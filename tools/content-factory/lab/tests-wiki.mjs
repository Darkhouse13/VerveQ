// Shared source layer for the 2026-09-25 concept tests (test-xi, test-guesswho,
// test-tierlist, test-xidebate). The owner's rule: every name and fact on
// screen is confirmed by at least TWO independent sources, and a gate fails
// loudly on any disagreement. The sources, in the lab/imposter-facts.mjs
// pattern:
//
//   1. app/convex/data/football_career_paths.json (clubs; loans count)
//   2. Wikidata P54 (member of sports team) + P27/P1532 + P413 + P580/P582
//   3. English Wikipedia, reached ONLY through the player's Wikidata enwiki
//      sitelink (never a name search — namesakes): the infobox `| clubsN =`
//      senior lines, each link target resolved to its Wikidata QID so
//      "Barcelona B" / "Real Madrid Castilla" are different clubs by identity,
//      not by spelling. Season articles (xidebate) are read the same way.
//
// Caches are this lane's own: lab/tests-wikidata-cache.json and
// lab/tests-wikipedia-cache.json. The imposter caches are read-only seeds.
// Polite: one request every 1.5s, backoff on 429/5xx, the house User-Agent.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
export const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const WD_CACHE = path.join(dir, "tests-wikidata-cache.json");
const WP_CACHE = path.join(dir, "tests-wikipedia-cache.json");
const SEED_WD = path.join(dir, "imposter-wikidata-cache.json");
export const UA = "VerveQ-content-factory/1.0 (https://verveq.com; fact gate)";
export const CHECK = process.argv.includes("--check");

// ── app data ─────────────────────────────────────────────────────────────
export const PATHS = JSON.parse(readFileSync(path.join(DATA, "football_career_paths.json"), "utf8"));
export const CARDS = JSON.parse(readFileSync(path.join(DATA, "drawCardsReal.candidates.json"), "utf8"));
const byName = new Map();
for (const p of PATHS) byName.set(p.answerName, [...(byName.get(p.answerName) ?? []), p]);
export const cardOf = new Map(CARDS.map((c) => [c.name, c]));
export const dataClubs = (name) => {
  const ps = byName.get(name) ?? [];
  if (ps.length !== 1) return null;
  return ps[0].clubs.map((c) => (typeof c === "string" ? { name: c, loan: false } : { name: c.name, loan: Boolean(c.loan) }));
};

// ── clubs ────────────────────────────────────────────────────────────────
// qid = senior team (its Wikidata label is asserted); data = the exact name
// on career paths; re = any-level spelling (youth/B/reserves) for NO answers.
export const CLUBS = {
  chelsea: { qid: "Q9616", label: /^Chelsea/i, data: "Chelsea", re: /chelsea/i, show: "CHELSEA", bg: "#034694", fg: "#FFFFFF" },
  barcelona: { qid: "Q7156", label: /Barcelona/i, data: "Barcelona", re: /barcelona|barça/i, show: "BARCELONA", bg: "#A50044", fg: "#FFFFFF" },
  realmadrid: { qid: "Q8682", label: /Real Madrid/i, data: "Real Madrid", re: /real madrid/i, show: "REAL MADRID", bg: "#FFFFFF", fg: "#00529F" },
  manutd: { qid: "Q18656", label: /Manchester United/i, data: "Manchester United", re: /manchester united|man\.? ?utd/i, show: "MAN UNITED", bg: "#DA291C", fg: "#FFFFFF" },
  mancity: { qid: "Q50602", label: /Manchester City/i, data: "Manchester City", re: /manchester city|man\.? ?city/i, show: "MAN CITY", bg: "#6CABDD", fg: "#1C2C5B" },
  liverpool: { qid: "Q1130849", label: /^Liverpool/i, data: "Liverpool", re: /^liverpool/i, show: "LIVERPOOL", bg: "#C8102E", fg: "#FFFFFF" },
  arsenal: { qid: "Q9617", label: /^Arsenal/i, data: "Arsenal", re: /^arsenal/i, show: "ARSENAL", bg: "#EF0107", fg: "#FFFFFF" },
  milan: { qid: "Q1543", label: /Milan/i, data: "AC Milan", re: /a\.?c\.? milan/i, show: "AC MILAN", bg: "#FB090B", fg: "#000000" },
  psg: { qid: "Q483020", label: /Paris Saint-Germain/i, data: "Paris Saint-Germain", re: /paris saint-germain|\bpsg\b/i, show: "PSG", bg: "#004170", fg: "#FFFFFF" },
  newcastle: { qid: "Q18716", label: /Newcastle United/i, data: "Newcastle United", re: /newcastle united/i, show: "NEWCASTLE", bg: "#241F20", fg: "#FFFFFF" },
  tottenham: { qid: "Q18741", label: /Tottenham Hotspur/i, data: "Tottenham Hotspur", re: /tottenham/i, show: "TOTTENHAM", bg: "#FFFFFF", fg: "#132257" },
};

