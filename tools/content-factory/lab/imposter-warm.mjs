// Fill the imposter gate's Wikidata + Wikipedia caches for the famous pool
// (THE DRAW cards by fameRank), so lab/imposter-generate.mjs can pick rounds
// from data the gate will then re-check. Idempotent; resumable.
//
//   node lab/imposter-warm.mjs [--top 250]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolvePlayer, resolveWikipedia } from "./imposter-facts.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(dir, "..", "..", "..", "app", "convex", "data");
const CACHE = path.join(dir, "imposter-wikidata-cache.json");
const WP_CACHE = path.join(dir, "imposter-wikipedia-cache.json");
const TOP = process.argv.includes("--top") ? Number(process.argv[process.argv.indexOf("--top") + 1]) : 250;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const paths = JSON.parse(readFileSync(path.join(DATA, "football_career_paths.json"), "utf8"));
const inData = new Set(paths.map((p) => p.answerName));
const pool = JSON.parse(readFileSync(path.join(DATA, "drawCardsReal.candidates.json"), "utf8"))
  .filter((c) => c.fameRank <= TOP && inData.has(c.name) && paths.filter((p) => p.answerName === c.name).length === 1)
  .sort((a, b) => a.fameRank - b.fameRank);
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : { players: {}, clubs: {} };
const wp = existsSync(WP_CACHE) ? JSON.parse(readFileSync(WP_CACHE, "utf8")) : {};
console.log(`pool: ${pool.length} famous players (fameRank ≤ ${TOP})`);
let done = 0;
for (const c of pool) {
  const n = c.name;
  try {
    if (!cache.players[n]) {
      cache.players[n] = await resolvePlayer(n);
      writeFileSync(CACHE, JSON.stringify(cache, null, 1));
      await sleep(1500);
    }
    const q = cache.players[n].qid;
    if (!wp[n] || wp[n].qid !== q || wp[n].parser !== 3) {
      wp[n] = { qid: q, ...(await resolveWikipedia(q)) };
      writeFileSync(WP_CACHE, JSON.stringify(wp, null, 1));
      await sleep(1500);
    }
  } catch (e) {
    console.log(`  ✗ ${n}: ${e.message.slice(0, 120)}`);
  }
  if (++done % 25 === 0) console.log(`  ${done}/${pool.length}`);
}
console.log("warm: done");
