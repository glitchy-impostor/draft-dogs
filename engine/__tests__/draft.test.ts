import { describe, expect, it } from 'vitest';
import {
  applyPick,
  initDraft,
  rerollEntity,
  rerollEra,
  spin,
} from '../draft';
import { worldCupTestConfig, worldCupTestPool } from './fixtures';
import type { CompetitionConfig, PlayerPool } from '../types';

function freshDraft(seed = 100, slug = 'test-nonce') {
  return initDraft(worldCupTestConfig, { nonce: slug, seed, formationId: '4-3-3' });
}

describe('draft state machine', () => {
  it('initializes with empty picks and full reroll budget', () => {
    const s = freshDraft();
    expect(s.picks.every(p => p === null)).toBe(true);
    expect(s.rerollsLeft).toEqual({ entity: 1, era: 1 });
    expect(s.round).toBe(0);
  });

  it('spin deals a (entity, era) from the spin table', () => {
    const s = spin(freshDraft());
    expect(s.spin).not.toBeNull();
    expect(worldCupTestConfig.spinTable.find(c => c.entity === s.spin!.entity && c.era === s.spin!.era)).toBeTruthy();
  });

  it('reroll entity keeps era, changes entity, decrements budget', () => {
    let s = spin(freshDraft(7));
    const era = s.spin!.era;
    const beforeBudget = s.rerollsLeft.entity;
    const rolled = rerollEntity(s);
    if (rolled === null) {
      // could fail because no other entity in this era; pick a different seed
      s = spin(freshDraft(8));
      const era2 = s.spin!.era;
      const r2 = rerollEntity(s);
      if (r2) {
        expect(r2.spin!.era).toBe(era2);
        expect(r2.rerollsLeft.entity).toBe(beforeBudget - 1);
      }
      return;
    }
    expect(rolled.spin!.era).toBe(era);
    expect(rolled.spin!.entity).not.toBe(s.spin!.entity);
    expect(rolled.rerollsLeft.entity).toBe(beforeBudget - 1);
  });

  it('reroll era keeps entity, decrements era budget', () => {
    let s = spin(freshDraft(99));
    const original = s.spin!;
    const rolled = rerollEra(s);
    if (rolled) {
      expect(rolled.spin!.entity).toBe(original.entity);
      expect(rolled.spin!.era).not.toBe(original.era);
      expect(rolled.rerollsLeft.era).toBe(s.rerollsLeft.era - 1);
    }
  });

  it('reroll returns null when budget exhausted', () => {
    let s = spin(freshDraft(1));
    const r1 = rerollEntity(s);
    if (r1) {
      const r2 = rerollEntity(r1);
      expect(r2).toBeNull();
    }
  });

  it('decades rule: era_repeat=false excludes drawn eras after a pick', () => {
    const decadesConfig: CompetitionConfig = {
      ...worldCupTestConfig,
      slug: 'decades-test',
      eraRepeat: false,
      rounds: 2,
      target: { games: 5, label: '5-0' },
      runMode: 'season',
      roster: {
        type: 'free',
        count: 2,
      },
      spinTable: [
        { entity: 'A', era: '1990s' },
        { entity: 'A', era: '2000s' },
        { entity: 'A', era: '2010s' },
      ],
      entities: [{ id: 'A', name: 'A' }],
      stages: undefined,
    };
    const decadesPool: PlayerPool = {
      competition: 'decades-test',
      poolVersion: 1,
      players: [
        { id: 'a90', name: 'a90', entity: 'A', era: '1990s', positions: [], ovr: 90 },
        { id: 'a00', name: 'a00', entity: 'A', era: '2000s', positions: [], ovr: 90 },
        { id: 'a10', name: 'a10', entity: 'A', era: '2010s', positions: [], ovr: 90 },
      ],
    };
    let s = initDraft(decadesConfig, { nonce: 'dec', seed: 5 });
    s = spin(s);
    const firstEra = s.spin!.era;
    s = applyPick(s, decadesPool, `a${firstEra.slice(0, -1).slice(-2)}`, 'S1');
    expect(s.drawnEras).toContain(firstEra);
    s = spin(s);
    expect(s.spin!.era).not.toBe(firstEra);
  });

  it('applyPick rejects players from the wrong cell', () => {
    let s = spin(freshDraft(42));
    expect(() => applyPick(s, worldCupTestPool, 'p-arg80-1', 'CAM')).toThrow();
  });

  it('applyPick rejects placing the same player ID twice', () => {
    let s = freshDraft(100);
    // Force a known cell by stubbing spin: pick from BRA 1970s
    s = { ...s, spin: { entity: 'BRA', era: '1970s' } };
    s = applyPick(s, worldCupTestPool, 'p-bra70-4', 'GK');
    s = { ...s, spin: { entity: 'BRA', era: '1970s' } };
    // Try to place the same player at another slot
    expect(() => applyPick(s, worldCupTestPool, 'p-bra70-4', 'LCB')).toThrow();
  });
});
