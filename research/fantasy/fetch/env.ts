/**
 * .env loader. Zero-dependency, because this package has no runtime deps and
 * adding one to read six lines of KEY=VALUE would not be a good trade.
 *
 * The key is returned to the client and nowhere else. Nothing in this package
 * prints it, and `describeKey` exists so operators can confirm the right key
 * loaded without the value reaching a terminal, a log, or a report.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ENV_PATH = path.join(PACKAGE_ROOT, '.env');

export interface FetchEnv {
  readonly apiKey: string;
  readonly authMode: 'apisports' | 'rapidapi';
}

function parseEnvFile(contents: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Precedence: real process env first, then the package .env. That way an
 * operator can override the file for a one-off run without editing it.
 *
 * Returns null rather than throwing so the caller decides whether a missing key
 * is fatal — `--dry-run` does not need one, a live pull does.
 */
export function loadEnv(): FetchEnv | null {
  let fileVars: Record<string, string> = {};
  if (fs.existsSync(ENV_PATH)) {
    fileVars = parseEnvFile(fs.readFileSync(ENV_PATH, 'utf-8'));
  }

  const apiKey = process.env.API_FOOTBALL_KEY || fileVars.API_FOOTBALL_KEY || '';
  if (apiKey === '') return null;

  const rawMode = (process.env.AUTH_MODE || fileVars.AUTH_MODE || 'apisports').toLowerCase();
  const authMode = rawMode === 'rapidapi' ? 'rapidapi' : 'apisports';

  return { apiKey, authMode };
}

/**
 * A non-reversible description of the loaded key, safe to print. Length plus
 * the last four characters is enough to tell two keys apart and not enough to
 * use one.
 */
export function describeKey(apiKey: string): string {
  return `${apiKey.length} chars, ending ...${apiKey.slice(-4)}`;
}
