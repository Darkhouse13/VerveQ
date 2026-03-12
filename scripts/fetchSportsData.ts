#!/usr/bin/env npx tsx
/**
 * fetchSportsData.ts — VerveQ Sports Data Pipeline (API-FOOTBALL + NBA)
 *
 * Extracts player/team/fixture data from API-FOOTBALL v3 (Pro) and
 * API-SPORTS NBA v2 (Free), normalizes into game-ready JSON tables
 * for VerveGrid, Higher or Lower, and Who Am I game modes.
 *
 * Usage:
 *   npx tsx scripts/fetchSportsData.ts                       # full run
 *   npx tsx scripts/fetchSportsData.ts --dry-run             # print planned calls
 *   npx tsx scripts/fetchSportsData.ts --resume              # resume from state
 *   npx tsx scripts/fetchSportsData.ts --config custom.json  # custom config
 *   npx tsx scripts/fetchSportsData.ts --sport football      # football only
 *   npx tsx scripts/fetchSportsData.ts --sport nba           # nba only
 *
 * Environment:
 *   API_FOOTBALL_KEY — API-Football Pro key
 *   NBA_API_KEY      — NBA API-Sports key (can be same as football if same account)
 *   AUTH_MODE        — "apisports" (default) or "rapidapi"
 */

import * as fs from "fs";
import * as path from "path";

// Load .env from project root
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── TypeScript Interfaces ──────────────────────────────────────────────────

// --- Config Types ---

interface LeagueEntry {
  id: number;
  name: string;
  country: string;
  topPlayerSeasons?: number[];
}

interface FootballConfig {
  enabled: boolean;
  leagues: LeagueEntry[];
  seasons: number[];
  topPlayerSeasons: number[];
  squadSeasons: number[];
  domesticLeagueIds: number[];
  enrichmentCount: number;
  topPlayersForEnrichment: number;
  fetchTrophies: boolean;
  fetchTransfers: boolean;
  fetchFixtures: boolean;
  fetchTeamStats: boolean;
  fixturesStatuses: string;
  dailyBudget: number;
  reserveBudget: number;
  rateLimitMs: number;
}

interface NbaConfig {
  enabled: boolean;
  seasons: number[];
  teamsPerDay: number;
  headlinePlayerCount: number;
  dailyBudget: number;
  reserveBudget: number;
  rateLimitMs: number;
}

interface FeaturesConfig {
  buildGridIndex: boolean;
  buildStatFacts: boolean;
  buildWhoAmIClues: boolean;
}

interface PipelineConfig {
  football: FootballConfig;
  nba: NbaConfig;
  features: FeaturesConfig;
}

// --- Normalized Entity Types (Output Tables) ---

interface League {
  id: string;
  sport: "football" | "nba";
  apiId: number;
  name: string;
  country: string;
  type: string | null;
  logo: string | null;
  seasons: number[];
}

interface Team {
  id: string;
  sport: "football" | "nba";
  apiId: number;
  name: string;
  shortName: string | null;
  logo: string | null;
  country: string | null;
  leagueId: string;
  season: number;
  founded: number | null;
  venue: string | null;
}

interface Player {
  id: string;
  sport: "football" | "nba";
  apiId: number;
  name: string;
  firstName: string | null;
  lastName: string | null;
  nationality: string | null;
  birthDate: string | null;
  birthCountry: string | null;
  age: number | null;
  height: string | null;
  weight: string | null;
  position: string | null;
  photo: string | null;
  injured: boolean;
}

interface PlayerTeamSeason {
  id: string;
  playerId: string;
  teamId: string;
  leagueId: string;
  season: number;
  position: string | null;
  appearances: number | null;
  minutes: number | null;
  goals: number | null;
  assists: number | null;
  cardsYellow: number | null;
  cardsRed: number | null;
  rating: string | null;
  // NBA-specific
  points: number | null;
  rebounds: number | null;
  steals: number | null;
  blocks: number | null;
}

interface PlayerTrophy {
  id: string;
  sport: "football" | "nba";
  playerId: string;
  trophyName: string;
  league: string;
  country: string | null;
  season: string;
  place: string;
}

interface PlayerTransfer {
  id: string;
  sport: "football";
  playerId: string;
  date: string;
  fromTeamId: string | null;
  fromTeamName: string;
  toTeamId: string | null;
  toTeamName: string;
  type: string;
}

interface Fixture {
  id: string;
  sport: "football";
  apiId: number;
  leagueId: string;
  season: number;
  date: string;
  round: string | null;
  status: string;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

interface FixtureParticipant {
  id: string;
  fixtureId: string;
  playerId: string;
  teamId: string;
  isStarter: boolean;
  minutesPlayed: number | null;
}

interface GridIndexEntry {
  id: string;
  sport: "football" | "nba";
  rowType: string;
  rowKey: string;
  rowLabel: string;
  colType: string;
  colKey: string;
  colLabel: string;
  playerIds: string[];
  difficulty: "easy" | "medium" | "hard";
}

interface StatFact {
  id: string;
  sport: "football" | "nba";
  entityType: "player" | "team";
  entityId: string;
  entityName: string;
  statKey: string;
  contextKey: string;
  value: number;
  season: number | null;
}

interface WhoAmIClue {
  id: string;
  sport: "football" | "nba";
  playerId: string;
  clue1: string;
  clue2: string;
  clue3: string;
  clue4: string;
  answerName: string;
  difficulty: "easy" | "medium" | "hard";
}

// --- Resume State ---

interface PhaseState {
  status: "pending" | "in_progress" | "completed";
  lastKey: string | null;
  processedKeys: string[];
}

type PhaseName =
  | "footballLeagues"
  | "footballTeams"
  | "footballTopScorers"
  | "footballTopAssists"
  | "footballSquadPlayers"
  | "footballTrophies"
  | "footballTransfers"
  | "footballFixtures"
  | "footballTeamStats"
  | "footballStandings"
  | "nbaTeams"
  | "nbaStandings"
  | "nbaPlayers"
  | "nbaStats"
  | "indexBuilding";

interface PipelineState {
  version: 2;
  startedAt: string;
  lastUpdatedAt: string;
  footballCallsUsed: number;
  nbaCallsUsed: number;
  phases: Record<PhaseName, PhaseState>;
}

// --- CLI Flags ---

interface PipelineFlags {
  dryRun: boolean;
  resume: boolean;
  sportFilter: "all" | "football" | "nba";
  configPath: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const NBA_BASE_URL = "https://v2.nba.api-sports.io";

const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5000;

const CACHE_DIR = path.join(__dirname, "cache");
const DATA_DIR = path.join(__dirname, "data");
const STATE_PATH = path.join(DATA_DIR, ".pipeline-state.json");

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs(): PipelineFlags {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf("--config");
  const sportIdx = args.indexOf("--sport");
  return {
    dryRun: args.includes("--dry-run"),
    resume: args.includes("--resume"),
    sportFilter: (() => {
      if (sportIdx >= 0 && args[sportIdx + 1]) {
        const val = args[sportIdx + 1].toLowerCase();
        if (val === "football" || val === "nba") return val;
      }
      return "all" as const;
    })(),
    configPath:
      configIdx >= 0 && args[configIdx + 1]
        ? args[configIdx + 1]
        : path.join(__dirname, "pipeline-config.json"),
  };
}

// ─── Utility Functions ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function calculateFameScores(
  allPts: PlayerTeamSeason[],
  limit: number,
): [string, number][] {
  const playerFame = new Map<string, number>();
  for (const pts of allPts) {
    if (!pts.playerId.startsWith("fb_")) continue;
    let score = (pts.appearances || 0) * 1;
    score += (pts.goals || 0) * 3;
    score += (pts.assists || 0) * 2;
    // Elite competition multiplier: UCL (2), World Cup (1), Euros (4)
    if (pts.leagueId === "fb_2" || pts.leagueId === "fb_1" || pts.leagueId === "fb_4") {
      score *= 2.5;
    }
    playerFame.set(
      pts.playerId,
      (playerFame.get(pts.playerId) || 0) + score,
    );
  }
  return [...playerFame.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// ─── Budget Tracker ─────────────────────────────────────────────────────────

class BudgetTracker {
  callsUsed: number;
  plannedCalls: number;

  constructor(
    public sport: string,
    public dailyBudget: number,
    public reserveBudget: number,
  ) {
    this.callsUsed = 0;
    this.plannedCalls = 0;
  }

  get effectiveBudget(): number {
    return this.dailyBudget - this.reserveBudget;
  }

  get remaining(): number {
    return this.effectiveBudget - this.callsUsed;
  }

  canMakeCall(): boolean {
    return this.remaining > 0;
  }

  record(): void {
    this.callsUsed++;
  }

  plan(): void {
    this.plannedCalls++;
  }

  summary(): string {
    return `${this.sport}: ${this.callsUsed}/${this.effectiveBudget} used, ${this.remaining} remaining`;
  }

  drySummary(): string {
    return `${this.sport}: ${this.plannedCalls} planned calls (budget: ${this.effectiveBudget})`;
  }
}

// ─── HTTP Client ────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  headers: Record<string, string> = {},
  retries: number = MAX_RETRIES,
): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers });

      if (res.status === 429) {
        const wait = RETRY_BACKOFF_MS * (attempt + 1);
        console.warn(`  Rate limited (429), waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }

      if (res.status >= 500) {
        const wait = RETRY_BACKOFF_MS * (attempt + 1);
        console.warn(`  Server error (${res.status}), waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }

      if (res.status === 404) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      if (attempt === retries) {
        console.error(
          `  Failed after ${retries + 1} attempts: ${err.message}`,
        );
        return null;
      }
      console.warn(`  Retry ${attempt + 1}/${retries}: ${err.message}`);
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  return null;
}

