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
//   node lab/guesswho-facts.mjs --edition eN [--seed N]  # build (or reuse) lab/editions/guesswho-eN.json, gate, write
//   node lab/guesswho-facts.mjs           # re-gate the edition facts.json holds
//   node lab/guesswho-facts.mjs --check   # offline: gate from cache, assert facts.json
//
// e1 (2026-09-25, aired 10-02) was cast by hand: Beckham. From e2 the board
// is searched offline on career_paths + THE DRAW cards (fame ≤ 200), then
// gated online; a name any source disagrees on is banned and the search
// reruns. Secrets never repeat (lab/editions/guesswho-used.json), and the
// previous board's names sit one edition out.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS, CHECK, CLUBS, assertClubs, cardOf, dataClubs, fmtWd, gateReport, isFootballer, resolveInfobox, resolvePlayer, wdAnyLevel, wdSenior, wpAnyLevel, wpSenior } from "./tests-wiki.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "src", "lab", "guesswho", "facts.json");
const EDITIONS = path.join(dir, "editions");
const USED = path.join(EDITIONS, "guesswho-used.json");
const BANNED = path.join(EDITIONS, "guesswho-banned.json"); // names a source disagreed on — never searched again
const edFile = (ed) => path.join(EDITIONS, `guesswho-${ed}.json`);
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);

// ── the edition: { edition, secret, board: [[name, show]…] in tile order,
// questions: [{ text, kind, arg, withheld? }…] } — `withheld` = the answer is
// shown but the board is NOT flipped; the viewer supplies the last cut.
const NATIONS = { Argentina: "ARGENTINIAN", Belgium: "BELGIAN", Brazil: "BRAZILIAN", Croatia: "CROATIAN", England: "ENGLISH", France: "FRENCH", Germany: "GERMAN", Italy: "ITALIAN", Netherlands: "DUTCH", Portugal: "PORTUGUESE", Spain: "SPANISH", Uruguay: "URUGUAYAN" };

const gate = async ({ edition, secret: SECRET, board: BOARD, questions: QUESTIONS, search: SEARCH = {} }) => {
  const problems = [];
  const bad = new Set(); // names a source disagreed on or could not resolve
  const fail = (m, name) => {
    problems.push(m);
    if (name) bad.add(name);
  };
  if (!BOARD.some(([n]) => n === SECRET)) fail("secret is not on the board");
  if (new Set(BOARD.map(([n]) => n)).size !== 9) fail("board must be nine distinct names");
  problems.push(...(await assertClubs([...new Set(QUESTIONS.filter((q) => q.kind === "club").map((q) => q.arg))])));

  const P = {};
  const IB = {};
  for (const [n] of BOARD) {
    try {
      P[n] = await resolvePlayer(n, SEARCH[n]);
      IB[n] = await resolveInfobox(P[n]);
    } catch (e) {
      fail(`${n}: ${e.message}`, n);
      continue;
    }
    if (!isFootballer(P[n])) fail(`${n}: Wikidata ${P[n].qid} is "${P[n].description}"`, n);
  }
  if (bad.size) return { problems, bad };

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
        fail(`${name}: not exactly one career-paths entry`, name);
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
      else fail(`"${q.text}" for ${name}: sources disagree — data ${dY ? "YES" : dAny ? "any-level" : "NO"}, wikidata ${wY.map(fmtWd).join("; ") || (wAny.length ? `any-level ${wAny.map(fmtWd)}` : "NO")}, wikipedia ${pY.map((c) => c.years).join(", ") || (pAny.length ? `any-level ${pAny.map((c) => c.raw)}` : "NO")}`, name);
      line = `data ${dY ? "✓" : "—"} · wikidata ${wY.map(fmtWd).join("; ") || "—"} · wikipedia ${pY.map((c) => `${c.years} ${c.target}`).join("; ") || "—"}`;
    } else if (q.kind === "nation") {
      const card = cardOf.get(name);
      if (!card) {
        fail(`${name}: no THE DRAW card (nationality source 1)`, name);
        return false;
      }
      const sport = P[name].sportNation.length ? P[name].sportNation : P[name].citizenship;
      const all = new Set([...P[name].sportNation, ...P[name].citizenship]);
      if (card.nation === q.arg && sport.includes(q.arg)) ans = true;
      else if (card.nation !== q.arg && !all.has(q.arg)) ans = false;
      else fail(`"${q.text}" for ${name}: sources disagree — DRAW card ${card.nation}, Wikidata P1532 ${JSON.stringify(P[name].sportNation)} P27 ${JSON.stringify(P[name].citizenship)}`, name);
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
  if (problems.length) return { problems, bad };

  const facts = {
    _doc: "Generated by lab/guesswho-facts.mjs — every YES/NO double-sourced (club: career paths + Wikidata P54 + Wikipedia infobox; nation: THE DRAW card + Wikidata P1532/P27). Do not edit; re-run the script.",
    edition,
    secretIndex: BOARD.findIndex(([n]) => n === SECRET),
    board: BOARD.map(([name, show], i) => ({ i, name, show, qid: P[name].qid, wikipedia: IB[name].ref })),
    questions,
    finalists: BOARD.map(([n], i) => (alive.includes(n) ? i : -1)).filter((i) => i >= 0),
  };
  return { problems, bad, facts };
};

