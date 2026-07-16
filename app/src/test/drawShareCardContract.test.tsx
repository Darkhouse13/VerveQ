/**
 * Share card contract (Ticket B, S5): the share surface is spoiler-free —
 * ZERO card names, zero card ids, zero board contents. Checked against the
 * entire pinned card set, on the rendered DOM and on the share text.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { LocalMockApi } from "@/lib/drawApi";
import { MOCK_CARD_SET_SEED, MOCK_ENGINE_CONFIG } from "@/lib/drawApi/mockConfig";
import { generateCardSet } from "@/lib/drawEngine";
import type { DrawRunView } from "@/lib/drawApi/types";
import { ShareCard } from "@/components/draw/ShareCard";
import { buildIdentity, buildShareText, buildTrail } from "@/components/draw/share";
import type { ShareCardData } from "@/components/draw/share";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

async function finishedRun(): Promise<DrawRunView> {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  let view = await api.startRun();
  while (view.phase === "draft") {
    view = await api.submitChoice({ type: "pick", offerIndex: 0 });
  }
  while (view.phase !== "done") {
    view =
      view.phase === "bench"
        ? await api.submitChoice({ type: "bench", squadIndex: 0 })
        : await api.submitChoice({ type: "push" });
  }
  return view;
}

function shareDataFor(view: DrawRunView): ShareCardData {
  return {
    boardNumber: view.boardNumber,
    outcome: view.outcome!,
    trail: buildTrail(view.rounds, view.outcome!),
    identity: buildIdentity(view.rounds),
    score: view.finalScore ?? 0,
    url: "https://verveq.com/draw",
    // Ticket F (F6): the leak contract must hold whether or not the rarity
    // line renders, so the spoiler-free assertions below run with a population
    // above the floor — the branch that puts the MOST text on the card.
    rarity: { linePercent: 4.2, population: 500 },
  };
}

describe("Draw share card", () => {
  it("renders board #, outcome trail and score with ZERO card names or ids", async () => {
    const view = await finishedRun();
    const data = shareDataFor(view);
    const { container } = render(<ShareCard data={data} />);
    const text = container.textContent ?? "";

    // Positive content: spoiler-free essentials are present.
    expect(text).toContain(`#${view.boardNumber}`);
    expect(text).toContain(data.trail);
    expect(text).toContain(Math.round(data.score).toLocaleString("en-US"));

    // Negative content: not one name from the ENTIRE card set, no card ids,
    // and none of the drafted squad's names in particular.
    const cardSet = generateCardSet(MOCK_CARD_SET_SEED, MOCK_ENGINE_CONFIG.cardGen);
    expect(cardSet.length).toBeGreaterThan(0);
    const html = container.innerHTML;
    for (const card of cardSet) {
      expect(text).not.toContain(card.name);
      expect(html).not.toContain(card.name);
      expect(html).not.toContain(card.id);
    }
  });

  it("share TEXT is equally spoiler-free and carries the link", async () => {
    const view = await finishedRun();
    const data = shareDataFor(view);
    const text = buildShareText(data);
    expect(text).toContain(`THE DRAW #${view.boardNumber}`);
    expect(text).toContain("https://verveq.com/draw");
    const cardSet = generateCardSet(MOCK_CARD_SET_SEED, MOCK_ENGINE_CONFIG.cardGen);
    for (const card of cardSet) {
      expect(text).not.toContain(card.name);
      expect(text).not.toContain(card.id);
    }
  });

  it("identity line names a tag chain, never a card (when a chain was granted)", async () => {
    const view = await finishedRun();
    const identity = buildIdentity(view.rounds);
    if (identity !== null) {
      // Built exclusively from tag vocabulary + family word + multiplier.
      expect(identity).toMatch(/^(CLUB [A-Z]+ SPINE|NATION [A-Z]+ BLOC|\d0s ERA WAVE) ×[\d.]+$/);
    }
  });
});
