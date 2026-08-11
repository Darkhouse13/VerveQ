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
export const BEAT = 15; // 120 BPM house tempo, 15 frames per beat
export const RUNGS_N = 10;

// ---- the grid, and why there are now two of them ----
//
// BATCH 2 (2026-08-05) runs a CADENCE A/B. Batch 1 shipped four editions at a
// metronomic 7.00s/rung — pitch.quiz's measured cadence to the frame. The other
// winner in FACELESS_WINNER_SPEC, gugum, holds a 5.5s modal beat across ten
// questions and carries the cohort's BEST comment rate (0.00271/view). Both sit
// inside the measured 5.5–7.02s band, so the band itself does not tell us which
// end to live at. Batch 2 asks the band directly: two editions at each pace.
//
// This is a METRONOME format either way: unlike `semi-final`, where the timeline
// was built backwards from the narrator's measured delivery, here the GRID is
// authoritative and the VO is written to fit inside it. Spec #2 found the
// winners' cadence is machine-exact, and a cadence that drifts to suit a
// sentence is the thing being ruled out.
//
// WHAT THE FAST GRID GIVES UP, AND WHAT IT REFUSES TO. Going 210f -> 165f has
// to come out of somewhere. It comes out of the GUESS WINDOW, never out of the
// answer: ANSWER_AT moves up so the resolved answer still holds a full 60f/2.00s
// (spec #3: ~2s of answer), and the 3-2-1 tightens from one tick per 2 beats to
// one per beat. Less time to think, same time to read the answer — which is
// precisely what "the winners' pace" means, and keeps the answer VO slot at
// 2.00s in both arms so the answer takes are pace-independent.
export type Grid = {
  step: number; // frames per answered rung (rungs 1-9)
  last: number; // rung 10 in full — the unanswered beat is the payload
  cta: number; // the closing card
  clubIn: number; // first club lands here — something moves before 0.3s
  clubGap: number; // stagger between clubs
  thinkAt: number; // guess window opens
  tickAt: number[]; // the 3-2-1
  answerAt: number; // answer stamps (and, on rung 10, the demand replaces it)
};

// The shipped batch-1 cadence. pitch.quiz's 7.02s, quantised to 14 beats.
// Rung 10 runs 3.00s longer than an answered rung ON PURPOSE: its beat carries a
// spoken sentence ("not telling you — comments or nowhere") and holds the demand
// for 5.00s, where an answered rung only carries a name for 2.00s. Sized to the
// VO slot budgets in promo/ladderlong-vo.mjs; re-time one, re-check both.
export const GRID_7: Grid = {
  step: 210, // 7.00s (14 beats)
  last: 300, // 10.00s (20 beats) — WITHHELD_AT 150f + a 150f/5.00s hold
  cta: 90, // 3.00s (6 beats)
  clubIn: 8, // 0.27s
  clubGap: 10, // 7 clubs => last lands at 2.27s
  thinkAt: 70, // 2.33s
  tickAt: [75, 105, 135], // one per second (2.50 / 3.50 / 4.50s)
  answerAt: 150, // 5.00s, holds 2.00s
};

// gugum's pace. 165f = 5.50s = 11 beats, still on the 120 BPM grid.
export const GRID_5_5: Grid = {
  step: 165, // 5.50s (11 beats)
  last: 255, // 8.50s (17 beats) — WITHHELD_AT 105f + the same 150f/5.00s hold
  cta: 90, // 3.00s — pace-independent
  clubIn: 6, // 0.20s
  clubGap: 7, // 7 clubs => last lands at 1.60s
  thinkAt: 52, // 1.73s — opens the moment the last club has landed
  tickAt: [60, 75, 90], // one per BEAT (2.00 / 2.50 / 3.00s) — the countdown is
  //                       twice as urgent because the window is half as long
  answerAt: 105, // 3.50s, still holds a full 2.00s
};

