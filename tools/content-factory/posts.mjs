// Weekly feed-post batch for the VerveQ Instagram + Facebook pages.
//
//   node posts.mjs [--from YYYY-MM-DD] [--days 7] [--dry] [--questions file.jsonl]
//                  [--preview <dir>]   render elsewhere, spend nothing
//
// Per day it renders the two still posts of the four-a-day feed:
//   carousel  — "guess the player" career path, one club per slide
//   question  — a football quiz question, answer on slide 2
// into out/social/<date>/<slot>/ (NN.jpg + post.json). The two reels
// (ladder, concept) are rendered elsewhere and dropped into the same tree by
// ../social/queue.mjs. The queue tree is what the publisher reads.
//
// Supply is spent for good: career-path ids go into ledger.json (the same
// "never picked again" ledger the reels use, so a ladder never re-casts a
// carousel player) and question checksums into posts-ledger.json.
// Questions come from PROD (`npx convex data quizQuestions --prod`) unless a
// saved export is passed with --questions.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(dir, "../..");
const LEDGER = path.join(dir, "ledger.json");
const POSTS_LEDGER = path.join(dir, "posts-ledger.json");
const OUT_DEFAULT = path.join(dir, "out", "social");

const argv = process.argv.slice(2);
const arg = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const dry = argv.includes("--dry");
// --only carousel|question re-renders one slot and spends only that slot's
// pick — for swapping a single post after review without burning the other.
const only = arg("--only", null);
if (only !== null && only !== "carousel" && only !== "question") {
  throw new Error("--only takes carousel or question");
}
// --preview renders into a scratch dir and spends nothing (no ledger writes).
const preview = arg("--preview", null);
const OUT = preview ? path.resolve(preview) : OUT_DEFAULT;
const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
const from = arg("--from", tomorrow);
const days = Number(arg("--days", "7"));
if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !(days >= 1 && days <= 31)) {
  throw new Error("usage: node posts.mjs [--from YYYY-MM-DD] [--days 1-31] [--dry] [--questions file.jsonl]");
}
const dates = Array.from({ length: days }, (_, i) =>
  new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400_000).toISOString().slice(0, 10),
);

// Deterministic randomness: same date → same picks and same option order.
const seeded = (s) => {
  let h = createHash("sha1").update(s).digest().readUInt32BE(0) || 1;
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
};

/* ── career paths ─────────────────────────────────────────────────────────── */

const ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
const spent = new Set(Object.keys(ledger));
// Ids already cast in any reel timeline/grid count as spent even before
// their ledger entry lands (the ladder batches cast ahead of rendering).
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = path.join(d, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
for (const f of walk(path.join(dir, "src")).filter((f) => /\.(ts|tsx|json)$/.test(f))) {
  for (const m of readFileSync(f, "utf8").matchAll(/cp-[a-z0-9-]+/g)) spent.add(m[0]);
}

const clubsOf = (e) => e.clubs.map((c) => (typeof c === "string" ? { name: c, loan: false } : { name: c.name, loan: c.loan === true }));
const paths = JSON.parse(readFileSync(path.join(REPO, "app/convex/data/football_career_paths.json"), "utf8"))
  .filter((e) => !spent.has(e.id))
  .map((e) => ({ ...e, flat: clubsOf(e) }))
  // 3–8 clubs: fewer is no guessing game, more won't fit a 10-slide carousel.
  // No club twice in a row (the Gullit trap — reads as a data bug on screen).
  .filter((e) => e.flat.length >= 3 && e.flat.length <= 8)
  .filter((e) => e.flat.every((c, i) => i === 0 || c.name !== e.flat[i - 1].name))
  .sort((a, b) => a.id.localeCompare(b.id));

// Mostly medium: recognisable enough to comment on, not a gimme. Easy is
// nearly exhausted in the dataset, so it gets one day a week.
const CAROUSEL_TIERS = ["medium", "medium", "easy", "medium", "hard", "medium", "medium"];

/* ── questions ────────────────────────────────────────────────────────────── */

const postsLedger = existsSync(POSTS_LEDGER) ? JSON.parse(readFileSync(POSTS_LEDGER, "utf8")) : { questions: {} };

// Convex refuses a CLI read that large (50,000 fails; the table held ~11,100
// rows on 2026-09-22). 20,000 covers it with room; the warning below fires
// if the table ever outgrows it.
const EXPORT_LIMIT = 20_000;
const loadQuestions = () => {
  const file = arg("--questions", null);
  let text;
  if (file) text = readFileSync(file, "utf8");
  else {
    console.log("[posts] exporting quizQuestions from prod…");
    const r = spawnSync("npx", ["convex", "data", "quizQuestions", "--prod", "--limit", String(EXPORT_LIMIT), "--format", "jsonl"], {
      cwd: path.join(REPO, "app"),
      encoding: "utf8",
      maxBuffer: 512 * 1024 * 1024,
    });
    if (r.status !== 0) throw new Error(`convex export failed: ${r.stderr.slice(0, 400)}`);
    text = r.stdout;
  }
  const rows = text
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l) => JSON.parse(l));
  if (!file && rows.length >= EXPORT_LIMIT) {
    console.warn(`[posts] export hit the ${EXPORT_LIMIT}-row cap — the newest questions may be missing`);
  }
  return rows;
};