class ApiClient {
  private sport: "football" | "nba";
  private baseUrl: string;
  private apiKey: string;
  private authMode: "apisports" | "rapidapi";
  private rateLimitMs: number;
  private budget: BudgetTracker;
  private dryRun: boolean;
  private cachePrefix: string;

  constructor(opts: {
    sport: "football" | "nba";
    baseUrl: string;
    apiKey: string;
    authMode: "apisports" | "rapidapi";
    rateLimitMs: number;
    budget: BudgetTracker;
    dryRun: boolean;
  }) {
    this.sport = opts.sport;
    this.baseUrl = opts.baseUrl;
    this.apiKey = opts.apiKey;
    this.authMode = opts.authMode;
    this.rateLimitMs = opts.rateLimitMs;
    this.budget = opts.budget;
    this.dryRun = opts.dryRun;
    this.cachePrefix = opts.sport === "football" ? "apisports" : "nbaapi";
  }

  private buildHeaders(): Record<string, string> {
    if (this.authMode === "rapidapi") {
      const host =
        this.sport === "football"
          ? "v3.football.api-sports.io"
          : "v2.nba.api-sports.io";
      return {
        "x-rapidapi-key": this.apiKey,
        "x-rapidapi-host": host,
      };
    }
    return { "x-apisports-key": this.apiKey };
  }

  async get<T = any>(
    endpoint: string,
    params: Record<string, string | number> = {},
  ): Promise<T | null> {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    const url = `${this.baseUrl}${endpoint}${qs ? "?" + qs : ""}`;

    // Cache key
    const sortedParams = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("_");
    const cacheKey = `${this.cachePrefix}_${endpoint.replace(/\//g, "_")}_${sortedParams}`;
    const safeName = sanitizeCacheKey(cacheKey);
    const cachePath = path.join(CACHE_DIR, `${safeName}.json`);

    // Check cache
    if (fs.existsSync(cachePath)) {
      try {
        const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
        if (cached && cached._empty === true) return null;
        return cached as T;
      } catch {
        // Corrupted cache file, re-fetch
      }
    }

    // Dry-run: count but don't call
    if (this.dryRun) {
      this.budget.plan();
      return null;
    }

    // Budget check
    if (!this.budget.canMakeCall()) {
      console.warn(
        `  Budget exhausted for ${this.sport} (${this.budget.summary()})`,
      );
      return null;
    }

    // Rate limit
    await sleep(this.rateLimitMs);

    // Make request
    const headers = this.buildHeaders();
    console.log(`  GET ${endpoint}${qs ? "?" + qs : ""}`);
    const data = await fetchWithRetry(url, headers);

    // Cache result
    ensureDir(CACHE_DIR);
    if (data === null) {
      fs.writeFileSync(cachePath, JSON.stringify({ _empty: true }));
    } else {
      fs.writeFileSync(cachePath, JSON.stringify(data));
    }

    this.budget.record();
    return data as T;
  }

  getBudget(): BudgetTracker {
    return this.budget;
  }
}

// ─── Football Fetchers ──────────────────────────────────────────────────────

async function fetchFootballLeague(
  client: ApiClient,
  leagueId: number,
): Promise<any | null> {
  const data = await client.get("/leagues", { id: leagueId });
  if (!data?.response?.length) return null;
  return data.response[0];
}

async function fetchFootballTeams(
  client: ApiClient,
  leagueId: number,
  season: number,
): Promise<any[]> {
  const data = await client.get("/teams", { league: leagueId, season });
  if (!data?.response) return [];
  return data.response;
}

async function fetchFootballPlayers(
  client: ApiClient,
  leagueId: number,
  season: number,
): Promise<any[]> {
  const allPlayers: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await client.get("/players", {
      league: leagueId,
      season,
      page,
    });
    if (!data) break;

    if (data.paging) {
      totalPages = data.paging.total || 1;
    }

    if (data.response) {
      allPlayers.push(...data.response);
    }

    page++;
  }

  return allPlayers;
}

async function fetchTopScorers(
  client: ApiClient,
  leagueId: number,
  season: number,
): Promise<any[]> {
  const data = await client.get("/players/topscorers", {
    league: leagueId,
    season,
  });
  if (!data?.response) return [];
  return data.response;
}

async function fetchTopAssists(
  client: ApiClient,
  leagueId: number,
  season: number,
): Promise<any[]> {
  const data = await client.get("/players/topassists", {
    league: leagueId,
    season,
  });
  if (!data?.response) return [];
  return data.response;
}

async function fetchPlayersByTeam(
  client: ApiClient,
  teamId: number,
  season: number,
): Promise<any[]> {
  const allPlayers: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await client.get("/players", {
      team: teamId,
      season,
      page,
    });
    if (!data) break;

    if (data.paging) {
      totalPages = data.paging.total || 1;
    }

    if (data.response) {
      allPlayers.push(...data.response);
    }

    page++;
  }

  return allPlayers;
}

async function fetchFootballStandings(
  client: ApiClient,
  leagueId: number,
  season: number,
): Promise<any[]> {
  const data = await client.get("/standings", { league: leagueId, season });
  if (!data?.response?.length) return [];
  // standings are nested: response[0].league.standings[0] is the main table
  const leagueData = data.response[0];
  if (leagueData?.league?.standings?.length) {
    return leagueData.league.standings[0]; // first standings group
  }
  return [];
}

async function fetchFootballTrophies(
  client: ApiClient,
  playerId: number,
): Promise<any[]> {
  const data = await client.get("/trophies", { player: playerId });
  if (!data?.response) return [];
  return data.response;
}

async function fetchFootballTransfers(
  client: ApiClient,
  playerId: number,
): Promise<any[]> {
  const data = await client.get("/transfers", { player: playerId });
  if (!data?.response?.length) return [];
  // transfers response is an array of {player, update, transfers[]}
  // Flatten all transfer entries
  const allTransfers: any[] = [];
  for (const entry of data.response) {
    if (entry.transfers) {
      allTransfers.push(...entry.transfers);
    }
  }
  return allTransfers;
}

async function fetchFootballFixtureIds(
  client: ApiClient,
  leagueId: number,
  season: number,
  statuses: string,
): Promise<number[]> {
  const data = await client.get("/fixtures", {
    league: leagueId,
    season,
    status: statuses,
  });
  if (!data?.response) return [];
  return data.response.map((f: any) => f.fixture?.id).filter(Boolean);
}

async function fetchFootballFixturesBatch(
  client: ApiClient,
  ids: number[],
): Promise<any[]> {
  const idsStr = ids.join("-");
  const data = await client.get("/fixtures", { ids: idsStr });
  if (!data?.response) return [];
  return data.response;
}

async function fetchFootballTeamStats(
  client: ApiClient,
  teamId: number,
  leagueId: number,
  season: number,
): Promise<any | null> {
  const data = await client.get("/teams/statistics", {
    team: teamId,
    league: leagueId,
    season,
  });
  if (!data?.response) return null;
  return data.response;
}

// ─── NBA Fetchers ───────────────────────────────────────────────────────────

async function fetchNbaTeams(client: ApiClient): Promise<any[]> {
  const data = await client.get("/teams");
  if (!data?.response) return [];
  return data.response;
}

async function fetchNbaStandings(
  client: ApiClient,
  season: number,
): Promise<any[]> {
  const data = await client.get("/standings", {
    league: "standard",
    season,
  });
  if (!data?.response) return [];
  return data.response;
}

async function fetchNbaPlayers(
  client: ApiClient,
  teamId: number,
  season: number,
): Promise<any[]> {
  const allPlayers: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const data = await client.get("/players", {
      team: teamId,
      season,
      page,
    });
    if (!data) break;

    if (data.paging) {
      totalPages = data.paging.total || 1;
    } else if (data.results !== undefined) {
      // Some API-Sports endpoints use results count without paging
      totalPages = 1;
    }

    if (data.response) {
      allPlayers.push(...data.response);
    }

    page++;
  }

  return allPlayers;
}

async function fetchNbaPlayerStats(
  client: ApiClient,
  playerId: number,
  season: number,
): Promise<any[]> {
  const data = await client.get("/players/statistics", {
    id: playerId,
    season,
  });
  if (!data?.response) return [];
  return data.response;
}

// ─── Normalizers ────────────────────────────────────────────────────────────

function normalizeFootballLeague(raw: any): League {
  const lg = raw.league || raw;
  const seasons: number[] = [];
  if (raw.seasons) {
    for (const s of raw.seasons) {
      if (s.year) seasons.push(s.year);
    }
  }
  return {
    id: `fb_${lg.id}`,
    sport: "football",
    apiId: lg.id,
    name: lg.name || "",
    country: lg.country?.name || raw.country?.name || lg.country || "",
    type: lg.type || null,
    logo: lg.logo || null,
    seasons,
  };
}

function normalizeFootballTeam(
  raw: any,
  leagueId: string,
  season: number,
): Team {
  const t = raw.team || raw;
  const v = raw.venue;
  return {
    id: `fb_team_${t.id}`,
    sport: "football",
    apiId: t.id,
    name: t.name || "",
    shortName: t.code || null,
    logo: t.logo || null,
    country: t.country || null,
    leagueId,
    season,
    founded: t.founded || null,
    venue: v?.name || null,
  };
}

