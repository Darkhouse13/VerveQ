import { useEffect, useState } from "react";

export type ArenaMode = "1v1" | "2v2" | "ffa3" | "ffa4" | "ffa5";

export const ARENA_MODE_OPTIONS: Array<{
  key: ArenaMode;
  label: string;
  description: string;
  capacity: number;
}> = [
  { key: "1v1", label: "1v1", description: "Head to head — fastest wins", capacity: 2 },
  { key: "2v2", label: "2v2 Teams", description: "Pick a team, sum the score", capacity: 4 },
  { key: "ffa3", label: "FFA 3", description: "Free-for-all, three players", capacity: 3 },
  { key: "ffa4", label: "FFA 4", description: "Free-for-all, four players", capacity: 4 },
  { key: "ffa5", label: "FFA 5", description: "Free-for-all, five players", capacity: 5 },
];

export function arenaModeLabel(mode: string) {
  switch (mode) {
    case "1v1":
      return "1v1";
    case "2v2":
      return "2v2";
    case "ffa3":
      return "FFA 3";
    case "ffa4":
      return "FFA 4";
    case "ffa5":
      return "FFA 5";
    default:
      return mode.toUpperCase();
  }
}

export function arenaModeVerboseLabel(mode: string) {
  switch (mode) {
    case "1v1":
      return "1V1 DUEL";
    case "2v2":
      return "TEAM 2V2";
    case "ffa3":
    case "ffa4":
    case "ffa5":
      return "FREE-FOR-ALL";
    default:
      return mode.toUpperCase();
  }
}

export function arenaModeCapacity(mode: string) {
  switch (mode) {
    case "1v1":
      return 2;
    case "2v2":
      return 4;
    case "ffa3":
      return 3;
    case "ffa4":
      return 4;
    case "ffa5":
      return 5;
    default:
      return 2;
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  football_quiz: "Football Quiz",
  general_knowledge: "General Knowledge",
  which_came_first: "Which Came First",
  enterprise_logos: "Enterprise Logos",
  name_the_logo: "Name the Logo",
  capital_cities: "Capital Cities",
  geography_fallback_for_logo: "Geography",
};

export function arenaCategoryLabel(slug: string) {
  if (CATEGORY_LABELS[slug]) return CATEGORY_LABELS[slug];
  return slug
    .split("_")
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

export function arenaCategoryEmoji(slug: string) {
  switch (slug) {
    case "football_quiz":
      return "⚽";
    case "general_knowledge":
      return "🧠";
    case "which_came_first":
      return "⏳";
    case "enterprise_logos":
      return "🏢";
    case "name_the_logo":
      return "🛡️";
    case "capital_cities":
      return "🏙️";
    case "geography_fallback_for_logo":
      return "🗺️";
    default:
      return "❓";
  }
}

export function buildArenaUrl(code: string) {
  if (typeof window === "undefined") return `/arena/${code}`;
  return `${window.location.origin}/arena/${code}`;
}

export async function shareArenaLink(
  code: string,
  customText?: string,
): Promise<"shared" | "copied" | "failed"> {
  const url = buildArenaUrl(code);
  const text = customText ?? `Join my VerveQ arena — code ${code}`;
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "VerveQ arena", text, url });
      return "shared";
    } catch {
      /* user cancelled — fall through to copy */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

// Track the difference between local clock and the server's clock so that
// timers driven by server timestamps render accurately. Pass the latest
// `serverNow` you have from a reactive query; the offset only updates when
// drift exceeds 250 ms to avoid jitter.
export function useClockOffset(serverNow: number | null | undefined) {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (typeof serverNow !== "number") return;
    const next = Date.now() - serverNow;
    setOffset((prev) => (Math.abs(prev - next) > 250 ? next : prev));
  }, [serverNow]);
  return offset;
}

// Ticking clock that updates every `intervalMs` for smooth countdowns.
export function useTick(intervalMs = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Capture a wall-clock timestamp the first time `key` is observed, so that
// client-only countdowns (no authoritative server start time) can anchor to
// the moment this client first saw the phase change.
export function usePhaseAnchor(key: string | null | undefined) {
  const [anchors, setAnchors] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!key) return;
    setAnchors((prev) => (prev[key] ? prev : { ...prev, [key]: Date.now() }));
  }, [key]);
  return key ? anchors[key] ?? null : null;
}

export function normalizeArenaCode(input: string) {
  const raw = input.trim();
  const arenaPathMatch = raw.match(/(?:^|\s|["'(<])(?:https?:\/\/\S+)?\/arena\/([A-Z0-9]+)/i);
  if (arenaPathMatch?.[1]) {
    return arenaPathMatch[1].replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
  }

  try {
    const parsed = new URL(raw);
    const queryCode = parsed.searchParams.get("code");
    if (queryCode) {
      return queryCode.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
    }
  } catch {
    // Not a standalone URL; fall back to plain code normalization below.
  }

  return raw.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
}

// Kick off background image fetches so they're in the browser cache by the time
// the QuestionImage <img> mounts. Each URL is fetched once per session — repeat
// calls with the same URL are no-ops. We also retry transient errors twice
// (300 ms then 600 ms) before giving up silently.
const preloadCache = new Map<string, "loading" | "ok" | "failed">();

export function useImagePreload(urls: readonly string[] | undefined) {
  const key = urls?.join("") ?? "";
  useEffect(() => {
    if (!urls?.length) return;
    const handles: HTMLImageElement[] = [];
    urls.forEach((url) => {
      if (!url) return;
      const cached = preloadCache.get(url);
      if (cached === "loading" || cached === "ok") return;
      preloadCache.set(url, "loading");
      const tryLoad = (attempt: number) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          preloadCache.set(url, "ok");
        };
        img.onerror = () => {
          if (attempt < 2) {
            window.setTimeout(() => tryLoad(attempt + 1), 300 * (attempt + 1));
          } else {
            preloadCache.set(url, "failed");
          }
        };
        img.src = url;
        handles.push(img);
      };
      tryLoad(0);
    });
    return () => {
      handles.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
