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
  enableHeadlineGapFill?: boolean;
  headlineGapFillLimit?: number;
  headlineProfilesMaxPages?: number;
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
  buildPlayerQualityProfiles?: boolean;
  buildFootballSurvivalIndex?: boolean;
  buildFootballCoverageReport?: boolean;
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

interface VerveGridApprovedEntry extends GridIndexEntry {
  sport: "football";
  sourceGridId: string;
  axisFamily: string;
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

interface HigherLowerFact {
  id: string;
  sport: "football" | "nba";
  poolKey: string;
  entityType: "player" | "team";
  entityId: string;
  entityName: string;
  statKey: string;
  contextKey: string;
  value: number;
  season: number | null;
}

interface HigherLowerPool {
  id: string;
  sport: "football" | "nba";
  entityType: "player" | "team";
  statKey: string;
  contextKey: string;
  contextLabel: string;
  factCount: number;
  distinctValueCount: number;
  minValue: number;
  maxValue: number;
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

interface WhoAmIApprovedClue {
  id: string;
  sourceClueId: string;
  sport: "football";
  playerId: string;
  clue1: string;
  clue2: string;
  clue3: string;
  clue4: string;
  answerName: string;
  difficulty: "easy" | "medium" | "hard";
  rawDifficulty: "easy" | "medium" | "hard";
  qualityScore: number;
  isHeadlineSeed: boolean;
  isManualLegend: boolean;
  teamLabels: string[];
  approvalReasons: string[];
  curationFlags: string[];
}

interface PlayerQualityProfile {
  id: string;
  sport: "football";
  playerId: string;
  playerName: string;
  normalizedName: string;
  initials2: string | null;
  initials3: string | null;

  fameScore: number;
  playabilityScore: number;
  clueRichnessScore: number;
  metadataCompletenessScore: number;
  recentPresenceScore: number;
  eliteCompetitionScore: number;
  transferScore: number;
  trophyScore: number;

  totalAppearances: number;
  totalMinutes: number;
  totalGoals: number;
  totalAssists: number;
  teamCount: number;
  leagueCount: number;
  trophyWins: number;
  transferCount: number;
  hasPhoto: boolean;
  hasNationality: boolean;
  hasPosition: boolean;
  hasFirstName: boolean;

  isHeadlineSeed: boolean;
  wasGapFilled: boolean;
  matchedViaProfilesEndpoint: boolean;

  survivalTier: "A" | "B" | "C" | "D";
  survivalEligible: boolean;
  whoAmIEligible: boolean;
  higherLowerEligible: boolean;
  gridEligible: boolean;

  reasons: string[];
}

interface SurvivalInitialsBucket {
  id: string;
  sport: "football";
  initials: string;
  initialsLength: number;

  playerIds: string[];
  playerNames: string[];
  totalPlayers: number;

  playablePlayerIds: string[];
  headlinePlayerIds: string[];
  famousCount: number;
  playableCount: number;
  playableRatio: number;

  topPlayerId: string | null;
  topPlayerName: string | null;
  topPlayabilityScore: number;

  bucketScore: number;
  recommendedTier: "easy" | "medium" | "hard" | "expert";
  eligibleEarlyRounds: boolean;
  eligibleMidRounds: boolean;
  eligibleLateRounds: boolean;
}

interface HeadlineCoverageEntry {
  seedName: string;
  normalizedSeedName: string;
  status:
    | "matched_existing"
    | "matched_manual_layer"
    | "gap_filled"
    | "ambiguous"
    | "missing";
  matchedPlayerId: string | null;
  matchedPlayerName: string | null;
  notes: string | null;
  priority: CoveragePriority;
  coverageBucket: CoverageBucket;
  matchConfidence?: MatchConfidence | null;
  matchedAlias?: string | null;
  overrideUsed?: boolean;
}

type CoveragePriority = "critical" | "high" | "medium" | "low";
type CoverageBucket =
  | "matched_existing"
  | "matched_manual_layer"
  | "matched_override"
  | "ambiguous_mononym"
  | "ambiguous_duplicate_legend"
  | "missing_current_star"
  | "missing_recent_star"
  | "missing_historical_legend"
  | "missing_out_of_scope"
  | "missing_unresolved";

type HeadlineSeedEra = "current" | "recent" | "historical";

interface ManualFootballLegend {
  canonicalName: string;
  aliases?: string[];
  nationality?: string;
  position?: string;
  era?: string;
  clubs?: string[];
  notableTeams?: string[];
  trophies?: string[];
  achievements?: string[];
  firstName?: string;
  lastName?: string;
  initials2?: string | null;
  initials3?: string | null;
  survivalTier?: "A" | "B";
  whoAmIEligible?: boolean;
  notes?: string;
}

interface NormalizedManualFootballLegend {
  id: string;
  sport: "football";
  canonicalName: string;
  aliases: string[];
  nationality: string | null;
  position: string | null;
  era: string | null;
  clubs: string[];
  notableTeams: string[];
  trophies: string[];
  achievements: string[];
  firstName: string | null;
  lastName: string | null;
  initials2: string | null;
  initials3: string | null;
  survivalTier: "A" | "B";
  whoAmIEligibleHint: boolean;
  notes: string | null;
  player: Player;
}

interface FinalIdentityResolution {
  canonicalName: string;
  resolutionType: "preferred_existing" | "manual_layer";
  preferredApiId?: number;
  preferredExactName?: string;
  notes?: string;
}

interface FootballHeadlineSeed {
  canonicalName: string;
  aliases: string[];
  allowMononym?: boolean;
  requiredTokens?: string[];
  forbiddenTokens?: string[];
  era?: HeadlineSeedEra;
  priority?: CoveragePriority;
}

interface HeadlineSeedOverride {
  canonicalName: string;
  preferredApiId?: number;
  preferredExactName?: string;
  allowedExactNames?: string[];
  allowedAliases?: string[];
  notes?: string;
}

type MatchConfidence = "exact" | "alias" | "strong" | "weak" | "reject";

interface NameMatchFeatures {
  candidateName: string;
  candidateNormalized: string;
  candidateTokens: string[];
  matchedAlias: string;
  matchedAliasNormalized: string;
  exactNormalizedEquality: boolean;
  exactAliasEquality: boolean;
  tokenOverlapRatio: number;
  orderedTokenContainment: boolean;
  initialsCompatibility: boolean;
  abbreviationCompatibility: boolean;
  extraTokenPenalty: number;
  extraUnrelatedTokens: string[];
  mononymStrictness: boolean;
  forbiddenTokenHit: boolean;
  requiredTokensSatisfied: boolean;
  falsePositiveSafetyRejected: boolean;
  confidence: MatchConfidence;
  score: number;
}

interface FootballCoverageReport {
  generatedAt: string;
  totalFootballPlayers: number;
  totalFootballPlayerTeamSeasons: number;

  playersWithRecentStats: number;
  playersWithPhotos: number;
  playersWithPosition: number;
  playersWithNationality: number;
  playersWithTrophies: number;
  playersWithTransfers: number;

  headlinerSeedsTotal: number;
  headlinerSeedsMatchedExisting: number;
  headlinerSeedsMatchedManualLayer: number;
  headlinerSeedsGapFilled: number;
  headlinerSeedsAmbiguous: number;
  headlinerSeedsMissing: number;

  tierCounts: {
    A: number;
    B: number;
    C: number;
    D: number;
  };

  recoveryCandidates: {
    criticalCurrentMissing: string[];
    highPriorityMissing: string[];
    ambiguousNeedsOverride: string[];
    historicalManualLayerCandidates: string[];
  };

  manualLayerRecommendation: {
    recommended: boolean;
    reasons: string[];
    candidateCount: number;
    candidateNames: string[];
  };

  manualLayerImpact: {
    legendsLoaded: number;
    seedsResolvedByManualLayer: number;
    survivalEligibleLegends: number;
    whoAmIEligibleLegends: number;
    unresolvedHistoricalSeedsAfterManualLayer: string[];
  };

  headlineGameplayCoverage: {
    survivalEligible: number;
    whoAmIEligible: number;
    bothEligible: number;
    neitherEligible: number;
  };

