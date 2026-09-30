// THE XI — fact gate. Eleven names on a pitch, one club they all played for.
// Two claims are on screen and BOTH are triple-sourced (lab/tests-wiki.mjs):
//
//   1. each of the eleven played for CLUB (senior team, loans count):
//      football_career_paths.json AND Wikidata P54 (senior QID, non-deprecated)
//      AND the English Wikipedia infobox senior clubs (link target resolved to
//      the club's QID) — all three must agree.
//   2. "one club connects them": CLUB is the ONLY club shared by all eleven —
//      proven separately in each source (career data club names, Wikidata P54
//      team QIDs, Wikipedia infobox club QIDs). If any source finds a second
//      shared club, the reel would be lying and the gate fails.
//
// The formation slot is editorial, but the slot's position class must agree
// with THE DRAW card / metadata AND Wikidata P413 (wide-role tolerance).
//
//   node lab/xi-facts.mjs           # resolve what is missing, gate, write
//   node lab/xi-facts.mjs --check   # offline: gate from cache, assert facts.json
//
// 2026-09-25 edition: recast from Inter (overlapped a posted Imposter round:
// Roberto Carlos, Pirlo, Seedorf) to CHELSEA — none of the eleven sat in a
// Chelsea round of any Imposter edition.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK, CLUBS, DATA, POS_RE, WD, assertClubs, cardOf, dataClubs, fmtWd, gateReport, isFootballer, resolveInfobox, resolvePlayer, wdSenior, wpSenior } from "./tests-wiki.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "src", "lab", "xi", "facts.json");
const meta = JSON.parse(readFileSync(path.join(DATA, "football_player_metadata.json"), "utf8"));

export const CLUB_KEY = "chelsea";
export const CLUB_SHOW = "CHELSEA";
// reveal order = the order the plates land: the connections people FORGET
// first, the one-club giveaway last. slot = formation position key (4-3-3).
export const XI = [
  { name: "Ruud Gullit", show: "GULLIT", slot: "CM2" },
  { name: "Pierre-Emerick Aubameyang", show: "AUBAMEYANG", slot: "ST" },
  { name: "Samuel Eto'o", show: "ETO'O", slot: "LW" },
  { name: "Filipe Luís", show: "FILIPE LUÍS", slot: "LB" },
  { name: "Mohamed Salah", show: "SALAH", slot: "RW" },
  { name: "Juan Cuadrado", show: "CUADRADO", slot: "RB" },
  { name: "Michael Ballack", show: "BALLACK", slot: "CM1" },
  { name: "Thiago Silva", show: "THIAGO SILVA", slot: "CB1" },
  { name: "Thibaut Courtois", show: "COURTOIS", slot: "GK" },
  { name: "N'Golo Kanté", show: "KANTÉ", slot: "CM3" },
  { name: "John Terry", show: "TERRY", slot: "CB2" },
];
const SEARCH = {};
const SLOT_POS = { GK: "GK", LB: "DEF", CB1: "DEF", CB2: "DEF", RB: "DEF", CM1: "MID", CM2: "MID", CM3: "MID", LW: "ATT", ST: "ATT", RW: "ATT" };
const META_POS = { Goalkeeper: "GK", Defender: "DEF", Midfield: "MID", Attack: "ATT" };

