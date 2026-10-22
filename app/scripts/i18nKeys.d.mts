export const APP_ROOT: string;
export const SRC_ROOT: string;
export const LOCALES_ROOT: string;
export function loadLocale(lng?: string): Record<string, Record<string, string>>;
export function literalKeyUses(files?: string[]): { file: string; key: string; ns?: string }[];
export function missingKeys(): { file: string; key: string; ns?: string }[];
export function unusedKeys(): string[];