// The follow-hook card is a BATCH property, not a cadence one — it is a surface
// batch 2 adds, like the score rail, and it is the same 2.00s at either pace
// because it is a card and not a rung. Keeping it off `Grid` is what lets batch 1
// and batch 2's control arm share GRID_7 while still running different lengths.
//
// Batch 1's total was 2280f = 76.00s and must STAY that, because those four are
// already posted — the sources have to keep reproducing what went out.
//   batch 1        : 9x210 + 300 +  0 + 90 = 2280f = 76.00s (152 beats)
//   batch 2 @7.00s : 9x210 + 300 + 60 + 90 = 2340f = 78.00s (156 beats)
//   batch 2 @5.50s : 9x165 + 255 + 60 + 90 = 1890f = 63.00s (126 beats)
// Both batch-2 lengths stay inside RESEARCH_DIGEST H3's 60-90s band, which is
// the point of testing cadence rather than length: the band is held constant.
export const FOLLOW_CARD = 60; // 2.00s (4 beats)
export const followFrames = (ed: Edition): number => (ed.batch === 2 ? FOLLOW_CARD : 0);
export const totalOf = (ed: Edition): number => ed.grid.step * 9 + ed.grid.last + followFrames(ed) + ed.grid.cta;
export const followAt = (ed: Edition): number => ed.grid.step * 9 + ed.grid.last;
export const ctaAt = (ed: Edition): number => followAt(ed) + followFrames(ed);

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
  // WHICH BATCH, and therefore WHICH FEATURE SET. `batch` and `grid` are
  // orthogonal on purpose: `grid` is the cadence under test, `batch` is the
  // surface. Batch 1 is frozen — no score rail, no follow card, the original
  // closing copy — so its four sources still render exactly what was posted on
  // 2026-08-01. Everything batch 2 adds is gated on this field, not bolted onto
  // the component for everyone.
  batch: 1 | 2;
  grid: Grid;
  // WHICH CAMPAIGN, if any — a THIRD orthogonal field, for the same reason the
  // first two are orthogonal to each other.
  //
  // Batch 2.5 (2026-08-05) is a CASTING variant: it reuses batch 2's surface set
  // EXACTLY — score rail, follow card, `?/9` ask — and changes one line of
  // closing copy plus the wordmark that line points at. Neither existing field
  // could carry that. Gating the swap on `batch` would have invented a batch 3
  // and dragged a whole surface set behind a copy change, which is the precise
  // thing that would contaminate the cadence A/B still running underneath.
  // Gating it on `grid` would have welded a campaign to a pace.
  //
  // So the campaign is its own axis and it gates exactly two things: the closing
  // VO key (`cta2` -> `cta3`) and the wordmark block on the CTA card. Nothing
  // else in the piece reads this field.
  campaign?: "weekend";
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
    batch: 1,
    grid: GRID_7,
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
    batch: 1,
    grid: GRID_7,
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
    batch: 1,
    grid: GRID_7,
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
    batch: 1,
    grid: GRID_7,
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
  // ---- BATCH 2 (2026-08-05) — the cadence A/B + the scoreboard surface ----
  // Pace is assigned ACROSS eras, not along them: each arm gets one legacy deck
  // and one modern deck, so "which pace" can't be read as "which casting".
  //   7.00s control : number-ones (legacy) + hard-way-up (modern)
  //   5.50s fast    : old-guard   (legacy) + grand-tour  (modern)
  {
    slug: "number-ones",
    title: "THE KEEPERS' UNION",
    batch: 2,
    grid: GRID_7,
    rungs: [
      { id: "cp-neuer", tier: "EASY", answer: "NEUER", clubs: ["Schalke 04","Bayern Munich"] },
      { id: "cp-casillas", tier: "EASY", answer: "CASILLAS", clubs: ["Real Madrid","Porto"] },
      { id: "cp-gianluigi-donnarumma", tier: "MEDIUM", answer: "DONNARUMMA", clubs: ["AC Milan","Paris Saint-Germain","Manchester City"] },
      { id: "cp-de-gea", tier: "MEDIUM", answer: "DE GEA", clubs: ["Atlético Madrid","Manchester United","Fiorentina"] },
      { id: "cp-lloris", tier: "MEDIUM", answer: "LLORIS", clubs: ["Nice","Lyon","Tottenham Hotspur","Los Angeles FC"] },
      { id: "cp-cech", tier: "HARD", answer: "ČECH", clubs: ["Chmel Blšany","Sparta Prague","Rennes","Chelsea","Arsenal"] },
      { id: "cp-van-der-sar", tier: "HARD", answer: "VAN DER SAR", clubs: ["Ajax","Juventus","Fulham","Manchester United","Noordwijk"] },
      { id: "cp-ederson", tier: "HARD", answer: "EDERSON", clubs: ["Ribeirão","Rio Ave","Benfica","Manchester City","Fenerbahçe"] },
      { id: "cp-fabien-barthez", tier: "IMPOSSIBLE", answer: "BARTHEZ", clubs: ["Toulouse","Marseille","Monaco","Manchester United","Marseille","Nantes"] },
      // WITHHELD
      { id: "cp-schmeichel", tier: "IMPOSSIBLE", answer: "SCHMEICHEL", clubs: ["Gladsaxe-Hero","Hvidovre","Brøndby","Manchester United","Sporting CP","Aston Villa","Manchester City"] },
    ],
  },
  {
    slug: "hard-way-up",
    title: "THE HARD WAY UP",
    batch: 2,
    grid: GRID_7,
    rungs: [
      { id: "cp-palmer", tier: "EASY", answer: "PALMER", clubs: ["Manchester City","Chelsea"] },
      { id: "cp-gakpo", tier: "EASY", answer: "GAKPO", clubs: ["PSV Eindhoven","Liverpool"] },
      { id: "cp-rafael-leao", tier: "MEDIUM", answer: "LEÃO", clubs: ["Sporting CP","Lille","AC Milan"] },
      { id: "cp-john-stones", tier: "MEDIUM", answer: "STONES", clubs: ["Barnsley","Everton","Manchester City"] },
      { id: "cp-harry-maguire", tier: "MEDIUM", answer: "MAGUIRE", clubs: ["Sheffield United","Hull City","Wigan Athletic","Leicester City","Manchester United"] },
      { id: "cp-riyad-mahrez", tier: "HARD", answer: "MAHREZ", clubs: ["Quimper","Le Havre","Leicester City","Manchester City","Al-Ahli"] },
      { id: "cp-osimhen", tier: "HARD", answer: "OSIMHEN", clubs: ["VfL Wolfsburg","Charleroi","Lille","Napoli","Galatasaray"] },
      { id: "cp-jorginho", tier: "HARD", answer: "JORGINHO", clubs: ["Hellas Verona","Sambonifacese","Napoli","Chelsea","Arsenal","Flamengo"] },
      { id: "cp-viktor-gyokeres", tier: "IMPOSSIBLE", answer: "GYÖKERES", clubs: ["Brommapojkarna","Brighton & Hove Albion","St. Pauli","Swansea City","Coventry City","Sporting CP","Arsenal"] },
      // WITHHELD
      { id: "cp-jamie-vardy", tier: "IMPOSSIBLE", answer: "VARDY", clubs: ["Stocksbridge Park Steels","FC Halifax Town","Fleetwood Town","Leicester City","Cremonese"] },
    ],
  },
  {
    slug: "old-guard",
    title: "THE OLD GUARD",
    batch: 2,
    grid: GRID_5_5,
    rungs: [
      { id: "cp-van-basten", tier: "EASY", answer: "VAN BASTEN", clubs: ["Ajax","AC Milan"] },
      { id: "cp-xavi", tier: "EASY", answer: "XAVI", clubs: ["Barcelona","Al-Sadd"] },
      { id: "cp-nesta", tier: "MEDIUM", answer: "NESTA", clubs: ["Lazio","AC Milan","Montreal Impact","Chennaiyin FC"] },
      { id: "cp-lilian-thuram", tier: "MEDIUM", answer: "THURAM", clubs: ["Monaco","Parma","Juventus","Barcelona"] },
      { id: "cp-emmanuel-petit", tier: "MEDIUM", answer: "PETIT", clubs: ["Monaco","Arsenal","Barcelona","Chelsea"] },
      { id: "cp-klose", tier: "HARD", answer: "KLOSE", clubs: ["Homburg","Kaiserslautern","Werder Bremen","Bayern Munich","Lazio"] },
      { id: "cp-gennaro-gattuso", tier: "HARD", answer: "GATTUSO", clubs: ["Perugia","Rangers","Salernitana","AC Milan","Sion"] },
      { id: "cp-marcel-desailly", tier: "HARD", answer: "DESAILLY", clubs: ["Nantes","Marseille","AC Milan","Chelsea","Al-Gharafa","Qatar SC"] },
      { id: "cp-baggio", tier: "IMPOSSIBLE", answer: "BAGGIO", clubs: ["Vicenza","Fiorentina","Juventus","AC Milan","Bologna","Inter Milan","Brescia"] },
      // WITHHELD
      { id: "cp-gianfranco-zola", tier: "IMPOSSIBLE", answer: "ZOLA", clubs: ["Nuorese","Torres","Napoli","Parma","Chelsea","Cagliari"] },
    ],
  },
  {
    slug: "grand-tour",
    title: "THE GRAND TOUR",
    batch: 2,
    grid: GRID_5_5,
    rungs: [
      { id: "cp-vinicius", tier: "EASY", answer: "VINÍCIUS", clubs: ["Flamengo","Real Madrid"] },
      { id: "cp-ruben-dias", tier: "EASY", answer: "RÚBEN DIAS", clubs: ["Benfica","Manchester City"] },
      { id: "cp-tchouameni", tier: "MEDIUM", answer: "TCHOUAMÉNI", clubs: ["Bordeaux","Monaco","Real Madrid"] },
      { id: "cp-de-ligt", tier: "MEDIUM", answer: "DE LIGT", clubs: ["Ajax","Juventus","Bayern Munich","Manchester United"] },
      { id: "cp-david-alaba", tier: "MEDIUM", answer: "ALABA", clubs: ["Bayern Munich","Hoffenheim","Bayern Munich","Real Madrid"] },
      { id: "cp-mateo-kovacic", tier: "HARD", answer: "KOVAČIĆ", clubs: ["Dinamo Zagreb","Inter Milan","Real Madrid","Chelsea","Manchester City"] },
      { id: "cp-hakan-calhanoglu", tier: "HARD", answer: "ÇALHANOĞLU", clubs: ["Karlsruher SC","Hamburger SV","Bayer Leverkusen","AC Milan","Inter Milan"] },
      { id: "cp-xabi-alonso", tier: "HARD", answer: "XABI ALONSO", clubs: ["Real Sociedad","Eibar","Real Sociedad","Liverpool","Real Madrid","Bayern Munich"] },
      { id: "cp-pires", tier: "IMPOSSIBLE", answer: "PIRÈS", clubs: ["Reims","Metz","Marseille","Arsenal","Villarreal","Aston Villa","FC Goa"] },
      // WITHHELD
      { id: "cp-robben", tier: "IMPOSSIBLE", answer: "ROBBEN", clubs: ["Groningen","PSV Eindhoven","Chelsea","Real Madrid","Bayern Munich","Groningen"] },
    ],
  },
  // ---- BATCH 2.5 (2026-08-05) — the two WEEKEND-cast editions ----
  //
  // Batch 2's spec is FROZEN here, deliberately and completely: same surfaces
  // (score rail, follow card, `?/9`), same carrier, same 7.00s control grid, no
  // trending sound. The cadence A/B is still being read off batch 2's four
  // editions, and a campaign edition that also moved a format variable would
  // add a confound to a live experiment for no gain.
  //
  // BOTH RUN 7.00s CONTROL. The 5.50s arm is still unproven — that is the entire
  // point of the batch-2 A/B, which has not reported yet — and campaign assets
  // are the last place to spend an untested variable. If the fast arm wins, the
  // next campaign cut can take it with evidence.
  //
  // What DOES vary is casting intent and one line of closing copy. Both decks
  // are CURRENT players only, because both are arguing for a mode you draft with
  // this weekend's actual teams: a retired name is a fine quiz answer and a
  // terrible advert for a live draft.
  {
    slug: "five-leagues",
    title: "FIVE LEAGUES, ONE SQUAD",
    batch: 2,
    grid: GRID_7,
    campaign: "weekend",
    rungs: [
      // THE PREMISE IS THE STRUCTURE. THE WEEKEND's pitch is "five leagues, one
      // squad", so the deck is TWO FULL PASSES THROUGH THE FIVE LEAGUES, in the
      // same order both times — rungs 1-5 are one player currently in each of
      // La Liga / Bundesliga / Serie A / Premier League / Ligue 1, and rungs
      // 6-10 are a second one each. Nothing on screen announces that (the card
      // shows clubs, not competitions), but it is why the deck can carry the
      // claim, and it means the withheld rung cannot be the only thing holding a
      // league up: every league is represented in the ANSWERED nine as well.
      { id: "cp-dani-carvajal", tier: "EASY", answer: "CARVAJAL", clubs: ["Bayer Leverkusen","Real Madrid"] },
      { id: "cp-kimmich", tier: "EASY", answer: "KIMMICH", clubs: ["RB Leipzig","Bayern Munich"] },
      { id: "cp-pulisic", tier: "MEDIUM", answer: "PULISIC", clubs: ["Borussia Dortmund","Chelsea","AC Milan"] },
      { id: "cp-alisson", tier: "MEDIUM", answer: "ALISSON", clubs: ["Internacional","Roma","Liverpool"] },
      { id: "cp-vitinha", tier: "MEDIUM", answer: "VITINHA", clubs: ["Porto","Wolverhampton Wanderers","Porto","Paris Saint-Germain"] },
      { id: "cp-vlahovic", tier: "HARD", answer: "VLAHOVIĆ", clubs: ["Partizan Belgrade","Fiorentina","Juventus"] },
      { id: "cp-michael-olise", tier: "HARD", answer: "OLISE", clubs: ["Reading","Crystal Palace","Bayern Munich"] },
      { id: "cp-raphinha", tier: "HARD", answer: "RAPHINHA", clubs: ["Vitória de Guimarães","Sporting CP","Rennes","Leeds United","Barcelona"] },
      { id: "cp-andrew-robertson", tier: "IMPOSSIBLE", answer: "ROBERTSON", clubs: ["Queen's Park","Dundee United","Hull City","Liverpool"] },
      // WITHHELD — obscure head (four clubs nobody outside Georgia and Russia
      // can place), famous tail (Napoli -> PSG), and still the Ligue 1 slot.
      { id: "cp-kvaratskhelia", tier: "IMPOSSIBLE", answer: "KVARATSKHELIA", clubs: ["Dinamo Tbilisi","Rustavi","Lokomotiv Moscow","Rubin Kazan","Dinamo Batumi","Napoli","Paris Saint-Germain"] },
    ],
  },
  {
    slug: "one-squad",
    title: "THE DRAFT BOARD",
    batch: 2,
    grid: GRID_7,
    campaign: "weekend",
    rungs: [
      // TEN PLAYERS A DRAFTER COULD ACTUALLY PICK THIS MONTH, cast in the shape
      // of a squad rather than a highlight reel: one keeper, three defenders,
      // three midfielders, three forwards. `number-ones` proved a positional
      // deck reads as a different puzzle even though the card never states a
      // position — the shape is felt, not announced.
      { id: "cp-rodrygo", tier: "EASY", answer: "RODRYGO", clubs: ["Santos","Real Madrid"] },
      { id: "cp-davies", tier: "EASY", answer: "DAVIES", clubs: ["Vancouver Whitecaps","Bayern Munich"] },
      { id: "cp-mike-maignan", tier: "MEDIUM", answer: "MAIGNAN", clubs: ["Lille","AC Milan"] },
      { id: "cp-valverde", tier: "MEDIUM", answer: "VALVERDE", clubs: ["Peñarol","Deportivo La Coruña","Real Madrid"] },
      { id: "cp-alessandro-bastoni", tier: "MEDIUM", answer: "BASTONI", clubs: ["Atalanta","Parma","Inter Milan"] },
      { id: "cp-frenkie-de-jong", tier: "HARD", answer: "DE JONG", clubs: ["Willem II","Ajax","Barcelona"] },
      { id: "cp-bruno-guimaraes", tier: "HARD", answer: "BRUNO GUIMARÃES", clubs: ["Audax","Athletico Paranaense","Lyon","Newcastle United"] },
      { id: "cp-rasmus-hojlund", tier: "HARD", answer: "HØJLUND", clubs: ["Copenhagen","Sturm Graz","Atalanta","Manchester United","Napoli"] },
      { id: "cp-gnabry", tier: "IMPOSSIBLE", answer: "GNABRY", clubs: ["Arsenal","West Bromwich Albion","Werder Bremen","Hoffenheim","Bayern Munich"] },
      // WITHHELD — a Korean power-company side and a Chinese one into Napoli and
      // Bayern. Same law as every rung 10: unguessable head, reachable tail.
      { id: "cp-kim-min-jae", tier: "IMPOSSIBLE", answer: "KIM MIN-JAE", clubs: ["Gyeongju KHNP","Jeonbuk Hyundai Motors","Beijing Guoan","Fenerbahçe","Napoli","Bayern Munich"] },
    ],
  },
  // ---- THE DUGOUT (2026-08-11) — first deck cut after the A/B reported ----
  //
  // GRID_7 here is the STANDING PACE, not the control arm. The batch-2 cadence
  // A/B reported and the 5.50s arm is retired (docs/DECISIONS.md, 2026-08-10),
  // so 7.00s is now what a deck takes because it WON, not because it is the
  // default. `batch: 2` is unchanged and means the surface set — score rail,
  // follow card, `?/9` — which this deck inherits whole. No campaign.
  //
  // THE THEME IS A REVEAL, NOT A CATEGORY. `number-ones` established that a
  // positional deck reads as a different puzzle even though the card never
  // states a position. This one leans on that twice over: the card shows only
  // clubs the man PLAYED for, so "he was a defender" is what you solve and "he
  // became a manager" is what you're left holding. Nothing on screen says
  // either. The rail is still just clubs and a name.
  //
  // THE BAR, and it is the casting constraint that actually bound this deck:
  //   • primary position defender (CB/FB/WB) for the MAJORITY of the senior
  //     playing career, and
  //   • PERMANENT first-team manager of a top-5-league club or a senior
  //     national team — no caretakers, no interims, no youth or B-team, no
  //     assistant spells.
  // Ambiguity on either clause excludes, and that cost the two biggest names
  // available. Koeman and Southgate are both classified "defender AND
  // midfielder" at source; a deck whose entire premise is "every one of these
  // was a defender" cannot carry a rung that needs an argument to stand up.
  // Where a man has both a caretaker and a permanent spell, it is the permanent
  // one that qualified him — Sagnol on Bordeaux and not his 2017 Bayern week,
  // Pearce on Manchester City and not Forest.
  //
  // PATHS: six are copied whole from football_career_paths.json; four (Coleman,
  // Bilić, Sylvinho, Tuchel) are not in that dataset and are cast here directly,
  // which the rung type already allows since ladder-long resolves clubs off the
  // Edition and never off the dataset. Two clubs are deliberately ABSENT because
  // they carry no senior appearances — Coleman's Manchester City (YTS trainee,
  // 0 apps) and Tuchel's Augsburg (released at 19, never a first-team player).
  // Putting either on a card would make the puzzle unsolvable AND untrue.
  {
    slug: "dugout",
    title: "THE DUGOUT",
    batch: 2,
    grid: GRID_7,
    rungs: [
      { id: "cp-vincent-kompany", tier: "EASY", answer: "KOMPANY", clubs: ["Anderlecht","Hamburger SV","Manchester City","Anderlecht"] },
      { id: "cp-willy-sagnol", tier: "EASY", answer: "SAGNOL", clubs: ["Saint-Étienne","Monaco","Bayern Munich"] },
      { id: "cp-chris-coleman", tier: "MEDIUM", answer: "COLEMAN", clubs: ["Swansea City","Crystal Palace","Blackburn Rovers","Fulham"] },
      { id: "cp-slaven-bilic", tier: "MEDIUM", answer: "BILIĆ", clubs: ["Hajduk Split","Karlsruher SC","West Ham United","Everton","Hajduk Split"] },
      { id: "cp-sylvinho", tier: "MEDIUM", answer: "SYLVINHO", clubs: ["Corinthians","Arsenal","Celta Vigo","Barcelona","Manchester City"] },
      { id: "cp-steve-bruce", tier: "HARD", answer: "BRUCE", clubs: ["Gillingham","Norwich City","Manchester United","Birmingham City","Sheffield United"] },
      { id: "cp-frank-de-boer", tier: "HARD", answer: "DE BOER", clubs: ["Ajax","Barcelona","Galatasaray","Rangers","Al-Rayyan","Al-Shamal"] },
      { id: "cp-stuart-pearce", tier: "HARD", answer: "PEARCE", clubs: ["Wealdstone","Coventry City","Nottingham Forest","Newcastle United","West Ham United","Manchester City"] },
      // Two clubs, both unplaceable, and the shortest path in the deck — the
      // card gives you almost nothing, which is the point: the name is enormous
      // and the career it came out of is not. Answered on screen, per the law:
      // TUCHEL is a name a casual fan knows on sight even if the clubs aren't.
      { id: "cp-thomas-tuchel", tier: "IMPOSSIBLE", answer: "TUCHEL", clubs: ["Stuttgarter Kickers","SSV Ulm"] },
      // WITHHELD — an Abruzzo village side and a Serie C club into Inter, Lyon
      // and Juventus. Textbook rung 10: the head is unguessable, the tail is
      // famous enough that the answer is reachable, and the name is one a
      // casual fan can actually supply (the 2006 final penalty).
      { id: "cp-fabio-grosso", tier: "IMPOSSIBLE", answer: "GROSSO", clubs: ["Renato Curi Angolana","Chieti","Perugia","Palermo","Inter Milan","Lyon","Juventus"] },
    ],
  },
];

