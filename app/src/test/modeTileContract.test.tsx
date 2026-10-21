/**
 * VerveQ ONE P2.5 — ModeTile, the one way a game mode is offered, and the
 * ink-ground rules it carries (decisions 1 and 12).
 *
 * Pins:
 *  - each mode accent renders its fill with INK text; WEEKEND/DRAW's
 *    `outline` is a lime border on the raised surface, never a lime fill;
 *  - lime is never a tile fill (R4: lime is the one action color);
 *  - the status chip renders only when a state is known;
 *  - it is a real button (keyboard- and screen-reader-reachable);
 *  - the Compete catalogue uses the decision-12 accent for every mode.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Hourglass } from "lucide-react";
import { ModeTile, type ModeAccent } from "@/components/ui/mode-tile";
import { COMPETE_MODE_TILES } from "@/pages/shell/competeModeTiles";

const classesOf = (el: HTMLElement) => el.className.split(/\s+/);

describe("ModeTile", () => {
  it.each([
    ["blue", "bg-electric-blue"],
    ["pink", "bg-hot-pink"],
    ["yellow", "bg-yellow"],
    ["orange", "bg-orange"],
  ] as const)("%s is a filled tile with ink text", (mode, fill) => {
    render(<ModeTile mode={mode} icon={Hourglass} name="Mode" onClick={() => {}} />);
    const tile = screen.getByRole("button", { name: /Mode/ });
    expect(classesOf(tile)).toEqual(expect.arrayContaining([fill, "text-ink", "on-fill"]));
  });

  it("outline (THE WEEKEND, THE DRAW) is a lime border on the surface, not a fill", () => {
    render(<ModeTile mode="outline" icon={Hourglass} name="Weekend" onClick={() => {}} />);
    const classes = classesOf(screen.getByRole("button", { name: /Weekend/ }));
    expect(classes).toEqual(expect.arrayContaining(["bg-card", "!border-lime"]));
  });

  it.each(["blue", "pink", "yellow", "orange", "outline", "surface"] as ModeAccent[])(
    "%s never fills with lime",
    (mode) => {
      render(<ModeTile mode={mode} icon={Hourglass} name={`T-${mode}`} onClick={() => {}} />);
      const classes = classesOf(screen.getByRole("button", { name: new RegExp(`T-${mode}`) }));
      expect(classes).not.toEqual(expect.arrayContaining(["bg-lime"]));
      expect(classes).not.toEqual(expect.arrayContaining(["bg-accent"]));
      expect(classes).not.toEqual(expect.arrayContaining(["bg-primary"]));
    },
  );

  it("shows a status chip only when a state is known", () => {
    const { rerender, container } = render(
      <ModeTile mode="blue" icon={Hourglass} name="Older" line="Ten a day" onClick={() => {}} />,
    );
    expect(container.querySelector('[data-slot="mode-tile-status"]')).toBeNull();
    rerender(
      <ModeTile mode="blue" icon={Hourglass} name="Older" line="Ten a day" status="7/10 today" onClick={() => {}} />,
    );
    expect(container.querySelector('[data-slot="mode-tile-status"]')?.textContent).toBe("7/10 today");
  });

  it("is a real button that fires onClick", () => {
    const onClick = vi.fn();
    render(<ModeTile mode="pink" icon={Hourglass} name="Letters" onClick={onClick} />);
    const tile = screen.getByRole("button", { name: /Letters/ });
    expect(tile.tagName).toBe("BUTTON");
    fireEvent.click(tile);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Compete catalogue accents (decision 12)", () => {
  const EXPECTED: Record<string, ModeAccent> = {
    whosOlder: "blue",
    higherLower: "blue",
    missingLetters: "pink",
    duel: "pink",
    arena: "pink",
    daily: "yellow",
    dailySurvival: "yellow",
    blitz: "yellow",
    careerPath: "orange",
    quiz: "orange",
    survival: "orange",
    verveGrid: "orange",
  };

  it.each(Object.entries(EXPECTED))("%s wears %s", (key, accent) => {
    expect(COMPETE_MODE_TILES.find((t) => t.key === key)?.color).toBe(accent);
  });
});