// ── http ─────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
export const getJson = async (url) => {
  if (CHECK) throw new Error(`--check is offline, but a fetch was needed: ${url.slice(0, 160)}`);
  for (let attempt = 0; attempt < 7; attempt++) {
    const wait = last + 1500 - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/sparql-results+json, application/json" } });
    } catch (e) {
      console.log(`  (network ${e.message}, retry ${attempt + 1})`);
      await sleep(3000 * 2 ** attempt);
      continue;
    }
    const text = await res.text();
    if (res.ok) {
      try {
        return JSON.parse(text);
      } catch {}
    }
    const ra = Number(res.headers.get("retry-after"));
    const back = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 3000 * 2 ** attempt;
    console.log(`  (${new URL(url).host} ${res.status}, backing off ${Math.round(back / 1000)}s, retry ${attempt + 1})`);
    await sleep(back);
  }
  throw new Error(`gave up on ${url.slice(0, 160)}`);
};
const wdApi = (params) => getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`);
const wpApi = (params) => getJson(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ ...params, format: "json", formatversion: "2" })}`);
const sparql = (q) => getJson(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: "json" })}`);

// ── caches ───────────────────────────────────────────────────────────────
const load = (f, empty) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : empty);
export const WD = load(WD_CACHE, { players: {}, clubs: {} });
export const WP = load(WP_CACHE, { infobox: {}, titleQid: {}, seasons: {} });
const SEED = load(SEED_WD, { players: {} });
const saveWD = () => !CHECK && writeFileSync(WD_CACHE, JSON.stringify(WD, null, 1));
const saveWP = () => !CHECK && writeFileSync(WP_CACHE, JSON.stringify(WP, null, 1));

// ── wikidata ─────────────────────────────────────────────────────────────
const qidOf = (u) => u?.value?.split("/").pop();
const playerSparql = async (qid) => {
  const q = `SELECT ?prop ?st ?rank ?val ?valLabel ?start ?end ?parent ?parentLabel WHERE {
    { wd:${qid} p:P54 ?st . ?st ps:P54 ?val ; wikibase:rank ?rank . BIND("P54" AS ?prop)
      OPTIONAL { ?st pq:P580 ?start } OPTIONAL { ?st pq:P582 ?end }
      OPTIONAL { ?val wdt:P361|wdt:P749|wdt:P127 ?parent } }
    UNION { wd:${qid} wdt:P27 ?val . BIND("P27" AS ?prop) }
    UNION { wd:${qid} wdt:P1532 ?val . BIND("P1532" AS ?prop) }
    UNION { wd:${qid} wdt:P413 ?val . BIND("P413" AS ?prop) }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
  }`;
  const rows = (await sparql(q)).results.bindings;
  const teams = new Map();
  for (const b of rows.filter((b) => b.prop.value === "P54")) {
    const t = teams.get(b.st.value) ?? {
      qid: qidOf(b.val),
      label: b.valLabel?.value,
      rank: b.rank.value.split("#").pop().replace("Rank", "").toLowerCase(),
      start: b.start?.value?.slice(0, 4) ?? null,
      end: b.end?.value?.slice(0, 4) ?? null,
      parents: [],
    };
    if (b.parent && !t.parents.some((p) => p.qid === qidOf(b.parent))) t.parents.push({ qid: qidOf(b.parent), label: b.parentLabel?.value });
    teams.set(b.st.value, t);
  }
  const labels = (p) => [...new Set(rows.filter((b) => b.prop.value === p).map((b) => b.valLabel?.value))];
  return { p54: [...teams.values()], nationality: [...new Set([...labels("P27"), ...labels("P1532")])], sportNation: labels("P1532"), citizenship: labels("P27"), positions: labels("P413") };
};

// search = the Wikidata search string (defaults to the name); qid pins it
export const resolvePlayer = async (name, { search, qid } = {}) => {
  const hit = WD.players[name];
  if (hit && (!qid || hit.qid === qid) && hit.enwiki && hit.sportNation) return hit;
  let id = qid;
  let label, description;
  if (!id) {
    const seed = SEED.players[name];
    if (seed && !search) {
      id = seed.qid;
    } else {
      const s = await wdApi({ action: "wbsearchentities", search: search ?? name, language: "en", limit: "7" });
      const h = (s.search ?? []).find((h) => /fo+t?ball|soccer|goalkeeper/i.test(h.description ?? ""));
      if (!h) throw new Error(`wikidata: no footballer entity for "${name}": ${JSON.stringify(s.search?.map((h) => `${h.label} — ${h.description}`))}`);
      id = h.id;
    }
  }
  const e = await wdApi({ action: "wbgetentities", ids: id, props: "labels|descriptions|sitelinks", languages: "en", sitefilter: "enwiki" });
  label = e.entities[id]?.labels?.en?.value;
  description = e.entities[id]?.descriptions?.en?.value;
  const enwiki = e.entities[id]?.sitelinks?.enwiki?.title ?? null;
  const data = await playerSparql(id);
  WD.players[name] = { name, qid: id, label, description, enwiki, ref: `https://www.wikidata.org/wiki/${id}`, fetched: new Date().toISOString().slice(0, 10), ...data };
  saveWD();
  return WD.players[name];
};

