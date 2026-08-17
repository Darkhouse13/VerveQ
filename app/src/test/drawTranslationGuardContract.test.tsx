/**
 * Google Translate mutates React-owned text nodes with <font> elements. The
 * production Draw issue (JAVASCRIPT-REACT-8) is the resulting removeChild
 * failure, so both the mode root and its Radix portal must opt out.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
}

describe("Draw translation guard", () => {
  it("protects the mode root from browser DOM translation", async () => {
    renderDraw();

    const entry = await screen.findByTestId("draw-entry");
    const modeRoot = entry.closest(".theme-draw");

    expect(modeRoot).not.toBeNull();
    expect(modeRoot).toHaveClass("notranslate");
    expect(modeRoot).toHaveAttribute("translate", "no");
  });

  it("protects the Radix sheet portal outside the mode root", async () => {
    renderDraw();
    fireEvent.click(await screen.findByTestId("draw-entry-cta"));
    await screen.findByTestId("draw-draft-stage");
    fireEvent.click(await screen.findByTestId("draw-fixture-chip-0"));

    const sheet = await screen.findByTestId("draw-fixture-sheet");
    expect(sheet).toHaveClass("notranslate");
    expect(sheet).toHaveAttribute("translate", "no");
  });
});
