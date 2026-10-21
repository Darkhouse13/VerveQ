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
    const counts = {};
    for (const [name, re] of Object.entries(PATTERNS)) {
      const n = (text.match(re) ?? []).length;
      if (n > 0) counts[name] = n;
    }
    if (Object.keys(counts).length > 0) {
      result[path.relative(APP_ROOT, file).split(path.sep).join("/")] = counts;
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
