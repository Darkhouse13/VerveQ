// WHICH CLUB IS OLDER? — pool, double-source fact gate and edition builder.
//
//   node lab/clubolder-facts.mjs --warm           # resolve every pool club's founding date
//   node lab/clubolder-facts.mjs --edition e1     # build + gate an edition → src/lab/clubolder/facts.json
//   node lab/clubolder-facts.mjs --check          # offline re-assert facts.json against the cache
//
// A club is usable only when Wikidata P571 (inception, day precision, exactly
// one live claim) and the enwiki infobox `founded` date agree TO THE DAY.
// Anything disputed, year-only or missing is dropped, never guessed. Club
// names and colours below are display only; the dates come from the gate.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gapLabel } from "./older-facts.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(dir, "clubolder-cache.json");
const USED = path.join(dir, "editions", "clubolder-used.json");
const OUT = path.join(dir, "..", "src", "lab", "clubolder", "facts.json");
const UA = "VerveQ-content-factory/1.0 (https://verveq.com; fact gate)";
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);

// enwiki title → on-screen name + card colours (bg, fg)
export const POOL = {
  "FC Barcelona": ["BARCELONA", "#a50044", "#fff"],
  "Real Madrid CF": ["REAL MADRID", "#f4f1ea", "#1b1f5e"],
  "Atlético Madrid": ["ATLÉTICO", "#cb3524", "#fff"],
  "Sevilla FC": ["SEVILLA", "#d8232a", "#fff"],
  "Valencia CF": ["VALENCIA", "#ee7f00", "#fff"],
  "Athletic Bilbao": ["ATHLETIC", "#ee2523", "#fff"],
  "Real Betis": ["BETIS", "#0bb363", "#fff"],
  "Juventus FC": ["JUVENTUS", "#111111", "#fff"],
  "AC Milan": ["AC MILAN", "#c8102e", "#fff"],
  "Inter Milan": ["INTER", "#0068a8", "#fff"],
  "SSC Napoli": ["NAPOLI", "#12a0d7", "#fff"],
  "AS Roma": ["ROMA", "#8e1f2f", "#f0bc42"],
  "SS Lazio": ["LAZIO", "#87d8f7", "#0b1f3a"],
  "Genoa CFC": ["GENOA", "#a1182e", "#fff"],
  "FC Bayern Munich": ["BAYERN", "#dc052d", "#fff"],
  "Borussia Dortmund": ["DORTMUND", "#fde100", "#111"],
  "Bayer 04 Leverkusen": ["LEVERKUSEN", "#e32221", "#fff"],
  "FC Schalke 04": ["SCHALKE", "#004d9d", "#fff"],
  "Hamburger SV": ["HAMBURG", "#0a3f86", "#fff"],
  "Paris Saint-Germain FC": ["PSG", "#004170", "#fff"],
  "Olympique de Marseille": ["MARSEILLE", "#2faee0", "#fff"],
  "Olympique Lyonnais": ["LYON", "#da0812", "#fff"],
  "AS Monaco FC": ["MONACO", "#e51b22", "#fff"],
  "Liverpool F.C.": ["LIVERPOOL", "#c8102e", "#fff"],
  "Manchester United F.C.": ["MAN UNITED", "#da291c", "#fff"],
  "Manchester City F.C.": ["MAN CITY", "#6cabdd", "#0b1f3a"],
  "Arsenal F.C.": ["ARSENAL", "#ef0107", "#fff"],
  "Chelsea F.C.": ["CHELSEA", "#034694", "#fff"],
  "Tottenham Hotspur F.C.": ["TOTTENHAM", "#f4f1ea", "#132257"],
  "Everton F.C.": ["EVERTON", "#003399", "#fff"],
  "Aston Villa F.C.": ["ASTON VILLA", "#670e36", "#95bfe5"],
  "Newcastle United F.C.": ["NEWCASTLE", "#241f20", "#fff"],
  "West Ham United F.C.": ["WEST HAM", "#7a263a", "#1bb1e7"],
  "Celtic F.C.": ["CELTIC", "#018749", "#fff"],
  "Rangers F.C.": ["RANGERS", "#1b458f", "#fff"],
  "AFC Ajax": ["AJAX", "#d2122e", "#fff"],
  "PSV Eindhoven": ["PSV", "#ed1c24", "#fff"],
  "Feyenoord": ["FEYENOORD", "#e0001a", "#fff"],
  "S.L. Benfica": ["BENFICA", "#e20e0e", "#fff"],
  "FC Porto": ["PORTO", "#00428c", "#fff"],
  "Sporting CP": ["SPORTING", "#008057", "#fff"],
  "Galatasaray S.K. (football)": ["GALATASARAY", "#a90432", "#fdb912"],
  "Fenerbahçe S.K. (football)": ["FENERBAHÇE", "#163962", "#ffed00"],
  "Boca Juniors": ["BOCA", "#103f79", "#f3b229"],
  "Club Atlético River Plate": ["RIVER PLATE", "#f4f1ea", "#d0021b"],
  "CR Flamengo": ["FLAMENGO", "#c3281e", "#111"],
  "Santos FC": ["SANTOS", "#f4f1ea", "#111"],
  "Sociedade Esportiva Palmeiras": ["PALMEIRAS", "#006437", "#fff"],
  "Club América": ["AMÉRICA", "#ffe200", "#0c2340"],
};

