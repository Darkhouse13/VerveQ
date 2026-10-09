import { useEffect, useState } from "react";

/** "h:mm:ss" until the next UTC midnight — when a new daily edition goes
 *  live — re-rendered every second. */
export function useUtcMidnightCountdown(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const next = Math.floor(now / 86_400_000 + 1) * 86_400_000;
  const s = Math.max(0, Math.floor((next - now) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