// Text questions only: image rounds (silhouettes, badges, stadiums) can't be
// shown — no real players, no crests.
const IMAGE_CATEGORIES = new Set(["player_silhouette", "badge_identification", "stadium_identification"]);
const questions = loadQuestions()
  .filter((q) => q.sport === "football" && !q.imageId && !IMAGE_CATEGORIES.has(q.category))
  .filter((q) => (q.questionKind ?? "mcq") === "mcq" && q.options?.length === 4 && q.options.includes(q.correctAnswer))
  .filter((q) => q.question.length <= 150 && q.options.every((o) => o.length <= 38))
  .filter((q) => !postsLedger.questions[q.checksum])
  .sort((a, b) => a.checksum.localeCompare(b.checksum));

const QUESTION_TIERS = ["intermediate", "hard", "easy", "intermediate", "hard", "intermediate", "hard"];

/* ── captions ─────────────────────────────────────────────────────────────── */
// Never the answer. No invented stats ("99% fail") — numbers get screenshot.

const CAROUSEL_HOOKS = [
  "{n} clubs. One player. Swipe one club at a time 👀",
  "Name him before the last slide.",
  "How early can you get this one? {n} clubs, one player.",
  "One club per slide. Stop as soon as you know.",
  "Real fans get this before the final club.",
];
const CAROUSEL_ASKS = [
  "Comment the club number where you got it 👇",
  "Drop your guess before you swipe to the end 👇",
  "Which club gave it away? 👇",
  "Be honest: how many clubs did you need? 👇",
];
const QUESTION_HOOKS = {
  easy: ["Warm-up question. Don't overthink it.", "Quick one. Get it in five seconds?"],
  intermediate: ["Proper fans only.", "Think you know your football?", "This one splits the group chat."],
  hard: ["This one is HARD.", "Football encyclopedias only 📚", "No googling. Honest answers only."],
};
const TAGS = "#football #soccer #footballquiz #guesstheplayer #footballtrivia #verveq";
const QTAGS = "#football #soccer #footballquiz #footballtrivia #quiz #verveq";
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

/* ── plan ─────────────────────────────────────────────────────────────────── */

