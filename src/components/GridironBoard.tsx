// NFL board: 8 typed slots laid out as a half-field with offense at the
// scrimmage line and the front-7 / DB below. Same RosterBoard contract as
// PitchBoard. Slot fit uses the engine's existing typed-slot logic.

import type { Pick, Player, SlotDef } from '@engine/types';
import { fit as fitFn } from '@engine/fit';

interface Coord { x: number; y: number; }

const COORDS: Record<string, Coord> = {
  // Offense top (downfield), defense bottom. Vertical spacing tuned so
  // slots never overlap at the board's narrowest mobile width.
  WR1: { x: 10, y: 14 },
  TE:  { x: 70, y: 22 },
  WR2: { x: 90, y: 14 },
  OL:  { x: 50, y: 30 },
  RB:  { x: 22, y: 42 },
  QB:  { x: 55, y: 46 },
  F7:  { x: 35, y: 72 },
  DB:  { x: 65, y: 72 },
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
  if (f >= 0.99) return 'gridiron-slot--natural';
  if (f >= 0.54) return 'gridiron-slot--wrong';
  return 'gridiron-slot--bad';
}

function filledFitClass(f: number): string {
  if (f >= 0.99) return '';
  return 'gridiron-slot--filled-bad';
}

function scoreClass(f: number): string {
  if (f >= 0.99) return '';
  return 'gridiron-slot__score--bad';
}

export function GridironBoard({ slots, picks, playersById, candidatePlayer, onSlotTap, mode }: Props) {
  return (
    <div className="gridiron-board" role="grid" aria-label="NFL roster">
      <div className="gridiron-board__field" aria-hidden>
        <div className="gridiron-line gridiron-line--scrim" />
        <div className="gridiron-line gridiron-line--hash" style={{ top: '20%' }} />
        <div className="gridiron-line gridiron-line--hash" style={{ top: '40%' }} />
        <div className="gridiron-line gridiron-line--hash" style={{ top: '60%' }} />
        <div className="gridiron-line gridiron-line--hash" style={{ top: '80%' }} />
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
              'gridiron-slot',
              player ? 'gridiron-slot--filled' : 'gridiron-slot--empty',
              player ? filledFitClass(filledFit) : '',
              showCandFit ? fitClass(candFit) : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onSlotTap(slot.key)}
            disabled={!!player && !candidatePlayer}
            aria-label={`${slot.key} slot${player ? `, ${player.name}` : ', empty'}`}
          >
            <span className="gridiron-slot__key">{slot.key}</span>
            {player ? (
              <>
                <span className="gridiron-slot__name">{lastName(player.name)}</span>
                {mode !== 'expert' && (
                  <span className={`gridiron-slot__score ${scoreClass(filledFit)}`}>{score}</span>
                )}
                {mode !== 'expert' && filledFit < 0.99 && (
                  <span className="gridiron-slot__raw">{player.ovr}×{filledFit.toFixed(2)}</span>
                )}
              </>
            ) : showCandFit ? (
              <span className="gridiron-slot__fit">{Math.round(candFit * 100)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
