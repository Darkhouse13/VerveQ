/**
 * H1 hotfix contract — the play stage must be vertically scrollable so the
 * decision buttons stay reachable when the resolved-round stack (~806px)
 * exceeds a small mobile viewport. jsdom does no real layout, so this asserts
 * the STRUCTURE that makes scroll possible: the stage sits inside an
 * overflow-y-auto container, and BANK/PUSH are in the DOM at a resolved round.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocalMockApi } from "@/lib/drawApi";
import { DrawExperience } from "@/pages/draw/DrawScreen";

const FIXED_NOW = Date.parse("2026-07-16T12:00:00.000Z");

function renderDraw() {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
  render(
    <MemoryRouter initialEntries={["/draw"]}>
      <DrawExperience api={api} revealMs={0} />
    </MemoryRouter>,
  );
  return api;
}

describe("Draw stage scroll (H1)", () => {
  it("wraps the draft stage in an overflow-y-auto scroll container", async () => {
    renderDraw();
    fireEvent.click(await screen.findByTestId("draw-entry-cta"));

    // First draft row is up — the play stage is mounted.
    await screen.findByTestId("draw-draft-stage");
    const scroll = screen.getByTestId("draw-play-scroll");
    expect(scroll.className).toContain("overflow-y-auto");
    // The stage renders INSIDE the scroll container, not as a clipped sibling.
    expect(scroll).toContainElement(screen.getByTestId("draw-draft-stage"));
  });

  it("keeps BANK/PUSH inside the scroll container at a resolved round", async () => {
    renderDraw();
    fireEvent.click(await screen.findByTestId("draw-entry-cta"));

    // 6 picks (select then confirm), always the first offer.
    for (let row = 0; row < 6; row++) {
      await screen.findByText(`PICK ${row + 1}/6`);
      fireEvent.click(screen.getByTestId("draw-offer-0"));
      fireEvent.click(screen.getByTestId("draw-offer-0"));
    }

    // Bench one, confirm — with revealMs 0 the reveal lands instantly and the
    // round resolves into the decision (or terminal) phase.
    const chip = await screen.findByTestId("draw-squad-chip-0");
    fireEvent.click(chip);
    const confirm = screen.getByTestId("draw-confirm-bench");
    await waitFor(() => expect(confirm).toBeEnabled());
    fireEvent.click(confirm);

    // The round stage is now inside the scroll container...
    const stage = await screen.findByTestId("draw-round-stage");
    const scroll = screen.getByTestId("draw-play-scroll");
    expect(scroll.className).toContain("overflow-y-auto");
    expect(scroll).toContainElement(stage);

    // ...and the advance control (BANK/PUSH at a clear, or CONTINUE at a
    // terminal) is present and reachable within that scroll container.
    const advance =
      screen.queryByTestId("draw-bank") ??
      screen.queryByTestId("draw-continue");
    expect(advance).not.toBeNull();
    expect(scroll).toContainElement(advance as HTMLElement);
  });
});
