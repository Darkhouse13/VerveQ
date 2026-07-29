/**
 * Resumable pull state + daily budget ledger.
 *
 * Two jobs, one file, because they have to agree: the budget is only correct if
 * it is written in the same atomic step as the progress it paid for. Written
 * after every single request (write-temp-then-rename), so a kill -9 mid-pull
 * costs at most one request rather than a day's quota.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FREE_TIER_DAILY_CAP } from './config.ts';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(PACKAGE_ROOT, 'data');
export const STATE_PATH = path.join(DATA_DIR, '.fetch-state.json');

export interface RoundSelection {
  readonly leagueId: number;
  readonly round: string;
  readonly label: string;
}

export interface FetchState {
  version: 1;
  startedAt: string;
  lastUpdatedAt: string;
  /** UTC date (YYYY-MM-DD) -> requests spent that day. Mirrors the API's reset. */
  requestsByDay: Record<string, number>;
  /**
   * The account's real daily cap, read from `x-ratelimit-requests-limit` on the
   * first response. Null until a response has been seen; the free-tier value is
   * assumed in the meantime, which errs toward under-spending.
   */
  detectedDailyCap: number | null;
  /** Fixture ids whose events feed is on disk (Stage E). */
  fetchedEvents: number[];
  /**
   * The season window the plan tier will actually serve, learned from a refusal.
   * The /leagues coverage flags advertise far more than the key can read, so
   * this — not those flags — is the binding constraint on season choice.
   */
  planSeasonWindow: { min: number; max: number } | null;
  /** league id -> the completed season discovery settled on. */
  season: Record<string, number>;
  /** league id -> every round name the league reported, in order. */
  allRounds: Record<string, string[]>;
  /** The four rounds actually sampled per league. */
  selectedRounds: RoundSelection[];
  /** `${leagueId}|${round}` -> fixture ids in that round. */
  fixturesByRound: Record<string, number[]>;
  /** Fixture ids whose player stats are on disk. */
  fetchedFixtures: number[];
  /** Anything a reader of the Phase 1 report needs to know. Append-only. */
  notes: string[];
}

/**
 * The provider's daily quota window does NOT roll at 00:00 UTC.
 *
 * INFERRED from this account's behaviour, 2026-07-27/28: day 1 spent its 100
 * between 17:30 and 18:10 UTC, and by 00:03 UTC the counter was already back to
 * 0 — so the reset happened in between, not at midnight. The subscription's own
 * timestamp ends 23:45:02 UTC, which is almost certainly the boundary.
 *
 * This is a local conservative fallback only. The gate that actually matters is
 * `reconcileWithProvider`, which asks the provider directly; if this boundary is
 * off by a few minutes the worst case is one refused request, handled by the
 * retry path.
 */
const QUOTA_RESET_MINUTE_UTC = 23 * 60 + 45;

/**
 * The provider quota window a moment belongs to, as a YYYY-MM-DD key. After the
 * reset boundary a moment belongs to the NEXT day's window, so a run at 23:50
 * is not charged against a window that already closed.
 */
export function utcDay(now: Date = new Date()): string {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const shifted = new Date(now.getTime());
  if (minutes >= QUOTA_RESET_MINUTE_UTC) shifted.setUTCDate(shifted.getUTCDate() + 1);
  return shifted.toISOString().slice(0, 10);
}

export function createFreshState(now: Date = new Date()): FetchState {
  const iso = now.toISOString();
  return {
    version: 1,
    startedAt: iso,
    lastUpdatedAt: iso,
    requestsByDay: {},
    detectedDailyCap: null,
    fetchedEvents: [],
    planSeasonWindow: null,
    season: {},
    allRounds: {},
    selectedRounds: [],
    fixturesByRound: {},
    fetchedFixtures: [],
    notes: [],
  };
}

export function loadState(): FetchState | null {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as FetchState;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: FetchState, now: Date = new Date()): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  state.lastUpdatedAt = now.toISOString();
  const tmp = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, STATE_PATH);
}

export function spentToday(state: FetchState, now: Date = new Date()): number {
  return state.requestsByDay[utcDay(now)] ?? 0;
}

/** The measured cap once known, the conservative free-tier assumption before. */
export function effectiveCap(state: FetchState): number {
  return state.detectedDailyCap ?? FREE_TIER_DAILY_CAP;
}

export function remainingToday(state: FetchState, now: Date = new Date()): number {
  return Math.max(0, effectiveCap(state) - spentToday(state, now));
}

export function recordRequest(state: FetchState, now: Date = new Date()): void {
  const day = utcDay(now);
  state.requestsByDay[day] = (state.requestsByDay[day] ?? 0) + 1;
}

export function addNote(state: FetchState, note: string): void {
  if (!state.notes.includes(note)) state.notes.push(note);
}
