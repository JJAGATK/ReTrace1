const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'back2you.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'student', -- 'student', 'staff', 'admin'
    trust_score INTEGER NOT NULL DEFAULT 95,
    returns_count INTEGER NOT NULL DEFAULT 0,
    campus_affiliation TEXT NOT NULL DEFAULT 'Harvard University',
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'found', 'lost'
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    coarse_location TEXT NOT NULL, -- Building / Area name (public)
    floor_room TEXT, -- e.g. "3rd Floor Carrel #42"
    latitude REAL, -- campus geofence coords
    longitude REAL,
    exact_location_encrypted TEXT, -- AES-256 encrypted for post-approval
    custody_type TEXT NOT NULL DEFAULT 'official_desk', -- 'official_desk', 'self_custody'
    custody_desk_name TEXT,
    custody_status TEXT NOT NULL DEFAULT 'at_desk', -- 'with_finder', 'at_desk', 'with_claimant'
    photos_json TEXT NOT NULL DEFAULT '[]', -- Array of image URLs
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'claim_pending', 'approved_pending_handover', 'returned', 'cancelled'
    reward_offered TEXT,
    user_id TEXT NOT NULL,
    reporter_name TEXT NOT NULL,
    reporter_avatar TEXT,
    is_urgent INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS challenges (
    item_id TEXT PRIMARY KEY,
    questions_json TEXT NOT NULL, -- JSON array of questions shown to claimants
    secret_answers_json TEXT NOT NULL, -- Encrypted or stored for matching
    intake_serial_encrypted TEXT,
    intake_serial_hash TEXT,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    claimant_id TEXT NOT NULL,
    claimant_name TEXT NOT NULL,
    claimant_email TEXT NOT NULL,
    answers_json TEXT NOT NULL, -- user submitted answers
    proof_notes TEXT,
    proof_photo_url TEXT,
    serial_provided TEXT,
    match_score INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'admin_review', 'approved', 'rejected'
    admin_notes TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id),
    FOREIGN KEY(claimant_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS handovers (
    id TEXT PRIMARY KEY,
    item_id TEXT UNIQUE NOT NULL,
    claim_id TEXT UNIQUE NOT NULL,
    finder_id TEXT NOT NULL,
    claimant_id TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    location_name TEXT NOT NULL,
    exact_directions TEXT,
    qr_code_token TEXT NOT NULL,
    finder_confirmed INTEGER DEFAULT 0,
    claimant_confirmed INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'disputed'
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES items(id),
    FOREIGN KEY(claim_id) REFERENCES claims(id)
  );

  CREATE TABLE IF NOT EXISTS custody_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    action TEXT NOT NULL, -- 'POSTED', 'CLAIM_ATTEMPTED', 'ADMIN_APPROVED', 'HANDOVER_SCHEDULED', 'HANDOVER_CONFIRMED', 'CLOSED'
    notes TEXT,
    previous_hash TEXT NOT NULL,
    hash TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flags (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL, -- 'item', 'user', 'claim'
    target_id TEXT NOT NULL,
    reporter_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS otp_codes (
    email TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
`);

module.exports = db;
