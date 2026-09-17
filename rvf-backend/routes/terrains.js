const router = require('express').Router();
const { pool } = require('../db');
const { optionalAuth, requireAuth, requireAdmin } = require('../middleware/auth');

// Maps a DB row to the object shape the React app expects.
// Handles both the old Express schema (fee, is_seeded) and the Supabase schema (free).
function rowToTerrain(r) {
  return {
    id:        r.id,
    name:      r.name,
    city:      r.city,
    country:   r.country,
    lat:       r.lat  ? parseFloat(r.lat)    : null,
    lng:       r.lng  ? parseFloat(r.lng)    : null,
    surface:   r.surface,
    sports:    r.sports || [],
    sport:     r.sport || (r.sports || [])[0] || '',
    lights:    r.lights,
    free:      r.free !== undefined ? r.free : !r.fee,
    price:     r.price,
    rating:    r.rating ? parseFloat(r.rating) : null,
    players:   r.players,
    phone:     r.phone,
    ownerName: r.owner_name || null,
    website:   r.website || null,
    address:    r.address || null,
    postalCode: r.postal_code || null,
    addedBy:   r.added_by,
    verified:  r.verified !== false,
    createdAt: r.created_at,
  };
}

// GET /api/terrains
// - no bbox: full list (used by the admin panel)
// - bbox + zoom < 12: lat/lng-rounded cluster counts (cheap, avoids shipping every row while zoomed out)
// - bbox + zoom >= 12: individual terrains within the bbox, capped
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { bbox, zoom } = req.query;
    if (!bbox) {
      const limit  = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10)  || 1000));
      const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
      const [{ rows }, { rows: [{ count }] }] = await Promise.all([
        pool.query('SELECT * FROM terrains ORDER BY created_at ASC LIMIT $1 OFFSET $2', [limit, offset]),
        pool.query('SELECT count(*)::int AS count FROM terrains'),
      ]);
      return res.json({ mode: 'terrains', terrains: rows.map(rowToTerrain), total: count, limit, offset });
    }

    const parts = String(bbox).split(',').map(Number);
    if (parts.length !== 4 || parts.some(Number.isNaN)) {
      return res.status(400).json({ error: 'bbox invalide (attendu: minLng,minLat,maxLng,maxLat).' });
    }
    const [minLng, minLat, maxLng, maxLat] = parts;
    const z = Number(zoom) || 0;

    if (z < 12) {
      const precision = Math.max(0, Math.min(4, Math.floor(z / 2)));
      const { rows } = await pool.query(
        `SELECT round(lat::numeric, $1) AS lat, round(lng::numeric, $1) AS lng, count(*)::int AS count
         FROM terrains
         WHERE lat BETWEEN $2 AND $3 AND lng BETWEEN $4 AND $5
         GROUP BY 1, 2`,
        [precision, minLat, maxLat, minLng, maxLng]
      );
      return res.json({
        mode: 'clusters',
        clusters: rows.map(r => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lng), count: r.count })),
      });
    }

    const { rows } = await pool.query(
      `SELECT * FROM terrains
       WHERE lat BETWEEN $1 AND $2 AND lng BETWEEN $3 AND $4
       ORDER BY created_at ASC
       LIMIT 500`,
      [minLat, maxLat, minLng, maxLng]
    );
    res.json({ mode: 'terrains', terrains: rows.map(rowToTerrain) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/terrains — optionalAuth so Supabase-session users (no rvf_token) can also use this fallback
router.post('/', optionalAuth, async (req, res) => {
  const { name, city, country, lat, lng, surface, sport, sports, lights, free, price, phone, photos, addedBy } = req.body;
  if (!name || !city) return res.status(400).json({ error: 'Nom et ville requis.' });

  try {
    // Resolve added_by: prefer body value, then look up in users table if we have a user id
    let resolvedAddedBy = addedBy || '';
    if (!resolvedAddedBy && req.user?.id) {
      const { rows: [u] } = await pool.query(
        'SELECT name FROM users WHERE id = $1', [req.user.id]
      ).catch(() => ({ rows: [] }));
      if (u?.name) resolvedAddedBy = u.name;
    }

    // Insert without id — let the DB sequence generate a bigint automatically
    const { rows } = await pool.query(
      `INSERT INTO terrains
         (name, sport, sports, city, country, surface, price, lights, free, phone, lat, lng, added_by, added_by_user_id, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        name,
        sport || (sports || [])[0] || '',
        sports || [],
        city,
        country || '',
        surface || 'Gazon naturel',
        price   || 'Gratuit',
        lights  || false,
        free    !== false,
        phone   || null,
        lat     || null,
        lng     || null,
        resolvedAddedBy,
        req.user?.id || null,
        photos  || [],
      ]
    );

    // Best-effort: increment user terrain count (may not exist in Supabase users table)
    if (req.user?.id) {
      pool.query('UPDATE users SET terrains_count = terrains_count + 1, xp = xp + 50 WHERE id = $1', [req.user.id]).catch(() => {});
    }

    res.status(201).json({ terrain: rowToTerrain(rows[0]) });
  } catch (err) {
    console.error('[terrains POST]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/terrains/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM terrains WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PUT /api/terrains/:id/phone
router.put('/:id/phone', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { phone } = req.body;
  try {
    await pool.query('UPDATE terrains SET phone = $1 WHERE id = $2', [phone, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
