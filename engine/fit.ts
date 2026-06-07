// Positional fit multiplier per §4.1.
//   natural: ×1.00
//   adjacent: ×0.85 (config-defined via slot.adjacent or slot.eligible)
//   wrong line: ×0.55
// GK is special: an outfielder in goal is ×0.40 (severe), real GK is ×1.00.
// Non-soccer competitions: slot.eligible drives this directly — non-eligible
// positions return ×0.55, and there is no GK-style severe class.

import type { Player, SlotDef } from './types';

export function fit(player: Player, slot: SlotDef): number {
  // Truly positionless slot (NBA — group:FREE AND no eligibility list). Any
  // player at full fit, including a player with no positions (NBA pool).
  if (slot.group === 'FREE' && slot.eligible.length === 0) {
    return 1.0;
  }
  // GK is special — both directions are heavily penalized.
  if (slot.group === 'GK') {
    return player.positions.includes('GK') ? 1.0 : 0.4;
  }
  if (player.positions.includes('GK')) {
    return 0.4;
  }
  if (slot.eligible.some(pos => player.positions.includes(pos))) {
    return 1.0;
  }
  if (slot.adjacent && slot.adjacent.some(pos => player.positions.includes(pos))) {
    return 0.85;
  }
  return 0.55;
}
