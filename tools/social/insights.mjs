#!/usr/bin/env node
// Pull every IG @playverveq and FB Page "VerveQ" post/reel with its metrics
// straight from the Graph API, using the tokens VerveQ's Postiz already holds.
//
//   node tools/social/insights.mjs            -> tools/social/insights/<date>.{json,csv}
//
// Tokens are read over ssh from the Postiz Postgres on the box and never
// written to disk. Metrics Meta rejects for a media type are skipped, not fatal.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = process.env.VERVEQ_SOCIAL_HOST || "hetzner";
const PG = "postgres-lmizsgaeiypte8pwawbklt7r";
const G = "https://graph.facebook.com/v21.0";
const HERE = dirname(fileURLToPath(import.meta.url));

function tokens() {
  const sql = `select "providerIdentifier", "internalId", token from "Integration" where "deletedAt" is null`;
  const out = execFileSync("ssh", [HOST,
    `docker exec -i ${PG} sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F"|"'`,
  ], { input: sql, encoding: "utf8" });
  const t = {};
  for (const line of out.trim().split("\n")) {
    const [provider, id, token] = line.split("|");
    t[provider] = { id, token };
  }
  if (!t.facebook || !t.instagram) throw new Error(`missing channel tokens: ${Object.keys(t)}`);
  return t;
}

async function get(path, params, token) {
  const u = path.startsWith("http") ? new URL(path) : new URL(`${G}/${path}`);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  if (token) u.searchParams.set("access_token", token);
  const r = await fetch(u);
  const j = await r.json();
  if (j.error) { const e = new Error(j.error.message); e.meta = j.error; throw e; }
  return j;
}

async function all(path, params, token) {
  const rows = [];
  let j = await get(path, params, token);
  for (;;) {
    rows.push(...(j.data || []));
    if (!j.paging?.next) return rows;
    j = await get(j.paging.next);
  }
}

// Ask for metrics one at a time: Meta rejects the whole call if any single
// metric is invalid for that media type, and the valid set shifts by version.
async function metrics(id, names, token, extra = {}) {
  const out = {};
  await Promise.all(names.map(async (m) => {
    try {
      const j = await get(`${id}/insights`, { metric: m, ...extra }, token);
      const d = j.data?.[0];
      if (!d) return;
      const v = d.total_value?.value ?? d.values?.[0]?.value;
      out[m] = v;
    } catch { /* not available for this media/type */ }
  }));
  return out;
}

const IG_REEL = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions",
  "ig_reels_avg_watch_time", "ig_reels_video_view_total_time", "ig_reels_skip_rate", "reposts", "follows", "profile_visits"];
const IG_FEED = ["views", "reach", "likes", "comments", "shares", "saved", "total_interactions",
  "follows", "profile_visits", "profile_activity", "reposts"];
const FB_POST = ["post_media_view", "post_total_media_view_unique", "post_impressions", "post_impressions_unique",
  "post_clicks", "post_reactions_by_type_total", "post_video_views", "post_video_avg_time_watched",
  "post_video_view_time", "post_video_complete_views_organic"];
const FB_REEL = ["blue_reels_play_count", "fb_reels_total_plays", "fb_reels_replay_count", "post_impressions_unique",
  "post_video_avg_time_watched", "post_video_view_time", "post_video_followers", "post_video_social_actions",
  "post_video_likes_by_reaction_type"];

async function instagram({ id, token }) {
  const account = await get(id, { fields: "username,followers_count,follows_count,media_count" }, token);
  const media = await all(`${id}/media`, {
    fields: "id,media_type,media_product_type,caption,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url",
    limit: 100,
  }, token);
  for (const m of media) {
    m.insights = await metrics(m.id, m.media_product_type === "REELS" ? IG_REEL : IG_FEED, token);
  }
  return { account, media };
}

async function facebook({ id, token }) {
  const page = await get(id, { fields: "name,followers_count,fan_count" }, token);
  const posts = await all(`${id}/published_posts`, {
    fields: "id,created_time,message,permalink_url,status_type,shares,attachments{media_type,type,target},reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)",
    limit: 100,
  }, token);
  for (const p of posts) p.insights = await metrics(p.id, FB_POST, token);
  let reels = [];
  try {
    reels = await all(`${id}/video_reels`, { fields: "id,created_time,description,permalink_url,length,post_id", limit: 100 }, token);
    for (const r of reels) {
      r.insights = {};
      try {
        const j = await get(`${r.id}/video_insights`, {}, token);
        for (const d of j.data || []) r.insights[d.name] = d.values?.[0]?.value;
      } catch { r.insights = await metrics(r.id, FB_REEL, token); }
    }
  } catch (e) { console.warn(`fb video_reels: ${e.message}`); }
  return { page, posts, reels };
}

const csvCell = (v) => {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function toCsv(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}

const t = tokens();
const [ig, fb] = await Promise.all([instagram(t.instagram), facebook(t.facebook)]);
const pulledAt = new Date().toISOString();

const rows = [
  ...ig.media.map((m) => ({
    platform: "instagram", id: m.id, time: m.timestamp, type: m.media_product_type === "REELS" ? "reel" : m.media_type.toLowerCase(),
    permalink: m.permalink, caption: (m.caption || "").split("\n")[0].slice(0, 120),
    likes: m.like_count, comments: m.comments_count, ...m.insights,
  })),
  ...fb.posts.map((p) => ({
    platform: "facebook", id: p.id, time: p.created_time, type: p.attachments?.data?.[0]?.media_type || p.status_type,
    permalink: p.permalink_url, caption: (p.message || "").split("\n")[0].slice(0, 120),
    likes: p.reactions?.summary?.total_count, comments: p.comments?.summary?.total_count, shares: p.shares?.count ?? 0,
    ...Object.fromEntries(Object.entries(p.insights).map(([k, v]) => [`fb_${k}`, v])),
    ...Object.fromEntries(Object.entries(fb.reels.find((r) => r.post_id === p.id || p.id.endsWith(`_${r.id}`))?.insights || {})
      .map(([k, v]) => [`fb_${k}`, v])),
  })),
].sort((a, b) => a.time.localeCompare(b.time));

const dir = join(HERE, "insights");
mkdirSync(dir, { recursive: true });
const stamp = pulledAt.slice(0, 10);
writeFileSync(join(dir, `${stamp}.json`), JSON.stringify({ pulledAt, instagram: ig, facebook: fb }, null, 2));
writeFileSync(join(dir, `${stamp}.csv`), toCsv(rows));
console.log(`IG @${ig.account.username}: ${ig.media.length} media, ${ig.account.followers_count} followers`);
console.log(`FB ${fb.page.name}: ${fb.posts.length} posts, ${fb.reels.length} reels, ${fb.page.followers_count} followers`);
console.log(`-> ${join(dir, `${stamp}.json`)}\n-> ${join(dir, `${stamp}.csv`)}`);
