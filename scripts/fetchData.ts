#!/usr/bin/env npx tsx
/**
 * fetchData.ts — VerveQ Data Pipeline
 *
 * Fetches player data from TheSportsDB API (Bio + Honors + Contracts)
 * and outputs a structured JSON file for seeding into Convex.
 *
 * Supports: Football (Soccer), Basketball (NBA), Tennis (ATP/WTA).
 *
 * Usage:
 *   npx tsx scripts/fetchData.ts
 *
 * Environment:
 *   SPORTSDB_API_KEY — API key (defaults to free-tier key "3")
 *
 * Output: verveq_seed_data.json (project root)
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
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface VerveQPlayerEntity {
  sportsDbId: string;
  sport: "Football" | "Basketball" | "Tennis";
  name: string;
  nationality: string;
  position: string;
  stats: {
    height: string | null;
    weight: string | null;
    totalHonors: number;
  };
  careerHistory: Array<{
    teamName: string;
    startYear: string;
    endYear: string;
  }>;
  honors: Array<{
    awardName: string;
    year: string;
  }>;
}

interface LeagueConfig {
  league: string;
  sport: "Football" | "Basketball" | "Tennis";
}

interface RawPlayer {
  idPlayer: string;
  strPlayer: string;
  strNationality: string | null;
  strPosition: string | null;
  strHeight: string | null;
  strWeight: string | null;
  strSport: string | null;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const API_KEY = process.env.SPORTSDB_API_KEY || "3";
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

const RATE_LIMIT_MS = 2000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5000;

const CACHE_DIR = path.join(__dirname, "cache");
const OUTPUT_PATH = path.join(__dirname, "..", "verveq_seed_data.json");

const LEAGUE_CONFIG: LeagueConfig[] = [
  // Football — Top 5 European leagues
  { league: "English Premier League", sport: "Football" },
  { league: "Spanish La Liga", sport: "Football" },
  { league: "German Bundesliga", sport: "Football" },
  { league: "Italian Serie A", sport: "Football" },
  { league: "French Ligue 1", sport: "Football" },
  // Basketball
  { league: "NBA", sport: "Basketball" },
];

// Tennis fallback — hardcoded list of top ATP/WTA players to search individually
// since TheSportsDB doesn't organize tennis into team-based leagues.
const TENNIS_FALLBACK_PLAYERS: string[] = [
  // Active ATP
  "Novak Djokovic",
  "Carlos Alcaraz",
  "Jannik Sinner",
  "Daniil Medvedev",
  "Alexander Zverev",
  "Andrey Rublev",
  "Stefanos Tsitsipas",
  "Holger Rune",
  "Casper Ruud",
  "Taylor Fritz",
  "Hubert Hurkacz",
  "Alex de Minaur",
  "Tommy Paul",
  "Ben Shelton",
  "Felix Auger-Aliassime",
  "Frances Tiafoe",
  "Lorenzo Musetti",
  "Grigor Dimitrov",
  // Legends ATP
  "Roger Federer",
  "Rafael Nadal",
  "Andy Murray",
  "Pete Sampras",
  "Andre Agassi",
  "Bjorn Borg",
  "John McEnroe",
  "Boris Becker",
  "Stefan Edberg",
  "Ivan Lendl",
  "Jimmy Connors",
  "Arthur Ashe",
  "Rod Laver",
  "Mats Wilander",
  // Active WTA
  "Iga Swiatek",
  "Aryna Sabalenka",
  "Coco Gauff",
  "Elena Rybakina",
  "Jessica Pegula",
  "Ons Jabeur",
  "Qinwen Zheng",
  "Jasmine Paolini",
  "Emma Raducanu",
  // Legends WTA
  "Serena Williams",
  "Venus Williams",
  "Steffi Graf",
  "Martina Navratilova",
  "Chris Evert",
  "Monica Seles",
  "Billie Jean King",
  "Martina Hingis",
  "Maria Sharapova",
  "Naomi Osaka",
  "Kim Clijsters",
  "Justine Henin",
  "Lindsay Davenport",
  "Margaret Court",
];

// ─── Utility Functions ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`Created cache directory: ${CACHE_DIR}`);
  }
}

/**
 * Sanitize a string for use as a cache file name.
 * Replaces non-alphanumeric characters with underscores.
 */
function sanitizeCacheKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
}

/**
 * Fetch a URL with retry logic and exponential backoff.
 * Handles 429 (rate limited) and 5xx (server error) responses.
 */
async function fetchWithRetry(
  url: string,
  retries: number = MAX_RETRIES,
): Promise<any | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);

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

      // 404 means "no data for this resource" — not a transient error
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

/**
 * Fetch with local file caching. If a cached response exists, return it
 * instead of hitting the API. On successful fetch, save to cache.
 * Also caches 404 (null) responses as {"_empty":true} to avoid re-fetching.
 */
async function cachedFetch(cacheKey: string, url: string): Promise<any | null> {
  const safeName = sanitizeCacheKey(cacheKey);
  const cachePath = path.join(CACHE_DIR, `${safeName}.json`);

  // Check cache first
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
      // Sentinel value for cached 404 responses
      if (cached && cached._empty === true) return null;
      return cached;
    } catch {
      // Corrupt cache file — re-fetch
    }
  }

  // Rate limit before API call
  await sleep(RATE_LIMIT_MS);

  const data = await fetchWithRetry(url);

  // Cache both successful responses and 404s (as sentinel)
  try {
    const toCache = data !== null ? data : { _empty: true };
    fs.writeFileSync(cachePath, JSON.stringify(toCache), "utf-8");
  } catch (err: any) {
    console.warn(`  Cache write failed for ${safeName}: ${err.message}`);
  }
  return data;
}

// ─── Tracking ───────────────────────────────────────────────────────────────

let cacheHits = 0;
let cacheMisses = 0;

async function trackedCachedFetch(
  cacheKey: string,
  url: string,
): Promise<any | null> {
  const safeName = sanitizeCacheKey(cacheKey);
  const cachePath = path.join(CACHE_DIR, `${safeName}.json`);
  const wasCached = fs.existsSync(cachePath);

  const result = await cachedFetch(cacheKey, url);

  if (wasCached && result !== null) {
    cacheHits++;
  } else if (result !== null) {
    cacheMisses++;
  }

  return result;
}

// ─── Phase A: Fetch Player Bio Data ─────────────────────────────────────────

interface PlayerBio {
  idPlayer: string;
  name: string;
  nationality: string;
  position: string;
  height: string | null;
  weight: string | null;
  sport: "Football" | "Basketball" | "Tennis";
}

/**
 * Map TheSportsDB sport names to our normalized sport names.
 */
function normalizeSport(
  rawSport: string | null,
  configSport: "Football" | "Basketball" | "Tennis",
): "Football" | "Basketball" | "Tennis" {
  if (!rawSport) return configSport;
  const lower = rawSport.toLowerCase();
  if (lower === "soccer" || lower === "football") return "Football";
  if (lower === "basketball") return "Basketball";
  if (lower === "tennis") return "Tennis";
  return configSport;
}

/**
 * Normalize height strings from TheSportsDB's varied formats.
 * Common formats: "1.85 m (6 ft 1 in)", "6 ft 1 in", "185 cm", "1.85m"
 * Output: "1.85m" or null
 */
