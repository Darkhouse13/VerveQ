import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { findBestMatch } from "./lib/fuzzy";
import { assertFullAccountUser } from "./lib/authz";

// Survival data loaded inline for Convex (no filesystem access in mutations)
// These are imported at bundle time.
import footballData from "./data/survival_initials_map.json";
import tennisData from "./data/survival_initials_map_tennis.json";
import nbaData from "./data/nba_survival_data.json";
import footballSurvivalIndexData from "./data/football_survival_index.json";
import footballMetadata from "./data/football_player_metadata.json";
import nbaMetadata from "./data/nba_player_metadata.json";
import tennisMetadata from "./data/tennis_player_metadata.json";

const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const FREE_CLOSE_CALLS_PER_ROUND = 1;
const PERFORMANCE_BONUS_CAP = 0.3;

// ── Reveal Ladder economy ──
// Each round is a shrinking pot: answering with no help banks the full pot,
// every help press (clue or letter reveal) cuts it, and it never drops below
// the floor — so a round is always finishable for at least a few points.
const POT_BY_DIFFICULTY: Record<string, number> = {
  Easy: 100,
  Medium: 150,
  Hard: 200,
  Expert: 300,
};
const POT_FLOOR = 10;
/** Each help press costs this fraction of the round's base pot. */
const HELP_STEP_FRACTION = 0.15;
/** Ladder stages 1..CLUE_STAGES are metadata clues; later stages reveal letters. */
const CLUE_STAGES = 2;
const SKIPS_PER_GAME = 3;

type InitialsMap = Record<string, string[]>;

type PlayerMetadata = {
  club: string;
  position: string;
  nationality: string;
  era: string;
};

type NbaMetadata = { team: string; position: string; nationality: string };
type TennisMetadata = { nationality: string; handedness: string; highestRank: string };

const footballMetadataMap = footballMetadata as Record<string, PlayerMetadata>;
const nbaMetadataMap = nbaMetadata as Record<string, NbaMetadata>;
const tennisMetadataMap = tennisMetadata as Record<string, TennisMetadata>;

const VALID_INITIALS_REGEX = /^[a-zA-Z]+$/;
const MIN_MEDIUM_ROUND_FAMOUS_POOL = 5;
const SUPPORTED_SPORTS = ["football", "basketball", "tennis"] as const;

// ── Famous players sets per sport ──
const FAMOUS_PLAYERS: Record<string, Set<string>> = {
  football: new Set([
    "Lionel Messi", "Cristiano Ronaldo", "Kylian Mbappé", "David Beckham",
    "Karim Benzema", "Luka Modric", "Robert Lewandowski",
    "Mohamed Salah", "Erling Haaland", "Kevin De Bruyne", "Sergio Ramos",
    "Andrés Iniesta", "Gerard Piqué", "Gianluigi Buffon", "Andrea Pirlo",
    "Zlatan Ibrahimović", "Wayne Rooney", "Frank Lampard", "Steven Gerrard",
    "Didier Drogba", "Samuel Eto'o", "Virgil van Dijk", "Toni Kroos",
    "Gareth Bale", "Antoine Griezmann", "Sadio Mané", "Jude Bellingham",
    "Vinicius Junior", "Pelé", "Diego Maradona", "Johan Cruyff",
    "Ronaldo Nazário", "Ronaldinho", "Zinedine Zidane", "Thierry Henry",
    "Xavi", "Iker Casillas", "Paolo Maldini", "Franz Beckenbauer",
    "Michel Platini", "George Best", "Lev Yashin", "Alfredo Di Stéfano",
    "Ferenc Puskás", "Roberto Baggio", "Romário", "Rivaldo", "Kaká",
    "Luis Figo", "Carles Puyol", "Roberto Carlos", "Cafu", "Philipp Lahm",
    "Manuel Neuer", "Bastian Schweinsteiger", "Thomas Müller", "Neymar",
    "Luis Suárez", "Sergio Agüero", "Eden Hazard", "Harry Kane",
    "Son Heung-min", "N'Golo Kanté", "Paul Pogba", "Raheem Sterling",
    "Bernardo Silva", "Phil Foden", "Bukayo Saka", "Declan Rice",
    "Rodri", "Bruno Fernandes", "Marcus Rashford", "Trent Alexander-Arnold",
    "Alisson Becker", "Ederson", "Thibaut Courtois", "Marc-André ter Stegen",
    "Jan Oblak", "Ruben Dias", "Marquinhos", "Thiago Silva", "Casemiro",
    "Fede Valverde", "Pedri", "Gavi", "Lamine Yamal", "Jamal Musiala",
    "Florian Wirtz", "Victor Osimhen", "Rafael Leão", "Lautaro Martínez",
    "Julian Alvarez", "Enzo Fernández", "Emiliano Martínez", "Alessandro Del Piero",
    "Francesco Totti", "Ryan Giggs", "Paul Scholes", "Roy Keane", "Eric Cantona",
  ]),
  basketball: new Set([
    "Michael Jordan", "Kobe Bryant", "Stephen Curry", "Kevin Durant",
    "Shaquille O'Neal", "Kareem Abdul-Jabbar", "Tim Duncan",
    "Wilt Chamberlain", "Bill Russell", "Dwyane Wade", "Dirk Nowitzki",
    "Giannis Antetokounmpo", "Nikola Jokic", "Luka Doncic",
    "James Harden", "Russell Westbrook", "Chris Paul",
    "Anthony Davis", "Damian Lillard", "Kyrie Irving",
    "Paul George", "Jimmy Butler", "Jayson Tatum",
    "Scottie Pippen", "Charles Barkley", "Karl Malone", "Patrick Ewing",
    "Dennis Rodman", "Vince Carter", "Steve Nash", "LeBron James",
    "Magic Johnson", "Larry Bird", "Hakeem Olajuwon", "Oscar Robertson",
    "Jerry West", "Julius Erving", "Elgin Baylor", "David Robinson",
    "Moses Malone", "Kevin Garnett", "Allen Iverson", "Isiah Thomas",
    "John Stockton", "Kawhi Leonard", "Carmelo Anthony", "Dwight Howard",
    "Tracy McGrady", "Ray Allen", "Paul Pierce", "Jason Kidd",
    "Gary Payton", "Dominique Wilkins", "Clyde Drexler", "Reggie Miller",
    "Chris Bosh", "Pau Gasol", "Tony Parker", "Manu Ginobili", "Yao Ming",
    "Klay Thompson", "Draymond Green", "Devin Booker", "Donovan Mitchell",
    "Joel Embiid", "Ja Morant", "Zion Williamson", "Anthony Edwards",
    "Shai Gilgeous-Alexander", "Tyrese Haliburton", "De'Aaron Fox", "Jalen Brunson",
    "Bam Adebayo", "Jaylen Brown", "Victor Wembanyama", "Trae Young",
    "LaMelo Ball", "DeMar DeRozan", "Bradley Beal", "Karl-Anthony Towns",
    "Rudy Gobert", "Jamal Murray", "Derrick Rose", "Blake Griffin",
    "Kevin Love", "John Wall", "DeMarcus Cousins", "Marc Gasol",
    "Rajon Rondo", "Amar'e Stoudemire", "Shawn Kemp", "Alonzo Mourning",
    "Dikembe Mutombo", "Grant Hill", "Penny Hardaway", "James Worthy",
    "Kevin McHale", "Robert Parish", "Earl Monroe", "Walt Frazier",
  ]),
  tennis: new Set([
    "Roger Federer", "Rafael Nadal", "Novak Djokovic", "Pete Sampras",
    "Andre Agassi", "Boris Becker", "Bjorn Borg", "John McEnroe",
    "Andy Murray", "Stan Wawrinka", "Alexander Zverev", "Daniil Medvedev",
    "Stefanos Tsitsipas", "Carlos Alcaraz", "Jannik Sinner",
    "Juan Martin del Potro", "Serena Williams", "Venus Williams", "Steffi Graf",
    "Martina Navratilova", "Chris Evert", "Margaret Court", "Billie Jean King",
    "Monica Seles", "Maria Sharapova", "Justine Henin", "Kim Clijsters",
    "Martina Hingis", "Lindsay Davenport", "Arantxa Sánchez Vicario", "Evonne Goolagong Cawley",
    "Ivan Lendl", "Jimmy Connors", "Stefan Edberg", "Mats Wilander",
    "Rod Laver", "Roy Emerson", "Ken Rosewall", "Arthur Ashe",
    "Guillermo Vilas", "Ilie Năstase", "Jim Courier", "Lleyton Hewitt",
    "Marat Safin", "Andy Roddick", "Juan Carlos Ferrero", "Carlos Moyá",
    "Gustavo Kuerten", "Yevgeny Kafelnikov", "Patrick Rafter", "Goran Ivanišević",
    "Richard Krajicek", "Michael Chang", "Thomas Muster", "Marin Čilić",
    "Dominic Thiem", "Casper Ruud", "Holger Rune", "Andrey Rublev",
    "Grigor Dimitrov", "Felix Auger-Aliassime", "Taylor Fritz", "Frances Tiafoe",
    "Ben Shelton", "Hubert Hurkacz", "Denis Shapovalov", "Milos Raonic",
    "Kei Nishikori", "Jo-Wilfried Tsonga", "Gaël Monfils", "Richard Gasquet",
    "Gilles Simon", "David Ferrer", "Tomas Berdych", "Tommy Haas",
    "Marcos Baghdatis", "Fernando González", "Nicolás Massú", "David Nalbandian",
    "Iga Świątek", "Aryna Sabalenka", "Elena Rybakina", "Coco Gauff",
    "Jessica Pegula", "Ons Jabeur", "Caroline Wozniacki", "Simona Halep",
    "Angelique Kerber", "Petra Kvitová", "Victoria Azarenka", "Sloane Stephens",
    "Bianca Andreescu", "Emma Raducanu", "Naomi Osaka", "Ashleigh Barty",
    "Li Na", "Sania Mirza", "Gabriela Sabatini", "Mary Pierce", "Amélie Mauresmo",
  ]),
};

