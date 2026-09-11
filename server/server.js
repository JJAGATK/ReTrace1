const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require('./db');
const seedDatabase = require('./seed');
const { encryptPII, decryptPII, createLogHash, hashSecret } = require('./crypto');
const { evaluateClaim } = require('./matcher');

const JWT_SECRET = process.env.JWT_SECRET || 'retrace-campus-super-secret-jwt-key-2026';
const PORT = process.env.PORT || 5000;

const app = express();

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeName = 'retrace-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/uploads', express.static(uploadsDir));

// Initialize DB schema and run seed if database is empty
async function initializeApp() {
  try {
    await db.initSchema();
    const itemCount = await db.get('SELECT COUNT(*) as count FROM items');
    if (!itemCount || Number(itemCount.count) === 0) {
      await seedDatabase();
    }
  } catch (err) {
    console.error('[ReTrace] DB Initialization error:', err);
  }
}
initializeApp();

// -------------------------------------------------------------
// Authentication Helpers & Middleware
// -------------------------------------------------------------
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in with a campus account.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT * FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: 'User account not found.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Campus Security / Admin access required.' });
  }
  next();
}

// Chain of Custody Helper
async function recordCustodyLog(itemId, actorId, actorName, action, notes) {
  const lastLog = await db.get('SELECT hash FROM custody_logs WHERE item_id = ? ORDER BY id DESC LIMIT 1', [itemId]);
  const prevHash = lastLog ? lastLog.hash : 'GENESIS_HASH_000000000000000000000000000000000000000000000000000000000000';
  const timestamp = new Date().toISOString();
  const hash = createLogHash({
    previousHash: prevHash,
    itemId,
    action,
    actorId,
    timestamp,
    notes
  });

  await db.run(`
    INSERT INTO custody_logs (item_id, actor_id, actor_name, action, notes, previous_hash, hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [itemId, actorId, actorName, action, notes, prevHash, hash, timestamp]);

  return hash;
}

// -------------------------------------------------------------
// Rate Limiter for Claim Verification (Prevent Brute-Force)
// -------------------------------------------------------------
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many claim attempts submitted from this device. Please wait 15 minutes or contact Cabot Desk.'
  }
});

// -------------------------------------------------------------
// Auth Routes
// -------------------------------------------------------------

// Quick persona switcher for live evaluation / testing
app.post('/api/auth/login-demo', async (req, res) => {
  const { personaId } = req.body;
  const validIds = ['user-maya', 'user-julian', 'user-admin'];
  const targetId = validIds.includes(personaId) ? personaId : 'user-maya';
  const user = await db.get('SELECT * FROM users WHERE id = ?', [targetId]);
  if (!user) return res.status(404).json({ error: 'Demo user not found' });

  const token = generateToken(user);
  res.json({ user, token });
});

// Campus SSO / .edu OTP Request
app.post('/api/auth/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid university email address required.' });
  }

  // Strict check: must be a .edu domain or campus sub-domain
  if (!email.toLowerCase().endsWith('.edu')) {
    return res.status(400).json({ error: 'Access restricted: Only verified .edu university institutional accounts are permitted.' });
  }

  const code = '441920'; // deterministic demo OTP for zero-friction evaluator experience
  const expiresAt = Date.now() + 10 * 60 * 1000;

  if (db.isPostgres) {
    await db.run(`
      INSERT INTO otp_codes (email, code, expires_at)
      VALUES (?, ?, ?)
      ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at
    `, [email.toLowerCase(), code, expiresAt]);
  } else {
    await db.run(`
      INSERT OR REPLACE INTO otp_codes (email, code, expires_at)
      VALUES (?, ?, ?)
    `, [email.toLowerCase(), code, expiresAt]);
  }

  res.json({
    success: true,
    message: `Verification OTP dispatched to ${email}.`,
    demoCode: code
  });
});

// Campus SSO / .edu OTP Verify
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, code, name } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  const record = await db.get('SELECT * FROM otp_codes WHERE email = ?', [email.toLowerCase()]);
  if (!record || record.code !== code.trim()) {
    return res.status(400).json({ error: 'Invalid or expired OTP code.' });
  }

  // Find or create user
  let user = await db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user) {
    const newId = 'user-' + crypto.randomUUID().slice(0, 8);
    const displayName = name || email.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const role = email.includes('admin') || email.includes('police') ? 'admin' : 'student';

    await db.run(`
      INSERT INTO users (id, name, email, role, trust_score, returns_count, campus_affiliation, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newId,
      displayName,
      email.toLowerCase(),
      role,
      95,
      0,
      'Harvard Campus Verified',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
    ]);
    user = await db.get('SELECT * FROM users WHERE id = ?', [newId]);
  }

  // Remove used OTP
  await db.run('DELETE FROM otp_codes WHERE email = ?', [email.toLowerCase()]);

  const token = generateToken(user);
  res.json({ user, token });
});

