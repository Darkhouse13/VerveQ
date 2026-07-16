/**
 * Full-loop acceptance (Ticket B): the whole mode is playable against
 * LocalMockApi — entry → 6-pick draft → rounds with bench → bank/bust/
 * fullclear → result → share card render. Also locks the UI-side choice
 * submission ordering: a double-tap on an offer submits exactly one pick.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LocalMockApi } from "@/lib/drawApi";
import { DrawExperience } from "@/pages/draw/DrawScreen";
import type { DrawFaultMode } from "@/lib/drawApi/localMock";

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

/** Render against a mock armed with one of the real backend failure modes. */
function renderFaulted(fault: DrawFaultMode) {
  const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null, fault });
  render(
    <MemoryRouter initialEntries={["/draw"]}>
      <DrawExperience api={api} revealMs={0} />
    </MemoryRouter>,
  );
  return api;
}

describe("Draw full loop against LocalMockApi", () => {
  it("plays entry → draft → rounds (bench each) → terminal → result + share card", async () => {
    renderDraw();

    // S1 — entry: board number visible, gauntlet strip visible pre-draft.
    const cta = await screen.findByTestId("draw-entry-cta");
    expect(cta).toHaveTextContent("PLAY TODAY'S BOARD");
    expect(screen.getByTestId("draw-fixture-strip")).toBeInTheDocument();
    fireEvent.click(cta);

    // S2 — draft: 6 picks, always the first offer.
    for (let row = 0; row < 6; row++) {
      const pickLabel = await screen.findByText(`PICK ${row + 1}/6`);
      expect(pickLabel).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("draw-offer-0"));
    }

    // S3 — rounds: bench chip 0, confirm, then push while offered (up to the
    // boss); ends on bust or full clear, both legal terminals for this line.
    for (let round = 0; round < 5; round++) {
      const chip = await screen.findByTestId("draw-squad-chip-0");
      fireEvent.click(chip);
      const confirm = screen.getByTestId("draw-confirm-bench");
      await waitFor(() => expect(confirm).toBeEnabled());
      fireEvent.click(confirm);

      // Reveal resolves (revealMs=0) into PUSH/BANK or a terminal CONTINUE.
      const next = await waitFor(() => {
        const push = screen.queryByTestId("draw-push");
        const done = screen.queryByTestId("draw-continue");
        if (!push && !done) throw new Error("still resolving");
        return push ?? done!;
      });
      if (next.dataset.testid === "draw-continue") {
        fireEvent.click(next);
        break;
      }
      fireEvent.click(next);
    }

    // S4 — result: outcome card, final score, share card (S5), board reveal.
    const result = await screen.findByTestId("draw-result-stage");
    expect(result).toBeInTheDocument();
    expect(screen.getByTestId("draw-final-score")).toBeInTheDocument();
    expect(screen.getByTestId("draw-share-card")).toBeInTheDocument();
    expect(screen.getByTestId("draw-board-reveal")).toBeInTheDocument();
    expect(screen.getByTestId("draw-share-btn")).toBeInTheDocument();
    expect(screen.getByTestId("draw-countdown")).toBeInTheDocument();
  });

  it("a double-tap on an offer submits exactly one pick (ordering guard)", async () => {
    const api = renderDraw();
    fireEvent.click(await screen.findByTestId("draw-entry-cta"));

    const offer = await screen.findByTestId("draw-offer-0");
    // Two taps in the same frame — the synchronous busy ref must swallow the
    // second before React state catches up.
    fireEvent.click(offer);
    fireEvent.click(offer);

    await screen.findByText("PICK 2/6");
    const view = await api.startRun(); // resumes the same run
    expect(view.rowIndex).toBe(1);
    expect(view.squad).toHaveLength(1);
  });

  it("resumes an in-progress run from entry", async () => {
    const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
    await api.startRun();
    await api.submitChoice({ type: "pick", offerIndex: 1 });

    render(
      <MemoryRouter initialEntries={["/draw"]}>
        <DrawExperience api={api} revealMs={0} />
      </MemoryRouter>,
    );
    const cta = await screen.findByTestId("draw-entry-cta");
    expect(cta).toHaveTextContent("RESUME RUN");
    fireEvent.click(cta);
    expect(await screen.findByText("PICK 2/6")).toBeInTheDocument();
  });
});

/**
 * Backend failure paths (Ticket D2). The LocalMockApi could not reject at all,
 * so the screens shipped with no failure path: against Convex a failed call
 * pinned the screen on "Loading…" forever and a failed CTA press vanished as
 * an unhandled rejection. The mock now injects the three ways a real backend
 * says no, using the server's own sentences.
 */
describe("Draw failure surfacing", () => {
  it("surfaces a network error instead of spinning forever", async () => {
    renderFaulted("networkError");
    expect(await screen.findByTestId("draw-error")).toBeInTheDocument();
    // The exact regression: the stage must LEAVE "loading".
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("translates the server flag gate into the mode's own words", async () => {
    renderFaulted("gateClosed");
    expect(await screen.findByTestId("draw-error")).toBeInTheDocument();
    expect(screen.getByText(/THE DRAW is not open yet\./)).toBeInTheDocument();
  });

  it("translates a lost session into an actionable message, not a raw throw", async () => {
    renderFaulted("authFailure");
    expect(await screen.findByTestId("draw-error")).toBeInTheDocument();
    expect(screen.getByText(/Couldn't start a guest session/)).toBeInTheDocument();
  });

  it("RETRY recovers once the fault clears, without a reload", async () => {
    const api = renderFaulted("networkError");
    const retry = await screen.findByText("RETRY");

    // The backend comes back; the same screen must recover in place.
    api.setFault(null);
    fireEvent.click(retry);

    const cta = await screen.findByTestId("draw-entry-cta");
    expect(cta).toHaveTextContent("PLAY TODAY'S BOARD");
    expect(screen.queryByTestId("draw-error")).not.toBeInTheDocument();
  });

  it("a mid-run submit failure surfaces rather than silently un-sticking the button", async () => {
    const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
    render(
      <MemoryRouter initialEntries={["/draw"]}>
        <DrawExperience api={api} revealMs={0} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByTestId("draw-entry-cta"));
    await screen.findByTestId("draw-offer-0");

    // The connection drops mid-draft; the next pick must not be swallowed.
    api.setFault("networkError");
    fireEvent.click(screen.getByTestId("draw-offer-0"));
    expect(await screen.findByTestId("draw-error")).toBeInTheDocument();
  });
});
