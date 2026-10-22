// Keeps the VerveQ feed queue topped up without anyone running anything.
//
//   node tools/social/autofill.mjs [--dry] [--days 7]
//
// Run daily by the systemd user timer `verveq-social-autofill` (see
// tools/social/systemd/). Rendering needs Remotion, Chrome and the rendered
// ladder reels, all of which live on this machine — the server only
// publishes. So this job runs HERE and pushes to the box.
//
// The feed (owner, 2026-09-25): FOUR reels a day — reel1 08:30, reel2 12:30,
// reel3 17:30, reel4 20:30. Quiz cards and the daily carousel are retired;
// the weekly Sunday carousel was retired too (owner, 2026-09-28 — 23 and 45
// views against 2K+ for every reel). The ladder and SPOT THE IMPOSTER were
// retired 2026-09-30 (owner: both milked to the max; WHO'S OLDER drew 16K).
// 2026-10-10 (owner): MISSING LETTERS swaps places with WHO'S OLDER — it hit
// 10K views as a test while Who's Older settled at 2–5K ("losing grip").
// 2026-10-13 (owner): three a day was too much — MISSING LETTERS drops to two,
// WHO'S OLDER keeps one (it feeds the bio link), and the test slot runs daily
// so GUESS WHO (10.1K, one run) and MISSING CLUB (5.6K, one run) get reruns.
// WHICH CLUB IS OLDER is dropped (2.2K over two runs).
//   08:30 20:30  MISSING LETTERS, a fresh edition each time
//                (lab/letters-facts.mjs gate → lab/letters-render.mjs)
//   12:30        WHO'S OLDER (lab/older-generate.mjs → lab/concept-render.mjs)
//   17:30        a new-concept TEST, least-tested family first
//                (out/concepts/test-*/ not yet queued; Who's Older if none)
// Every step is idempotent: a filled slot is never refilled, so a missed day
// (machine off) is simply caught up on the next run.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const FACTORY = join(REPO, "tools/content-factory");
const QUEUE = join(FACTORY, "out/social");
const CONCEPTS = join(FACTORY, "out/concepts");
const EDITIONS = join(FACTORY, "lab/editions");
const LEDGER = join(HERE, "reels-queued.json");
const dry = process.argv.includes("--dry");
const DAYS = process.argv.includes("--days") ? Number(process.argv[process.argv.indexOf("--days") + 1]) : 7;

const DAY = 86_400_000;
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const log = (m) => console.log(`${new Date().toISOString()} [autofill] ${m}`);
const run = (cmd, args, cwd) => {
  log(`$ ${cmd} ${args.join(" ")}`);
  if (dry) return true;
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  return r.status === 0;
};
const must = (cmd, args, cwd) => {
  if (!run(cmd, args, cwd)) throw new Error(`${cmd} ${args.join(" ")} failed`);
};

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {};
const saveLedger = () => !dry && writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + "\n");

// which folders fill each reel time (legacy names still count)
const SLOT_ALIASES = { reel1: ["reel1"], reel2: ["reel2", "ladder"], reel3: ["reel3"], reel4: ["reel4", "concept"] };
const filled = (date, slot) => SLOT_ALIASES[slot].some((s) => existsSync(join(QUEUE, date, s, "post.json")));

