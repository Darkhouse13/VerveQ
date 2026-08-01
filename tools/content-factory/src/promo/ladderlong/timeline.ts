// "LADDER-LONG" — the retention lane's gauntlet, retooled to the length and
// cadence the faceless winners actually run.
//
// WHY THIS EXISTS, AND WHY IT IS TEN RUNGS AND NOT FIVE
//
// `ladder` (16.0s, five rungs at 3.2s each) was built before we had measured
// anything. Two studies since, and they point at different axes:
//
//   • RESEARCH_DIGEST §3/H3 (n=112 reels >=5k views) — comment rate climbs with
//     LENGTH and peaks at 90-120s. Our whole library sat in the 0.07-0.26/1k
//     bands. That produced `long-chain` (100.0s) as a pure length test.
//   • FACELESS_WINNER_SPEC (n=4 faceless winners, 2026-08-01) — measured the
//     CADENCE inside the winners: 5.5-7.02s per question, 6-10 questions,
//     42-73s total. pitch.quiz holds 7.02s across six questions with <=8ms of
//     drift; gugum holds a 5.5s modal beat across ten.
//
// Those are not in conflict — they measure different things. Ticket 2's brief
// (five questions across 60-90s) sat between them and satisfied neither: it
// forces 12-18s per rung, 1.7-2.6x the slowest winner. Owner ruled 10 rungs at
// ~7s, which obeys the measured cadence AND lands in H3's 60-90s band.
//
// The tenth slot is the point. FACELESS_WINNER_SPEC #26: a persistent running
// scoreboard was the strongest single differentiator inside that cohort — the
// three reels carrying a filling 10-slot answer sheet averaged 0.0020 comment
// rate against pitch.quiz's 0.00088, and gugum's 10-slot reel hit 0.00271 at
// 70s. Ten rungs is not "five, but more"; ten rungs is what makes the rail a
// scoreboard the viewer can count themselves against.
//
// WHAT THE SPEC CONFIRMED, so don't "fix" these:
//   • rungs 1-9 resolve on screen, rung 10 never does. 35 of 36 questions
//     across the four winners resolve — faceless winners are NOT withholding
//     formats. The single terminal withhold is pitch.quiz's exact shape, and it
//     is the biggest number in the cohort (232,932).
//   • motion is underway at frame 0 in 4/4 winners, and frame 0 states the size
//     of the game. Rung 1 is pre-placed and the drain bar is already moving.
//   • no intro card, no title beat, no build-in. Ever.
//   • the video does not loop. None of the four did; all end on a terminal
//     state. Ending on the CTA card is correct.
export const FPS = 30;

// ---- the grid: 120 BPM house tempo, 15 frames per beat ----
// STEP is 14 beats = 7.00s, which is pitch.quiz's measured cadence to the
// frame. This is a METRONOME format: unlike `semi-final`, where the timeline
// was built backwards from the narrator's measured delivery, here the GRID is
// authoritative and the VO is written to fit inside it. That inversion is
// deliberate — spec #2 found the winners' cadence is machine-exact, and a
// cadence that drifts to suit a sentence is the thing being ruled out.
export const BEAT = 15;
export const STEP = 210; // 7.00s per answered rung  (14 beats)
export const LAST = 300; // 10.00s for rung 10 — the unanswered beat is the payload (20 beats)
export const CTA = 90; //   3.00s closing card (6 beats)
export const RUNGS_N = 10;
export const TOTAL = STEP * 9 + LAST + CTA; // 2280 = 76.00s = 152 beats

export const startOf = (i: number): number => i * STEP;
export const CTA_AT = STEP * 9 + LAST; // 2190

