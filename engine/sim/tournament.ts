// Tournament simulator per §5.3.
//   Stages from config: e.g. WC = [group×3, R32, R16, QF, SF, Final]
//   Opponent strength ramps per stage (config.sim.opp.stages keyed by stage label).
//   Group stages: trinomial W/D/L (soccer); loss does NOT eliminate.
//   KO stages: single elimination, no draws in our sim (force decision).

import { PRNG } from '../prng';
import type { CompetitionConfig, Match, TeamRating, TournamentResult } from '../types';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  if (p < 0.001) return 0.001;
  if (p > 0.999) return 0.999;
  return p;
}

// Scoreline lambdas reflect attacking power against opponent's defensive
// brittleness. The baseline of ~1.2 goals/team is rough international avg.
// Wider spread → fewer identical 0-1 scorelines for under-rated teams.
function scorelineLambdas(R: number, opp: number): { us: number; them: number } {
  const us = Math.max(0.25, 1.2 + (R - 75) * 0.045 - (opp - 75) * 0.022);
  const them = Math.max(0.25, 1.2 + (opp - 75) * 0.045 - (R - 75) * 0.022);
  return { us, them };
}

function samplePoisson(prng: PRNG, lambda: number): number {
  let k = 0;
  let p = Math.exp(-lambda);
  let cum = p;
  const r = prng.nextFloat();
  while (r > cum && k < 8) {
    k++;
    p *= lambda / k;
    cum += p;
  }
  return k;
}

function makeScoreLine(prng: PRNG, R: number, opp: number, outcome: 'W' | 'D' | 'L'): string {
  const { us: lu, them: lt } = scorelineLambdas(R, opp);
  let us = samplePoisson(prng, lu);
  let them = samplePoisson(prng, lt);
  switch (outcome) {
    case 'W':
      if (us <= them) us = them + 1;
      break;
    case 'L':
      if (us >= them) them = us + 1;
      break;
    case 'D':
      them = us;
      break;
  }
  return `${us}-${them}`;
}

function stagePretty(stage: string): string {
  const map: Record<string, string> = {
    group: 'Group',
    r32: 'Round of 32',
    r16: 'Round of 16',
    qf: 'Quarter-final',
    sf: 'Semi-final',
    final: 'Final',
    league: 'League Phase',
    leaguePlayoff: 'League Playoff',
  };
  return map[stage] ?? stage;
}

function resolveTier(config: CompetitionConfig, stageReached: string, eliminated: boolean): string {
  for (const tier of config.tiers) {
    if (tier.stage && tier.stage === stageReached) {
      if (tier.stage === 'final' && !eliminated) continue;
      return tier.label;
    }
  }
  return config.tiers[config.tiers.length - 1]?.label ?? 'Unranked';
}

// Minimum points needed to advance out of the group stage. Matches the
// historical WC/Euros norm where 4 points (e.g. 1W-1D-1L) is the typical
// qualification floor and ≤3 points almost always exits.
const GROUP_QUALIFICATION_PTS = 4;

export function simulateTournament(
  rating: TeamRating,
  config: CompetitionConfig,
  seed: number,
): TournamentResult {
  if (!config.stages || config.stages.length === 0) {
    throw new Error(`simulateTournament: ${config.slug} missing stages`);
  }
  const prng = PRNG.fromSeed(seed);
  const matches: Match[] = [];
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let stageReached = '';
  let eliminated = false;

  // Index of the last group-stage entry — used to fire the qualification
  // check before any KO match runs.
  let lastGroupIndex = -1;
  for (let i = 0; i < config.stages.length; i++) {
    if (config.stages[i] === 'group' || config.stages[i] === 'league') lastGroupIndex = i;
  }
  let groupPts = 0;

  for (let i = 0; i < config.stages.length; i++) {
    const stage = config.stages[i];
    if (eliminated) break;
    const dist = config.sim.opp?.stages?.[stage] ?? { mean: 80 + i * 1.5, std: 5 };
    const opp = prng.nextNormal(dist.mean, dist.std);
    const pWin = clampProb(sigmoid(config.sim.k * (rating.R - opp)));
    const isGroup = stage === 'group' || stage === 'league';
    const drawPeak = isGroup ? config.sim.drawPeak ?? 0.22 : 0;
    const closeness = Math.max(0, 1 - 4 * (pWin - 0.5) ** 2);
    const drawProb = drawPeak * closeness;
    const r = prng.nextFloat();
    let outcome: 'W' | 'D' | 'L';
    if (r < (1 - drawProb) * pWin) outcome = 'W';
    else if (r < (1 - drawProb) * pWin + drawProb) outcome = 'D';
    else outcome = 'L';

    const scoreLine = config.sport === 'soccer' ? makeScoreLine(prng, rating.R, opp, outcome) : undefined;
    matches.push({ index: i, stage: stagePretty(stage), oppRating: opp, pWin, outcome, scoreLine });
    if (outcome === 'W') wins++;
    else if (outcome === 'D') draws++;
    else losses++;
    stageReached = stage;

    if (isGroup) {
      groupPts += outcome === 'W' ? 3 : outcome === 'D' ? 1 : 0;
      // After the last group game, run the qualification cut. ≥4 pts and
      // you're through; otherwise you crash out before any KO stage.
      if (i === lastGroupIndex && groupPts < GROUP_QUALIFICATION_PTS) {
        eliminated = true;
        // stageReached stays 'group' so resolveTier maps to the group exit.
      }
    } else if (outcome !== 'W') {
      eliminated = true;
    }
  }

  const target = config.target.games;
  const perfectRun = wins === target && losses === 0 && draws === 0;
  const tier = perfectRun
    ? config.perfectionTier
    : resolveTier(config, stageReached, eliminated);

  const record = config.sport === 'soccer' ? `${wins}-${draws}-${losses}` : `${wins}-${losses}`;
  return {
    mode: 'tournament',
    wins,
    draws,
    losses,
    record,
    matches,
    stageReached: stagePretty(stageReached),
    tier,
    perfectRun,
  };
}
