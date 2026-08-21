/**
 * Weekend Fantasy — transfer classification rules (FW-T1), as pure functions.
 *
 * Everything the transfer pipeline DECIDES lives here so it can be unit tested
 * without a database or a network: record identity, window filtering,
 * classification a–e, and the out-of-order-application guard. fantasyTransfers.ts
 * fetches and writes; this module never does either.
 *
 * Rulings (owner, 2026-08-01):
 *   R1  prices are static — nothing here computes a price; the 4.0 floor for a
 *       created player is applied by the write path from PRICE_MIN
 *   R2  existing squads are grandfathered — squads are not this module's input
 *   R3  fail-closed on ambiguity — every uncertain branch below returns
 *       "unresolved" with a reason, never a guess
 */

import type { FeedTransferEntry } from "../fantasyApiFootball";
import { normalizePlayerName } from "./fantasyPlayerName";

/** Sweeps re-read this many days behind the last success. Overlap is free —
 *  record identity makes a re-seen transfer a no-op — and it is what makes a
 *  day the feed backfilled late land anyway. */
export const CRON_WINDOW_OVERLAP_DAYS = 3;

/** The backfill's inclusive lower bound: squads were seeded from late-July
 *  reads, so the window opens where the seed's knowledge starts going stale. */
export const TRANSFER_BACKFILL_START_DAY = "2026-07-01";

/** The ticket's gate: STOP if a single run projects more calls than this. */
export const SWEEP_CALL_CEILING = 500;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** One feed transfer record, normalized but not yet classified. */
export interface TransferCandidate {
  readonly providerPlayerId: string;
  readonly playerName: string;
  /** YYYY-MM-DD. Lexicographic comparison IS chronological comparison. */
  readonly transferDate: string;
  readonly rawFromClubId: string | null;
  readonly rawToClubId: string | null;
  /** Feed display names, for created players' pool meta and owner review. */
  readonly fromClubName: string | null;
  readonly toClubName: string | null;
  readonly transferType: string | null;
}

/**
 * Provider identity for one transfer record. The /transfers endpoint carries no
 * id; (player, date, from, to) is the tuple the provider itself distinguishes
 * records by. A missing side keys as "?" — two records differing only in which
 * side is missing are the same record re-served with less data, and colliding
 * them is the safe direction (a no-op, not a double-apply).
 */
export function transferKey(c: {
  providerPlayerId: string;
  transferDate: string;
  rawFromClubId: string | null;
  rawToClubId: string | null;
}): string {
  return [
    c.providerPlayerId,
    c.transferDate,
    c.rawFromClubId ?? "?",
    c.rawToClubId ?? "?",
  ].join("|");
}

/** The feed flags a loan in `type` as a label, not a field. */
export function isLoanType(transferType: string | null): boolean {
  return transferType !== null && /loan/i.test(transferType);
}

export interface CollectResult {
  /** Deduped by transferKey, in (date, key) order — the application order. */
  readonly candidates: TransferCandidate[];
  /** Records dropped for carrying no usable player id or date. */
  readonly malformed: number;
  /** Records inside the window that touch no covered club — out of scope. */
  readonly outOfScope: number;
  /** Records older than the window — already covered by a prior sweep. */
  readonly beforeWindow: number;
}

/**
 * Flatten one team's transfer feed into windowed, covered, deduped candidates.
 *
 * Callable once over the concatenation of all 96 team reads: an internal
 * transfer appears in both clubs' feeds and collapses onto one key here.
 */
export function collectCandidates(
  entries: readonly FeedTransferEntry[],
  opts: {
    windowFromDay: string;
    coveredClubIds: ReadonlySet<string>;
  },
): CollectResult {
  const byKey = new Map<string, TransferCandidate>();
  let malformed = 0;
  let outOfScope = 0;
  let beforeWindow = 0;

  for (const entry of entries) {
    const playerId = entry.player?.id;
    if (playerId === null || playerId === undefined) {
      malformed += 1;
      continue;
    }

    for (const move of entry.transfers ?? []) {
      if (move.date === null || !ISO_DAY.test(move.date)) {
        malformed += 1;
        continue;
      }
      if (move.date < opts.windowFromDay) {
        beforeWindow += 1;
        continue;
      }

      const inSide = move.teams?.in ?? null;
      const outSide = move.teams?.out ?? null;
      const rawToClubId = inSide?.id != null ? String(inSide.id) : null;
      const rawFromClubId = outSide?.id != null ? String(outSide.id) : null;

      const touchesCovered =
        (rawToClubId !== null && opts.coveredClubIds.has(rawToClubId)) ||
        (rawFromClubId !== null && opts.coveredClubIds.has(rawFromClubId));
      if (!touchesCovered) {
        outOfScope += 1;
        continue;
      }

      const candidate: TransferCandidate = {
        providerPlayerId: String(playerId),
        // FW-NAMES: the transfer feed carries the same entity-escaped,
        // mis-decoded names the squad feed does, and this candidate is what
        // seeds a NEW fantasyPlayers row (applyTransferChunk, incoming_new).
        // Repairing here keeps the two ingest paths writing one spelling.
        playerName: normalizePlayerName(entry.player.name ?? `player ${playerId}`),
        transferDate: move.date,
        rawFromClubId,
        rawToClubId,
        fromClubName: outSide?.name ?? null,
        toClubName: inSide?.name ?? null,
        transferType: move.type ?? null,
      };
      // First sighting wins; a duplicate is the same record off the other
      // club's feed (or a re-serve with fewer fields — see transferKey).
      const key = transferKey(candidate);
      if (!byKey.has(key)) byKey.set(key, candidate);
    }
  }

  const candidates = [...byKey.values()].sort((a, b) =>
    a.transferDate !== b.transferDate
      ? a.transferDate < b.transferDate
        ? -1
        : 1
      : transferKey(a) < transferKey(b)
        ? -1
        : 1,
  );

  return { candidates, malformed, outOfScope, beforeWindow };
}