// ---- within-rung beats (relative to the rung's start) ----
export const CLUB_IN = 8; // first club lands at 0.27s — something moves before 0.3s
export const CLUB_GAP = 10; // 7 clubs => last lands at 2.27s
export const THINK_AT = 70; // 2.33s — guess window opens
export const TICK_AT = [75, 105, 135]; // 3-2-1, one per second (2.5 / 3.5 / 4.5s)
export const ANSWER_AT = 150; // 5.00s — answer stamps, holds 2.0s (spec #3: ~2s of answer)
export const WITHHELD_AT = 150; // rung 10: the demand replaces the answer, holds 5.0s
// Rung 10 runs 1.0s longer than an answered rung ON PURPOSE: the withheld beat
// has to carry a spoken sentence ("not telling you — comments or nowhere"),
// where an answered rung only carries a name. Sized to the VO slot budget in
// promo/ladderlong-vo.mjs; if that line changes, re-check both.

export type Tier = "EASY" | "MEDIUM" | "HARD" | "IMPOSSIBLE";

export type Rung = {
  id: string; // football_career_paths.json id — goes to ledger.json after render
  clubs: string[];
  answer: string; // rail + card stamp. Rung 10's is deliberately never drawn.
  tier: Tier;
};

export type Edition = {
  slug: string;
  title: string; // the deck the batch is cut from — never on screen, it's bookkeeping
  rungs: Rung[]; // exactly 10; index 9 is withheld
};

// CASTING LAW (ladder/timeline.ts, wall/timeline.ts — extended here to ten
// slots). Every rung that gets ANSWERED on screen is a name a casual fan knows
// on sight: format is the multiplier, the name is the base, and a mid-tier base
// multiplies to nothing. The first `ladder` cut answered Koundé and Netzer and
// went nowhere.
//
// The WITHHELD rung (10) obeys the stricter half of the law: it must be a name
// people RECOGNISE the moment someone types it. An unguessable answer is a dead
// end, not a hook — that was the flaw in the Sušić cut, where nobody could
// supply the payoff so nobody typed anything. Every rung-10 pick below has a
// famous tail (Modrić's Spurs->Real, Mascherano's West Ham->Liverpool->Barça,
// Rakitić's Sevilla->Barça, Riquelme's Boca->Barça) so the answer is reachable,
// and an obscure HEAD so it isn't free.
//
// TIER = difficulty of the PATH, not obscurity of the NAME. All forty names are
// S-tier; what escalates is how hard the route is to read. Ladder shape is
// 2 EASY / 3 MEDIUM / 3 HARD / 2 IMPOSSIBLE.
//
// Paths are copied WHOLE from the dataset — never truncated, because a
// shortened path is a different puzzle and often an ambiguous one. Casting was
// capped at 7 clubs so a whole path always fits the card at a readable size;
// that is a selection constraint, NOT a licence to trim a longer one.
// No crests (trademarked) and no player likenesses — club names in brand type,
// answer names in brand type. Standing rule, all lanes.

