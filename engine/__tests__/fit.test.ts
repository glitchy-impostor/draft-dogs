import { describe, expect, it } from 'vitest';
import { fit } from '../fit';
import type { Player, SlotDef } from '../types';

function makeSlot(over: Partial<SlotDef>): SlotDef {
  return {
    key: 'ST',
    eligible: ['ST', 'CF'],
    weight: 1.2,
    group: 'ATT',
    adjacent: ['LW', 'RW', 'CAM'],
    ...over,
  };
}

function makePlayer(positions: string[]): Player {
  return { id: 'p', name: 'P', entity: 'X', era: '2010s', positions, ovr: 90 };
}

describe('fit multiplier (§4.1)', () => {
  it('natural position = 1.0', () => {
    expect(fit(makePlayer(['ST']), makeSlot({}))).toBe(1.0);
  });

  it('adjacent position = 0.85', () => {
    expect(fit(makePlayer(['LW']), makeSlot({}))).toBe(0.85);
    expect(fit(makePlayer(['CAM']), makeSlot({}))).toBe(0.85);
  });

  it('wrong line = 0.55', () => {
    expect(fit(makePlayer(['CB']), makeSlot({}))).toBe(0.55);
  });

  it('GK slot demands a GK; outfielder in goal = 0.40', () => {
    const gkSlot = makeSlot({ key: 'GK', eligible: ['GK'], weight: 1.3, group: 'GK', adjacent: [] });
    expect(fit(makePlayer(['GK']), gkSlot)).toBe(1.0);
    expect(fit(makePlayer(['ST']), gkSlot)).toBe(0.4);
  });

  it('GK in an outfield slot = 0.40 (severe)', () => {
    expect(fit(makePlayer(['GK']), makeSlot({}))).toBe(0.4);
  });

  it('positionless (FREE) slot with empty eligible accepts anything at 1.0 (NBA)', () => {
    const freeSlot: SlotDef = { key: 'S1', eligible: [], weight: 1.0, group: 'FREE' };
    expect(fit(makePlayer(['ST']), freeSlot)).toBe(1.0);
    expect(fit(makePlayer(['CB']), freeSlot)).toBe(1.0);
    expect(fit({ id: 'p', name: 'P', entity: 'X', era: '2010s', positions: [], ovr: 90 }, freeSlot)).toBe(1.0);
  });

  it('typed slot with FREE group still enforces eligibility (NFL/NHL/MLB)', () => {
    // NFL config has slots like { eligible: ["QB"], group: "FREE" } — the
    // FREE group only means "positionless" when eligible is empty. A QB at
    // a WR slot must be penalized as wrong-line, not given the free pass.
    const wrSlot: SlotDef = { key: 'WR1', eligible: ['WR'], weight: 1.15, group: 'FREE' };
    expect(fit(makePlayer(['WR']), wrSlot)).toBe(1.0);
    expect(fit(makePlayer(['QB']), wrSlot)).toBe(0.55);
    expect(fit(makePlayer(['CB']), wrSlot)).toBe(0.55);
  });
});
