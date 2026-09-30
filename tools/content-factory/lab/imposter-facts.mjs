// SPOT THE IMPOSTER — triple fact gate. Six rounds, each "3 of them played
// for CLUB, who didn't?". A round is valid ONLY if three independent sources
// agree:
//
//   1. app/convex/data/football_career_paths.json (the app's own career data;
//      clubs are strings or {name, loan} — loans count as "played for")
//   2. Wikidata P54 (member of sports team), resolved once per player into
//      lab/imposter-wikidata-cache.json
//   3. English Wikipedia's infobox senior-club list (clubsN = …), reached
//      through the player's Wikidata enwiki sitelink so the article can never
//      be a namesake; cached in lab/imposter-wikipedia-cache.json. Added
//      2026-09-25 after the owner asked for every name to be re-verified.
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
//   node lab/imposter-facts.mjs --edition e2 [--check]
//        rounds, display names and overrides from lab/editions/imposter-e2.json
//        (no --edition = edition 1, the rounds below)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { infoboxParams } from "./tests-wiki.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const CACHE = path.join(dir, "imposter-wikidata-cache.json");
const WP_CACHE = path.join(dir, "imposter-wikipedia-cache.json");
const OUT = path.join(dir, "..", "src", "lab", "imposter", "facts.json");
const UA = "VerveQ-content-factory/1.0 (https://verveq.com; imposter reel fact gate; contact via verveq.com)";
const CHECK = process.argv.includes("--check");
const EDITION = process.argv.includes("--edition") ? process.argv[process.argv.indexOf("--edition") + 1] : "e1";
const ED = EDITION === "e1" ? null : JSON.parse(readFileSync(path.join(dir, "editions", `imposter-${EDITION}.json`), "utf8"));

