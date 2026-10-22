/**
 * Design ratchet (VerveQ ONE plan, guardrail P0.4).
 *
 * Counts, per source file, the patterns the design system is replacing:
 * one-off pixel sizes, raw colors, hand-rolled buttons and overlays, and so
 * on. `src/test/designRatchet.test.ts` fails when any file's count rises above
 * the committed baseline, and also when it falls without the baseline being
 * lowered, so every improvement is locked in.
 *
 *   node scripts/designRatchet.mjs            # print totals
 *   node scripts/designRatchet.mjs --write    # rewrite the baseline
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(HERE, "..");
export const SRC_ROOT = path.join(APP_ROOT, "src");
export const BASELINE_PATH = path.join(SRC_ROOT, "test", "designRatchet.baseline.json");

/** Pattern name → regex. Every regex is global. Keep names stable: they key the baseline. */
export const PATTERNS = {
  // One-off pixel font sizes instead of the type scale.
  textPx: /\btext-\[\d+(?:\.\d+)?px\]/g,
  // Arbitrary shadows instead of the shadow tokens.
  shadowArbitrary: /\bshadow-\[/g,
  // Literal black borders instead of the line/ink tokens.
  borderBlack: /\bborder-black\b/g,
  // Raw hex colors (6- or 3-digit) instead of color tokens.
  hex: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g,
  // Literal hsl()/rgb() colors with numbers (hsl(var(--x)) is fine).
  colorFn: /\b(?:hsla?|rgba?)\(\s*\d/g,
  // Hand-rolled buttons instead of Button / IconButton.
  rawButton: /<button\b/g,
  // Direct toast calls instead of notify().
  toast: /\btoast(?:\.\w+)?\(/g,
  // Radix dialog imported outside the ui primitives.
  radixDialog: /@radix-ui\/react-dialog/g,
  // Hand-rolled full-screen overlays.
  fixedInset: /\bfixed inset-0\b/g,
  // Off-token radii.
  roundedXl: /\brounded-(?:xl|2xl|3xl)\b|\brounded-\[\d/g,
  // Untargeted transitions.
  transitionAll: /\btransition-all\b/g,
  // font-black (weight 900 is never loaded).
  fontBlack: /\bfont-black\b/g,
  // Opacity used for muted text instead of the text-muted token.
  opacityText: /\bopacity-(?:[1-8]\d)\b/g,
  // Letter-spacing one-offs instead of the eyebrow token.
  trackingArbitrary: /\btracking-\[/g,
};

/**
 * Patterns that are the point of a primitive, not a departure from it: the
 * ui primitives ARE the Button / IconButton / Dialog, so their own <button>
 * and Radix imports are not counted. Everything else still is.
 */
const PRIMITIVE_DIR = "src/components/ui/";
const PRIMITIVE_EXEMPT = new Set(["rawButton", "radixDialog"]);

/**
 * Legitimate exceptions (VerveQ ONE P5.1), each named with its reason. An
 * entry excuses at most `count` occurrences of `pattern` in `file`, and only
 * on lines matching `line` when given. Anything beyond is counted as usual, so
 * a second hand-rolled frame in the same file still fails the ratchet. Never
 * dodge a regex by renaming a class: add the case here, where review sees it.
 * The ratchet test also fails on an entry that no longer excuses anything.
 */
export const ALLOWLIST = [
  {
    file: "src/components/shell/play/PlayStage.tsx",
    pattern: "fixedInset",
    count: 2,
    reason: "StageFrame IS the in-game fixed-inset frame every mode renders inside (class + its doc comment)",
  },
  {
    file: "src/components/shell/ShellLayout.tsx",
    pattern: "fixedInset",
    count: 2,
    reason: "ShellLayout IS the hub fixed-inset frame (Home, Ranks, Profile, Settings) (class + its doc comment)",
  },
  {
    file: "src/components/learn/LearnPrimitives.tsx",
    pattern: "fixedInset",
    count: 1,
    reason: "LearnShell IS the Learn hub fixed-inset frame (Learn runs use StageFrame)",
  },
  {
    file: "src/components/ui/overlay.tsx",
    pattern: "fixedInset",
    count: 1,
    reason: "the Overlay primitive's own scrim, which every Dialog / Sheet / FullscreenFlow goes through",
  },
  {
    file: "src/App.tsx",
    pattern: "fixedInset",
    count: 1,
    line: /shell frames/,
    reason: "a JSX comment naming the shell frames, not a class",
  },
  {
    file: "src/index.css",
    pattern: "hex",
    count: 2,
    line: /^\s*\*/,
    reason: "the token documentation comment quotes the brand hex values the HSL tokens encode",
  },
  {
    file: "src/components/shell/play/grid/GridBoard.tsx",
    pattern: "rawButton",
    count: 1,
    reason: "an empty VerveGrid board cell: the board's grid lines are its border, so it is neither a Button nor a Card",
  },
  {
    file: "src/pages/shell/play/MissingLettersPlayScreen.tsx",
    pattern: "rawButton",
    count: 1,
    reason: "a letter blank on the word board, sized per word by the board's fit math, not a Button or Card",
  },
];

function allowlistFor(rel, name) {
  return ALLOWLIST.filter((e) => e.file === rel && e.pattern === name);
}

/**
 * Count `re` in `text`, minus what the allowlist entries excuse. Returns the
 * remaining count and, per entry, how many occurrences it excused.
 */
function countWithAllowlist(text, re, entries) {
  const budget = entries.map((e) => e.count ?? Infinity);
  const used = entries.map(() => 0);
  let n = 0;
  for (const line of text.split("\n")) {
    for (let k = (line.match(re) ?? []).length; k > 0; k--) {
      const i = entries.findIndex((e, j) => used[j] < budget[j] && (!e.line || e.line.test(line)));
      if (i === -1) n++;
      else used[i]++;
    }
  }
  return { n, used };
}

/** Per allowlist entry, how many occurrences it excuses today (0 = stale). */
export function allowlistUsage() {
  return ALLOWLIST.map((entry) => {
    const text = readFileSync(path.join(APP_ROOT, entry.file), "utf8");
    const { used } = countWithAllowlist(text, PATTERNS[entry.pattern], [entry]);
    return { ...entry, used: used[0] };
  });
}

const EXTS = new Set([".ts", ".tsx", ".css"]);
// Tests, generated code and the token sources themselves are out of scope.
const SKIP_DIRS = new Set(["test", "node_modules"]);
const SKIP_FILES = new Set(["vite-env.d.ts"]);

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (EXTS.has(path.extname(name)) && !SKIP_FILES.has(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** { "src/…/File.tsx": { textPx: 3, … } } — zero counts omitted, keys sorted. */
export function countAll() {
  const result = {};
  for (const file of walk(SRC_ROOT, []).sort()) {
    const text = readFileSync(file, "utf8");
    const rel = path.relative(APP_ROOT, file).split(path.sep).join("/");
    const isPrimitive = rel.startsWith(PRIMITIVE_DIR);
    const counts = {};
    for (const [name, re] of Object.entries(PATTERNS)) {
      if (isPrimitive && PRIMITIVE_EXEMPT.has(name)) continue;
      const entries = allowlistFor(rel, name);
      const n = entries.length > 0 ? countWithAllowlist(text, re, entries).n : (text.match(re) ?? []).length;
      if (n > 0) counts[name] = n;
    }
    if (Object.keys(counts).length > 0) {
      result[rel] = counts;
    }
  }
  return result;
}

export function totals(map) {
  const t = {};
  for (const counts of Object.values(map)) {
    for (const [k, v] of Object.entries(counts)) t[k] = (t[k] ?? 0) + v;
  }
  return t;
}

export function readBaseline() {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8"));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const current = countAll();
  if (process.argv.includes("--write")) {
    writeFileSync(BASELINE_PATH, JSON.stringify(current, null, 2) + "\n");
    console.log(`baseline written: ${Object.keys(current).length} files`);
  }
  console.table(totals(current));
}
