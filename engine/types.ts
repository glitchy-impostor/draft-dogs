export type Sport = 'soccer' | 'nba' | 'nfl' | 'nhl' | 'mlb';
export type RunMode = 'season' | 'tournament';
export type GameMode = 'classic' | 'expert' | 'hard' | 'daily';

export type SlotKey = string;
export type PositionTag = string;

export interface Player {
  id: string;
  name: string;
  entity: string;
  era: string;
  positions: PositionTag[];
  ovr: number;
  stats?: Record<string, number | string>;
  tags?: string[];
}

export interface EntityDef {
  id: string;
  name: string;
  colors?: [string, string];
  spinWeight?: number;
}

export interface RerollBudget {
  entity: number;
  era: number;
}

export interface OppDist {
  mean: number;
  std: number;
}

export interface SimParams {
  k: number;
  r50: number;
  drawPeak?: number;
  opp?: {
    season?: OppDist;
    stages?: Record<string, OppDist>;
  };
  /** Post-season epilogue (NFL/NHL/NBA/MLB). Fires when regular-season wins
   * meet `playoffThreshold` (or default: wins === target.games for backward
   * compat). Loss eliminates; the final stage's winner takes the title. */
  playoffStages?: Array<{ id?: string; label: string; opp: OppDist }>;
  playoffThreshold?: number;
}

export interface TierRule {
  minWins?: number;
  exact?: number;
  stage?: string;
  label: string;
}

export type SlotGroup = 'GK' | 'DEF' | 'MID' | 'ATT' | 'F7' | 'BK' | 'IF' | 'OF' | 'PIT' | 'CAT' | 'D' | 'G' | 'OL' | 'FREE';

export interface SlotDef {
  key: SlotKey;
  eligible: PositionTag[];
  weight: number;
  group: SlotGroup;
  adjacent?: PositionTag[];
}

export interface Formation {
  id: string;
  name: string;
  slots: SlotDef[];
}

export interface RosterDef {
  type: 'formation' | 'free' | 'typed';
  formations?: Formation[];
  slots?: SlotDef[];
  count?: number;
}

export interface CompetitionConfig {
  slug: string;
  name: string;
  sport: Sport;
  runMode: RunMode;
  target: { games: number; label: string };
  stages?: string[];
  eraBands: string[];
  eraRepeat: boolean;
  rerolls: RerollBudget;
  rounds: number;
  roster: RosterDef;
  tiers: TierRule[];
  sim: SimParams;
  entities: EntityDef[];
  spinTable: Array<{ entity: string; era: string }>;
  perfectionTier: string;
  disclaimer: string;
  axisLabels?: { entity: string; era: string };
  /** Real team names used as synthetic opponents on the standings table.
   * Sized 17–32 per league. Populated by scripts/sync-table-opponents. */
  tableOpponents?: string[];
  /** Optional conference→division→teams grouping for American sports.
   * When present, the engine drops the last opponent in tableOpponents to
   * make room for Your XI (so the visible league size stays at 32/30), and
   * the UI renders divisional sub-tables under conference headers. */
  tableLayout?: TableLayout;
}

export interface DivisionDef {
  name: string;
  teams: string[];
}

export interface ConferenceDef {
  name: string;
  divisions: DivisionDef[];
}

export interface TableLayout {
  conferences: ConferenceDef[];
}

export interface PlayerPool {
  competition: string;
  poolVersion: number;
  players: Player[];
}

export interface SpinResult {
  entity: string;
  era: string;
}

export interface Pick {
  playerId: string;
  slotKey: SlotKey;
}

export interface DraftState {
  config: CompetitionConfig;
  formation: Formation | null;
  slots: SlotDef[];
  round: number;
  picks: Array<Pick | null>;
  spin: SpinResult | null;
  rerollsLeft: RerollBudget;
  drawnEras: string[];
  spinHistory: SpinResult[];
  rngState: number;
  nonce: string;
}

export interface SlotScore {
  slotKey: SlotKey;
  playerId: string;
  ovr: number;
  fit: number;
  score: number;
  weight: number;
}

export interface TeamRating {
  slotScores: SlotScore[];
  base: number;
  balancePen: number;
  chem: number;
  R: number;
}

export interface Match {
  index: number;
  stage?: string;
  oppRating: number;
  pWin: number;
  outcome: 'W' | 'D' | 'L';
  scoreLine?: string;
}

export interface SeasonResult {
  mode: 'season';
  wins: number;
  draws: number;
  losses: number;
  record: string;
  matches: Match[];
  table?: TableRow[];
  position?: number;
  tier: string;
  perfectRun: boolean;
  /** Set when the team made playoffs. `playoffStageReached` is the id of
   * the round they exited at (or 'champion' if they won the title). */
  madePlayoffs?: boolean;
  playoffStageReached?: string;
  wonChampionship?: boolean;
}

export interface TournamentResult {
  mode: 'tournament';
  wins: number;
  draws: number;
  losses: number;
  record: string;
  matches: Match[];
  stageReached: string;
  tier: string;
  perfectRun: boolean;
}

export type RunResult = SeasonResult | TournamentResult;

export interface TableRow {
  id: string;
  name: string;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  pts: number;
  isYou: boolean;
  /** Win pct for American sports display (W / total). Computed at build. */
  pct?: number;
  /** Division name for American sports (e.g., "AFC East"). */
  division?: string;
  /** Conference name for American sports (e.g., "AFC"). */
  conference?: string;
}
