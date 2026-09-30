// SPOT THE IMPOSTER — edition generator. Builds six rounds (EASY, EASY,
// MEDIUM, HARD, HARD, IMPOSSIBLE-withheld) from the famous pool, writes
// lab/editions/imposter-<ed>.json, then runs the triple gate on it
// (lab/imposter-facts.mjs --edition <ed>). It only picks facts the three
// caches already agree on; the gate then re-checks everything from scratch.
//
//   node lab/imposter-warm.mjs            # once: fill the caches for the pool
//   node lab/imposter-generate.mjs e4 [--seed 11]
//
// Difficulty is read from Wikipedia appearances at the club: long spells are
// easy, loans and short stints are hard. A genuine player@club or imposter
// player@club never repeats across editions (every lab/editions/imposter-*.json
// is the ledger), and a player appears once per edition.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS, FLAG, NATION_RE, POS } from "./imposter-facts.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const ED_DIR = path.join(dir, "editions");
const TOP = 250;

const edition = process.argv[2];
if (!/^e\d+$/.test(edition ?? "") || edition === "e1") throw new Error("usage: node lab/imposter-generate.mjs <eN> [--seed N]");
let seed = process.argv.includes("--seed") ? Number(process.argv[process.argv.indexOf("--seed") + 1]) : Number(edition.slice(1)) * 104729;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

const paths = JSON.parse(readFileSync(path.join(DATA, "football_career_paths.json"), "utf8"));
const cards = JSON.parse(readFileSync(path.join(DATA, "drawCardsReal.candidates.json"), "utf8"));
const wd = JSON.parse(readFileSync(path.join(dir, "imposter-wikidata-cache.json"), "utf8")).players;
const wp = JSON.parse(readFileSync(path.join(dir, "imposter-wikipedia-cache.json"), "utf8"));
const clubName = (c) => (typeof c === "string" ? c : c.name);
const norm = (x) => x.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\b(f\.?c\.?|a\.?f\.?c\.?|c\.?f\.?|s\.?c\.?|club de futbol|calcio|football club)\b/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// ── the pool: famous, in all three sources, same person in all three ─────
const P = [];
for (const c of cards.filter((c) => c.fameRank <= TOP)) {
  const ps = paths.filter((p) => p.answerName === c.name);
  const W = wd[c.name];
  const K = wp[c.name];
  if (ps.length !== 1 || !W || !K || K.qid !== W.qid || K.parser !== 3) continue;
  if (!/fo+t?ball|soccer/i.test(W.description ?? "")) continue;
  const data = ps[0].clubs.map(clubName);
  const uniq = [...new Set(data.map(norm))];
  const wdNames = W.p54.map((t) => norm(t.label ?? ""));
  if (uniq.filter((x) => x && wdNames.some((w) => w.includes(x) || x.includes(w))).length < Math.min(2, uniq.length)) continue;
  // display: THE DRAW card, checked the way the gate checks it
  const nre = NATION_RE[c.nation] ?? new RegExp(c.nation, "i");
  if (!FLAG[c.nation] || !W.nationality.some((l) => nre.test(l))) continue;
  let position = c.position;
  const fits = (pos) => POS[pos] && (W.positions.some((l) => POS[pos].re.test(l)) || (pos !== "DEF" && W.positions.some((l) => /wing half/i.test(l))));
  if (!fits(position)) position = ["ATT", "MID", "DEF"].find(fits);
  if (!position) continue;
  // a forward first in Wikidata is shown as one (Rooney's card says MID)
  if (position === "MID" && /forward|striker/i.test(W.positions[0] ?? "") && fits("ATT")) position = "ATT";
  const spells = {};
  for (const [k, club] of Object.entries(CLUBS)) {
    const rows = K.clubs.filter((r) => club.wp.test(r.club));
    const genuine = data.includes(club.data) && W.p54.some((t) => t.qid === club.qid && String(t.rank).toLowerCase() !== "deprecated") && rows.length > 0;
    const anyContact = data.some((d) => club.re.test(d)) || K.clubs.some((r) => club.re.test(r.club) || club.wp.test(r.club)) ||
      W.p54.some((t) => t.qid === club.qid || club.re.test(t.label ?? "") || t.parents.some((p) => p.qid === club.qid || club.re.test(p.label ?? "")));
    const played = rows.some((r) => r.apps === null || r.apps > 0);
    spells[k] = { genuine: genuine && played, never: !anyContact, apps: rows.reduce((s, r) => s + (r.apps ?? 0), 0), loan: rows.every((r) => /loan/i.test(r.club)) };
  }
  P.push({ name: c.name, fame: c.fameRank, nation: c.nation, position, cardPosition: c.position, clubs: new Set(uniq), spells });
}

