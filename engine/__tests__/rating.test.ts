import { describe, expect, it } from 'vitest';
import { rateTeam, BALANCE_LAMBDA } from '../rating';
import type { Pick, Player, SlotDef } from '../types';
import { worldCupTestConfig } from './fixtures';

function freeSlots(n: number): SlotDef[] {
  return Array.from({ length: n }, (_, i) => ({ key: `S${i + 1}`, eligible: [], weight: 1.0, group: 'FREE' }));
}

function freePicks(n: number): Pick[] {
  return Array.from({ length: n }, (_, i) => ({ playerId: `p${i + 1}`, slotKey: `S${i + 1}` }));
}

function pool(ovrs: number[]): Player[] {
  return ovrs.map((ovr, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    entity: 'X',
    era: '2010s',
    positions: [],
    ovr,
  }));
}

describe('team rating (§5.1)', () => {
  it('all 90s, perfect fit → R near 90', () => {
    const slots = freeSlots(5);
    const picks = freePicks(5);
    const players = pool([90, 90, 90, 90, 90]);
    const r = rateTeam(picks, slots, players, worldCupTestConfig);
    expect(r.base).toBeCloseTo(90, 5);
    expect(r.balancePen).toBeCloseTo(0, 5);
    expect(r.R).toBeCloseTo(90, 5);
  });

  it('balance penalty punishes a weak link', () => {
    const slots = freeSlots(5);
    const picks = freePicks(5);
    const players = pool([95, 95, 95, 95, 50]);
    const r = rateTeam(picks, slots, players, worldCupTestConfig);
    expect(r.base).toBeCloseTo((95 * 4 + 50) / 5, 5);
    const expectedPen = BALANCE_LAMBDA * (r.base - 50);
    expect(r.balancePen).toBeCloseTo(expectedPen, 5);
    expect(r.R).toBeLessThan(r.base);
  });

  it('R is clamped to [50, 99]', () => {
    const slots = freeSlots(3);
    const picks = freePicks(3);
    const r = rateTeam(picks, slots, pool([99, 99, 99]), worldCupTestConfig);
    expect(r.R).toBeLessThanOrEqual(99);
    expect(r.R).toBeGreaterThanOrEqual(50);
  });

  it('empty pick contributes 0 score and tanks balance', () => {
    const slots = freeSlots(2);
    const r = rateTeam([{ playerId: 'p1', slotKey: 'S1' }, null], slots, pool([99]), worldCupTestConfig);
    expect(r.R).toBeLessThan(99);
  });
});
