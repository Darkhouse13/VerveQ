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
//   every 4th reel     a new-concept TEST (out/concepts/test-*/ not yet queued),
//                      i.e. 17:30 daily (owner 2026-09-30: 1 in 4, for diversity)
//   every other slot   WHO'S OLDER, a FRESH edition each time: the generator
//                      picks it, the two-source fact gate must pass,
//                      lab/concept-render.mjs renders + verifies it.
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
const EPOCH = "2026-09-26"; // reel index 0 = this day's 08:30 slot

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

const nextEdition = (concept) => {
  const nums = readdirSync(EDITIONS).map((f) => f.match(new RegExp(`^${concept}-e(\\d+)\\.json$`))?.[1]).filter(Boolean).map(Number);
  return `e${Math.max(3, ...nums) + 1}`;
};
const freeTest = () => {
  if (!existsSync(CONCEPTS)) return null;
  const used = new Set(Object.values(ledger).filter((v) => v.concept === "test").map((v) => v.dir));
  // alternate formats: the least-tested family goes next (test-letters-e2 is family "letters")
  const family = (d) => d.replace(/^test-/, "").replace(/-e\d+$/, "");
  const runs = {};
  for (const d of used) runs[family(d)] = (runs[family(d)] ?? 0) + 1;
  const dirs = readdirSync(CONCEPTS)
    .filter((d) => d.startsWith("test-") && !used.has(d))
    .sort((a, b) => (runs[family(a)] ?? 0) - (runs[family(b)] ?? 0) || a.localeCompare(b));
  for (const d of dirs) {
    const mp4 = readdirSync(join(CONCEPTS, d)).find((f) => f.endsWith(".mp4"));
    if (mp4 && existsSync(join(CONCEPTS, d, mp4.replace(/\.mp4$/, ".txt")))) return { dir: d, mp4: join(CONCEPTS, d, mp4), txt: join(CONCEPTS, d, mp4.replace(/\.mp4$/, ".txt")) };
  }
  return null;
};

// one fresh edition: generate (gate runs inside), render (gate + verify again)
const freshReel = (concept) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    const ed = nextEdition(concept);
    if (!run("node", ["lab/older-generate.mjs", ed, "--seed", String(Date.now() % 100000 + attempt)], FACTORY)) continue;
    if (!run("node", ["lab/concept-render.mjs", concept, ed], FACTORY)) continue;
    const dir = join(CONCEPTS, `${concept}-${ed}`);
    return { ed, mp4: join(dir, "lab-older.mp4"), txt: join(dir, "lab-older.txt") };
  }
  return null;
};

const today = iso(Date.now());
const days = Array.from({ length: DAYS }, (_, i) => iso(Date.parse(today) + (i + 1) * DAY));
log(`filling ${days[0]} … ${days[days.length - 1]}`);

for (const date of days) {
  for (const [i, slot] of ["reel1", "reel2", "reel3", "reel4"].entries()) {
    if (filled(date, slot)) continue;
    const index = Math.round((Date.parse(date) - Date.parse(EPOCH)) / DAY) * 4 + i;
    const key = `${date}:${slot}`;
    if (index % 4 === 2) {
      const t = freeTest();
      if (t) {
        must("node", ["tools/social/queue.mjs", "add-reel", date, slot, t.mp4, t.txt], REPO);
        ledger[key] = { concept: "test", dir: t.dir };
        saveLedger();
        continue;
      }
      log(`${key}: WARNING no unused concept test in out/concepts/test-* — build one; a concept reel takes the slot`);
    }
    const concept = "older";
    const reel = dry ? { ed: "(dry)", mp4: "", txt: "" } : freshReel(concept);
    if (!reel) {
      log(`${key}: WARNING could not build a ${concept} edition — slot left empty`);
      continue;
    }
    if (!dry) must("node", ["tools/social/queue.mjs", "add-reel", date, slot, reel.mp4, reel.txt], REPO);
    ledger[key] = { concept, edition: reel.ed };
    saveLedger();
  }
}

must("node", ["tools/social/queue.mjs", "push", today, days[days.length - 1]], REPO);
log("done");
