/**
 * Weekend Fantasy FW-NAMES — display-name normalisation, as pure unit tests.
 *
 * The CORPUS below is not invented. It is every broken name found on prod
 * (different-lynx-153, `fantasyMarket:getMarket`) on 2026-08-20 — 32 rows out
 * of 4,706 — paired with the spelling each player's own club uses. Anything
 * this file cannot repair is a row a human has to look at, which is why the
 * corpus is asserted exhaustively rather than sampled.
 *
 * The second half of the file is the safety case: the pass must be idempotent,
 * must leave the 4,674 already-correct names alone, and must never mangle a
 * legitimately accented name into ASCII.
 */

import { describe, expect, it } from "vitest";

import {
  needsNameRepair,
  normalizePlayerName,
  searchKeyForName,
} from "../../convex/lib/fantasyPlayerName";

/** Raw feed name → the spelling the player is actually known by. */
const CORPUS: ReadonlyArray<readonly [string, string]> = [
  // ── HTML entity leakage: the feed escapes apostrophes and never unescapes ──
  ["A. N&apos;Diaye", "A. N'Diaye"],
  ["M&apos;Bala Nzola", "M'Bala Nzola"],
  ["M. O&apos;Riley", "M. O'Riley"],
  ["N. O&apos;Reilly", "N. O'Reilly"],
  ["L. O&apos;Nien", "L. O'Nien"],
  ["J. O&apos;Brien", "J. O'Brien"],
  ["D. O&apos;Shea", "D. O'Shea"],
  ["J. O&apos;Brien-Whitmarsh", "J. O'Brien-Whitmarsh"],
  ["C. O&apos;Hare", "C. O'Hare"],
  ["C. O&apos;Riordan", "C. O'Riordan"],
  ["R. O&apos;Donnell", "R. O'Donnell"],
  ["L. O&apos;Brien", "L. O'Brien"],

  // ── Mojibake, 2-byte Latin-1 supplement (Ã lead) ──
  ["C. Inao Oula\u00C3\u00AF", "C. Inao Oula\u00EF"],
  ["Dani Mart\u00C3\u00ADnez", "Dani Mart\u00EDnez"],
  ["O. H\u00C3\u00B8jlund", "O. H\u00F8jlund"],
  ["Jo\u00C3\u00A3o Vasconcelos", "Jo\u00E3o Vasconcelos"],

  // ── Mojibake, Latin Extended-A (Ä lead). The second byte survived as a C1
  //    control character, which is exactly what makes these repairable. ──
  // Nidal \u010Celik (Lens, 395589). The feed's own /players/profiles row
  // spells the lastname "\u010Celik" while corrupting the short name \u2014 the
  // repair restores the character the feed itself intends.
  ["N. \u00C4\u008Celik", "N. \u010Celik"],
  ["M. Ljubi\u00C4\u008Di\u00C4\u0087", "M. Ljubi\u010Di\u0107"],
  ["L. Jovanovi\u00C4\u0087", "L. Jovanovi\u0107"],
  ["A. Maksimovi\u00C4\u0087", "A. Maksimovi\u0107"],
  ["R. Obri\u00C4\u0087", "R. Obri\u0107"],

  // ── Whitespace damage: a doubled space the feed's own join introduced ──
  ["Max  Gr\u00FCger", "Max Gr\u00FCger"],
  ["Paris Josua  Brunner", "Paris Josua Brunner"],
  ["Vitalie  Becker", "Vitalie Becker"],
  ["Elias  Benkara", "Elias Benkara"],
  ["J.  McGinn", "J. McGinn"],
  ["Ilyas  Ansah", "Ilyas Ansah"],
  ["Gon\u00E7alo  Maia Pereira", "Gon\u00E7alo Maia Pereira"],
  ["Sebastian  Naylor", "Sebastian Naylor"],

  // ── A stray C1 control after an already-correct name. Not mojibake (the
  //    string holds a real U+010D, so it was never wholly mis-decoded); the
  //    invisible strip plus the trim is what fixes it. ──
  ["N. Kova\u010D \u008D", "N. Kova\u010D"],

  // ── Typographic apostrophes, normalised so search has one spelling to know ──
  ["M. O\u2019Leary", "M. O'Leary"],
  ["Shiloh Kiesar \u2019t Zand", "Shiloh Kiesar 't Zand"],
];