// ── clubs ────────────────────────────────────────────────────────────────
// qid = senior team; label = what Wikidata must call that QID (asserted);
// wp = the senior team's Wikipedia link target, closed by | or ]] so
// "Barcelona B" / "Real Madrid Castilla" can never count as the first team;
// data = the exact name on career paths; re = any-level match (youth/B/reserves)
export const CLUBS = {
  chelsea: { qid: "Q9616", label: /^Chelsea/i, data: "Chelsea", re: /chelsea/i, show: "CHELSEA", bg: "#034694", fg: "#FFFFFF", edge: "#FFFFFF", wp: /^\[\[Chelsea F\.?C\.?(\||\]\])/ },
  barcelona: { qid: "Q7156", label: /Barcelona/i, data: "Barcelona", re: /barcelona|barça/i, show: "BARCELONA", bg: "#A50044", fg: "#FFFFFF", edge: "#004D98", wp: /^\[\[(FC |F\.C\. )?Barcelona(\||\]\])/ },
  realmadrid: { qid: "Q8682", label: /Real Madrid/i, data: "Real Madrid", re: /real madrid/i, show: "REAL MADRID", bg: "#FFFFFF", fg: "#00529F", edge: "#FEBE10", wp: /^\[\[Real Madrid( CF| C\.F\.| Club de Fútbol)?(\||\]\])/ },
  juventus: { qid: "Q1422", label: /Juventus/i, data: "Juventus", re: /juventus/i, show: "JUVENTUS", bg: "#000000", fg: "#FFFFFF", edge: "#FFFFFF", wp: /^\[\[Juventus( FC| F\.C\.)?(\||\]\])/ },
  manutd: { qid: "Q18656", label: /Manchester United/i, data: "Manchester United", re: /manchester united|man\.? ?utd/i, show: "MANCHESTER UNITED", bg: "#DA291C", fg: "#FFFFFF", edge: "#FBE122", wp: /^\[\[Manchester United( F\.?C\.?)?(\||\]\])/ },
  inter: { qid: "Q631", label: /Inter/i, data: "Inter Milan", re: /internazionale|inter milan|^inter$|^f\.?c\.? inter/i, show: "INTER", bg: "#010E80", fg: "#FFFFFF", edge: "#000000", wp: /^\[\[(Inter Milan|F\.?C\.? Internazionale( Milano)?|Internazionale)(\||\]\])/ },
  liverpool: { qid: "Q1130849", label: /^Liverpool/i, data: "Liverpool", re: /^liverpool/i, show: "LIVERPOOL", bg: "#C8102E", fg: "#FFFFFF", edge: "#F6EB61", wp: /^\[\[Liverpool F\.?C\.?(\||\]\])/ },
  arsenal: { qid: "Q9617", label: /^Arsenal/i, data: "Arsenal", re: /^arsenal/i, show: "ARSENAL", bg: "#EF0107", fg: "#FFFFFF", edge: "#FFFFFF", wp: /^\[\[Arsenal F\.?C\.?(\||\]\])/ },
  bayern: { qid: "Q15789", label: /Bayern/i, data: "Bayern Munich", re: /bayern/i, show: "BAYERN MUNICH", bg: "#DC052D", fg: "#FFFFFF", edge: "#0066B2", wp: /^\[\[(FC )?Bayern Munich(\||\]\])/ },
  psg: { qid: "Q483020", label: /Paris Saint-Germain/i, data: "Paris Saint-Germain", re: /paris saint|paris sg|\bpsg\b/i, show: "PSG", bg: "#004170", fg: "#FFFFFF", edge: "#DA291C", wp: /^\[\[Paris Saint-Germain( F\.?C\.?)?(\||\]\])/ },
  mancity: { qid: "Q50602", label: /Manchester City/i, data: "Manchester City", re: /manchester city|man\.? city/i, show: "MAN CITY", bg: "#6CABDD", fg: "#1C2C5B", edge: "#FFFFFF", wp: /^\[\[Manchester City( F\.?C\.?)?(\||\]\])/ },
  tottenham: { qid: "Q18741", label: /Tottenham/i, data: "Tottenham Hotspur", re: /tottenham|spurs/i, show: "TOTTENHAM", bg: "#FFFFFF", fg: "#132257", edge: "#132257", wp: /^\[\[Tottenham Hotspur( F\.?C\.?)?(\||\]\])/ },
  atletico: { qid: "Q8701", label: /Atl[ée]tico/i, data: "Atlético Madrid", re: /atl[ée]tico (de )?madrid/i, show: "ATLÉTICO MADRID", bg: "#CB3524", fg: "#FFFFFF", edge: "#272E61", wp: /^\[\[Atl[ée]tico Madrid(\||\]\])/ },
  dortmund: { qid: "Q41420", label: /Dortmund/i, data: "Borussia Dortmund", re: /dortmund/i, show: "DORTMUND", bg: "#FDE100", fg: "#000000", edge: "#000000", wp: /^\[\[Borussia Dortmund(\||\]\])/ },
  ajax: { qid: "Q81888", label: /Ajax/i, data: "Ajax", re: /ajax/i, show: "AJAX", bg: "#FFFFFF", fg: "#D2122E", edge: "#D2122E", wp: /^\[\[AFC Ajax(\||\]\])/ },
  milan: { qid: "Q1543", label: /Milan/i, data: "AC Milan", re: /a\.?c\.? milan/i, show: "AC MILAN", bg: "#FB090B", fg: "#FFFFFF", edge: "#000000", wp: /^\[\[A\.?C\.? Milan(\||\]\])/ },
};

