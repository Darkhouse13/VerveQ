import { describe, expect, it } from "vitest";
import { SUPPORTED_LANGUAGES } from "../i18n";

// Eagerly load every locale namespace file: { "../i18n/locales/<lng>/<ns>.json": data }
const modules = import.meta.glob("../i18n/locales/*/*.json", {
  eager: true,
  import: "default",
}) as Record<string, Record<string, unknown>>;

type FlatLeaves = Record<string, string>;
function flatten(
  obj: Record<string, unknown>,
  prefix = "",
  out: FlatLeaves = {},
): FlatLeaves {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, path, out);
    } else {
      out[path] = String(v);
    }
  }
  return out;
}

const byLngNs: Record<string, Record<string, Record<string, unknown>>> = {};
for (const [filePath, data] of Object.entries(modules)) {
  const m = filePath.match(/locales\/([^/]+)\/([^/]+)\.json$/);
  if (!m) continue;
  const [, lng, ns] = m;
  (byLngNs[lng] ??= {})[ns] = data;
}

// Namespaces declared in src/i18n/index.ts; keep in sync if a namespace is added.
const NAMESPACES = ["shell", "learn", "play", "screens"] as const;
const NON_EN = SUPPORTED_LANGUAGES.filter((l) => l !== "en");

// Guards the translation contract: every non-English locale must define exactly
// the English key set (no missing, no stray) with non-empty values. Drives the
// "done" signal for the i18n rollout and runs as part of `npm run check`.
describe("i18n locale completeness", () => {
  for (const ns of NAMESPACES) {
    const en = flatten(byLngNs.en?.[ns] ?? {});
    const enKeys = Object.keys(en);

    for (const lng of NON_EN) {
      const target = flatten(byLngNs[lng]?.[ns] ?? {});

      it(`${lng}/${ns}: defines every en key`, () => {
        const missing = enKeys.filter((k) => !(k in target));
        expect(missing).toEqual([]);
      });

      it(`${lng}/${ns}: has no keys absent from en`, () => {
        const extra = Object.keys(target).filter((k) => !(k in en));
        expect(extra).toEqual([]);
      });

      it(`${lng}/${ns}: has no empty values`, () => {
        const empty = Object.entries(target)
          .filter(([, v]) => v.trim() === "")
          .map(([k]) => k);
        expect(empty).toEqual([]);
      });
    }
  }
});
