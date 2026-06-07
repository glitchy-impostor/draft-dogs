// Competition registry. The hub uses this to render the grid; the game route
// resolves slug → config + pool loader. Configs are static JSON for CDN
// hosting per §8. Pools are dynamically imported so each competition's pool
// is a separate Vite chunk (and absent competitions can be marked "soon").

import type { CompetitionConfig, PlayerPool } from '@engine/types';
import worldcupConfig from './configs/worldcup.json';
import eplConfig from './configs/epl.json';
import laligaConfig from './configs/laliga.json';
import serieaConfig from './configs/seriea.json';
import bundesligaConfig from './configs/bundesliga.json';
import ligue1Config from './configs/ligue1.json';
import mlsConfig from './configs/mls.json';
import nbaConfig from './configs/nba.json';
import nflConfig from './configs/nfl.json';
import nhlConfig from './configs/nhl.json';
import mlbConfig from './configs/mlb.json';
import uclConfig from './configs/ucl.json';
import eurosConfig from './configs/euros.json';
import copaConfig from './configs/copa.json';
import mixedbagConfig from './configs/mixedbag.json';

export interface CompetitionEntry {
  slug: string;
  display: string;
  recordLabel: string;
  sport: 'soccer' | 'nba' | 'nfl' | 'nhl' | 'mlb';
  status: 'live' | 'soon';
  config?: CompetitionConfig;
  loadPool?: () => Promise<PlayerPool>;
  blurb?: string;
}

export const COMPETITIONS: CompetitionEntry[] = [
  {
    slug: 'worldcup',
    display: 'World Cup',
    recordLabel: '8-0',
    sport: 'soccer',
    status: 'live',
    config: worldcupConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/worldcup.json')).default as unknown as PlayerPool,
    blurb: 'Spin a nation × era. Build an XI. Win the World Cup 8-0.',
  },
  {
    slug: 'epl',
    display: 'Premier League',
    recordLabel: '38-0',
    sport: 'soccer',
    status: 'live',
    config: eplConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/epl.json')).default as unknown as PlayerPool,
    blurb: 'Spin a club × era. Draft an XI. Go unbeaten across 38 games — table position included.',
  },
  {
    slug: 'laliga', display: 'LaLiga', recordLabel: '38-0', sport: 'soccer', status: 'live',
    config: laligaConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/laliga.json')).default as unknown as PlayerPool,
    blurb: 'Spin a club × era. El Clásico-era picks. 38 invencible.',
  },
  {
    slug: 'seriea', display: 'Serie A', recordLabel: '38-0', sport: 'soccer', status: 'live',
    config: serieaConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/seriea.json')).default as unknown as PlayerPool,
    blurb: 'Calcio across the decades. Scudetto-era greats.',
  },
  {
    slug: 'bundesliga', display: 'Bundesliga', recordLabel: '34-0', sport: 'soccer', status: 'live',
    config: bundesligaConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/bundesliga.json')).default as unknown as PlayerPool,
    blurb: 'Meisterschale chaser. Bayern + BVB at full strength.',
  },
  {
    slug: 'ligue1', display: 'Ligue 1', recordLabel: '34-0', sport: 'soccer', status: 'live',
    config: ligue1Config as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/ligue1.json')).default as unknown as PlayerPool,
    blurb: 'Spin a French club × era. Mbappé to Papin and back.',
  },
  {
    slug: 'mls', display: 'MLS', recordLabel: '34-0', sport: 'soccer', status: 'live',
    config: mlsConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/mls.json')).default as unknown as PlayerPool,
    blurb: 'From Beckham\'s Galaxy to Chicharito. 34-0 in the new league.',
  },
  {
    slug: 'ucl', display: 'Champions League', recordLabel: '15-0', sport: 'soccer', status: 'live',
    config: uclConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/ucl.json')).default as unknown as PlayerPool,
    blurb: 'Spin a European super-club × era. League phase + KO. Win 15 straight.',
  },
  {
    slug: 'euros', display: 'Euros', recordLabel: '7-0', sport: 'soccer', status: 'live',
    config: eurosConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/euros.json')).default as unknown as PlayerPool,
    blurb: 'Spin a European nation × era. 7 games to lift the trophy.',
  },
  {
    slug: 'copa', display: 'Copa América', recordLabel: '6-0', sport: 'soccer', status: 'live',
    config: copaConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/copa.json')).default as unknown as PlayerPool,
    blurb: 'Spin a South American nation × era. Win the Copa.',
  },
  {
    slug: 'mixedbag', display: 'World League', recordLabel: '38-0', sport: 'soccer', status: 'live',
    config: mixedbagConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/mixedbag.json')).default as unknown as PlayerPool,
    blurb: 'Fictional 20-team World League: any club, any era. 38-0 or bust.',
  },
  {
    slug: 'nba',
    display: 'NBA',
    recordLabel: '82-0',
    sport: 'nba',
    status: 'live',
    config: nbaConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/nba.json')).default as unknown as PlayerPool,
    blurb: 'Spin a franchise × decade. Decades Rule: no repeats. Five picks, no positions. Win all 82.',
  },
  {
    slug: 'nfl',
    display: 'NFL',
    recordLabel: '17-0',
    sport: 'nfl',
    status: 'live',
    config: nflConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/nfl.json')).default as unknown as PlayerPool,
    blurb: 'Spin a franchise × era. 8 typed slots (QB, RB, WR×2, TE, OL, Front-7, DB). Go 17-0.',
  },
  {
    slug: 'nhl',
    display: 'NHL',
    recordLabel: '82-0',
    sport: 'nhl',
    status: 'live',
    config: nhlConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/nhl.json')).default as unknown as PlayerPool,
    blurb: 'Spin a franchise × era. 6 slots (LW, C, RW, D, D, G). Sweep the season.',
  },
  {
    slug: 'mlb',
    display: 'MLB',
    recordLabel: '162-0',
    sport: 'mlb',
    status: 'live',
    config: mlbConfig as unknown as CompetitionConfig,
    loadPool: async () => (await import('./pools/mlb.json')).default as unknown as PlayerPool,
    blurb: 'Spin a franchise × era. 10 typed slots (SP, C, 4 IF, 3 OF, DH). 162-0 is mythic.',
  },
];

export function getCompetition(slug: string): CompetitionEntry | undefined {
  return COMPETITIONS.find(c => c.slug === slug);
}