function getInitialsMap(sport: string): InitialsMap {
  if (sport === "tennis") {
    return (tennisData as { initials_map: InitialsMap }).initials_map;
  }
  if (sport === "basketball") {
    // NBA data is a flat initials map (no wrapper)
    return nbaData as unknown as InitialsMap;
  }
  return (footballData as { initials_map: InitialsMap }).initials_map;
}

interface DifficultyLevel {
  initialsLen: number;
  label: string;
}

type SportMetadata = PlayerMetadata | NbaMetadata | TennisMetadata;

interface BucketStats {
  initials: string;
  players: string[];
  totalPlayers: number;
  famousPlayers: string[];
  famousCount: number;
  famousRatio: number;
  metadataCoverage: number;
  sizeScore: number;
  playabilityScore: number;
  primaryPlayer: string;
}

interface SurvivalChallenge {
  initials: string;
  round: number;
  difficulty: string;
  validPlayers: string[];
  primaryPlayer: string;
}

type FootballRoundTier = "easy" | "medium" | "hard" | "expert";

interface FootballSurvivalIndexBucket {
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
  recommendedTier: FootballRoundTier;
  eligibleEarlyRounds: boolean;
  eligibleMidRounds: boolean;
  eligibleLateRounds: boolean;
}

interface FootballRoundPreferences {
  filters: Array<(bucket: FootballSurvivalIndexBucket) => boolean>;
}

function getMetadataMapForSport(sport: string): Record<string, SportMetadata> {
  if (sport === "football") {
    return footballMetadataMap;
  }
  if (sport === "basketball") {
    return nbaMetadataMap;
  }
  if (sport === "tennis") {
    return tennisMetadataMap;
  }
  return {};
}

function isAlphabeticInitials(initials: string): boolean {
  return VALID_INITIALS_REGEX.test(initials);
}

function pickWeighted<T>(
  items: T[],
  getWeight: (item: T) => number,
): T | null {
  if (!items.length) return null;

  const weightedItems = items.map((item) => ({
    item,
    weight: Math.max(
      1,
      Number.isFinite(getWeight(item)) ? getWeight(item) : 1,
    ),
  }));

  const totalWeight = weightedItems.reduce(
    (sum, entry) => sum + entry.weight,
    0,
  );

  let roll = Math.random() * totalWeight;
  for (const { item, weight } of weightedItems) {
    roll -= weight;
    if (roll <= 0) {
      return item;
    }
  }

  return weightedItems[weightedItems.length - 1]?.item ?? null;
}

