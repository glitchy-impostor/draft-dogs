// Per-player flavor stats sampled after the run. Pure flavor — these do
// NOT feed the sim. Models the 38-0/Road-to-38 mechanic: each XI member
// gets games / goals / assists / clean sheets based on their role × OVR
// × the actual team record (so a 1-7 collapse leaves your striker with
// fewer goals than an 8-0 sweep would).

import { PRNG } from '../prng';
import type { Pick, Player, PositionTag, RunResult, Sport } from '../types';

export type Role = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface PlayerStatLine {
  playerId: string;
  role: Role;
  games: number;
  goals?: number;
  assists?: number;
  cleanSheets?: number;
}

const ROLE_FOR_POSITION: Record<PositionTag, Role> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', FB: 'DEF', WB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID', DM: 'MID', AM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT', CF: 'ATT',
};

export function playerRole(player: Player): Role | null {
  for (const pos of player.positions) {
    const r = ROLE_FOR_POSITION[pos];
    if (r) return r;
  }
  // Non-soccer position vocabulary (NFL QB/WR/DE, NHL D/G, MLB SP/SS, etc).
  // The current playerStats pipeline is soccer-flavored (G/A/CS); we'll add
  // sport-specific generators later — for now skip them.
  return null;
}

function samplePoisson(prng: PRNG, lambda: number): number {
  if (lambda <= 0) return 0;
  let k = 0;
  let p = Math.exp(-lambda);
  let cum = p;
  const r = prng.nextFloat();
  while (r > cum && k < 60) {
    k++;
    p *= lambda / k;
    cum += p;
  }
  return k;
}

function teamGoalsFor(result: RunResult): number {
  let total = 0;
  for (const m of result.matches) {
    if (!m.scoreLine) continue;
    const [us] = m.scoreLine.split('-').map(Number);
    if (Number.isFinite(us)) total += us;
  }
  return total;
}

function teamCleanSheets(result: RunResult): number {
  let cs = 0;
  for (const m of result.matches) {
    if (!m.scoreLine) continue;
    const [, them] = m.scoreLine.split('-').map(Number);
    if (them === 0) cs++;
  }
  return cs;
}

export function simulatePlayerStats(
  picks: Array<Pick | null>,
  pool: Player[],
  result: RunResult,
  seed: number,
  sport: Sport = 'soccer',
): Map<string, PlayerStatLine> {
  // The current stat pipeline is purely soccer-flavored (G / A / CS). NFL,
  // NHL, MLB share some position-tag letters with soccer (RB, LB, S) so we
  // can't rely on tag-vocabulary alone — we hard-gate on sport. Sport-
  // specific generators (NFL yards/TDs, NBA PPG, MLB BA) are a follow-up.
  if (sport !== 'soccer') return new Map();
  const prng = PRNG.fromSeed(seed);
  const byId = new Map(pool.map(p => [p.id, p]));

  const totalGames = result.matches.length;
  const tg = teamGoalsFor(result);
  const tcs = teamCleanSheets(result);

  // Pre-compute role distributions so the team's total goals get roughly
  // shared (forwards 60%, mids 30%, defenders 10% baseline weighted by OVR).
  const roleWeights: Record<Role, number> = { GK: 0, DEF: 0.10, MID: 0.30, ATT: 0.60 };

  const players: Array<{ pick: Pick; player: Player; role: Role; weight: number }> = [];
  for (const pick of picks) {
    if (!pick) continue;
    const player = byId.get(pick.playerId);
    if (!player) continue;
    // Positionless players (NBA) and non-soccer position vocabularies (NFL,
    // NHL, MLB) get no soccer-flavored stat line. Sport-specific generators
    // are a future task.
    if (player.positions.length === 0) continue;
    const role = playerRole(player);
    if (role === null) continue;
    const w = roleWeights[role] * Math.max(0.1, (player.ovr - 50) / 49);
    players.push({ pick, player, role, weight: w });
  }
  const totalWeight = players.reduce((s, p) => s + p.weight, 0) || 1;

  const stats = new Map<string, PlayerStatLine>();
  for (const { pick, player, role, weight } of players) {
    // Games played: small absence chance (injury / rotation).
    const absences = samplePoisson(prng, 0.15 * totalGames);
    const games = Math.max(1, Math.min(totalGames, totalGames - absences));

    const ovrFactor = (player.ovr - 50) / 49;
    const expectedShare = tg * (weight / totalWeight); // expected goals from role weighting

    const line: PlayerStatLine = { playerId: pick.playerId, role, games };

    if (role === 'ATT') {
      const lambdaGoals = Math.max(0.15, expectedShare * 0.9 + ovrFactor * 0.05 * games);
      const lambdaAssists = Math.max(0.1, ovrFactor * 0.18 * games);
      line.goals = samplePoisson(prng, lambdaGoals);
      line.assists = samplePoisson(prng, lambdaAssists);
    } else if (role === 'MID') {
      const lambdaAssists = Math.max(0.15, expectedShare * 0.7 + ovrFactor * 0.12 * games);
      const lambdaGoals = Math.max(0.1, ovrFactor * 0.12 * games);
      line.assists = samplePoisson(prng, lambdaAssists);
      line.goals = samplePoisson(prng, lambdaGoals);
    } else if (role === 'DEF') {
      // Defenders share team's clean sheets — they all play the same games.
      line.cleanSheets = Math.max(0, tcs - samplePoisson(prng, totalGames * 0.05));
      const lambdaGoals = Math.max(0.0, ovrFactor * 0.04 * games);
      line.goals = samplePoisson(prng, lambdaGoals);
    } else if (role === 'GK') {
      line.cleanSheets = tcs;
    }
    stats.set(pick.playerId, line);
  }
  return stats;
}
