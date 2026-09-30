// GUESS WHO — fact gate. Nine names on a board, one secret, six yes/no
// questions. Every elimination is COMPUTED, and every YES/NO is sourced at
// least twice (lab/tests-wiki.mjs), failing loudly on any disagreement:
//
//   club  "PLAYED FOR X?"  YES ⇔ football_career_paths.json has X AND Wikidata
//                          P54 has X's senior QID AND the Wikipedia infobox
//                          senior clubs resolve to that QID (all three).
//                          NO  ⇔ none of the three shows X at ANY level
//                          (youth/B sides included — a NO must be clean).
//   nation "IS HE X?"      YES ⇔ THE DRAW card nation is X AND Wikidata
//                          P1532 (country for sport; P27 if absent) has X.
//                          NO  ⇔ the card is not X AND neither P1532 nor P27
//                          lists X (a dual citizen makes the gate fail).
//
// The script writes src/lab/guesswho/facts.json and throws if the board does
// not reduce 9 → … → 2 with the final question splitting the last two (that
// split is the withheld flip, the comment ask).
//
//   node lab/guesswho-facts.mjs           # resolve what is missing, gate, write
//   node lab/guesswho-facts.mjs --check   # offline: gate from cache, assert facts.json
//
// 2026-09-25 edition: recast. The first edition's secret (Ibrahimović) and
// four of its nine names (Henry, Ibrahimović, Suárez, Zidane) were on the
// posted Imposter reel of 2026-09-23.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK, CLUBS, assertClubs, cardOf, dataClubs, fmtWd, gateReport, isFootballer, resolveInfobox, resolvePlayer, wdAnyLevel, wdSenior, wpAnyLevel, wpSenior } from "./tests-wiki.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "src", "lab", "guesswho", "facts.json");

// ── the edition ──────────────────────────────────────────────────────────
export const SECRET = "David Beckham";
// board order = tile order, left→right, top→bottom
export const BOARD = [
  ["Luís Figo", "FIGO"],
  ["Mesut Özil", "ÖZIL"],
  ["Kaká", "KAKÁ"],
  ["Wayne Rooney", "ROONEY"],
  ["Xabi Alonso", "XABI ALONSO"],
  ["Gareth Bale", "BALE"],
  ["Cesc Fàbregas", "FÀBREGAS"],
  ["David Beckham", "BECKHAM"],
  ["Ronaldinho", "RONALDINHO"],
];
// `withheld` = the answer is shown but the board is NOT flipped — the viewer
// supplies the last cut.
export const QUESTIONS = [
  { text: "PLAYED FOR ARSENAL?", kind: "club", arg: "arsenal" },
  { text: "PLAYED FOR REAL MADRID?", kind: "club", arg: "realmadrid" },
  { text: "PLAYED FOR BARCELONA?", kind: "club", arg: "barcelona" },
  { text: "IS HE SPANISH?", kind: "nation", arg: "Spain" },
  { text: "PLAYED FOR AC MILAN?", kind: "club", arg: "milan" },
  { text: "PLAYED FOR PSG?", kind: "club", arg: "psg", withheld: true },
];
const SEARCH = {};