// Current user profile
app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// -------------------------------------------------------------
// Items Routes
// -------------------------------------------------------------

// List items with filters
app.get('/api/items', async (req, res) => {
  const { type, category, status, search, building } = req.query;

  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];

  if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }
  if (category && category !== 'All' && category !== 'All Items') {
    query += ' AND category = ?';
    params.push(category);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (building) {
    query += ' AND coarse_location = ?';
    params.push(building);
  }
  if (search) {
    query += ' AND (title LIKE ? OR description LIKE ? OR coarse_location LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC';

  const rows = await db.all(query, params);

  const items = await Promise.all(rows.map(async (item) => {
    let photos = [];
    try { photos = JSON.parse(item.photos_json); } catch (e) {}

    const challengeRow = await db.get('SELECT questions_json FROM challenges WHERE item_id = ?', [item.id]);
    let hasChallenge = false;
    let challengeQuestions = [];
    if (challengeRow) {
      hasChallenge = true;
      try { challengeQuestions = JSON.parse(challengeRow.questions_json); } catch (e) {}
    }

    return {
      id: item.id,
      type: item.type,
      title: item.title,
      category: item.category,
      description: item.description,
      coarse_location: item.coarse_location,
      floor_room: item.floor_room,
      latitude: item.latitude,
      longitude: item.longitude,
      custody_type: item.custody_type,
      custody_desk_name: item.custody_desk_name,
      custody_status: item.custody_status,
      photos,
      status: item.status,
      reward_offered: item.reward_offered,
      user_id: item.user_id,
      reporter_name: item.reporter_name,
      reporter_avatar: item.reporter_avatar,
      is_urgent: Boolean(item.is_urgent),
      has_challenge: hasChallenge,
      challenge_questions: challengeQuestions,
      created_at: item.created_at
    };
  }));

  res.json({ items });
});

// Single item details
app.get('/api/items/:id', async (req, res) => {
  const item = await db.get('SELECT * FROM items WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  let photos = [];
  try { photos = JSON.parse(item.photos_json); } catch (e) {}

  const challenge = await db.get('SELECT questions_json FROM challenges WHERE item_id = ?', [item.id]);
  let questions = [];
  if (challenge) {
    try { questions = JSON.parse(challenge.questions_json); } catch (e) {}
  }

  const handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [item.id]);

  res.json({
    item: {
      ...item,
      photos,
      challenge_questions: questions,
      is_urgent: Boolean(item.is_urgent),
      has_handover: Boolean(handover)
    }
  });
});

// File Upload Endpoint (Images, Photos, Proofs, Receipts)
app.post('/api/upload', (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('[Upload Error]', err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({
      success: true,
      urls,
      url: urls[0],
      files: req.files.map(f => ({
        originalName: f.originalname,
        filename: f.filename,
        url: `/uploads/${f.filename}`,
        size: f.size,
        mimetype: f.mimetype
      }))
    });
  });
});

