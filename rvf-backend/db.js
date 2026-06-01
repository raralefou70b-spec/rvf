const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        city        VARCHAR(100) DEFAULT '',
        bio         TEXT DEFAULT '',
        avatar      VARCHAR(20) DEFAULT NULL,
        phone       VARCHAR(30) DEFAULT '',
        sport       VARCHAR(50) DEFAULT '',
        level       VARCHAR(50) DEFAULT 'Amateur',
        wins        INTEGER DEFAULT 0,
        draws       INTEGER DEFAULT 0,
        losses      INTEGER DEFAULT 0,
        terrains_count INTEGER DEFAULT 0,
        matchs_count   INTEGER DEFAULT 0,
        teams_count    INTEGER DEFAULT 0,
        verified    BOOLEAN DEFAULT false,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

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
      );
    `);

    // Idempotent migrations for new columns
    await client.query(`
      DO $$ BEGIN
        BEGIN ALTER TABLE users ADD COLUMN role    VARCHAR(20)  DEFAULT 'user';  EXCEPTION WHEN duplicate_column THEN NULL; END;
        BEGIN ALTER TABLE users ADD COLUMN blocked BOOLEAN      DEFAULT false;   EXCEPTION WHEN duplicate_column THEN NULL; END;
      END $$;

      CREATE TABLE IF NOT EXISTS reports (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        user_name   VARCHAR(100) DEFAULT '',
        type        VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        status      VARCHAR(20) DEFAULT 'new',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS maintenance (
        id      INTEGER PRIMARY KEY DEFAULT 1,
        active  BOOLEAN DEFAULT false,
        message TEXT    DEFAULT ''
      );

      INSERT INTO maintenance (id, active, message) VALUES (1, false, '') ON CONFLICT (id) DO NOTHING;
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM terrains WHERE is_seeded = true');
    if (parseInt(rows[0].count) === 0) {
      console.log('Seeding terrains...');
      await seedTerrains(client);
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

module.exports = { pool, init };
