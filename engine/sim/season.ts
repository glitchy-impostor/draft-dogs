// Season simulator per §5.2.
//   p_win(R) = 1 / (1 + exp(-k × (R − R50)))
//   per match: opp_g ~ N(opp.season.mean, std); p_g = sigmoid(k × (R − opp_g))
//   soccer: trinomial W/D/L; draw prob peaks (~drawPeak) at p_g = 0.5, decays to 0
//   non-soccer: Bernoulli W/L
//
// League table flavor: synth 19 opponents with seeded ratings, double round-robin.

import { PRNG } from '../prng';
import type { CompetitionConfig, Match, SeasonResult, TableRow, TeamRating } from '../types';

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clampProb(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  if (p < 0.001) return 0.001;
  if (p > 0.999) return 0.999;
  return p;
}

function scorelineLambdas(R: number, opp: number): { us: number; them: number } {
  const us = Math.max(0.3, 1.4 + (R - 75) * 0.04 - (opp - 75) * 0.02);
  const them = Math.max(0.3, 1.4 + (opp - 75) * 0.04 - (R - 75) * 0.02);
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

function resolveTier(
  config: CompetitionConfig,
  wins: number,
  position?: number,
  playoffStageReached?: string,
  wonChampionship?: boolean,
): string {
  const totalTarget = config.target.games + (config.sim.playoffStages?.length ?? 0);
  if (wins >= totalTarget) return config.perfectionTier;
  // Walk tiers in order, first match wins. Playoff-stage tiers fire when the
  // team made playoffs; otherwise fall through to win-count or table tiers.
  for (const tier of config.tiers) {
    if (tier.stage === 'champion' && wonChampionship) return tier.label;
    if (tier.stage && playoffStageReached && tier.stage === playoffStageReached) return tier.label;
    if (tier.minWins !== undefined && wins >= tier.minWins && !playoffStageReached && !wonChampionship) {
      return tier.label;
    }
    if (tier.exact !== undefined && wins === tier.exact) return tier.label;
    if (tier.stage !== undefined && position !== undefined) {
      if (tier.stage === 'top4' && position <= 4) return tier.label;
      if (tier.stage === 'top1' && position === 1) return tier.label;
      if (tier.stage === 'top7' && position <= 7) return tier.label;
    }
  }
  return config.tiers[config.tiers.length - 1]?.label ?? 'Unranked';
}

const FAKE_OPPONENTS = [
  'Merseyside Red', 'North London', 'East London', 'South Coast', 'West Mids',
  'Tyne & Wear', 'Sky Blues', 'Steel City', 'Highland Reds', 'Old Industrial',
  'Capital Crown', 'Riverside FC', 'The Reservists', 'Harbour United', 'Hillside Athletic',
  'Cathedral City', 'Foundry FC', 'Garrison Town', 'Old Mill United',
];

export function simulateSeason(
  rating: TeamRating,
  config: CompetitionConfig,
  seed: number,
): SeasonResult {
  const prng = PRNG.fromSeed(seed);
  const isSoccer = config.sport === 'soccer';
  const games = config.target.games;
  const oppMean = config.sim.opp?.season?.mean ?? 78;
  const oppStd = config.sim.opp?.season?.std ?? 7;
  const drawPeak = config.sim.drawPeak ?? 0;
  const k = config.sim.k;
  const matches: Match[] = [];
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  for (let i = 0; i < games; i++) {
    const opp = prng.nextNormal(oppMean, oppStd);
    const pWin = clampProb(sigmoid(k * (rating.R - opp)));
    let outcome: 'W' | 'D' | 'L';
    if (isSoccer) {
      const closeness = Math.max(0, 1 - 4 * (pWin - 0.5) ** 2);
      const drawProb = drawPeak * closeness;
      const wProb = (1 - drawProb) * pWin;
      const dProb = drawProb;
      const r = prng.nextFloat();
      if (r < wProb) outcome = 'W';
      else if (r < wProb + dProb) outcome = 'D';
      else outcome = 'L';
    } else {
      outcome = prng.nextFloat() < pWin ? 'W' : 'L';
    }
    const scoreLine = isSoccer ? makeScoreLine(prng, rating.R, opp, outcome) : undefined;
    if (scoreLine) {
      const [a, b] = scoreLine.split('-').map(Number);
      goalsFor += a;
      goalsAgainst += b;
    }
    matches.push({ index: i, oppRating: opp, pWin, outcome, scoreLine });
    if (outcome === 'W') wins++;
    else if (outcome === 'D') draws++;
    else losses++;
  }

  // Snapshot regular-season tallies — the standings table must reflect the
  // regular-season record only, not the post-playoff totals. Without this
  // snapshot a 12-5 team that goes 3-1 in the playoffs would show as 15-2
  // in the table because `wins` would already include the playoff games.
  const regSeasonWins = wins;
  const regSeasonDraws = draws;
  const regSeasonLosses = losses;
  const regSeasonGF = goalsFor;
  const regSeasonGA = goalsAgainst;

  // Playoff epilogue (NFL/NHL/NBA/MLB). Threshold-based: any team with
  // wins >= playoffThreshold runs the playoff bracket. Each loss ends the
  // run; winning the last stage = champion.
  const playoffStages = config.sim.playoffStages ?? [];
  const playoffThreshold = config.sim.playoffThreshold ?? games; // back-compat default = perfection
  let madePlayoffs = false;
  let playoffStageReached: string | undefined;
  let wonChampionship = false;
  if (playoffStages.length > 0 && wins >= playoffThreshold) {
    madePlayoffs = true;
    let eliminatedInPlayoff = false;
    for (let pi = 0; pi < playoffStages.length; pi++) {
      if (eliminatedInPlayoff) break;
      const ps = playoffStages[pi];
      const stageId = ps.id ?? ps.label.toLowerCase().replace(/\s+/g, '');
      const opp = prng.nextNormal(ps.opp.mean, ps.opp.std);
      const pWin = clampProb(sigmoid(k * (rating.R - opp)));
      const outcome: 'W' | 'L' = prng.nextFloat() < pWin ? 'W' : 'L';
      const scoreLine = isSoccer ? makeScoreLine(prng, rating.R, opp, outcome) : undefined;
      matches.push({ index: games + pi, stage: ps.label, oppRating: opp, pWin, outcome, scoreLine });
      if (outcome === 'W') {
        wins++;
        playoffStageReached = stageId;
        if (pi === playoffStages.length - 1) wonChampionship = true;
      } else {
        losses++;
        playoffStageReached = stageId;
        eliminatedInPlayoff = true;
      }
    }
  }

  let table: TableRow[] | undefined;
  let position: number | undefined;
  if (config.runMode === 'season' && config.tableOpponents && config.tableOpponents.length > 0) {
    table = buildTable(prng, regSeasonWins, regSeasonDraws, regSeasonLosses, regSeasonGF, regSeasonGA, config);
    position = table.findIndex(r => r.isYou) + 1;
  }

  const record = isSoccer ? `${wins}-${draws}-${losses}` : `${wins}-${losses}`;
  const totalTarget = games + (config.sim.playoffStages?.length ?? 0);
  const perfectRun = losses === 0 && (isSoccer ? draws === 0 : true) && wins === totalTarget;
  const tier = resolveTier(config, wins, position, playoffStageReached, wonChampionship);

  return {
    mode: 'season',
    wins,
    draws,
    losses,
    record,
    matches,
    table,
    position,
    tier,
    perfectRun,
    madePlayoffs,
    playoffStageReached,
    wonChampionship,
  };
}

function buildTable(
  prng: PRNG,
  yourW: number,
  yourD: number,
  yourL: number,
  yourGF: number,
  yourGA: number,
  config: CompetitionConfig,
): TableRow[] {
  const games = config.target.games;
  const isSoccer = config.sport === 'soccer';
  const allOpps = config.tableOpponents ?? FAKE_OPPONENTS;
  const layout = config.tableLayout;
  const oppMean = config.sim.opp?.season?.mean ?? 78;
  const oppStd = config.sim.opp?.season?.std ?? 7;
  const k = config.sim.k;
  const drawPeakBase = isSoccer ? (config.sim.drawPeak ?? 0.22) : 0;

  // For grouped sports (NFL/NBA/NHL/MLB) Your XI replaces the last opponent so
  // the visible league size stays at 32/30. For flat soccer leagues Your XI
  // is appended.
  const replacesSlot = !!layout;
  let opps = replacesSlot ? allOpps.slice(0, -1) : allOpps.slice();
  // Force even team count (opps + Your XI). With even N the pair-based
  // round-robin has no byes and every match is a 1W-1L pair, which is what
  // lets us preserve exact league balance through the reshuffle below.
  if ((opps.length + 1) % 2 === 1) opps = opps.slice(0, -1);
  const droppedName = replacesSlot ? allOpps[allOpps.length - 1] : undefined;

  const teamMeta = new Map<string, { division: string; conference: string }>();
  if (layout) {
    for (const conf of layout.conferences) {
      for (const div of conf.divisions) {
        for (const team of div.teams) {
          teamMeta.set(team, { division: div.name, conference: conf.name });
        }
      }
    }
  }
  const youMeta = droppedName ? teamMeta.get(droppedName) : undefined;

  type T = {
    id: string; name: string; rating: number; isYou: boolean;
    division?: string; conference?: string;
    W: number; D: number; L: number; GF: number; GA: number;
  };
  const teams: T[] = [];
  // Your XI sits at index 0 with a placeholder rating; pair-sim accumulates
  // their record like any other team, then the reshuffle below replaces it
  // with the main-sim record by trading individual game outcomes with opps.
  teams.push({
    id: 'YOU', name: 'Your XI', rating: oppMean + 2, isYou: true,
    division: youMeta?.division, conference: youMeta?.conference,
    W: 0, D: 0, L: 0, GF: 0, GA: 0,
  });
  for (let i = 0; i < opps.length; i++) {
    const name = opps[i];
    const meta = teamMeta.get(name);
    teams.push({
      id: `O${i + 1}`, name, rating: prng.nextNormal(oppMean, oppStd), isYou: false,
      division: meta?.division, conference: meta?.conference,
      W: 0, D: 0, L: 0, GF: 0, GA: 0,
    });
  }

  const indices: number[] = [];
  for (let i = 0; i < teams.length; i++) indices.push(i);
  // Track Your XI's pair-sim matches so we can later trade individual game
  // outcomes with the opps Your XI played against. Each entry is the round's
  // opponent index and the outcome from Your XI's POV.
  type YourMatch = { oppIdx: number; outcome: 'W' | 'D' | 'L' };
  const yourMatches: YourMatch[] = [];

  for (let round = 0; round < games; round++) {
    const order = [...indices];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(prng.nextFloat() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    // Even N guaranteed above — no leftover, no filler, no byes.
    for (let p = 0; p + 1 < order.length; p += 2) {
      const aIdx = order[p];
      const bIdx = order[p + 1];
      const a = teams[aIdx];
      const b = teams[bIdx];
      const pAwin = clampProb(sigmoid(k * (a.rating - b.rating)));
      const closeness = isSoccer ? Math.max(0, 1 - 4 * (pAwin - 0.5) ** 2) : 0;
      const drawProb = drawPeakBase * closeness;
      const r = prng.nextFloat();
      let outcome: 'aW' | 'D' | 'bW';
      if (isSoccer) {
        if (r < (1 - drawProb) * pAwin) outcome = 'aW';
        else if (r < (1 - drawProb) * pAwin + drawProb) outcome = 'D';
        else outcome = 'bW';
      } else {
        outcome = r < pAwin ? 'aW' : 'bW';
      }
      if (isSoccer) {
        const slOutcome: 'W' | 'D' | 'L' = outcome === 'aW' ? 'W' : outcome === 'D' ? 'D' : 'L';
        const sl = makeScoreLine(prng, a.rating, b.rating, slOutcome);
        const [ga, gb] = sl.split('-').map(Number);
        a.GF += ga; a.GA += gb;
        b.GF += gb; b.GA += ga;
      }
      if (outcome === 'aW') { a.W++; b.L++; }
      else if (outcome === 'bW') { a.L++; b.W++; }
      else { a.D++; b.D++; }

      if (a.isYou) {
        const myOutcome: 'W'|'D'|'L' = outcome === 'aW' ? 'W' : outcome === 'D' ? 'D' : 'L';
        yourMatches.push({ oppIdx: bIdx, outcome: myOutcome });
      } else if (b.isYou) {
        const myOutcome: 'W'|'D'|'L' = outcome === 'aW' ? 'L' : outcome === 'D' ? 'D' : 'W';
        yourMatches.push({ oppIdx: aIdx, outcome: myOutcome });
      }
    }
  }

  // Reshuffle Your XI's outcomes to match the main-sim record. Each flip is a
  // reciprocal trade: when Your XI's outcome vs opp X changes from L to W,
  // opp X's record loses 1 W and gains 1 L — so total league W and total
  // league L both stay invariant. yourMatches.length === games (even N + no
  // byes), and yourW + yourD + yourL === games (caller's contract), so the
  // target multiset slots perfectly into yourMatches.
  const targets: ('W'|'D'|'L')[] = [];
  for (let i = 0; i < yourW; i++) targets.push('W');
  for (let i = 0; i < yourD; i++) targets.push('D');
  for (let i = 0; i < yourL; i++) targets.push('L');
  // Trim/pad defensively in case of any caller-side rounding (shouldn't fire).
  while (targets.length < yourMatches.length) targets.push('L');
  while (targets.length > yourMatches.length) targets.pop();
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(prng.nextFloat() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }

  const you = teams[0];
  for (let g = 0; g < yourMatches.length; g++) {
    const { oppIdx, outcome: oldOutcome } = yourMatches[g];
    const newOutcome = targets[g];
    if (oldOutcome === newOutcome) continue;
    const opp = teams[oppIdx];
    if (oldOutcome === 'W') { you.W--; opp.L--; }
    else if (oldOutcome === 'D') { you.D--; opp.D--; }
    else { you.L--; opp.W--; }
    if (newOutcome === 'W') { you.W++; opp.L++; }
    else if (newOutcome === 'D') { you.D++; opp.D++; }
    else { you.L++; opp.W++; }
  }

  // Your XI's goal totals come from the main sim (per-game scorelines were
  // generated there); the pair-sim aggregates were placeholders.
  you.GF = yourGF;
  you.GA = yourGA;

  const rows: TableRow[] = teams.map(t => ({
    id: t.id,
    name: t.name,
    division: t.division,
    conference: t.conference,
    W: t.W, D: t.D, L: t.L,
    GF: t.GF, GA: t.GA,
    GD: t.GF - t.GA,
    pts: isSoccer ? t.W * 3 + t.D : t.W,
    pct: games > 0 ? t.W / games : 0,
    isYou: t.isYou,
  }));

  if (isSoccer) {
    rows.sort((a, b) =>
      b.pts - a.pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name),
    );
  } else {
    rows.sort((a, b) =>
      b.W - a.W || a.L - b.L || a.name.localeCompare(b.name),
    );
  }
  return rows;
}
