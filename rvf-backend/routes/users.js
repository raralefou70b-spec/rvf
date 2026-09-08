const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/users?q=search+term
// Returns other registered users for friend search. Never exposes password_hash or email.
router.get('/', requireAuth, async (req, res) => {
  const q = (req.query.q || '').trim();
  const params = [req.user.id];
  let where = 'WHERE id != $1 AND blocked = false';
  if (q) {
    params.push(`%${q}%`);
    where += ` AND (name ILIKE $2 OR city ILIKE $2)`;
  }
  try {
    const { rows } = await pool.query(
      `SELECT id, name, city FROM users ${where} ORDER BY name ASC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/users', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
