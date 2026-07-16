/**
 * Display metadata for THE DRAW's synthetic vocabularies: archetype labels +
 * icons, synergy family colors, tag formatting. All labels are synthetic
 * (CLUB_A-style) — real labels arrive with the real card set.
 */

import { Shield, Zap, Cog, History, Sparkles, Hand, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { eraTag } from "@/lib/drawEngine";
import type { FixtureModifier, SynergyFamily } from "@/lib/drawEngine";

export const ARCHETYPE_META: Record<string, { label: string; Icon: LucideIcon }> = {
  ARCH_WALL: { label: "WALL", Icon: Shield },
  ARCH_BLITZ: { label: "BLITZ", Icon: Zap },
  ARCH_ENGINE: { label: "ENGINE", Icon: Cog },
  ARCH_THROWBACK: { label: "THROWBACK", Icon: History },
  ARCH_NEWWAVE: { label: "NEW WAVE", Icon: Sparkles },
  ARCH_FORTRESS_KEEPER: { label: "FORTRESS", Icon: Hand },
};

export function archetypeMeta(id: string): { label: string; Icon: LucideIcon } {
  return ARCHETYPE_META[id] ?? { label: id.replace(/^ARCH_/, ""), Icon: Swords };
}

/** Family → house palette slot (matches the meter + tag chip colors). */
export const FAMILY_CLASS: Record<SynergyFamily, string> = {
  club: "bg-electric-blue text-electric-blue-foreground",
  nation: "bg-hot-pink text-hot-pink-foreground",
  era: "bg-yellow text-yellow-foreground",
};

export const FAMILY_LABEL: Record<SynergyFamily, string> = {
  club: "CLUB",
  nation: "NATION",
  era: "ERA",
};

/** "CLUB_D" → "D", "NATION_C" → "C", "ERA_1990s" → "90s". */
export function shortTag(tag: string): string {
  if (tag.startsWith("ERA_")) return tag.replace(/^ERA_..(..s)$/, "$1");
  return tag.replace(/^[A-Z]+_/, "");
}

/** "CLUB_D" → "CLUB D" (identity/share lines). */
export function spacedTag(tag: string): string {
  if (tag.startsWith("ERA_")) return `${shortTag(tag)} ERA`;
  return tag.replace("_", " ");
}

export function formatMult(mult: number): string {
  return `×${(Math.round(mult * 100) / 100).toString()}`;
}

/** One fixture modifier as a compact chip label, e.g. "DEF ×2.69", "PRE-90s ×1.78". */
export function modifierLabel(mod: FixtureModifier): string {
  if (mod.kind === "eraBefore") return `PRE-${eraBoundLabel(mod.value as number)} ${formatMult(mod.mult)}`;
  if (mod.kind === "eraAtLeast") return `${eraBoundLabel(mod.value as number)}+ ${formatMult(mod.mult)}`;
  if (mod.kind === "position") return `${mod.value} ${formatMult(mod.mult)}`;
  return `${shortTag(String(mod.value))} ${formatMult(mod.mult)}`;
}

/**
 * Era bucket index → decade label ("3" → "90s"). Goes through the engine's own
 * `eraTag` rather than repeating its 1960 base here: the buckets cards are
 * generated into and the labels modifiers are described with cannot then drift.
 */
function eraBoundLabel(index: number): string {
  return shortTag(eraTag(index));
}
