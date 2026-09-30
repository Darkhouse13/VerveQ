// Concept tests of 2026-09-25 — shared render pipeline + the two LAB-root
// reels (THE XI, GUESS WHO), one command each:
//
//   node lab/tests-render.mjs xi
//   node lab/tests-render.mjs guesswho
//
// (test-tierlist and test-xidebate have their own lab/<name>-render.mjs,
// which call renderTest() below.)
//
// fact gate (writes facts.json; its log → gate.log) → offline re-assert
// (--check) → sound bed → Remotion render → caption → facts.json copy →
// delivery gate. Out to out/concepts/test-<name>/. Nothing is queued/posted.
import path from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dir, "..");

const run = (label, args, env = {}) => {
  console.log(`\n── ${label}`);
  const r = spawnSync("node", args, { cwd: root, encoding: "utf8", env: { ...process.env, ...env } });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status !== 0) process.exit(r.status ?? 1);
  return (r.stdout ?? "") + (r.stderr ?? "");
};

// cfg: { test, gate, facts, entry, id, slug, audio(), caption(facts), verify: [script, args, env] }
export const renderTest = async (cfg) => {
  const outDir = path.join(root, "out", "concepts", `test-${cfg.test}`);
  mkdirSync(outDir, { recursive: true });
  const log = run(`fact gate · ${cfg.test}`, [path.join("lab", cfg.gate)]);
  const recheck = run("fact gate · offline re-assert", [path.join("lab", cfg.gate), "--check"]);
  writeFileSync(path.join(outDir, "gate.log"), `$ node lab/${cfg.gate}\n${log}\n$ node lab/${cfg.gate} --check\n${recheck}`);
  const facts = JSON.parse(readFileSync(path.join(root, cfg.facts), "utf8"));
  await cfg.audio();

  console.log(`\nBundling ${cfg.entry}…`);
  const serveUrl = await bundle({ entryPoint: path.join(root, cfg.entry), publicDir: path.join(root, "public") });
  const composition = await selectComposition({ serveUrl, id: cfg.id });
  const out = path.join(outDir, `${cfg.slug}.mp4`);
  console.log(`\n[${cfg.test}] ${composition.durationInFrames}f (${(composition.durationInFrames / composition.fps).toFixed(1)}s)…`);
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
  writeFileSync(out.replace(/\.mp4$/, ".txt"), cfg.caption(facts));
  writeFileSync(path.join(outDir, "facts.json"), JSON.stringify(facts, null, 1));
  console.log(`\n  → ${out} (+ caption .txt, facts.json, gate.log)`);
  const [script, args, env] = cfg.verify(outDir);
  const vlog = run("delivery gate", [path.join("lab", script), ...args], env);
  writeFileSync(path.join(outDir, "verify.log"), vlog);
  console.log(`\ntests-render: DONE — ${outDir}`);
};

const TAIL = ["", "Play the daily football quiz free at verveq.com", ""];
const LAB = {
  xi: {
    test: "xi",
    gate: "xi-facts.mjs",
    facts: path.join("src", "lab", "xi", "facts.json"),
    entry: path.join("src", "lab", "index.ts"),
    id: "LabTheXI",
    slug: "lab-xi",
    audio: async () => (await import("./audio.mjs")).ensureLabXIAudio(),
    caption: () =>
      [
        "Eleven players. One club connects every one of them.",
        "",
        "Which name gave it away for you? One name in the comments 👇",
        ...TAIL,
        "#football #footballquiz #seriea #premierleague #footballtrivia",
        "",
      ].join("\n"),
    verify: (out) => ["verify.mjs", ["", "lab-xi"], { LAB_VERIFY_OUT: out }],
  },
  guesswho: {
    test: "guesswho",
    gate: "guesswho-facts.mjs",
    facts: path.join("src", "lab", "guesswho", "facts.json"),
    entry: path.join("src", "lab", "index.ts"),
    id: "LabGuessWho",
    slug: "lab-guesswho",
    audio: async () => (await import("./audio.mjs")).ensureLabGuessWhoAudio(),
    caption: () =>
      [
        "Nine names. Six questions. Two left, and I'm not flipping the last one.",
        "",
        "Which one is he? One name in the comments 👇",
        ...TAIL,
        "#football #guesswho #footballquiz #footballtrivia #premierleague",
        "",
      ].join("\n"),
    verify: (out) => ["verify.mjs", ["", "lab-guesswho"], { LAB_VERIFY_OUT: out }],
  },
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = LAB[process.argv[2]];
  if (!cfg) throw new Error(`usage: node lab/tests-render.mjs <${Object.keys(LAB).join("|")}>`);
  await renderTest(cfg);
}
