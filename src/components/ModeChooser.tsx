import { useState } from 'react';
import type { GameMode } from '@engine/types';
import { writeLastMode } from '@/lib/storage';

interface Props {
  initial: GameMode;
  onStart: (mode: GameMode) => void;
  competitionName: string;
  recordLabel: string;
}

const MODES: Array<{ id: GameMode; label: string; blurb: string; chip: string }> = [
  { id: 'classic', label: 'Classic',  blurb: 'Stats and ratings visible. The standard run.',                  chip: 'STARTER' },
  { id: 'expert',  label: 'Expert',   blurb: 'Names, positions, eras only. Stats hidden. Draft from memory.', chip: 'NO STATS' },
  { id: 'hard',    label: 'Hard',     blurb: 'Stats visible. Zero rerolls. You play what you spin.',          chip: 'NO REROLLS' },
  { id: 'daily',   label: 'Daily',    blurb: 'Same spins for everyone today. One submitted run.',             chip: 'WORDLE' },
];

export function ModeChooser({ initial, onStart, competitionName, recordLabel }: Props) {
  const [picked, setPicked] = useState<GameMode>(initial);
  return (
    <div className="mode-chooser">
      <header className="mode-chooser__head">
        <div className="mode-chooser__brand">DRAFT DOGS</div>
        <h1 className="mode-chooser__title">
          <span className="mode-chooser__record">{recordLabel}</span>
          <span className="mode-chooser__name">{competitionName}</span>
        </h1>
        <p className="mode-chooser__sub">Pick a mode to begin.</p>
      </header>
      <ul className="mode-chooser__list" role="radiogroup" aria-label="Game mode">
        {MODES.map(m => {
          const active = m.id === picked;
          return (
            <li key={m.id}>
              <button
                type="button"
                className={`mode-card ${active ? 'mode-card--active' : ''}`}
                role="radio"
                aria-checked={active}
                onClick={() => setPicked(m.id)}
              >
                <span className="mode-card__chip">{m.chip}</span>
                <span className="mode-card__label">{m.label}</span>
                <span className="mode-card__blurb">{m.blurb}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="mode-chooser__start"
        onClick={() => {
          writeLastMode(picked);
          onStart(picked);
        }}
      >
        Start as {picked.toUpperCase()} →
      </button>
    </div>
  );
}
