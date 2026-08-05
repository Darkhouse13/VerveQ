// Renders the hero brand promos to out/<date>/<name>.mp4, generating each
// soundtrack first if needed.
//
//   node promo.mjs                        # render all of them
//   node promo.mjs settle-it              # render one by name
//   node promo.mjs group-chat anthem      # or any subset
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ensurePromoAudio } from "./promo/audio-gen.mjs";
import { ensureVersusAudio } from "./promo/versus-audio.mjs";
import { ensureQuizTeaseAudio } from "./promo/quiztease-audio.mjs";
import { ensureGroupChatAudio } from "./promo/groupchat-audio.mjs";
import { ensureOneMoreAudio } from "./promo/onemore-audio.mjs";
import { ensureAnthemAudio } from "./promo/anthem-audio.mjs";
import { ensureBreakingAudio } from "./promo/breaking-audio.mjs";
import { ensureWrappedAudio } from "./promo/wrapped-audio.mjs";
import { ensureFanTypesAudio } from "./promo/fantypes-audio.mjs";
import { ensureRematchAudio } from "./promo/rematch-audio.mjs";
import { ensureRememberAudio } from "./promo/remember-audio.mjs";
import { ensureLicenseAudio } from "./promo/license-audio.mjs";
import { ensureFinalAudio } from "./promo/final-audio.mjs";
import { ensureHorrorAudio } from "./promo/horror-audio.mjs";
import { ensureAsmrAudio } from "./promo/asmr-audio.mjs";
import { ensureSpeedrunAudio } from "./promo/speedrun-audio.mjs";
import { ensureTutorialAudio } from "./promo/tutorial-audio.mjs";
import { ensureReceiptAudio } from "./promo/receipt-audio.mjs";
import { ensureDeparturesAudio } from "./promo/departures-audio.mjs";
import { ensureLoopAudio } from "./promo/loop-audio.mjs";
import { ensureSemifinalAudio } from "./promo/semifinal-audio.mjs";
import { ensureSemifinalVo } from "./promo/semifinal-vo.mjs";
import { ensureDrawAudio } from "./promo/draw-audio.mjs";
import { ensureLadderAudio } from "./promo/ladder-audio.mjs";
import { ensureLadderLongAudio } from "./promo/ladderlong-audio.mjs";
import { ensureLadderLongVo } from "./promo/ladderlong-vo.mjs";
import { readEditions as readLadderLongEditions } from "./promo/ladderlong-grid.mjs";
import { ensureChainAudio } from "./promo/chain-audio.mjs";
import { ensureWallAudio } from "./promo/wall-audio.mjs";
import { ensurePickASideAudio } from "./promo/pickaside-audio.mjs";
import { ensureLongChainAudio } from "./promo/longchain-audio.mjs";
import { ensureNotTellingAudio } from "./promo/nottelling-audio.mjs";
import { buildPromoCaption } from "./promo/captions.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const today = new Date().toISOString().slice(0, 10);
const outDir = path.join(dir, "out", today);
mkdirSync(outDir, { recursive: true });

