import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { color, font } from "@/theme/tokens";

// Mirrors app/src/lib/arena.ts + convex/challengeArenas.ts validateArenaConfig.
export type ArenaMode = "1v1" | "2v2" | "ffa3" | "ffa4" | "ffa5";

export const ARENA_MODES: { key: ArenaMode; label: string; line: string; capacity: number }[] = [
  { key: "1v1", label: "1v1", line: "Head to head, fastest wins", capacity: 2 },
  { key: "2v2", label: "2v2", line: "Two teams, scores add up", capacity: 4 },
  { key: "ffa3", label: "3", line: "3 players · free-for-all, everyone for themselves", capacity: 3 },
  { key: "ffa4", label: "4", line: "4 players · free-for-all, everyone for themselves", capacity: 4 },
  { key: "ffa5", label: "5", line: "5 players · free-for-all, everyone for themselves", capacity: 5 },
];

export const ARENA_LIMITS = { minRounds: 1, maxRounds: 8, minPerRound: 5, maxPerRound: 15, maxTotal: 80 };
export const ARENA_DEFAULTS = { rounds: 5, perRound: 10 };

export const ARENA_SUBJECTS: { key: string; label: string; line: string }[] = [
  { key: "football_quiz", label: "Football quiz", line: "Players, clubs, trophies" },
  { key: "general_knowledge", label: "General knowledge", line: "A bit of everything" },
  { key: "which_came_first", label: "Which came first", line: "Order two events in time" },
  { key: "enterprise_logos", label: "Name the logo", line: "Name the company" },
  { key: "capital_cities", label: "Capital cities", line: "Capitals of the world" },
  { key: "tennis", label: "Tennis", line: "ATP, slams, records" },
  { key: "basketball", label: "Basketball", line: "NBA players, teams, history" },
  { key: "science", label: "Science & nature", line: "The natural world and beyond" },
  { key: "world_history", label: "World history", line: "Events, eras and empires" },
  { key: "movies_tv", label: "Movies & TV", line: "Films, shows and stars" },
  { key: "music", label: "Music", line: "Artists, albums and eras" },
  { key: "video_games", label: "Video games", line: "Franchises, studios and icons" },
];
export const ARENA_DEFAULT_SUBJECTS = ARENA_SUBJECTS.slice(0, 5).map((s) => s.key);

/** Cycle the chosen subjects across the rounds, in canonical order (web: buildArenaCategories). */
export function buildCategories(selected: string[], rounds: number) {
  const ordered = ARENA_SUBJECTS.map((s) => s.key).filter((k) => selected.includes(k));
  if (ordered.length === 0) return [];
  return Array.from({ length: rounds }, (_, i) => ordered[i % ordered.length]!);
}

export function subjectLabel(slug: string | undefined) {
  if (!slug) return "";
  const hit = ARENA_SUBJECTS.find((s) => s.key === slug);
  if (hit) return hit.label;
  if (slug === "name_the_logo") return "Name the logo";
  return slug.split("_").filter(Boolean).map((w, i) => (i === 0 ? w[0]!.toUpperCase() + w.slice(1) : w)).join(" ");
}

export function subjectLine(slug: string | undefined) {
  return ARENA_SUBJECTS.find((s) => s.key === slug)?.line ?? "";
}

export function modeCapacity(mode: string) {
  return ARENA_MODES.find((m) => m.key === mode)?.capacity ?? 2;
}

export function modeLabel(mode: string) {
  if (mode === "1v1") return "1v1";
  if (mode === "2v2") return "Team 2v2";
  return "Free-for-all";
}

/** Codes are 6 characters and never use I, O, 0 or 1 (convex randomArenaCode). */
export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export const arenaUrl = (code: string) => `https://verveq.com/arena/${encodeURIComponent(code)}`;

/**
 * Server-clock "now", ticking every 100 ms while `active`. Port of the web's
 * useClockOffset: the local-minus-server offset only moves on >250 ms drift.
 * The offset is measured on the tick (not in an effect body), per React's rules.
 */
export function useServerNow(serverNow: number | null | undefined, active: boolean) {
  const latest = useRef<{ server: number; local: number } | null>(null);
  const offset = useRef(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (typeof serverNow === "number") latest.current = { server: serverNow, local: Date.now() };
  }, [serverNow]);
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const l = latest.current;
      if (l) {
        const next = l.local - l.server;
        if (Math.abs(offset.current - next) > 250) offset.current = next;
      }
      setNow(Date.now() - offset.current);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 100);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);
  return now;
}

export function useTick(active: boolean, intervalMs = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

// Player avatars cycle the brand mode accents; text on a colored fill is ink (BRAND.md).
const AVATAR = [color.blue, color.pink, color.orange, color.yellow, color.right];
export function avatarColor(index: number) {
  return AVATAR[index % AVATAR.length]!;
}

export const initialsOf = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "?";

export function Avatar({ name, index, sizePx = 40, dim }: { name: string; index: number; sizePx?: number; dim?: boolean }) {
  return (
    <View
      style={{
        width: sizePx,
        height: sizePx,
        borderRadius: sizePx / 2,
        backgroundColor: dim ? color.line : avatarColor(index),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text maxFontSizeMultiplier={1} style={{ fontFamily: font.bold, fontSize: sizePx * 0.38, color: dim ? color.muted : color.ink }}>{initialsOf(name)}</Text>
    </View>
  );
}

export const fmtPts = (n: number) => n.toLocaleString("en-GB");

export function errorText(err: unknown, fallback: string) {
  const msg = err instanceof Error ? err.message : "";
  if (/not found/i.test(msg)) return "No room with that code";
  if (/full/i.test(msg)) return "That room is full";
  if (/lobby|started|not accepting/i.test(msg)) return "That room has already started";
  if (/username/i.test(msg)) return "Pick a name to play live";
  if (/ready before start/i.test(msg)) return "Everyone has to be ready first";
  if (/two players/i.test(msg)) return "You need at least 2 players";
  if (/team/i.test(msg)) return msg;
  return fallback;
}