// ── the edition ──────────────────────────────────────────────────────────
// cards = grid order (TL, TR, BL, BR). `imp` = the imposter; `real` = the
// club stamped on his flipped card. Round 6 is withheld on screen.
const ROUNDS_E1 = [
  { tier: "EASY", club: "chelsea", cards: ["Didier Drogba", "Steven Gerrard", "Eden Hazard", "Frank Lampard"], imp: "Steven Gerrard", real: "liverpool" },
  { tier: "EASY", club: "barcelona", cards: ["Zinedine Zidane", "Ronaldinho", "Luis Suárez", "Neymar"], imp: "Zinedine Zidane", real: "realmadrid" },
  { tier: "MEDIUM", club: "realmadrid", cards: ["Arjen Robben", "Michael Owen", "Wesley Sneijder", "Robin van Persie"], imp: "Robin van Persie", real: "arsenal" },
  { tier: "HARD", club: "juventus", cards: ["Thierry Henry", "Andriy Shevchenko", "Patrick Vieira", "Zlatan Ibrahimović"], imp: "Andriy Shevchenko", real: "milan" },
  { tier: "HARD", club: "manutd", cards: ["Radamel Falcao", "Ángel Di María", "Gonzalo Higuaín", "Henrik Larsson"], imp: "Gonzalo Higuaín", real: "juventus" },
  { tier: "IMPOSSIBLE", club: "inter", cards: ["Patrick Kluivert", "Roberto Carlos", "Andrea Pirlo", "Edgar Davids"], imp: "Patrick Kluivert", real: "barcelona", withheld: true },
];
export const ROUNDS = ED ? ED.rounds : ROUNDS_E1;
const TIERS = ["EASY", "EASY", "MEDIUM", "HARD", "HARD", "IMPOSSIBLE"];

// display: first-name line (small) + surname (big). Nation/position come from
// THE DRAW cards where present, else DISPLAY_FALLBACK — and both are then
// cross-checked against Wikidata below.
const SHOW_E1 = {
  "Didier Drogba": ["Didier", "DROGBA"], "Steven Gerrard": ["Steven", "GERRARD"], "Eden Hazard": ["Eden", "HAZARD"], "Frank Lampard": ["Frank", "LAMPARD"],
  "Zinedine Zidane": ["Zinedine", "ZIDANE"], Ronaldinho: ["", "RONALDINHO"], "Luis Suárez": ["Luis", "SUÁREZ"], Neymar: ["", "NEYMAR"],
  "Arjen Robben": ["Arjen", "ROBBEN"], "Michael Owen": ["Michael", "OWEN"], "Wesley Sneijder": ["Wesley", "SNEIJDER"], "Robin van Persie": ["Robin", "VAN PERSIE"],
  "Thierry Henry": ["Thierry", "HENRY"], "Andriy Shevchenko": ["Andriy", "SHEVCHENKO"], "Patrick Vieira": ["Patrick", "VIEIRA"], "Zlatan Ibrahimović": ["Zlatan", "IBRAHIMOVIĆ"],
  "Radamel Falcao": ["Radamel", "FALCAO"], "Ángel Di María": ["Ángel", "DI MARÍA"], "Gonzalo Higuaín": ["Gonzalo", "HIGUAÍN"], "Henrik Larsson": ["Henrik", "LARSSON"],
  "Patrick Kluivert": ["Patrick", "KLUIVERT"], "Roberto Carlos": ["", "ROBERTO CARLOS"], "Andrea Pirlo": ["Andrea", "PIRLO"], "Edgar Davids": ["Edgar", "DAVIDS"],
};
const SHOW = ED ? ED.show : SHOW_E1;
const DISPLAY_FALLBACK = { "Henrik Larsson": { nation: "Sweden", position: "ATT" }, "Patrick Kluivert": { nation: "Netherlands", position: "ATT" }, ...(ED?.display ?? {}) };
// Wikidata search overrides where the plain name search is ambiguous
const SEARCH = { "Roberto Carlos": "Roberto Carlos da Silva", ...(ED?.search ?? {}) };
export const FLAG = {
  "Ivory Coast": "🇨🇮", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Belgium: "🇧🇪", France: "🇫🇷", Brazil: "🇧🇷", Uruguay: "🇺🇾", Netherlands: "🇳🇱",
  Sweden: "🇸🇪", Ukraine: "🇺🇦", Colombia: "🇨🇴", Argentina: "🇦🇷", Italy: "🇮🇹",
  Egypt: "🇪🇬", Spain: "🇪🇸", Portugal: "🇵🇹", Croatia: "🇭🇷", Chile: "🇨🇱", Germany: "🇩🇪", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", Ghana: "🇬🇭",
  Poland: "🇵🇱", Cameroon: "🇨🇲", Denmark: "🇩🇰", Togo: "🇹🇬", Bulgaria: "🇧🇬",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Japan: "🇯🇵", Norway: "🇳🇴", Serbia: "🇷🇸", "South Korea": "🇰🇷", "Czech Republic": "🇨🇿", Liberia: "🇱🇷", Hungary: "🇭🇺", Senegal: "🇸🇳", Algeria: "🇩🇿", Gabon: "🇬🇦", "Costa Rica": "🇨🇷", Switzerland: "🇨🇭", Morocco: "🇲🇦", Russia: "🇷🇺", Turkey: "🇹🇷", "Bosnia and Herzegovina": "🇧🇦", Mexico: "🇲🇽", Nigeria: "🇳🇬", Austria: "🇦🇹", Romania: "🇷🇴", Ecuador: "🇪🇨", Australia: "🇦🇺", "Republic of Ireland": "🇮🇪", Greece: "🇬🇷", Slovakia: "🇸🇰", Slovenia: "🇸🇮", Peru: "🇵🇪", Paraguay: "🇵🇾", Finland: "🇫🇮", Georgia: "🇬🇪", Iran: "🇮🇷", "United States": "🇺🇸",
};
// how each nation may appear among a player's P27/P1532 labels
export const NATION_RE = { "Ivory Coast": /ivory coast|côte d'ivoire/i, England: /england|united kingdom/i, Wales: /wales|united kingdom/i, Scotland: /scotland|united kingdom/i, Netherlands: /netherlands/i,
  "South Korea": /korea/i, "Czech Republic": /czech/i, "Bosnia and Herzegovina": /bosnia/i, Turkey: /turkey|türkiye/i, Russia: /russia|soviet/i, "Republic of Ireland": /ireland/i, "United States": /united states/i };
