// NHL rink board. Forward line up top (LW-C-RW), defense pair below, goalie
// at the bottom of the rink. Same RosterBoard contract.

import type { Pick, Player, SlotDef } from '@engine/types';
import { fit as fitFn } from '@engine/fit';

interface Coord { x: number; y: number; }

const COORDS: Record<string, Coord> = {
  LW: { x: 18, y: 22 },
  C:  { x: 50, y: 18 },
  RW: { x: 82, y: 22 },
  D1: { x: 32, y: 52 },
  D2: { x: 68, y: 52 },
  G:  { x: 50, y: 86 },
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
  if (f >= 0.99) return 'rink-slot--natural';
  return 'rink-slot--wrong';
}

function filledFitClass(f: number): string {
  return f >= 0.99 ? '' : 'rink-slot--filled-bad';
}

function scoreClass(f: number): string {
  return f >= 0.99 ? '' : 'rink-slot__score--bad';
}

export function RinkBoard({ slots, picks, playersById, candidatePlayer, onSlotTap, mode }: Props) {
  return (
    <div className="rink-board" role="grid" aria-label="NHL roster">
      <div className="rink-board__ice" aria-hidden>
        <div className="rink-line rink-line--center" />
        <div className="rink-line rink-line--top-circle" />
        <div className="rink-line rink-line--bottom-circle" />
        <div className="rink-line rink-line--goal-top" />
        <div className="rink-line rink-line--goal-bottom" />
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
              'rink-slot',
              player ? 'rink-slot--filled' : 'rink-slot--empty',
              player ? filledFitClass(filledFit) : '',
              showCandFit ? fitClass(candFit) : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onSlotTap(slot.key)}
            disabled={!!player && !candidatePlayer}
            aria-label={`${slot.key} slot${player ? `, ${player.name}` : ', empty'}`}
          >
            <span className="rink-slot__key">{slot.key}</span>
            {player ? (
              <>
                <span className="rink-slot__name">{lastName(player.name)}</span>
                {mode !== 'expert' && (
                  <span className={`rink-slot__score ${scoreClass(filledFit)}`}>{score}</span>
                )}
                {mode !== 'expert' && filledFit < 0.99 && (
                  <span className="rink-slot__raw">{player.ovr}×{filledFit.toFixed(2)}</span>
                )}
              </>
            ) : showCandFit ? (
              <span className="rink-slot__fit">{Math.round(candFit * 100)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
