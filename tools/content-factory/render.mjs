// VerveQ content factory — batch renderer.
//
//   node render.mjs --count 7 --difficulty easy
//   node render.mjs --id cp-messi,cp-neymar
//   node render.mjs --count 5 --dry        (preview the picks, render nothing)
//
// Picks entries from the Career Path dataset that are not yet in ledger.json,
// renders one vertical MP4 per entry into out/<date>/, and records each id in
// the ledger so the same player is never rendered twice.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { buildCaption } from "./captions.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const DATASET = path.join(dir, "..", "..", "app", "convex", "data", "football_career_paths.json");
const LEDGER = path.join(dir, "ledger.json");

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 || i === args.length - 1 ? def : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);

const count = Number(flag("count", "7"));
const difficulty = flag("difficulty", "all");
const onlyIds = flag("id", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const dry = has("dry");

const entries = JSON.parse(readFileSync(DATASET, "utf8"));
const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));

let picks;
if (onlyIds.length > 0) {
  picks = onlyIds.map((id) => {
    const e = entries.find((x) => x.id === id);
    if (!e) throw new Error(`Unknown id: ${id}`);
    return e;
  });
} else {
  const pool = entries.filter(
    (e) => !ledger[e.id] && (difficulty === "all" || e.difficulty === difficulty),
  );
  if (pool.length === 0) {
    console.error(`No unused entries left for difficulty="${difficulty}".`);
    process.exit(1);
  }
  // Shuffle so a batch mixes eras/leagues instead of walking the file order.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  picks = pool.slice(0, count);
}

const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(dir, "out", today);

console.log(`Picks (${picks.length}):`);
for (const e of picks) {
  console.log(`  ${e.id}  [${e.difficulty}]  ${e.clubs.length} clubs  → ${e.answerName}`);
}
if (dry) process.exit(0);

// Captions are fixed before rendering starts so a crash mid-batch still
// leaves every finished MP4 with its caption file beside it.
const captions = new Map(picks.map((e) => [e.id, buildCaption(e)]));

mkdirSync(outDir, { recursive: true });

console.log("\nBundling composition…");
const serveUrl = await bundle({ entryPoint: path.join(dir, "src", "index.ts") });

for (const [i, entry] of picks.entries()) {
  const inputProps = { entry };
  const composition = await selectComposition({
    serveUrl,
    id: "CareerPathReveal",
    inputProps,
  });
  const outputLocation = path.join(outDir, `${entry.id}.mp4`);
  console.log(`\n[${i + 1}/${picks.length}] ${entry.answerName} (${composition.durationInFrames}f)…`);
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    inputProps,
    outputLocation,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct > lastPct) {
        lastPct = pct;
        process.stdout.write(`${pct}% `);
      }
    },
  });
  writeFileSync(outputLocation.replace(/\.mp4$/, ".txt"), captions.get(entry.id));
  // Write the ledger after every video, not at the end — a crash mid-batch
  // must not cause already-rendered players to be picked again.
  ledger[entry.id] = today;
  writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
  console.log(`\n  → ${outputLocation} (+ caption .txt)`);
}

console.log(`\nDone. ${picks.length} video(s) in ${outDir}`);
