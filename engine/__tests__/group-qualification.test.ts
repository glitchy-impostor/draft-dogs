// Tests for the group-stage qualification rule. Before this fix, group
// losses didn't eliminate so the "Crashed out · Group Stage" tier was
// unreachable — every weak team got tagged as "Out in the Round of 32".

import { describe, expect, it } from 'vitest';
import { simulateTournament } from '../sim/tournament';
import worldcupConfig from '../../data/configs/worldcup.json';
import type { CompetitionConfig, TeamRating } from '../types';

const config = worldcupConfig as unknown as CompetitionConfig;

function fakeRating(R: number): TeamRating {
  return { slotScores: [], base: R, balancePen: 0, chem: 0, R };
}

describe('group qualification', () => {
  it('weak teams (R=58) sometimes crash out in the group stage', () => {
    const groupExits = new Set<number>();
    let groupExitCount = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = simulateTournament(fakeRating(58), config, seed);
      if (r.stageReached === 'Group') {
        groupExitCount++;
        groupExits.add(seed);
      }
    }
    // The exact percent depends on RNG, but a weak team must crash in
    // groups at least sometimes — pre-fix this was 0.
    expect(groupExitCount).toBeGreaterThan(10);
  });

  it('strong teams (R=95) almost never crash in groups', () => {
    let groupExits = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = simulateTournament(fakeRating(95), config, seed);
      if (r.stageReached === 'Group' && !r.perfectRun) groupExits++;
    }
    // Strong teams should clear groups easily.
    expect(groupExits).toBeLessThan(15);
  });

  it('exit-stage distribution is no longer R32-dominant for mediocre teams', () => {
    const exits: Record<string, number> = {};
    for (let seed = 1; seed <= 500; seed++) {
      const r = simulateTournament(fakeRating(80), config, seed);
      if (r.perfectRun) continue;
      exits[r.stageReached] = (exits[r.stageReached] ?? 0) + 1;
    }
    // Mediocre teams should spread across at least 3 different exit stages.
    const distinctStages = Object.keys(exits).length;
    expect(distinctStages, `exits: ${JSON.stringify(exits)}`).toBeGreaterThanOrEqual(3);
  });
});
