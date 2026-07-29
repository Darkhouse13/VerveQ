import { trackOnExit } from "./analytics";

/**
 * Field responsiveness telemetry — the missing evidence for "the app doesn't
 * respond to my taps". Until now the product captured no INP, no long-task,
 * no interaction timing of any kind, so responsiveness complaints could not be
 * confirmed or dismissed from data.
 *
 * Posture matches the rest of the analytics layer: no-op unless analytics
 * initialized (prod + key), no PII, and exactly ONE summary event per page
 * lifetime — `perf_vitals`, sent via sendBeacon on pagehide. No per-
 * interaction events, no continuous streaming.
 *
 * Captured:
 *  - worst_inp_ms / p_high_inp_count — worst event-timing duration and how
 *    many interactions exceeded 200ms (the "needs improvement" INP line)
 *  - long_task_count / long_task_total_ms — main-thread stalls >50ms
 *  - device class context (memory, cores, connection) to separate "slow
 *    phone" from "broken app"
 */

let armed = false;

export function armPerfVitals(): void {
  if (armed || typeof PerformanceObserver === "undefined") return;
  armed = true;

  let worstInpMs = 0;
  let highInpCount = 0;
  let interactionCount = 0;
  let longTaskCount = 0;
  let longTaskTotalMs = 0;

  const supported = PerformanceObserver.supportedEntryTypes ?? [];

  if (supported.includes("event")) {
    try {
      const eventObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only discrete input interactions carry an interactionId.
          const id = (entry as PerformanceEntry & { interactionId?: number })
            .interactionId;
          if (!id) continue;
          interactionCount += 1;
          if (entry.duration > worstInpMs) worstInpMs = entry.duration;
          if (entry.duration > 200) highInpCount += 1;
        }
      });
      // durationThreshold floor is 16ms in the spec; 40 keeps the callback
      // quiet for normal interactions while catching everything sluggish.
      eventObserver.observe({ type: "event", buffered: true, durationThreshold: 40 } as PerformanceObserverInit);
    } catch {
      /* older browser — fine, the summary just omits INP */
    }
  }

  if (supported.includes("longtask")) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTaskCount += 1;
          longTaskTotalMs += entry.duration;
        }
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      /* older browser */
    }
  }

  let reported = false;
  window.addEventListener("pagehide", () => {
    if (reported) return;
    reported = true;
    // Nothing measured and nothing to contextualize — skip the empty event.
    if (interactionCount === 0 && longTaskCount === 0) return;
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      connection?: { effectiveType?: string };
    };
    trackOnExit("perf_vitals", {
      worst_inp_ms: Math.round(worstInpMs),
      high_inp_count: highInpCount,
      interaction_count: interactionCount,
      long_task_count: longTaskCount,
      long_task_total_ms: Math.round(longTaskTotalMs),
      device_memory_gb: nav.deviceMemory ?? null,
      cpu_cores: navigator.hardwareConcurrency ?? null,
      connection_type: nav.connection?.effectiveType ?? null,
    });
  });
}