export const POS = { ATT: { show: "FORWARD", re: /forward|striker|winger/i }, MID: { show: "MIDFIELDER", re: /midfield/i }, DEF: { show: "DEFENDER", re: /back|defender/i } };

// ── wikidata ─────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const getJson = async (url) => {
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
export const api = (params) => getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`);
const sparql = (q) => getJson(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: "json" })}`);

export const resolvePlayer = async (name) => {
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
      rank: b.rank.value.split("#").pop().replace("Rank", "").toLowerCase(),
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

// ── wikipedia (third source) ─────────────────────────────────────────────
// Senior clubs from the infobox: every `| clubsN = …` line, paired with its
// `| yearsN =`. Youth/B/reserve sides live under youthclubsN and never match.
export const resolveWikipedia = async (qid) => {
  const e = await api({ action: "wbgetentities", ids: qid, props: "sitelinks", sitefilter: "enwiki" });
  const title = e.entities[qid]?.sitelinks?.enwiki?.title;
  if (!title) throw new Error(`wikipedia: ${qid} has no enwiki sitelink`);
  await sleep(1000);
  const u = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "parse", page: title, prop: "wikitext", section: "0", redirects: "1", format: "json" })}`;
  const j = await getJson(u);
  const w = j.parse?.wikitext?.["*"];
  if (!w) throw new Error(`wikipedia: no wikitext for "${title}"`);
  // top-level-pipe parser (lab/tests-wiki.mjs): handles infoboxes that put
  // several params on one line ("| years1 = … |clubs1 = …"), which a
  // line-anchored regex silently dropped (Shearer, Cantona, Romário…)
  const params = infoboxParams(w);
  const rows = Object.keys(params)
    .filter((k) => /^clubs\d+$/.test(k))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((k) => {
      const i = k.slice(5);
      return { years: params[`years${i}`] ?? null, club: params[k].replace(/^→\s*/, "").trim(), apps: ((v) => (Number.isNaN(v) ? null : v))(Number.parseInt(String(params[`caps${i}`] ?? "").replace(/[^\d]/g, "") === "" ? "x" : String(params[`caps${i}`]).match(/\d+/)[0], 10)) };
    });
  if (!rows.length) throw new Error(`wikipedia: "${title}" infobox has no clubsN params`);
  return { parser: 3, title, ref: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`, fetched: new Date().toISOString().slice(0, 10), clubs: rows };
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

  const wpCache = existsSync(WP_CACHE) ? JSON.parse(readFileSync(WP_CACHE, "utf8")) : {};
  for (const n of all) {
    if (wpCache[n]?.qid === cache.players[n].qid && wpCache[n].parser === 3) continue;
    if (CHECK) throw new Error(`--check: "${n}" not in the Wikipedia cache`);
    console.log(`wikipedia ${n} …`);
    wpCache[n] = { qid: cache.players[n].qid, ...(await resolveWikipedia(cache.players[n].qid)) };
    writeFileSync(WP_CACHE, JSON.stringify(wpCache, null, 1));
    await sleep(1500);
  }
  const wpSenior = (n, club) => wpCache[n].clubs.filter((c) => club.wp.test(c.club));

  const dataClubs = (n) => {
    const ps = paths.filter((p) => p.answerName === n);
    if (ps.length !== 1) {
      fail(`"${n}" has ${ps.length} entries in football_career_paths.json`);
      return [];
    }
    return ps[0].clubs.map((c) => ({ name: clubName(c), loan: typeof c === "object" && Boolean(c.loan) }));
  };
  // senior-team spells in Wikidata
  const wdSenior = (n, club) => cache.players[n].p54.filter((t) => t.qid === club.qid && String(t.rank).toLowerCase() !== "deprecated");
  // ANY-level contact with the club in Wikidata (any rank — conservative)
  const wdAnyLevel = (n, club) =>
    cache.players[n].p54.filter((t) => t.qid === club.qid || club.re.test(t.label ?? "") || t.parents.some((p) => p.qid === club.qid || club.re.test(p.label ?? "")));
  const span = (t) => `${t.label} [${t.qid}] ${t.start ?? "?"}–${t.end ?? "?"}${String(t.rank).toLowerCase() !== "normal" ? ` (${t.rank})` : ""}`;

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
      // namesake guard: the Wikidata person must share ≥2 senior clubs with our
      // career data (all of them if the path is shorter), or a wrong "Raúl"
      // could sail through as an imposter
      {
        const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(f\.?c\.?|a\.?f\.?c\.?|c\.?f\.?|s\.?c\.?|club de futbol|calcio|football club)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
        const wdNames = P.p54.map((t) => norm(t.label ?? ""));
        const uniq = [...new Set(dc.map((c) => norm(c.name)))];
        const shared = uniq.filter((c) => c && wdNames.some((w) => w.includes(c) || c.includes(w)));
        const need = Math.min(2, uniq.length);
        if (shared.length < need) fail(`${n}: Wikidata ${P.qid} shares ${shared.length} club(s) with the career data (need ${need}) — wrong person?`);
      }
      const isImp = n === r.imp;
      if (!isImp) {
        const d = dc.filter((c) => c.name === club.data);
        const w = wdSenior(n, club);
        const wp = wpSenior(n, club);
        const ok = d.length > 0 && w.length > 0 && wp.length > 0;
        if (d.length === 0) fail(`R${i + 1} ${n}: career data has no "${club.data}" (${dc.map((c) => c.name).join(", ")})`);
        if (w.length === 0) fail(`R${i + 1} ${n}: Wikidata ${P.qid} P54 lacks senior ${club.qid}`);
        if (wp.length === 0) fail(`R${i + 1} ${n}: Wikipedia "${wpCache[n].title}" infobox lists no senior ${club.show}`);
        // "played for" means played: a registered spell with 0 senior
        // appearances (Diogo Jota at Atlético, 2016–18, loaned out) is not one
        else if (wp.every((c) => c.apps === 0)) fail(`R${i + 1} ${n}: Wikipedia lists ${club.show} but with 0 appearances — never played`);
        console.log(`  ${ok ? "✓" : "✗"} GENUINE  ${n.padEnd(20)} data: ${d.map((c) => c.name + (c.loan ? " (loan)" : "")).join(", ") || "—"}  |  wikidata ${P.qid}: ${w.map(span).join("; ") || "—"}  |  wikipedia: ${wp.map((c) => `${c.years} ${c.club}`).join("; ") || "—"}`);
      } else {
        const d = dc.filter((c) => club.re.test(c.name));
        const w = wdAnyLevel(n, club);
        if (d.length) fail(`R${i + 1} imposter ${n}: career data HAS ${d.map((c) => c.name)}`);
        if (w.length) fail(`R${i + 1} imposter ${n}: Wikidata lists ${w.map(span).join("; ")}`);
        const wp = wpCache[n].clubs.filter((c) => club.re.test(c.club) || club.wp.test(c.club));
        if (wp.length) fail(`R${i + 1} imposter ${n}: Wikipedia lists ${wp.map((c) => `${c.years} ${c.club}`).join("; ")}`);
        const rwp = wpSenior(n, real);
        if (!rwp.length) fail(`R${i + 1} imposter ${n}: Wikipedia has no senior ${real.show} for the stamp`);
        const rd = dc.filter((c) => c.name === real.data);
        const rw = wdSenior(n, real);
        if (!rd.length || !rw.length) fail(`R${i + 1} imposter ${n}: stamped club ${real.show} not confirmed by both (data ${rd.length}, wikidata ${rw.length})`);
        console.log(`  ${!d.length && !w.length ? "✓" : "✗"} IMPOSTER ${n.padEnd(20)} data: no ${club.show} in [${dc.map((c) => c.name).join(", ")}]  |  wikidata ${P.qid}: no ${club.show} at any level among ${P.p54.length} P54 teams`);
        console.log(`             wikipedia "${wpCache[n].title}": no ${club.show} among ${wpCache[n].clubs.length} senior clubs`);
        console.log(`             stamp ${real.show}: data ${rd.length ? "✓" : "✗"} · wikidata ${rw.map(span).join("; ") || "✗"} · wikipedia ${rwp.map((c) => c.years).join(", ") || "✗"}`);
      }
      // display cross-checks
      const card = cardOf.get(n);
      // an edition's display entry wins over THE DRAW card (e.g. Rooney: the card
      // says MID, the world says striker) — and is still checked against Wikidata
      const disp = ED?.display?.[n] ?? (card ? { nation: card.nation, position: card.position } : DISPLAY_FALLBACK[n]);
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
    _doc: "Generated by lab/imposter-facts.mjs — triple-gated (football_career_paths.json + Wikidata P54 + Wikipedia infobox). Do not edit; re-run the script.",
    edition: EDITION,
    sources: ["app/convex/data/football_career_paths.json", "wikidata P54 (lab/imposter-wikidata-cache.json)", "en.wikipedia infobox clubs (lab/imposter-wikipedia-cache.json)"],
    rounds,
  };
  if (CHECK) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (cur.edition !== EDITION || JSON.stringify(cur.rounds) !== JSON.stringify(rounds)) {
      console.error("✗ --check: facts.json drifted from the gate — re-run without --check");
      process.exit(1);
    }
    console.log(`\n✓ IMPOSTER GATE PASSED (offline) — 6 rounds, 24 players, all three sources agree.`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  console.log(`\n✓ IMPOSTER GATE PASSED — 6 rounds, 24 players, all three sources agree.\n→ ${OUT}`);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
