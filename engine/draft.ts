// Draft state machine per §2.
//   CONFIGURE → (SPIN → [REROLL?] → PICK) × N_ROUNDS → SIMULATE
// Actions: start, spin, rerollEntity, rerollEra, pick.
// State is fully reproducible from (initial seed + ordered action list).

import { PRNG, mix32 } from './prng';
import { dealSpin } from './dealer';
import type {
  CompetitionConfig,
  DraftState,
  Formation,
  Pick,
  PlayerPool,
  SlotDef,
  SpinResult,
} from './types';

const SALT = {
  SPIN: 1,
  REROLL_ENTITY: 2,
  REROLL_ERA: 3,
  SIMULATE: 4,
} as const;

function bumpRng(state: number, salt: number): number {
  return mix32((state ^ Math.imul(salt | 0, 0xa3c59ac3)) >>> 0);
}

function resolveSlots(config: CompetitionConfig, formationId?: string): { slots: SlotDef[]; formation: Formation | null } {
  if (config.roster.type === 'formation') {
    const formations = config.roster.formations ?? [];
    const formation = (formationId && formations.find(f => f.id === formationId)) ?? formations[0];
    if (!formation) throw new Error(`resolveSlots: no formation found for ${config.slug}`);
    return { slots: formation.slots, formation };
  }
  if (config.roster.type === 'typed') {
    return { slots: config.roster.slots ?? [], formation: null };
  }
  // free: synthesize N positionless slots
  const count = config.roster.count ?? config.rounds;
  const slots: SlotDef[] = Array.from({ length: count }, (_, i) => ({
    key: `S${i + 1}`,
    eligible: [],
    weight: 1.0,
    group: 'FREE',
  }));
  return { slots, formation: null };
}

export function initDraft(
  config: CompetitionConfig,
  opts: { nonce: string; seed: number; formationId?: string },
): DraftState {
  const { slots, formation } = resolveSlots(config, opts.formationId);
  if (slots.length !== config.rounds) {
    throw new Error(
      `initDraft: roster slot count (${slots.length}) does not match config.rounds (${config.rounds}) for ${config.slug}`,
    );
  }
  return {
    config,
    formation,
    slots,
    round: 0,
    picks: slots.map(() => null),
    spin: null,
    rerollsLeft: { ...config.rerolls },
    drawnEras: [],
    spinHistory: [],
    rngState: opts.seed >>> 0,
    nonce: opts.nonce,
  };
}

export function spin(state: DraftState): DraftState {
  if (state.spin) return state; // already spun this round
  const prng = PRNG.fromSeed(state.rngState).split(SALT.SPIN);
  const result = dealSpin(prng, state.config, state.drawnEras);
  return {
    ...state,
    spin: result,
    spinHistory: [...state.spinHistory, result],
    rngState: bumpRng(state.rngState, SALT.SPIN),
  };
}

export function rerollEntity(state: DraftState): DraftState | null {
  if (!state.spin) return null;
  if (state.rerollsLeft.entity <= 0) return null;
  const era = state.spin.era;
  const candidates = state.config.spinTable.filter(c => c.era === era && c.entity !== state.spin!.entity);
  if (candidates.length === 0) return null;
  const prng = PRNG.fromSeed(state.rngState).split(SALT.REROLL_ENTITY);
  const next = candidates[prng.nextInt(0, candidates.length)];
  return {
    ...state,
    spin: next,
    spinHistory: [...state.spinHistory, next],
    rerollsLeft: { ...state.rerollsLeft, entity: state.rerollsLeft.entity - 1 },
    rngState: bumpRng(state.rngState, SALT.REROLL_ENTITY),
  };
}

export function rerollEra(state: DraftState): DraftState | null {
  if (!state.spin) return null;
  if (state.rerollsLeft.era <= 0) return null;
  const entity = state.spin.entity;
  const eraAllowed = (e: string) => state.config.eraRepeat || !state.drawnEras.includes(e);
  const candidates = state.config.spinTable.filter(
    c => c.entity === entity && c.era !== state.spin!.era && eraAllowed(c.era),
  );
  if (candidates.length === 0) return null;
  const prng = PRNG.fromSeed(state.rngState).split(SALT.REROLL_ERA);
  const next = candidates[prng.nextInt(0, candidates.length)];
  return {
    ...state,
    spin: next,
    spinHistory: [...state.spinHistory, next],
    rerollsLeft: { ...state.rerollsLeft, era: state.rerollsLeft.era - 1 },
    rngState: bumpRng(state.rngState, SALT.REROLL_ERA),
  };
}

export interface PickValidation {
  ok: boolean;
  reason?: string;
}

function normalizeName(s: string): string {
  return s.toLowerCase().trim().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

export function validatePick(
  state: DraftState,
  pool: PlayerPool,
  playerId: string,
  slotKey: string,
): PickValidation {
  if (!state.spin) return { ok: false, reason: 'no spin' };
  const slotIndex = state.slots.findIndex(s => s.key === slotKey);
  if (slotIndex < 0) return { ok: false, reason: 'unknown slot' };
  if (state.picks[slotIndex]) return { ok: false, reason: 'slot already filled' };
  const player = pool.players.find(p => p.id === playerId);
  if (!player) return { ok: false, reason: 'unknown player' };
  if (player.entity !== state.spin.entity || player.era !== state.spin.era) {
    return { ok: false, reason: 'player not in dealt cell' };
  }
  // Hard block: same player ID already in picks (same row of the pool).
  if (state.picks.some(pk => pk?.playerId === playerId)) {
    return { ok: false, reason: 'player already on your XI' };
  }
  // Hard block: same NAME already in picks (cross-era same person).
  const nameKey = normalizeName(player.name);
  for (const pk of state.picks) {
    if (!pk) continue;
    const other = pool.players.find(p => p.id === pk.playerId);
    if (other && normalizeName(other.name) === nameKey) {
      return { ok: false, reason: 'this player is already on your XI in another era' };
    }
  }
  return { ok: true };
}

export function applyPick(
  state: DraftState,
  pool: PlayerPool,
  playerId: string,
  slotKey: string,
): DraftState {
  const v = validatePick(state, pool, playerId, slotKey);
  if (!v.ok) throw new Error(`applyPick: ${v.reason}`);
  const slotIndex = state.slots.findIndex(s => s.key === slotKey);
  const pick: Pick = { playerId, slotKey };
  const picks = [...state.picks];
  picks[slotIndex] = pick;
  const spin = state.spin!;
  const drawnEras = state.config.eraRepeat
    ? state.drawnEras
    : Array.from(new Set([...state.drawnEras, spin.era]));
  // reset rerolls per spec — rerolls are per-game budgets, not per-spin.
  return {
    ...state,
    picks,
    spin: null,
    round: state.round + 1,
    drawnEras,
  };
}

export function isComplete(state: DraftState): boolean {
  return state.picks.every(p => p !== null) && state.round >= state.config.rounds;
}

export function spinFromSeed(seed: number, config: CompetitionConfig): SpinResult {
  return dealSpin(PRNG.fromSeed(seed).split(SALT.SPIN), config, []);
}

export const DRAFT_SALT = SALT;