function normalizeHeight(raw: string | null): string | null {
  if (!raw || raw.trim() === "") return null;
  const s = raw.trim();

  // Match "X.XX m" or "X.XXm" pattern
  const meterMatch = s.match(/(\d+\.\d+)\s*m/i);
  if (meterMatch) return `${meterMatch[1]}m`;

  // Match "XXX cm" pattern
  const cmMatch = s.match(/(\d{2,3})\s*cm/i);
  if (cmMatch) {
    const meters = (parseInt(cmMatch[1], 10) / 100).toFixed(2);
    return `${meters}m`;
  }

  // Match feet/inches pattern "X ft Y in"
  const ftMatch = s.match(/(\d+)\s*(?:ft|')\s*(\d+)?\s*(?:in|")?/i);
  if (ftMatch) {
    const feet = parseInt(ftMatch[1], 10);
    const inches = ftMatch[2] ? parseInt(ftMatch[2], 10) : 0;
    const totalInches = feet * 12 + inches;
    const meters = (totalInches * 0.0254).toFixed(2);
    return `${meters}m`;
  }

  return null;
}

/**
 * Normalize weight strings from TheSportsDB's varied formats.
 * Common formats: "80 kg (176 lb)", "176 lb", "80kg"
 * Output: "80kg" or null
 */
function normalizeWeight(raw: string | null): string | null {
  if (!raw || raw.trim() === "") return null;
  const s = raw.trim();

  // Match "XX kg" or "XXkg" pattern
  const kgMatch = s.match(/(\d+)\s*kg/i);
  if (kgMatch) return `${kgMatch[1]}kg`;

  // Match "XXX lb" pattern
  const lbMatch = s.match(/(\d+)\s*lb/i);
  if (lbMatch) {
    const kg = Math.round(parseInt(lbMatch[1], 10) * 0.453592);
    return `${kg}kg`;
  }

  return null;
}

/**
 * Fetch all teams for a league, then all players for each team.
 */
async function fetchPlayerBiosForLeague(
  config: LeagueConfig,
): Promise<PlayerBio[]> {
  const players: PlayerBio[] = [];
  const seenPlayerIds = new Set<string>();

  // Fetch teams for this league
  const teamsUrl = `${BASE_URL}/search_all_teams.php?l=${encodeURIComponent(config.league)}`;
  const teamsData = await trackedCachedFetch(
    `teams_${config.league}`,
    teamsUrl,
  );

  if (!teamsData || !teamsData.teams) {
    console.log(`  No teams found for ${config.league}`);
    return players;
  }

  const teams: Array<{ idTeam: string; strTeam: string }> = teamsData.teams;
  console.log(`  Found ${teams.length} teams in ${config.league}`);

  // Fetch players for each team
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    process.stdout.write(
      `  Fetching players (${i + 1}/${teams.length}): ${team.strTeam}...`,
    );

    const playersUrl = `${BASE_URL}/lookup_all_players.php?id=${team.idTeam}`;
    const playersData = await trackedCachedFetch(
      `players_${team.idTeam}`,
      playersUrl,
    );

    if (!playersData || !playersData.player) {
      console.log(" no data");
      continue;
    }

    const rawPlayers: RawPlayer[] = playersData.player;
    let added = 0;

    for (const p of rawPlayers) {
      if (!p.idPlayer || !p.strPlayer || seenPlayerIds.has(p.idPlayer))
        continue;
      seenPlayerIds.add(p.idPlayer);

      players.push({
        idPlayer: p.idPlayer,
        name: p.strPlayer,
        nationality: p.strNationality || "Unknown",
        position: p.strPosition || "Unknown",
        height: normalizeHeight(p.strHeight),
        weight: normalizeWeight(p.strWeight),
        sport: normalizeSport(p.strSport, config.sport),
      });
      added++;
    }

    console.log(` ${added} players`);
  }

  return players;
}

/**
 * Fetch tennis players using the fallback list (search by name).
 */
async function fetchTennisPlayerBios(): Promise<PlayerBio[]> {
  const players: PlayerBio[] = [];
  const seenPlayerIds = new Set<string>();

  console.log(
    `  Searching for ${TENNIS_FALLBACK_PLAYERS.length} tennis players individually...`,
  );

  for (let i = 0; i < TENNIS_FALLBACK_PLAYERS.length; i++) {
    const playerName = TENNIS_FALLBACK_PLAYERS[i];
    process.stdout.write(
      `  Searching (${i + 1}/${TENNIS_FALLBACK_PLAYERS.length}): ${playerName}...`,
    );

    const searchUrl = `${BASE_URL}/searchplayers.php?p=${encodeURIComponent(playerName)}`;
    const data = await trackedCachedFetch(
      `tennis_search_${playerName}`,
      searchUrl,
    );

    if (!data || !data.player || data.player.length === 0) {
      console.log(" not found");
      continue;
    }

    // Find the best match — prefer exact name match and tennis sport
    const match = data.player.find(
      (p: any) =>
        p.strPlayer?.toLowerCase() === playerName.toLowerCase() &&
        p.strSport?.toLowerCase() === "tennis",
    ) ||
      data.player.find(
        (p: any) => p.strSport?.toLowerCase() === "tennis",
      ) ||
      data.player[0];

    if (!match || !match.idPlayer || seenPlayerIds.has(match.idPlayer)) {
      console.log(" no match");
      continue;
    }

    seenPlayerIds.add(match.idPlayer);
    players.push({
      idPlayer: match.idPlayer,
      name: match.strPlayer || playerName,
      nationality: match.strNationality || "Unknown",
      position: match.strPosition || "Tennis Player",
      height: normalizeHeight(match.strHeight),
      weight: normalizeWeight(match.strWeight),
      sport: "Tennis",
    });
    console.log(` found (ID: ${match.idPlayer})`);
  }

  return players;
}

// ─── Phase B: Fetch Honors ──────────────────────────────────────────────────

interface PlayerHonors {
  honors: Array<{ awardName: string; year: string }>;
  totalHonors: number;
}

async function fetchHonorsForPlayer(playerId: string): Promise<PlayerHonors> {
  const url = `${BASE_URL}/lookuphonors.php?id=${playerId}`;
  const data = await trackedCachedFetch(`honors_${playerId}`, url);

  if (!data || !data.honors) {
    return { honors: [], totalHonors: 0 };
  }

  const honors = data.honors
    .filter((h: any) => h.strHonour || h.strHonor)
    .map((h: any) => ({
      awardName: (h.strHonour || h.strHonor || "Unknown Award").trim(),
      year: (h.strSeason || h.strYear || "Unknown").trim(),
    }));

  return { honors, totalHonors: honors.length };
}

// ─── Phase C: Fetch Career History (Contracts) ──────────────────────────────

interface CareerEntry {
  teamName: string;
  startYear: string;
  endYear: string;
}

async function fetchContractsForPlayer(
  playerId: string,
): Promise<CareerEntry[]> {
  const url = `${BASE_URL}/lookupcontracts.php?id=${playerId}`;
  const data = await trackedCachedFetch(`contracts_${playerId}`, url);

  if (!data || !data.contracts) {
    return [];
  }

  return data.contracts
    .filter((c: any) => c.strTeam)
    .map((c: any) => ({
      teamName: (c.strTeam || "Unknown").trim(),
      startYear: (c.strYearStart || "Unknown").trim(),
      endYear: (c.strYearEnd || "Unknown").trim(),
    }));
}

// ─── Data Merging ───────────────────────────────────────────────────────────

async function enrichPlayers(
  bios: PlayerBio[],
): Promise<VerveQPlayerEntity[]> {
  const entities: VerveQPlayerEntity[] = [];
  const total = bios.length;

  console.log(`\nEnriching ${total} players with honors and career data...\n`);

  for (let i = 0; i < bios.length; i++) {
    const bio = bios[i];

    if ((i + 1) % 50 === 0 || i === 0 || i === total - 1) {
      process.stdout.write(
        `  Progress: ${i + 1}/${total} (${Math.round(((i + 1) / total) * 100)}%)\r`,
      );
    }

    // Fetch honors and contracts in sequence (to respect rate limits)
    const honorsData = await fetchHonorsForPlayer(bio.idPlayer);
    const careerHistory = await fetchContractsForPlayer(bio.idPlayer);

    entities.push({
      sportsDbId: bio.idPlayer,
      sport: bio.sport,
      name: bio.name,
      nationality: bio.nationality,
      position: bio.position,
      stats: {
        height: bio.height,
        weight: bio.weight,
        totalHonors: honorsData.totalHonors,
      },
      careerHistory,
      honors: honorsData.honors,
    });
  }

  console.log(); // Clear the progress line
  return entities;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== VerveQ Data Pipeline: TheSportsDB ===\n");
  console.log(`API Base: ${BASE_URL}`);
  console.log(`Cache Dir: ${CACHE_DIR}`);
  console.log(`Output: ${OUTPUT_PATH}`);
  console.log(`Rate Limit: ${RATE_LIMIT_MS}ms between requests\n`);

  const startTime = Date.now();

  // Setup
  ensureCacheDir();

  // ── Phase A: Fetch Player Bios ──
  console.log("── Phase A: Fetching Player Bios ──\n");

  const allBios: PlayerBio[] = [];

  // Football & Basketball (team-based leagues)
  for (const config of LEAGUE_CONFIG) {
    console.log(`\n[${config.sport}] ${config.league}`);
    const bios = await fetchPlayerBiosForLeague(config);
    allBios.push(...bios);
    console.log(`  Subtotal: ${bios.length} players from ${config.league}`);
  }

  // Tennis (fallback approach)
  console.log(`\n[Tennis] Fallback player search`);

  // Try ATP league first
  const atpUrl = `${BASE_URL}/search_all_teams.php?l=${encodeURIComponent("ATP")}`;
  const atpData = await trackedCachedFetch("teams_ATP", atpUrl);

  if (atpData && atpData.teams && atpData.teams.length > 0) {
    console.log(
      `  ATP league returned ${atpData.teams.length} entries — using league approach`,
    );
    const tennisBios = await fetchPlayerBiosForLeague({
      league: "ATP",
      sport: "Tennis",
    });
    allBios.push(...tennisBios);
    console.log(`  Subtotal: ${tennisBios.length} tennis players from ATP`);
  } else {
    console.log("  ATP league search returned no teams — using fallback list");
    const tennisBios = await fetchTennisPlayerBios();
    allBios.push(...tennisBios);
    console.log(
      `  Subtotal: ${tennisBios.length} tennis players from fallback search`,
    );
  }

  // Deduplicate by player ID
  const dedupMap = new Map<string, PlayerBio>();
  for (const bio of allBios) {
    if (!dedupMap.has(bio.idPlayer)) {
      dedupMap.set(bio.idPlayer, bio);
    }
  }
  const uniqueBios = Array.from(dedupMap.values());

  console.log(`\nTotal unique players: ${uniqueBios.length}`);
  console.log(
    `  Football: ${uniqueBios.filter((b) => b.sport === "Football").length}`,
  );
  console.log(
    `  Basketball: ${uniqueBios.filter((b) => b.sport === "Basketball").length}`,
  );
  console.log(
    `  Tennis: ${uniqueBios.filter((b) => b.sport === "Tennis").length}`,
  );

  // ── Phase B & C: Enrich with Honors + Contracts ──
  console.log("\n── Phase B & C: Enriching with Honors & Contracts ──");

  const entities = await enrichPlayers(uniqueBios);

  // Filter out players with no meaningful data
  const validEntities = entities.filter(
    (e) => e.name && e.name.trim() !== "" && e.nationality !== "Unknown",
  );

  // ── Write Output ──
  console.log(`\n── Writing Output ──\n`);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(validEntities, null, 2), "utf-8");

  // ── Summary ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const withHonors = validEntities.filter(
    (e) => e.stats.totalHonors > 0,
  ).length;
  const withCareer = validEntities.filter(
    (e) => e.careerHistory.length > 0,
  ).length;
  const totalHonors = validEntities.reduce(
    (sum, e) => sum + e.stats.totalHonors,
    0,
  );

  console.log("=== Pipeline Complete ===\n");
  console.log(`  Total players:        ${validEntities.length}`);
  console.log(
    `  Football:             ${validEntities.filter((e) => e.sport === "Football").length}`,
  );
  console.log(
    `  Basketball:           ${validEntities.filter((e) => e.sport === "Basketball").length}`,
  );
  console.log(
    `  Tennis:               ${validEntities.filter((e) => e.sport === "Tennis").length}`,
  );
  console.log(`  With honors:          ${withHonors}`);
  console.log(`  With career history:  ${withCareer}`);
  console.log(`  Total honors fetched: ${totalHonors}`);
  console.log(`  Cache hits:           ${cacheHits}`);
  console.log(`  Cache misses (API):   ${cacheMisses}`);
  console.log(`  Time:                 ${elapsed}s`);
  console.log(`  Output:               ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
