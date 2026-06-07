// Adds the right axisLabels {entity, era} to every config that needs them.
// SpinMachine + leaderboard headers fall back to "Nation"/"Era" otherwise,
// which is wrong for club leagues. Idempotent.
//
// Usage: node scripts/sync-axis-labels.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONFIGS_DIR = path.join(ROOT, 'data', 'configs');

const AXIS = {
  worldcup:   { entity: 'Nation',    era: 'Era' },
  euros:      { entity: 'Nation',    era: 'Era' },
  copa:       { entity: 'Nation',    era: 'Era' },
  epl:        { entity: 'Club',      era: 'Era' },
  laliga:     { entity: 'Club',      era: 'Era' },
  seriea:     { entity: 'Club',      era: 'Era' },
  bundesliga: { entity: 'Club',      era: 'Era' },
  ligue1:     { entity: 'Club',      era: 'Era' },
  mls:        { entity: 'Club',      era: 'Era' },
  ucl:        { entity: 'Club',      era: 'Era' },
  mixedbag:   { entity: 'Club',      era: 'Era' },
  nba:        { entity: 'Franchise', era: 'Decade' },
  nfl:        { entity: 'Franchise', era: 'Era' },
  nhl:        { entity: 'Franchise', era: 'Era' },
  mlb:        { entity: 'Franchise', era: 'Era' },
};

let touched = 0;
for (const [slug, labels] of Object.entries(AXIS)) {
  const p = path.join(CONFIGS_DIR, `${slug}.json`);
  if (!fs.existsSync(p)) continue;
  const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cur = cfg.axisLabels;
  if (cur && cur.entity === labels.entity && cur.era === labels.era) {
    console.log(`${slug}: already correct (${labels.entity} / ${labels.era})`);
    continue;
  }
  cfg.axisLabels = labels;
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  console.log(`${slug}: set axisLabels = ${labels.entity} / ${labels.era}`);
  touched++;
}
console.log(`\n${touched} configs updated`);