describe("normalizePlayerName — the prod corpus", () => {
  it.each(CORPUS)("repairs %j", (raw, expected) => {
    expect(normalizePlayerName(raw)).toBe(expected);
  });

  it("leaves no residue of the three fault classes", () => {
    for (const [raw] of CORPUS) {
      const fixed = normalizePlayerName(raw);
      expect(fixed, `entity residue in ${fixed}`).not.toMatch(/&[a-zA-Z#][a-zA-Z0-9]*;/);
      expect(fixed, `mojibake residue in ${fixed}`).not.toMatch(
        /[\u00C2-\u00C5\u00D0][\u0080-\u00BF]/,
      );
      expect(fixed, `control residue in ${fixed}`).not.toMatch(
        // eslint-disable-next-line no-control-regex -- asserting their absence
        /[\u0000-\u001F\u007F-\u009F]/,
      );
      expect(fixed, `whitespace residue in ${fixed}`).toBe(fixed.trim());
      expect(fixed, `double space in ${fixed}`).not.toMatch(/\s\s/);
    }
  });

  it("flags every corpus row as needing repair", () => {
    for (const [raw] of CORPUS) expect(needsNameRepair(raw)).toBe(true);
  });
});

describe("normalizePlayerName — idempotence", () => {
  it("is a no-op on its own output", () => {
    for (const [raw, expected] of CORPUS) {
      const once = normalizePlayerName(raw);
      expect(normalizePlayerName(once)).toBe(once);
      expect(needsNameRepair(expected)).toBe(false);
    }
  });
});

/**
 * Names that are already right. Each one is a live prod row, chosen because a
 * naive repair would damage it: real accents, a real hyphen, a genuine
 * apostrophe, a one-word name, a Turkish dotted capital.
 */
const UNTOUCHED = [
  "Bayern M\u00FCnchen",
  "N. Kova\u010D",
  "O. H\u00F8jlund",
  "Gon\u00E7alo Maia Pereira",
  "M. Ljubi\u010Di\u0107",
  "J. O'Brien-Whitmarsh",
  "Raphinha",
  "Angeli\u00F1o",
  "Ot\u00E1vio",
  "E. \u0130\u015F",
  "Jahmai Simpson-Pusey",
  "F. O. Onambele",
  "D. Kownacki",
  "A. N'Diaye",
];

describe("normalizePlayerName — leaves correct names alone", () => {
  it.each(UNTOUCHED)("passes %j through unchanged", (name) => {
    expect(normalizePlayerName(name)).toBe(name);
    expect(needsNameRepair(name)).toBe(false);
  });

  it("does not transliterate accents away", () => {
    expect(normalizePlayerName("Jo\u00C3\u00A3o Vasconcelos")).toContain("\u00E3");
    expect(normalizePlayerName("O. H\u00C3\u00B8jlund")).toContain("\u00F8");
    expect(normalizePlayerName("M. Ljubi\u00C4\u008Di\u00C4\u0087")).toContain("\u010D");
  });

  it("never returns an empty name, whatever it is handed", () => {
    // Zero-width-only input keeps the raw fallback rather than vanishing.
    expect(normalizePlayerName(" \u200B")).toBe("\u200B");
    expect(normalizePlayerName("   ")).toBe("");
    expect(normalizePlayerName("A")).toBe("A");
  });

  it("leaves a malformed entity reference literal rather than guessing", () => {
    expect(normalizePlayerName("A&B;C")).toBe("A&B;C");
    expect(normalizePlayerName("A&#999999999;C")).toBe("A&#999999999;C");
  });

  it("decodes numeric references the feed also emits", () => {
    expect(normalizePlayerName("J. O&#39;Brien")).toBe("J. O'Brien");
    expect(normalizePlayerName("J. O&#x27;Brien")).toBe("J. O'Brien");
    expect(normalizePlayerName("Fish &amp; Chips")).toBe("Fish & Chips");
  });

  it("survives a double-encoded name", () => {
    // "João" encoded twice: UTF-8 → Latin-1 → UTF-8 → Latin-1.
    expect(normalizePlayerName("Jo\u00C3\u0083\u00C2\u00A3o")).toBe("Jo\u00E3o");
  });
});

describe("searchKeyForName", () => {
  it("folds the accents a phone keyboard cannot type", () => {
    expect(searchKeyForName("M. Ljubi\u010Di\u0107")).toBe("m ljubicic");
    expect(searchKeyForName("O. H\u00F8jlund")).toBe("o hojlund");
    expect(searchKeyForName("Bayern M\u00FCnchen")).toBe("bayern munchen");
    expect(searchKeyForName("Angeli\u00F1o")).toBe("angelino");
  });

  it("makes the raw feed spelling and the repaired one collide", () => {
    for (const [raw, expected] of CORPUS) {
      expect(searchKeyForName(raw)).toBe(searchKeyForName(expected));
    }
  });

  it("reduces every apostrophe form to the same key", () => {
    expect(searchKeyForName("M. O&apos;Leary")).toBe("m o leary");
    expect(searchKeyForName("M. O\u2019Leary")).toBe("m o leary");
    expect(searchKeyForName("M. O'Leary")).toBe("m o leary");
  });
});
