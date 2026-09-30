// Take scheduled posts back out of VerveQ's Postiz.
//
//   node unschedule.mjs <date>:<slot> [<date>:<slot> …] [--forget] [--dry-run]
//
// Runs on the box inside the social-runner container, next to publish.mjs
// (queue.mjs `unschedule` copies it there and calls it). For each date:slot it
// deletes the Instagram and Facebook post in Postiz, removes the queue folder
// so the slot is not re-read, and marks the posted-keys entry as deleted.
// The entry is KEPT by default so the daily publisher never re-creates the
// post; --forget drops it instead, so the same date:slot can be scheduled
// again with new content.
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const QUEUE_DIR = process.env.SOCIAL_QUEUE_DIR || "/data/queue";
const STATUS_DIR = process.env.SOCIAL_STATUS_DIR || "/data/status";
const API_URL = (process.env.POSTIZ_API_URL || "https://postiz.verveq.com/api").replace(/\/$/, "");
const API_KEY = process.env.POSTIZ_API_KEY || "";
const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const forget = argv.includes("--forget");
const targets = argv.filter((a) => !a.startsWith("--"));
if (!targets.length || targets.some((t) => !/^\d{4}-\d{2}-\d{2}:[a-z0-9-]+$/.test(t))) throw new Error("usage: unschedule.mjs <YYYY-MM-DD>:<slot> … [--forget] [--dry-run]");
if (!API_KEY && !dryRun) throw new Error("POSTIZ_API_KEY is required for a live run");

const storePath = join(STATUS_DIR, "posted-keys.json");
const store = existsSync(storePath) ? JSON.parse(readFileSync(storePath, "utf8")) : {};

async function del(id) {
  const res = await fetch(`${API_URL}/public/v1/posts/${id}`, { method: "DELETE", headers: { Authorization: API_KEY } });
  const text = await res.text();
  if (!res.ok) throw new Error(`DELETE ${id} → ${res.status} ${text.slice(0, 200)}`);
}

let failed = 0;
for (const t of targets) {
  const [date, slot] = t.split(":");
  for (const platform of ["instagram", "facebook"]) {
    const key = `${date}:${platform}:${slot}`;
    const entry = store[key];
    if (!entry) { console.log(`${key}  not in posted-keys — nothing scheduled`); continue; }
    if (entry.deletedAt) { console.log(`${key}  already deleted ${entry.deletedAt}`); if (forget && !dryRun) delete store[key]; continue; }
    if (Date.parse(entry.scheduledFor) < Date.now()) { console.log(`${key}  SKIP — its time (${entry.scheduledFor}) has passed, it is live`); continue; }
    if (dryRun) { console.log(`${key}  would delete Postiz post ${entry.postizId}`); continue; }
    try {
      await del(entry.postizId);
      if (forget) delete store[key];
      else store[key] = { ...entry, deletedAt: new Date().toISOString() };
      writeFileSync(storePath, JSON.stringify(store, null, 2) + "\n");
      console.log(`${key}  deleted (${entry.postizId})${forget ? ", key forgotten" : ""}`);
    } catch (err) {
      failed++;
      console.log(`${key}  FAILED — ${err.message}`);
    }
  }
  const dir = join(QUEUE_DIR, date, slot);
  if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
