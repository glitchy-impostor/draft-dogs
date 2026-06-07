import type { CompetitionConfig, Formation, PlayerPool, SlotDef } from '../types';

const wcFormation433: Formation = {
  id: '4-3-3',
  name: '4-3-3',
  slots: [
    { key: 'GK', eligible: ['GK'], weight: 1.3, group: 'GK' },
    { key: 'LB', eligible: ['LB', 'FB', 'WB'], weight: 1.0, group: 'DEF', adjacent: ['CB', 'LW'] },
    { key: 'LCB', eligible: ['CB'], weight: 1.0, group: 'DEF', adjacent: ['CDM', 'FB'] },
    { key: 'RCB', eligible: ['CB'], weight: 1.0, group: 'DEF', adjacent: ['CDM', 'FB'] },
    { key: 'RB', eligible: ['RB', 'FB', 'WB'], weight: 1.0, group: 'DEF', adjacent: ['CB', 'RW'] },
    { key: 'CDM', eligible: ['CDM', 'CM'], weight: 1.1, group: 'MID', adjacent: ['CB', 'CAM'] },
    { key: 'LCM', eligible: ['CM', 'CAM'], weight: 1.1, group: 'MID', adjacent: ['CDM', 'LW'] },
    { key: 'RCM', eligible: ['CM', 'CAM'], weight: 1.1, group: 'MID', adjacent: ['CDM', 'RW'] },
    { key: 'LW', eligible: ['LW', 'LM'], weight: 1.2, group: 'ATT', adjacent: ['ST', 'CAM', 'LB'] },
    { key: 'ST', eligible: ['ST', 'CF'], weight: 1.2, group: 'ATT', adjacent: ['LW', 'RW', 'CAM'] },
    { key: 'RW', eligible: ['RW', 'RM'], weight: 1.2, group: 'ATT', adjacent: ['ST', 'CAM', 'RB'] },
  ],
};

export const worldCupTestConfig: CompetitionConfig = {
  slug: 'worldcup-test',
  name: 'World Cup 8-0 (test fixture)',
  sport: 'soccer',
  runMode: 'tournament',
  target: { games: 8, label: '8-0' },
  stages: ['group', 'group', 'group', 'r32', 'r16', 'qf', 'sf', 'final'],
  eraBands: ['1970s', '1980s', '1990s', '2000s', '2010s', '2020s'],
  eraRepeat: true,
  rerolls: { entity: 1, era: 1 },
  rounds: 11,
  roster: { type: 'formation', formations: [wcFormation433] },
  tiers: [
    { stage: 'group', label: 'Crashed out in the Group Stage' },
    { stage: 'r32', label: 'Out in the Round of 32' },
    { stage: 'r16', label: 'Out in the Round of 16' },
    { stage: 'qf', label: 'Quarter-final exit' },
    { stage: 'sf', label: 'Semi-final exit' },
    { stage: 'final', label: 'Runners-up' },
  ],
  sim: {
    k: 0.28,
    r50: 82,
    drawPeak: 0.22,
    opp: {
      stages: {
        group: { mean: 72, std: 6 },
        r32: { mean: 80, std: 5 },
        r16: { mean: 85, std: 4 },
        qf: { mean: 89, std: 4 },
        sf: { mean: 92, std: 3 },
        final: { mean: 93, std: 3 },
      },
    },
  },
  entities: [
    { id: 'BRA', name: 'Brazil', colors: ['#FFDC00', '#009C3B'] },
    { id: 'ARG', name: 'Argentina', colors: ['#74ACDF', '#FFFFFF'] },
    { id: 'GER', name: 'Germany', colors: ['#000000', '#DD0000'] },
    { id: 'FRA', name: 'France', colors: ['#0055A4', '#EF4135'] },
  ],
  spinTable: [
    { entity: 'BRA', era: '1970s' },
    { entity: 'BRA', era: '2000s' },
    { entity: 'ARG', era: '1980s' },
    { entity: 'GER', era: '1990s' },
    { entity: 'FRA', era: '2010s' },
    { entity: 'FRA', era: '2020s' },
  ],
  perfectionTier: 'Immortal XI · TOP DOG',
  disclaimer:
    'Draft Dogs is an independent project, not affiliated with, endorsed by, or sponsored by FIFA or any national football association.',
};

export const worldCupTestPool: PlayerPool = {
  competition: 'worldcup-test',
  poolVersion: 1,
  players: [
    { id: 'p-bra70-1', name: 'Striker A', entity: 'BRA', era: '1970s', positions: ['ST', 'CAM'], ovr: 95 },
    { id: 'p-bra70-2', name: 'Winger A', entity: 'BRA', era: '1970s', positions: ['LW', 'RW'], ovr: 92 },
    { id: 'p-bra70-3', name: 'Mid A', entity: 'BRA', era: '1970s', positions: ['CM', 'CAM'], ovr: 88 },
    { id: 'p-bra70-4', name: 'GK A', entity: 'BRA', era: '1970s', positions: ['GK'], ovr: 86 },
    { id: 'p-bra70-5', name: 'CB A', entity: 'BRA', era: '1970s', positions: ['CB'], ovr: 84 },
    { id: 'p-bra70-6', name: 'FB A', entity: 'BRA', era: '1970s', positions: ['LB', 'RB', 'FB'], ovr: 83 },
    { id: 'p-bra70-7', name: 'CDM A', entity: 'BRA', era: '1970s', positions: ['CDM', 'CM'], ovr: 82 },
    { id: 'p-bra70-8', name: 'Winger B', entity: 'BRA', era: '1970s', positions: ['RW', 'LW'], ovr: 81 },
    { id: 'p-bra00-1', name: 'ST C', entity: 'BRA', era: '2000s', positions: ['ST'], ovr: 93 },
    { id: 'p-bra00-2', name: 'CB C', entity: 'BRA', era: '2000s', positions: ['CB'], ovr: 90 },
    { id: 'p-bra00-3', name: 'FB C', entity: 'BRA', era: '2000s', positions: ['LB', 'RB'], ovr: 89 },
    { id: 'p-arg80-1', name: 'CAM D', entity: 'ARG', era: '1980s', positions: ['CAM', 'ST'], ovr: 99 },
    { id: 'p-ger90-1', name: 'GK D', entity: 'GER', era: '1990s', positions: ['GK'], ovr: 96 },
    { id: 'p-fra10-1', name: 'ST F', entity: 'FRA', era: '2010s', positions: ['ST'], ovr: 91 },
    { id: 'p-fra20-1', name: 'MF F', entity: 'FRA', era: '2020s', positions: ['CM', 'CAM'], ovr: 90 },
  ],
};

export function findSlot(slug: string, key: string): SlotDef {
  const formation = worldCupTestConfig.roster.formations?.[0];
  if (!formation) throw new Error('no formation');
  const slot = formation.slots.find(s => s.key === key);
  if (!slot) throw new Error(`no slot ${key} in ${slug}`);
  return slot;
}
