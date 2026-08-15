import { describe, expect, it } from "vitest";

import { buildCareerPathSharePayload } from "@/lib/careerPathShare";

describe("career path result sharing", () => {
  it("always sends friends through the canonical marketed /play door", () => {
    expect(buildCareerPathSharePayload("I got 7/10")).toEqual({
      title: "VerveQ Career Path",
      text: "I got 7/10",
      url: "https://verveq.com/play",
    });
  });
});