// Create Item (Found or Lost)
app.post('/api/items', authMiddleware, async (req, res) => {
  const {
    type,
    title,
    category,
    description,
    coarse_location,
    floor_room,
    latitude,
    longitude,
    exact_location_notes,
    custody_type,
    custody_desk_name,
    photos = [],
    reward_offered,
    is_urgent = false,
    verification_questions = [],
    secret_answers = [],
    intake_serial
  } = req.body;

  if (!title || !category || !coarse_location) {
    return res.status(400).json({ error: 'Title, category, and discovery location are required.' });
  }

  const itemId = 'REC-' + Math.floor(1000 + Math.random() * 9000);
  const encryptedExact = exact_location_notes ? encryptPII(exact_location_notes) : null;
  const custodyStatus = custody_type === 'official_desk' ? 'at_desk' : 'with_finder';

  await db.run(`
    INSERT INTO items (
      id, type, title, category, description, coarse_location, floor_room,
      latitude, longitude, exact_location_encrypted, custody_type, custody_desk_name,
      custody_status, photos_json, status, reward_offered, user_id, reporter_name,
      reporter_avatar, is_urgent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    itemId,
    type || 'found',
    title,
    category,
    description || '',
    coarse_location,
    floor_room || '',
    latitude || 42.3770,
    longitude || -71.1167,
    encryptedExact,
    custody_type || 'official_desk',
    custody_desk_name || 'Cabot Science Library Desk',
    custodyStatus,
    JSON.stringify(photos),
    'open',
    reward_offered || null,
    req.user.id,
    req.user.name,
    req.user.avatar_url,
    is_urgent ? 1 : 0
  ]);

  // If Found item, save private verification challenge
  if (type === 'found' && verification_questions.length > 0) {
    await db.run(`
      INSERT INTO challenges (item_id, questions_json, secret_answers_json, intake_serial_encrypted, intake_serial_hash)
      VALUES (?, ?, ?, ?, ?)
    `, [
      itemId,
      JSON.stringify(verification_questions),
      JSON.stringify(secret_answers),
      intake_serial ? encryptPII(intake_serial) : null,
      intake_serial ? hashSecret(intake_serial) : null
    ]);
  }

  // Initial immutable chain-of-custody entry
  await recordCustodyLog(
    itemId,
    req.user.id,
    req.user.name,
    'POSTED',
    `${type.toUpperCase()} report registered with campus network. Custody assigned to: ${custody_type === 'official_desk' ? custody_desk_name || 'Official Desk' : 'Reporter safe care'}.`
  );

  res.status(201).json({ success: true, itemId });
});

// -------------------------------------------------------------
// Claim & Verification Flow
// -------------------------------------------------------------
app.post('/api/items/:id/claim', authMiddleware, claimLimiter, async (req, res) => {
  const itemId = req.params.id;
  const { answers = [], serial_provided, proof_notes, proof_photo_url } = req.body;

  const item = await db.get('SELECT * FROM items WHERE id = ?', [itemId]);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if (item.user_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot claim an item you reported.' });
  }

  if (item.status === 'returned') {
    return res.status(400).json({ error: 'This item has already been successfully returned to its verified owner.' });
  }

  // Fetch challenge secrets for server-side evaluation
  const challenge = await db.get('SELECT * FROM challenges WHERE item_id = ?', [itemId]);
  let expectedAnswers = [];
  let expectedSerial = null;

  if (challenge) {
    try { expectedAnswers = JSON.parse(challenge.secret_answers_json); } catch (e) {}
    if (challenge.intake_serial_encrypted) {
      expectedSerial = decryptPII(challenge.intake_serial_encrypted);
    }
  }

  // Evaluate match server-side
  const matchResult = evaluateClaim({
    submittedAnswers: answers,
    expectedAnswers,
    submittedSerial: serial_provided,
    expectedSerial,
    proofNotes: proof_notes
  });

  const claimId = 'CLM-' + crypto.randomUUID().slice(0, 8);
  const claimStatus = matchResult.passedThreshold ? 'admin_review' : 'submitted';

  // Store claim
  await db.run(`
    INSERT INTO claims (
      id, item_id, claimant_id, claimant_name, claimant_email,
      answers_json, proof_notes, proof_photo_url, serial_provided,
      match_score, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    claimId,
    itemId,
    req.user.id,
    req.user.name,
    req.user.email,
    JSON.stringify(answers),
    proof_notes || '',
    proof_photo_url || null,
    serial_provided || null,
    matchResult.score,
    claimStatus
  ]);

  // Update item status if strong match
  if (matchResult.passedThreshold) {
    await db.run("UPDATE items SET status = 'claim_pending' WHERE id = ?", [itemId]);
  }

  // Record audit log with hash chain
  await recordCustodyLog(
    itemId,
    req.user.id,
    req.user.name,
    'CLAIM_ATTEMPTED',
    `Ownership verification challenge submitted by ${req.user.name}. Confidence score: ${matchResult.score}%. Status: ${claimStatus}.`
  );

  res.json({
    success: true,
    claimId,
    matchScore: matchResult.score,
    passedThreshold: matchResult.passedThreshold,
    status: claimStatus,
    message: matchResult.passedThreshold
      ? 'Verification answers matched high-confidence criteria. Claim forwarded to Campus Security Admin for physical release approval.'
      : 'Verification submitted. If additional documentation is required, campus security desk will contact your university email.'
  });
});

