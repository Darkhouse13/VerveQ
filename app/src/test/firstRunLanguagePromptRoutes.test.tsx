import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FirstRunLanguagePrompt } from "@/components/shell/FirstRunLanguagePrompt";
import { hasChosenLanguage } from "@/lib/languagePref";

/**
 * VerveQ ONE decision 6: reel traffic lands on a daily game and plays in the
 * detected language — no first-visit language modal on those routes.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FirstRunLanguagePrompt />
    </MemoryRouter>,
  );
}

describe("first-run language prompt routing", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(["/whos-older", "/missing-letters", "/draw", "/weekend"])(
    "is not shown on the reel route %s, and is remembered as chosen",
    (path) => {
      renderAt(path);
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(hasChosenLanguage()).toBe(true);
    },
  );

  it("still asks a first-time visitor on Home", () => {
    renderAt("/home");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
