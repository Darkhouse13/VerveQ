// PAUSE IT — fact gate. Every club on screen comes from VerveQ's PRODUCTION
// fantasyPlayers table (reconciled against API-Football's current squads),
// never from memory: the 2026 summer window moved a lot of these names.
//
//   node lab/pause-facts.mjs                 # pulls prod live (npx convex data … --prod)
//   node lab/pause-facts.mjs --from rows.jsonl   # re-gate against a saved dump
//
// Players are pinned by providerPlayerId (stable across renames) AND the prod
// name is asserted, so a re-keyed row can't silently swap in someone else.
// Fails if any pick is missing, inactive, duplicated, or its clubId has no
// entry in the club map. Writes src/lab/pause/facts.json (cards + the three
// shuffled passes the composition plays) and prints the final list.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const APP = path.join(root, "..", "..", "app");
const CLUB_MAP = path.join(APP, "scripts", "squad-batch-2026-09-05", "club_map.json");
const OUT = path.join(root, "src", "lab", "pause", "facts.json");

// pid = API-Football providerPlayerId; prod = the exact prod `name`;
// first/last = on-screen type (last is the huge line); nat = flag + label
const PICKS = [
  { pid: "1100", prod: "E. Haaland", first: "ERLING", last: "HAALAND", nat: "NOR" },
  { pid: "278", prod: "Kylian Mbappé", first: "KYLIAN", last: "MBAPPÉ", nat: "FRA" },
  { pid: "184", prod: "H. Kane", first: "HARRY", last: "KANE", nat: "ENG" },
  { pid: "217", prod: "Lautaro Martínez", first: "LAUTARO", last: "MARTÍNEZ", nat: "ARG" },
  { pid: "762", prod: "Vinícius Júnior", first: "", last: "VINÍCIUS JR.", nat: "BRA" },
  { pid: "386828", prod: "Lamine Yamal", first: "LAMINE", last: "YAMAL", nat: "ESP" },
  { pid: "2864", prod: "A. Isak", first: "ALEXANDER", last: "ISAK", nat: "SWE" },
  { pid: "18979", prod: "V. Gyökeres", first: "VIKTOR", last: "GYÖKERES", nat: "SWE" },
  { pid: "115589", prod: "B. Šeško", first: "BENJAMIN", last: "ŠEŠKO", nat: "SVN" },
  { pid: "153", prod: "O. Dembélé", first: "OUSMANE", last: "DEMBÉLÉ", nat: "FRA" },
  { pid: "6009", prod: "J. Álvarez", first: "JULIÁN", last: "ÁLVAREZ", nat: "ARG" },
  { pid: "483", prod: "K. Kvaratskhelia", first: "KHVICHA", last: "KVARATSKHELIA", nat: "GEO" },
  { pid: "1460", prod: "B. Saka", first: "BUKAYO", last: "SAKA", nat: "ENG" },
  { pid: "1496", prod: "Raphinha", first: "", last: "RAPHINHA", nat: "BRA" },
  { pid: "174565", prod: "H. Ekitike", first: "HUGO", last: "EKITIKÉ", nat: "FRA" },
  { pid: "21393", prod: "S. Guirassy", first: "SERHOU", last: "GUIRASSY", nat: "GUI" },
  { pid: "288006", prod: "R. Højlund", first: "RASMUS", last: "HØJLUND", nat: "DEN" },
  { pid: "2489", prod: "L. Díaz", first: "LUIS", last: "DÍAZ", nat: "COL" },
  { pid: "19617", prod: "M. Olise", first: "MICHAEL", last: "OLISE", nat: "FRA" },
  { pid: "183799", prod: "Nico Williams", first: "NICO", last: "WILLIAMS", nat: "ESP" },
  { pid: "152982", prod: "C. Palmer", first: "COLE", last: "PALMER", nat: "ENG" },
  { pid: "875", prod: "P. Dybala", first: "PAULO", last: "DYBALA", nat: "ARG" },
  { pid: "203224", prod: "F. Wirtz", first: "FLORIAN", last: "WIRTZ", nat: "GER" },
];

// the twist: two joke cards, same frame budget as everyone else
const JOKES = [
  { key: "grandad", first: "", last: "YOUR GRANDAD", club: "SUNDAY LEAGUE", flag: "👴", natLabel: "LEGEND", colors: { bg: "#3D6B35", fg: "#FFFFFF", bar: "#F2E6C9" } },
  { key: "kitman", first: "", last: "THE KIT MAN", club: "THE LAUNDRY ROOM", flag: "🧺", natLabel: "UNSUNG", colors: { bg: "#FFFFFF", fg: "#111111", bar: "#9A9A9A" } },
];

