// Live smoke tests against the actual data/configs + data/pools JSON.
// These catch issues like "spinner always lands on same cell" by sampling
// many seeds and asserting that the result varies — proves the engine and
// the real config are wired up correctly.

import { describe, expect, it } from 'vitest';
import worldcupConfig from '../../data/configs/worldcup.json';
import worldcupPool from '../../data/pools/worldcup.json';
import nbaConfig from '../../data/configs/nba.json';
import nbaPool from '../../data/pools/nba.json';
import { applyPick, initDraft, spin } from '../draft';
import { simulate } from '../sim';
import type { CompetitionConfig, PlayerPool, SpinResult } from '../types';

const config = worldcupConfig as unknown as CompetitionConfig;
const pool = worldcupPool as unknown as PlayerPool;
const nbaCfg = nbaConfig as unknown as CompetitionConfig;
const nbaPl = nbaPool as unknown as PlayerPool;

describe('worldcup smoke (real JSON)', () => {
  it('first-spin distribution covers >5 cells across 200 seeds', () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const seed = (i + 1) * 2654435761;
      const draft = initDraft(config, { nonce: `smoke-${i}`, seed, formationId: '4-3-3' });
      const next = spin(draft);
      const s = next.spin as SpinResult;
      const key = `${s.entity}/${s.era}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const distinctCells = seen.size;
    expect(distinctCells, `distinct first-spin cells: ${distinctCells}; top=${[...seen.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}(${v})`).join(',')}`).toBeGreaterThan(5);
  });

  it('every spinTable cell has ≥8 players in the pool', () => {
    const counts = new Map<string, number>();
    for (const p of pool.players) {
      const key = `${p.entity}/${p.era}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const tooThin = config.spinTable.filter(c => (counts.get(`${c.entity}/${c.era}`) ?? 0) < 8);
    expect(tooThin, JSON.stringify(tooThin)).toHaveLength(0);
  });

  it('first-spin player filter returns at least 8 candidates', () => {
    const draft = initDraft(config, { nonce: 'smoke', seed: 42, formationId: '4-3-3' });
    const next = spin(draft);
    const s = next.spin as SpinResult;
    const candidates = pool.players.filter(p => p.entity === s.entity && p.era === s.era);
    expect(candidates.length, `cell ${s.entity}/${s.era}`).toBeGreaterThanOrEqual(8);
  });
});

describe('nba smoke (positionless + decades rule)', () => {
  it('5 free slots, no formation', () => {
    const draft = initDraft(nbaCfg, { nonce: 'nba-smoke', seed: 1 });
    expect(draft.slots).toHaveLength(5);
    expect(draft.slots.every(s => s.group === 'FREE')).toBe(true);
    expect(draft.formation).toBeNull();
  });

  it('decades rule: 5 spins yield 5 distinct decades', () => {
    let state = initDraft(nbaCfg, { nonce: 'nba-dec', seed: 7 });
    const decades = new Set<string>();
    for (let r = 0; r < 5; r++) {
      state = spin(state);
      if (!state.spin) break;
      decades.add(state.spin.era);
      const cands = nbaPl.players.filter(p => p.entity === state.spin!.entity && p.era === state.spin!.era);
      expect(cands.length).toBeGreaterThanOrEqual(8);
      const cand = cands[0];
      state = applyPick(state, nbaPl, cand.id, state.slots[r].key);
    }
    expect(decades.size).toBe(5);
  });

  it('a complete NBA draft simulates without error', () => {
    let state = initDraft(nbaCfg, { nonce: 'nba-sim', seed: 99 });
    const usedIds = new Set<string>();
    const usedNames = new Set<string>();
    for (let r = 0; r < 5; r++) {
      state = spin(state);
      if (!state.spin) break;
      const cands = nbaPl.players.filter(p =>
        p.entity === state.spin!.entity && p.era === state.spin!.era &&
        !usedIds.has(p.id) && !usedNames.has(p.name.toLowerCase().trim()),
      );
      const cand = cands[0];
      usedIds.add(cand.id);
      usedNames.add(cand.name.toLowerCase().trim());
      state = applyPick(state, nbaPl, cand.id, state.slots[r].key);
    }
    const { result } = simulate(state, nbaPl, nbaCfg);
    // Regular season is 82 games; playoffs add up to 4 more if the team
    // makes the cut, so the total is 82..86 with no draws.
    const total = result.wins + result.losses + result.draws;
    expect(total).toBeGreaterThanOrEqual(82);
    expect(total).toBeLessThanOrEqual(82 + (nbaCfg.sim.playoffStages?.length ?? 0));
    expect(result.draws).toBe(0);
  });
});