const usedPaths = new Set();
const usedQs = new Set();
const plan = dates.map((date, i) => {
  const rng = seeded(`verveq-posts:${date}`);
  const tier = CAROUSEL_TIERS[i % CAROUSEL_TIERS.length];
  const pool = paths.filter((e) => !usedPaths.has(e.id));
  const tierPool = pool.filter((e) => e.difficulty === tier);
  const path_ = pick(rng, tierPool.length ? tierPool : pool);
  if (!path_) throw new Error(`no unused career paths left for ${date}`);
  usedPaths.add(path_.id);

  const qTier = QUESTION_TIERS[i % QUESTION_TIERS.length];
  const qPool = questions.filter((q) => !usedQs.has(q.checksum));
  const qTierPool = qPool.filter((q) => q.difficulty === qTier);
  const q = pick(rng, qTierPool.length ? qTierPool : qPool);
  if (!q) throw new Error(`no unused quiz questions left for ${date}`);
  usedQs.add(q.checksum);

  // Fisher–Yates on the options, seeded by the question — the source lists
  // the correct answer first.
  const qr = seeded(`verveq-options:${q.checksum}`);
  const options = [...q.options];
  for (let k = options.length - 1; k > 0; k--) {
    const j = Math.floor(qr() * (k + 1));
    [options[k], options[j]] = [options[j], options[k]];
  }

  const n = path_.flat.length;
  return {
    date,
    accentIndex: i,
    carousel: {
      source: path_.id,
      props: { answerName: path_.answerName, clubs: path_.flat, difficulty: path_.difficulty, accentIndex: i },
      caption: `${pick(rng, CAROUSEL_HOOKS).replace("{n}", n)}\n\n${pick(rng, CAROUSEL_ASKS)}\n\nA new career path every day at verveq.com\n\n${TAGS}`,
    },
    question: {
      source: q.checksum,
      props: {
        question: q.question,
        options,
        correctIndex: options.indexOf(q.correctAnswer),
        difficulty: q.difficulty,
        // "" not undefined: undefined props fall back to the composition defaults.
        explanation: q.explanation || "",
        accentIndex: i + 2,
      },
      caption: `${pick(rng, QUESTION_HOOKS[q.difficulty] || QUESTION_HOOKS.intermediate)}\n\n${q.question}\n\nComment A, B, C or D, then swipe for the answer 👇\n\nDaily football quiz at verveq.com\n\n${QTAGS}`,
    },
  };
});

for (const d of plan) {
  const c = d.carousel.props;
  console.log(`${d.date}  carousel ${d.carousel.source} (${c.difficulty}, ${c.clubs.length} clubs)  |  question ${d.question.source} (${d.question.props.difficulty}) ${d.question.props.question.slice(0, 60)}…`);
}
if (dry) process.exit(0);

/* ── render ───────────────────────────────────────────────────────────────── */

const serveUrl = await bundle({ entryPoint: path.join(dir, "src", "posts", "index.ts") });

const renderSlides = async (compositionId, inputProps, outDir) => {
  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const files = [];
  for (let frame = 0; frame < composition.durationInFrames; frame++) {
    const name = `${String(frame + 1).padStart(2, "0")}.jpg`;
    // JPEG straight away: Instagram's content API rejects PNG.
    await renderStill({ composition, serveUrl, inputProps, frame, output: path.join(outDir, name), imageFormat: "jpeg", jpegQuality: 92 });
    files.push(name);
  }
  return files;
};

for (const d of plan) {
  for (const slot of only ? [only] : ["carousel", "question"]) {
    const item = d[slot];
    const outDir = path.join(OUT, d.date, slot);
    const files = await renderSlides(slot === "carousel" ? "PostCareerCarousel" : "PostQuestion", item.props, outDir);
    writeFileSync(
      path.join(outDir, "post.json"),
      JSON.stringify({ kind: slot, source: item.source, media: files, caption: item.caption }, null, 2) + "\n",
    );
  }
  if (preview) {
    console.log(`[posts] preview ${d.date} → ${OUT}/${d.date}/`);
    continue;
  }
  // Ledgers after every day, not at the end: a crash mid-batch keeps what
  // was rendered spent.
  if (only !== "question") {
    ledger[d.carousel.source] = d.date;
    writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");
  }
  if (only !== "carousel") {
    postsLedger.questions[d.question.source] = d.date;
    writeFileSync(POSTS_LEDGER, JSON.stringify(postsLedger, null, 2) + "\n");
  }
  console.log(`[posts] ${d.date} rendered → out/social/${d.date}/`);
}
console.log(`[posts] done. Review the slides, then queue them: node ../social/queue.mjs push ${dates[0]} ${dates[dates.length - 1]}`);