// how each main format is generated, rendered and found on disk
const FORMATS = {
  older: {
    gen: (ed, seed) => ["lab/older-generate.mjs", ed, "--seed", seed],
    render: (ed) => ["lab/concept-render.mjs", "older", ed],
    dir: (ed) => `older-${ed}`,
    slug: "lab-older",
    editions: () => readdirSync(EDITIONS).map((f) => f.match(/^older-e(\d+)\.json$/)?.[1]),
  },
  letters: {
    gen: (ed, seed) => ["lab/letters-facts.mjs", "--edition", ed, "--seed", seed],
    render: (ed) => ["lab/letters-render.mjs", ed],
    dir: (ed) => `test-letters-${ed}`,
    slug: "lab-letters",
    editions: () => readdirSync(CONCEPTS).map((d) => d.match(/^test-letters-e(\d+)$/)?.[1]),
  },
};
const nextEdition = (concept) => `e${Math.max(3, ...FORMATS[concept].editions().filter(Boolean).map(Number)) + 1}`;
const queuedDirs = () => new Set(Object.values(ledger).map((v) => v.dir ?? (v.edition && FORMATS[v.concept]?.dir(v.edition))).filter(Boolean));
const rendered = (dir, slug) => {
  const mp4 = join(CONCEPTS, dir, `${slug}.mp4`);
  return existsSync(mp4) && existsSync(mp4.replace(/\.mp4$/, ".txt")) ? { mp4, txt: mp4.replace(/\.mp4$/, ".txt") } : null;
};
// letters graduated to the main rotation; clubolder lost its test (owner, 2026-10-13)
const RETIRED_TESTS = new Set(["letters", "clubolder"]);
const freeTest = () => {
  if (!existsSync(CONCEPTS)) return null;
  const used = queuedDirs();
  // alternate formats: the least-tested family goes next (test-letters-e2 is family "letters")
  const family = (d) => d.replace(/^test-/, "").replace(/-e\d+$/, "");
  const runs = {};
  for (const d of used) runs[family(d)] = (runs[family(d)] ?? 0) + 1;
  const dirs = readdirSync(CONCEPTS)
    .filter((d) => d.startsWith("test-") && !used.has(d) && !RETIRED_TESTS.has(family(d)))
    .sort((a, b) => (runs[family(a)] ?? 0) - (runs[family(b)] ?? 0) || a.localeCompare(b));
  for (const d of dirs) {
    const mp4 = readdirSync(join(CONCEPTS, d)).find((f) => f.endsWith(".mp4"));
    if (mp4 && existsSync(join(CONCEPTS, d, mp4.replace(/\.mp4$/, ".txt")))) return { dir: d, mp4: join(CONCEPTS, d, mp4), txt: join(CONCEPTS, d, mp4.replace(/\.mp4$/, ".txt")) };
  }
  return null;
};

// one fresh edition: generate (gate runs inside), render (gate + verify again).
// A rendered edition nobody has queued yet goes first.
const freshReel = (concept) => {
  const F = FORMATS[concept];
  const used = queuedDirs();
  const spare = F.editions().filter(Boolean).map(Number).sort((a, b) => a - b).map((n) => `e${n}`).find((ed) => !used.has(F.dir(ed)) && rendered(F.dir(ed), F.slug));
  if (spare) return { ed: spare, dir: F.dir(spare), ...rendered(F.dir(spare), F.slug) };
  for (let attempt = 0; attempt < 3; attempt++) {
    const ed = nextEdition(concept);
    if (!run("node", F.gen(ed, String(Date.now() % 100000 + attempt)), FACTORY)) continue;
    if (!run("node", F.render(ed), FACTORY)) continue;
    const r = rendered(F.dir(ed), F.slug);
    if (r) return { ed, dir: F.dir(ed), ...r };
  }
  return null;
};

const today = iso(Date.now());
const days = Array.from({ length: DAYS }, (_, i) => iso(Date.parse(today) + (i + 1) * DAY));
log(`filling ${days[0]} … ${days[days.length - 1]}`);

for (const date of days) {
  for (const slot of ["reel1", "reel2", "reel3", "reel4"]) {
    if (filled(date, slot)) continue;
    const key = `${date}:${slot}`;
    let concept = slot === "reel1" || slot === "reel4" ? "letters" : "older";
    if (slot === "reel3") {
      const t = freeTest();
      if (t) {
        must("node", ["tools/social/queue.mjs", "add-reel", date, slot, t.mp4, t.txt], REPO);
        ledger[key] = { concept: "test", dir: t.dir };
        saveLedger();
        continue;
      }
      log(`${key}: WARNING no unused concept test in out/concepts/test-* — build one; Who's Older takes the slot`);
    }
    const reel = dry ? { ed: "(dry)", mp4: "", txt: "" } : freshReel(concept);
    if (!reel) {
      log(`${key}: WARNING could not build a ${concept} edition — slot left empty`);
      continue;
    }
    if (!dry) must("node", ["tools/social/queue.mjs", "add-reel", date, slot, reel.mp4, reel.txt], REPO);
    ledger[key] = { concept, edition: reel.ed, dir: reel.dir };
    saveLedger();
  }
}

// FACEBOOK-ONLY daily card (owner, 2026-10-22): the day's first Who's Older
// pair as an image whose caption links to that day's game — a format Facebook
// can carry and Instagram can't. The reels keep going to both platforms.
for (const date of days) {
  if (existsSync(join(QUEUE, date, "fbdaily", "post.json"))) continue;
  must("node", ["app/scripts/fbDailyCard.mjs", "--date", date, "--out", join(QUEUE, date, "fbdaily")], REPO);
}

must("node", ["tools/social/queue.mjs", "push", today, days[days.length - 1]], REPO);
log("done");