const main = async () => {
  const problems = [];
  const fail = (m) => problems.push(m);
  if (!BOARD.some(([n]) => n === SECRET)) fail("secret is not on the board");
  if (new Set(BOARD.map(([n]) => n)).size !== 9) fail("board must be nine distinct names");
  problems.push(...(await assertClubs([...new Set(QUESTIONS.filter((q) => q.kind === "club").map((q) => q.arg))])));

  const P = {};
  const IB = {};
  for (const [n] of BOARD) {
    P[n] = await resolvePlayer(n, SEARCH[n]);
    IB[n] = await resolveInfobox(P[n]);
    if (!isFootballer(P[n])) fail(`${n}: Wikidata ${P[n].qid} is "${P[n].description}"`);
  }

  const evidence = [];
  const memo = new Map();
  const predicate = (q, name) => {
    const key = `${q.kind}:${q.arg}:${name}`;
    if (memo.has(key)) return memo.get(key);
    let ans = null;
    let line = "";
    if (q.kind === "club") {
      const club = CLUBS[q.arg];
      const dc = dataClubs(name);
      if (!dc) {
        fail(`${name}: not exactly one career-paths entry`);
        return false;
      }
      const dY = dc.some((c) => c.name === club.data);
      const wY = wdSenior(P[name], club);
      const pY = wpSenior(IB[name], club);
      const dAny = dc.some((c) => club.re.test(c.name));
      const wAny = wdAnyLevel(P[name], club);
      const pAny = wpAnyLevel(IB[name], club);
      if (dY && wY.length && pY.length) ans = true;
      else if (!dAny && !wAny.length && !pAny.length) ans = false;
      else fail(`"${q.text}" for ${name}: sources disagree — data ${dY ? "YES" : dAny ? "any-level" : "NO"}, wikidata ${wY.map(fmtWd).join("; ") || (wAny.length ? `any-level ${wAny.map(fmtWd)}` : "NO")}, wikipedia ${pY.map((c) => c.years).join(", ") || (pAny.length ? `any-level ${pAny.map((c) => c.raw)}` : "NO")}`);
      line = `data ${dY ? "✓" : "—"} · wikidata ${wY.map(fmtWd).join("; ") || "—"} · wikipedia ${pY.map((c) => `${c.years} ${c.target}`).join("; ") || "—"}`;
    } else if (q.kind === "nation") {
      const card = cardOf.get(name);
      if (!card) {
        fail(`${name}: no THE DRAW card (nationality source 1)`);
        return false;
      }
      const sport = P[name].sportNation.length ? P[name].sportNation : P[name].citizenship;
      const all = new Set([...P[name].sportNation, ...P[name].citizenship]);
      if (card.nation === q.arg && sport.includes(q.arg)) ans = true;
      else if (card.nation !== q.arg && !all.has(q.arg)) ans = false;
      else fail(`"${q.text}" for ${name}: sources disagree — DRAW card ${card.nation}, Wikidata P1532 ${JSON.stringify(P[name].sportNation)} P27 ${JSON.stringify(P[name].citizenship)}`);
      line = `DRAW card ${card.nation} · wikidata P1532 ${JSON.stringify(P[name].sportNation)} P27 ${JSON.stringify(P[name].citizenship)}`;
    } else throw new Error(`unknown predicate kind ${q.kind}`);
    memo.set(key, ans);
    evidence.push({ q: q.text, name, answer: ans === null ? "DISAGREE" : ans ? "YES" : "NO", line });
    return ans;
  };

  let alive = BOARD.map(([n]) => n);
  const questions = [];
  for (const [i, q] of QUESTIONS.entries()) {
    const answer = predicate(q, SECRET);
    const out = alive.filter((n) => predicate(q, n) !== answer);
    const remain = alive.filter((n) => predicate(q, n) === answer);
    console.log(`\nQ${i + 1} ${q.text}  (secret: ${answer ? "YES" : "NO"})`);
    for (const n of alive) {
      const e = evidence.find((e) => e.q === q.text && e.name === n);
      console.log(`   ${e.answer.padEnd(3)} ${n.padEnd(15)} ${e.line}`);
    }
    if (!q.withheld) {
      if (out.length === 0) fail(`Q${i + 1} "${q.text}" eliminates nobody — dead beat`);
      if (remain.length < 2) fail(`Q${i + 1} leaves ${remain.length} — the board must end on TWO before the withheld question`);
      alive = remain;
    } else {
      if (i !== QUESTIONS.length - 1) fail("only the last question may be withheld");
      if (alive.length !== 2) fail(`withheld question must be asked over exactly two survivors, got ${alive.length}`);
      if (remain.length !== 1 || remain[0] !== SECRET) fail("the withheld question must single out the secret");
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
  gateReport("GUESS WHO", problems);

  const facts = {
    _doc: "Generated by lab/guesswho-facts.mjs — every YES/NO double-sourced (club: career paths + Wikidata P54 + Wikipedia infobox; nation: THE DRAW card + Wikidata P1532/P27). Do not edit; re-run the script.",
    edition: "beckham-2026-09-25",
    secretIndex: BOARD.findIndex(([n]) => n === SECRET),
    board: BOARD.map(([name, show], i) => ({ i, name, show, qid: P[name].qid, wikipedia: IB[name].ref })),
    questions,
    finalists: BOARD.map(([n], i) => (alive.includes(n) ? i : -1)).filter((i) => i >= 0),
  };
  if (CHECK) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.questions) !== JSON.stringify(facts.questions) || JSON.stringify(cur.board) !== JSON.stringify(facts.board)) {
      console.error("✗ --check: facts.json drifted from the gate — re-run without --check");
      process.exit(1);
    }
    console.log(`\n✓ GUESS WHO GATE PASSED (offline) — finalists ${facts.finalists.map((i) => BOARD[i][1]).join(" / ")}`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  console.log(`\n✓ GUESS WHO GATE PASSED — finalists ${facts.finalists.map((i) => BOARD[i][1]).join(" / ")} · secret ${SECRET} (never written to screen)\n→ ${OUT}`);
};
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
