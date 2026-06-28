import { describe, expect, it } from "vitest";

import {
  buildPlayerSearchText,
  expandPlayerDisplayName,
  playerSearchTokens,
} from "../../convex/lib/playerSearch";

describe("playerSearchTokens / buildPlayerSearchText", () => {
  it("flattens name + firstName + lastName into distinct folded tokens", () => {
    expect(playerSearchTokens("H. Kane", "Harry Edward", "Kane").sort()).toEqual([
      "edward",
      "h",
      "harry",
      "kane",
    ]);
    expect(
      buildPlayerSearchText("E. Haaland", "Erling", "Braut Haaland").split(" ").sort(),
    ).toEqual(["braut", "e", "erling", "haaland"]);
  });

  it("folds accents so an unaccented query can match", () => {
    expect(buildPlayerSearchText("Kylian Mbappé", "Kylian", "Mbappé Lottin")).toContain(
      "mbappe",
    );
  });

  it("is empty when no name parts are present", () => {
    expect(buildPlayerSearchText(undefined, null, "")).toBe("");
  });
});

describe("expandPlayerDisplayName", () => {
  it("expands abbreviated names from first given name + surname", () => {
    expect(expandPlayerDisplayName("H. Kane", "Harry Edward", "Kane")).toBe("Harry Kane");
    expect(
      expandPlayerDisplayName("J. Bellingham", "Jude Victor William", "Bellingham"),
    ).toBe("Jude Bellingham");
  });

  it("leaves already-full display names untouched", () => {
    expect(expandPlayerDisplayName("Lionel Messi", "Lionel", "Messi")).toBe("Lionel Messi");
    expect(expandPlayerDisplayName("Son Heung-Min", "Heung-Min", "Son")).toBe(
      "Son Heung-Min",
    );
  });

  it("falls back to the stored name when first/last name are missing", () => {
    expect(expandPlayerDisplayName("H. Kane")).toBe("H. Kane");
  });
});
