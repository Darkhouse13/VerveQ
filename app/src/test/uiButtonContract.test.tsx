/**
 * VerveQ ONE P1.3 — the Button primitive and the NeoButton alias over it.
 *
 * Pins:
 *  - each Button variant renders its fill (ink text on every colored fill);
 *  - every size is a ≥44px tap target (min-h-11/12/14);
 *  - `disabled` is styled by the primitive (muted fill, no shadow) and is a
 *    real disabled button; `loading` keeps the variant fill, sets aria-busy,
 *    blocks clicks and keeps the label in layout (width never jumps);
 *  - NeoButton maps every legacy variant/size onto the new ones, keeps
 *    type="button" by default and forwards refs.
 */
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { NeoButton } from "@/components/neo/NeoButton";

const classesOf = (el: HTMLElement) => el.className.split(/\s+/);

describe("Button", () => {
  it.each([
    ["primary", "bg-primary", "text-primary-foreground"],
    ["secondary", "bg-card", "text-card-foreground"],
    ["danger", "bg-destructive", "text-destructive-foreground"],
    ["ghost", "bg-transparent", "text-foreground"],
  ] as const)("%s renders its fill and text color", (variant, fill, text) => {
    render(<Button variant={variant}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(classesOf(button)).toEqual(expect.arrayContaining([fill, text]));
    if (variant === "ghost") expect(classesOf(button)).not.toContain("neo-shadow");
    else expect(classesOf(button)).toEqual(expect.arrayContaining(["neo-border", "neo-shadow"]));
  });

  it.each([
    ["sm", "min-h-11"],
    ["md", "min-h-12"],
    ["lg", "min-h-14"],
  ] as const)("size %s is at least 44px tall", (size, minH) => {
    render(<Button size={size}>Go</Button>);
    expect(classesOf(screen.getByRole("button"))).toContain(minH);
  });

  it("defaults to type=button and spans the row with block", () => {
    render(<Button block>Go</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "button");
    expect(classesOf(button)).toContain("w-full");
  });

  it("disabled: a real disabled button with the muted look and no shadow", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    const classes = classesOf(button);
    expect(classes).toEqual(expect.arrayContaining(["bg-muted", "text-muted-foreground", "cursor-not-allowed"]));
    expect(classes).not.toContain("bg-primary");
    expect(classes).not.toContain("neo-shadow");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading: aria-busy, clicks blocked, fill kept, label kept in layout", () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    expect(classesOf(button)).toContain("bg-primary");
    expect(classesOf(button)).not.toContain("bg-muted");
    // The label stays rendered (invisible) so the button keeps its width.
    expect(screen.getByText("Saving")).toHaveClass("invisible");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("not loading: no aria-busy", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
  });

  it("call-site classes win over the primitive's (tailwind-merge knows the type scale)", () => {
    render(<Button className="text-body text-ink">Go</Button>);
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toEqual(expect.arrayContaining(["text-body", "text-ink"]));
    expect(classes).not.toContain("text-body-sm");
    expect(classes).not.toContain("text-primary-foreground");
  });
});

describe("NeoButton → Button mapping", () => {
  it.each([
    ["primary", "bg-primary"],
    ["accent", "bg-primary"],
    ["success", "bg-primary"],
    ["yellow", "bg-primary"],
    ["pink", "bg-primary"],
    ["blue", "bg-card"],
    ["secondary", "bg-card"],
    ["outline", "bg-card"],
    ["danger", "bg-destructive"],
    ["ghost", "bg-transparent"],
  ] as const)("variant %s → %s", (variant, fill) => {
    render(<NeoButton variant={variant}>Go</NeoButton>);
    expect(classesOf(screen.getByRole("button"))).toContain(fill);
  });

  it.each([
    ["sm", "min-h-11", false],
    ["md", "min-h-12", false],
    ["lg", "min-h-14", false],
    ["xl", "min-h-14", false],
    ["full", "min-h-14", true],
  ] as const)("size %s → %s (block: %s)", (size, minH, block) => {
    render(<NeoButton size={size}>Go</NeoButton>);
    const classes = classesOf(screen.getByRole("button"));
    expect(classes).toContain(minH);
    expect(classes.includes("w-full")).toBe(block);
  });

  it("defaults: primary, md, type=button, legacy all-caps, ref forwarded", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<NeoButton ref={ref}>Go</NeoButton>);
    const button = screen.getByRole("button");
    expect(ref.current).toBe(button);
    expect(button).toHaveAttribute("type", "button");
    expect(classesOf(button)).toEqual(expect.arrayContaining(["bg-primary", "min-h-12", "uppercase"]));
  });

  it("passes disabled and submit type through", () => {
    render(
      <NeoButton type="submit" disabled>
        Go
      </NeoButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
    expect(classesOf(button)).toContain("bg-muted");
  });
});