const main = async () => {
  const problems = [];
  const fail = (m) => problems.push(m);
  const club = CLUBS[CLUB_KEY];
  if (XI.length !== 11) fail("eleven names");
  if (new Set(XI.map((x) => x.slot)).size !== 11) fail("eleven distinct slots");
  if (new Set(XI.map((x) => x.name)).size !== 11) fail("eleven distinct players");
  problems.push(...(await assertClubs([CLUB_KEY])));

  const sets = { data: [], wd: [], wp: [] };
  const rows = [];
  for (const [i, x] of XI.entries()) {
    const P = await resolvePlayer(x.name, SEARCH[x.name]);
    const IB = await resolveInfobox(P);
    if (!isFootballer(P)) fail(`${x.name}: Wikidata ${P.qid} is "${P.description}", not a footballer`);
    const dc = dataClubs(x.name);
    if (!dc) {
      fail(`${x.name}: not exactly one entry in football_career_paths.json`);
      continue;
    }
    const d = dc.filter((c) => c.name === club.data);
    const w = wdSenior(P, club);
    const wp = wpSenior(IB, club);
    if (!d.length) fail(`${x.name}: career data has no "${club.data}" (${dc.map((c) => c.name).join(", ")})`);
    if (!w.length) fail(`${x.name}: Wikidata ${P.qid} P54 lacks senior ${club.qid}`);
    if (!wp.length) fail(`${x.name}: Wikipedia "${IB.title}" infobox lists no senior ${club.show}`);
    console.log(`${String(i + 1).padStart(2)} ${d.length && w.length && wp.length ? "✓" : "✗"} ${x.name.padEnd(26)} data: ${d.map((c) => c.name + (c.loan ? " (loan)" : "")).join(", ") || "—"}  |  wikidata ${P.qid}: ${w.map(fmtWd).join("; ") || "—"}  |  wikipedia: ${wp.map((c) => `${c.years} ${c.target}${c.loan ? " (loan)" : ""}`).join("; ") || "—"}`);

    sets.data.push(new Set(dc.map((c) => c.name)));
    sets.wd.push(new Set(P.p54.filter((t) => String(t.rank).toLowerCase() !== "deprecated").map((t) => t.qid)));
    sets.wp.push(new Set(IB.clubs.map((c) => c.qid ?? `unresolved:${c.target}`)));
    if (IB.clubs.some((c) => !c.qid)) console.log(`     · note: unresolved infobox club link(s): ${IB.clubs.filter((c) => !c.qid).map((c) => c.raw).join("; ")}`);

    // position class: DRAW card / metadata AND Wikidata P413
    const want = SLOT_POS[x.slot];
    const card = cardOf.get(x.name);
    const m = meta[x.name];
    const have = card?.position ?? (m ? META_POS[m.position] : undefined);
    if (!have) fail(`${x.name}: no position source (no DRAW card, no metadata)`);
    else if (have !== want) fail(`${x.name}: DRAW/metadata position ${have} but slot ${x.slot} wants ${want}`);
    if (!P.positions.some((l) => POS_RE[want].test(l))) fail(`${x.name}: slot ${x.slot} (${want}) not supported by Wikidata P413 ${JSON.stringify(P.positions)}`);
    rows.push({ i, name: x.name, show: x.show, slot: x.slot, position: want, qid: P.qid, wikipedia: IB.ref, positionSources: [card ? "drawCardsReal" : "football_player_metadata", `wikidata P413 ${JSON.stringify(P.positions)}`] });
  }

  // uniqueness, source by source
  const inter = (arr) => arr.reduce((a, s) => new Set([...a].filter((v) => s.has(v))));
  if (sets.data.length === 11) {
    const cData = inter(sets.data);
    const cWd = inter(sets.wd);
    const cWp = inter(sets.wp);
    const lbl = (q) => `${q} (${WD.clubs[q] ?? Object.values(WD.players).flatMap((p) => p.p54).find((t) => t.qid === q)?.label ?? "?"})`;
    console.log(`\nshared by all eleven — career data: [${[...cData].join(", ")}] · Wikidata P54: [${[...cWd].map(lbl).join(", ")}] · Wikipedia infobox: [${[...cWp].map(lbl).join(", ")}]`);
    if (cData.size !== 1 || !cData.has(club.data)) fail(`career data: connecting club not unique/right: ${[...cData].join(", ")}`);
    if (cWd.size !== 1 || !cWd.has(club.qid)) fail(`Wikidata P54: connecting club not unique/right: ${[...cWd].map(lbl).join(", ")}`);
    if (cWp.size !== 1 || !cWp.has(club.qid)) fail(`Wikipedia infobox: connecting club not unique/right: ${[...cWp].map(lbl).join(", ")}`);
  }

  gateReport("THE XI", problems);
  const facts = {
    _doc: "Generated by lab/xi-facts.mjs — triple-gated (football_career_paths.json + Wikidata P54 + Wikipedia infobox), membership AND uniqueness. Do not edit; re-run the script.",
    edition: "chelsea-2026-09-25",
    club: club.data,
    clubShow: CLUB_SHOW,
    clubQid: club.qid,
    sources: ["app/convex/data/football_career_paths.json", "wikidata P54 (lab/tests-wikidata-cache.json)", "en.wikipedia infobox clubs (lab/tests-wikipedia-cache.json)"],
    xi: rows,
  };
  if (CHECK) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.xi) !== JSON.stringify(rows) || cur.club !== facts.club) {
      console.error("✗ --check: facts.json drifted from the gate — re-run without --check");
      process.exit(1);
    }
    console.log(`\n✓ THE XI GATE PASSED (offline) — 11 players at ${CLUB_SHOW}, and ${CLUB_SHOW} is the only club all eleven share in all three sources.`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  console.log(`\n✓ THE XI GATE PASSED — 11 players at ${CLUB_SHOW}, and ${CLUB_SHOW} is the only club all eleven share in all three sources.\n→ ${OUT}`);
};
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
