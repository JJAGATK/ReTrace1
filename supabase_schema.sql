-- ========================================================================
-- ReTrace — University Campus Lost & Found Platform
-- Supabase / PostgreSQL Production Schema DDL
-- ========================================================================

-- 1. Users & Trust Profiles
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  trust_score INTEGER NOT NULL DEFAULT 95,
  returns_count INTEGER NOT NULL DEFAULT 0,
  campus_affiliation TEXT NOT NULL DEFAULT 'Harvard University',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Items Registry (Lost & Found)
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'found', 'lost'
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  coarse_location TEXT NOT NULL,
  floor_room TEXT,
  latitude REAL,
  longitude REAL,
  exact_location_encrypted TEXT,
  custody_type TEXT NOT NULL DEFAULT 'official_desk', -- 'official_desk', 'self_custody'
  custody_desk_name TEXT,
  custody_status TEXT NOT NULL DEFAULT 'at_desk', -- 'with_finder', 'at_desk', 'with_claimant'
  photos_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'claim_pending', 'approved_pending_handover', 'returned', 'cancelled'
  reward_offered TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_name TEXT NOT NULL,
  reporter_avatar TEXT,
  is_urgent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Proof-of-Ownership Challenges (Encrypted & Secret criteria)
CREATE TABLE IF NOT EXISTS challenges (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  questions_json TEXT NOT NULL,
  secret_answers_json TEXT NOT NULL,
  intake_serial_encrypted TEXT,
  intake_serial_hash TEXT
);

-- 4. Claims & Ownership Verification Submissions
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimant_name TEXT NOT NULL,
  claimant_email TEXT NOT NULL,
  answers_json TEXT NOT NULL,
  proof_notes TEXT,
  proof_photo_url TEXT,
  serial_provided TEXT,
  match_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted', -- 'submitted', 'admin_review', 'approved', 'rejected'
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Safe Handover Sessions & Dual Confirmation
CREATE TABLE IF NOT EXISTS handovers (
  id TEXT PRIMARY KEY,
  item_id TEXT UNIQUE NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claim_id TEXT UNIQUE NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  finder_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimant_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_time TEXT NOT NULL,
  location_name TEXT NOT NULL,
  exact_directions TEXT,
  qr_code_token TEXT NOT NULL,
  finder_confirmed INTEGER DEFAULT 0,
  claimant_confirmed INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'completed', 'disputed'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Cryptographic Immutable Chain-of-Custody (SHA-256)
CREATE TABLE IF NOT EXISTS custody_logs (
  id SERIAL PRIMARY KEY,
  item_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  notes TEXT,
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Community Moderation Flags
CREATE TABLE IF NOT EXISTS flags (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL, -- 'item', 'user', 'claim'
  target_id TEXT NOT NULL,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Campus Single Sign-On OTP Codes
CREATE TABLE IF NOT EXISTS otp_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);

-- 9. User Bookmarks / Saved Listings
CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_id)
);

-- 10. Community Sighting Tips & Location Clues
CREATE TABLE IF NOT EXISTS sightings (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reporter_name TEXT NOT NULL,
  location_clue TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Handover Coordination Chat Messages
CREATE TABLE IF NOT EXISTS handover_messages (
  id TEXT PRIMARY KEY,
  handover_id TEXT NOT NULL REFERENCES handovers(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'student',
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast searches & joins
CREATE INDEX IF NOT EXISTS idx_items_type_status ON items(type, status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_claims_item_id ON claims(item_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant_id ON claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_custody_logs_item_id ON custody_logs(item_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_sightings_item_id ON sightings(item_id);
CREATE INDEX IF NOT EXISTS idx_handover_messages_handover_id ON handover_messages(handover_id);
