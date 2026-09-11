// One-off: generate referral_code for accounts that predate the column
// (added by hand in Supabase before generateUniqueReferralCode() existed).
require('dotenv').config();
const { pool, generateUniqueReferralCode } = require('../db');

async function main() {
  const { rows } = await pool.query('SELECT id, name FROM users WHERE referral_code IS NULL');
  if (!rows.length) { console.log('[backfill] rien à faire — tous les comptes ont déjà un referral_code.'); return; }
  for (const u of rows) {
    const code = await generateUniqueReferralCode(pool, u.name);
    await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, u.id]);
    console.log(`[backfill] id=${u.id} name=${u.name} -> ${code}`);
  }
}

main().catch(err => { console.error('[backfill] erreur:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());
