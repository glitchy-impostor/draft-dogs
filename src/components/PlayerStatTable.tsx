// Renders flavor stat lines per XI member. Each row shows games + role-
// appropriate stats. Sorted by role (ATT → MID → DEF → GK) then by goals.

import type { Pick, Player } from '@engine/types';
import type { PlayerStatLine } from '@engine/sim';

const ROLE_RANK: Record<string, number> = { ATT: 0, MID: 1, DEF: 2, GK: 3 };

interface Props {
  picks: Array<Pick | null>;
  playersById: Map<string, Player>;
  playerStats: Map<string, PlayerStatLine>;
}

function formatStats(line: PlayerStatLine): string[] {
  const parts: string[] = [];
  if (line.goals !== undefined && (line.role === 'ATT' || line.role === 'MID' || (line.goals ?? 0) > 0)) {
    parts.push(`${line.goals}G`);
  }
  if (line.assists !== undefined && line.assists > 0) {
    parts.push(`${line.assists}A`);
  }
  if (line.cleanSheets !== undefined) {
    parts.push(`${line.cleanSheets} CS`);
  }
  return parts;
}

export function PlayerStatTable({ picks, playersById, playerStats }: Props) {
  const rows = picks
    .map((pick, i) => {
      if (!pick) return null;
      const player = playersById.get(pick.playerId);
      if (!player) return null;
      const line = playerStats.get(pick.playerId);
      if (!line) return null;
      return { index: i, pick, player, line };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  rows.sort((a, b) => {
    const ra = ROLE_RANK[a.line.role] ?? 5;
    const rb = ROLE_RANK[b.line.role] ?? 5;
    if (ra !== rb) return ra - rb;
    return (b.line.goals ?? 0) - (a.line.goals ?? 0);
  });

  if (rows.length === 0) return null;

  return (
    <section className="player-stats">
      <h3 className="player-stats__title">▸ Squad season</h3>
      <table className="player-stats__table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>G</th>
            <th>Stats</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ pick, player, line }) => (
            <tr key={pick.playerId} className={`player-stats__row player-stats__row--${line.role}`}>
              <td className="player-stats__name">{player.name}</td>
              <td className="player-stats__pos">{pick.slotKey}</td>
              <td className="player-stats__games">{line.games}</td>
              <td className="player-stats__line">
                {formatStats(line).join(' · ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