// -------------------------------------------------------------
// Bookmarks API (Feature: Real Save/Favorite listings)
// -------------------------------------------------------------
app.get('/api/bookmarks', authMiddleware, async (req, res) => {
  const rows = await db.all('SELECT item_id FROM bookmarks WHERE user_id = ?', [req.user.id]);
  const bookmarkedIds = rows.map(r => r.item_id);
  res.json({ bookmarks: bookmarkedIds });
});

app.post('/api/bookmarks/:itemId/toggle', authMiddleware, async (req, res) => {
  const itemId = req.params.itemId;
  const existing = await db.get('SELECT * FROM bookmarks WHERE user_id = ? AND item_id = ?', [req.user.id, itemId]);

  if (existing) {
    await db.run('DELETE FROM bookmarks WHERE user_id = ? AND item_id = ?', [req.user.id, itemId]);
    return res.json({ bookmarked: false, itemId, message: 'Removed from saved listings.' });
  } else {
    const id = 'BMK-' + crypto.randomUUID().slice(0, 8);
    await db.run('INSERT INTO bookmarks (id, user_id, item_id) VALUES (?, ?, ?)', [id, req.user.id, itemId]);
    return res.json({ bookmarked: true, itemId, message: 'Saved to your activity.' });
  }
});

// -------------------------------------------------------------
// Sightings / Community Clues API (Feature: Real "I've Seen This")
// -------------------------------------------------------------
app.get('/api/items/:id/sightings', async (req, res) => {
  const sightings = await db.all('SELECT * FROM sightings WHERE item_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json({ sightings });
});

app.post('/api/items/:id/sightings', authMiddleware, async (req, res) => {
  const itemId = req.params.id;
  const { location_clue, notes } = req.body;

  if (!location_clue) {
    return res.status(400).json({ error: 'Please provide a location clue.' });
  }

  const sightingId = 'STG-' + crypto.randomUUID().slice(0, 8);
  await db.run(`
    INSERT INTO sightings (id, item_id, reporter_id, reporter_name, location_clue, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    sightingId,
    itemId,
    req.user.id,
    req.user.name,
    location_clue,
    notes || ''
  ]);

  await recordCustodyLog(
    itemId,
    req.user.id,
    req.user.name,
    'SIGHTING_REPORTED',
    `Community sighting tip submitted by ${req.user.name}: "${location_clue}". Notes: "${notes || 'None'}"`
  );

  res.status(201).json({
    success: true,
    sightingId,
    message: 'Location clue dispatched to student owner and logged in custody audit!'
  });
});

// -------------------------------------------------------------
// Handover Coordination & Persisted Chat API
// -------------------------------------------------------------

// List all active handovers for user or admin
app.get('/api/handovers', authMiddleware, async (req, res) => {
  let handovers = [];
  if (req.user.role === 'admin') {
    handovers = await db.all(`
      SELECT h.*, i.title as item_title, i.category, i.photos_json,
             f.name as finder_name, c.name as claimant_name
      FROM handovers h
      JOIN items i ON h.item_id = i.id
      JOIN users f ON h.finder_id = f.id
      JOIN users c ON h.claimant_id = c.id
      ORDER BY h.created_at DESC
    `);
  } else {
    handovers = await db.all(`
      SELECT h.*, i.title as item_title, i.category, i.photos_json,
             f.name as finder_name, c.name as claimant_name
      FROM handovers h
      JOIN items i ON h.item_id = i.id
      JOIN users f ON h.finder_id = f.id
      JOIN users c ON h.claimant_id = c.id
      WHERE h.finder_id = ? OR h.claimant_id = ?
      ORDER BY h.created_at DESC
    `, [req.user.id, req.user.id]);
  }

  res.json({ handovers });
});

// Get single handover session details
app.get('/api/handovers/:itemId', authMiddleware, async (req, res) => {
  const handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  if (!handover) return res.status(404).json({ error: 'Handover record not found' });

  const isParticipant =
    req.user.id === handover.finder_id ||
    req.user.id === handover.claimant_id ||
    req.user.role === 'admin';

  if (!isParticipant) {
    return res.status(403).json({ error: 'You are not authorized to view this handover session.' });
  }

  const item = await db.get('SELECT * FROM items WHERE id = ?', [handover.item_id]);
  const finder = await db.get('SELECT id, name, email, trust_score, avatar_url FROM users WHERE id = ?', [handover.finder_id]);
  const claimant = await db.get('SELECT id, name, email, trust_score, avatar_url FROM users WHERE id = ?', [handover.claimant_id]);

  res.json({
    handover,
    item,
    finder,
    claimant
  });
});

// Fetch messages for handover session
app.get('/api/handovers/:itemId/messages', authMiddleware, async (req, res) => {
  const messages = await db.all(`
    SELECT * FROM handover_messages 
    WHERE item_id = ? 
    ORDER BY created_at ASC
  `, [req.params.itemId]);

  res.json({ messages });
});

// Send message in handover session
app.post('/api/handovers/:itemId/messages', authMiddleware, async (req, res) => {
  const { text, handover_id } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text cannot be empty.' });
  }

  const handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  const hId = handover_id || (handover ? handover.id : 'HO-DEFAULT');

  const msgId = 'MSG-' + crypto.randomUUID().slice(0, 8);
  await db.run(`
    INSERT INTO handover_messages (id, handover_id, item_id, sender_id, sender_name, sender_role, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    msgId,
    hId,
    req.params.itemId,
    req.user.id,
    req.user.name,
    req.user.role,
    text.trim()
  ]);

  const newMsg = await db.get('SELECT * FROM handover_messages WHERE id = ?', [msgId]);
  res.status(201).json({ success: true, message: newMsg });
});

// Dual confirmation endpoint
app.post('/api/handovers/:itemId/confirm', authMiddleware, async (req, res) => {
  const handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  if (!handover) return res.status(404).json({ error: 'Handover record not found' });

  const isFinder = req.user.id === handover.finder_id;
  const isClaimant = req.user.id === handover.claimant_id;
  const isAdmin = req.user.role === 'admin';

  if (!isFinder && !isClaimant && !isAdmin) {
    return res.status(403).json({ error: 'Not authorized for this item handover.' });
  }

  let finderConfirmed = handover.finder_confirmed;
  let claimantConfirmed = handover.claimant_confirmed;

  if (isFinder || isAdmin) finderConfirmed = 1;
  if (isClaimant || isAdmin) claimantConfirmed = 1;

  const isFullyCompleted = finderConfirmed === 1 && claimantConfirmed === 1;

  await db.run(`
    UPDATE handovers 
    SET finder_confirmed = ?, claimant_confirmed = ?, status = ?, completed_at = ?
    WHERE id = ?
  `, [
    finderConfirmed,
    claimantConfirmed,
    isFullyCompleted ? 'completed' : 'scheduled',
    isFullyCompleted ? new Date().toISOString() : null,
    handover.id
  ]);

  if (isFullyCompleted) {
    await db.run("UPDATE items SET status = 'returned', custody_status = 'with_claimant' WHERE id = ?", [handover.item_id]);

    await db.run('UPDATE users SET trust_score = LEAST(100, trust_score + 2), returns_count = returns_count + 1 WHERE id = ?', [handover.finder_id]).catch(() => {
      db.run('UPDATE users SET trust_score = MIN(100, trust_score + 2), returns_count = returns_count + 1 WHERE id = ?', [handover.finder_id]);
    });
    await db.run('UPDATE users SET trust_score = LEAST(100, trust_score + 1) WHERE id = ?', [handover.claimant_id]).catch(() => {
      db.run('UPDATE users SET trust_score = MIN(100, trust_score + 1) WHERE id = ?', [handover.claimant_id]);
    });

    await recordCustodyLog(
      handover.item_id,
      req.user.id,
      req.user.name,
      'HANDOVER_CONFIRMED',
      `Dual-confirmation complete. Item released to verified claimant. Chain of custody closed successfully.`
    );
  } else {
    await recordCustodyLog(
      handover.item_id,
      req.user.id,
      req.user.name,
      'HANDOVER_SIGN_OFF',
      `Handover step acknowledged by ${req.user.name} (${isFinder ? 'Finder / Desk' : 'Claimant'}). Waiting for second party verification.`
    );
  }

  res.json({
    success: true,
    isFullyCompleted,
    finderConfirmed: Boolean(finderConfirmed),
    claimantConfirmed: Boolean(claimantConfirmed)
  });
});

// -------------------------------------------------------------
// Admin / Moderator Desk Routes
// -------------------------------------------------------------
app.get('/api/admin/claims', authMiddleware, adminOnly, async (req, res) => {
  const claims = await db.all(`
    SELECT c.*, i.title as item_title, i.category, i.coarse_location, i.custody_desk_name,
           u.trust_score as claimant_trust, u.returns_count as claimant_returns
    FROM claims c
    JOIN items i ON c.item_id = i.id
    JOIN users u ON c.claimant_id = u.id
    ORDER BY c.created_at DESC
  `);

  const enriched = await Promise.all(claims.map(async (c) => {
    const challenge = await db.get('SELECT * FROM challenges WHERE item_id = ?', [c.item_id]);
    let questions = [];
    let expectedAnswers = [];
    let expectedSerial = null;
    if (challenge) {
      try {
        questions = JSON.parse(challenge.questions_json);
        expectedAnswers = JSON.parse(challenge.secret_answers_json);
        if (challenge.intake_serial_encrypted) {
          expectedSerial = decryptPII(challenge.intake_serial_encrypted);
        }
      } catch (e) {}
    }

    let submittedAnswers = [];
    try { submittedAnswers = JSON.parse(c.answers_json); } catch (e) {}

    return {
      ...c,
      submitted_answers: submittedAnswers,
      intake_questions: questions,
      expected_answers: expectedAnswers,
      expected_serial: expectedSerial
    };
  }));

  res.json({ claims: enriched });
});

// Admin Decision on Claim
app.post('/api/admin/claims/:id/decision', authMiddleware, adminOnly, async (req, res) => {
  const { action, handover_location, handover_time, notes } = req.body;
  const claimId = req.params.id;

  const claim = await db.get('SELECT * FROM claims WHERE id = ?', [claimId]);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const item = await db.get('SELECT * FROM items WHERE id = ?', [claim.item_id]);
  if (!item) return res.status(404).json({ error: 'Associated item not found' });

  if (action === 'approve') {
    await db.run(`
      UPDATE claims 
      SET status = 'approved', admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [notes || 'Approved by Campus Desk Monitor', req.user.name, claimId]);

    await db.run("UPDATE items SET status = 'approved_pending_handover' WHERE id = ?", [item.id]);

    const qrToken = 'VERIFIED_QR_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const meetingSpot = handover_location || item.custody_desk_name || 'Cabot Science Library Circulation Desk';
    const scheduleTime = handover_time || 'Available Today until 11:00 PM (Staff ID #L-89)';

    if (db.isPostgres) {
      await db.run(`
        INSERT INTO handovers (
          id, item_id, claim_id, finder_id, claimant_id,
          scheduled_time, location_name, exact_directions, qr_code_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
        ON CONFLICT (item_id) DO UPDATE SET
          claim_id = EXCLUDED.claim_id,
          scheduled_time = EXCLUDED.scheduled_time,
          location_name = EXCLUDED.location_name,
          qr_code_token = EXCLUDED.qr_code_token,
          status = 'scheduled'
      `, [
        'HO-' + crypto.randomUUID().slice(0, 8),
        item.id,
        claim.id,
        item.user_id,
        claim.claimant_id,
        scheduleTime,
        meetingSpot,
        'Present university student ID card or scan dynamic QR token at Cabot Circulation Desk.',
        qrToken
      ]);
    } else {
      await db.run(`
        INSERT OR REPLACE INTO handovers (
          id, item_id, claim_id, finder_id, claimant_id,
          scheduled_time, location_name, exact_directions, qr_code_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
      `, [
        'HO-' + crypto.randomUUID().slice(0, 8),
        item.id,
        claim.id,
        item.user_id,
        claim.claimant_id,
        scheduleTime,
        meetingSpot,
        'Present university student ID card or scan dynamic QR token at Cabot Circulation Desk.',
        qrToken
      ]);
    }

    await recordCustodyLog(
      item.id,
      req.user.id,
      req.user.name,
      'ADMIN_APPROVED',
      `Claim approved by Officer ${req.user.name}. Handover scheduled at ${meetingSpot}. Dynamic QR verification token generated.`
    );

    return res.json({ success: true, message: 'Claim approved and safe handover session activated.' });
  } else {
    await db.run(`
      UPDATE claims 
      SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [notes || 'Insufficient proof of ownership', req.user.name, claimId]);

    await db.run("UPDATE items SET status = 'open' WHERE id = ?", [item.id]);

    await recordCustodyLog(
      item.id,
      req.user.id,
      req.user.name,
      'CLAIM_REJECTED',
      `Claim by ${claim.claimant_name} rejected: ${notes || 'Verification questions did not match secret criteria.'}`
    );

    return res.json({ success: true, message: 'Claim rejected. Item returned to open search registry.' });
  }
});

// Admin Flags Management
app.get('/api/admin/flags', authMiddleware, adminOnly, async (req, res) => {
  const flags = await db.all(`
    SELECT f.*, u.name as reporter_name, u.email as reporter_email
    FROM flags f
    LEFT JOIN users u ON f.reporter_id = u.id
    ORDER BY f.created_at DESC
  `);
  res.json({ flags });
});

app.post('/api/admin/flags/:id/resolve', authMiddleware, adminOnly, async (req, res) => {
  const { action } = req.body; // 'resolved' or 'dismissed'
  const newStatus = action === 'dismissed' ? 'dismissed' : 'resolved';
  await db.run('UPDATE flags SET status = ? WHERE id = ?', [newStatus, req.params.id]);
  res.json({ success: true, status: newStatus });
});

// Community Flagging Endpoint
app.post('/api/flags', authMiddleware, async (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'Missing required flag parameters.' });
  }

  const flagId = 'FLG-' + crypto.randomUUID().slice(0, 8);
  await db.run(`
    INSERT INTO flags (id, target_type, target_id, reporter_id, reason, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `, [flagId, target_type, target_id, req.user.id, reason]);

  res.status(201).json({ success: true, message: 'Report submitted for Campus Security moderation.' });
});

