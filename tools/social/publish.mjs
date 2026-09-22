// VerveQ social publisher — queue tree → scheduled posts in VerveQ's Postiz.
//
//   node publish.mjs [--date YYYY-MM-DD] [--dry-run]
//
// Runs on the Hetzner box inside the verveq social-runner container (daily
// Coolify scheduled task, and on demand after every `queue.mjs push`). Node
// stdlib only: the container has no node_modules.
//
// Queue layout (SOCIAL_QUEUE_DIR, default /data/queue):
//   <date>/<slot>/post.json   { caption, media: ["01.jpg", …] | ["reel.mp4"], platforms? }
//   <date>/<slot>/<media…>
// slot ∈ slots.json "slots" (carousel, ladder, question, concept). A missing
// slot folder is simply not posted that day.
//
// Without --date it walks today … today+lookaheadDays, so a pushed week lands
// in the Postiz calendar at once (review it there) and the daily run is the
// safety net. Idempotent: each post has a deterministic id (UUIDv5 of
// "<date>:<platform>:<slot>"), checked against a local posted-keys store and
// Postiz's own day window before anything is uploaded.
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(join(HERE, "slots.json"), "utf8"));
if (config.version !== 1) throw new Error(`unknown slots.json version ${config.version}`);
const TZ = config.timezone;

const QUEUE_DIR = process.env.SOCIAL_QUEUE_DIR || "/data/queue";
const STATUS_DIR = process.env.SOCIAL_STATUS_DIR || "/data/status";
const API_URL = (process.env.POSTIZ_API_URL || "https://postiz.verveq.com/api").replace(/\/$/, "");
const API_KEY = process.env.POSTIZ_API_KEY || "";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const dateArg = argv.includes("--date") ? argv[argv.indexOf("--date") + 1] : null;
if (dateArg && !/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) throw new Error(`--date must be YYYY-MM-DD, got ${dateArg}`);
if (!API_KEY && !dryRun) throw new Error("POSTIZ_API_KEY is required for a live run");

/* ── time: wall clock in the configured zone → UTC instant ────────────────── */

function tzOffsetMs(instantMs, tz) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instantMs)).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === "24" ? 0 : +p.hour, +p.minute, +p.second) - instantMs;
}

// Two passes so a slot near a DST change resolves against the offset in force
// at the resulting instant.
function zonedToUtc(dateIso, hhmm, tz) {
  const wall = Date.parse(`${dateIso}T${hhmm}:00Z`);
  let t = wall - tzOffsetMs(wall, tz);
  t = wall - tzOffsetMs(t, tz);
  return new Date(t);
}

const todayIn = (tz) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
const addMinutes = (hhmm, m) => {
  const t = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3)) + m;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

/* ── deterministic ids ────────────────────────────────────────────────────── */

