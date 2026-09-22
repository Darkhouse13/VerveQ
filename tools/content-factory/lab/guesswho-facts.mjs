// GUESS WHO — fact gate. Nine names on a board, one secret, six yes/no
// questions. Every elimination is COMPUTED from app/convex/data (career
// paths for club + country predicates, THE DRAW's Wikidata-sourced cards for
// nationality) — never typed. The script writes src/lab/guesswho/facts.json
// and throws if the board does not reduce 9 → … → 2 with the final question
// splitting the last two (that split is the withheld flip, the comment ask).
//
//   node lab/guesswho-facts.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const OUT = path.join(dir, "..", "src", "lab", "guesswho", "facts.json");

const paths = JSON.parse(readFileSync(path.join(DATA, "football_career_paths.json"), "utf8"));
const cards = JSON.parse(readFileSync(path.join(DATA, "drawCardsReal.candidates.json"), "utf8"));
const byName = new Map(paths.map((p) => [p.answerName, p]));
const cardOf = new Map(cards.map((c) => [c.name, c]));
const clubName = (c) => (typeof c === "string" ? c : c.name);

// ── the edition ──────────────────────────────────────────────────────────
export const SECRET = "Zlatan Ibrahimović";
// board order = tile order, left→right, top→bottom
export const BOARD = [
  ["Lionel Messi", "MESSI"],
  ["Thierry Henry", "HENRY"],
  ["Cristiano Ronaldo", "RONALDO"],
  ["Samuel Eto'o", "ETO'O"],
  ["Zlatan Ibrahimović", "IBRAHIMOVIĆ"],
  ["David Beckham", "BECKHAM"],
  ["Luis Suárez", "SUÁREZ"],
  ["Zinedine Zidane", "ZIDANE"],
  ["Cesc Fàbregas", "FÀBREGAS"],
];
// Each question is a predicate over the dataset. `withheld` = the answer is
// shown but the board is NOT flipped — the viewer supplies the last cut.
export const QUESTIONS = [
  { text: "PLAYED IN ENGLAND?", kind: "country", arg: "England" },
  { text: "PLAYED FOR BARCELONA?", kind: "club", arg: "Barcelona" },
  { text: "PLAYED IN ITALY?", kind: "country", arg: "Italy" },
  { text: "IS HE EUROPEAN?", kind: "continent", arg: "Europe" },
  { text: "PLAYED IN THE USA?", kind: "country", arg: "USA" },
  { text: "PLAYED FOR AC MILAN?", kind: "club", arg: "AC Milan", withheld: true },
];

// Every club on every board path must be classified, so a "played in X" NO
// is a statement about the whole path, not about the clubs we remembered.
const CLUB_COUNTRY = {
  Barcelona: "Spain", "Paris Saint-Germain": "France", "Inter Miami": "USA",
  Monaco: "France", Juventus: "Italy", Arsenal: "England", "New York Red Bulls": "USA",
  "Sporting CP": "Portugal", "Manchester United": "England", "Real Madrid": "Spain", "Al-Nassr": "Saudi Arabia",
  Leganes: "Spain", Espanyol: "Spain", Mallorca: "Spain", "Inter Milan": "Italy", "Anzhi Makhachkala": "Russia",
  Chelsea: "England", Everton: "England", Sampdoria: "Italy", Antalyaspor: "Turkey", Konyaspor: "Turkey", "Qatar SC": "Qatar",
  "Malmö FF": "Sweden", Ajax: "Netherlands", "AC Milan": "Italy", "LA Galaxy": "USA",
  "Preston North End": "England",
  Nacional: "Uruguay", Groningen: "Netherlands", Liverpool: "England", "Atlético Madrid": "Spain", Grêmio: "Brazil",
  Cannes: "France", Bordeaux: "France", Como: "Italy",
};
const NATION_CONTINENT = {
  Argentina: "South America", France: "Europe", Portugal: "Europe", Cameroon: "Africa", Sweden: "Europe",
  England: "Europe", Uruguay: "South America", Spain: "Europe",
};

const predicate = (q, name) => {
  const p = byName.get(name);
  if (!p) throw new Error(`"${name}" is not in football_career_paths.json`);
  const clubs = p.clubs.map(clubName);
  if (q.kind === "club") {
    if (!Object.values(CLUB_COUNTRY).length) throw new Error("unreachable");
    if (!(q.arg in CLUB_COUNTRY)) throw new Error(`club "${q.arg}" not in CLUB_COUNTRY`);
    return clubs.includes(q.arg);
  }
  if (q.kind === "country") {
    for (const c of clubs) if (!(c in CLUB_COUNTRY)) throw new Error(`unclassified club "${c}" on ${name}'s path`);
    return clubs.some((c) => CLUB_COUNTRY[c] === q.arg);
  }
  if (q.kind === "continent") {
    const card = cardOf.get(name);
    if (!card) throw new Error(`"${name}" has no THE DRAW card (nationality source)`);
    if (!(card.nation in NATION_CONTINENT)) throw new Error(`nation "${card.nation}" not in NATION_CONTINENT`);
    return NATION_CONTINENT[card.nation] === q.arg;
  }
  throw new Error(`unknown predicate kind ${q.kind}`);
};

const main = () => {
  if (!BOARD.some(([n]) => n === SECRET)) throw new Error("secret is not on the board");
  if (new Set(BOARD.map(([n]) => n)).size !== 9) throw new Error("board must be nine distinct names");
  let alive = BOARD.map(([n]) => n);
  const questions = [];
  for (const [i, q] of QUESTIONS.entries()) {
    const answer = predicate(q, SECRET);
    const out = alive.filter((n) => predicate(q, n) !== answer);
    const remain = alive.filter((n) => predicate(q, n) === answer);
    if (!q.withheld) {
      if (out.length === 0) throw new Error(`Q${i + 1} "${q.text}" eliminates nobody — dead beat`);
      if (remain.length < 2) throw new Error(`Q${i + 1} leaves ${remain.length} — the board must end on TWO before the withheld question`);
      alive = remain;
    } else {
      if (i !== QUESTIONS.length - 1) throw new Error("only the last question may be withheld");
      if (alive.length !== 2) throw new Error(`withheld question must be asked over exactly two survivors, got ${alive.length}`);
      if (remain.length !== 1 || remain[0] !== SECRET) throw new Error("the withheld question must single out the secret");
    }
    questions.push({
      n: i + 1,
      text: q.text,
      answer: answer ? "YES" : "NO",
      withheld: Boolean(q.withheld),
      eliminated: q.withheld ? [] : out.map((n) => BOARD.findIndex(([m]) => m === n)),
      left: q.withheld ? alive.length : remain.length,
    });
  }
  const facts = {
    _doc: "Generated by lab/guesswho-facts.mjs from football_career_paths.json + drawCardsReal.candidates.json. Do not edit — re-run the script.",
    secretIndex: BOARD.findIndex(([n]) => n === SECRET),
    board: BOARD.map(([name, show], i) => ({ i, name, show })),
    questions,
    finalists: BOARD.map(([n], i) => (alive.includes(n) ? i : -1)).filter((i) => i >= 0),
  };
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  for (const q of questions) console.log(`Q${q.n} ${q.text.padEnd(24)} ${q.answer.padEnd(3)} → out ${q.eliminated.map((i) => BOARD[i][1]).join(", ") || (q.withheld ? "(withheld)" : "-")}  · ${q.left} left`);
  console.log(`finalists: ${facts.finalists.map((i) => BOARD[i][1]).join(" / ")} · secret ${SECRET} (never written to screen)\n→ ${OUT}`);
};
main();
