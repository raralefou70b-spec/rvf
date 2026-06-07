const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

function rowToTerrain(r) {
  return {
    id:      r.id,
    name:    r.name,
    city:    r.city,
    country: r.country,
    lat:     r.lat ? parseFloat(r.lat) : null,
    lng:     r.lng ? parseFloat(r.lng) : null,
    surface: r.surface,
    sports:  r.sports || [],
    sport:   (r.sports || [])[0] || '',
    lights:  r.lights,
    free:    !r.fee,
    fee:     r.fee,
    price:   r.price,
    rating:  r.rating ? parseFloat(r.rating) : null,
    players: r.players,
    phone:   r.phone,
    description: r.description,
    addedBy: r.added_by,
    isSeeded: r.is_seeded,
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

// POST /api/terrains
router.post('/', requireAuth, async (req, res) => {
  const { name, city, lat, lng, surface, sports, lights, fee, price, phone, description } = req.body;
  if (!name || !city) return res.status(400).json({ error: 'Nom et ville requis.' });

  const id = 'T' + Date.now();
  try {
    const { rows: [user] } = await pool.query(
      'SELECT name FROM users WHERE id = $1', [req.user.id]
    );
    const { rows } = await pool.query(
      `INSERT INTO terrains (id, name, city, lat, lng, surface, sports, lights, fee, price, phone, description, added_by, added_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [id, name, city, lat||null, lng||null, surface||'Gazon naturel',
       sports||[], lights||false, fee||false, price||'Gratuit',
       phone||null, description||'', user?.name||'', req.user.id]
    );
    await pool.query(
      'UPDATE users SET terrains_count = terrains_count + 1 WHERE id = $1', [req.user.id]
    );
    res.status(201).json({ terrain: rowToTerrain(rows[0]) });
  } catch (err) {
    console.error(err);
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
