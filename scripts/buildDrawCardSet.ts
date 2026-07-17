#!/usr/bin/env npx tsx
/**
 * THE DRAW — real card-set SELECTOR (Ticket E0.2).
 *
 * Builds `drawCardsReal.candidates.json` + `drawCardsReal.dossier.json` from the
 * canonical `playersSourced.json` plus the sitelink fame backbone. Pure and
 * offline: every input is a committed file or a cache written by the ingest
 * script's network stages, so a third party can reproduce the set byte for byte.
 *
 *   npx tsx scripts/buildDrawCardSet.ts            # write the artifacts
 *   npx tsx scripts/buildDrawCardSet.ts --check    # assert the committed ones match
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS, AND WHAT IT IS NOT
 *
 * E1/E1.1/E1.2 shipped the card set as DATA ONLY. The selector ran in a build
 * session and was never committed; BUILD_NOTES §11 recorded the gap after E1.2
 * hit it — the era partition was documented nowhere, and E1.2 found there was no
 * selector to transcribe the rule from, so one boundary had to be DECLARED rather
 * than recovered. Ticket E0.2 asks for the E1 artifacts to be regenerated "via the
 * committed selector". There is no committed selector. This is it.
 *
 * It is NOT a recovery of E1's selector, and it must not be read as one. Selection
 * order, tier handling, club-tag spelling and display codes were session-only
 * knowledge and are GONE. What survives is prose in BUILD_NOTES §1/§7/§8/§12: the
 * floors, the quotas, the fame backbone, the era rule. This file implements those
 * rules afresh and DECLARES everything the prose did not pin down.
 *
 * Consequence, stated plainly: running this on the OLD canonical file does not
 * reproduce the committed real-v1. It cannot — the rules it had to declare are
 * exactly the ones nobody wrote down. So the E0.2 report gives TWO diffs:
 *
 *   real-v1 -> X   X = this selector on the OLD canonical  = re-authoring drift
 *   X       -> Y   Y = this selector on the NEW canonical  = the E0.2 rule effects
 *
 * Only the second is attributable to the pipeline fixes, and the first is the
 * price of the missing selector rather than anything E0.2 changed. Reporting one
 * combined diff would silently blame the rule changes for the drift.
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateCardSet } from "../app/src/lib/drawEngine/cardGen";
import { C13V1_CONFIG, C13V1_CONFIG_VERSION } from "../app/src/lib/drawEngine/configs/c13v1";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "app", "convex", "data");
const CACHE = path.join(__dirname, "cache", "careerPath");

const SOURCED_PATH = path.join(DATA, "playersSourced.json");
const RULINGS_PATH = path.join(DATA, "ownerPositionRulings.json");
const NATION_RULINGS_PATH = path.join(DATA, "ownerNationRulings.json");
const DEBUT_RULINGS_PATH = path.join(DATA, "ownerDebutRulings.json");
const DISPUTED_PATH = path.join(DATA, "ownerDisputedStatements.json");
const CITED_OVERRIDES_PATH = path.join(DATA, "ownerCitedOverrides.json");
const SITELINKS_PATH = path.join(CACHE, "sitelinks.json");
const CARDS_PATH = path.join(DATA, "drawCardsReal.candidates.json");
const DOSSIER_PATH = path.join(DATA, "drawCardsReal.dossier.json");

/** Pinned so an open spell's tenure is reproducible rather than clock-dependent. */
const PINNED_YEAR = 2026;
const SET_VERSION = "real-v3";
const RATING_SEED = "realset-ratings-v1";
const SET_SIZE = 430;
const MAX_CLUBS_PER_CARD = 3;
const ERA_FLOOR = 40;

type Pos = "GK" | "DEF" | "MID" | "ATT";
interface Spell { start: number | null; end: number | null }
interface SourcedClub { value: string; clubQid: string; spells: Spell[]; source: unknown; sourceQuality: string }
interface Sourced<T> { value: T; source: { qid: string; property: string; retrievedAt: string }; sourceQuality: string }
interface Player {
  careerPathId: string; answerName: string; origin: string; qid: string;
  facts: { nation: Sourced<string> | null; position: Sourced<Pos> | null; sourceStartYear: Sourced<number> | null; birthYear: Sourced<number> | null; clubs: SourcedClub[] };
  identityEvidence: Record<string, unknown> & { positionCandidates?: Pos[]; nationCandidates?: string[]; positionStatements?: string[] };
  volatility: string;
}
const readJson = <T,>(p: string, fb: T): T => (fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T) : fb);

