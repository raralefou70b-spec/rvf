const router = require('express').Router();
const { pool } = require('../db');
const { optionalAuth } = require('../middleware/auth');

// POST /api/reports — optionalAuth (guests can report too)
router.post('/', optionalAuth, async (req, res) => {
  const { type, description } = req.body;
  if (!type || !['bug', 'hack'].includes(type))
    return res.status(400).json({ error: 'Type invalide (bug ou hack).' });
  if (!description || description.trim().length < 10)
    return res.status(400).json({ error: 'Description trop courte (10 caractères min).' });

  try {
    const userId   = req.user?.id   || null;
    const userName = req.user?.name || 'Anonyme';
    await pool.query(
      `INSERT INTO reports (user_id, user_name, type, description) VALUES ($1, $2, $3, $4)`,
      [userId, userName, type, description.trim()]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
