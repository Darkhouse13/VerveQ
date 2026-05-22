import { describe, expect, it } from "vitest";

import { buildWhoAmIComparisonFeedback } from "../../convex/whoAmIPlayerSearch";

describe("Who Am I deduction feedback", () => {
  const metadata = {
    "Thierry Henry": {
      club: "Arsenal",
      position: "Forward",
      nationality: "France",
    },
    "Sadio Mane": {
      club: "Liverpool",
      position: "Forward",
      nationality: "Senegal",
    },
    "Patrick Vieira": {
      club: "Arsenal",
      position: "Midfielder",
      nationality: "France",
    },
  };

  it("compares wrong guesses against the hidden answer without exposing the answer name", () => {
    const feedback = buildWhoAmIComparisonFeedback(metadata, "Sadio Mane", "Thierry Henry");

    expect(feedback).toEqual({
      guessedPlayerName: "Sadio Mane",
      nationality: "incorrect",
      position: "correct",
      team: "incorrect",
    });
    expect(feedback).not.toHaveProperty("answerName");
  });

  it("reports correct overlap for shared nationality and club dimensions", () => {
    const feedback = buildWhoAmIComparisonFeedback(metadata, "Patrick Vieira", "Thierry Henry");

    expect(feedback).toMatchObject({
      nationality: "correct",
      position: "incorrect",
      team: "correct",
    });
  });

  it("uses unknown when metadata is missing", () => {
    const feedback = buildWhoAmIComparisonFeedback(metadata, "Unknown Player", "Thierry Henry");

    expect(feedback).toMatchObject({
      guessedPlayerName: "Unknown Player",
      nationality: "unknown",
      position: "unknown",
      team: "unknown",
    });
  });
});
