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
      `SELECT id, name, city, xp, name_color, referral_count FROM users ${where} ORDER BY name ASC LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/users', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/users/me/badges — real, server-computed progress for the logged-in user.
// Only covers insignia that are actually traceable in the DB today:
//   - builder: terrains.added_by_user_id (added when a terrain is created via this API)
//   - recruiter: users.referral_count
// "explorer" (cities visited) and "competitor" (matches played) have no visit or match
// log anywhere in the schema, so they are intentionally NOT included here rather than
// faked with a made-up number.
router.get('/me/badges', requireAuth, async (req, res) => {
  try {
    const [{ rows: [{ n }] }, { rows: [u] }] = await Promise.all([
      pool.query('SELECT count(*)::int AS n FROM terrains WHERE added_by_user_id = $1', [req.user.id]),
      pool.query('SELECT referral_count FROM users WHERE id = $1', [req.user.id]),
    ]);
    res.json({
      builder: n,
      recruiter: u?.referral_count || 0,
    });
  } catch (e) {
    console.error('GET /api/users/me/badges', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
