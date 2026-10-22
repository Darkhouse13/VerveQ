export type CountMap = Record<string, Record<string, number>>;
export interface AllowlistEntry {
  file: string;
  pattern: string;
  /** How many occurrences this entry may excuse (default: all). */
  count?: number;
  /** Only occurrences on lines matching this are excused. */
  line?: RegExp;
  reason: string;
}
export const APP_ROOT: string;
export const SRC_ROOT: string;
export const BASELINE_PATH: string;
export const PATTERNS: Record<string, RegExp>;
export const ALLOWLIST: AllowlistEntry[];
export function countAll(): CountMap;
export function totals(map: CountMap): Record<string, number>;
export function readBaseline(): CountMap;
export function allowlistUsage(): Array<AllowlistEntry & { used: number }>;