const NAT = {
  NOR: { flag: "🇳🇴", label: "NORWAY" },
  FRA: { flag: "🇫🇷", label: "FRANCE" },
  ENG: { flag: "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", label: "ENGLAND" },
  ARG: { flag: "🇦🇷", label: "ARGENTINA" },
  BRA: { flag: "🇧🇷", label: "BRAZIL" },
  ESP: { flag: "🇪🇸", label: "SPAIN" },
  SWE: { flag: "🇸🇪", label: "SWEDEN" },
  SVN: { flag: "🇸🇮", label: "SLOVENIA" },
  GEO: { flag: "🇬🇪", label: "GEORGIA" },
  GUI: { flag: "🇬🇳", label: "GUINEA" },
  DEN: { flag: "🇩🇰", label: "DENMARK" },
  COL: { flag: "🇨🇴", label: "COLOMBIA" },
  GER: { flag: "🇩🇪", label: "GERMANY" },
};

// club colours keyed by prod clubId (bg = shirt, fg = type, bar = trim).
// A clubId a pick resolves to that is missing here fails the gate.
const CLUB_STYLE = {
  50: { bg: "#6CABDD", fg: "#1C2C5B", bar: "#1C2C5B" }, // Man City
  541: { bg: "#FFFFFF", fg: "#1B3F8B", bar: "#FEBE10" }, // Real Madrid
  157: { bg: "#DC052D", fg: "#FFFFFF", bar: "#0066B2" }, // Bayern
  505: { bg: "#0A2D8C", fg: "#FFFFFF", bar: "#111111" }, // Inter
  529: { bg: "#A50044", fg: "#FFED02", bar: "#004D98" }, // Barcelona
  40: { bg: "#C8102E", fg: "#FFFFFF", bar: "#F6EB61" }, // Liverpool
  42: { bg: "#EF0107", fg: "#FFFFFF", bar: "#FFFFFF" }, // Arsenal
  33: { bg: "#DA291C", fg: "#FBE122", bar: "#111111" }, // Man Utd
  85: { bg: "#004170", fg: "#FFFFFF", bar: "#DA291C" }, // PSG
  530: { bg: "#CB3524", fg: "#FFFFFF", bar: "#272E61" }, // Atlético
  165: { bg: "#FDE100", fg: "#111111", bar: "#111111" }, // Dortmund
  492: { bg: "#12A0D7", fg: "#FFFFFF", bar: "#003C82" }, // Napoli
  531: { bg: "#EE2523", fg: "#FFFFFF", bar: "#FFFFFF" }, // Athletic Club
  49: { bg: "#034694", fg: "#FFFFFF", bar: "#DBA111" }, // Chelsea
  497: { bg: "#8E1F2F", fg: "#F0BC42", bar: "#F0BC42" }, // Roma
};
// cosmetic only — the source of truth is club_map.ourName
const CLUB_DISPLAY = { "Paris Saint Germain": "PARIS SAINT-GERMAIN" };

const fail = (msg) => {
  console.error(`pause-facts: FAIL — ${msg}`);
  process.exit(1);
};

// ── load prod rows
const fromIdx = process.argv.indexOf("--from");
let raw;
if (fromIdx > 0) {
  raw = readFileSync(process.argv[fromIdx + 1], "utf8");
  console.log(`pause-facts: gating against saved dump ${process.argv[fromIdx + 1]}`);
} else {
  console.log("pause-facts: pulling fantasyPlayers from PROD…");
  raw = execFileSync("npx", ["convex", "data", "fantasyPlayers", "--prod", "--limit", "8000", "--format", "jsonl"], { cwd: APP, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] }).toString();
}
const rows = raw
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.startsWith("{"))
  .map((l) => JSON.parse(l));
if (rows.length < 3000) fail(`only ${rows.length} rows — the dump looks truncated`);
if (rows.length >= 8000) fail(`hit the 8000-row limit — raise --limit, the table may be cut`);
const clubMap = JSON.parse(readFileSync(CLUB_MAP, "utf8"));

