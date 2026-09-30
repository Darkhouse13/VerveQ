// XI DEBATE — fact gate. "Arsenal 2003–04 (the Invincibles) vs Man City
// 2022–23 (the treble): combined XI — who gets in?" Eleven slots, two names
// each. The PICK is the viewer's (opinion, never answered on screen); every
// NAME and both team LABELS are facts, sourced at least twice
// (lab/tests-wiki.mjs), failing loudly on any disagreement:
//
//   each name was in that team that season:
//     A. the English Wikipedia SEASON article's squad/statistics table links
//        the player (link target → Wikidata QID; namesake-proof)
//     B. Wikidata P54 has a dated spell at the club (P580/P582) covering the
//        season
//     C. the player's own Wikipedia infobox years at the club cover it
//     (+ football_career_paths.json lists the club, where the player exists)
//   the slot's position class agrees with the season table's GK/DF/MF/FW
//   AND Wikidata P413.
//   "THE INVINCIBLES 2003–04": the app's own question bank (fbq2_0002) AND the
//     Wikipedia season article's league table (0 defeats) AND Wikidata P1346
//     (Arsenal won the 2003–04 Premier League).
//   "THE TREBLE 2022–23": the app's question bank (Guardiola/City 2023 treble)
//     AND Wikidata P1346 winner = Man City for the 2022–23 Premier League,
//     FA Cup and Champions League AND the season article's "treble".
//
//   node lab/xidebate-facts.mjs           # resolve what is missing, gate, write
//   node lab/xidebate-facts.mjs --check   # offline: gate from cache, assert facts.json
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK, CLUBS, POS_RE, WD, assertClubs, dataClubs, fmtWd, gateReport, getJson, isFootballer, resolveInfobox, resolvePlayer, resolveSeason, span, wdSenior, wpSenior } from "./tests-wiki.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "src", "lab", "xidebate", "facts.json");
const BANK = path.join(dir, "..", "..", "..", "app", "convex", "footballTriviaExpansionV1.ts");
const TROPHY_CACHE = path.join(dir, "tests-trophy-cache.json");

