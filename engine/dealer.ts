// Spin dealer per §2. Spins yield (entity, era) from the config's spinTable.
// Era-repeat false (NBA decades rule) filters out already-drawn eras.
// Entity spinWeight from config can bias toward deeper-pool nations.

import type { CompetitionConfig, SpinResult } from './types';
import { PRNG, weightedPick } from './prng';

export function dealSpin(
  prng: PRNG,
  config: CompetitionConfig,
  drawnEras: string[],
): SpinResult {
  const allowed = config.eraRepeat
    ? config.spinTable
    : config.spinTable.filter(cell => !drawnEras.includes(cell.era));
  if (allowed.length === 0) {
    throw new Error(`dealSpin: no spinTable cells remain for ${config.slug}`);
  }
  const entityWeight = new Map(config.entities.map(e => [e.id, e.spinWeight ?? 1.0] as const));
  const weights = allowed.map(cell => entityWeight.get(cell.entity) ?? 1.0);
  return weightedPick(prng, allowed, weights);
}
