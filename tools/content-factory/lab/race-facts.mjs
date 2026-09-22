// BALLON D'OR BY CLUB — fact gate (double source). Every year on screen is
// the agreement of two independently maintained datasets:
//
//   (1) English Wikipedia, "Ballon d'Or" → the winners table (1st-place row
//       per year: player link + team link). Cached raw to
//       lab/race-wikipedia-cache.json.
//   (2) Wikidata: Q166177 (Ballon d'Or) → P1346 "winner" statements with
//       P585 point-in-time qualifiers give the winner per year; the CLUB is
//       derived independently from the winner's own P54 (member of sports
//       team) spells, P580/P582 dated, national teams excluded — the club
//       whose spell contains the award date. Cached raw to
//       lab/race-wikidata-cache.json.
//
// A year passes only if both sources name the same winner (QID-resolved via
// Wikipedia's sitelink) AND the same club (canonical English name). Any
// disagreement exits non-zero unless a RULING below covers it — a ruling is
// written down after reading both sources, never to make the gate green.
//
// Attribution law (brief + Wikipedia's own "Wins by club" table): an award
// counts to the club the winner played for WHEN THE AWARD WAS GIVEN. That is
// why 2021 Messi is Paris Saint-Germain and 2023 Messi is Inter Miami.
//
//   node lab/race-facts.mjs            # fetch (if no cache), gate, write facts
//   node lab/race-facts.mjs --refresh  # re-fetch both sources
//   node lab/race-facts.mjs --check    # offline: gate from cache + assert facts.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const WP_CACHE = path.join(dir, "race-wikipedia-cache.json");
const WD_CACHE = path.join(dir, "race-wikidata-cache.json");
const OUT = path.join(dir, "..", "src", "lab", "race", "facts.json");
const UA = "VerveQ-content-factory/1.0 (https://verveq.com; Ballon d'Or fact gate)";
const FIRST = 1956;
const LAST = 2025;
const NOT_AWARDED = new Set([2020]);

// Award (announcement) dates — only matter when a winner changed club inside
// the award year; they place the award on the right side of the move. Years
// not listed default to Dec 1 of the year; 2010–2015 (FIFA Ballon d'Or) were
// announced in January of the following year.
const AWARD_DATE = {
  1956: "1956-12-18",
  1973: "1973-12-27",
  1997: "1997-12-23",
  2000: "2000-12-19",
  2002: "2002-12-23",
  2021: "2021-11-29",
  2022: "2022-10-17",
  2023: "2023-10-30",
  2024: "2024-10-28",
  2025: "2025-09-22",
};
const awardDate = (y) => AWARD_DATE[y] ?? (y >= 2010 && y <= 2015 ? `${y + 1}-01-10` : `${y}-12-01`);

// canonical English club names — keyed by Wikipedia link target and by
// Wikidata QID. An unmapped club fails the gate (so a new winner can't slip
// through with a raw label).
const CLUB_BY_WP = {
  "Blackpool F.C.": "Blackpool",
  "Real Madrid CF": "Real Madrid",
  "FC Barcelona": "Barcelona",
  "Juventus FC": "Juventus",
  "Juventus F.C.": "Juventus",
  "AC Milan": "AC Milan",
  "Inter Milan": "Inter",
  "FC Bayern Munich": "Bayern Munich",
  "Manchester United F.C.": "Manchester United",
  "Manchester City F.C.": "Manchester City",
  "Paris Saint-Germain F.C.": "Paris Saint-Germain",
  "AFC Ajax": "Ajax",
  "S.L. Benfica": "Benfica",
  "Dukla Prague": "Dukla Prague",
  "FC Dynamo Moscow": "Dynamo Moscow",
  "FC Dynamo Kyiv": "Dynamo Kyiv",
  "Ferencvárosi TC": "Ferencváros",
  "Hamburger SV": "Hamburger SV",
  "Borussia Mönchengladbach": "Borussia Mönchengladbach",
  "Borussia Dortmund": "Borussia Dortmund",
  "Liverpool F.C.": "Liverpool",
  "Olympique de Marseille": "Marseille",
  "Inter Miami CF": "Inter Miami",
};

// Winner display names for the ticker — Wikipedia's link text, except the
// Brazilian Ronaldo, disambiguated from Cristiano on screen.
const SHOW_OVERRIDE = { "Ronaldo (Brazilian footballer)": "Ronaldo Nazário" };