export const assertClubs = async (keys) => {
  const missing = keys.map((k) => CLUBS[k].qid).filter((q) => !WD.clubs[q]);
  if (missing.length) {
    const e = await wdApi({ action: "wbgetentities", ids: missing.join("|"), props: "labels", languages: "en" });
    for (const q of missing) WD.clubs[q] = e.entities[q]?.labels?.en?.value ?? null;
    saveWD();
  }
  return keys.filter((k) => !CLUBS[k].label.test(WD.clubs[CLUBS[k].qid] ?? "")).map((k) => `club ${k}: ${CLUBS[k].qid} is "${WD.clubs[CLUBS[k].qid]}" on Wikidata`);
};

// ── wikipedia ────────────────────────────────────────────────────────────
// link target of a wikitext club cell: "→ [[Chelsea F.C.|Chelsea]] (loan)"
export const linkTarget = (cell) => {
  const m = cell.match(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/);
  return m ? m[1].trim().replace(/_/g, " ") : null;
};
// title → Wikidata QID through the page's wikibase_item (follows redirects)
export const titlesToQids = async (titles) => {
  const want = [...new Set(titles.filter((t) => t && !(t in WP.titleQid)))];
  for (let i = 0; i < want.length; i += 40) {
    const chunk = want.slice(i, i + 40);
    const j = await wpApi({ action: "query", titles: chunk.join("|"), redirects: "1", prop: "pageprops", ppprop: "wikibase_item" });
    const q = j.query ?? {};
    const hop = new Map();
    for (const n of q.normalized ?? []) hop.set(n.from, n.to);
    for (const r of q.redirects ?? []) hop.set(r.from, r.to);
    const byTitle = new Map((q.pages ?? []).map((p) => [p.title, p.pageprops?.wikibase_item ?? null]));
    for (const t of chunk) {
      let cur = t;
      for (let k = 0; k < 4 && hop.has(cur); k++) cur = hop.get(cur);
      WP.titleQid[t] = byTitle.get(cur) ?? null;
    }
    saveWP();
  }
  return Object.fromEntries(titles.map((t) => [t, WP.titleQid[t] ?? null]));
};


// the football-biography infobox as {param: value}, split on TOP-LEVEL pipes
// only (links and templates keep theirs), HTML comments stripped — so both
// one-param-per-line and "| years1 = … |clubs1 = …" layouts parse the same
export const infoboxParams = (w) => {
  const at = w.search(/\{\{\s*Infobox (football|soccer)/i);
  if (at < 0) throw new Error("wikipedia: no football infobox");
  let depth = 0;
  let end = at;
  for (let i = at; i < w.length - 1; i++) {
    if (w[i] === "{" && w[i + 1] === "{") (depth++, i++);
    else if (w[i] === "}" && w[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) {
        end = i - 1;
        break;
      }
    }
  }
  const body = w.slice(at + 2, end).replace(/<!--[\s\S]*?-->/g, "");
  const parts = [];
  let cur = "";
  let sq = 0;
  let cu = 0;
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2);
    if (two === "[[") (sq++, (cur += two), i++);
    else if (two === "]]") (sq--, (cur += two), i++);
    else if (two === "{{") (cu++, (cur += two), i++);
    else if (two === "}}") (cu--, (cur += two), i++);
    else if (body[i] === "|" && sq === 0 && cu === 0) (parts.push(cur), (cur = ""));
    else cur += body[i];
  }
  parts.push(cur);
  const out = {};
  for (const p of parts.slice(1)) {
    const m = p.match(/^\s*([^=]+?)\s*=\s*([\s\S]*)$/);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
};

// the player's infobox: senior clubs (years, raw, target, qid, loan) + position
export const resolveInfobox = async (P) => {
  if (!P.enwiki) throw new Error(`wikipedia: ${P.name} (${P.qid}) has no enwiki sitelink`);
  let ib = WP.infobox[P.enwiki];
  if (!ib) {
    const j = await wpApi({ action: "parse", page: P.enwiki, prop: "wikitext|revid", section: "0", redirects: "1" });
    const w = j.parse?.wikitext;
    if (!w) throw new Error(`wikipedia: no wikitext for "${P.enwiki}"`);
    const params = infoboxParams(w);
    const field = (k) => Object.fromEntries(Object.entries(params).map(([key, v]) => [key.match(new RegExp(`^${k}(\\d+)$`))?.[1], v]).filter(([i]) => i));
    const clubs = field("clubs");
    const years = field("years");
    const rows = Object.keys(clubs)
      .sort((a, b) => a - b)
      .map((i) => {
        const raw = clubs[i];
        return { years: (years[i] ?? "").replace(/\{\{[^}]*\}\}/g, "").trim() || null, raw, target: linkTarget(raw.replace(/^→\s*/, "")), loan: /^→|\(loan\)/i.test(raw) };
      })
      .filter((r) => r.raw);
    if (!rows.length) throw new Error(`wikipedia: "${P.enwiki}" infobox has no clubsN params`);
    const pos = params.position ?? "";
    ib = { title: j.parse.title, revid: j.parse.revid, ref: `https://en.wikipedia.org/wiki/${encodeURIComponent(j.parse.title.replace(/ /g, "_"))}`, fetched: new Date().toISOString().slice(0, 10), position: pos, clubs: rows };
    WP.infobox[P.enwiki] = ib;
    saveWP();
  }
  const map = await titlesToQids(ib.clubs.map((c) => c.target));
  return { ...ib, clubs: ib.clubs.map((c) => ({ ...c, qid: map[c.target] ?? null })) };
};

