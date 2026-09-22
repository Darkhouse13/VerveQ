// SPOT THE IMPOSTER — double fact gate. Six rounds, each "3 of them played
// for CLUB, who didn't?". A round is valid ONLY if two independent sources
// agree:
//
//   1. app/convex/data/football_career_paths.json (the app's own career data;
//      clubs are strings or {name, loan} — loans count as "played for")
//   2. Wikidata P54 (member of sports team), resolved once per player into
//      lab/imposter-wikidata-cache.json
//
// Genuine ⇒ the club is on the data path AND Wikidata P54 carries the club's
// SENIOR team QID (non-deprecated). Imposter ⇒ no club on the data path
// matches the club AND no Wikidata P54 team matches it at ANY level — the
// senior QID, a youth/B/reserve side (label match), or any team whose
// P361/P749/P127 points at the club. The imposter's stamped "real" club must
// itself pass the genuine test. Nation and position on the name cards are
// cross-checked against Wikidata P27/P1532 and P413.
//
// Writes src/lab/imposter/facts.json; exits non-zero on ANY disagreement.
//
//   node lab/imposter-facts.mjs           # resolve what is missing, gate, write
//   node lab/imposter-facts.mjs --check   # offline: gate from cache, assert facts.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const CACHE = path.join(dir, "imposter-wikidata-cache.json");
const OUT = path.join(dir, "..", "src", "lab", "imposter", "facts.json");
const UA = "VerveQ-content-factory/1.0 (https://verveq.com; imposter reel fact gate; contact via verveq.com)";
const CHECK = process.argv.includes("--check");

// ── clubs ────────────────────────────────────────────────────────────────
// qid = senior team; label = what Wikidata must call that QID (asserted);
// data = the exact name on career paths; re = any-level match (youth/B/reserves)
const CLUBS = {
  chelsea: { qid: "Q9616", label: /^Chelsea/i, data: "Chelsea", re: /chelsea/i, show: "CHELSEA", bg: "#034694", fg: "#FFFFFF", edge: "#FFFFFF" },
  barcelona: { qid: "Q7156", label: /Barcelona/i, data: "Barcelona", re: /barcelona|barça/i, show: "BARCELONA", bg: "#A50044", fg: "#FFFFFF", edge: "#004D98" },
  realmadrid: { qid: "Q8682", label: /Real Madrid/i, data: "Real Madrid", re: /real madrid/i, show: "REAL MADRID", bg: "#FFFFFF", fg: "#00529F", edge: "#FEBE10" },
  juventus: { qid: "Q1422", label: /Juventus/i, data: "Juventus", re: /juventus/i, show: "JUVENTUS", bg: "#000000", fg: "#FFFFFF", edge: "#FFFFFF" },
  manutd: { qid: "Q18656", label: /Manchester United/i, data: "Manchester United", re: /manchester united|man\.? ?utd/i, show: "MANCHESTER UNITED", bg: "#DA291C", fg: "#FFFFFF", edge: "#FBE122" },
  inter: { qid: "Q631", label: /Inter/i, data: "Inter Milan", re: /internazionale|inter milan|^inter$|^f\.?c\.? inter/i, show: "INTER", bg: "#010E80", fg: "#FFFFFF", edge: "#000000" },
  liverpool: { qid: "Q1130849", label: /^Liverpool/i, data: "Liverpool", re: /^liverpool/i, show: "LIVERPOOL", bg: "#C8102E", fg: "#FFFFFF", edge: "#F6EB61" },
  arsenal: { qid: "Q9617", label: /^Arsenal/i, data: "Arsenal", re: /^arsenal/i, show: "ARSENAL", bg: "#EF0107", fg: "#FFFFFF", edge: "#FFFFFF" },
  milan: { qid: "Q1543", label: /Milan/i, data: "AC Milan", re: /a\.?c\.? milan/i, show: "AC MILAN", bg: "#FB090B", fg: "#FFFFFF", edge: "#000000" },
};