// RULINGS — disagreements resolved by reading both sources. Key: year.
// Each states what each source says and which way it goes.
const RULINGS = {
  // filled in as the gate surfaces disagreements (see the bottom of this file
  // for the ledger printed on every run)
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJSON = async (url) => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      await sleep(2500 * (attempt + 1));
    }
  }
  throw new Error(`gave up on ${url}`);
};

// ── source 1: Wikipedia ────────────────────────────────────────────────
const fetchWikipedia = async () => {
  const url = "https://en.wikipedia.org/w/api.php?action=parse&page=Ballon_d%27Or&prop=wikitext|revid&format=json&formatversion=2";
  const j = await getJSON(url);
  const t = j.parse.wikitext;
  const a = t.indexOf("== Winners ==");
  const b = t.indexOf("== Wins by player ==");
  if (a < 0 || b < 0) throw new Error("wikipedia: winners section not found");
  return { url, revid: j.parse.revid, fetched: new Date().toISOString(), winnersWikitext: t.slice(a, b), winsByClubWikitext: t.slice(t.indexOf("== Wins by club =="), t.indexOf("== Additional awards ==")) };
};

const linkOf = (cell) => {
  const m = cell.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  return m ? { target: m[1].trim(), text: (m[2] ?? m[1]).trim() } : null;
};