export const EDITIONS: Edition[] = [
  {
    slug: "all-timers",
    title: "THE ALL-TIMERS",
    rungs: [
      { id: "cp-pele", tier: "EASY", answer: "PELÉ", clubs: ["Santos", "New York Cosmos"] },
      { id: "cp-gerrard", tier: "EASY", answer: "GERRARD", clubs: ["Liverpool", "LA Galaxy"] },
      { id: "cp-pique", tier: "MEDIUM", answer: "PIQUÉ", clubs: ["Manchester United", "Real Zaragoza", "Barcelona"] },
      { id: "cp-kroos", tier: "MEDIUM", answer: "KROOS", clubs: ["Bayern Munich", "Bayer Leverkusen", "Bayern Munich", "Real Madrid"] },
      { id: "cp-marcelo", tier: "MEDIUM", answer: "MARCELO", clubs: ["Fluminense", "Real Madrid", "Olympiacos", "Fluminense"] },
      { id: "cp-shevchenko", tier: "HARD", answer: "SHEVCHENKO", clubs: ["Dynamo Kyiv", "AC Milan", "Chelsea", "AC Milan", "Dynamo Kyiv"] },
      { id: "cp-salah", tier: "HARD", answer: "SALAH", clubs: ["Al Mokawloon", "Basel", "Chelsea", "Fiorentina", "Roma", "Liverpool"] },
      { id: "cp-pirlo", tier: "HARD", answer: "PIRLO", clubs: ["Brescia", "Inter Milan", "Reggina", "Brescia", "AC Milan", "Juventus", "New York City FC"] },
      { id: "cp-nedved", tier: "IMPOSSIBLE", answer: "NEDVĚD", clubs: ["Škoda Plzeň", "Dukla Prague", "Sparta Prague", "Lazio", "Juventus"] },
      // WITHHELD — never drawn, never spoken.
      { id: "cp-modric", tier: "IMPOSSIBLE", answer: "MODRIĆ", clubs: ["Dinamo Zagreb", "Zrinjski Mostar", "Inter Zaprešić", "Dinamo Zagreb", "Tottenham Hotspur", "Real Madrid", "AC Milan"] },
    ],
  },
  {
    slug: "premier-league",
    title: "THE PREMIER LEAGUE",
    rungs: [
      { id: "cp-rice", tier: "EASY", answer: "RICE", clubs: ["West Ham United", "Arsenal"] },
      { id: "cp-alexander-arnold", tier: "EASY", answer: "ALEXANDER-ARNOLD", clubs: ["Liverpool", "Real Madrid"] },
      { id: "cp-courtois", tier: "MEDIUM", answer: "COURTOIS", clubs: ["Genk", "Atlético Madrid", "Chelsea", "Real Madrid"] },
      { id: "cp-son", tier: "MEDIUM", answer: "SON", clubs: ["Hamburger SV", "Bayer Leverkusen", "Tottenham Hotspur", "Los Angeles FC"] },
      { id: "cp-lampard", tier: "MEDIUM", answer: "LAMPARD", clubs: ["West Ham United", "Swansea City", "Chelsea", "Manchester City", "New York City FC"] },
      { id: "cp-kante", tier: "HARD", answer: "KANTÉ", clubs: ["Boulogne", "Caen", "Leicester City", "Chelsea", "Al-Ittihad", "Fenerbahçe"] },
      { id: "cp-de-bruyne", tier: "HARD", answer: "DE BRUYNE", clubs: ["Genk", "Chelsea", "Werder Bremen", "Chelsea", "Wolfsburg", "Manchester City", "Napoli"] },
      { id: "cp-vidic", tier: "HARD", answer: "VIDIĆ", clubs: ["Red Star Belgrade", "Spartak Subotica", "Spartak Moscow", "Manchester United", "Inter Milan"] },
      { id: "cp-heskey", tier: "IMPOSSIBLE", answer: "HESKEY", clubs: ["Leicester City", "Liverpool", "Birmingham City", "Wigan Athletic", "Aston Villa", "Newcastle Jets", "Bolton Wanderers"] },
      // WITHHELD
      { id: "cp-mascherano", tier: "IMPOSSIBLE", answer: "MASCHERANO", clubs: ["River Plate", "Corinthians", "West Ham United", "Liverpool", "Barcelona", "Hebei China Fortune", "Estudiantes"] },
    ],
  },
  {
    slug: "modern",
    title: "THE MODERN GAME",
    rungs: [
      { id: "cp-wirtz", tier: "EASY", answer: "WIRTZ", clubs: ["Bayer Leverkusen", "Liverpool"] },
      { id: "cp-lautaro", tier: "EASY", answer: "LAUTARO", clubs: ["Racing Club", "Inter Milan"] },
      { id: "cp-julian-alvarez", tier: "MEDIUM", answer: "ÁLVAREZ", clubs: ["River Plate", "Manchester City", "Atlético Madrid"] },
      { id: "cp-hakimi", tier: "MEDIUM", answer: "HAKIMI", clubs: ["Real Madrid", "Borussia Dortmund", "Inter Milan", "Paris Saint-Germain"] },
      { id: "cp-dembele", tier: "MEDIUM", answer: "DEMBÉLÉ", clubs: ["Rennes", "Borussia Dortmund", "Barcelona", "Paris Saint-Germain"] },
      { id: "cp-luis-diaz", tier: "HARD", answer: "LUIS DÍAZ", clubs: ["Barranquilla", "Atlético Junior", "Porto", "Liverpool", "Bayern Munich"] },
      { id: "cp-bruno-fernandes", tier: "HARD", answer: "BRUNO FERNANDES", clubs: ["Novara", "Udinese", "Sampdoria", "Sporting CP", "Manchester United"] },
      { id: "cp-isak", tier: "HARD", answer: "ISAK", clubs: ["AIK", "Borussia Dortmund", "Willem II", "Real Sociedad", "Newcastle United", "Liverpool"] },
      { id: "cp-mane", tier: "IMPOSSIBLE", answer: "MANÉ", clubs: ["Metz", "Red Bull Salzburg", "Southampton", "Liverpool", "Bayern Munich", "Al-Nassr"] },
      // WITHHELD
      { id: "cp-rakitic", tier: "IMPOSSIBLE", answer: "RAKITIĆ", clubs: ["Basel", "Schalke 04", "Sevilla", "Barcelona", "Sevilla", "Al-Shabab", "Hajduk Split"] },
    ],
  },
  {
    slug: "journeymen",
    title: "THE LONG WAY ROUND",
    rungs: [
      { id: "cp-busquets", tier: "EASY", answer: "BUSQUETS", clubs: ["Barcelona", "Inter Miami"] },
      { id: "cp-muller", tier: "EASY", answer: "MÜLLER", clubs: ["Bayern Munich", "Vancouver Whitecaps"] },
      { id: "cp-schweinsteiger", tier: "MEDIUM", answer: "SCHWEINSTEIGER", clubs: ["Bayern Munich", "Manchester United", "Chicago Fire"] },
      { id: "cp-varane", tier: "MEDIUM", answer: "VARANE", clubs: ["Lens", "Real Madrid", "Manchester United", "Como"] },
      { id: "cp-dybala", tier: "MEDIUM", answer: "DYBALA", clubs: ["Instituto", "Palermo", "Juventus", "Roma"] },
      { id: "cp-griezmann", tier: "HARD", answer: "GRIEZMANN", clubs: ["Real Sociedad", "Atlético Madrid", "Barcelona", "Atlético Madrid", "Orlando City"] },
      { id: "cp-david-silva", tier: "HARD", answer: "DAVID SILVA", clubs: ["Eibar", "Celta Vigo", "Valencia", "Manchester City", "Real Sociedad"] },
      { id: "cp-kane", tier: "HARD", answer: "KANE", clubs: ["Tottenham Hotspur", "Leyton Orient", "Millwall", "Norwich City", "Leicester City", "Tottenham Hotspur", "Bayern Munich"] },
      { id: "cp-vertonghen", tier: "IMPOSSIBLE", answer: "VERTONGHEN", clubs: ["Ajax", "RKC Waalwijk", "Tottenham Hotspur", "Benfica", "Anderlecht"] },
      // WITHHELD
      { id: "cp-riquelme", tier: "IMPOSSIBLE", answer: "RIQUELME", clubs: ["Boca Juniors", "Barcelona", "Villarreal", "Boca Juniors", "Argentinos Juniors"] },
    ],
  },
];

export const editionBySlug = (slug: string): Edition => {
  const e = EDITIONS.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown ladder-long edition "${slug}"`);
  return e;
};

// Which rung is on the card, and how far into it we are.
export const locate = (frame: number): { i: number; phase: number; dur: number; cta: boolean } => {
  if (frame >= CTA_AT) return { i: 9, phase: LAST, dur: LAST, cta: true };
  const i = Math.min(9, Math.floor(frame / STEP));
  return { i, phase: frame - i * STEP, dur: i === 9 ? LAST : STEP, cta: false };
};
