// MISSING LETTERS — "name the player from the missing letters", ten rounds,
// easy → impossible. Pool, fact gate and edition builder in one.
//
//   node lab/letters-facts.mjs --edition e1 [--seed N]   # build + gate → src/lab/letters/facts.json
//   node lab/letters-facts.mjs [--check]                 # offline re-assert facts.json
//
// Candidates: THE DRAW cards (fameRank ≤ 150) already resolved in the Who's
// Older cache, so each one is a known Wikidata footballer. Gate, per player:
//   spelling — the card name must equal the Wikidata English label AND the
//              enwiki article title (both from the gated older-dob-cache);
//   clue     — the nation shown must be a live Wikidata P1532 ("country for
//              sport") value, fetched live and cached in letters-cache.json.
// Which letters are hidden is display only, decided by the seed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, "..", "src", "lab", "letters", "facts.json");
const CACHE = path.join(dir, "letters-cache.json");
const USED = path.join(dir, "editions", "letters-used.json");
const OLDER = JSON.parse(readFileSync(path.join(dir, "older-dob-cache.json"), "utf8"));
const CARDS = JSON.parse(readFileSync(path.join(dir, "..", "..", "..", "app", "convex", "data", "drawCardsReal.candidates.json"), "utf8"));
const UA = "VerveQ-content-factory/1.0 (https://verveq.com; fact gate)";
const arg = (k) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

// Wikidata's P1532 labels vs THE DRAW's nation strings
const NATION_ALIAS = { "Ivory Coast": ["Ivory Coast", "Côte d'Ivoire"], "Czech Republic": ["Czech Republic", "Czechia"], "South Korea": ["South Korea"], Netherlands: ["Netherlands", "Kingdom of the Netherlands"] };
const nationOk = (nation, labels) => (NATION_ALIAS[nation] ?? [nation]).some((n) => labels.includes(n));

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

const sportCountries = async (qid) => {
  if (cache[qid]) return cache[qid];
  const e = await wd({ action: "wbgetentities", ids: qid, props: "claims" });
  const ids = (e.entities[qid].claims?.P1532 ?? []).filter((c) => c.rank !== "deprecated").map((c) => c.mainsnak.datavalue?.value?.id).filter(Boolean);
  await sleep(1000);
  let labels = [];
  if (ids.length) {
    const l = await wd({ action: "wbgetentities", ids: ids.join("|"), props: "labels", languages: "en" });
    labels = ids.map((id) => l.entities[id]?.labels?.en?.value).filter(Boolean);
    await sleep(1000);
  }
  cache[qid] = labels;
  writeFileSync(CACHE, JSON.stringify(cache, null, 1));
  return labels;
};

const spellingOk = (name) => {
  const c = OLDER[name];
  return Boolean(c?.qid && c.label === name && c.wikipedia?.title === name);
};

const assertFacts = (f) => {
  for (const r of f.rounds) {
    if (!spellingOk(r.name)) throw new Error(`round ${r.n}: "${r.name}" spelling not double-sourced`);
    if (!nationOk(r.nation, cache[r.qid] ?? [])) throw new Error(`round ${r.n}: ${r.name} nation ${r.nation} not in Wikidata P1532 ${JSON.stringify(cache[r.qid])}`);
    const shown = r.words.map((w) => w.map((t) => t.c).join("")).join(" ");
    if (shown !== r.name.toUpperCase()) throw new Error(`round ${r.n}: tiles spell "${shown}", not "${r.name.toUpperCase()}"`);
    if (!r.words.flat().some((t) => t.hide)) throw new Error(`round ${r.n}: nothing hidden`);
  }
  return true;
};

const edition = arg("--edition");
if (!edition) {
  const f = JSON.parse(readFileSync(OUT, "utf8"));
  assertFacts(f);
  console.log(`letters --check: ${f.edition} OK — ${f.rounds.map((r) => `${r.name} (${r.nation})`).join(", ")}`);
  process.exit(0);
}

let seed = Number(arg("--seed") ?? Number(edition.slice(1)) * 7919);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const used = new Set(existsSync(USED) ? JSON.parse(readFileSync(USED, "utf8")) : []);
// tiers: [fame from, fame to, share of letters hidden, first letter shown?]
const TIERS = [
  ...Array(3).fill([1, 40, 0.34, true, "EASY"]),
  ...Array(3).fill([1, 80, 0.48, true, "MEDIUM"]),
  ...Array(3).fill([30, 150, 0.6, true, "HARD"]),
  [1, 150, 0.72, false, "IMPOSSIBLE"],
];
const pool = CARDS.filter((c) => c.fameRank <= 150 && !used.has(c.name) && spellingOk(c.name) && c.name.replace(/[^\p{L}]/gu, "").length >= 5);
const taken = new Set();
const rounds = [];
for (const [i, [lo, hi, share, first, label]] of TIERS.entries()) {
  const cands = pool.filter((c) => c.fameRank >= lo && c.fameRank <= hi && !taken.has(c.name)).sort(() => rand() - 0.5);
  let pick = null;
  for (const c of cands) {
    const labels = await sportCountries(OLDER[c.name].qid);
    if (nationOk(c.nation, labels)) {
      pick = c;
      break;
    }
    console.log(`  · skip ${c.name}: card nation ${c.nation}, Wikidata P1532 ${JSON.stringify(labels)}`);
  }
  if (!pick) throw new Error(`no gated player for round ${i + 1}`);
  taken.add(pick.name);
  const up = pick.name.toUpperCase();
  const letters = [...up].map((c, k) => ({ c, k })).filter((t) => /\p{L}/u.test(t.c));
  const wordStart = new Set([0, ...[...up].flatMap((c, k) => (/[\s-]/.test(c) ? [k + 1] : []))]);
  const keep = new Set(first ? [...wordStart] : []);
  const n = Math.max(2, Math.round(letters.length * share));
  const hideable = letters.filter((t) => !keep.has(t.k)).sort(() => rand() - 0.5);
  const hidden = new Set(hideable.slice(0, n).map((t) => t.k));
  const words = up.split(" ").map((w, wi, arr) => {
    const off = arr.slice(0, wi).reduce((a, x) => a + x.length + 1, 0);
    return [...w].map((c, k) => ({ c, hide: hidden.has(off + k) }));
  });
  rounds.push({ n: i + 1, tier: label, name: pick.name, nation: pick.nation, qid: OLDER[pick.name].qid, ref: OLDER[pick.name].ref, wikipedia: OLDER[pick.name].wikipedia.ref, fameRank: pick.fameRank, words });
}
const facts = { _doc: "MISSING LETTERS — spelling = Wikidata label = enwiki title; nation clue = Wikidata P1532. Built by lab/letters-facts.mjs.", edition, rounds };
assertFacts(facts);
writeFileSync(OUT, JSON.stringify(facts, null, 1));
writeFileSync(USED, JSON.stringify([...used, ...rounds.map((r) => r.name)], null, 1));
for (const r of rounds) console.log(`  R${r.n} ${r.tier.padEnd(10)} ${r.words.map((w) => w.map((t) => (t.hide ? "_" : t.c)).join("")).join(" ").padEnd(28)} ${r.name} · ${r.nation}`);
console.log(`letters ${edition}: 10 rounds gated → ${OUT}`);