function pickDeterministicPrimaryPlayer(players: string[]): string | null {
  const normalizedPlayers = Array.from(
    new Set(
      players.filter(
        (player): player is string =>
          typeof player === "string" && player.trim().length > 0,
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return normalizedPlayers[0] ?? null;
}

function normalizeFootballSurvivalIndexBucket(
  rawBucket: unknown,
): FootballSurvivalIndexBucket | null {
  if (!rawBucket || typeof rawBucket !== "object") {
    return null;
  }

  const bucket = rawBucket as Partial<FootballSurvivalIndexBucket>;
  const initials = typeof bucket.initials === "string" ? bucket.initials.trim() : "";
  const playerNames = Array.from(
    new Set(
      Array.isArray(bucket.playerNames)
        ? bucket.playerNames.filter(
            (playerName): playerName is string =>
              typeof playerName === "string" && playerName.trim().length > 0,
          )
        : [],
    ),
  );

  if (
    bucket.sport !== "football" ||
    !isAlphabeticInitials(initials) ||
    playerNames.length === 0
  ) {
    return null;
  }

  const recommendedTier: FootballRoundTier = ["easy", "medium", "hard", "expert"].includes(
    bucket.recommendedTier ?? "",
  )
    ? (bucket.recommendedTier as FootballRoundTier)
    : "expert";

  const topPlayerName =
    typeof bucket.topPlayerName === "string" &&
    bucket.topPlayerName.trim().length > 0 &&
    playerNames.includes(bucket.topPlayerName)
      ? bucket.topPlayerName
      : null;

  return {
    id:
      typeof bucket.id === "string" && bucket.id.trim().length > 0
        ? bucket.id
        : `surv_bucket_${initials.toLowerCase()}`,
    sport: "football",
    initials,
    initialsLength:
      bucket.initialsLength === 2 || bucket.initialsLength === 3
        ? bucket.initialsLength
        : initials.length,
    playerIds: Array.isArray(bucket.playerIds)
      ? bucket.playerIds.filter(
          (playerId): playerId is string =>
            typeof playerId === "string" && playerId.trim().length > 0,
        )
      : [],
    playerNames,
    totalPlayers:
      typeof bucket.totalPlayers === "number" && bucket.totalPlayers > 0
        ? bucket.totalPlayers
        : playerNames.length,
    playablePlayerIds: Array.isArray(bucket.playablePlayerIds)
      ? bucket.playablePlayerIds.filter(
          (playerId): playerId is string =>
            typeof playerId === "string" && playerId.trim().length > 0,
        )
      : [],
    headlinePlayerIds: Array.isArray(bucket.headlinePlayerIds)
      ? bucket.headlinePlayerIds.filter(
          (playerId): playerId is string =>
            typeof playerId === "string" && playerId.trim().length > 0,
        )
      : [],
    famousCount:
      typeof bucket.famousCount === "number" ? bucket.famousCount : 0,
    playableCount:
      typeof bucket.playableCount === "number" ? bucket.playableCount : 0,
    playableRatio:
      typeof bucket.playableRatio === "number" ? bucket.playableRatio : 0,
    topPlayerId:
      typeof bucket.topPlayerId === "string" && bucket.topPlayerId.trim().length > 0
        ? bucket.topPlayerId
        : null,
    topPlayerName,
    topPlayabilityScore:
      typeof bucket.topPlayabilityScore === "number"
        ? bucket.topPlayabilityScore
        : 0,
    bucketScore:
      typeof bucket.bucketScore === "number" ? bucket.bucketScore : 0,
    recommendedTier,
    eligibleEarlyRounds: bucket.eligibleEarlyRounds === true,
    eligibleMidRounds: bucket.eligibleMidRounds === true,
    eligibleLateRounds: bucket.eligibleLateRounds === true,
  };
}

const FOOTBALL_CURATED_SURVIVAL_INDEX = Array.isArray(footballSurvivalIndexData)
  ? footballSurvivalIndexData
      .map(normalizeFootballSurvivalIndexBucket)
      .filter(
        (bucket): bucket is FootballSurvivalIndexBucket => bucket !== null,
      )
  : [];

function getDifficulty(round: number): DifficultyLevel {
  if (round <= 3) return { initialsLen: 2, label: "Easy" };
  if (round <= 5) return { initialsLen: 2, label: "Medium" };
  if (round <= 7) return { initialsLen: 2, label: "Hard" };
  return { initialsLen: 3, label: "Expert" };
}

function getBasePot(difficulty: string): number {
  return POT_BY_DIFFICULTY[difficulty] ?? POT_BY_DIFFICULTY.Easy;
}

/**
 * Current value of the round's pot. `potFloored` is the anti-cheat first
 * offense: the pot collapses to the floor for the rest of the round, so a
 * quick lookup elsewhere can only ever earn the minimum.
 */
function getPotValue(
  difficulty: string,
  helpStage: number,
  potFloored: boolean,
): number {
  if (potFloored) return POT_FLOOR;
  const basePot = getBasePot(difficulty);
  const step = Math.round(basePot * HELP_STEP_FRACTION);
  return Math.max(POT_FLOOR, basePot - step * helpStage);
}

/** Letters revealed so far for a given ladder stage (clue stages reveal none). */
function getRevealedLetterCount(helpStage: number): number {
  return Math.max(0, helpStage - CLUE_STAGES);
}

const MASK_CHAR = "•";
const LETTER_REGEX = /\p{L}/u;

/**
 * Masked form of the primary player's name, e.g. "K•••• D• B••••••" for
 * "Kevin De Bruyne". Word-initial letters (already implied by the shown
 * initials) and non-letter characters (hyphens, apostrophes) are always
 * visible; `revealedLetters` hidden letters are filled in left to right.
 * Only this masked string ever leaves the server — never the raw name.
 */
function buildMaskedName(
  primaryPlayer: string,
  revealedLetters: number,
): string {
  let remaining = revealedLetters;
  return primaryPlayer
    .trim()
    .split(/\s+/)
    .map((word) =>
      Array.from(word)
        .map((char, index) => {
          if (!LETTER_REGEX.test(char)) return char;
          if (index === 0) return char;
          if (remaining > 0) {
            remaining -= 1;
            return char;
          }
          return MASK_CHAR;
        })
        .join(""),
    )
    .join(" ");
}

/** How many letters of the name start out hidden (mirror of buildMaskedName). */
function countHiddenLetters(primaryPlayer: string): number {
  return primaryPlayer
    .trim()
    .split(/\s+/)
    .reduce(
      (sum, word) =>
        sum +
        Array.from(word).filter(
          (char, index) => LETTER_REGEX.test(char) && index > 0,
        ).length,
      0,
    );
}

function getSizeScore(totalPlayers: number): number {
  if (totalPlayers === 1) return -15;
  if (totalPlayers >= 2 && totalPlayers <= 12) return 15;
  if (totalPlayers >= 13 && totalPlayers <= 25) return 10;
  if (totalPlayers >= 26 && totalPlayers <= 50) return 5;
  if (totalPlayers >= 51 && totalPlayers <= 75) return 0;
  return -10;
}

function getMetadataRichness(metadata: SportMetadata | undefined): number {
  if (!metadata) return 0;
  return Object.values(metadata).filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  ).length;
}

function pickPrimaryPlayer(players: string[], sport: string): string {
  const famousSet = FAMOUS_PLAYERS[sport] ?? new Set<string>();
  const famousPlayer = players.find((player) => famousSet.has(player));
  if (famousPlayer) {
    return famousPlayer;
  }

  const metadataMap = getMetadataMapForSport(sport);
  const bestMetadataCandidate = players
    .map((player, index) => ({
      player,
      index,
      richness: getMetadataRichness(metadataMap[player]),
    }))
    .filter((candidate) => candidate.richness > 0)
    .sort(
      (a, b) =>
        b.richness - a.richness ||
        a.player.localeCompare(b.player) ||
        a.index - b.index,
    )[0];

  if (bestMetadataCandidate) {
    return bestMetadataCandidate.player;
  }

  return [...players].sort((a, b) => a.localeCompare(b))[0] ?? players[0] ?? "";
}

function computeBucketStats(sport: string): BucketStats[] {
  const map = getInitialsMap(sport);
  const metadataMap = getMetadataMapForSport(sport);
  const famousSet = FAMOUS_PLAYERS[sport] ?? new Set<string>();

  return Object.entries(map)
    .filter(
      ([initials, players]) =>
        isAlphabeticInitials(initials) && players.length > 0,
    )
    .map(([initials, players]) => {
      const rawPlayers = [...players];
      const totalPlayers = rawPlayers.length;
      const famousPlayers = rawPlayers.filter((player) => famousSet.has(player));
      const famousCount = famousPlayers.length;
      const famousRatio = totalPlayers > 0 ? famousCount / totalPlayers : 0;
      const metadataCount = rawPlayers.filter((player) => metadataMap[player]).length;
      const metadataCoverage = totalPlayers > 0 ? metadataCount / totalPlayers : 0;
      const sizeScore = getSizeScore(totalPlayers);
      const playabilityScore =
        famousCount * 100 +
        famousRatio * 40 +
        metadataCoverage * 20 +
        sizeScore;

      return {
        initials,
        players: rawPlayers,
        totalPlayers,
        famousPlayers,
        famousCount,
        famousRatio,
        metadataCoverage,
        sizeScore,
        playabilityScore,
        primaryPlayer: pickPrimaryPlayer(rawPlayers, sport),
      };
    })
    .sort(
      (a, b) =>
        b.playabilityScore - a.playabilityScore ||
        a.initials.localeCompare(b.initials),
    );
}

const CURATED_BUCKETS_BY_SPORT: Record<string, BucketStats[]> = {};

for (const sport of SUPPORTED_SPORTS) {
  CURATED_BUCKETS_BY_SPORT[sport] = computeBucketStats(sport);
}

function getBucketsForSport(sport: string): BucketStats[] {
  if (!CURATED_BUCKETS_BY_SPORT[sport]) {
    CURATED_BUCKETS_BY_SPORT[sport] = computeBucketStats(sport);
  }

  return CURATED_BUCKETS_BY_SPORT[sport];
}

function getBucketsByLength(
  sport: string,
  initialsLen: number,
  usedInitials: string[],
): BucketStats[] {
  const usedSet = new Set(usedInitials);
  return getBucketsForSport(sport).filter(
    (bucket) =>
      bucket.initials.length === initialsLen && !usedSet.has(bucket.initials),
  );
}

function getCuratedBucketsForRound(
  sport: string,
  round: number,
  usedInitials: string[],
): BucketStats[] {
  const twoLetterBuckets = getBucketsByLength(sport, 2, usedInitials);

  if (round <= 3) {
    return twoLetterBuckets.filter((bucket) => bucket.famousCount >= 1);
  }

  if (round <= 5) {
    const famousBuckets = twoLetterBuckets.filter(
      (bucket) => bucket.famousCount >= 1,
    );
    if (famousBuckets.length >= MIN_MEDIUM_ROUND_FAMOUS_POOL) {
      return famousBuckets;
    }

    const nonFamousBuckets = twoLetterBuckets.filter(
      (bucket) => bucket.famousCount === 0,
    );

    return [
      ...famousBuckets,
      ...nonFamousBuckets.slice(
        0,
        Math.max(0, MIN_MEDIUM_ROUND_FAMOUS_POOL - famousBuckets.length),
      ),
    ];
  }

  if (round <= 7) {
    return twoLetterBuckets;
  }

  const threeLetterBuckets = getBucketsByLength(sport, 3, usedInitials);
  return threeLetterBuckets.length > 0 ? threeLetterBuckets : twoLetterBuckets;
}

function getFallbackBucketsForRound(
  sport: string,
  round: number,
  usedInitials: string[],
): BucketStats[] {
  const usedSet = new Set(usedInitials);
  const allBuckets = getBucketsForSport(sport).filter(
    (bucket) => !usedSet.has(bucket.initials),
  );
  const targetLength = getDifficulty(round).initialsLen;
  const exactLengthBuckets = allBuckets.filter(
    (bucket) => bucket.initials.length === targetLength,
  );

  if (exactLengthBuckets.length > 0) {
    return exactLengthBuckets;
  }

  if (targetLength === 3) {
    const twoLetterBuckets = allBuckets.filter(
      (bucket) => bucket.initials.length === 2,
    );
    if (twoLetterBuckets.length > 0) {
      return twoLetterBuckets;
    }
  }

  return allBuckets;
}

function pickWeightedBucket(candidates: BucketStats[]): BucketStats | null {
  return pickWeighted(
    candidates,
    (candidate) => candidate.playabilityScore,
  );
}

function getFootballRoundPreferences(round: number): FootballRoundPreferences {
  if (round <= 3) {
    return {
      filters: [
        (bucket) => bucket.eligibleEarlyRounds && bucket.recommendedTier === "easy",
        (bucket) => bucket.eligibleEarlyRounds,
        (bucket) => bucket.eligibleMidRounds,
        (bucket) => bucket.eligibleLateRounds,
      ],
    };
  }

  if (round <= 5) {
    return {
      filters: [
        (bucket) =>
          bucket.eligibleMidRounds &&
          (bucket.recommendedTier === "easy" ||
            bucket.recommendedTier === "medium"),
        (bucket) => bucket.eligibleMidRounds,
        (bucket) => bucket.eligibleLateRounds,
      ],
    };
  }

  if (round <= 7) {
    return {
      filters: [
        (bucket) =>
          bucket.eligibleLateRounds &&
          (bucket.recommendedTier === "medium" ||
            bucket.recommendedTier === "hard"),
        (bucket) => bucket.eligibleLateRounds,
      ],
    };
  }

  return {
    filters: [
      (bucket) => bucket.initialsLength === 3 && bucket.eligibleLateRounds,
      (bucket) => bucket.initialsLength === 3,
      (bucket) => bucket.initialsLength === 2 && bucket.eligibleLateRounds,
      (bucket) => bucket.eligibleLateRounds,
    ],
  };
}

function getChallengePrimaryPlayer(
  sport: string,
  challenge: Pick<SurvivalChallenge, "validPlayers"> & {
    primaryPlayer?: string;
  },
): string {
  if (challenge.primaryPlayer) {
    return challenge.primaryPlayer;
  }

  if (sport === "football") {
    return pickDeterministicPrimaryPlayer(challenge.validPlayers) ?? "";
  }

  return pickPrimaryPlayer(challenge.validPlayers, sport);
}

function getFirstName(player: string): string {
  return player.trim().split(/\s+/)[0] || "Unknown";
}

function getLastNameInitial(player: string): string {
  const parts = player.trim().split(/\s+/).filter(Boolean);
  const lastName = parts[parts.length - 1] ?? "";
  return lastName.charAt(0).toUpperCase() || "?";
}

function getFamousPlayerFallbackHint(
  primaryPlayer: string,
  sport: string,
  stage: number,
): string {
  const sportLabel = sport === "basketball" ? "NBA" : sport;
  if (!primaryPlayer) {
    return `Most famous match: known ${sportLabel} player.`;
  }
  if (stage === 1) {
    return `Most famous match: ${sportLabel} player; first name has ${getFirstName(primaryPlayer).length} letters.`;
  }
  if (stage === 2) {
    return `Most famous match: last name starts with ${getLastNameInitial(primaryPlayer)}.`;
  }
  return `Most famous match first name: ${getFirstName(primaryPlayer)}`;
}

function buildFamousPlayerHint(
  sport: string,
  primaryPlayer: string,
  stage: number,
): string {
  if (sport === "football") {
    const meta = primaryPlayer ? footballMetadataMap[primaryPlayer] : undefined;
    if (stage === 1 && meta) {
      return `Most famous match — nationality: ${meta.nationality} | club: ${meta.club}`;
    }
    if (stage === 2 && meta) {
      return `Most famous match — position: ${meta.position} | era: ${meta.era}`;
    }
    if (stage === 3) {
      return `Most famous match first name: ${getFirstName(primaryPlayer)}`;
    }
    return getFamousPlayerFallbackHint(primaryPlayer, sport, stage);
  }

  if (sport === "basketball") {
    const meta = primaryPlayer ? nbaMetadataMap[primaryPlayer] : undefined;
    if (stage === 1 && meta) {
      return `Most famous match — team: ${meta.team} | nationality: ${meta.nationality}`;
    }
    if (stage === 2 && meta) {
      return `Most famous match — position: ${meta.position}`;
    }
    if (stage === 3) {
      return `Most famous match first name: ${getFirstName(primaryPlayer)}`;
    }
    return getFamousPlayerFallbackHint(primaryPlayer, sport, stage);
  }

  if (sport === "tennis") {
    const meta = primaryPlayer ? tennisMetadataMap[primaryPlayer] : undefined;
    if (stage === 1 && meta) {
      return `Most famous match — nationality: ${meta.nationality}`;
    }
    if (stage === 2 && meta) {
      return `Most famous match — handedness: ${meta.handedness} | highest rank: #${meta.highestRank}`;
    }
    if (stage === 3) {
      return `Most famous match first name: ${getFirstName(primaryPlayer)}`;
    }
    return getFamousPlayerFallbackHint(primaryPlayer, sport, stage);
  }

  return getFamousPlayerFallbackHint(primaryPlayer, sport, stage);
}

/**
 * i18n (docs/I18N_CONTENT_DESIGN.md, P4.3): the structured form of
 * buildFamousPlayerHint. The v2 Survival screen composes the localized hint from
 * `key` (→ a `survival.hintBody.*` template in the `play` namespace) + `vars`.
 * Values stay CANONICAL — player/club/team/nationality are proper nouns, and
 * position/era/handedness are left canonical for now (only the template scaffolding
 * + labels translate; see the P4.3 decision). The legacy English `hintText` is
 * unchanged for v1. `key`/`vars` mirror the English branches above 1:1.
 */
type HintI18n = { key: string; vars: Record<string, string | number> };

function fallbackHintI18n(
  primaryPlayer: string,
  sport: string,
  stage: number,
): HintI18n {
  if (!primaryPlayer) return { key: "fbNoPlayer", vars: { sport } };
  if (stage === 1) {
    return {
      key: "fbFirstNameLen",
      vars: { sport, length: getFirstName(primaryPlayer).length },
    };
  }
  if (stage === 2) {
    return { key: "fbLastNameInitial", vars: { initial: getLastNameInitial(primaryPlayer) } };
  }
  return { key: "fmFirstName", vars: { firstName: getFirstName(primaryPlayer) } };
}

function buildFamousPlayerHintI18n(
  sport: string,
  primaryPlayer: string,
  stage: number,
): HintI18n {
  if (sport === "football") {
    const meta = primaryPlayer ? footballMetadataMap[primaryPlayer] : undefined;
    if (stage === 1 && meta) {
      return { key: "fmNationalityClub", vars: { nationality: meta.nationality, club: meta.club } };
    }
    if (stage === 2 && meta) {
      return { key: "fmPositionEra", vars: { position: meta.position, era: meta.era } };
    }
    if (stage === 3) return { key: "fmFirstName", vars: { firstName: getFirstName(primaryPlayer) } };
    return fallbackHintI18n(primaryPlayer, sport, stage);
  }

  if (sport === "basketball") {
    const meta = primaryPlayer ? nbaMetadataMap[primaryPlayer] : undefined;
    if (stage === 1 && meta) {
      return { key: "fmTeamNationality", vars: { team: meta.team, nationality: meta.nationality } };
    }
    if (stage === 2 && meta) return { key: "fmPosition", vars: { position: meta.position } };
    if (stage === 3) return { key: "fmFirstName", vars: { firstName: getFirstName(primaryPlayer) } };
    return fallbackHintI18n(primaryPlayer, sport, stage);
  }

  if (sport === "tennis") {
    const meta = primaryPlayer ? tennisMetadataMap[primaryPlayer] : undefined;
    if (stage === 1 && meta) return { key: "fmNationality", vars: { nationality: meta.nationality } };
    if (stage === 2 && meta) {
      return { key: "fmHandednessRank", vars: { handedness: meta.handedness, rank: meta.highestRank } };
    }
    if (stage === 3) return { key: "fmFirstName", vars: { firstName: getFirstName(primaryPlayer) } };
    return fallbackHintI18n(primaryPlayer, sport, stage);
  }

  return fallbackHintI18n(primaryPlayer, sport, stage);
}

function getChallengeValidGuessPlayers(
  sport: string,
  challenge: Pick<SurvivalChallenge, "initials" | "validPlayers">,
): string[] {
  const allPlayersForInitials = getInitialsMap(sport)[challenge.initials] ?? [];
  return Array.from(
    new Set(
      [...challenge.validPlayers, ...allPlayersForInitials].filter(
        (player): player is string =>
          typeof player === "string" && player.trim().length > 0,
      ),
    ),
  );
}

function generateFootballChallengeFromCuratedIndex(
  round: number,
  usedInitials: string[],
): SurvivalChallenge | null {
  const diff = getDifficulty(round);
  const usedSet = new Set(usedInitials);
  const validBuckets = FOOTBALL_CURATED_SURVIVAL_INDEX.filter(
    (bucket) =>
      !usedSet.has(bucket.initials) &&
      isAlphabeticInitials(bucket.initials) &&
      bucket.playerNames.length > 0 &&
      bucket.totalPlayers > 0,
  );

  if (!validBuckets.length) {
    return null;
  }

  const preferences = getFootballRoundPreferences(round);
  const candidatePool =
    preferences.filters
      .map((filter) => validBuckets.filter(filter))
      .find((candidates) => candidates.length > 0) ?? validBuckets;

  const pickedBucket = pickWeighted(
    candidatePool,
    (bucket) => bucket.bucketScore,
  );

  if (!pickedBucket) {
    return null;
  }

  const primaryPlayer =
    pickedBucket.topPlayerName ??
    pickDeterministicPrimaryPlayer(pickedBucket.playerNames);

  if (!primaryPlayer) {
    return null;
  }

  return {
    initials: pickedBucket.initials,
    round,
    difficulty: diff.label,
    validPlayers: [...pickedBucket.playerNames],
    primaryPlayer,
  };
}

function generateLegacyChallenge(
  sport: string,
  round: number,
  usedInitials: string[],
): SurvivalChallenge | null {
  const diff = getDifficulty(round);
  const candidates = getCuratedBucketsForRound(sport, round, usedInitials);
  const picked = pickWeightedBucket(
    candidates.length > 0
      ? candidates
      : getFallbackBucketsForRound(sport, round, usedInitials),
  );

  if (!picked) return null;

  const primaryPlayer =
    picked.primaryPlayer || pickPrimaryPlayer(picked.players, sport);

  return {
    initials: picked.initials,
    round,
    difficulty: diff.label,
    validPlayers: [...picked.players],
    primaryPlayer,
  };
}

function generateFootballChallengeFallback(
  round: number,
  usedInitials: string[],
): SurvivalChallenge | null {
  return generateLegacyChallenge("football", round, usedInitials);
}

function generateFootballChallenge(
  round: number,
  usedInitials: string[],
): SurvivalChallenge | null {
  return (
    generateFootballChallengeFromCuratedIndex(round, usedInitials) ??
    generateFootballChallengeFallback(round, usedInitials)
  );
}

function generateChallenge(
  sport: string,
  round: number,
  usedInitials: string[],
): SurvivalChallenge | null {
  if (sport === "football") {
    return generateFootballChallenge(round, usedInitials);
  }

  return generateLegacyChallenge(sport, round, usedInitials);
}

interface ChallengeViewState {
  helpStage: number;
  potFloored: boolean;
}

const FRESH_CHALLENGE_VIEW: ChallengeViewState = {
  helpStage: 0,
  potFloored: false,
};

/**
 * Client-facing projection of a challenge. Deliberately omits `validPlayers`
 * and `primaryPlayer`; the name only appears as the buildMaskedName() mask,
 * with letters filled in strictly by the server-side help ladder.
 */
function buildChallengeResponse(
  challenge: Pick<
    SurvivalChallenge,
    "initials" | "difficulty" | "validPlayers"
  > & { primaryPlayer?: string },
  sport: string,
  view: ChallengeViewState = FRESH_CHALLENGE_VIEW,
) {
  const primaryPlayer = getChallengePrimaryPlayer(sport, challenge);
  const revealedLetters = getRevealedLetterCount(view.helpStage);
  return {
    initials: challenge.initials,
    difficulty: challenge.difficulty,
    hint: `Find a ${sport} player with initials ${challenge.initials}`,
    maskedName: buildMaskedName(primaryPlayer, revealedLetters),
    basePot: getBasePot(challenge.difficulty),
    potValue: getPotValue(challenge.difficulty, view.helpStage, view.potFloored),
    lettersRemaining: Math.max(
      0,
      countHiddenLetters(primaryPlayer) - revealedLetters,
    ),
  };
}

export const startGame = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertFullAccountUser(ctx, userId);

    const challenge = generateChallenge(sport, 1, []);
    if (!challenge) throw new Error("No survival data available");

    const sessionId = await ctx.db.insert("survivalSessions", {
      userId,
      sport,
      round: 1,
      score: 0,
      correctCount: 0,
      lives: 3,
      hintUsed: false,
      usedInitials: [challenge.initials],
      gameOver: false,
      expiresAt: Date.now() + SESSION_TTL_MS,
      startedAt: Date.now(),
      currentChallenge: challenge,
      speedStreak: 0,
      lastAnswerAt: 0,
      performanceBonus: 0,
      closeCallRound: 1,
      closeCallCount: 0,
      helpStage: 0,
      skipsLeft: SKIPS_PER_GAME,
    });

    return {
      sessionId,
      round: 1,
      lives: 3,
      score: 0,
      skipsLeft: SKIPS_PER_GAME,
      challenge: buildChallengeResponse(challenge, sport),
    };
  },
});

