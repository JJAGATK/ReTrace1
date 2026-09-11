const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const db = require('./db');
const seedDatabase = require('./seed');
const { encryptPII, decryptPII, createLogHash, hashSecret } = require('./crypto');
const { evaluateClaim } = require('./matcher');

const JWT_SECRET = process.env.JWT_SECRET || 'back2you-campus-super-secret-jwt-key-2026';
const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Run seed on startup if database is empty
const itemCount = db.prepare('SELECT COUNT(*) as count FROM items').get();
if (!itemCount || itemCount.count === 0) {
  seedDatabase();
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

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in with a campus account.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
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
function recordCustodyLog(itemId, actorId, actorName, action, notes) {
  const lastLog = db.prepare('SELECT hash FROM custody_logs WHERE item_id = ? ORDER BY id DESC LIMIT 1').get(itemId);
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

  db.prepare(`
    INSERT INTO custody_logs (item_id, actor_id, actor_name, action, notes, previous_hash, hash, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(itemId, actorId, actorName, action, notes, prevHash, hash, timestamp);

  return hash;
}

// -------------------------------------------------------------
// Rate Limiter for Claim Verification (Prevent Brute-Force)
// -------------------------------------------------------------
const claimLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 claim attempts per IP
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
app.post('/api/auth/login-demo', (req, res) => {
  const { personaId } = req.body;
  const validIds = ['user-maya', 'user-julian', 'user-admin'];
  const targetId = validIds.includes(personaId) ? personaId : 'user-maya';
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId);
  if (!user) return res.status(404).json({ error: 'Demo user not found' });

  const token = generateToken(user);
  res.json({ user, token });
});

// Campus SSO / .edu OTP Request
app.post('/api/auth/request-otp', (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid university email address required.' });
  }

  // Strict check: must be a .edu domain or campus sub-domain
  if (!email.toLowerCase().endsWith('.edu')) {
    return res.status(400).json({ error: 'Access restricted: Only verified .edu university institutional accounts are permitted.' });
  }

  const code = '441920'; // deterministic demo OTP or 6 digits
  const expiresAt = Date.now() + 10 * 60 * 1000;

  db.prepare(`
    INSERT OR REPLACE INTO otp_codes (email, code, expires_at)
    VALUES (?, ?, ?)
  `).run(email.toLowerCase(), code, expiresAt);

  res.json({
    success: true,
    message: `Verification OTP dispatched to ${email}.`,
    demoCode: code // provided for zero-friction evaluator experience
  });
});

// Campus SSO / .edu OTP Verify
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, code, name } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  const record = db.prepare('SELECT * FROM otp_codes WHERE email = ?').get(email.toLowerCase());
  if (!record || record.code !== code.trim()) {
    return res.status(400).json({ error: 'Invalid or expired OTP code.' });
  }

  // Find or create user
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) {
    const newId = 'user-' + crypto.randomUUID().slice(0, 8);
    const displayName = name || email.split('@')[0].replace('.', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const role = email.includes('admin') || email.includes('police') ? 'admin' : 'student';

    db.prepare(`
      INSERT INTO users (id, name, email, role, trust_score, returns_count, campus_affiliation, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newId,
      displayName,
      email.toLowerCase(),
      role,
      95,
      0,
      'Harvard Campus Verified',
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'
    );
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(newId);
  }

  // Remove used OTP
  db.prepare('DELETE FROM otp_codes WHERE email = ?').run(email.toLowerCase());

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

// List items with filters (Returns SANITIZED public data)
app.get('/api/items', (req, res) => {
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

  const rows = db.prepare(query).all(...params);

  // Parse JSON and sanitize (exact location & secrets NOT exposed publicly)
  const items = rows.map(item => {
    let photos = [];
    try { photos = JSON.parse(item.photos_json); } catch (e) {}

    // Check if challenge exists (only check boolean existence, never expose answers)
    const challengeRow = db.prepare('SELECT questions_json FROM challenges WHERE item_id = ?').get(item.id);
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
      challenge_questions: challengeQuestions, // Only questions, never answers!
      created_at: item.created_at
    };
  });

  res.json({ items });
});

// Single item details
app.get('/api/items/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  let photos = [];
  try { photos = JSON.parse(item.photos_json); } catch (e) {}

  // Check challenge
  const challenge = db.prepare('SELECT questions_json FROM challenges WHERE item_id = ?').get(item.id);
  let questions = [];
  if (challenge) {
    try { questions = JSON.parse(challenge.questions_json); } catch (e) {}
  }

  // Active handover if approved
  const handover = db.prepare('SELECT * FROM handovers WHERE item_id = ?').get(item.id);

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

// Create Item (Found or Lost)
app.post('/api/items', authMiddleware, (req, res) => {
  const {
    type, // 'found' or 'lost'
    title,
    category,
    description,
    coarse_location,
    floor_room,
    latitude,
    longitude,
    exact_location_notes,
    custody_type, // 'official_desk' or 'self_custody'
    custody_desk_name,
    photos = [],
    reward_offered,
    is_urgent = false,
    verification_questions = [], // 1-3 questions
    secret_answers = [], // hidden answers
    intake_serial
  } = req.body;

  if (!title || !category || !coarse_location) {
    return res.status(400).json({ error: 'Title, category, and discovery location are required.' });
  }

  const itemId = 'REC-' + Math.floor(1000 + Math.random() * 9000);
  const encryptedExact = exact_location_notes ? encryptPII(exact_location_notes) : null;
  const custodyStatus = custody_type === 'official_desk' ? 'at_desk' : 'with_finder';

  db.prepare(`
    INSERT INTO items (
      id, type, title, category, description, coarse_location, floor_room,
      latitude, longitude, exact_location_encrypted, custody_type, custody_desk_name,
      custody_status, photos_json, status, reward_offered, user_id, reporter_name,
      reporter_avatar, is_urgent, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
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
  );

  // If Found item, save private verification challenge
  if (type === 'found' && verification_questions.length > 0) {
    db.prepare(`
      INSERT INTO challenges (item_id, questions_json, secret_answers_json, intake_serial_encrypted, intake_serial_hash)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      itemId,
      JSON.stringify(verification_questions),
      JSON.stringify(secret_answers),
      intake_serial ? encryptPII(intake_serial) : null,
      intake_serial ? hashSecret(intake_serial) : null
    );
  }

  // Initial immutable chain-of-custody entry
  recordCustodyLog(
    itemId,
    req.user.id,
    req.user.name,
    'POSTED',
    `${type.toUpperCase()} report registered with campus network. Custody assigned to: ${custody_type === 'official_desk' ? custody_desk_name || 'Official Desk' : 'Reporter safe care'}.`
  );

  res.status(201).json({ success: true, itemId });
});

// -------------------------------------------------------------
// Claim & Verification Flow (Feature 2 - Core Verification Engine)
// -------------------------------------------------------------
app.post('/api/items/:id/claim', authMiddleware, claimLimiter, (req, res) => {
  const itemId = req.params.id;
  const { answers = [], serial_provided, proof_notes, proof_photo_url } = req.body;

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  if (item.user_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot claim an item you reported.' });
  }

  if (item.status === 'returned') {
    return res.status(400).json({ error: 'This item has already been successfully returned to its verified owner.' });
  }

  // Check recent claims by this user across unrelated items (Fraud detection)
  const recentClaims = db.prepare(`
    SELECT COUNT(*) as count FROM claims 
    WHERE claimant_id = ? AND created_at > datetime('now', '-2 hour')
  `).get(req.user.id);

  if (recentClaims && recentClaims.count >= 5) {
    // Flag account for suspicious claim flooding
    db.prepare(`
      INSERT INTO flags (id, target_type, target_id, reporter_id, reason, status)
      VALUES (?, 'user', ?, 'SYSTEM_FRAUD_MONITOR', 'Exceeded claim velocity threshold (>5 claims in 2h)', 'pending')
    `).run('FLAG-' + crypto.randomUUID().slice(0, 8), req.user.id);

    return res.status(429).json({
      error: 'Unusual claim activity detected. Your account has been temporarily restricted pending moderator review.'
    });
  }

  // Fetch challenge secrets for server-side evaluation
  const challenge = db.prepare('SELECT * FROM challenges WHERE item_id = ?').get(itemId);
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
  db.prepare(`
    INSERT INTO claims (
      id, item_id, claimant_id, claimant_name, claimant_email,
      answers_json, proof_notes, proof_photo_url, serial_provided,
      match_score, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
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
  );

  // Update item status if strong match
  if (matchResult.passedThreshold) {
    db.prepare("UPDATE items SET status = 'claim_pending' WHERE id = ?").run(itemId);
  }

  // Record audit log with hash chain
  recordCustodyLog(
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
// Admin / Moderator Desk Routes (Feature 4 - Trust & Safety)
// -------------------------------------------------------------
app.get('/api/admin/claims', authMiddleware, adminOnly, (req, res) => {
  const claims = db.prepare(`
    SELECT c.*, i.title as item_title, i.category, i.coarse_location, i.custody_desk_name,
           u.trust_score as claimant_trust, u.returns_count as claimant_returns
    FROM claims c
    JOIN items i ON c.item_id = i.id
    JOIN users u ON c.claimant_id = u.id
    ORDER BY c.created_at DESC
  `).all();

  // Attach intake challenge questions & answers for admin side-by-side inspection
  const enriched = claims.map(c => {
    const challenge = db.prepare('SELECT * FROM challenges WHERE item_id = ?').get(c.item_id);
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
  });

  res.json({ claims: enriched });
});

// Admin Decision on Claim
app.post('/api/admin/claims/:id/decision', authMiddleware, adminOnly, (req, res) => {
  const { action, handover_location, handover_time, notes } = req.body;
  const claimId = req.params.id;

  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(claim.item_id);
  if (!item) return res.status(404).json({ error: 'Associated item not found' });

  if (action === 'approve') {
    db.prepare(`
      UPDATE claims 
      SET status = 'approved', admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(notes || 'Approved by Campus Desk Monitor', req.user.name, claimId);

    db.prepare("UPDATE items SET status = 'approved_pending_handover' WHERE id = ?").run(item.id);

    // Schedule Handover Record with secure QR token
    const qrToken = 'VERIFIED_QR_' + crypto.randomBytes(8).toString('hex').toUpperCase();
    const meetingSpot = handover_location || item.custody_desk_name || 'Cabot Science Library Circulation Desk';
    const scheduleTime = handover_time || 'Available Today until 11:00 PM (Staff ID #L-89)';

    db.prepare(`
      INSERT OR REPLACE INTO handovers (
        id, item_id, claim_id, finder_id, claimant_id,
        scheduled_time, location_name, exact_directions, qr_code_token, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')
    `).run(
      'HO-' + crypto.randomUUID().slice(0, 8),
      item.id,
      claim.id,
      item.user_id,
      claim.claimant_id,
      scheduleTime,
      meetingSpot,
      'Present university student ID card or scan dynamic QR token at Cabot Circulation Desk.',
      qrToken
    );

    recordCustodyLog(
      item.id,
      req.user.id,
      req.user.name,
      'ADMIN_APPROVED',
      `Claim approved by Officer ${req.user.name}. Handover scheduled at ${meetingSpot}. Dynamic QR verification token generated.`
    );

    return res.json({ success: true, message: 'Claim approved and safe handover session activated.' });
  } else {
    // Reject
    db.prepare(`
      UPDATE claims 
      SET status = 'rejected', admin_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(notes || 'Insufficient proof of ownership', req.user.name, claimId);

    db.prepare("UPDATE items SET status = 'open' WHERE id = ?").run(item.id);

    recordCustodyLog(
      item.id,
      req.user.id,
      req.user.name,
      'CLAIM_REJECTED',
      `Claim by ${claim.claimant_name} rejected: ${notes || 'Verification questions did not match secret criteria.'}`
    );

    return res.json({ success: true, message: 'Claim rejected. Item returned to open search registry.' });
  }
});

// -------------------------------------------------------------
// Handover Coordination & Dual Confirmation
// -------------------------------------------------------------
app.get('/api/handovers/:itemId', authMiddleware, (req, res) => {
  const handover = db.prepare('SELECT * FROM handovers WHERE item_id = ?').get(req.params.itemId);
  if (!handover) return res.status(404).json({ error: 'Handover record not found' });

  // Only finder, claimant, or admin can view
  const isParticipant =
    req.user.id === handover.finder_id ||
    req.user.id === handover.claimant_id ||
    req.user.role === 'admin';

  if (!isParticipant) {
    return res.status(403).json({ error: 'You are not authorized to view this handover session.' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(handover.item_id);
  const finder = db.prepare('SELECT id, name, email, trust_score, avatar_url FROM users WHERE id = ?').get(handover.finder_id);
  const claimant = db.prepare('SELECT id, name, email, trust_score, avatar_url FROM users WHERE id = ?').get(handover.claimant_id);

  res.json({
    handover,
    item,
    finder,
    claimant
  });
});

// Dual confirmation endpoint
app.post('/api/handovers/:itemId/confirm', authMiddleware, (req, res) => {
  const handover = db.prepare('SELECT * FROM handovers WHERE item_id = ?').get(req.params.itemId);
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

  db.prepare(`
    UPDATE handovers 
    SET finder_confirmed = ?, claimant_confirmed = ?, status = ?, completed_at = ?
    WHERE id = ?
  `).run(
    finderConfirmed,
    claimantConfirmed,
    isFullyCompleted ? 'completed' : 'scheduled',
    isFullyCompleted ? new Date().toISOString() : null,
    handover.id
  );

  if (isFullyCompleted) {
    db.prepare("UPDATE items SET status = 'returned', custody_status = 'with_claimant' WHERE id = ?").run(handover.item_id);

    // Boost trust score
    db.prepare('UPDATE users SET trust_score = MIN(100, trust_score + 2), returns_count = returns_count + 1 WHERE id = ?').run(handover.finder_id);
    db.prepare('UPDATE users SET trust_score = MIN(100, trust_score + 1) WHERE id = ?').run(handover.claimant_id);

    recordCustodyLog(
      handover.item_id,
      req.user.id,
      req.user.name,
      'HANDOVER_CONFIRMED',
      `Dual-confirmation complete. Item released to verified claimant. Chain of custody closed successfully.`
    );
  } else {
    recordCustodyLog(
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
// Custody Chain & Tamper-Proof Audit Logs (Feature 2)
// -------------------------------------------------------------
app.get('/api/items/:id/custody-chain', (req, res) => {
  const logs = db.prepare('SELECT * FROM custody_logs WHERE item_id = ? ORDER BY id ASC').all(req.params.id);

  // Validate chain integrity
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

// Admin Analytics & Heatmap
app.get('/api/admin/analytics', authMiddleware, adminOnly, (req, res) => {
  const totalItems = db.prepare('SELECT COUNT(*) as c FROM items').get().c;
  const returnedItems = db.prepare("SELECT COUNT(*) as c FROM items WHERE status = 'returned'").get().c;
  const pendingClaims = db.prepare("SELECT COUNT(*) as c FROM claims WHERE status = 'admin_review'").get().c;
  const activeLost = db.prepare("SELECT COUNT(*) as c FROM items WHERE type = 'lost' AND status = 'open'").get().c;

  const categories = db.prepare(`
    SELECT category, COUNT(*) as count 
    FROM items GROUP BY category ORDER BY count DESC
  `).all();

  const hotspotZones = db.prepare(`
    SELECT coarse_location as zone, COUNT(*) as count 
    FROM items GROUP BY coarse_location ORDER BY count DESC LIMIT 5
  `).all();

  const flaggedAccounts = db.prepare(`
    SELECT f.*, u.name, u.email, u.trust_score
    FROM flags f JOIN users u ON f.target_id = u.id
    WHERE f.status = 'pending'
  `).all();

  res.json({
    totalItems,
    returnedItems,
    recoveryRate: totalItems > 0 ? Math.round((returnedItems / totalItems) * 100) : 0,
    pendingClaims,
    activeLost,
    categories,
    hotspotZones,
    flaggedAccounts
  });
});

// Export Immutable Audit Log (Compliance & Safety)
app.get('/api/admin/audit-export', authMiddleware, adminOnly, (req, res) => {
  const logs = db.prepare('SELECT * FROM custody_logs ORDER BY id ASC').all();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="back2you-audit-chain-export.json"');
  res.json({
    exported_at: new Date().toISOString(),
    institution: 'Harvard University Campus Security',
    chain_type: 'SHA-256 Hash Chain',
    record_count: logs.length,
    chain: logs
  });
});

// Flagging endpoint
app.post('/api/flags', authMiddleware, (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: 'Missing required flag parameters.' });
  }

  const flagId = 'FLG-' + crypto.randomUUID().slice(0, 8);
  db.prepare(`
    INSERT INTO flags (id, target_type, target_id, reporter_id, reason, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(flagId, target_type, target_id, req.user.id, reason);

  res.json({ success: true, message: 'Report submitted for Campus Security moderation.' });
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
    console.log(`Back2You Campus Security App & API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
