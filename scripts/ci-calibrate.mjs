// CI gate: for every (config, pool) pair in data/, run the validator and
// the Monte-Carlo calibration. Exits non-zero if anything fails — wire it
// into your CI as `node scripts/ci-calibrate.mjs --strict`. Per-pool
// tolerance bands live in scripts/calibration-bands.json.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const STRICT = process.argv.includes('--strict');
const N = Number(process.env.CALIBRATE_N ?? 3000);

const bands = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts/calibration-bands.json'), 'utf8'),
);
const defaultBand = bands._default;

const configsDir = path.join(ROOT, 'data/configs');
const poolsDir = path.join(ROOT, 'data/pools');
const slugs = fs.readdirSync(configsDir)
  .filter(f => f.endsWith('.json'))
  .map(f => path.basename(f, '.json'))
  .filter(slug => fs.existsSync(path.join(poolsDir, `${slug}.json`)))
  .sort();

console.log(`▸ ci-calibrate: ${slugs.length} pools, N=${N} per scenario`);
console.log('');

const results = [];
let hadFailure = false;

for (const slug of slugs) {
  const configPath = path.join('data/configs', `${slug}.json`);
  const poolPath = path.join('data/pools', `${slug}.json`);
  const band = bands[slug] ?? defaultBand;

  // 1) validator (pool density + entity/era consistency)
  const v = spawnSync('node', ['scripts/validate-pool.mjs', configPath, poolPath], {
    cwd: ROOT, encoding: 'utf8',
  });
  const validatorOk = v.status === 0;
  if (!validatorOk) {
    console.log(`✗ ${slug.padEnd(12)} validator FAILED`);
    console.log(v.stdout.split('\n').filter(l => l.startsWith('  ')).slice(0, 3).join('\n'));
    hadFailure = true;
    results.push({ slug, validatorOk, calibrationOk: false });
    continue;
  }

  // 2) calibration with per-pool bands
  const args = [
    'scripts/calibrate.py', configPath, poolPath,
    '--n', String(N),
    '--perfect-min', String(band.perfectMin),
    '--perfect-max', String(band.perfectMax),
    '--greedy-min', String(band.greedyMin),
    '--greedy-max', String(band.greedyMax),
  ];
  const c = spawnSync('python', args, { cwd: ROOT, encoding: 'utf8' });
  const lines = (c.stdout ?? '').split('\n');
  const perfectLine = lines.find(l => l.includes('perfect-record rate')) ?? '';
  const greedyLine = lines.slice(lines.indexOf(perfectLine) + 1).find(l => l.includes('perfect-record rate')) ?? '';
  const perfectPct = perfectLine.match(/([0-9]+\.[0-9]+)%/)?.[1] ?? '?';
  const greedyPct = greedyLine.match(/([0-9]+\.[0-9]+)%/)?.[1] ?? '?';
  // Parse the "Invariants: perfect PASS|FAIL | greedy PASS|FAIL" footer.
  const invLine = lines.find(l => l.startsWith('Invariants:')) ?? '';
  const perfectOk = /perfect\s+PASS/.test(invLine);
  const greedyOk = /greedy\s+PASS/.test(invLine);
  const calibrationOk = perfectOk && greedyOk;

  const mark = calibrationOk ? '✓' : '✗';
  console.log(
    `${mark} ${slug.padEnd(12)} ` +
    `perfect=${perfectPct.padStart(6)}% ` +
    `(${(band.perfectMin*100).toFixed(0)}-${(band.perfectMax*100).toFixed(0)})  ` +
    `greedy=${greedyPct.padStart(6)}% ` +
    `(${(band.greedyMin*100).toFixed(1)}-${(band.greedyMax*100).toFixed(1)})`,
  );
  if (!calibrationOk) hadFailure = true;
  results.push({ slug, validatorOk, calibrationOk, perfectPct, greedyPct });
}

console.log('');
const passes = results.filter(r => r.validatorOk && r.calibrationOk).length;
console.log(`▸ result: ${passes}/${results.length} pools within calibration band`);

if (hadFailure && STRICT) process.exit(1);