// ── the edition ──────────────────────────────────────────────────────────
// cards = grid order (TL, TR, BL, BR). `imp` = the imposter; `real` = the
// club stamped on his flipped card. Round 6 is withheld on screen.
export const ROUNDS = [
  { tier: "EASY", club: "chelsea", cards: ["Didier Drogba", "Steven Gerrard", "Eden Hazard", "Frank Lampard"], imp: "Steven Gerrard", real: "liverpool" },
  { tier: "EASY", club: "barcelona", cards: ["Zinedine Zidane", "Ronaldinho", "Luis Suárez", "Neymar"], imp: "Zinedine Zidane", real: "realmadrid" },
  { tier: "MEDIUM", club: "realmadrid", cards: ["Arjen Robben", "Michael Owen", "Wesley Sneijder", "Robin van Persie"], imp: "Robin van Persie", real: "arsenal" },
  { tier: "HARD", club: "juventus", cards: ["Thierry Henry", "Andriy Shevchenko", "Patrick Vieira", "Zlatan Ibrahimović"], imp: "Andriy Shevchenko", real: "milan" },
  { tier: "HARD", club: "manutd", cards: ["Radamel Falcao", "Ángel Di María", "Gonzalo Higuaín", "Henrik Larsson"], imp: "Gonzalo Higuaín", real: "juventus" },
  { tier: "IMPOSSIBLE", club: "inter", cards: ["Patrick Kluivert", "Roberto Carlos", "Andrea Pirlo", "Edgar Davids"], imp: "Patrick Kluivert", real: "barcelona", withheld: true },
];
const TIERS = ["EASY", "EASY", "MEDIUM", "HARD", "HARD", "IMPOSSIBLE"];

// display: first-name line (small) + surname (big). Nation/position come from
// THE DRAW cards where present, else DISPLAY_FALLBACK — and both are then
// cross-checked against Wikidata below.
const SHOW = {
  "Didier Drogba": ["Didier", "DROGBA"], "Steven Gerrard": ["Steven", "GERRARD"], "Eden Hazard": ["Eden", "HAZARD"], "Frank Lampard": ["Frank", "LAMPARD"],
  "Zinedine Zidane": ["Zinedine", "ZIDANE"], Ronaldinho: ["", "RONALDINHO"], "Luis Suárez": ["Luis", "SUÁREZ"], Neymar: ["", "NEYMAR"],
  "Arjen Robben": ["Arjen", "ROBBEN"], "Michael Owen": ["Michael", "OWEN"], "Wesley Sneijder": ["Wesley", "SNEIJDER"], "Robin van Persie": ["Robin", "VAN PERSIE"],
  "Thierry Henry": ["Thierry", "HENRY"], "Andriy Shevchenko": ["Andriy", "SHEVCHENKO"], "Patrick Vieira": ["Patrick", "VIEIRA"], "Zlatan Ibrahimović": ["Zlatan", "IBRAHIMOVIĆ"],
  "Radamel Falcao": ["Radamel", "FALCAO"], "Ángel Di María": ["Ángel", "DI MARÍA"], "Gonzalo Higuaín": ["Gonzalo", "HIGUAÍN"], "Henrik Larsson": ["Henrik", "LARSSON"],
  "Patrick Kluivert": ["Patrick", "KLUIVERT"], "Roberto Carlos": ["", "ROBERTO CARLOS"], "Andrea Pirlo": ["Andrea", "PIRLO"], "Edgar Davids": ["Edgar", "DAVIDS"],
};
const DISPLAY_FALLBACK = { "Henrik Larsson": { nation: "Sweden", position: "ATT" }, "Patrick Kluivert": { nation: "Netherlands", position: "ATT" } };
// Wikidata search overrides where the plain name search is ambiguous
const SEARCH = { "Roberto Carlos": "Roberto Carlos da Silva" };
const FLAG = {
  "Ivory Coast": "🇨🇮", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Belgium: "🇧🇪", France: "🇫🇷", Brazil: "🇧🇷", Uruguay: "🇺🇾", Netherlands: "🇳🇱",
  Sweden: "🇸🇪", Ukraine: "🇺🇦", Colombia: "🇨🇴", Argentina: "🇦🇷", Italy: "🇮🇹",
};
// how each nation may appear among a player's P27/P1532 labels
const NATION_RE = { "Ivory Coast": /ivory coast|côte d'ivoire/i, England: /england|united kingdom/i, Netherlands: /netherlands/i };
const POS = { ATT: { show: "FORWARD", re: /forward|striker|winger/i }, MID: { show: "MIDFIELDER", re: /midfield/i }, DEF: { show: "DEFENDER", re: /back|defender/i } };

// ── wikidata ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json, application/json" } });
    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text);
      } catch {}
    }
    console.log(`  (wikidata ${res.status}, retry ${attempt + 1})`);
    await sleep(4000 * (attempt + 1));
  }
  throw new Error(`wikidata: gave up on ${url}`);
};
const api = (params) => getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`);
const sparql = (q) => getJson(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: "json" })}`);

