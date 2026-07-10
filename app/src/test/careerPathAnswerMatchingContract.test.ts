import { describe, expect, it } from "vitest";

import {
  buildCareerPathAnswerAliases,
  getCareerPathEntries,
  CAREER_PATH_MAX_GUESSES,
} from "../../convex/careerPath";
import {
  clubName,
  clubIsLoan,
  clubsForDisplay,
  CAREER_PATH_MAX_DISPLAY_CLUBS,
} from "../../convex/lib/careerPathClubs";
import { findBestMatch, getMaxFuzzyDistance } from "../../convex/lib/fuzzy";
import { normalizeAnswer } from "../../convex/lib/scoring";

/**
 * Career Path grades a free-typed name against the round's answer with NO
 * autocomplete to lean on, so the server-side alias set + the length-scaled
 * typo budget ARE the input UX. These contracts pin both.
 */

describe("buildCareerPathAnswerAliases", () => {
  it("accepts the full name, bare surname, multiword surname, and initialed forms", () => {
    const aliases = buildCareerPathAnswerAliases("Virgil van Dijk");
    expect(aliases).toContain("Virgil van Dijk");
    expect(aliases).toContain("Dijk");
    expect(aliases).toContain("van Dijk");
    expect(aliases).toContain("V Dijk");
    expect(aliases).toContain("V. Dijk");
  });

  it("does NOT emit a bare-initials alias (fuzzy budget would over-accept)", () => {
    // The old Who Am I builder emitted "LM" for Lionel Messi; with a fuzzy
    // budget of 1 on short strings, that would accept nearly any 1-2 letter
    // guess. Career Path deliberately drops it.
    const aliases = buildCareerPathAnswerAliases("Lionel Messi");
    expect(aliases).not.toContain("LM");
    expect(aliases).toContain("Messi");
  });

  it("folds acceptedAnswers (nicknames) into the gradeable set", () => {
    const aliases = buildCareerPathAnswerAliases("Javier Hernández", ["Chicharito"]);
    expect(aliases).toContain("Chicharito");
    expect(aliases).toContain("Hernández");
  });

  it("keeps single-word names as-is", () => {
    expect(buildCareerPathAnswerAliases("Ronaldinho")).toEqual(["Ronaldinho"]);
  });
});

describe("typo tolerance scales with name length", () => {
  it("short names get a 1-edit budget, medium 2, long 3", () => {
    expect(getMaxFuzzyDistance(normalizeAnswer("Messi"))).toBe(1);
    expect(getMaxFuzzyDistance(normalizeAnswer("van Dijk"))).toBe(2);
    expect(getMaxFuzzyDistance(normalizeAnswer("Zlatan Ibrahimović"))).toBe(3);
  });

  it("accepts an exact surname with no typo flag", () => {
    const res = findBestMatch("messi", buildCareerPathAnswerAliases("Lionel Messi"));
    expect(res.matched).toBe(true);
    expect(res.typoAccepted).toBe(false);
  });

  it("accepts a within-budget typo and flags it typoAccepted", () => {
    const res = findBestMatch("mesi", buildCareerPathAnswerAliases("Lionel Messi"));
    expect(res.matched).toBe(true);
    expect(res.typoAccepted).toBe(true);
  });

  it("gives long names a bigger typo pass", () => {
    const res = findBestMatch(
      "zlatan ibrahimovik",
      buildCareerPathAnswerAliases("Zlatan Ibrahimović"),
    );
    expect(res.matched).toBe(true);
  });

  it("folds diacritics before matching", () => {
    const res = findBestMatch("hernandez", buildCareerPathAnswerAliases("Javier Hernández"));
    expect(res.matched).toBe(true);
    expect(res.typoAccepted).toBe(false);
  });

  it("flags a near-miss just past the budget as closeCall, not matched", () => {
    // "masso" is 2 edits from "messi"; the 5-letter budget is 1.
    const res = findBestMatch("masso", buildCareerPathAnswerAliases("Lionel Messi"));
    expect(res.matched).toBe(false);
    expect(res.closeCall).toBe(true);
  });

  it("rejects a different player's name outright", () => {
    const res = findBestMatch("Cristiano Ronaldo", buildCareerPathAnswerAliases("Lionel Messi"));
    expect(res.matched).toBe(false);
    expect(res.closeCall).toBe(false);
  });
});