// ── the ledger ───────────────────────────────────────────────────────────
const usedGenuine = new Set();
const usedImp = new Set();
const E1 = [["chelsea", ["Didier Drogba", "Eden Hazard", "Frank Lampard"], "Steven Gerrard"], ["barcelona", ["Ronaldinho", "Luis Suárez", "Neymar"], "Zinedine Zidane"], ["realmadrid", ["Arjen Robben", "Michael Owen", "Wesley Sneijder"], "Robin van Persie"], ["juventus", ["Thierry Henry", "Patrick Vieira", "Zlatan Ibrahimović"], "Andriy Shevchenko"], ["manutd", ["Radamel Falcao", "Ángel Di María", "Henrik Larsson"], "Gonzalo Higuaín"], ["inter", ["Roberto Carlos", "Andrea Pirlo", "Edgar Davids"], "Patrick Kluivert"]];
const record = (club, cardsIn, imp) => {
  for (const n of cardsIn) if (n !== imp) usedGenuine.add(`${n}@${club}`);
  usedImp.add(`${imp}@${club}`);
};
for (const [k, g, i] of E1) record(k, [...g, i], i);
// nobody plays the imposter twice within three editions (Hazard, Aubameyang…)
const edNum = Number(edition.slice(1));
const recentImps = new Set();
for (const f of readdirSync(ED_DIR).filter((f) => /^imposter-e\d+\.json$/.test(f) && f !== `imposter-${edition}.json`)) {
  const n = Number(f.match(/e(\d+)/)[1]);
  for (const r of JSON.parse(readFileSync(path.join(ED_DIR, f), "utf8")).rounds) {
    record(r.club, r.cards, r.imp);
    if (Math.abs(n - edNum) <= 3) recentImps.add(r.imp);
  }
}

// ── rounds ───────────────────────────────────────────────────────────────
const TIERS = ["EASY", "EASY", "MEDIUM", "HARD", "HARD", "IMPOSSIBLE"];
const share = (a, b) => [...a.clubs].some((c) => b.clubs.has(c));
const realOf = (p, not) => Object.entries(p.spells).filter(([k, s]) => k !== not && s.genuine).sort((a, b) => b[1].apps - a[1].apps)[0];

const pickRound = (tier, club, taken) => {
  const free = P.filter((p) => !taken.has(p.name));
  const G = free.filter((p) => p.spells[club].genuine && !usedGenuine.has(`${p.name}@${club}`));
  const I = free.filter((p) => p.spells[club].never && !usedImp.has(`${p.name}@${club}`) && !recentImps.has(p.name) && realOf(p, club));
  const apps = (p) => p.spells[club].apps;
  let g;
  let imps;
  if (tier === "EASY") {
    g = G.filter((p) => apps(p) >= 100 && p.fame <= 120);
    imps = I.filter((p) => p.fame <= 80 && realOf(p, club)[1].apps >= 100);
  } else if (tier === "MEDIUM") {
    g = G.filter((p) => apps(p) >= 40 && p.fame <= 180);
    imps = I.filter((p) => p.fame <= 150 && realOf(p, club)[1].apps >= 60);
  } else {
    g = G.filter((p) => p.fame <= (tier === "HARD" ? 200 : 250));
    imps = I.filter((p) => p.fame <= 150);
  }
  if (g.length < 3 || !imps.length) return null;
  for (let t = 0; t < 60; t++) {
    const trio = shuffle(g).slice(0, 3);
    const short = trio.filter((p) => apps(p) < (tier === "IMPOSSIBLE" ? 45 : 60) || p.spells[club].loan).length;
    if (tier === "HARD" && short < 1) continue;
    if (tier === "IMPOSSIBLE" && short < 2) continue;
    if (tier === "EASY" && trio.some((p) => apps(p) < 100)) continue;
    // the trap: in the hard rounds the imposter shares a club with the genuines
    const need = tier === "IMPOSSIBLE" ? 2 : tier === "HARD" ? 1 : 0;
    const imp = shuffle(imps).find((p) => trio.filter((q) => share(p, q)).length >= need);
    if (!imp) continue;
    return { trio, imp };
  }
  return null;
};

