// Basketball court board. Five positionless slots arranged in a half-court
// layout. Same RosterBoard contract as PitchBoard (slots / fills / tap to
// place / candidate-fit highlight) but no positional fit logic, since NBA
// is positionless per §4.2.

import type { Pick, Player, SlotDef } from '@engine/types';

interface Props {
  slots: SlotDef[];
  picks: Array<Pick | null>;
  playersById: Map<string, Player>;
  candidatePlayer: Player | null;
  onSlotTap: (slotKey: string) => void;
  mode: 'classic' | 'expert' | 'hard' | 'daily';
}

interface Coord { x: number; y: number; }

const SLOT_COORDS: Coord[] = [
  { x: 50, y: 14 },  // top of key
  { x: 18, y: 35 },  // left wing
  { x: 82, y: 35 },  // right wing
  { x: 30, y: 70 },  // left low post
  { x: 70, y: 70 },  // right low post
];

function lastName(name: string): string {
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}

export function CourtBoard({ slots, picks, playersById, candidatePlayer, onSlotTap, mode }: Props) {
  return (
    <div className="court-board" role="grid" aria-label="Basketball roster">
      <div className="court-board__floor" aria-hidden>
        <div className="court-line court-line--3pt" />
        <div className="court-line court-line--paint" />
        <div className="court-line court-line--ft" />
        <div className="court-line court-line--rim" />
      </div>
      {slots.map((slot, i) => {
        const pos = SLOT_COORDS[i] ?? { x: 50, y: 50 };
        const pick = picks[i];
        const player = pick ? playersById.get(pick.playerId) : null;
        return (
          <button
            key={slot.key}
            type="button"
            className={`court-slot ${player ? 'court-slot--filled' : 'court-slot--empty'} ${candidatePlayer && !player ? 'court-slot--candidate' : ''}`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onSlotTap(slot.key)}
            disabled={!!player && !candidatePlayer}
            aria-label={`Slot ${i + 1}${player ? `, ${player.name}` : ', empty'}`}
          >
            <span className="court-slot__num">{i + 1}</span>
            {player ? (
              <>
                <span className="court-slot__name">{lastName(player.name)}</span>
                {mode !== 'expert' && <span className="court-slot__ovr">{player.ovr}</span>}
              </>
            ) : (
              <span className="court-slot__placeholder">{candidatePlayer ? 'TAP' : '—'}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