export const getSession = query({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    if (session.userId && session.userId !== userId) return null;
    const expired = Date.now() > session.expiresAt;
    return {
      round: session.round,
      score: session.score,
      correctCount: session.correctCount ?? 0,
      lives: session.lives,
      hintUsed: session.hintUsed,
      gameOver: session.gameOver || expired,
      helpStage: session.helpStage ?? 0,
      speedStreak: session.speedStreak ?? 0,
      skipsLeft: session.skipsLeft ?? SKIPS_PER_GAME,
      challenge: session.currentChallenge
        ? buildChallengeResponse(session.currentChallenge, session.sport, {
            helpStage: session.helpStage ?? 0,
            potFloored: session.potFloorRound === session.round,
          })
        : null,
    };
  },
});

export const submitGuess = mutation({
  args: {
    sessionId: v.id("survivalSessions"),
    guess: v.string(),
  },
  handler: async (ctx, { sessionId, guess }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.gameOver) throw new Error("Invalid session");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { gameOver: true });
      throw new Error("Session expired");
    }

    const challenge = session.currentChallenge;
    if (!challenge) throw new Error("No active challenge");

    const validGuessPlayers = getChallengeValidGuessPlayers(
      session.sport,
      challenge,
    );
    const {
      matched: correct,
      distance,
      matchedPlayer,
      closeCall,
      typoAccepted,
      surnameMatch,
      ambiguousSurname,
    } = findBestMatch(guess, validGuessPlayers, { acceptSurname: true });

    const helpStage = session.helpStage ?? 0;
    const potFloored = session.potFloorRound === session.round;
    const potValue = getPotValue(challenge.difficulty, helpStage, potFloored);

    // Close call: one free retry per round, then it counts as a miss.
    // An ambiguous surname ("Silva" when several Silvas fit) rides the same
    // free-retry lane with its own flag so the UI can ask for the full name.
    if (!correct && closeCall) {
      const closeCallsThisRound =
        session.closeCallRound === session.round
          ? (session.closeCallCount ?? 0)
          : 0;

      if (closeCallsThisRound < FREE_CLOSE_CALLS_PER_ROUND) {
        await ctx.db.patch(sessionId, {
          closeCallRound: session.round,
          closeCallCount: closeCallsThisRound + 1,
          speedStreak: 0,
          lastAnswerAt: Date.now(),
        });

        return {
          correct: false,
          closeCall: true,
          ambiguousSurname,
          typoAccepted: false,
          surnameMatch: false,
          matchDistance: distance,
          // Never reveal what the near-miss was close to — the round is
          // still live and the mask is the only sanctioned reveal channel.
          correctAnswer: null,
          pointsEarned: 0,
          potValue,
          lives: session.lives,
          score: session.score,
          round: session.round,
          gameOver: false,
          speedStreak: 0,
          isOnFire: false,
          earnedLife: false,
          isHiddenAnswer: false,
          nextChallenge: null,
        };
      }
    }

    if (correct) {
      const now = Date.now();
      const lastAnswerAt = session.lastAnswerAt ?? 0;
      const elapsed = lastAnswerAt > 0 ? (now - lastAnswerAt) / 1000 : Infinity;

      // The streak (and its earn-a-life / On Fire rewards) only feeds on
      // full-pot answers — using the help ladder banks points but resets it.
      const noHelpUsed = helpStage === 0 && !potFloored;
      const newStreak = noHelpUsed
        ? elapsed < 4.0
          ? (session.speedStreak ?? 0) + 1
          : 1
        : 0;
      const isOnFire = newStreak >= 5;
      const bonusIncrement = isOnFire ? 0.1 : 0;

      // Hidden answer detection
      const primaryPlayer = getChallengePrimaryPlayer(session.sport, challenge);
      const isHiddenAnswer = matchedPlayer !== primaryPlayer;
      const hiddenBonus = 0;

      // Earn-a-life: exactly hitting "On Fire" threshold with < 3 lives
      const earnedLife = newStreak === 5 && session.lives < 3;
      const newLives = earnedLife ? session.lives + 1 : session.lives;

      const newRound = session.round + 1;
      const newScore = session.score + potValue;
      const newCorrectCount = (session.correctCount ?? 0) + 1;
      const next = generateChallenge(
        session.sport,
        newRound,
        session.usedInitials,
      );

      await ctx.db.patch(sessionId, {
        round: newRound,
        score: newScore,
        correctCount: newCorrectCount,
        lives: newLives,
        usedInitials: next
          ? [...session.usedInitials, next.initials]
          : session.usedInitials,
        currentChallenge: next ?? undefined,
        gameOver: !next,
        speedStreak: newStreak,
        lastAnswerAt: now,
        performanceBonus: Math.min(
          PERFORMANCE_BONUS_CAP,
          (session.performanceBonus ?? 0) + bonusIncrement + hiddenBonus,
        ),
        closeCallRound: newRound,
        closeCallCount: 0,
        helpStage: 0,
      });

      return {
        correct: true,
        closeCall: false,
        ambiguousSurname: false,
        typoAccepted,
        surnameMatch,
        matchDistance: distance,
        correctAnswer: matchedPlayer,
        pointsEarned: potValue,
        potValue,
        lives: newLives,
        score: newScore,
        round: newRound,
        gameOver: !next,
        speedStreak: newStreak,
        isOnFire,
        earnedLife,
        isHiddenAnswer,
        nextChallenge: next
          ? buildChallengeResponse(next, session.sport)
          : null,
      };
    } else {
      const newLives = session.lives - 1;

      let next = null;
      if (newLives > 0) {
        next = generateChallenge(
          session.sport,
          session.round + 1,
          session.usedInitials,
        );
      }
      const isGameOver = newLives <= 0 || !next;

      await ctx.db.patch(sessionId, {
        lives: newLives,
        gameOver: isGameOver,
        speedStreak: 0,
        lastAnswerAt: 0,
        closeCallRound: next ? session.round + 1 : session.round,
        closeCallCount: 0,
        helpStage: 0,
        ...(next
          ? {
              round: session.round + 1,
              usedInitials: [...session.usedInitials, next.initials],
              currentChallenge: next,
            }
          : {}),
      });

      return {
        correct: false,
        closeCall: false,
        ambiguousSurname: false,
        typoAccepted: false,
        surnameMatch: false,
        matchDistance: distance,
        // A committed miss ends the round, so revealing the answer here is
        // the learning moment, not a leak.
        correctAnswer: matchedPlayer,
        pointsEarned: 0,
        potValue,
        lives: newLives,
        score: session.score,
        round: next ? session.round + 1 : session.round,
        gameOver: isGameOver,
        speedStreak: 0,
        isOnFire: false,
        earnedLife: false,
        isHiddenAnswer: false,
        nextChallenge: next
          ? buildChallengeResponse(next, session.sport)
          : null,
      };
    }
  },
});

