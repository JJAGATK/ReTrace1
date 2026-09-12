require('dotenv').config();
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_URL;
const isPostgres = Boolean(DATABASE_URL && (DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://')));

let db = null;
let pgPool = null;

// Convert SQLite-style '?' placeholders to Postgres '$1, $2, ...' placeholders
function convertPlaceholders(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

if (isPostgres) {
  const { Pool } = require('pg');
  
  // Configure Postgres connection with SSL for Supabase / Neon / Cloud providers
  const isLocalhost = DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1');
  const poolConfig = {
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  };

  if (!isLocalhost) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  pgPool = new Pool(poolConfig);
  console.log('[ReTrace DB] Connected to PostgreSQL / Supabase cloud database.');

  db = {
    isPostgres: true,
    async get(sql, params = []) {
      const pgSql = convertPlaceholders(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows[0] || null;
    },
    async all(sql, params = []) {
      const pgSql = convertPlaceholders(sql);
      const res = await pgPool.query(pgSql, params);
      return res.rows;
    },
    async run(sql, params = []) {
      const pgSql = convertPlaceholders(sql);
      const res = await pgPool.query(pgSql, params);
      return {
        changes: res.rowCount,
        rows: res.rows
      };
    },
    async exec(sql) {
      return await pgPool.query(sql);
    },
    async initSchema() {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'student',
          trust_score INTEGER NOT NULL DEFAULT 95,
          returns_count INTEGER NOT NULL DEFAULT 0,
          bounties_earned INTEGER NOT NULL DEFAULT 0,
          campus_affiliation TEXT NOT NULL DEFAULT 'Harvard University',
          avatar_url TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          coarse_location TEXT NOT NULL,
          floor_room TEXT,
          latitude REAL,
          longitude REAL,
          exact_location_encrypted TEXT,
          custody_type TEXT NOT NULL DEFAULT 'official_desk',
          custody_desk_name TEXT,
          custody_status TEXT NOT NULL DEFAULT 'at_desk',
          photos_json TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'open',
          reward_offered TEXT,
          user_id TEXT NOT NULL,
          reporter_name TEXT NOT NULL,
          reporter_avatar TEXT,
          is_urgent INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS challenges (
          item_id TEXT PRIMARY KEY,
          questions_json TEXT NOT NULL,
          secret_answers_json TEXT NOT NULL,
          intake_serial_encrypted TEXT,
          intake_serial_hash TEXT
        );

        CREATE TABLE IF NOT EXISTS claims (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          claimant_id TEXT NOT NULL,
          claimant_name TEXT NOT NULL,
          claimant_email TEXT NOT NULL,
          answers_json TEXT NOT NULL,
          proof_notes TEXT,
          proof_photo_url TEXT,
          serial_provided TEXT,
          match_score INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'submitted',
          admin_notes TEXT,
          reviewed_by TEXT,
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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
          status TEXT NOT NULL DEFAULT 'scheduled',
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

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

        CREATE TABLE IF NOT EXISTS flags (
          id TEXT PRIMARY KEY,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          reporter_id TEXT NOT NULL,
          reason TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS otp_codes (
          email TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          expires_at BIGINT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS sightings (
          id TEXT PRIMARY KEY,
          item_id TEXT NOT NULL,
          reporter_id TEXT NOT NULL,
          reporter_name TEXT NOT NULL,
          location_clue TEXT NOT NULL,
          notes TEXT,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS handover_messages (
          id TEXT PRIMARY KEY,
          handover_id TEXT NOT NULL,
          item_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          sender_role TEXT NOT NULL DEFAULT 'student',
          text TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[ReTrace DB] PostgreSQL / Supabase schema verified.');
    }
  };
} else {
  // Local SQLite Engine (better-sqlite3)
  const Database = require('better-sqlite3');
  const DB_PATH = path.join(__dirname, 'retrace.db');
  const sqlite = new Database(DB_PATH);

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  console.log(`[ReTrace DB] Using local SQLite database at: ${DB_PATH}`);

  // Create SQLite schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      trust_score INTEGER NOT NULL DEFAULT 95,
      returns_count INTEGER NOT NULL DEFAULT 0,
      bounties_earned INTEGER NOT NULL DEFAULT 0,
      campus_affiliation TEXT NOT NULL DEFAULT 'Harvard University',
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      coarse_location TEXT NOT NULL,
      floor_room TEXT,
      latitude REAL,
      longitude REAL,
      exact_location_encrypted TEXT,
      custody_type TEXT NOT NULL DEFAULT 'official_desk',
      custody_desk_name TEXT,
      custody_status TEXT NOT NULL DEFAULT 'at_desk',
      photos_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'open',
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
      questions_json TEXT NOT NULL,
      secret_answers_json TEXT NOT NULL,
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
      answers_json TEXT NOT NULL,
      proof_notes TEXT,
      proof_photo_url TEXT,
      serial_provided TEXT,
      match_score INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'submitted',
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
      status TEXT NOT NULL DEFAULT 'scheduled',
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
      action TEXT NOT NULL,
      notes TEXT,
      previous_hash TEXT NOT NULL,
      hash TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flags (
      id TEXT PRIMARY KEY,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, item_id),
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sightings (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      reporter_id TEXT NOT NULL,
      reporter_name TEXT NOT NULL,
      location_clue TEXT NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS handover_messages (
      id TEXT PRIMARY KEY,
      handover_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL DEFAULT 'student',
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
    );
  `);

  db = {
    isPostgres: false,
    sqliteInstance: sqlite,
    async get(sql, params = []) {
      return sqlite.prepare(sql).get(...params) || null;
    },
    async all(sql, params = []) {
      return sqlite.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const info = sqlite.prepare(sql).run(...params);
      return {
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid
      };
    },
    async exec(sql) {
      return sqlite.exec(sql);
    },
    async initSchema() {
      try {
        sqlite.exec(`ALTER TABLE users ADD COLUMN bounties_earned INTEGER DEFAULT 0;`);
      } catch (e) {
        // Column already exists
      }
      return true;
    }
  };
}

module.exports = db;
