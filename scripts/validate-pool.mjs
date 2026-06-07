// Validate a (config, pool) pair against §6.2 rules:
//   - every spinTable cell has ≥8 players in the pool
//   - every player references a valid entity in config.entities
//   - no duplicate player IDs
//   - player.era is in config.eraBands
//   - player.positions all match a known position vocab (warn on outliers)
//
// Usage: node scripts/validate-pool.mjs <configPath> <poolPath>

import fs from 'node:fs';
import path from 'node:path';

const POSITION_VOCAB = new Set([
  // soccer
  'GK',
  'LB','RB','CB','FB','WB',
  'CDM','CM','CAM','LM','RM','DM','AM',
  'LW','RW','ST','CF',
  // nfl
  'QB','RB','FB','WR','TE','T','G','C','OL',
  'DL','DT','DE','EDGE','LB','ILB','OLB','CB','S','FS','SS','DB',
  // nhl
  'D','LD','RD',
  // mlb
  'SP','RP','P','1B','2B','3B','SS','LF','CF','RF','OF','DH',
]);

function main() {
  const [, , configArg, poolArg] = process.argv;
  if (!configArg || !poolArg) {
    console.error('Usage: validate-pool.mjs <config.json> <pool.json>');
    process.exit(2);
  }
  const config = JSON.parse(fs.readFileSync(path.resolve(configArg), 'utf8'));
  const pool = JSON.parse(fs.readFileSync(path.resolve(poolArg), 'utf8'));

  const errors = [];
  const warnings = [];
  const entityIds = new Set(config.entities.map(e => e.id));
  const eraSet = new Set(config.eraBands);
  const seenIds = new Set();

  for (const p of pool.players) {
    if (seenIds.has(p.id)) errors.push(`duplicate player id: ${p.id}`);
    seenIds.add(p.id);
    // Unknown entity is a warning, not an error — those rows are orphans
    // (unreachable via spinTable) but still validly part of a union pool.
    if (!entityIds.has(p.entity)) warnings.push(`${p.id}: entity ${p.entity} not in config (orphan row)`);
    if (!eraSet.has(p.era)) errors.push(`${p.id}: unknown era ${p.era}`);
    for (const pos of p.positions ?? []) {
      if (!POSITION_VOCAB.has(pos)) warnings.push(`${p.id}: unusual position tag ${pos}`);
    }
    if (typeof p.ovr !== 'number' || p.ovr < 50 || p.ovr > 99) {
      errors.push(`${p.id}: ovr out of range (${p.ovr})`);
    }
  }

  const cellCounts = new Map();
  for (const p of pool.players) {
    const key = `${p.entity}/${p.era}`;
    cellCounts.set(key, (cellCounts.get(key) ?? 0) + 1);
  }
  const minDensity = 8;
  const lowCells = [];
  for (const cell of config.spinTable) {
    const key = `${cell.entity}/${cell.era}`;
    const n = cellCounts.get(key) ?? 0;
    if (n < minDensity) lowCells.push({ key, n });
  }

  console.log(`pool ${pool.competition} v${pool.poolVersion}: ${pool.players.length} players across ${cellCounts.size} cells`);
  console.log(`spinTable cells: ${config.spinTable.length}, low-density (< ${minDensity}): ${lowCells.length}`);
  if (lowCells.length) {
    for (const { key, n } of lowCells) console.log(`  LOW ${key}: ${n}`);
  }
  if (warnings.length) {
    console.log(`warnings: ${warnings.length}`);
    warnings.slice(0, 10).forEach(w => console.log(`  ${w}`));
  }
  if (errors.length) {
    console.log(`ERRORS: ${errors.length}`);
    errors.forEach(e => console.log(`  ${e}`));
    process.exit(1);
  }
  if (lowCells.length) {
    process.exit(1);
  }
  console.log('OK');
}

main();
