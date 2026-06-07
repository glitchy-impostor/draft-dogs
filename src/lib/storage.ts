// Tiny typed wrapper around localStorage. Per §2: last-played mode is
// remembered per device. We also stash username and any future client prefs.

import type { GameMode } from '@engine/types';

const KEYS = {
  lastMode: 'dd.lastMode',
  username: 'dd.username',
} as const;

export function readLastMode(): GameMode | null {
  if (typeof localStorage === 'undefined') return null;
  const v = localStorage.getItem(KEYS.lastMode);
  if (v === 'classic' || v === 'expert' || v === 'hard' || v === 'daily') return v;
  return null;
}

export function writeLastMode(mode: GameMode): void {
  try { localStorage.setItem(KEYS.lastMode, mode); } catch { /* private mode */ }
}

export function readUsername(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(KEYS.username) ?? '';
}

export function writeUsername(name: string): void {
  try { localStorage.setItem(KEYS.username, name.slice(0, 20)); } catch { /* private mode */ }
}