function normalizeFootballPlayer(raw: any): {
  player: Player;
  pts: PlayerTeamSeason[];
  discoveredTeams: Team[];
} {
  const p = raw.player || raw;
  const player: Player = {
    id: `fb_player_${p.id}`,
    sport: "football",
    apiId: p.id,
    name: p.name || "",
    firstName: p.firstname || null,
    lastName: p.lastname || null,
    nationality: p.nationality || null,
    birthDate: p.birth?.date || null,
    birthCountry: p.birth?.country || null,
    age: p.age || null,
    height: p.height || null,
    weight: p.weight || null,
    position: null, // set from statistics
    photo: p.photo || null,
    injured: p.injured || false,
  };

  const pts: PlayerTeamSeason[] = [];
  const discoveredTeams: Team[] = [];
  if (raw.statistics) {
    for (const stat of raw.statistics) {
      const teamId = stat.team?.id;
      const leagueId = stat.league?.id;
      const season = stat.league?.season;
      if (!teamId || !leagueId) continue;

      const position = stat.games?.position || null;
      if (!player.position && position) {
        player.position = position;
      }

      // Capture team stub from API response to fix FK gaps
      if (stat.team?.name) {
        discoveredTeams.push({
          id: `fb_team_${teamId}`,
          sport: "football",
          apiId: teamId,
          name: stat.team.name,
          shortName: null,
          logo: stat.team.logo || null,
          country: null,
          leagueId: `fb_${leagueId}`,
          season: season || 0,
          founded: null,
          venue: null,
        });
      }

      pts.push({
        id: `fb_player_${p.id}_team_${teamId}_${season}`,
        playerId: `fb_player_${p.id}`,
        teamId: `fb_team_${teamId}`,
        leagueId: `fb_${leagueId}`,
        season: season || 0,
        position,
        appearances: stat.games?.appearences ?? null,
        minutes: stat.games?.minutes ?? null,
        goals: stat.goals?.total ?? null,
        assists: stat.goals?.assists ?? null,
        cardsYellow: stat.cards?.yellow ?? null,
        cardsRed: stat.cards?.red ?? null,
        rating: stat.games?.rating ?? null,
        points: null,
        rebounds: null,
        steals: null,
        blocks: null,
      });
    }
  }

  return { player, pts, discoveredTeams };
}

function normalizeFootballTrophy(
  playerId: string,
  raw: any,
): PlayerTrophy {
  return {
    id: `${playerId}_${sanitizeCacheKey(raw.league || "unknown")}_${raw.season || "unknown"}`,
    sport: "football",
    playerId,
    trophyName: raw.league || raw.trophy || "",
    league: raw.league || "",
    country: raw.country || null,
    season: raw.season || "",
    place: raw.place || "",
  };
}

function normalizeFootballTransfer(
  playerId: string,
  raw: any,
): PlayerTransfer {
  const teamIn = raw.teams?.in || {};
  const teamOut = raw.teams?.out || {};
  const date = raw.date || "";
  return {
    id: `${playerId}_${sanitizeCacheKey(date)}_${teamIn.id || "unknown"}`,
    sport: "football",
    playerId,
    date,
    fromTeamId: teamOut.id ? `fb_team_${teamOut.id}` : null,
    fromTeamName: teamOut.name || "",
    toTeamId: teamIn.id ? `fb_team_${teamIn.id}` : null,
    toTeamName: teamIn.name || "",
    type: raw.type || "N/A",
  };
}

function normalizeFootballFixture(raw: any): {
  fixture: Fixture;
  participants: FixtureParticipant[];
} {
  const f = raw.fixture || {};
  const teams = raw.teams || {};
  const goals = raw.goals || {};
  const league = raw.league || {};

  const fixture: Fixture = {
    id: `fb_fixture_${f.id}`,
    sport: "football",
    apiId: f.id,
    leagueId: league.id ? `fb_${league.id}` : "",
    season: league.season || 0,
    date: f.date || "",
    round: league.round || null,
    status: f.status?.short || "",
    homeTeamId: teams.home?.id ? `fb_team_${teams.home.id}` : "",
    awayTeamId: teams.away?.id ? `fb_team_${teams.away.id}` : "",
    homeGoals: goals.home ?? null,
    awayGoals: goals.away ?? null,
  };

  // Extract lineup participants if available
  const participants: FixtureParticipant[] = [];
  if (raw.lineups) {
    for (const lineup of raw.lineups) {
      const teamId = lineup.team?.id ? `fb_team_${lineup.team.id}` : "";
      if (lineup.startXI) {
        for (const entry of lineup.startXI) {
          const pl = entry.player || entry;
          if (pl.id) {
            participants.push({
              id: `fb_fixture_${f.id}_${pl.id}_${teamId}`,
              fixtureId: `fb_fixture_${f.id}`,
              playerId: `fb_player_${pl.id}`,
              teamId,
              isStarter: true,
              minutesPlayed: null,
            });
          }
        }
      }
      if (lineup.substitutes) {
        for (const entry of lineup.substitutes) {
          const pl = entry.player || entry;
          if (pl.id) {
            participants.push({
              id: `fb_fixture_${f.id}_${pl.id}_${teamId}`,
              fixtureId: `fb_fixture_${f.id}`,
              playerId: `fb_player_${pl.id}`,
              teamId,
              isStarter: false,
              minutesPlayed: null,
            });
          }
        }
      }
    }
  }

  return { fixture, participants };
}

function normalizeFootballStanding(
  raw: any,
  leagueId: string,
  season: number,
): StatFact[] {
  const facts: StatFact[] = [];
  if (!raw.team?.id) return facts;

  const teamId = `fb_team_${raw.team.id}`;
  const teamName = raw.team.name || "";
  const ctx = `league:${leagueId}`;

  const statMappings: [string, any][] = [
    ["points", raw.points],
    ["wins", raw.all?.win],
    ["draws", raw.all?.draw],
    ["losses", raw.all?.lose],
    ["goalsFor", raw.all?.goals?.for],
    ["goalsAgainst", raw.all?.goals?.against],
    ["goalDifference", raw.goalsDiff],
    ["rank", raw.rank],
  ];

  for (const [key, val] of statMappings) {
    if (val != null && typeof val === "number") {
      facts.push({
        id: `${teamId}_${key}_${leagueId}_${season}`,
        sport: "football",
        entityType: "team",
        entityId: teamId,
        entityName: teamName,
        statKey: key,
        contextKey: ctx,
        value: val,
        season,
      });
    }
  }

  return facts;
}

// --- NBA Normalizers ---

function normalizeNbaTeam(raw: any, season: number): Team {
  return {
    id: `nba_team_${raw.id}`,
    sport: "nba",
    apiId: raw.id,
    name: raw.name || "",
    shortName: raw.code || raw.nickname || null,
    logo: raw.logo || null,
    country: raw.conference || null,
    leagueId: "nba_standard",
    season,
    founded: null,
    venue: null,
  };
}

function normalizeNbaPlayer(raw: any): Player {
  // NBA API height is sometimes in feet-inches format
  let height: string | null = null;
  if (raw.height?.fpiValue) {
    height = raw.height.fpiValue;
  } else if (raw.height?.fpiValue === undefined && raw.height?.meters) {
    height = `${raw.height.meters}m`;
  }

  let weight: string | null = null;
  if (raw.weight?.kilograms) {
    weight = `${raw.weight.kilograms}kg`;
  } else if (raw.weight?.pounds) {
    const kg = Math.round(parseFloat(raw.weight.pounds) * 0.453592);
    weight = `${kg}kg`;
  }

  return {
    id: `nba_player_${raw.id}`,
    sport: "nba",
    apiId: raw.id,
    name: `${raw.firstname || ""} ${raw.lastname || ""}`.trim(),
    firstName: raw.firstname || null,
    lastName: raw.lastname || null,
    nationality: raw.birth?.country || null,
    birthDate: raw.birth?.date || null,
    birthCountry: raw.birth?.country || null,
    age: null,
    height,
    weight,
    position: raw.leagues?.standard?.pos || null,
    photo: null,
    injured: false,
  };
}

function normalizeNbaPlayerStats(
  playerId: string,
  raw: any[],
  season: number,
): PlayerTeamSeason[] {
  const ptsList: PlayerTeamSeason[] = [];

  for (const stat of raw) {
    const teamId = stat.team?.id;
    if (!teamId) continue;

    ptsList.push({
      id: `nba_player_${playerId}_team_${teamId}_${season}`,
      playerId: `nba_player_${playerId}`,
      teamId: `nba_team_${teamId}`,
      leagueId: "nba_standard",
      season,
      position: stat.pos || null,
      appearances: stat.game ? 1 : null,
      minutes: stat.min ? parseInt(stat.min, 10) || null : null,
      goals: null,
      assists: stat.assists ?? null,
      cardsYellow: null,
      cardsRed: null,
      rating: null,
      points: stat.points ?? null,
      rebounds: stat.totReb ?? null,
      steals: stat.steals ?? null,
      blocks: stat.blocks ?? null,
    });
  }

  return ptsList;
}

