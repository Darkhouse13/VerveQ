import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { findBestMatch } from "./lib/fuzzy";

// Survival data loaded inline for Convex (no filesystem access in mutations)
// These are imported at bundle time.
import footballData from "./data/survival_initials_map.json";
import tennisData from "./data/survival_initials_map_tennis.json";
import nbaData from "./data/nba_survival_data.json";
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
  famousWeight: number;
  label: string;
}

function getDifficulty(round: number): DifficultyLevel {
  if (round <= 2) return { initialsLen: 2, famousWeight: 1.0, label: "Easy" };
  if (round === 3) return { initialsLen: 2, famousWeight: 0.8, label: "Easy" };
  if (round === 4)
    return { initialsLen: 2, famousWeight: 0.6, label: "Medium" };
  if (round === 5)
    return { initialsLen: 2, famousWeight: 0.4, label: "Medium" };
  if (round <= 7) return { initialsLen: 2, famousWeight: 0.2, label: "Hard" };
  return { initialsLen: 3, famousWeight: 0.2, label: "Expert" };
}

function getInitialsFameScore(players: string[], sport: string): number {
  const famousSet = FAMOUS_PLAYERS[sport] ?? new Set();
  for (const p of players) {
    if (famousSet.has(p)) return 10;
  }
  return 0;
}

function generateChallenge(
  sport: string,
  round: number,
  usedInitials: string[],
) {
  const map = getInitialsMap(sport);
  const diff = getDifficulty(round);
  const usedSet = new Set(usedInitials);

  const candidates = Object.entries(map).filter(
    ([initials, players]) =>
      initials.length <= diff.initialsLen &&
      !usedSet.has(initials) &&
      players.length > 0 &&
      /^[a-zA-Z]+$/.test(initials),
  );

  if (!candidates.length) return null;

  // Score each candidate for fame
  const scored = candidates.map(([initials, players]) => ({
    initials,
    players,
    fameScore: getInitialsFameScore(players, sport),
  }));

  let picked: { initials: string; players: string[]; fameScore: number };

  if (diff.famousWeight >= 0.8) {
    // Rounds 1-3: famous only
    const famous = scored.filter((c) => c.fameScore === 10);
    const pool = famous.length > 0 ? famous : scored;
    picked = pool[Math.floor(Math.random() * pool.length)];
  } else if (diff.famousWeight >= 0.4) {
    // Rounds 4-5: 60% famous, 40% random
    const famous = scored.filter((c) => c.fameScore === 10);
    if (famous.length > 0 && Math.random() < 0.6) {
      picked = famous[Math.floor(Math.random() * famous.length)];
    } else {
      picked = scored[Math.floor(Math.random() * scored.length)];
    }
  } else {
    // Rounds 6+: pure random
    picked = scored[Math.floor(Math.random() * scored.length)];
  }

  // Identify primary player (most famous in validPlayers)
  const famousSet = FAMOUS_PLAYERS[sport] ?? new Set();
  let primaryPlayer = picked.players[0];
  for (const p of picked.players) {
    if (famousSet.has(p)) {
      primaryPlayer = p;
      break;
    }
  }

  // Generate masked name: letters → "_", keep spaces
  const maskedName = primaryPlayer
    .split("")
    .map((ch) => (ch === " " ? " " : "_"))
    .join("");

  return {
    initials: picked.initials,
    round,
    difficulty: diff.label,
    validPlayers: picked.players,
    maskedName,
    primaryPlayer,
  };
}

function buildChallengeResponse(
  challenge: { initials: string; difficulty: string; maskedName?: string },
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
    const challenge = generateChallenge(sport, 1, []);
    if (!challenge) throw new Error("No survival data available");

    const sessionId = await ctx.db.insert("survivalSessions", {
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
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
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
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) throw new Error("Invalid session");

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
      const isHiddenAnswer = matchedPlayer !== challenge.primaryPlayer;
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
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) throw new Error("Invalid session");

    const tokensLeft = session.hintTokensLeft ?? 0;
    const currentStage = session.currentHintStage ?? 0;

    if (stage !== currentStage + 1) {
      throw new Error("Must use hints in order");
    }
    if (tokensLeft <= 0) {
      throw new Error("No hint tokens remaining");
    }

    const players = session.currentChallenge?.validPlayers ?? [];
    const sport = session.sport;
    let hintText = "";

    if (sport === "football") {
      const meta = players.length > 0 ? footballMetadataMap[players[0]] : undefined;
      if (stage === 1) {
        hintText = meta
          ? `Nationality: ${meta.nationality} | Club: ${meta.club}`
          : `Football player — ${players.length} possible answers`;
      } else if (stage === 2) {
        hintText = meta
          ? `Position: ${meta.position} | Era: ${meta.era}`
          : `${players.length} players match these initials`;
      } else if (stage === 3) {
        const samplePlayer = players[Math.floor(Math.random() * players.length)];
        const firstName = samplePlayer?.split(" ")[0] ?? "Unknown";
        hintText = `First name: ${firstName}`;
      }
    } else if (sport === "basketball") {
      const meta = players.length > 0 ? nbaMetadataMap[players[0]] : undefined;
      if (stage === 1) {
        hintText = meta
          ? `Team: ${meta.team} | Nationality: ${meta.nationality}`
          : `NBA player — ${players.length} possible answers`;
      } else if (stage === 2) {
        hintText = meta
          ? `Position: ${meta.position}`
          : `${players.length} players match these initials`;
      } else if (stage === 3) {
        const samplePlayer = players[Math.floor(Math.random() * players.length)];
        const firstName = samplePlayer?.split(" ")[0] ?? "Unknown";
        hintText = `First name: ${firstName}`;
      }
    } else if (sport === "tennis") {
      const meta = players.length > 0 ? tennisMetadataMap[players[0]] : undefined;
      if (stage === 1) {
        hintText = meta
          ? `Nationality: ${meta.nationality}`
          : `Tennis player — ${players.length} possible answers`;
      } else if (stage === 2) {
        hintText = meta
          ? `Handedness: ${meta.handedness} | Highest Rank: #${meta.highestRank}`
          : `${players.length} players match these initials`;
      } else if (stage === 3) {
        const samplePlayer = players[Math.floor(Math.random() * players.length)];
        const firstName = samplePlayer?.split(" ")[0] ?? "Unknown";
        hintText = `First name: ${firstName}`;
      }
    } else {
      // Fallback for unknown sports
      if (stage === 3) {
        const samplePlayer = players[Math.floor(Math.random() * players.length)];
        const firstName = samplePlayer?.split(" ")[0] ?? "Unknown";
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
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) throw new Error("Invalid session");

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
    const session = await ctx.db.get(sessionId);
    if (!session || session.gameOver) {
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
