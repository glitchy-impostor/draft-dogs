import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ModeChooser } from '@/components/ModeChooser';
import { GameView } from '@/components/GameView';
import { getCompetition } from '@data/registry';
import { readLastMode } from '@/lib/storage';
import { fetchDaily } from '@/lib/arcadeApi';
import type { GameMode } from '@engine/types';
import '@/styles/game.css';
import '@/styles/board.css';
import '@/styles/result.css';

type Phase = 'mode' | 'formation' | 'playing';

function todayString(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function localSeedForRun(slug: string, mode: GameMode): { nonce: string; seed: number } {
  // Offline-fallback seed. Daily mode prefers the server's HMAC-derived seed
  // (so all users today get the same puzzle); we only fall back to this
  // local hash when the server is unreachable. Non-daily modes always use
  // local randomness.
  if (mode === 'daily') {
    const day = todayString();
    return { nonce: `daily:${slug}:${day}:offline`, seed: hashCode(`daily:${slug}:${day}`) };
  }
  const r = Math.floor(((Date.now() & 0xffffffff) ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  return { nonce: `${slug}:${mode}:${r}`, seed: r };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export default function ArcadeGame() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const entry = getCompetition(slug);
  const [phase, setPhase] = useState<Phase>('mode');
  const [mode, setMode] = useState<GameMode>('classic');
  const [formationId, setFormationId] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    const last = readLastMode();
    if (last) setMode(last);
  }, []);

  // Fresh seed for each runId so Play Again gives a different game.
  const localSeed = useMemo(() => localSeedForRun(slug, mode), [slug, mode, runId]);
  const [seedInfo, setSeedInfo] = useState(localSeed);

  useEffect(() => {
    setSeedInfo(localSeed);
    // For daily mode we MUST use the server's HMAC-derived seed so everyone
    // playing today plays the same puzzle. Falls back to the local seed if
    // the API is down — local play still works, just on a different puzzle.
    if (mode !== 'daily') return;
    let cancelled = false;
    fetchDaily(slug)
      .then(d => { if (!cancelled) setSeedInfo({ nonce: d.nonce, seed: d.seed }); })
      .catch(() => { /* keep local fallback */ });
    return () => { cancelled = true; };
  }, [slug, mode, runId, localSeed]);

  if (!entry) {
    return (
      <main className="game game--missing">
        <h1>Unknown competition: {slug}</h1>
        <Link to="/arcade">← Back to arcade</Link>
      </main>
    );
  }

  if (entry.status === 'soon' || !entry.config || !entry.loadPool) {
    return (
      <main className="game game--soon">
        <div className="game__brand">DRAFT DOGS · {entry.recordLabel}</div>
        <h1>{entry.display}</h1>
        <p>This competition isn't live yet. Pool curation in progress.</p>
        <Link to="/arcade" className="game__back">← Back to arcade</Link>
      </main>
    );
  }

  if (phase === 'mode') {
    return (
      <main className="game">
        <ModeChooser
          initial={mode}
          competitionName={entry.display}
          recordLabel={entry.recordLabel}
          onStart={picked => {
            setMode(picked);
            if (entry.config!.roster.type === 'formation') {
              setPhase('formation');
            } else {
              setFormationId('');
              setPhase('playing');
            }
          }}
        />
      </main>
    );
  }

  if (phase === 'formation') {
    const formations = entry.config.roster.formations ?? [];
    return (
      <main className={`game game--formation sport-${entry.sport}`}>
        <header className="game__header">
          <button type="button" onClick={() => setPhase('mode')} className="game__back">←</button>
          <div className="game__title">
            <span className="game__record">{entry.recordLabel}</span>
            <span className="game__name">Choose formation</span>
          </div>
          <div className="game__mode">{mode.toUpperCase()}</div>
        </header>
        <ul className="formation-list">
          {formations.map(f => (
            <li key={f.id}>
              <button
                type="button"
                className="formation-card"
                onClick={() => {
                  setFormationId(f.id);
                  setPhase('playing');
                }}
              >
                <span className="formation-card__name">{f.name}</span>
                <span className="formation-card__slots">{f.slots.map(s => s.key).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <GameView
      key={runId}
      config={entry.config}
      loadPool={entry.loadPool}
      mode={mode}
      formationId={formationId ?? '4-3-3'}
      nonce={seedInfo.nonce}
      seed={seedInfo.seed}
      onExit={() => {
        navigate('/arcade');
      }}
      onRestart={() => {
        // Bump runId → seedInfo recomputes → key on GameView changes → fresh
        // engine state with a new seed, same formation, no return to hub.
        setRunId(n => n + 1);
      }}
    />
  );
}
