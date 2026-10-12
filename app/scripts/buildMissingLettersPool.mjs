#!/usr/bin/env node
// MISSING LETTERS — build the in-game player pool from the content factory's
// fact gate, the same one every Missing Letters reel ships under.
//
//   node scripts/buildMissingLettersPool.mjs [--fetch]  -> convex/data/missing_letters_players.json
//   node scripts/buildMissingLettersPool.mjs --check    -> exit 1 if the file is stale
//
// Candidates are THE DRAW cards (fameRank <= 300, drawCardsReal.candidates.json).
// A player enters the pool only when:
//   spelling — the card name equals BOTH the Wikidata English label and the
//              enwiki article title (tools/content-factory/lab/older-dob-cache.json);
//   clue     — the nation shown is a Wikidata P1532 ("country for sport") value
//              (tools/content-factory/lab/letters-cache.json; --fetch fills
//              missing entries live from Wikidata and writes them back);
//   board    — at least five letters, so a board can hide something and still
//              leave a name on screen.
// `fame` is the card's fameRank: lib/missingLetters.ts cuts the EASY / MEDIUM /
// HARD bands from it.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.join(here, "..", "..", "tools", "content-factory", "lab");
const OLDER = JSON.parse(readFileSync(path.join(LAB, "older-dob-cache.json"), "utf8"));
const NATIONS_PATH = path.join(LAB, "letters-cache.json");
const CARDS = JSON.parse(readFileSync(path.join(here, "..", "convex", "data", "drawCardsReal.candidates.json"), "utf8"));
const OUT = path.join(here, "..", "convex", "data", "missing_letters_players.json");
const UA = "VerveQ-app/1.0 (https://verveq.com; missing letters pool)";
const MAX_FAME = 300;

const nations = existsSync(NATIONS_PATH) ? JSON.parse(readFileSync(NATIONS_PATH, "utf8")) : {};
// Wikidata's P1532 labels vs THE DRAW's nation strings (same table as lab/letters-facts.mjs).
const NATION_ALIAS = {
  "Ivory Coast": ["Ivory Coast", "Côte d'Ivoire"],
  "Czech Republic": ["Czech Republic", "Czechia"],
  "South Korea": ["South Korea"],
  Netherlands: ["Netherlands", "Kingdom of the Netherlands"],
};
const nationOk = (nation, labels) => (NATION_ALIAS[nation] ?? [nation]).some((n) => labels.includes(n));
const spellingOk = (name) => {
  const c = OLDER[name];
  return Boolean(c?.qid && c.label === name && c.wikipedia?.title === name);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function wd(params) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return res.json();
    await sleep(3000 * (attempt + 1));
  }
  throw new Error(`gave up on ${url}`);
}
async function fetchSportCountries(qid) {
  const e = await wd({ action: "wbgetentities", ids: qid, props: "claims" });
  const ids = (e.entities[qid].claims?.P1532 ?? [])
    .filter((c) => c.rank !== "deprecated")
    .map((c) => c.mainsnak.datavalue?.value?.id)
    .filter(Boolean);
  await sleep(1000);
  if (!ids.length) return [];
  const l = await wd({ action: "wbgetentities", ids: ids.join("|"), props: "labels", languages: "en" });
  await sleep(1000);
  return ids.map((id) => l.entities[id]?.labels?.en?.value).filter(Boolean);
}

const candidates = CARDS.filter(
  (c) => c.fameRank <= MAX_FAME && spellingOk(c.name) && c.name.replace(/[^\p{L}]/gu, "").length >= 5,
);

if (process.argv.includes("--fetch")) {
  let fetched = 0;
  for (const c of candidates) {
    const qid = OLDER[c.name].qid;
    if (nations[qid]) continue;
    nations[qid] = await fetchSportCountries(qid);
    fetched++;
    writeFileSync(NATIONS_PATH, JSON.stringify(nations, null, 1));
  }
  console.log(`fetched P1532 for ${fetched} players`);
}

const byQid = new Map();
const dropped = [];
for (const c of candidates) {
  const qid = OLDER[c.name].qid;
  if (!nationOk(c.nation, nations[qid] ?? [])) {
    dropped.push(`${c.name} (${c.nation} vs ${JSON.stringify(nations[qid] ?? null)})`);
    continue;
  }
  if (!byQid.has(qid)) byQid.set(qid, { id: qid, name: c.name, nation: c.nation, fame: c.fameRank });
}

const players = [...byQid.values()].sort((a, b) => a.fame - b.fame || a.name.localeCompare(b.name));
const out = `${JSON.stringify(players, null, 1)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== out) {
    console.error("missing_letters_players.json is stale — re-run scripts/buildMissingLettersPool.mjs");
    process.exit(1);
  }
  console.log(`ok: ${players.length} players`);
} else {
  writeFileSync(OUT, out);
  console.log(`${players.length} players -> ${path.relative(process.cwd(), OUT)}`);
  console.log(`dropped (nation clue not in Wikidata P1532): ${dropped.join(", ") || "none"}`);
}
