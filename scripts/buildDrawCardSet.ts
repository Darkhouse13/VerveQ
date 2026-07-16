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
const SITELINKS_PATH = path.join(CACHE, "sitelinks.json");
const CARDS_PATH = path.join(DATA, "drawCardsReal.candidates.json");
const DOSSIER_PATH = path.join(DATA, "drawCardsReal.dossier.json");

/** Pinned so an open spell's tenure is reproducible rather than clock-dependent. */
const PINNED_YEAR = 2026;
const SET_VERSION = "real-v2";
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
  facts: { nation: Sourced<string> | null; position: Sourced<Pos> | null; debutYear: Sourced<number> | null; birthYear: Sourced<number> | null; clubs: SourcedClub[] };
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
  const drops = { noPosition: 0, noDebut: 0, noClub: 0 };
  const selectable = distinct.filter((p) => {
    if (!p.facts.position) { drops.noPosition++; return false; }
    if (!p.facts.debutYear) { drops.noDebut++; return false; }
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
// The bucket 0/1 boundary is DECLARED, not transcribed: no card has debutYear 1975,
// so peakYear<=1980 and <=1979 classify every card identically and the data cannot
// discriminate them. <=1980 is chosen so the four ranges are contiguous with no gap.
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
function select(selectable: Player[], sitelinks: Record<string, number>, posOf: (p: Player) => Pos) {
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
    const count = (i: number) => chosen.filter((c) => eraOf(c.facts.debutYear!.value).index === i).length;
    const short = ERA_BUCKETS.map((b) => b.index).find((i) => count(i) < ERA_FLOOR);
    if (short === undefined) break;
    const inSet = new Set(chosen.map((c) => c.qid));
    const cand = ranked.find((c) => !inSet.has(c.qid) && eraOf(c.facts.debutYear!.value).index === short);
    if (!cand) {
      throw new Error(
        `STOP: era bucket ${short} cannot reach the floor of ${ERA_FLOOR} — the pool is exhausted ` +
          `(${count(short)} selected, no unselected candidate left). Floors unreachable is a STOP condition, ` +
          `not something to relax.`,
      );
    }
    const pos = posOf(cand);
    const victim = [...chosen]
      .filter((c) => posOf(c) === pos && eraOf(c.facts.debutYear!.value).index !== short)
      .sort((a, b) => (sitelinks[a.qid] ?? 0) - (sitelinks[b.qid] ?? 0) || b.qid.localeCompare(a.qid))
      .find((c) => count(eraOf(c.facts.debutYear!.value).index) > ERA_FLOOR);
    if (!victim) throw new Error(`STOP: era bucket ${short} short and no droppable ${pos} outside a floor-bound era.`);
    chosen.splice(chosen.findIndex((c) => c.qid === victim.qid), 1);
    chosen.push(cand);
    swaps.push(`era${short} <- ${cand.answerName} (${pos}, fame ${sitelinks[cand.qid] ?? 0}) replaces ${victim.answerName} (era${eraOf(victim.facts.debutYear!.value).index}, fame ${sitelinks[victim.qid] ?? 0})`);
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

  // THE RULED POSITION IS THE CARD'S POSITION, so selection must run on the RULED
  // pool. Applying rulings after selection instead puts the set at ATT 147 / MID 111
  // (±4.19pp, outside the ±3pp band) — the 18 MID->ATT rulings move players across
  // buckets the quota was already balanced against. Enforcing the quota on ruled
  // positions restores 43/129/129/129 exactly, and the cards it drops are the
  // lowest-fame ATT while the cards it promotes are the highest-fame unselected MID.
  // A position ruling is therefore not cosmetic: it decides who is in the set.
  const posOf = (p: Player): Pos => rulingByQid.get(p.qid)?.ruling ?? p.facts.position!.value;

  const { selectable, drops, duplicates } = pool(players);
  const { chosen, quota, swaps } = select(selectable, sitelinks, posOf);
  if (chosen.length !== SET_SIZE) throw new Error(`STOP: selected ${chosen.length}, expected ${SET_SIZE}`);

  // Ratings are identical-by-construction to the tuned c13v1 set: the SAME generator,
  // the SAME seed, only setSize overridden. rating k -> fameRank k, so the most famous
  // player carries the highest rating.
  const gen = generateCardSet(RATING_SEED, { ...C13V1_CONFIG.cardGen, setSize: SET_SIZE });
  const ratings = gen.map((c) => c.rating).sort((a, b) => b - a);

  const tagger = buildTagger(chosen);
  const cards = chosen.map((p, i) => {
    const era = eraOf(p.facts.debutYear!.value);
    const clubs = p.facts.clubs
      .slice()
      // Longest sourced first-team tenure first. Ties -> QID, never file order.
      .sort((a, b) => tenure(b) - tenure(a) || a.clubQid.localeCompare(b.clubQid))
      .slice(0, MAX_CLUBS_PER_CARD)
      .map((c) => { const t = tagger.get(c.clubQid)!; return { tag: t.tag, displayCode: t.code, fullName: t.name }; });
    const ruling = rulingByQid.get(p.qid);
    return {
      cardId: `real_${String(i + 1).padStart(4, "0")}`,
      name: p.answerName,
      nation: p.facts.nation?.value ?? null,
      position: posOf(p),
      debutYear: p.facts.debutYear!.value,
      eraIndex: era.index,
      eraLabel: era.label,
      clubs,
      rating: ratings[i],
      fameRank: i + 1,
    };
  });

  const dossier = {
    _doc:
      "Per-fact provenance for drawCardsReal.candidates.json. FACTS (nation, position, debutYear, club membership) " +
      "are sourced from Wikidata (CC0) and carry a resolvable ref. EDITORIAL fields (rating, fameRank, which <=3 clubs " +
      "are printed, tag/displayCode/fullName, eraIndex) are VerveQ's own and are marked as such — they are not claims " +
      "about the player. Built by scripts/buildDrawCardSet.ts, which is committed and reproduces this file exactly.",
    setVersion: SET_VERSION,
    generatedFor: "THE DRAW",
    cardCount: cards.length,
    ratingSeed: RATING_SEED,
    configVersion: C13V1_CONFIG_VERSION,
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
        "fameRank. The only input is debutYear, which IS sourced — see each entry facts.debutYear.",
        "Stated as a RULE, not just ranges, so the partition can be recomputed from debutYear",
        "alone and can never drift silently from the cards (asserted: drawCardSetEraContract).",
      ],
      rule: {
        input: "debutYear (sourced; per-entry facts.debutYear)",
        derived: "peakYear := debutYear + 5",
        assign: "lowest eraIndex whose peakYear range contains the card peakYear; ranges are contiguous and exhaustive",
        buckets: ERA_BUCKETS.map((b) => {
          const mine = cards.filter((c) => c.eraIndex === b.index);
          const debuts = mine.map((c) => c.debutYear);
          return {
            eraIndex: b.index,
            eraLabel: b.label,
            peakYearMin: b.minPeak,
            peakYearMax: b.maxPeak,
            debutYearMin: b.minPeak === null ? null : b.minPeak - 5,
            debutYearMax: b.maxPeak === null ? null : b.maxPeak - 5,
            cardCount: mine.length,
            observedDebutYearRange: debuts.length ? [Math.min(...debuts), Math.max(...debuts)] : null,
          };
        }),
      },
      derivationNote: [
        "Why +5: a card belongs to the era a player was KNOWN in, not the year they first",
        "appeared. A debut is typically followed by ~5 years before first-team prominence, so",
        "bucketing on debutYear alone files late-blooming players one era earlier than fans",
        "place them. +5 is a flat editorial approximation of \"time to prominence\" — deliberately",
        "uniform, since a per-player peak would be an unsourced judgement on all 430 cards.",
      ],
      boundaryNote: [
        "The bucket0/bucket1 boundary is DECLARED, not transcribed. No card has debutYear 1975",
        "(peakYear 1980), so peakYear<=1980 and peakYear<=1979 classify every card identically and",
        "the data cannot discriminate them. peakYear<=1980 -> bucket 0 is a forward-binding choice,",
        "made so the four peakYear ranges are contiguous with no gap. Every other boundary is",
        "pinned by cards on both sides. E0.2 note: a selector now EXISTS (scripts/buildDrawCardSet.ts),",
        "so this boundary is code rather than prose — but it is still a declaration, not a recovery.",
      ],
    },
    ownerPositionRulings: rulings.rulings ?? [],
    entries: chosen.map((p, i) => {
      const ruling = rulingByQid.get(p.qid);
      return {
        cardId: cards[i].cardId,
        name: p.answerName,
        qid: p.qid,
        fameSitelinks: sitelinks[p.qid] ?? 0,
        facts: {
          nation: p.facts.nation && { ...p.facts.nation, candidates: p.identityEvidence.nationCandidates ?? null, path: p.identityEvidence.nationPath ?? null },
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
          debutYear: p.facts.debutYear && { ...p.facts.debutYear, birthYear: p.facts.birthYear?.value ?? null, birthYearSource: p.facts.birthYear?.source ?? null },
          clubs: p.facts.clubs.map((c) => ({ value: c.value, clubQid: c.clubQid, spells: c.spells, source: c.source, sourceQuality: c.sourceQuality, printed: cards[i].clubs.some((x) => x.tag === tagger.get(c.clubQid)?.tag) })),
        },
        identityEvidence: p.identityEvidence,
      };
    }),
  };
  return { cards, dossier };
}

