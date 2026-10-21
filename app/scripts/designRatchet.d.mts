export type CountMap = Record<string, Record<string, number>>;
export const APP_ROOT: string;
export const SRC_ROOT: string;
export const BASELINE_PATH: string;
export const PATTERNS: Record<string, RegExp>;
export function countAll(): CountMap;
export function totals(map: CountMap): Record<string, number>;
export function readBaseline(): CountMap;
