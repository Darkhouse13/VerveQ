import { useEffect, useRef } from "react";

/**
 * Let a mouse wheel drive a horizontal chip row.
 *
 * A horizontal scroller with a hidden scrollbar is reachable by touch but not
 * by mouse: a wheel only moves the vertical axis, so on desktop the overflow
 * is simply unreachable (the weekend picker's filter row, 2026-08-21). This
 * turns a vertical wheel over the element into horizontal travel, and claims
 * the event only while there is somewhere left to scroll — at either end the
 * wheel falls through to the page as usual.
 *
 * A native, non-passive listener: React registers wheel handlers passively,
 * so a React onWheel could not preventDefault the page scroll underneath.
 */
export function useWheelToHorizontalScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY) || e.deltaY === 0) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
      if (next === el.scrollLeft) return;
      e.preventDefault();
      el.scrollLeft = next;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  return ref;
}
