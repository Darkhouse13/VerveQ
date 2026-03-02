#!/usr/bin/env node
/**
 * generate_image_dataset.js
 *
 * Fetches stadium images, player cutouts, and team badges from TheSportsDB
 * (free API) and generates image-based trivia questions for VerveQ.
 *
 * Usage:  node scripts/generate_image_dataset.js
 * Output: complete_image_seed_data.json (project root)
 * Requires: Node.js 18+ (native fetch)
 */

const fs = require("fs");
const path = require("path");

// ─── Configuration ───────────────────────────────────────────────────────────

const OUTPUT_PATH = path.join(__dirname, "..", "complete_image_seed_data.json");
const RATE_LIMIT_MS = 1500;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 5000;
const START_ID = 1001;

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

const LEAGUE_CONFIG = [
  // Football — Tier 1 (easy)
  { league: "English Premier League", sport: "football", tier: 1 },
  { league: "Spanish La Liga", sport: "football", tier: 1 },
  { league: "German Bundesliga", sport: "football", tier: 1 },
  { league: "Italian Serie A", sport: "football", tier: 1 },
  { league: "French Ligue 1", sport: "football", tier: 1 },
  // Football — Tier 2 (intermediate)
  { league: "Dutch Eredivisie", sport: "football", tier: 2 },
  { league: "Portuguese Primeira Liga", sport: "football", tier: 2 },
  { league: "Turkish Süper Lig", sport: "football", tier: 2 },
  { league: "English League Championship", sport: "football", tier: 2 },
  // Football — Tier 3 (hard)
  { league: "Brazilian Serie A", sport: "football", tier: 3 },
  { league: "Scottish Premiership", sport: "football", tier: 3 },
  { league: "Belgian Pro League", sport: "football", tier: 3 },
  // Basketball — Tier 1 (easy)
  { league: "NBA", sport: "basketball", tier: 1 },
  // Basketball — Tier 2 (intermediate)
  { league: "Spanish Liga ACB", sport: "basketball", tier: 2 },
];

// ─── Utility Functions ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * djb2 checksum matching forge.ts pattern, with `img_` prefix to avoid
 * collision with existing seed checksums (hex) and forge checksums (forge_).
 */
function generateChecksum(question, options) {
  const normalized = [question, ...options.slice().sort()]
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
  let hash = 5381;
  for (let i = 0; i < normalized.length; i++) {
    hash = ((hash << 5) + hash + normalized.charCodeAt(i)) | 0;
  }
  return `img_${Math.abs(hash).toString(16)}`;
}

