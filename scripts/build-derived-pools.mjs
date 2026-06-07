// Builds reuse-derived pools per §7:
//   Euros pool = WC pool filtered to European entities
//   Copa pool  = WC pool filtered to South American entities
//   UCL pool   = union of big-5 league pools, era-normalized
//
// Usage: node scripts/build-derived-pools.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

function read(slug, kind) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'data', kind, `${slug}.json`), 'utf8'));
}

function write(slug, kind, obj) {
  const fp = path.join(ROOT, 'data', kind, `${slug}.json`);
  fs.writeFileSync(fp, JSON.stringify(obj, null, 2));
  return fp;
}

function reKey(player, prefix) {
  return { ...player, id: `${prefix}-${player.id}` };
}

// ── Euros (Europe-only WC re-key) ──────────────────────────────────────────
const EU_NATIONS = ['GER','FRA','ITA','ESP','NED','ENG','POR','BEL','CRO'];
{
  const wc = read('worldcup', 'pools');
  const players = wc.players
    .filter(p => EU_NATIONS.includes(p.entity))
    .map(p => reKey(p, 'eu'));
  const pool = { competition: 'euros', poolVersion: 1, players };
  const out = write('euros', 'pools', pool);
  console.log(`euros: ${players.length} players → ${path.relative(ROOT, out)}`);
}

// ── Copa (S. America-only WC re-key) ───────────────────────────────────────
const SA_NATIONS = ['BRA','ARG','URU'];
{
  const wc = read('worldcup', 'pools');
  const players = wc.players
    .filter(p => SA_NATIONS.includes(p.entity))
    .map(p => reKey(p, 'co'));
  const pool = { competition: 'copa', poolVersion: 1, players };
  const out = write('copa', 'pools', pool);
  console.log(`copa: ${players.length} players → ${path.relative(ROOT, out)}`);
}

// ── UCL (big-5 league union, era-normalized, top-club filter) ──────────────
const UCL_SOURCES = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
const UCL_CLUBS = new Set([
  'MUN','ARS','CHE','LIV','MCI',
  'RM','BAR','ATM',
  'JUV','MIL','INT',
  'BAY','DOR',
  'PSG',
]);
const EPL_ERA_MAP = { '1992-99': '1990s' }; // EPL banded; UCL uses decade buckets
function eraForUcl(srcSlug, era) {
  if (srcSlug === 'epl') return EPL_ERA_MAP[era] ?? era;
  return era;
}
{
  const players = [];
  for (const slug of UCL_SOURCES) {
    const pool = read(slug, 'pools');
    for (const p of pool.players) {
      if (!UCL_CLUBS.has(p.entity)) continue;
      const era = eraForUcl(slug, p.era);
      players.push({ ...p, id: `ucl-${p.id}`, era });
    }
  }
  const pool = { competition: 'ucl', poolVersion: 1, players };
  const out = write('ucl', 'pools', pool);
  console.log(`ucl: ${players.length} players → ${path.relative(ROOT, out)}`);
}

// ── Mixed Bag (all soccer-league clubs, light era normalization) ───────────
const MIXEDBAG_SOURCES = ['epl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'mls'];
{
  const players = [];
  for (const slug of MIXEDBAG_SOURCES) {
    const pool = read(slug, 'pools');
    for (const p of pool.players) {
      const era = slug === 'epl' ? (EPL_ERA_MAP[p.era] ?? p.era) : p.era;
      players.push({ ...p, id: `mb-${p.id}`, entity: `${slug}-${p.entity}`, era });
    }
  }
  const pool = { competition: 'mixedbag', poolVersion: 1, players };
  const out = write('mixedbag', 'pools', pool);
  console.log(`mixedbag: ${players.length} players → ${path.relative(ROOT, out)}`);
}
