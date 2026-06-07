// Wraps the engine for React. Exposes draft state + actions and lazy-loads
// the player pool on demand so each competition's pool is its own Vite chunk.
//
// Effects depend on primitive args (not the opts object) so React doesn't
// reload the pool or reset the draft on every parent render.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyPick,
  initDraft,
  isComplete,
  rerollEntity as engineRerollEntity,
  rerollEra as engineRerollEra,
  rateTeam,
  simulate,
  spin as engineSpin,
} from '@engine/index';
import type {
  CompetitionConfig,
  DraftState,
  Formation,
  GameMode,
  PlayerPool,
  RunResult,
  TeamRating,
} from '@engine/types';
import type { PlayerStatLine, MvpPick } from '@engine/sim';

export type GamePhase = 'loading' | 'configuring' | 'drafting' | 'simulating' | 'result';

export interface UseGameOpts {
  config: CompetitionConfig;
  loadPool: () => Promise<PlayerPool>;
  mode: GameMode;
  nonce: string;
  seed: number;
}

export function useGame({ config, loadPool, mode, nonce, seed }: UseGameOpts) {
  const [pool, setPool] = useState<PlayerPool | null>(null);
  const [state, setState] = useState<DraftState | null>(null);
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [formation, setFormation] = useState<Formation | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [rating, setRating] = useState<TeamRating | null>(null);
  const [playerStats, setPlayerStats] = useState<Map<string, PlayerStatLine> | null>(null);
  const [mvp, setMvp] = useState<MvpPick | null>(null);

  // Load pool exactly once per loadPool reference. Registry entries are
  // module-level singletons so loadPool is stable across renders.
  useEffect(() => {
    let cancelled = false;
    loadPool().then(p => {
      if (cancelled) return;
      setPool(p);
      setPhase(prev => (prev === 'loading' ? 'configuring' : prev));
    });
    return () => {
      cancelled = true;
    };
  }, [loadPool]);

  const startDraft = useCallback((formationId: string) => {
    if (!pool) return;
    const draft = initDraft(config, { nonce, seed, formationId });
    const chosenFormation = config.roster.formations?.find(f => f.id === formationId) ?? null;
    setFormation(chosenFormation);
    setState(draft);
    setPhase('drafting');
  }, [pool, config, nonce, seed]);

  const spin = useCallback(() => {
    setState(s => (s ? engineSpin(s) : s));
  }, []);

  const rerollEntity = useCallback(() => {
    let didRoll = false;
    setState(s => {
      if (!s) return s;
      const n = engineRerollEntity(s);
      if (n) didRoll = true;
      return n ?? s;
    });
    return didRoll;
  }, []);

  const rerollEra = useCallback(() => {
    let didRoll = false;
    setState(s => {
      if (!s) return s;
      const n = engineRerollEra(s);
      if (n) didRoll = true;
      return n ?? s;
    });
    return didRoll;
  }, []);

  const pickPlayer = useCallback((playerId: string, slotKey: string) => {
    setState(s => {
      if (!s || !pool) return s;
      return applyPick(s, pool, playerId, slotKey);
    });
  }, [pool]);

  const simulateRun = useCallback(() => {
    if (!state || !pool) return;
    setPhase('simulating');
    window.setTimeout(() => {
      const { result: r, rating: rt, playerStats: ps, mvp: m } = simulate(state, pool, config);
      setResult(r);
      setRating(rt);
      setPlayerStats(ps);
      setMvp(m);
      setPhase('result');
    }, 50);
  }, [state, pool, config]);

  const complete = useMemo(() => (state ? isComplete(state) : false), [state]);

  const rateCurrent = useCallback(() => {
    if (!state || !pool) return null;
    return rateTeam(state.picks, state.slots, pool.players, config);
  }, [state, pool, config]);

  return {
    phase,
    pool,
    config,
    state,
    formation,
    result,
    rating,
    playerStats,
    mvp,
    complete,
    mode,
    startDraft,
    spin,
    rerollEntity,
    rerollEra,
    pickPlayer,
    simulateRun,
    rateCurrent,
  };
}
