// MLB diamond board. Pitcher on the mound, catcher behind home, infield in
// a diamond, outfield up top, DH off to the side. Same RosterBoard contract.

import type { Pick, Player, SlotDef } from '@engine/types';
import { fit as fitFn } from '@engine/fit';

interface Coord { x: number; y: number; }

const COORDS: Record<string, Coord> = {
  SP: { x: 50, y: 55 },
  C:  { x: 50, y: 90 },
  '1B': { x: 78, y: 60 },
  '2B': { x: 64, y: 42 },
  '3B': { x: 22, y: 60 },
  SS: { x: 36, y: 42 },
  LF: { x: 14, y: 18 },
  CF: { x: 50, y: 8 },
  RF: { x: 86, y: 18 },
  DH: { x: 12, y: 88 },
};

interface Props {
  slots: SlotDef[];
  picks: Array<Pick | null>;
  playersById: Map<string, Player>;
  candidatePlayer: Player | null;
  onSlotTap: (slotKey: string) => void;
  mode: 'classic' | 'expert' | 'hard' | 'daily';
}

function lastName(name: string): string {
  const parts = name.split(' ');
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

function fitClass(f: number): string {
  if (f >= 0.99) return 'diamond-slot--natural';
  return 'diamond-slot--wrong';
}

function filledFitClass(f: number): string {
  return f >= 0.99 ? '' : 'diamond-slot--filled-bad';
}

function scoreClass(f: number): string {
  return f >= 0.99 ? '' : 'diamond-slot__score--bad';
}

export function DiamondBoard({ slots, picks, playersById, candidatePlayer, onSlotTap, mode }: Props) {
  return (
    <div className="diamond-board" role="grid" aria-label="MLB roster">
      <div className="diamond-board__field" aria-hidden>
        <div className="diamond-line diamond-line--infield" />
        <div className="diamond-line diamond-line--outfield" />
        <div className="diamond-line diamond-line--basepath diamond-line--basepath-1" />
        <div className="diamond-line diamond-line--basepath diamond-line--basepath-2" />
        <div className="diamond-line diamond-line--basepath diamond-line--basepath-3" />
        <div className="diamond-line diamond-line--basepath diamond-line--basepath-4" />
        <div className="diamond-mound" />
        <div className="diamond-home" />
      </div>
      {slots.map((slot, i) => {
        const pos = COORDS[slot.key] ?? { x: 50, y: 50 };
        const pick = picks[i];
        const player = pick ? playersById.get(pick.playerId) : null;
        const candFit = candidatePlayer ? fitFn(candidatePlayer, slot) : 1;
        const showCandFit = !!candidatePlayer && !player;
        const filledFit = player ? fitFn(player, slot) : 1;
        const score = player ? Math.round(player.ovr * filledFit) : 0;
        return (
          <button
            key={slot.key}
            type="button"
            className={[
              'diamond-slot',
              player ? 'diamond-slot--filled' : 'diamond-slot--empty',
              player ? filledFitClass(filledFit) : '',
              showCandFit ? fitClass(candFit) : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onSlotTap(slot.key)}
            disabled={!!player && !candidatePlayer}
            aria-label={`${slot.key} slot${player ? `, ${player.name}` : ', empty'}`}
          >
            <span className="diamond-slot__key">{slot.key}</span>
            {player ? (
              <>
                <span className="diamond-slot__name">{lastName(player.name)}</span>
                {mode !== 'expert' && (
                  <span className={`diamond-slot__score ${scoreClass(filledFit)}`}>{score}</span>
                )}
                {mode !== 'expert' && filledFit < 0.99 && (
                  <span className="diamond-slot__raw">{player.ovr}×{filledFit.toFixed(2)}</span>
                )}
              </>
            ) : showCandFit ? (
              <span className="diamond-slot__fit">{Math.round(candFit * 100)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
