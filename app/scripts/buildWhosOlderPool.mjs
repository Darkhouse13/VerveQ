#!/usr/bin/env node
// WHO'S OLDER? — build the in-game player pool from the content factory's
// fact gate (tools/content-factory/lab/older-dob-cache.json).
//
//   node scripts/buildWhosOlderPool.mjs          -> convex/data/whos_older_players.json
//   node scripts/buildWhosOlderPool.mjs --check  -> exit 1 if the file is stale
//
// A player enters the pool only when BOTH sources agree to the day: the
// Wikidata P569 birth date (day precision, resolved to a QID whose description
// says "footballer" or "football player") and the English Wikipedia infobox
// date reached through that QID's sitelink. This is the same double-source rule every Who's Older
// reel ships under; a name either source disputes stays out. Grow the pool by
// adding names to the reel editions and re-running lab/older-facts.mjs, then
// this script.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(here, "..", "..", "tools", "content-factory", "lab", "older-dob-cache.json");
const OUT = path.join(here, "..", "convex", "data", "whos_older_players.json");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const cache = JSON.parse(readFileSync(CACHE, "utf8"));
const byQid = new Map();
const dropped = [];
for (const [name, entry] of Object.entries(cache)) {
  const dob = entry.dob;
  const ok =
    typeof entry.qid === "string" &&
    DATE_RE.test(dob ?? "") &&
    entry.wikipedia?.dob === dob &&
    /football(er| player)/i.test(entry.description ?? "");
  if (!ok) {
    dropped.push(name);
    continue;
  }
  // One row per person: two casting names can resolve to the same QID.
  if (!byQid.has(entry.qid)) byQid.set(entry.qid, { id: entry.qid, name, dob });
}

const players = [...byQid.values()].sort((a, b) => a.name.localeCompare(b.name));
const out = `${JSON.stringify(players, null, 1)}\n`;

if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== out) {
    console.error(`whos_older_players.json is stale — re-run scripts/buildWhosOlderPool.mjs`);
    process.exit(1);
  }
  console.log(`ok: ${players.length} players`);
} else {
  writeFileSync(OUT, out);
  console.log(`${players.length} players -> ${path.relative(process.cwd(), OUT)}`);
  console.log(`dropped (not double-sourced): ${dropped.join(", ") || "none"}`);
}