/** Fisher-Yates shuffle (returns new array). */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function difficultyFromTier(tier) {
  if (tier === 1) return "easy";
  if (tier === 2) return "intermediate";
  return "hard";
}

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const wait = RETRY_BACKOFF_MS * (attempt + 1);
        console.warn(`  Rate limited, waiting ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) {
        console.error(`  Failed after ${retries + 1} attempts: ${err.message}`);
        return null;
      }
      console.warn(`  Retry ${attempt + 1}/${retries}: ${err.message}`);
      await sleep(RETRY_BACKOFF_MS);
    }
  }
  return null;
}

/** Pick `count` random distractors from `pool`, excluding `exclude`. */
function pickDistractors(pool, exclude, count = 3) {
  const candidates = pool.filter((item) => item !== exclude);
  return shuffleArray(candidates).slice(0, count);
}

// ─── Data Collection ─────────────────────────────────────────────────────────

async function fetchAllTeams() {
  const teamsByLeague = new Map();
  const seenTeamIds = new Set();

  for (const config of LEAGUE_CONFIG) {
    await sleep(RATE_LIMIT_MS);
    process.stdout.write(`Fetching teams: ${config.league}...`);

    const url = `${BASE_URL}/search_all_teams.php?l=${encodeURIComponent(config.league)}`;
    const data = await fetchWithRetry(url);

    if (!data || !data.teams) {
      console.log(" no data");
      teamsByLeague.set(config.league, { teams: [], sport: config.sport, tier: config.tier });
      continue;
    }

    // Deduplicate teams across leagues
    const teams = data.teams.filter((t) => {
      if (seenTeamIds.has(t.idTeam)) return false;
      seenTeamIds.add(t.idTeam);
      return true;
    });

    const badgeCount = teams.filter((t) => t.strBadge).length;
    console.log(` ${teams.length} teams (${badgeCount} with badges)`);

    teamsByLeague.set(config.league, { teams, sport: config.sport, tier: config.tier });
  }

  return teamsByLeague;
}

/**
 * Fetch venue thumbnail for a team's stadium.
 * Uses: lookupvenue.php?id={idVenue} → strThumb
 */
async function fetchVenueImage(idVenue) {
  if (!idVenue) return null;
  const url = `${BASE_URL}/lookupvenue.php?id=${idVenue}`;
  const data = await fetchWithRetry(url);
  if (!data || !data.venues || !data.venues[0]) return null;
  return data.venues[0].strThumb || null;
}

/**
 * Fetch stadium images for all teams via the venue lookup endpoint.
 * Adds `venueImageUrl` to each team object.
 */
async function fetchVenueImages(teamsByLeague) {
  const allTeams = [];
  for (const [, { teams }] of teamsByLeague) {
    for (const t of teams) allTeams.push(t);
  }

  let fetched = 0;
  let withImages = 0;

  for (const team of allTeams) {
    if (!team.idVenue || !team.strStadium) {
      team.venueImageUrl = null;
      continue;
    }

    fetched++;
    await sleep(RATE_LIMIT_MS);
    process.stdout.write(
      `Fetching venue (${fetched}): ${team.strStadium}...`
    );

    const imageUrl = await fetchVenueImage(team.idVenue);
    team.venueImageUrl = imageUrl;

    if (imageUrl) {
      withImages++;
      console.log(" found");
    } else {
      console.log(" no image");
    }
  }

  console.log(`  Venues with images: ${withImages}/${fetched}`);
}

/**
 * Fetch players using lookup_all_players.php?id={teamId}
 * (the searchplayers.php endpoint is unreliable)
 */
async function fetchAllPlayers(teamsByLeague) {
  const allTeamEntries = [];
  for (const [league, { teams, sport, tier }] of teamsByLeague) {
    for (const team of teams) {
      allTeamEntries.push({ team, sport, tier, league });
    }
  }

  const playersBySport = {};
  let fetchedCount = 0;

  for (const entry of allTeamEntries) {
    fetchedCount++;
    await sleep(RATE_LIMIT_MS);
    process.stdout.write(
      `Fetching players (${fetchedCount}/${allTeamEntries.length}): ${entry.team.strTeam}...`
    );

    const url = `${BASE_URL}/lookup_all_players.php?id=${entry.team.idTeam}`;
    const data = await fetchWithRetry(url);

    if (!data || !data.player) {
      console.log(" no data");
      continue;
    }

    // Only keep players with cutout images
    const playersWithCutouts = data.player.filter(
      (p) => p.strCutout && p.strCutout.trim() !== "" && p.strPlayer
    );

    if (!playersBySport[entry.sport]) playersBySport[entry.sport] = [];

    for (const p of playersWithCutouts) {
      playersBySport[entry.sport].push({
        name: p.strPlayer,
        team: entry.team.strTeam,
        position: p.strPosition || "Player",
        nationality: p.strNationality || "Unknown",
        cutoutUrl: p.strCutout,
        tier: entry.tier,
        league: entry.league,
      });
    }

    console.log(` ${playersWithCutouts.length} with cutouts`);
  }

  return playersBySport;
}

// ─── Question Generation ─────────────────────────────────────────────────────

function generateStadiumQuestions(teamsByLeague) {
  const questions = [];

  // Build sport-wide stadium name pools as fallback
  const stadiumsBySport = {};
  for (const [, { teams, sport }] of teamsByLeague) {
    if (!stadiumsBySport[sport]) stadiumsBySport[sport] = [];
    for (const t of teams) {
      if (isValidStadium(t)) {
        stadiumsBySport[sport].push(t.strStadium);
      }
    }
  }

  for (const [, { teams, sport, tier }] of teamsByLeague) {
    const validTeams = teams.filter(isValidStadium);
    const leagueStadiumNames = validTeams.map((t) => t.strStadium);
    const difficulty = difficultyFromTier(tier);

    for (const team of validTeams) {
      let pool = leagueStadiumNames;
      if (leagueStadiumNames.length < 4) {
        pool = stadiumsBySport[sport] || [];
      }
      if (pool.length < 4) continue;

      const wrongAnswers = pickDistractors(pool, team.strStadium, 3);
      if (wrongAnswers.length < 3) continue;

      const options = shuffleArray([team.strStadium, ...wrongAnswers]);
      const question = "Which stadium is shown in this image?";

      questions.push({
        sport,
        category: "stadium_identification",
        question,
        options,
        correct_answer: team.strStadium,
        difficulty,
        bucket: `${sport}_${difficulty}_stadium_identification_1`,
        checksum: generateChecksum(question, options),
        explanation: `This is ${team.strStadium}, the home ground of ${team.strTeam}.`,
        imageUrl: team.venueImageUrl,
        imageType: "stadium",
      });
    }
  }

  return questions;
}

function isValidStadium(team) {
  return (
    team.venueImageUrl &&
    team.strStadium &&
    team.strStadium.trim() !== "" &&
    team.strStadium.toLowerCase() !== "null" &&
    team.strStadium.toLowerCase() !== "n/a"
  );
}

function generateBadgeQuestions(teamsByLeague) {
  const questions = [];

  // Build sport-wide team name pools as fallback
  const teamNamesBySport = {};
  for (const [, { teams, sport }] of teamsByLeague) {
    if (!teamNamesBySport[sport]) teamNamesBySport[sport] = [];
    for (const t of teams) {
      if (t.strBadge && t.strTeam) {
        teamNamesBySport[sport].push(t.strTeam);
      }
    }
  }

  for (const [, { teams, sport, tier }] of teamsByLeague) {
    const validTeams = teams.filter((t) => t.strBadge && t.strTeam);
    const leagueTeamNames = validTeams.map((t) => t.strTeam);
    const difficulty = difficultyFromTier(tier);

    for (const team of validTeams) {
      let pool = leagueTeamNames;
      if (leagueTeamNames.length < 4) {
        pool = teamNamesBySport[sport] || [];
      }
      if (pool.length < 4) continue;

      const wrongAnswers = pickDistractors(pool, team.strTeam, 3);
      if (wrongAnswers.length < 3) continue;

      const options = shuffleArray([team.strTeam, ...wrongAnswers]);
      const question = "Which team does this badge belong to?";

      questions.push({
        sport,
        category: "badge_identification",
        question,
        options,
        correct_answer: team.strTeam,
        difficulty,
        bucket: `${sport}_${difficulty}_badge_identification_1`,
        checksum: generateChecksum(question, options),
        explanation: `This badge belongs to ${team.strTeam}.`,
        imageUrl: team.strBadge,
        imageType: "badge",
      });
    }
  }

  return questions;
}

function generatePlayerQuestions(playersBySport) {
  const questions = [];

  for (const [sport, players] of Object.entries(playersBySport)) {
    if (players.length < 4) {
      console.warn(`  Skipping ${sport} player questions — only ${players.length} players with cutouts`);
      continue;
    }

    const allNames = players.map((p) => p.name);

    for (const player of players) {
      const wrongAnswers = pickDistractors(allNames, player.name, 3);
      if (wrongAnswers.length < 3) continue;

      const options = shuffleArray([player.name, ...wrongAnswers]);
      const question = "Who is this player?";
      const difficulty = difficultyFromTier(player.tier);

      questions.push({
        sport,
        category: "player_silhouette",
        question,
        options,
        correct_answer: player.name,
        difficulty,
        bucket: `${sport}_${difficulty}_player_silhouette_1`,
        checksum: generateChecksum(question, options),
        explanation: `This is ${player.name}, a ${player.nationality} ${player.position} who plays for ${player.team}.`,
        imageUrl: player.cutoutUrl,
        imageType: "player_silhouette",
      });
    }
  }

  return questions;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== VerveQ Image Dataset Generator ===\n");
  const startTime = Date.now();

  // Phase 1: Fetch teams
  console.log("-- Phase 1: Fetching teams --\n");
  const teamsByLeague = await fetchAllTeams();
  const totalTeams = [...teamsByLeague.values()].reduce((s, v) => s + v.teams.length, 0);
  console.log(`\nTotal teams: ${totalTeams}\n`);

  // Phase 2: Fetch venue/stadium images
  console.log("-- Phase 2: Fetching stadium images --\n");
  await fetchVenueImages(teamsByLeague);
  console.log();

  // Phase 3: Fetch players
  console.log("-- Phase 3: Fetching players --\n");
  const playersBySport = await fetchAllPlayers(teamsByLeague);
  for (const [sport, players] of Object.entries(playersBySport)) {
    console.log(`  ${sport}: ${players.length} players with cutouts`);
  }
  console.log();

  // Phase 4: Generate questions
  console.log("-- Phase 4: Generating questions --\n");
  const stadiumQs = generateStadiumQuestions(teamsByLeague);
  console.log(`  Stadium questions: ${stadiumQs.length}`);

  const badgeQs = generateBadgeQuestions(teamsByLeague);
  console.log(`  Badge questions: ${badgeQs.length}`);

  const playerQs = generatePlayerQuestions(playersBySport);
  console.log(`  Player silhouette questions: ${playerQs.length}`);

  // Phase 5: Deduplicate and assign IDs
  const checksumSet = new Set();
  const allQuestions = [];
  let nextId = START_ID;

  for (const q of [...stadiumQs, ...badgeQs, ...playerQs]) {
    if (!checksumSet.has(q.checksum)) {
      checksumSet.add(q.checksum);
      allQuestions.push({ id: nextId++, ...q });
    }
  }

  // Phase 6: Write output
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allQuestions, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n-- Done! --`);
  console.log(`  Total questions: ${allQuestions.length}`);
  console.log(`  Stadium:         ${stadiumQs.length}`);
  console.log(`  Badge:           ${badgeQs.length}`);
  console.log(`  Player:          ${playerQs.length}`);
  console.log(`  Duplicates:      ${stadiumQs.length + badgeQs.length + playerQs.length - allQuestions.length}`);
  console.log(`  Time:            ${elapsed}s`);
  console.log(`  Output:          ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
