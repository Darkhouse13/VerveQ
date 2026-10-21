/**
 * VerveQ ONE P1.4 — the overlay primitives (components/ui/overlay + sheet /
 * dialog / confirm-dialog / fullscreen-flow).
 *
 * Pins the two things the hand-rolled sheets kept getting wrong:
 *  - THEME CARRYING: Radix portals to document.body, outside the themed
 *    frame, so a sheet opened inside `.theme-ink` must put the palette back
 *    on its own content (no hand-added class at the call site);
 *  - ESCAPE closes, and the close target is a labelled 44px button.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { Sheet } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FullscreenFlow } from "@/components/ui/fullscreen-flow";
import { ThemeScope } from "@/components/ui/theme-scope";

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {},
    interpolation: { escapeValue: false },
  });
});

function SheetHarness({ initiallyOpen = true }: { initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Sheet open={open} onOpenChange={setOpen} title="Pick a club" testId="probe-sheet">
        <p>Sheet body</p>
      </Sheet>
    </>
  );
}

describe("Sheet — theme carrying", () => {
  it("a sheet opened inside a .theme-ink frame wears theme-ink on its portalled content", async () => {
    render(
      <ThemeScope theme="theme-ink">
        <div className="theme-ink">
          <SheetHarness />
        </div>
      </ThemeScope>,
    );
    const sheet = await screen.findByTestId("probe-sheet");
    // Portalled out of the themed div…
    expect(sheet.closest("div.theme-ink:not([data-testid])")).toBeNull();
    // …but carrying the palette itself.
    expect(sheet).toHaveClass("theme-ink");
  });

  it("falls back to the focused trigger's themed ancestor when no frame provided a scope", async () => {
    render(
      <div className="theme-weekend shell">
        <SheetHarness initiallyOpen={false} />
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });
    trigger.focus();
    fireEvent.click(trigger);
    const sheet = await screen.findByTestId("probe-sheet");
    expect(sheet).toHaveClass("theme-weekend");
    expect(sheet).not.toHaveClass("shell");
  });

  it("only palette classes travel — the draw scoping prefix stays behind", async () => {
    render(
      <ThemeScope theme="theme-draw notranslate">
        <SheetHarness />
      </ThemeScope>,
    );
    const sheet = await screen.findByTestId("probe-sheet");
    expect(sheet.className).not.toMatch(/theme-/);
  });

  it("a sheet nested in a themed sheet inherits through the portal", async () => {
    function Nested() {
      const [inner, setInner] = useState(true);
      return (
        <Sheet open onOpenChange={() => {}} title="Outer" testId="outer">
          <Sheet open={inner} onOpenChange={setInner} title="Inner" testId="inner">
            <p>inner</p>
          </Sheet>
        </Sheet>
      );
    }
    render(
      <ThemeScope theme="theme-learn">
        <Nested />
      </ThemeScope>,
    );
    expect(await screen.findByTestId("inner")).toHaveClass("theme-learn");
  });
});

describe("Sheet — dismissal and a11y", () => {
  it("Escape closes it", async () => {
    render(
      <ThemeScope theme="theme-ink">
        <SheetHarness />
      </ThemeScope>,
    );
    const sheet = await screen.findByTestId("probe-sheet");
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("probe-sheet")).toBeNull());
  });

  it("is a labelled dialog with a 44px close target", async () => {
    render(<SheetHarness />);
    const dialog = await screen.findByRole("dialog", { name: "Pick a club" });
    const close = screen.getByRole("button", { name: "Close" });
    expect(dialog).toContainElement(close);
    expect(close).toHaveClass("h-11", "w-11");
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("ConfirmDialog", () => {
  it("cancel closes without confirming; confirm calls onConfirm", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Sign out?"
        description="You can sign back in anytime."
        cancelLabel="Cancel"
        confirmLabel="Sign out"
        danger
        onConfirm={onConfirm}
      />,
    );
    const dialog = await screen.findByRole("dialog", { name: "Sign out?" });
    expect(dialog).toHaveAccessibleDescription("You can sign back in anytime.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("FullscreenFlow", () => {
  it("Escape closes; a back step replaces the close target", async () => {
    const onClose = vi.fn();
    const onBack = vi.fn();
    const { rerender } = render(
      <FullscreenFlow onClose={onClose} title="New duel" closeLabel="Close flow">
        <p>step one</p>
      </FullscreenFlow>,
    );
    const dialog = await screen.findByRole("dialog", { name: "New duel" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <FullscreenFlow onClose={onClose} title="New duel" onBack={onBack} backLabel="Back">
        <p>step two</p>
      </FullscreenFlow>,
    );
    expect(screen.queryByRole("button", { name: "Close flow" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