const PROMOS = [
  { name: "settle-it", id: "BrandPromo", audio: ensurePromoAudio },
  { name: "versus", id: "Versus", audio: ensureVersusAudio },
  { name: "quiz", id: "QuizTease", audio: ensureQuizTeaseAudio },
  { name: "group-chat", id: "GroupChat", audio: ensureGroupChatAudio },
  { name: "one-more", id: "OneMore", audio: ensureOneMoreAudio },
  { name: "anthem", id: "Anthem", audio: ensureAnthemAudio },
  { name: "breaking", id: "Breaking", audio: ensureBreakingAudio },
  { name: "wrapped", id: "Wrapped", audio: ensureWrappedAudio },
  { name: "fan-types", id: "FanTypes", audio: ensureFanTypesAudio },
  { name: "rematch", id: "Rematch", audio: ensureRematchAudio },
  { name: "remember", id: "Remember", audio: ensureRememberAudio },
  { name: "license", id: "License", audio: ensureLicenseAudio },
  { name: "final", id: "Final", audio: ensureFinalAudio },
  { name: "horror", id: "Horror", audio: ensureHorrorAudio },
  { name: "asmr", id: "Asmr", audio: ensureAsmrAudio },
  { name: "speedrun", id: "Speedrun", audio: ensureSpeedrunAudio },
  { name: "tutorial", id: "Tutorial", audio: ensureTutorialAudio },
  { name: "receipt", id: "Receipt", audio: ensureReceiptAudio },
  { name: "departures", id: "Departures", audio: ensureDeparturesAudio },
  { name: "loop", id: "Loop", audio: ensureLoopAudio },
  // Dated one-off (England v Argentina, 15 Jul 2026) — not evergreen like the
  // rest of the set. `vo` is the narrated track; every other promo is pure
  // synthesis and has none.
  { name: "semi-final", id: "SemiFinal", audio: ensureSemifinalAudio, vo: ensureSemifinalVo },
  // THE DRAW launch promo v2 — the viewer makes the BANK-or-PUSH call live.
  { name: "the-decision", id: "TheDecision", audio: ensureDrawAudio },
  // The retention lane: gauntlet, relay and wall. Unlike the rest of this list
  // these are not brand ads — they're playable content that happens to end at
  // verveq.com, which is why none of them resolves fully on screen.
  { name: "ladder", id: "Ladder", audio: ensureLadderAudio },
  { name: "chain", id: "Chain", audio: ensureChainAudio },
  { name: "wall", id: "Wall", audio: ensureWallAudio },
  // The format-test batch (2026-07-25). Each moves exactly ONE variable
  // against `chain`, so whichever wins tells us WHY. See RESEARCH_DIGEST.md
  // for the hypotheses and SCRIPTS_PHASE2.md for the beat sheets.
  { name: "pick-a-side", id: "PickASide", audio: ensurePickASideAudio },
  { name: "long-chain", id: "LongChain", audio: ensureLongChainAudio },
  { name: "not-telling", id: "NotTelling", audio: ensureNotTellingAudio },
  // LADDER-LONG — the retention lane rebuilt on FACELESS_WINNER_SPEC: ten rungs,
  // nine answered, rung 10 withheld and asked for out loud. One component, and
  // the VO carrier is shared across every edition (promo/ladderlong-vo.mjs)
  // exactly as the winners' is.
  //   batch 1 (2026-08-01) — four editions at a metronomic 7.00s/rung.
  //   batch 2 (2026-08-05) — four more, running a CADENCE A/B (two at 7.00s,
  //     two at 5.50s) over a new running-scoreboard surface and a follow hook.
  // Derived from the editions table rather than listed, so adding a ninth
  // edition stays a one-file change in src/promo/ladderlong/timeline.ts.
  ...readLadderLongEditions().map((ed) => ({
    name: `ladder-long-${ed.slug}`,
    id: `LadderLong-${ed.slug}`,
    audio: ensureLadderLongAudio,
    vo: () => ensureLadderLongVo({ soft: true }),
  })),
];

const want = process.argv.slice(2);
const unknown = want.filter((w) => !PROMOS.some((p) => p.name === w));
if (unknown.length > 0) {
  console.error(`Unknown promo(s) ${unknown.join(", ")}. One of: ${PROMOS.map((p) => p.name).join(", ")}`);
  process.exit(1);
}
const list = want.length > 0 ? PROMOS.filter((p) => want.includes(p.name)) : PROMOS;

// generate every needed soundtrack up front, then bundle once. A promo with a
// voiceover resolves it from promo/vo-cache/ (offline, no API key) and mirrors
// it into public/ — see promo/semifinal-vo.mjs.
for (const p of list) {
  if (p.vo) await p.vo();
  p.audio();
}
console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: path.join(dir, "src", "index.ts"), publicDir: path.join(dir, "public") });

for (const p of list) {
  const out = path.join(outDir, `verveq-${p.name}.mp4`);
  const composition = await selectComposition({ serveUrl, id: p.id });
  console.log(`\n[${p.name}] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: out,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 20) * 5;
      if (pct > last) {
        last = pct;
        process.stdout.write(pct + "% ");
      }
    },
  });
  writeFileSync(out.replace(/\.mp4$/, ".txt"), buildPromoCaption(p.name));
  console.log(`\n  → ${out} (+ caption .txt)`);
}
console.log("\nDone.");
