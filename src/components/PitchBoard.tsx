// Formation-based soccer pitch. Renders 11 slots at fixed coordinates per
// formation. Empty slots highlight with fit color when a candidate is
// selected; filled slots show the fit-adjusted score (so the user sees
// Casillas-at-CB as 38 not 95).

import type { Pick, Player, SlotDef, Formation } from '@engine/types';
import { fit as fitFn } from '@engine/fit';

interface Coord { x: number; y: number; }

const COORDS: Record<string, Record<string, Coord>> = {
  '4-3-3': {
    GK: { x: 50, y: 92 },
    LB: { x: 10, y: 75 }, LCB: { x: 35, y: 80 }, RCB: { x: 65, y: 80 }, RB: { x: 90, y: 75 },
    CDM: { x: 50, y: 60 }, LCM: { x: 25, y: 50 }, RCM: { x: 75, y: 50 },
    LW: { x: 18, y: 20 }, ST: { x: 50, y: 12 }, RW: { x: 82, y: 20 },
  },
  '4-4-2': {
    GK: { x: 50, y: 92 },
    LB: { x: 10, y: 75 }, LCB: { x: 35, y: 80 }, RCB: { x: 65, y: 80 }, RB: { x: 90, y: 75 },
    LM: { x: 10, y: 45 }, LCM: { x: 35, y: 50 }, RCM: { x: 65, y: 50 }, RM: { x: 90, y: 45 },
    LS: { x: 35, y: 15 }, RS: { x: 65, y: 15 },
  },
  '3-5-2': {
    GK: { x: 50, y: 92 },
    LCB: { x: 25, y: 80 }, CCB: { x: 50, y: 82 }, RCB: { x: 75, y: 80 },
    LWB: { x: 8, y: 55 }, LCM: { x: 30, y: 55 }, CDM: { x: 50, y: 65 }, RCM: { x: 70, y: 55 }, RWB: { x: 92, y: 55 },
    LS: { x: 35, y: 15 }, RS: { x: 65, y: 15 },
  },
  '4-2-3-1': {
    GK: { x: 50, y: 92 },
    LB: { x: 10, y: 75 }, LCB: { x: 35, y: 80 }, RCB: { x: 65, y: 80 }, RB: { x: 90, y: 75 },
    LDM: { x: 35, y: 60 }, RDM: { x: 65, y: 60 },
    LAM: { x: 20, y: 38 }, CAM: { x: 50, y: 38 }, RAM: { x: 80, y: 38 },
    ST: { x: 50, y: 12 },
  },
  '5-3-2': {
    GK: { x: 50, y: 92 },
    LWB: { x: 8, y: 65 }, LCB: { x: 28, y: 80 }, CCB: { x: 50, y: 84 }, RCB: { x: 72, y: 80 }, RWB: { x: 92, y: 65 },
    LCM: { x: 25, y: 45 }, CDM: { x: 50, y: 50 }, RCM: { x: 75, y: 45 },
    LS: { x: 35, y: 15 }, RS: { x: 65, y: 15 },
  },
  '3-4-3': {
    GK: { x: 50, y: 92 },
    LCB: { x: 25, y: 80 }, CCB: { x: 50, y: 82 }, RCB: { x: 75, y: 80 },
    LM: { x: 8, y: 50 }, LCM: { x: 35, y: 55 }, RCM: { x: 65, y: 55 }, RM: { x: 92, y: 50 },
    LW: { x: 18, y: 18 }, ST: { x: 50, y: 12 }, RW: { x: 82, y: 18 },
  },
};

interface Props {
  formation: Formation;
  slots: SlotDef[];
  picks: Array<Pick | null>;
  playersById: Map<string, Player>;
  candidatePlayer: Player | null;
  onSlotTap: (slotKey: string) => void;
  mode: 'classic' | 'expert' | 'hard' | 'daily';
}

function fitClass(f: number): string {
  if (f >= 0.99) return 'pitch-slot--natural';
  if (f >= 0.84) return 'pitch-slot--adjacent';
  if (f >= 0.54) return 'pitch-slot--wrong';
  return 'pitch-slot--gk-mismatch';
}

function filledFitClass(f: number): string {
  if (f >= 0.99) return '';
  if (f >= 0.84) return 'pitch-slot--filled-warn';
  return 'pitch-slot--filled-bad';
}

function scoreClass(f: number): string {
  if (f >= 0.99) return '';
  if (f >= 0.84) return 'pitch-slot__score--penalized';
  return 'pitch-slot__score--bad';
}

export function PitchBoard({ formation, slots, picks, playersById, candidatePlayer, onSlotTap, mode }: Props) {
  const coords = COORDS[formation.id] ?? COORDS['4-3-3'];
  return (
    <div className="pitch-board" role="grid" aria-label={`Formation ${formation.name}`}>
      <div className="pitch-board__grass" aria-hidden>
        <div className="pitch-line pitch-line--mid" />
        <div className="pitch-line pitch-line--center-circle" />
        <div className="pitch-line pitch-line--box-bottom" />
        <div className="pitch-line pitch-line--box-top" />
      </div>
      {slots.map((slot, i) => {
        const pos = coords[slot.key] ?? { x: 50, y: 50 };
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
              'pitch-slot',
              player ? 'pitch-slot--filled' : 'pitch-slot--empty',
              player ? filledFitClass(filledFit) : '',
              showCandFit ? fitClass(candFit) : '',
            ].filter(Boolean).join(' ')}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            onClick={() => onSlotTap(slot.key)}
            disabled={!!player && !candidatePlayer}
            aria-label={`${slot.key} slot${player ? `, ${player.name}, score ${score}` : ', empty'}`}
          >
            <span className="pitch-slot__key">{slot.key}</span>
            {player ? (
              <>
                <span className="pitch-slot__name">{lastName(player.name)}</span>
                {mode !== 'expert' && (
                  <span className={`pitch-slot__score ${scoreClass(filledFit)}`}>{score}</span>
                )}
                {mode !== 'expert' && filledFit < 0.99 && (
                  <span className="pitch-slot__raw">{player.ovr}×{filledFit.toFixed(2)}</span>
                )}
              </>
            ) : showCandFit ? (
              <span className="pitch-slot__fit">{Math.round(candFit * 100)}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function lastName(name: string): string {
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0];
  return parts[parts.length - 1];
}