function normalizeNbaStanding(
  raw: any,
  season: number,
): StatFact[] {
  const facts: StatFact[] = [];
  const team = raw.team || {};
  if (!team.id) return facts;

  const teamId = `nba_team_${team.id}`;
  const teamName = team.name || team.nickname || "";
  const ctx = "league:nba_standard";

  const mappings: [string, any][] = [
    ["wins", raw.win?.total],
    ["losses", raw.loss?.total],
    ["winPct", raw.win?.percentage ? parseFloat(raw.win.percentage) : null],
    ["streak", raw.streak],
  ];

  for (const [key, val] of mappings) {
    if (val != null && typeof val === "number") {
      facts.push({
        id: `${teamId}_${key}_nba_standard_${season}`,
        sport: "nba",
        entityType: "team",
        entityId: teamId,
        entityName: teamName,
        statKey: key,
        contextKey: ctx,
        value: val,
        season,
      });
    }
  }

  return facts;
}

// ─── Index Builders ─────────────────────────────────────────────────────────

function buildGridIndex(
  players: Player[],
  ptsList: PlayerTeamSeason[],
  teams: Team[],
  trophies: PlayerTrophy[],
): GridIndexEntry[] {
  // Build lookup maps
  const playerToTeams = new Map<string, Set<string>>();
  const playerToLeagues = new Map<string, Set<string>>();
  const playerToNationality = new Map<string, string>();
  const playerToPosition = new Map<string, string>();
  const playerToTrophies = new Map<string, Set<string>>();
  const teamNames = new Map<string, string>();
  const leagueNames = new Map<string, string>();

  for (const t of teams) {
    teamNames.set(t.id, t.name);
  }

  for (const p of players) {
    if (p.nationality) playerToNationality.set(p.id, p.nationality);
    if (p.position) playerToPosition.set(p.id, p.position);
  }

  for (const pts of ptsList) {
    if (!playerToTeams.has(pts.playerId))
      playerToTeams.set(pts.playerId, new Set());
    playerToTeams.get(pts.playerId)!.add(pts.teamId);

    if (!playerToLeagues.has(pts.playerId))
      playerToLeagues.set(pts.playerId, new Set());
    playerToLeagues.get(pts.playerId)!.add(pts.leagueId);
  }

  for (const t of trophies) {
    if (t.place?.toLowerCase() === "winner") {
      if (!playerToTrophies.has(t.playerId))
        playerToTrophies.set(t.playerId, new Set());
      playerToTrophies.get(t.playerId)!.add(t.trophyName);
    }
  }

  // Collect unique axis values
  const allTeamIds = new Set<string>();
  const allNationalities = new Set<string>();
  const allPositions = new Set<string>();

  for (const [, teamSet] of playerToTeams) {
    for (const t of teamSet) allTeamIds.add(t);
  }
  for (const [, nat] of playerToNationality) allNationalities.add(nat);
  for (const [, pos] of playerToPosition) allPositions.add(pos);

  const entries: GridIndexEntry[] = [];
  const playerIds = players.map((p) => p.id);

  function findIntersection(
    filterA: (pid: string) => boolean,
    filterB: (pid: string) => boolean,
  ): string[] {
    return playerIds.filter((pid) => filterA(pid) && filterB(pid));
  }

  function difficultyFromCount(count: number): "easy" | "medium" | "hard" {
    if (count >= 6) return "easy";
    if (count >= 3) return "medium";
    return "hard";
  }

  // Team × Nationality
  for (const teamId of allTeamIds) {
    const tName = teamNames.get(teamId) || teamId;
    for (const nat of allNationalities) {
      const pids = findIntersection(
        (pid) => playerToTeams.get(pid)?.has(teamId) === true,
        (pid) => playerToNationality.get(pid) === nat,
      );
      if (pids.length > 0) {
        entries.push({
          id: `grid_team_${teamId}_nat_${sanitizeCacheKey(nat)}`,
          sport: players[0]?.sport || "football",
          rowType: "team",
          rowKey: teamId,
          rowLabel: tName,
          colType: "nationality",
          colKey: nat,
          colLabel: nat,
          playerIds: pids,
          difficulty: difficultyFromCount(pids.length),
        });
      }
    }
  }

  // Team × Position
  for (const teamId of allTeamIds) {
    const tName = teamNames.get(teamId) || teamId;
    for (const pos of allPositions) {
      const pids = findIntersection(
        (pid) => playerToTeams.get(pid)?.has(teamId) === true,
        (pid) => playerToPosition.get(pid) === pos,
      );
      if (pids.length > 0) {
        entries.push({
          id: `grid_team_${teamId}_pos_${sanitizeCacheKey(pos)}`,
          sport: players[0]?.sport || "football",
          rowType: "team",
          rowKey: teamId,
          rowLabel: tName,
          colType: "position",
          colKey: pos,
          colLabel: pos,
          playerIds: pids,
          difficulty: difficultyFromCount(pids.length),
        });
      }
    }
  }

  // Nationality × Position
  for (const nat of allNationalities) {
    for (const pos of allPositions) {
      const pids = findIntersection(
        (pid) => playerToNationality.get(pid) === nat,
        (pid) => playerToPosition.get(pid) === pos,
      );
      if (pids.length > 0) {
        entries.push({
          id: `grid_nat_${sanitizeCacheKey(nat)}_pos_${sanitizeCacheKey(pos)}`,
          sport: players[0]?.sport || "football",
          rowType: "nationality",
          rowKey: nat,
          rowLabel: nat,
          colType: "position",
          colKey: pos,
          colLabel: pos,
          playerIds: pids,
          difficulty: difficultyFromCount(pids.length),
        });
      }
    }
  }

  // Team × Team (players who played for both)
  const teamArr = Array.from(allTeamIds);
  for (let i = 0; i < teamArr.length; i++) {
    for (let j = i + 1; j < teamArr.length; j++) {
      const tA = teamArr[i];
      const tB = teamArr[j];
      const pids = findIntersection(
        (pid) => playerToTeams.get(pid)?.has(tA) === true,
        (pid) => playerToTeams.get(pid)?.has(tB) === true,
      );
      if (pids.length > 0) {
        entries.push({
          id: `grid_team_${tA}_team_${tB}`,
          sport: players[0]?.sport || "football",
          rowType: "team",
          rowKey: tA,
          rowLabel: teamNames.get(tA) || tA,
          colType: "team",
          colKey: tB,
          colLabel: teamNames.get(tB) || tB,
          playerIds: pids,
          difficulty: difficultyFromCount(pids.length),
        });
      }
    }
  }

  console.log(`  Built ${entries.length} grid index entries`);
  return entries;
}

function buildStatFacts(
  players: Player[],
  ptsList: PlayerTeamSeason[],
  trophies: PlayerTrophy[],
  existingTeamFacts: StatFact[],
): StatFact[] {
  const facts: StatFact[] = [...existingTeamFacts];

  // Aggregate player stats per season
  for (const pts of ptsList) {
    const player = players.find((p) => p.id === pts.playerId);
    if (!player) continue;

    const ctx = `league:${pts.leagueId}`;

    if (pts.goals != null) {
      facts.push({
        id: `${pts.playerId}_goals_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "goals",
        contextKey: ctx,
        value: pts.goals,
        season: pts.season,
      });
    }

    if (pts.assists != null) {
      facts.push({
        id: `${pts.playerId}_assists_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "assists",
        contextKey: ctx,
        value: pts.assists,
        season: pts.season,
      });
    }

    if (pts.appearances != null) {
      facts.push({
        id: `${pts.playerId}_appearances_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "appearances",
        contextKey: ctx,
        value: pts.appearances,
        season: pts.season,
      });
    }

    if (pts.minutes != null) {
      facts.push({
        id: `${pts.playerId}_minutes_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "minutes",
        contextKey: ctx,
        value: pts.minutes,
        season: pts.season,
      });
    }

    if (pts.cardsYellow != null) {
      facts.push({
        id: `${pts.playerId}_cardsYellow_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "cardsYellow",
        contextKey: ctx,
        value: pts.cardsYellow,
        season: pts.season,
      });
    }

    // NBA-specific
    if (pts.points != null) {
      facts.push({
        id: `${pts.playerId}_points_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "points",
        contextKey: ctx,
        value: pts.points,
        season: pts.season,
      });
    }

    if (pts.rebounds != null) {
      facts.push({
        id: `${pts.playerId}_rebounds_${pts.leagueId}_${pts.season}`,
        sport: player.sport,
        entityType: "player",
        entityId: pts.playerId,
        entityName: player.name,
        statKey: "rebounds",
        contextKey: ctx,
        value: pts.rebounds,
        season: pts.season,
      });
    }
  }

  // Trophy count per player
  const trophyCounts = new Map<string, number>();
  for (const t of trophies) {
    if (t.place?.toLowerCase() === "winner") {
      trophyCounts.set(t.playerId, (trophyCounts.get(t.playerId) || 0) + 1);
    }
  }

  for (const [playerId, count] of trophyCounts) {
    const player = players.find((p) => p.id === playerId);
    if (!player) continue;
    facts.push({
      id: `${playerId}_trophies_career`,
      sport: player.sport,
      entityType: "player",
      entityId: playerId,
      entityName: player.name,
      statKey: "trophies",
      contextKey: "career",
      value: count,
      season: null,
    });
  }

  console.log(`  Built ${facts.length} stat facts`);
  return facts;
}

