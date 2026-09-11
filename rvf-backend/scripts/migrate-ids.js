// One-off migration: FK consistency + Supabase Auth residue cleanup.
//
// Usage:
//   node scripts/migrate-ids.js                 dry checks + FK/cleanup, prints the
//                                                cascade impact of deleting the test
//                                                accounts (ids 2, 3, 4) but does NOT
//                                                delete them
//   node scripts/migrate-ids.js --delete-user-2  same, and also deletes those test
//                                                accounts after showing the preview:
//                                                id 2 (plaintext password_hash, unusable
//                                                account), ids 3/4 (testa/testb@rvf.app,
//                                                throwaway accounts from feature testing)
//
// Safety: every FK addition is preceded by a read-only orphan-row check. If any FK
// would fail, the script stops and prints the offending rows — it never deletes data
// to force a constraint through. Everything else runs in a single transaction (all or
// nothing). The test-account deletion is gated behind --delete-user-2 specifically so a
// first run can be used purely to review the cascade preview.
//
// reports.user_id is deliberately left as ON DELETE SET NULL (not upgraded to CASCADE):
// a moderation report should survive the deletion of its author's account.
require('dotenv').config();
const { pool } = require('../db');

const TEST_USER_IDS = [2, 3, 4];
const deleteTestUsers = process.argv.includes('--delete-user-2');

const ORPHAN_CHECKS = [
  {
    // from_user/to_user may already be integer (idempotent re-run after a prior
    // successful pass) or still text (first run) — cast both sides to text so the
    // check works either way.
    label: 'direct_messages.from_user/to_user -> users',
    sql: `SELECT count(*)::int AS n FROM direct_messages dm
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = dm.from_user::text)
             OR NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = dm.to_user::text)`,
  },
  {
    label: 'friendships.user_id -> users',
    sql: `SELECT count(*)::int AS n FROM friendships f
          WHERE f.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.user_id)`,
  },
  {
    label: 'friendships.friend_id -> users',
    sql: `SELECT count(*)::int AS n FROM friendships f
          WHERE f.friend_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = f.friend_id)`,
  },
  {
    label: 'team_members.user_id -> users',
    sql: `SELECT count(*)::int AS n FROM team_members tm
          WHERE tm.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tm.user_id)`,
  },
  {
    label: 'team_members.team_id -> teams',
    sql: `SELECT count(*)::int AS n FROM team_members tm
          WHERE tm.team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = tm.team_id)`,
  },
  {
    label: 'teams.owner_id -> users',
    sql: `SELECT count(*)::int AS n FROM teams t
          WHERE t.owner_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = t.owner_id)`,
  },
  {
    label: 'reports.user_id -> users',
    sql: `SELECT count(*)::int AS n FROM reports r
          WHERE r.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id)`,
  },
  {
    label: 'team_messages.team_id -> teams',
    sql: `SELECT count(*)::int AS n FROM team_messages tm
          WHERE tm.team_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.id = tm.team_id)`,
  },
];

// [table, constraint name, column, referenced table, referenced column]
const CASCADE_UPGRADES = [
  ['friendships',   'friendships_user_id_fkey',   'user_id',  'users', 'id'],
  ['friendships',   'friendships_friend_id_fkey', 'friend_id','users', 'id'],
  ['team_members',  'team_members_user_id_fkey',  'user_id',  'users', 'id'],
  ['team_members',  'team_members_team_id_fkey',  'team_id',  'teams', 'id'],
  ['teams',         'teams_owner_id_fkey',        'owner_id', 'users', 'id'],
];

