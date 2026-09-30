// WHO'S OLDER? — edition generator. Picks ten famous head-to-heads whose
// birth-date gap shrinks every round (years → days), writes
// lab/editions/older-<ed>.json, then runs the double-source gate on it
// (lab/older-facts.mjs --edition <ed>). Nothing here is a fact source: every
// date it uses is the gate's own cache, where Wikidata and Wikipedia agree.
//
//   node lab/older-generate.mjs --warm            # resolve the pool's dates
//   node lab/older-generate.mjs e4 [--seed 7]     # build + gate one edition
//
// Pool = THE DRAW cards up to fameRank 250 + lab/editions/older-pool-extra.json
// (current stars THE DRAW predates). A pair never repeats across editions and
// a player appears once per edition; lab/editions/older-used.json is the ledger.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolve, wikipediaDob } from "./older-facts.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const CACHE = path.join(dir, "older-dob-cache.json");
const ED_DIR = path.join(dir, "editions");
const EXTRA = JSON.parse(readFileSync(path.join(ED_DIR, "older-pool-extra.json"), "utf8"));
const TOP = 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const cards = JSON.parse(readFileSync(path.join(DATA, "drawCardsReal.candidates.json"), "utf8"));
const fame = new Map(cards.filter((c) => c.fameRank <= TOP).map((c) => [c.name, c.fameRank]));
for (const [n, r] of Object.entries(EXTRA.players)) if (!fame.has(n)) fame.set(n, r);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

if (process.argv.includes("--warm")) {
  let i = 0;
  for (const n of fame.keys()) {
    i++;
    try {
      if (!cache[n]) {
        cache[n] = await resolve(n);
        writeFileSync(CACHE, JSON.stringify(cache, null, 1));
        await sleep(1500);
      }
      if (!cache[n].wikipedia) {
        cache[n].wikipedia = await wikipediaDob(cache[n].qid);
        writeFileSync(CACHE, JSON.stringify(cache, null, 1));
        await sleep(1500);
      }
    } catch (e) {
      cache[n] = { ...(cache[n] ?? {}), name: n, failed: e.message.slice(0, 160) };
      writeFileSync(CACHE, JSON.stringify(cache, null, 1));
      console.log(`  ✗ ${n}: ${e.message.slice(0, 120)}`);
    }
    if (i % 25 === 0) console.log(`  ${i}/${fame.size}`);
  }
  console.log("older warm: done");
  process.exit(0);
}

const edition = process.argv[2];
if (!/^e\d+$/.test(edition ?? "")) throw new Error("usage: node lab/older-generate.mjs <eN> [--seed N] | --warm");
let seed = process.argv.includes("--seed") ? Number(process.argv[process.argv.indexOf("--seed") + 1]) : Number(edition.slice(1)) * 7919;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

// on-screen surname: particles stay with the surname; mononyms stay whole
const OVERRIDE = { ...EXTRA.show };
const PARTICLES = new Set(["van", "de", "di", "del", "da", "dos", "mac", "ter", "von", "le", "la", "el", "ben"]);
const surnameOf = (n) => {
  const t = n.split(" ");
  if (t.length === 1) return n.toUpperCase();
  const k = t.findIndex((w, i) => i > 0 && PARTICLES.has(w.toLowerCase()));
  return (k > 0 ? t.slice(k) : t.slice(-1)).join(" ").toUpperCase();
};
// a surname two famous players share (Boateng, Touré, Martínez…) or a famous
// namesake outside the pool (Dean Henderson, Jesús Navas) gets a first name
const ALL_FAMOUS = [...cards.map((c) => c.name), ...Object.keys(EXTRA.players)];
const surnameCount = new Map();
for (const n of new Set(ALL_FAMOUS)) surnameCount.set(surnameOf(n), (surnameCount.get(surnameOf(n)) ?? 0) + 1);
const NAMESAKES = new Set(["HENDERSON", "NAVAS", "COSTA", "LUIZ", "ALVES", "ALBA", "SILVA", "DÍAZ", "RODRÍGUEZ", "MARTÍNEZ", "FERNÁNDEZ", "FERNANDES", "GONZÁLEZ", "HERNÁNDEZ", "GARCÍA", "LÓPEZ", "PÉREZ", "COLE", "NEVILLE", "BOATENG", "TOURÉ", "HAZARD", "INZAGHI", "DE BOER", "MALDINI", "SCHMEICHEL", "WRIGHT-PHILLIPS", "LAUDRUP", "KOEMAN", "DE JONG", "GÖTZE"]);
const showOf = (n) => {
  if (OVERRIDE[n]) return OVERRIDE[n];
  const s = surnameOf(n);
  if (n.split(" ").length === 1 || (surnameCount.get(s) === 1 && !NAMESAKES.has(s))) return s;
  const first = n.split(" ")[0];
  const full = `${first} ${s}`.toUpperCase();
  return full.length <= 13 ? full : `${first[0]}. ${s}`.toUpperCase();
};