export const TEAMS = {
  a: {
    club: "arsenal",
    season: "2003–04",
    from: 2003,
    to: 2004,
    label: "THE INVINCIBLES",
    article: "2003–04 Arsenal F.C. season",
    section: "==Player statistics==",
    // |GK \n |{{Flag|GER}} \n !scope="row"|[[Jens Lehmann]]
    // league results by round (sports rbr table, "Result" row): W/D/L per round
    extract: (w) => {
      const m = w.slice(w.indexOf("====Results by round====")).match(/\|\s*label2\s*=\s*Result\s*\n\|\s*res2\s*=\s*([WDL/]+)/);
      if (!m) return null;
      const r = m[1].split("/");
      return { rounds: r.length, won: r.filter((x) => x === "W").length, drawn: r.filter((x) => x === "D").length, lost: r.filter((x) => x === "L").length };
    },
    rowRe: /\|\s*(?<pos>GK|DF|MF|FW)\s*\n[^\n]*\n\s*!\s*scope="row"\s*\|\s*\[\[(?<target>[^\]|#]+)/g,
  },
  b: {
    club: "mancity",
    season: "2022–23",
    from: 2022,
    to: 2023,
    label: "THE TREBLE",
    article: "2022–23 Manchester City F.C. season",
    section: "==First-team squad==",
    // | [[Ederson (footballer, born 1993)|Ederson]] \n | {{Flagicon|BRA}} \n | [[…|GK]]
    extract: (w) => ({ trebleSection: /====\s*The treble\s*====/.test(w), trebleText: (w.match(/====\s*The treble\s*====([\s\S]{0,4000})/)?.[1] ?? "").replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "").slice(0, 1500) }),
    rowRe: /\n\|\s*\[\[(?<target>[^\]|#]+)[^\n]*\n\|\s*\{\{[Ff]lagicon[^\n]*\n\|\s*(?<pos>[^\n]*)/g,
  },
};
// 4-4-2, attack at the top. cls = the position class the slot claims.
export const SLOTS = [
  { slot: "ST_L", cls: ["MF", "FW"], a: ["Dennis Bergkamp", "BERGKAMP"], b: ["Kevin De Bruyne", "DE BRUYNE"] },
  { slot: "ST_R", cls: ["FW"], a: ["Thierry Henry", "HENRY"], b: ["Erling Haaland", "HAALAND"] },
  { slot: "LM", cls: ["MF", "FW"], a: ["Robert Pires", "PIRES"], b: ["Jack Grealish", "GREALISH"] },
  { slot: "CM_L", cls: ["MF"], a: ["Gilberto Silva", "GILBERTO"], b: ["İlkay Gündoğan", "GÜNDOĞAN"] },
  { slot: "CM_R", cls: ["MF"], a: ["Patrick Vieira", "VIEIRA"], b: ["Rodri", "RODRI"] },
  { slot: "RM", cls: ["MF", "FW"], a: ["Freddie Ljungberg", "LJUNGBERG"], b: ["Bernardo Silva", "BERNARDO"] },
  { slot: "LB", cls: ["DF"], a: ["Ashley Cole", "ASHLEY COLE"], b: ["Nathan Aké", "AKÉ"] },
  { slot: "CB_L", cls: ["DF"], a: ["Kolo Touré", "KOLO TOURÉ"], b: ["John Stones", "STONES"] },
  { slot: "CB_R", cls: ["DF"], a: ["Sol Campbell", "CAMPBELL"], b: ["Rúben Dias", "DIAS"] },
  { slot: "RB", cls: ["DF"], a: ["Lauren", "LAUREN"], b: ["Kyle Walker", "WALKER"] },
  { slot: "GK", cls: ["GK"], a: ["Jens Lehmann", "LEHMANN"], b: ["Ederson", "EDERSON"] },
];
const SEARCH = {
  Lauren: { search: "Lauren Etame Mayer" },
  Rodri: { search: "Rodrigo Hernández Cascante" },
  Ederson: { search: "Ederson Santana de Moraes" },
};
const DATA_NAME = { "Robert Pires": "Robert Pirès" };
const CLASS_RE = { GK: POS_RE.GK, DF: POS_RE.DEF, MF: POS_RE.MID, FW: POS_RE.ATT };
// "[[Right back (association football)|RB]] / [[Centre-back|CB]]" → DF
const posClass = (raw) => {
  if (/^(GK|DF|MF|FW)$/.test(raw.trim())) return [raw.trim()];
  const codes = [...raw.matchAll(/\|([A-Z]{2,3})\]\]/g)].map((m) => m[1]);
  const map = { GK: "GK", CB: "DF", RB: "DF", LB: "DF", RWB: "DF", LWB: "DF", DM: "MF", CM: "MF", AM: "MF", LM: "MF", RM: "MF", LW: "FW", RW: "FW", CF: "FW", ST: "FW", SS: "FW" };
  return [...new Set(codes.map((c) => map[c]).filter(Boolean))];
};

// Wikidata P1346 (winner) of a competition-season item, by exact label
const trophyWinner = async (label, cache) => {
  if (cache[label]) return cache[label];
  const q = `SELECT ?item ?w ?wLabel WHERE { ?item rdfs:label "${label}"@en ; wdt:P1346 ?w . SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`;
  const j = await getJson(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: "json" })}`);
  cache[label] = j.results.bindings.map((b) => ({ item: b.item.value.split("/").pop(), winner: b.w.value.split("/").pop(), label: b.wLabel?.value }));
  if (!CHECK) writeFileSync(TROPHY_CACHE, JSON.stringify(cache, null, 1));
  return cache[label];
};

const main = async () => {
  const problems = [];
  const fail = (m) => problems.push(m);
  problems.push(...(await assertClubs(["arsenal", "mancity"])));
  const all = SLOTS.flatMap((s) => [s.a[0], s.b[0]]);
  if (SLOTS.length !== 11 || new Set(SLOTS.map((s) => s.slot)).size !== 11) fail("eleven distinct slots");
  if (new Set(all).size !== 22) fail("22 distinct players");

  // ── team labels ──
  const bank = readFileSync(BANK, "utf8");
  const trophies = existsSync(TROPHY_CACHE) ? JSON.parse(readFileSync(TROPHY_CACHE, "utf8")) : {};
  const seasons = {};
  for (const [k, T] of Object.entries(TEAMS)) seasons[k] = await resolveSeason(T.article, T.section, T.rowRe, T.extract);
  // Invincibles
  if (!/"checksum": "fbq2_0002"/.test(bank) || !/Invincibles'? to an unbeaten league season in 2003-04/.test(bank)) fail("question bank: fbq2_0002 (Invincibles 2003-04 unbeaten) not found");
  const lg = seasons.a.extra;
  const arsWiki = !lg ? { ok: false, why: "no results-by-round row" } : lg.rounds === 38 && lg.lost === 0 ? { ok: true, why: `results by round: ${lg.rounds} league games, W${lg.won} D${lg.drawn} L${lg.lost}` } : { ok: false, why: `results by round: ${lg.rounds} games, ${lg.lost} defeats` };
  if (!arsWiki.ok) fail(`Wikipedia "${TEAMS.a.article}": ${arsWiki.why}`);
  const pl04 = await trophyWinner("2003–04 FA Premier League", trophies);
  if (!pl04.some((r) => r.winner === CLUBS.arsenal.qid)) fail(`Wikidata: 2003–04 FA Premier League winner is not Arsenal (${JSON.stringify(pl04)})`);
  console.log(`THE INVINCIBLES 2003–04 · bank fbq2_0002 ✓ · wikipedia ${arsWiki.why} · wikidata P1346 2003–04 FA Premier League → ${pl04.map((r) => r.label).join(", ")}`);
  // Treble
  if (!/Guardiola won the treble with Barcelona in 2009 and again with Manchester City in 2023 \(Premier League, FA Cup, Champions League\)/.test(bank)) fail("question bank: the City 2023 treble line not found");
  const cityWiki = Boolean(seasons.b.extra?.trebleSection) && /Champions League/i.test(seasons.b.extra.trebleText) && /FA Cup/i.test(seasons.b.extra.trebleText);
  for (const label of ["2022–23 Premier League", "2022–23 FA Cup", "2022–23 UEFA Champions League"]) {
    const w = await trophyWinner(label, trophies);
    if (!w.some((r) => r.winner === CLUBS.mancity.qid)) fail(`Wikidata: ${label} winner is not Manchester City (${JSON.stringify(w)})`);
    console.log(`THE TREBLE 2022–23 · wikidata P1346 ${label} → ${w.map((r) => r.label).join(", ") || "—"}`);
  }
  if (!cityWiki) fail(`Wikipedia "${TEAMS.b.article}": no "treble" section`);
  console.log(`THE TREBLE 2022–23 · bank (Guardiola/City 2023) ✓ · wikipedia season article section "The treble" ${cityWiki ? "✓" : "✗"}`);

  // ── the 22 names ──
  const out = [];
  for (const s of SLOTS) {
    const row = { slot: s.slot };
    for (const side of ["a", "b"]) {
      const T = TEAMS[side];
      const club = CLUBS[T.club];
      const [name, show] = s[side];
      const P = await resolvePlayer(name, SEARCH[name]);
      const IB = await resolveInfobox(P);
      if (!isFootballer(P)) fail(`${name}: Wikidata ${P.qid} is "${P.description}"`);
      // A — season article
      const sr = seasons[side].rows.filter((r) => r.qid === P.qid);
      if (!sr.length) fail(`${name}: not in "${T.article}" ${T.section} (as ${P.qid})`);
      // B — Wikidata dated spell
      const w = wdSenior(P, club);
      const wCover = w.filter((t) => t.start && Number(t.start) <= T.from && (t.end === null || Number(t.end) >= T.to));
      if (!wCover.length) fail(`${name}: no Wikidata P54 ${club.show} spell covering ${T.season} (${w.map(fmtWd).join("; ") || "none"})`);
      // C — own infobox years
      const wp = wpSenior(IB, club);
      const pCover = wp.filter((c) => {
        const sp = span(c.years);
        return sp && sp.from <= T.from && sp.to >= T.to;
      });
      if (!pCover.length) fail(`${name}: Wikipedia infobox ${club.show} years ${wp.map((c) => c.years).join(", ") || "none"} do not cover ${T.season}`);
      // + career data where present
      const dc = dataClubs(DATA_NAME[name] ?? name);
      const d = dc ? dc.some((c) => c.name === club.data) : null;
      if (d === false) fail(`${name}: career data exists but lacks ${club.data}`);
      // position class
      const cls = [...new Set(sr.flatMap((r) => posClass(r.pos ?? "")))];
      if (!cls.some((c) => s.cls.includes(c))) fail(`${name}: slot ${s.slot} wants ${s.cls}, season table says ${JSON.stringify(cls)} ("${sr[0]?.pos}")`);
      if (!P.positions.some((l) => s.cls.some((c) => CLASS_RE[c].test(l)))) fail(`${name}: slot ${s.slot} (${s.cls}) not supported by Wikidata P413 ${JSON.stringify(P.positions)}`);
      console.log(
        `${s.slot.padEnd(5)} ${side === "a" ? "ARS" : "MCI"} ${name.padEnd(18)} season-article ${sr.length ? `✓ ${sr[0].target} [${cls}]` : "✗"} · wikidata ${wCover.map(fmtWd).join("; ") || "✗"} · infobox ${pCover.map((c) => c.years).join("; ") || "✗"} · career data ${d === null ? "n/a" : d ? "✓" : "✗"} · P413 ${JSON.stringify(P.positions)}`,
      );
      row[side] = { name, show, qid: P.qid, wikipedia: IB.ref, sources: ["wikipedia season article", "wikidata P54 dated", "wikipedia infobox years", ...(d ? ["football_career_paths.json"] : [])] };
    }
    out.push(row);
  }
  gateReport("XI DEBATE", problems);
  const facts = {
    _doc: "Generated by lab/xidebate-facts.mjs — every name double/triple-sourced (Wikipedia season article + Wikidata dated P54 + Wikipedia infobox years [+ career paths]); team labels from the app question bank + Wikidata P1346 + Wikipedia. The pick is the viewer's. Do not edit; re-run the script.",
    teams: Object.fromEntries(Object.entries(TEAMS).map(([k, T]) => [k, { club: CLUBS[T.club].show, season: T.season, label: T.label, bg: CLUBS[T.club].bg, fg: CLUBS[T.club].fg, article: seasons[k].ref, revid: seasons[k].revid }])),
    slots: out,
  };
  if (CHECK) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.slots) !== JSON.stringify(out) || JSON.stringify(cur.teams) !== JSON.stringify(facts.teams)) {
      console.error("✗ --check: facts.json drifted from the gate — re-run without --check");
      process.exit(1);
    }
    console.log("\n✓ XI DEBATE GATE PASSED (offline) — 22 names, both team labels, all multi-sourced.");
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  console.log(`\n✓ XI DEBATE GATE PASSED — 22 names, both team labels, all multi-sourced.\n→ ${OUT}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
