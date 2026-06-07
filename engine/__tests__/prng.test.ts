import { describe, expect, it } from 'vitest';
import { PRNG, mix32, seedFromString } from '../prng';

describe('PRNG', () => {
  it('is deterministic for the same seed', () => {
    const a = PRNG.fromSeed(12345);
    const b = PRNG.fromSeed(12345);
    for (let i = 0; i < 100; i++) {
      expect(a.nextU32()).toBe(b.nextU32());
    }
  });

  it('produces different streams for different seeds', () => {
    const a = PRNG.fromSeed(1);
    const b = PRNG.fromSeed(2);
    let diffs = 0;
    for (let i = 0; i < 100; i++) {
      if (a.nextU32() !== b.nextU32()) diffs++;
    }
    expect(diffs).toBeGreaterThan(95);
  });

  it('split derives independent reproducible streams', () => {
    const parent = PRNG.fromSeed('hello');
    const c1 = parent.split(1);
    const c2 = parent.clone().split(2);
    const c1Again = PRNG.fromSeed('hello').split(1);
    for (let i = 0; i < 50; i++) {
      expect(c1.nextU32()).toBe(c1Again.nextU32());
    }
    let diffs = 0;
    for (let i = 0; i < 50; i++) {
      if (PRNG.fromSeed('hello').split(1).nextU32() !== PRNG.fromSeed('hello').split(2).nextU32()) diffs++;
    }
    expect(diffs).toBeGreaterThan(40);
    void c2;
  });

  it('nextFloat is in [0,1)', () => {
    const r = PRNG.fromSeed(42);
    for (let i = 0; i < 1000; i++) {
      const f = r.nextFloat();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('nextInt covers full range without exceeding', () => {
    const r = PRNG.fromSeed(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(0, 10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
      seen.add(v);
    }
    expect(seen.size).toBe(10);
  });

  it('seedFromString is deterministic', () => {
    expect(seedFromString('worldcup-2026-06-06')).toBe(seedFromString('worldcup-2026-06-06'));
    expect(seedFromString('a')).not.toBe(seedFromString('b'));
  });

  it('mix32 returns uint32', () => {
    for (const x of [0, 1, 0xffffffff, 12345, -1]) {
      const v = mix32(x);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(0xffffffff);
    }
  });
});
