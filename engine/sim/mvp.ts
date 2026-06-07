// Picks a Player of the Season / MVP from the user's XI. For soccer we
// have flavor stats (goals + assists + clean sheets) so we use those;
// for American sports we fall back to fit-adjusted OVR until per-sport
// stat generators land.

import { fit } from '../fit';
import type { Pick, Player, SlotDef } from '../types';
import type { PlayerStatLine } from './playerStats';

export interface MvpPick {
  playerId: string;
  player: Player;
  slot: SlotDef;
  reason: string;        // e.g. "12 G · 4 A · 18 starts"
  fitAdjOvr: number;     // OVR × fit (for non-soccer / tie-break)
  goalsPlusAssists?: number;
  cleanSheets?: number;
}

export function pickMVP(
  picks: Array<Pick | null>,
  slots: SlotDef[],
  pool: Player[],
  playerStats: Map<string, PlayerStatLine>,
): MvpPick | null {
  const byId = new Map(pool.map(p => [p.id, p]));
  let best: MvpPick | null = null;

  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    if (!pick) continue;
    const player = byId.get(pick.playerId);
    if (!player) continue;
    const slot = slots[i];
    const fitAdj = player.ovr * fit(player, slot);
    const line = playerStats.get(pick.playerId);
    const ga = (line?.goals ?? 0) + (line?.assists ?? 0);
    const cs = line?.cleanSheets ?? 0;

    const candidate: MvpPick = {
      playerId: pick.playerId,
      player,
      slot,
      reason: line
        ? buildSoccerReason(line)
        : `OVR ${player.ovr} · ${slot.key}`,
      fitAdjOvr: fitAdj,
      goalsPlusAssists: line ? ga : undefined,
      cleanSheets: line ? cs : undefined,
    };

    if (!best) { best = candidate; continue; }
    if (line) {
      // Soccer: max G+A, tie-break on cleanSheets (for GK), then fit-adj OVR.
      const currG = best.goalsPlusAssists ?? 0;
      const newG = candidate.goalsPlusAssists ?? 0;
      if (newG > currG) best = candidate;
      else if (newG === currG) {
        const currCS = best.cleanSheets ?? 0;
        const newCS = candidate.cleanSheets ?? 0;
        if (newCS > currCS) best = candidate;
        else if (newCS === currCS && candidate.fitAdjOvr > best.fitAdjOvr) best = candidate;
      }
    } else {
      // Non-soccer: highest fit-adjusted OVR.
      if (candidate.fitAdjOvr > best.fitAdjOvr) best = candidate;
    }
  }
  return best;
}

function buildSoccerReason(line: PlayerStatLine): string {
  const parts: string[] = [];
  if (line.goals !== undefined && line.goals > 0) parts.push(`${line.goals} G`);
  if (line.assists !== undefined && line.assists > 0) parts.push(`${line.assists} A`);
  if (line.cleanSheets !== undefined && line.cleanSheets > 0) parts.push(`${line.cleanSheets} CS`);
  parts.push(`${line.games} starts`);
  return parts.join(' · ');
}
