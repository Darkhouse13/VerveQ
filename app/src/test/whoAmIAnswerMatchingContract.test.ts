import { describe, expect, it } from "vitest";

import { buildAnswerAliases } from "../../convex/whoAmI";
import {
  buildWhoAmIComparisonFeedback,
  findMetadataEntryByName,
  resolveCanonicalPlayerName,
} from "../../convex/whoAmIPlayerSearch";
import { findBestMatch } from "../../convex/lib/fuzzy";

/**
 * Curated whoAmIApprovedClues store answers as "B. Matuidi" while players type
 * the full names the clues describe. These contracts pin the bridge between
 * the two: canonical resolution, alias acceptance, and deduction feedback.
 */

const metadata = {
  "Blaise Matuidi": { club: "Juventus", position: "Midfielder", nationality: "France" },
  "Paul Pogba": { club: "Juventus", position: "Midfielder", nationality: "France" },
  "André Ayew": { club: "Swansea City", position: "Attacker", nationality: "Ghana" },
  "Jordan Ayew": { club: "Crystal Palace", position: "Attacker", nationality: "Ghana" },
  "Virgil van Dijk": { club: "Liverpool", position: "Defender", nationality: "Netherlands" },
};

describe("resolveCanonicalPlayerName", () => {
  it("resolves an abbreviated stored answer to its unique full-name key", () => {
    expect(resolveCanonicalPlayerName(metadata, "B. Matuidi")).toBe("Blaise Matuidi");
    expect(resolveCanonicalPlayerName(metadata, "V. van Dijk")).toBe("Virgil van Dijk");
  });

  it("keeps the stored form when the abbreviation is ambiguous", () => {
    // Both André and Jordan Ayew normalize to an initial that differs, but
    // an initial-less collision must not guess: "A. Ayew" is unique, "J. Ayew" is unique.
    expect(resolveCanonicalPlayerName(metadata, "A. Ayew")).toBe("André Ayew");
    expect(resolveCanonicalPlayerName(metadata, "J. Ayew")).toBe("Jordan Ayew");
  });

  it("passes through full names and unknown names unchanged", () => {
    expect(resolveCanonicalPlayerName(metadata, "Blaise Matuidi")).toBe("Blaise Matuidi");
    expect(resolveCanonicalPlayerName(metadata, "Z. Nobody")).toBe("Z. Nobody");
  });
});

describe("who-am-i answer acceptance (abbreviated stored answer)", () => {
  const aliases = buildAnswerAliases(
    "B. Matuidi",
    resolveCanonicalPlayerName(metadata, "B. Matuidi"),
  );

  it("accepts the full correct name the clues describe", () => {
    expect(findBestMatch("Blaise Matuidi", aliases).matched).toBe(true);
    expect(findBestMatch("blaise matuidi", aliases).matched).toBe(true);
  });

  it("accepts the bare surname exactly (no typo budget needed)", () => {
    const result = findBestMatch("Matuidi", aliases);
    expect(result.matched).toBe(true);
    expect(result.distance).toBe(0);
  });

  it("accepts the stored abbreviated form", () => {
    expect(findBestMatch("B. Matuidi", aliases).matched).toBe(true);
  });

  it("still rejects a different well-known player", () => {
    expect(findBestMatch("Paul Pogba", aliases).matched).toBe(false);
  });

  it("makes short-surname clue sets winnable by surname", () => {
    const ayewAliases = buildAnswerAliases(
      "A. Ayew",
      resolveCanonicalPlayerName(metadata, "A. Ayew"),
    );
    const result = findBestMatch("Ayew", ayewAliases);
    expect(result.matched).toBe(true);
    expect(result.distance).toBe(0);
    expect(findBestMatch("André Ayew", ayewAliases).matched).toBe(true);
  });

  it("handles multiword surnames end to end", () => {
    const vvdAliases = buildAnswerAliases(
      "V. van Dijk",
      resolveCanonicalPlayerName(metadata, "V. van Dijk"),
    );
    expect(findBestMatch("Virgil van Dijk", vvdAliases).matched).toBe(true);
    expect(findBestMatch("van Dijk", vvdAliases).matched).toBe(true);
  });
});

describe("deduction feedback with abbreviated answers", () => {
  it("resolves both guess and abbreviated answer to real metadata", () => {
    const feedback = buildWhoAmIComparisonFeedback(metadata, "Paul Pogba", "B. Matuidi");
    expect(feedback).toMatchObject({
      nationality: "correct",
      position: "correct",
      team: "correct",
    });
  });

  it("tolerates case and diacritics in the guess lookup", () => {
    expect(findMetadataEntryByName(metadata, "andre ayew")).toBe(metadata["André Ayew"]);
  });

  it("still reports unknown for players outside the metadata", () => {
    const feedback = buildWhoAmIComparisonFeedback(metadata, "Not A Player", "B. Matuidi");
    expect(feedback).toMatchObject({
      nationality: "unknown",
      position: "unknown",
      team: "unknown",
    });
  });
});
