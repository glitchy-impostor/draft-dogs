// Syncs `tableOpponents: string[]` (flat list) and `tableLayout` (optional
// conference→division→teams grouping) into every season-mode config.
// Source: scripts/table-opponents.json. For soccer leagues the entry is a
// flat array; for American sports it is {conferences: [{name, divisions: [{name, teams}]}]}.
// Idempotent.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONFIGS_DIR = path.join(ROOT, 'data', 'configs');
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/table-opponents.json'), 'utf8'));

function flatten(entry) {
  if (Array.isArray(entry)) return { opponents: entry, layout: undefined };
  const opponents = [];
  for (const conf of entry.conferences) {
    for (const div of conf.divisions) {
      for (const team of div.teams) opponents.push(team);
    }
  }
  return { opponents, layout: { conferences: entry.conferences } };
}

function eqOpp(a, b) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
function eqLayout(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

let touched = 0;
for (const [slug, entry] of Object.entries(data)) {
  if (slug.startsWith('_')) continue;
  const p = path.join(CONFIGS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) continue;
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (cfg.runMode !== 'season') {
    console.log(`${slug}: not a season config, skipping`);
    continue;
  }
  const { opponents, layout } = flatten(entry);
  const sameOpps = eqOpp(cfg.tableOpponents ?? [], opponents);
  const sameLayout = eqLayout(cfg.tableLayout, layout);
  if (sameOpps && sameLayout) {
    console.log(`${slug}: already in sync (${opponents.length} opponents${layout ? ', layout present' : ''})`);
    continue;
  }
  cfg.tableOpponents = opponents;
  if (layout) cfg.tableLayout = layout;
  else delete cfg.tableLayout;
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`${slug}: wrote ${opponents.length} opponents${layout ? ' + layout' : ''}`);
  touched++;
}
console.log(`\n${touched} configs updated`);