/**
 * The one help button of the Reveal Ladder. Every press advances a single
 * per-round ladder and shrinks the pot: stages 1-2 are metadata clues
 * (nationality/club, position/era, …), every later stage fills in one letter
 * of the masked name. Unlimited presses — a round can always be revealed down
 * to the floor and finished, so nobody gets hard-stuck.
 */
export const requestHelp = mutation({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.gameOver) throw new Error("Invalid session");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { gameOver: true });
      throw new Error("Session expired");
    }

    const challenge = session.currentChallenge;
    if (!challenge) throw new Error("No active challenge");

    const sport = session.sport;
    const primaryPlayer = getChallengePrimaryPlayer(sport, challenge);
    const stage = (session.helpStage ?? 0) + 1;
    const hiddenTotal = countHiddenLetters(primaryPlayer);

    let kind: "clue" | "letter";
    let hintText: string | null = null;
    let hintI18n: HintI18n | null = null;
    if (stage <= CLUE_STAGES) {
      kind = "clue";
      // Legacy English string (v1 screens, untranslated) + structured form
      // localized in the v2 UI via `survival.hintBody.<key>`.
      hintText = buildFamousPlayerHint(sport, primaryPlayer, stage);
      hintI18n = buildFamousPlayerHintI18n(sport, primaryPlayer, stage);
    } else {
      kind = "letter";
      if (getRevealedLetterCount(session.helpStage ?? 0) >= hiddenTotal) {
        throw new Error("Nothing left to reveal");
      }
    }

    await ctx.db.patch(sessionId, {
      helpStage: stage,
      hintUsed: true,
    });

    const revealedLetters = getRevealedLetterCount(stage);
    const potFloored = session.potFloorRound === session.round;
    return {
      stage,
      kind,
      hintText,
      hintI18n,
      maskedName: buildMaskedName(primaryPlayer, revealedLetters),
      potValue: getPotValue(challenge.difficulty, stage, potFloored),
      lettersRemaining: Math.max(0, hiddenTotal - revealedLetters),
    };
  },
});

