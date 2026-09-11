// One-off import: data.sports.gouv.fr (dataset "equipements-sportifs") -> terrains
//
// Usage:
//   node scripts/import-equipements-sportifs.js [options]
//
//   --force            backfill existing rows too (ON CONFLICT DO UPDATE instead of DO
//                       NOTHING) — always leaves `phone` alone, so a number a user added
//                       via PUT /:id/phone is never overwritten by a re-import.
//   --reset-progress   forget which departments were already completed and start over
//   --dep=XX           restrict to one INSEE department code, bypassing the department
//                       loop and progress file entirely (fast way to smoke-test)
//   --limit=N           (only with --dep) stop after N records read from the API
//   --dry-run           parse and count, but issue no INSERT and touch no local state
//
// Idempotent: the live Supabase `terrains` table has no natural key for the source's
// stable "equip_numero" (its `id` is an auto-generated bigint, unlike the VARCHAR(50)
// PK db.js declares for a fresh DB — the two have drifted). This script adds a nullable
// `source_id` column + a partial unique index the first time it runs, then upserts via
// ON CONFLICT (source_id) — DO NOTHING by default, DO UPDATE (minus `phone`) with
// --force — so re-running is safe for equipment already imported.
//
// Resilience: without --dep, the ~143k matching records are fetched one INSEE
// department at a time (the source's `exports/jsonl` endpoint has no offset/limit cap
// issue when used unfiltered, but a single 200MB stream has no resume point — sharding
// by department bounds how much a network drop can cost). Each department is retried
// up to 3 times with backoff; a department that still fails is skipped (not silently
// lost — it's simply absent from the progress file) and the run continues. Completed
// departments are recorded in .import-progress.json next to this script, so re-running
// the same command later only (re)processes what isn't done yet.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Readable } = require('stream');
const { pool } = require('../db');

const DATASET_URL = 'https://data.sports.gouv.fr/api/explore/v2.1/catalog/datasets/equipements-sportifs/exports/jsonl';
const RECORDS_URL = 'https://data.sports.gouv.fr/api/explore/v2.1/catalog/datasets/equipements-sportifs/records';
const PROGRESS_FILE = path.join(__dirname, '.import-progress.json');
const BATCH_SIZE = 500;
const RETRY_ATTEMPTS = 3;
const DEPT_TIMEOUT_MS = 5 * 60 * 1000;

// aps_name (source facet label) -> this app's SPORTS[].id (App.js)
const SPORT_MAP = {
  'Football / Football en salle (Futsal)': 'football',
  'Basket-Ball': 'basketball',
  'Tennis': 'tennis',
  'Rugby à 15 / Rugby à 7': 'rugby',
  'Padel': 'padel',
  'Badminton': 'badminton',
  'Tennis de table': 'pingpong',
  'Volley-ball / Volley-ball de plage (beach-volley) / Green-Volley': 'volleyball',
};

const args = process.argv.slice(2);
const dep = (args.find(a => a.startsWith('--dep=')) || '').split('=')[1] || null;
const limit = parseInt((args.find(a => a.startsWith('--limit=')) || '').split('=')[1], 10) || null;
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const resetProgress = args.includes('--reset-progress');

function sportsWhereClause() {
  return Object.keys(SPORT_MAP)
    .map(label => `aps_name="${label.replace(/"/g, '\\"')}"`)
    .join(' or ');
}

// depCode: a real INSEE code, or null for the bucket of equipment with no department set
function buildWhereClause(depCode) {
  let where = `(${sportsWhereClause()})`;
  if (depCode === undefined) return where; // no department filter at all (only used by --dep-less discovery base)
  where += depCode === null ? ' and dep_code is null' : ` and dep_code="${String(depCode).replace(/"/g, '')}"`;
  return where;
}

