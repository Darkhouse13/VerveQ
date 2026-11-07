// THE WEEKEND — client helpers for the squad side (ported from app/src/lib/weekend*.ts
// and app/convex/lib/fantasyConstants.ts; pure, no React).
import type { FunctionReturnType } from "convex/server";

import type { api } from "@/lib/convex";

export type OpenGameweek = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getOpenGameweek>>;
export type Market = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getMarket>>;
export type MarketPlayer = Market["players"][number];
export type BudgetSquad = NonNullable<FunctionReturnType<typeof api.fantasySquads.getSquad>>;
export type BudgetSlot = BudgetSquad["slots"][number];
export type SquadScore = NonNullable<FunctionReturnType<typeof api.fantasyScores.getSquadScore>>;
export type Fixtures = NonNullable<FunctionReturnType<typeof api.fantasyMarket.getWeekendFixtures>>;
export type Fixture = Fixtures["fixtures"][number];

export type SlotRole = "GK" | "DEF" | "MID" | "ATT";
export const SLOT_ROLES: readonly SlotRole[] = ["GK", "DEF", "MID", "ATT"];
export const XI_SIZE = 11;
export const SQUAD_BUDGET = 91.0;
export const FORMATION_BOUNDS: Record<SlotRole, { min: number; max: number }> = {
  GK: { min: 1, max: 1 },
  DEF: { min: 3, max: 5 },
  MID: { min: 2, max: 5 },
  ATT: { min: 1, max: 3 },
};

export const ROLE_LABEL: Record<SlotRole, string> = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", ATT: "Attacker" };

export const LEAGUE_NAMES: Record<number, string> = {
  39: "Premier League",
  140: "La Liga",
  135: "Serie A",
  78: "Bundesliga",
  61: "Ligue 1",
  88: "Eredivisie",
  94: "Liga Portugal",
  40: "Championship",
};
export const leagueName = (id: number) => LEAGUE_NAMES[id] ?? "another league";

/** £ prices on the editorial 0.5 scale: 4.5 → "£4.5m". */
export const price = (n: number) => `£${n.toFixed(1)}m`;

/** fantasyScoring.formatPoints: ties round away from zero, no "-0.0". */
export function points(n: number): string {
  const scaled = n * 10;
  const mag = Math.round(Math.abs(scaled));
  const r = (scaled < 0 ? -mag : mag) / 10;
  return (r === 0 ? 0 : r).toFixed(1);
}

/** "Hull City" → "HUL"; the mockup's fixture shorthand on the pitch. */
export function shortClub(name: string | null | undefined): string {
  if (!name) return "—";
  const words = name.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean);
  const skip = new Set(["FC", "AFC", "CF", "SC", "AC", "AS", "SS", "SV", "VfB", "VfL", "RC", "RCD", "CD", "UD", "SD", "Real", "1"]);
  const main = words.find((w) => !skip.has(w) && w.length > 2) ?? words[0] ?? name;
  return main.slice(0, 3).toUpperCase();
}

export const fixtureTag = (opponent: string | null | undefined, isHome: boolean) =>
  opponent ? `${shortClub(opponent)} (${isHome ? "H" : "A"})` : "No game";

/** Search that ignores accents and punctuation (fantasyPlayerName.matchesNameSearch). */
export function matchesName(haystack: string, query: string): boolean {
  const squash = (v: string) => v.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const needle = squash(query);
  return needle === "" || squash(haystack).includes(needle);
}