export type TransferClassification =
  | "internal"
  | "incoming_known"
  | "incoming_new"
  | "outgoing"
  | "unresolved";

export interface ClassifiedTransfer {
  readonly classification: TransferClassification;
  /** Present exactly when classification is "unresolved" (R3's log line). */
  readonly unresolvedReason?: string;
}

/**
 * The ticket's exactly-one-of classification (P2), given the two facts the
 * candidate does not carry: whether the player already exists in our table,
 * and whether each side's club is covered.
 *
 * The branch shape follows what each class DOES, which is why the destination
 * decides first:
 *  - destination covered + player known   → update club (a and b are the same
 *    write; "internal" vs "incoming_known" records where he came from)
 *  - destination covered + player unknown → create at the floor (c) — even off
 *    a covered origin, because a player we never carried is new to the
 *    universe wherever the feed says he stood
 *  - destination outside + origin covered → departed (d)
 *  - a null ORIGIN with a covered destination is admitted — the action
 *    (update/create at destination) is identical whatever the origin was
 *  - a null DESTINATION with a covered origin is OUTGOING (d) — the FW-T1b
 *    owner ruling. FW-T1 parked these as unresolved; the ruling reads them
 *    as what they are on this feed: releases, retirements and moves the
 *    provider has no destination for, i.e. the player has left the covered
 *    universe. Row kept, departed, active:false — same as any departure.
 */
export function classifyTransfer(args: {
  candidate: TransferCandidate;
  playerKnown: boolean;
  coveredClubIds: ReadonlySet<string>;
}): ClassifiedTransfer {
  const { candidate, playerKnown, coveredClubIds } = args;
  const toCovered =
    candidate.rawToClubId !== null && coveredClubIds.has(candidate.rawToClubId);
  const fromCovered =
    candidate.rawFromClubId !== null && coveredClubIds.has(candidate.rawFromClubId);

  if (toCovered) {
    if (!playerKnown) return { classification: "incoming_new" };
    return fromCovered
      ? { classification: "internal" }
      : { classification: "incoming_known" };
  }

  if (candidate.rawToClubId === null) {
    // Destination missing entirely. With a covered origin this is class d by
    // the FW-T1b owner ruling (see the header); without one there is nothing
    // covered to act on and R3 keeps it parked.
    if (fromCovered) return { classification: "outgoing" };
    return {
      classification: "unresolved",
      unresolvedReason: "destination club missing from feed record",
    };
  }

  if (fromCovered) return { classification: "outgoing" };

  // Neither side covered — collectCandidates filters these out, so reaching
  // here means the coverage set changed between collection and classification.
  return {
    classification: "unresolved",
    unresolvedReason: "neither club is covered",
  };
}

/**
 * Out-of-order guard: apply a candidate's club move only if no LATER-dated
 * move for the same player has already been applied. The feed backfills
 * history; a July record arriving after an August one must be recorded (it is
 * part of the ledger) without regressing the player's current club.
 *
 * Same-date moves apply in the deterministic (date, key) order collectCandidates
 * established; an equal date does not block.
 */
/**
 * FW-EXPAND R2: is this stored event a reactivation candidate after the
 * covered universe widened? Exactly the rows first classified "outgoing"
 * whose recorded destination is NOW a covered club. Superseded rows never
 * moved anyone and stay historical; unresolved rows have their own retry
 * pass; anything else already applied a covered-destination move.
 */
export function reactivationCandidate(
  row: {
    classification: string;
    rawToClubId: string | null;
    superseded?: boolean;
  },
  coveredClubIds: ReadonlySet<string>,
): boolean {
  return (
    row.classification === "outgoing" &&
    row.superseded !== true &&
    row.rawToClubId !== null &&
    coveredClubIds.has(row.rawToClubId)
  );
}

export function laterMoveAlreadyApplied(
  candidateDate: string,
  appliedMoveDatesForPlayer: readonly string[],
): boolean {
  return appliedMoveDatesForPlayer.some((d) => d > candidateDate);
}
