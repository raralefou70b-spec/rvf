const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

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
    addedBy:   r.added_by,
    createdAt: r.created_at,
  };
}

// GET /api/terrains
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM terrains ORDER BY created_at ASC'
    );
    res.json({ terrains: rows.map(rowToTerrain) });
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
         (name, sport, sports, city, country, surface, price, lights, free, phone, lat, lng, added_by, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        photos  || [],
      ]
    );

    // Best-effort: increment user terrain count (may not exist in Supabase users table)
    if (req.user?.id) {
      pool.query('UPDATE users SET terrains_count = terrains_count + 1 WHERE id = $1', [req.user.id]).catch(() => {});
    }

    res.status(201).json({ terrain: rowToTerrain(rows[0]) });
  } catch (err) {
    console.error('[terrains POST]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// DELETE /api/terrains/:id
router.delete('/:id', requireAuth, async (req, res) => {
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
router.put('/:id/phone', optionalAuth, async (req, res) => {
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
