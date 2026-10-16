import { afterEach, describe, expect, it, vi } from "vitest";
import { isInstagramVisitor, tierGrid } from "@/lib/dailyShare";

const run = (pattern: string) => pattern.split("").map((c) => ({ correct: c === "1" }));

describe("tierGrid", () => {
  it("groups ten rounds 3 / 3 / 3 / 1 by difficulty tier", () => {
    expect(tierGrid(run("1110101011"))).toBe("🟩🟩🟩 🟥🟩🟥 🟩🟥🟩 🟩");
  });

  it("leaves a short run ungrouped past its last round", () => {
    expect(tierGrid(run("10"))).toBe("🟩🟥");
    expect(tierGrid([])).toBe("");
  });
});

describe("isInstagramVisitor", () => {
  afterEach(() => vi.restoreAllMocks());

  it("spots Instagram's in-app browser by its user agent", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0.0",
    );
    expect(isInstagramVisitor()).toBe(true);
  });

  it("is false for a plain phone browser with no Instagram referrer", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );
    vi.spyOn(document, "referrer", "get").mockReturnValue("https://www.google.com/");
    expect(isInstagramVisitor()).toBe(false);
  });
});
