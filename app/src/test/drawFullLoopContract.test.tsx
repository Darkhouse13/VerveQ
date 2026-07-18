/**
 * Full-loop acceptance (Ticket B): the whole mode is playable against
 * LocalMockApi — entry → 6-pick draft → rounds with bench → bank/bust/
 * fullclear → result → share card render. Also locks the UI-side choice
 * submission ordering: a double-tap on an offer submits exactly one pick.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConvexError } from "convex/values";
import { LocalMockApi } from "@/lib/drawApi";
import { DrawExperience } from "@/pages/draw/DrawScreen";
import type { DrawFaultMode } from "@/lib/drawApi/localMock";
import {
  DRAW_AUTH_REQUIRED_CODE,
  DRAW_DISABLED_CODE,
} from "../../convex/lib/drawMessages";

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

    // S2 — draft: 6 picks, always the first offer. Ticket F (F2a) made the
    // pick two-step, so each row is select-then-confirm: the first tap only
    // lifts the card, and the mini-gauntlet + ghost meters appear before
    // anything is committed.
    for (let row = 0; row < 6; row++) {
      const pickLabel = await screen.findByText(`PICK ${row + 1}/6`);
      expect(pickLabel).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("draw-offer-0")); // select
      expect(screen.getByTestId("draw-pick-impact")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("draw-offer-0")); // confirm
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

  it("a mashed offer submits exactly one pick (ordering guard)", async () => {
    const api = renderDraw();
    fireEvent.click(await screen.findByTestId("draw-entry-cta"));

    const offer = await screen.findByTestId("draw-offer-0");
    // Ticket F (F2a) re-shaped what a double-tap MEANS: two taps are now a
    // legitimate select-then-confirm, i.e. exactly one pick by design. So the
    // guard is probed by mashing — taps 1-2 select and commit, and taps 3-4
    // land in the same frame while that submit is still in flight. The
    // synchronous busy ref must swallow them before React state catches up;
    // without it, tap 4 would commit a second pick against a stale row.
    fireEvent.click(offer);
    fireEvent.click(offer);
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

  // Ticket K1 — prod redaction: the sentence NEVER reaches a prod client, so
  // the ConvexError code alone (no message anywhere in the error) must be
  // enough to reach each designed state. This is the case the dev deployment
  // and the sentence-carrying mock faults above structurally cannot catch.
  it("recognizes the flag gate by ConvexError code alone (prod-redacted shape)", async () => {
    const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
    vi.spyOn(api, "getToday").mockRejectedValue(
      new ConvexError({ code: DRAW_DISABLED_CODE }),
    );
    render(
      <MemoryRouter initialEntries={["/draw"]}>
        <DrawExperience api={api} revealMs={0} />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("draw-error")).toBeInTheDocument();
    expect(screen.getByText(/THE DRAW is not open yet\./)).toBeInTheDocument();
  });

  it("recognizes a lost session by ConvexError code alone (prod-redacted shape)", async () => {
    const api = new LocalMockApi({ now: () => FIXED_NOW, storage: null });
    vi.spyOn(api, "getToday").mockRejectedValue(
      new ConvexError({ code: DRAW_AUTH_REQUIRED_CODE }),
    );
    render(
      <MemoryRouter initialEntries={["/draw"]}>
        <DrawExperience api={api} revealMs={0} />
      </MemoryRouter>,
    );
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
    fireEvent.click(screen.getByTestId("draw-offer-0")); // select
    fireEvent.click(screen.getByTestId("draw-offer-0")); // confirm — this call fails
    expect(await screen.findByTestId("draw-error")).toBeInTheDocument();
  });
});
