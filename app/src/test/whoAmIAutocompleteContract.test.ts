import { describe, expect, it } from "vitest";

import {
  WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH,
  searchWhoAmIPlayersFromMetadata,
} from "../../convex/whoAmIPlayerSearch";

describe("Who Am I player autocomplete contract", () => {
  const metadata = {
    "Lionel Messi": {
      club: "Inter Miami",
      position: "Forward",
      nationality: "Argentina",
      era: "2000s",
    },
    "Cristiano Ronaldo": {
      club: "Al Nassr",
      position: "Forward",
      nationality: "Portugal",
      era: "2000s",
    },
    "Ronaldo Nazario": {
      club: "Real Madrid",
      position: "Forward",
      nationality: "Brazil",
      era: "1990s",
    },
  };

  it("requires at least three typed characters before returning suggestions", () => {
    expect(WHO_AM_I_PLAYER_SEARCH_MIN_QUERY_LENGTH).toBe(3);
    expect(searchWhoAmIPlayersFromMetadata(metadata, "ro")).toEqual([]);
  });

  it("clamps client-supplied result limits to the server-side max", () => {
    expect(searchWhoAmIPlayersFromMetadata(metadata, "ron", -1)).toHaveLength(1);
    expect(searchWhoAmIPlayersFromMetadata(metadata, "ron", 999)).toHaveLength(2);
  });

  it("returns safe player picker fields and never includes answer-only fields", () => {
    const results = searchWhoAmIPlayersFromMetadata(metadata, "ron");

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.name)).toEqual([
      "Ronaldo Nazario",
      "Cristiano Ronaldo",
    ]);
    expect(results[1]).toMatchObject({
      name: "Cristiano Ronaldo",
      nationality: "Portugal",
      team: "Al Nassr",
      position: "Forward",
    });
    expect(results[1]).toHaveProperty("playerId");
    expect(results[1]).not.toHaveProperty("answerName");
    expect(results[1]).not.toHaveProperty("clueExternalId");
  });
});