// ── the offline search ───────────────────────────────────────────────────
// Answers from the app's data only (career paths exact = YES, no any-level
// spelling = NO, anything between = unusable). The online gate decides.
const POOL = CARDS.filter((c) => c.fameRank <= 200 && dataClubs(c.name));
// the name fans say: surname with its particles (DE BRUYNE, VAN PERSIE), or
// the playing name where the surname would mislead (Ronaldo Nazário is RONALDO,
// so he and Cristiano can never share a board — shows must be distinct)
const SHOW = {
  "Ronaldo Nazário": "RONALDO",
  "Roberto Carlos": "ROBERTO CARLOS",
  "Vinícius Júnior": "VINÍCIUS",
  "Marcelo Vieira": "MARCELO",
  "Son Heung-min": "SON",
  "Alisson Becker": "ALISSON",
  "Luis Enrique": "LUIS ENRIQUE",
  "Thiago Silva": "THIAGO SILVA",
  "Xabi Alonso": "XABI ALONSO",
};
const PARTICLE = /^(de|di|da|do|dos|das|del|della|van|von|der|den|ter|la|le|el|al)$/i;
const showOf = (name) => {
  if (SHOW[name]) return SHOW[name];
  const w = name.split(" ");
  if (w.length === 1) return name.toUpperCase();
  let i = w.length - 1;
  while (i > 1 && PARTICLE.test(w[i - 1])) i--;
  return w.slice(i).join(" ").toUpperCase();
};
const FEATURES = [
  ...Object.entries(CLUBS).map(([k, c]) => ({ text: `PLAYED FOR ${c.show}?`, kind: "club", arg: k })),
  ...Object.entries(NATIONS).map(([n, d]) => ({ text: `IS HE ${d}?`, kind: "nation", arg: n })),
];
const offline = (q, name) => {
  if (q.kind === "nation") return cardOf.get(name).nation === q.arg;
  const club = CLUBS[q.arg];
  const dc = dataClubs(name);
  if (dc.some((c) => c.name === club.data)) return true;
  return dc.some((c) => club.re.test(c.name)) ? null : false;
};
// eliminations per non-withheld question: 9 → 7 → 5 → 4 → 3 → 2, as in e1
const CUTS = [2, 2, 1, 1, 1];

