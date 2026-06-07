// The 500-seed determinism gate (§14 task 1 gate).
// For each seed, run a scripted draft (spin → pick deterministically → sim)
// twice and assert byte-identical outputs.

import { describe, expect, it } from 'vitest';
import { applyPick, initDraft, spin } from '../draft';
import { simulate } from '../sim';
import type { DraftState, PlayerPool, RunResult, TeamRating } from '../types';
import { worldCupTestConfig, worldCupTestPool } from './fixtures';

function scriptedDraft(seed: number): { result: RunResult; rating: TeamRating } {
  let state: DraftState = initDraft(worldCupTestConfig, {
    nonce: `det-${seed}`,
    seed,
    formationId: '4-3-3',
  });
  const pool: PlayerPool = worldCupTestPool;

  while (state.round < state.config.rounds) {
    state = spin(state);
    if (!state.spin) break;
    const cellPlayers = pool.players.filter(
      p => p.entity === state.spin!.entity && p.era === state.spin!.era,
    );
    const openSlotIdx = state.picks.findIndex(p => p === null);
    if (openSlotIdx < 0) break;
    const slot = state.slots[openSlotIdx];

    if (cellPlayers.length === 0) {
      // Skip rounds when the test pool lacks a player for the cell — represent
      // the slot as filled by a placeholder. In the real game the validator
      // ensures every landable cell has ≥8 players, so this path doesn't fire
      // in production. For determinism we just leave it null and continue.
      state = { ...state, spin: null, round: state.round + 1 };
      continue;
    }

    const usedIds = new Set(state.picks.filter((p): p is NonNullable<typeof p> => p !== null).map(p => p.playerId));
    const usedNames = new Set(
      [...usedIds].map(id => pool.players.find(p => p.id === id)?.name.toLowerCase().trim()),
    );
    const sorted = [...cellPlayers]
      .filter(p => !usedIds.has(p.id) && !usedNames.has(p.name.toLowerCase().trim()))
      .sort((a, b) => b.ovr - a.ovr || a.id.localeCompare(b.id));
    if (sorted.length === 0) {
      state = { ...state, spin: null, round: state.round + 1 };
      continue;
    }
    const pick = sorted[0];
    state = applyPick(state, pool, pick.id, slot.key);
  }
  return simulate(state, pool, state.config);
}

describe('determinism: 500 seeds', () => {
  it('two runs of the same scripted draft produce identical output for 500 seeds', () => {
    let mismatches = 0;
    const seeds = Array.from({ length: 500 }, (_, i) => 1000 + i);
    for (const seed of seeds) {
      const a = scriptedDraft(seed);
      const b = scriptedDraft(seed);
      const aJson = JSON.stringify(a);
      const bJson = JSON.stringify(b);
      if (aJson !== bJson) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});