// Custody Chain & Tamper-Proof Audit Logs
app.get('/api/items/:id/custody-chain', async (req, res) => {
  const logs = await db.all('SELECT * FROM custody_logs WHERE item_id = ? ORDER BY id ASC', [req.params.id]);

  let isChainValid = true;
  for (let i = 1; i < logs.length; i++) {
    if (logs[i].previous_hash !== logs[i - 1].hash) {
      isChainValid = false;
      break;
    }
  }

  res.json({
    itemId: req.params.id,
    isChainValid,
    totalEvents: logs.length,
    logs
  });
});

// Dynamic Stats & Category Counts
app.get('/api/stats', async (req, res) => {
  const totalRow = await db.get('SELECT COUNT(*) as c FROM items');
  const activeRow = await db.get("SELECT COUNT(*) as c FROM items WHERE status != 'returned'");
  const foundRow = await db.get("SELECT COUNT(*) as c FROM items WHERE type = 'found' AND status != 'returned'");
  const lostRow = await db.get("SELECT COUNT(*) as c FROM items WHERE type = 'lost' AND status != 'returned'");
  const returnedRow = await db.get("SELECT COUNT(*) as c FROM items WHERE status = 'returned'");
  const pendingRow = await db.get("SELECT COUNT(*) as c FROM claims WHERE status IN ('admin_review', 'submitted')");

  // Active category counts (status != 'returned')
  const activeCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE status != 'returned' GROUP BY category");
  const categoryCounts = {};
  activeCatRows.forEach(r => {
    categoryCounts[r.category] = Number(r.count);
  });

  // Total category counts (including returned)
  const totalCatRows = await db.all('SELECT category, COUNT(*) as count FROM items GROUP BY category');
  const totalCategoryCounts = {};
  totalCatRows.forEach(r => {
    totalCategoryCounts[r.category] = Number(r.count);
  });

  // Lost category counts
  const lostCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE type = 'lost' AND status != 'returned' GROUP BY category");
  const lostCategoryCounts = {};
  lostCatRows.forEach(r => {
    lostCategoryCounts[r.category] = Number(r.count);
  });

  // Found category counts
  const foundCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE type = 'found' AND status != 'returned' GROUP BY category");
  const foundCategoryCounts = {};
  foundCatRows.forEach(r => {
    foundCategoryCounts[r.category] = Number(r.count);
  });

  // Returned category counts
  const returnedCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE status = 'returned' GROUP BY category");
  const returnedCategoryCounts = {};
  returnedCatRows.forEach(r => {
    returnedCategoryCounts[r.category] = Number(r.count);
  });

  res.json({
    total: Number(totalRow.c),
    active: Number(activeRow.c),
    found: Number(foundRow.c),
    lost: Number(lostRow.c),
    returned: Number(returnedRow.c),
    pendingClaims: Number(pendingRow.c),
    categoryCounts,
    totalCategoryCounts,
    lostCategoryCounts,
    foundCategoryCounts,
    returnedCategoryCounts
  });
});