// The source sometimes gives a bare domain ("example.com") or a malformed scheme
// ("https:/example.com", single slash) — strip whatever scheme prefix is there and
// rebuild a clean https:// URL so it's directly usable as a clickable link.
function normalizeUrl(raw) {
  if (!raw) return null;
  const stripped = raw.trim().replace(/^https?:\/*/i, '');
  return stripped ? `https://${stripped}` : null;
}

function mapRecord(r) {
  if (!r.equip_numero) return null;

  const sports = [...new Set((r.aps_name || []).map(a => SPORT_MAP[a]).filter(Boolean))];
  if (sports.length === 0) return null;

  const lat = Number(r.equip_coordonnees?.lat);
  const lng = Number(r.equip_coordonnees?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = (r.equip_nom || r.inst_nom || 'Équipement sportif').slice(0, 200);
  const city = (r.new_name || '').slice(0, 100);
  const surface = (r.equip_sol || 'Non renseigné').slice(0, 50);
  const lights = r.equip_eclair === 'true';
  const ownerName = r.equip_prop_nom?.trim() || null;
  const website = normalizeUrl(r.equip_url);

  return [
    name,
    sports[0],                    // sport — legacy single-sport column, mirrors routes/terrains.js
    sports,                       // sports — text[]
    city,
    'France',                     // country
    surface,
    'Gratuit',                    // price — no pricing field in this dataset, leave the app default
    lights,
    null,                         // phone — not present in this dataset, left for the app's own PUT /:id/phone
    lat,
    lng,
    'data.sports.gouv.fr',        // added_by — shown as attribution in the app
    ownerName,
    website,
    `gouv:${r.equip_numero}`,     // source_id — idempotency key for this import
  ];
}

const COLS = ['name','sport','sports','city','country','surface','price','lights','phone','lat','lng','added_by','owner_name','website','source_id'];
const UPDATABLE_COLS = COLS.filter(c => c !== 'phone' && c !== 'source_id'); // never clobber a user-completed phone number

const MIGRATION_SQL = `
  ALTER TABLE terrains ADD COLUMN IF NOT EXISTS source_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS terrains_source_id_idx ON terrains (source_id) WHERE source_id IS NOT NULL;
  ALTER TABLE terrains ADD COLUMN IF NOT EXISTS owner_name TEXT;
  ALTER TABLE terrains ADD COLUMN IF NOT EXISTS website TEXT;
`;

function buildInsertSQL(rows) {
  const values = [];
  const placeholders = rows.map((row, i) => {
    const base = i * COLS.length;
    values.push(...row);
    return `(${COLS.map((_, j) => `$${base + j + 1}`).join(',')})`;
  }).join(',');

  if (!force) {
    return {
      text: `INSERT INTO terrains (${COLS.join(',')}) VALUES ${placeholders} ON CONFLICT (source_id) WHERE source_id IS NOT NULL DO NOTHING`,
      values,
    };
  }

  const setClause = UPDATABLE_COLS.map(c => `${c} = EXCLUDED.${c}`).join(', ');
  return {
    text: `INSERT INTO terrains (${COLS.join(',')}) VALUES ${placeholders}
           ON CONFLICT (source_id) WHERE source_id IS NOT NULL
           DO UPDATE SET ${setClause}
           RETURNING (xmax = 0) AS inserted`,
    values,
  };
}

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch { return { normal: [], force: [] }; }
}
function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function withRetry(label, fn, attempts = RETRY_ATTEMPTS) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(`[import] ${label} — tentative ${i}/${attempts} échouée: ${err.message}`);
      if (i < attempts) await new Promise(r => setTimeout(r, 1000 * i * i)); // 1s, 4s, ...
    }
  }
  throw lastErr;
}

// Discovers every dep_code present in the filtered dataset (paginated group_by; the API
// caps each page at 100 groups, and there are 108+, so this must page through).
async function discoverDepartments() {
  const where = buildWhereClause(undefined);
  const groups = [];
  let offset = 0;
  for (;;) {
    const url = `${RECORDS_URL}?where=${encodeURIComponent(where)}&select=${encodeURIComponent('dep_code,count(*) as n')}&group_by=dep_code&order_by=dep_code&limit=100&offset=${offset}`;
    const data = await withRetry(`découverte départements (offset=${offset})`, async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    });
    groups.push(...data.results);
    if (data.results.length < 100) break;
    offset += 100;
  }
  return groups.map(g => ({ code: g.dep_code, count: g.n }));
}

// Streams and upserts one department (or the null-department bucket). Returns stats.
async function importDepartment(depCode) {
  const url = `${DATASET_URL}?where=${encodeURIComponent(buildWhereClause(depCode))}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(DEPT_TIMEOUT_MS) });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const rl = readline.createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
  const stats = { fetched: 0, parseErrors: 0, skipped: 0, inserted: 0, updated: 0, duplicates: 0 };
  let batch = [];

  const flush = async () => {
    if (batch.length === 0) return;
    if (!dryRun) {
      const { text, values } = buildInsertSQL(batch);
      const result = await pool.query(text, values);
      if (force) {
        const ins = result.rows.filter(r => r.inserted).length;
        stats.inserted += ins;
        stats.updated += result.rows.length - ins;
      } else {
        stats.inserted += result.rowCount;
        stats.duplicates += batch.length - result.rowCount;
      }
    }
    batch = [];
  };

  for await (const line of rl) {
    if (!line.trim()) continue;
    stats.fetched++;

    let record;
    try { record = JSON.parse(line); } catch { stats.parseErrors++; continue; }

    const row = mapRecord(record);
    if (!row) { stats.skipped++; continue; }

    batch.push(row);
    if (batch.length >= BATCH_SIZE) await flush();

    if (limit && stats.fetched >= limit) break;
  }
  await flush();
  return stats;
}

function addStats(totals, s) {
  for (const k of Object.keys(s)) totals[k] += s[k];
}

async function runSingleDepartment() {
  console.log(`[import] département unique ${dep}${limit ? ` (max ${limit} lus)` : ''}`);
  const stats = await importDepartment(dep);
  return stats;
}

async function runAllDepartments() {
  const progress = resetProgress ? { normal: [], force: [] } : loadProgress();
  const bucket = force ? 'force' : 'normal';
  const done = new Set(progress[bucket] || []);

  const depts = await discoverDepartments();
  console.log(`[import] ${depts.length} groupes département détectés`);

  const totals = { fetched: 0, parseErrors: 0, skipped: 0, inserted: 0, updated: 0, duplicates: 0 };
  const failed = [];

  for (const { code, count } of depts) {
    const key = code === null ? '__sans_departement__' : code;
    if (done.has(key)) { console.log(`[import] ${key} déjà traité, ignoré`); continue; }

    console.log(`[import] ${key} (${count} équipements dans la source)…`);
    try {
      const stats = await withRetry(`département ${key}`, () => importDepartment(code));
      addStats(totals, stats);
      console.log(`[import]   → ${stats.inserted} insérés, ${stats.updated} mis à jour, ${stats.duplicates} déjà à jour, ${stats.skipped} ignorés`);

      if (!dryRun) {
        done.add(key);
        progress[bucket] = [...done];
        saveProgress(progress);
      }
    } catch (err) {
      console.error(`[import]   ✗ ${key} abandonné après ${RETRY_ATTEMPTS} tentatives: ${err.message}`);
      failed.push(key);
    }
  }

  if (failed.length) {
    console.log(`[import] ${failed.length} groupe(s) en échec, relancez la même commande pour reprendre uniquement ceux-ci: ${failed.join(', ')}`);
  }
  return totals;
}

async function main() {
  if (force) console.log('[import] mode --force: les lignes déjà importées seront mises à jour (téléphone préservé)');
  if (dryRun) console.log('[import] dry-run: aucune écriture, ni en base ni dans le fichier de progression');

  if (!dryRun) {
    await pool.query(MIGRATION_SQL);
    console.log('[import] colonnes source_id/owner_name/website prêtes');
  }

  const totals = dep ? await runSingleDepartment() : await runAllDepartments();

  console.log('[import] terminé.');
  console.log(`  lus:              ${totals.fetched}`);
  console.log(`  erreurs de parse: ${totals.parseErrors}`);
  console.log(`  ignorés (sport hors périmètre / sans coordonnées): ${totals.skipped}`);
  console.log(`  insérés:          ${totals.inserted}`);
  if (force) console.log(`  mis à jour:       ${totals.updated}`);
  else console.log(`  déjà présents:    ${totals.duplicates}`);
}

main()
  .catch(err => { console.error('[import] échec:', err); process.exitCode = 1; })
  .finally(() => pool.end());
