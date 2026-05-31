const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

function makeToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

function safeUser(row) {
  const { password_hash, ...u } = row;
  return u;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password, city, sport, level } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Nom, email et mot de passe requis.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Mot de passe trop court (6 caractères min).' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, city, sport, level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name.trim(), email.toLowerCase().trim(), hash, city || '', sport || '', level || 'Amateur']
    );
    const user  = safeUser(rows[0]);
    const token = makeToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email déjà utilisé.' });
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });

    const user  = safeUser(row);
    const token = makeToken(user.id);
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable.' });
    res.json({ user: safeUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', requireAuth, async (req, res) => {
  const { name, bio, city, phone, sport, level, wins, draws, losses } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET name  = COALESCE($1, name),
           bio   = COALESCE($2, bio),
           city  = COALESCE($3, city),
           phone = COALESCE($4, phone),
           sport = COALESCE($5, sport),
           level = COALESCE($6, level),
           wins  = COALESCE($7, wins),
           draws = COALESCE($8, draws),
           losses = COALESCE($9, losses)
       WHERE id = $10
       RETURNING *`,
      [name||null, bio||null, city||null, phone||null, sport||null, level||null,
       wins??null, draws??null, losses??null, req.user.id]
    );
    res.json({ user: safeUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