function buildWhoAmIClues(
  players: Player[],
  ptsList: PlayerTeamSeason[],
  teams: Team[],
  trophies: PlayerTrophy[],
  transfers: PlayerTransfer[],
): WhoAmIClue[] {
  const clues: WhoAmIClue[] = [];
  const teamNames = new Map<string, string>();
  for (const t of teams) teamNames.set(t.id, t.name);

  // Build per-player data
  const playerPts = new Map<string, PlayerTeamSeason[]>();
  for (const pts of ptsList) {
    if (!playerPts.has(pts.playerId)) playerPts.set(pts.playerId, []);
    playerPts.get(pts.playerId)!.push(pts);
  }

  const playerTrophies = new Map<string, PlayerTrophy[]>();
  for (const t of trophies) {
    if (!playerTrophies.has(t.playerId)) playerTrophies.set(t.playerId, []);
    playerTrophies.get(t.playerId)!.push(t);
  }

  const playerTransfers = new Map<string, PlayerTransfer[]>();
  for (const t of transfers) {
    if (!playerTransfers.has(t.playerId))
      playerTransfers.set(t.playerId, []);
    playerTransfers.get(t.playerId)!.push(t);
  }

  // Sort players by total appearances for difficulty assignment
  const playerAppearances = new Map<string, number>();
  for (const [pid, ptArr] of playerPts) {
    const total = ptArr.reduce((sum, pt) => sum + (pt.appearances || 0), 0);
    playerAppearances.set(pid, total);
  }

  const sortedPlayerIds = [...playerAppearances.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  for (const player of players) {
    const pts = playerPts.get(player.id) || [];
    const troph = playerTrophies.get(player.id) || [];
    const trans = playerTransfers.get(player.id) || [];

    // Need at least some data to make clues
    if (pts.length === 0) continue;

    // Clue 1: Nationality + position
    const clue1Parts: string[] = [];
    if (player.nationality) clue1Parts.push(`I am from ${player.nationality}`);
    if (player.position) clue1Parts.push(`I play as a ${player.position}`);
    if (clue1Parts.length === 0) continue;
    const clue1 = clue1Parts.join(". ") + ".";

    // Clue 2: Teams played for (2-4 clubs, excluding most recent if possible)
    const teamIds = [...new Set(pts.map((p) => p.teamId))];
    const teamLabels = teamIds
      .map((tid) => teamNames.get(tid) || tid)
      .filter(Boolean);
    let clue2 = "";
    if (teamLabels.length >= 2) {
      const displayed = teamLabels.slice(0, 4);
      clue2 = `I have played for ${displayed.join(", ")}.`;
    } else if (teamLabels.length === 1) {
      clue2 = `I have played for ${teamLabels[0]}.`;
    } else {
      clue2 = `I have played in ${pts.length} season(s).`;
    }

    // Clue 3: Trophies / achievements
    const wins = troph.filter(
      (t) => t.place?.toLowerCase() === "winner",
    );
    let clue3 = "";
    if (wins.length > 0) {
      const topTrophies = wins.slice(0, 3).map((t) => t.trophyName);
      clue3 = `I have won ${wins.length} trophy/trophies, including ${topTrophies.join(", ")}.`;
    } else {
      // Fallback: notable stats
      const totalGoals = pts.reduce(
        (sum, p) => sum + (p.goals || 0),
        0,
      );
      const totalApps = pts.reduce(
        (sum, p) => sum + (p.appearances || 0),
        0,
      );
      if (totalGoals > 0) {
        clue3 = `I have scored ${totalGoals} goals across ${totalApps} appearances.`;
      } else if (pts[0]?.points != null) {
        const totalPts = pts.reduce(
          (sum, p) => sum + (p.points || 0),
          0,
        );
        clue3 = `I have accumulated ${totalPts} points.`;
      } else {
        clue3 = `I have made ${totalApps} appearances in my career.`;
      }
    }

    // Clue 4: Transfer history or specific team + era
    let clue4 = "";
    if (trans.length > 0) {
      const recent = trans.slice(0, 2);
      const parts = recent.map(
        (t) => `${t.fromTeamName} to ${t.toTeamName}`,
      );
      clue4 = `My transfers include: ${parts.join("; ")}.`;
    } else if (player.firstName) {
      clue4 = `My first name is ${player.firstName}.`;
    } else {
      clue4 = `I currently play in the ${teamLabels[teamLabels.length - 1] || "top division"}.`;
    }

    // Difficulty based on ranking
    const rank = sortedPlayerIds.indexOf(player.id);
    let difficulty: "easy" | "medium" | "hard" = "hard";
    if (rank >= 0 && rank < 100) difficulty = "easy";
    else if (rank >= 100 && rank < 500) difficulty = "medium";

    clues.push({
      id: `whoami_${player.id}`,
      sport: player.sport,
      playerId: player.id,
      clue1,
      clue2,
      clue3,
      clue4,
      answerName: player.name,
      difficulty,
    });
  }

  console.log(`  Built ${clues.length} Who Am I clue sets`);
  return clues;
}

// ─── Persistence ────────────────────────────────────────────────────────────

function persistTable<T extends { id: string }>(
  tableName: string,
  records: T[],
): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, `${tableName}.json`);

  // Load existing records and merge (upsert by id)
  let existing: T[] = [];
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      existing = [];
    }
  }

  const byId = new Map<string, T>();
  for (const rec of existing) byId.set(rec.id, rec);
  for (const rec of records) byId.set(rec.id, rec);

  const merged = Array.from(byId.values());
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  console.log(
    `  Persisted ${tableName}: ${records.length} new/updated, ${merged.length} total`,
  );
}

function loadTable<T>(tableName: string): T[] {
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return [];
  }
}

// --- Pipeline State ---

function createFreshState(): PipelineState {
  const phases: Record<PhaseName, PhaseState> = {} as any;
  const names: PhaseName[] = [
    "footballLeagues",
    "footballTeams",
    "footballTopScorers",
    "footballTopAssists",
    "footballSquadPlayers",
    "footballTrophies",
    "footballTransfers",
    "footballFixtures",
    "footballTeamStats",
    "footballStandings",
    "nbaTeams",
    "nbaStandings",
    "nbaPlayers",
    "nbaStats",
    "indexBuilding",
  ];
  for (const name of names) {
    phases[name] = { status: "pending", lastKey: null, processedKeys: [] };
  }
  return {
    version: 2,
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    footballCallsUsed: 0,
    nbaCallsUsed: 0,
    phases,
  };
}

