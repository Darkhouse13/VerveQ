/**
 * Ticket D4 — entry-tile plain-words descriptors.
 *
 * Pins three things:
 *  1. descriptorLine() output for EVERY archetype in the accepted c13-2 config
 *     (enumerated — a retune that adds or reshapes an archetype fails here and
 *     forces a mapping review rather than silently rendering wrong words).
 *  2. The STOP-shape guard: modifier shapes the mapping cannot express throw
 *     DescriptorShapeError instead of guessing.
 *  3. The dual mount: the entry variant renders descriptors, the default
 *     draft mount renders none.
 */

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { C13V2_CONFIG } from "@/lib/drawEngine/configs/c13v2";
import type { Fixture, FixtureModifier } from "@/lib/drawEngine";
import { DescriptorShapeError, descriptorLine } from "@/components/draw/fixtureEffects";
import { FixtureStrip } from "@/components/draw/FixtureStrip";

function fixtureOf(archetypeId: string, modifiers: FixtureModifier[], index = 0): Fixture {
  return { index, archetypeId, modifiers, threshold: 375, isBoss: false };
}

/** Every archetype currently in c13-2, with the exact line each must produce. */
const EXPECTED: Record<string, string> = {
  ARCH_WALL: "defenders shine · attackers fade",
  ARCH_BLITZ: "attackers shine · defenders fade",
  ARCH_ENGINE: "midfielders shine · keepers fade",
  ARCH_THROWBACK: "80s and earlier shine",
  ARCH_NEWWAVE: "90s and later shine",
  ARCH_FORTRESS_KEEPER: "keepers shine · midfielders fade",
};

describe("descriptorLine — c13-2 archetypes", () => {
  it("covers every archetype in the config (enumeration is exhaustive)", () => {
    expect(C13V2_CONFIG.archetypes.map((a) => a.id).sort()).toEqual(
      Object.keys(EXPECTED).sort(),
    );
  });

  for (const arch of C13V2_CONFIG.archetypes) {
    it(`${arch.id} → "${EXPECTED[arch.id]}"`, () => {
      expect(descriptorLine(fixtureOf(arch.id, arch.modifiers))).toBe(EXPECTED[arch.id]);
    });
  }
});

describe("descriptorLine — STOP-shape guard", () => {
  it("throws on a tag (club) boost — no mapping exists", () => {
    const f = fixtureOf("ARCH_X", [{ kind: "club", value: "CLUB_A", mult: 1.5 } as FixtureModifier]);
    expect(() => descriptorLine(f)).toThrow(DescriptorShapeError);
  });

  it("throws on an era cut — the mapping only covers era boosts", () => {
    const f = fixtureOf("ARCH_X", [
      { kind: "position", value: "DEF", mult: 2 },
      { kind: "eraBefore", value: 3, mult: 0.7 },
    ] as FixtureModifier[]);
    expect(() => descriptorLine(f)).toThrow(DescriptorShapeError);
  });

  it("throws on two boosts", () => {
    const f = fixtureOf("ARCH_X", [
      { kind: "position", value: "DEF", mult: 2 },
      { kind: "position", value: "GK", mult: 1.3 },
    ] as FixtureModifier[]);
    expect(() => descriptorLine(f)).toThrow(DescriptorShapeError);
  });

  it("throws on a flat ×1 modifier", () => {
    const f = fixtureOf("ARCH_X", [
      { kind: "position", value: "DEF", mult: 2 },
      { kind: "position", value: "ATT", mult: 1 },
    ] as FixtureModifier[]);
    expect(() => descriptorLine(f)).toThrow(DescriptorShapeError);
  });
});

describe("FixtureStrip mounts", () => {
  const fixtures = C13V2_CONFIG.archetypes
    .slice(0, 5)
    .map((a, i) => fixtureOf(a.id, a.modifiers, i));

  it("entry variant renders a descriptor on every chip", () => {
    render(
      <FixtureStrip fixtures={fixtures} activeIndex={null} clearedCount={0} variant="entry" />,
    );
    for (const f of fixtures) {
      expect(screen.getByTestId(`draw-fixture-descriptor-${f.index}`)).toHaveTextContent(
        EXPECTED[f.archetypeId],
      );
    }
  });

  it("default (draft) mount renders no descriptors", () => {
    render(<FixtureStrip fixtures={fixtures} activeIndex={0} clearedCount={0} />);
    for (const f of fixtures) {
      expect(screen.queryByTestId(`draw-fixture-descriptor-${f.index}`)).toBeNull();
    }
  });
});
