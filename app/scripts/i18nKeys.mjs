#!/usr/bin/env node
/**
 * i18n key audit (VerveQ ONE P4.6).
 *
 *   node scripts/i18nKeys.mjs            # report missing + unused keys
 *   node scripts/i18nKeys.mjs --missing  # only keys used in code but absent from en
 *   node scripts/i18nKeys.mjs --unused   # only en keys nothing in src/ references
 *
 * "Missing": every literal `t("a.b")` / `t('a.b')` / `i18n.t("a.b")` key (an
 * optional `ns:` prefix is honoured) must exist in SOME en namespace file.
 * Template keys (`t(\`modes.${k}.name\`)`) cannot be checked statically and are
 * skipped here; they are what keeps a whole key FAMILY alive in the unused pass.
 *
 * "Unused": an en key is referenced when its full dotted path appears as a
 * string anywhere in src/ (outside the locale files) — this covers keys parked
 * in config objects (`labelKey: "home.x"`) — or when it matches a dynamic
 * template family (each `${…}` becomes a wildcard segment), or when a
 * plural/context suffix (`_one`, `_other`, `_zero`…) hangs off a referenced key.
 * Tests also count as references so a key asserted by a test is never pruned.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SRC_ROOT = join(APP_ROOT, "src");
export const LOCALES_ROOT = join(SRC_ROOT, "i18n", "locales");

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (p === LOCALES_ROOT) continue;
      walkFiles(p, out);
    } else if (/\.(tsx?|mjs|js)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, path, out);
    else out[path] = String(v);
  }
  return out;
}

/** { ns: { flatKey: value } } for one language. */
export function loadLocale(lng = "en") {
  const dir = join(LOCALES_ROOT, lng);
  const out = {};
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    out[name.replace(/\.json$/, "")] = flatten(JSON.parse(readFileSync(join(dir, name), "utf8")));
  }
  return out;
}

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other|plural)$/;

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\s\/\/\s.*$/gm, "");
}

/** Literal keys passed to t()/i18n.t(): [{ file, key, ns? }]. */
export function literalKeyUses(files = walkFiles(SRC_ROOT)) {
  const uses = [];
  const re = /(?<![\w$.])(?:i18n\.)?t\(\s*(["'])([^"'`\n]+?)\1/g;
  for (const file of files) {
    if (/\/test\//.test(file) || /\.test\.tsx?$/.test(file)) continue;
    const src = stripComments(readFileSync(file, "utf8"));
    for (const m of src.matchAll(re)) {
      let key = m[2];
      let ns;
      const colon = key.indexOf(":");
      if (colon > 0 && /^[a-z]+$/.test(key.slice(0, colon))) {
        ns = key.slice(0, colon);
        key = key.slice(colon + 1);
      }
      // Only dotted identifiers are i18n keys; skip e.g. t("x") on unrelated fns.
      if (!/^[A-Za-z0-9_]+(\.[A-Za-z0-9_-]+)+$/.test(key)) continue;
      uses.push({ file: relative(APP_ROOT, file), key, ns });
    }
  }
  return uses;
}

/** Keys used in code that no en namespace defines. */
export function missingKeys() {
  const en = loadLocale("en");
  const all = new Set();
  for (const [ns, keys] of Object.entries(en))
    for (const k of Object.keys(keys)) {
      all.add(k);
      all.add(`${ns}:${k}`);
      const base = k.replace(PLURAL_SUFFIX, "");
      all.add(base);
    }
  return literalKeyUses().filter(({ key, ns }) => {
    if (ns) return !(en[ns] && (key in en[ns] || Object.keys(en[ns]).some((k) => k.replace(PLURAL_SUFFIX, "") === key)));
    return !all.has(key);
  });
}

/** Regexes for template-literal key families, e.g. `modes.${k}.name`. */
function dynamicFamilies(sources) {
  const fams = [];
  for (const src of sources) {
    for (const line of src.split("\n")) {
      if (!line.includes("${")) continue;
      // Segments between backticks on one line; odd indices are inside a template.
      const segs = line.split("`");
      // Nested templates (`${t(`weekend.position_${p}`)}`) break the backtick
      // pairing, so every t(`…`) argument is also read on its own.
      const tpls = segs.filter((_, i) => i % 2 === 1);
      for (const m of line.matchAll(/\bt\(\s*`([^`]*)`/g)) tpls.push(m[1]);
      for (const tpl of tpls) {
        if (!tpl.includes("${")) continue;
        const parts = tpl.split(/\$\{[^}]*\}/);
        if (parts.some((p) => !/^[A-Za-z0-9_.-]*$/.test(p))) continue;
        if (parts.every((p) => p === "" || p === ".")) continue;
        // Key-shaped only: a literal dotted prefix (`modes.${k}.name`) or a
        // wildcard namespace segment (`${ns}.streakTitle`). `${x}s` and
        // `${a}-${b}` are not keys and would match half the catalogue.
        if (!/^[A-Za-z][A-Za-z0-9_]*\./.test(tpl) && !/^\$\{[^}]*\}\.[A-Za-z]/.test(tpl)) continue;
        const pattern = parts
          .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("[A-Za-z0-9_-]+");
        fams.push(new RegExp(`^(?:[A-Za-z0-9]+\\.)?${pattern}$`));
      }
    }
  }
  return fams;
}

/** en keys (per namespace) nothing in src/ references. */
export function unusedKeys() {
  const en = loadLocale("en");
  const files = walkFiles(SRC_ROOT);
  const sources = files.map((f) => readFileSync(f, "utf8"));
  // Every complete quoted literal that could be a key, collected once.
  const literals = new Set();
  for (const src of sources) {
    for (const m of src.matchAll(/(["'`])([A-Za-z0-9_.:-]+)\1/g)) literals.add(m[2]);
  }
  const fams = dynamicFamilies(sources);
  const out = [];
  for (const [ns, keys] of Object.entries(en)) {
    for (const key of Object.keys(keys)) {
      const base = key.replace(PLURAL_SUFFIX, "");
      const quoted = (k) => literals.has(k) || literals.has(`${ns}:${k}`);
      if (quoted(key) || quoted(base)) continue;
      if (fams.some((re) => re.test(key) || re.test(base))) continue;
      out.push(`${ns}:${key}`);
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = new Set(process.argv.slice(2));
  if (args.has("--families")) {
    const sources = walkFiles(SRC_ROOT).map((f) => readFileSync(f, "utf8"));
    for (const re of new Set(dynamicFamilies(sources).map(String))) console.log(re);
    process.exit(0);
  }
  const both = !args.has("--missing") && !args.has("--unused");
  if (both || args.has("--missing")) {
    const miss = missingKeys();
    console.log(`# keys used in code but missing from en (${miss.length})`);
    for (const { file, key, ns } of miss) console.log(`${ns ? ns + ":" : ""}${key}\t${file}`);
  }
  if (both || args.has("--unused")) {
    const unused = unusedKeys();
    console.log(`# en keys not referenced in src/ (${unused.length})`);
    for (const k of unused) console.log(k);
  }
}