// ── resolve every pick
const errors = [];
const players = PICKS.map((p) => {
  const hits = rows.filter((r) => String(r.providerPlayerId) === p.pid);
  if (hits.length === 0) return errors.push(`${p.last}: providerPlayerId ${p.pid} not in prod`), null;
  if (hits.length > 1) return errors.push(`${p.last}: ${hits.length} rows share providerPlayerId ${p.pid}`), null;
  const r = hits[0];
  if (r.name !== p.prod) errors.push(`${p.last}: prod name is "${r.name}", expected "${p.prod}"`);
  if (r.active !== true) errors.push(`${p.last}: prod row is NOT active`);
  const club = clubMap[String(r.clubId)];
  if (!club || !club.ourName) errors.push(`${p.last}: clubId ${r.clubId} missing from club_map.json`);
  const style = CLUB_STYLE[String(r.clubId)];
  if (!style) errors.push(`${p.last}: clubId ${r.clubId} (${club?.ourName}) has no colours in CLUB_STYLE`);
  const nat = NAT[p.nat];
  if (!nat) errors.push(`${p.last}: no flag for ${p.nat}`);
  return {
    key: p.pid,
    first: p.first,
    last: p.last,
    club: club ? (CLUB_DISPLAY[club.ourName] ?? club.ourName).toUpperCase() : "?",
    clubId: String(r.clubId),
    leagueId: r.leagueId,
    prodName: r.name,
    feedPosition: r.feedPosition,
    flag: nat?.flag ?? "",
    natLabel: nat?.label ?? "",
    colors: style ?? null,
  };
});
if (new Set(PICKS.map((p) => p.pid)).size !== PICKS.length) errors.push("duplicate pick");
if (errors.length > 0) fail(`\n  - ${errors.join("\n  - ")}`);

const cards = [...players, ...JOKES.map((j) => ({ ...j, joke: true }))];

// ── three shuffled passes (seeded). Every card appears exactly once per pass,
// so every card gets the same number of frames in the loop; the passes differ
// so no card owns a fixed beat. Constraints (checked across pass joins AND the
// loop seam): no club twice in a row, jokes never adjacent, pass 1 opens on a
// real player (frame 0 is the cover), jokes not in pass 1's first three slots.
const PASSES = 3;
let seed = 0x5eed2309;
const rnd = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const clash = (x, y) => (x.joke && y.joke) || (!x.joke && !y.joke && x.clubId === y.clubId);
let order = null;
for (let attempt = 0; attempt < 200000 && !order; attempt++) {
  const seq = [];
  for (let p = 0; p < PASSES; p++) seq.push(...shuffle(cards.map((c) => c.key)));
  const byKey = Object.fromEntries(cards.map((c) => [c.key, c]));
  const s = seq.map((k) => byKey[k]);
  let ok = !s[0].joke && !s[1].joke && !s[2].joke;
  for (let i = 0; ok && i < s.length; i++) if (clash(s[i], s[(i + 1) % s.length])) ok = false;
  // a card never repeats within 8 slots (pass joins could otherwise stutter)
  for (let i = 0; ok && i < s.length; i++) for (let d = 1; d <= 8; d++) if (s[i].key === s[(i + d) % s.length].key) ok = false;
  if (ok) order = seq;
}
if (!order) fail("could not find a shuffle satisfying the adjacency rules");

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify(
    {
      _comment: "GENERATED by lab/pause-facts.mjs from PROD fantasyPlayers + app/scripts/squad-batch-2026-09-05/club_map.json. Do not hand-edit — re-run the gate.",
      gatedAt: new Date().toISOString(),
      framesPerCard: 4,
      passes: PASSES,
      cards,
      order,
    },
    null,
    1,
  ) + "\n",
);

console.log(`\n${players.length} players + ${JOKES.length} joke cards, all active in prod:`);
for (const p of players) console.log(`  ${`${p.first} ${p.last}`.trim().padEnd(24)} ${p.club.padEnd(22)} ${p.natLabel.padEnd(10)} (prod "${p.prodName}", club ${p.clubId}, ${p.feedPosition})`);
for (const j of JOKES) console.log(`  ${j.last.padEnd(24)} ${j.club.padEnd(22)} (joke)`);
console.log(`\norder: ${order.length} slots × 4f = ${order.length * 4}f (${(order.length * 4) / 30}s), ${PASSES} passes`);
console.log(`pause-facts: PASS → ${path.relative(root, OUT)}`);
