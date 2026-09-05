const router = require('express').Router();
const { pool } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/auth');

function rowToTeam(r) {
  return {
    id: r.id,
    name: r.name,
    sport: r.sport,
    city: r.city,
    lat: r.lat ? parseFloat(r.lat) : null,
    lng: r.lng ? parseFloat(r.lng) : null,
    level: r.level,
    open: r.open,
    avatar: r.avatar,
    isDemo: r.is_demo,
    members: parseInt(r.member_count || 0, 10),
    distanceKm: r.distance_km != null ? Math.round(parseFloat(r.distance_km)) : null,
  };
}

// GET /api/teams?lat=&lng=&sport=
router.get('/', optionalAuth, async (req, res) => {
  const { lat, lng, sport } = req.query;
  const hasGeo = lat && lng;

  const params = [];
  let distSelect = 'null as distance_km';
  if (hasGeo) {
    params.push(parseFloat(lat), parseFloat(lng));
    distSelect = `
      6371 * acos(
        greatest(-1, least(1,
          cos(radians($1)) * cos(radians(t.lat)) * cos(radians(t.lng) - radians($2))
          + sin(radians($1)) * sin(radians(t.lat))
        ))
      ) as distance_km`;
  }

  let where = '';
  if (sport) {
    params.push(sport);
    where = `where t.sport = $${params.length}`;
  }

  try {
    const { rows } = await pool.query(`
      select t.*,
        (select count(*) from team_members m
          where m.team_id = t.id and m.status = 'approved') as member_count,
        ${distSelect}
      from teams t
      ${where}
      order by ${hasGeo ? 'distance_km asc nulls last' : 't.id asc'}
    `, params);
    res.json(rows.map(rowToTeam));
  } catch (e) {
    console.error('GET /api/teams', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams/:id/join
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('select * from teams where id = $1', [req.params.id]);
    const team = rows[0];
    if (!team) return res.status(404).json({ error: 'team_not_found' });
    if (team.is_demo) return res.status(403).json({ error: 'demo_team' });
    if (!team.open) return res.status(403).json({ error: 'team_closed' });

    await pool.query(
      `insert into team_members (team_id, user_id, status)
       values ($1, $2, 'approved')
       on conflict (team_id, user_id) do nothing`,
      [team.id, req.user.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/teams/:id/join', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams
router.post('/', requireAuth, async (req, res) => {
  const { name, sport, city, lat, lng, level, avatar } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'missing_fields' });
  try {
    const { rows } = await pool.query(
      `insert into teams (name, sport, city, lat, lng, level, avatar, owner_id, open, is_demo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,false) returning *`,
      [name, sport, city || null, lat || null, lng || null, level || null, avatar || '⚽', req.user.id]
    );
    await pool.query(
      `insert into team_members (team_id, user_id, role, status)
       values ($1, $2, 'captain', 'approved')`,
      [rows[0].id, req.user.id]
    );
    res.json(rowToTeam({ ...rows[0], member_count: 1 }));
  } catch (e) {
    console.error('POST /api/teams', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;