const PARTICLES = new Set(["van", "de", "di", "del", "da", "dos", "mac", "ter", "von", "le"]);
const SHOW_OVERRIDE = { "Cristiano Ronaldo": ["Cristiano", "RONALDO"], "Ronaldo Nazário": ["", "RONALDO"], "Vinícius Júnior": ["", "VINÍCIUS JR"], "Son Heung-min": ["Heung-min", "SON"], "Marcelo Vieira": ["", "MARCELO"], "Alisson Becker": ["", "ALISSON"] };
const showOf = (n) => {
  if (SHOW_OVERRIDE[n]) return SHOW_OVERRIDE[n];
  const t = n.split(" ");
  if (t.length === 1) return ["", n.toUpperCase()];
  const k = t.findIndex((w, i) => i > 0 && PARTICLES.has(w.toLowerCase()));
  const cut = k > 0 ? k : t.length - 1;
  return [t.slice(0, cut).join(" "), t.slice(cut).join(" ").toUpperCase()];
};

for (let attempt = 0; attempt < 300; attempt++) {
  const taken = new Set();
  const clubsUsed = new Set();
  const rounds = [];
  for (const tier of TIERS) {
    let got = null;
    for (const club of shuffle(Object.keys(CLUBS)).filter((k) => !clubsUsed.has(k))) {
      got = pickRound(tier, club, taken);
      if (got) {
        const cardsOut = shuffle([...got.trio.map((p) => p.name), got.imp.name]);
        rounds.push({ tier, club, cards: cardsOut, imp: got.imp.name, real: realOf(got.imp, club)[0], ...(tier === "IMPOSSIBLE" ? { withheld: true } : {}) });
        for (const n of cardsOut) taken.add(n);
        clubsUsed.add(club);
        break;
      }
    }
    if (!got) break;
  }
  if (rounds.length !== 6) continue;
  const names = rounds.flatMap((r) => r.cards);
  const byName = new Map(P.map((p) => [p.name, p]));
  if (names.some((n) => showOf(n)[1].length > 14)) continue;
  const ed = {
    _doc: `SPOT THE IMPOSTER edition ${edition.slice(1)} — generated by lab/imposter-generate.mjs (seed ${seed}). Gate: node lab/imposter-facts.mjs --edition ${edition}`,
    rounds,
    show: Object.fromEntries(names.map((n) => [n, showOf(n)])),
    display: Object.fromEntries(names.filter((n) => byName.get(n).position !== byName.get(n).cardPosition).map((n) => [n, { nation: byName.get(n).nation, position: byName.get(n).position }])),
    search: {},
  };
  writeFileSync(path.join(ED_DIR, `imposter-${edition}.json`), JSON.stringify(ed, null, 1) + "\n");
  const r = spawnSync("node", [path.join(dir, "imposter-facts.mjs"), "--edition", edition], { encoding: "utf8" });
  if (r.status !== 0) {
    process.stdout.write(r.stdout.split("\n").filter((l) => /✗|FAILED|^\s+-/.test(l)).join("\n") + "\n");
    process.stderr.write(r.stderr);
    process.exit(1);
  }
  for (const x of rounds) console.log(`${x.tier.padEnd(10)} ${CLUBS[x.club].show.padEnd(18)} ${x.cards.map((n) => (n === x.imp ? `[${n}]` : n)).join(", ")}  → ${CLUBS[x.real].show}`);
  console.log(`imposter-generate: ${edition} written and gated (all three sources agree)`);
  process.exit(0);
}
throw new Error("imposter-generate: no edition found — widen the pool or free the ledger");