export function kickoffLabel(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

export function dayLabel(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();
}

export function countdown(ms: number, now = Date.now()): string {
  const diff = Math.max(0, ms - now);
  const mins = Math.floor(diff / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export type FixtureKind = "upcoming" | "started" | "live" | "played" | "void";
export function fixtureKind(f: Pick<Fixture, "status" | "kickoffAt">, now = Date.now()): FixtureKind {
  if (f.status === "postponed" || f.status === "cancelled" || f.status === "abandoned") return "void";
  if (f.status === "finished") return "played";
  if (f.status === "live") return "live";
  return f.kickoffAt <= now ? "started" : "upcoming";
}

export function groupByDay<F extends { kickoffAt: number }>(rows: readonly F[]): { key: string; label: string; rows: F[] }[] {
  const out: { key: string; label: string; rows: F[] }[] = [];
  for (const r of [...rows].sort((a, b) => a.kickoffAt - b.kickoffAt)) {
    const key = new Date(r.kickoffAt).toDateString();
    const last = out[out.length - 1];
    if (last?.key === key) last.rows.push(r);
    else out.push({ key, label: dayLabel(r.kickoffAt), rows: [r] });
  }
  return out;
}

// ── Formations (app/src/lib/weekendFormations.ts) ─────────────────────────

export interface FormationShape {
  DEF: number;
  MID: number;
  ATT: number;
}
export interface FormationRow {
  role: SlotRole;
  count: number;
}
export interface NamedFormation {
  name: string;
  shape: FormationShape;
  rows: FormationRow[];
}

const GK_ROW: FormationRow = { role: "GK", count: 1 };
const row = (role: SlotRole, count: number): FormationRow => ({ role, count });

export const FORMATION_CATALOGUE: NamedFormation[] = [
  { name: "4-4-2", shape: { DEF: 4, MID: 4, ATT: 2 }, rows: [GK_ROW, row("DEF", 4), row("MID", 4), row("ATT", 2)] },
  { name: "4-4-1-1", shape: { DEF: 4, MID: 4, ATT: 2 }, rows: [GK_ROW, row("DEF", 4), row("MID", 4), row("ATT", 1), row("ATT", 1)] },
  { name: "4-1-2-1-2", shape: { DEF: 4, MID: 4, ATT: 2 }, rows: [GK_ROW, row("DEF", 4), row("MID", 1), row("MID", 2), row("MID", 1), row("ATT", 2)] },
  { name: "4-3-3", shape: { DEF: 4, MID: 3, ATT: 3 }, rows: [GK_ROW, row("DEF", 4), row("MID", 3), row("ATT", 3)] },
  { name: "4-2-3-1", shape: { DEF: 4, MID: 5, ATT: 1 }, rows: [GK_ROW, row("DEF", 4), row("MID", 2), row("MID", 3), row("ATT", 1)] },
  { name: "4-5-1", shape: { DEF: 4, MID: 5, ATT: 1 }, rows: [GK_ROW, row("DEF", 4), row("MID", 5), row("ATT", 1)] },
  { name: "4-1-4-1", shape: { DEF: 4, MID: 5, ATT: 1 }, rows: [GK_ROW, row("DEF", 4), row("MID", 1), row("MID", 4), row("ATT", 1)] },
  { name: "4-3-2-1", shape: { DEF: 4, MID: 5, ATT: 1 }, rows: [GK_ROW, row("DEF", 4), row("MID", 3), row("MID", 2), row("ATT", 1)] },
  { name: "3-5-2", shape: { DEF: 3, MID: 5, ATT: 2 }, rows: [GK_ROW, row("DEF", 3), row("MID", 5), row("ATT", 2)] },
  { name: "3-1-4-2", shape: { DEF: 3, MID: 5, ATT: 2 }, rows: [GK_ROW, row("DEF", 3), row("MID", 1), row("MID", 4), row("ATT", 2)] },
  { name: "3-4-3", shape: { DEF: 3, MID: 4, ATT: 3 }, rows: [GK_ROW, row("DEF", 3), row("MID", 4), row("ATT", 3)] },
  { name: "3-4-2-1", shape: { DEF: 3, MID: 4, ATT: 3 }, rows: [GK_ROW, row("DEF", 3), row("MID", 4), row("ATT", 2), row("ATT", 1)] },
  { name: "5-3-2", shape: { DEF: 5, MID: 3, ATT: 2 }, rows: [GK_ROW, row("DEF", 5), row("MID", 3), row("ATT", 2)] },
  { name: "5-4-1", shape: { DEF: 5, MID: 4, ATT: 1 }, rows: [GK_ROW, row("DEF", 5), row("MID", 4), row("ATT", 1)] },
  { name: "5-2-3", shape: { DEF: 5, MID: 2, ATT: 3 }, rows: [GK_ROW, row("DEF", 5), row("MID", 2), row("ATT", 3)] },
];

export const sameShape = (a: FormationShape, b: FormationShape) => a.DEF === b.DEF && a.MID === b.MID && a.ATT === b.ATT;
export const shapeToFormation = (s: FormationShape): Record<SlotRole, number> => ({ GK: 1, DEF: s.DEF, MID: s.MID, ATT: s.ATT });

export function resolveFormation(name: string | null, shape: FormationShape): NamedFormation | null {
  const stored = FORMATION_CATALOGUE.find((f) => f.name === name);
  if (stored && sameShape(stored.shape, shape)) return stored;
  return FORMATION_CATALOGUE.find((f) => sameShape(f.shape, shape)) ?? null;
}

export interface PlannerSlot {
  slotIndex: number;
  slotRole: SlotRole;
  isFinisher: boolean;
  playerId: string | null;
  locked: boolean;
}

export function currentShape(slots: readonly PlannerSlot[]): FormationShape {
  const counts = { DEF: 0, MID: 0, ATT: 0 };
  for (const s of slots) if (!s.isFinisher && s.slotRole !== "GK") counts[s.slotRole] += 1;
  return counts;
}

export interface FormationPlan {
  ok: boolean;
  lockedConflict: SlotRole | null;
  payload: { slotIndex: number; slotRole: SlotRole; isFinisher: boolean }[];
  displaced: { slotIndex: number; playerId: string }[];
  changesAnything: boolean;
}

/** The setFormation payload that takes the XI to `shape` (identical rules to the web planner). */
export function planFormationChange(slots: readonly PlannerSlot[], shape: FormationShape): FormationPlan {
  const capacity: Record<SlotRole, number> = shapeToFormation(shape);
  const xi = slots.filter((s) => !s.isFinisher);
  for (const s of xi) {
    if (!s.locked) continue;
    capacity[s.slotRole] -= 1;
    if (capacity[s.slotRole] < 0) return { ok: false, lockedConflict: s.slotRole, payload: [], displaced: [], changesAnything: false };
  }
  const assigned = new Map<number, SlotRole>();
  const unassigned: PlannerSlot[] = [];
  for (const filledPass of [true, false]) {
    for (const s of xi) {
      if (s.locked || assigned.has(s.slotIndex)) continue;
      if ((s.playerId !== null) !== filledPass) continue;
      if (capacity[s.slotRole] > 0) {
        capacity[s.slotRole] -= 1;
        assigned.set(s.slotIndex, s.slotRole);
      } else if (!filledPass) unassigned.push(s);
    }
  }
  for (const s of xi) if (!s.locked && !assigned.has(s.slotIndex) && s.playerId !== null) unassigned.push(s);
  const leftover: SlotRole[] = [];
  for (const r of SLOT_ROLES) for (let i = 0; i < capacity[r]; i += 1) leftover.push(r);
  const displaced: { slotIndex: number; playerId: string }[] = [];
  unassigned.forEach((s, i) => {
    const r = leftover[i]!;
    assigned.set(s.slotIndex, r);
    if (s.playerId !== null && r !== s.slotRole) displaced.push({ slotIndex: s.slotIndex, playerId: s.playerId });
  });
  const payload = [...slots]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((s) => ({ slotIndex: s.slotIndex, slotRole: s.isFinisher ? s.slotRole : (assigned.get(s.slotIndex) ?? s.slotRole), isFinisher: s.isFinisher }));
  const changesAnything = payload.some((n) => {
    const p = slots.find((s) => s.slotIndex === n.slotIndex)!;
    return p.slotRole !== n.slotRole || p.isFinisher !== n.isFinisher;
  });
  return { ok: true, lockedConflict: null, payload, displaced, changesAnything };
}

/** Server error text → something a player can read (Convex wraps the message). */
export function serverMessage(e: unknown, fallback = "That didn't go through. Try again."): string {
  const raw = e instanceof Error ? e.message : String(e ?? "");
  const m = raw.match(/Uncaught Error:\s*([^\n]+?)(?:\s+at\s|\n|$)/);
  const msg = (m?.[1] ?? raw)
    .replace(/^\[CONVEX[^\]]*\]\s*/, "")
    .replace(/^\[Request ID:[^\]]*\]\s*/, "")
    .trim();
  // Production hides the reason ("Server Error"): fall back to plain words.
  if (!msg || /^Server Error$/i.test(msg) || msg.length >= 200) return fallback;
  return msg;
}
