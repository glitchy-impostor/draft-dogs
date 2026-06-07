// Verify the §5.2 calibration spirit: scorelines should vary, especially
// across many simulations of similar ratings. A weak team losing every match
// 0-1 means the lambda formula collapsed and needs widening.

import { describe, expect, it } from 'vitest';
import { simulateTournament } from '../sim/tournament';
import worldcupConfig from '../../data/configs/worldcup.json';
import type { CompetitionConfig, TeamRating } from '../types';

const config = worldcupConfig as unknown as CompetitionConfig;

function fakeRating(R: number): TeamRating {
  return { slotScores: [], base: R, balancePen: 0, chem: 0, R };
}

describe('scoreline variety', () => {
  it('weak team (R=60) does not lose every match 0-1', () => {
    const scorelines = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateTournament(fakeRating(60), config, seed);
      for (const m of r.matches) {
        if (m.scoreLine) scorelines.add(m.scoreLine);
      }
    }
    expect(scorelines.size, `scorelines=${[...scorelines].slice(0, 10).join(',')}`).toBeGreaterThan(6);
  });

  it('elite team (R=95) wins by varied scorelines (not all 1-0)', () => {
    const scorelines = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const r = simulateTournament(fakeRating(95), config, seed);
      for (const m of r.matches) {
        if (m.outcome === 'W' && m.scoreLine) scorelines.add(m.scoreLine);
      }
    }
    expect(scorelines.size).toBeGreaterThan(6);
  });

  it('different seeds for the same rating produce different run summaries', () => {
    const records = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const r = simulateTournament(fakeRating(82), config, seed);
      records.add(`${r.record}|${r.matches.map(m => m.scoreLine).join(',')}`);
    }
    expect(records.size).toBeGreaterThan(50);
  });
});
