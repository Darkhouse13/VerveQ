// CF-42H live gate + countdown stamp. Pulls the prod market (the price/
// fixture authority — never memory), re-verifies EVERY fact the boost reel
// shows (13 squad prices, 6 fixture cards, the asleep-league claim, the
// 36-game count, the first-kickoff pairing) and writes the volatile countdown
// numbers to src/weekend/reels/boost-live.json. Any drift THROWS — a stale
// render cannot happen silently. Run standalone or via render-42h.mjs:
//
//   node weekend/boost-live.mjs        # verify + restamp countdown
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const FACTS = JSON.parse(readFileSync(path.join(dir, "..", "src", "weekend", "reels", "boost-facts.json"), "utf8"));
const LIVE = path.join(dir, "..", "src", "weekend", "reels", "boost-live.json");
const PROD = "https://different-lynx-153.convex.cloud/api/query";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export const hoursWord = (n) => {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return o === 0 ? TENS[t] : `${TENS[t]}-${ONES[o]}`;
};

export const refreshBoostLive = async () => {
  const res = await fetch(PROD, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "fantasyMarket:getMarket", args: {}, format: "json" }),
  });
  if (!res.ok) throw new Error(`prod getMarket ${res.status}`);
  const body = await res.json();
  if (body.status !== "success") throw new Error(`prod getMarket: ${JSON.stringify(body).slice(0, 200)}`);
  const m = body.value;

  const fail = [];
  if (m.gwNumber !== FACTS.gw) fail.push(`gameweek moved: board GW${m.gwNumber}, reel says GW${FACTS.gw}`);

  // squad: every name/club/price must match, uniquely
  for (const s of FACTS.squad) {
    const hits = m.players.filter((p) => p.name === s.name && p.clubName.includes(s.club));
    if (hits.length !== 1) fail.push(`squad ${s.name} (${s.club}): ${hits.length} matches`);
    else if (hits[0].price !== s.price) fail.push(`squad ${s.name}: board ${hits[0].price}, reel ${s.price}`);
    else if (hits[0].position !== s.pos) fail.push(`squad ${s.name}: board pos ${hits[0].position}, reel ${s.pos}`);
  }
  const sum = FACTS.squad.reduce((a, s) => a + s.price, 0);
  if (Math.abs(sum - FACTS.budget) > 1e-9) fail.push(`squad sums to ${sum}, not ${FACTS.budget}`);

  // fixtures: each card's pairing + kickoff must still be on the board
  const fixtures = new Map();
  for (const p of m.players) {
    if (!p.kickoffAt || !p.isHome) continue;
    fixtures.set(`${p.clubName}|${p.opponentName}|${p.kickoffAt}`, p.leagueId);
  }
  for (const c of FACTS.cards) {
    const at = Date.parse(c.atIso);
    if (!fixtures.has(`${c.homeFull}|${c.awayFull}|${at}`)) fail.push(`card ${c.home}–${c.away}: not on the board at ${c.atIso}`);
  }
  if (fixtures.size !== FACTS.fixtureCount) fail.push(`fixture count: board ${fixtures.size}, reel says ${FACTS.fixtureCount}`);

  // "the big leagues are asleep" must stay literally true
  const activeLeagues = new Set(m.players.filter((p) => p.kickoffAt).map((p) => p.leagueId));
  for (const lg of FACTS.asleepLeagueIds) if (activeLeagues.has(lg)) fail.push(`asleep league ${lg} has fixtures — the contrarian turn is now false`);
  if (activeLeagues.size !== FACTS.activeLeagueCount) fail.push(`active leagues: ${activeLeagues.size}, reel says ${FACTS.activeLeagueCount}`);

  // the squeeze's 4.5 alternative must exist in numbers
  const alt = m.players.filter((p) => p.price === FACTS.squeezeAlt.price).length;
  if (alt < FACTS.squeezeAlt.count) fail.push(`only ${alt} players at ${FACTS.squeezeAlt.price}`);

  // first kickoff: the earliest fixture on the board must be the named one
  const earliest = Math.min(...[...fixtures.keys()].map((k) => Number(k.split("|")[2])));
  const fkAt = Date.parse(FACTS.firstKickoff.atIso);
  if (earliest !== fkAt) fail.push(`first kickoff moved: board ${new Date(earliest).toISOString()}, reel ${FACTS.firstKickoff.atIso}`);
  if (!fixtures.has(`${FACTS.firstKickoff.home}|${FACTS.firstKickoff.away}|${fkAt}`)) fail.push(`first-kickoff pairing ${FACTS.firstKickoff.home} v ${FACTS.firstKickoff.away} not on the board`);

  if (fail.length > 0) throw new Error(`boost-live: FACT DRIFT — fix boost-facts.json + composition before rendering:\n  ` + fail.join("\n  "));

  // countdown stamp: what frame 0 shows, truthful at render time
  const now = Date.now();
  const secondsToKickoff = Math.max(0, Math.round((fkAt - now) / 1000));
  if (secondsToKickoff === 0) throw new Error("boost-live: kickoff has passed — this reel is over");
  const hours = Math.round(secondsToKickoff / 3600);
  if (hours < 1) throw new Error("boost-live: under 30 minutes to kickoff — the spoken hours line no longer works");
  const live = {
    _comment: "GENERATED by weekend/boost-live.mjs — do not hand-edit. secondsAtFrame0 is what the on-screen countdown shows at frame 0; truthful at render time, so POST WITHIN 15 MINUTES of rendering or re-run the one command.",
    generatedAtIso: new Date(now).toISOString(),
    kickoffAtIso: FACTS.firstKickoff.atIso,
    secondsAtFrame0: secondsToKickoff,
    hoursNum: hours,
    hoursWord: hoursWord(hours),
  };
  writeFileSync(LIVE, JSON.stringify(live, null, 1) + "\n");
  console.log(`boost-live: ALL FACTS VERIFIED on prod · ${secondsToKickoff}s (${hours}h, "${live.hoursWord}") to ${FACTS.firstKickoff.home} v ${FACTS.firstKickoff.away}`);
  return live;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  refreshBoostLive().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
