// Verifies the standings table sums to exact league balance for every
// season-mode competition: total W across all rows === total L across all
// rows (draws count as neither). The trade-balance reshuffle in season.ts
// must preserve this invariant for any Your XI record.

import { describe, expect, it } from 'vitest';
import { simulateSeason } from '../sim/season';
import type { CompetitionConfig } from '../types';

import eplCfg from '../../data/configs/epl.json';
import laligaCfg from '../../data/configs/laliga.json';
import serieaCfg from '../../data/configs/seriea.json';
import bundesligaCfg from '../../data/configs/bundesliga.json';
import ligue1Cfg from '../../data/configs/ligue1.json';
import mlsCfg from '../../data/configs/mls.json';
import mixedbagCfg from '../../data/configs/mixedbag.json';
import nflCfg from '../../data/configs/nfl.json';
import nbaCfg from '../../data/configs/nba.json';
import nhlCfg from '../../data/configs/nhl.json';
import mlbCfg from '../../data/configs/mlb.json';

const seasonConfigs: Array<[string, CompetitionConfig]> = [
  ['epl', eplCfg as unknown as CompetitionConfig],
  ['laliga', laligaCfg as unknown as CompetitionConfig],
  ['seriea', serieaCfg as unknown as CompetitionConfig],
  ['bundesliga', bundesligaCfg as unknown as CompetitionConfig],
  ['ligue1', ligue1Cfg as unknown as CompetitionConfig],
  ['mls', mlsCfg as unknown as CompetitionConfig],
  ['mixedbag', mixedbagCfg as unknown as CompetitionConfig],
  ['nfl', nflCfg as unknown as CompetitionConfig],
  ['nba', nbaCfg as unknown as CompetitionConfig],
  ['nhl', nhlCfg as unknown as CompetitionConfig],
  ['mlb', mlbCfg as unknown as CompetitionConfig],
];

describe('standings table league balance', () => {
  for (const [name, cfg] of seasonConfigs) {
    it(`${name}: total W === total L across all rows for many ratings`, () => {
      // Sweep team ratings from very weak to very strong so Your XI's record
      // varies across the full spectrum — the trade reshuffle must hold for
      // every value.
      for (let trial = 0; trial < 20; trial++) {
        const R = 55 + trial * 2.5; // 55 .. 102.5
        const rating = { slotScores: [], base: R, balancePen: 0, chem: 0, R };
        const seed = (trial + 1) * 0x9e3779b1;
        const result = simulateSeason(rating, cfg, seed);
        if (!result.table) continue;
        let totalW = 0, totalL = 0;
        for (const row of result.table) {
          totalW += row.W;
          totalL += row.L;
        }
        expect(totalW, `${name} trial=${trial} R=${R}: rows=${result.table.length}`).toBe(totalL);
      }
    });
  }

  it('each row plays exactly target.games (NFL)', () => {
    const cfg = nflCfg as unknown as CompetitionConfig;
    for (let trial = 0; trial < 5; trial++) {
      const R = 70 + trial * 6;
      const rating = { slotScores: [], base: R, balancePen: 0, chem: 0, R };
      const result = simulateSeason(rating, cfg, (trial + 1) * 12345);
      if (!result.table) continue;
      for (const row of result.table) {
        expect(row.W + row.D + row.L, `${row.name}`).toBe(cfg.target.games);
      }
    }
  });

  it('Your XI standings row reflects regular-season W/L only, not post-playoff totals', () => {
    // High-rating runs are likely to make playoffs and win games there, so
    // the bug where the table consumed `wins` after playoffs would show up
    // as yourRow.W diverging from the regular-season match count.
    const americanCfgs: Array<[string, CompetitionConfig]> = [
      ['nfl', nflCfg as unknown as CompetitionConfig],
      ['nba', nbaCfg as unknown as CompetitionConfig],
      ['nhl', nhlCfg as unknown as CompetitionConfig],
      ['mlb', mlbCfg as unknown as CompetitionConfig],
    ];
    for (const [name, cfg] of americanCfgs) {
      for (let trial = 0; trial < 8; trial++) {
        const R = 90 + trial; // skew high → consistent playoff appearances
        const rating = { slotScores: [], base: R, balancePen: 0, chem: 0, R };
        const result = simulateSeason(rating, cfg, (trial + 7) * 0xdeadbeef);
        if (!result.table) continue;
        const yourRow = result.table.find(r => r.isYou)!;
        let regW = 0, regL = 0, regD = 0;
        for (let i = 0; i < cfg.target.games; i++) {
          if (result.matches[i].outcome === 'W') regW++;
          else if (result.matches[i].outcome === 'L') regL++;
          else regD++;
        }
        expect(yourRow.W, `${name} trial=${trial} R=${R}`).toBe(regW);
        expect(yourRow.L, `${name} trial=${trial} R=${R}`).toBe(regL);
        expect(yourRow.D, `${name} trial=${trial} R=${R}`).toBe(regD);
      }
    }
  });
});