function main() {
  const check = process.argv.includes("--check");
  const { cards, dossier } = build();
  const cardsJson = JSON.stringify(cards, null, 2) + "\n";
  const dossierJson = JSON.stringify(dossier, null, 2) + "\n";
  if (check) {
    const strip = (s: string) => JSON.stringify(JSON.parse(s), (k, v) => (k === "retrievedAt" ? undefined : v));
    let ok = true;
    for (const [p, got] of [[CARDS_PATH, cardsJson], [DOSSIER_PATH, dossierJson]] as const) {
      const committed = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
      if (strip(committed || "null") !== strip(got)) { console.error(`selector --check FAILED: ${path.basename(p)} does not match a fresh build`); ok = false; }
    }
    if (!ok) { process.exitCode = 1; return; }
    console.log(`selector --check OK: both artifacts reproduce exactly (${cards.length} cards, modulo retrievedAt)`);
    return;
  }
  fs.writeFileSync(CARDS_PATH, cardsJson);
  fs.writeFileSync(DOSSIER_PATH, dossierJson);
  console.log(`selector DONE: ${cards.length} cards -> ${path.relative(process.cwd(), CARDS_PATH)}`);
  console.log(`               dossier -> ${path.relative(process.cwd(), DOSSIER_PATH)}`);
  console.log(`  era swaps: ${dossier.selector.eraSwaps.length}`);
}
main();
