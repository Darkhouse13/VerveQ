import { describe, expect, it } from "vitest";
import { cleanDisplayName, isBlockedName } from "../../convex/lib/usernameBlocklist";

describe("isBlockedName", () => {
  it.each([
    "nigganigga",
    "xx_nigga_99",
    "n1gg3r",
    "NIGGER",
    "faggot_fc",
    "spic_99",
    "c00n",
    "kike",
    "hitler_fan",
    "kkk_member",
  ])("blocks %s", (name) => {
    expect(isBlockedName(name)).toBe(true);
  });

  it.each([
    "pueblo",
    "inigo_perez",
    "spice_master",
    "raccoon",
    "pakistan_fan",
    "nigeria_fan",
    "niger_delta",
    "scunthorpe",
    "cocoon",
    "dykes_fc_fan",
    "kikelo",
    "chinkapin_tree",
    "nazir",
    "player_7",
  ])("allows %s", (name) => {
    expect(isBlockedName(name)).toBe(false);
  });
});

describe("cleanDisplayName", () => {
  it("drops blocked and empty names", () => {
    expect(cleanDisplayName("  nigga  ")).toBeUndefined();
    expect(cleanDisplayName("   ")).toBeUndefined();
    expect(cleanDisplayName(undefined)).toBeUndefined();
  });
  it("keeps normal names trimmed", () => {
    expect(cleanDisplayName("  Kylian ")).toBe("Kylian");
  });
});
