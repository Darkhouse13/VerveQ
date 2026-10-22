import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildTokens, serialize, TOKENS_PATH } from "../../scripts/exportTokens.mjs";
import tokens from "@/styles/tokens.json";

/**
 * src/styles/tokens.json is GENERATED from src/index.css (VerveQ ONE P4.5) —
 * the file the content factory imports for the brand. A token edit without a
 * re-export (`node scripts/exportTokens.mjs`) fails here.
 */
describe("design tokens export", () => {
  it("is current with src/index.css", () => {
    expect(readFileSync(TOKENS_PATH, "utf8")).toBe(serialize(buildTokens()));
  });

  it("carries the owner-approved brand values", () => {
    expect(tokens.palette.ink.hex).toBe("#121212");
    expect(tokens.palette.cream.hex).toBe("#FFF7F0");
    expect(tokens.palette.lime.hex).toBe("#C6FF1A");
    expect(tokens.palette.blue.hex).toBe("#0084FF");
    expect(tokens.palette.pink.hex).toBe("#FF3DC5");
    expect(tokens.theme.ink.background.hex).toBe(tokens.palette.ink.hex);
    expect(tokens.theme.ink.action.hex).toBe(tokens.palette.lime.hex);
    expect(tokens.theme.paper.background.hex).toBe(tokens.palette.cream.hex);
    expect(tokens.type.heading.family).toBe("Space Grotesk");
    expect(tokens.type.mono.family).toBe("JetBrains Mono");
  });
});
