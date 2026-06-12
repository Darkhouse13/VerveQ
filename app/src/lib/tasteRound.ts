/**
 * Taste round — the instant, account-free sample game on the cold-entry
 * landing (`/` for signed-out visitors with no deep-link context).
 *
 * This is a MARKETING TASTE, not a competitive mode: questions ship in the
 * bundle, scoring is client-side, and nothing is persisted server-side. That
 * is deliberate — the cold visitor must be able to play within one tap, with
 * no signup wall, no Convex session, and no backend surface added. Real,
 * server-authoritative play starts after they claim a username (the existing
 * `/v2/welcome` flow). Keep ranked/ELO logic far away from this file.
 */

export type TasteQuestion = {
  id: string;
  question: string;
  options: string[];
  /** Index into `options` AFTER any sampling shuffle. */
  correctIndex: number;
  explanation: string;
};

export const TASTE_ROUND_SIZE = 5;

/** Correct answer: flat 100, plus up to 50 for speed (full under 2.5s, gone by 10s). */
export function scoreTasteAnswer(correct: boolean, elapsedMs: number): number {
  if (!correct) return 0;
  const clamped = Math.min(Math.max(elapsedMs, 0), 10_000);
  const bonus = Math.round(50 * Math.min(1, Math.max(0, (10_000 - clamped) / 7_500)));
  return 100 + bonus;
}

/** Max points a perfect, instant round can reach — used for result framing. */
export const TASTE_ROUND_MAX_SCORE = TASTE_ROUND_SIZE * scoreTasteAnswer(true, 0);

// Evergreen, uncontroversial football facts only — this pool is shown to
// first-touch visitors with zero context, so every question must be winnable
// by a casual fan and verifiable at a glance.
export const TASTE_QUESTION_POOL: readonly TasteQuestion[] = [
  {
    id: "wc-most-titles",
    question: "Which country has won the most FIFA World Cups?",
    options: ["Brazil", "Germany", "Italy", "Argentina"],
    correctIndex: 0,
    explanation: "Brazil have five titles — 1958, 1962, 1970, 1994 and 2002.",
  },
  {
    id: "messi-club",
    question: "Lionel Messi spent most of his career at which club?",
    options: ["Barcelona", "Real Madrid", "PSG", "Inter Miami"],
    correctIndex: 0,
    explanation: "Messi came through La Masia and played 17 seasons for Barça.",
  },
  {
    id: "wc-2022-winner",
    question: "Who won the 2022 World Cup in Qatar?",
    options: ["Argentina", "France", "Brazil", "Croatia"],
    correctIndex: 0,
    explanation: "Argentina beat France on penalties after a 3–3 final.",
  },
  {
    id: "red-devils",
    question: "Which English club is nicknamed 'The Red Devils'?",
    options: ["Manchester United", "Liverpool", "Arsenal", "Manchester City"],
    correctIndex: 0,
    explanation: "Old Trafford's Manchester United carry the Red Devils name.",
  },
  {
    id: "ucl-most-titles",
    question: "Which club has won the most European Cup / Champions League titles?",
    options: ["Real Madrid", "AC Milan", "Bayern Munich", "Liverpool"],
    correctIndex: 0,
    explanation: "Real Madrid lead Europe by a distance — AC Milan are next.",
  },
  {
    id: "el-clasico",
    question: "'El Clásico' is Real Madrid against which club?",
    options: ["Barcelona", "Atlético Madrid", "Sevilla", "Valencia"],
    correctIndex: 0,
    explanation: "Real Madrid vs Barcelona — Spain's defining rivalry.",
  },
  {
    id: "hand-of-god",
    question: "Maradona's 'Hand of God' goal came at which World Cup?",
    options: ["1986", "1982", "1990", "1994"],
    correctIndex: 0,
    explanation: "Mexico 1986, against England — minutes before his solo masterpiece.",
  },
  {
    id: "wc-1966",
    question: "Which country hosted AND won the 1966 World Cup?",
    options: ["England", "West Germany", "Brazil", "Italy"],
    correctIndex: 0,
    explanation: "England's only World Cup — 4–2 over West Germany at Wembley.",
  },
  {
    id: "ronaldo-sporting",
    question: "Cristiano Ronaldo left which Portuguese club for Manchester United?",
    options: ["Sporting CP", "Benfica", "Porto", "Braga"],
    correctIndex: 0,
    explanation: "United signed the 18-year-old from Sporting CP in 2003.",
  },
  {
    id: "henry-arsenal",
    question: "Thierry Henry is the all-time top scorer of which club?",
    options: ["Arsenal", "Monaco", "Barcelona", "Juventus"],
    correctIndex: 0,
    explanation: "228 goals for Arsenal — no one has scored more for the club.",
  },
  {
    id: "pele-santos",
    question: "Pelé played most of his career for which Brazilian club?",
    options: ["Santos", "Flamengo", "Corinthians", "São Paulo"],
    correctIndex: 0,
    explanation: "Pelé spent nearly two decades at Santos before New York Cosmos.",
  },
  {
    id: "old-lady",
    question: "Which Italian club in black and white stripes is 'The Old Lady'?",
    options: ["Juventus", "Inter Milan", "AC Milan", "Napoli"],
    correctIndex: 0,
    explanation: "Juventus — 'La Vecchia Signora' of Turin.",
  },
  {
    id: "players-per-side",
    question: "How many players does each team field at kick-off?",
    options: ["11", "10", "12", "9"],
    correctIndex: 0,
    explanation: "Eleven a side — ten outfielders and a goalkeeper.",
  },
  {
    id: "ballon-dor",
    question: "The Ballon d'Or is awarded to…",
    options: [
      "The world's best player",
      "The season's top scorer",
      "The best goalkeeper",
      "The best young player",
    ],
    correctIndex: 0,
    explanation: "France Football's award for the best player in the world.",
  },
  {
    id: "invincibles",
    question: "Which club went unbeaten through the 2003–04 Premier League?",
    options: ["Arsenal", "Manchester United", "Chelsea", "Liverpool"],
    correctIndex: 0,
    explanation: "Arsène Wenger's 'Invincibles' — 26 wins, 12 draws, 0 losses.",
  },
];

function shuffled<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pick a round of questions, preferring ones the visitor hasn't seen this
 * visit (so "Maybe later → keep playing" feels fresh), topping up from seen
 * ones once the pool runs dry. Option order is re-shuffled per sample so a
 * replayed question isn't answerable by position memory.
 */
export function sampleTasteRound(
  seenIds: ReadonlySet<string> = new Set(),
  size: number = TASTE_ROUND_SIZE,
  rng: () => number = Math.random,
  pool: readonly TasteQuestion[] = TASTE_QUESTION_POOL,
): TasteQuestion[] {
  const unseen = pool.filter((q) => !seenIds.has(q.id));
  const seen = pool.filter((q) => seenIds.has(q.id));
  const picked = [
    ...shuffled(unseen, rng).slice(0, size),
    ...shuffled(seen, rng).slice(0, Math.max(0, size - unseen.length)),
  ].slice(0, size);

  return picked.map((q) => {
    const order = shuffled(
      q.options.map((_, idx) => idx),
      rng,
    );
    return {
      ...q,
      options: order.map((idx) => q.options[idx]),
      correctIndex: order.indexOf(q.correctIndex),
    };
  });
}