// Both sources agree on these, but fans widely cite a different founding year
// (City: 1880 as St. Mark's; Monaco: 1919). A "wrong-looking" date costs trust,
// so they never appear.
const CONTESTED = new Set(["Manchester City F.C.", "AS Monaco FC"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      try {
        return await res.json();
      } catch {}
    }
    await sleep(3000 * (attempt + 1));
  }
  throw new Error(`gave up on ${url}`);
};
const wd = (p) => getJson(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...p, format: "json" })}`);
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

// Wikidata: enwiki title → entity → P571 (one live claim, preferred wins, day precision)
const wikidataFounded = async (title) => {
  const e = await wd({ action: "wbgetentities", sites: "enwiki", titles: title, props: "claims|sitelinks", sitefilter: "enwiki", redirects: "yes" });
  const [qid, ent] = Object.entries(e.entities ?? {})[0] ?? [];
  if (!qid || qid.startsWith("-")) throw new Error(`no Wikidata item for enwiki "${title}"`);
  const live = (ent.claims?.P571 ?? []).filter((c) => c.rank !== "deprecated");
  const pref = live.filter((c) => c.rank === "preferred");
  const claims = pref.length ? pref : live;
  if (claims.length !== 1) throw new Error(`${qid} has ${claims.length} candidate P571 claims`);
  const v = claims[0].mainsnak.datavalue?.value;
  if (!v || v.precision !== 11) throw new Error(`${qid} P571 precision ${v?.precision}, need day (11)`);
  const m = v.time.match(/^\+(\d{4})-(\d{2})-(\d{2})T/);
  return { qid, date: `${m[1]}-${m[2]}-${m[3]}`, enwiki: ent.sitelinks?.enwiki?.title ?? title };
};

// Wikipedia: the infobox `founded` field, as {{start date|y|m|d}} or "29 November 1899" / "November 29, 1899"
const wikipediaFounded = async (title) => {
  const url = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "parse", page: title, prop: "wikitext", section: "0", redirects: "1", format: "json" })}`;
  const w = (await getJson(url)).parse?.wikitext?.["*"] ?? "";
  const field = w.match(/\|\s*founded\s*=\s*([^\n]*)/i)?.[1];
  if (!field) throw new Error(`no infobox founded field in "${title}"`);
  const clean = field.replace(/<ref[\s\S]*?(<\/ref>|\/>)/g, "").replace(/<!--[\s\S]*?-->/g, "");
  const found = new Set();
  for (const m of clean.matchAll(/\{\{\s*(?:start date|founded date|start date and age|start date and years ago)[^|}]*\|(?:\s*[a-z]+\s*=\s*\w+\s*\|)*\s*(\d{4})\s*\|\s*(\d{1,2})\s*\|\s*(\d{1,2})/gi)) found.add(iso(m[1], m[2], m[3]));
  const text = clean.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1");
  for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\b/g)) {
    const mo = MONTHS.indexOf(m[2].toLowerCase());
    if (mo >= 0) found.add(iso(m[3], mo + 1, m[1]));
  }
  for (const m of text.matchAll(/\b([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\b/g)) {
    const mo = MONTHS.indexOf(m[1].toLowerCase());
    if (mo >= 0) found.add(iso(m[3], mo + 1, m[2]));
  }
  if (found.size !== 1) throw new Error(`infobox founded "${field.trim().slice(0, 120)}" gives ${found.size} day-precise dates`);
  return { date: [...found][0], ref: `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` };
};

const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

if (process.argv.includes("--warm")) {
  for (const title of Object.keys(POOL)) {
    if (cache[title]?.ok) continue;
    try {
      const a = await wikidataFounded(title);
      await sleep(1200);
      const b = await wikipediaFounded(a.enwiki);
      await sleep(1200);
      if (a.date !== b.date) throw new Error(`Wikidata ${a.date} ≠ Wikipedia ${b.date}`);
      cache[title] = { ok: true, qid: a.qid, date: a.date, wikidata: `https://www.wikidata.org/wiki/${a.qid}#P571`, wikipedia: b.ref };
      console.log(`  ✓ ${title}: ${a.date}`);
    } catch (e) {
      cache[title] = { ok: false, why: e.message.slice(0, 200) };
      console.log(`  ✗ ${title}: ${e.message.slice(0, 140)}`);
    }
    writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  }
  const ok = Object.values(cache).filter((c) => c.ok).length;
  console.log(`clubolder warm: ${ok}/${Object.keys(POOL).length} clubs pass both sources`);
  process.exit(0);
}

const days = (a, b) => Math.abs(Math.round((Date.parse(b) - Date.parse(a)) / 86400000));
const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pretty = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return `${dd} ${MON[m - 1]} ${y}`;
};
const side = (title) => {
  const [show, bg, fg] = POOL[title];
  const c = cache[title];
  return { name: title, show, bg, fg, founded: c.date, date: pretty(c.date), qid: c.qid, ref: c.wikidata, wikipedia: c.wikipedia };
};

