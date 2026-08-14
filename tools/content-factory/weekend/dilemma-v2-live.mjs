// DILEMMA-WEEKLY v2 live fact gate — everything weekend/dilemma-live.mjs
// asserts, plus the three obligations MONID-SWEEP-2 added, all recomputed
// against the prod board on EVERY render so nothing uncitable can reach a
// frame (the ticket's STOP conditions, made structural):
//
//   node weekend/dilemma-v2-live.mjs            # verify all v2 editions
//   node weekend/dilemma-v2-live.mjs dS         # verify one (id or slug)
//
// Per edition, on top of the v1 checks (unique board row, price/position/
// fixture/venue/kickoff drift, selectability, neutrality, per-club cap):
//   7. DEADLINE — deadlineDay must equal the UTC day tag of the EARLIEST
//      kickoff among the edition's named players (the moment the first of
//      them locks, the choice is gone), and deadlineWord must appear in the
//      on-screen question, in the caption lead, and — once voiced — in the
//      spoken question line (vo.json). Day words only; a clock time on screen
//      would be a timezone claim and fails the review, not this gate.
//   8. RECEIPTS — every side carries exactly ONE receipt row and this gate
//      REBUILDS its text from the live board; a receipt that cannot be
//      recomputed (unknown kind, broken claim) throws. lastGwPoints is
//      permitted by the ticket from Thu 2026-08-21 but stays unimplemented
//      until prod exposes a settlement query — so proposing it today throws,
//      which is the correct STOP.
//   9. proof: true editions render for MECHANISM PROOF ONLY (cached VO under
//      a reused cue key): board checks all still bind, the spoken-line check
//      is skipped, and the gate shouts NOT FOR POSTING.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { fetchMarket } from "./dilemma-live.mjs";
import { buildWeekendCaption } from "./captions.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "dilemma-v2-facts.json"), "utf8"));
const VO = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "vo.json"), "utf8"));
const PER_CLUB_CAP = 3; // app/convex/lib/fantasyConstants.ts:91

const near = (a, b) => Math.abs(a - b) < 1e-9;
const DAY_TAGS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const dayTag = (ms) => DAY_TAGS[new Date(ms).getUTCDay()];

// receipt kinds — each returns the ONE text the board supports right now, or
// throws. A tag mismatch is fact drift exactly like a moved price.
const RECEIPT_KINDS = {
  clubDearest: (side, pickable) => {
    if (side.players.length !== 1) throw new Error(`clubDearest wants a 1-player side, got ${side.players.length}`);
    const pl = side.players[0];
    const clubmates = pickable.filter((p) => p.clubName === pl.club);
    const max = Math.max(...clubmates.map((p) => p.price));
    const atMax = clubmates.filter((p) => p.price === max);
    if (!(near(max, pl.price) && atMax.length === 1 && atMax[0].name === pl.board)) {
      throw new Error(`clubDearest no longer true for ${pl.board}: ${pl.club}'s dearest pickable is ${atMax.map((p) => `${p.name} ${p.price}`).join(", ")}`);
    }
    return `${pl.chip}'S DEAREST PLAYER`;
  },
  costMoreCount: (side, pickable) => {
    if (side.players.length !== 1) throw new Error(`costMoreCount wants a 1-player side, got ${side.players.length}`);
    const pl = side.players[0];
    const n = pickable.filter((p) => p.price > pl.price).length;
    return `ONLY ${n} COST MORE`;
  },
};