// year span of an infobox years cell: "2004–2007" | "2022–" | "1996"
export const span = (s) => {
  if (!s) return null;
  const m = s.match(/(\d{4})\s*(?:[–—-]\s*(\d{4})?)?/);
  if (!m) return null;
  const open = /[–—-]\s*$/.test(s.replace(/\s+/g, ""));
  return { from: Number(m[1]), to: m[2] ? Number(m[2]) : open ? 9999 : Number(m[1]) };
};

// a season article's squad section: rows of {target, qid, pos}
export const resolveSeason = async (title, sectionHeading, rowRe, extract) => {
  let s = WP.seasons[title];
  if (!s) {
    const j = await wpApi({ action: "parse", page: title, prop: "wikitext|revid", redirects: "1" });
    const w = j.parse?.wikitext;
    if (!w) throw new Error(`wikipedia: no season article "${title}"`);
    const at = w.indexOf(sectionHeading);
    if (at < 0) throw new Error(`wikipedia: "${title}" has no section ${sectionHeading}`);
    const rest = w.slice(at + sectionHeading.length);
    const body = rest.slice(0, rest.search(/\n==[^=]/));
    const rows = [...body.matchAll(rowRe)].map((m) => ({ target: m.groups.target.trim(), pos: m.groups.pos ?? null }));
    s = { title: j.parse.title, revid: j.parse.revid, section: sectionHeading, ref: `https://en.wikipedia.org/wiki/${encodeURIComponent(j.parse.title.replace(/ /g, "_"))}`, fetched: new Date().toISOString().slice(0, 10), rows, extra: extract ? extract(w) : null };
    WP.seasons[title] = s;
    saveWP();
  }
  const map = await titlesToQids(s.rows.map((r) => r.target));
  return { ...s, rows: s.rows.map((r) => ({ ...r, qid: map[r.target] ?? null })) };
};

// ── shared checks ────────────────────────────────────────────────────────
const rk = (t) => String(t.rank).toLowerCase();
export const wdSenior = (P, club) => P.p54.filter((t) => t.qid === club.qid && rk(t) !== "deprecated");
export const wdAnyLevel = (P, club) => P.p54.filter((t) => t.qid === club.qid || club.re.test(t.label ?? "") || t.parents.some((p) => p.qid === club.qid || club.re.test(p.label ?? "")));
export const wpSenior = (IB, club) => IB.clubs.filter((c) => c.qid === club.qid);
export const wpAnyLevel = (IB, club) => IB.clubs.filter((c) => c.qid === club.qid || club.re.test(c.raw));
export const fmtWd = (t) => `${t.label} [${t.qid}] ${t.start ?? "?"}–${t.end ?? "?"}${rk(t) !== "normal" ? ` (${rk(t)})` : ""}`;
export const isFootballer = (P) => /fo+t?ball|soccer|goalkeeper/i.test(P.description ?? "");
// P413 / infobox position vs a class; "wing half" is Wikidata's catch-all for a
// wide player and is consistent with a wide forward or a midfielder
export const POS_RE = { GK: /goal ?keeper/i, DEF: /back|defender|sweeper|libero/i, MID: /midfield|wing half|playmaker/i, ATT: /forward|striker|winger|wing half/i };

export const gateReport = (name, problems) => {
  if (problems.length) {
    console.error(`\n✗ ${name} GATE FAILED — ${problems.length} disagreement(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
};
