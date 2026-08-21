import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useWheelToHorizontalScroll } from "@/hooks/useWheelToHorizontalScroll";

function Row() {
  const ref = useWheelToHorizontalScroll<HTMLDivElement>();
  return <div ref={ref} data-testid="row" />;
}

function wheel(el: HTMLElement, deltaY: number, deltaX = 0) {
  const e = new WheelEvent("wheel", {
    deltaY,
    deltaX,
    bubbles: true,
    cancelable: true,
  });
  el.dispatchEvent(e);
  return e.defaultPrevented;
}

describe("useWheelToHorizontalScroll", () => {
  it("turns a vertical wheel into horizontal travel and claims the event", () => {
    const { getByTestId } = render(<Row />);
    const row = getByTestId("row");
    Object.defineProperty(row, "scrollWidth", {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(row, "clientWidth", {
      value: 200,
      configurable: true,
    });
    row.scrollLeft = 0;
    expect(wheel(row, 120)).toBe(true);
    expect(row.scrollLeft).toBe(120);
    expect(wheel(row, -40)).toBe(true);
    expect(row.scrollLeft).toBe(80);
  });

  it("lets the wheel fall through at the ends and when nothing overflows", () => {
    const { getByTestId } = render(<Row />);
    const row = getByTestId("row");
    Object.defineProperty(row, "scrollWidth", {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(row, "clientWidth", {
      value: 200,
      configurable: true,
    });
    row.scrollLeft = 300; // at the far end
    expect(wheel(row, 120)).toBe(false);
    row.scrollLeft = 0;
    expect(wheel(row, -120)).toBe(false);
    expect(wheel(row, 0, 50)).toBe(false); // already horizontal — native handles it
    Object.defineProperty(row, "scrollWidth", {
      value: 200,
      configurable: true,
    });
    expect(wheel(row, 120)).toBe(false);
  });
});