export const editionBySlug = (slug: string): Edition => {
  const e = EDITIONS.find((x) => x.slug === slug);
  if (!e) throw new Error(`unknown ladder-long edition "${slug}"`);
  return e;
};

// Which rung is on the card, how far into it we are, and which of the two
// terminal cards (if either) is up. `follow` is batch 2's follow-hook beat and
// is never entered by a batch-1 edition, whose grid has follow: 0.
export const locate = (
  frame: number,
  ed: Edition,
): { i: number; phase: number; dur: number; follow: boolean; cta: boolean } => {
  const g = ed.grid;
  const fAt = followAt(ed);
  const cAt = ctaAt(ed);
  if (frame >= cAt) return { i: 9, phase: g.last, dur: g.last, follow: false, cta: true };
  if (frame >= fAt) return { i: 9, phase: g.last, dur: g.last, follow: true, cta: false };
  const i = Math.min(9, Math.floor(frame / g.step));
  return { i, phase: frame - i * g.step, dur: i === 9 ? g.last : g.step, follow: false, cta: false };
};

// Every rung boundary and every VO-bearing frame for an edition, as plain
// numbers. `promo/ladderlong-vo.mjs` re-derives the same layout from the parsed
// grid, so if these two ever disagree the render's 21/23-cue verification fails
// loudly rather than drifting a line half a beat off its rung.
export const cueFrames = (ed: Edition): { counts: number[]; answers: number[]; withhold: number; follow: number; cta: number } => ({
  counts: Array.from({ length: 9 }, (_, k) => (k + 1) * ed.grid.step), // n2…n10
  answers: Array.from({ length: 9 }, (_, k) => k * ed.grid.step + ed.grid.answerAt), // a1…a9
  withhold: 9 * ed.grid.step + ed.grid.answerAt,
  follow: followAt(ed),
  cta: ctaAt(ed),
});