const parseWikipedia = (wp) => {
  const lines = wp.winnersWikitext.split("\n");
  const out = {};
  let year = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const ym = l.match(/^\|align="center"[^|]*\|'''(?:\[\[[^\]|]+\|)?(?:\{\{gray\|)?(\d{4})/);
    if (ym) {
      year = Number(ym[1]);
      if (/Not awarded/i.test(lines[i + 1] ?? "")) out[year] = { awarded: false };
      continue;
    }
    if (year && year <= LAST && /background-color:gold/.test(l)) {
      const player = linkOf(lines[i + 1]);
      const team = linkOf(lines[i + 2]);
      if (!player || !team) throw new Error(`wikipedia: cannot parse 1st row for ${year}`);
      out[year] = { awarded: true, playerTarget: player.target, playerText: player.text, teamTarget: team.target, teamText: team.text };
    }
  }
  return out;
};

// Wikipedia link targets → Wikidata QIDs, following redirects (e.g. the
// table links "Rodri (footballer, born 1996)", a redirect to "Rodri"). This
// is how identities are compared: QID to QID, never label to label.
const resolveTargets = async (targets) => {
  const out = {};
  for (let i = 0; i < targets.length; i += 50) {
    const chunk = targets.slice(i, i + 50);
    const j = await getJSON(`https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: "query", titles: chunk.join("|"), redirects: "1", prop: "pageprops", ppprop: "wikibase_item", format: "json", formatversion: "2" })}`);
    const norm = Object.fromEntries((j.query.normalized ?? []).map((n) => [n.from, n.to]));
    const redir = Object.fromEntries((j.query.redirects ?? []).map((n) => [n.from, n.to]));
    const byTitle = Object.fromEntries(j.query.pages.map((pg) => [pg.title, pg.pageprops?.wikibase_item ?? null]));
    for (const t of chunk) {
      const n = norm[t] ?? t;
      out[t] = byTitle[redir[n] ?? n] ?? null;
    }
    await sleep(500);
  }
  return out;
};

// P166 (award received) = Q166177 on the players themselves, with P585 —
// the fallback for a year Q166177's own P1346 list has not caught up with.
const fetchP166 = async () => {
  const q = "SELECT ?p ?t WHERE { ?p p:P166 ?st . ?st ps:P166 wd:Q166177 ; pq:P585 ?t . }";
  const j = await getJSON(`https://query.wikidata.org/sparql?${new URLSearchParams({ query: q, format: "json" })}`);
  return j.results.bindings.map((b) => ({ qid: b.p.value.split("/").pop(), year: Number(b.t.value.slice(0, 4)) }));
};

// ── source 2: Wikidata ────────────────────────────────────────────────
const wbget = async (ids, props) => {
  const res = {};
  for (let i = 0; i < ids.length; i += 45) {
    const chunk = ids.slice(i, i + 45);
    const j = await getJSON(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: "wbgetentities", ids: chunk.join("|"), props, languages: "en", sitefilter: "enwiki", format: "json" })}`);
    Object.assign(res, j.entities);
    await sleep(800);
  }
  return res;
};

const tv = (snak) => (snak?.snaktype === "value" ? snak.datavalue.value : null);

const fetchWikidata = async () => {
  const bo = await wbget(["Q166177"], "claims");
  const winners = []; // {year, qid}
  for (const st of bo.Q166177.claims.P1346 ?? []) {
    if (st.rank === "deprecated") continue;
    const qid = tv(st.mainsnak)?.id;
    for (const q of st.qualifiers?.P585 ?? []) {
      const v = tv(q);
      if (v) winners.push({ year: Number(v.time.slice(1, 5)), qid, precision: v.precision });
    }
  }
  const playerIds = [...new Set(winners.map((w) => w.qid))];
  const players = await wbget(playerIds, "labels|claims|sitelinks");
  const spells = {};
  const teamIds = new Set();
  for (const id of playerIds) {
    const p = players[id];
    spells[id] = {
      label: p.labels?.en?.value,
      enwiki: p.sitelinks?.enwiki?.title ?? null,
      P54: (p.claims.P54 ?? [])
        .filter((s) => s.rank !== "deprecated" && tv(s.mainsnak))
        .map((s) => {
          const team = tv(s.mainsnak).id;
          teamIds.add(team);
          const d = (p) => {
            const v = tv(s.qualifiers?.[p]?.[0]);
            return v ? { time: v.time, precision: v.precision } : null;
          };
          return { team, start: d("P580"), end: d("P582"), loan: Boolean(s.qualifiers?.P1642) };
        }),
    };
  }
  const teamsRaw = await wbget([...teamIds], "labels|claims|sitelinks");
  const teams = {};
  for (const id of teamIds) {
    const t = teamsRaw[id];
    teams[id] = { label: t.labels?.en?.value, enwiki: t.sitelinks?.enwiki?.title ?? null, P31: (t.claims?.P31 ?? []).map((s) => tv(s.mainsnak)?.id).filter(Boolean) };
  }
  return { source: "https://www.wikidata.org/wiki/Q166177 (P1346 + P585) · winners' P54 spells", fetched: new Date().toISOString(), winners, players: spells, teams };
};

// national teams (senior/youth/olympic) are not clubs
const NATIONAL = new Set(["Q6979593", "Q1194951", "Q20738811", "Q23905105", "Q23847779", "Q23904673", "Q23901137", "Q23904672", "Q23901123"]);
const isNational = (t) => t.P31.some((c) => NATIONAL.has(c)) || /national .*team/i.test(t.label ?? "") || /national .*team/i.test(t.enwiki ?? "");

// a spell's date range as [earliest, latest] bounds given precision
const bounds = (d, isEnd) => {
  if (!d) return isEnd ? ["9999-12-31", "9999-12-31"] : ["0000-01-01", "0000-01-01"];
  const y = d.time.slice(1, 5);
  const m = d.time.slice(6, 8);
  if (d.precision >= 11) return [d.time.slice(1, 11), d.time.slice(1, 11)];
  if (d.precision === 10) return [`${y}-${m}-01`, `${y}-${m}-31`];
  return [`${y}-01-01`, `${y}-12-31`];
};

const clubAt = (wd, qid, date) => {
  const p = wd.players[qid];
  const clubs = p.P54.filter((s) => !isNational(wd.teams[s.team]));
  const definite = [];
  const possible = [];
  for (const s of clubs) {
    const [s0, s1] = bounds(s.start, false);
    const [e0, e1] = bounds(s.end, true);
    if ((s.start || s.end) && s1 <= date && date < e0) definite.push(s);
    else if (s0 <= date && date <= e1) possible.push(s);
  }
  let pick = definite.length === 1 ? definite[0] : definite.length === 0 && possible.length === 1 ? possible[0] : null;
  let tiebreak = false;
  // LATE-YEAR TIE-BREAK (documented rule, not a per-year ruling): Wikidata
  // often dates spells to the year only, so a winner who changed club inside
  // the award year matches two spells — one ENDING in that year, one STARTING
  // in it. Every award is announced in Oct–Jan, after the summer window, so
  // the spell that STARTS in the award year wins. It applies only when that
  // is exactly the shape (one dated spell ending in Y, one starting in Y);
  // every year it decides is printed on each run.
  if (!pick && definite.length === 0) {
    const y = date.slice(0, 4);
    const dated = possible.filter((s) => s.start || s.end);
    const starts = dated.filter((s) => s.start && s.start.time.slice(1, 5) === y && s.start.precision <= 10);
    const ends = dated.filter((s) => s.end && s.end.time.slice(1, 5) === y && s.end.precision <= 10);
    if (starts.length === 1 && ends.length === 1 && dated.length === 2 && starts[0] !== ends[0]) {
      pick = starts[0];
      tiebreak = true;
    }
  }
  return { pick, tiebreak, definite, possible };
};

// ── gate ───────────────────────────────────────────────────────────────
const main = async () => {
  const refresh = process.argv.includes("--refresh");
  const check = process.argv.includes("--check");
  if (check && (!existsSync(WP_CACHE) || !existsSync(WD_CACHE))) throw new Error("--check needs both caches");
  let wp;
  let wd;
  if (existsSync(WP_CACHE) && !refresh) wp = JSON.parse(readFileSync(WP_CACHE, "utf8"));
  else {
    console.log("fetching Wikipedia …");
    wp = await fetchWikipedia();
    writeFileSync(WP_CACHE, JSON.stringify(wp, null, 1));
  }
  if (existsSync(WD_CACHE) && !refresh) wd = JSON.parse(readFileSync(WD_CACHE, "utf8"));
  else {
    console.log("fetching Wikidata …");
    wd = await fetchWikidata();
    writeFileSync(WD_CACHE, JSON.stringify(wd, null, 1));
  }

  const WP = parseWikipedia(wp);
  if (!wp.resolve) {
    if (check) throw new Error("--check: Wikipedia cache has no QID resolution");
    const targets = [...new Set(Object.values(WP).flatMap((r) => (r.awarded ? [r.playerTarget, r.teamTarget] : [])))];
    wp.resolve = await resolveTargets(targets);
    writeFileSync(WP_CACHE, JSON.stringify(wp, null, 1));
  }
  if (!wd.p166) {
    if (check) throw new Error("--check: Wikidata cache has no P166 fallback");
    wd.p166 = await fetchP166();
    writeFileSync(WD_CACHE, JSON.stringify(wd, null, 1));
  }
  const wdByYear = {};
  const via = {};
  for (const w of wd.winners) (wdByYear[w.year] ??= []).push(w.qid);
  for (const w of wd.p166) {
    if (wdByYear[w.year] || w.year < FIRST || w.year > LAST) continue;
    (via[w.year] ??= []).push(w.qid);
  }
  for (const [y, qs] of Object.entries(via)) {
    wdByYear[y] = [...new Set(qs)];
    for (const q of wdByYear[y]) {
      if (!wd.players[q]) {
        if (check) throw new Error(`--check: fallback winner ${q} not cached`);
        const e = (await wbget([q], "labels|claims|sitelinks"))[q];
        const teams = (e.claims.P54 ?? []).map((st) => tv(st.mainsnak)?.id).filter((t) => t && !wd.teams[t]);
        const tr = teams.length ? await wbget(teams, "labels|claims|sitelinks") : {};
        for (const t of teams) wd.teams[t] = { label: tr[t].labels?.en?.value, enwiki: tr[t].sitelinks?.enwiki?.title ?? null, P31: (tr[t].claims?.P31 ?? []).map((x) => tv(x.mainsnak)?.id).filter(Boolean) };
        wd.players[q] = {
          label: e.labels?.en?.value,
          enwiki: e.sitelinks?.enwiki?.title ?? null,
          P54: (e.claims.P54 ?? []).filter((st) => st.rank !== "deprecated" && tv(st.mainsnak)).map((st) => {
            const d = (pp) => {
              const v = tv(st.qualifiers?.[pp]?.[0]);
              return v ? { time: v.time, precision: v.precision } : null;
            };
            return { team: tv(st.mainsnak).id, start: d("P580"), end: d("P582"), loan: Boolean(st.qualifiers?.P1642) };
          }),
        };
        writeFileSync(WD_CACHE, JSON.stringify(wd, null, 1));
      }
    }
  }

  let bad = 0;
  const fail = (y, msg) => {
    console.error(`  ✗ ${y}: ${msg}`);
    bad++;
  };
  const years = [];
  const ledger = [];
  for (let y = FIRST; y <= LAST; y++) {
    const a = WP[y];
    const bq = wdByYear[y] ?? [];
    if (NOT_AWARDED.has(y)) {
      if (!a || a.awarded !== false) fail(y, "Wikipedia does not mark it not-awarded");
      if (bq.length) fail(y, `Wikidata has a winner ${bq.join(",")}`);
      years.push({ year: y, awarded: false });
      continue;
    }
    if (!a?.awarded) {
      fail(y, "no Wikipedia winner row");
      continue;
    }
    if (bq.length !== 1) {
      fail(y, `Wikidata has ${bq.length} winners (${bq.join(",")})`);
      continue;
    }
    const qid = bq[0];
    const p = wd.players[qid];
    // winner identity: Wikipedia link target must be the Wikidata item's enwiki sitelink
    if (wp.resolve[a.playerTarget] !== qid) {
      fail(y, `winner: Wikipedia [[${a.playerTarget}]] (${wp.resolve[a.playerTarget]}) vs Wikidata ${qid} (${p.label})`);
      continue;
    }
    if (via[y]) ledger.push(`${y}: winner from Wikidata P166 on ${p.label} (${qid}) — Q166177's P1346 list has no ${y} entry yet`);
    const clubA = CLUB_BY_WP[a.teamTarget];
    if (!clubA) {
      fail(y, `unmapped Wikipedia club [[${a.teamTarget}]]`);
      continue;
    }
    const date = awardDate(y);
    const r = clubAt(wd, qid, date);
    const clubAQ = wp.resolve[a.teamTarget];
    let clubB = r.pick ? (r.pick.team === clubAQ ? clubA : `${wd.teams[r.pick.team].label} (${r.pick.team})`) : null;
    if (r.tiebreak && clubB === clubA) ledger.push(`${y}: ${p.label} → ${clubA} by the late-year tie-break (Wikidata spells dated to the year only)`);
    const ruling = RULINGS[y];
    if (clubB !== clubA) {
      if (ruling && ruling.wikidata === (clubB ?? "ambiguous") && ruling.club === clubA) {
        ledger.push(`${y}: RULING — ${ruling.why}`);
        clubB = ruling.club;
      } else {
        const cands = [...r.definite, ...r.possible].map((s) => `${wd.teams[s.team].label}[${s.start?.time.slice(1, 11) ?? "-"}..${s.end?.time.slice(1, 11) ?? "-"}]`).join(", ");
        fail(y, `club: Wikipedia ${clubA} vs Wikidata ${clubB ?? "AMBIGUOUS"} @${date} (${cands || "no spell"})`);
        continue;
      }
    }
    years.push({ year: y, awarded: true, winner: SHOW_OVERRIDE[a.playerTarget] ?? a.playerText, club: clubA, qid, wp: a.playerTarget });
  }
  // every ruling must still be needed — a stale ruling is a failure
  for (const y of Object.keys(RULINGS)) if (!ledger.some((l) => l.startsWith(`${y}: RULING`))) fail(y, "stale RULING (sources now agree or disagree differently) — re-read and update");

  if (bad) {
    console.error(`\nrace-facts: ${bad} DISAGREEMENT(S) — not deliverable.`);
    process.exit(1);
  }

  // cross-check against Wikipedia's own "Wins by club" table (a third view)
  const totals = {};
  for (const r of years) if (r.awarded) totals[r.club] = (totals[r.club] ?? 0) + 1;
  const wbc = {};
  const rows = wp.winsByClubWikitext.split("\n! scope=\"row\"").slice(1);
  for (const row of rows) {
    const l = linkOf(row);
    const nums = [...row.matchAll(/\|\s*(\d+)\s*$/gm)].map((m) => Number(m[1]));
    if (l && nums.length >= 2) wbc[CLUB_BY_WP[l.target] ?? l.target] = nums[nums.length - 1];
  }
  for (const [c, n] of Object.entries({ ...wbc, ...totals })) {
    if ((wbc[c] ?? 0) !== (totals[c] ?? 0)) {
      console.error(`  ✗ totals: ${c} computed ${totals[c] ?? 0} vs Wikipedia wins-by-club ${wbc[c] ?? 0}`);
      bad++;
    }
  }
  if (bad) process.exit(1);

  const facts = {
    _doc: "Generated by lab/race-facts.mjs — Wikipedia winners table ∩ Wikidata (Q166177 P1346/P585 + winners' P54 spells). Do not edit — re-run the script.",
    rule: "club at the time the award was given",
    sources: { wikipedia: `${wp.url} (revid ${wp.revid}, ${wp.fetched})`, wikidata: `${wd.source} (${wd.fetched})` },
    years,
    totals: Object.entries(totals).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])),
  };
  if (check) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.years) !== JSON.stringify(years)) throw new Error("race-facts --check: facts.json drifted from the gated caches — re-run without --check");
  } else {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(facts, null, 1));
  }
  const awarded = years.filter((r) => r.awarded).length;
  console.log(`race-facts: ${years.length} years (${awarded} awarded, ${years.length - awarded} not awarded) — Wikipedia and Wikidata agree on winner AND club for every year.`);
  console.log("rulings applied:" + (ledger.length ? "\n  " + ledger.join("\n  ") : " none"));
  console.log("per-club totals (also equal to Wikipedia's wins-by-club table):");
  for (const [c, n] of facts.totals) console.log(`  ${String(n).padStart(2)}  ${c}`);
  if (!check) console.log(`→ ${OUT}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
