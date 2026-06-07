// Bottom sheet that lists the dealt cell's candidates. Stats are filtered
// per-player (no "0 goals" cell on a goalkeeper). If a player with the same
// name is already on the XI, the card carries an "ALREADY PICKED" badge —
// the genre permits it (§6.2 says one person can appear in multiple eras)
// but we should at least telegraph the duplication so the user is making
// the choice deliberately.

import type { GameMode, Pick, Player, SpinResult } from '@engine/types';

interface Props {
  spin: SpinResult | null;
  entityName: string;
  candidates: Player[];
  alreadyPicked: Map<string, Pick | null>;   // last name → pick if any
  mode: GameMode;
  selectedPlayerId: string | null;
  onSelectPlayer: (player: Player) => void;
  onCancel: () => void;
}

function displayStats(player: Player): Array<[string, string]> {
  if (!player.stats) return [];
  const entries: Array<[string, string]> = [];
  const isGK = player.positions.includes('GK');
  for (const [k, v] of Object.entries(player.stats)) {
    // skip 0-value or absent keys that are meaningless for the role
    if (v === 0 || v === '0') continue;
    if (isGK && (k === 'goals' || k === 'assists')) continue;
    entries.push([k, String(v)]);
  }
  return entries;
}

function dupKey(name: string): string {
  return name.toLowerCase().trim();
}

export function DraftSheet({ spin, entityName, candidates, alreadyPicked, mode, selectedPlayerId, onSelectPlayer, onCancel }: Props) {
  if (!spin) return null;
  const expert = mode === 'expert';
  return (
    <section className="draft-sheet" aria-label="Player picks">
      <header className="draft-sheet__head">
        <div className="draft-sheet__cell">
          <span className="draft-sheet__entity">{entityName}</span>
          <span className="draft-sheet__era">{spin.era}</span>
        </div>
        {selectedPlayerId && (
          <button type="button" className="draft-sheet__cancel" onClick={onCancel}>
            ← back
          </button>
        )}
      </header>
      {selectedPlayerId ? (
        <div className="draft-sheet__placement">
          Tap a slot on the pitch to place this player. Slot color shows fit.
        </div>
      ) : (
        <ul className="draft-sheet__list" role="listbox">
          {candidates.map(p => {
            const dup = alreadyPicked.has(dupKey(p.name));
            const stats = expert ? [] : displayStats(p);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  className={`player-card ${dup ? 'player-card--dup' : ''}`}
                  onClick={() => { if (!dup) onSelectPlayer(p); }}
                  disabled={dup}
                  aria-label={`Pick ${p.name}${dup ? ' (already on your XI — disabled)' : ''}`}
                >
                  <div className="player-card__main">
                    <div className="player-card__name">{p.name}</div>
                    <div className="player-card__row player-card__meta">
                      <span className="player-card__pos">{p.positions.join('·')}</span>
                      <span className="player-card__era">{p.era}</span>
                    </div>
                    {stats.length > 0 && (
                      <div className="player-card__stats">
                        {stats.map(([k, v]) => (
                          <span key={k} className="player-card__stat">
                            <span className="player-card__stat-k">{k}</span>
                            <span className="player-card__stat-v">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="player-card__aside">
                    {!expert && <div className="player-card__ovr">{p.ovr}</div>}
                    <div className="player-card__badges">
                      {p.tags?.includes('icon') && <span className="player-card__icon-badge">ICON</span>}
                      {dup && <span className="player-card__dup-badge">PICKED</span>}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