export const verifyDilemmaV2Facts = async (only = []) => {
  const m = await fetchMarket();
  // proof editions verify only when named explicitly — they are pinned to the
  // gameweek they proved the mechanism on and would fail (correctly) forever
  // after it closes, which must not block a no-arg run of the live editions.
  const editions = only.length > 0 ? FACTS.editions.filter((e) => only.includes(e.id) || only.includes(e.slug)) : FACTS.editions.filter((e) => !e.proof);
  if (editions.length === 0) throw new Error(`dilemma-v2-live: no edition matches ${only.join(", ")} (proof editions must be named explicitly)`);

  const fail = [];
  if (m.gwNumber !== FACTS.gw) fail.push(`gameweek moved: board GW${m.gwNumber}, facts say GW${FACTS.gw}`);
  const pickable = m.players.filter((p) => p.kickoffAt);

  for (const ed of editions) {
    const tag = ed.slug;
    const clubCount = new Map();
    let earliest = Infinity;

    for (const side of ed.sides) {
      let sum = 0;
      for (const pl of side.players) {
        const hits = m.players.filter((p) => p.name === pl.board && p.clubName === pl.club);
        if (hits.length !== 1) {
          fail.push(`${tag} ${side.key}: "${pl.board}" (${pl.club}) matches ${hits.length} board rows, need exactly 1`);
          continue;
        }
        const p = hits[0];
        if (!near(p.price, pl.price)) fail.push(`${tag} ${side.key} ${pl.display}: board price ${p.price}, reel says ${pl.price}`);
        if (p.position !== pl.pos) fail.push(`${tag} ${side.key} ${pl.display}: board position ${p.position}, reel says ${pl.pos}`);
        if (p.kickoffAt === null) {
          fail.push(`${tag} ${side.key} ${pl.display}: NO FIXTURE this gameweek — budget mode rejects the pick`);
        } else {
          if (p.kickoffAt !== Date.parse(pl.atIso)) fail.push(`${tag} ${side.key} ${pl.display}: kickoff moved — board ${new Date(p.kickoffAt).toISOString()}, reel ${pl.atIso}`);
          if (p.opponentName !== pl.opponent) fail.push(`${tag} ${side.key} ${pl.display}: opponent is ${p.opponentName}, reel says ${pl.opponent}`);
          if (p.isHome !== pl.isHome) fail.push(`${tag} ${side.key} ${pl.display}: venue flipped — board isHome=${p.isHome}, reel says ${pl.isHome}`);
          if (dayTag(p.kickoffAt) !== pl.day) fail.push(`${tag} ${side.key} ${pl.display}: day tag is ${dayTag(p.kickoffAt)}, reel says ${pl.day}`);
          earliest = Math.min(earliest, p.kickoffAt);
        }
        sum += pl.price;
        clubCount.set(pl.club, (clubCount.get(pl.club) ?? 0) + 1);
      }
      if (!near(sum, side.total)) fail.push(`${tag} ${side.key}: prices sum to ${sum}, side claims ${side.total}`);
      if (!near(side.total, ed.stake)) fail.push(`${tag} ${side.key}: total ${side.total} ≠ stake ${ed.stake}`);

      // 8 — the receipt row, recomputed from the board
      if (!side.receipt || !side.receipt.kind || !side.receipt.tag) {
        fail.push(`${tag} ${side.key}: v2 requires exactly one receipt row per side`);
      } else {
        const kindFn = RECEIPT_KINDS[side.receipt.kind];
        if (!kindFn) {
          fail.push(`${tag} ${side.key}: receipt kind "${side.receipt.kind}" is not implemented — an uncitable receipt is the ticket's STOP`);
        } else {
          try {
            const expected = kindFn(side, pickable);
            if (expected !== side.receipt.tag) fail.push(`${tag} ${side.key}: receipt drifted — board supports "${expected}", reel says "${side.receipt.tag}"`);
          } catch (e) {
            fail.push(`${tag} ${side.key}: ${e.message}`);
          }
        }
      }
    }

    for (const [club, n] of clubCount) {
      if (n > PER_CLUB_CAP) fail.push(`${tag}: ${n} players from ${club} exceeds the per-club cap of ${PER_CLUB_CAP}`);
    }

    // 7 — the deadline, bound to the earliest lock among the named players
    if (Number.isFinite(earliest)) {
      const expect = dayTag(earliest);
      if (ed.deadlineDay !== expect) fail.push(`${tag}: deadlineDay ${ed.deadlineDay} but the earliest named lock is ${expect} (${new Date(earliest).toISOString()})`);
    }
    const word = (ed.deadlineWord ?? "").toLowerCase();
    if (!word) {
      fail.push(`${tag}: no deadlineWord — the deadline belongs in the question and the caption lead`);
    } else {
      if (!ed.question.join(" ").toLowerCase().includes(word)) fail.push(`${tag}: on-screen question does not carry the deadline ("${ed.deadlineWord}")`);
      const caption = buildWeekendCaption(ed.slug);
      if (!caption.split("\n").slice(0, 3).join(" ").toLowerCase().includes(word)) fail.push(`${tag}: caption lead does not carry the deadline ("${ed.deadlineWord}")`);
      const spoken = VO.lines.find((l) => l.key === ed.qKey);
      if (ed.proof) {
        // mechanism proof: the reused cached take predates the amended register
      } else if (!spoken) {
        console.log(`dilemma-v2-live: NOTE — ${tag}'s question (${ed.qKey}) is not voiced yet; the deadline-in-VO check binds on the next render after reels-vo runs`);
      } else if (!spoken.text.toLowerCase().includes(word)) {
        fail.push(`${tag}: spoken question "${spoken.text}" does not carry the deadline ("${ed.deadlineWord}")`);
      }
    }
  }

  if (fail.length > 0) {
    throw new Error(`dilemma-v2-live: FACT DRIFT — fix dilemma-v2-facts.json (and the copy that quotes it) before rendering:\n  ` + fail.join("\n  "));
  }

  for (const ed of editions) {
    const sides = ed.sides.map((s) => `${s.key} ${s.players.map((p) => `${p.display} ${p.price.toFixed(1)}`).join(" + ")} [${s.receipt.tag}]`).join("  vs  ");
    console.log(`dilemma-v2-live: ${ed.slug} VERIFIED on prod · GW${m.gwNumber} · ${ed.stake.toFixed(1)} each · deadline ${ed.deadlineDay} · ${sides}`);
    if (ed.proof) console.log(`dilemma-v2-live: *** ${ed.slug} is a MECHANISM PROOF — NOT FOR POSTING (reused cached take under "${ed.qKey}") ***`);
  }
  return editions;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDilemmaV2Facts(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
