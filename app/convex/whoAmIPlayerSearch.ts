import { query } from "./_generated/server";
import { v } from "convex/values";
import footballPlayerMetadata from "./data/football_player_metadata.json";

export const WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH = 3;
export const WHO_AM_I_PLAYER_SEARCH_LIMIT = 8;

export type WhoAmIPlayerSearchResult = {
  playerId: string;
  name: string;
  nationality?: string;
  team?: string;
  position?: string;
  photoUrl?: string;
};

export type FootballPlayerMetadataEntry = {
  club?: string;
  team?: string;
  position?: string;
  nationality?: string;
  photoUrl?: string;
  imageUrl?: string;
};


export type WhoAmIComparisonStatus = "correct" | "incorrect" | "unknown";
export type WhoAmIComparisonFeedback = {
  guessedPlayerName: string;
  nationality: WhoAmIComparisonStatus;
  position: WhoAmIComparisonStatus;
  team: WhoAmIComparisonStatus;
};

function compareDimension(guessValue?: string, answerValue?: string): WhoAmIComparisonStatus {
  if (!guessValue || !answerValue) return "unknown";
  return normalizeSearchText(guessValue) === normalizeSearchText(answerValue) ? "correct" : "incorrect";
}

const ABBREVIATED_NAME_PATTERN = /^(\p{L})\.?\s+(.+)$/u;

let normalizedIndexCache: {
  source: Record<string, FootballPlayerMetadataEntry>;
  index: Map<string, string>;
} | null = null;

function getNormalizedNameIndex(
  metadata: Record<string, FootballPlayerMetadataEntry>,
): Map<string, string> {
  if (normalizedIndexCache?.source === metadata) return normalizedIndexCache.index;
  const index = new Map<string, string>();
  for (const key of Object.keys(metadata)) {
    const normalized = normalizeSearchText(key);
    if (!index.has(normalized)) index.set(normalized, key);
  }
  normalizedIndexCache = { source: metadata, index };
  return index;
}

/**
 * Curated clue sets store answers in "B. Matuidi" form while the metadata is
 * keyed by full names. Resolve an abbreviated name to its unique full-name
 * key; anything ambiguous or unknown comes back unchanged.
 */
export function resolveCanonicalPlayerName(
  metadata: Record<string, FootballPlayerMetadataEntry>,
  name: string,
): string {
  if (metadata[name]) return name;
  const match = name.match(ABBREVIATED_NAME_PATTERN);
  if (!match) return name;
  const initial = normalizeSearchText(match[1]);
  const tail = normalizeSearchText(match[2]);
  let resolved: string | null = null;
  for (const [normalized, key] of getNormalizedNameIndex(metadata)) {
    if (!normalized.startsWith(initial)) continue;
    if (normalized !== `${initial} ${tail}` && !normalized.endsWith(` ${tail}`)) continue;
    if (resolved !== null) return name; // ambiguous — keep the stored form
    resolved = key;
  }
  return resolved ?? name;
}

/** Look a player up by display name, tolerating case/diacritics and "X. Lastname" forms. */
export function findMetadataEntryByName(
  metadata: Record<string, FootballPlayerMetadataEntry>,
  name: string,
): FootballPlayerMetadataEntry | undefined {
  if (metadata[name]) return metadata[name];
  const byNormalized = getNormalizedNameIndex(metadata).get(normalizeSearchText(name));
  if (byNormalized) return metadata[byNormalized];
  const canonical = resolveCanonicalPlayerName(metadata, name);
  return canonical === name ? undefined : metadata[canonical];
}

export function buildWhoAmIComparisonFeedback(
  metadata: Record<string, FootballPlayerMetadataEntry>,
  guessedPlayerName: string,
  answerName: string,
): WhoAmIComparisonFeedback {
  const guessedMeta = findMetadataEntryByName(metadata, guessedPlayerName);
  const answerMeta = findMetadataEntryByName(metadata, answerName);
  const guessedTeam = guessedMeta?.team ?? guessedMeta?.club;
  const answerTeam = answerMeta?.team ?? answerMeta?.club;

  return {
    guessedPlayerName,
    nationality: compareDimension(guessedMeta?.nationality, answerMeta?.nationality),
    position: compareDimension(guessedMeta?.position, answerMeta?.position),
    team: compareDimension(guessedTeam, answerTeam),
  };
}

export function getWhoAmIPlayerMetadata(): Record<string, FootballPlayerMetadataEntry> {
  return footballPlayerMetadata as Record<string, FootballPlayerMetadataEntry>;
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function stablePlayerIdFromName(name: string): string {
  return `football:${normalizeSearchText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function clampSearchLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit ?? WHO_AM_I_PLAYER_SEARCH_LIMIT)) {
    return WHO_AM_I_PLAYER_SEARCH_LIMIT;
  }
  const integerLimit = Math.floor(limit ?? WHO_AM_I_PLAYER_SEARCH_LIMIT);
  return Math.max(1, Math.min(integerLimit, WHO_AM_I_PLAYER_SEARCH_LIMIT));
}

export function searchWhoAmIPlayersFromMetadata(
  metadata: Record<string, FootballPlayerMetadataEntry>,
  queryText: string,
  limit = WHO_AM_I_PLAYER_SEARCH_LIMIT,
): WhoAmIPlayerSearchResult[] {
  const query = normalizeSearchText(queryText);
  if (query.length < WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH) return [];

  const safeLimit = clampSearchLimit(limit);

  return Object.entries(metadata)
    .map(([name, meta]) => ({ name, meta, normalizedName: normalizeSearchText(name) }))
    .filter(({ normalizedName }) => normalizedName.includes(query))
    .sort((a, b) => {
      const aStarts = a.normalizedName.startsWith(query) ? 0 : 1;
      const bStarts = b.normalizedName.startsWith(query) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.name.localeCompare(b.name);
    })
    .slice(0, safeLimit)
    .map(({ name, meta }) => ({
      playerId: stablePlayerIdFromName(name),
      name,
      nationality: meta.nationality,
      team: meta.team ?? meta.club,
      position: meta.position,
      photoUrl: meta.photoUrl ?? meta.imageUrl,
    }));
}

export const searchPlayers = query({
  args: {
    sport: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, { sport, query, limit }) => {
    if (sport !== "football") return [];
    return searchWhoAmIPlayersFromMetadata(
      getWhoAmIPlayerMetadata(),
      query,
      limit,
    );
  },
});
