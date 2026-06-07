// Orchestrates the in-game loop: SpinMachine → DraftSheet → PitchBoard →
// simulate → ResultReveal/ShareCard. Spin → user can reroll within the
// landed phase → user taps "Pick Player" → DraftSheet → tap a slot to place.

import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/state/useGame';
import { SpinMachine } from '@/components/SpinMachine';
import { PitchBoard } from '@/components/PitchBoard';
import { CourtBoard } from '@/components/CourtBoard';
import { GridironBoard } from '@/components/GridironBoard';
import { RinkBoard } from '@/components/RinkBoard';
import { DiamondBoard } from '@/components/DiamondBoard';
import { DraftSheet } from '@/components/DraftSheet';
import { ResultReveal } from '@/components/ResultReveal';
import { ShareCard } from '@/components/ShareCard';
import { PlayerStatTable } from '@/components/PlayerStatTable';
import { rateTeam } from '@engine/rating';
import type { CompetitionConfig, GameMode, Pick, Player, PlayerPool } from '@engine/types';
import { submitRun, type SubmitResponse } from '@/lib/arcadeApi';
import { readUsername, writeUsername } from '@/lib/storage';
import { Link } from 'react-router-dom';

interface Props {
  config: CompetitionConfig;
  loadPool: () => Promise<PlayerPool>;
  mode: GameMode;
  formationId: string;
  nonce: string;
  seed: number;
  onExit: () => void;
  onRestart: () => void;
}

function dupKey(name: string): string {
  return name.toLowerCase().trim();
}

type Stage = 'spin' | 'pick';

