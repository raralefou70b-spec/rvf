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
    captainId: r.owner_id,
    members: parseInt(r.member_count || 0, 10),
    distanceKm: r.distance_km != null ? Math.round(parseFloat(r.distance_km)) : null,
    // Always derived from team_members/owner_id for THIS team — never from the account's
    // global users.role, so a plain 'user' who creates a team gets full captain rights on it.
    isMember: !!r.is_member,
    isCaptain: !!r.is_captain,
  };
}

// GET /api/teams?lat=&lng=&sport=
router.get('/', optionalAuth, async (req, res) => {
  const { lat, lng, sport } = req.query;
  const hasGeo = lat && lng;
  const meId = req.user?.id || null;

  const params = [meId];
  let distSelect = 'null as distance_km';
  if (hasGeo) {
    params.push(parseFloat(lat), parseFloat(lng));
    distSelect = `
      6371 * acos(
        greatest(-1, least(1,
          cos(radians($${params.length-1})) * cos(radians(t.lat)) * cos(radians(t.lng) - radians($${params.length}))
          + sin(radians($${params.length-1})) * sin(radians(t.lat))
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
        exists(select 1 from team_members m where m.team_id = t.id and m.user_id = $1 and m.status = 'approved') as is_member,
        (t.owner_id = $1 or exists(
          select 1 from team_members m where m.team_id = t.id and m.user_id = $1 and m.role = 'captain' and m.status = 'approved'
        )) as is_captain,
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

// GET /api/teams/mine — teams the logged-in user is an approved member of (captain or not),
// used to populate the team-chat list in Messages.
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, m.role AS my_role,
        (SELECT count(*) FROM team_members m2 WHERE m2.team_id = t.id AND m2.status = 'approved') AS member_count
      FROM teams t
      JOIN team_members m ON m.team_id = t.id AND m.user_id = $1 AND m.status = 'approved'
      ORDER BY t.name ASC
    `, [req.user.id]);
    res.json(rows.map(r => rowToTeam({
      ...r,
      is_member: true,
      is_captain: r.owner_id === req.user.id || r.my_role === 'captain',
    })));
  } catch (e) {
    console.error('GET /api/teams/mine', e);
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

// GET /api/teams/:id/members — approved roster; a fellow approved member also sees pending invitations
router.get('/:id/members', optionalAuth, async (req, res) => {
  const teamId = req.params.id;
  try {
    const { rows: teamRows } = await pool.query('SELECT id FROM teams WHERE id = $1', [teamId]);
    if (!teamRows[0]) return res.status(404).json({ error: 'team_not_found' });

    const { rows: members } = await pool.query(
      `SELECT tm.id, tm.user_id, tm.role, u.name, u.city, u.xp, u.name_color
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 AND tm.status = 'approved'
       ORDER BY (tm.role = 'captain') DESC, tm.created_at ASC`,
      [teamId]
    );

    let pendingInvites = [];
    if (req.user?.id && await isTeamMember(req.user.id, teamId)) {
      const { rows } = await pool.query(
        `SELECT tm.id, tm.user_id, u.name, u.city, tm.created_at
         FROM team_members tm JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $1 AND tm.status = 'pending'
         ORDER BY tm.created_at DESC`,
        [teamId]
      );
      pendingInvites = rows;
    }

    res.json({ members, pendingInvites });
  } catch (e) {
    console.error('GET /api/teams/:id/members', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams/:id/invite — any approved member invites a user by id (pending team_members row)
router.post('/:id/invite', requireAuth, async (req, res) => {
  const teamId = req.params.id;
  const targetUserId = parseInt(req.body.userId, 10);
  if (!targetUserId) return res.status(400).json({ error: 'missing_user_id' });
  if (targetUserId === req.user.id) return res.status(400).json({ error: 'cannot_invite_self' });

  try {
    const { rows: teamRows } = await pool.query('SELECT id, is_demo FROM teams WHERE id = $1', [teamId]);
    const team = teamRows[0];
    if (!team) return res.status(404).json({ error: 'team_not_found' });
    if (team.is_demo) return res.status(403).json({ error: 'demo_team' });
    if (!(await isTeamMember(req.user.id, teamId))) return res.status(403).json({ error: 'not_a_member' });

    const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
    if (!userRows[0]) return res.status(404).json({ error: 'user_not_found' });

    const { rows: existing } = await pool.query(
      'SELECT status FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, targetUserId]
    );
    if (existing[0]?.status === 'approved') return res.status(409).json({ error: 'already_member' });
    if (existing[0]?.status === 'pending')  return res.status(409).json({ error: 'already_invited' });

    const { rows } = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role, status)
       VALUES ($1, $2, 'member', 'pending')
       ON CONFLICT (team_id, user_id) DO NOTHING
       RETURNING *`,
      [teamId, targetUserId]
    );
    if (!rows[0]) return res.status(409).json({ error: 'already_invited' });

    res.status(201).json({ ok: true, invitation: rows[0] });
  } catch (e) {
    console.error('POST /api/teams/:id/invite', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/teams/invitations — pending invitations addressed to the logged-in user
router.get('/invitations', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tm.id, tm.team_id, tm.created_at, t.name, t.sport, t.city, t.avatar
       FROM team_members tm JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND tm.status = 'pending'
       ORDER BY tm.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/teams/invitations', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams/invitations/:id/accept
router.post('/invitations/:id/accept', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE team_members SET status = 'approved'
       WHERE id = $1 AND user_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'invitation_not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/teams/invitations/:id/accept', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams/invitations/:id/decline
router.post('/invitations/:id/decline', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM team_members WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id`,
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'invitation_not_found' });
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/teams/invitations/:id/decline', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams
router.post('/', requireAuth, async (req, res) => {
  const { name, sport, city, lat, lng, level, avatar } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'missing_fields' });

  // Single transaction: a team must never exist without its captain row, so a crash
  // between the two inserts must roll back the team creation too, not leave it orphaned.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `insert into teams (name, sport, city, lat, lng, level, avatar, owner_id, open, is_demo)
       values ($1,$2,$3,$4,$5,$6,$7,$8,true,false) returning *`,
      [name, sport, city || null, lat || null, lng || null, level || null, avatar || '⚽', req.user.id]
    );
    await client.query(
      `insert into team_members (team_id, user_id, role, status)
       values ($1, $2, 'captain', 'approved')`,
      [rows[0].id, req.user.id]
    );
    await client.query('COMMIT');
    res.json(rowToTeam({ ...rows[0], member_count: 1, is_member: true, is_captain: true }));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('POST /api/teams', e);
    res.status(500).json({ error: 'server_error' });
  } finally {
    client.release();
  }
});

// Membership check shared by the two message routes below
async function isTeamMember(userId, teamId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'approved'
     UNION SELECT 1 FROM teams WHERE id = $1 AND owner_id = $2`,
    [teamId, userId]
  );
  return rows.length > 0;
}

// GET /api/teams/:id/messages
router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    if (!(await isTeamMember(req.user.id, req.params.id)))
      return res.status(403).json({ error: 'not_a_member' });
    const { rows } = await pool.query(
      `SELECT id, team_id, user_id, user_name, content, created_at
       FROM team_messages WHERE team_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /api/teams/:id/messages', e);
    res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/teams/:id/messages
router.post('/:id/messages', requireAuth, async (req, res) => {
  const content = (req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'empty_message' });
  try {
    if (!(await isTeamMember(req.user.id, req.params.id)))
      return res.status(403).json({ error: 'not_a_member' });
    const { rows: [u] } = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
    const { rows } = await pool.query(
      `INSERT INTO team_messages (team_id, user_id, user_name, content)
       VALUES ($1, $2, $3, $4) RETURNING id, team_id, user_id, user_name, content, created_at`,
      [req.params.id, req.user.id, u?.name || '', content]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('POST /api/teams/:id/messages', e);
    res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;