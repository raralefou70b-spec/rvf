require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { init, pool } = require('./db');

const app = express();

// Allow React dev, Capacitor iOS/Android, and the deployed frontend
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost',
  'capacitor://localhost',
  'https://localhost',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.railway.app') || origin.endsWith('.netlify.app') || origin.endsWith('.vercel.app')) {
      cb(null, true);
    } else {
      cb(null, true); // open during dev — restrict in prod if needed
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/terrains',require('./routes/terrains'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/admin',   require('./routes/admin'));

// Public maintenance status (no auth required)
app.get('/api/maintenance', async (_, res) => {
  try {
    const { rows } = await pool.query('SELECT active, message FROM maintenance WHERE id = 1');
    res.json(rows[0] || { active: false, message: '' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date() }));

const PORT = process.env.PORT || 3001;

init()
  .then(() => {
    app.listen(PORT, () => console.log(`RVF backend on port ${PORT}`));
  })
  .catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
  });
