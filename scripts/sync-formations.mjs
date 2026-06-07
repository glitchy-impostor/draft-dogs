// Syncs the 6 canonical soccer formations across every soccer config in
// data/configs/. WC has them all; the other 10 soccer competitions were
// missing most. Idempotent — re-running adds nothing.
//
// Usage: node scripts/sync-formations.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONFIGS_DIR = path.join(ROOT, 'data', 'configs');

const SOCCER_SLUGS = [
  'epl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'mls',
  'ucl', 'euros', 'copa', 'mixedbag',
];

// Load WC as the source of truth.
const wc = JSON.parse(fs.readFileSync(path.join(CONFIGS_DIR, 'worldcup.json'), 'utf8'));
const canonical = wc.roster.formations;
const canonicalIds = new Set(canonical.map(f => f.id));

let touched = 0;
for (const slug of SOCCER_SLUGS) {
  const p = path.join(CONFIGS_DIR, `${slug}.json`);
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (cfg.roster?.type !== 'formation') continue;
  const existing = new Set((cfg.roster.formations ?? []).map(f => f.id));
  const missing = canonical.filter(f => !existing.has(f.id));
  if (missing.length === 0) {
    console.log(`${slug}: already in sync (${existing.size}/${canonicalIds.size})`);
    continue;
  }
  cfg.roster.formations = [...(cfg.roster.formations ?? []), ...missing];
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`${slug}: added ${missing.map(f => f.id).join(', ')} → ${cfg.roster.formations.length} total`);
  touched++;
}

console.log(`\n${touched} configs updated`);
