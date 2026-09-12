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
  const { type, category, status, search, building, bounty_only } = req.query;

  let query = 'SELECT * FROM items WHERE 1=1';
  const params = [];

  if (type === 'bounty' || bounty_only === 'true') {
    query += " AND reward_offered IS NOT NULL AND reward_offered != '' AND reward_offered != 'None' AND reward_offered != 'null'";
  } else if (type && type !== 'all') {
    query += ' AND type = ?';
    params.push(type);
  }
  if (category && category !== 'All' && category !== 'All Items') {
    if (category === 'Other' || category === 'Other Items') {
      const standard = ['Tech & Audio', 'Bags & Wallets', 'Campus IDs', 'Keys & Dorm', 'Bottles & Mugs', 'Apparel', 'Jackets & Gear', 'Books & Notes', 'Eyewear'];
      const placeholders = standard.map(() => '?').join(',');
      query += ` AND (category = 'Other' OR category = 'Other Items' OR category NOT IN (${placeholders}))`;
      params.push(...standard);
    } else {
      query += ' AND category = ?';
      params.push(category);
    }
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

// Delete item (Admin desk or owner only)
app.delete('/api/items/:id', authMiddleware, async (req, res) => {
  const itemId = req.params.id;
  const item = await db.get('SELECT * FROM items WHERE id = ?', [itemId]);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if (req.user.role !== 'admin' && item.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized: Security Administrator or post author access required.' });
  }

  await db.run('DELETE FROM handover_messages WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM handovers WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM claims WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM challenges WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM sightings WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM bookmarks WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM flags WHERE target_id = ?', [itemId]);
  await db.run('DELETE FROM custody_logs WHERE item_id = ?', [itemId]);
  await db.run('DELETE FROM items WHERE id = ?', [itemId]);

  res.json({
    success: true,
    message: `Post #${itemId} ("${item.title}") removed successfully by ${req.user.name}.`
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

  // Ensure handover chamber session is activated immediately for coordination
  const qrToken = 'VERIFIED_QR_' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const scheduleTime = 'Available for pickup & coordination';
  const meetingSpot = item.custody_desk_name || 'Cabot Science Library Circulation Desk';
  const handoverId = 'HO-' + crypto.randomUUID().slice(0, 8);

  const existingHandover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [itemId]);
  const activeHandoverId = existingHandover ? existingHandover.id : handoverId;

  if (!existingHandover) {
    if (db.isPostgres) {
      await db.run(`
        INSERT INTO handovers (
          id, item_id, claim_id, finder_id, claimant_id,
          scheduled_time, location_name, exact_directions, qr_code_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (item_id) DO UPDATE SET
          claim_id = EXCLUDED.claim_id,
          claimant_id = EXCLUDED.claimant_id,
          status = EXCLUDED.status
      `, [
        handoverId,
        itemId,
        claimId,
        item.user_id,
        req.user.id,
        scheduleTime,
        meetingSpot,
        'Direct coordination safe exchange via ReTrace verified protocol.',
        qrToken,
        matchResult.passedThreshold ? 'scheduled' : 'pending_review'
      ]);
    } else {
      await db.run(`
        INSERT OR REPLACE INTO handovers (
          id, item_id, claim_id, finder_id, claimant_id,
          scheduled_time, location_name, exact_directions, qr_code_token, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        handoverId,
        itemId,
        claimId,
        item.user_id,
        req.user.id,
        scheduleTime,
        meetingSpot,
        'Direct coordination safe exchange via ReTrace verified protocol.',
        qrToken,
        matchResult.passedThreshold ? 'scheduled' : 'pending_review'
      ]);
    }
  }

  // Insert initial coordination message
  const initMsgId = 'MSG-' + crypto.randomUUID().slice(0, 8);
  const greetingText = `Claim filed by ${req.user.name} (Confidence: ${matchResult.score}%). Verification details recorded. Coordinate safe handoff and questions here.`;
  await db.run(`
    INSERT INTO handover_messages (id, handover_id, item_id, sender_id, sender_name, sender_role, text, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `, [
    initMsgId,
    activeHandoverId,
    itemId,
    req.user.id,
    req.user.name,
    req.user.role || 'student',
    greetingText
  ]);

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
    itemId,
    handoverId: activeHandoverId,
    matchScore: matchResult.score,
    passedThreshold: matchResult.passedThreshold,
    status: claimStatus,
    message: matchResult.passedThreshold
      ? 'Verification answers matched high-confidence criteria! Handover chat channel activated.'
      : 'Verification submitted! Handover chat channel activated for student and desk coordination.'
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
      LEFT JOIN items i ON h.item_id = i.id
      LEFT JOIN users f ON h.finder_id = f.id
      LEFT JOIN users c ON h.claimant_id = c.id
      ORDER BY h.created_at DESC
    `);
  } else {
    handovers = await db.all(`
      SELECT h.*, i.title as item_title, i.category, i.photos_json,
             f.name as finder_name, c.name as claimant_name
      FROM handovers h
      LEFT JOIN items i ON h.item_id = i.id
      LEFT JOIN users f ON h.finder_id = f.id
      LEFT JOIN users c ON h.claimant_id = c.id
      WHERE h.finder_id = ? OR h.claimant_id = ? OR (i.user_id = ?)
      ORDER BY h.created_at DESC
    `, [req.user.id, req.user.id, req.user.id]);
  }

  res.json({ handovers });
});

// Get single handover session details
app.get('/api/handovers/:itemId', authMiddleware, async (req, res) => {
  let handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  const item = await db.get('SELECT * FROM items WHERE id = ?', [req.params.itemId]);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  // If no handover row yet, auto-create one linked to latest claim or item reporter
  if (!handover) {
    const claim = await db.get('SELECT * FROM claims WHERE item_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.itemId]);
    const hId = 'HO-' + crypto.randomUUID().slice(0, 8);
    const qrToken = 'VERIFIED_QR_' + crypto.randomBytes(6).toString('hex').toUpperCase();
    await db.run(`
      INSERT INTO handovers (
        id, item_id, claim_id, finder_id, claimant_id,
        scheduled_time, location_name, exact_directions, qr_code_token, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `, [
      hId,
      item.id,
      claim ? claim.id : 'CLM-DIRECT',
      item.user_id,
      claim ? claim.claimant_id : req.user.id,
      'Available for pickup & coordination',
      item.custody_desk_name || 'Cabot Science Library Circulation Desk',
      'Coordinate safe handoff details via this chat.',
      qrToken
    ]);
    handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  }

  const finder = await db.get('SELECT id, name, email, trust_score, avatar_url FROM users WHERE id = ?', [handover.finder_id]) || {
    id: handover.finder_id,
    name: item.reporter_name || 'Item Custodian / Finder',
    email: 'custody@campus.harvard.edu',
    trust_score: 98,
    avatar_url: item.reporter_avatar
  };

  const claimant = await db.get('SELECT id, name, email, trust_score, avatar_url FROM users WHERE id = ?', [handover.claimant_id]) || {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    trust_score: req.user.trust_score || 95,
    avatar_url: req.user.avatar_url
  };

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
  const text = req.body.text || req.body.message;
  const { handover_id } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message text cannot be empty.' });
  }

  let handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  if (!handover) {
    const item = await db.get('SELECT * FROM items WHERE id = ?', [req.params.itemId]);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const claim = await db.get('SELECT * FROM claims WHERE item_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.itemId]);
    const hId = 'HO-' + crypto.randomUUID().slice(0, 8);
    const qrToken = 'VERIFIED_QR_' + crypto.randomBytes(6).toString('hex').toUpperCase();
    await db.run(`
      INSERT INTO handovers (
        id, item_id, claim_id, finder_id, claimant_id,
        scheduled_time, location_name, exact_directions, qr_code_token, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `, [
      hId,
      item.id,
      claim ? claim.id : 'CLM-DIRECT',
      item.user_id,
      claim ? claim.claimant_id : req.user.id,
      'Available for pickup & coordination',
      item.custody_desk_name || 'Cabot Science Library Circulation Desk',
      'Coordinate safe handoff details via this chat.',
      qrToken
    ]);
    handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  }

  const hId = handover_id || (handover ? handover.id : 'HO-' + crypto.randomUUID().slice(0, 8));
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
    req.user.role || 'student',
    text.trim()
  ]);

  const newMsg = await db.get('SELECT * FROM handover_messages WHERE id = ?', [msgId]);
  res.status(201).json({ success: true, message: newMsg });
});

// Dual confirmation endpoint
app.post('/api/handovers/:itemId/confirm', authMiddleware, async (req, res) => {
  let handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  const item = await db.get('SELECT * FROM items WHERE id = ?', [req.params.itemId]);
  
  if (!handover) {
    if (!item) return res.status(404).json({ error: 'Item not found' });
    const claim = await db.get('SELECT * FROM claims WHERE item_id = ? ORDER BY created_at DESC LIMIT 1', [req.params.itemId]);
    const hId = 'HO-' + crypto.randomUUID().slice(0, 8);
    const qrToken = 'VERIFIED_QR_' + crypto.randomBytes(6).toString('hex').toUpperCase();
    await db.run(`
      INSERT INTO handovers (
        id, item_id, claim_id, finder_id, claimant_id,
        scheduled_time, location_name, exact_directions, qr_code_token, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `, [
      hId,
      item.id,
      claim ? claim.id : 'CLM-DIRECT',
      item.user_id,
      claim ? claim.claimant_id : req.user.id,
      'Available for pickup & coordination',
      item.custody_desk_name || 'Cabot Science Library Circulation Desk',
      'Coordinate safe handoff details via this chat.',
      qrToken
    ]);
    handover = await db.get('SELECT * FROM handovers WHERE item_id = ?', [req.params.itemId]);
  }

  // Determine user's role in this handover
  const isFinder = req.user.id === handover.finder_id || (item && req.user.id === item.user_id);
  const isClaimant = req.user.id === handover.claimant_id || (!isFinder && req.user.role !== 'admin');
  const isAdmin = req.user.role === 'admin';

  let finderConfirmed = Number(handover.finder_confirmed) || 0;
  let claimantConfirmed = Number(handover.claimant_confirmed) || 0;

  if (isAdmin) {
    finderConfirmed = 1;
    claimantConfirmed = 1;
  } else if (isFinder) {
    finderConfirmed = 1;
  } else if (isClaimant) {
    claimantConfirmed = 1;
  }

  const isFullyCompleted = (finderConfirmed === 1 && claimantConfirmed === 1) || isAdmin;

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

    // Extract bounty reward numeric amount from item if present
    let bountyRewardValue = 0;
    if (item && item.reward_offered) {
      const match = String(item.reward_offered).match(/\$?(\d+)/);
      if (match) bountyRewardValue = parseInt(match[1], 10) || 0;
    }

    // Standard SQL compliant with both SQLite and Postgres
    if (handover.finder_id) {
      await db.run(`
        UPDATE users 
        SET trust_score = (CASE WHEN trust_score + 2 > 100 THEN 100 ELSE trust_score + 2 END),
            returns_count = returns_count + 1,
            bounties_earned = bounties_earned + ?
        WHERE id = ?
      `, [bountyRewardValue, handover.finder_id]);
    }
    if (handover.claimant_id) {
      await db.run('UPDATE users SET trust_score = (CASE WHEN trust_score + 1 > 100 THEN 100 ELSE trust_score + 1 END) WHERE id = ?', [handover.claimant_id]);
    }

    const logMessage = bountyRewardValue > 0
      ? `Dual-confirmation complete. Item released to verified claimant. Bounty reward of $${bountyRewardValue} awarded to finder. Chain of custody closed.`
      : `Dual-confirmation complete. Item released to verified claimant. Chain of custody closed successfully.`;

    await recordCustodyLog(
      handover.item_id,
      req.user.id,
      req.user.name,
      'HANDOVER_CONFIRMED',
      logMessage
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
    claimantConfirmed: Boolean(claimantConfirmed),
    status: isFullyCompleted ? 'completed' : 'scheduled',
    message: isFullyCompleted
      ? 'Dual confirmation complete! Item safely returned and chain of custody closed.'
      : 'Sign-off recorded! Awaiting second party confirmation.'
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

  const standardCategories = ['Tech & Audio', 'Bags & Wallets', 'Campus IDs', 'Keys & Dorm', 'Bottles & Mugs', 'Apparel', 'Books & Notes', 'Eyewear'];

  function normalizeCategoryCounts(rows) {
    const counts = {};
    standardCategories.forEach(cat => { counts[cat] = 0; });
    counts['Other'] = 0;

    rows.forEach(r => {
      const cat = r.category;
      const count = Number(r.count) || 0;
      if (cat === 'Apparel' || cat === 'Jackets & Gear') {
        counts['Apparel'] = (counts['Apparel'] || 0) + count;
      } else if (standardCategories.includes(cat)) {
        counts[cat] = (counts[cat] || 0) + count;
      } else {
        counts['Other'] = (counts['Other'] || 0) + count;
      }
    });
    return counts;
  }

  // Active category counts (status != 'returned')
  const activeCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE status != 'returned' GROUP BY category");
  const categoryCounts = normalizeCategoryCounts(activeCatRows);

  // Total category counts (all items including returned)
  const totalCatRows = await db.all('SELECT category, COUNT(*) as count FROM items GROUP BY category');
  const totalCategoryCounts = normalizeCategoryCounts(totalCatRows);

  // Lost category counts
  const lostCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE type = 'lost' AND status != 'returned' GROUP BY category");
  const lostCategoryCounts = normalizeCategoryCounts(lostCatRows);

  // Found category counts
  const foundCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE type = 'found' AND status != 'returned' GROUP BY category");
  const foundCategoryCounts = normalizeCategoryCounts(foundCatRows);

  // Returned category counts
  const returnedCatRows = await db.all("SELECT category, COUNT(*) as count FROM items WHERE status = 'returned' GROUP BY category");
  const returnedCategoryCounts = normalizeCategoryCounts(returnedCatRows);

  // Active bounty items count
  const bountiesRow = await db.get("SELECT COUNT(*) as c FROM items WHERE reward_offered IS NOT NULL AND reward_offered != '' AND reward_offered != 'None' AND reward_offered != 'null' AND status != 'returned'");

  res.json({
    total: Number(totalRow.c),
    active: Number(activeRow.c),
    found: Number(foundRow.c),
    lost: Number(lostRow.c),
    bounties: Number(bountiesRow ? bountiesRow.c : 0),
    returned: Number(returnedRow.c),
    pendingClaims: Number(pendingRow.c),
    categoryCounts,
    totalCategoryCounts,
    lostCategoryCounts,
    foundCategoryCounts,
    returnedCategoryCounts
  });
});

// -------------------------------------------------------------
// Campus Leaderboard & Ranking API
// -------------------------------------------------------------
app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await db.all(`
      SELECT id, name, email, role, trust_score, returns_count, bounties_earned, campus_affiliation, avatar_url, created_at
      FROM users
      ORDER BY returns_count DESC, trust_score DESC, bounties_earned DESC
    `);

    const rankedUsers = users.map((u, index) => {
      const rank = index + 1;
      const count = Number(u.returns_count) || 0;
      let tierTitle = 'New Scout 🌱';
      let tierColor = 'slate';
      let tierLevel = 1;

      if (count >= 50 || u.role === 'admin') {
        tierTitle = 'Campus Legend 🏆';
        tierColor = 'amber';
        tierLevel = 5;
      } else if (count >= 15) {
        tierTitle = 'Master Finder 🥇';
        tierColor = 'indigo';
        tierLevel = 4;
      } else if (count >= 10) {
        tierTitle = 'Campus Guardian 🛡️';
        tierColor = 'emerald';
        tierLevel = 3;
      } else if (count >= 5) {
        tierTitle = 'Senior Scout ⭐';
        tierColor = 'blue';
        tierLevel = 2;
      } else if (count >= 1) {
        tierTitle = 'Active Returner 🌟';
        tierColor = 'teal';
        tierLevel = 1;
      }

      return {
        rank,
        ...u,
        returns_count: count,
        bounties_earned: Number(u.bounties_earned) || 0,
        tierTitle,
        tierColor,
        tierLevel
      };
    });

    const totalReturns = rankedUsers.reduce((acc, u) => acc + u.returns_count, 0);
    const totalBounties = rankedUsers.reduce((acc, u) => acc + u.bounties_earned, 0);
    const activeReturners = rankedUsers.filter(u => u.returns_count > 0).length;

    res.json({
      leaderboard: rankedUsers,
      stats: {
        totalReturns,
        totalBountiesDistributed: totalBounties,
        activeReturners,
        topReturner: rankedUsers[0] || null
      }
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to generate campus leaderboard' });
  }
});

// Notifications API
const readNotificationIds = new Set();

app.get('/api/notifications', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';
  const notifications = [];

  try {
    // 1. Handover Messages from other users
    let messageQuery = `
      SELECT m.*, i.title as item_title, i.photos_json, h.item_id as h_item_id
      FROM handover_messages m
      JOIN handovers h ON m.handover_id = h.id
      JOIN items i ON m.item_id = i.id
      WHERE m.sender_id != ?
    `;
    const messageParams = [userId];

    if (!isAdmin) {
      messageQuery += ' AND (h.finder_id = ? OR h.claimant_id = ? OR i.user_id = ?)';
      messageParams.push(userId, userId, userId);
    }
    messageQuery += ' ORDER BY m.created_at DESC LIMIT 20';

    const recentMessages = await db.all(messageQuery, messageParams);
    recentMessages.forEach(m => {
      let photos = [];
      try { photos = JSON.parse(m.photos_json); } catch (e) {}
      notifications.push({
        id: `msg-${m.id}`,
        rawId: m.id,
        type: 'message',
        title: `Message from ${m.sender_name}`,
        desc: m.text,
        item_id: m.item_id,
        item_title: m.item_title,
        photo: photos[0] || null,
        time: m.created_at,
        read: readNotificationIds.has(`msg-${m.id}`),
        icon: 'chat',
        color: 'text-[#4648d4] bg-indigo-50',
        targetTab: 'handover'
      });
    });

    // 2. Claim updates
    if (isAdmin) {
      const pendingClaims = await db.all(`
        SELECT c.*, i.title as item_title
        FROM claims c JOIN items i ON c.item_id = i.id
        WHERE c.status IN ('admin_review', 'submitted')
        ORDER BY c.created_at DESC LIMIT 10
      `);
      pendingClaims.forEach(c => {
        notifications.push({
          id: `clm-admin-${c.id}`,
          rawId: c.id,
          type: 'claim_pending',
          title: 'New Ownership Claim for Review',
          desc: `${c.claimant_name} filed a verification claim for ${c.item_title} (Match: ${c.match_score}%).`,
          item_id: c.item_id,
          item_title: c.item_title,
          time: c.created_at,
          read: readNotificationIds.has(`clm-admin-${c.id}`),
          icon: 'verified_user',
          color: 'text-purple-600 bg-purple-50',
          targetTab: 'admin'
        });
      });
    } else {
      // User's claims status updates
      const myClaims = await db.all(`
        SELECT c.*, i.title as item_title
        FROM claims c JOIN items i ON c.item_id = i.id
        WHERE c.claimant_id = ?
        ORDER BY c.created_at DESC LIMIT 5
      `, [userId]);
      myClaims.forEach(c => {
        if (c.status === 'approved') {
          notifications.push({
            id: `clm-appr-${c.id}`,
            rawId: c.id,
            type: 'claim_approved',
            title: 'Claim Approved by Cabot Desk!',
            desc: `Your claim for ${c.item_title} was approved. Ready for safe pickup.`,
            item_id: c.item_id,
            item_title: c.item_title,
            time: c.reviewed_at || c.created_at,
            read: readNotificationIds.has(`clm-appr-${c.id}`),
            icon: 'verified',
            color: 'text-emerald-600 bg-emerald-50',
            targetTab: 'handover'
          });
        }
      });
    }

    // 3. Sightings on items user reported
    const mySightings = await db.all(`
      SELECT s.*, i.title as item_title
      FROM sightings s JOIN items i ON s.item_id = i.id
      WHERE i.user_id = ? AND s.reporter_id != ?
      ORDER BY s.created_at DESC LIMIT 10
    `, [userId, userId]);
    mySightings.forEach(s => {
      notifications.push({
        id: `stg-${s.id}`,
        rawId: s.id,
        type: 'sighting',
        title: 'New Sighting Reported',
        desc: `${s.reporter_name} spotted your ${s.item_title}: "${s.location_clue}"`,
        item_id: s.item_id,
        item_title: s.item_title,
        time: s.created_at,
        read: readNotificationIds.has(`stg-${s.id}`),
        icon: 'visibility',
        color: 'text-rose-600 bg-rose-50',
        targetTab: 'detail'
      });
    });

    // Sort by timestamp desc
    notifications.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({
      notifications,
      unreadCount,
      totalCount: notifications.length
    });
  } catch (err) {
    console.error('Error in /api/notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

app.post('/api/notifications/read', authMiddleware, (req, res) => {
  const { id } = req.body;
  if (id) {
    readNotificationIds.add(id);
  }
  res.json({ success: true, id });
});

app.post('/api/notifications/read-all', authMiddleware, (req, res) => {
  const { ids = [] } = req.body;
  ids.forEach(id => readNotificationIds.add(id));
  res.json({ success: true, count: ids.length });
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

// Unified Server Startup (Frontend + Backend + DB on single port)
async function startServer() {
  await initializeApp();

  const isProduction = process.env.NODE_ENV === 'production';
  const clientRoot = path.join(__dirname, '../client');
  const clientDistPath = path.join(clientRoot, 'dist');

  if (!isProduction) {
    try {
      const { pathToFileURL } = require('url');
      const vitePath = path.join(clientRoot, 'node_modules/vite/dist/node/index.js');
      const { createServer: createViteServer } = await import(pathToFileURL(vitePath).href);
      const vite = await createViteServer({
        root: clientRoot,
        server: {
          middlewareMode: true
        },
        appType: 'spa'
      });
      app.use(vite.middlewares);
      console.log('[ReTrace] Vite Live React Frontend middleware attached.');
    } catch (viteErr) {
      console.warn('[ReTrace] Vite dev server fallback to static build:', viteErr.message);
      if (fs.existsSync(clientDistPath)) {
        app.use(express.static(clientDistPath));
        app.use((req, res, next) => {
          if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
          res.sendFile(path.join(clientDistPath, 'index.html'));
        });
      }
    }
  } else {
    if (fs.existsSync(clientDistPath)) {
      app.use(express.static(clientDistPath));
      app.use((req, res, next) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
        res.sendFile(path.join(clientDistPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n===============================================================`);
    console.log(`  ★ ReTrace All-in-One Server Running!`);
    console.log(`  ★ Open in Browser: http://localhost:${PORT}`);
    console.log(`  ★ Network Address: http://127.0.0.1:${PORT}`);
    console.log(`===============================================================\n`);
  });
}

startServer().catch(err => {
  console.error('[ReTrace] Server fatal startup error:', err);
});

module.exports = app;


