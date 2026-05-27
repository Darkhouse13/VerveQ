import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
