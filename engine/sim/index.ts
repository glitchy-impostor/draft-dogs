import { mix32 } from '../prng';
import { rateTeam } from '../rating';
import type { CompetitionConfig, DraftState, PlayerPool, RunResult } from '../types';
import { simulateSeason } from './season';
import { simulateTournament } from './tournament';
import { simulatePlayerStats, type PlayerStatLine } from './playerStats';
import { pickMVP, type MvpPick } from './mvp';

export { simulateSeason, simulateTournament, simulatePlayerStats, pickMVP };
export type { PlayerStatLine, MvpPick };

export function simulate(
  state: DraftState,
  pool: PlayerPool,
  config: CompetitionConfig,
): {
  result: RunResult;
  rating: ReturnType<typeof rateTeam>;
  playerStats: Map<string, PlayerStatLine>;
  mvp: MvpPick | null;
} {
  const rating = rateTeam(state.picks, state.slots, pool.players, config);
  const simSeed = mix32((state.rngState ^ 0x5d3c6f1b) >>> 0);
  const result = config.runMode === 'tournament'
    ? simulateTournament(rating, config, simSeed)
    : simulateSeason(rating, config, simSeed);
  const playerStats = simulatePlayerStats(
    state.picks,
    pool.players,
    result,
    mix32((simSeed ^ 0x2c3f5d61) >>> 0),
    config.sport,
  );
  const mvp = pickMVP(state.picks, state.slots, pool.players, playerStats);
  return { result, rating, playerStats, mvp };
}
