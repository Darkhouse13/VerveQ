/**
 * Raw-response persistence. One JSON file per fixture, plus one per discovery
 * call, exactly as the API returned it — no normalisation on the way in, so the
 * sample on disk stays auditable against the provider.
 *
 * Existence of the file IS the "already fetched" signal. That is what makes the
 * ticket's "requests are never repeated" guarantee hold across a three-day pull
 * even if the state file is lost.
 */

import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './state.ts';

export const FIXTURES_DIR = path.join(DATA_DIR, 'fixtures');
export const EVENTS_DIR = path.join(DATA_DIR, 'events');
export const DISCOVERY_DIR = path.join(DATA_DIR, 'discovery');

export function fixturePath(leagueId: number, fixtureId: number): string {
  return path.join(FIXTURES_DIR, String(leagueId), `${fixtureId}.json`);
}

export function eventsPath(leagueId: number, fixtureId: number): string {
  return path.join(EVENTS_DIR, String(leagueId), `${fixtureId}.json`);
}

export function discoveryPath(name: string): string {
  return path.join(DISCOVERY_DIR, `${name}.json`);
}

export function has(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
}

/** Every fixture id already on disk, across all leagues. */
export function cachedFixtureIds(): number[] {
  if (!fs.existsSync(FIXTURES_DIR)) return [];
  const ids: number[] = [];
  for (const leagueDir of fs.readdirSync(FIXTURES_DIR)) {
    const dir = path.join(FIXTURES_DIR, leagueDir);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      const id = Number.parseInt(file.slice(0, -'.json'.length), 10);
      if (Number.isFinite(id)) ids.push(id);
    }
  }
  return ids.sort((a, b) => a - b);
}
