const router = require('express').Router();
const { pool } = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, user_id, user_name, type, description, status, created_at
       FROM reports ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ reports: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PATCH /api/admin/reports/:id
router.patch('/reports/:id', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['new', 'in_progress', 'resolved'].includes(status))
    return res.status(400).json({ error: 'Statut invalide.' });
  try {
    await pool.query('UPDATE reports SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/admin/block — block or unblock a user by email
router.post('/block', requireAdmin, async (req, res) => {
  const { email, blocked } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis.' });
  try {
    const { rowCount } = await pool.query(
      'UPDATE users SET blocked = $1 WHERE LOWER(email) = LOWER($2)',
      [blocked !== false, email.trim()]
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ ok: true, blocked: blocked !== false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PUT /api/admin/maintenance
router.put('/maintenance', requireAdmin, async (req, res) => {
  const { active, message } = req.body;
  try {
    await pool.query(
      'UPDATE maintenance SET active = $1, message = $2 WHERE id = 1',
      [!!active, message || '']
    );
    res.json({ ok: true, active: !!active, message: message || '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
