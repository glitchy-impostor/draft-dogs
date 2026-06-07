// Thin fetch client for the FastAPI arcade router. All endpoints live under
// /api/arcade. In dev, Vite proxies /api → :8000 (see vite.config.ts). In a
// split deployment (GH Pages frontend + Railway backend) set VITE_API_URL at
// build time to the absolute backend origin, e.g. https://api.example.com.

import type { Pick } from '@engine/types';

const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const BASE = `${API_ORIGIN}/api/arcade`;

export interface LeaderboardRow {
  rank: number;
  nonce: string;
  competition: string;
  mode: string;
  sim_version: number;
  pool_version: number;
  username: string;
  score: number;
  record: string;
  team_rating: number;
  team: Array<{ playerId: string; slotKey: string }>;
  day: string | null;
  created_at: number;
}

export interface SubmitResponse {
  rank: number | null;
  total: number;
  score: number;
  record: string;
  rating: number;
  tier?: string;
  around: LeaderboardRow[];
}

export interface NonceResponse {
  nonce: string;
  seed: number;
}

export interface DailyResponse {
  competition: string;
  day: string;
  nonce: string;
  seed: number;
}

export async function issueNonce(competition: string, mode: string): Promise<NonceResponse> {
  const r = await fetch(`${BASE}/nonce?competition=${competition}&mode=${mode}`);
  if (!r.ok) throw new Error(`nonce ${r.status}`);
  return r.json();
}

export async function fetchDaily(competition: string): Promise<DailyResponse> {
  const r = await fetch(`${BASE}/daily?competition=${competition}`);
  if (!r.ok) throw new Error(`daily ${r.status}`);
  return r.json();
}

export async function submitRun(body: {
  competition: string;
  mode: string;
  nonce: string;
  formationId?: string | null;
  picks: Pick[];
  username: string;
  day?: string | null;
}): Promise<SubmitResponse> {
  const r = await fetch(`${BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(data?.detail ?? `submit ${r.status}`) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return data as SubmitResponse;
}

export interface LeaderboardResponse {
  competition: string;
  mode: string;
  sim_version: number;
  day: string | null;
  rows: LeaderboardRow[];
  total: number;
}

export async function fetchLeaderboard(opts: {
  competition: string;
  mode: string;
  day?: string | null;
  limit?: number;
}): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({
    competition: opts.competition,
    mode: opts.mode,
    limit: String(opts.limit ?? 50),
  });
  if (opts.day) params.set('day', opts.day);
  const r = await fetch(`${BASE}/leaderboard?${params.toString()}`);
  if (!r.ok) throw new Error(`leaderboard ${r.status}`);
  return r.json();
}
