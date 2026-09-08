const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const cid = (a, b) => [String(a), String(b)].sort().join('::');

function rowToMessage(r) {
  return {
    id: r.id,
    cid: r.cid,
    from: r.from_user,
    to: r.to_user,
    text: r.content,
    read: r.read,
    ts: r.created_at,
  };
}

// GET /api/messages/conversations
router.get('/conversations', requireAuth, async (req, res) => {
  const me = String(req.user.id);
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (cid) *
       FROM direct_messages
       WHERE from_user = $1 OR to_user = $1
       ORDER BY cid, created_at DESC`,
      [me]
    );
    const { rows: unreadRows } = await pool.query(
      `SELECT cid, COUNT(*) AS unread
       FROM direct_messages
       WHERE to_user = $1 AND read = false
       GROUP BY cid`,
      [me]
    );
    const unreadByCid = Object.fromEntries(unreadRows.map(r => [r.cid, parseInt(r.unread, 10)]));

    const convs = rows
      .map(r => ({
        id: r.cid,
        other: r.cid.split('::').find(id => id !== me),
        last: rowToMessage(r),
        unread: unreadByCid[r.cid] || 0,
      }))
      .sort((a, b) => new Date(b.last.ts) - new Date(a.last.ts));

    res.json(convs);
  } catch (e) {
    console.error('GET /api/messages/conversations', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/messages/:otherId
router.get('/:otherId', requireAuth, async (req, res) => {
  const me = String(req.user.id);
  const other = String(req.params.otherId);
  const id = cid(me, other);
  try {
    const { rows } = await pool.query(
      `SELECT * FROM direct_messages WHERE cid = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json(rows.map(rowToMessage));
  } catch (e) {
    console.error('GET /api/messages/:otherId', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/messages/:otherId  { content }
router.post('/:otherId', requireAuth, async (req, res) => {
  const me = String(req.user.id);
  const other = String(req.params.otherId);
  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'missing_content' });
  if (other === me) return res.status(400).json({ error: 'invalid_recipient' });

  const id = cid(me, other);
  try {
    const { rows } = await pool.query(
      `INSERT INTO direct_messages (cid, from_user, to_user, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, me, other, content]
    );
    res.status(201).json(rowToMessage(rows[0]));
  } catch (e) {
    console.error('POST /api/messages/:otherId', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/messages/:otherId/read
router.post('/:otherId/read', requireAuth, async (req, res) => {
  const me = String(req.user.id);
  const other = String(req.params.otherId);
  const id = cid(me, other);
  try {
    await pool.query(
      `UPDATE direct_messages SET read = true WHERE cid = $1 AND to_user = $2 AND read = false`,
      [id, me]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/messages/:otherId/read', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
