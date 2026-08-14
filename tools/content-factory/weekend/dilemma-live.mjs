// DILEMMA-B1 live fact gate. Pulls the prod market — the price/fixture
// authority for content work, never memory, never career_paths.json — and
// re-verifies EVERY fact the two dilemma reels put on screen. Any drift
// THROWS, so a stale or wrong price cannot reach a rendered frame: a wrong
// price under "no right answer" branding is a credibility wound, which is
// exactly what this file exists to make impossible.
//
//   node weekend/dilemma-live.mjs          # verify both editions
//   node weekend/dilemma-live.mjs d1       # verify one
//
// Checked per edition:
//   1. gameweek still matches the fact base
//   2. each named player resolves to exactly ONE board row (name + club), and
//      his price / position / opponent / venue / kickoff all still match
//   3. SELECTABILITY — every named player HAS a fixture. Budget-mode WEEKEND
//      squads server-reject a fixtureless pick (app/convex/fantasySquads.ts:422),
//      so a dilemma naming one would be offering a move the product forbids.
//   4. NEUTRALITY — each side's prices sum to its stated total, and both
//      sides equal the stake. Unequal sides are not a trade.
//   5. per-club cap — no side may need more than PER_CLUB_CAP (3) of a club
//   6. any on-screen superlative (`claim`) is still literally true and still
//      uniquely held
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "dilemma-facts.json"), "utf8"));
const PROD = "https://different-lynx-153.convex.cloud/api/query";
const PER_CLUB_CAP = 3; // app/convex/lib/fantasyConstants.ts:91

const near = (a, b) => Math.abs(a - b) < 1e-9;

export const fetchMarket = async () => {
  const res = await fetch(PROD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "fantasyMarket:getMarket", args: {}, format: "json" }),
  });
  if (!res.ok) throw new Error(`prod getMarket ${res.status}`);
  const body = await res.json();
  if (body.status !== "success") throw new Error(`prod getMarket: ${JSON.stringify(body).slice(0, 200)}`);
  return body.value;
};

export const verifyDilemmaFacts = async (only = []) => {
  const m = await fetchMarket();
  const editions = only.length > 0 ? FACTS.editions.filter((e) => only.includes(e.id) || only.includes(e.slug)) : FACTS.editions;
  if (editions.length === 0) throw new Error(`dilemma-live: no edition matches ${only.join(", ")}`);

  const fail = [];
  if (m.gwNumber !== FACTS.gw) fail.push(`gameweek moved: board GW${m.gwNumber}, facts say GW${FACTS.gw}`);

  // the pickable pool: budget mode can only take a player who has a fixture
  const pickable = m.players.filter((p) => p.kickoffAt);

  for (const ed of editions) {
    const tag = ed.slug;
    const clubCount = new Map();

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
        // 3 — selectability. A fixtureless player is not offerable at all.
        if (p.kickoffAt === null) {
          fail.push(`${tag} ${side.key} ${pl.display}: NO FIXTURE this gameweek — budget mode rejects the pick, so he cannot be one side of a dilemma`);
        } else {
          if (p.kickoffAt !== Date.parse(pl.atIso)) fail.push(`${tag} ${side.key} ${pl.display}: kickoff moved — board ${new Date(p.kickoffAt).toISOString()}, reel ${pl.atIso}`);
          if (p.opponentName !== pl.opponent) fail.push(`${tag} ${side.key} ${pl.display}: opponent is ${p.opponentName}, reel says ${pl.opponent}`);
          if (p.isHome !== pl.isHome) fail.push(`${tag} ${side.key} ${pl.display}: venue flipped — board isHome=${p.isHome}, reel says ${pl.isHome}`);
        }
        sum += pl.price;
        clubCount.set(pl.club, (clubCount.get(pl.club) ?? 0) + 1);
      }
      // 4 — neutrality
      if (!near(sum, side.total)) fail.push(`${tag} ${side.key}: prices sum to ${sum}, side claims ${side.total}`);
      if (!near(side.total, ed.stake)) fail.push(`${tag} ${side.key}: total ${side.total} ≠ stake ${ed.stake} — the two sides must cost the same`);
    }

    // 5 — per-club cap
    for (const [club, n] of clubCount) {
      if (n > PER_CLUB_CAP) fail.push(`${tag}: ${n} players from ${club} exceeds the per-club cap of ${PER_CLUB_CAP}`);
    }

    // 6 — on-screen superlatives
    if (ed.claim?.kind === "maxPricedWithFixture") {
      const max = Math.max(...pickable.map((p) => p.price));
      const atMax = pickable.filter((p) => p.price === max);
      if (!near(max, ed.stake)) fail.push(`${tag}: claim "${ed.claim.tag}" — the dearest player with a fixture is now ${max}, not ${ed.stake}`);
      else if (atMax.length !== 1) fail.push(`${tag}: claim "${ed.claim.tag}" — ${atMax.length} players now tie at ${max} (${atMax.map((p) => p.name).join(", ")}); the superlative is no longer unique`);
      else if (atMax[0].name !== ed.claim.board) fail.push(`${tag}: claim "${ed.claim.tag}" — the dearest player with a fixture is now ${atMax[0].name}, not ${ed.claim.board}`);
    }
  }

  if (fail.length > 0) {
    throw new Error(`dilemma-live: FACT DRIFT — fix dilemma-facts.json (and the copy that quotes it) before rendering:\n  ` + fail.join("\n  "));
  }

  for (const ed of editions) {
    const sides = ed.sides.map((s) => `${s.key} ${s.players.map((p) => `${p.display} ${p.price.toFixed(1)}`).join(" + ")}`).join("  vs  ");
    console.log(`dilemma-live: ${ed.slug} VERIFIED on prod · GW${m.gwNumber} · ${ed.stake.toFixed(1)} each · ${sides}`);
  }
  return editions;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyDilemmaFacts(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