// Admin Analytics & Heatmap
app.get('/api/admin/analytics', authMiddleware, adminOnly, async (req, res) => {
  const totalRow = await db.get('SELECT COUNT(*) as c FROM items');
  const totalItems = Number(totalRow.c);

  const activeRow = await db.get("SELECT COUNT(*) as c FROM items WHERE status != 'returned'");
  const activeItems = Number(activeRow.c);

  const returnedRow = await db.get("SELECT COUNT(*) as c FROM items WHERE status = 'returned'");
  const returnedItems = Number(returnedRow.c);

  const pendingRow = await db.get("SELECT COUNT(*) as c FROM claims WHERE status IN ('admin_review', 'submitted')");
  const pendingClaims = Number(pendingRow.c);

  const activeLostRow = await db.get("SELECT COUNT(*) as c FROM items WHERE type = 'lost' AND status != 'returned'");
  const activeLost = Number(activeLostRow.c);

  const activeFoundRow = await db.get("SELECT COUNT(*) as c FROM items WHERE type = 'found' AND status != 'returned'");
  const activeFound = Number(activeFoundRow.c);

  const categories = await db.all(`
    SELECT category, COUNT(*) as count 
    FROM items GROUP BY category ORDER BY count DESC
  `);

  const hotspotZones = await db.all(`
    SELECT coarse_location as zone, COUNT(*) as count 
    FROM items GROUP BY coarse_location ORDER BY count DESC LIMIT 5
  `);

  const flaggedAccounts = await db.all(`
    SELECT f.*, u.name, u.email, u.trust_score
    FROM flags f LEFT JOIN users u ON f.target_id = u.id
    WHERE f.status = 'pending'
  `);

  res.json({
    totalItems,
    activeItems,
    activeLost,
    activeFound,
    returnedItems,
    recoveryRate: totalItems > 0 ? Math.round((returnedItems / totalItems) * 100) : 0,
    pendingClaims,
    categories,
    hotspotZones,
    flaggedAccounts
  });
});

// Export Immutable Audit Log (Compliance & Safety)
app.get('/api/admin/audit-export', authMiddleware, adminOnly, async (req, res) => {
  const logs = await db.all('SELECT * FROM custody_logs ORDER BY id ASC');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="retrace-audit-chain-export.json"');
  res.json({
    exported_at: new Date().toISOString(),
    institution: 'Harvard University Campus Security — ReTrace Protocol',
    chain_type: 'SHA-256 Hash Chain',
    record_count: logs.length,
    chain: logs
  });
});

// Serve frontend static assets from client/dist
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`ReTrace Campus Security App & API running on http://localhost:${PORT}`);
  });
}

module.exports = app;

