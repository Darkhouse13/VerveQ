/**
 * Weekend Fantasy — API-Football v3 read client (FW-2).
 *
 * The ONLY place the fantasy namespace touches the network. Actions call it;
 * mutations never do.
 *
 * Deliberately NOT a port of `research/fantasy/fetch/apiFootball.ts`. That
 * client exists to spend a scarce daily quota safely across a multi-day pull
 * and carries a persistent request ledger to prove it never double-spends.
 * Ingestion has the opposite problem: a generous budget (Pro, 7,500/day,
 * measured 2026-07-29) and a hard requirement to be correct when the provider
 * misbehaves mid-cron. So this one keeps the parts that matter here — refusal
 * detection in the BODY, not the status code; retry on transport only — and
 * drops the ledger, which a stateless action could not maintain anyway.
 *
 * ── The one trap this file exists to not fall into ──
 *
 * API-Football signals quota exhaustion and plan refusals with **HTTP 200** and
 * a populated `errors` field. `response.ok` is true, `response.json()` parses,
 * and an unwary caller ingests `[]` as "this league has no fixtures" and
 * happily deletes a season. Every response therefore goes through
 * `unwrap`, which treats a populated `errors` as a thrown failure and never
 * as an empty result.
 */

import type { FeedStatBlock, MatchEvent } from "./lib/fantasyFeedStats";

/** api-sports.io direct. RapidAPI uses a different host and header pair. */
const API_BASE_URL = "https://v3.football.api-sports.io";
const RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com";
const RAPIDAPI_BASE_URL = `https://${RAPIDAPI_HOST}/v3`;

const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 2_000;

/**
 * Measured 2026-07-29 on the live Pro key: `x-ratelimit-limit` is 300/minute
 * (not the 450 the FS-1 config previously assumed). 250ms between calls is
 * 240/minute — a 20% cushion. Ingestion's biggest single burst is the ~156-club
 * player bootstrap (eight leagues since FW-EXPAND), ~40s at this spacing.
 */
const REQUEST_SPACING_MS = 250;

export class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

interface Envelope<T> {
  errors?: unknown;
  results?: number;
  paging?: { current: number; total: number };
  response?: T;
}

/** A populated `errors` — in any of the three shapes the API uses — or null. */
function errorsToMessage(errors: unknown): string | null {
  if (errors === null || errors === undefined) return null;
  if (typeof errors === "string") return errors === "" ? null : errors;
  if (Array.isArray(errors)) return errors.length === 0 ? null : JSON.stringify(errors);
  if (typeof errors === "object") {
    const keys = Object.keys(errors as Record<string, unknown>);
    return keys.length === 0 ? null : JSON.stringify(errors);
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ApiFootballCredentials {
  readonly apiKey: string;
  readonly authMode: "apisports" | "rapidapi";
}

/**
 * Credentials from the deployment environment.
 *
 * Throws rather than returning null: every caller is an action that cannot do
 * anything useful without a key, and a thrown error surfaces in the Convex log
 * with a name the operator can act on. The key itself is never logged, never
 * returned, and never included in an error message.
 */
export function credentialsFromEnv(): ApiFootballCredentials {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (apiKey === undefined || apiKey === "") {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY is not set on this deployment. Set it with `npx convex env set API_FOOTBALL_KEY <key>`.",
      "(none)",
      0,
    );
  }
  const authMode = process.env.AUTH_MODE === "rapidapi" ? "rapidapi" : "apisports";
  return { apiKey, authMode };
}

export class ApiFootballClient {
  private lastRequestAt = 0;
  /** Provider's own remaining-today count, from the last response seen. */
  public dailyRemaining: number | null = null;

  constructor(private readonly credentials: ApiFootballCredentials) {}

  private get baseUrl(): string {
    return this.credentials.authMode === "rapidapi" ? RAPIDAPI_BASE_URL : API_BASE_URL;
  }

  private headers(): Record<string, string> {
    return this.credentials.authMode === "rapidapi"
      ? { "x-rapidapi-key": this.credentials.apiKey, "x-rapidapi-host": RAPIDAPI_HOST }
      : { "x-apisports-key": this.credentials.apiKey };
  }

  /**
   * One GET, paced, retried on transport failures and 429/5xx only.
   *
   * A populated `errors` body is NEVER retried: a plan refusal or a spent quota
   * will say exactly the same thing on the second attempt, and hammering it is
   * how a cron burns a day's budget discovering that it has no budget.
   */
  async get<T>(endpoint: string, params: Record<string, string | number>): Promise<T> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) search.set(key, String(value));
    const url = `${this.baseUrl}${endpoint}?${search.toString()}`;

    const since = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt !== 0 && since < REQUEST_SPACING_MS) {
      await sleep(REQUEST_SPACING_MS - since);
    }

    let lastTransportError: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      this.lastRequestAt = Date.now();

      let response: Response;
      try {
        response = await fetch(url, { headers: this.headers() });
      } catch (cause) {
        lastTransportError = cause instanceof Error ? cause.message : String(cause);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BACKOFF_MS * attempt);
          continue;
        }
        throw new ApiFootballError(
          `transport failure after ${MAX_ATTEMPTS} attempts: ${lastTransportError}`,
          endpoint,
          0,
        );
      }

      const remaining = response.headers.get("x-ratelimit-requests-remaining");
      if (remaining !== null) {
        const parsed = Number.parseInt(remaining, 10);
        if (Number.isFinite(parsed)) this.dailyRemaining = parsed;
      }

      if (response.status === 429 || response.status >= 500) {
        lastTransportError = `HTTP ${response.status}`;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_BACKOFF_MS * attempt);
          continue;
        }
        throw new ApiFootballError(
          `${lastTransportError} after ${MAX_ATTEMPTS} attempts`,
          endpoint,
          response.status,
        );
      }

      if (!response.ok) {
        throw new ApiFootballError(`HTTP ${response.status}`, endpoint, response.status);
      }

      const body = (await response.json()) as Envelope<T>;
      const message = errorsToMessage(body.errors);
      if (message !== null) {
        // HTTP 200 with a refusal inside. See the module header.
        throw new ApiFootballError(`provider refused: ${message}`, endpoint, 200);
      }

      return (body.response ?? ([] as unknown)) as T;
    }

    throw new ApiFootballError(
      `exhausted retries: ${lastTransportError ?? "unknown"}`,
      endpoint,
      0,
    );
  }
}