// ─────────────────────────────────────────────────────────────────────────────
// S1 — the selectable pool
// ─────────────────────────────────────────────────────────────────────────────
function pool(players: Player[]) {
  // Duplicate QIDs: the same person emitted under two names. Two cards for one
  // player is a visible defect AND would forge a synergy chain with himself.
  // Keep the fuller name (Marcelo -> "Marcelo Vieira"), ties by careerPathId so
  // the pick never depends on file order.
  const byQid = new Map<string, Player>();
  for (const p of players) {
    const prev = byQid.get(p.qid);
    if (!prev) { byQid.set(p.qid, p); continue; }
    const better =
      p.answerName.length !== prev.answerName.length
        ? p.answerName.length > prev.answerName.length
        : p.careerPathId < prev.careerPathId;
    if (better) byQid.set(p.qid, p);
  }
  const distinct = [...byQid.values()];
  // FAIL CLOSED. A card needs a position, a debut year and at least one club; none
  // may be invented, so a player missing any of them is dropped and counted.
  const drops = { noPosition: 0, noSourceStart: 0, noClub: 0 };
  const selectable = distinct.filter((p) => {
    if (!p.facts.position) { drops.noPosition++; return false; }
    // E0.5 — a null sourceStartYear fails the card out here. This is how the van der
    // Sar / De Bruyne fail-closed (erased earliest career, ingest) removes them: the
    // canonical carries null, so the pool never selects them and the selector
    // backfills — no card ships on a mis-bucketed or unknowable start year.
    if (!p.facts.sourceStartYear) { drops.noSourceStart++; return false; }
    if (p.facts.clubs.length === 0) { drops.noClub++; return false; }
    return true;
  });
  return { distinct, selectable, drops, duplicates: players.length - distinct.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// S2 — fame (EDITORIAL, sitelink-backed)
// ─────────────────────────────────────────────────────────────────────────────
// Wikidata sitelink count = how many Wikipedia language editions carry an article.
// Objective and reproducible, but it is NOT a sourced fact about the player and is
// never published as one. Ties break on QID so the order is total and stable.
function fameOrder(ps: Player[], sitelinks: Record<string, number>): Player[] {
  return ps.slice().sort((a, b) => (sitelinks[b.qid] ?? 0) - (sitelinks[a.qid] ?? 0) || a.qid.localeCompare(b.qid));
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 — era mapping (EDITORIAL — the E1.2 rule, transcribed)
// ─────────────────────────────────────────────────────────────────────────────
// peakYear := debutYear + 5. A card belongs to the era a player was KNOWN in, not
// the year he first appeared. Bucket 0 is open-ended below so the pre-1960 icons
// (Puskás 1943, Di Stéfano) have a home; bucket 3 is open above.
// Labels are the COMMITTED ones (E1.2 relabelled bucket 0 to "≤70s"); the
// drawCardSetEraContract drift guard compares card labels against these.
//
// The bucket 0/1 boundary is DECLARED, not transcribed. E1.2 could declare it freely
// because nothing turned on it: no card had debutYear 1975, so peakYear<=1980 and
// <=1979 classified all 430 identically.
//
// E0.4 — THAT IS NO LONGER TRUE, and the declaration is now load-bearing. E0.2's
// debut rules moved 85 values, and real-v2 contains Jean Tigana (real_0427, debut
// 1975, peakYear 1980) sitting EXACTLY on the boundary. He is in bucket 0 because of
// this line. And bucket 0 holds exactly 40 cards — the floor — so under <=1979 he
// moves to bucket 1, bucket 0 falls to 39, and the selector has to swap a card in to
// stay legal. A boundary that classified nothing now decides a card and a floor.
// Kept as declared (it is still the documented choice, and it keeps the four ranges
// contiguous), but it is no longer free, and the owner should know that.
const ERA_BUCKETS = [
  { index: 0, label: "≤70s", minPeak: null as number | null, maxPeak: 1980 as number | null },
  { index: 1, label: "1980s-90s", minPeak: 1981 as number | null, maxPeak: 1999 as number | null },
  { index: 2, label: "2000s", minPeak: 2000 as number | null, maxPeak: 2009 as number | null },
  { index: 3, label: "2010s-20s", minPeak: 2010 as number | null, maxPeak: null as number | null },
] as const;
const eraOf = (debutYear: number) => ERA_BUCKETS.find((b) => b.maxPeak === null || debutYear + 5 <= b.maxPeak) ?? ERA_BUCKETS[3];

// ─────────────────────────────────────────────────────────────────────────────
// S4 — club tags
// ─────────────────────────────────────────────────────────────────────────────
// A tag is a SYNERGY KEY, so it must be 1:1 with a club QID. Distinct clubs share
// names — Club Atlético River Plate exists in Argentina AND Uruguay — so a
// collision is suffixed, never merged: merging forges a synergy chain between
// players who never shared a club.
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(fc|f\.c\.|afc|cf|sc|ac|ss|as|ssc|club|association|football|futbol|de|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "club";

function tenure(c: SourcedClub): number {
  // Sum of the sourced spells. An open spell runs to PINNED_YEAR. This is why the
  // merge had to die before this line could be trusted: on a hull, Rooney's Everton
  // "2002-2018" outranked his real Manchester United tenure.
  let t = 0;
  for (const s of c.spells) {
    if (s.start === null) continue;
    t += Math.max(0, (s.end ?? PINNED_YEAR) - s.start) + 1;
  }
  return t;
}

function buildTagger(selected: Player[]) {
  const byQid = new Map<string, { tag: string; code: string; name: string }>();
  const usedTag = new Set<string>();
  const usedCode = new Set<string>();
  // Assignment order is by CARD COUNT descending, then QID ascending — deterministic,
  // and it hands the clean code to the club that carries the most cards. Ordering by
  // QID alone is equally deterministic and produces "REA7" for Real Madrid, because
  // six smaller clubs happen to hold lower QIDs and claim "REA" first.
  const clubs = new Map<string, string>();
  const cardCount = new Map<string, number>();
  for (const p of selected)
    for (const c of p.facts.clubs) {
      if (!clubs.has(c.clubQid)) clubs.set(c.clubQid, c.value);
      cardCount.set(c.clubQid, (cardCount.get(c.clubQid) ?? 0) + 1);
    }
  const assignOrder = [...clubs.keys()].sort(
    (a, b) => (cardCount.get(b) ?? 0) - (cardCount.get(a) ?? 0) || a.localeCompare(b),
  );
  for (const qid of assignOrder) {
    const label = clubs.get(qid) as string;
    let tag = slug(label);
    if (usedTag.has(tag)) { let i = 2; while (usedTag.has(`${tag}-${i}`)) i++; tag = `${tag}-${i}`; }
    usedTag.add(tag);
    const base = (tag.replace(/-/g, "").slice(0, 3) || "clb").toUpperCase();
    let code = base;
    if (usedCode.has(code)) { let i = 2; while (usedCode.has(`${base}${i}`)) i++; code = `${base}${i}`; }
    usedCode.add(code);
    byQid.set(qid, { tag, code, name: label });
  }
  return byQid;
}

// ─────────────────────────────────────────────────────────────────────────────
// S5 — selection
// ─────────────────────────────────────────────────────────────────────────────
// Position quota is enforced BY CONSTRUCTION from the generator's positionWeights
// (GK1/DEF3/MID3/ATT3 -> 10/30/30/30%), which is what holds the set inside the
// ±3pp band without any post-hoc correction. Within a position, fame decides.
// Then era floors are repaired by lowest-fameRank swaps INSIDE the same position,
// so the quota cannot drift while the floor is satisfied.
function select(
  selectable: Player[],
  sitelinks: Record<string, number>,
  posOf: (p: Player) => Pos,
  eraYearOf: (p: Player) => number,
) {
  const w = C13V1_CONFIG.cardGen.positionWeights;
  const total = w.GK + w.DEF + w.MID + w.ATT;
  const quota: Record<Pos, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
  const order: Pos[] = ["GK", "DEF", "MID", "ATT"];
  let assigned = 0;
  order.forEach((p, i) => {
    quota[p] = i === order.length - 1 ? SET_SIZE - assigned : Math.round((SET_SIZE * w[p]) / total);
    assigned += quota[p];
  });

  const ranked = fameOrder(selectable, sitelinks);
  const byPos = (p: Pos) => ranked.filter((x) => posOf(x) === p);
  const chosen: Player[] = [];
  const swaps: string[] = [];
  for (const p of order) chosen.push(...byPos(p).slice(0, quota[p]));

  // ── era floors ──────────────────────────────────────────────────────────────
  // Promote the highest-fame unselected card of an under-floor era; drop the
  // lowest-fame selected card of the most over-supplied era — within the SAME
  // position, so quotas stay exact. Bounded: each pass fills one seat.
  for (let guard = 0; guard < 500; guard++) {
    const count = (i: number) => chosen.filter((c) => eraOf(eraYearOf(c)).index === i).length;
    const short = ERA_BUCKETS.map((b) => b.index).find((i) => count(i) < ERA_FLOOR);
    if (short === undefined) break;
    const inSet = new Set(chosen.map((c) => c.qid));
    const cand = ranked.find((c) => !inSet.has(c.qid) && eraOf(eraYearOf(c)).index === short);
    if (!cand) {
      throw new Error(
        `STOP: era bucket ${short} cannot reach the floor of ${ERA_FLOOR} — the pool is exhausted ` +
          `(${count(short)} selected, no unselected candidate left). Floors unreachable is a STOP condition, ` +
          `not something to relax.`,
      );
    }
    const pos = posOf(cand);
    const victim = [...chosen]
      .filter((c) => posOf(c) === pos && eraOf(eraYearOf(c)).index !== short)
      .sort((a, b) => (sitelinks[a.qid] ?? 0) - (sitelinks[b.qid] ?? 0) || b.qid.localeCompare(a.qid))
      .find((c) => count(eraOf(eraYearOf(c)).index) > ERA_FLOOR);
    if (!victim) throw new Error(`STOP: era bucket ${short} short and no droppable ${pos} outside a floor-bound era.`);
    chosen.splice(chosen.findIndex((c) => c.qid === victim.qid), 1);
    chosen.push(cand);
    swaps.push(`era${short} <- ${cand.answerName} (${pos}, fame ${sitelinks[cand.qid] ?? 0}) replaces ${victim.answerName} (era${eraOf(eraYearOf(victim)).index}, fame ${sitelinks[victim.qid] ?? 0})`);
  }
  return { chosen: fameOrder(chosen, sitelinks), quota, swaps };
}

// ─────────────────────────────────────────────────────────────────────────────
// build
// ─────────────────────────────────────────────────────────────────────────────
function build() {
  const players = readJson<Player[]>(SOURCED_PATH, []);
  const sitelinks = readJson<Record<string, number>>(SITELINKS_PATH, {});
  if (Object.keys(sitelinks).length === 0) throw new Error(`STOP: ${SITELINKS_PATH} missing — run cp-sitelinks first.`);
  const rulings = readJson<{ ruledBy?: string; ruledOn?: string; rulings?: { qid: string; ruling: Pos; note?: string }[] }>(RULINGS_PATH, {});
  const rulingByQid = new Map((rulings.rulings ?? []).map((r) => [r.qid, r]));

  // E0.3 — nation and debutYear rulings, same signed pattern as positions.
  type NationRuling = { qid: string; name: string; ruleOutput: string; ruleCandidates?: string[]; ruleBasis?: string; ruling: string; note?: string; pendingSecondSource?: boolean };
  type DebutRuling = { qid: string; name: string; ruleOutput: number; ruleBasis?: string; ruling: number; note?: string; independentRef?: string | null; independentRefStatus?: string; eraImpact?: string };
  const natRulings = readJson<{ ruledBy?: string; ruledOn?: string; rulings?: NationRuling[]; reviewedNotOverridden?: unknown[] }>(NATION_RULINGS_PATH, {});
  const debutRulings = readJson<{ ruledBy?: string; ruledOn?: string; rulings?: DebutRuling[] }>(DEBUT_RULINGS_PATH, {});
  const natRulingByQid = new Map((natRulings.rulings ?? []).map((r) => [r.qid, r]));
  const debutRulingByQid = new Map((debutRulings.rulings ?? []).map((r) => [r.qid, r]));

  // E0.4 — disputed statements (F2 class). These do NOT change a value; they change
  // what the artifact claims about it. The affected fact is forced amber and carries
  // the record, so a green fact can never rest on a statement a human has established
  // is false. No rule can find these — see ownerDisputedStatements.json.
  type Disputed = { qid: string; name: string; class: string; verdict: string; affectsFacts: string[]; cardQuality: string; statement: unknown; dispute: string; note: string; e2Reference?: string; valueStands?: unknown; dropPrintedClub?: string };
  const disputed = readJson<{ ruledBy?: string; ruledOn?: string; records?: Disputed[] }>(DISPUTED_PATH, {});
  const disputedByQid = new Map((disputed.records ?? []).map((r) => [r.qid, r]));

  // E0.5 — CITED ERA-YEAR OVERRIDES. sourceStartYear is the earliest senior-club
  // membership START, not a debut, and E2.1's blind verify found it systematically
  // early. No date is a published fact, but eraYear (-> peakYear -> eraIndex) still
  // decides the one year-derived thing a player sees, so this layer supplies eraYear
  // from a named, quoted citation whenever the sourced value would file the card in
  // the WRONG era. It never edits sourceStartYear; the sourced value stands beside it.
  type CitedOverride = { cardId: string; qid: string; name: string; field: "eraYear"; sourceValue: number; citedValue: number; publisher: string; url: string; quote: string; bucketMove?: string; note?: string; signedBy: string };
  const citedOverrides = readJson<{ ruledBy?: string; ruledOn?: string; records?: CitedOverride[]; acceptedNoise?: unknown[] }>(CITED_OVERRIDES_PATH, {});
  const citedOverrideByQid = new Map((citedOverrides.records ?? []).map((r) => [r.qid, r]));

  // FAIL CLOSED on a ruling that hits nothing. A QID-pinned ruling whose QID is not
  // in the pool is either a typo or a stale record, and in both cases it silently
  // does NOTHING — the exact drift the QID pinning exists to prevent (E1.1 pinned
  // Maldini's identity ruling to a QID for this reason, and warns if it misses).
  // A ruling the owner signed must either apply or stop the build.
  const poolQids = new Set(players.map((p) => p.qid));
  const byQidPool = new Map(players.map((p) => [p.qid, p]));
  for (const [label, qids] of [
    ["position", [...rulingByQid.keys()]],
    ["nation", [...natRulingByQid.keys()]],
    ["debutYear", [...debutRulingByQid.keys()]],
    ["disputedStatement", [...disputedByQid.keys()]],
    ["citedOverride", [...citedOverrideByQid.keys()]],
  ] as const) {
    const orphans = qids.filter((q) => !poolQids.has(q));
    if (orphans.length > 0)
      throw new Error(`STOP: ${label} ruling(s) reference QIDs absent from the canonical pool: ${orphans.join(", ")}`);
  }
  // A ruling that agrees with the rule is a no-op pretending to be a decision: it
  // would show as "editorial-ruled" while changing nothing. Catch it rather than
  // ship a card that claims a human overruled something.
  for (const r of natRulings.rulings ?? [])
    if (r.ruling === r.ruleOutput) throw new Error(`STOP: nation ruling for ${r.name} (${r.qid}) equals the rule output "${r.ruleOutput}" — record it under reviewedNotOverridden instead.`);
  for (const r of debutRulings.rulings ?? [])
    if (r.ruling === r.ruleOutput) throw new Error(`STOP: debut ruling for ${r.name} (${r.qid}) equals the rule output ${r.ruleOutput} — record it under reviewedNotOverridden instead.`);

  // E0.5 — a cited override must (a) declare the SAME sourceValue the pool actually
  // carries, so the record cannot silently rot when the canonical changes, and (b)
  // MOVE THE ERA BUCKET. An override whose citedValue lands in the same bucket as the
  // sourced value changes nothing a player sees, so it is a decision pretending to be
  // one — exactly what acceptedNoise is for. Both are STOP conditions, not warnings.
  for (const r of citedOverrides.records ?? []) {
    const p = byQidPool.get(r.qid)!;
    const src = p.facts.sourceStartYear?.value ?? null;
    // A debut ruling (Busquets) resets sourceStartYear before an override would read
    // it; none currently coincide, but resolve through it so the check stays honest.
    const effectiveSrc = debutRulingByQid.get(r.qid)?.ruling ?? src;
    if (effectiveSrc !== r.sourceValue)
      throw new Error(`STOP: cited override for ${r.name} (${r.qid}) declares sourceValue ${r.sourceValue} but the pool carries ${effectiveSrc}. Re-verify against the current canonical.`);
    if (eraOf(r.citedValue).index === eraOf(r.sourceValue).index)
      throw new Error(`STOP: cited override for ${r.name} (${r.qid}) does not cross an era bucket (${r.sourceValue} and ${r.citedValue} both map to era ${eraOf(r.sourceValue).index}) — record it under acceptedNoise instead.`);
  }

  // THE RULED POSITION IS THE CARD'S POSITION, so selection must run on the RULED
  // pool. Applying rulings after selection instead puts the set at ATT 147 / MID 111
  // (±4.19pp, outside the ±3pp band) — the 18 MID->ATT rulings move players across
  // buckets the quota was already balanced against. Enforcing the quota on ruled
  // positions restores 43/129/129/129 exactly, and the cards it drops are the
  // lowest-fame ATT while the cards it promotes are the highest-fame unselected MID.
  // A position ruling is therefore not cosmetic: it decides who is in the set.
  const posOf = (p: Player): Pos => rulingByQid.get(p.qid)?.ruling ?? p.facts.position!.value;
  // E0.3 — nation and debut rulings apply to the POOL, on the same principle.
  // nation enters no selection criterion and cannot move a card; the era year can.
  const natOf = (p: Player): string | null => natRulingByQid.get(p.qid)?.ruling ?? p.facts.nation?.value ?? null;
  // E0.5 — sourceStartYear is the published (dossier-only) sourced value: a debut
  // ruling may reset it, but a cited override never touches it.
  const startYearOf = (p: Player): number => debutRulingByQid.get(p.qid)?.ruling ?? p.facts.sourceStartYear!.value;
  // eraYear is what era mapping runs on: the cited override's value where one exists,
  // else sourceStartYear. This is the ONLY year that feeds eraOf, the era floors and
  // therefore selection — so the overrides are rulings-before-selection, like the rest.
  const eraYearOf = (p: Player): number => citedOverrideByQid.get(p.qid)?.citedValue ?? startYearOf(p);

  const { selectable, drops, duplicates } = pool(players);
  const { chosen, quota, swaps } = select(selectable, sitelinks, posOf, eraYearOf);
  if (chosen.length !== SET_SIZE) throw new Error(`STOP: selected ${chosen.length}, expected ${SET_SIZE}`);

  // Ratings are identical-by-construction to the tuned c13v1 set: the SAME generator,
  // the SAME seed, only setSize overridden. rating k -> fameRank k, so the most famous
  // player carries the highest rating.
  const gen = generateCardSet(RATING_SEED, { ...C13V1_CONFIG.cardGen, setSize: SET_SIZE });
  const ratings = gen.map((c) => c.rating).sort((a, b) => b - a);

  // E0.5 — a printed club a player is disputed to have actually appeared for is
  // dropped from the card (the Benatia class). The membership STAYS in the canonical
  // and in the dossier as source data with its disputed-statement record; only the
  // CHIP is suppressed, so the card never asserts an appearance a human has disputed.
  const droppedChipOf = (p: Player): string | null => {
    const d = disputedByQid.get(p.qid);
    return d?.dropPrintedClub ?? null;
  };

  const tagger = buildTagger(chosen);
  const cards = chosen.map((p, i) => {
    // E0.5 — era mapping runs on eraYear (cited override where one exists, else
    // sourceStartYear). No date is printed on the card; eraIndex/eraLabel — editorial
    // buckets, not a year — are the only era signal a player sees.
    const era = eraOf(eraYearOf(p));
    const droppedChip = droppedChipOf(p);
    const clubs = p.facts.clubs
      .slice()
      .filter((c) => c.clubQid !== droppedChip)
      // Longest sourced first-team tenure first. Ties -> QID, never file order.
      .sort((a, b) => tenure(b) - tenure(a) || a.clubQid.localeCompare(b.clubQid))
      .slice(0, MAX_CLUBS_PER_CARD)
      .map((c) => { const t = tagger.get(c.clubQid)!; return { tag: t.tag, displayCode: t.code, fullName: t.name }; });
    return {
      cardId: `real_${String(i + 1).padStart(4, "0")}`,
      name: p.answerName,
      nation: natOf(p),
      position: posOf(p),
      // E0.5 — NO DATE IS A PUBLISHED FACT. debutYear is gone from the card face; the
      // sourced sourceStartYear and the eraYear that bucketed it live in the dossier.
      eraIndex: era.index,
      eraLabel: era.label,
      clubs,
      rating: ratings[i],
      fameRank: i + 1,
    };
  });

  // E0.5 — eraYear per card (cited override where present, else sourceStartYear) and
  // the bucket it maps to. Aligned with `cards`/`chosen` order for the era mapping's
  // per-bucket rollup and each entry's era block.
  const entryEraYear = chosen.map((p) => {
    const eraYear = eraYearOf(p);
    return { eraYear, eraIndex: eraOf(eraYear).index };
  });

  const dossier = {
    _doc:
      "Per-fact provenance for drawCardsReal.candidates.json. FACTS (nation, position, sourceStartYear, club membership) " +
      "are sourced from Wikidata (CC0) and carry a resolvable ref. EDITORIAL fields (rating, fameRank, which <=3 clubs " +
      "are printed, tag/displayCode/fullName, eraIndex, eraYear) are VerveQ's own and are marked as such — they are not claims " +
      "about the player. NO DATE IS A PUBLISHED FACT: the card face carries no year at all (see sourceStartYearMeaning); " +
      "sourceStartYear and eraYear live here in the dossier only. Built by scripts/buildDrawCardSet.ts, which is committed " +
      "and reproduces this file exactly.",
    setVersion: SET_VERSION,
    generatedFor: "THE DRAW",
    cardCount: cards.length,
    ratingSeed: RATING_SEED,
    configVersion: C13V1_CONFIG_VERSION,
    // E0.5 — THE FACT-MODEL REALIGNMENT. The field formerly called debutYear is
    // renamed sourceStartYear across canonical, dossier and selector, and redefined.
    sourceStartYearMeaning: {
      definition:
        "The earliest senior-club membership START per the source's P54 statements " +
        "(age >= 16, first teams only). It is NOT a competitive-debut claim and is not " +
        "published as one: the card face carries no year, and this value appears only " +
        "here as membership-start provenance.",
      whyRenamed:
        "E2.1's blind re-verify (drawCardsReal.verify2.json, committed) re-retrieved all " +
        "430 cards live and found the value systematically EARLIER than the competitive " +
        "debut: ~25% of the cards for which a qualifying non-Wikidata source was actually " +
        "retrieved were contradicted, spanning every era from Banks (1958) to Rashford " +
        "(2016). Calling it debutYear asserted a debut the source cannot support. Renaming " +
        "it to what it actually is — a membership start — makes every downstream claim true.",
      knownContaminationClasses: [
        "1. SIGNING / SQUAD-REGISTRATION year — the year a player joined the club's books, " +
          "not his first competitive minute (Owen 1995 signing vs 1997 debut; Banks 1953 " +
          "part-time youth contract vs 1958 debut; Gattuso, Romero, Otamendi).",
        "2. ACADEMY / YOUTH-INTAKE recorded on the FIRST-TEAM QID — one P54 statement starting " +
          "at the academy age but typed as the senior club, so the age filter cannot split it " +
          "(Busquets 2000 age-12 intake -> owner debut ruling; Szczesny 2006 academy vs 2009).",
        "3. RESERVE / B-TEAM season counted as first-team (Moutinho 2003/04 Sporting B vs 2005 " +
          "first-team; Benzema autumn-2004 CFA reserve side vs Jan-2005 first team).",
        "4. SPLIT-SEASON label mis-parsed to its earlier year ('2005/06' -> 2005 for Cavani, " +
          "whose Danubio debut was Apr 2006).",
        "5. FRIENDLY / non-competitive match logged as a debut (David Silva's 2003 value traces " +
          "to a Trofeo de La Magdalena friendly, not a competitive appearance).",
      ],
      note:
        "These five are why sourceStartYear is provenance, not a truth claim about a debut. " +
        "Where the contamination would put a card in the WRONG ERA, a signed cited override " +
        "supplies eraYear instead (ownerCitedOverrides); where it does not cross a bucket it " +
        "is accepted noise. printedSpells (per-club P54 spell dates) are likewise demoted to " +
        "internal identity evidence: the published club fact is membership EXISTENCE only, " +
        "never a date.",
    },
    selector: {
      script: "scripts/buildDrawCardSet.ts",
      provenance: "editorial",
      _doc:
        "E1's selector was never committed and is unrecoverable (BUILD_NOTES §11). This is a fresh implementation of " +
        "the documented rules; selection order, tier, club tags and display codes are DECLARED here, not recovered.",
      fameBackbone: "Wikidata sitelink count, descending; ties by QID ascending. EDITORIAL.",
      positionQuota: quota,
      eraFloor: ERA_FLOOR,
      maxClubsPerCard: MAX_CLUBS_PER_CARD,
      clubPick: `longest sourced first-team tenure (sum of P54 spells; open spell runs to ${PINNED_YEAR}), ties by club QID`,
      eraSwaps: swaps,
      pool: { emitted: players.length, duplicatesCollapsed: duplicates, dropped: drops, selectable: selectable.length },
    },
    eraMapping: {
      provenance: "editorial",
      _doc: [
        "A game-mechanical partition of the set into four era buckets. NOT a truth claim: no",
        "source asserts a player's era. eraIndex/eraLabel are VerveQ's own, like rating and",
        "fameRank. The only input is eraYear (per-entry), which is the cited override where one",
        "exists (ownerCitedOverrides) and the sourced sourceStartYear otherwise. Stated as a RULE,",
        "not just ranges, so the partition can be recomputed from eraYear alone and can never",
        "drift silently from the cards (asserted: drawCardSetEraContract).",
      ],
      rule: {
        input: "eraYear (per-entry; cited override where present, else sourced sourceStartYear)",
        derived: "peakYear := eraYear + 5",
        assign: "lowest eraIndex whose peakYear range contains the card peakYear; ranges are contiguous and exhaustive",
        buckets: ERA_BUCKETS.map((b) => {
          const mine = entryEraYear.filter((e) => e.eraIndex === b.index);
          const years = mine.map((e) => e.eraYear);
          return {
            eraIndex: b.index,
            eraLabel: b.label,
            peakYearMin: b.minPeak,
            peakYearMax: b.maxPeak,
            eraYearMin: b.minPeak === null ? null : b.minPeak - 5,
            eraYearMax: b.maxPeak === null ? null : b.maxPeak - 5,
            cardCount: mine.length,
            observedEraYearRange: years.length ? [Math.min(...years), Math.max(...years)] : null,
          };
        }),
      },
      derivationNote: [
        "Why +5: a card belongs to the era a player was KNOWN in, not the year they first",
        "appeared. A career start is typically followed by ~5 years before first-team prominence,",
        "so bucketing on the start year alone files late-blooming players one era earlier than",
        "fans place them. +5 is a flat editorial approximation of \"time to prominence\" —",
        "deliberately uniform, since a per-player peak would be an unsourced judgement on all cards.",
      ],
      boundaryNote: [
        "The bucket0/bucket1 boundary (peakYear<=1980) is DECLARED, not transcribed, and is",
        "LOAD-BEARING: bucket 0 sits exactly at the 40-card floor, so a single card crossing this",
        "boundary forces a floor swap. E1.2 could declare it freely when no card had eraYear 1975;",
        "that is no longer true. The choice is kept (it is the documented one, and it keeps the four",
        "peakYear ranges contiguous with no gap) and is flagged for owner review. Every other",
        "boundary is pinned by cards on both sides.",
      ],
    },
    ownerPositionRulings: rulings.rulings ?? [],
    // E0.3 — every signed override that shaped this set, in one place. A ruling never
    // edits a fact: playersSourced.json still emits the rule's answer for all of them.
    ownerNationRulings: natRulings,
    ownerDebutRulings: debutRulings,
    ownerDisputedStatements: disputed,
    // E0.5 — the cited era-year override layer, every signed record in one place.
    ownerCitedOverrides: citedOverrides,
    entries: chosen.map((p, i) => {
      const ruling = rulingByQid.get(p.qid);
      const natRuling = natRulingByQid.get(p.qid);
      const debutRuling = debutRulingByQid.get(p.qid);
      const dispute = disputedByQid.get(p.qid);
      const cited = citedOverrideByQid.get(p.qid);
      return {
        cardId: cards[i].cardId,
        name: p.answerName,
        qid: p.qid,
        fameSitelinks: sitelinks[p.qid] ?? 0,
        // E0.5 — how this card's eraIndex/eraLabel were derived. eraYear is the cited
        // override's citedValue where one exists, else the sourced sourceStartYear.
        era: {
          eraIndex: cards[i].eraIndex,
          eraLabel: cards[i].eraLabel,
          eraYear: entryEraYear[i].eraYear,
          eraYearSource: cited ? "cited-override" : "sourceStartYear",
          citedOverride: cited ?? null,
        },
        facts: {
          // E0.3 — an overridden nation reproduces the RULE'S OUTPUT verbatim beside
          // the ruling, exactly as an overridden position reproduces its sourced value.
          // A reader always sees what the rule said and that a human overruled it.
          nation: natRuling
            ? {
                value: natRuling.ruling,
                provenance: "editorial-ruled",
                ruledBy: natRulings.ruledBy ?? null,
                ruledOn: natRulings.ruledOn ?? null,
                note: natRuling.note ?? null,
                ruleOutput: natRuling.ruleOutput,
                ruleBasis: natRuling.ruleBasis ?? null,
                ...(natRuling.pendingSecondSource ? { pendingSecondSource: true } : {}),
                sourcedValue: p.facts.nation?.value ?? null,
                candidates: p.identityEvidence.nationCandidates ?? null,
                path: p.identityEvidence.nationPath ?? null,
                source: p.facts.nation?.source ?? null,
                sourceQuality: p.facts.nation?.sourceQuality ?? null,
              }
            : p.facts.nation && { ...p.facts.nation, provenance: "sourced", candidates: p.identityEvidence.nationCandidates ?? null, path: p.identityEvidence.nationPath ?? null },
          position: ruling
            ? {
                value: ruling.ruling,
                provenance: "editorial-ruled",
                ruledBy: rulings.ruledBy ?? null,
                ruledOn: rulings.ruledOn ?? null,
                note: ruling.note ?? null,
                // A ruling NEVER edits a fact: the sourced value and the raw
                // statements sit beside it so a reader always sees what Wikidata
                // said and that a human overruled it.
                sourcedValue: p.facts.position!.value,
                sourcedStatements: p.identityEvidence.positionStatements ?? null,
                candidates: p.identityEvidence.positionCandidates ?? null,
                source: p.facts.position!.source,
                sourceQuality: p.facts.position!.sourceQuality,
              }
            : { ...p.facts.position!, provenance: "sourced", statements: p.identityEvidence.positionStatements ?? null, candidates: p.identityEvidence.positionCandidates ?? null },
          // E0.5 — renamed from debutYear. Provenance for the earliest senior-club
          // membership START, explicitly NOT a debut claim (see sourceStartYearMeaning).
          // A debut ruling (Busquets) may reset the value; a cited override never does —
          // it supplies eraYear (see entry.era), leaving this sourced value intact.
          sourceStartYear: debutRuling
            ? {
                value: debutRuling.ruling,
                provenance: "editorial-ruled",
                ruledBy: debutRulings.ruledBy ?? null,
                ruledOn: debutRulings.ruledOn ?? null,
                note: debutRuling.note ?? null,
                ruleOutput: debutRuling.ruleOutput,
                ruleBasis: debutRuling.ruleBasis ?? null,
                // null here is load-bearing: the ticket asked for an independent ref
                // and none was supplied. The field is published EMPTY with its status
                // rather than filled with a plausible-looking citation.
                independentRef: debutRuling.independentRef ?? null,
                independentRefStatus: debutRuling.independentRefStatus ?? null,
                sourcedValue: p.facts.sourceStartYear!.value,
                birthYear: p.facts.birthYear?.value ?? null,
                birthYearSource: p.facts.birthYear?.source ?? null,
                source: p.facts.sourceStartYear!.source,
                sourceQuality: p.facts.sourceStartYear!.sourceQuality,
              }
            : p.facts.sourceStartYear && {
                ...p.facts.sourceStartYear,
                provenance: "sourced",
                // E0.4 — a disputed statement forces the fact it supports to amber.
                // The VALUE is untouched (Dybala's 2011 is independently confirmed
                // correct); what changes is the confidence the artifact claims, which
                // was resting on a statement a human has established is false.
                ...(dispute?.affectsFacts.includes("sourceStartYear")
                  ? { sourceQuality: dispute.cardQuality, disputedStatement: dispute }
                  : {}),
                birthYear: p.facts.birthYear?.value ?? null,
                birthYearSource: p.facts.birthYear?.source ?? null,
              },
          // E0.5 — printed reflects the card face AFTER a disputed-appearance chip drop
          // (Benatia's Marseille). The membership stays here as source data, marked with
          // its disputed-statement record, so the canonical is never edited — only the
          // chip is suppressed. spells stay as INTERNAL identity evidence; the published
          // club fact is membership EXISTENCE, never a date.
          clubs: p.facts.clubs.map((c) => ({
            value: c.value,
            clubQid: c.clubQid,
            spells: c.spells,
            source: c.source,
            sourceQuality: c.sourceQuality,
            printed: cards[i].clubs.some((x) => x.tag === tagger.get(c.clubQid)?.tag),
            ...(dispute?.dropPrintedClub === c.clubQid
              ? { disputedAppearance: true, disputedStatement: dispute, sourceQuality: dispute.cardQuality }
              : {}),
          })),
        },
        identityEvidence: p.identityEvidence,
      };
    }),
  };
  return { cards, dossier };
}

/**
 * E0.3 — the pure half of `--check`, exported so the CI guard
 * (app/src/test/drawCardSetSelectorContract.test.ts) can run it in-process
 * without a subprocess or a tsx dependency. Returns [] when the committed
 * artifacts reproduce from the rules; a list of failures otherwise.
 */
export function checkCommittedArtifacts(): string[] {
  const { cards, dossier } = build();
  const strip = (s: string) => JSON.stringify(JSON.parse(s), (k, v) => (k === "retrievedAt" ? undefined : v));
  const fails: string[] = [];
  for (const [p, got] of [
    [CARDS_PATH, JSON.stringify(cards, null, 2) + "\n"],
    [DOSSIER_PATH, JSON.stringify(dossier, null, 2) + "\n"],
  ] as const) {
    const committed = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
    if (!committed) fails.push(`${path.basename(p)} does not exist`);
    else if (strip(committed) !== strip(got)) fails.push(`${path.basename(p)} does not match a fresh build from the rules`);
  }
  return fails;
}

function main() {
  if (process.argv.includes("--check")) {
    const fails = checkCommittedArtifacts();
    if (fails.length > 0) {
      for (const f of fails) console.error(`selector --check FAILED: ${f}`);
      process.exitCode = 1;
      return;
    }
    console.log(`selector --check OK: both artifacts reproduce exactly (modulo retrievedAt)`);
    return;
  }
  const { cards, dossier } = build();
  fs.writeFileSync(CARDS_PATH, JSON.stringify(cards, null, 2) + "\n");
  fs.writeFileSync(DOSSIER_PATH, JSON.stringify(dossier, null, 2) + "\n");
  console.log(`selector DONE: ${cards.length} cards -> ${path.relative(process.cwd(), CARDS_PATH)}`);
  console.log(`               dossier -> ${path.relative(process.cwd(), DOSSIER_PATH)}`);
  console.log(`  era swaps: ${dossier.selector.eraSwaps.length}`);
}

// Only run when invoked as a script. Importing this module (the CI guard does)
// must not rebuild or rewrite the committed artifacts.
const invokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) main();
