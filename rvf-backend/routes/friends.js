const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/friends — my accepted friends (relationship is stored as one row regardless
// of who sent the request, so we pick whichever side of the row isn't me)
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.city, u.xp, u.name_color
       FROM friendships f
       JOIN users u ON u.id = (CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END)
       WHERE (f.user_id = $1 OR f.friend_id = $1) AND f.status = 'accepted'
       ORDER BY u.name ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/friends', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/friends/request — send a friend request
router.post('/request', requireAuth, async (req, res) => {
  const targetUserId = parseInt(req.body.userId, 10);
  if (!targetUserId) return res.status(400).json({ error: 'missing_user_id' });
  if (targetUserId === req.user.id) return res.status(400).json({ error: 'cannot_add_self' });

  try {
    const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (!userRows[0]) return res.status(404).json({ error: 'user_not_found' });

    const { rows: existing } = await pool.query(
      `SELECT status FROM friendships
       WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
      [req.user.id, targetUserId]
    );
    if (existing[0]?.status === 'accepted') return res.status(409).json({ error: 'already_friends' });
    if (existing[0]) return res.status(409).json({ error: 'already_requested' });

    const { rows } = await pool.query(
      `INSERT INTO friendships (user_id, friend_id, status)
       VALUES ($1, $2, 'pending')
       ON CONFLICT (user_id, friend_id) DO NOTHING
       RETURNING *`,
      [req.user.id, targetUserId]
    );
    if (!rows[0]) return res.status(409).json({ error: 'already_requested' });

    res.status(201).json({ ok: true, request: rows[0] });
  } catch (e) {
    console.error('POST /api/friends/request', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/friends/requests — pending requests addressed to me
router.get('/requests', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT f.id, f.user_id AS from_user_id, f.created_at, u.name, u.city
       FROM friendships f JOIN users u ON u.id = f.user_id
       WHERE f.friend_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/friends/requests', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/friends/requests/:id/accept
router.post('/requests/:id/accept', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE id = $1 AND friend_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'request_not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/friends/requests/:id/accept', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/friends/requests/:id/decline
router.post('/requests/:id/decline', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM friendships WHERE id = $1 AND friend_id = $2 AND status = 'pending' RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'request_not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/friends/requests/:id/decline', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// DELETE /api/friends/:userId — remove an existing friendship
router.delete('/:userId', requireAuth, async (req, res) => {
  const otherId = parseInt(req.params.userId, 10);
  try {
    const { rows } = await pool.query(
      `DELETE FROM friendships
       WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)) AND status = 'accepted'
       RETURNING id`,
      [req.user.id, otherId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_friends' });
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/friends/:userId', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