async function main() {
  console.log('[migrate] vérification des lignes orphelines…');
  let blocked = false;
  for (const c of ORPHAN_CHECKS) {
    const { rows } = await pool.query(c.sql);
    const n = rows[0].n;
    if (n > 0) {
      console.error(`[migrate]   ✗ ${c.label}: ${n} ligne(s) orpheline(s) — BLOQUANT`);
      blocked = true;
    } else {
      console.log(`[migrate]   ✓ ${c.label}: 0 orpheline`);
    }
  }
  if (blocked) {
    console.error('[migrate] arrêt — corrige les lignes orphelines ci-dessus avant de relancer. Rien n\'a été modifié.');
    process.exitCode = 1;
    return;
  }

  const impact = await pool.query(
    `SELECT id, cid, from_user, to_user, content, created_at FROM direct_messages
     WHERE from_user::text = ANY($1::text[]) OR to_user::text = ANY($1::text[])`,
    [TEST_USER_IDS.map(String)]
  );
  console.log(`\n[migrate] impact si les comptes de test (${TEST_USER_IDS.join(', ')}) sont supprimés (direct_messages concernés: ${impact.rows.length}):`);
  console.log(JSON.stringify(impact.rows, null, 2));
  if (!deleteTestUsers) {
    console.log('[migrate] comptes de test NON supprimés cette fois (relance avec --delete-user-2 pour confirmer).\n');
  } else {
    console.log('[migrate] --delete-user-2 passé : la suppression sera exécutée après le reste de la migration.\n');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // All ADD CONSTRAINT / ALTER COLUMN steps below are guarded so re-running this
    // script after a prior successful (or partial) pass is a safe no-op for whatever
    // already landed, instead of failing on "already exists".
    const constraintExists = async name => {
      const { rows } = await client.query(
        `SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = $1`, [name]
      );
      return rows.length > 0;
    };
    const columnType = async (table, column) => {
      const { rows } = await client.query(
        `SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      );
      return rows[0]?.data_type;
    };

    console.log('[migrate] direct_messages: conversion en integer + FK…');
    if ((await columnType('direct_messages', 'from_user')) !== 'integer') {
      await client.query(`ALTER TABLE direct_messages ALTER COLUMN from_user TYPE integer USING from_user::integer`);
    }
    if ((await columnType('direct_messages', 'to_user')) !== 'integer') {
      await client.query(`ALTER TABLE direct_messages ALTER COLUMN to_user TYPE integer USING to_user::integer`);
    }
    if (!(await constraintExists('direct_messages_from_user_fkey'))) {
      await client.query(`ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_from_user_fkey FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE CASCADE`);
    }
    if (!(await constraintExists('direct_messages_to_user_fkey'))) {
      await client.query(`ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_to_user_fkey FOREIGN KEY (to_user) REFERENCES users(id) ON DELETE CASCADE`);
    }

    console.log('[migrate] team_messages.team_id -> teams (FK manquante)…');
    if (!(await constraintExists('team_messages_team_fk'))) {
      await client.query(`ALTER TABLE team_messages ADD CONSTRAINT team_messages_team_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE`);
    }

    console.log('[migrate] passage des FK existantes en ON DELETE CASCADE…');
    for (const [table, cons, col, refTable, refCol] of CASCADE_UPGRADES) {
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${cons}`);
      await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${cons} FOREIGN KEY (${col}) REFERENCES ${refTable}(${refCol}) ON DELETE CASCADE`);
      console.log(`[migrate]   ✓ ${table}.${col} -> ${refTable}.${refCol} (CASCADE)`);
    }

    console.log('[migrate] nettoyage résidus Supabase Auth (profiles, handle_new_user, trigger)…');
    await client.query(`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users`);
    await client.query(`DROP FUNCTION IF EXISTS public.handle_new_user()`);
    await client.query(`DROP TABLE IF EXISTS public.profiles CASCADE`);

    if (deleteTestUsers) {
      const { rowCount } = await client.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [TEST_USER_IDS]);
      console.log(`[migrate] comptes de test supprimés: ${rowCount} (ids ${TEST_USER_IDS.join(', ')}).`);
    }

    await client.query('COMMIT');
    console.log('[migrate] terminé avec succès.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] échec — tout annulé (transaction unique):', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

main()
  .catch(err => { console.error('[migrate] erreur non gérée:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
