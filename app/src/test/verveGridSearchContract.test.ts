import { describe, expect, it } from "vitest";

import {
  buildRosterSearchPrefixes,
  rankRosterSearchResults,
} from "../../convex/verveGrid";

/**
 * VerveGrid search must behave like a full-roster autocomplete, not an answer
 * oracle: results are ranked purely by name relevance, and the only exclusion
 * is players already locked into other cells. Correctness is decided on
 * lock-in (submitGuess), never in search.
 */

const roster = [
  { externalId: "fb_1", name: "B. Foster", position: "Goalkeeper", nationality: "England" },
  { externalId: "fb_2", name: "Jack Butland", position: "Goalkeeper", nationality: "England" },
  { externalId: "fb_3", name: "Maik Taylor", position: "Goalkeeper", nationality: "Northern Ireland" },
  { externalId: "fb_4", name: "Lionel Messi", position: "Attacker", nationality: "Argentina" },
  { externalId: "fb_5", name: "Fostino Unrelated", position: "Defender", nationality: "Italy" },
];

describe("buildRosterSearchPrefixes", () => {
  it("probes the query as typed plus a title-cased variant", () => {
    expect(buildRosterSearchPrefixes("butland")).toEqual(["butland", "Butland"]);
    expect(buildRosterSearchPrefixes("jack butland")).toEqual([
      "jack butland",
      "Jack Butland",
    ]);
  });

  it("collapses duplicate variants and trims whitespace", () => {
    expect(buildRosterSearchPrefixes("  Foster ")).toEqual(["Foster"]);
    expect(buildRosterSearchPrefixes("   ")).toEqual([]);
  });
});

describe("rankRosterSearchResults", () => {
  it("matches surnames of abbreviated stored names", () => {
    const results = rankRosterSearchResults(roster, "foster");
    expect(results.map((r) => r.externalId)).toContain("fb_1");
  });

  it("returns famous players regardless of cell validity (no oracle)", () => {
    const results = rankRosterSearchResults(roster, "messi");
    expect(results.map((r) => r.name)).toEqual(["Lionel Messi"]);
  });

  it("ranks prefix matches first and dedupes by externalId", () => {
    const withDupes = [...roster, roster[0]];
    const results = rankRosterSearchResults(withDupes, "fost");
    expect(results.filter((r) => r.externalId === "fb_1")).toHaveLength(1);
    expect(results[0].name).toBe("Fostino Unrelated"); // normalized prefix match leads
  });

  it("excludes players already locked into other cells", () => {
    const results = rankRosterSearchResults(roster, "butland", new Set(["fb_2"]));
    expect(results.map((r) => r.externalId)).not.toContain("fb_2");
  });

  it("caps the result list", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      externalId: `fb_x${i}`,
      name: `Fosterson ${i}`,
    }));
    expect(rankRosterSearchResults(many, "foster")).toHaveLength(10);
  });
});

/**
 * The roster stores abbreviated display names ("H. Kane") with the real given
 * name in firstName and a possibly-compound surname in lastName ("Braut
 * Haaland"). Search must reach players by their well-known full name and by any
 * surname token — not just the stored abbreviation. (Regression: "Harry Kane"
 * and even "Haaland" used to return nothing.)
 */
describe("rankRosterSearchResults — full names & compound surnames", () => {
  const stars = [
    {
      externalId: "kane",
      name: "H. Kane",
      firstName: "Harry Edward",
      lastName: "Kane",
      nationality: "England",
    },
    {
      externalId: "haaland",
      name: "E. Haaland",
      firstName: "Erling",
      lastName: "Braut Haaland",
      nationality: "Norway",
    },
    {
      externalId: "bellingham",
      name: "J. Bellingham",
      firstName: "Jude Victor William",
      lastName: "Bellingham",
      nationality: "England",
    },
    {
      externalId: "messi",
      name: "Lionel Messi",
      firstName: "Lionel Andrés",
      lastName: "Messi",
      nationality: "Argentina",
    },
  ];

  it("finds an abbreviated player by their full name", () => {
    expect(rankRosterSearchResults(stars, "Harry Kane").map((r) => r.externalId)).toContain("kane");
    expect(
      rankRosterSearchResults(stars, "Jude Bellingham").map((r) => r.externalId),
    ).toContain("bellingham");
  });

  it("finds a player by a non-leading compound-surname token", () => {
    expect(rankRosterSearchResults(stars, "Haaland").map((r) => r.externalId)).toContain("haaland");
    expect(
      rankRosterSearchResults(stars, "Erling Haaland").map((r) => r.externalId),
    ).toContain("haaland");
  });

  it("still finds by surname alone", () => {
    expect(rankRosterSearchResults(stars, "kane").map((r) => r.externalId)).toContain("kane");
  });

  it("tolerates a typo in a longer surname", () => {
    expect(
      rankRosterSearchResults(stars, "Bellinghan").map((r) => r.externalId),
    ).toContain("bellingham");
  });
});
