import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { findBestMatch } from "./lib/fuzzy";

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
  maskedName: string;
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

function buildMaskedName(player: string): string {
  return player
    .split("")
    .map((ch) => (ch === " " ? " " : "_"))
    .join("");
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
    maskedName: buildMaskedName(primaryPlayer),
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
    maskedName: buildMaskedName(primaryPlayer),
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

function buildChallengeResponse(
  challenge: Pick<SurvivalChallenge, "initials" | "difficulty"> & {
    maskedName?: string;
  },
  sport: string,
) {
  return {
    initials: challenge.initials,
    difficulty: challenge.difficulty,
    hint: `Find a ${sport} player with initials ${challenge.initials}`,
    maskedName: challenge.maskedName,
  };
}

export const startGame = mutation({
  args: { sport: v.string() },
  handler: async (ctx, { sport }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const challenge = generateChallenge(sport, 1, []);
    if (!challenge) throw new Error("No survival data available");

    const sessionId = await ctx.db.insert("survivalSessions", {
      userId,
      sport,
      round: 1,
      score: 0,
      lives: 3,
      hintUsed: false,
      usedInitials: [challenge.initials],
      gameOver: false,
      expiresAt: Date.now() + SESSION_TTL_MS,
      currentChallenge: challenge,
      speedStreak: 0,
      lastAnswerAt: 0,
      performanceBonus: 0,
      hintTokensLeft: 3,
      currentHintStage: 0,
      freeSkipsLeft: 1,
    });

    return {
      sessionId,
      round: 1,
      lives: 3,
      score: 0,
      hintAvailable: true,
      hintTokensLeft: 3,
      freeSkipsLeft: 1,
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
    return {
      round: session.round,
      score: session.score,
      lives: session.lives,
      hintUsed: session.hintUsed,
      gameOver: session.gameOver,
      hintTokensLeft: session.hintTokensLeft ?? 0,
      currentHintStage: session.currentHintStage ?? 0,
      speedStreak: session.speedStreak ?? 0,
      freeSkipsLeft: session.freeSkipsLeft ?? 0,
      challenge: session.currentChallenge
        ? buildChallengeResponse(session.currentChallenge, session.sport)
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

    const challenge = session.currentChallenge;
    if (!challenge) throw new Error("No active challenge");

    const { matched: correct, distance, matchedPlayer, closeCall, typoAccepted } = findBestMatch(
      guess,
      challenge.validPlayers,
    );

    // Close call: don't penalize, let user retry
    if (!correct && closeCall) {
      return {
        correct: false,
        closeCall: true,
        typoAccepted: false,
        matchDistance: distance,
        correctAnswer: matchedPlayer,
        lives: session.lives,
        score: session.score,
        round: session.round,
        gameOver: false,
        speedStreak: session.speedStreak ?? 0,
        isOnFire: (session.speedStreak ?? 0) >= 5,
        earnedLife: false,
        isHiddenAnswer: false,
        nextChallenge: null,
      };
    }

    if (correct) {
      const now = Date.now();
      const lastAnswerAt = session.lastAnswerAt ?? 0;
      const elapsed = lastAnswerAt > 0 ? (now - lastAnswerAt) / 1000 : Infinity;

      const newStreak = elapsed < 4.0 ? (session.speedStreak ?? 0) + 1 : 1;
      const isOnFire = newStreak >= 5;
      const bonusIncrement = isOnFire ? 0.1 : 0;

      // Hidden answer detection
      const primaryPlayer = getChallengePrimaryPlayer(session.sport, challenge);
      const isHiddenAnswer = matchedPlayer !== primaryPlayer;
      const hiddenBonus = isHiddenAnswer ? 0.2 : 0;

      // Earn-a-life: exactly hitting "On Fire" threshold with < 3 lives
      const earnedLife = newStreak === 5 && session.lives < 3;
      const newLives = earnedLife ? session.lives + 1 : session.lives;

      const newRound = session.round + 1;
      const newScore = session.score + 1;
      const next = generateChallenge(
        session.sport,
        newRound,
        session.usedInitials,
      );

      await ctx.db.patch(sessionId, {
        round: newRound,
        score: newScore,
        lives: newLives,
        usedInitials: next
          ? [...session.usedInitials, next.initials]
          : session.usedInitials,
        currentChallenge: next ?? undefined,
        gameOver: !next,
        speedStreak: newStreak,
        lastAnswerAt: now,
        performanceBonus: (session.performanceBonus ?? 0) + bonusIncrement + hiddenBonus,
        currentHintStage: 0,
      });

      return {
        correct: true,
        closeCall: false,
        typoAccepted,
        matchDistance: distance,
        correctAnswer: matchedPlayer,
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
      const isGameOver = newLives <= 0;

      let next = null;
      if (!isGameOver) {
        next = generateChallenge(
          session.sport,
          session.round + 1,
          session.usedInitials,
        );
      }

      await ctx.db.patch(sessionId, {
        lives: newLives,
        gameOver: isGameOver,
        speedStreak: 0,
        lastAnswerAt: 0,
        currentHintStage: 0,
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
        typoAccepted: false,
        matchDistance: distance,
        correctAnswer: matchedPlayer,
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

export const useHint = mutation({
  args: {
    sessionId: v.id("survivalSessions"),
    stage: v.number(),
  },
  handler: async (ctx, { sessionId, stage }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Not found");
    if (session.userId && session.userId !== userId) {
      throw new Error("Not authorized");
    }
    if (session.gameOver) throw new Error("Invalid session");

    const tokensLeft = session.hintTokensLeft ?? 0;
    const currentStage = session.currentHintStage ?? 0;

    if (stage !== currentStage + 1) {
      throw new Error("Must use hints in order");
    }
    if (tokensLeft <= 0) {
      throw new Error("No hint tokens remaining");
    }

    const sport = session.sport;
    const challenge = session.currentChallenge;
    const players = challenge?.validPlayers ?? [];
    const primaryPlayer = challenge
      ? getChallengePrimaryPlayer(sport, challenge)
      : "";
    let hintText = "";

    if (sport === "football") {
      const meta = primaryPlayer ? footballMetadataMap[primaryPlayer] : undefined;
      if (stage === 1) {
        hintText = meta
          ? `Nationality: ${meta.nationality} | Club: ${meta.club}`
          : `Football player — ${players.length} possible answers`;
      } else if (stage === 2) {
        hintText = meta
          ? `Position: ${meta.position} | Era: ${meta.era}`
          : `${players.length} players match these initials`;
      } else if (stage === 3) {
        const firstName = primaryPlayer.split(" ")[0] || "Unknown";
        hintText = `First name: ${firstName}`;
      }
    } else if (sport === "basketball") {
      const meta = primaryPlayer ? nbaMetadataMap[primaryPlayer] : undefined;
      if (stage === 1) {
        hintText = meta
          ? `Team: ${meta.team} | Nationality: ${meta.nationality}`
          : `NBA player — ${players.length} possible answers`;
      } else if (stage === 2) {
        hintText = meta
          ? `Position: ${meta.position}`
          : `${players.length} players match these initials`;
      } else if (stage === 3) {
        const firstName = primaryPlayer.split(" ")[0] || "Unknown";
        hintText = `First name: ${firstName}`;
      }
    } else if (sport === "tennis") {
      const meta = primaryPlayer ? tennisMetadataMap[primaryPlayer] : undefined;
      if (stage === 1) {
        hintText = meta
          ? `Nationality: ${meta.nationality}`
          : `Tennis player — ${players.length} possible answers`;
      } else if (stage === 2) {
        hintText = meta
          ? `Handedness: ${meta.handedness} | Highest Rank: #${meta.highestRank}`
          : `${players.length} players match these initials`;
      } else if (stage === 3) {
        const firstName = primaryPlayer.split(" ")[0] || "Unknown";
        hintText = `First name: ${firstName}`;
      }
    } else {
      // Fallback for unknown sports
      if (stage === 3) {
        const firstName = primaryPlayer.split(" ")[0] || "Unknown";
        hintText = `First name: ${firstName}`;
      } else {
        hintText = `${players.length} players match these initials`;
      }
    }

    await ctx.db.patch(sessionId, {
      hintTokensLeft: tokensLeft - 1,
      currentHintStage: stage,
      hintUsed: true,
    });

    return {
      stage,
      hintText,
      tokensLeft: tokensLeft - 1,
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

    const freeSkips = session.freeSkipsLeft ?? 0;
    let newLives: number;
    let newFreeSkips: number;

    if (freeSkips > 0) {
      // Free skip — no life deduction
      newLives = session.lives;
      newFreeSkips = freeSkips - 1;
    } else {
      // Paid skip — deduct life
      newLives = session.lives - 1;
      newFreeSkips = 0;
    }

    const isGameOver = newLives <= 0;

    let next = null;
    if (!isGameOver) {
      next = generateChallenge(
        session.sport,
        session.round + 1,
        session.usedInitials,
      );
    }

    await ctx.db.patch(sessionId, {
      lives: newLives,
      freeSkipsLeft: newFreeSkips,
      gameOver: isGameOver,
      speedStreak: 0,
      lastAnswerAt: 0,
      currentHintStage: 0,
      ...(next
        ? {
            round: session.round + 1,
            usedInitials: [...session.usedInitials, next.initials],
            currentChallenge: next,
          }
        : {}),
    });

    return {
      lives: newLives,
      freeSkipsLeft: newFreeSkips,
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
      return { penalized: false, lives: 0, gameOver: true };
    }

    if (session.lastPenalizedRound === currentRound) {
      return {
        penalized: false,
        lives: session.lives,
        gameOver: session.gameOver,
      };
    }

    const newLives = session.lives - 1;
    const isGameOver = newLives <= 0;

    await ctx.db.patch(sessionId, {
      lives: newLives,
      gameOver: isGameOver,
      lastPenalizedRound: currentRound,
    });

    return { penalized: true, lives: newLives, gameOver: isGameOver };
  },
});
