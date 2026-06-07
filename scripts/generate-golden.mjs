// Generates backend/tests/golden_vectors.json — the source of truth for
// engine parity tests. Run this from the project root:
//   node scripts/generate-golden.mjs
// then run the Python tests, which load this file and assert equality.

import fs from 'node:fs';
import path from 'node:path';

// Same Mulberry32 as engine/prng.ts — re-implemented here so this script
// has no TS-build dependency.
const MASK32 = 0xffffffff;
function toUint32(x) { return (x >>> 0); }
function imul32(a, b) { return Math.imul(a, b) >>> 0; }
function mix32(z) {
  z = (z + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

class PRNG {
  constructor(state) { this.state = toUint32(state); }
  static fromSeed(seed) { return new PRNG(mix32(toUint32(seed))); }
  nextU32() {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }
  nextFloat() { return this.nextU32() / 0x100000000; }
}

const seeds = [];
for (let i = 0; i < 100; i++) seeds.push(1000 + i * 7919);

const vectors = seeds.map(seed => {
  const r1 = PRNG.fromSeed(seed);
  const r2 = PRNG.fromSeed(seed);
  const u32 = [];
  const floats = [];
  for (let i = 0; i < 20; i++) u32.push(r1.nextU32());
  for (let i = 0; i < 20; i++) floats.push(r2.nextFloat());
  return { seed, u32, floats };
});

const out = {
  scheme: 'mulberry32-v1',
  count: vectors.length,
  vectors,
};

const outPath = path.resolve('backend/tests/golden_vectors.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(`wrote ${vectors.length} vectors to ${outPath}`);
