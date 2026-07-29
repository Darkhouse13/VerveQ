/**
 * API-Football v3 client.
 *
 * Conventions mirrored from `scripts/fetchSportsData.ts` (auth mode, spacing,
 * retry-on-transport-only, dry-run short-circuit) without importing it — that
 * script is written for a Pro key and a different data model.
 *
 * THIS FILE AND ITS CALLERS IN fetch/ ARE THE ONLY PLACE IN THIS PACKAGE
 * PERMITTED TO TOUCH THE NETWORK. See README.md §The network rule.
 *
 * Every call is metered against the state ledger BEFORE it goes out and the
 * ledger is persisted immediately after, so an interrupted run can never
 * under-count what it already spent.
 */

import {
  API_BASE_URL,
  MAX_RETRIES,
  paceFor,
  RAPIDAPI_BASE_URL,
  RAPIDAPI_HOST,
  RETRY_BACKOFF_MS,
} from './config.ts';
import {
  effectiveCap,
  recordRequest,
  remainingToday,
  saveState,
  spentToday,
  type FetchState,
} from './state.ts';

export interface ApiEnvelope<T> {
  get: string;
  parameters: Record<string, unknown>;
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T;
}

export class BudgetExhaustedError extends Error {
  constructor(
    public readonly spentToday: number,
    /**
     * What the provider actually said, when it was the provider that refused
     * rather than our own ledger. Carried because a bare "cap reached" with a
     * spend of 1 is indistinguishable from a misclassified error — which is
     * exactly the ambiguity this field exists to remove.
     */
    public readonly providerMessage?: string,
  ) {
    super(
      providerMessage === undefined
        ? `Local ledger says the daily budget is spent (${spentToday} today).`
        : `Provider refused (${spentToday} spent by our count): ${providerMessage}`,
    );
    this.name = 'BudgetExhaustedError';
  }
}

/**
 * The plan tier refusing a season.
 *
 * This is its own error type because the `/leagues` coverage flags are NOT a
 * reliable guide to what the key can actually read: on the free tier they
 * advertise `statistics_players` for every season back to 2014 while the plan
 * only serves 2022-2024. The refusal carries the real window, so it is parsed
 * and fed back into season selection rather than treated as a dead end.
 */
export class PlanRestrictionError extends Error {
  constructor(
    message: string,
    public readonly minSeason: number | null,
    public readonly maxSeason: number | null,
  ) {
    super(message);
    this.name = 'PlanRestrictionError';
  }
}

/** Parses "Free plans do not have access to this season, try from 2022 to 2024." */
export function parsePlanSeasonWindow(message: string): { min: number; max: number } | null {
  const match = /from\s+(\d{4})\s+to\s+(\d{4})/i.exec(message);
  if (match === null) return null;
  const min = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2], 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;
  return { min, max };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly endpoint: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The provider signals quota exhaustion inside a 200 body rather than with a
 * status code, so this has to sniff the `errors` field.
 */
function errorsToMessage(errors: unknown): string | null {
  if (errors === null || errors === undefined) return null;
  if (Array.isArray(errors)) return errors.length === 0 ? null : JSON.stringify(errors);
  if (typeof errors === 'object') {
    const keys = Object.keys(errors as Record<string, unknown>);
    return keys.length === 0 ? null : JSON.stringify(errors);
  }
  if (typeof errors === 'string') return errors === '' ? null : errors;
  return null;
}

function looksLikeQuota(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('rate') || lower.includes('quota') || lower.includes('limit');
}

export interface ClientOptions {
  readonly apiKey: string;
  readonly authMode: 'apisports' | 'rapidapi';
  readonly state: FetchState;
  /** Records the request against the ledger but sends nothing. */
  readonly dryRun: boolean;
  readonly log: (line: string) => void;
}

export class ApiFootballClient {
  private lastRequestAt = 0;
  /** What the server itself says is left today, when it tells us. */
  public serverDailyRemaining: number | null = null;
  /** The account's plan cap, from `x-ratelimit-requests-limit`. */
  public serverDailyLimit: number | null = null;

  constructor(private readonly opts: ClientOptions) {}

  private get baseUrl(): string {
    return this.opts.authMode === 'rapidapi' ? RAPIDAPI_BASE_URL : API_BASE_URL;
  }