export const skipChallenge = mutation({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.gameOver) throw new Error("Invalid session");
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { gameOver: true });
      throw new Error("Session expired");
    }

    // Skips never cost a life in the Reveal Ladder — lives are only lost on
    // committed wrong guesses. A small per-game budget keeps skip-fishing for
    // favourable initials bounded.
    const skipsLeft = session.skipsLeft ?? SKIPS_PER_GAME;
    if (skipsLeft <= 0) throw new Error("No skips remaining");
    const newSkips = skipsLeft - 1;
    const newLives = session.lives;

    const next = generateChallenge(
      session.sport,
      session.round + 1,
      session.usedInitials,
    );
    const isGameOver = newLives <= 0 || !next;

    await ctx.db.patch(sessionId, {
      skipsLeft: newSkips,
      gameOver: isGameOver,
      speedStreak: 0,
      lastAnswerAt: 0,
      helpStage: 0,
      closeCallCount: 0,
      ...(next
        ? {
            round: session.round + 1,
            usedInitials: [...session.usedInitials, next.initials],
            currentChallenge: next,
            closeCallRound: session.round + 1,
          }
        : {}),
    });

    return {
      lives: newLives,
      skipsLeft: newSkips,
      score: session.score,
      round: next ? session.round + 1 : session.round,
      gameOver: isGameOver,
      speedStreak: 0,
      isOnFire: false,
      challenge: next
        ? buildChallengeResponse(next, session.sport)
        : null,
    };
  },
});