  coverage: HeadlineCoverageEntry[];
  missingSeedNames: string[];
}

interface FootballGameplayQaReport {
  generatedAt: string;
  survival: {
    totalBuckets: number;
    buckets2Letters: number;
    buckets3Letters: number;
    easyBuckets: number;
    mediumBuckets: number;
    hardBuckets: number;
    expertBuckets: number;
    earlyEligibleBuckets: number;
    midEligibleBuckets: number;
    lateEligibleBuckets: number;
    bucketsWithHeadlinePlayer: number;
    bucketsWithManualLegendTopPlayer: number;
    top20EarlyBuckets: Array<{
      initials: string;
      topPlayerName: string | null;
      bucketScore: number;
      recommendedTier: string;
      totalPlayers: number;
      playableCount: number;
      famousCount: number;
    }>;
    suspiciousBuckets: Array<{
      initials: string;
      reason: string;
      totalPlayers: number;
      playableCount: number;
      topPlayerName: string | null;
      bucketScore: number;
    }>;
  };
  whoAmI: {
    totalClueSets: number;
    headlineClueSets: number;
    manualLegendClueSets: number;
    easy: number;
    medium: number;
    hard: number;
    lowSignalClueSets: Array<{
      playerId: string;
      answerName: string;
      reasons: string[];
    }>;
  };
  quality: {
    tierA: number;
    tierB: number;
    tierC: number;
    tierD: number;
    headlineTierBreakdown: {
      A: number;
      B: number;
      C: number;
      D: number;
    };
  };
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
  | "footballHeadlineGapFill"
  | "footballTrophies"
  | "footballTransfers"
  | "footballFixtures"
  | "footballTeamStats"
  | "footballStandings"
  | "nbaTeams"
  | "nbaStandings"
  | "nbaPlayers"
  | "nbaStats"
  | "indexBuilding"
  | "qualityIndexBuilding";

interface PipelineState {
  version: 2;
  startedAt: string;
  lastUpdatedAt: string;
  footballCallsUsed: number;
  nbaCallsUsed: number;
  phases: Record<PhaseName, PhaseState>;
  footballHeadlineCoverage: HeadlineCoverageEntry[];
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
const MANUAL_FOOTBALL_LEGENDS_PATH = path.join(
  DATA_DIR,
  "manual_football_legends.json",
);

const FOOTBALL_ELITE_COMPETITION_IDS = new Set([1, 2, 3, 4, 9]);
const FOOTBALL_RECENT_SEASONS_COUNT = 3;
const FOOTBALL_WHO_AM_I_MIN_SIGNAL_COUNT = 3;
const FOOTBALL_WHO_AM_I_MIN_PLAYABILITY_SCORE = 45;
const FOOTBALL_WHO_AM_I_MIN_CLUE_RICHNESS_SCORE = 12;
const FOOTBALL_SURVIVAL_EASY_MIN_TOP_SCORE = 150;
const FOOTBALL_SURVIVAL_EASY_MIN_BUCKET_SCORE = 250;
const FOOTBALL_SURVIVAL_EASY_MIN_PLAYABLE_RATIO = 0.18;
const FOOTBALL_SURVIVAL_MEDIUM_MIN_TOP_SCORE = 100;
const FOOTBALL_SURVIVAL_MEDIUM_MIN_BUCKET_SCORE = 140;
const FOOTBALL_SURVIVAL_MEDIUM_MIN_PLAYABLE_RATIO = 0.12;
const FOOTBALL_SURVIVAL_HARD_MIN_TOP_SCORE = 60;
const FOOTBALL_SURVIVAL_EARLY_MIN_FAMOUS_COUNT = 2;
const FOOTBALL_SURVIVAL_EARLY_MIN_PLAYABLE_COUNT = 3;
const FOOTBALL_SURVIVAL_EARLY_MIN_PLAYABLE_RATIO = 0.22;
const FOOTBALL_SURVIVAL_EARLY_MIN_TOP_SCORE = 180;
const FOOTBALL_SURVIVAL_EARLY_MIN_BUCKET_SCORE = 400;
const FOOTBALL_SURVIVAL_MID_MIN_PLAYABLE_COUNT = 2;
const FOOTBALL_SURVIVAL_MID_MIN_PLAYABLE_RATIO = 0.15;
const FOOTBALL_SURVIVAL_MID_MIN_TOP_SCORE = 120;
const FOOTBALL_SURVIVAL_MID_MIN_BUCKET_SCORE = 180;

const FOOTBALL_HEADLINE_SEED_NAMES = [
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Kylian Mbappé",
  "David Beckham",
  "Karim Benzema",
  "Luka Modric",
  "Robert Lewandowski",
  "Mohamed Salah",
  "Erling Haaland",
  "Kevin De Bruyne",
  "Sergio Ramos",
  "Andrés Iniesta",
  "Gerard Piqué",
  "Gianluigi Buffon",
  "Andrea Pirlo",
  "Zlatan Ibrahimović",
  "Wayne Rooney",
  "Frank Lampard",
  "Steven Gerrard",
  "Didier Drogba",
  "Samuel Eto'o",
  "Virgil van Dijk",
  "Toni Kroos",
  "Gareth Bale",
  "Antoine Griezmann",
  "Sadio Mané",
  "Jude Bellingham",
  "Vinicius Junior",
  "Pelé",
  "Diego Maradona",
  "Johan Cruyff",
  "Ronaldo Nazário",
  "Ronaldinho",
  "Zinedine Zidane",
  "Thierry Henry",
  "Xavi",
  "Iker Casillas",
  "Paolo Maldini",
  "Franz Beckenbauer",
  "Michel Platini",
  "George Best",
  "Lev Yashin",
  "Alfredo Di Stéfano",
  "Ferenc Puskás",
  "Roberto Baggio",
  "Romário",
  "Rivaldo",
  "Kaká",
  "Luis Figo",
  "Carles Puyol",
  "Roberto Carlos",
  "Cafu",
  "Philipp Lahm",
  "Manuel Neuer",
  "Bastian Schweinsteiger",
  "Thomas Müller",
  "Neymar",
  "Luis Suárez",
  "Sergio Agüero",
  "Eden Hazard",
  "Harry Kane",
  "Son Heung-min",
  "N'Golo Kanté",
  "Paul Pogba",
  "Raheem Sterling",
  "Bernardo Silva",
  "Phil Foden",
  "Bukayo Saka",
  "Declan Rice",
  "Rodri",
  "Bruno Fernandes",
  "Marcus Rashford",
  "Trent Alexander-Arnold",
  "Alisson Becker",
  "Ederson",
  "Thibaut Courtois",
  "Marc-André ter Stegen",
  "Jan Oblak",
  "Ruben Dias",
  "Marquinhos",
  "Thiago Silva",
  "Casemiro",
  "Fede Valverde",
  "Pedri",
  "Gavi",
  "Lamine Yamal",
  "Jamal Musiala",
  "Florian Wirtz",
  "Victor Osimhen",
  "Rafael Leão",
  "Lautaro Martínez",
  "Julian Alvarez",
  "Enzo Fernández",
  "Emiliano Martínez",
  "Alessandro Del Piero",
  "Francesco Totti",
  "Ryan Giggs",
  "Paul Scholes",
  "Roy Keane",
  "Eric Cantona",
  "Alan Shearer",
  "Ruud van Nistelrooy",
  "Dennis Bergkamp",
  "Patrick Vieira",
  "Claude Makélélé",
  "Ashley Cole",
  "John Terry",
  "Rio Ferdinand",
  "Nemanja Vidić",
  "Petr Čech",
  "Arjen Robben",
  "Franck Ribéry",
  "Xabi Alonso",
  "Mesut Özil",
  "Angel Di María",
  "Ángel Correa",
  "Cesc Fàbregas",
  "David Villa",
  "Fernando Torres",
  "Raúl",
  "Sergio Busquets",
  "Javier Zanetti",
  "Fabio Cannavaro",
  "Clarence Seedorf",
  "Edgar Davids",
  "Ruud Gullit",
  "Marco van Basten",
  "Frank Rijkaard",
  "Andrea Barzagli",
  "Leonardo Bonucci",
  "Giorgio Chiellini",
  "Franco Baresi",
  "Gaetano Scirea",
  "Dani Alves",
  "Riyad Mahrez",
  "Yaya Touré",
  "Vincent Kompany",
  "Miroslav Klose",
  "Robin van Persie",
  "Dirk Kuyt",
  "Wesley Sneijder",
  "Edwin van der Sar",
  "Michael Ballack",
  "Bobby Charlton",
  "Kenny Dalglish",
  "Kevin Keegan",
  "Bobby Moore",
  "Gerd Müller",
  "Oliver Kahn",
  "Lothar Matthäus",
  "Davor Šuker",
  "Hristo Stoichkov",
  "Roberto Bettega",
  "Gheorghe Hagi",
  "Carlos Valderrama",
  "James Rodríguez",
  "Alexis Sánchez",
  "Arturo Vidal",
  "Luis Díaz",
  "Achraf Hakimi",
  "Khvicha Kvaratskhelia",
] as const;

const FOOTBALL_RECENT_HEADLINE_SEEDS = new Set([
  "David Beckham",
  "Sergio Ramos",
  "Andrés Iniesta",
  "Gerard Piqué",
  "Gianluigi Buffon",
  "Andrea Pirlo",
  "Zlatan Ibrahimović",
  "Wayne Rooney",
  "Frank Lampard",
  "Steven Gerrard",
  "Didier Drogba",
  "Samuel Eto'o",
  "Toni Kroos",
  "Gareth Bale",
  "Antoine Griezmann",
  "Sadio Mané",
  "Luka Modric",
  "Karim Benzema",
  "Iker Casillas",
  "Paolo Maldini",
  "Ronaldo Nazário",
  "Ronaldinho",
  "Thierry Henry",
  "Xavi",
  "Romário",
  "Rivaldo",
  "Kaká",
  "Luis Figo",
  "Carles Puyol",
  "Cafu",
  "Philipp Lahm",
  "Manuel Neuer",
  "Bastian Schweinsteiger",
  "Thomas Müller",
  "Neymar",
  "Luis Suárez",
  "Sergio Agüero",
  "Eden Hazard",
  "N'Golo Kanté",
  "Paul Pogba",
  "Alessandro Del Piero",
  "Francesco Totti",
  "Ryan Giggs",
  "Paul Scholes",
  "Roy Keane",
  "Eric Cantona",
  "Alan Shearer",
  "Ruud van Nistelrooy",
  "Dennis Bergkamp",
  "Patrick Vieira",
  "Claude Makélélé",
  "Ashley Cole",
  "John Terry",
  "Rio Ferdinand",
  "Nemanja Vidić",
  "Petr Čech",
  "Arjen Robben",
  "Franck Ribéry",
  "Xabi Alonso",
  "Mesut Özil",
  "Angel Di María",
  "Ángel Correa",
  "Cesc Fàbregas",
  "David Villa",
  "Fernando Torres",
  "Raúl",
  "Sergio Busquets",
  "Javier Zanetti",
  "Fabio Cannavaro",
  "Clarence Seedorf",
  "Andrea Barzagli",
  "Leonardo Bonucci",
  "Giorgio Chiellini",
  "Dani Alves",
  "Yaya Touré",
  "Vincent Kompany",
  "Miroslav Klose",
  "Robin van Persie",
  "Dirk Kuyt",
  "Wesley Sneijder",
  "Edwin van der Sar",
  "Michael Ballack",
  "James Rodríguez",
  "Alexis Sánchez",
  "Arturo Vidal",
]);

const FOOTBALL_HISTORICAL_HEADLINE_SEEDS = new Set([
  "Pelé",
  "Diego Maradona",
  "Johan Cruyff",
  "Franz Beckenbauer",
  "Michel Platini",
  "George Best",
  "Lev Yashin",
  "Alfredo Di Stéfano",
  "Ferenc Puskás",
  "Roberto Baggio",
  "Franco Baresi",
  "Gaetano Scirea",
  "Edgar Davids",
  "Ruud Gullit",
  "Marco van Basten",
  "Frank Rijkaard",
  "Bobby Charlton",
  "Kenny Dalglish",
  "Kevin Keegan",
  "Bobby Moore",
  "Gerd Müller",
  "Oliver Kahn",
  "Lothar Matthäus",
  "Davor Šuker",
  "Hristo Stoichkov",
  "Roberto Bettega",
  "Gheorghe Hagi",
  "Carlos Valderrama",
]);

const FOOTBALL_CRITICAL_HEADLINE_SEEDS = new Set([
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Kylian Mbappé",
  "Erling Haaland",
  "Kevin De Bruyne",
  "Jude Bellingham",
  "Harry Kane",
  "Virgil van Dijk",
  "Bukayo Saka",
  "Trent Alexander-Arnold",
  "Florian Wirtz",
  "Jamal Musiala",
  "Victor Osimhen",
  "Achraf Hakimi",
]);

const FOOTBALL_HIGH_PRIORITY_HEADLINE_SEEDS = new Set([
  "Robert Lewandowski",
  "Mohamed Salah",
  "Karim Benzema",
  "Luka Modric",
  "Toni Kroos",
  "Gareth Bale",
  "Eden Hazard",
  "Sergio Agüero",
  "Gerard Piqué",
  "Didier Drogba",
  "Samuel Eto'o",
  "Iker Casillas",
  "Carles Puyol",
  "Luis Suárez",
  "Rodri",
  "Ederson",
  "Marquinhos",
  "Pedri",
  "Gavi",
  "Lamine Yamal",
  "Phil Foden",
  "Ruben Dias",
  "James Rodríguez",
  "Ronaldinho",
  "Xavi",
  "Neymar",
  "Luis Díaz",
  "Khvicha Kvaratskhelia",
]);

const FOOTBALL_LOW_PRIORITY_HEADLINE_SEEDS = new Set([
  "George Best",
  "Lev Yashin",
  "Ferenc Puskás",
  "Gaetano Scirea",
  "Bobby Charlton",
  "Gerd Müller",
  "Kenny Dalglish",
  "Kevin Keegan",
  "Alfredo Di Stéfano",
  "Roberto Bettega",
]);

const FOOTBALL_HEADLINE_SEED_CONFIG: Record<
  string,
  Partial<Omit<FootballHeadlineSeed, "canonicalName">>
> = {
  "Lionel Messi": {
    aliases: ["Leo Messi", "L. Messi"],
    requiredTokens: ["messi"],
  },
  "Cristiano Ronaldo": {
    aliases: ["Cristiano Ronaldo dos Santos Aveiro", "C. Ronaldo"],
    requiredTokens: ["ronaldo"],
  },
  "Kylian Mbappé": {
    aliases: ["Kylian Mbappe", "K. Mbappé", "K. Mbappe"],
    requiredTokens: ["mbappe"],
  },
  "Karim Benzema": {
    aliases: ["K. Benzema"],
    requiredTokens: ["benzema"],
  },
  "Luka Modric": {
    aliases: ["Luka Modrić", "L. Modric", "L. Modrić"],
    requiredTokens: ["modric"],
  },
  "Kevin De Bruyne": {
    aliases: ["K. De Bruyne"],
    requiredTokens: ["bruyne"],
  },
  "Virgil van Dijk": {
    aliases: ["V. van Dijk"],
    requiredTokens: ["dijk"],
  },
  "Trent Alexander-Arnold": {
    aliases: [
      "Trent Alexander Arnold",
      "T. Alexander-Arnold",
      "T. Alexander Arnold",
    ],
    requiredTokens: ["alexander", "arnold"],
  },
  "N'Golo Kanté": {
    aliases: ["Ngolo Kante", "N. Kante", "N Golo Kante"],
    requiredTokens: ["kante"],
  },
  "Son Heung-min": {
    aliases: ["Son Heung Min"],
    requiredTokens: ["son", "heung", "min"],
  },
  "Luis Suárez": {
    aliases: ["Luis Suarez", "L. Suárez", "L. Suarez"],
    requiredTokens: ["suarez"],
  },
  "Angel Di María": {
    aliases: ["Ángel Di María", "Angel Di Maria", "A. Di María", "A. Di Maria"],
    requiredTokens: ["maria"],
  },
  "Rafael Leão": {
    aliases: ["Rafael Leao", "R. Leão", "R. Leao"],
    requiredTokens: ["leao"],
  },
  "Lautaro Martínez": {
    aliases: ["Lautaro Martinez", "L. Martínez", "L. Martinez"],
    requiredTokens: ["lautaro", "martinez"],
  },
  "Vinicius Junior": {
    aliases: ["Vinícius Júnior", "V. Junior", "V. Júnior"],
    requiredTokens: ["junior"],
  },
  "Erling Haaland": {
    aliases: ["E. Haaland"],
    requiredTokens: ["haaland"],
  },
  "Harry Kane": {
    aliases: ["H. Kane"],
    requiredTokens: ["kane"],
  },
  "Jude Bellingham": {
    aliases: ["J. Bellingham"],
    requiredTokens: ["bellingham"],
  },
  Xavi: {
    aliases: ["Xavi Hernandez", "Xavier Hernández Creus", "Xavier Hernandez Creus"],
    allowMononym: true,
  },
  Ronaldinho: {
    aliases: ["Ronaldinho Gaúcho", "Ronaldinho Gaucho"],
    allowMononym: true,
  },
  Kaká: {
    aliases: ["Kaka", "Ricardo Kaká", "Ricardo Kaka", "Ricardo Izecson dos Santos Leite"],
    allowMononym: true,
  },
  Rivaldo: {
    aliases: ["Rivaldo Vítor Borba Ferreira", "Rivaldo Vitor Borba Ferreira"],
    allowMononym: true,
  },
  Cafu: {
    aliases: ["Marcos Evangelista de Morais"],
    allowMononym: true,
  },
  Neymar: {
    aliases: [
      "Neymar Jr",
      "Neymar Júnior",
      "Neymar Junior",
      "Neymar da Silva Santos Júnior",
      "Neymar da Silva Santos Junior",
    ],
    allowMononym: true,
  },
  Rodri: {
    aliases: ["Rodrigo Hernández Cascante", "Rodrigo Hernandez Cascante", "Rodrigo Hernández", "Rodrigo Hernandez"],
    allowMononym: true,
  },
  Pedri: {
    aliases: ["Pedro González López", "Pedro Gonzalez Lopez"],
    allowMononym: true,
  },
  Gavi: {
    aliases: ["Pablo Martín Páez Gavira", "Pablo Martin Paez Gavira"],
    allowMononym: true,
  },
  Ederson: {
    aliases: ["Ederson Santana de Moraes"],
    allowMononym: true,
  },
  Casemiro: {
    aliases: ["Carlos Henrique Casemiro", "Carlos Henrique Casimiro"],
    allowMononym: true,
  },
  Marquinhos: {
    aliases: ["Marcos Aoás Corrêa", "Marcos Aoas Correa"],
    allowMononym: true,
  },
  "Alessandro Del Piero": {
    aliases: ["A. Del Piero"],
    requiredTokens: ["piero"],
  },
  "Michel Platini": {
    requiredTokens: ["platini"],
  },
};

const FOOTBALL_HEADLINE_SEEDS: FootballHeadlineSeed[] = FOOTBALL_HEADLINE_SEED_NAMES.map(
  (canonicalName) =>
    buildFootballHeadlineSeed(
      canonicalName,
      FOOTBALL_HEADLINE_SEED_CONFIG[canonicalName],
    ),
);

const FOOTBALL_HEADLINE_SEED_OVERRIDES: HeadlineSeedOverride[] = [
  {
    canonicalName: "Xavi",
    preferredApiId: 42041,
    allowedAliases: ["Xavi", "Xavi Hernandez", "Xavier Hernández Creus"],
    notes: "Resolve mononym collision to the Barcelona/Spain legend record.",
  },
  {
    canonicalName: "Rodri",
    preferredApiId: 44,
    allowedAliases: ["Rodri", "Rodrigo Hernández Cascante", "Rodrigo Hernandez Cascante"],
    notes: "Resolve the modern Ballon d'Or contender rather than other Rodrigo variants.",
  },
  {
    canonicalName: "Ederson",
    preferredApiId: 617,
    allowedAliases: ["Ederson", "Ederson Santana de Moraes"],
    notes: "Resolve the Manchester City/Brazil goalkeeper over the older namesake.",
  },
  {
    canonicalName: "Marquinhos",
    preferredApiId: 257,
    allowedAliases: ["Marquinhos", "Marcos Aoás Corrêa", "Marcos Aoas Correa"],
    notes: "Resolve the PSG/Brazil defender over the younger namesake.",
  },
  {
    canonicalName: "Ronaldinho",
    preferredApiId: 114413,
    allowedAliases: ["Ronaldinho", "Ronaldinho Gaúcho", "Ronaldinho Gaucho"],
    notes: "Resolve the Brazilian legend record for the mononym.",
  },
  {
    canonicalName: "Carles Puyol",
    preferredApiId: 116880,
    allowedExactNames: ["Carles Puyol i Saforcada"],
    allowedAliases: ["Carles Puyol"],
    notes: "Accept the existing player record with the Catalan compound surname.",
  },
  {
    canonicalName: "Didier Drogba",
    preferredApiId: 102731,
    allowedExactNames: ["Didier Yves Drogba Tébily", "Didier Drogba Tébily"],
    allowedAliases: ["Didier Drogba", "D. Drogba"],
    notes: "Accept the existing full-name record for Drogba.",
  },
  {
    canonicalName: "Gerard Piqué",
    preferredApiId: 136,
    allowedExactNames: ["Piqué", "Gerard Piqué"],
    allowedAliases: ["Gerard Piqué", "Gerard Pique"],
    notes: "Resolve the surname-only display record back to Gerard Piqué.",
  },
  {
    canonicalName: "Iker Casillas",
    preferredApiId: 367,
    allowedExactNames: ["Iker Casillas Fernández", "Iker Casillas Fernandez"],
    allowedAliases: ["Iker Casillas", "I. Casillas"],
    notes: "Accept the existing two-surname Casillas record.",
  },
  {
    canonicalName: "Samuel Eto'o",
    preferredApiId: 42432,
    allowedExactNames: ["Samuel Eto'o Fils", "Samuel Etoo Fils"],
    allowedAliases: ["Samuel Eto'o", "Samuel Etoo"],
    notes: "Accept the existing Eto'o Fils record for the headline seed.",
  },
  {
    canonicalName: "Robert Lewandowski",
    preferredApiId: 521,
    allowedAliases: ["Robert Lewandowski", "R. Lewandowski"],
    notes: "Resolve duplicate Lewandowski records to the established current-star profile.",
  },
  {
    canonicalName: "James Rodríguez",
    preferredApiId: 517,
    allowedAliases: ["James Rodríguez", "James Rodriguez", "J. Rodríguez", "J. Rodriguez"],
    notes: "Resolve James Rodríguez to the Colombian attacking midfielder profile.",
  },
  {
    canonicalName: "Luis Suárez",
    preferredApiId: 157,
    allowedAliases: ["Luis Suárez", "Luis Suarez", "L. Suárez", "L. Suarez"],
    notes: "Resolve Luis Suárez to the Uruguayan striker over other Suárez players.",
  },
  {
    canonicalName: "Kaká",
    preferredApiId: 105404,
    allowedAliases: ["Kaká", "Kaka", "Ricardo Kaká", "Ricardo Kaka"],
    notes: "Resolve Kaká to Ricardo Izecson dos Santos Leite.",
  },
];

const FOOTBALL_HEADLINE_SEED_OVERRIDE_MAP = new Map(
  FOOTBALL_HEADLINE_SEED_OVERRIDES.map((override) => [
    normalizeNameForMatch(override.canonicalName),
    override,
  ]),
);

const FINAL_FOOTBALL_IDENTITY_RESOLUTIONS: FinalIdentityResolution[] = [
  {
    canonicalName: "Rivaldo",
    resolutionType: "manual_layer",
    notes:
      "resolved via manual legends layer; preferred over persistent mononym ambiguity in provider data",
  },
  {
    canonicalName: "Bobby Moore",
    resolutionType: "manual_layer",
    notes:
      "resolved via manual legends layer; preferred over ambiguous duplicate provider identities",
  },
  {
    canonicalName: "Diego Maradona",
    resolutionType: "manual_layer",
    notes:
      "resolved via manual legends layer; preferred over ambiguous duplicate provider identities",
  },
];

const FINAL_FOOTBALL_IDENTITY_RESOLUTION_MAP = new Map(
  FINAL_FOOTBALL_IDENTITY_RESOLUTIONS.map((resolution) => [
    normalizeNameForMatch(resolution.canonicalName),
    resolution,
  ]),
);

const DEFAULT_FOOTBALL_CONFIG_FIELDS = {
  enableHeadlineGapFill: true,
  headlineGapFillLimit: 40,
  headlineProfilesMaxPages: 2,
} as const;

const DEFAULT_FEATURE_CONFIG_FIELDS = {
  buildPlayerQualityProfiles: true,
  buildFootballSurvivalIndex: true,
  buildFootballCoverageReport: true,
} as const;

const HIGHER_LOWER_APPROVED_CONTEXT_LABELS: Record<string, string> = {
  "league:fb_39": "Premier League",
  "league:fb_140": "La Liga",
  "league:fb_135": "Serie A",
  "league:fb_78": "Bundesliga",
  "league:fb_61": "Ligue 1",
  "league:fb_2": "Champions League",
  "league:fb_3": "Europa League",
  "league:fb_848": "Conference League",
  "league:fb_1": "World Cup",
  "league:fb_4": "Euro Championship",
  "league:fb_9": "Copa America",
  "league:fb_15": "FIFA Club World Cup",
  career: "Career",
};

const HIGHER_LOWER_APPROVED_CONTEXT_KEYS = new Set(
  Object.keys(HIGHER_LOWER_APPROVED_CONTEXT_LABELS),
);
const HIGHER_LOWER_APPROVED_STAT_KEYS = new Set([
  "goalsFor",
  "goalsAgainst",
  "assists",
  "appearances",
  "wins",
  "losses",
  "draws",
  "points",
]);
const HIGHER_LOWER_DISABLED_STAT_KEYS = new Set(["cleanSheets"]);
const HIGHER_LOWER_MIN_GROUP_SIZE = 5;
const HIGHER_LOWER_MIN_DISTINCT_VALUES = 3;
const VERVE_GRID_APPROVED_NATIONALITIES = new Set([
  "Argentina",
  "Belgium",
  "Brazil",
  "Colombia",
  "England",
  "France",
  "Germany",
  "Italy",
  "Netherlands",
  "Portugal",
  "Spain",
  "Uruguay",
]);
const VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS = new Set(["fb_1", "fb_4", "fb_9"]);
const VERVE_GRID_POSITION_NORMALIZATION: Record<string, string> = {
  Forward: "Attacker",
};

interface FootballSeasonCoverage {
  players?: boolean;
  topScorers?: boolean;
  topAssists?: boolean;
  standings?: boolean;
  fixtures?: boolean;
}

type FootballCoverageRequirement = keyof FootballSeasonCoverage;

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

function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeVerveGridPositionLabel(position: string | null): string | null {
  if (!position) return null;
  return VERVE_GRID_POSITION_NORMALIZATION[position] || position;
}

function getVerveGridAxisFamily(entry: {
  rowType: string;
  colType: string;
}): string {
  return `${entry.rowType}x${entry.colType}`;
}

function buildVerveGridCellStats(counts: number[]): VerveGridQaCellStats {
  if (counts.length === 0) {
    return { count: 0, min: 0, median: 0, max: 0 };
  }

  const sorted = [...counts].sort((a, b) => a - b);
  return {
    count: counts.length,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
  };
}

function normalizeNameForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[’'`´-]+/g, " ")
    .replace(/[.,/#!$%^&*;:{}=_~()\[\]\\|+?<>]/g, " ")
    .replace(/[^a-zA-Z\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_PARTICLE_TOKENS = new Set([
  "al",
  "bin",
  "da",
  "das",
  "de",
  "del",
  "der",
  "di",
  "do",
  "dos",
  "du",
  "el",
  "la",
  "le",
  "los",
  "san",
  "santa",
  "st",
  "ter",
  "van",
  "von",
  "y",
]);

function tokenizeNormalizedName(name: string): string[] {
  return normalizeNameForMatch(name)
    .split(" ")
    .filter((token) => /^[a-z]+$/.test(token));
}

function buildInitialTokenSet(name: string): Set<string> {
  return new Set(
    tokenizeNormalizedName(name)
      .map((token) => token[0])
      .filter((token): token is string => Boolean(token)),
  );
}

function isAbbreviatedName(name: string): boolean {
  return /\b[A-Za-z]\./.test(name) || tokenizeNormalizedName(name).some((token) => token.length === 1);
}

function buildDefaultHeadlineAliases(canonicalName: string): string[] {
  const tokens = tokenizeNormalizedName(canonicalName);
  if (tokens.length < 2) {
    return [];
  }

  return [[`${tokens[0][0]}.`, ...tokens.slice(1)].join(" ")];
}

function getDefaultFootballHeadlineSeedEra(
  canonicalName: string,
): HeadlineSeedEra {
  if (FOOTBALL_HISTORICAL_HEADLINE_SEEDS.has(canonicalName)) {
    return "historical";
  }

  if (FOOTBALL_RECENT_HEADLINE_SEEDS.has(canonicalName)) {
    return "recent";
  }

  return "current";
}

function getDefaultFootballHeadlineSeedPriority(
  canonicalName: string,
): CoveragePriority {
  if (FOOTBALL_CRITICAL_HEADLINE_SEEDS.has(canonicalName)) {
    return "critical";
  }

  if (FOOTBALL_HIGH_PRIORITY_HEADLINE_SEEDS.has(canonicalName)) {
    return "high";
  }

  if (FOOTBALL_LOW_PRIORITY_HEADLINE_SEEDS.has(canonicalName)) {
    return "low";
  }

  return "medium";
}

function buildFootballHeadlineSeed(
  canonicalName: string,
  config: Partial<Omit<FootballHeadlineSeed, "canonicalName">> = {},
): FootballHeadlineSeed {
  const aliases = Array.from(
    new Set([
      canonicalName,
      ...buildDefaultHeadlineAliases(canonicalName),
      ...(config.aliases || []),
    ]),
  );

  return {
    canonicalName,
    aliases,
    allowMononym: config.allowMononym ?? tokenizeNormalizedName(canonicalName).length === 1,
    requiredTokens: config.requiredTokens || [],
    forbiddenTokens: config.forbiddenTokens || [],
    era: config.era ?? getDefaultFootballHeadlineSeedEra(canonicalName),
    priority: config.priority ?? getDefaultFootballHeadlineSeedPriority(canonicalName),
  };
}

function getHeadlineSeedOverride(
  seed: FootballHeadlineSeed,
): HeadlineSeedOverride | undefined {
  return FOOTBALL_HEADLINE_SEED_OVERRIDE_MAP.get(
    normalizeNameForMatch(seed.canonicalName),
  );
}

function getHeadlineSeedAliasVariants(seed: FootballHeadlineSeed): string[] {
  const aliases = Array.from(new Set([seed.canonicalName, ...seed.aliases]));
  return aliases.filter((alias) => tokenizeNormalizedName(alias).length > 0);
}

function areOrderedTokensContained(
  referenceTokens: string[],
  candidateTokens: string[],
): boolean {
  if (referenceTokens.length === 0) {
    return false;
  }

  let referenceIndex = 0;
  for (const candidateToken of candidateTokens) {
    if (candidateToken === referenceTokens[referenceIndex]) {
      referenceIndex++;
    }
    if (referenceIndex === referenceTokens.length) {
      return true;
    }
  }

  return referenceIndex === referenceTokens.length;
}

function areAbbreviationCompatibleTokens(
  referenceTokens: string[],
  candidateTokens: string[],
): boolean {
  if (referenceTokens.length !== candidateTokens.length) {
    return false;
  }

  let foundAbbreviation = false;

  for (let index = 0; index < referenceTokens.length; index++) {
    const referenceToken = referenceTokens[index];
    const candidateToken = candidateTokens[index];

    if (referenceToken === candidateToken) {
      continue;
    }

    const compatible =
      (referenceToken.length === 1 && candidateToken.startsWith(referenceToken)) ||
      (candidateToken.length === 1 && referenceToken.startsWith(candidateToken));

    if (!compatible) {
      return false;
    }

    foundAbbreviation = true;
  }

  return foundAbbreviation;
}

function isSafeAliasExtraToken(token: string): boolean {
  return NAME_PARTICLE_TOKENS.has(token);
}

function getExtraUnrelatedTokens(
  referenceTokens: string[],
  candidateTokens: string[],
): string[] {
  const remainingReferenceTokens = [...referenceTokens];
  const extraTokens: string[] = [];

  for (const candidateToken of candidateTokens) {
    const matchingIndex = remainingReferenceTokens.indexOf(candidateToken);
    if (matchingIndex >= 0) {
      remainingReferenceTokens.splice(matchingIndex, 1);
      continue;
    }

    if (!isSafeAliasExtraToken(candidateToken)) {
      extraTokens.push(candidateToken);
    }
  }

  return extraTokens;
}

function getMatchConfidenceRank(confidence: MatchConfidence): number {
  switch (confidence) {
    case "exact":
      return 4;
    case "alias":
      return 3;
    case "strong":
      return 2;
    case "weak":
      return 1;
    default:
      return 0;
  }
}

function computeAliasMatchFeatures(
  seed: FootballHeadlineSeed,
  alias: string,
  candidateName: string,
): NameMatchFeatures {
  const canonicalNormalized = normalizeNameForMatch(seed.canonicalName);
  const aliasNormalized = normalizeNameForMatch(alias);
  const candidateNormalized = normalizeNameForMatch(candidateName);
  const aliasTokens = tokenizeNormalizedName(alias);
  const candidateTokens = tokenizeNormalizedName(candidateName);
  const aliasInitials = buildInitialTokenSet(alias);
  const candidateInitials = buildInitialTokenSet(candidateName);
  const overlapCount = aliasTokens.filter((token) => candidateTokens.includes(token)).length;
  const tokenOverlapRatio = aliasTokens.length > 0 ? overlapCount / aliasTokens.length : 0;
  const orderedTokenContainment = areOrderedTokensContained(aliasTokens, candidateTokens);
  const abbreviationCompatibility = areAbbreviationCompatibleTokens(aliasTokens, candidateTokens);
  const initialsCompatibility =
    aliasInitials.size > 0 &&
    candidateInitials.size > 0 &&
    Array.from(aliasInitials).every((initial) => candidateInitials.has(initial));
  const extraUnrelatedTokens = getExtraUnrelatedTokens(aliasTokens, candidateTokens);
  const extraTokenPenalty = extraUnrelatedTokens.length * 25;
  const requiredTokens = (seed.requiredTokens || []).flatMap(tokenizeNormalizedName);
  const forbiddenTokens = (seed.forbiddenTokens || []).flatMap(tokenizeNormalizedName);
  const requiredTokensSatisfied = requiredTokens.every((token) => candidateTokens.includes(token));
  const forbiddenTokenHit = forbiddenTokens.some((token) => candidateTokens.includes(token));
  const exactNormalizedEquality = candidateNormalized === canonicalNormalized;
  const exactAliasEquality = candidateNormalized === aliasNormalized;
  const mononymStrictness =
    !seed.allowMononym ||
    aliasTokens.length > 1 ||
    candidateTokens.length === 1 ||
    exactAliasEquality ||
    exactNormalizedEquality;
  const falsePositiveSafetyRejected =
    !exactAliasEquality &&
    !exactNormalizedEquality &&
    orderedTokenContainment &&
    extraUnrelatedTokens.length > 0 &&
    !abbreviationCompatibility;

  let confidence: MatchConfidence = "reject";
  let score = 0;

  if (exactNormalizedEquality) {
    confidence = "exact";
    score = 300;
  } else if (exactAliasEquality) {
    confidence = "alias";
    score = 280;
  } else if (
    forbiddenTokenHit ||
    !requiredTokensSatisfied ||
    !mononymStrictness ||
    falsePositiveSafetyRejected
  ) {
    confidence = "reject";
    score = 0;
  } else if (
    tokenOverlapRatio >= 1 &&
    (orderedTokenContainment || abbreviationCompatibility) &&
    extraUnrelatedTokens.length === 0
  ) {
    confidence = "strong";
    score = 190;
  } else if (
    tokenOverlapRatio >= 0.67 &&
    (abbreviationCompatibility || orderedTokenContainment || initialsCompatibility) &&
    extraUnrelatedTokens.length === 0
  ) {
    confidence = "strong";
    score = 160;
  } else if (
    tokenOverlapRatio >= 0.5 &&
    (orderedTokenContainment || abbreviationCompatibility || initialsCompatibility)
  ) {
    confidence = "weak";
    score = 90;
  }

  score += Math.round(tokenOverlapRatio * 50);
  if (orderedTokenContainment) score += 15;
  if (abbreviationCompatibility) score += 20;
  if (initialsCompatibility) score += 10;
  if (seed.allowMononym && aliasTokens.length === 1 && candidateTokens.length === 1) {
    score += 10;
  }
  score -= extraTokenPenalty;

  return {
    candidateName,
    candidateNormalized,
    candidateTokens,
    matchedAlias: alias,
    matchedAliasNormalized: aliasNormalized,
    exactNormalizedEquality,
    exactAliasEquality,
    tokenOverlapRatio: roundScore(tokenOverlapRatio),
    orderedTokenContainment,
    initialsCompatibility,
    abbreviationCompatibility,
    extraTokenPenalty,
    extraUnrelatedTokens,
    mononymStrictness,
    forbiddenTokenHit,
    requiredTokensSatisfied,
    falsePositiveSafetyRejected,
    confidence,
    score,
  };
}

function computeNameMatchFeatures(
  seed: FootballHeadlineSeed,
  candidateName: string,
): NameMatchFeatures {
  return getHeadlineSeedAliasVariants(seed)
    .map((alias) => computeAliasMatchFeatures(seed, alias, candidateName))
    .sort(
      (a, b) =>
        getMatchConfidenceRank(b.confidence) - getMatchConfidenceRank(a.confidence) ||
        b.score - a.score ||
        a.candidateName.localeCompare(b.candidateName),
    )[0];
}

function getPlayerInitials(name: string, len: 2 | 3): string | null {
  const tokens = tokenizeNormalizedName(name);

  if (tokens.length < len) {
    return null;
  }

  const initials = tokens
    .slice(0, len)
    .map((token) => token[0]?.toUpperCase() || "")
    .join("");

  return /^[A-Z]+$/.test(initials) ? initials : null;
}

function isManualLegendPlayerId(playerId: string): boolean {
  return playerId.startsWith("fb_manual_legend_");
}

function slugifyManualLegendName(name: string): string {
  return normalizeNameForMatch(name).replace(/\s+/g, "_");
}

function hashStringToStableNegativeInt(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }

  const normalizedHash = Math.abs(hash) || 1;
  return normalizedHash * -1;
}

function sanitizeManualLegendStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeManualFootballLegend(
  rawLegend: ManualFootballLegend,
): NormalizedManualFootballLegend | null {
  if (!rawLegend || typeof rawLegend.canonicalName !== "string") {
    return null;
  }

  const canonicalName = rawLegend.canonicalName.trim();
  if (!canonicalName) {
    return null;
  }

  const firstName = rawLegend.firstName?.trim() || null;
  const lastName = rawLegend.lastName?.trim() || null;
  const aliases = Array.from(
    new Set([
      canonicalName,
      ...sanitizeManualLegendStringArray(rawLegend.aliases),
    ]),
  );
  const clubs = sanitizeManualLegendStringArray(rawLegend.clubs);
  const notableTeams = sanitizeManualLegendStringArray(rawLegend.notableTeams);
  const trophies = sanitizeManualLegendStringArray(rawLegend.trophies);
  const achievements = sanitizeManualLegendStringArray(rawLegend.achievements);
  const slug = slugifyManualLegendName(canonicalName);
  const id = `fb_manual_legend_${slug}`;

  const player: Player = {
    id,
    sport: "football",
    apiId: hashStringToStableNegativeInt(slug),
    name: canonicalName,
    firstName,
    lastName,
    nationality: rawLegend.nationality?.trim() || null,
    birthDate: null,
    birthCountry: rawLegend.nationality?.trim() || null,
    age: null,
    height: null,
    weight: null,
    position: rawLegend.position?.trim() || null,
    photo: null,
    injured: false,
  };

  return {
    id,
    sport: "football",
    canonicalName,
    aliases,
    nationality: player.nationality,
    position: player.position,
    era: rawLegend.era?.trim() || null,
    clubs,
    notableTeams,
    trophies,
    achievements,
    firstName,
    lastName,
    initials2: rawLegend.initials2 ?? getPlayerInitials(canonicalName, 2),
    initials3: rawLegend.initials3 ?? getPlayerInitials(canonicalName, 3),
    survivalTier: rawLegend.survivalTier === "B" ? "B" : "A",
    whoAmIEligibleHint: rawLegend.whoAmIEligible ?? true,
    notes: rawLegend.notes?.trim() || null,
    player,
  };
}

function loadManualFootballLegends(): NormalizedManualFootballLegend[] {
  if (!fs.existsSync(MANUAL_FOOTBALL_LEGENDS_PATH)) {
    return [];
  }

  try {
    const raw = JSON.parse(
      fs.readFileSync(MANUAL_FOOTBALL_LEGENDS_PATH, "utf-8"),
    ) as unknown;
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .map((entry) => normalizeManualFootballLegend(entry as ManualFootballLegend))
      .filter(
        (legend): legend is NormalizedManualFootballLegend => legend !== null,
      )
      .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName));
  } catch (error) {
    console.warn(
      `Warning: failed to load manual football legends from ${MANUAL_FOOTBALL_LEGENDS_PATH}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

function getFinalFootballIdentityResolution(
  seedName: string,
): FinalIdentityResolution | undefined {
  return FINAL_FOOTBALL_IDENTITY_RESOLUTION_MAP.get(
    normalizeNameForMatch(seedName),
  );
}

function findPreferredExistingPlayerForFinalResolution(
  resolution: FinalIdentityResolution,
  footballPlayers: Player[],
): Player | null {
  let candidates = [...footballPlayers];

  if (resolution.preferredApiId != null) {
    candidates = candidates.filter(
      (player) => player.apiId === resolution.preferredApiId,
    );
  }

  if (resolution.preferredExactName) {
    const normalizedPreferredExactName = normalizeNameForMatch(
      resolution.preferredExactName,
    );
    candidates = candidates.filter((player) =>
      getExistingPlayerCandidateNames(player).some(
        (candidateName) =>
          normalizeNameForMatch(candidateName) === normalizedPreferredExactName,
      ),
    );
  }

  return candidates.length === 1 ? candidates[0] : null;
}

function resolveCoverageWithManualFootballLegends(
  coverage: HeadlineCoverageEntry[],
  footballPlayers: Player[],
  manualLegends: NormalizedManualFootballLegend[],
): HeadlineCoverageEntry[] {
  const manualLegendByNormalizedName = new Map<string, NormalizedManualFootballLegend>();
  for (const legend of manualLegends) {
    for (const alias of [legend.canonicalName, ...legend.aliases]) {
      const normalizedAlias = normalizeNameForMatch(alias);
      if (normalizedAlias && !manualLegendByNormalizedName.has(normalizedAlias)) {
        manualLegendByNormalizedName.set(normalizedAlias, legend);
      }
    }
  }

  return coverage.map((entry) => {
    const annotatedEntry = annotateHeadlineCoverageEntry(entry);
    const seed = getFootballHeadlineSeedByName(annotatedEntry.seedName);

    if (annotatedEntry.status !== "missing" && annotatedEntry.status !== "ambiguous") {
      return annotatedEntry;
    }

    const finalIdentityResolution = getFinalFootballIdentityResolution(
      annotatedEntry.seedName,
    );
    if (finalIdentityResolution) {
      if (finalIdentityResolution.resolutionType === "preferred_existing") {
        const preferredPlayer = findPreferredExistingPlayerForFinalResolution(
          finalIdentityResolution,
          footballPlayers,
        );

        if (preferredPlayer) {
          return annotateHeadlineCoverageEntry({
            ...annotatedEntry,
            status: "matched_existing",
            matchedPlayerId: preferredPlayer.id,
            matchedPlayerName: preferredPlayer.name,
            notes:
              finalIdentityResolution.notes ||
              "resolved via preferred existing identity",
            matchConfidence: null,
            matchedAlias: finalIdentityResolution.preferredExactName || preferredPlayer.name,
            overrideUsed: true,
          });
        }
      }

      if (finalIdentityResolution.resolutionType === "manual_layer") {
        const manualLegend = manualLegendByNormalizedName.get(
          annotatedEntry.normalizedSeedName,
        );

        if (manualLegend) {
          return annotateHeadlineCoverageEntry({
            ...annotatedEntry,
            status: "matched_manual_layer",
            matchedPlayerId: manualLegend.id,
            matchedPlayerName: manualLegend.canonicalName,
            notes:
              finalIdentityResolution.notes || "resolved via manual legends layer",
            matchConfidence: null,
            matchedAlias: manualLegend.canonicalName,
            overrideUsed: false,
          });
        }
      }
    }

    if (
      !seed ||
      seed.era !== "historical" ||
      (annotatedEntry.status !== "missing" && annotatedEntry.status !== "ambiguous")
    ) {
      return annotatedEntry;
    }

    const manualLegend = manualLegendByNormalizedName.get(
      annotatedEntry.normalizedSeedName,
    );
    if (!manualLegend) {
      return annotatedEntry;
    }

    return annotateHeadlineCoverageEntry({
      ...annotatedEntry,
      status: "matched_manual_layer",
      matchedPlayerId: manualLegend.id,
      matchedPlayerName: manualLegend.canonicalName,
      notes: "resolved via manual legends layer",
      matchConfidence: null,
      matchedAlias: manualLegend.canonicalName,
      overrideUsed: false,
    });
  });
}

function applyConfigDefaults(config: PipelineConfig): PipelineConfig {
  const football = config.football || ({} as FootballConfig);
  const features = config.features || ({} as FeaturesConfig);

  return {
    ...config,
    football: {
      ...football,
      enableHeadlineGapFill:
        football.enableHeadlineGapFill ??
        DEFAULT_FOOTBALL_CONFIG_FIELDS.enableHeadlineGapFill,
      headlineGapFillLimit:
        football.headlineGapFillLimit ??
        DEFAULT_FOOTBALL_CONFIG_FIELDS.headlineGapFillLimit,
      headlineProfilesMaxPages:
        football.headlineProfilesMaxPages ??
        DEFAULT_FOOTBALL_CONFIG_FIELDS.headlineProfilesMaxPages,
    },
    features: {
      ...features,
      buildPlayerQualityProfiles:
        features.buildPlayerQualityProfiles ??
        DEFAULT_FEATURE_CONFIG_FIELDS.buildPlayerQualityProfiles,
      buildFootballSurvivalIndex:
        features.buildFootballSurvivalIndex ??
        DEFAULT_FEATURE_CONFIG_FIELDS.buildFootballSurvivalIndex,
      buildFootballCoverageReport:
        features.buildFootballCoverageReport ??
        DEFAULT_FEATURE_CONFIG_FIELDS.buildFootballCoverageReport,
    },
  };
}

function isEliteCompetitionLeagueId(leagueId: string): boolean {
  const numericLeagueId = parseInt(leagueId.replace(/^fb_/, ""), 10);
  return FOOTBALL_ELITE_COMPETITION_IDS.has(numericLeagueId);
}

function getRecentFootballSeasons(config: FootballConfig): number[] {
  return Array.from(
    new Set([
      ...config.seasons,
      ...config.topPlayerSeasons,
      ...config.squadSeasons,
    ]),
  )
    .sort((a, b) => b - a)
    .slice(0, FOOTBALL_RECENT_SEASONS_COUNT);
}

function extractFootballLeagueCoverage(rawLeague: any): Map<number, FootballSeasonCoverage> {
  const seasonCoverage = new Map<number, FootballSeasonCoverage>();

  for (const season of rawLeague?.seasons || []) {
    if (!season?.year) continue;
    const coverage = season.coverage || {};
    seasonCoverage.set(season.year, {
      players:
        typeof coverage.players === "boolean" ? coverage.players : undefined,
      topScorers:
        typeof coverage.top_scorers === "boolean"
          ? coverage.top_scorers
          : undefined,
      topAssists:
        typeof coverage.top_assists === "boolean"
          ? coverage.top_assists
          : undefined,
      standings:
        typeof coverage.standings === "boolean"
          ? coverage.standings
          : undefined,
      fixtures:
        typeof coverage.fixtures?.events === "boolean"
          ? coverage.fixtures.events
          : typeof coverage.fixtures === "boolean"
            ? coverage.fixtures
            : undefined,
    });
  }

  return seasonCoverage;
}

function canUseLeagueCoverage(
  coverageByLeague: Map<number, Map<number, FootballSeasonCoverage>>,
  leagueId: number,
  season: number,
  requirement: FootballCoverageRequirement,
): boolean {
  const seasonCoverage = coverageByLeague.get(leagueId)?.get(season);
  const allowed = seasonCoverage?.[requirement];
  return allowed !== false;
}

function upsertRecordsById<T extends { id: string }>(records: T[]): T[] {
  const byId = new Map<string, T>();
  for (const record of records) {
    byId.set(record.id, record);
  }
  return Array.from(byId.values());
}

function scorePlayerTeamSeasonCompleteness(record: PlayerTeamSeason): number {
  const fields = [
    record.position,
    record.appearances,
    record.minutes,
    record.goals,
    record.assists,
    record.cardsYellow,
    record.cardsRed,
    record.rating,
    record.points,
    record.rebounds,
    record.steals,
    record.blocks,
  ];
  return fields.filter((value) => value !== null && value !== undefined).length;
}

function mergePlayerTeamSeasonRecords(
  records: PlayerTeamSeason[],
): PlayerTeamSeason[] {
  const byId = new Map<string, PlayerTeamSeason>();
  for (const record of records) {
    const existing = byId.get(record.id);
    if (
      !existing ||
      scorePlayerTeamSeasonCompleteness(record) >=
        scorePlayerTeamSeasonCompleteness(existing)
    ) {
      byId.set(record.id, record);
    }
  }
  return Array.from(byId.values());
}

function scoreTeamCompleteness(team: Team): number {
  const fields = [team.shortName, team.logo, team.country, team.founded, team.venue];
  return fields.filter((value) => value !== null && value !== undefined).length;
}

function mergeTeamsByQuality(teams: Team[]): Team[] {
  const byId = new Map<string, Team>();
  for (const team of teams) {
    const existing = byId.get(team.id);
    if (!existing || scoreTeamCompleteness(team) >= scoreTeamCompleteness(existing)) {
      byId.set(team.id, team);
    }
  }
  return Array.from(byId.values());
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

async function fetchFootballPlayerProfiles(
  client: ApiClient,
  search: string,
  page: number = 1,
): Promise<any | null> {
  return client.get("/players/profiles", { search, page });
}

async function fetchFootballPlayerTeams(
  client: ApiClient,
  playerId: number,
): Promise<any[]> {
  const data = await client.get("/players/teams", { player: playerId });
  if (!data?.response) return [];
  return data.response;
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

function extractFootballTeamSeasons(raw: any): number[] {
  const seasonValues = new Set<number>();
  const candidates = [
    ...(Array.isArray(raw?.seasons) ? raw.seasons : []),
    ...(Array.isArray(raw?.statistics) ? raw.statistics : []),
    ...(Array.isArray(raw?.leagues) ? raw.leagues : []),
    raw?.season,
  ];

  for (const candidate of candidates) {
    const rawSeason =
      typeof candidate === "number"
        ? candidate
        : candidate?.year ?? candidate?.season ?? candidate?.league?.season;
    if (typeof rawSeason === "number" && Number.isFinite(rawSeason)) {
      seasonValues.add(rawSeason);
    }
  }

  return Array.from(seasonValues).sort((a, b) => a - b);
}

function normalizeFootballPlayerTeamsResponse(
  player: Player,
  rawTeams: any[],
): { pts: PlayerTeamSeason[]; discoveredTeams: Team[] } {
  const pts: PlayerTeamSeason[] = [];
  const discoveredTeams: Team[] = [];

  for (const raw of rawTeams) {
    const team = raw?.team || raw;
    if (!team?.id || !team?.name) continue;

    const seasons = extractFootballTeamSeasons(raw);
    const leagueId = raw?.league?.id ? `fb_${raw.league.id}` : "";

    if (seasons.length === 0) {
      discoveredTeams.push({
        id: `fb_team_${team.id}`,
        sport: "football",
        apiId: team.id,
        name: team.name,
        shortName: team.code || null,
        logo: team.logo || null,
        country: team.country || null,
        leagueId,
        season: 0,
        founded: null,
        venue: null,
      });
      continue;
    }

    for (const season of seasons) {
      discoveredTeams.push({
        id: `fb_team_${team.id}`,
        sport: "football",
        apiId: team.id,
        name: team.name,
        shortName: team.code || null,
        logo: team.logo || null,
        country: team.country || null,
        leagueId,
        season,
        founded: null,
        venue: null,
      });

      pts.push({
        id: `${player.id}_team_${team.id}_${season}`,
        playerId: player.id,
        teamId: `fb_team_${team.id}`,
        leagueId,
        season,
        position: player.position,
        appearances: null,
        minutes: null,
        goals: null,
        assists: null,
        cardsYellow: null,
        cardsRed: null,
        rating: null,
        points: null,
        rebounds: null,
        steals: null,
        blocks: null,
      });
    }
  }

  return {
    pts: mergePlayerTeamSeasonRecords(pts),
    discoveredTeams: mergeTeamsByQuality(discoveredTeams),
  };
}

interface HeadlineCandidateEvaluation<T> {
  item: T;
  candidateNames: string[];
  displayName: string;
  apiId: number | null;
  features: NameMatchFeatures;
  overrideUsed: boolean;
  overrideNotes?: string | null;
}

function buildAbbreviationExpandedNameVariant(
  displayName: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  if (!displayName || !firstName || !lastName) {
    return "";
  }

  const normalizedDisplayTokens = tokenizeNormalizedName(displayName);
  const shouldExpand =
    isAbbreviatedName(displayName) || normalizedDisplayTokens.length <= 1;

  if (!shouldExpand) {
    return "";
  }

  const firstToken = firstName.trim().split(/\s+/)[0];
  const lastNameTokens = lastName.trim().split(/\s+/).filter(Boolean);
  if (!firstToken || lastNameTokens.length === 0) {
    return "";
  }

  const condensedLastNameTokens = [lastNameTokens[0]];
  const normalizedFirstLastToken = normalizeNameForMatch(lastNameTokens[0]);
  if (
    NAME_PARTICLE_TOKENS.has(normalizedFirstLastToken) &&
    lastNameTokens.length > 1
  ) {
    condensedLastNameTokens.push(lastNameTokens[1]);
  }

  return `${firstToken} ${condensedLastNameTokens.join(" ")}`.trim();
}

function getExistingPlayerCandidateNames(player: Player): string[] {
  const firstNameTokens = tokenizeNormalizedName(player.firstName || "");
  const primaryFirstName = firstNameTokens[0]
    ? `${player.firstName!.trim().split(/\s+/)[0]} ${player.lastName || ""}`.trim()
    : "";
  const abbreviationExpandedName = buildAbbreviationExpandedNameVariant(
    player.name,
    player.firstName,
    player.lastName,
  );

  return Array.from(
    new Set(
      [
        player.name,
        `${player.firstName || ""} ${player.lastName || ""}`.trim(),
        primaryFirstName,
        abbreviationExpandedName,
      ].filter((name): name is string => Boolean(name && name.trim())),
    ),
  );
}

function getFootballProfileCandidateNames(rawProfile: any): string[] {
  const player = rawProfile?.player || rawProfile || {};
  const firstNameTokens = tokenizeNormalizedName(player.firstname || "");
  const primaryFirstName = firstNameTokens[0]
    ? `${String(player.firstname).trim().split(/\s+/)[0]} ${player.lastname || ""}`.trim()
    : "";
  const abbreviationExpandedName = buildAbbreviationExpandedNameVariant(
    player.name,
    player.firstname,
    player.lastname,
  );
  return Array.from(
    new Set(
      [
        player.name || "",
        `${player.firstname || ""} ${player.lastname || ""}`.trim(),
        primaryFirstName,
        abbreviationExpandedName,
      ].filter((name): name is string => Boolean(name && name.trim())),
    ),
  );
}

function isAcceptableHeadlineMatch(
  features: NameMatchFeatures,
  source: "existing" | "profiles",
): boolean {
  if (features.confidence === "exact" || features.confidence === "alias") {
    return true;
  }

  if (features.confidence !== "strong") {
    return false;
  }

  return (
    !features.falsePositiveSafetyRejected &&
    features.extraUnrelatedTokens.length === 0 &&
    features.score >= (source === "profiles" ? 185 : 170)
  );
}

function describeRejectedHeadlineCandidate(
  features: NameMatchFeatures | null,
  seed: FootballHeadlineSeed,
): string | null {
  if (!features) {
    return "No plausible candidate found";
  }

  if (features.falsePositiveSafetyRejected || features.extraUnrelatedTokens.length > 0) {
    return `rejected candidate due to extra unrelated tokens: ${features.candidateName}`;
  }

  if (features.forbiddenTokenHit) {
    return `rejected candidate due to forbidden tokens: ${features.candidateName}`;
  }

  if (!features.requiredTokensSatisfied) {
    return `required tokens not satisfied for ${seed.canonicalName}`;
  }

  if (seed.allowMononym && tokenizeNormalizedName(seed.canonicalName).length === 1) {
    return "ambiguous mononym";
  }

  if (features.confidence === "weak") {
    return `candidate too weak for safe acceptance: ${features.candidateName}`;
  }

  return "No safe headline match found";
}

function buildAcceptedHeadlineMatchNote(
  evaluation: HeadlineCandidateEvaluation<any>,
  source: "existing" | "profiles",
): string {
  const sourceLabel = source === "existing" ? "matched existing" : "matched profile";

  if (evaluation.overrideUsed) {
    if (evaluation.overrideNotes) {
      return `override used (${evaluation.displayName}): ${evaluation.overrideNotes}`;
    }
    return `override used (${evaluation.displayName})`;
  }

  if (evaluation.features.confidence === "alias") {
    return `matched via alias: ${evaluation.displayName}`;
  }

  if (evaluation.features.abbreviationCompatibility || isAbbreviatedName(evaluation.displayName)) {
    return `${sourceLabel} via abbreviation-compatible candidate: ${evaluation.displayName}`;
  }

  if (normalizeNameForMatch(evaluation.displayName) !== evaluation.features.candidateNormalized) {
    return `${sourceLabel} via full-name fields: ${evaluation.displayName}`;
  }

  return `${sourceLabel} via ${evaluation.features.confidence} candidate: ${evaluation.displayName}`;
}

function applyHeadlineSeedOverride<T>(
  seed: FootballHeadlineSeed,
  evaluations: HeadlineCandidateEvaluation<T>[],
): HeadlineCandidateEvaluation<T> | null {
  const override = getHeadlineSeedOverride(seed);
  if (!override) {
    return null;
  }

  const preferredExactName = override.preferredExactName
    ? normalizeNameForMatch(override.preferredExactName)
    : null;
  const allowedExactNames = new Set(
    (override.allowedExactNames || []).map((name) => normalizeNameForMatch(name)),
  );
  const allowedAliases = new Set(
    (override.allowedAliases || []).map((alias) => normalizeNameForMatch(alias)),
  );

  const doesEvaluationMatchOverride = (
    evaluation: HeadlineCandidateEvaluation<T>,
  ): boolean => {
    if (override.preferredApiId != null && evaluation.apiId !== override.preferredApiId) {
      return false;
    }

    const normalizedCandidateNames = evaluation.candidateNames.map((candidateName) =>
      normalizeNameForMatch(candidateName),
    );
    const matchedAlias = normalizeNameForMatch(evaluation.features.matchedAlias);

    if (
      preferredExactName &&
      normalizedCandidateNames.includes(preferredExactName)
    ) {
      return true;
    }

    if (
      allowedExactNames.size > 0 &&
      normalizedCandidateNames.some((candidateName) => allowedExactNames.has(candidateName))
    ) {
      return true;
    }

    if (allowedAliases.size > 0 && allowedAliases.has(matchedAlias)) {
      return true;
    }

    return (
      override.preferredApiId != null &&
      !preferredExactName &&
      allowedExactNames.size === 0 &&
      allowedAliases.size === 0
    );
  };

  for (const evaluation of evaluations) {
    if (doesEvaluationMatchOverride(evaluation)) {
      evaluation.overrideUsed = true;
      evaluation.overrideNotes = override.notes || null;
      return evaluation;
    }
  }

  return null;
}

function resolveHeadlineSeedMatch<T>(params: {
  seed: FootballHeadlineSeed;
  items: T[];
  source: "existing" | "profiles";
  getCandidateNames: (item: T) => string[];
  getDisplayName: (item: T) => string;
  getApiId: (item: T) => number | null;
}): {
  status: "matched" | "ambiguous" | "missing";
  evaluation: HeadlineCandidateEvaluation<T> | null;
  notes: string | null;
} {
  const allEvaluations = params.items
    .map((item) => {
      const candidateNames = params.getCandidateNames(item);
      const bestFeatures = candidateNames
        .map((candidateName) => computeNameMatchFeatures(params.seed, candidateName))
        .sort(
          (a, b) =>
            getMatchConfidenceRank(b.confidence) - getMatchConfidenceRank(a.confidence) ||
            b.score - a.score ||
            a.candidateName.localeCompare(b.candidateName),
        )[0];

      if (!bestFeatures) {
        return null;
      }

      return {
        item,
        candidateNames,
        displayName: params.getDisplayName(item),
        apiId: params.getApiId(item),
        features: bestFeatures,
        overrideUsed: false,
      };
    })
    .filter(
      (evaluation): evaluation is HeadlineCandidateEvaluation<T> => evaluation !== null,
    )
    .sort(
      (a, b) =>
        getMatchConfidenceRank(b.features.confidence) - getMatchConfidenceRank(a.features.confidence) ||
        b.features.score - a.features.score ||
        a.displayName.localeCompare(b.displayName),
    );

  const acceptedEvaluations = allEvaluations.filter((evaluation) =>
    isAcceptableHeadlineMatch(evaluation.features, params.source),
  );

  const overrideEvaluation = applyHeadlineSeedOverride(
    params.seed,
    acceptedEvaluations,
  );
  if (overrideEvaluation) {
    return {
      status: "matched",
      evaluation: overrideEvaluation,
      notes: buildAcceptedHeadlineMatchNote(overrideEvaluation, params.source),
    };
  }

  const targetedRecoveryEvaluation = applyHeadlineSeedOverride(
    params.seed,
    allEvaluations,
  );
  if (targetedRecoveryEvaluation) {
    return {
      status: "matched",
      evaluation: targetedRecoveryEvaluation,
      notes: buildAcceptedHeadlineMatchNote(
        targetedRecoveryEvaluation,
        params.source,
      ),
    };
  }

  if (acceptedEvaluations.length === 0) {
    return {
      status: "missing",
      evaluation: null,
      notes: describeRejectedHeadlineCandidate(
        allEvaluations[0]?.features ?? null,
        params.seed,
      ),
    };
  }

  const topEvaluation = acceptedEvaluations[0];
  const secondEvaluation = acceptedEvaluations[1];

  if (secondEvaluation) {
    const topRank = getMatchConfidenceRank(topEvaluation.features.confidence);
    const secondRank = getMatchConfidenceRank(secondEvaluation.features.confidence);
    const scoreGap = topEvaluation.features.score - secondEvaluation.features.score;

    if (
      (topRank === secondRank && scoreGap < 15) ||
      (topEvaluation.features.confidence === "strong" && scoreGap < 25)
    ) {
      return {
        status: "ambiguous",
        evaluation: null,
        notes: params.seed.allowMononym && tokenizeNormalizedName(params.seed.canonicalName).length === 1
          ? "ambiguous mononym"
          : `candidate score too close to second best (${topEvaluation.displayName} vs ${secondEvaluation.displayName})`,
      };
    }
  }

  return {
    status: "matched",
    evaluation: topEvaluation,
    notes: buildAcceptedHeadlineMatchNote(topEvaluation, params.source),
  };
}

function buildInitialHeadlineCoverage(
  footballPlayers: Player[],
): HeadlineCoverageEntry[] {
  return FOOTBALL_HEADLINE_SEEDS.map((seed) => {
    const resolution = resolveHeadlineSeedMatch({
      seed,
      items: footballPlayers,
      source: "existing",
      getCandidateNames: getExistingPlayerCandidateNames,
      getDisplayName: (player) => player.name,
      getApiId: (player) => player.apiId,
    });

    if (resolution.status === "matched" && resolution.evaluation) {
      return annotateHeadlineCoverageEntry({
        seedName: seed.canonicalName,
        normalizedSeedName: normalizeNameForMatch(seed.canonicalName),
        status: "matched_existing",
        matchedPlayerId: resolution.evaluation.item.id,
        matchedPlayerName: resolution.evaluation.item.name,
        notes: resolution.notes,
        matchConfidence: resolution.evaluation.features.confidence,
        matchedAlias: resolution.evaluation.features.matchedAlias,
        overrideUsed: resolution.evaluation.overrideUsed,
      });
    }

    return annotateHeadlineCoverageEntry({
      seedName: seed.canonicalName,
      normalizedSeedName: normalizeNameForMatch(seed.canonicalName),
      status: resolution.status === "ambiguous" ? "ambiguous" : "missing",
      matchedPlayerId: null,
      matchedPlayerName: null,
      notes: resolution.notes,
      matchConfidence: null,
      matchedAlias: null,
      overrideUsed: false,
    });
  });
}

function getFootballHeadlineSeedByName(
  seedName: string,
): FootballHeadlineSeed | undefined {
  const normalizedSeedName = normalizeNameForMatch(seedName);
  return FOOTBALL_HEADLINE_SEEDS.find(
    (seed) => normalizeNameForMatch(seed.canonicalName) === normalizedSeedName,
  );
}

function getHeadlineCoveragePriorityRank(priority: CoveragePriority): number {
  switch (priority) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

function getHeadlineSeedEraRank(era: HeadlineSeedEra): number {
  switch (era) {
    case "current":
      return 0;
    case "recent":
      return 1;
    case "historical":
      return 2;
    default:
      return 3;
  }
}

function classifyFootballCoverageBucket(
  entry: Pick<
    HeadlineCoverageEntry,
    "status" | "notes" | "overrideUsed"
  >,
  seed?: FootballHeadlineSeed,
): CoverageBucket {
  if (entry.status === "matched_manual_layer") {
    return "matched_manual_layer";
  }

  if (entry.overrideUsed) {
    return "matched_override";
  }

  if (entry.status === "matched_existing" || entry.status === "gap_filled") {
    return "matched_existing";
  }

  if (entry.status === "ambiguous") {
    if (seed?.allowMononym || entry.notes === "ambiguous mononym") {
      return "ambiguous_mononym";
    }

    return "ambiguous_duplicate_legend";
  }

  if (seed?.era === "current" && (seed.priority === "critical" || seed.priority === "high")) {
    return "missing_current_star";
  }

  if (seed?.era === "recent") {
    return "missing_recent_star";
  }

  if (seed?.era === "historical") {
    if (
      seed.priority === "low" &&
      (!entry.notes || entry.notes === "No plausible candidate found")
    ) {
      return "missing_out_of_scope";
    }

    return "missing_historical_legend";
  }

  return "missing_unresolved";
}

function annotateHeadlineCoverageEntry(
  entry: Omit<HeadlineCoverageEntry, "priority" | "coverageBucket"> &
    Partial<Pick<HeadlineCoverageEntry, "priority" | "coverageBucket">>,
): HeadlineCoverageEntry {
  const seed = getFootballHeadlineSeedByName(entry.seedName);
  const priority = entry.priority ?? seed?.priority ?? "medium";
  const coverageBucket = classifyFootballCoverageBucket(entry, seed);

  return {
    ...entry,
    priority,
    coverageBucket,
  };
}

function sortHeadlineCoverageEntries(
  coverage: HeadlineCoverageEntry[],
): HeadlineCoverageEntry[] {
  return [...coverage].sort((a, b) => {
    const seedA = getFootballHeadlineSeedByName(a.seedName);
    const seedB = getFootballHeadlineSeedByName(b.seedName);

    const groupA =
      a.coverageBucket === "missing_current_star"
        ? 0
        : a.status === "ambiguous" && seedA?.era !== "historical"
          ? 1
          : a.coverageBucket === "missing_recent_star"
            ? 2
            : a.coverageBucket === "missing_historical_legend" ||
                a.coverageBucket === "missing_out_of_scope"
              ? 3
              : a.coverageBucket === "matched_existing" ||
                  a.coverageBucket === "matched_override" ||
                  a.coverageBucket === "matched_manual_layer"
                ? 4
                : 5;

    const groupB =
      b.coverageBucket === "missing_current_star"
        ? 0
        : b.status === "ambiguous" && seedB?.era !== "historical"
          ? 1
          : b.coverageBucket === "missing_recent_star"
            ? 2
            : b.coverageBucket === "missing_historical_legend" ||
                b.coverageBucket === "missing_out_of_scope"
              ? 3
              : b.coverageBucket === "matched_existing" ||
                  b.coverageBucket === "matched_override" ||
                  b.coverageBucket === "matched_manual_layer"
                ? 4
                : 5;

    return (
      groupA - groupB ||
      getHeadlineCoveragePriorityRank(a.priority) -
        getHeadlineCoveragePriorityRank(b.priority) ||
      getHeadlineSeedEraRank(seedA?.era ?? "historical") -
        getHeadlineSeedEraRank(seedB?.era ?? "historical") ||
      a.seedName.localeCompare(b.seedName)
    );
  });
}

function buildSortedCoverageNameList(
  coverage: HeadlineCoverageEntry[],
): string[] {
  return sortHeadlineCoverageEntries(coverage).map((entry) => entry.seedName);
}

function getHeadlineSeedSearchQueries(seed: FootballHeadlineSeed): string[] {
  const uniqueQueries = Array.from(new Set([seed.canonicalName, ...seed.aliases]));
  const multiTokenQueries = uniqueQueries.filter(
    (query) => tokenizeNormalizedName(query).length > 1 && !isAbbreviatedName(query),
  );
  const abbreviatedQueries = uniqueQueries.filter(
    (query) => isAbbreviatedName(query),
  );
  const mononymQueries = uniqueQueries.filter(
    (query) => tokenizeNormalizedName(query).length === 1,
  );

  return Array.from(
    new Set([
      ...multiTokenQueries,
      ...abbreviatedQueries.slice(0, 1),
      ...(seed.allowMononym ? mononymQueries : []),
    ]),
  ).slice(0, 3);
}

function rankFootballPlayersForEnrichment(
  footballPlayers: Player[],
  footballPts: PlayerTeamSeason[],
  config: FootballConfig,
  coverage: HeadlineCoverageEntry[],
  limit: number,
): [string, number][] {
  const profiles = buildFootballPlayerQualityProfiles(
    footballPlayers,
    footballPts,
    [],
    [],
    [],
    [],
    config,
    coverage,
  );

  return profiles
    .sort((a, b) => b.playabilityScore - a.playabilityScore)
    .slice(0, limit)
    .map((profile) => [profile.playerId, profile.playabilityScore]);
}

async function runFootballHeadlineGapFill(params: {
  client: ApiClient;
  footballPlayers: Player[];
  footballPts: PlayerTeamSeason[];
  footballTeams: Team[];
  config: FootballConfig;
  coverage: HeadlineCoverageEntry[];
  dryRun: boolean;
}): Promise<{
  players: Player[];
  pts: PlayerTeamSeason[];
  teams: Team[];
  coverage: HeadlineCoverageEntry[];
}> {
  const coverage = params.coverage.map((entry) => ({ ...annotateHeadlineCoverageEntry(entry) }));
  let players = [...params.footballPlayers];
  let pts = [...params.footballPts];
  let teams = [...params.footballTeams];

  if (!params.config.enableHeadlineGapFill) {
    return {
      players,
      pts,
      teams,
      coverage: coverage.map((entry) => annotateHeadlineCoverageEntry(entry)),
    };
  }

  let gapFillCount = 0;
  const gapFillLimit = params.config.headlineGapFillLimit ?? 0;
  const maxPages = Math.max(1, params.config.headlineProfilesMaxPages ?? 1);

  for (const entry of coverage) {
    if (entry.status !== "missing") continue;
    if (gapFillCount >= gapFillLimit) {
      entry.notes = entry.notes || "Gap-fill limit reached";
      continue;
    }

    const seed = getFootballHeadlineSeedByName(entry.seedName);
    if (!seed) {
      entry.notes = entry.notes || "Missing headline seed config";
      continue;
    }

    const searchResultsByApiId = new Map<number | string, any>();

    for (const query of getHeadlineSeedSearchQueries(seed)) {
      let totalPages = 1;

      for (let page = 1; page <= totalPages && page <= maxPages; page++) {
        if (!params.dryRun && !params.client.getBudget().canMakeCall()) {
          entry.notes = "Budget exhausted before gap-fill lookup";
          return {
            players,
            pts,
            teams,
            coverage: coverage.map((item) => annotateHeadlineCoverageEntry(item)),
          };
        }

        const data = await fetchFootballPlayerProfiles(params.client, query, page);

        if (!data) {
          break;
        }

        totalPages = Math.min(maxPages, data?.paging?.total || 1);
        if (Array.isArray(data.response)) {
          for (const rawProfile of data.response) {
            const apiId = rawProfile?.player?.id || rawProfile?.id || `${query}:${page}:${searchResultsByApiId.size}`;
            if (!searchResultsByApiId.has(apiId)) {
              searchResultsByApiId.set(apiId, rawProfile);
            }
          }
        }
      }
    }

    const selection = resolveHeadlineSeedMatch({
      seed,
      items: Array.from(searchResultsByApiId.values()),
      source: "profiles",
      getCandidateNames: getFootballProfileCandidateNames,
      getDisplayName: (rawProfile) => rawProfile?.player?.name || rawProfile?.name || "Unknown",
      getApiId: (rawProfile) => rawProfile?.player?.id || rawProfile?.id || null,
    });

    if (selection.status === "missing") {
      entry.notes = selection.notes;
      continue;
    }

    if (selection.status === "ambiguous") {
      entry.status = "ambiguous";
      entry.notes = selection.notes;
      continue;
    }

    const selectedRawProfile = selection.evaluation?.item;
    if (!selectedRawProfile) {
      entry.notes = selection.notes || "No selected profile candidate";
      continue;
    }

    const normalized = normalizeFootballPlayer(selectedRawProfile);
    players = upsertRecordsById([...players, normalized.player]);
    pts = mergePlayerTeamSeasonRecords([...pts, ...normalized.pts]);
    teams = mergeTeamsByQuality([...teams, ...normalized.discoveredTeams]);

    if (!params.dryRun && !params.client.getBudget().canMakeCall()) {
      entry.status = "gap_filled";
      entry.matchedPlayerId = normalized.player.id;
      entry.matchedPlayerName = normalized.player.name;
      entry.notes = `${selection.notes}; teams lookup skipped due to budget`;
      entry.matchConfidence = selection.evaluation?.features.confidence || null;
      entry.matchedAlias = selection.evaluation?.features.matchedAlias || null;
      entry.overrideUsed = selection.evaluation?.overrideUsed || false;
      gapFillCount++;
      continue;
    }

    const rawTeams = await fetchFootballPlayerTeams(
      params.client,
      normalized.player.apiId,
    );
    const playerTeams = normalizeFootballPlayerTeamsResponse(
      normalized.player,
      rawTeams,
    );

    pts = mergePlayerTeamSeasonRecords([...pts, ...playerTeams.pts]);
    teams = mergeTeamsByQuality([...teams, ...playerTeams.discoveredTeams]);

    entry.status = "gap_filled";
    entry.matchedPlayerId = normalized.player.id;
    entry.matchedPlayerName = normalized.player.name;
    entry.notes = selection.notes;
    entry.matchConfidence = selection.evaluation?.features.confidence || null;
    entry.matchedAlias = selection.evaluation?.features.matchedAlias || null;
    entry.overrideUsed = selection.evaluation?.overrideUsed || false;
    gapFillCount++;
  }

  return {
    players,
    pts,
    teams,
    coverage: coverage.map((entry) => annotateHeadlineCoverageEntry(entry)),
  };
}

function getFootballBucketSizeScore(totalPlayers: number): number {
  if (totalPlayers === 1) return -15;
  if (totalPlayers >= 2 && totalPlayers <= 12) return 15;
  if (totalPlayers >= 13 && totalPlayers <= 25) return 10;
  if (totalPlayers >= 26 && totalPlayers <= 50) return 5;
  if (totalPlayers >= 51 && totalPlayers <= 75) return 0;
  return -10;
}

function getFootballBucketNoisePenalty(
  totalPlayers: number,
  topPlayabilityScore: number,
  famousCount: number,
  playableRatio: number,
): number {
  if (totalPlayers >= 250 && topPlayabilityScore < 170) return -55;
  if (totalPlayers >= 150 && topPlayabilityScore < 150) return -35;
  if (totalPlayers >= 100 && famousCount === 0) return -25;
  if (totalPlayers >= 80 && playableRatio < 0.08) return -20;
  return 0;
}

function hasMeaningfulFootballStats(
  totalAppearances: number,
  totalMinutes: number,
  totalGoals: number,
  totalAssists: number,
): boolean {
  return (
    totalAppearances >= 15 ||
    totalMinutes >= 900 ||
    totalGoals >= 10 ||
    totalAssists >= 8 ||
    totalGoals + totalAssists >= 12
  );
}

function getFootballWhoAmISignalStrength(params: {
  playabilityScore: number;
  clueRichnessScore: number;
  metadataCompletenessScore: number;
  teamCount: number;
  trophyWins: number;
  transferCount: number;
  meaningfulStats: boolean;
  hasNationality: boolean;
  hasPosition: boolean;
  isHeadlineSeed: boolean;
  eliteCompetitionScore: number;
}): {
  signalCount: number;
  hasIdentitySignal: boolean;
  hasTeamSignal: boolean;
  hasTrophySignal: boolean;
  hasTransferSignal: boolean;
  hasStatSignal: boolean;
  qualifiesBase: boolean;
  qualifiesHeadlineFallback: boolean;
} {
  const hasIdentitySignal = params.hasNationality && params.hasPosition;
  const hasTeamSignal = params.teamCount >= 2;
  const hasTrophySignal = params.trophyWins > 0;
  const hasTransferSignal = params.transferCount > 0;
  const hasStatSignal = params.meaningfulStats;
  const signalCount = [
    hasIdentitySignal,
    hasTeamSignal,
    hasTrophySignal,
    hasTransferSignal,
    hasStatSignal,
  ].filter(Boolean).length;
  const qualifiesBase =
    params.playabilityScore >= FOOTBALL_WHO_AM_I_MIN_PLAYABILITY_SCORE &&
    params.clueRichnessScore >= FOOTBALL_WHO_AM_I_MIN_CLUE_RICHNESS_SCORE &&
    params.metadataCompletenessScore >= 8 &&
    hasTeamSignal &&
    (
      hasTrophySignal ||
      hasTransferSignal ||
      (hasStatSignal &&
        params.eliteCompetitionScore > 0 &&
        params.playabilityScore >= 90)
    );
  const qualifiesHeadlineFallback =
    !qualifiesBase &&
    params.isHeadlineSeed &&
    params.playabilityScore >= 120 &&
    params.clueRichnessScore >= FOOTBALL_WHO_AM_I_MIN_CLUE_RICHNESS_SCORE &&
    params.metadataCompletenessScore >= 8 &&
    signalCount >= FOOTBALL_WHO_AM_I_MIN_SIGNAL_COUNT &&
    (params.eliteCompetitionScore > 0 || hasTrophySignal || hasStatSignal);

  return {
    signalCount,
    hasIdentitySignal,
    hasTeamSignal,
    hasTrophySignal,
    hasTransferSignal,
    hasStatSignal,
    qualifiesBase,
    qualifiesHeadlineFallback,
  };
}

interface VerveGridQaCellStats {
  count: number;
  min: number;
  median: number;
  max: number;
}

interface VerveGridQaTemplateSummary {
  rowTripletsWithThreePlusSharedCols: number;
  distinctColumnTypeMixes: number;
}

interface VerveGridQaReport {
  generatedAt: string;
  sport: "football";
  raw: {
    totalEntries: number;
    easyEntries: number;
    mediumEntries: number;
    hardEntries: number;
    sameLabelCollisionCount: number;
  };
  approved: {
    totalEntries: number;
    sameLabelCollisionCount: number;
    axisFamilyCounts: Record<string, number>;
    cellSizeStatsByAxisFamily: Record<string, VerveGridQaCellStats>;
    templateCountsByRowTypeMix: Record<string, VerveGridQaTemplateSummary>;
  };
  curationImpact: {
    nationalityEntriesRemoved: number;
    nationalityLabelsRemoved: string[];
    nationalTeamEntriesRemoved: number;
    nationalTeamSameLabelCollisionsRemoved: number;
    positionNormalization: {
      entriesCollapsed: number;
      beforeCounts: Record<string, number>;
      afterCounts: Record<string, number>;
      mapping: Record<string, string>;
    };
  };
}

interface WhoAmIRejectedClue {
  sourceClueId: string;
  playerId: string;
  answerName: string;
  rawDifficulty: "easy" | "medium" | "hard";
  reasons: string[];
}

interface WhoAmIQaExample {
  playerId: string;
  answerName: string;
  rawDifficulty: "easy" | "medium" | "hard";
  approvedDifficulty?: "easy" | "medium" | "hard";
  reasons?: string[];
  rawClue1?: string;
  rawClue2?: string;
  rawClue3?: string;
  rawClue4?: string;
  approvedClue1?: string;
  approvedClue2?: string;
  approvedClue3?: string;
  approvedClue4?: string;
}

interface WhoAmIQaReport {
  generatedAt: string;
  sport: "football";
  raw: {
    totalClueSets: number;
    countsBySport: Record<string, number>;
    countsByDifficulty: Record<string, number>;
    lowSignalClueSets: number;
    nationalTeamLeakyClueSets: number;
    attackerGrammarIssues: number;
    trophyWordingIssues: number;
    transferClueSets: number;
    firstNameClueSets: number;
  };
  approved: {
    totalClueSets: number;
    countsBySport: Record<string, number>;
    countsByDifficulty: Record<string, number>;
    headlineClueSets: number;
    manualLegendClueSets: number;
    nationalTeamLeakyClueSets: number;
  };
  rejections: {
    totalRejected: number;
    byReason: Record<string, number>;
  };
  curationImpact: {
    approvedFromRawRate: number;
    rejectedFromRawRate: number;
    difficultyChangedCount: number;
    nationalTeamLabelsRemovedCount: number;
    transferClueReplacedCount: number;
    trophyTextNormalizedCount: number;
    attackerGrammarFixedCount: number;
  };
  examples: {
    rejected: WhoAmIQaExample[];
    difficultyChanged: WhoAmIQaExample[];
    textAdjusted: WhoAmIQaExample[];
  };
}

function getManualLegendTeamLabels(
  legend: NormalizedManualFootballLegend,
): string[] {
  return Array.from(new Set([...legend.clubs, ...legend.notableTeams]));
}

function getManualLegendClueDimensionCount(
  legend: NormalizedManualFootballLegend,
): number {
  return [
    Boolean(legend.nationality && legend.position),
    getManualLegendTeamLabels(legend).length > 0,
    legend.trophies.length > 0,
    legend.achievements.length > 0,
    Boolean(legend.era),
    Boolean(legend.firstName),
  ].filter(Boolean).length;
}

function buildManualFootballLegendQualityProfiles(
  manualLegends: NormalizedManualFootballLegend[],
  coverageByPlayerId: Map<string, HeadlineCoverageEntry>,
): PlayerQualityProfile[] {
  return manualLegends
    .map((legend) => {
      const coverageEntry = coverageByPlayerId.get(legend.id);
      const isHeadlineSeed = Boolean(coverageEntry);
      const teamLabels = getManualLegendTeamLabels(legend);
      const metadataCompletenessScore =
        (legend.firstName ? 4 : 0) +
        (legend.nationality ? 4 : 0) +
        (legend.position ? 4 : 0) +
        (teamLabels.length > 0 ? 3 : 0);
      const clueRichnessScore =
        (teamLabels.length >= 2 ? 8 : teamLabels.length === 1 ? 4 : 0) +
        (legend.trophies.length > 0 ? 6 : 0) +
        (legend.achievements.length > 0 ? 6 : 0) +
        (legend.era ? 4 : 0);
      const trophyScore = roundScore(legend.trophies.length * 8);
      const eliteCompetitionScore = roundScore(teamLabels.length * 4);
      const fameScore = roundScore(
        (legend.survivalTier === "A" ? 140 : 110) +
          trophyScore +
          eliteCompetitionScore +
          legend.achievements.length * 6 +
          (isHeadlineSeed ? 25 : 0),
      );
      const playabilityScore = roundScore(
        fameScore + metadataCompletenessScore + clueRichnessScore,
      );
      const whoAmIEligible =
        legend.whoAmIEligibleHint &&
        getManualLegendClueDimensionCount(legend) >= 3 &&
        metadataCompletenessScore >= 8;

      const reasons = ["manual_legend", "manual_layer", `tier_${legend.survivalTier.toLowerCase()}`];
      if (isHeadlineSeed) {
        reasons.push("headline_seed", "manual_layer_resolved");
      }
      if (whoAmIEligible) {
        reasons.push("whoami_curated");
      }

      return {
        id: `quality_${legend.id}`,
        sport: "football" as const,
        playerId: legend.id,
        playerName: legend.canonicalName,
        normalizedName: normalizeNameForMatch(legend.canonicalName),
        initials2: legend.initials2,
        initials3: legend.initials3,
        fameScore,
        playabilityScore,
        clueRichnessScore: roundScore(clueRichnessScore),
        metadataCompletenessScore: roundScore(metadataCompletenessScore),
        recentPresenceScore: 0,
        eliteCompetitionScore,
        transferScore: 0,
        trophyScore,
        totalAppearances: 0,
        totalMinutes: 0,
        totalGoals: 0,
        totalAssists: 0,
        teamCount: teamLabels.length,
        leagueCount: teamLabels.length > 0 ? 1 : 0,
        trophyWins: legend.trophies.length,
        transferCount: 0,
        hasPhoto: false,
        hasNationality: Boolean(legend.nationality),
        hasPosition: Boolean(legend.position),
        hasFirstName: Boolean(legend.firstName),
        isHeadlineSeed,
        wasGapFilled: false,
        matchedViaProfilesEndpoint: false,
        survivalTier: legend.survivalTier,
        survivalEligible: true,
        whoAmIEligible,
        higherLowerEligible: false,
        gridEligible: false,
        reasons,
      };
    })
    .sort(
      (a, b) =>
        b.playabilityScore - a.playabilityScore ||
        a.playerName.localeCompare(b.playerName),
    );
}

function buildFootballPlayerQualityProfiles(
  footballPlayers: Player[],
  footballPts: PlayerTeamSeason[],
  footballTrophies: PlayerTrophy[],
  footballTransfers: PlayerTransfer[],
  footballFixtures: Fixture[],
  footballFixtureParticipants: FixtureParticipant[],
  config: FootballConfig,
  coverage: HeadlineCoverageEntry[],
  manualLegends: NormalizedManualFootballLegend[] = [],
): PlayerQualityProfile[] {
  const qualityProfiles: PlayerQualityProfile[] = [];
  const recentSeasons = new Set(getRecentFootballSeasons(config));
  const coverageByPlayerId = new Map<string, HeadlineCoverageEntry>();
  const normalizedCoverage = coverage.map((entry) => annotateHeadlineCoverageEntry(entry));

  for (const entry of normalizedCoverage) {
    if (entry.matchedPlayerId) {
      coverageByPlayerId.set(entry.matchedPlayerId, entry);
    }
  }

  const ptsByPlayerId = new Map<string, PlayerTeamSeason[]>();
  for (const pts of footballPts) {
    if (!ptsByPlayerId.has(pts.playerId)) {
      ptsByPlayerId.set(pts.playerId, []);
    }
    ptsByPlayerId.get(pts.playerId)!.push(pts);
  }

  const trophiesByPlayerId = new Map<string, PlayerTrophy[]>();
  for (const trophy of footballTrophies) {
    if (!trophiesByPlayerId.has(trophy.playerId)) {
      trophiesByPlayerId.set(trophy.playerId, []);
    }
    trophiesByPlayerId.get(trophy.playerId)!.push(trophy);
  }

  const transfersByPlayerId = new Map<string, PlayerTransfer[]>();
  for (const transfer of footballTransfers) {
    if (!transfersByPlayerId.has(transfer.playerId)) {
      transfersByPlayerId.set(transfer.playerId, []);
    }
    transfersByPlayerId.get(transfer.playerId)!.push(transfer);
  }

  const fixtureSeasonById = new Map<string, number>();
  for (const fixture of footballFixtures) {
    fixtureSeasonById.set(fixture.id, fixture.season);
  }

  const recentFixturePresenceByPlayerId = new Map<string, number>();
  for (const participant of footballFixtureParticipants) {
    const fixtureSeason = fixtureSeasonById.get(participant.fixtureId);
    if (!fixtureSeason || !recentSeasons.has(fixtureSeason)) continue;
    recentFixturePresenceByPlayerId.set(
      participant.playerId,
      (recentFixturePresenceByPlayerId.get(participant.playerId) || 0) + 1,
    );
  }

  for (const player of footballPlayers) {
    const playerPts = ptsByPlayerId.get(player.id) || [];
    const playerTrophies = trophiesByPlayerId.get(player.id) || [];
    const playerTransfers = transfersByPlayerId.get(player.id) || [];
    const winningTrophies = playerTrophies.filter(
      (trophy) => trophy.place?.toLowerCase() === "winner",
    );
    const normalizedName = normalizeNameForMatch(player.name);
    const coverageEntry = coverageByPlayerId.get(player.id);
    const isHeadlineSeed = Boolean(coverageEntry);

    const totalAppearances = playerPts.reduce(
      (sum, pts) => sum + (pts.appearances || 0),
      0,
    );
    const totalMinutes = playerPts.reduce(
      (sum, pts) => sum + (pts.minutes || 0),
      0,
    );
    const totalGoals = playerPts.reduce(
      (sum, pts) => sum + (pts.goals || 0),
      0,
    );
    const totalAssists = playerPts.reduce(
      (sum, pts) => sum + (pts.assists || 0),
      0,
    );
    const teamCount = new Set(
      playerPts.map((pts) => pts.teamId).filter(Boolean),
    ).size;
    const leagueCount = new Set(
      playerPts.map((pts) => pts.leagueId).filter(Boolean),
    ).size;
    const trophyWins = winningTrophies.length;
    const transferCount = playerTransfers.length;
    const hasPhoto = Boolean(player.photo);
    const hasNationality = Boolean(player.nationality);
    const hasPosition = Boolean(player.position);
    const hasFirstName = Boolean(player.firstName);

    const eliteCompetitionAppearances = playerPts.reduce(
      (sum, pts) =>
        sum +
        (isEliteCompetitionLeagueId(pts.leagueId) ? pts.appearances || 0 : 0),
      0,
    );
    const recentAppearances = playerPts.reduce(
      (sum, pts) =>
        sum + (recentSeasons.has(pts.season) ? pts.appearances || 0 : 0),
      0,
    );
    const recentMinutes = playerPts.reduce(
      (sum, pts) =>
        sum + (recentSeasons.has(pts.season) ? pts.minutes || 0 : 0),
      0,
    );
    const recentFixturePresence =
      recentFixturePresenceByPlayerId.get(player.id) || 0;

    const metadataCompletenessScore =
      (hasFirstName ? 4 : 0) +
      (hasNationality ? 4 : 0) +
      (hasPosition ? 4 : 0) +
      (hasPhoto ? 3 : 0);

    const clueRichnessScore =
      (teamCount >= 2 ? 8 : teamCount === 1 ? 3 : 0) +
      (trophyWins > 0 ? 6 : 0) +
      (totalGoals > 0 ? 4 : 0) +
      (transferCount > 0 ? 4 : 0);

    const recentPresenceScore = roundScore(
      recentAppearances * 0.5 + recentMinutes / 300,
    );
    const eliteCompetitionScore = roundScore(eliteCompetitionAppearances * 2);
    const transferScore = roundScore(transferCount * 2);
    const trophyScore = roundScore(trophyWins * 8);

    const fameScore = roundScore(
      totalAppearances * 1 +
        Math.floor(totalMinutes / 90) * 0.25 +
        totalGoals * 4 +
        totalAssists * 3 +
        trophyWins * 8 +
        transferCount * 2 +
        eliteCompetitionAppearances * 2 +
        recentFixturePresence * 2 +
        (isHeadlineSeed ? 25 : 0),
    );

    const playabilityScore = roundScore(
      fameScore +
        metadataCompletenessScore +
        clueRichnessScore +
        recentPresenceScore,
    );
    const meaningfulStats = hasMeaningfulFootballStats(
      totalAppearances,
      totalMinutes,
      totalGoals,
      totalAssists,
    );
    const whoAmISignal = getFootballWhoAmISignalStrength({
      playabilityScore,
      clueRichnessScore,
      metadataCompletenessScore,
      teamCount,
      trophyWins,
      transferCount,
      meaningfulStats,
      hasNationality,
      hasPosition,
      isHeadlineSeed,
      eliteCompetitionScore,
    });

    const survivalTier: PlayerQualityProfile["survivalTier"] =
      playabilityScore >= 120
        ? "A"
        : playabilityScore >= 70
          ? "B"
          : playabilityScore >= 35
            ? "C"
            : "D";

    const survivalEligible = survivalTier !== "D";
    const whoAmIEligible =
      whoAmISignal.qualifiesBase || whoAmISignal.qualifiesHeadlineFallback;
    const higherLowerEligible = playabilityScore >= 50;
    const gridEligible = teamCount >= 1 && metadataCompletenessScore >= 4;

    const reasons: string[] = [];
    if (isHeadlineSeed) {
      reasons.push("headline_seed");
      if (coverageEntry?.overrideUsed) {
        reasons.push("headline_seed_override");
      } else if (coverageEntry?.status === "matched_manual_layer") {
        reasons.push("headline_seed_manual_layer");
      } else if (coverageEntry?.matchConfidence === "exact") {
        reasons.push("headline_seed_exact");
      } else if (
        coverageEntry?.matchConfidence === "alias" ||
        coverageEntry?.matchConfidence === "strong"
      ) {
        reasons.push("headline_seed_alias");
      }
    }
    if (coverageEntry?.status === "gap_filled") reasons.push("gap_filled");
    if (eliteCompetitionAppearances > 0) reasons.push("elite_competition_presence");
    if (recentPresenceScore > 0) reasons.push("recent_presence");
    if (metadataCompletenessScore >= 8) reasons.push("metadata_complete");
    if (clueRichnessScore >= 10) reasons.push("clue_rich");
    if (whoAmISignal.hasTeamSignal) reasons.push("whoami_team_signal");
    if (trophyWins > 0) reasons.push("trophy_winner");
    if (transferCount > 0) reasons.push("transfer_history");
    if (meaningfulStats) {
      reasons.push("meaningful_stats");
    }
    if (whoAmISignal.qualifiesHeadlineFallback) {
      reasons.push("whoami_headline_fallback");
    }
    reasons.push(`tier_${survivalTier.toLowerCase()}`);

    qualityProfiles.push({
      id: `quality_${player.id}`,
      sport: "football",
      playerId: player.id,
      playerName: player.name,
      normalizedName,
      initials2: getPlayerInitials(player.name, 2),
      initials3: getPlayerInitials(player.name, 3),
      fameScore,
      playabilityScore,
      clueRichnessScore: roundScore(clueRichnessScore),
      metadataCompletenessScore: roundScore(metadataCompletenessScore),
      recentPresenceScore,
      eliteCompetitionScore,
      transferScore,
      trophyScore,
      totalAppearances,
      totalMinutes,
      totalGoals,
      totalAssists,
      teamCount,
      leagueCount,
      trophyWins,
      transferCount,
      hasPhoto,
      hasNationality,
      hasPosition,
      hasFirstName,
      isHeadlineSeed,
      wasGapFilled: coverageEntry?.status === "gap_filled",
      matchedViaProfilesEndpoint: coverageEntry?.status === "gap_filled",
      survivalTier,
      survivalEligible,
      whoAmIEligible,
      higherLowerEligible,
      gridEligible,
      reasons,
    });
  }

  qualityProfiles.push(
    ...buildManualFootballLegendQualityProfiles(manualLegends, coverageByPlayerId),
  );

  return qualityProfiles.sort(
    (a, b) => b.playabilityScore - a.playabilityScore || a.playerName.localeCompare(b.playerName),
  );
}

function buildFootballSurvivalIndex(
  footballPlayers: Player[],
  qualityProfiles: PlayerQualityProfile[],
): SurvivalInitialsBucket[] {
  const profilesByPlayerId = new Map(
    qualityProfiles.map((profile) => [profile.playerId, profile]),
  );
  const buckets = new Map<
    string,
    { players: Player[]; profiles: PlayerQualityProfile[] }
  >();

  for (const player of footballPlayers) {
    const profile = profilesByPlayerId.get(player.id);
    if (!player.name) continue;

    for (const initialsLength of [2, 3] as const) {
      const initials = getPlayerInitials(player.name, initialsLength);
      if (!initials) continue;
      if (!buckets.has(initials)) {
        buckets.set(initials, { players: [], profiles: [] });
      }
      const bucket = buckets.get(initials)!;
      if (!bucket.players.some((existing) => existing.id === player.id)) {
        bucket.players.push(player);
      }
      if (profile && !bucket.profiles.some((existing) => existing.playerId === profile.playerId)) {
        bucket.profiles.push(profile);
      }
    }
  }

  return Array.from(buckets.entries())
    .map(([initials, bucket]) => {
      const bucketPlayers = [...bucket.players].sort(
        (a, b) => a.name.localeCompare(b.name),
      );
      const totalPlayers = bucket.players.length;
      const playableProfiles = bucket.profiles.filter(
        (profile) => profile.survivalEligible,
      );
      const headlineProfiles = bucket.profiles.filter(
        (profile) => profile.survivalTier === "A" || profile.isHeadlineSeed,
      );
      const playableHeadlineProfiles = playableProfiles.filter(
        (profile) => profile.survivalTier === "A" || profile.isHeadlineSeed,
      );
      const topProfilePool =
        playableHeadlineProfiles.length > 0
          ? playableHeadlineProfiles
          : playableProfiles.length > 0
            ? playableProfiles
            : [];
      const topProfile =
        topProfilePool.length > 0
          ? [...topProfilePool].sort(
              (a, b) =>
                Number(b.isHeadlineSeed) - Number(a.isHeadlineSeed) ||
                b.playabilityScore - a.playabilityScore ||
                a.playerName.localeCompare(b.playerName),
            )[0]
          : undefined;
      const playableCount = playableProfiles.length;
      const famousCount = headlineProfiles.length;
      const playableRatio = totalPlayers > 0 ? playableCount / totalPlayers : 0;
      const topPlayabilityScore = topProfile?.playabilityScore || 0;
      const hasSurvivalEligibleTopPlayer = Boolean(topProfile?.survivalEligible);
      const bucketNoisePenalty = getFootballBucketNoisePenalty(
        totalPlayers,
        topPlayabilityScore,
        famousCount,
        playableRatio,
      );
      const bucketScore = roundScore(
        famousCount * 100 +
          playableCount * 15 +
          playableRatio * 80 +
          topPlayabilityScore * 0.6 +
          getFootballBucketSizeScore(totalPlayers) +
          bucketNoisePenalty,
      );

      const recommendedTier: SurvivalInitialsBucket["recommendedTier"] =
        famousCount >= 1 &&
        playableCount >= 2 &&
        playableRatio >= FOOTBALL_SURVIVAL_EASY_MIN_PLAYABLE_RATIO &&
        topPlayabilityScore >= FOOTBALL_SURVIVAL_EASY_MIN_TOP_SCORE &&
        bucketScore >= FOOTBALL_SURVIVAL_EASY_MIN_BUCKET_SCORE
          ? "easy"
          : playableCount >= 2 &&
              playableRatio >= FOOTBALL_SURVIVAL_MEDIUM_MIN_PLAYABLE_RATIO &&
              topPlayabilityScore >= FOOTBALL_SURVIVAL_MEDIUM_MIN_TOP_SCORE &&
              bucketScore >= FOOTBALL_SURVIVAL_MEDIUM_MIN_BUCKET_SCORE
            ? "medium"
            : playableCount >= 1 && topPlayabilityScore >= FOOTBALL_SURVIVAL_HARD_MIN_TOP_SCORE
              ? "hard"
              : "expert";

      return {
        id: `surv_bucket_${initials.toLowerCase()}`,
        sport: "football" as const,
        initials,
        initialsLength: initials.length,
        playerIds: bucketPlayers.map((player) => player.id),
        playerNames: bucketPlayers.map((player) => player.name),
        totalPlayers,
        playablePlayerIds: playableProfiles.map((profile) => profile.playerId),
        headlinePlayerIds: headlineProfiles.map((profile) => profile.playerId),
        famousCount,
        playableCount,
        playableRatio: roundScore(playableRatio),
        topPlayerId: topProfile?.playerId || null,
        topPlayerName: topProfile?.playerName || null,
        topPlayabilityScore: roundScore(topPlayabilityScore),
        bucketScore,
        recommendedTier,
        eligibleEarlyRounds:
          recommendedTier === "easy" &&
          hasSurvivalEligibleTopPlayer &&
          famousCount >= FOOTBALL_SURVIVAL_EARLY_MIN_FAMOUS_COUNT &&
          playableCount >= FOOTBALL_SURVIVAL_EARLY_MIN_PLAYABLE_COUNT &&
          playableRatio >= FOOTBALL_SURVIVAL_EARLY_MIN_PLAYABLE_RATIO &&
          topPlayabilityScore >= FOOTBALL_SURVIVAL_EARLY_MIN_TOP_SCORE &&
          bucketScore >= FOOTBALL_SURVIVAL_EARLY_MIN_BUCKET_SCORE,
        eligibleMidRounds:
          (recommendedTier === "easy" || recommendedTier === "medium") &&
          hasSurvivalEligibleTopPlayer &&
          playableCount >= FOOTBALL_SURVIVAL_MID_MIN_PLAYABLE_COUNT &&
          playableRatio >= FOOTBALL_SURVIVAL_MID_MIN_PLAYABLE_RATIO &&
          topPlayabilityScore >= FOOTBALL_SURVIVAL_MID_MIN_TOP_SCORE &&
          bucketScore >= FOOTBALL_SURVIVAL_MID_MIN_BUCKET_SCORE,
        eligibleLateRounds:
          hasSurvivalEligibleTopPlayer &&
          playableCount >= 1 &&
          topPlayabilityScore >= FOOTBALL_SURVIVAL_HARD_MIN_TOP_SCORE &&
          (initials.length === 2 || playableCount >= 2 || famousCount >= 1),
      };
    })
    .sort((a, b) => b.bucketScore - a.bucketScore || a.initials.localeCompare(b.initials));
}

function buildFootballCoverageReport(
  footballPlayers: Player[],
  footballPts: PlayerTeamSeason[],
  footballTrophies: PlayerTrophy[],
  footballTransfers: PlayerTransfer[],
  qualityProfiles: PlayerQualityProfile[],
  coverage: HeadlineCoverageEntry[],
  config: FootballConfig,
  manualLegends: NormalizedManualFootballLegend[] = [],
): FootballCoverageReport {
  const recentSeasons = new Set(getRecentFootballSeasons(config));
  const annotatedCoverage = sortHeadlineCoverageEntries(
    coverage.map((entry) => annotateHeadlineCoverageEntry(entry)),
  );
  const qualityProfilesByPlayerId = new Map(
    qualityProfiles.map((profile) => [profile.playerId, profile]),
  );
  const manualLegendProfiles = qualityProfiles.filter((profile) =>
    isManualLegendPlayerId(profile.playerId),
  );
  const playersWithRecentStats = new Set(
    footballPts
      .filter((pts) => recentSeasons.has(pts.season))
      .map((pts) => pts.playerId),
  ).size;
  const playersWithTrophies = new Set(
    footballTrophies
      .filter((trophy) => trophy.place?.toLowerCase() === "winner")
      .map((trophy) => trophy.playerId),
  ).size;
  const playersWithTransfers = new Set(
    footballTransfers.map((transfer) => transfer.playerId),
  ).size;

  const tierCounts = qualityProfiles.reduce(
    (counts, profile) => {
      counts[profile.survivalTier]++;
      return counts;
    },
    { A: 0, B: 0, C: 0, D: 0 },
  );

  const headlineGameplayCoverage = annotatedCoverage
    .filter((entry) => Boolean(entry.matchedPlayerId))
    .reduce(
      (counts, entry) => {
        const profile = entry.matchedPlayerId
          ? qualityProfilesByPlayerId.get(entry.matchedPlayerId)
          : undefined;
        const survivalEligible = Boolean(profile?.survivalEligible);
        const whoAmIEligible = Boolean(profile?.whoAmIEligible);

        if (survivalEligible) counts.survivalEligible++;
        if (whoAmIEligible) counts.whoAmIEligible++;
        if (survivalEligible && whoAmIEligible) counts.bothEligible++;
        if (!survivalEligible && !whoAmIEligible) counts.neitherEligible++;

        return counts;
      },
      {
        survivalEligible: 0,
        whoAmIEligible: 0,
        bothEligible: 0,
        neitherEligible: 0,
      },
    );

  const criticalCurrentMissingEntries = annotatedCoverage.filter(
    (entry) =>
      entry.coverageBucket === "missing_current_star" &&
      entry.priority === "critical",
  );
  const highPriorityMissingEntries = annotatedCoverage.filter(
    (entry) => entry.status === "missing" && entry.priority === "high",
  );
  const ambiguousNeedsOverrideEntries = annotatedCoverage.filter(
    (entry) => {
      const seed = getFootballHeadlineSeedByName(entry.seedName);
      return (
        entry.status === "ambiguous" &&
        !entry.overrideUsed &&
        seed?.era !== "historical"
      );
    },
  );
  const historicalManualLayerEntries = annotatedCoverage.filter((entry) => {
    const seed = getFootballHeadlineSeedByName(entry.seedName);
    return (
      seed?.era === "historical" &&
      (entry.coverageBucket === "missing_historical_legend" ||
        entry.coverageBucket === "missing_out_of_scope" ||
        entry.coverageBucket === "ambiguous_duplicate_legend")
    );
  });

  const unresolvedHistoricalSeedsAfterManualLayer = buildSortedCoverageNameList(
    historicalManualLayerEntries,
  );

  const manualLayerCandidateNames = buildSortedCoverageNameList(
    historicalManualLayerEntries,
  );
  const unresolvedEntries = annotatedCoverage.filter(
    (entry) => entry.status === "missing" || entry.status === "ambiguous",
  );
  const historicalMissingCount = annotatedCoverage.filter(
    (entry) => entry.coverageBucket === "missing_historical_legend",
  ).length;
  const outOfScopeCount = annotatedCoverage.filter(
    (entry) => entry.coverageBucket === "missing_out_of_scope",
  ).length;
  const ambiguousHistoricalCount = annotatedCoverage.filter((entry) => {
    const seed = getFootballHeadlineSeedByName(entry.seedName);
    return (
      entry.coverageBucket === "ambiguous_duplicate_legend" &&
      seed?.era === "historical"
    );
  }).length;

  const manualLayerReasons: string[] = [];
  if (historicalMissingCount >= 8) {
    manualLayerReasons.push(
      "Many unresolved headline seeds are historical legends with weak provider coverage.",
    );
  }
  if (outOfScopeCount >= 3) {
    manualLayerReasons.push(
      "Several unresolved legends appear effectively out of provider scope for API-driven recovery.",
    );
  }
  if (ambiguousHistoricalCount >= 2) {
    manualLayerReasons.push(
      "Historical duplicate-name collisions still need curated disambiguation or manual sourcing.",
    );
  }
  if (
    manualLayerCandidateNames.length >= 6 &&
    manualLayerCandidateNames.length >= Math.ceil(unresolvedEntries.length / 2)
  ) {
    manualLayerReasons.push(
      "Historical legends make up a large share of the remaining unresolved headline set.",
    );
  }

  const manualLayerRecommendation = {
    recommended: manualLayerReasons.length > 0,
    reasons: manualLayerReasons,
    candidateCount: manualLayerCandidateNames.length,
    candidateNames: manualLayerCandidateNames,
  };

  const manualLayerImpact = {
    legendsLoaded: manualLegends.length,
    seedsResolvedByManualLayer: annotatedCoverage.filter(
      (entry) => entry.status === "matched_manual_layer",
    ).length,
    survivalEligibleLegends: manualLegendProfiles.filter(
      (profile) => profile.survivalEligible,
    ).length,
    whoAmIEligibleLegends: manualLegendProfiles.filter(
      (profile) => profile.whoAmIEligible,
    ).length,
    unresolvedHistoricalSeedsAfterManualLayer,
  };

  return {
    generatedAt: new Date().toISOString(),
    totalFootballPlayers: footballPlayers.length,
    totalFootballPlayerTeamSeasons: footballPts.length,
    playersWithRecentStats,
    playersWithPhotos: footballPlayers.filter((player) => Boolean(player.photo)).length,
    playersWithPosition: footballPlayers.filter((player) => Boolean(player.position)).length,
    playersWithNationality: footballPlayers.filter((player) => Boolean(player.nationality)).length,
    playersWithTrophies,
    playersWithTransfers,
    headlinerSeedsTotal: annotatedCoverage.length,
    headlinerSeedsMatchedExisting: annotatedCoverage.filter((entry) => entry.status === "matched_existing").length,
    headlinerSeedsMatchedManualLayer: annotatedCoverage.filter((entry) => entry.status === "matched_manual_layer").length,
    headlinerSeedsGapFilled: annotatedCoverage.filter((entry) => entry.status === "gap_filled").length,
    headlinerSeedsAmbiguous: annotatedCoverage.filter((entry) => entry.status === "ambiguous").length,
    headlinerSeedsMissing: annotatedCoverage.filter((entry) => entry.status === "missing").length,
    tierCounts,
    recoveryCandidates: {
      criticalCurrentMissing: buildSortedCoverageNameList(
        criticalCurrentMissingEntries,
      ),
      highPriorityMissing: buildSortedCoverageNameList(highPriorityMissingEntries),
      ambiguousNeedsOverride: buildSortedCoverageNameList(
        ambiguousNeedsOverrideEntries,
      ),
      historicalManualLayerCandidates: manualLayerCandidateNames,
    },
    manualLayerRecommendation,
    manualLayerImpact,
    headlineGameplayCoverage,
    coverage: annotatedCoverage,
    missingSeedNames: annotatedCoverage
      .filter((entry) => entry.status === "missing")
      .map((entry) => entry.seedName),
  };
}

function buildFootballGameplayQaReport(
  survivalIndex: SurvivalInitialsBucket[],
  whoAmIClues: WhoAmIClue[],
  qualityProfiles: PlayerQualityProfile[],
): FootballGameplayQaReport {
  const qualityProfilesByPlayerId = new Map(
    qualityProfiles.map((profile) => [profile.playerId, profile]),
  );
  const footballWhoAmIClues = whoAmIClues.filter((clue) => clue.sport === "football");

  const suspiciousBuckets = survivalIndex.flatMap((bucket) => {
    const topProfile = bucket.topPlayerId
      ? qualityProfilesByPlayerId.get(bucket.topPlayerId)
      : undefined;
    const reasons: string[] = [];
    const manualPlayableCount = bucket.playablePlayerIds.filter((playerId) =>
      isManualLegendPlayerId(playerId),
    ).length;

    if (
      (bucket.totalPlayers >= 250 && bucket.topPlayabilityScore < 170) ||
      (bucket.totalPlayers >= 150 && bucket.topPlayabilityScore < 150)
    ) {
      reasons.push("large_bucket_with_weak_top_player");
    }
    if (
      bucket.recommendedTier === "easy" &&
      bucket.playableRatio < FOOTBALL_SURVIVAL_EASY_MIN_PLAYABLE_RATIO
    ) {
      reasons.push("easy_bucket_low_playable_ratio");
    }
    if (bucket.totalPlayers >= 100 && bucket.famousCount === 0) {
      reasons.push("huge_bucket_without_headline_player");
    }
    if (
      bucket.initialsLength === 3 &&
      bucket.recommendedTier === "expert" &&
      bucket.totalPlayers >= 5 &&
      (bucket.topPlayabilityScore < FOOTBALL_SURVIVAL_HARD_MIN_TOP_SCORE ||
        bucket.playableCount === 0)
    ) {
      reasons.push("three_letter_bucket_too_weak_for_expert_rounds");
    }
    if (topProfile && !topProfile.survivalEligible) {
      reasons.push("top_player_not_survival_eligible");
    }
    if (
      bucket.totalPlayers >= 5 &&
      bucket.playableCount > 0 &&
      manualPlayableCount > bucket.playableCount / 2
    ) {
      reasons.push("manual_legend_heavy_bucket");
    }

    return reasons.length > 0
      ? [
          {
            initials: bucket.initials,
            reason: reasons.join(", "),
            totalPlayers: bucket.totalPlayers,
            playableCount: bucket.playableCount,
            topPlayerName: bucket.topPlayerName,
            bucketScore: bucket.bucketScore,
          },
        ]
      : [];
  });

  const lowSignalClueSets = footballWhoAmIClues
    .flatMap((clue) => {
      const profile = qualityProfilesByPlayerId.get(clue.playerId);
      if (!profile) {
        return [
          {
            playerId: clue.playerId,
            answerName: clue.answerName,
            reasons: ["missing_quality_profile"],
          },
        ];
      }

      const reasons: string[] = [];
      const isManualLegend = isManualLegendPlayerId(clue.playerId);
      const meaningfulStats = profile.reasons.includes("meaningful_stats");
      const whoAmISignal = getFootballWhoAmISignalStrength({
        playabilityScore: profile.playabilityScore,
        clueRichnessScore: profile.clueRichnessScore,
        metadataCompletenessScore: profile.metadataCompletenessScore,
        teamCount: profile.teamCount,
        trophyWins: profile.trophyWins,
        transferCount: profile.transferCount,
        meaningfulStats,
        hasNationality: profile.hasNationality,
        hasPosition: profile.hasPosition,
        isHeadlineSeed: profile.isHeadlineSeed,
        eliteCompetitionScore: profile.eliteCompetitionScore,
      });

      if (profile.reasons.includes("whoami_headline_fallback")) {
        reasons.push("headline_fallback_path");
      }
      if (!isManualLegend && whoAmISignal.signalCount === FOOTBALL_WHO_AM_I_MIN_SIGNAL_COUNT) {
        reasons.push("minimum_signal_shape");
      }
      if (
        !isManualLegend &&
        profile.teamCount === 2 &&
        profile.trophyWins === 0 &&
        profile.transferCount === 0 &&
        meaningfulStats
      ) {
        reasons.push("two_club_stats_only_signal");
      }
      if (
        !isManualLegend &&
        profile.trophyWins === 0 &&
        profile.transferCount === 0 &&
        meaningfulStats &&
        profile.teamCount <= 3 &&
        profile.clueRichnessScore <= FOOTBALL_WHO_AM_I_MIN_CLUE_RICHNESS_SCORE
      ) {
        reasons.push("stats_only_weak_diversity");
      }

      return reasons.length > 0
        ? [
            {
              playerId: clue.playerId,
              answerName: clue.answerName,
              reasons,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        b.reasons.length - a.reasons.length ||
        a.answerName.localeCompare(b.answerName),
    );

  const headlineTierBreakdown = qualityProfiles
    .filter((profile) => profile.isHeadlineSeed)
    .reduce(
      (counts, profile) => {
        counts[profile.survivalTier]++;
        return counts;
      },
      { A: 0, B: 0, C: 0, D: 0 },
    );

  return {
    generatedAt: new Date().toISOString(),
    survival: {
      totalBuckets: survivalIndex.length,
      buckets2Letters: survivalIndex.filter((bucket) => bucket.initialsLength === 2).length,
      buckets3Letters: survivalIndex.filter((bucket) => bucket.initialsLength === 3).length,
      easyBuckets: survivalIndex.filter((bucket) => bucket.recommendedTier === "easy").length,
      mediumBuckets: survivalIndex.filter((bucket) => bucket.recommendedTier === "medium").length,
      hardBuckets: survivalIndex.filter((bucket) => bucket.recommendedTier === "hard").length,
      expertBuckets: survivalIndex.filter((bucket) => bucket.recommendedTier === "expert").length,
      earlyEligibleBuckets: survivalIndex.filter((bucket) => bucket.eligibleEarlyRounds).length,
      midEligibleBuckets: survivalIndex.filter((bucket) => bucket.eligibleMidRounds).length,
      lateEligibleBuckets: survivalIndex.filter((bucket) => bucket.eligibleLateRounds).length,
      bucketsWithHeadlinePlayer: survivalIndex.filter((bucket) => bucket.headlinePlayerIds.length > 0).length,
      bucketsWithManualLegendTopPlayer: survivalIndex.filter(
        (bucket) => Boolean(bucket.topPlayerId && isManualLegendPlayerId(bucket.topPlayerId)),
      ).length,
      top20EarlyBuckets: survivalIndex
        .filter((bucket) => bucket.eligibleEarlyRounds)
        .slice(0, 20)
        .map((bucket) => ({
          initials: bucket.initials,
          topPlayerName: bucket.topPlayerName,
          bucketScore: bucket.bucketScore,
          recommendedTier: bucket.recommendedTier,
          totalPlayers: bucket.totalPlayers,
          playableCount: bucket.playableCount,
          famousCount: bucket.famousCount,
        })),
      suspiciousBuckets,
    },
    whoAmI: {
      totalClueSets: footballWhoAmIClues.length,
      headlineClueSets: footballWhoAmIClues.filter((clue) => {
        const profile = qualityProfilesByPlayerId.get(clue.playerId);
        return Boolean(profile?.isHeadlineSeed);
      }).length,
      manualLegendClueSets: footballWhoAmIClues.filter((clue) => isManualLegendPlayerId(clue.playerId)).length,
      easy: footballWhoAmIClues.filter((clue) => clue.difficulty === "easy").length,
      medium: footballWhoAmIClues.filter((clue) => clue.difficulty === "medium").length,
      hard: footballWhoAmIClues.filter((clue) => clue.difficulty === "hard").length,
      lowSignalClueSets,
    },
    quality: {
      tierA: qualityProfiles.filter((profile) => profile.survivalTier === "A").length,
      tierB: qualityProfiles.filter((profile) => profile.survivalTier === "B").length,
      tierC: qualityProfiles.filter((profile) => profile.survivalTier === "C").length,
      tierD: qualityProfiles.filter((profile) => profile.survivalTier === "D").length,
      headlineTierBreakdown,
    },
  };
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

function buildFootballVerveGridApprovedData(
  rawGridIndex: GridIndexEntry[],
  teams: Team[],
): {
  approvedEntries: VerveGridApprovedEntry[];
  qaReport: VerveGridQaReport;
} {
  const footballEntries = rawGridIndex.filter((entry) => entry.sport === "football");
  const rawPlayableEntries = footballEntries.filter(
    (entry) => entry.difficulty === "easy" || entry.difficulty === "medium",
  );
  const teamById = new Map(
    teams
      .filter((team) => team.sport === "football")
      .map((team) => [team.id, team]),
  );
  const rawSameLabelCollisionCount = rawPlayableEntries.filter(
    (entry) =>
      normalizeNameForMatch(entry.rowLabel) === normalizeNameForMatch(entry.colLabel),
  ).length;
  const rawPositionCounts = rawPlayableEntries.reduce<Record<string, number>>(
    (acc, entry) => {
      if (entry.rowType === "position") {
        acc[entry.rowKey] = (acc[entry.rowKey] || 0) + 1;
      }
      if (entry.colType === "position") {
        acc[entry.colKey] = (acc[entry.colKey] || 0) + 1;
      }
      return acc;
    },
    {},
  );

  let nationalityEntriesRemoved = 0;
  let nationalTeamEntriesRemoved = 0;
  let nationalTeamSameLabelCollisionsRemoved = 0;
  let positionEntriesCollapsed = 0;
  const removedNationalities = new Set<string>();

  const mergedEntries = new Map<
    string,
    {
      entry: VerveGridApprovedEntry;
      playerIds: Set<string>;
      sourceIds: string[];
    }
  >();

  for (const entry of rawPlayableEntries) {
    if (
      entry.rowType === "nationality" &&
      !VERVE_GRID_APPROVED_NATIONALITIES.has(entry.rowKey)
    ) {
      nationalityEntriesRemoved += 1;
      removedNationalities.add(entry.rowKey);
      continue;
    }
    if (
      entry.colType === "nationality" &&
      !VERVE_GRID_APPROVED_NATIONALITIES.has(entry.colKey)
    ) {
      nationalityEntriesRemoved += 1;
      removedNationalities.add(entry.colKey);
      continue;
    }

    const rowTeam = entry.rowType === "team" ? teamById.get(entry.rowKey) : null;
    const colTeam = entry.colType === "team" ? teamById.get(entry.colKey) : null;
    const rowIsNationalTeam =
      rowTeam != null && VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(rowTeam.leagueId);
    const colIsNationalTeam =
      colTeam != null && VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(colTeam.leagueId);

    if (rowIsNationalTeam || colIsNationalTeam) {
      nationalTeamEntriesRemoved += 1;
      if (
        normalizeNameForMatch(entry.rowLabel) === normalizeNameForMatch(entry.colLabel)
      ) {
        nationalTeamSameLabelCollisionsRemoved += 1;
      }
      continue;
    }

    const normalizedRowKey =
      entry.rowType === "position"
        ? normalizeVerveGridPositionLabel(entry.rowKey) ?? entry.rowKey
        : entry.rowKey;
    const normalizedColKey =
      entry.colType === "position"
        ? normalizeVerveGridPositionLabel(entry.colKey) ?? entry.colKey
        : entry.colKey;
    const normalizedRowLabel =
      entry.rowType === "position"
        ? normalizeVerveGridPositionLabel(entry.rowLabel) ?? entry.rowLabel
        : entry.rowLabel;
    const normalizedColLabel =
      entry.colType === "position"
        ? normalizeVerveGridPositionLabel(entry.colLabel) ?? entry.colLabel
        : entry.colLabel;

    if (
      (entry.rowType === "position" && normalizedRowKey !== entry.rowKey) ||
      (entry.colType === "position" && normalizedColKey !== entry.colKey)
    ) {
      positionEntriesCollapsed += 1;
    }

    const mergedId = `approved_grid_${sanitizeCacheKey(entry.rowType)}_${sanitizeCacheKey(normalizedRowKey)}_${sanitizeCacheKey(entry.colType)}_${sanitizeCacheKey(normalizedColKey)}`;
    const axisFamily = getVerveGridAxisFamily(entry);
    const playerIds = new Set(entry.playerIds);
    const existing = mergedEntries.get(mergedId);

    if (existing) {
      for (const playerId of entry.playerIds) {
        existing.playerIds.add(playerId);
      }
      existing.sourceIds.push(entry.id);
    } else {
      mergedEntries.set(mergedId, {
        entry: {
          id: mergedId,
          sourceGridId: entry.id,
          axisFamily,
          sport: "football",
          rowType: entry.rowType,
          rowKey: normalizedRowKey,
          rowLabel: normalizedRowLabel,
          colType: entry.colType,
          colKey: normalizedColKey,
          colLabel: normalizedColLabel,
          playerIds: entry.playerIds,
          difficulty: entry.difficulty,
        },
        playerIds,
        sourceIds: [entry.id],
      });
    }
  }

  const approvedEntries = Array.from(mergedEntries.values())
    .map(({ entry, playerIds }) => {
      const dedupedPlayerIds = Array.from(playerIds);
      const count = dedupedPlayerIds.length;
      const difficulty: "easy" | "medium" | "hard" =
        count >= 6 ? "easy" : count >= 3 ? "medium" : "hard";
      return {
        ...entry,
        playerIds: dedupedPlayerIds,
        difficulty,
      };
    })
    .filter((entry) => entry.playerIds.length >= 3)
    .sort((a, b) => a.id.localeCompare(b.id));

  const approvedSameLabelCollisionCount = approvedEntries.filter(
    (entry) =>
      normalizeNameForMatch(entry.rowLabel) === normalizeNameForMatch(entry.colLabel),
  ).length;
  const approvedAxisFamilyCounts = approvedEntries.reduce<Record<string, number>>(
    (acc, entry) => {
      acc[entry.axisFamily] = (acc[entry.axisFamily] || 0) + 1;
      return acc;
    },
    {},
  );
  const approvedCellCountsByAxisFamily = approvedEntries.reduce<
    Record<string, number[]>
  >((acc, entry) => {
    if (!acc[entry.axisFamily]) acc[entry.axisFamily] = [];
    acc[entry.axisFamily].push(entry.playerIds.length);
    return acc;
  }, {});
  const approvedCellSizeStatsByAxisFamily = Object.fromEntries(
    Object.entries(approvedCellCountsByAxisFamily).map(([axisFamily, counts]) => [
      axisFamily,
      buildVerveGridCellStats(counts),
    ]),
  );
  const approvedPositionCounts = approvedEntries.reduce<Record<string, number>>(
    (acc, entry) => {
      if (entry.rowType === "position") {
        acc[entry.rowKey] = (acc[entry.rowKey] || 0) + 1;
      }
      if (entry.colType === "position") {
        acc[entry.colKey] = (acc[entry.colKey] || 0) + 1;
      }
      return acc;
    },
    {},
  );

  const rowToCols = new Map<string, Set<string>>();
  const rowTypeById = new Map<string, string>();
  const colTypeById = new Map<string, string>();
  for (const entry of approvedEntries) {
    const rowId = `${entry.rowType}:${entry.rowKey}`;
    const colId = `${entry.colType}:${entry.colKey}`;
    rowTypeById.set(rowId, entry.rowType);
    colTypeById.set(colId, entry.colType);
    if (!rowToCols.has(rowId)) rowToCols.set(rowId, new Set());
    rowToCols.get(rowId)!.add(colId);
  }

  const rowIds = Array.from(rowToCols.keys());
  const templateCountsByRowTypeMix = new Map<
    string,
    { rowTripletsWithThreePlusSharedCols: number; columnTypeMixes: Set<string> }
  >();

  for (let i = 0; i < rowIds.length - 2; i++) {
    for (let j = i + 1; j < rowIds.length - 1; j++) {
      for (let k = j + 1; k < rowIds.length; k++) {
        const rowIdA = rowIds[i];
        const rowIdB = rowIds[j];
        const rowIdC = rowIds[k];
        const sharedCols = Array.from(rowToCols.get(rowIdA)!).filter(
          (colId) =>
            rowToCols.get(rowIdB)!.has(colId) && rowToCols.get(rowIdC)!.has(colId),
        );

        if (sharedCols.length < 3) continue;

        const rowTypeMix = [
          rowTypeById.get(rowIdA)!,
          rowTypeById.get(rowIdB)!,
          rowTypeById.get(rowIdC)!,
        ]
          .sort()
          .join(",");
        const summary =
          templateCountsByRowTypeMix.get(rowTypeMix) || {
            rowTripletsWithThreePlusSharedCols: 0,
            columnTypeMixes: new Set<string>(),
          };
        summary.rowTripletsWithThreePlusSharedCols += 1;

        const sharedColTypeCounts = sharedCols.reduce<Record<string, number>>(
          (acc, colId) => {
            const colType = colTypeById.get(colId)!;
            acc[colType] = (acc[colType] || 0) + 1;
            return acc;
          },
          {},
        );
        const signatures = new Set<string>();
        const columnTypes = Object.keys(sharedColTypeCounts).sort();
        for (let a = 0; a < columnTypes.length; a++) {
          for (let b = a; b < columnTypes.length; b++) {
            for (let c = b; c < columnTypes.length; c++) {
              const counts = new Map<string, number>();
              for (const colType of [columnTypes[a], columnTypes[b], columnTypes[c]]) {
                counts.set(colType, (counts.get(colType) || 0) + 1);
              }
              const isValid = Array.from(counts.entries()).every(
                ([colType, needed]) => (sharedColTypeCounts[colType] || 0) >= needed,
              );
              if (isValid) {
                signatures.add([columnTypes[a], columnTypes[b], columnTypes[c]].join(","));
              }
            }
          }
        }

        for (const signature of signatures) {
          summary.columnTypeMixes.add(signature);
        }
        templateCountsByRowTypeMix.set(rowTypeMix, summary);
      }
    }
  }

  const approvedTemplateCountsByRowTypeMix = Object.fromEntries(
    Array.from(templateCountsByRowTypeMix.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([rowTypeMix, summary]) => [
        rowTypeMix,
        {
          rowTripletsWithThreePlusSharedCols: summary.rowTripletsWithThreePlusSharedCols,
          distinctColumnTypeMixes: summary.columnTypeMixes.size,
        },
      ]),
  );

  return {
    approvedEntries,
    qaReport: {
      generatedAt: new Date().toISOString(),
      sport: "football",
      raw: {
        totalEntries: footballEntries.length,
        easyEntries: footballEntries.filter((entry) => entry.difficulty === "easy").length,
        mediumEntries: footballEntries.filter((entry) => entry.difficulty === "medium").length,
        hardEntries: footballEntries.filter((entry) => entry.difficulty === "hard").length,
        sameLabelCollisionCount: rawSameLabelCollisionCount,
      },
      approved: {
        totalEntries: approvedEntries.length,
        sameLabelCollisionCount: approvedSameLabelCollisionCount,
        axisFamilyCounts: approvedAxisFamilyCounts,
        cellSizeStatsByAxisFamily: approvedCellSizeStatsByAxisFamily,
        templateCountsByRowTypeMix: approvedTemplateCountsByRowTypeMix,
      },
      curationImpact: {
        nationalityEntriesRemoved,
        nationalityLabelsRemoved: Array.from(removedNationalities).sort(),
        nationalTeamEntriesRemoved,
        nationalTeamSameLabelCollisionsRemoved,
        positionNormalization: {
          entriesCollapsed: positionEntriesCollapsed,
          beforeCounts: rawPositionCounts,
          afterCounts: approvedPositionCounts,
          mapping: VERVE_GRID_POSITION_NORMALIZATION,
        },
      },
    },
  };
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

function buildHigherLowerPoolKey(fact: {
  entityType: string;
  statKey: string;
  contextKey: string;
  season: number | null;
}): string {
  return `${fact.entityType}_${fact.statKey}_${fact.contextKey}_${fact.season ?? "career"}`;
}

function buildFootballHigherLowerData(
  statFacts: StatFact[],
  qualityProfiles: PlayerQualityProfile[],
): { facts: HigherLowerFact[]; pools: HigherLowerPool[] } {
  const eligiblePlayerIds = new Set(
    qualityProfiles
      .filter((profile) => profile.sport === "football" && profile.higherLowerEligible)
      .map((profile) => profile.playerId),
  );

  const candidateFacts = statFacts.filter((fact) => {
    if (fact.sport !== "football") return false;
    if (!HIGHER_LOWER_APPROVED_STAT_KEYS.has(fact.statKey)) return false;
    if (HIGHER_LOWER_DISABLED_STAT_KEYS.has(fact.statKey)) return false;
    if (!HIGHER_LOWER_APPROVED_CONTEXT_KEYS.has(fact.contextKey)) return false;
    if (fact.entityType === "player" && !eligiblePlayerIds.has(fact.entityId)) {
      return false;
    }
    return fact.entityType === "player" || fact.entityType === "team";
  });

  const groupedFacts = new Map<string, StatFact[]>();
  for (const fact of candidateFacts) {
    const poolKey = buildHigherLowerPoolKey(fact);
    const group = groupedFacts.get(poolKey);
    if (group) {
      group.push(fact);
    } else {
      groupedFacts.set(poolKey, [fact]);
    }
  }

  const approvedFacts: HigherLowerFact[] = [];
  const approvedPools: HigherLowerPool[] = [];

  for (const [poolKey, facts] of groupedFacts.entries()) {
    if (facts.length < HIGHER_LOWER_MIN_GROUP_SIZE) continue;

    const distinctValues = new Set(facts.map((fact) => fact.value));
    if (distinctValues.size < HIGHER_LOWER_MIN_DISTINCT_VALUES) continue;

    const sortedFacts = [...facts].sort(
      (a, b) =>
        a.value - b.value ||
        a.entityName.localeCompare(b.entityName) ||
        a.entityId.localeCompare(b.entityId),
    );
    const [firstFact] = sortedFacts;
    const minValue = sortedFacts[0]?.value ?? 0;
    const maxValue = sortedFacts[sortedFacts.length - 1]?.value ?? 0;

    approvedPools.push({
      id: poolKey,
      sport: "football",
      entityType: firstFact.entityType,
      statKey: firstFact.statKey,
      contextKey: firstFact.contextKey,
      contextLabel:
        HIGHER_LOWER_APPROVED_CONTEXT_LABELS[firstFact.contextKey] || firstFact.contextKey,
      factCount: sortedFacts.length,
      distinctValueCount: distinctValues.size,
      minValue,
      maxValue,
      season: firstFact.season,
    });

    approvedFacts.push(
      ...sortedFacts.map((fact) => ({
        id: fact.id,
        sport: fact.sport,
        poolKey,
        entityType: fact.entityType,
        entityId: fact.entityId,
        entityName: fact.entityName,
        statKey: fact.statKey,
        contextKey: fact.contextKey,
        value: fact.value,
        season: fact.season,
      })),
    );
  }

  approvedPools.sort(
    (a, b) =>
      a.statKey.localeCompare(b.statKey) ||
      a.contextKey.localeCompare(b.contextKey) ||
      (a.season ?? 0) - (b.season ?? 0) ||
      a.entityType.localeCompare(b.entityType),
  );
  approvedFacts.sort(
    (a, b) =>
      a.poolKey.localeCompare(b.poolKey) ||
      a.value - b.value ||
      a.entityName.localeCompare(b.entityName) ||
      a.entityId.localeCompare(b.entityId),
  );

  console.log(
    `  Built ${approvedPools.length} Higher or Lower pools and ${approvedFacts.length} approved facts`,
  );

  return { facts: approvedFacts, pools: approvedPools };
}

function getPreferredWhoAmITeamLabels(
  pts: PlayerTeamSeason[],
  teamNames: Map<string, string>,
): string[] {
  const appearancesByTeam = new Map<string, number>();

  for (const entry of pts) {
    const label = teamNames.get(entry.teamId) || "";
    if (!label || label.startsWith("fb_team_")) continue;
    appearancesByTeam.set(
      label,
      (appearancesByTeam.get(label) || 0) + (entry.appearances || 0),
    );
  }

  return Array.from(appearancesByTeam.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label)
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function getApprovedWhoAmITeamLabels(
  pts: PlayerTeamSeason[],
  teamsById: Map<string, Team>,
): string[] {
  const appearancesByTeam = new Map<string, number>();

  for (const entry of pts) {
    const team = teamsById.get(entry.teamId);
    const label = team?.name || "";
    if (!label || label.startsWith("fb_team_")) continue;
    if (team && VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(team.leagueId)) continue;

    appearancesByTeam.set(
      label,
      (appearancesByTeam.get(label) || 0) + (entry.appearances || 0),
    );
  }

  return Array.from(appearancesByTeam.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label)
    .filter((label, index, labels) => labels.indexOf(label) === index);
}

function withIndefiniteArticle(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  const article = /^[aeiou]/.test(lower) ? "an" : "a";
  return `${article} ${trimmed}`;
}

function formatWhoAmIIdentityClue(params: {
  nationality: string | null;
  position: string | null;
  pastTense?: boolean;
}): string | null {
  const parts: string[] = [];
  if (params.nationality) {
    parts.push(`I am from ${params.nationality}`);
  }
  if (params.position) {
    const verb = params.pastTense ? "played as" : "play as";
    parts.push(`I ${verb} ${withIndefiniteArticle(params.position)}`);
  }

  return parts.length > 0 ? `${parts.join(". ")}.` : null;
}

function formatWhoAmITrophyClue(
  wins: PlayerTrophy[],
): { clue: string; trophyNames: string[] } | null {
  if (wins.length === 0) return null;

  const trophyNames = wins
    .map((trophy) => trophy.trophyName.trim())
    .filter(Boolean)
    .filter((name, index, names) => names.indexOf(name) === index)
    .slice(0, 3);

  const trophyWord = wins.length === 1 ? "trophy" : "trophies";
  return {
    clue: `I have won ${wins.length} ${trophyWord}, including ${trophyNames.join(", ")}.`,
    trophyNames,
  };
}

function getFootballWhoAmILowSignalReasons(
  profile: PlayerQualityProfile,
  isManualLegend: boolean,
): string[] {
  const reasons: string[] = [];
  const meaningfulStats = profile.reasons.includes("meaningful_stats");
  const whoAmISignal = getFootballWhoAmISignalStrength({
    playabilityScore: profile.playabilityScore,
    clueRichnessScore: profile.clueRichnessScore,
    metadataCompletenessScore: profile.metadataCompletenessScore,
    teamCount: profile.teamCount,
    trophyWins: profile.trophyWins,
    transferCount: profile.transferCount,
    meaningfulStats,
    hasNationality: profile.hasNationality,
    hasPosition: profile.hasPosition,
    isHeadlineSeed: profile.isHeadlineSeed,
    eliteCompetitionScore: profile.eliteCompetitionScore,
  });

  if (profile.reasons.includes("whoami_headline_fallback")) {
    reasons.push("headline_fallback_path");
  }
  if (
    !isManualLegend &&
    whoAmISignal.signalCount === FOOTBALL_WHO_AM_I_MIN_SIGNAL_COUNT
  ) {
    reasons.push("minimum_signal_shape");
  }
  if (
    !isManualLegend &&
    profile.teamCount === 2 &&
    profile.trophyWins === 0 &&
    profile.transferCount === 0 &&
    meaningfulStats
  ) {
    reasons.push("two_club_stats_only_signal");
  }
  if (
    !isManualLegend &&
    profile.trophyWins === 0 &&
    profile.transferCount === 0 &&
    meaningfulStats &&
    profile.teamCount <= 3 &&
    profile.clueRichnessScore <= FOOTBALL_WHO_AM_I_MIN_CLUE_RICHNESS_SCORE
  ) {
    reasons.push("stats_only_weak_diversity");
  }

  return reasons;
}

function getApprovedWhoAmIDifficulty(params: {
  rawDifficulty: "easy" | "medium" | "hard";
  profile: PlayerQualityProfile;
  isManualLegend: boolean;
}): "easy" | "medium" | "hard" {
  const { rawDifficulty, profile, isManualLegend } = params;

  if (isManualLegend) {
    return rawDifficulty === "hard" ? "medium" : rawDifficulty;
  }

  if (rawDifficulty === "easy") {
    return profile.playabilityScore < 220 && !profile.isHeadlineSeed
      ? "medium"
      : "easy";
  }

  if (rawDifficulty === "medium") {
    if (
      (profile.isHeadlineSeed && profile.playabilityScore >= 350) ||
      profile.playabilityScore >= 700 ||
      (profile.teamCount >= 5 && profile.trophyWins >= 15)
    ) {
      return "easy";
    }
    return "medium";
  }

  if (
    (profile.isHeadlineSeed && profile.playabilityScore >= 350) ||
    profile.playabilityScore >= 650
  ) {
    return "easy";
  }
  if (
    profile.playabilityScore >= 350 ||
    profile.trophyWins > 0 ||
    profile.transferCount >= 5 ||
    (profile.teamCount >= 4 && profile.playabilityScore >= 250)
  ) {
    return "medium";
  }
  return "hard";
}

function buildFootballWhoAmIApprovedData(params: {
  rawClues: WhoAmIClue[];
  players: Player[];
  ptsList: PlayerTeamSeason[];
  teams: Team[];
  trophies: PlayerTrophy[];
  transfers: PlayerTransfer[];
  qualityProfiles: PlayerQualityProfile[];
}): {
  approvedClues: WhoAmIApprovedClue[];
  qaReport: WhoAmIQaReport;
} {
  const footballRawClues = params.rawClues.filter((clue) => clue.sport === "football");
  const footballPlayers = params.players.filter((player) => player.sport === "football");
  const footballPts = params.ptsList.filter((pts) => pts.leagueId.startsWith("fb_"));
  const footballTeams = params.teams.filter((team) => team.sport === "football");
  const footballTrophies = params.trophies.filter((trophy) => trophy.sport === "football");
  const footballTransfers = params.transfers.filter((transfer) => transfer.sport === "football");
  const qualityProfilesByPlayerId = new Map(
    params.qualityProfiles.map((profile) => [profile.playerId, profile]),
  );
  const playerById = new Map(footballPlayers.map((player) => [player.id, player]));
  const teamsById = new Map(footballTeams.map((team) => [team.id, team]));
  const teamNames = new Map(footballTeams.map((team) => [team.id, team.name]));
  const nationalTeamNames = new Set(
    footballTeams
      .filter((team) => VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(team.leagueId))
      .map((team) => team.name),
  );

  const playerPts = new Map<string, PlayerTeamSeason[]>();
  for (const pts of footballPts) {
    if (!playerPts.has(pts.playerId)) playerPts.set(pts.playerId, []);
    playerPts.get(pts.playerId)!.push(pts);
  }

  const playerTrophies = new Map<string, PlayerTrophy[]>();
  for (const trophy of footballTrophies) {
    if (!playerTrophies.has(trophy.playerId)) playerTrophies.set(trophy.playerId, []);
    playerTrophies.get(trophy.playerId)!.push(trophy);
  }

  const playerTransfers = new Map<string, PlayerTransfer[]>();
  for (const transfer of footballTransfers) {
    if (!playerTransfers.has(transfer.playerId)) {
      playerTransfers.set(transfer.playerId, []);
    }
    playerTransfers.get(transfer.playerId)!.push(transfer);
  }

  const countsBySport = footballRawClues.reduce<Record<string, number>>((acc, clue) => {
    acc[clue.sport] = (acc[clue.sport] || 0) + 1;
    return acc;
  }, {});
  const rawCountsByDifficulty = footballRawClues.reduce<Record<string, number>>(
    (acc, clue) => {
      acc[clue.difficulty] = (acc[clue.difficulty] || 0) + 1;
      return acc;
    },
    {},
  );

  const approvedClues: WhoAmIApprovedClue[] = [];
  const rejectedClues: WhoAmIRejectedClue[] = [];
  const difficultyChangedExamples: WhoAmIQaExample[] = [];
  const rejectedExamples: WhoAmIQaExample[] = [];
  const textAdjustedExamples: WhoAmIQaExample[] = [];

  let nationalTeamLeakyRawCount = 0;
  let nationalTeamLabelsRemovedCount = 0;
  let trophyTextNormalizedCount = 0;
  let transferClueReplacedCount = 0;
  let attackerGrammarFixedCount = 0;

  for (const rawClue of footballRawClues) {
    const profile = qualityProfilesByPlayerId.get(rawClue.playerId);
    const isManualLegend = isManualLegendPlayerId(rawClue.playerId);
    const rejections: string[] = [];

    if (!profile) {
      rejections.push("missing_quality_profile");
    } else if (!profile.whoAmIEligible) {
      rejections.push("quality_profile_ineligible");
    }

    const pts = playerPts.get(rawClue.playerId) || [];
    const wins = (playerTrophies.get(rawClue.playerId) || []).filter(
      (trophy) => trophy.place?.toLowerCase() === "winner",
    );
    const transfers = playerTransfers.get(rawClue.playerId) || [];
    const player = playerById.get(rawClue.playerId) || null;
    const rawTeamLabels = !isManualLegend
      ? getPreferredWhoAmITeamLabels(pts, teamNames)
      : [];
    const approvedTeamLabels = !isManualLegend
      ? getApprovedWhoAmITeamLabels(pts, teamsById)
      : [];

    if (
      rawTeamLabels.length > approvedTeamLabels.length &&
      rawTeamLabels.length > 0
    ) {
      nationalTeamLabelsRemovedCount += rawTeamLabels.length - approvedTeamLabels.length;
      nationalTeamLeakyRawCount += 1;
    }

    if (profile) {
      rejections.push(...getFootballWhoAmILowSignalReasons(profile, isManualLegend));

      if (
        !isManualLegend &&
        approvedTeamLabels.length < 2 &&
        profile.trophyWins === 0 &&
        profile.transferCount === 0 &&
        !profile.isHeadlineSeed
      ) {
        rejections.push("insufficient_club_signal_after_curation");
      }

      if (
        rejections.includes("stats_only_weak_diversity") &&
        !profile.isHeadlineSeed &&
        profile.playabilityScore < 300
      ) {
        rejections.push("reject_stats_only_weak_diversity");
      }
      if (
        rejections.includes("minimum_signal_shape") &&
        !profile.isHeadlineSeed &&
        profile.playabilityScore < 180
      ) {
        rejections.push("reject_minimum_signal_shape");
      }
      if (rejections.includes("two_club_stats_only_signal")) {
        rejections.push("reject_two_club_stats_only_signal");
      }
    }

    const rejectionReasons = Array.from(new Set(rejections.filter((reason) => reason.startsWith("reject_") || reason === "missing_quality_profile" || reason === "quality_profile_ineligible" || reason === "insufficient_club_signal_after_curation")));
    if (rejectionReasons.length > 0) {
      rejectedClues.push({
        sourceClueId: rawClue.id,
        playerId: rawClue.playerId,
        answerName: rawClue.answerName,
        rawDifficulty: rawClue.difficulty,
        reasons: rejectionReasons,
      });
      if (rejectedExamples.length < 12) {
        rejectedExamples.push({
          playerId: rawClue.playerId,
          answerName: rawClue.answerName,
          rawDifficulty: rawClue.difficulty,
          reasons: rejectionReasons,
          rawClue1: rawClue.clue1,
          rawClue2: rawClue.clue2,
          rawClue3: rawClue.clue3,
          rawClue4: rawClue.clue4,
        });
      }
      continue;
    }

    if (!profile) {
      continue;
    }

    let approvedClue1 = rawClue.clue1;
    let approvedClue2 = rawClue.clue2;
    let approvedClue3 = rawClue.clue3;
    let approvedClue4 = rawClue.clue4;
    const curationFlags: string[] = [];

    if (isManualLegend) {
      const manualClue1 = formatWhoAmIIdentityClue({
        nationality: rawClue.clue1.match(/^I am from (.+?)\./)?.[1] || null,
        position: rawClue.clue1.match(/I played as (?:a|an) (.+?)\./)?.[1] || null,
        pastTense: true,
      });
      if (manualClue1 && manualClue1 !== rawClue.clue1) {
        approvedClue1 = manualClue1;
        curationFlags.push("identity_clue_normalized");
      }
    } else if (player) {
      const identityClue = formatWhoAmIIdentityClue({
        nationality: player.nationality,
        position: player.position,
      });
      if (identityClue) {
        approvedClue1 = identityClue;
      }
      if (
        rawClue.clue1.includes("I play as a Attacker.") &&
        approvedClue1 !== rawClue.clue1
      ) {
        attackerGrammarFixedCount += 1;
        curationFlags.push("attacker_article_fixed");
      }

      if (approvedTeamLabels.length >= 2) {
        approvedClue2 = `I have played for ${approvedTeamLabels.slice(0, 4).join(", ")}.`;
      } else if (approvedTeamLabels.length === 1) {
        approvedClue2 = `I have played for ${approvedTeamLabels[0]}.`;
      }
      if (approvedClue2 !== rawClue.clue2) {
        curationFlags.push("team_labels_curated");
      }

      const trophyClue = formatWhoAmITrophyClue(wins);
      const totalGoals = pts.reduce((sum, entry) => sum + (entry.goals || 0), 0);
      const totalAssists = pts.reduce((sum, entry) => sum + (entry.assists || 0), 0);
      const totalAppearances = pts.reduce(
        (sum, entry) => sum + (entry.appearances || 0),
        0,
      );

      if (trophyClue) {
        approvedClue3 = trophyClue.clue;
      } else if (totalGoals > 0 && totalAssists >= 8 && totalGoals < 10) {
        approvedClue3 = `I have produced ${totalGoals} goals and ${totalAssists} assists across ${totalAppearances} appearances.`;
      } else if (totalGoals > 0) {
        const goalWord = totalGoals === 1 ? "goal" : "goals";
        approvedClue3 = `I have scored ${totalGoals} ${goalWord} across ${totalAppearances} appearances.`;
      } else {
        approvedClue3 = `I have made ${totalAppearances} appearances in my career.`;
      }
      if (approvedClue3 !== rawClue.clue3) {
        trophyTextNormalizedCount += 1;
        curationFlags.push("achievement_clue_normalized");
      }

      const distinctTransfers = transfers
        .map((transfer) => `${transfer.fromTeamName} to ${transfer.toTeamName}`)
        .filter((label, index, labels) => labels.indexOf(label) === index)
        .slice(0, 2);
      if (
        distinctTransfers.length > 0 &&
        (profile.transferCount >= 5 ||
          (profile.teamCount >= 4 && profile.playabilityScore >= 300))
      ) {
        approvedClue4 = `My transfers include: ${distinctTransfers.join("; ")}.`;
      } else if (player.firstName) {
        approvedClue4 = `My first name is ${player.firstName}.`;
        if (rawClue.clue4 !== approvedClue4 && rawClue.clue4.startsWith("My transfers include:")) {
          transferClueReplacedCount += 1;
          curationFlags.push("transfer_clue_replaced");
        }
      }
    }

    const approvedDifficulty = getApprovedWhoAmIDifficulty({
      rawDifficulty: rawClue.difficulty,
      profile,
      isManualLegend,
    });
    if (approvedDifficulty !== rawClue.difficulty && difficultyChangedExamples.length < 12) {
      difficultyChangedExamples.push({
        playerId: rawClue.playerId,
        answerName: rawClue.answerName,
        rawDifficulty: rawClue.difficulty,
        approvedDifficulty,
        rawClue1: rawClue.clue1,
        rawClue2: rawClue.clue2,
        rawClue3: rawClue.clue3,
        rawClue4: rawClue.clue4,
      });
    }
    if (
      (approvedClue1 !== rawClue.clue1 ||
        approvedClue2 !== rawClue.clue2 ||
        approvedClue3 !== rawClue.clue3 ||
        approvedClue4 !== rawClue.clue4) &&
      textAdjustedExamples.length < 12
    ) {
      textAdjustedExamples.push({
        playerId: rawClue.playerId,
        answerName: rawClue.answerName,
        rawDifficulty: rawClue.difficulty,
        approvedDifficulty,
        rawClue1: rawClue.clue1,
        rawClue2: rawClue.clue2,
        rawClue3: rawClue.clue3,
        rawClue4: rawClue.clue4,
        approvedClue1,
        approvedClue2,
        approvedClue3,
        approvedClue4,
      });
    }

    const approvalReasons = [
      "curated_upstream",
      profile.isHeadlineSeed ? "headline_seed" : null,
      isManualLegend ? "manual_legend" : null,
      profile.playabilityScore >= 350 ? "high_playability" : null,
      profile.trophyWins > 0 ? "trophy_signal" : null,
      profile.transferCount > 0 ? "transfer_signal" : null,
      approvedTeamLabels.length >= 3 ? "broad_club_history" : null,
    ].filter((reason): reason is string => Boolean(reason));

    approvedClues.push({
      id: `whoami_approved_${rawClue.playerId}`,
      sourceClueId: rawClue.id,
      sport: "football",
      playerId: rawClue.playerId,
      clue1: approvedClue1,
      clue2: approvedClue2,
      clue3: approvedClue3,
      clue4: approvedClue4,
      answerName: rawClue.answerName,
      difficulty: approvedDifficulty,
      rawDifficulty: rawClue.difficulty,
      qualityScore: Number(profile.playabilityScore.toFixed(2)),
      isHeadlineSeed: profile.isHeadlineSeed,
      isManualLegend,
      teamLabels: approvedTeamLabels,
      approvalReasons,
      curationFlags: Array.from(new Set(curationFlags)),
    });
  }

  const approvedCountsByDifficulty = approvedClues.reduce<Record<string, number>>(
    (acc, clue) => {
      acc[clue.difficulty] = (acc[clue.difficulty] || 0) + 1;
      return acc;
    },
    {},
  );
  const rejectionReasonCounts = rejectedClues.reduce<Record<string, number>>(
    (acc, clue) => {
      for (const reason of clue.reasons) {
        acc[reason] = (acc[reason] || 0) + 1;
      }
      return acc;
    },
    {},
  );

  return {
    approvedClues: approvedClues.sort((a, b) => a.answerName.localeCompare(b.answerName)),
    qaReport: {
      generatedAt: new Date().toISOString(),
      sport: "football",
      raw: {
        totalClueSets: footballRawClues.length,
        countsBySport,
        countsByDifficulty: rawCountsByDifficulty,
        lowSignalClueSets: footballRawClues.filter((clue) => {
          const profile = qualityProfilesByPlayerId.get(clue.playerId);
          return profile
            ? getFootballWhoAmILowSignalReasons(
                profile,
                isManualLegendPlayerId(clue.playerId),
              ).length > 0
            : true;
        }).length,
        nationalTeamLeakyClueSets: nationalTeamLeakyRawCount,
        attackerGrammarIssues: footballRawClues.filter((clue) =>
          clue.clue1.includes("I play as a Attacker."),
        ).length,
        trophyWordingIssues: footballRawClues.filter((clue) =>
          clue.clue3.includes("trophy/trophies"),
        ).length,
        transferClueSets: footballRawClues.filter((clue) =>
          clue.clue4.startsWith("My transfers include:"),
        ).length,
        firstNameClueSets: footballRawClues.filter((clue) =>
          clue.clue4.startsWith("My first name is "),
        ).length,
      },
      approved: {
        totalClueSets: approvedClues.length,
        countsBySport: { football: approvedClues.length },
        countsByDifficulty: approvedCountsByDifficulty,
        headlineClueSets: approvedClues.filter((clue) => clue.isHeadlineSeed).length,
        manualLegendClueSets: approvedClues.filter((clue) => clue.isManualLegend).length,
        nationalTeamLeakyClueSets: approvedClues.filter((clue) =>
          clue.teamLabels.some((label) => nationalTeamNames.has(label)),
        ).length,
      },
      rejections: {
        totalRejected: rejectedClues.length,
        byReason: rejectionReasonCounts,
      },
      curationImpact: {
        approvedFromRawRate: Number(
          (approvedClues.length / Math.max(1, footballRawClues.length)).toFixed(4),
        ),
        rejectedFromRawRate: Number(
          (rejectedClues.length / Math.max(1, footballRawClues.length)).toFixed(4),
        ),
        difficultyChangedCount: approvedClues.filter(
          (clue) => clue.difficulty !== clue.rawDifficulty,
        ).length,
        nationalTeamLabelsRemovedCount,
        transferClueReplacedCount,
        trophyTextNormalizedCount,
        attackerGrammarFixedCount,
      },
      examples: {
        rejected: rejectedExamples,
        difficultyChanged: difficultyChangedExamples,
        textAdjusted: textAdjustedExamples,
      },
    },
  };
}

function buildManualFootballLegendWhoAmIClues(
  manualLegends: NormalizedManualFootballLegend[],
  qualityProfilesByPlayerId?: Map<string, PlayerQualityProfile>,
): WhoAmIClue[] {
  return manualLegends
    .flatMap((legend) => {
      const qualityProfile = qualityProfilesByPlayerId?.get(legend.id);
      if (qualityProfile && !qualityProfile.whoAmIEligible) {
        return [];
      }

      const teamLabels = getManualLegendTeamLabels(legend);
      const clue1Parts: string[] = [];
      if (legend.nationality) clue1Parts.push(`I am from ${legend.nationality}`);
      if (legend.position) clue1Parts.push(`I played as a ${legend.position}`);
      if (clue1Parts.length === 0) {
        return [];
      }

      const clue1 = clue1Parts.join(". ") + ".";
      const clue2 =
        teamLabels.length > 0
          ? `I am associated with ${teamLabels.slice(0, 4).join(", ")}.`
          : `I am associated with the ${legend.era || "classic"} era of football.`;

      let clue3 = "";
      if (legend.trophies.length > 0) {
        clue3 = `I won honors such as ${legend.trophies.slice(0, 3).join(", ")}.`;
      } else if (legend.achievements.length > 0) {
        clue3 = `I am known for ${legend.achievements.slice(0, 2).join(" and ")}.`;
      } else {
        clue3 = `I am remembered as a football icon of the ${legend.era || "classic"} era.`;
      }

      const clue4 = legend.firstName
        ? `My first name is ${legend.firstName}.`
        : legend.era
          ? `I am strongly associated with the ${legend.era}.`
          : `I am remembered as one of football's historic greats.`;
      const difficulty: WhoAmIClue["difficulty"] =
        legend.survivalTier === "A" ? "easy" : "medium";

      return [
        {
          id: `whoami_${legend.id}`,
          sport: "football" as const,
          playerId: legend.id,
          clue1,
          clue2,
          clue3,
          clue4,
          answerName: legend.canonicalName,
          difficulty,
        },
      ];
    })
    .sort((a, b) => a.answerName.localeCompare(b.answerName));
}

function buildWhoAmIClues(
  players: Player[],
  ptsList: PlayerTeamSeason[],
  teams: Team[],
  trophies: PlayerTrophy[],
  transfers: PlayerTransfer[],
  qualityProfilesByPlayerId?: Map<string, PlayerQualityProfile>,
  manualFootballLegends: NormalizedManualFootballLegend[] = [],
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
    const qualityProfile = qualityProfilesByPlayerId?.get(player.id);

    // Need at least some data to make clues
    if (pts.length === 0) continue;

    if (player.sport === "football" && qualityProfile && !qualityProfile.whoAmIEligible) {
      continue;
    }

    const wins = troph.filter(
      (t) => t.place?.toLowerCase() === "winner",
    );
    const totalGoals = pts.reduce(
      (sum, p) => sum + (p.goals || 0),
      0,
    );
    const totalApps = pts.reduce(
      (sum, p) => sum + (p.appearances || 0),
      0,
    );
    const totalMinutes = pts.reduce(
      (sum, p) => sum + (p.minutes || 0),
      0,
    );

    const teamLabels = getPreferredWhoAmITeamLabels(pts, teamNames);
    const meaningfulStats = hasMeaningfulFootballStats(
      totalApps,
      totalMinutes,
      totalGoals,
      pts.reduce((sum, p) => sum + (p.assists || 0), 0),
    );

    if (player.sport === "football") {
      const metadataCompletenessScore =
        (player.firstName ? 4 : 0) +
        (player.nationality ? 4 : 0) +
        (player.position ? 4 : 0) +
        (player.photo ? 3 : 0);
      const clueRichnessScore =
        (teamLabels.length >= 2 ? 8 : teamLabels.length === 1 ? 3 : 0) +
        (wins.length > 0 ? 6 : 0) +
        (totalGoals > 0 ? 4 : 0) +
        (trans.length > 0 ? 4 : 0);
      const whoAmISignal = getFootballWhoAmISignalStrength({
        playabilityScore: qualityProfile?.playabilityScore || 0,
        clueRichnessScore:
          qualityProfile?.clueRichnessScore ?? clueRichnessScore,
        metadataCompletenessScore:
          qualityProfile?.metadataCompletenessScore ?? metadataCompletenessScore,
        teamCount: qualityProfile?.teamCount ?? teamLabels.length,
        trophyWins: qualityProfile?.trophyWins ?? wins.length,
        transferCount: qualityProfile?.transferCount ?? trans.length,
        meaningfulStats,
        hasNationality: qualityProfile?.hasNationality ?? Boolean(player.nationality),
        hasPosition: qualityProfile?.hasPosition ?? Boolean(player.position),
        isHeadlineSeed: qualityProfile?.isHeadlineSeed ?? false,
        eliteCompetitionScore: qualityProfile?.eliteCompetitionScore ?? 0,
      });

      if (
        !qualityProfile &&
        !whoAmISignal.qualifiesBase &&
        !whoAmISignal.qualifiesHeadlineFallback
      ) {
        continue;
      }
    }

    // Clue 1: Nationality + position
    const clue1Parts: string[] = [];
    if (player.nationality) clue1Parts.push(`I am from ${player.nationality}`);
    if (player.position) clue1Parts.push(`I play as a ${player.position}`);
    if (clue1Parts.length === 0) continue;
    const clue1 = clue1Parts.join(". ") + ".";

    // Clue 2: Teams played for (distinct recognizable teams)
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
    let clue3 = "";
    if (wins.length > 0) {
      const topTrophies = wins.slice(0, 3).map((t) => t.trophyName);
      clue3 = `I have won ${wins.length} trophy/trophies, including ${topTrophies.join(", ")}.`;
    } else {
      // Fallback: notable stats
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

  clues.push(
    ...buildManualFootballLegendWhoAmIClues(
      manualFootballLegends,
      qualityProfilesByPlayerId,
    ),
  );

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

function persistReplaceTable<T extends { id: string }>(
  tableName: string,
  records: T[],
): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, `${tableName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(records, null, 2));
  console.log(`  Persisted ${tableName}: ${records.length} total`);
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

function persistJsonFile<T>(fileName: string, data: T): void {
  ensureDir(DATA_DIR);
  const filePath = path.join(DATA_DIR, `${fileName}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Persisted ${fileName}`);
}

function loadJsonFile<T>(fileName: string): T | null {
  const filePath = path.join(DATA_DIR, `${fileName}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
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
    "footballHeadlineGapFill",
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
    "qualityIndexBuilding",
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
    footballHeadlineCoverage: [],
  };
}

function loadPipelineState(): PipelineState | null {
  if (!fs.existsSync(STATE_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as Partial<PipelineState>;
    if (data.version !== 2) return null;

    const freshState = createFreshState();
    return {
      ...freshState,
      ...data,
      phases: {
        ...freshState.phases,
        ...(data.phases || {}),
      },
      footballHeadlineCoverage: data.footballHeadlineCoverage || [],
    };
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
  const footballLeagueCoverage = new Map<number, Map<number, FootballSeasonCoverage>>();

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
          footballLeagueCoverage.set(lc.id, extractFootballLeagueCoverage(raw));
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

    if (!flags.dryRun) {
      for (const lc of config.football.leagues) {
        if (footballLeagueCoverage.has(lc.id)) continue;
        const rawLeague = await fetchFootballLeague(fbClient, lc.id);
        if (rawLeague) {
          footballLeagueCoverage.set(
            lc.id,
            extractFootballLeagueCoverage(rawLeague),
          );
        }
      }
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

          if (
            !canUseLeagueCoverage(
              footballLeagueCoverage,
              lc.id,
              season,
              "topScorers",
            )
          ) {
            console.log(`  Skipping top scorers: ${lc.name} ${season} (coverage unavailable)`);
            state.phases.footballTopScorers.processedKeys.push(key);
            state.phases.footballTopScorers.lastKey = key;
            savePipelineState(state);
            continue;
          }

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

          if (
            !canUseLeagueCoverage(
              footballLeagueCoverage,
              lc.id,
              season,
              "topAssists",
            )
          ) {
            console.log(`  Skipping top assists: ${lc.name} ${season} (coverage unavailable)`);
            state.phases.footballTopAssists.processedKeys.push(key);
            state.phases.footballTopAssists.lastKey = key;
            savePipelineState(state);
            continue;
          }

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
          if (
            !canUseLeagueCoverage(
              footballLeagueCoverage,
              domesticId,
              season,
              "players",
            )
          ) {
            console.log(`  Skipping squad players: league ${domesticId} ${season} (coverage unavailable)`);
            continue;
          }

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
        const existingTeams = loadTable<Team>("teams");
        allPlayers.push(...existingPlayers);
        allPts.push(...existingPts);
        allTeams.push(...existingTeams);
      }

      allPlayers = upsertRecordsById(allPlayers);
      allPts = mergePlayerTeamSeasonRecords(allPts);
      allTeams = mergeTeamsByQuality(allTeams);

      if (!flags.dryRun) {
        persistTable("players", allPlayers);
        persistTable("playerTeamSeason", allPts);
        persistTable("teams", allTeams);
      }
    }

    // Phase 3d: Headline gap-fill (targeted, football-only)
    if (state.phases.footballHeadlineGapFill.status !== "completed") {
      console.log("\n--- Phase 3d: Football Headline Gap-Fill ---");
      state.phases.footballHeadlineGapFill.status = "in_progress";
      savePipelineState(state);

      const currentFootballPlayers = allPlayers.filter(
        (player) => player.sport === "football",
      );
      const currentFootballPts = allPts.filter((pts) => pts.playerId.startsWith("fb_"));
      const currentFootballTeams = allTeams.filter((team) => team.sport === "football");
      const initialCoverage =
        state.footballHeadlineCoverage.length > 0
          ? state.footballHeadlineCoverage
          : buildInitialHeadlineCoverage(currentFootballPlayers);

      const gapFillResult = await runFootballHeadlineGapFill({
        client: fbClient,
        footballPlayers: currentFootballPlayers,
        footballPts: currentFootballPts,
        footballTeams: currentFootballTeams,
        config: config.football,
        coverage: initialCoverage,
        dryRun: flags.dryRun,
      });

      const nonFootballPlayers = allPlayers.filter(
        (player) => player.sport !== "football",
      );
      const nonFootballTeams = allTeams.filter((team) => team.sport !== "football");
      const nonFootballPts = allPts.filter((pts) => !pts.playerId.startsWith("fb_"));

      allPlayers = upsertRecordsById([...gapFillResult.players, ...nonFootballPlayers]);
      allTeams = mergeTeamsByQuality([...gapFillResult.teams, ...nonFootballTeams]);
      allPts = mergePlayerTeamSeasonRecords([...gapFillResult.pts, ...nonFootballPts]);

      state.footballHeadlineCoverage = gapFillResult.coverage;
      state.phases.footballHeadlineGapFill.status = "completed";
      state.footballCallsUsed = fbBudget.callsUsed;
      savePipelineState(state);

      if (!flags.dryRun) {
        persistTable("players", allPlayers);
        persistTable("playerTeamSeason", allPts);
        persistTable("teams", allTeams);
      }
    } else if (state.footballHeadlineCoverage.length === 0) {
      state.footballHeadlineCoverage = buildInitialHeadlineCoverage(
        allPlayers.filter((player) => player.sport === "football"),
      );
      savePipelineState(state);
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
      const topPlayers = rankFootballPlayersForEnrichment(
        allPlayers.filter((player) => player.sport === "football"),
        allPts.filter((pts) => pts.playerId.startsWith("fb_")),
        config.football,
        state.footballHeadlineCoverage,
        enrichLimit,
      );

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
      const topPlayers = rankFootballPlayersForEnrichment(
        allPlayers.filter((player) => player.sport === "football"),
        allPts.filter((pts) => pts.playerId.startsWith("fb_")),
        config.football,
        state.footballHeadlineCoverage,
        enrichLimit,
      );

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

          if (
            !canUseLeagueCoverage(
              footballLeagueCoverage,
              lc.id,
              season,
              "fixtures",
            )
          ) {
            console.log(`  Skipping fixtures: ${lc.name} ${season} (coverage unavailable)`);
            state.phases.footballFixtures.processedKeys.push(key);
            state.phases.footballFixtures.lastKey = key;
            savePipelineState(state);
            continue;
          }

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

          if (
            !canUseLeagueCoverage(
              footballLeagueCoverage,
              lc.id,
              season,
              "standings",
            )
          ) {
            console.log(`  Skipping standings: ${lc.name} ${season} (coverage unavailable)`);
            state.phases.footballStandings.processedKeys.push(key);
            state.phases.footballStandings.lastKey = key;
            savePipelineState(state);
            continue;
          }

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
      allPlayers = upsertRecordsById(allPlayers);

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

  if (!flags.dryRun) {
    console.log("\n--- Phase 11: Building Game Indexes ---");
    state.phases.indexBuilding.status = "in_progress";
    savePipelineState(state);

    // Reload all data from disk to ensure completeness
    allPlayers = loadTable<Player>("players");
    allPts = loadTable<PlayerTeamSeason>("playerTeamSeason");
    allTeams = loadTable<Team>("teams");
    allTrophies = loadTable<PlayerTrophy>("playerTrophies");
    allTransfers = loadTable<PlayerTransfer>("playerTransfers");
    allFixtures = loadTable<Fixture>("fixtures");
    allFixtureParticipants = loadTable<FixtureParticipant>("fixtureParticipants");

    const footballPlayers = allPlayers.filter((player) => player.sport === "football");
    const footballPts = allPts.filter((pts) => pts.playerId.startsWith("fb_"));
    const footballTrophies = allTrophies.filter((trophy) => trophy.sport === "football");
    const footballTransfers = allTransfers.filter((transfer) => transfer.sport === "football");
    const footballFixtures = allFixtures.filter((fixture) => fixture.sport === "football");
    const footballWhoAmIClues = loadTable<WhoAmIClue>("whoAmIClues").filter(
      (clue) => clue.sport === "football",
    );
    const manualFootballLegends = loadManualFootballLegends();
    const derivedFootballPlayers = [
      ...footballPlayers,
      ...manualFootballLegends.map((legend) => legend.player),
    ];
    const resolvedFootballCoverage = resolveCoverageWithManualFootballLegends(
      state.footballHeadlineCoverage,
      footballPlayers,
      manualFootballLegends,
    );
    const footballQualityProfiles =
      config.features.buildWhoAmIClues ||
      config.features.buildPlayerQualityProfiles ||
      config.features.buildFootballSurvivalIndex ||
      config.features.buildFootballCoverageReport
        ? buildFootballPlayerQualityProfiles(
            footballPlayers,
            footballPts,
            footballTrophies,
            footballTransfers,
            footballFixtures,
            allFixtureParticipants,
            config.football,
            resolvedFootballCoverage,
            manualFootballLegends,
          )
        : [];
    const footballQualityLookup = new Map(
      footballQualityProfiles.map((profile) => [profile.playerId, profile]),
    );

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
        footballQualityLookup,
        manualFootballLegends,
      );
      persistReplaceTable("whoAmIClues", whoAmI);
    }

    state.phases.indexBuilding.status = "completed";
    savePipelineState(state);
  }

  if (!flags.dryRun) {
    console.log("\n--- Phase 12: Building Football Quality Indexes ---");
    state.phases.qualityIndexBuilding.status = "in_progress";
    savePipelineState(state);

    allPlayers = loadTable<Player>("players");
    allPts = loadTable<PlayerTeamSeason>("playerTeamSeason");
    allTrophies = loadTable<PlayerTrophy>("playerTrophies");
    allTransfers = loadTable<PlayerTransfer>("playerTransfers");
    allFixtures = loadTable<Fixture>("fixtures");
    allFixtureParticipants = loadTable<FixtureParticipant>("fixtureParticipants");

    const footballPlayers = allPlayers.filter((player) => player.sport === "football");
    const footballPts = allPts.filter((pts) => pts.playerId.startsWith("fb_"));
    const footballTrophies = allTrophies.filter((trophy) => trophy.sport === "football");
    const footballTransfers = allTransfers.filter((transfer) => transfer.sport === "football");
    const footballFixtures = allFixtures.filter((fixture) => fixture.sport === "football");
    const footballWhoAmIClues = loadTable<WhoAmIClue>("whoAmIClues").filter(
      (clue) => clue.sport === "football",
    );
    const manualFootballLegends = loadManualFootballLegends();
    const derivedFootballPlayers = [
      ...footballPlayers,
      ...manualFootballLegends.map((legend) => legend.player),
    ];
    const resolvedFootballCoverage = resolveCoverageWithManualFootballLegends(
      state.footballHeadlineCoverage,
      footballPlayers,
      manualFootballLegends,
    );

    const footballQualityProfiles = buildFootballPlayerQualityProfiles(
      footballPlayers,
      footballPts,
      footballTrophies,
      footballTransfers,
      footballFixtures,
      allFixtureParticipants,
      config.football,
      resolvedFootballCoverage,
      manualFootballLegends,
    );

    if (config.features.buildPlayerQualityProfiles) {
      console.log("  Building football player quality profiles...");
      persistReplaceTable("playerQualityProfiles", footballQualityProfiles);
    }

    console.log("  Building approved VerveGrid football index...");
    const verveGridData = buildFootballVerveGridApprovedData(
      loadTable<GridIndexEntry>("gridIndex"),
      loadTable<Team>("teams"),
    );
    persistReplaceTable("verveGridApprovedIndex", verveGridData.approvedEntries);
    persistJsonFile("verveGridQaReport", verveGridData.qaReport);

    console.log("  Building Higher or Lower football pools...");
    const higherLowerData = buildFootballHigherLowerData(
      loadTable<StatFact>("statFacts"),
      footballQualityProfiles,
    );
    persistReplaceTable("higherLowerPools", higherLowerData.pools);
    persistReplaceTable("higherLowerFacts", higherLowerData.facts);

    const footballSurvivalIndex =
      config.features.buildFootballSurvivalIndex ||
      config.features.buildFootballCoverageReport
        ? buildFootballSurvivalIndex(
            derivedFootballPlayers,
            footballQualityProfiles,
          )
        : [];

    if (config.features.buildFootballSurvivalIndex) {
      console.log("  Building football survival index...");
      persistReplaceTable("footballSurvivalIndex", footballSurvivalIndex);
    }

    console.log("  Building approved Who Am I football clues...");
    const approvedWhoAmIData = buildFootballWhoAmIApprovedData({
      rawClues: loadTable<WhoAmIClue>("whoAmIClues"),
      players: allPlayers,
      ptsList: allPts,
      teams: allTeams,
      trophies: allTrophies,
      transfers: allTransfers,
      qualityProfiles: footballQualityProfiles,
    });
    persistReplaceTable("whoAmIApprovedClues", approvedWhoAmIData.approvedClues);
    persistJsonFile("whoAmIQaReport", approvedWhoAmIData.qaReport);

    if (config.features.buildFootballCoverageReport) {
      console.log("  Building football coverage report...");
      const footballCoverageReport = buildFootballCoverageReport(
        footballPlayers,
        footballPts,
        footballTrophies,
        footballTransfers,
        footballQualityProfiles,
        resolvedFootballCoverage,
        config.football,
        manualFootballLegends,
      );
      persistJsonFile("footballCoverageReport", footballCoverageReport);

      console.log("  Building football gameplay QA report...");
      const footballGameplayQaReport = buildFootballGameplayQaReport(
        footballSurvivalIndex,
        footballWhoAmIClues,
        footballQualityProfiles,
      );
      persistJsonFile("footballGameplayQaReport", footballGameplayQaReport);
    }

    state.phases.qualityIndexBuilding.status = "completed";
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
      "higherLowerPools",
      "higherLowerFacts",
      "whoAmIClues",
      "whoAmIApprovedClues",
      "playerQualityProfiles",
      "footballSurvivalIndex",
    ];
    console.log(`\nOutput records:`);
    for (const table of tables) {
      const records = loadTable<any>(table);
      if (records.length > 0) {
        console.log(`  ${table}: ${records.length}`);
      }
    }

    const footballCoverageReport = loadJsonFile<FootballCoverageReport>(
      "footballCoverageReport",
    );
    if (footballCoverageReport) {
      console.log(
        `  footballCoverageReport: ${footballCoverageReport.coverage.length} seed entries`,
      );
    }

    const footballGameplayQaReport = loadJsonFile<FootballGameplayQaReport>(
      "footballGameplayQaReport",
    );
    if (footballGameplayQaReport) {
      console.log(
        `  footballGameplayQaReport: ${footballGameplayQaReport.survival.totalBuckets} survival buckets, ${footballGameplayQaReport.whoAmI.totalClueSets} football clue sets`,
      );
    }

    const verveGridApprovedIndex = loadTable<VerveGridApprovedEntry>(
      "verveGridApprovedIndex",
    );
    if (verveGridApprovedIndex.length > 0) {
      console.log(
        `  verveGridApprovedIndex: ${verveGridApprovedIndex.length} approved football entries`,
      );
    }

    const verveGridQaReport = loadJsonFile<VerveGridQaReport>("verveGridQaReport");
    if (verveGridQaReport) {
      console.log(
        `  verveGridQaReport: ${verveGridQaReport.approved.totalEntries} approved entries, ${Object.keys(verveGridQaReport.approved.templateCountsByRowTypeMix).length} row type mixes`,
      );
    }

    const whoAmIQaReport = loadJsonFile<WhoAmIQaReport>("whoAmIQaReport");
    if (whoAmIQaReport) {
      console.log(
        `  whoAmIQaReport: ${whoAmIQaReport.approved.totalClueSets} approved clue sets, ${whoAmIQaReport.rejections.totalRejected} rejected`,
      );
    }
  }

  console.log("\nDone.\n");
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateOutput(): string[] {
  const errors: string[] = [];
  const manualLegendIds = new Set(
    loadManualFootballLegends().map((legend) => legend.id),
  );

  const players = loadTable<Player>("players");
  const teams = loadTable<Team>("teams");
  const pts = loadTable<PlayerTeamSeason>("playerTeamSeason");

  const playerIds = new Set(players.map((p) => p.id));
  const derivedPlayerIds = new Set([...playerIds, ...manualLegendIds]);
  const teamIds = new Set(teams.map((t) => t.id));
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const nationalTeamNames = new Set(
    teams
      .filter((team) => VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(team.leagueId))
      .map((team) => team.name),
  );

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

  const qualityProfilesPath = path.join(DATA_DIR, "playerQualityProfiles.json");
  if (fs.existsSync(qualityProfilesPath)) {
    const qualityProfiles = loadTable<PlayerQualityProfile>("playerQualityProfiles");
    const qualityProfileIds = new Map<string, number>();

    for (const profile of qualityProfiles) {
      qualityProfileIds.set(profile.id, (qualityProfileIds.get(profile.id) || 0) + 1);
      if (!derivedPlayerIds.has(profile.playerId)) {
        errors.push(`Quality profile FK: playerId ${profile.playerId} not in players`);
      }
    }

    for (const [id, count] of qualityProfileIds) {
      if (count > 1) {
        errors.push(`Duplicate quality profile ID: ${id} (${count}x)`);
      }
    }
  }

  const survivalIndexPath = path.join(DATA_DIR, "footballSurvivalIndex.json");
  if (fs.existsSync(survivalIndexPath)) {
    const survivalIndex = loadTable<SurvivalInitialsBucket>("footballSurvivalIndex");
    const survivalBucketIds = new Map<string, number>();

    for (const bucket of survivalIndex) {
      survivalBucketIds.set(bucket.id, (survivalBucketIds.get(bucket.id) || 0) + 1);

      for (const playerId of bucket.playerIds) {
        if (!derivedPlayerIds.has(playerId)) {
          errors.push(`Survival bucket FK: playerId ${playerId} not in players`);
        }
      }

      if (bucket.topPlayerId && !derivedPlayerIds.has(bucket.topPlayerId)) {
        errors.push(`Survival bucket topPlayerId ${bucket.topPlayerId} not in players`);
      }
    }

    for (const [id, count] of survivalBucketIds) {
      if (count > 1) {
        errors.push(`Duplicate survival bucket ID: ${id} (${count}x)`);
      }
    }
  }

  const higherLowerPoolsPath = path.join(DATA_DIR, "higherLowerPools.json");
  if (fs.existsSync(higherLowerPoolsPath)) {
    const higherLowerPools = loadTable<HigherLowerPool>("higherLowerPools");
    const higherLowerFacts = loadTable<HigherLowerFact>("higherLowerFacts");
    const poolIds = new Map<string, number>();
    const availablePoolIds = new Set<string>();
    const eligiblePlayerIds = new Set(
      loadTable<PlayerQualityProfile>("playerQualityProfiles")
        .filter((profile) => profile.sport === "football" && profile.higherLowerEligible)
        .map((profile) => profile.playerId),
    );

    for (const pool of higherLowerPools) {
      poolIds.set(pool.id, (poolIds.get(pool.id) || 0) + 1);
      availablePoolIds.add(pool.id);

      if (!HIGHER_LOWER_APPROVED_CONTEXT_KEYS.has(pool.contextKey)) {
        errors.push(`HigherLower pool ${pool.id} uses unapproved context ${pool.contextKey}`);
      }
      if (HIGHER_LOWER_DISABLED_STAT_KEYS.has(pool.statKey)) {
        errors.push(`HigherLower pool ${pool.id} uses disabled stat ${pool.statKey}`);
      }
      if (!HIGHER_LOWER_APPROVED_STAT_KEYS.has(pool.statKey)) {
        errors.push(`HigherLower pool ${pool.id} uses unapproved stat ${pool.statKey}`);
      }
      if (pool.factCount < HIGHER_LOWER_MIN_GROUP_SIZE) {
        errors.push(`HigherLower pool ${pool.id} is smaller than minimum size`);
      }
      if (pool.distinctValueCount < HIGHER_LOWER_MIN_DISTINCT_VALUES) {
        errors.push(`HigherLower pool ${pool.id} has too few distinct values`);
      }
    }

    for (const [id, count] of poolIds) {
      if (count > 1) {
        errors.push(`Duplicate HigherLower pool ID: ${id} (${count}x)`);
      }
    }

    for (const fact of higherLowerFacts) {
      if (!availablePoolIds.has(fact.poolKey)) {
        errors.push(`HigherLower fact ${fact.id} references missing pool ${fact.poolKey}`);
      }
      if (!HIGHER_LOWER_APPROVED_CONTEXT_KEYS.has(fact.contextKey)) {
        errors.push(`HigherLower fact ${fact.id} uses unapproved context ${fact.contextKey}`);
      }
      if (fact.entityType === "player" && !eligiblePlayerIds.has(fact.entityId)) {
        errors.push(`HigherLower fact ${fact.id} uses ineligible player ${fact.entityId}`);
      }
      if (HIGHER_LOWER_DISABLED_STAT_KEYS.has(fact.statKey)) {
        errors.push(`HigherLower fact ${fact.id} uses disabled stat ${fact.statKey}`);
      }
      if (!HIGHER_LOWER_APPROVED_STAT_KEYS.has(fact.statKey)) {
        errors.push(`HigherLower fact ${fact.id} uses unapproved stat ${fact.statKey}`);
      }
      if (fact.entityType === "player" && !playerIds.has(fact.entityId)) {
        errors.push(`HigherLower fact ${fact.id} playerId ${fact.entityId} not in players`);
      }
      if (fact.entityType === "team" && !teamIds.has(fact.entityId)) {
        errors.push(`HigherLower fact ${fact.id} teamId ${fact.entityId} not in teams`);
      }
    }
  }

  const whoAmIApprovedPath = path.join(DATA_DIR, "whoAmIApprovedClues.json");
  if (fs.existsSync(whoAmIApprovedPath)) {
    const rawWhoAmIClues = loadTable<WhoAmIClue>("whoAmIClues");
    const approvedWhoAmIClues = loadTable<WhoAmIApprovedClue>("whoAmIApprovedClues");
    const qaReport = loadJsonFile<WhoAmIQaReport>("whoAmIQaReport");
    const rawClueIds = new Set(rawWhoAmIClues.map((clue) => clue.id));
    const approvedIds = new Map<string, number>();

    for (const clue of approvedWhoAmIClues) {
      approvedIds.set(clue.id, (approvedIds.get(clue.id) || 0) + 1);

      if (clue.sport !== "football") {
        errors.push(`WhoAmI approved clue ${clue.id} is not football-only`);
      }
      if (!derivedPlayerIds.has(clue.playerId)) {
        errors.push(`WhoAmI approved clue ${clue.id} playerId ${clue.playerId} not in players`);
      }
      if (!rawClueIds.has(clue.sourceClueId)) {
        errors.push(`WhoAmI approved clue ${clue.id} source ${clue.sourceClueId} missing from raw clues`);
      }
      if (!clue.clue1 || !clue.clue2 || !clue.clue3 || !clue.clue4) {
        errors.push(`WhoAmI approved clue ${clue.id} has an empty clue stage`);
      }
      if (clue.clue1.includes("I play as a Attacker.")) {
        errors.push(`WhoAmI approved clue ${clue.id} still has attacker grammar issue`);
      }
      if (clue.clue3.includes("trophy/trophies")) {
        errors.push(`WhoAmI approved clue ${clue.id} still has trophy wording issue`);
      }
      if (clue.teamLabels.some((label) => nationalTeamNames.has(label))) {
        errors.push(`WhoAmI approved clue ${clue.id} still exposes national team labels`);
      }
    }

    for (const [id, count] of approvedIds) {
      if (count > 1) {
        errors.push(`Duplicate approved WhoAmI clue ID: ${id} (${count}x)`);
      }
    }

    if (qaReport) {
      if (qaReport.approved.totalClueSets !== approvedWhoAmIClues.length) {
        errors.push(
          `WhoAmIQaReport approved count ${qaReport.approved.totalClueSets} does not match approved clues ${approvedWhoAmIClues.length}`,
        );
      }
      if (qaReport.approved.nationalTeamLeakyClueSets !== 0) {
        errors.push(
          `WhoAmIQaReport still reports ${qaReport.approved.nationalTeamLeakyClueSets} national-team-leaky approved clue sets`,
        );
      }
    }
  }

  const verveGridApprovedPath = path.join(DATA_DIR, "verveGridApprovedIndex.json");
  if (fs.existsSync(verveGridApprovedPath)) {
    const approvedGridEntries = loadTable<VerveGridApprovedEntry>(
      "verveGridApprovedIndex",
    );
    const approvedIds = new Map<string, number>();

    for (const entry of approvedGridEntries) {
      approvedIds.set(entry.id, (approvedIds.get(entry.id) || 0) + 1);

      if (entry.sport !== "football") {
        errors.push(`VerveGrid approved entry ${entry.id} is not football-only`);
      }
      if (entry.playerIds.length < 3) {
        errors.push(`VerveGrid approved entry ${entry.id} has fewer than 3 players`);
      }
      if (
        entry.rowType === "nationality" &&
        !VERVE_GRID_APPROVED_NATIONALITIES.has(entry.rowKey)
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} uses unapproved row nationality ${entry.rowKey}`);
      }
      if (
        entry.colType === "nationality" &&
        !VERVE_GRID_APPROVED_NATIONALITIES.has(entry.colKey)
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} uses unapproved col nationality ${entry.colKey}`);
      }
      if (
        entry.rowType === "position" &&
        normalizeVerveGridPositionLabel(entry.rowKey) !== entry.rowKey
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} uses unnormalized row position ${entry.rowKey}`);
      }
      if (
        entry.colType === "position" &&
        normalizeVerveGridPositionLabel(entry.colKey) !== entry.colKey
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} uses unnormalized col position ${entry.colKey}`);
      }
      if (
        normalizeNameForMatch(entry.rowLabel) === normalizeNameForMatch(entry.colLabel)
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} still has same-label collision`);
      }

      const rowTeam = entry.rowType === "team" ? teamsById.get(entry.rowKey) : null;
      const colTeam = entry.colType === "team" ? teamsById.get(entry.colKey) : null;
      if (
        rowTeam &&
        VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(rowTeam.leagueId)
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} keeps national-team row ${entry.rowKey}`);
      }
      if (
        colTeam &&
        VERVE_GRID_NATIONAL_TEAM_LEAGUE_IDS.has(colTeam.leagueId)
      ) {
        errors.push(`VerveGrid approved entry ${entry.id} keeps national-team col ${entry.colKey}`);
      }
    }

    for (const [id, count] of approvedIds) {
      if (count > 1) {
        errors.push(`Duplicate VerveGrid approved entry ID: ${id} (${count}x)`);
      }
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
    config = applyConfigDefaults(JSON.parse(raw) as PipelineConfig);
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