// identity: a DRAW-card player must be the SAME Wikidata person the imposter
// gate resolved and club-matched against our career data (the "Raúl" trap:
// a plain name search can land on a namesake with another birthday). The
// extra list was checked by hand; its "(born YYYY)" must match the date.
const IMP_WD = JSON.parse(readFileSync(path.join(dir, "imposter-wikidata-cache.json"), "utf8")).players;
const PATHS = JSON.parse(readFileSync(path.join(DATA, "football_career_paths.json"), "utf8"));
const normC = (x) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\b(f\.?c\.?|a\.?f\.?c\.?|c\.?f\.?|s\.?c\.?|club de futbol|calcio|football club)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const sameAsCareer = (n) => {
  const W = IMP_WD[n];
  const ps = PATHS.filter((p) => p.answerName === n);
  if (!W || ps.length !== 1 || W.qid !== cache[n]?.qid) return false;
  const uniq = [...new Set(ps[0].clubs.map((c) => normC(typeof c === "string" ? c : c.name)))];
  const wdNames = W.p54.map((t) => normC(t.label ?? ""));
  return uniq.filter((x) => x && wdNames.some((w) => w.includes(x) || x.includes(w))).length >= Math.min(2, uniq.length);
};
const bornOk = (n) => {
  const m = (cache[n]?.description ?? "").match(/born (\d{4})/);
  return !m || m[1] === cache[n].dob.slice(0, 4);
};
const identityOk = (n) => bornOk(n) && (n in EXTRA.players || sameAsCareer(n));

// usable = both sources agree to the day, and the name fits the card
const usable = [...fame.keys()].filter((n) => cache[n]?.dob && cache[n].wikipedia?.dob === cache[n].dob && identityOk(n) && showOf(n).length <= 13);
const dobMs = (n) => Date.parse(cache[n].dob + "T00:00:00Z");
const gapDays = (a, b) => Math.abs(Math.round((dobMs(a) - dobMs(b)) / 86400000));

// ledger: every pair ever used (posted editions included)
const used = new Set();
for (const f of readdirSync(ED_DIR).filter((f) => /^older-e\d+\.json$/.test(f) && f !== `older-${edition}.json`)) {
  for (const r of JSON.parse(readFileSync(path.join(ED_DIR, f), "utf8")).rounds) used.add([r.a, r.b].sort().join("|"));
}
const E1 = [["Jude Bellingham", "Luka Modrić"], ["Harry Kane", "Erling Haaland"], ["Kylian Mbappé", "Neymar"], ["Lionel Messi", "Cristiano Ronaldo"], ["Mohamed Salah", "Kevin De Bruyne"], ["Robert Lewandowski", "Karim Benzema"], ["Luka Modrić", "Cristiano Ronaldo"], ["Kevin De Bruyne", "Antoine Griezmann"], ["Son Heung-min", "Mohamed Salah"], ["Erling Haaland", "Vinícius Júnior"]];
for (const [a, b] of E1) used.add([a, b].sort().join("|"));

// the escalation: ten bands, years → days. Each round must also be strictly
// smaller than the one before (the gate asserts it again).
const BANDS = [[5800, 8200], [4700, 5790], [3800, 4690], [3000, 3790], [2200, 2990], [1300, 2190], [500, 1290], [100, 480], [15, 95], [1, 12]];
// recency: every appearance in an earlier generated edition costs 90 fame
// points, so the same five legends do not front every reel
const recent = new Map();
for (const f of readdirSync(ED_DIR).filter((f) => /^older-e\d+\.json$/.test(f) && f !== `older-${edition}.json`)) {
  for (const r of JSON.parse(readFileSync(path.join(ED_DIR, f), "utf8")).rounds) for (const n of [r.a, r.b]) recent.set(n, (recent.get(n) ?? 0) + 1);
}
const fameOf = (n) => (fame.get(n) ?? 999) + 90 * (recent.get(n) ?? 0);

for (let attempt = 0; attempt < 400; attempt++) {
  const taken = new Set();
  const shows = new Set();
  const rounds = [];
  let prev = Infinity;
  let ok = true;
  for (const [lo, hi] of BANDS) {
    const cands = [];
    const pool = usable.filter((n) => !taken.has(n));
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i];
        const b = pool[j];
        const g = gapDays(a, b);
        if (g < lo || g > hi || g >= prev) continue;
        if (used.has([a, b].sort().join("|"))) continue;
        if (shows.has(showOf(a)) || shows.has(showOf(b)) || showOf(a) === showOf(b)) continue;
        cands.push({ a, b, g, score: fameOf(a) + fameOf(b) + rand() * 120 });
      }
    }
    if (!cands.length) {
      ok = false;
      break;
    }
    cands.sort((x, y) => x.score - y.score);
    const pick = cands[Math.floor(rand() * Math.min(6, cands.length))];
    const [a, b] = rand() < 0.5 ? [pick.a, pick.b] : [pick.b, pick.a];
    rounds.push({ a, b });
    taken.add(a).add(b);
    shows.add(showOf(a)).add(showOf(b));
    prev = pick.g;
  }
  if (!ok) continue;
  const names = rounds.flatMap((r) => [r.a, r.b]);
  const ed = {
    _doc: `WHO'S OLDER edition ${edition.slice(1)} — generated by lab/older-generate.mjs (seed ${seed}). Gate: node lab/older-facts.mjs --edition ${edition}`,
    rounds,
    show: Object.fromEntries(names.map((n) => [n, showOf(n)])),
  };
  writeFileSync(path.join(ED_DIR, `older-${edition}.json`), JSON.stringify(ed, null, 1) + "\n");
  const r = spawnSync("node", [path.join(dir, "older-facts.mjs"), "--edition", edition], { encoding: "utf8" });
  process.stdout.write(r.stdout);
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    process.exit(1);
  }
  console.log(`older-generate: ${edition} written and gated`);
  process.exit(0);
}
throw new Error("older-generate: no ladder found — pool too small or every pair used");
