// Concept editions for the 20:30 feed slot — one command per reel:
//   node lab/concept-render.mjs imposter e2
//   node lab/concept-render.mjs older e3
//
// fact gate for that edition (writes the active facts.json, then re-asserts it
// offline) → sound bed → Remotion render from the concept's root → caption →
// delivery gate. Out to out/concepts/<concept>-<edition>/ with the gate log.
// Edition e1 of each is the posted 2026-09-22/23 test; its renderers stay as
// they were (lab/imposter-render.mjs, lab/render.mjs lab-older).
import path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");
const [concept, edition] = process.argv.slice(2);
if (!/^e\d+$/.test(edition ?? "") || edition === "e1") throw new Error("usage: node lab/concept-render.mjs <imposter|older> <e2|e3|…>");

const CONCEPTS = {
  imposter: {
    facts: "imposter-facts.mjs",
    entry: path.join("src", "lab", "imposter", "index.ts"),
    id: "LabImposter",
    slug: "imposter",
    audio: async () => (await import("./imposter-audio.mjs")).ensureImposterAudio(true),
    verify: (out) => ["imposter-verify.mjs", [], { IMPOSTER_VERIFY_OUT: out }],
    caption: (f) => {
      const imp = f.rounds.find((r) => r.withheld);
      return [
        "3 of them played for the club. 1 never did. Can you spot all 6 imposters?",
        "",
        `Round 6 is ${imp.club.show === "AC MILAN" ? "AC Milan" : imp.club.show.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}. Your answer 👇 (be honest if you Googled)`,
        "",
        "Play the daily football quiz free at verveq.com",
        "",
        "#footballquiz #football #premierleague #championsleague #footballtrivia",
        "",
      ].join("\n");
    },
  },
  older: {
    facts: "older-facts.mjs",
    entry: path.join("src", "lab", "index.ts"),
    id: "LabWhosOlder",
    slug: "lab-older",
    audio: async () => (await import("./audio.mjs")).ensureLabOlderAudio(),
    verify: (out) => ["verify.mjs", ["", "lab-older"], { LAB_VERIFY_OUT: out }],
    caption: (f) => {
      const first = f.rounds[0];
      const last = f.rounds[f.rounds.length - 1];
      return [
        `Who's older? Ten rounds, and the gap shrinks every round — ${first.gap.toLowerCase()} down to ${last.gap.toLowerCase()}.`,
        "",
        "Your streak, 0 to 10, in the comments.",
        "",
        "Play today's Who's Older free → verveq.com/older",
        "",
        "#football #whosolder #footballquiz #footballtrivia #premierleague",
        "",
      ].join("\n");
    },
  },
};
const C = CONCEPTS[concept];
if (!C) throw new Error(`unknown concept ${concept}: one of ${Object.keys(CONCEPTS)}`);

const outDir = path.join(root, "out", "concepts", `${concept}-${edition}`);
mkdirSync(outDir, { recursive: true });
const run = (label, args, env = {}) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r.stdout ?? "";
};

const gateLog = run(`fact gate · ${concept} ${edition}`, [path.join("lab", C.facts), "--edition", edition]);
writeFileSync(path.join(outDir, "gate.log"), gateLog);
run("fact gate · offline re-assert", [path.join("lab", C.facts), "--edition", edition, "--check"]);
const factsPath = path.join(root, "src", "lab", concept === "imposter" ? "imposter" : "older", "facts.json");
const { readFileSync } = await import("node:fs");
const facts = JSON.parse(readFileSync(factsPath, "utf8"));
if (facts.edition !== edition) throw new Error(`facts.json holds ${facts.edition}, not ${edition}`);
await C.audio();

console.log(`\nBundling ${C.entry}…`);
const serveUrl = await bundle({ entryPoint: path.join(root, C.entry), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: C.id });
const out = path.join(outDir, `${C.slug}.mp4`);
console.log(`\n[${concept} ${edition}] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
let last = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  audioCodec: "aac",
  concurrency: process.env.LAB_CONCURRENCY ? Number(process.env.LAB_CONCURRENCY) : undefined,
  outputLocation: out,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 20) * 5;
    if (pct > last) {
      last = pct;
      process.stdout.write(pct + "% ");
    }
  },
});
writeFileSync(out.replace(/\.mp4$/, ".txt"), C.caption(facts));
writeFileSync(path.join(outDir, "facts.json"), JSON.stringify(facts, null, 1));
console.log(`\n  → ${out} (+ caption .txt, facts.json, gate.log)`);

// the bundle copies all of public/ (~330 MB) into /tmp, a RAM disk here —
// twenty renders without cleanup fill it (EDQUOT, 2026-09-25)
const { rmSync } = await import("node:fs");
if (serveUrl.startsWith("/tmp/")) rmSync(serveUrl, { recursive: true, force: true });

const [script, args, env] = C.verify(outDir);
run("delivery gate", [path.join("lab", script), ...args], env);
console.log(`\nconcept-render: DONE — ${outDir}`);