/**
 * Voluntary cash-out: ends the run so the banked score can be finalized via
 * games.completeSurvival. Distinct from abandoning the tab — this is the
 * graceful "I'm done, record my points" exit.
 */
export const endRun = mutation({
  args: { sessionId: v.id("survivalSessions") },
  handler: async (ctx, { sessionId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }

    if (!session.gameOver) {
      await ctx.db.patch(sessionId, { gameOver: true });
    }

    return {
      gameOver: true,
      score: session.score,
      round: session.round,
    };
  },
});

export const penalizeTabSwitch = mutation({
  args: {
    sessionId: v.id("survivalSessions"),
    currentRound: v.number(),
  },
  handler: async (ctx, { sessionId, currentRound }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.gameOver) {
      return { penalized: false, warning: false, lives: 0, gameOver: true };
    }
    if (Date.now() > session.expiresAt) {
      await ctx.db.patch(sessionId, { gameOver: true });
      return {
        penalized: false,
        warning: false,
        lives: session.lives,
        gameOver: true,
      };
    }

    if (session.lastPenalizedRound === currentRound) {
      return {
        penalized: false,
        warning: false,
        lives: session.lives,
        gameOver: session.gameOver,
      };
    }

    // First offense of the game: no life lost, but the current round's pot
    // collapses to the floor — a quick lookup can only ever earn the minimum.
    // Repeat offenses cost a life as before.
    if (!session.antiCheatWarned) {
      await ctx.db.patch(sessionId, {
        antiCheatWarned: true,
        potFloorRound: session.round,
        lastPenalizedRound: currentRound,
      });
      return {
        penalized: true,
        warning: true,
        lives: session.lives,
        potValue: POT_FLOOR,
        gameOver: false,
      };
    }

    const newLives = session.lives - 1;
    const isGameOver = newLives <= 0;

    await ctx.db.patch(sessionId, {
      lives: newLives,
      gameOver: isGameOver,
      lastPenalizedRound: currentRound,
    });

    return { penalized: true, warning: false, lives: newLives, gameOver: isGameOver };
  },
});
