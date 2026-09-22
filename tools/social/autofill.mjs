// Keeps the VerveQ feed queue topped up without anyone running anything.
//
//   node tools/social/autofill.mjs [--dry]
//
// Run daily by the systemd user timer `verveq-social-autofill` (see
// tools/social/systemd/). Rendering needs Remotion, Chrome, the Convex CLI
// and the rendered ladder reels, all of which live on this machine — the
// server only publishes. So this job runs HERE and pushes to the box.
//
// Each run looks at the last day queued locally. When fewer than MIN_BUFFER
// days remain it renders the gap up to TARGET_BUFFER days ahead (carousel +
// quiz via posts.mjs, ladder via queue.mjs fill-ladder), then pushes, which
// schedules everything in Postiz straight away. Every step is idempotent, so
// a missed day (machine off) is simply caught up on the next run.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const FACTORY = join(REPO, "tools/content-factory");
const QUEUE = join(FACTORY, "out/social");
const MIN_BUFFER = 5;
const TARGET_BUFFER = 8;
const dry = process.argv.includes("--dry");

const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;
const stamp = () => new Date().toISOString();
const log = (m) => console.log(`${stamp()} [autofill] ${m}`);

function run(cmd, args, cwd) {
  log(`$ ${cmd} ${args.join(" ")}`);
  if (dry) return;
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${r.status}`);
}

const today = iso(Date.now());
const queued = existsSync(QUEUE)
  ? readdirSync(QUEUE).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(join(QUEUE, d, "carousel", "post.json"))).sort()
  : [];
const last = queued.length ? queued[queued.length - 1] : iso(Date.now());
const bufferDays = Math.round((Date.parse(last) - Date.parse(today)) / DAY);
log(`today ${today}, last queued ${last}, ${bufferDays} day(s) ahead`);

if (bufferDays >= MIN_BUFFER) {
  log(`buffer is ${bufferDays} ≥ ${MIN_BUFFER} — nothing to render; pushing to catch any day the publisher has not scheduled yet`);
  run("node", ["tools/social/queue.mjs", "push", today, last], REPO);
  process.exit(0);
}

const from = iso(Math.max(Date.parse(last), Date.parse(today)) + DAY);
const days = Math.min(7, Math.round((Date.parse(today) + TARGET_BUFFER * DAY - Date.parse(from)) / DAY) + 1);
const to = iso(Date.parse(from) + (days - 1) * DAY);
log(`rendering ${days} day(s): ${from} … ${to}`);

run("node", ["posts.mjs", "--from", from, "--days", String(days)], FACTORY);
run("node", ["tools/social/queue.mjs", "fill-ladder", from, String(days)], REPO);
run("node", ["tools/social/queue.mjs", "push", today, to], REPO);
log("done");