const search = (rand, banned, used, rest) => {
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const ok = POOL.filter((c) => !banned.has(c.name) && !rest.has(c.name));
  for (let attempt = 0; attempt < 200000; attempt++) {
    const secret = pick(ok.filter((c) => c.fameRank <= 80 && !used.has(c.name)));
    const qs = [];
    while (qs.length < 6) {
      const f = pick(FEATURES);
      if (!qs.includes(f)) qs.push(f);
    }
    const nations = qs.filter((q) => q.kind === "nation").length;
    if (nations < 1 || nations > 2) continue;
    const ans = qs.map((q) => offline(q, secret.name));
    if (ans.includes(null) || ans.slice(0, 5).filter(Boolean).length < 2) continue;
    // every other candidate: the step that knocks it out (5 = the withheld split)
    const bucket = [[], [], [], [], [], []];
    for (const c of ok) {
      if (c === secret) continue;
      for (let i = 0; i < 6; i++) {
        const a = offline(qs[i], c.name);
        if (a === null) break;
        if (a !== ans[i]) {
          bucket[i].push(c);
          break;
        }
      }
    }
    if (CUTS.some((n, i) => bucket[i].length < n) || !bucket[5].length) continue;
    const board = [secret];
    const shows = new Set([showOf(secret.name)]);
    const take = (from, n) => {
      const xs = [...from].sort((a, b) => a.fameRank - b.fameRank).slice(0, 12).sort(() => rand() - 0.5);
      for (const c of xs) {
        if (n === 0) break;
        if (shows.has(showOf(c.name))) continue;
        board.push(c);
        shows.add(showOf(c.name));
        n--;
      }
      return n === 0;
    };
    if (!CUTS.every((n, i) => take(bucket[i], n)) || !take(bucket[5], 1)) continue;
    const order = board.sort(() => rand() - 0.5);
    return {
      secret: secret.name,
      board: order.map((c) => [c.name, showOf(c.name)]),
      questions: qs.map((q, i) => ({ ...q, ...(i === 5 ? { withheld: true } : {}) })),
    };
  }
  throw new Error("guesswho: no board found — widen the pool or the features");
};

const main = async () => {
  const edition = arg("--edition") ?? (() => {
    const f = JSON.parse(readFileSync(OUT, "utf8"));
    return /^e\d+$/.test(f.edition) ? f.edition : "e1"; // e1 predates edition files
  })();
  let ed;
  if (existsSync(edFile(edition))) ed = JSON.parse(readFileSync(edFile(edition), "utf8"));
  else {
    if (CHECK) throw new Error(`--check: no ${edFile(edition)}`);
    let seed = Number(arg("--seed") ?? Number(edition.slice(1)) * 7919);
    // mulberry32 — the float LCG (seed * 1103515245) overflows 2^53 and some seeds collapse into a short cycle
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const usedList = existsSync(USED) ? JSON.parse(readFileSync(USED, "utf8")) : [];
    const used = new Set(usedList.map((u) => u.secret));
    const rest = new Set(usedList.at(-1)?.board ?? []);
    const banned = new Set(existsSync(BANNED) ? JSON.parse(readFileSync(BANNED, "utf8")) : []);
    for (let round = 1; ; round++) {
      ed = { edition, ...search(rand, banned, used, rest) };
      console.log(`\n── candidate ${round}: ${ed.board.map(([, s]) => s).join(", ")}`);
      const g = await gate(ed);
      if (!g.problems.length) break;
      for (const p of g.problems) console.log(`  ✗ ${p}`);
      if (!g.bad.size || round >= 8) gateReport("GUESS WHO", g.problems);
      for (const n of g.bad) banned.add(n);
      writeFileSync(BANNED, JSON.stringify([...banned].sort(), null, 1));
      console.log(`  banned: ${[...g.bad].join(", ")} — searching again`);
    }
    writeFileSync(edFile(edition), JSON.stringify(ed, null, 1));
    writeFileSync(USED, JSON.stringify([...usedList, { edition, secret: ed.secret, board: ed.board.map(([n]) => n) }], null, 1));
  }
  const { problems, facts } = await gate(ed);
  gateReport("GUESS WHO", problems);
  const BOARD = ed.board;
  if (CHECK) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.questions) !== JSON.stringify(facts.questions) || JSON.stringify(cur.board) !== JSON.stringify(facts.board)) {
      console.error("✗ --check: facts.json drifted from the gate — re-run without --check");
      process.exit(1);
    }
    console.log(`\n✓ GUESS WHO GATE PASSED (offline) — ${edition} finalists ${facts.finalists.map((i) => BOARD[i][1]).join(" / ")}`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  console.log(`\n✓ GUESS WHO GATE PASSED — ${edition} finalists ${facts.finalists.map((i) => BOARD[i][1]).join(" / ")} · secret never written to screen\n→ ${OUT}`);
};
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
