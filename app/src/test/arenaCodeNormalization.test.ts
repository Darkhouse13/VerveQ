import { describe, expect, it } from "vitest";

import { normalizeArenaCode } from "@/lib/arena";

describe("normalizeArenaCode", () => {
  it("keeps direct short arena codes uppercase", () => {
    expect(normalizeArenaCode(" e8m8jf ")).toBe("E8M8JF");
  });

  it("extracts the code from pasted arena links", () => {
    expect(normalizeArenaCode("https://verveq.com/arena/e8m8jf")).toBe("E8M8JF");
    expect(normalizeArenaCode("https://www.verveq.com/arena/E8M8JF?utm_source=share")).toBe("E8M8JF");
  });

  it("extracts the code from shared text containing an arena link", () => {
    expect(normalizeArenaCode("Join my VerveQ arena: https://verveq.com/arena/e8m8jf"))
      .toBe("E8M8JF");
  });
});
