const { Pool } = require('pg');

// Supabase pooler requires SSL regardless of NODE_ENV
const needsSsl = (process.env.DATABASE_URL || '').includes('supabase.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
});

// Mirrors the frontend's makeReferralCode() shape (name prefix + 4 digits), with a
// DB-checked retry loop since this is now the authoritative source of the code.
async function generateUniqueReferralCode(queryable, name) {
  const prefix = (name || 'RVF').replace(/\s+/g, '').toUpperCase().slice(0, 6) || 'RVF';
  for (let i = 0; i < 10; i++) {
    const code = prefix + Math.floor(1000 + Math.random() * 9000);
    const { rows } = await queryable.query('SELECT 1 FROM users WHERE referral_code = $1', [code]);
    if (rows.length === 0) return code;
  }
  // Extremely unlikely fallback: timestamp suffix guarantees uniqueness
  return prefix + Date.now().toString().slice(-6);
}

async function init() {
  const client = await pool.connect();
  try {
    // Each block is wrapped so a schema mismatch on Supabase doesn't crash startup
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        city          VARCHAR(100) DEFAULT '',
        bio           TEXT DEFAULT '',
        avatar        VARCHAR(20) DEFAULT NULL,
        phone         VARCHAR(30) DEFAULT '',
        sport         VARCHAR(50) DEFAULT '',
        level         VARCHAR(50) DEFAULT 'Amateur',
        wins          INTEGER DEFAULT 0,
        draws         INTEGER DEFAULT 0,
        losses        INTEGER DEFAULT 0,
        terrains_count INTEGER DEFAULT 0,
        matchs_count   INTEGER DEFAULT 0,
        teams_count    INTEGER DEFAULT 0,
        verified      BOOLEAN DEFAULT false,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(e => console.warn('[DB] users table:', e.message));

    await client.query(`
      CREATE TABLE IF NOT EXISTS terrains (
        id          VARCHAR(50) PRIMARY KEY,
        name        VARCHAR(200) NOT NULL,
        city        VARCHAR(100) DEFAULT '',
        country     VARCHAR(100) DEFAULT '',
        lat         DECIMAL(10, 8),
        lng         DECIMAL(11, 8),
        surface     VARCHAR(50) DEFAULT 'Gazon naturel',
        sports      TEXT[] DEFAULT '{}',
        lights      BOOLEAN DEFAULT false,
        fee         BOOLEAN DEFAULT false,
        price       VARCHAR(20) DEFAULT 'Gratuit',
        rating      DECIMAL(3,1) DEFAULT 4.5,
        players     INTEGER DEFAULT 0,
        phone       VARCHAR(30),
        description TEXT DEFAULT '',
        added_by    VARCHAR(100),
        added_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        is_seeded   BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(e => console.warn('[DB] terrains table:', e.message));

    await client.query(`
      DO $$ BEGIN
        BEGIN ALTER TABLE users ADD COLUMN role    VARCHAR(20) DEFAULT 'user';  EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE users ADD COLUMN blocked BOOLEAN     DEFAULT false;   EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$
    `).catch(e => console.warn('[DB] migrations:', e.message));


    await client.query(`
      DO $$ BEGIN
        BEGIN ALTER TABLE terrains ADD COLUMN verified BOOLEAN NOT NULL DEFAULT true; EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$
    `).catch(e => console.warn('[DB] terrains.verified migration:', e.message));

    await client.query(`
      CREATE INDEX IF NOT EXISTS terrains_lat_lng_idx ON terrains (lat, lng)
    `).catch(e => console.warn('[DB] terrains lat/lng index:', e.message));

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name   VARCHAR(100) DEFAULT '',
        type        VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        status      VARCHAR(20) DEFAULT 'new',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(e => console.warn('[DB] reports table:', e.message));

    await client.query(`
      CREATE TABLE IF NOT EXISTS maintenance (
        id      INTEGER PRIMARY KEY DEFAULT 1,
        active  BOOLEAN DEFAULT false,
        message TEXT    DEFAULT ''
      )
    `).catch(e => console.warn('[DB] maintenance table:', e.message));

    await client.query(
      `INSERT INTO maintenance (id, active, message) VALUES (1, false, '') ON CONFLICT (id) DO NOTHING`
    ).catch(() => {});

    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).catch(e => console.warn('[DB] pgcrypto extension:', e.message));

    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        cid        TEXT NOT NULL,
        from_user  TEXT NOT NULL,
        to_user    TEXT NOT NULL,
        content    TEXT NOT NULL,
        read       BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(e => console.warn('[DB] direct_messages table:', e.message));

    await client.query(`
      CREATE INDEX IF NOT EXISTS direct_messages_cid_idx ON direct_messages (cid, created_at)
    `).catch(e => console.warn('[DB] direct_messages cid index:', e.message));

    await client.query(`
      CREATE INDEX IF NOT EXISTS direct_messages_unread_idx ON direct_messages (to_user, read)
    `).catch(e => console.warn('[DB] direct_messages unread index:', e.message));

    // is_seeded column may not exist when terrains table was created via Supabase SQL
    try {
      const { rows } = await client.query('SELECT COUNT(*) FROM terrains WHERE is_seeded = true');
      if (parseInt(rows[0].count) === 0) {
        console.log('[DB] Seeding terrains...');
        await seedTerrains(client);
      }
    } catch {
      console.log('[DB] Terrain seed skipped (is_seeded column not present — OK for Supabase schema)');
    }
  } finally {
    client.release();
  }
}

async function seedTerrains(client) {
  const { SEEDED_TERRAINS } = require('./seeds');
  for (const t of SEEDED_TERRAINS) {
    await client.query(
      `INSERT INTO terrains (id, name, city, country, lat, lng, surface, sports, lights, fee, price, rating, players, phone, is_seeded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true)
       ON CONFLICT (id) DO NOTHING`,
      [
        't' + t.id,
        t.name,
        t.city     || '',
        t.country  || '',
        t.lat      || null,
        t.lng      || null,
        t.surface  || 'Gazon naturel',
        [t.sport],
        t.lights   || false,
        !(t.free),
        t.price    || 'Gratuit',
        t.rating   || 4.5,
        t.players  || 0,
        t.phone    || null,
      ]
    );
  }
  console.log(`Seeded ${SEEDED_TERRAINS.length} terrains.`);
}

module.exports = { pool, init, generateUniqueReferralCode };