const UUID_NS = Buffer.from("3b1f0c9e7a6d4e2f8c5b9a1d0e7f6c24", "hex");
function uuidv5(name) {
  const h = createHash("sha1").update(Buffer.concat([UUID_NS, Buffer.from(name)])).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = b.toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/* ── Postiz public API ────────────────────────────────────────────────────── */

async function api(path, init = {}) {
  const res = await fetch(`${API_URL}/public/v1${path}`, { ...init, headers: { Authorization: API_KEY, ...(init.headers || {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Postiz ${init.method || "GET"} ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4" };
async function upload(absPath, filename) {
  const ext = absPath.slice(absPath.lastIndexOf(".")).toLowerCase();
  if (!MIME[ext]) throw new Error(`unsupported media ${absPath} (jpg or mp4 only — Instagram rejects PNG)`);
  const form = new FormData();
  form.append("file", new Blob([readFileSync(absPath)], { type: MIME[ext] }), filename);
  return api("/upload", { method: "POST", body: form });
}

/* ── the run ──────────────────────────────────────────────────────────────── */

const startedAt = Date.now();
const today = todayIn(TZ);
const dates = dateArg ? [dateArg] : Array.from({ length: config.lookaheadDays + 1 }, (_, i) => addDays(today, i));

// Everything queued in the window, one entry per platform.
const planned = [];
for (const date of dates) {
  const dayDir = join(QUEUE_DIR, date);
  if (!existsSync(dayDir)) continue;
  for (const slot of readdirSync(dayDir).sort()) {
    const slotDir = join(dayDir, slot);
    const metaPath = join(slotDir, "post.json");
    if (!existsSync(metaPath)) continue;
    const hhmm = config.slots[slot];
    if (!hhmm) throw new Error(`queue ${date}/${slot}: no such slot in slots.json`);
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    if (typeof meta.caption !== "string" || !meta.caption.trim()) throw new Error(`queue ${date}/${slot}: caption missing`);
    if (!Array.isArray(meta.media) || !meta.media.length) throw new Error(`queue ${date}/${slot}: media missing`);
    for (const f of meta.media) if (!existsSync(join(slotDir, f))) throw new Error(`queue ${date}/${slot}: ${f} not found`);
    for (const platform of meta.platforms || ["instagram", "facebook"]) {
      const local = addMinutes(hhmm, config.platformOffsetMinutes?.[platform] || 0);
      const key = `${date}:${platform}:${slot}`;
      planned.push({ key, date, slot, platform, slotDir, meta, local, at: zonedToUtc(date, local, TZ), postId: uuidv5(key) });
    }
  }
}
planned.sort((a, b) => a.at - b.at);

mkdirSync(STATUS_DIR, { recursive: true });
const storePath = join(STATUS_DIR, "posted-keys.json");
const store = existsSync(storePath) ? JSON.parse(readFileSync(storePath, "utf8")) : {};

// Channels: only the two pinned integrations, and only while connected.
let channels = {};
let existingIds = new Set();
if (API_KEY) {
  const integrations = await api("/integrations");
  for (const [platform, id] of Object.entries(config.channels)) {
    const hit = integrations.find((i) => i.id === id && !i.disabled);
    if (hit) channels[platform] = hit;
  }
  if (planned.length) {
    const start = `${dates[0]}T00:00:00.000Z`;
    const end = `${addDays(dates[dates.length - 1], 2)}T00:00:00.000Z`;
    const { posts } = await api(`/posts?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`);
    existingIds = new Set((posts || []).map((p) => p.id));
  }
}

// One upload per slot, shared by both platforms: the same files go to
// Instagram and Facebook, and uploads are most of the API budget.
const uploadedBySlot = new Map();
// A 429 means Postiz's hourly API budget (API_LIMIT) is spent. Everything
// after it would fail the same way, so the run stops sending and leaves the
// rest for the next run instead of recording a wall of failures.
let throttled = false;

const results = [];
for (const p of planned) {
  const base = { key: p.key, platform: p.platform, slot: p.slot, scheduledFor: p.at.toISOString(), localTime: `${p.local} ${TZ}` };
  const skip = (reason) => results.push({ ...base, action: "skipped", reason });
  if (store[p.key]) { skip(`already scheduled (posted-keys store, ${store[p.key].at})`); continue; }
  if (existingIds.has(p.postId)) { skip("already scheduled (post id found in Postiz)"); continue; }
  if (p.at.getTime() < Date.now() + 5 * 60_000) { skip("slot time already passed"); continue; }
  const channel = API_KEY ? channels[p.platform] : { id: "(offline)", identifier: p.platform, name: "(offline)" };
  if (!channel) { skip(`pinned ${p.platform} channel ${config.channels[p.platform] || "(none)"} not connected in Postiz`); continue; }
  if (dryRun) { results.push({ ...base, action: "would-schedule", channel: channel.name, media: p.meta.media.length }); continue; }
  if (throttled) { skip("Postiz API budget spent this hour — left for the next run"); continue; }
  try {
    const slotKey = `${p.date}:${p.slot}`;
    let media = uploadedBySlot.get(slotKey);
    if (!media) {
      media = [];
      for (const f of p.meta.media) {
        const up = await upload(join(p.slotDir, f), `verveq-${p.date}-${p.slot}-${f}`);
        media.push({ id: up.id, path: up.path });
      }
      uploadedBySlot.set(slotKey, media);
    }
    const created = await api("/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "schedule",
        shortLink: false,
        date: p.at.toISOString(),
        tags: [],
        posts: [
          {
            integration: { id: channel.id },
            value: [{ id: p.postId, content: p.meta.caption.trim(), image: media }],
            // Postiz v2.10 validates settings through the __type discriminator;
            // a single mp4 with post_type "post" goes out as an Instagram Reel.
            settings: p.platform === "instagram" ? { __type: channel.identifier, post_type: "post" } : { __type: channel.identifier },
          },
        ],
      }),
    });
    store[p.key] = { at: new Date().toISOString(), postizId: created?.[0]?.postId || p.postId, scheduledFor: p.at.toISOString() };
    writeFileSync(storePath, JSON.stringify(store, null, 2) + "\n");
    results.push({ ...base, action: "scheduled" });
  } catch (err) {
    const reason = String(err.message || err);
    if (/→ 429/.test(reason)) {
      throttled = true;
      skip("Postiz API budget spent this hour — left for the next run");
      continue;
    }
    results.push({ ...base, action: "failed", reason });
  }
}

const failed = results.filter((r) => r.action === "failed");
const status = {
  runAt: new Date().toISOString(),
  dates: [dates[0], dates[dates.length - 1]],
  dryRun,
  api: API_KEY ? "connected" : "offline",
  channels: Object.fromEntries(Object.entries(config.channels).map(([k]) => [k, channels[k]?.name || (API_KEY ? "NOT CONNECTED" : "?")])),
  durationMs: Date.now() - startedAt,
  ok: failed.length === 0,
  posts: results,
};
if (!dryRun) {
  appendFileSync(join(STATUS_DIR, "publish-status.jsonl"), JSON.stringify(status) + "\n");
  writeFileSync(join(STATUS_DIR, "last-run.json"), JSON.stringify(status, null, 2) + "\n");
}
for (const r of results) console.log(`${r.localTime.padEnd(20)} ${r.platform.padEnd(9)} ${r.slot.padEnd(9)} ${r.action}${r.reason ? ` — ${r.reason}` : ""}  [${r.key}]`);
console.log(`[publish] ${results.length} post(s) considered, ${results.filter((r) => r.action === "scheduled").length} scheduled, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