// ------------------------------------------------------------------ feed shapes

export interface FeedFixture {
  fixture: {
    id: number;
    date: string;
    timestamp: number;
    status: { short: string; long: string };
  };
  league: { id: number; season: number; round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

export interface FeedSquadPlayer {
  id: number;
  name: string;
  /** "Goalkeeper" | "Defender" | "Midfielder" | "Attacker", or absent. */
  position?: string | null;
}

export interface FeedSquad {
  team: { id: number; name: string };
  players: FeedSquadPlayer[];
}

export interface FeedTeamEntry {
  team: { id: number; name: string };
}

/** Every fixture of one league-season. One request; the feed does not page it. */
export async function fetchLeagueFixtures(
  client: ApiFootballClient,
  leagueId: number,
  season: number,
): Promise<FeedFixture[]> {
  return client.get<FeedFixture[]>("/fixtures", { league: leagueId, season });
}

/** The clubs contesting a league-season. */
export async function fetchLeagueTeams(
  client: ApiFootballClient,
  leagueId: number,
  season: number,
): Promise<FeedTeamEntry[]> {
  return client.get<FeedTeamEntry[]>("/teams", { league: leagueId, season });
}

/** One club's current squad list. */
export async function fetchSquad(
  client: ApiFootballClient,
  teamId: number,
): Promise<FeedSquad[]> {
  return client.get<FeedSquad[]>("/players/squads", { team: teamId });
}

// ────────────────────────────── scoring reads (FW-4, additive to this client)
//
// Two endpoints, two calls per fixture, and the scoring pipeline reads BOTH or
// scores nothing (FW-4 R7): the per-player stat lines carry no clock and no own
// goals, and the events feed carries no aggregate counts. Either one alone would
// silently under-score somebody.
//
// The shapes are the measured ones and live in lib/fantasyFeedStats.ts, which is
// also what normalises them — this file only performs the request.

export interface FeedFixturePlayerRow {
  player: { id: number; name: string };
  /** One entry per fixture; index 0 is this fixture's line. */
  statistics: FeedStatBlock[];
}

export interface FeedFixturePlayers {
  team: { id: number; name: string };
  players: FeedFixturePlayerRow[];
}

/** Per-player aggregate lines for one fixture. 1 request. */
export async function fetchFixturePlayers(
  client: ApiFootballClient,
  providerFixtureId: string,
): Promise<FeedFixturePlayers[]> {
  return client.get<FeedFixturePlayers[]>("/fixtures/players", { fixture: providerFixtureId });
}

// ────────────────────────────── transfer reads (FW-T1, additive to this client)
//
// One endpoint, queried per team. The response is the transfer HISTORY of every
// player the team was ever party to — not a windowed list — so the caller
// filters by date and by whether either side is a covered club. The endpoint
// does not page (no `page` parameter exists on /transfers), and it carries NO
// transfer id: identity is (player, date, from-team, to-team), which is what
// the ingestion keys on.
//
// Every field except the player id has been observed null on live data at some
// point in this feed's history, so the shape below trusts nothing.

export interface FeedTransferMove {
  /** YYYY-MM-DD, or null on malformed rows. */
  date: string | null;
  /** "€ 25.5m" | "Loan" | "Free" | "N/A" | null — a label, not an enum. */
  type: string | null;
  teams: {
    in: { id: number | null; name: string | null } | null;
    out: { id: number | null; name: string | null } | null;
  } | null;
}

export interface FeedTransferEntry {
  player: { id: number | null; name: string | null };
  /** Provider's own last-updated stamp for this player's history. */
  update: string;
  transfers: FeedTransferMove[] | null;
}

/** Every transfer record involving one team. 1 request; the feed does not page it. */
export async function fetchTeamTransfers(
  client: ApiFootballClient,
  teamId: string | number,
): Promise<FeedTransferEntry[]> {
  return client.get<FeedTransferEntry[]>("/transfers", { team: teamId });
}

/**
 * Timed events for one fixture. 1 request.
 *
 * An empty array counts as "events not present" and leaves the fixture unscored
 * (R7, fail-closed). That is deliberate rather than pedantic: a finished match
 * always carries at least its substitutions — 1,734 of them across the
 * 192-fixture FS-1 sample, every one with an incoming player id — so an empty
 * events response for an FT fixture is a feed failure, not a quiet match.
 */
export async function fetchFixtureEvents(
  client: ApiFootballClient,
  providerFixtureId: string,
): Promise<MatchEvent[]> {
  return client.get<MatchEvent[]>("/fixtures/events", { fixture: providerFixtureId });
}
