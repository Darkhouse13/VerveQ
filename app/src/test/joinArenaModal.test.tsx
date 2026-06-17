import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// JoinArenaModal now uses useTranslation; resolve its keys to English so the
// "Join" button and labels render real copy in this render test.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (({
        "joinArena.title": "Join arena",
        "joinArena.instructions":
          "Enter the code your friend shared, or paste the arena link.",
        "joinArena.joinButton": "Join",
        "joinArena.closeAria": "Close",
      }) as Record<string, string>)[key] ?? key,
    i18n: { language: "en" },
  }),
}));

import JoinArenaModal from "@/pages/arena/JoinArenaModal";

describe("JoinArenaModal", () => {
  it("accepts a pasted arena link without truncating it before extracting the code", () => {
    const onJoin = vi.fn();
    render(<JoinArenaModal onClose={() => {}} onJoin={onJoin} />);

    const input = screen.getByPlaceholderText("ABCD23");
    fireEvent.change(input, {
      target: { value: "https://verveq.com/arena/e8m8jf" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(onJoin).toHaveBeenCalledWith("E8M8JF");
  });
});