describe("career path content dataset", () => {
  const entries = getCareerPathEntries();

  it("ships a real pool for every difficulty tier", () => {
    expect(entries.length).toBeGreaterThanOrEqual(100);
    for (const tier of ["easy", "medium", "hard"]) {
      expect(entries.filter((e) => e.difficulty === tier).length).toBeGreaterThanOrEqual(20);
    }
  });

  it("every entry has a unique id, a unique answer, and at least two clubs", () => {
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const entry of entries) {
      expect(entry.id).toMatch(/^cp-[a-z0-9-]+$/);
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(names.has(entry.answerName)).toBe(false);
      names.add(entry.answerName);
      expect(entry.answerName.trim().length).toBeGreaterThan(0);
      expect(["easy", "medium", "hard"]).toContain(entry.difficulty);
      expect(entry.clubs.length).toBeGreaterThanOrEqual(2);
      for (const club of entry.clubs) {
        expect(clubName(club).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("marks loan spells as structured { name, loan: true } objects, never bare noise", () => {
    let loanCount = 0;
    for (const entry of entries) {
      for (const club of entry.clubs) {
        if (typeof club === "string") continue;
        // Object form is reserved for loans — no bare-name objects, no loan:false.
        expect(typeof club.name).toBe("string");
        expect(club.name.trim().length).toBeGreaterThan(0);
        expect(club.loan).toBe(true);
        expect(clubIsLoan(club)).toBe(true);
        loanCount++;
      }
    }
    // The whole point of the structured shape: loans are actually represented.
    expect(loanCount).toBeGreaterThan(0);
  });

  it("never carries nationality — the path is the only clue", () => {
    for (const entry of entries) {
      expect(entry).not.toHaveProperty("nationality");
      expect(entry).not.toHaveProperty("position");
    }
  });

  it("every answer is reachable through the alias builder", () => {
    for (const entry of entries) {
      const res = findBestMatch(
        entry.answerName,
        buildCareerPathAnswerAliases(entry.answerName, entry.acceptedAnswers),
      );
      expect(res.matched).toBe(true);
      expect(res.typoAccepted).toBe(false);
    }
  });

  it("keeps the guess economy at three attempts", () => {
    expect(CAREER_PATH_MAX_GUESSES).toBe(3);
  });
});

describe("clubsForDisplay condenses only very long paths", () => {
  it("passes short/normal paths through unchanged with 1-based positions", () => {
    const clubs = ["Ajax", { name: "PSV", loan: true }, "Barcelona"];
    const rows = clubsForDisplay(clubs);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.kind === "club")).toBe(true);
    expect(rows.map((r) => (r.kind === "club" ? r.position : 0))).toEqual([1, 2, 3]);
    expect(rows[1]).toMatchObject({ kind: "club", name: "PSV", loan: true, position: 2 });
  });

  it("condenses an over-long path to head + gap + tail with a truthful hidden count", () => {
    const clubs = Array.from({ length: 20 }, (_, i) => `Club ${i + 1}`);
    const rows = clubsForDisplay(clubs);
    expect(rows).toHaveLength(CAREER_PATH_MAX_DISPLAY_CLUBS);
    const gaps = rows.filter((r) => r.kind === "gap");
    expect(gaps).toHaveLength(1);
    const clubRows = rows.filter((r) => r.kind === "club");
    // head 6 + tail 5 = 11 real clubs shown, 1 gap row
    expect(clubRows).toHaveLength(CAREER_PATH_MAX_DISPLAY_CLUBS - 1);
    const positions = clubRows.map((r) => (r.kind === "club" ? r.position : 0));
    expect(positions).toEqual([1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20]);
    // hidden = total - shown; every real spell is accounted for (nothing lost, just not drawn)
    const hidden = gaps[0].kind === "gap" ? gaps[0].hidden : 0;
    expect(hidden).toBe(clubs.length - (CAREER_PATH_MAX_DISPLAY_CLUBS - 1));
    expect(clubRows.length + hidden).toBe(clubs.length);
  });

  it("never condenses at exactly the cap", () => {
    const clubs = Array.from({ length: CAREER_PATH_MAX_DISPLAY_CLUBS }, (_, i) => `C${i}`);
    const rows = clubsForDisplay(clubs);
    expect(rows).toHaveLength(CAREER_PATH_MAX_DISPLAY_CLUBS);
    expect(rows.some((r) => r.kind === "gap")).toBe(false);
  });
});
