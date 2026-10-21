import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_HSL } from "@/lib/brandTokens";

const css = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "index.css"),
  "utf8",
);

/** The CSS custom property each brand token mirrors. */
const VAR: Record<keyof typeof BRAND_HSL, string> = {
  ink: "--ink",
  cream: "--cream",
  lime: "--lime",
  blue: "--electric-blue",
  pink: "--hot-pink",
  right: "--right",
  wrong: "--wrong",
};

describe("brand tokens (canvas mirror of src/index.css)", () => {
  for (const [name, [h, s, l]] of Object.entries(BRAND_HSL)) {
    it(`${name} matches ${VAR[name as keyof typeof BRAND_HSL]}`, () => {
      const decl = new RegExp(`${VAR[name as keyof typeof BRAND_HSL]}:\\s*${h} ${s}% ${l}%;`);
      expect(css).toMatch(decl);
    });
  }
});