const resolvePlayer = async (name) => {
  const s = await api({ action: "wbsearchentities", search: SEARCH[name] ?? name, language: "en", limit: "7" });
  const hit = (s.search ?? []).find((h) => /fo+t?ball|soccer/i.test(h.description ?? ""));
  if (!hit) throw new Error(`wikidata: no footballer entity for "${name}": ${JSON.stringify(s.search?.map((h) => `${h.label} — ${h.description}`))}`);
  await sleep(1500);
  const q = `SELECT ?prop ?st ?rank ?val ?valLabel ?start ?end ?parent ?parentLabel WHERE {
    { wd:${hit.id} p:P54 ?st . ?st ps:P54 ?val ; wikibase:rank ?rank . BIND("P54" AS ?prop)
      OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
      OPTIONAL { ?val wdt:P361|wdt:P749|wdt:P127 ?parent } }
    UNION { wd:${hit.id} wdt:P27 ?val . BIND("P27" AS ?prop) }
    UNION { wd:${hit.id} wdt:P1532 ?val . BIND("P1532" AS ?prop) }
    UNION { wd:${hit.id} wdt:P413 ?val . BIND("P413" AS ?prop) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const r = await sparql(q);
  const rows = r.results.bindings;
  const qidOf = (u) => u?.value?.split("/").pop();
  const teams = new Map();
  for (const b of rows.filter((b) => b.prop.value === "P54")) {
    const key = b.st.value;
    const t = teams.get(key) ?? {
      qid: qidOf(b.val),
      label: b.valLabel?.value,
      rank: b.rank.value.split("#").pop().replace("Rank", ""),
      start: b.start?.value?.slice(0, 4) ?? null,
      end: b.end?.value?.slice(0, 4) ?? null,
      parents: [],
    };
    if (b.parent && !t.parents.some((p) => p.qid === qidOf(b.parent))) t.parents.push({ qid: qidOf(b.parent), label: b.parentLabel?.value });
    teams.set(key, t);
  }
  const labels = (p) => [...new Set(rows.filter((b) => b.prop.value === p).map((b) => b.valLabel?.value))];
  return {
    name,
    qid: hit.id,
    label: hit.label,
    description: hit.description,
    ref: `https://www.wikidata.org/wiki/${hit.id}#P54`,
    fetched: new Date().toISOString().slice(0, 10),
    p54: [...teams.values()],
    nationality: [...new Set([...labels("P27"), ...labels("P1532")])],
    positions: labels("P413"),
  };
};

// ── the gate ─────────────────────────────────────────────────────────────
const paths = JSON.parse(readFileSync(path.join(DATA, "football_career_paths.json"), "utf8"));
const cards = JSON.parse(readFileSync(path.join(DATA, "drawCardsReal.candidates.json"), "utf8"));
const cardOf = new Map(cards.map((c) => [c.name, c]));
const clubName = (c) => (typeof c === "string" ? c : c.name);

