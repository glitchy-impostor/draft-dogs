// Team rating per §5.1.
//   slot_score_i = OVR_i × fit_i
//   base         = Σ(w_i × slot_score_i) / Σ w_i
//   balance_pen  = λ × max(0, base − min slot_score)        # λ ≈ 0.35
//   R            = clamp(base − balance_pen + chem, 50, 99)
//
// Chemistry is 0 in v1 (§4.1, flagged for "Season 2").

import { fit } from './fit';
import type { CompetitionConfig, Pick, Player, SlotDef, SlotScore, TeamRating } from './types';

export const BALANCE_LAMBDA = 0.35;

export function rateTeam(
  picks: Array<Pick | null>,
  slots: SlotDef[],
  pool: Player[],
  _config: CompetitionConfig,
): TeamRating {
  const byId = new Map(pool.map(p => [p.id, p] as const));
  const slotScores: SlotScore[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const pick = picks[i];
    if (!pick) {
      slotScores.push({
        slotKey: slot.key,
        playerId: '',
        ovr: 50,
        fit: 0,
        score: 0,
        weight: slot.weight,
      });
      continue;
    }
    const player = byId.get(pick.playerId);
    if (!player) {
      slotScores.push({
        slotKey: slot.key,
        playerId: pick.playerId,
        ovr: 50,
        fit: 0,
        score: 0,
        weight: slot.weight,
      });
      continue;
    }
    const f = fit(player, slot);
    slotScores.push({
      slotKey: slot.key,
      playerId: player.id,
      ovr: player.ovr,
      fit: f,
      score: player.ovr * f,
      weight: slot.weight,
    });
  }

  let weightedSum = 0;
  let weightTotal = 0;
  let minScore = Infinity;
  for (const s of slotScores) {
    weightedSum += s.weight * s.score;
    weightTotal += s.weight;
    if (s.score < minScore) minScore = s.score;
  }
  const base = weightTotal > 0 ? weightedSum / weightTotal : 0;
  if (!Number.isFinite(minScore)) minScore = 0;
  const balancePen = BALANCE_LAMBDA * Math.max(0, base - minScore);
  const chem = 0;
  const R = Math.max(50, Math.min(99, base - balancePen + chem));

  return { slotScores, base, balancePen, chem, R };
}
