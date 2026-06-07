// Splittable 32-bit PRNG. Mulberry32 as the per-stream generator with a
// splitMix32-style mix for deriving child seeds. NEVER use Math.random in
// game logic — every draw must be reproducible from (seed, action sequence).

export type PRNGState = number; // uint32

export function mix32(z: PRNGState): PRNGState {
  z = (z + 0x9e3779b9) | 0;
  z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
  z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
  return (z ^ (z >>> 15)) >>> 0;
}

export function seedFromString(s: string): PRNGState {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return mix32(h >>> 0);
}

export class PRNG {
  state: PRNGState;
  constructor(state: PRNGState) {
    this.state = state >>> 0;
  }

  static fromSeed(seed: number | string): PRNG {
    if (typeof seed === 'string') return new PRNG(seedFromString(seed));
    return new PRNG(mix32(seed >>> 0));
  }

  nextU32(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  /** [0, 1) float */
  nextFloat(): number {
    return this.nextU32() / 0x100000000;
  }

  /** [min, max) integer */
  nextInt(min: number, maxExclusive: number): number {
    if (maxExclusive <= min) return min;
    const range = maxExclusive - min;
    return min + (this.nextU32() % range);
  }

  /** Standard-normal sample via Box–Muller; uses two uniforms per call. */
  nextNormal(mean = 0, std = 1): number {
    let u1 = this.nextFloat();
    if (u1 < 1e-12) u1 = 1e-12;
    const u2 = this.nextFloat();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  /** Derive an independent child PRNG. Splittable contract: same parent state
   * + same salt = same child stream, regardless of intervening draws. */
  split(salt: number = 0): PRNG {
    const childSeed = mix32((this.state ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0);
    return new PRNG(childSeed);
  }

  clone(): PRNG {
    return new PRNG(this.state);
  }
}

export function weightedPick<T>(prng: PRNG, items: T[], weights: number[]): T {
  if (items.length === 0) throw new Error('weightedPick: empty items');
  let total = 0;
  for (const w of weights) total += Math.max(0, w);
  if (total <= 0) return items[prng.nextInt(0, items.length)];
  let r = prng.nextFloat() * total;
  for (let i = 0; i < items.length; i++) {
    r -= Math.max(0, weights[i]);
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
