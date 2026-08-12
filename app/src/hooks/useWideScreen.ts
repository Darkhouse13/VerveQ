/**
 * FW-IMMERSE B1 — the one breakpoint the WEEKEND's adaptive layout keys on.
 *
 * ≥1280px (Tailwind xl) is where the weekend stops being a phone column and
 * starts using the room: pitch and market side by side, fixtures as a
 * persistent rail. One hook, one query string, so the JS-gated pieces (which
 * of the picker's two hosts renders) can never disagree with the CSS-gated
 * pieces (xl: classes) about where "wide" begins.
 */
import { useEffect, useState } from "react";

export const WIDE_WEEKEND_QUERY = "(min-width: 1280px)";

export function useWideScreen(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia(WIDE_WEEKEND_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(WIDE_WEEKEND_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener("change", onChange);
    setWide(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return wide;
}