  private headers(): Record<string, string> {
    if (this.opts.authMode === 'rapidapi') {
      return { 'x-rapidapi-key': this.opts.apiKey, 'x-rapidapi-host': RAPIDAPI_HOST };
    }
    return { 'x-apisports-key': this.opts.apiKey };
  }

  async request<T>(
    endpoint: string,
    params: Record<string, string | number>,
  ): Promise<ApiEnvelope<T>> {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) search.set(key, String(value));
    const url = `${this.baseUrl}${endpoint}?${search.toString()}`;
    const display = `${endpoint}?${search.toString()}`;

    if (remainingToday(this.opts.state) <= 0) {
      throw new BudgetExhaustedError(spentToday(this.opts.state));
    }

    if (this.opts.dryRun) {
      this.opts.log(`  [dry-run] GET ${display}`);
      return { get: endpoint, parameters: params, errors: [], results: 0, paging: { current: 1, total: 1 }, response: [] as unknown as T };
    }

    const pace = paceFor(effectiveCap(this.opts.state));
    const since = Date.now() - this.lastRequestAt;
    if (this.lastRequestAt !== 0 && since < pace) await sleep(pace - since);

    let lastTransportError: string | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      this.lastRequestAt = Date.now();

      // Metered before the response is seen: a request that left the machine
      // counts against the quota whether or not we liked the answer.
      recordRequest(this.opts.state);
      saveState(this.opts.state);

      let response: Response;
      try {
        response = await fetch(url, { headers: this.headers() });
      } catch (cause) {
        lastTransportError = cause instanceof Error ? cause.message : String(cause);
        if (attempt < MAX_RETRIES) {
          this.opts.log(`  ! transport error (${lastTransportError}); retry ${attempt}/${MAX_RETRIES - 1} in ${RETRY_BACKOFF_MS / 1000}s`);
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        throw new ApiError(`transport failure after ${MAX_RETRIES} attempts: ${lastTransportError}`, endpoint, 0);
      }

      const dailyRemaining = response.headers.get('x-ratelimit-requests-remaining');
      if (dailyRemaining !== null) {
        const parsed = Number.parseInt(dailyRemaining, 10);
        if (Number.isFinite(parsed)) this.serverDailyRemaining = parsed;
      }

      // The plan tier, straight from the provider. Persisting it is what lets
      // the budget re-cost itself against a Pro key instead of the free-tier
      // assumption — and it is measured, never inferred from what we were told.
      const dailyLimit = response.headers.get('x-ratelimit-requests-limit');
      if (dailyLimit !== null) {
        const parsed = Number.parseInt(dailyLimit, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.serverDailyLimit = parsed;
          if (this.opts.state.detectedDailyCap !== parsed) {
            this.opts.state.detectedDailyCap = parsed;
            saveState(this.opts.state);
          }
        }
      }

      if (response.status === 429 || response.status >= 500) {
        lastTransportError = `HTTP ${response.status}`;
        if (attempt < MAX_RETRIES) {
          this.opts.log(`  ! ${lastTransportError}; retry ${attempt}/${MAX_RETRIES - 1} in ${RETRY_BACKOFF_MS / 1000}s`);
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        throw new ApiError(`${lastTransportError} after ${MAX_RETRIES} attempts`, endpoint, response.status);
      }

      if (!response.ok) {
        throw new ApiError(`HTTP ${response.status}`, endpoint, response.status);
      }

      const body = (await response.json()) as ApiEnvelope<T>;
      const message = errorsToMessage(body.errors);
      if (message !== null) {
        // Order matters: a plan refusal mentions "plan", not "limit", but the
        // quota sniffer is broad enough to catch stray wording, so the more
        // specific classification runs first.
        if (/plan/i.test(message) && /season/i.test(message)) {
          const window = parsePlanSeasonWindow(message);
          throw new PlanRestrictionError(message, window?.min ?? null, window?.max ?? null);
        }
        if (looksLikeQuota(message)) {
          throw new BudgetExhaustedError(spentToday(this.opts.state), message);
        }
        throw new ApiError(`provider error: ${message}`, endpoint, response.status);
      }

      return body;
    }

    throw new ApiError(`exhausted retries: ${lastTransportError ?? 'unknown'}`, endpoint, 0);
  }
}