const main = async () => {
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { players: {}, clubs: {} };
  const problems = [];
  const fail = (msg) => problems.push(msg);

  // structure
  if (ROUNDS.length !== 6) fail(`need 6 rounds, got ${ROUNDS.length}`);
  ROUNDS.forEach((r, i) => {
    if (r.tier !== TIERS[i]) fail(`R${i + 1} tier ${r.tier} ≠ ladder ${TIERS[i]}`);
    if (r.cards.length !== 4 || new Set(r.cards).size !== 4) fail(`R${i + 1} needs 4 distinct cards`);
    if (!r.cards.includes(r.imp)) fail(`R${i + 1} imposter not on the grid`);
    if (Boolean(r.withheld) !== (i === 5)) fail(`only round 6 is withheld`);
  });
  const all = ROUNDS.flatMap((r) => r.cards);
  if (new Set(all).size !== 24) fail(`24 distinct players required, got ${new Set(all).size}`);

  // club QIDs must be the clubs we think they are
  const clubQids = Object.values(CLUBS).map((c) => c.qid).filter((q) => !cache.clubs[q]);
  if (clubQids.length) {
    if (CHECK) throw new Error(`--check: club QIDs missing from cache: ${clubQids}`);
    const e = await api({ action: "wbgetentities", ids: clubQids.join("|"), props: "labels", languages: "en" });
    for (const q of clubQids) cache.clubs[q] = e.entities[q]?.labels?.en?.value ?? null;
    writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    await sleep(1500);
  }
  for (const [k, c] of Object.entries(CLUBS)) if (!c.label.test(cache.clubs[c.qid] ?? "")) fail(`club ${k}: ${c.qid} is "${cache.clubs[c.qid]}" on Wikidata`);

  // resolve players
  for (const n of all) {
    if (cache.players[n]) continue;
    if (CHECK) throw new Error(`--check: "${n}" not in cache`);
    console.log(`resolving ${n} …`);
    cache.players[n] = await resolvePlayer(n);
    writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    await sleep(1500);
  }

  const dataClubs = (n) => {
    const ps = paths.filter((p) => p.answerName === n);
    if (ps.length !== 1) {
      fail(`"${n}" has ${ps.length} entries in football_career_paths.json`);
      return [];
    }
    return ps[0].clubs.map((c) => ({ name: clubName(c), loan: typeof c === "object" && Boolean(c.loan) }));
  };
  // senior-team spells in Wikidata
  const wdSenior = (n, club) => cache.players[n].p54.filter((t) => t.qid === club.qid && t.rank !== "deprecated");
  // ANY-level contact with the club in Wikidata (any rank — conservative)
  const wdAnyLevel = (n, club) =>
    cache.players[n].p54.filter((t) => t.qid === club.qid || club.re.test(t.label ?? "") || t.parents.some((p) => p.qid === club.qid || club.re.test(p.label ?? "")));
  const span = (t) => `${t.label} [${t.qid}] ${t.start ?? "?"}–${t.end ?? "?"}${t.rank !== "normal" ? ` (${t.rank})` : ""}`;

  const rounds = [];
  for (const [i, r] of ROUNDS.entries()) {
    const club = CLUBS[r.club];
    const real = CLUBS[r.real];
    console.log(`\n── R${i + 1} ${r.tier} · ${club.show} (${club.qid})${r.withheld ? " · WITHHELD ON SCREEN" : ""}`);
    const out = [];
    for (const n of r.cards) {
      const P = cache.players[n];
      if (!/fo+t?ball|soccer/i.test(P.description ?? "")) fail(`${n}: resolved to non-footballer ${P.qid} "${P.description}"`);
      const dc = dataClubs(n);
      const isImp = n === r.imp;
      if (!isImp) {
        const d = dc.filter((c) => c.name === club.data);
        const w = wdSenior(n, club);
        const ok = d.length > 0 && w.length > 0;
        if (d.length === 0) fail(`R${i + 1} ${n}: career data has no "${club.data}" (${dc.map((c) => c.name).join(", ")})`);
        if (w.length === 0) fail(`R${i + 1} ${n}: Wikidata ${P.qid} P54 lacks senior ${club.qid}`);
        console.log(`  ${ok ? "✓" : "✗"} GENUINE  ${n.padEnd(20)} data: ${d.map((c) => c.name + (c.loan ? " (loan)" : "")).join(", ") || "—"}  |  wikidata ${P.qid}: ${w.map(span).join("; ") || "—"}`);
      } else {
        const d = dc.filter((c) => club.re.test(c.name));
        const w = wdAnyLevel(n, club);
        if (d.length) fail(`R${i + 1} imposter ${n}: career data HAS ${d.map((c) => c.name)}`);
        if (w.length) fail(`R${i + 1} imposter ${n}: Wikidata lists ${w.map(span).join("; ")}`);
        const rd = dc.filter((c) => c.name === real.data);
        const rw = wdSenior(n, real);
        if (!rd.length || !rw.length) fail(`R${i + 1} imposter ${n}: stamped club ${real.show} not confirmed by both (data ${rd.length}, wikidata ${rw.length})`);
        console.log(`  ${!d.length && !w.length ? "✓" : "✗"} IMPOSTER ${n.padEnd(20)} data: no ${club.show} in [${dc.map((c) => c.name).join(", ")}]  |  wikidata ${P.qid}: no ${club.show} at any level among ${P.p54.length} P54 teams`);
        console.log(`             stamp ${real.show}: data ${rd.length ? "✓" : "✗"} · wikidata ${rw.map(span).join("; ") || "✗"}`);
      }
      // display cross-checks
      const card = cardOf.get(n);
      const disp = card ? { nation: card.nation, position: card.position } : DISPLAY_FALLBACK[n];
      if (!disp) fail(`${n}: no nation/position source`);
      const nre = NATION_RE[disp.nation] ?? new RegExp(disp.nation, "i");
      if (!P.nationality.some((l) => nre.test(l))) fail(`${n}: nation "${disp.nation}" not in Wikidata ${JSON.stringify(P.nationality)}`);
      const pos = POS[disp.position];
      if (!pos) fail(`${n}: unknown position ${disp.position}`);
      else if (!P.positions.some((l) => pos.re.test(l))) {
        // "wing half" is Wikidata's catch-all for a wide player (Neymar, Di María):
        // it is consistent with a wide FORWARD or a MIDFIELDER, never a DEFENDER.
        if (disp.position !== "DEF" && P.positions.some((l) => /wing half/i.test(l))) console.log(`  · note: ${n} shown as ${pos.show}; Wikidata P413 says ${JSON.stringify(P.positions)} (wide role, accepted)`);
        else fail(`${n}: position ${pos.show} not in Wikidata ${JSON.stringify(P.positions)}`);
      }
      if (!FLAG[disp.nation]) fail(`${n}: no flag for ${disp.nation}`);
      if (!SHOW[n]) fail(`${n}: no display name`);
      out.push({ name: n, first: SHOW[n]?.[0] ?? "", last: SHOW[n]?.[1] ?? n, nation: disp.nation, flag: FLAG[disp.nation], position: pos?.show, qid: P.qid });
    }
    rounds.push({
      n: i + 1,
      tier: r.tier,
      withheld: Boolean(r.withheld),
      club: { key: r.club, show: club.show, bg: club.bg, fg: club.fg, edge: club.edge, qid: club.qid },
      cards: out,
      imposter: r.cards.indexOf(r.imp),
      real: { key: r.real, show: real.show, bg: real.bg, fg: real.fg, edge: real.edge },
    });
  }

  if (problems.length) {
    console.error(`\n✗ IMPOSTER GATE FAILED — ${problems.length} disagreement(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const facts = {
    _doc: "Generated by lab/imposter-facts.mjs — double-gated (football_career_paths.json + Wikidata P54). Do not edit; re-run the script.",
    sources: ["app/convex/data/football_career_paths.json", "wikidata P54 (lab/imposter-wikidata-cache.json)"],
    rounds,
  };
  if (CHECK) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.rounds) !== JSON.stringify(rounds)) {
      console.error("✗ --check: facts.json drifted from the gate — re-run without --check");
      process.exit(1);
    }
    console.log(`\n✓ IMPOSTER GATE PASSED (offline) — 6 rounds, 24 players, both sources agree.`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  console.log(`\n✓ IMPOSTER GATE PASSED — 6 rounds, 24 players, both sources agree.\n→ ${OUT}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
