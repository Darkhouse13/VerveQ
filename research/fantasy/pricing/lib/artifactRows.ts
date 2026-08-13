/**
 * MISSION FW-REPRICE — the bridge from price artifacts to gate rows.
 *
 * Both seed scripts must run R2 and R3 (mission: "asserted in the seed
 * pipeline, run on both deployments"), and R2 groups by club, so neither
 * artifact can be gated alone: a club's squad has to be complete for "the
 * most-played player at this club and position" to mean anything. So the rows
 * are always assembled from BOTH files, whichever seed is running.
 *
 * `overlayStoredPrices` is what makes the deployment-side assertion real. Run
 * against the artifact, the gates prove the FILE consistent. Overlaid with the
 * prices read back out of a deployment, they prove THAT DEPLOYMENT consistent
 * — which is the thing a seed can actually get wrong.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GateRow } from './gates.ts';

const PRICING_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CORE_ARTIFACT = path.join(PRICING_DIR, 'price-final.json');
export const EXPANSION_ARTIFACT = path.join(PRICING_DIR, 'expansion-price-final.json');

interface ArtifactRow {
  apiFootballId: number;
  name: string;
  clubId?: number;
  club?: string;
  clubName?: string;
  position: string;
  pool: string;
  price: number;
  minutes: number;
  per90?: number | null;
  overridden?: boolean;
}

function rowsOf(file: string): ArtifactRow[] {
  return (JSON.parse(fs.readFileSync(file, 'utf-8')) as { players: ArtifactRow[] }).players;
}

/**
 * Every distinct priced player, from both artifacts. The eight players who
 * appear in both are written as identical rows by reprice.ts, so first-wins
 * deduplication is exact rather than a preference; a disagreement is a bug and
 * throws here rather than silently gating one of the two prices.
 */
export function gateRowsFromArtifacts(): GateRow[] {
  const byId = new Map<number, GateRow>();
  for (const r of [...rowsOf(CORE_ARTIFACT), ...rowsOf(EXPANSION_ARTIFACT)]) {
    const row: GateRow = {
      apiFootballId: r.apiFootballId,
      name: r.name,
      clubId: r.clubId ?? -1,
      clubName: r.clubName ?? r.club ?? String(r.clubId ?? ''),
      position: r.position,
      pool: r.pool,
      price: r.price,
      lastSeasonMinutes: r.minutes,
      per90: r.per90 ?? null,
      overridden: r.overridden === true,
    };
    const seen = byId.get(row.apiFootballId);
    if (seen !== undefined) {
      if (seen.price !== row.price || seen.pool !== row.pool) {
        throw new Error(
          `STOP: ${row.name} (${row.apiFootballId}) is in both artifacts with different prices ` +
            `(${seen.price}/${seen.pool} vs ${row.price}/${row.pool}) — the two files disagree.`,
        );
      }
      continue;
    }
    byId.set(row.apiFootballId, row);
  }
  return [...byId.values()];
}

/**
 * The same rows, re-priced from what a deployment actually stores. Any player
 * the deployment has no price for is reported by id rather than skipped — a
 * missing price is exactly the failure this pass exists to catch.
 */
export function overlayStoredPrices(
  rows: readonly GateRow[],
  stored: ReadonlyMap<string, number | null>,
): { rows: GateRow[]; missing: number[]; unpriced: number[] } {
  const out: GateRow[] = [];
  const missing: number[] = [];
  const unpriced: number[] = [];
  for (const r of rows) {
    const price = stored.get(String(r.apiFootballId));
    if (price === undefined) {
      missing.push(r.apiFootballId);
      continue;
    }
    if (price === null) {
      unpriced.push(r.apiFootballId);
      continue;
    }
    out.push({ ...r, price });
  }
  return { rows: out, missing, unpriced };
}