function loadPipelineState(): PipelineState | null {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
    if (data.version !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

function savePipelineState(state: PipelineState): void {
  ensureDir(DATA_DIR);
  state.lastUpdatedAt = new Date().toISOString();
  const tmp = STATE_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, STATE_PATH);
}

// ─── Pipeline Orchestrator ──────────────────────────────────────────────────

async function runPipeline(
  config: PipelineConfig,
  flags: PipelineFlags,
): Promise<void> {
  console.log("\n=== VerveQ Sports Data Pipeline ===\n");
  console.log(`Mode: ${flags.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(`Resume: ${flags.resume}`);
  console.log(`Sport filter: ${flags.sportFilter}`);

  // Load or create state
  let state: PipelineState;
  if (flags.resume) {
    const loaded = loadPipelineState();
    if (loaded) {
      state = loaded;
      console.log(`Resumed from state (started ${state.startedAt})`);
    } else {
      state = createFreshState();
      console.log("No resume state found, starting fresh");
    }
  } else {
    state = createFreshState();
    // Clear stale data files so persistTable starts clean
    if (!flags.dryRun && fs.existsSync(DATA_DIR)) {
      for (const f of fs.readdirSync(DATA_DIR)) {
        if (f.endsWith(".json") && !f.startsWith(".")) {
          fs.unlinkSync(path.join(DATA_DIR, f));
        }
      }
      console.log("Cleared stale data files for fresh run");
    }
  }

  // Create API clients
  const authMode =
    (process.env.AUTH_MODE as "apisports" | "rapidapi") || "apisports";

  const fbBudget = new BudgetTracker(
    "football",
    config.football.dailyBudget,
    config.football.reserveBudget,
  );
  fbBudget.callsUsed = state.footballCallsUsed;

  const nbaBudget = new BudgetTracker(
    "nba",
    config.nba.dailyBudget,
    config.nba.reserveBudget,
  );
  nbaBudget.callsUsed = state.nbaCallsUsed;

  const fbClient = new ApiClient({
    sport: "football",
    baseUrl: FOOTBALL_BASE_URL,
    apiKey: process.env.API_FOOTBALL_KEY || "",
    authMode,
    rateLimitMs: config.football.rateLimitMs,
    budget: fbBudget,
    dryRun: flags.dryRun,
  });

  const nbaClient = new ApiClient({
    sport: "nba",
    baseUrl: NBA_BASE_URL,
    apiKey: process.env.NBA_API_KEY || process.env.API_FOOTBALL_KEY || "",
    authMode: "apisports", // NBA always uses apisports header
    rateLimitMs: config.nba.rateLimitMs,
    budget: nbaBudget,
    dryRun: flags.dryRun,
  });

  // Collected data (in-memory during run, persisted after each phase)
  let allLeagues: League[] = [];
  let allTeams: Team[] = [];
  let allPlayers: Player[] = [];
  let allPts: PlayerTeamSeason[] = [];
  let allTrophies: PlayerTrophy[] = [];
  let allTransfers: PlayerTransfer[] = [];
  let allFixtures: Fixture[] = [];
  let allFixtureParticipants: FixtureParticipant[] = [];
  let allStatFacts: StatFact[] = [];

  // ─── FOOTBALL PHASES ───

  const runFootball =
    config.football.enabled &&
    (flags.sportFilter === "all" || flags.sportFilter === "football");

  if (runFootball) {
    // Phase 1: Leagues
    if (state.phases.footballLeagues.status !== "completed") {
      console.log("\n--- Phase 1: Football Leagues ---");
      state.phases.footballLeagues.status = "in_progress";
      savePipelineState(state);

      for (const lc of config.football.leagues) {
        const key = `league_${lc.id}`;
        if (state.phases.footballLeagues.processedKeys.includes(key)) continue;

        const raw = await fetchFootballLeague(fbClient, lc.id);
        if (raw) {
          allLeagues.push(normalizeFootballLeague(raw));
        }

        state.phases.footballLeagues.processedKeys.push(key);
        state.phases.footballLeagues.lastKey = key;
        state.footballCallsUsed = fbBudget.callsUsed;
        savePipelineState(state);
      }

      if (!flags.dryRun) persistTable("leagues", allLeagues);
      state.phases.footballLeagues.status = "completed";
      savePipelineState(state);
    } else {
      allLeagues = loadTable<League>("leagues");
    }

    // Phase 2: Teams
    if (state.phases.footballTeams.status !== "completed") {
      console.log("\n--- Phase 2: Football Teams ---");
      state.phases.footballTeams.status = "in_progress";
      savePipelineState(state);

      for (const lc of config.football.leagues) {
        for (const season of config.football.seasons) {
          const key = `teams_${lc.id}_${season}`;
          if (state.phases.footballTeams.processedKeys.includes(key)) continue;

          const rawTeams = await fetchFootballTeams(fbClient, lc.id, season);
          for (const rt of rawTeams) {
            allTeams.push(normalizeFootballTeam(rt, `fb_${lc.id}`, season));
          }

          state.phases.footballTeams.processedKeys.push(key);
          state.phases.footballTeams.lastKey = key;
          state.footballCallsUsed = fbBudget.callsUsed;
          savePipelineState(state);
        }
      }

      if (!flags.dryRun) persistTable("teams", allTeams);
      state.phases.footballTeams.status = "completed";
      savePipelineState(state);
    } else {
      allTeams = loadTable<Team>("teams");
    }

    // Phase 3a: Top Scorers
    if (state.phases.footballTopScorers.status !== "completed") {
      console.log("\n--- Phase 3a: Football Top Scorers ---");
      state.phases.footballTopScorers.status = "in_progress";
      savePipelineState(state);

      for (const lc of config.football.leagues) {
        const seasons = lc.topPlayerSeasons || config.football.topPlayerSeasons;
        for (const season of seasons) {
          const key = `topscorers_${lc.id}_${season}`;
          if (state.phases.footballTopScorers.processedKeys.includes(key)) continue;

          if (!fbBudget.canMakeCall() && !flags.dryRun) {
            console.warn(`  Budget exhausted, stopping top scorers phase`);
            break;
          }

          console.log(`  Top scorers: ${lc.name} ${season}...`);
          const rawPlayers = await fetchTopScorers(fbClient, lc.id, season);

          for (const rp of rawPlayers) {
            const { player, pts, discoveredTeams } = normalizeFootballPlayer(rp);
            allPlayers.push(player);
            allPts.push(...pts);
            allTeams.push(...discoveredTeams);
          }

          state.phases.footballTopScorers.processedKeys.push(key);
          state.phases.footballTopScorers.lastKey = key;
          state.footballCallsUsed = fbBudget.callsUsed;
          savePipelineState(state);
        }
      }

      state.phases.footballTopScorers.status = "completed";
      savePipelineState(state);
    }

    // Phase 3b: Top Assists
    if (state.phases.footballTopAssists.status !== "completed") {
      console.log("\n--- Phase 3b: Football Top Assists ---");
      state.phases.footballTopAssists.status = "in_progress";
      savePipelineState(state);

      for (const lc of config.football.leagues) {
        const seasons = lc.topPlayerSeasons || config.football.topPlayerSeasons;
        for (const season of seasons) {
          const key = `topassists_${lc.id}_${season}`;
          if (state.phases.footballTopAssists.processedKeys.includes(key)) continue;

          if (!fbBudget.canMakeCall() && !flags.dryRun) {
            console.warn(`  Budget exhausted, stopping top assists phase`);
            break;
          }

          console.log(`  Top assists: ${lc.name} ${season}...`);
          const rawPlayers = await fetchTopAssists(fbClient, lc.id, season);

          for (const rp of rawPlayers) {
            const { player, pts, discoveredTeams } = normalizeFootballPlayer(rp);
            allPlayers.push(player);
            allPts.push(...pts);
            allTeams.push(...discoveredTeams);
          }

          state.phases.footballTopAssists.processedKeys.push(key);
          state.phases.footballTopAssists.lastKey = key;
          state.footballCallsUsed = fbBudget.callsUsed;
          savePipelineState(state);
        }
      }

      state.phases.footballTopAssists.status = "completed";
      savePipelineState(state);
    }

    // Phase 3c: Squad Players (domestic leagues only, recent seasons)
    if (state.phases.footballSquadPlayers.status !== "completed") {
      console.log("\n--- Phase 3c: Football Squad Players ---");
      state.phases.footballSquadPlayers.status = "in_progress";
      savePipelineState(state);

      let budgetExhausted = false;

      for (const domesticId of config.football.domesticLeagueIds) {
        if (budgetExhausted) break;
        for (const season of config.football.squadSeasons) {
          if (budgetExhausted) break;

          // Get teams for this league-season from allTeams
          const leagueTeams = allTeams.filter(
            (t) => t.leagueId === `fb_${domesticId}` && t.season === season,
          );

          for (const team of leagueTeams) {
            if (budgetExhausted) break;
            const key = `squad_${team.apiId}_${season}`;
            if (state.phases.footballSquadPlayers.processedKeys.includes(key)) continue;

            if (!fbBudget.canMakeCall() && !flags.dryRun) {
              console.warn(`  Budget exhausted, stopping squad players phase`);
              budgetExhausted = true;
              break;
            }

            console.log(`  Squad: ${team.name} ${season}...`);
            const rawPlayers = await fetchPlayersByTeam(fbClient, team.apiId, season);

            for (const rp of rawPlayers) {
              const { player, pts, discoveredTeams } = normalizeFootballPlayer(rp);
              allPlayers.push(player);
              allPts.push(...pts);
              allTeams.push(...discoveredTeams);
            }

            state.phases.footballSquadPlayers.processedKeys.push(key);
            state.phases.footballSquadPlayers.lastKey = key;
            state.footballCallsUsed = fbBudget.callsUsed;
            savePipelineState(state);
          }
        }
      }

      if (!budgetExhausted) {
        state.phases.footballSquadPlayers.status = "completed";
      }
      savePipelineState(state);
    }

    // Deduplicate players by id and persist after all player phases
    {
      // Only merge with existing files on resume (fresh runs start clean)
      if (flags.resume) {
        const existingPlayers = loadTable<Player>("players");
        const existingPts = loadTable<PlayerTeamSeason>("playerTeamSeason");
        allPlayers.push(...existingPlayers);
        allPts.push(...existingPts);
      }

      const playerMap = new Map<string, Player>();
      for (const p of allPlayers) playerMap.set(p.id, p);
      allPlayers = Array.from(playerMap.values());

      const ptsMap = new Map<string, PlayerTeamSeason>();
      for (const p of allPts) ptsMap.set(p.id, p);
      allPts = Array.from(ptsMap.values());

      // Dedup teams: prefer Phase 2 entries (have founded/venue/country) over stubs
      const teamMap = new Map<string, Team>();
      for (const t of allTeams) {
        const existing = teamMap.get(t.id);
        if (!existing || (t.founded != null && existing.founded == null)) {
          teamMap.set(t.id, t);
        }
      }
      allTeams = Array.from(teamMap.values());

      if (!flags.dryRun) {
        persistTable("players", allPlayers);
        persistTable("playerTeamSeason", allPts);
        persistTable("teams", allTeams);
      }
    }

    // Phase 4: Trophies (curated subset)
    if (
      config.football.fetchTrophies &&
      state.phases.footballTrophies.status !== "completed"
    ) {
      console.log("\n--- Phase 4: Football Trophies ---");
      state.phases.footballTrophies.status = "in_progress";
      savePipelineState(state);

      const enrichLimit = config.football.enrichmentCount || config.football.topPlayersForEnrichment;
      const topPlayers = calculateFameScores(allPts, enrichLimit);

      for (const [playerId] of topPlayers) {
        const key = `trophies_${playerId}`;
        if (state.phases.footballTrophies.processedKeys.includes(key)) continue;

        if (!fbBudget.canMakeCall() && !flags.dryRun) {
          console.warn("  Budget exhausted, stopping trophies phase");
          break;
        }

        const apiId = parseInt(playerId.replace("fb_player_", ""), 10);
        const rawTrophies = await fetchFootballTrophies(fbClient, apiId);

        for (const rt of rawTrophies) {
          allTrophies.push(normalizeFootballTrophy(playerId, rt));
        }

        state.phases.footballTrophies.processedKeys.push(key);
        state.phases.footballTrophies.lastKey = key;
        state.footballCallsUsed = fbBudget.callsUsed;
        savePipelineState(state);
      }

      if (!flags.dryRun) persistTable("playerTrophies", allTrophies);
      state.phases.footballTrophies.status = "completed";
      savePipelineState(state);
    } else if (state.phases.footballTrophies.status === "completed") {
      allTrophies = loadTable<PlayerTrophy>("playerTrophies");
    }

    // Phase 5: Transfers (curated subset)
    if (
      config.football.fetchTransfers &&
      state.phases.footballTransfers.status !== "completed"
    ) {
      console.log("\n--- Phase 5: Football Transfers ---");
      state.phases.footballTransfers.status = "in_progress";
      savePipelineState(state);

      const enrichLimit = config.football.enrichmentCount || config.football.topPlayersForEnrichment;
      const topPlayers = calculateFameScores(allPts, enrichLimit);

      for (const [playerId] of topPlayers) {
        const key = `transfers_${playerId}`;
        if (state.phases.footballTransfers.processedKeys.includes(key))
          continue;

        if (!fbBudget.canMakeCall() && !flags.dryRun) {
          console.warn("  Budget exhausted, stopping transfers phase");
          break;
        }

        const apiId = parseInt(playerId.replace("fb_player_", ""), 10);
        const rawTransfers = await fetchFootballTransfers(fbClient, apiId);

        for (const rt of rawTransfers) {
          allTransfers.push(normalizeFootballTransfer(playerId, rt));
        }

        state.phases.footballTransfers.processedKeys.push(key);
        state.phases.footballTransfers.lastKey = key;
        state.footballCallsUsed = fbBudget.callsUsed;
        savePipelineState(state);
      }

      if (!flags.dryRun) persistTable("playerTransfers", allTransfers);
      state.phases.footballTransfers.status = "completed";
      savePipelineState(state);
    } else if (state.phases.footballTransfers.status === "completed") {
      allTransfers = loadTable<PlayerTransfer>("playerTransfers");
    }

    // Phase 6: Fixtures (if enabled)
    if (
      config.football.fetchFixtures &&
      state.phases.footballFixtures.status !== "completed"
    ) {
      console.log("\n--- Phase 6: Football Fixtures ---");
      state.phases.footballFixtures.status = "in_progress";
      savePipelineState(state);

      for (const lc of config.football.leagues) {
        for (const season of config.football.seasons) {
          const key = `fixtures_${lc.id}_${season}`;
          if (state.phases.footballFixtures.processedKeys.includes(key))
            continue;

          if (!fbBudget.canMakeCall() && !flags.dryRun) {
            console.warn("  Budget exhausted, stopping fixtures phase");
            break;
          }

          // Step 1: Get fixture IDs
          console.log(`  Fetching fixture IDs: ${lc.name} ${season}...`);
          const fixtureIds = await fetchFootballFixtureIds(
            fbClient,
            lc.id,
            season,
            config.football.fixturesStatuses,
          );

          // Step 2: Batch fetch details in chunks of 20
          const batches = chunk(fixtureIds, 20);
          console.log(
            `  Found ${fixtureIds.length} fixtures, ${batches.length} batches`,
          );

          for (const batch of batches) {
            if (!fbBudget.canMakeCall() && !flags.dryRun) break;

            const rawFixtures = await fetchFootballFixturesBatch(
              fbClient,
              batch,
            );

            for (const rf of rawFixtures) {
              const { fixture, participants } =
                normalizeFootballFixture(rf);
              allFixtures.push(fixture);
              allFixtureParticipants.push(...participants);
            }
          }

          state.phases.footballFixtures.processedKeys.push(key);
          state.phases.footballFixtures.lastKey = key;
          state.footballCallsUsed = fbBudget.callsUsed;
          savePipelineState(state);
        }
      }

      if (!flags.dryRun) {
        persistTable("fixtures", allFixtures);
        persistTable("fixtureParticipants", allFixtureParticipants);
      }
      state.phases.footballFixtures.status = "completed";
      savePipelineState(state);
    }

    // Phase 7: Team Stats
    if (
      config.football.fetchTeamStats &&
      state.phases.footballTeamStats.status !== "completed"
    ) {
      console.log("\n--- Phase 7: Football Team Stats ---");
      state.phases.footballTeamStats.status = "in_progress";
      savePipelineState(state);

      // Only fetch for latest season to save budget
      const latestSeason = Math.max(...config.football.seasons);

      for (const lc of config.football.leagues) {
        const key = `teamstats_${lc.id}_${latestSeason}`;
        if (state.phases.footballTeamStats.processedKeys.includes(key))
          continue;

        // Get teams for this league-season
        const leagueTeams = allTeams.filter(
          (t) => t.leagueId === `fb_${lc.id}` && t.season === latestSeason,
        );

        for (const team of leagueTeams) {
          if (!fbBudget.canMakeCall() && !flags.dryRun) break;

          const raw = await fetchFootballTeamStats(
            fbClient,
            team.apiId,
            lc.id,
            latestSeason,
          );

          if (raw) {
            // Extract team-level stat facts from the response
            const goals = raw.goals;
            const teamId = team.id;
            const teamName = team.name;
            const ctx = `league:fb_${lc.id}`;

            if (goals?.for?.total?.total != null) {
              allStatFacts.push({
                id: `${teamId}_goalsFor_fb_${lc.id}_${latestSeason}`,
                sport: "football",
                entityType: "team",
                entityId: teamId,
                entityName: teamName,
                statKey: "goalsFor",
                contextKey: ctx,
                value: goals.for.total.total,
                season: latestSeason,
              });
            }
            if (goals?.against?.total?.total != null) {
              allStatFacts.push({
                id: `${teamId}_goalsAgainst_fb_${lc.id}_${latestSeason}`,
                sport: "football",
                entityType: "team",
                entityId: teamId,
                entityName: teamName,
                statKey: "goalsAgainst",
                contextKey: ctx,
                value: goals.against.total.total,
                season: latestSeason,
              });
            }
            if (raw.clean_sheet?.total != null) {
              allStatFacts.push({
                id: `${teamId}_cleanSheets_fb_${lc.id}_${latestSeason}`,
                sport: "football",
                entityType: "team",
                entityId: teamId,
                entityName: teamName,
                statKey: "cleanSheets",
                contextKey: ctx,
                value: raw.clean_sheet.total,
                season: latestSeason,
              });
            }
          }
        }

        state.phases.footballTeamStats.processedKeys.push(key);
        state.phases.footballTeamStats.lastKey = key;
        state.footballCallsUsed = fbBudget.callsUsed;
        savePipelineState(state);
      }

      state.phases.footballTeamStats.status = "completed";
      savePipelineState(state);
    }

    // Phase: Football Standings (for team stat facts)
    if (state.phases.footballStandings.status !== "completed") {
      console.log("\n--- Phase: Football Standings ---");
      state.phases.footballStandings.status = "in_progress";
      savePipelineState(state);

      for (const lc of config.football.leagues) {
        for (const season of config.football.seasons) {
          const key = `standings_${lc.id}_${season}`;
          if (state.phases.footballStandings.processedKeys.includes(key))
            continue;

          if (!fbBudget.canMakeCall() && !flags.dryRun) break;

          const rawStandings = await fetchFootballStandings(
            fbClient,
            lc.id,
            season,
          );

          for (const rs of rawStandings) {
            allStatFacts.push(
              ...normalizeFootballStanding(rs, `fb_${lc.id}`, season),
            );
          }

          state.phases.footballStandings.processedKeys.push(key);
          state.phases.footballStandings.lastKey = key;
          state.footballCallsUsed = fbBudget.callsUsed;
          savePipelineState(state);
        }
      }

      state.phases.footballStandings.status = "completed";
      savePipelineState(state);
    }
  }

  // ─── NBA PHASES ───

  const runNba =
    config.nba.enabled &&
    (flags.sportFilter === "all" || flags.sportFilter === "nba");

  let nbaTeams: Team[] = [];

  if (runNba) {
    // Phase 8: NBA Teams
    if (state.phases.nbaTeams.status !== "completed") {
      console.log("\n--- Phase 8: NBA Teams ---");
      state.phases.nbaTeams.status = "in_progress";
      savePipelineState(state);

      const season = config.nba.seasons[0] || 2024;
      const rawTeams = await fetchNbaTeams(nbaClient);

      for (const rt of rawTeams) {
        const team = normalizeNbaTeam(rt, season);
        nbaTeams.push(team);
        allTeams.push(team);
      }

      if (!flags.dryRun) persistTable("teams", allTeams);
      state.phases.nbaTeams.status = "completed";
      state.nbaCallsUsed = nbaBudget.callsUsed;
      savePipelineState(state);
    } else {
      nbaTeams = loadTable<Team>("teams").filter((t) => t.sport === "nba");
    }

    // Phase: NBA Standings
    if (state.phases.nbaStandings.status !== "completed") {
      console.log("\n--- Phase: NBA Standings ---");
      state.phases.nbaStandings.status = "in_progress";
      savePipelineState(state);

      for (const season of config.nba.seasons) {
        const key = `nba_standings_${season}`;
        if (state.phases.nbaStandings.processedKeys.includes(key)) continue;

        if (!nbaBudget.canMakeCall() && !flags.dryRun) break;

        const rawStandings = await fetchNbaStandings(nbaClient, season);
        for (const rs of rawStandings) {
          allStatFacts.push(...normalizeNbaStanding(rs, season));
        }

        state.phases.nbaStandings.processedKeys.push(key);
        state.phases.nbaStandings.lastKey = key;
        state.nbaCallsUsed = nbaBudget.callsUsed;
        savePipelineState(state);
      }

      state.phases.nbaStandings.status = "completed";
      savePipelineState(state);
    }

    // Phase 9: NBA Players (limited per day)
    if (state.phases.nbaPlayers.status !== "completed") {
      console.log("\n--- Phase 9: NBA Players ---");
      state.phases.nbaPlayers.status = "in_progress";
      savePipelineState(state);

      const season = config.nba.seasons[0] || 2024;
      let teamsFetched = 0;

      for (const team of nbaTeams) {
        if (teamsFetched >= config.nba.teamsPerDay) {
          console.log(
            `  Reached teamsPerDay limit (${config.nba.teamsPerDay}), stopping`,
          );
          break;
        }

        const key = `nba_players_${team.apiId}_${season}`;
        if (state.phases.nbaPlayers.processedKeys.includes(key)) continue;

        if (!nbaBudget.canMakeCall() && !flags.dryRun) {
          console.warn("  NBA budget exhausted, stopping players phase");
          break;
        }

        const rawPlayers = await fetchNbaPlayers(
          nbaClient,
          team.apiId,
          season,
        );

        for (const rp of rawPlayers) {
          allPlayers.push(normalizeNbaPlayer(rp));
        }

        teamsFetched++;
        state.phases.nbaPlayers.processedKeys.push(key);
        state.phases.nbaPlayers.lastKey = key;
        state.nbaCallsUsed = nbaBudget.callsUsed;
        savePipelineState(state);
      }

      // Deduplicate
      const playerMap = new Map<string, Player>();
      for (const p of allPlayers) playerMap.set(p.id, p);
      allPlayers = Array.from(playerMap.values());

      if (!flags.dryRun) persistTable("players", allPlayers);

      // Mark completed only if all teams done
      if (
        state.phases.nbaPlayers.processedKeys.length >= nbaTeams.length
      ) {
        state.phases.nbaPlayers.status = "completed";
      }
      savePipelineState(state);
    }

    // Phase 10: NBA Player Stats (curated)
    if (state.phases.nbaStats.status !== "completed") {
      console.log("\n--- Phase 10: NBA Player Stats ---");
      state.phases.nbaStats.status = "in_progress";
      savePipelineState(state);

      const season = config.nba.seasons[0] || 2024;

      // Select headline players: pick from fetched NBA players with most data
      const nbaPlayerList = allPlayers.filter((p) => p.sport === "nba");
      const headlinePlayers = nbaPlayerList.slice(
        0,
        config.nba.headlinePlayerCount,
      );

      for (const player of headlinePlayers) {
        const key = `nba_stats_${player.apiId}_${season}`;
        if (state.phases.nbaStats.processedKeys.includes(key)) continue;

        if (!nbaBudget.canMakeCall() && !flags.dryRun) {
          console.warn("  NBA budget exhausted, stopping stats phase");
          break;
        }

        const rawStats = await fetchNbaPlayerStats(
          nbaClient,
          player.apiId,
          season,
        );

        if (rawStats.length > 0) {
          const ptsList = normalizeNbaPlayerStats(
            String(player.apiId),
            rawStats,
            season,
          );
          allPts.push(...ptsList);
        }

        state.phases.nbaStats.processedKeys.push(key);
        state.phases.nbaStats.lastKey = key;
        state.nbaCallsUsed = nbaBudget.callsUsed;
        savePipelineState(state);
      }

      if (!flags.dryRun) persistTable("playerTeamSeason", allPts);
      state.phases.nbaStats.status = "completed";
      savePipelineState(state);
    }
  }

  // ─── INDEX BUILDING PHASE ───

  if (
    !flags.dryRun &&
    state.phases.indexBuilding.status !== "completed"
  ) {
    console.log("\n--- Phase 11: Building Game Indexes ---");
    state.phases.indexBuilding.status = "in_progress";
    savePipelineState(state);

    // Reload all data from disk to ensure completeness
    allPlayers = loadTable<Player>("players");
    allPts = loadTable<PlayerTeamSeason>("playerTeamSeason");
    allTeams = loadTable<Team>("teams");
    allTrophies = loadTable<PlayerTrophy>("playerTrophies");
    allTransfers = loadTable<PlayerTransfer>("playerTransfers");

    if (config.features.buildGridIndex) {
      console.log("  Building grid index...");
      const gridIndex = buildGridIndex(
        allPlayers,
        allPts,
        allTeams,
        allTrophies,
      );
      persistTable("gridIndex", gridIndex);
    }

    if (config.features.buildStatFacts) {
      console.log("  Building stat facts...");
      const statFacts = buildStatFacts(
        allPlayers,
        allPts,
        allTrophies,
        allStatFacts,
      );
      persistTable("statFacts", statFacts);
    }

    if (config.features.buildWhoAmIClues) {
      console.log("  Building Who Am I clues...");
      const whoAmI = buildWhoAmIClues(
        allPlayers,
        allPts,
        allTeams,
        allTrophies,
        allTransfers,
      );
      persistTable("whoAmIClues", whoAmI);
    }

    state.phases.indexBuilding.status = "completed";
    savePipelineState(state);
  }

  // ─── VALIDATION ───

  if (!flags.dryRun) {
    console.log("\n--- Validation ---");
    const errors = validateOutput();
    if (errors.length > 0) {
      console.warn(`  ${errors.length} validation issues:`);
      for (const err of errors.slice(0, 20)) {
        console.warn(`    - ${err}`);
      }
      if (errors.length > 20)
        console.warn(`    ... and ${errors.length - 20} more`);
    } else {
      console.log("  All validations passed");
    }
  }

  // ─── SUMMARY ───

  console.log("\n=== Pipeline Summary ===\n");

  if (flags.dryRun) {
    console.log("DRY RUN — No API calls made\n");
    console.log(`Football: ${fbBudget.drySummary()}`);
    console.log(`NBA:      ${nbaBudget.drySummary()}`);
  } else {
    console.log(`Football: ${fbBudget.summary()}`);
    console.log(`NBA:      ${nbaBudget.summary()}`);
    console.log(`\nPhase status:`);
    for (const [name, phase] of Object.entries(state.phases)) {
      const icon =
        phase.status === "completed"
          ? "[done]"
          : phase.status === "in_progress"
            ? "[partial]"
            : "[pending]";
      console.log(`  ${icon} ${name} (${phase.processedKeys.length} keys)`);
    }

    // Count output records
    const tables = [
      "leagues",
      "teams",
      "players",
      "playerTeamSeason",
      "playerTrophies",
      "playerTransfers",
      "fixtures",
      "fixtureParticipants",
      "gridIndex",
      "statFacts",
      "whoAmIClues",
    ];
    console.log(`\nOutput records:`);
    for (const table of tables) {
      const records = loadTable<any>(table);
      if (records.length > 0) {
        console.log(`  ${table}: ${records.length}`);
      }
    }
  }

  console.log("\nDone.\n");
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateOutput(): string[] {
  const errors: string[] = [];

  const players = loadTable<Player>("players");
  const teams = loadTable<Team>("teams");
  const pts = loadTable<PlayerTeamSeason>("playerTeamSeason");

  const playerIds = new Set(players.map((p) => p.id));
  const teamIds = new Set(teams.map((t) => t.id));

  // Check for duplicate IDs
  const playerIdCounts = new Map<string, number>();
  for (const p of players) {
    playerIdCounts.set(p.id, (playerIdCounts.get(p.id) || 0) + 1);
  }
  for (const [id, count] of playerIdCounts) {
    if (count > 1) errors.push(`Duplicate player ID: ${id} (${count}x)`);
  }

  // Check FK integrity for playerTeamSeason
  for (const p of pts) {
    if (!playerIds.has(p.playerId)) {
      errors.push(`PTS FK: playerId ${p.playerId} not in players`);
    }
    if (!teamIds.has(p.teamId)) {
      errors.push(`PTS FK: teamId ${p.teamId} not in teams`);
    }
  }

  // Check trophies FK
  const trophies = loadTable<PlayerTrophy>("playerTrophies");
  for (const t of trophies) {
    if (!playerIds.has(t.playerId)) {
      errors.push(`Trophy FK: playerId ${t.playerId} not in players`);
    }
  }

  // Check transfers FK
  const transfers = loadTable<PlayerTransfer>("playerTransfers");
  for (const t of transfers) {
    if (!playerIds.has(t.playerId)) {
      errors.push(`Transfer FK: playerId ${t.playerId} not in players`);
    }
  }

  return errors;
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseArgs();

  // Load config
  let config: PipelineConfig;
  try {
    const raw = fs.readFileSync(flags.configPath, "utf-8");
    config = JSON.parse(raw);
  } catch (err: any) {
    console.error(`Failed to load config from ${flags.configPath}: ${err.message}`);
    process.exit(1);
  }

  // Validate env
  if (!flags.dryRun) {
    if (
      config.football.enabled &&
      (flags.sportFilter === "all" || flags.sportFilter === "football")
    ) {
      if (!process.env.API_FOOTBALL_KEY) {
        console.error("Missing API_FOOTBALL_KEY in environment");
        process.exit(1);
      }
    }
    if (
      config.nba.enabled &&
      (flags.sportFilter === "all" || flags.sportFilter === "nba")
    ) {
      if (
        !process.env.NBA_API_KEY &&
        !process.env.API_FOOTBALL_KEY
      ) {
        console.error(
          "Missing NBA_API_KEY (or API_FOOTBALL_KEY) in environment",
        );
        process.exit(1);
      }
    }
  }

  await runPipeline(config, flags);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
