// Local side of the VerveQ feed: put content in the queue on the box.
//
//   node tools/social/queue.mjs add-reel <date> <ladder|concept> <video.mp4> <caption.txt>
//        copies a rendered reel into the local queue tree (checks 1080×1920 H.264)
//   node tools/social/queue.mjs push <from> [to]
//        uploads out/social/<from…to> to the box, then runs the publisher so the
//        posts appear in the Postiz calendar straight away (review them there)
//   node tools/social/queue.mjs fill-ladder <from> [days]
//        puts the next unposted reel from ladder-pool.json into each day's
//        ladder slot (skips days that already have one) and records it in
//        ladder-posted.json so no reel is ever queued twice
//   node tools/social/queue.mjs status
//        prints the last publisher run
//
// The local queue tree is tools/content-factory/out/social/<date>/<slot>/ —
// posts.mjs renders carousel + question there, add-reel adds the reels.
// On the box: /data/verveq-social/{queue,status,bin} (bind-mounted at /data in
// the verveq social-runner container). Never Terralore's paths or Postiz.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL_QUEUE = resolve(HERE, "../content-factory/out/social");
const HOST = process.env.VERVEQ_SOCIAL_HOST || "hetzner";
const REMOTE = "/data/verveq-social";
const RUNNER = "runner-"; // container name prefix, resolved with the service uuid below
const RUNNER_SERVICE = "eroglu2ngnvl30b1w88y1pig"; // Coolify project verveq → social-runner
const REEL_SLOTS = new Set(["ladder", "concept"]);
const FACTORY_OUT = resolve(HERE, "../content-factory/out");
const LADDER_POOL = join(HERE, "ladder-pool.json");
const LADDER_POSTED = join(HERE, "ladder-posted.json");

// The ladder captions were written for TikTok: they carry an operator block of
// per-platform links ("LINKS — paste per platform…") and a TikTok-only tag.
// Neither belongs in an Instagram or Facebook caption.
function cleanReelCaption(text) {
  return text
    .split(/\n\s*LINKS —/)[0]
    .replace(/#footballtiktok\b/g, "#footballreels")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function probeReel(video) {
  const probe = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "json", video], { encoding: "utf8" });
  const s = JSON.parse(probe.stdout || "{}").streams?.[0];
  if (!s || s.codec_name !== "h264" || s.width !== 1080 || s.height !== 1920) {
    throw new Error(`${video}: need 1080×1920 H.264, got ${s ? `${s.width}×${s.height} ${s.codec_name}` : "no video stream"}`);
  }
}

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (exit ${r.status})`);
  return r;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");
const [cmd, ...rest] = process.argv.slice(2);

if (cmd === "add-reel") {
  const [date, slot, video, captionFile] = rest;
  if (!isDate(date) || !REEL_SLOTS.has(slot) || !video || !captionFile) {
    throw new Error("usage: add-reel <YYYY-MM-DD> <ladder|concept> <video.mp4> <caption.txt>");
  }
  probeReel(video);
  const caption = readFileSync(captionFile, "utf8").trim();
  if (!caption) throw new Error(`${captionFile} is empty`);
  const dir = join(LOCAL_QUEUE, date, slot);
  mkdirSync(dir, { recursive: true });
  copyFileSync(video, join(dir, "reel.mp4"));
  writeFileSync(join(dir, "post.json"), JSON.stringify({ kind: slot, media: ["reel.mp4"], caption }, null, 2) + "\n");
  console.log(`[queue] ${date}/${slot} ready locally. Push it: node tools/social/queue.mjs push ${date}`);
} else if (cmd === "fill-ladder") {
  const [from, daysArg = "7"] = rest;
  const days = Number(daysArg);
  if (!isDate(from) || !(days >= 1 && days <= 31)) throw new Error("usage: fill-ladder <from YYYY-MM-DD> [days 1-31]");
  const pool = JSON.parse(readFileSync(LADDER_POOL, "utf8")).reels;
  const posted = existsSync(LADDER_POSTED) ? JSON.parse(readFileSync(LADDER_POSTED, "utf8")) : {};
  const free = pool.filter((r) => !posted[r.id]);
  let filled = 0;
  for (let i = 0; i < days; i += 1) {
    const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400_000).toISOString().slice(0, 10);
    const dir = join(LOCAL_QUEUE, date, "ladder");
    if (existsSync(join(dir, "post.json"))) {
      console.log(`[queue] ${date}/ladder already queued — left as is`);
      continue;
    }
    const reel = free.shift();
    if (!reel) {
      console.warn(`[queue] ${date}: ladder pool is EMPTY — render new ladder editions and add them to ladder-pool.json`);
      continue;
    }
    const video = join(FACTORY_OUT, reel.video);
    probeReel(video);
    const caption = cleanReelCaption(readFileSync(join(FACTORY_OUT, reel.caption), "utf8"));
    if (!caption) throw new Error(`${reel.caption}: caption empty after cleaning`);
    mkdirSync(dir, { recursive: true });
    copyFileSync(video, join(dir, "reel.mp4"));
    writeFileSync(join(dir, "post.json"), JSON.stringify({ kind: "ladder", source: reel.id, media: ["reel.mp4"], caption }, null, 2) + "\n");
    posted[reel.id] = date;
    writeFileSync(LADDER_POSTED, JSON.stringify(posted, null, 2) + "\n");
    filled += 1;
    console.log(`[queue] ${date}/ladder ← ${reel.id}`);
  }
  console.log(`[queue] ${filled} ladder reel(s) queued; ${free.length} left in the pool`);
} else if (cmd === "push") {
  const [from, to = from] = rest;
  if (!isDate(from) || !isDate(to) || to < from) throw new Error("usage: push <from YYYY-MM-DD> [to YYYY-MM-DD]");
  const days = existsSync(LOCAL_QUEUE) ? readdirSync(LOCAL_QUEUE).filter((d) => isDate(d) && d >= from && d <= to).sort() : [];
  if (!days.length) throw new Error(`nothing in ${LOCAL_QUEUE} between ${from} and ${to}`);
  for (const d of days) console.log(`[queue] ${d}: ${readdirSync(join(LOCAL_QUEUE, d)).sort().join(", ")}`);
  run("ssh", [HOST, `mkdir -p ${REMOTE}/queue ${REMOTE}/status ${REMOTE}/bin`]);
  run("rsync", ["-a", ...days.map((d) => join(LOCAL_QUEUE, d)), `${HOST}:${REMOTE}/queue/`]);
  // The publisher ships with the content, so the box always runs the
  // committed-with-this-batch version.
  run("rsync", ["-a", join(HERE, "publish.mjs"), join(HERE, "slots.json"), `${HOST}:${REMOTE}/bin/`]);
  run("ssh", [HOST, `docker exec $(docker ps -qf name=${RUNNER}${RUNNER_SERVICE}) node /data/bin/publish.mjs`]);
} else if (cmd === "status") {
  run("ssh", [HOST, `cat ${REMOTE}/status/last-run.json`]);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(0, 12).join("\n"));
  process.exit(cmd ? 1 : 0);
}