// re-assert a facts file against the cache: both sources agreed, order is right, gaps shrink
const assertFacts = (f) => {
  let prev = Infinity;
  for (const r of f.rounds) {
    for (const s of ["a", "b"]) {
      const c = cache[r[s].name];
      if (!c?.ok || CONTESTED.has(r[s].name) || c.date !== r[s].founded) throw new Error(`round ${r.n}: ${r[s].name} not gated (${c?.why ?? c?.date})`);
    }
    const older = r.a.founded < r.b.founded ? "a" : "b";
    if (r.older !== older) throw new Error(`round ${r.n}: older should be ${older}`);
    if (r.gapDays !== days(r.a.founded, r.b.founded) || r.gapDays >= prev) throw new Error(`round ${r.n}: gap ${r.gapDays} does not shrink`);
    prev = r.gapDays;
  }
  return true;
};

if (process.argv.includes("--check") || process.argv.length === 2) {
  const f = JSON.parse(readFileSync(OUT, "utf8"));
  assertFacts(f);
  console.log(`clubolder --check: ${f.edition} OK — ${f.rounds.length} rounds, every date double-sourced, gaps ${f.rounds.map((r) => r.gapDays).join(" > ")}`);
  process.exit(0);
}

// build an edition: ten pairs whose gap shrinks toward these targets (days); no pair
// repeats across editions, no club twice in one edition, first card is random
const edition = arg("--edition");
if (!/^e\d+$/.test(edition ?? "")) throw new Error("usage: --warm | --edition eN | --check");
let seed = Number(arg("--seed") ?? Number(edition.slice(1)) * 7919);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const TARGETS = [40, 25, 16, 10, 6, 3.5, 2, 1, 0.4, 0.08].map((y) => y * 365.25);
const used = existsSync(USED) ? JSON.parse(readFileSync(USED, "utf8")) : [];
const usedSet = new Set(used);
const clubs = Object.keys(POOL).filter((t) => cache[t]?.ok && !CONTESTED.has(t));
const pairs = [];
for (let i = 0; i < clubs.length; i++)
  for (let j = i + 1; j < clubs.length; j++) {
    const key = [clubs[i], clubs[j]].sort().join(" | ");
    const g = days(cache[clubs[i]].date, cache[clubs[j]].date);
    if (!usedSet.has(key) && g > 0) pairs.push({ x: clubs[i], y: clubs[j], g, key });
  }
// built from the LAST round backwards: the tightest unused pair takes round 10,
// then each earlier round needs a strictly wider gap (a forward greedy strands
// round 10 once the few sub-month pairs are used up)
const inEd = new Set();
const rounds = [];
let next = 0;
for (let ti = TARGETS.length - 1; ti >= 0; ti--) {
  const t = TARGETS[ti];
  const ok = pairs.filter((p) => p.g > next && !inEd.has(p.x) && !inEd.has(p.y));
  if (!ok.length) throw new Error(`no pair left for round ${ti + 1} — widen the pool`);
  ok.sort((p, q) => Math.abs(Math.log(p.g / t)) - Math.abs(Math.log(q.g / t)) + (rand() - 0.5) * 0.25);
  const p = ok[0];
  inEd.add(p.x).add(p.y);
  next = p.g;
  const [a, b] = rand() < 0.5 ? [p.x, p.y] : [p.y, p.x];
  const A = side(a);
  const B = side(b);
  rounds.unshift({ n: ti + 1, a: A, b: B, older: A.founded < B.founded ? "a" : "b", gapDays: p.g, gap: gapLabel(p.g), key: p.key });
}
const facts = { _doc: "WHICH CLUB IS OLDER? — founding dates double-sourced (Wikidata P571 = enwiki infobox, to the day). Built by lab/clubolder-facts.mjs.", edition, rounds };
assertFacts(facts);
writeFileSync(OUT, JSON.stringify(facts, null, 1));
writeFileSync(USED, JSON.stringify([...used, ...rounds.map((r) => r.key)], null, 1));
for (const r of rounds) console.log(`  R${r.n}: ${r.a.show} ${r.a.founded} vs ${r.b.show} ${r.b.founded} → ${r.older === "a" ? r.a.show : r.b.show} older by ${r.gap}`);
console.log(`clubolder ${edition}: 10 rounds gated → ${OUT}`);