export function GameView({ config, loadPool, mode, formationId, nonce, seed, onExit, onRestart }: Props) {
  const game = useGame({ config, loadPool, mode, nonce, seed });
  const [stage, setStage] = useState<Stage>('spin');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [submitState, setSubmitState] = useState<'idle' | 'submitting' | 'submitted' | 'failed'>('idle');
  const [submission, setSubmission] = useState<SubmitResponse | null>(null);
  const [username, setUsername] = useState<string>(() => readUsername());

  const playersById = useMemo(() => {
    const m = new Map<string, Player>();
    if (game.pool) for (const p of game.pool.players) m.set(p.id, p);
    return m;
  }, [game.pool]);

  const alreadyPickedByName = useMemo(() => {
    const m = new Map<string, Pick>();
    const picks = game.state?.picks ?? [];
    for (const p of picks) {
      if (!p) continue;
      const player = playersById.get(p.playerId);
      if (player) m.set(dupKey(player.name), p);
    }
    return m;
  }, [game.state?.picks, playersById]);

  // start the draft as soon as the pool resolves
  useEffect(() => {
    if (game.phase === 'configuring') {
      game.startDraft(formationId);
    }
  }, [game.phase, game.startDraft, formationId]);

  // when state.spin clears (after a pick), reset to the spin stage for next round
  useEffect(() => {
    if (game.state && !game.state.spin) {
      setStage('spin');
      setSelectedPlayer(null);
    }
  }, [game.state]);

  // formation is intentionally null for typed/free roster types (NBA/NFL/NHL/MLB).
  // Only require it for formation-based rosters (soccer).
  const needsFormation = config.roster.type === 'formation';
  if (game.phase === 'loading' || !game.state || !game.pool || (needsFormation && !game.formation)) {
    return <main className={`game game--play sport-${config.sport}`}><div className="game__placeholder">Loading pool…</div></main>;
  }

  if (game.phase === 'simulating') {
    return <main className={`game game--play sport-${config.sport}`}><div className="game__placeholder">Simulating run…</div></main>;
  }

  if (game.phase === 'result' && game.result && game.rating) {
    const onSubmit = async () => {
      if (!game.state || !game.config) return;
      const trimmed = username.trim();
      if (!trimmed) {
        setSubmitState('failed');
        return;
      }
      writeUsername(trimmed);
      setSubmitState('submitting');
      try {
        const validPicks: Pick[] = game.state.picks.filter((p): p is Pick => p !== null);
        const res = await submitRun({
          competition: game.config.slug,
          mode,
          nonce,
          formationId: game.formation?.id ?? formationId,
          picks: validPicks,
          username: trimmed,
        });
        setSubmission(res);
        setSubmitState('submitted');
      } catch {
        setSubmitState('failed');
      }
    };
    return (
      <main className={`game game--result sport-${config.sport}`}>
        <header className="game__header">
          <button type="button" onClick={onExit} className="game__back" aria-label="Back to arcade">←</button>
          <div className="game__title">
            <span className="game__record">{config.target.label}</span>
            <span className="game__name">{config.name}</span>
          </div>
          <div className="game__mode">{mode.toUpperCase()}</div>
        </header>
        <ResultReveal
          config={config}
          result={game.result}
          onShare={() => setShowShare(true)}
          onRestart={onRestart}
          mvp={game.mvp}
          statTable={
            game.playerStats ? (
              <PlayerStatTable
                picks={game.state.picks}
                playersById={playersById}
                playerStats={game.playerStats}
              />
            ) : null
          }
        />

        <section className="leaderboard-submit">
          {submitState !== 'submitted' ? (
            <>
              <h3 className="leaderboard-submit__title">Post to leaderboard</h3>
              <div className="leaderboard-submit__row">
                <input
                  type="text"
                  className="leaderboard-submit__input"
                  placeholder="username (1–20, A–Z 0–9 _ - .)"
                  value={username}
                  maxLength={20}
                  onChange={e => setUsername(e.target.value)}
                  disabled={submitState === 'submitting'}
                />
                <button
                  type="button"
                  className="leaderboard-submit__btn"
                  onClick={onSubmit}
                  disabled={submitState === 'submitting' || username.trim().length === 0}
                >
                  {submitState === 'submitting' ? '…' : 'Submit'}
                </button>
              </div>
              {submitState === 'failed' && (
                <p className="leaderboard-submit__err">
                  Couldn't reach the leaderboard service (or username rejected). Local play still works.
                </p>
              )}
            </>
          ) : (
            <div className="leaderboard-submit__success">
              <div className="leaderboard-submit__rank">RANK <strong>#{submission?.rank}</strong> / {submission?.total}</div>
              <Link to={`/arcade/${config.slug}/leaderboard`} className="leaderboard-submit__viewbtn">View leaderboard →</Link>
            </div>
          )}
        </section>

        {showShare && (
          <ShareCard
            config={config}
            picks={game.state.picks}
            playersById={playersById}
            result={game.result}
            rating={game.rating}
            mode={mode}
          />
        )}
      </main>
    );
  }

  const state = game.state;
  const spin = state.spin;
  const round = state.round;
  const candidates = spin
    ? game.pool.players.filter(p => p.entity === spin.entity && p.era === spin.era)
    : [];
  const entityName = spin
    ? config.entities.find(e => e.id === spin.entity)?.name ?? spin.entity
    : '';

  const liveRating = !game.complete ? rateTeam(state.picks, state.slots, game.pool.players, config) : null;

  const onSpinClick = () => {
    setSelectedPlayer(null);
    setStage('spin');
    game.spin();
  };

  const onProceedToPick = () => {
    setStage('pick');
  };

  const onSlotTap = (slotKey: string) => {
    if (!selectedPlayer || !spin) return;
    game.pickPlayer(selectedPlayer.id, slotKey);
    setSelectedPlayer(null);
    // pickPlayer clears spin; the effect above will move us back to 'spin' stage
  };

  return (
    <main className={`game game--play sport-${config.sport}`}>
      <header className="game__header">
        <button type="button" onClick={onExit} className="game__back" aria-label="Back to arcade">←</button>
        <div className="game__title">
          <span className="game__record">{config.target.label}</span>
          <span className="game__name">{config.name}</span>
        </div>
        <div className="game__mode">{mode.toUpperCase()}</div>
      </header>

      <div className="game__roundbar">
        <span>Round {round + 1} / {config.rounds}</span>
        {liveRating && mode !== 'expert' && (
          <span>Team R: <strong>{liveRating.R.toFixed(1)}</strong></span>
        )}
      </div>

      {config.sport === 'soccer' && game.formation ? (
        <PitchBoard
          formation={game.formation}
          slots={state.slots}
          picks={state.picks}
          playersById={playersById}
          candidatePlayer={selectedPlayer}
          onSlotTap={onSlotTap}
          mode={mode}
        />
      ) : config.sport === 'nba' ? (
        <CourtBoard
          slots={state.slots}
          picks={state.picks}
          playersById={playersById}
          candidatePlayer={selectedPlayer}
          onSlotTap={onSlotTap}
          mode={mode}
        />
      ) : config.sport === 'nfl' ? (
        <GridironBoard
          slots={state.slots}
          picks={state.picks}
          playersById={playersById}
          candidatePlayer={selectedPlayer}
          onSlotTap={onSlotTap}
          mode={mode}
        />
      ) : config.sport === 'nhl' ? (
        <RinkBoard
          slots={state.slots}
          picks={state.picks}
          playersById={playersById}
          candidatePlayer={selectedPlayer}
          onSlotTap={onSlotTap}
          mode={mode}
        />
      ) : config.sport === 'mlb' ? (
        <DiamondBoard
          slots={state.slots}
          picks={state.picks}
          playersById={playersById}
          candidatePlayer={selectedPlayer}
          onSlotTap={onSlotTap}
          mode={mode}
        />
      ) : null}

      {!game.complete ? (
        stage === 'pick' && spin ? (
          <DraftSheet
            spin={spin}
            entityName={entityName}
            candidates={candidates}
            alreadyPicked={alreadyPickedByName}
            mode={mode}
            selectedPlayerId={selectedPlayer?.id ?? null}
            onSelectPlayer={p => setSelectedPlayer(p)}
            onCancel={() => setSelectedPlayer(null)}
          />
        ) : (
          <SpinMachine
            config={config}
            pendingResult={spin}
            onProceed={onProceedToPick}
            rerollsLeft={state.rerollsLeft}
            onSpin={onSpinClick}
            onRerollEntity={() => game.rerollEntity()}
            onRerollEra={() => game.rerollEra()}
            roundLabel={`Round ${round + 1}`}
          />
        )
      ) : (
        <button type="button" className="game__simulate" onClick={() => game.simulateRun()}>
          SIMULATE THE RUN →
        </button>
      )}

      <footer className="game__disclaimer-footer">{config.disclaimer}</footer>
    </main>
  );
}
