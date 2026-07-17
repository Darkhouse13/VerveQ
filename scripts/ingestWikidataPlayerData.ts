#!/usr/bin/env npx tsx
/**
 * Wikidata ingest for VerveGrid data completeness (#2).
 *
 * The grid's player->club affiliations are built only from 2010-2024 top-5-league
 * appearances, so legends map to a single club (Ronaldinho -> AC Milan only) and
 * are wrongly rejected on their other clubs. This script pulls FULL-CAREER club
 * histories (Wikidata P54) for the existing roster, plus a bounded set of missing
 * legends, so the regenerated grid validates correctly.
 *
 * Subcommands (each resumable; safe to re-run):
 *   resolve       roster name+DOB -> Wikidata QID (DOB-bucketed, namesake-safe)
 *   affiliations  QID -> full P54 club history (+ nationalities), national teams filtered
 *   legends       bounded notable-player set not already in roster (+ their P54)
 *
 * Run from repo root:  npx tsx scripts/ingestWikidataPlayerData.ts <subcommand>
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "data");

const UA =
  "VerveQ-data-ingest/1.0 (support@verveq.com; VerveGrid coverage rebuild)";
const WDQS = "https://query.wikidata.org/sparql";
const FOOTBALLER = "wd:Q937857"; // occupation: association football player
const THROTTLE_MS = 1200; // polite ~1 query / 1.2s sustained

// ── data file paths ──────────────────────────────────────────────────────────
const PLAYERS_PATH = path.join(DATA_DIR, "players.json");
const QIDS_PATH = path.join(DATA_DIR, "wikidataPlayerQids.json");
const QIDS_PROGRESS = path.join(DATA_DIR, "wikidataResolveProgress.json");
const AFFIL_PATH = path.join(DATA_DIR, "wikidataAffiliations.json");
const LEGENDS_PATH = path.join(DATA_DIR, "wikidataLegends.json");

// ── types ────────────────────────────────────────────────────────────────────
interface RosterPlayer {
  id: string;
  apiId: number;
  name: string;
  firstName?: string;
  lastName?: string;
  nationality?: string;
  birthDate?: string;
  position?: string;
}
interface QidMatch {
  playerId: string;
  apiId: number;
  qid: string;
  wdLabel: string;
  rosterName: string;
  birthDate: string;
  confidence: "strong" | "nationality" | "lastname-unique";
}

// ── tiny throttled SPARQL client w/ retry+backoff ────────────────────────────
let lastReq = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function sparql(query: string, timeoutMs = 60000): Promise<any[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = THROTTLE_MS - (Date.now() - lastReq);
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${WDQS}?format=json&query=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.status === 429 || res.status >= 500) {
        const ra = Number(res.headers.get("retry-after")) || 2 ** attempt * 3;
        console.warn(`  ${res.status}; backoff ${ra}s (attempt ${attempt + 1})`);
        await sleep(ra * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { results: { bindings: any[] } };
      return json.results.bindings;
    } catch (err) {
      if (attempt === 5) throw err;
      const back = 2 ** attempt * 2;
      console.warn(`  fetch error (${String(err).slice(0, 80)}); retry in ${back}s`);
      await sleep(back * 1000);
    }
  }
  throw new Error("unreachable");
}

// ── name normalization ───────────────────────────────────────────────────────
function norm(s: string): string {
  // ASCII-only source (no combining-mark literals — esbuild/tsx choke on those).
  // NFD splits accents into combining marks (U+0300..U+036F), which we drop;
  // everything that isn't [a-z0-9] becomes a space.
  let out = "";
  for (const ch of s.normalize("NFD").toLowerCase()) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x0300 && code <= 0x036f) continue;
    out += (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") ? ch : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}
const tokens = (s: string) => norm(s).split(" ").filter((t) => t.length > 0);
// Latin name particles / suffixes that carry little disambiguating signal.
const NAME_STOPWORDS = new Set([
  "de", "del", "da", "dos", "do", "la", "le", "el", "van", "von", "den", "der",
  "di", "al", "bin", "ben", "st", "jr", "junior", "the",
]);
const qidOf = (uri: string) => uri.split("/").pop() as string;
const readJson = <T>(p: string, fallback: T): T =>
  fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as T) : fallback;
const writeJson = (p: string, v: unknown) =>
  fs.writeFileSync(p, JSON.stringify(v, null, 2));

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1: resolve roster -> QID, bucketed by exact date of birth
// ─────────────────────────────────────────────────────────────────────────────
async function resolve() {
  const roster = readJson<RosterPlayer[]>(PLAYERS_PATH, []).filter((p) => p.birthDate);
  const byDob = new Map<string, RosterPlayer[]>();
  for (const p of roster) {
    if (!byDob.has(p.birthDate!)) byDob.set(p.birthDate!, []);
    byDob.get(p.birthDate!)!.push(p);
  }
  const allDobs = [...byDob.keys()].sort();
  const done = new Set(readJson<string[]>(QIDS_PROGRESS, []));
  const matches = readJson<QidMatch[]>(QIDS_PATH, []);
  const matchedPlayerIds = new Set(matches.map((m) => m.playerId));

  const pending = allDobs.filter((d) => !done.has(d));
  console.log(
    `resolve: ${roster.length} players, ${allDobs.length} distinct DOBs, ` +
      `${pending.length} DOB-chunks pending, ${matches.length} already matched`,
  );

  const DOB_PER_QUERY = 120;
  const chunks = chunk(pending, DOB_PER_QUERY);
  for (let ci = 0; ci < chunks.length; ci++) {
    const dobChunk = chunks[ci];
    const values = dobChunk.map((d) => `"${d}T00:00:00Z"^^xsd:dateTime`).join(" ");
    const query = `SELECT ?p ?dob ?name (GROUP_CONCAT(DISTINCT ?alias;separator="||") AS ?aliases) (GROUP_CONCAT(DISTINCT ?natLabel;separator="||") AS ?nats) WHERE {
  VALUES ?dob { ${values} }
  ?p wdt:P569 ?dob; wdt:P106 ${FOOTBALLER}; rdfs:label ?name.
  FILTER(LANG(?name)="en")
  OPTIONAL { ?p skos:altLabel ?alias. FILTER(LANG(?alias)="en") }
  OPTIONAL { ?p wdt:P27 ?nat. ?nat rdfs:label ?natLabel. FILTER(LANG(?natLabel)="en") }
} GROUP BY ?p ?dob ?name`;

    let rows: any[];
    try {
      rows = await sparql(query);
    } catch (err) {
      console.error(`  chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 120)}`);
      continue; // leave undone; re-run resumes
    }

    // group Wikidata candidates by DOB
    const wdByDob = new Map<string, any[]>();
    for (const r of rows) {
      const dob = r.dob.value.slice(0, 10);
      if (!wdByDob.has(dob)) wdByDob.set(dob, []);
      const names = [r.name.value, ...(r.aliases?.value ? r.aliases.value.split("||") : [])];
      wdByDob.get(dob)!.push({
        qid: qidOf(r.p.value),
        label: r.name.value,
        wdTokens: new Set<string>(names.flatMap((n: string) => tokens(n))),
        nats: new Set(
          (r.nats?.value ? r.nats.value.split("||") : []).map((n: string) => norm(n)),
        ),
      });
    }

    let chunkMatched = 0;
    for (const dob of dobChunk) {
      const cands = wdByDob.get(dob) || [];
      for (const rp of byDob.get(dob)!) {
        if (matchedPlayerIds.has(rp.id)) continue;
        const rosterTokens = new Set<string>([
          ...tokens(rp.name),
          ...tokens(rp.firstName || ""),
          ...tokens(rp.lastName || ""),
        ]);
        const natN = rp.nationality ? norm(rp.nationality) : "";

        // Score each DOB-bucket candidate by shared tokens; require >=1 "specific"
        // shared token (len>=4, not a name particle). DOB already isolates ~10
        // footballers, so a specific surname/forename overlap is highly diagnostic.
        // Nationality is a soft boost/tiebreak only (WD cites "United Kingdom" for
        // England/Scotland/Wales players), never a hard gate.
        const scored = cands
          .map((c: any) => {
            const shared = [...rosterTokens].filter((t) => c.wdTokens.has(t));
            const specific = shared.filter(
              (t) => t.length >= 4 && !NAME_STOPWORDS.has(t),
            );
            const maxLen = shared.reduce((m, t) => Math.max(m, t.length), 0);
            const natOk = natN !== "" && c.nats.has(natN);
            return { c, specific, maxLen, natOk, score: specific.length * 10 + shared.length };
          })
          .filter((s) => s.specific.length >= 1)
          // Token-overlap score is the primary signal for WHICH person this is;
          // nationality is only a tiebreak (a UK player's correct match is often
          // nat-false because Wikidata cites "United Kingdom", not "England").
          .sort(
            (a, b) =>
              b.score - a.score ||
              Number(b.natOk) - Number(a.natOk) ||
              b.maxLen - a.maxLen,
          );

        if (scored.length === 0) continue;
        const best = scored[0];
        const second = scored[1];
        // Reject only-ambiguous ties: same nationality status AND identical score.
        if (second && second.natOk === best.natOk && second.score === best.score) {
          continue;
        }
        const pick = best.c;
        const conf: QidMatch["confidence"] = best.natOk
          ? best.specific.length >= 2
            ? "strong"
            : "nationality"
          : "lastname-unique";
        matches.push({
          playerId: rp.id,
          apiId: rp.apiId,
          qid: pick.qid,
          wdLabel: pick.label,
          rosterName: rp.name,
          birthDate: dob,
          confidence: conf,
        });
        matchedPlayerIds.add(rp.id);
        chunkMatched++;
      }
      done.add(dob);
    }

    writeJson(QIDS_PATH, matches);
    writeJson(QIDS_PROGRESS, [...done]);
    if ((ci + 1) % 5 === 0 || ci === chunks.length - 1) {
      console.log(
        `  chunk ${ci + 1}/${chunks.length} (+${chunkMatched}) total matched ${matches.length}`,
      );
    }
  }

  const byConf = matches.reduce<Record<string, number>>((a, m) => {
    a[m.confidence] = (a[m.confidence] || 0) + 1;
    return a;
  }, {});
  console.log(
    `resolve DONE: ${matches.length}/${roster.length} matched ` +
      `(${((matches.length / roster.length) * 100).toFixed(1)}%) by confidence ${JSON.stringify(byConf)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2: QID -> full-career club affiliations (P54), national teams filtered
// ─────────────────────────────────────────────────────────────────────────────
interface ClubAffiliation {
  clubQid: string;
  label: string;
  start: string | null; // YYYY
  end: string | null; // YYYY or null = open/current
  league: string | null;
  country: string | null;
}
interface AffiliationRecord {
  qid: string;
  playerIds: string[];
  apiIds: number[];
  clubs: ClubAffiliation[];
  nationalTeams: string[]; // labels, filtered out of clubs
  nationalities: string[];
}

const yr = (v: string | undefined | null) => (v ? v.slice(0, 4) : null);
const isNationalTeamType = (types: string[]) =>
  types.some((t) => /\bnational\b/.test(t.toLowerCase()));

async function fetchAffiliationsForQids(
  qids: string[],
): Promise<Map<string, { clubs: Map<string, ClubAffiliation>; nationalTeams: Set<string>; nationalities: Set<string> }>> {
  const out = new Map<
    string,
    { clubs: Map<string, ClubAffiliation>; nationalTeams: Set<string>; nationalities: Set<string> }
  >();
  for (const q of qids)
    out.set(q, { clubs: new Map(), nationalTeams: new Set(), nationalities: new Set() });

  const values = qids.map((q) => `wd:${q}`).join(" ");
  const clubQuery = `SELECT ?p ?s ?club ?clubLabel (SAMPLE(?startV) AS ?start) (SAMPLE(?endV) AS ?end) (GROUP_CONCAT(DISTINCT ?p31Label;separator="||") AS ?types) (SAMPLE(?leagueLabel) AS ?league) (SAMPLE(?countryLabel) AS ?country) WHERE {
  VALUES ?p { ${values} }
  ?p p:P54 ?s. ?s ps:P54 ?club.
  OPTIONAL { ?s pq:P580 ?startV } OPTIONAL { ?s pq:P582 ?endV }
  ?club rdfs:label ?clubLabel. FILTER(LANG(?clubLabel)="en")
  OPTIONAL { ?club wdt:P31 ?p31. ?p31 rdfs:label ?p31Label. FILTER(LANG(?p31Label)="en") }
  OPTIONAL { ?club wdt:P118 ?leagueE. ?leagueE rdfs:label ?leagueLabel. FILTER(LANG(?leagueLabel)="en") }
  OPTIONAL { ?club wdt:P17 ?countryE. ?countryE rdfs:label ?countryLabel. FILTER(LANG(?countryLabel)="en") }
} GROUP BY ?p ?s ?club ?clubLabel`;

  const rows = await sparql(clubQuery, 90000);
  for (const r of rows) {
    const qid = qidOf(r.p.value);
    const bucket = out.get(qid);
    if (!bucket) continue;
    const types = r.types?.value ? r.types.value.split("||") : [];
    const label = r.clubLabel.value;
    if (isNationalTeamType(types) || /\bnational\b/i.test(label)) {
      bucket.nationalTeams.add(label);
      continue;
    }
    const clubQid = qidOf(r.club.value);
    const start = yr(r.start?.value);
    const end = yr(r.end?.value);
    const existing = bucket.clubs.get(clubQid);
    if (existing) {
      if (start && (!existing.start || start < existing.start)) existing.start = start;
      if (existing.end !== null && (!end || end > existing.end)) existing.end = end ?? null;
    } else {
      bucket.clubs.set(clubQid, {
        clubQid,
        label,
        start,
        end,
        league: r.league?.value ?? null,
        country: r.country?.value ?? null,
      });
    }
  }

  const natQuery = `SELECT ?p (GROUP_CONCAT(DISTINCT ?natLabel;separator="||") AS ?nats) WHERE {
  VALUES ?p { ${values} }
  ?p wdt:P27 ?nat. ?nat rdfs:label ?natLabel. FILTER(LANG(?natLabel)="en")
} GROUP BY ?p`;
  const natRows = await sparql(natQuery, 60000);
  for (const r of natRows) {
    const bucket = out.get(qidOf(r.p.value));
    if (!bucket || !r.nats?.value) continue;
    for (const n of r.nats.value.split("||")) bucket.nationalities.add(n);
  }
  return out;
}

async function affiliations() {
  const matches = readJson<QidMatch[]>(QIDS_PATH, []);
  if (matches.length === 0) {
    console.error("no wikidataPlayerQids.json — run `resolve` first");
    process.exit(1);
  }
  // qid -> roster playerIds/apiIds (collisions possible; keep all)
  const byQid = new Map<string, { playerIds: string[]; apiIds: number[] }>();
  for (const m of matches) {
    if (!byQid.has(m.qid)) byQid.set(m.qid, { playerIds: [], apiIds: [] });
    byQid.get(m.qid)!.playerIds.push(m.playerId);
    byQid.get(m.qid)!.apiIds.push(m.apiId);
  }
  const existing = readJson<AffiliationRecord[]>(AFFIL_PATH, []);
  const doneQids = new Set(existing.map((r) => r.qid));
  const records = [...existing];
  const pending = [...byQid.keys()].filter((q) => !doneQids.has(q));
  console.log(
    `affiliations: ${byQid.size} distinct QIDs, ${pending.length} pending, ${existing.length} done`,
  );

  const QIDS_PER_QUERY = 110;
  const chunks = chunk(pending, QIDS_PER_QUERY);
  for (let ci = 0; ci < chunks.length; ci++) {
    let res;
    try {
      res = await fetchAffiliationsForQids(chunks[ci]);
    } catch (err) {
      console.error(`  chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 120)}`);
      continue;
    }
    for (const [qid, b] of res) {
      const ids = byQid.get(qid)!;
      records.push({
        qid,
        playerIds: ids.playerIds,
        apiIds: ids.apiIds,
        clubs: [...b.clubs.values()].sort((a, c) => (a.start || "9999").localeCompare(c.start || "9999")),
        nationalTeams: [...b.nationalTeams],
        nationalities: [...b.nationalities],
      });
    }
    writeJson(AFFIL_PATH, records);
    if ((ci + 1) % 5 === 0 || ci === chunks.length - 1) {
      console.log(`  chunk ${ci + 1}/${chunks.length}; ${records.length} players have affiliations`);
    }
  }

  const totalClubLinks = records.reduce((a, r) => a + r.clubs.length, 0);
  const withMulti = records.filter((r) => r.clubs.length > 1).length;
  console.log(
    `affiliations DONE: ${records.length} players, ${totalClubLinks} club links ` +
      `(avg ${(totalClubLinks / records.length).toFixed(1)}/player), ${withMulti} with >1 club`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 3: bounded roster expansion — notable players not already in the roster
// ─────────────────────────────────────────────────────────────────────────────
interface LegendRecord {
  qid: string;
  syntheticId: string; // fb_wd_<QID>
  name: string;
  birthDate: string | null;
  nationality: string | null; // primary
  nationalities: string[];
  position: string | null; // mapped to {Attacker,Midfielder,Defender,Goalkeeper}
  sitelinks: number;
  clubs: ClubAffiliation[];
  nationalTeams: string[];
}

function mapPosition(labels: string[]): string | null {
  const s = labels.join(" ").toLowerCase();
  if (/goalkeeper|goalie/.test(s)) return "Goalkeeper";
  if (/forward|striker|winger|centre-forward|attack/.test(s)) return "Attacker";
  if (/midfield/.test(s)) return "Midfielder";
  if (/back|defender|sweeper|fullback|full-back/.test(s)) return "Defender";
  return null;
}

async function legends() {
  const threshold = Number(process.argv[3] || 50); // sitelink fame proxy
  const matched = new Set(readJson<QidMatch[]>(QIDS_PATH, []).map((m) => m.qid));
  const roster = readJson<RosterPlayer[]>(PLAYERS_PATH, []);
  // DOB -> roster players' "specific" surname/forename tokens, to catch duplicates
  // even when the roster name is abbreviated ("C. Tevez") vs Wikidata's full name.
  const rosterByDob = new Map<string, Set<string>[]>();
  for (const p of roster) {
    if (!p.birthDate) continue;
    const t = new Set(
      [...tokens(p.name), ...tokens(p.firstName || ""), ...tokens(p.lastName || "")].filter(
        (x) => x.length >= 4 && !NAME_STOPWORDS.has(x),
      ),
    );
    if (!rosterByDob.has(p.birthDate)) rosterByDob.set(p.birthDate, []);
    rosterByDob.get(p.birthDate)!.push(t);
  }
  const isRosterDuplicate = (name: string, dob: string | null) => {
    if (!dob) return false;
    const cand = tokens(name).filter((x) => x.length >= 4 && !NAME_STOPWORDS.has(x));
    return (rosterByDob.get(dob) || []).some((rt) => cand.some((t) => rt.has(t)));
  };
  console.log(
    `legends: sitelinks>=${threshold}; excluding ${matched.size} matched QIDs + roster name/DOB collisions`,
  );

  // Candidate notable footballers by sitelink count (global fame proxy).
  const candQuery = `SELECT ?p ?name ?dob ?links (GROUP_CONCAT(DISTINCT ?natLabel;separator="||") AS ?nats) (GROUP_CONCAT(DISTINCT ?posLabel;separator="||") AS ?poss) WHERE {
  ?p wdt:P106 wd:Q937857; wikibase:sitelinks ?links.
  FILTER(?links >= ${threshold})
  ?p rdfs:label ?name. FILTER(LANG(?name)="en")
  OPTIONAL { ?p wdt:P569 ?dob }
  OPTIONAL { ?p wdt:P27 ?nat. ?nat rdfs:label ?natLabel. FILTER(LANG(?natLabel)="en") }
  OPTIONAL { ?p wdt:P413 ?pos. ?pos rdfs:label ?posLabel. FILTER(LANG(?posLabel)="en") }
} GROUP BY ?p ?name ?dob ?links`;
  console.log("  fetching candidate set (heavy query, up to 120s)...");
  const rows = await sparql(candQuery, 120000);
  console.log(`  ${rows.length} footballers above threshold`);

  const candidates = rows
    .map((r) => {
      const qid = qidOf(r.p.value);
      const dob = r.dob?.value ? r.dob.value.slice(0, 10) : null;
      const nats = r.nats?.value ? r.nats.value.split("||") : [];
      return {
        qid,
        name: r.name.value,
        dob,
        nationalities: nats,
        position: mapPosition(r.poss?.value ? r.poss.value.split("||") : []),
        sitelinks: Number(r.links.value),
      };
    })
    .filter((c) => !matched.has(c.qid)) // not already a roster player by QID
    .filter((c) => !isRosterDuplicate(c.name, c.dob)); // nor by name/DOB collision
  console.log(`  ${candidates.length} are NOT already in the roster (the expansion set)`);

  // Fetch their full-career affiliations in chunks.
  const legendsOut: LegendRecord[] = [];
  const chunks = chunk(candidates, 100);
  for (let ci = 0; ci < chunks.length; ci++) {
    let res;
    try {
      res = await fetchAffiliationsForQids(chunks[ci].map((c) => c.qid));
    } catch (err) {
      console.error(`  affil chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 100)}`);
      continue;
    }
    for (const c of chunks[ci]) {
      const b = res.get(c.qid);
      legendsOut.push({
        qid: c.qid,
        syntheticId: `fb_wd_${c.qid}`,
        name: c.name,
        birthDate: c.dob,
        nationality: c.nationalities[0] ?? null,
        nationalities: c.nationalities,
        position: c.position,
        sitelinks: c.sitelinks,
        clubs: b ? [...b.clubs.values()] : [],
        nationalTeams: b ? [...b.nationalTeams] : [],
      });
    }
    writeJson(LEGENDS_PATH, legendsOut);
    if ((ci + 1) % 5 === 0 || ci === chunks.length - 1) {
      console.log(`  affil chunk ${ci + 1}/${chunks.length}; ${legendsOut.length} legends w/ data`);
    }
  }
  const withClubs = legendsOut.filter((l) => l.clubs.length > 0).length;
  console.log(
    `legends DONE: ${legendsOut.length} new players, ${withClubs} with >=1 club affiliation`,
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// THE DRAW — Ticket E0: sourced player retrieval (provenance-first enrichment)
// ═════════════════════════════════════════════════════════════════════════════
//
// Enriches the Career Path universe (football_career_paths.json) with per-fact
// sourced data + provenance, so E1 can select and E2 can blindly verify.
//
// PROVENANCE LAW: no fact is written without a resolvable Wikidata source ref.
// Nation, position and debut year come from Wikidata's answer or are null.
// Model knowledge is never a source. Absence is recorded as null, never guessed.
//
// Stages (each cached + resumable; run in order):
//   cp-search   answerName -> candidate QIDs           (Wikidata search API)
//   cp-clubqids candidate QIDs -> their P54 club QIDs   (cheap gate input)
//   cp-clubdict distinct club QIDs -> label/aliases/type/country
//   cp-facts    gate locally, then fetch facts for WINNERS only
//   cp-emit     write playersSourced.json (pure; no network)
//   cp-assert   committed playersSourced.json == a fresh emit (pure; no network)
//   cp-report   coverage report (pure; no network)
//   cp-all      run every stage in order
//
// Network stages cache raw responses under scripts/cache/careerPath (gitignored),
// so cp-emit / cp-report rerun instantly and offline while iterating on rules.

// Plausibility bounds for a P580-derived debut year. Association football was
// codified in 1863; anything earlier is a Wikidata placeholder/typo, not a career.
// Deliberately wide — these reject sentinels, they do not curate the era range.
const CP_MIN_PLAUSIBLE_DEBUT = 1850;
// FIFA's minimum age for a professional contract. The floor below which a P54
// start year cannot be describing senior football (E1.1).
const CP_MIN_DEBUT_AGE = 16;
const CP_MAX_PLAUSIBLE_DEBUT = new Date().getFullYear() + 1;

const CP_CACHE_DIR = path.join(__dirname, "cache", "careerPath");
const CP_PATHS_PATH = path.join(__dirname, "..", "app", "convex", "data", "football_career_paths.json");
const CP_ALIASES_PATH = path.join(__dirname, "..", "app", "convex", "data", "clubAliases.json");
const CP_ADDITIONS_PATH = path.join(__dirname, "..", "app", "convex", "data", "playerAdditions.json");
const CP_OUT_PATH = path.join(__dirname, "..", "app", "convex", "data", "playersSourced.json");
const CP_SEARCH_CACHE = path.join(CP_CACHE_DIR, "searchCandidates.json");
const CP_CLUBQIDS_CACHE = path.join(CP_CACHE_DIR, "candidateClubQids.json");
const CP_CLUBDICT_CACHE = path.join(CP_CACHE_DIR, "clubDict.json");
const CP_FACTS_CACHE = path.join(CP_CACHE_DIR, "playerFacts.json");
// E0.2: sitelink counts, the editorial fame backbone behind fameRank.
const CP_SITELINKS_CACHE = path.join(CP_CACHE_DIR, "sitelinks.json");

const WD_API = "https://www.wikidata.org/w/api.php";
const SEARCH_THROTTLE_MS = 150; // action=wbsearchentities is light; still be polite

// NOTE ON `clubs` SHAPE: football_career_paths.json is heterogeneous — an entry is
// either a bare string ("Barcelona") or a loan-annotated object ({name, loan:true}).
// 1216 of 9366 club entries (across 639 of 1322 players) are the object form, so this
// is the norm, not an edge case. Everything downstream MUST read club names through
// cpClubEntryName(); coercing an entry with String() yields "[object Object]", which
// would silently fail to match and weaken the identity gate for ~half the universe.
type CareerPathClub = string | { name: string; loan?: boolean };
interface CareerPath {
  id: string;
  answerName: string;
  acceptedAnswers?: string[];
  clubs: CareerPathClub[];
  difficulty: string;
  // Ticket E0.1. "career-path" = derived from football_career_paths.json (gate: >=2 of
  // many clubs). "manual" = owner-supplied addition (gate: ALL owner anchors must be
  // confirmed). Anchors are the owner's HYPOTHESIS; Wikidata is the test.
  origin?: "career-path" | "manual";
  anchorClubs?: string[];
  ownerRuling?: { qid: string; verdict: "green"; ruledOn: string; note: string };
}
interface PlayerAddition {
  name: string;
  anchorClubs: string[];
  ownerNote?: string | string[];
  // E1.1: an explicit owner ruling on a QID the club-anchor gate could not resolve.
  // It NEVER invents evidence — it records that a human accepted a named entity as
  // correct, pinned to the exact QID so it cannot silently transfer to a different
  // entity if search results move. The gate refuses a ruling whose qid does not
  // match the candidate it actually selected.
  ownerRuling?: { qid: string; verdict: "green"; ruledOn: string; note: string };
}
const cpClubEntryName = (c: CareerPathClub): string => (typeof c === "string" ? c : c.name);
interface SearchCandidates {
  careerPathId: string;
  answerName: string;
  candidates: { qid: string; label: string; description: string }[];
  retrievedAt: string;
}
interface ClubDictEntry {
  qid: string;
  label: string;
  aliases: string[];
  types: string[]; // P31 labels
  country: string | null; // P17 label
  retrievedAt: string;
}
// E0.2: bump when a fetch stage changes SHAPE or PREDICATE, so cp-facts re-pulls
// instead of silently mixing old and new rows. v2 = P413 read statement-level
// (p:/ps:) rather than truthy wdt:, which returned best-rank only and hid a real
// second position on Ronaldinho (winger | attacking midfielder) and Endo
// (defensive midfielder | defender). See cpFacts.
const CP_FACTS_SCHEMA = 2;
interface RawFacts {
  qid: string;
  memberships: { clubQid: string; start: string | null; end: string | null }[];
  positions: string[]; // P413 labels — ALL non-deprecated statements (schema>=2)
  countryForSport: string | null; // P1532 label
  citizenships: string[]; // P27 labels
  // E1.1: P569 birth year. Without it debutYear is unfixable — see cpDebutYear.
  // `undefined` marks a pre-E1.1 cache entry and forces a refetch; `null` means
  // fetched and genuinely absent.
  birthYear?: number | null;
  // E0.2: absent/older => the entry predates the statement-level P413 fetch.
  schemaVersion?: number;
  retrievedAt: string;
}

const cpEnsureCache = () => fs.mkdirSync(CP_CACHE_DIR, { recursive: true });
const nowIso = () => new Date().toISOString();

// The universe every stage operates on. CP_ONLY (comma-separated careerPathIds)
// narrows it for smoke tests; every stage reads through here so a scoped run stays
// internally consistent (gate/report counts describe the SAME set that was fetched).
// add_<slug> — synthetic, stable careerPathId for owner-supplied additions.
const cpAdditionId = (name: string) => `add_${norm(name).replace(/ /g, "-")}`;

// Owner additions, normalised onto the CareerPath shape so every stage (search,
// club fetch, facts, emit) treats them identically. Only the identity gate differs.
function cpLoadAdditions(): CareerPath[] {
  const raw = readJson<{ additions?: PlayerAddition[] }>(CP_ADDITIONS_PATH, {});
  return (raw.additions || []).map((a) => ({
    id: cpAdditionId(a.name),
    answerName: a.name,
    clubs: a.anchorClubs,
    difficulty: "manual",
    origin: "manual" as const,
    anchorClubs: a.anchorClubs,
    ownerRuling: a.ownerRuling,
  }));
}

function cpUniverse(): CareerPath[] {
  const all = [
    ...readJson<CareerPath[]>(CP_PATHS_PATH, []).map((p) => ({ ...p, origin: "career-path" as const })),
    ...cpLoadAdditions(),
  ];
  const only = (process.env.CP_ONLY || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (only.length === 0) return all;
  const want = new Set(only);
  const picked = all.filter((p) => want.has(p.id));
  console.log(`  [CP_ONLY] scoped universe: ${picked.length}/${all.length} career paths`);
  return picked;
}

// ── club-name matching ───────────────────────────────────────────────────────
// STRICT normalized equality against a club's label + skos:altLabel set.
//
// Deliberately strict: the tempting alternative (strip affix tokens like FC/AC/CF,
// then compare token sets) collapses "AC Milan" -> {milan}, which is a subset of
// "Inter Milan" -> {inter, milan} and produces cross-club false positives. Since a
// false club match directly weakens the identity gate, we accept more misses in
// exchange for no false matches. Wikidata's own altLabels already carry most bare
// names ("Manchester United" is an alias of Q18656); clubAliases.json holds the
// residue where they do not (e.g. "Juventus" vs label "Juventus FC").
function cpLoadAliasTable(): Map<string, string[]> {
  const raw = readJson<{ aliases?: Record<string, string[]> }>(CP_ALIASES_PATH, {});
  return new Map(Object.entries(raw.aliases || {}));
}

function cpAcceptedNames(cpClub: string, aliases: Map<string, string[]>): Set<string> {
  const out = new Set<string>([norm(cpClub)]);
  for (const a of aliases.get(cpClub) || []) out.add(norm(a));
  return out;
}

function cpClubNamesOf(entry: ClubDictEntry): Set<string> {
  const s = new Set<string>([norm(entry.label)]);
  for (const a of entry.aliases) s.add(norm(a));
  return s;
}

// ── club-type exclusion rules (documented per ticket) ────────────────────────
// A P54 entry is only a CLUB fact if it is neither a national team nor an
// identifiable youth/reserve/B side. Both checks look at P31 type labels first
// (authoritative) and fall back to the entity label (catches entries whose P31 is
// missing or under-specified). Fail-closed: anything that looks like a national
// or youth/reserve side is excluded rather than risk polluting the club list.
const CP_NATIONAL_TYPE_RE = /national (association )?football team|national team|national association football/i;
const CP_NATIONAL_LABEL_RE = /\bnational\b/i;
// E1.1: `reserve team` and `farm team` are deliberately NOT here — they are P31
// types of SENIOR sides in the league pyramid, and lumping them with age-group
// types is what made debutYear unfixable. E0's single CP_YOUTH_TYPE_RE carried
// `reserve team`, so excluding age-group sides from a debut also excluded
// FC Barcelona Atlètic and read Iniesta as debuting in 2002 rather than 2001.
// Reserve/farm sides are matched by cpIsReserve instead: excluded from the clubs
// printed on a card, counted for debutYear.
const CP_AGEGROUP_TYPE_RE = /youth team|academy|youth academy|under-\d{2}/i;
const CP_RESERVE_TYPE_RE = /reserve|farm team/i;

// Youth/reserve markers, split by WHERE they may legally appear in a label.
//
// ANYWHERE: unambiguous age/reserve words. These must NOT be end-anchored —
// "Brazil national under-23 football team" carries the marker mid-label, and an
// end-anchored rule silently accepted it as a SENIOR national team, which then
// became the source of that player's sporting-nation fact.
// E1.1: youth and reserve are SPLIT, because they answer different questions.
// An AGE-GROUP side (U-19, Juvenil, academy) is not senior football and can
// never source a debut. A RESERVE/B side IS senior football — it plays in the
// senior league pyramid — so it counts for debutYear even though it is never an
// "iconic" club worth printing on a card. Collapsing the two (as E0 did) makes
// debutYear unfixable: see cpDebutYear.
const CP_AGEGROUP_ANYWHERE_RE =
  /\bU-?\d{2}\b|\bunder-?\d{2}\b|\byouth\b|\bacademy\b|\bprimavera\b|\bjuvenil\b|\bcadet\b/i;
const CP_RESERVE_ANYWHERE_RE = /\breserves?\b|\bamateure\b|\bcastilla\b|\batl[eè]tic\b/i;
// TRAILING ONLY: bare letters/numerals marking a B-side ("FC Barcelona B",
// "FC Barcelona C", "Bayern Munich II"). Meaningful only as a suffix — un-anchoring
// them would wrongly exclude senior clubs whose names merely contain the letter,
// while "Boca Juniors"/"Argentinos Juniors" must stay KEPT (senior clubs).
const CP_RESERVE_SUFFIX_RE = /\s(B|C|D|II|III|IV)$/;

// E1.1: P54 is not a club-only property. Q1492 — the CITY of Barcelona, typed
// `municipality of Catalonia`/`city` — appears as a P54 value and became a club
// tag colliding with FC Barcelona. A deny-list cannot anticipate which non-club
// entity shows up next, so a club must POSITIVELY declare a club-ish type.
const CP_CLUB_TYPE_RE = /football club|football team|sports team|sports club|association football/i;

function cpIsNationalTeam(e: ClubDictEntry): boolean {
  return e.types.some((t) => CP_NATIONAL_TYPE_RE.test(t)) || CP_NATIONAL_LABEL_RE.test(e.label);
}
function cpIsAgeGroup(e: ClubDictEntry): boolean {
  return e.types.some((t) => CP_AGEGROUP_TYPE_RE.test(t)) || CP_AGEGROUP_ANYWHERE_RE.test(e.label.trim());
}
function cpIsReserve(e: ClubDictEntry): boolean {
  const label = e.label.trim();
  return (
    e.types.some((t) => CP_RESERVE_TYPE_RE.test(t)) ||
    CP_RESERVE_ANYWHERE_RE.test(label) ||
    CP_RESERVE_SUFFIX_RE.test(label)
  );
}
function cpIsClubEntity(e: ClubDictEntry): boolean {
  return e.types.some((t) => CP_CLUB_TYPE_RE.test(t));
}
// E0.2 item 5 — a club QID that fetched but came back DESCRIBED BY NOTHING: no
// label and no P31 types. The ref resolves to an address, not to an entity, so a
// membership citing it asserts a club that the source does not describe. Distinct
// from a resolvable club that is merely not a club (Q1492, the CITY of Barcelona,
// which cpIsClubEntity's allow-list already rejects) and from a resolvable club
// whose STATEMENT is false (Dybala's Club Sport Emelec is a real, fully described
// club he never played for — F2, invisible to any provenance rule and out of reach
// here). Kept narrow on purpose: this drops refs, and dropping is destructive.
function cpIsPhantomEntity(e: ClubDictEntry): boolean {
  return !e.label.trim() && e.types.length === 0;
}
// Populated by cp-emit, read by cp-report. Both are RESET at the top of cp-emit —
// cp-assert re-runs the emit in the same process, and an appending log would
// double-count on the second pass.
const cpPhantomLog: { qid: string; name: string; clubQid: string; start: string | null; end: string | null }[] = [];
// E0.2 item 4: dual internationals the recency rule cannot separate -> owner list.
const cpNationRulingLog: { qid: string; name: string; candidates: string[]; reason: string }[] = [];
// E0.5 — MALFORMED NON-CLUB memberships that erased a player's EARLIEST career.
// A P54 statement resolving to a real entity that is not a football club (a city,
// a commune, a business, a university) is a mis-targeted membership. cpIsClubEntity
// (E1.1) correctly refuses to tag it — but that refusal is SILENT, and when the
// malformed statement is the EARLIEST, refusing it deletes the start of the career
// and promotes a later transfer to sourceStartYear. Recorded here and fail-closed
// (sourceStartYear -> null) so the card drops rather than ship a mis-bucketed year.
const cpErasedCareerLog: { qid: string; name: string; sourceStartWas: number; malformedStarts: number[] }[] = [];
function cpIsYouthOrReserve(e: ClubDictEntry): boolean {
  return cpIsAgeGroup(e) || cpIsReserve(e);
}
// E0.2 — ONE club filter, restoring E0's intent. E1.1 split this from
// cpIsSeniorClub so reserve/B sides COUNTED for debutYear ("they are senior league
// football"), which made debutYear systematically early: E2 found 65 of 430 cards
// (15%) had their debut set by a reserve/B/C side, and EVERY divergence from the
// commonly-cited senior debut ran the same direction — Pedro 2005 vs 2008, Messi
// 2003 vs 2004, Neuer/Khedira 2004 vs 2006. The owner ruled the definition:
// debutYear is the first-team debut, so reserve sides are excluded here too.
//
// Measured before the change (offline, against the committed cache): 85 debuts move,
// 84 of them by +1..+4 onto the commonly-cited year (Butragueño 1981->1984, Villa
// 2000->2001, Pedro 2005->2008). ONE regresses — Busquets 2006 -> 2023 — because
// Wikidata records his academy entry on the FIRST-TEAM QID (FC Barcelona, one
// statement, P580=2000), so the age-16 filter discards it whole and only Inter Miami
// survives. That is a source-modelling fault this rule cannot see; he is flagged and
// listed for an owner ruling rather than shipped at 2023. See cpDebutAudit.
/** Senior FIRST-team football for debutYear. Identical to cpIsSeniorClub by design. */
function cpCountsForDebut(e: ClubDictEntry): boolean {
  return cpIsSeniorClub(e);
}
// E0.5 — REPRESENTATIVE TEAMS IN THE CLUB SLOT. E2.1 found Andreas Brehme carrying
// "Germany Olympic football team" (Q1202757, typed `national Olympic football team`)
// as one of his three printed clubs. An Olympic side is a representative team
// assembled for a tournament, not a club a player is transferred to — the same class
// the nation path already excludes via CP_NT_COMPOSITE_RE's \bolympic\b. cpIsClubEntity
// accepts it (the type contains "football team") and cpIsNationalTeam misses it (no
// "national ... team" match on this exact string), so it slipped into the club list.
// Excluded here so it is dropped from BOTH the printed chips and the canonical clubs:
// unlike Benatia's Marseille (a real club with a disputed appearance, handled by an
// owner disputed-statement record), this entity is simply not a club at all.
//
// MATCHED ON TYPE, NEVER LABEL. Real clubs carry "Olympic" in their NAME — Sydney
// Olympic FC, BK Olympic, Atletico Olympic F.C. — and are typed "association football
// club". Representative sides are typed "national Olympic football team". A label
// regex would wrongly drop the three real clubs; the type regex catches only the
// representative teams. (The "... Olympic football team" sides that ALSO carry
// "national association football team" — Portugal, Colombia, etc. — are already
// excluded by cpIsNationalTeam; this closes the gap for those typed ONLY as Olympic.)
const CP_REPRESENTATIVE_TYPE_RE = /\bolympic\b/i;
function cpIsRepresentativeTeam(e: ClubDictEntry): boolean {
  return e.types.some((t) => CP_REPRESENTATIVE_TYPE_RE.test(t));
}
/** A club worth naming on a card: senior FIRST team only. */
function cpIsSeniorClub(e: ClubDictEntry): boolean {
  return cpIsClubEntity(e) && !cpIsNationalTeam(e) && !cpIsYouthOrReserve(e) && !cpIsRepresentativeTeam(e);
}

// A national team's SECOND string ("France B national football team", "England
// national association football B team"). The B marker sits mid-label here, so the
// trailing-suffix rule above cannot see it. Scoped to national teams only — a bare
// \bB\b applied to clubs would wrongly exclude senior clubs containing "B".
const CP_NT_B_TEAM_RE = /\bB\b/;
// The dictionary also holds non-association-football national sides (rugby union,
// beach soccer, futsal), because candidate QIDs include non-footballers. None may
// ever source a football player's sporting nation.
const CP_NT_OTHER_SPORT_RE = /rugby|beach soccer|futsal|american football|field hockey|cricket/i;
const CP_NT_FOOTBALL_RE = /football|soccer/i;
// Olympic composites are NOT football sporting nations. "United Kingdom national
// association football team" (Team GB) is an Olympic-only side assembled from the
// four home nations and is not a FIFA member. Craig Bellamy — a Wales international
// — carries BOTH it and the Wales team, and it sorted first in his P54 order, so he
// was emitted as "United Kingdom" at green quality. Same class of UK modelling
// artifact as the P17 case, excluded for the same reason.
const CP_NT_COMPOSITE_RE = /^(united kingdom|great britain)\b|\bolympic\b/i;
// E1.1: NON-FIFA REPRESENTATIVE SIDES. Same class as the Team GB composite above,
// and the same failure: a side that is not a FIFA nation sourcing the sporting
// nation fact. The Basque Country side is the live case — Wikidata types it
// `men's national association football team` and, because its label says
// "regional" rather than "national", CP_NT_LABEL_RE cannot parse a name from it,
// so cpNationFromNationalTeam falls through to P17. The Basque Country spans two
// states and Q738846 carries **P17 = France**, so EIGHT Basque Spaniards —
// Xabi Alonso, Zubizarreta, Llorente, Javi Martínez, Illarramendi, Iván Campo,
// Mendieta, Julio Salinas — were emitted as "France", a nation none represented.
// Catalonia and Galicia are equally non-FIFA but carry P17 = Spain, so they
// happened to yield the right answer; they are excluded here anyway, because
// being right by luck is not a rule. With every regional side excluded these
// players fall through to P1532/P27, which both say Spain.
const CP_NT_NON_FIFA_RE = /\bregional\b|^(basque country|catalonia|galicia)\b/i;

// A SENIOR association-football national team — the only kind allowed to source the
// sporting-nation fact ("senior national team P54 if present").
function cpIsSeniorNationalTeam(e: ClubDictEntry): boolean {
  const label = e.label.trim();
  return (
    cpIsNationalTeam(e) &&
    !cpIsYouthOrReserve(e) &&
    !CP_NT_B_TEAM_RE.test(label) &&
    CP_NT_FOOTBALL_RE.test(label) &&
    !CP_NT_OTHER_SPORT_RE.test(label) &&
    !CP_NT_COMPOSITE_RE.test(label) &&
    !CP_NT_NON_FIFA_RE.test(label)
  );
}

// Extract the sporting nation from a senior national-team entity.
//
// P17 (country) alone is WRONG here: it names the sovereign state, but football's
// nations are not states. England, Scotland, Wales and Northern Ireland are four
// separate FIFA nations that ALL carry P17 = United Kingdom, which silently
// collapsed 115 players (Gareth Bale, a Wales international, was emitted as
// "United Kingdom" — a team he never played for).
//
// The team's own NAME alone is wrong too: "Canadian men's national soccer team"
// parses to the demonym "Canadian", not "Canada".
//
// So: trust P17 by default (accurate and clean for every sovereign nation), and use
// the team's name ONLY where P17 is provably too coarse — the United Kingdom case.
// That is one rule about a known Wikidata modelling choice covering a whole class,
// not per-player curation. If neither yields a name, return null (fail closed).
const CP_NT_LABEL_RE =
  /^(.*?)\s+(?:men's |women's )?national\s+(?:association\s+)?(?:football|soccer)\s+team$/i;
function cpNationFromNationalTeam(e: ClubDictEntry): string | null {
  const m = e.label.trim().match(CP_NT_LABEL_RE);
  const fromLabel = m ? m[1].trim() : null;
  if (e.country === "United Kingdom" && fromLabel) return fromLabel;
  return e.country || fromLabel;
}

// ── position mapping (P413 -> GK|DEF|MID|ATT) ────────────────────────────────
type CpPosition = "GK" | "DEF" | "MID" | "ATT";

// Map ONE P413 label to a bucket. Within a single label, order matters:
// "attacking midfielder" must resolve to MID (midfield beats attack), and
// "wing-back" must resolve to DEF without being caught by /winger/.
function cpMapPositionLabel(label: string): CpPosition | null {
  const s = label.toLowerCase().trim();
  if (!s) return null;
  if (/goalkeeper|goalie|keeper/.test(s)) return "GK";
  // Terms Wikidata ITSELF classifies as midfielder via P279 (subclass of):
  //   Q8025128 "wing half" -> midfielder   (95 of our 105 null positions)
  //   Q1201458 "playmaker" -> midfielder
  // Mapped on Wikidata's own subclass statement, NOT on football judgement. Many
  // players tagged "wing half" are plainly wingers (Bale, Neymar, Di María), but
  // reclassing them to ATT would be our opinion overriding the only sourced answer —
  // exactly what this ticket forbids. E2 can verify this mapping against P279.
  // "centerhalf" (Q1109563) has NO P279 parent, so it stays unmapped -> null.
  if (/\bwing half\b|\bplaymaker\b/.test(s)) return "MID";
  if (/midfield/.test(s)) return "MID";
  if (/\bback\b|back\b|defender|defence|defense|sweeper|libero/.test(s)) return "DEF";
  if (/forward|striker|winger|attack|centre-forward|center-forward/.test(s)) return "ATT";
  return null;
}

// Map a player's P413 value set. Each label is mapped INDEPENDENTLY — joining the
// labels into one string and running an ordered regex would let a global priority
// invent an answer Wikidata never gave.
//
// Wikidata frequently carries several equally-ranked P413 values that disagree
// (Pelé, Cruyff and Messi are each BOTH "midfielder" AND "forward" at NormalRank).
// There is no Wikidata answer to "which one wins", so we do not pretend there is:
// a genuine multi-bucket conflict is reported as AMBIGUOUS and flagged amber, with
// every candidate bucket recorded so E1 can decide (curation is out of scope here).
// `pick` exists only so the field is populated deterministically; the precedence
// GK > DEF > MID > ATT is arbitrary and carries no claim of correctness — consumers
// must read sourceQuality/positionCandidates, not trust `pick` blindly.
//
// NOTE: the caller passes wdt:P413 values, which are already rank-filtered by
// Wikidata (truthy = best rank), so a `preferred` value correctly wins upstream and
// only ties among equally-ranked values ever reach the ambiguity branch.
// A GENERIC P413 value names only a broad line; a SPECIFIC one names a role
// within it. "forward" is generic, "left winger" is specific (E1.1).
const CP_GENERIC_POSITION_RE = /^(forward|midfielder|defender|attacker|wing half)$/i;
const cpIsGenericPositionLabel = (l: string) => CP_GENERIC_POSITION_RE.test(l.trim());

// E1.1 — OWNER-RULED CONFLICT RESOLUTION (replaces E0's arbitrary precedence).
//
// E0 resolved conflicts by a GK > DEF > MID > ATT precedence it documented as
// "arbitrary and carr[ying] no claim of correctness", explicitly leaving the call
// to E1. That precedence always picks the least-attacking bucket, which emitted
// Messi, Cristiano Ronaldo, Pelé, Maradona, Cruyff, Salah and Rooney as MID and
// skewed the pool to 504 MID / 434 ATT. The owner ruled the rule below.
//
// Ranks cannot do this job: `wdt:` is already rank-filtered, and only 6 of 529
// statements across the selected set carry `preferred` — the conflicts are
// genuinely equal-rank. Statement ORDER cannot either: Ronaldo lists "wing half"
// BEFORE "forward".
//
// The pick is STILL not a sourced verdict — `ambiguous` and `candidates` are
// unchanged, and consumers must keep reading sourceQuality.
function cpMapPosition(
  labels: string[],
  debutYear: number | null,
): {
  pick: CpPosition | null;
  candidates: CpPosition[];
  ambiguous: boolean;
  artifactDropped: string[];
} {
  const mappable = labels.filter((l) => cpMapPositionLabel(l));
  const buckets = [...new Set(mappable.map(cpMapPositionLabel) as CpPosition[])];
  if (buckets.length === 0) return { pick: null, candidates: [], ambiguous: false, artifactDropped: [] };
  if (buckets.length === 1) {
    return { pick: buckets[0], candidates: buckets, ambiguous: false, artifactDropped: [] };
  }

  // (a) ARTIFACT: "wing half" is a 1930s half-back role. Wikidata editors attach it
  // to modern wingers (Ronaldo, Salah, Vinícius, Garrincha all carry it). Where the
  // player debuted in the modern era AND another statement survives, it is a mapping
  // artifact, not a claim. Dropped ONLY when something else remains — a player whose
  // only value is "wing half" keeps MID (Wikidata's own P279 answer), because
  // overriding a sole source would be inventing a fact.
  const modern = debutYear !== null && debutYear >= 1950;
  const survivors = mappable.filter((l) => !/^wing half$/i.test(l.trim()));
  const artifactDropped =
    modern && survivors.length > 0 && survivors.length < mappable.length ? ["wing half"] : [];
  const kept = artifactDropped.length > 0 ? survivors : mappable;

  // (b) SPECIFIC values outrank GENERIC ones: "full-back" beats a co-stated
  // "midfielder" (Zanetti, Alexander-Arnold stay DEF).
  const specific = kept.filter((l) => !cpIsGenericPositionLabel(l));
  const basis = specific.length > 0 ? specific : kept;
  const basisBuckets = [...new Set(basis.map(cpMapPositionLabel) as CpPosition[])];

  // (c) Remaining ties resolve to the MOST ATTACKING bucket.
  const order: CpPosition[] = ["ATT", "MID", "DEF", "GK"];
  const pick = order.find((b) => basisBuckets.includes(b)) || null;
  return { pick, candidates: buckets, ambiguous: true, artifactDropped };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-search: answerName (+acceptedAnswers) -> candidate QIDs
// ─────────────────────────────────────────────────────────────────────────────
async function cpSearchEntities(term: string): Promise<{ qid: string; label: string; description: string }[]> {
  const url =
    `${WD_API}?action=wbsearchentities&format=json&language=en&uselang=en&type=item&limit=10&search=` +
    encodeURIComponent(term);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { search?: any[] };
      return (json.search || []).map((s) => ({
        qid: s.id as string,
        label: (s.label as string) || "",
        description: (s.description as string) || "",
      }));
    } catch (err) {
      if (attempt === 4) throw err;
      await sleep(2 ** attempt * 1000);
    }
  }
  return [];
}

// Candidate prefilter. Non-footballers (books, given names, video games) carry no
// P54 and would be eliminated by the identity gate anyway; dropping them here only
// saves WDQS work. Entities with NO description are KEPT — an empty description is
// not evidence against personhood, and the club gate remains the real decider.
const CP_NONPERSON_DESC_RE =
  /\b(book|edition|album|song|film|movie|video game|family name|given name|surname|disambiguation|magazine|newspaper|painting|album by)\b/i;
const CP_FOOTBALL_DESC_RE = /footballer|football player|soccer|association football/i;
function cpKeepCandidate(c: { description: string }): boolean {
  if (!c.description.trim()) return true;
  if (CP_FOOTBALL_DESC_RE.test(c.description)) return true;
  return !CP_NONPERSON_DESC_RE.test(c.description);
}

async function cpSearch() {
  cpEnsureCache();
  const paths = cpUniverse();
  const cache = readJson<SearchCandidates[]>(CP_SEARCH_CACHE, []);
  const done = new Set(cache.map((c) => c.careerPathId));
  const pending = paths.filter((p) => !done.has(p.id));
  console.log(`cp-search: ${paths.length} career paths, ${pending.length} pending, ${cache.length} cached`);

  for (let i = 0; i < pending.length; i++) {
    const p = pending[i];
    // Search the answer name plus any accepted answers — different surface forms
    // (e.g. "Salinas" vs "Julio Salinas Fernández") surface different candidates.
    const terms = [p.answerName, ...(p.acceptedAnswers || [])];
    const byQid = new Map<string, { qid: string; label: string; description: string }>();
    for (const t of terms) {
      let hits: { qid: string; label: string; description: string }[];
      try {
        hits = await cpSearchEntities(t);
      } catch (err) {
        console.error(`  search "${t}" FAILED: ${String(err).slice(0, 80)}`);
        continue;
      }
      for (const h of hits) if (cpKeepCandidate(h) && !byQid.has(h.qid)) byQid.set(h.qid, h);
      await sleep(SEARCH_THROTTLE_MS);
    }
    cache.push({
      careerPathId: p.id,
      answerName: p.answerName,
      candidates: [...byQid.values()],
      retrievedAt: nowIso(),
    });
    if ((i + 1) % 50 === 0 || i === pending.length - 1) {
      writeJson(CP_SEARCH_CACHE, cache);
      console.log(`  ${i + 1}/${pending.length} searched (${cache.length} total)`);
    }
  }
  writeJson(CP_SEARCH_CACHE, cache);
  const noCand = cache.filter((c) => c.candidates.length === 0).length;
  const totalCands = cache.reduce((a, c) => a + c.candidates.length, 0);
  console.log(
    `cp-search DONE: ${cache.length} players, ${totalCands} candidates ` +
      `(avg ${(totalCands / Math.max(1, cache.length)).toFixed(1)}), ${noCand} with zero candidates`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-clubqids: candidate QIDs -> their P54 club QIDs (gate input, cheap)
// ─────────────────────────────────────────────────────────────────────────────
async function cpClubQids() {
  cpEnsureCache();
  const search = readJson<SearchCandidates[]>(CP_SEARCH_CACHE, []);
  if (search.length === 0) {
    console.error("no search cache — run `cp-search` first");
    process.exit(1);
  }
  const allQids = [...new Set(search.flatMap((s) => s.candidates.map((c) => c.qid)))];
  const cache = readJson<Record<string, string[]>>(CP_CLUBQIDS_CACHE, {});
  const pending = allQids.filter((q) => !(q in cache));
  console.log(`cp-clubqids: ${allQids.length} distinct candidate QIDs, ${pending.length} pending`);

  const chunks = chunk(pending, 200);
  for (let ci = 0; ci < chunks.length; ci++) {
    const values = chunks[ci].map((q) => `wd:${q}`).join(" ");
    // MUST use the full statement path (p:P54/ps:P54), NOT truthy wdt:P54.
    // wdt: exposes only BEST-RANK statements. Wikidata marks an active player's
    // CURRENT club as `preferred` rank, so wdt:P54 returns that club ALONE and hides
    // the whole career history (Messi -> Inter Miami only; Ronaldo -> Al-Nassr only).
    // Retired players have no preferred statement, so they look fine — which makes
    // this fail silently and only for active players, starving the identity gate of
    // the very club evidence it needs. p:/ps: returns every statement, any rank.
    const query = `SELECT ?p ?club WHERE { VALUES ?p { ${values} } ?p p:P54 ?s. ?s ps:P54 ?club. }`;
    let rows: any[];
    try {
      rows = await sparql(query, 90000);
    } catch (err) {
      console.error(`  chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 100)}`);
      continue;
    }
    // Seed every QID in the chunk (including those with zero P54) so reruns skip them.
    for (const q of chunks[ci]) cache[q] = cache[q] || [];
    for (const r of rows) {
      const p = qidOf(r.p.value);
      const club = qidOf(r.club.value);
      if (!cache[p].includes(club)) cache[p].push(club);
    }
    writeJson(CP_CLUBQIDS_CACHE, cache);
    if ((ci + 1) % 5 === 0 || ci === chunks.length - 1) {
      console.log(`  chunk ${ci + 1}/${chunks.length}`);
    }
  }
  const withClubs = Object.values(cache).filter((v) => v.length > 0).length;
  console.log(`cp-clubqids DONE: ${Object.keys(cache).length} QIDs, ${withClubs} have >=1 P54 club`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-clubdict: distinct club QIDs -> label / altLabels / P31 types / P17
// ─────────────────────────────────────────────────────────────────────────────
// `extraQids` lets cp-facts top the dictionary up with clubs first seen on
// qualifier-bearing statements, without round-tripping them through the cache file.
async function cpClubDict(extraQids: string[] = []) {
  cpEnsureCache();
  const clubQids = readJson<Record<string, string[]>>(CP_CLUBQIDS_CACHE, {});
  const all = [...new Set([...Object.values(clubQids).flat(), ...extraQids])];
  const cache = readJson<Record<string, ClubDictEntry>>(CP_CLUBDICT_CACHE, {});
  const pending = all.filter((q) => !(q in cache));
  console.log(`cp-clubdict: ${all.length} distinct club QIDs, ${pending.length} pending`);

  const chunks = chunk(pending, 150);
  for (let ci = 0; ci < chunks.length; ci++) {
    const values = chunks[ci].map((q) => `wd:${q}`).join(" ");
    const query = `SELECT ?c ?cLabel (GROUP_CONCAT(DISTINCT ?a;separator="||") AS ?aliases) (GROUP_CONCAT(DISTINCT ?t;separator="||") AS ?types) (SAMPLE(?ctry) AS ?country) WHERE {
  VALUES ?c { ${values} }
  ?c rdfs:label ?cLabel. FILTER(LANG(?cLabel)="en")
  OPTIONAL { ?c skos:altLabel ?a. FILTER(LANG(?a)="en") }
  OPTIONAL { ?c wdt:P31 ?tE. ?tE rdfs:label ?t. FILTER(LANG(?t)="en") }
  OPTIONAL { ?c wdt:P17 ?ctryE. ?ctryE rdfs:label ?ctry. FILTER(LANG(?ctry)="en") }
} GROUP BY ?c ?cLabel`;
    let rows: any[];
    try {
      rows = await sparql(query, 90000);
    } catch (err) {
      console.error(`  chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 100)}`);
      continue;
    }
    const ts = nowIso();
    for (const r of rows) {
      const qid = qidOf(r.c.value);
      cache[qid] = {
        qid,
        label: r.cLabel.value,
        aliases: r.aliases?.value ? r.aliases.value.split("||").filter(Boolean) : [],
        types: r.types?.value ? r.types.value.split("||").filter(Boolean) : [],
        country: r.country?.value || null,
        retrievedAt: ts,
      };
    }
    writeJson(CP_CLUBDICT_CACHE, cache);
    if ((ci + 1) % 5 === 0 || ci === chunks.length - 1) console.log(`  chunk ${ci + 1}/${chunks.length}`);
  }
  console.log(`cp-clubdict DONE: ${Object.keys(cache).length} clubs described`);
}

// ─────────────────────────────────────────────────────────────────────────────
// IDENTITY GATE (pure) — the core safety rule of this ticket
// ─────────────────────────────────────────────────────────────────────────────
// Accept a QID only if >=2 of the player's Career Path clubs match that entity's
// P54 club memberships. 1 match => AMBER-identity. 0 => UNRESOLVED (excluded).
// Name similarity ALONE is never sufficient — homonyms ("Ronaldo" ranks Cristiano
// above Ronaldo Nazário in search) are the failure mode this gate exists to stop.
interface GateResult {
  careerPathId: string;
  answerName: string;
  origin: "career-path" | "manual";
  qid: string | null;
  matchedClubs: string[];
  matchCount: number;
  status: "resolved" | "amber-identity" | "unresolved";
  unmatchedClubNames: string[];
  ownerRuling?: { qid: string; verdict: "green"; ruledOn: string; note: string };
}

function cpRunGate(): GateResult[] {
  const paths = cpUniverse();
  const search = readJson<SearchCandidates[]>(CP_SEARCH_CACHE, []);
  const clubQids = readJson<Record<string, string[]>>(CP_CLUBQIDS_CACHE, {});
  const clubDict = readJson<Record<string, ClubDictEntry>>(CP_CLUBDICT_CACHE, {});
  const aliasTable = cpLoadAliasTable();
  const searchById = new Map(search.map((s) => [s.careerPathId, s]));

  const out: GateResult[] = [];
  for (const p of paths) {
    const s = searchById.get(p.id);
    const cands = s?.candidates || [];
    // DISTINCT club names only. A career path can list the same club twice (e.g.
    // cp-beckham has two AC Milan loan spells); counting both would let a SINGLE
    // real club clear the ">=2 clubs" gate. Dedupe on the normalized name.
    const distinctClubs: string[] = [];
    const seenClub = new Set<string>();
    for (const entry of p.clubs) {
      const name = cpClubEntryName(entry);
      const key = norm(name);
      if (!key || seenClub.has(key)) continue;
      seenClub.add(key);
      distinctClubs.push(name);
    }
    // Score every candidate by how many DISTINCT Career Path clubs appear in that
    // candidate's P54 set. Highest match count wins; ties are rejected as
    // unresolvable (we cannot tell the homonyms apart on club evidence).
    const scored = cands
      .map((c) => {
        const entityClubNames = (clubQids[c.qid] || [])
          .map((cq) => clubDict[cq])
          .filter(Boolean)
          .map((e) => cpClubNamesOf(e));
        const matched: string[] = [];
        for (const cpClub of distinctClubs) {
          const accepted = cpAcceptedNames(cpClub, aliasTable);
          const hit = entityClubNames.some((names) => [...accepted].some((a) => names.has(a)));
          if (hit) matched.push(cpClub);
        }
        return { qid: c.qid, matched };
      })
      .sort((a, b) => b.matched.length - a.matched.length);

    const best = scored[0];
    const second = scored[1];
    if (!best || best.matched.length === 0) {
      out.push({
        careerPathId: p.id,
        answerName: p.answerName,
        origin: p.origin || "career-path",
        qid: null,
        matchedClubs: [],
        matchCount: 0,
        status: "unresolved",
        unmatchedClubNames: distinctClubs,
      });
      continue;
    }
    // Ambiguous tie between two candidates on identical club evidence => refuse.
    if (second && second.matched.length === best.matched.length) {
      out.push({
        careerPathId: p.id,
        answerName: p.answerName,
        origin: p.origin || "career-path",
        qid: null,
        matchedClubs: [],
        matchCount: 0,
        status: "unresolved",
        unmatchedClubNames: distinctClubs,
      });
      continue;
    }
    // ── E0.1: owner-anchored gate for manual additions ──
    // The owner's anchors are a HYPOTHESIS; Wikidata is the test. EVERY anchor must
    // be confirmed in the entity's P54 or the entry is UNRESOLVED — a partially
    // confirmed assertion is never forced through. A lone confirmed anchor yields
    // AMBER-identity, never `resolved`: one club cannot separate players who share a
    // surname AND that club (Cesare / Paolo / Daniel Maldini all played for AC Milan),
    // and deciding on name similarity is exactly what this gate exists to prevent.
    if (p.origin === "manual") {
      const anchors = distinctClubs;
      const allConfirmed = anchors.length > 0 && best.matched.length === anchors.length;
      if (!allConfirmed) {
        out.push({
          careerPathId: p.id,
          answerName: p.answerName,
          origin: "manual",
          qid: null,
          matchedClubs: best.matched,
          matchCount: best.matched.length,
          status: "unresolved",
          unmatchedClubNames: anchors.filter((c) => !best.matched.includes(c)),
        });
        continue;
      }
      // E1.1: an owner ruling can resolve a single-anchor identity, but ONLY for the
      // exact QID it names. A ruling pinned to a different entity than the gate chose
      // is ignored (and reported) rather than applied to whatever won — the whole
      // point of pinning the QID is that the ruling cannot drift onto a homonym.
      const ruling = p.ownerRuling;
      const ruled = Boolean(ruling && ruling.verdict === "green" && ruling.qid === best.qid);
      if (ruling && !ruled) {
        console.warn(
          `  [owner-ruling IGNORED] ${p.answerName}: ruling names ${ruling.qid}, gate selected ${best.qid}`,
        );
      }
      out.push({
        careerPathId: p.id,
        answerName: p.answerName,
        origin: "manual",
        qid: best.qid,
        matchedClubs: best.matched,
        matchCount: best.matched.length,
        // >=2 confirmed anchors earns `resolved`; a single confirmed anchor stays
        // AMBER unless an explicit owner ruling names this exact QID (E1.1).
        status: anchors.length >= 2 || ruled ? "resolved" : "amber-identity",
        ...(ruled ? { ownerRuling: ruling } : {}),
        unmatchedClubNames: [],
      });
      continue;
    }

    out.push({
      careerPathId: p.id,
      answerName: p.answerName,
      origin: p.origin || "career-path",
      qid: best.qid,
      matchedClubs: best.matched,
      matchCount: best.matched.length,
      status: best.matched.length >= 2 ? "resolved" : "amber-identity",
      unmatchedClubNames: distinctClubs.filter((c) => !best.matched.includes(c)),
    });
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-facts: fetch facts for gate winners only
// ─────────────────────────────────────────────────────────────────────────────
async function cpFacts() {
  cpEnsureCache();
  const gate = cpRunGate();
  const winners = [...new Set(gate.filter((g) => g.qid).map((g) => g.qid as string))];
  const cache = readJson<Record<string, RawFacts>>(CP_FACTS_CACHE, {});
  // E1.1 cache migration: an entry without `birthYear` predates the P569 fetch
  // and must be re-pulled, or debutYear silently keeps its youth-club value.
  // E0.2 migration: an entry below CP_FACTS_SCHEMA predates the statement-level
  // P413 fetch and still carries best-rank-only positions.
  const pending = winners.filter(
    (q) =>
      !(q in cache) ||
      cache[q].birthYear === undefined ||
      (cache[q].schemaVersion ?? 1) < CP_FACTS_SCHEMA,
  );
  console.log(`cp-facts: ${winners.length} gated QIDs, ${pending.length} pending`);

  const chunks = chunk(pending, 80);
  for (let ci = 0; ci < chunks.length; ci++) {
    const values = chunks[ci].map((q) => `wd:${q}`).join(" ");
    const ts = nowIso();
    for (const q of chunks[ci]) {
      // RESET, never `||=`: a re-fetched entry that kept its old array would have
      // every membership pushed twice (the E1.1 P569 migration re-pulls entries
      // that already exist).
      cache[q] = {
        qid: q,
        memberships: [],
        positions: [],
        countryForSport: null,
        citizenships: [],
        birthYear: null,
        schemaVersion: CP_FACTS_SCHEMA,
        retrievedAt: ts,
      };
    }

    // P54 statements WITH start/end qualifiers (debutYear needs statement-level P580).
    const memQuery = `SELECT ?p ?club ?start ?end WHERE {
  VALUES ?p { ${values} }
  ?p p:P54 ?s. ?s ps:P54 ?club.
  OPTIONAL { ?s pq:P580 ?start }
  OPTIONAL { ?s pq:P582 ?end }
}`;
    // E0.2 — P413 MUST be read statement-level. `wdt:P413` is the truthy predicate:
    // it returns BEST-RANK values only, so a normal-rank position is invisible when
    // any preferred-rank statement exists. That silently suppressed real ambiguity
    // and shipped it as green: Ronaldinho recorded [winger] while Wikidata holds
    // {winger, attacking midfielder}; Endo recorded [defensive midfielder] against
    // {defensive midfielder, defender}. Deprecated statements ARE excluded — a
    // deprecated rank is an editorial retraction, the one rank that carries a claim
    // about correctness. Everything else is emitted as a candidate.
    const posQuery = `SELECT ?p ?posL WHERE {
  VALUES ?p { ${values} }
  ?p p:P413 ?st. ?st ps:P413 ?pos.
  FILTER NOT EXISTS { ?st wikibase:rank wikibase:DeprecatedRank }
  ?pos rdfs:label ?posL. FILTER(LANG(?posL)="en")
}`;
    // Scalars: P1532 country for sport, P27 citizenship,
    // P569 date of birth (E1.1 — the age floor debutYear is derived against).
    const scalarQuery = `SELECT ?p (GROUP_CONCAT(DISTINCT ?cfsL;separator="||") AS ?cfs) (GROUP_CONCAT(DISTINCT ?natL;separator="||") AS ?nats) (MIN(?dob) AS ?born) WHERE {
  VALUES ?p { ${values} }
  OPTIONAL { ?p wdt:P1532 ?cfsE. ?cfsE rdfs:label ?cfsL. FILTER(LANG(?cfsL)="en") }
  OPTIONAL { ?p wdt:P27 ?natE. ?natE rdfs:label ?natL. FILTER(LANG(?natL)="en") }
  OPTIONAL { ?p wdt:P569 ?dob }
} GROUP BY ?p`;

    try {
      const memRows = await sparql(memQuery, 90000);
      for (const r of memRows) {
        const p = qidOf(r.p.value);
        if (!cache[p]) continue;
        cache[p].memberships.push({
          clubQid: qidOf(r.club.value),
          start: yr(r.start?.value),
          end: yr(r.end?.value),
        });
      }
      const posRows = await sparql(posQuery, 90000);
      for (const r of posRows) {
        const p = qidOf(r.p.value);
        if (!cache[p]) continue;
        const label = r.posL?.value;
        if (label && !cache[p].positions.includes(label)) cache[p].positions.push(label);
      }
      const scRows = await sparql(scalarQuery, 90000);
      for (const r of scRows) {
        const p = qidOf(r.p.value);
        if (!cache[p]) continue;
        cache[p].countryForSport = r.cfs?.value ? r.cfs.value.split("||")[0] : null;
        cache[p].citizenships = r.nats?.value ? r.nats.value.split("||").filter(Boolean) : [];
        const born = yr(r.born?.value);
        const bornN = born === null ? NaN : Number(born);
        cache[p].birthYear =
          Number.isFinite(bornN) && bornN >= 1850 && bornN <= CP_MAX_PLAUSIBLE_DEBUT ? bornN : null;
      }
      // SPARQL row order is not guaranteed, and `positions` is now assembled row by
      // row rather than by GROUP_CONCAT. Sort so a refetch is byte-reproducible —
      // cp-assert compares the emitted file exactly. Order carries no meaning: it
      // cannot disambiguate a conflict (Ronaldo lists "wing half" before "forward").
      for (const q of chunks[ci]) cache[q]?.positions.sort();
    } catch (err) {
      console.error(`  chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 100)}`);
      for (const q of chunks[ci]) delete cache[q]; // leave undone; rerun resumes
      continue;
    }
    writeJson(CP_FACTS_CACHE, cache);
    if ((ci + 1) % 5 === 0 || ci === chunks.length - 1) console.log(`  chunk ${ci + 1}/${chunks.length}`);
  }

  // Newly-referenced club QIDs (from qualifier-bearing statements) may not be in the
  // dict yet; top it up so cp-emit can classify every membership.
  const clubDict = readJson<Record<string, ClubDictEntry>>(CP_CLUBDICT_CACHE, {});
  const missing = [
    ...new Set(
      Object.values(cache)
        .flatMap((f) => f.memberships.map((m) => m.clubQid))
        .filter((q) => !(q in clubDict)),
    ),
  ];
  if (missing.length > 0) {
    console.log(`  topping up club dict with ${missing.length} newly-seen clubs`);
    await cpClubDict(missing);
  }
  console.log(`cp-facts DONE: ${Object.keys(cache).length} players with raw facts`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-emit: playersSourced.json (pure — the provenance contract)
// ─────────────────────────────────────────────────────────────────────────────
type SourceQuality = "green" | "amber";
interface SourceRef {
  qid: string;
  property: string;
  retrievedAt: string;
}
interface SourcedFact<T> {
  value: T;
  source: SourceRef;
  sourceQuality: SourceQuality;
}
// E0.2 — ONE SPELL PER P54 STATEMENT. NEVER MERGED.
//
// E1.1 collapsed every statement for a club into a min(start)/max(end) hull, which
// E2 measured as the dominant defect in the shipped set: 207 of 1260 memberships
// (16.4%) across 170 of 430 cards merged 2+ statements, and 158 of them across 138
// cards were AFFIRMATIVELY FALSE — another club occupies the gap the hull paves
// over. The artifact asserted Cristiano Ronaldo at Manchester United 2003-2022
// (through Real Madrid and Juventus), Maradona at Boca 1981-1997 (through Barcelona
// and Napoli), Pat Jennings at Tottenham 1964-1986 (through eight years at ARSENAL).
// No source asserts any of those: the card contradicted its OWN cited provenance.
//
// A hull is not a fact about a career, it is an artifact of the shape it was stored
// in. `spells` is the fact: each entry is exactly one P54 statement's P580/P582.
// A returning player (Beckham's two AC Milan loans, Pogba's two Manchester United
// spells) carries two spells and always did — only the shape hid it.
//
// `start` is clamped to the player's 16th year so an academy P580 cannot inflate a
// tenure; `end` null means the spell is open (still at the club, or an unknown-value
// node — Wikidata serves those as a genid URL, which parses to null, not a year).
interface CpSpell {
  start: number | null;
  end: number | null;
}
interface SourcedClub extends SourcedFact<string> {
  clubQid: string;
  spells: CpSpell[];
}
interface SourcedPlayer {
  careerPathId: string;
  answerName: string;
  // E0.1: "manual" entries came from playerAdditions.json (owner-anchored identity),
  // not from the Career Path universe. Facts are sourced identically either way.
  origin: "career-path" | "manual";
  qid: string;
  facts: {
    nation: SourcedFact<string> | null;
    position: SourcedFact<CpPosition> | null;
    // E0.5: earliest senior-club membership START, not a debut claim — see the
    // derivation and cpErasedCareerLog. Renamed from debutYear across canonical,
    // dossier and selector so no artifact publishes a debut it cannot source.
    sourceStartYear: SourcedFact<number> | null;
    // E1.1: P569. Not a card fact — published because sourceStartYear is DERIVED
    // against it, so a verifier cannot re-check the value without seeing the anchor.
    birthYear: SourcedFact<number> | null;
    clubs: SourcedClub[];
  };
  identityEvidence: {
    matchedClubs: string[];
    matchCount: number;
    status: "resolved" | "amber-identity";
    // E1.1: set when an explicit owner ruling in playerAdditions.json resolved an
    // identity the club-anchor gate could not. The evidence is unchanged — this
    // records WHO decided, so the call is never mistaken for a sourced verdict.
    ownerRuling?: { qid: string; verdict: "green"; ruledOn: string; note: string };
    nationPath?: "national-team" | "P1532" | "P27";
    // E0.2: ALWAYS present (was: only when P413 conflicted). Every bucket P413
    // supports, so `facts.position.value` can always be read against the full
    // sourced choice. >1 entry means the value is a deterministic pick, NOT a
    // sourced verdict — read sourceQuality.
    positionCandidates: CpPosition[];
    // Present only when the player has >1 senior national team (dual internationals).
    // `facts.nation.value` is then a deterministic pick, NOT a sourced verdict.
    nationCandidates?: string[];
    // E1.1: every raw P413 label, verbatim, and any dropped as a known artifact.
    positionStatements?: string[];
    positionArtifactDropped?: string[];
  };
  volatility: "static";
}

function cpEmit(write = true): { players: SourcedPlayer[]; gate: GateResult[] } {
  // cp-assert re-runs this in-process; the logs must not accumulate across passes.
  cpPhantomLog.length = 0;
  cpNationRulingLog.length = 0;
  cpErasedCareerLog.length = 0;
  const gate = cpRunGate();
  const facts = readJson<Record<string, RawFacts>>(CP_FACTS_CACHE, {});
  const clubDict = readJson<Record<string, ClubDictEntry>>(CP_CLUBDICT_CACHE, {});
  const players: SourcedPlayer[] = [];

  for (const g of gate) {
    if (!g.qid) continue;
    const raw = facts[g.qid];
    if (!raw) continue;
    // If the IDENTITY itself is amber (only one club matched), every fact inherits
    // amber: a fact is only as trustworthy as the entity it was read from.
    const identityAmber = g.status === "amber-identity";
    const q = (base: SourceQuality): SourceQuality => (identityAmber ? "amber" : base);
    const ref = (property: string): SourceRef => ({
      qid: g.qid as string,
      property,
      retrievedAt: raw.retrievedAt,
    });

    // ── birthYear (P569): not a card fact — the anchor debutYear is derived against ──
    const born = raw.birthYear ?? null;
    const birthYear: SourcedFact<number> | null =
      born !== null ? { value: born, source: ref("P569"), sourceQuality: q("green") } : null;
    // A membership only reaches senior football from the player's 16th year — FIFA's
    // minimum professional contract age, and the floor below which a P580 cannot be
    // describing senior football at all.
    const seniorFrom = born !== null ? born + CP_MIN_DEBUT_AGE : null;
    const startOf = (m: { start: string | null }) => {
      const n = Number(m.start);
      return m.start && Number.isFinite(n) && n >= CP_MIN_PLAUSIBLE_DEBUT && n <= CP_MAX_PLAUSIBLE_DEBUT
        ? n
        : null;
    };
    const endOf = (m: { end: string | null }) => {
      const n = Number(m.end);
      return m.end && Number.isFinite(n) ? n : null;
    };

    // ── clubs: P54 first teams the player actually played SENIOR football for ──
    // E1.1: a membership that both starts AND ends before the player turned 16 is an
    // academy stint, not senior football, and the ticket's fact is "has played senior
    // football for this club". Messi's Newell's Old Boys spell (1995-2000, ages 8-13)
    // is a real P54 statement about a real senior club — and he never played a senior
    // minute for them. A membership that merely STARTS early is kept: Wikidata records
    // academy entry as the club start, so Busquets' Barcelona is P580=2000 (age 12)
    // through 2023, and dropping it would delete his actual career.
    const seen = new Map<string, { clubQid: string; label: string; spells: CpSpell[] }>();
    for (const m of raw.memberships) {
      const e = clubDict[m.clubQid];
      // E0.2 item 5 — PHANTOM PROVENANCE. A membership whose club QID does not
      // resolve to a described entity cannot be published as sourced: the ref is
      // the provenance, and an unresolvable ref is a claim with no source behind
      // it. Dropped and logged (cpPhantomLog), never silently skipped.
      if (!e || cpIsPhantomEntity(e)) {
        cpPhantomLog.push({
          qid: g.qid as string,
          name: g.answerName,
          clubQid: m.clubQid,
          start: m.start,
          end: m.end,
        });
        continue;
      }
      if (!cpIsSeniorClub(e)) continue;
      const rawEnd = endOf(m);
      if (seniorFrom !== null && rawEnd !== null && rawEnd < seniorFrom) continue; // pre-16 academy stint only
      const rawStart = startOf(m);
      const start = rawStart === null ? null : seniorFrom === null ? rawStart : Math.max(rawStart, seniorFrom);
      const spell: CpSpell = { start, end: rawEnd };
      const prev = seen.get(m.clubQid);
      // ONE SPELL PER STATEMENT — never merged. See CpSpell.
      if (!prev) seen.set(m.clubQid, { clubQid: m.clubQid, label: e.label, spells: [spell] });
      else prev.spells.push(spell);
    }
    const clubs: SourcedClub[] = [...seen.values()].map((i) => ({
      value: i.label,
      clubQid: i.clubQid,
      // Deterministic order: a club's statements arrive in arbitrary SPARQL order,
      // and cp-assert compares the emitted file byte for byte.
      spells: i.spells.sort((a, b) => (a.start ?? -1) - (b.start ?? -1) || (a.end ?? 1e9) - (b.end ?? 1e9)),
      source: ref("P54"),
      sourceQuality: q("green"),
    }));

    // ── sourceStartYear: earliest senior-club P580, clamped to the player's 16th year ──
    // Wikidata carries placeholder start times: Roberto Carlos (Q429039) has a real
    // P580 of "0001-01-01T00:00:00Z", which min()'d straight through to debutYear=1.
    // Discard values outside the plausible range rather than propagate a sentinel as
    // a sourced fact. The floor is set at football's codification era, NOT trimmed to
    // this dataset — Ricardo Zamora (1914) and Larbi Benbarek (1935) are genuine early
    // debuts and must survive. If every start is implausible, debutYear is null.
    //
    // E1.1 — THE AGE FLOOR. P54 covers a player's whole club history INCLUDING the
    // academy, so a bare min() over starts is a youth-entry date, not a debut: 71 of
    // 1308 players (5.4%) debuted at an impossible age — Messi 1995 (aged 8), Pelé
    // 1953 (13), De Bruyne 1995 (4), Eriksen 1995 (3). Without P569 there is no floor
    // to apply, so the value stays as-sourced and is flagged amber rather than guessed.
    //
    // E0.2 — reserve/B sides are now EXCLUDED (cpCountsForDebut === cpIsSeniorClub):
    // debutYear is the FIRST-TEAM debut. See cpCountsForDebut for the measurement.
    //
    // E0.6 — CLAMP, NOT DISCARD. sourceStartYear = min over senior first-team starts of
    // max(start, born+16). This REPLACES the E0.2/E0.5 age-16 FILTER (which discarded a
    // sub-16 statement whole). The two differ only when a player's EARLIEST senior start
    // is sub-16: the filter skipped it and surfaced the next membership at/after 16 —
    // often a later transfer — while the clamp anchors that earliest statement to born+16.
    // So `min(clamped)` = max(earliestSeniorStart, born+16): the earliest career point,
    // floored to age 16, never deleted.
    //
    // WHY THE FILTER'S OBJECTION NO LONGER HOLDS. E0.2 kept the filter because the clamped
    // reading "regresses" debut ACCURACY (Piqué 2004->2003, ter Stegen 2011->2008, Xabi
    // Alonso 1999->1997 — an academy P580 on the first-team QID floored to born+16). But
    // E0.5 REDEFINED this field: it is not a debut and no date is published. The only
    // thing it decides is the ERA BUCKET (eraYear -> peakYear := eraYear+5 -> eraIndex),
    // and none of those three cross a bucket (2004/2003 both era2, 2011/2008 both era3,
    // 1999/1997 both era2). What the discard DID cost was worse: it let an early academy
    // statement delete the earliest career point and promote a later transfer across a
    // bucket (Agüero surfaced 2006/Atlético, era3, when his Independiente start is 2003).
    // The clamp fixes that class at the rule and removes the Busquets special-case: his
    // FC Barcelona P580=2000 now clamps to born+16=2004 (was discarded to Inter Miami
    // 2023). 2004 is still his academy age, not a debut, so his signed debut ruling (2008)
    // stands — but the rule output is now off by a bucket, not by a career.
    //
    // The COST is stated plainly and reported in full (buildDrawCardSet BUILD_NOTES §E0.6
    // clamp delta): the clamp files a late-blooming player whose earliest senior statement
    // is a sub-16 academy entry one era EARLIER. Seven pool players cross a bucket (Falcao,
    // David Luiz, van Bommel, Agüero, Busquets, Kaladze, Javi Martínez); Agüero and
    // Busquets are held by an override/ruling, the rest move. This is the definition the
    // owner chose (E0.6 item 4): a sub-16 debut is a curiosity, and born+16 — not the
    // curiosity year, and not a later transfer — is the anchor.
    //
    // The placeholder-year guard (Roberto Carlos P580=year 0001) and the birthYear-null
    // amber path (no born => no floor to clamp to => as-sourced min, flagged amber) are
    // unchanged from E1.1.
    const starts = raw.memberships
      .filter((m) => {
        const e = clubDict[m.clubQid];
        if (!e || !cpCountsForDebut(e)) return false;
        return startOf(m) !== null;
      })
      // E0.6 — CLAMP, not discard. A senior first-team membership whose P580 predates
      // the player's 16th year is anchored to born+16 rather than thrown away. The
      // clamp is `max(membershipStart, born+16)`, so `Math.min` over the clamped starts
      // is `max(earliestSeniorStart, born+16)` — the earliest senior career point,
      // floored to age 16. This replaces the age-16 FILTER (see the block above): the
      // filter DISCARDED a sub-16 statement whole, which let an academy-on-first-team
      // P580 delete the earliest career point and promote a later transfer to the
      // anchor (Agüero surfaced 2006/Atlético, his real Independiente start 2003 gone).
      // Careers are never deleted for an early statement now; only clamped.
      .map((m) => {
        const s = startOf(m) as number;
        return seniorFrom === null ? s : Math.max(s, seniorFrom);
      });
    // E0.5 — RENAMED debutYear -> sourceStartYear. This is the earliest senior-club
    // P54 membership START (age >= 16, first teams only) — NOT a competitive-debut
    // claim. E2.1's blind verify confirmed the two differ systematically: ~25% of
    // checked cards had a signing/registration/academy/reserve/friendly year sitting
    // where a debut was assumed. The field keeps its derivation; only its NAME and
    // its published meaning change, so no card asserts a debut it cannot source.
    const sourceStartCandidate: SourcedFact<number> | null =
      starts.length > 0
        ? {
            value: Math.min(...starts),
            source: ref(seniorFrom !== null ? "P54/P580+P569" : "P54/P580"),
            sourceQuality: seniorFrom !== null ? q("green") : "amber",
          }
        : null;

    // E0.5 — FAIL CLOSED on an ERASED EARLIEST CAREER (the van der Sar class; E2.1
    // V1d flagged the E0.2 fix as never landed). A malformed non-club membership
    // (real entity, not a football club, not a national team, not a phantom) whose
    // START predates the surviving earliest senior start means the true first career
    // point was silently deleted by cpIsClubEntity's allow-list, and a later transfer
    // became sourceStartYear. Edwin van der Sar's Ajax years (1990-1999) are filed
    // under Q1492 = Barcelona the CITY, so 1999 (his Juventus transfer) surfaced as
    // the start, one era bucket too late. No rule reading only P54 can recover the
    // real start from a statement pointing at the wrong entity, so the value is
    // nulled and the card fails out of the pool — the honest outcome, not a guess.
    // De Bruyne is caught too (a Romanian commune + a pharmacy business predate his
    // Genk start); his card was right by luck, and "right by luck" is not sourceable.
    // "Malformed" is narrow ON PURPOSE. It is NOT any excluded statement — a youth
    // side, an academy or a national team is a PRINCIPLED exclusion that erases no
    // senior career, so those are cleared first. What remains is a statement pointing
    // at an entity that is not football at all (a city, a commune, a business): the
    // club slot is genuinely mis-targeted, and only then can an early membership have
    // been silently deleted. Without the youth clear, Eriksen ("Ajax Youth Academy",
    // typed job-training) and Donovan ("IMG Soccer Academy") would drop on legitimate
    // academy stints — false positives the E0.2 filter already excludes correctly.
    const malformedNonClubStarts = raw.memberships
      .map((m) => ({ e: clubDict[m.clubQid], s: startOf(m) }))
      .filter(
        (r) =>
          r.e &&
          r.s !== null &&
          !cpIsPhantomEntity(r.e) &&
          !cpIsClubEntity(r.e) &&
          !cpIsNationalTeam(r.e) &&
          !cpIsYouthOrReserve(r.e),
      )
      .map((r) => r.s as number);
    const erasesEarliestCareer =
      sourceStartCandidate !== null && malformedNonClubStarts.some((s) => s < sourceStartCandidate.value);
    if (erasesEarliestCareer)
      cpErasedCareerLog.push({
        qid: g.qid as string,
        name: g.answerName,
        sourceStartWas: sourceStartCandidate!.value,
        malformedStarts: [...new Set(malformedNonClubStarts)].sort((a, b) => a - b),
      });
    const sourceStartYear: SourcedFact<number> | null = erasesEarliestCareer ? null : sourceStartCandidate;

    // ── nation (sporting): senior national team P54 > P1532 > P27(amber) ──
    let nation: SourcedFact<string> | null = null;
    let nationPath: "national-team" | "P1532" | "P27" | undefined;
    let nationCandidates: string[] | undefined;
    // Collect EVERY senior national team, not the first in P54 order. Membership
    // order is arbitrary, so `find()` silently let whichever statement happened to
    // sort first decide the nation. A player with two senior teams (dual
    // internationals) is genuinely ambiguous: pick deterministically, flag amber and
    // record the candidates, exactly as conflicting P413 values are handled.
    // E0.2 item 4 — a dual international resolves to his MOST RECENT senior national
    // team, from the sourced P580/P582 on the P54 statement itself. E1.1 took
    // `.sort()[0]`, i.e. alphabetical order: Diego Costa is "Brazil" (2 friendlies,
    // 2013) rather than Spain (24 caps, two World Cups) purely because B precedes S.
    // Alphabetical order is not a fact about a career; recency is at least sourced.
    //
    // The ticket says "most recent senior COMPETITIVE national team". COMPETITIVE is
    // NOT derivable from P54: the statement carries the team, the start and the end,
    // and nothing about whether the caps were friendlies or a World Cup. Rather than
    // invent a proxy, recency alone decides and every candidate is recorded with its
    // span; a tie on recency is unresolvable by the rule and goes to the owner list.
    // This is exactly the England-friendlies-then-switch case FIFA eligibility turns
    // on (Zaha, Diego Costa), so recency and "competitive" agree in practice — but
    // that agreement is a coincidence of the data, not something this rule verifies.
    const natRows = raw.memberships
      .map((m) => ({ m, e: clubDict[m.clubQid] }))
      .filter((r): r is { m: (typeof raw.memberships)[number]; e: ClubDictEntry } =>
        Boolean(r.e) && cpIsSeniorNationalTeam(r.e),
      )
      .map((r) => ({ nation: cpNationFromNationalTeam(r.e), start: startOf(r.m), end: endOf(r.m) }))
      .filter((r): r is { nation: string; start: number | null; end: number | null } => Boolean(r.nation));
    // An open span (still in the squad — or an unknown-value node, which parses to
    // null exactly as an open one does) is the most recent thing there is.
    const recencyOf = (r: { start: number | null; end: number | null }) =>
      r.end !== null ? r.end : r.start !== null ? CP_MAX_PLAUSIBLE_DEBUT : -1;

    // COACHING CONTAMINATION. P54 is "member of sports team", and Wikidata files a
    // manager's spell under it too: László Kubala carries "Paraguay men's national
    // football team 1995-1995" — he MANAGED Paraguay at 68, having last kicked a ball
    // in the 1960s — plus "Spain 1969-1980", also as manager. Recency reads those as
    // his nation and emits Kubala/Paraguay. (E1.1's alphabetical pick got him right
    // by luck, which is not a rule.)
    //
    // "COMPETITIVE" in the ticket means the player COMPETED for them, so require the
    // national span to overlap his own senior club career — both sides sourced P54
    // spans, no threshold and no judgement. Kubala's Paraguay and Spain-as-manager
    // spells fall outside his club career and drop; his playing Spain spell (1953-61,
    // 19 caps) survives and wins on recency. Puskás keeps Spain (1961-62 overlaps
    // Real Madrid) — that IS the rule's answer, and it is on the owner list because
    // the rule cannot know Hungary is his identity.
    //
    // FAIL-CLOSED: applied only when the player HAS club spells AND the filter leaves
    // at least one national team. A player whose club career we failed to source must
    // not silently lose his nation as well.
    const clubYears = clubs.flatMap((c) =>
      c.spells.map((s) => ({ start: s.start, end: s.end === null ? CP_MAX_PLAUSIBLE_DEBUT : s.end })),
    );
    const overlapsClubCareer = (r: { start: number | null; end: number | null }) => {
      const s = r.start ?? r.end;
      const e = r.end === null ? CP_MAX_PLAUSIBLE_DEBUT : r.end;
      if (s === null) return true; // undated: cannot rule it out, so keep it
      return clubYears.some((c) => (c.start ?? -1) <= e && c.end >= s);
    };
    const playing = natRows.filter(overlapsClubCareer);
    const natRowsUsed = clubYears.length > 0 && playing.length > 0 ? playing : natRows;

    const byNation = new Map<string, number>();
    for (const r of natRowsUsed) {
      const k = recencyOf(r);
      if (!byNation.has(r.nation) || k > (byNation.get(r.nation) as number)) byNation.set(r.nation, k);
    }
    const natNations = [...byNation.keys()].sort();
    if (natNations.length > 0) {
      // Rank by recency, then alphabetically so the pick is deterministic even when
      // the rule cannot separate two teams.
      const ranked = natNations.slice().sort((a, b) => (byNation.get(b) as number) - (byNation.get(a) as number) || a.localeCompare(b));
      const top = byNation.get(ranked[0]) as number;
      const tied = ranked.filter((n) => byNation.get(n) === top);
      if (tied.length > 1) {
        cpNationRulingLog.push({
          qid: g.qid as string,
          name: g.answerName,
          candidates: tied,
          reason: `tied on most-recent senior national team (${top === CP_MAX_PLAUSIBLE_DEBUT ? "both open" : top})`,
        });
      }
      nation = {
        value: ranked[0],
        source: ref("P54"),
        sourceQuality: natNations.length > 1 ? "amber" : q("green"),
      };
      nationPath = "national-team";
      if (natNations.length > 1) nationCandidates = natNations;
    } else if (raw.countryForSport) {
      nation = { value: raw.countryForSport, source: ref("P1532"), sourceQuality: q("green") };
      nationPath = "P1532";
    } else if (raw.citizenships.length > 0) {
      // Citizenship is a legal fact, not a sporting one — always amber.
      nation = { value: raw.citizenships[0], source: ref("P27"), sourceQuality: "amber" };
      nationPath = "P27";
    }

    // ── position: P413 mapped; unmappable/absent => null; conflict => amber ──
    const mapped = cpMapPosition(raw.positions, sourceStartYear?.value ?? null);
    const position: SourcedFact<CpPosition> | null = mapped.pick
      ? {
          value: mapped.pick,
          source: ref("P413"),
          sourceQuality: mapped.ambiguous ? "amber" : q("green"),
        }
      : null;

    players.push({
      careerPathId: g.careerPathId,
      answerName: g.answerName,
      origin: g.origin,
      qid: g.qid,
      facts: { nation, position, sourceStartYear, birthYear, clubs },
      identityEvidence: {
        matchedClubs: g.matchedClubs,
        matchCount: g.matchCount,
        status: g.status as "resolved" | "amber-identity",
        ...(g.ownerRuling ? { ownerRuling: g.ownerRuling } : {}),
        ...(nationPath ? { nationPath } : {}),
        ...(nationCandidates ? { nationCandidates } : {}),
        // E0.2 item 3 — ALWAYS emitted, never only-when-ambiguous. A consumer
        // reading `position` alone cannot tell a sole sourced value from a pick
        // among several unless the candidate list is unconditionally present;
        // absence used to mean "no conflict", which is indistinguishable from
        // "conflict suppressed upstream" — exactly what wdt:P413 was doing to
        // Ronaldinho and Endo. One value in, one candidate out.
        positionCandidates: mapped.candidates,
        // E1.1: the raw P413 values behind `position`, verbatim, so a verifier can
        // re-run the conflict rule without refetching — and so an owner ruling on a
        // position can never obscure what Wikidata actually said.
        positionStatements: raw.positions,
        ...(mapped.artifactDropped.length > 0 ? { positionArtifactDropped: mapped.artifactDropped } : {}),
      },
      volatility: "static",
    });
  }

  if (write) {
    writeJson(CP_OUT_PATH, players);
    console.log(`cp-emit DONE: wrote ${players.length} players -> ${path.relative(process.cwd(), CP_OUT_PATH)}`);
  }
  return { players, gate };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-assert: the committed file IS what the pipeline emits (E1.1)
// ─────────────────────────────────────────────────────────────────────────────
// Re-runs cp-emit in memory and diffs it against the committed playersSourced.json,
// ignoring `retrievedAt` (a fetch timestamp, not a fact). This is what stops the
// canonical file drifting from the rules that are supposed to produce it — the exact
// failure E1 hit, where the committed file disagreed with the raw cache it came from.
// Pure + offline: it never refetches, so it is safe in CI.
// ─────────────────────────────────────────────────────────────────────────────
const cpStripTimestamps = (v: unknown): unknown =>
  JSON.parse(
    JSON.stringify(v, (k, val) => (k === "retrievedAt" || k === "ruledOn" ? undefined : val)),
  );

/**
 * E0.3 — the pure half of cp-assert, exported so the CI guard
 * (app/src/test/drawCanonicalAssertContract.test.ts) can run it in-process.
 * Returns [] when the committed canonical file reproduces from the rules.
 * Offline: reads only the committed file and the fetch cache.
 */
export function cpAssertFailures(): string[] {
  if (!fs.existsSync(CP_OUT_PATH)) return [`${path.relative(process.cwd(), CP_OUT_PATH)} does not exist`];
  const committed = readJson<SourcedPlayer[]>(CP_OUT_PATH, []);
  const { players } = cpEmit(false);
  const a = cpStripTimestamps(committed) as SourcedPlayer[];
  const b = cpStripTimestamps(players) as SourcedPlayer[];
  if (a.length !== b.length) return [`committed ${a.length} players, re-run emits ${b.length}`];
  const diffs: string[] = [];
  for (let i = 0; i < a.length && diffs.length < 10; i++) {
    const x = JSON.stringify(a[i]);
    const y = JSON.stringify(b[i]);
    if (x !== y) diffs.push(`  [${i}] ${committed[i]?.answerName ?? "?"}
    committed: ${x.slice(0, 260)}
    re-run:    ${y.slice(0, 260)}`);
  }
  if (diffs.length > 0) return [`${diffs.length}+ players differ (modulo retrievedAt):\n${diffs.join("\n")}`];

  // ── E0.2 item 1 — THE SPELL INVARIANT ────────────────────────────────────────
  // Byte-equality above only proves the file matches the rules as they are now. It
  // would pass just as happily if the merge came back, because the committed file
  // would come back merged with it. This asserts the property directly, against the
  // FETCH CACHE rather than against the emitted file: for every club, the number of
  // emitted spells must equal the number of source P54 statements that survived
  // filtering. A hull can never satisfy it — that is the whole point.
  const rawFacts = readJson<Record<string, RawFacts>>(CP_FACTS_CACHE, {});
  const clubDict = readJson<Record<string, ClubDictEntry>>(CP_CLUBDICT_CACHE, {});
  const spellFails: string[] = [];
  let multiSpellClubs = 0;
  for (const p of committed) {
    const raw = rawFacts[p.qid];
    if (!raw) continue;
    const born = p.facts.birthYear?.value ?? null;
    const seniorFrom = born !== null ? born + CP_MIN_DEBUT_AGE : null;
    const srcCount = new Map<string, number>();
    for (const m of raw.memberships) {
      const e = clubDict[m.clubQid];
      if (!e || cpIsPhantomEntity(e) || !cpIsSeniorClub(e)) continue;
      const n = Number(String(m.end ?? "").slice(0, 4));
      const rawEnd = m.end && Number.isFinite(n) ? n : null;
      if (seniorFrom !== null && rawEnd !== null && rawEnd < seniorFrom) continue;
      srcCount.set(m.clubQid, (srcCount.get(m.clubQid) ?? 0) + 1);
    }
    for (const c of p.facts.clubs) {
      const expected = srcCount.get(c.clubQid) ?? 0;
      if (c.spells.length > 1) multiSpellClubs++;
      if (c.spells.length !== expected && spellFails.length < 10) {
        spellFails.push(
          `  ${p.answerName} (${p.qid}) / ${c.value} (${c.clubQid}): ${expected} source statement(s) -> ${c.spells.length} spell(s)`,
        );
      }
    }
  }
  if (spellFails.length > 0)
    return [`spell count does not match source statement count:\n${spellFails.join("\n")}`];

  cpAssertMultiSpellClubs = multiSpellClubs;
  return [];
}
/** Reporting only — set by the last cpAssertFailures() run. */
let cpAssertMultiSpellClubs = 0;

function cpAssert(): void {
  const fails = cpAssertFailures();
  if (fails.length > 0) {
    for (const f of fails) console.error(`cp-assert FAILED: ${f}`);
    process.exitCode = 1;
    return;
  }
  const n = readJson<SourcedPlayer[]>(CP_OUT_PATH, []).length;
  console.log(`cp-assert OK: committed file reproduces exactly (${n} players, modulo retrievedAt)`);
  console.log(`cp-assert OK: one spell per P54 statement, no merging (${cpAssertMultiSpellClubs} multi-spell clubs)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-report: coverage report (drives E1 feasibility — no curation here)
// ─────────────────────────────────────────────────────────────────────────────
// Icon-tier spot-list, pinned by careerPathId rather than display name. Matching
// icons by name is the very homonym trap this ticket guards against: "Ronaldo"
// resolves to Cristiano Ronaldo in the universe, not Ronaldo Nazário (cp-ronaldo-nazario).
// A missing id is itself reportable — the ticket's Maldini is absent from the universe.
// Each entry lists every id that may satisfy it: a player absent from the Career
// Path universe can be supplied via playerAdditions.json (E0.1) under an add_ id.
const CP_ICON_TIER: { ids: string[]; name: string }[] = [
  { ids: ["cp-pele"], name: "Pelé" },
  { ids: ["cp-maradona"], name: "Diego Maradona" },
  { ids: ["cp-cruyff"], name: "Johan Cruyff" },
  { ids: ["cp-zidane"], name: "Zinedine Zidane" },
  { ids: ["cp-ronaldo-nazario"], name: "Ronaldo Nazário" },
  { ids: ["cp-maldini", "add_paolo-maldini"], name: "Paolo Maldini" },
];

function cpReport() {
  const paths = cpUniverse();
  const { players, gate } = cpEmit();
  const byId = new Map(players.map((p) => [p.careerPathId, p]));
  const L = (s = "") => console.log(s);

  const resolved = gate.filter((g) => g.status === "resolved").length;
  const amber = gate.filter((g) => g.status === "amber-identity").length;
  const unresolved = gate.filter((g) => g.status === "unresolved").length;

  L("\n══════════════════════════════════════════════════════════════");
  L("  TICKET E0 — COVERAGE REPORT");
  L("══════════════════════════════════════════════════════════════");
  L(`\nUNIVERSE: ${paths.length} career paths`);
  const pct = (n: number) => `${((n / paths.length) * 100).toFixed(1)}%`;
  L(`\n── IDENTITY ──`);
  L(`  resolved (>=2 club matches) : ${resolved} (${pct(resolved)})`);
  L(`  AMBER-identity (1 match)    : ${amber} (${pct(amber)})`);
  L(`  UNRESOLVED (0 / tie)        : ${unresolved} (${pct(unresolved)})`);
  L(`  emitted to playersSourced   : ${players.length}`);
  // A gated player with no facts row was dropped by cp-emit (a failed/incomplete
  // cp-facts chunk). Surface it loudly — silently emitting fewer players than the
  // gate accepted would read as "fully covered" while quietly losing data.
  const gatedTotal = resolved + amber;
  if (players.length < gatedTotal) {
    L(
      `\n  !!! WARNING: ${gatedTotal - players.length} gated players have NO facts row and were` +
        ` dropped.\n      cp-facts is incomplete — rerun \`cp-facts\` (it resumes) before trusting this report.`,
    );
  }

  // ── E0.1: owner additions get their own section. They are few and each one needs a
  // human ruling, so a per-entry verdict is more useful than a rolled-up percentage.
  const addGate = gate.filter((g) => g.origin === "manual");
  if (addGate.length > 0) {
    L(`\n── MANUAL ADDITIONS (E0.1, owner-anchored) ──`);
    for (const g of addGate) {
      const sp = players.find((p) => p.careerPathId === g.careerPathId);
      const anchors = cpUniverse().find((p) => p.id === g.careerPathId)?.anchorClubs || [];
      L(`  ${g.answerName}  (${g.careerPathId})`);
      L(`    owner anchors   : ${anchors.length} [${anchors.join(", ")}]`);
      L(`    confirmed in P54: ${g.matchCount} [${g.matchedClubs.join(", ")}]`);
      L(`    verdict         : ${g.status.toUpperCase()}${g.qid ? ` -> ${g.qid}` : ""}`);
      if (g.status === "unresolved") {
        L(`      !!! NOT EMITTED. Anchors unconfirmed: [${g.unmatchedClubNames.join(", ")}]`);
        L(`          The owner's assertion failed the Wikidata test. Never forced.`);
      } else if (g.status === "amber-identity") {
        L(`      !!! AMBER — SINGLE ANCHOR. One club cannot separate same-surname players`);
        L(`          who shared it. E1 must NOT select this player until the owner rules`);
        L(`          explicitly on QID ${g.qid}.`);
      }
      if (sp) {
        L(
          `    facts           : nation=${sp.facts.nation?.value ?? "null"} pos=${sp.facts.position?.value ?? "null"}` +
            ` debut=${sp.facts.sourceStartYear?.value ?? "null"} clubs=${sp.facts.clubs.length}`,
        );
      }
    }
  }

  L(`\n── PER-FACT NULL RATES (of ${players.length} emitted) ──`);
  const nulls = {
    nation: players.filter((p) => !p.facts.nation).length,
    position: players.filter((p) => !p.facts.position).length,
    debutYear: players.filter((p) => !p.facts.sourceStartYear).length,
    clubs: players.filter((p) => p.facts.clubs.length === 0).length,
  };
  for (const [k, v] of Object.entries(nulls)) {
    const p = players.length ? ((v / players.length) * 100).toFixed(1) : "0.0";
    L(`  ${k.padEnd(10)} null: ${String(v).padStart(4)} (${p}%)`);
  }
  // Report the nation PATH and the amber CAUSES separately. A single "amber" count
  // conflates unrelated causes (citizenship fallback vs dual internationals vs
  // amber identity) and reads as a much worse P27 rate than the data shows.
  const natByPath = { "national-team": 0, P1532: 0, P27: 0 } as Record<string, number>;
  for (const p of players) if (p.identityEvidence.nationPath) natByPath[p.identityEvidence.nationPath]++;
  const natAmber = players.filter((p) => p.facts.nation?.sourceQuality === "amber").length;
  const natDual = players.filter((p) => p.identityEvidence.nationCandidates).length;
  L(`\n── NATION SOURCE PATH ──`);
  L(`  senior national team (P54) : ${natByPath["national-team"]}`);
  L(`  country for sport (P1532)  : ${natByPath.P1532}`);
  L(`  citizenship (P27, amber)   : ${natByPath.P27}`);
  L(`  amber nations overall      : ${natAmber}`);
  L(`    of which dual-international (>1 senior national team): ${natDual}`);
  const posAmber = players.filter((p) => p.facts.position?.sourceQuality === "amber").length;
  const posConflict = players.filter((p) => (p.identityEvidence.positionCandidates?.length ?? 0) > 1).length;
  L(`  amber positions overall    : ${posAmber}`);
  L(`    of which conflicting P413 buckets (e.g. midfielder+forward): ${posConflict}`);

  // ── E0.2 item 5 — phantom provenance ────────────────────────────────────────
  L(`\n── DROPPED: MEMBERSHIPS WITH AN UNRESOLVABLE CLUB REF (E0.2 item 5) ──`);
  L(`  A P54 statement whose club QID resolves to no described entity. The ref IS`);
  L(`  the provenance, so the membership cannot be published as sourced. Dropped`);
  L(`  and listed here rather than skipped in silence, which is what E1.1 did.`);
  if (cpPhantomLog.length === 0) L(`  none`);
  for (const p of cpPhantomLog) {
    L(`    ${p.name.padEnd(26)} ${p.clubQid.padEnd(12)} ${String(p.start ?? "?").slice(0, 4)}-${String(p.end ?? "open").slice(0, 4)}`);
  }
  L(`  total: ${cpPhantomLog.length} membership(s) across ${new Set(cpPhantomLog.map((p) => p.qid)).size} player(s), ${new Set(cpPhantomLog.map((p) => p.clubQid)).size} distinct club QID(s)`);

  // ── E0.5 — earliest career erased by a malformed non-club membership ─────────
  L(`\n── FAIL-CLOSED: sourceStartYear NULLED, EARLIEST CAREER ERASED (E0.5) ──`);
  L(`  A P54 membership resolving to a real NON-CLUB entity (city/commune/business)`);
  L(`  whose start predates the surviving earliest senior start. cpIsClubEntity`);
  L(`  refuses it, deleting the true first career point; rather than promote a later`);
  L(`  transfer to sourceStartYear, the value is nulled and the card fails the pool.`);
  if (cpErasedCareerLog.length === 0) L(`  none`);
  for (const e of cpErasedCareerLog)
    L(`    ${e.name.padEnd(26)} surfaced ${e.sourceStartWas}, malformed start(s) at ${e.malformedStarts.join(", ")} -> NULLED`);
  L(`  total: ${cpErasedCareerLog.length} player(s) dropped from the pool.`);

  // ── E0.2 item 4 — nations the recency rule cannot decide ────────────────────
  L(`\n── OWNER LIST: NATIONS UNRESOLVABLE BY THE RECENCY RULE (E0.2 item 4) ──`);
  if (cpNationRulingLog.length === 0) L(`  none — every dual international was separated by recency`);
  for (const n of cpNationRulingLog) L(`    ${n.name.padEnd(26)} ${n.candidates.join(" | ")}  (${n.reason})`);
  const duals = players.filter((p) => (p.identityEvidence.nationCandidates?.length ?? 0) > 1);
  L(`  dual internationals resolved BY the rule (amber, candidates recorded): ${duals.length}`);

  L(`\n── DEBUT YEAR COVERAGE ──`);
  const withDebut = players.filter((p) => p.facts.sourceStartYear).length;
  L(`  overall: ${withDebut}/${players.length} emitted (${players.length ? ((withDebut / players.length) * 100).toFixed(1) : "0"}%)`);
  L(`           ${withDebut}/${paths.length} of universe (${pct(withDebut)})`);

  L(`\n  ICON TIER (E1 blocker if missing):`);
  let iconMissing = 0;
  let iconAbsent = 0;
  for (const { ids, name } of CP_ICON_TIER) {
    const cp = paths.find((p) => ids.includes(p.id));
    if (!cp) {
      L(`    ${name.padEnd(20)} *** NOT IN UNIVERSE (none of ${ids.join(", ")} present) ***`);
      iconAbsent++;
      continue;
    }
    const sp = byId.get(cp.id);
    if (!sp) {
      L(`    ${name.padEnd(20)} *** UNRESOLVED — identity gate rejected ***`);
      iconMissing++;
      continue;
    }
    const d = sp.facts.sourceStartYear?.value ?? null;
    if (d === null) iconMissing++;
    L(
      `    ${name.padEnd(20)} ${sp.qid.padEnd(9)} debut=${d === null ? "*** NULL ***" : d}` +
        (sp.origin === "manual" ? " [E0.1 manual]" : "") +
        `  nation=${sp.facts.nation?.value ?? "null"}  pos=${sp.facts.position?.value ?? "null"}` +
        `  clubs=${sp.facts.clubs.length}  [${sp.identityEvidence.status}]`,
    );
  }
  if (iconMissing > 0) {
    L(`\n    !!! LOUD WARNING: ${iconMissing}/${CP_ICON_TIER.length} icon-tier players LACK a sourced debut year.`);
    L(`        E1 must treat these as era-ineligible. Do NOT estimate — fix upstream or accept exclusion.`);
  }
  if (iconAbsent > 0) {
    L(`\n    !!! LOUD WARNING: ${iconAbsent}/${CP_ICON_TIER.length} icon-tier players are NOT IN THE UNIVERSE at all.`);
    L(`        No enrichment can recover these — the career-path universe itself lacks them.`);
  }
  // An icon with a sourced debut year can still be unusable: an amber identity is
  // pending a ruling, so "all have debut years" alone would read as a false all-clear.
  const iconAmber = CP_ICON_TIER.map(({ ids }) => players.find((p) => ids.includes(p.careerPathId)))
    .filter((sp) => sp?.identityEvidence.status === "amber-identity");
  if (iconAmber.length > 0) {
    L(`\n    !!! ${iconAmber.length}/${CP_ICON_TIER.length} icon-tier players have an AMBER identity:`);
    for (const sp of iconAmber) {
      L(`        ${sp!.answerName} (${sp!.qid}) — identity rests on ${sp!.identityEvidence.matchCount} club match.`);
    }
    L(`        Debut years are sourced, but E1 must NOT select these until the identity is ruled on.`);
  }
  if (iconMissing === 0 && iconAbsent === 0 && iconAmber.length === 0) {
    L(`    All icon-tier players have sourced debut years and confirmed identities.`);
  } else if (iconMissing === 0 && iconAbsent === 0) {
    L(`    All icon-tier players have sourced debut years.`);
  }

  L(`\n── GOALKEEPERS ──`);
  const gks = players.filter((p) => p.facts.position?.value === "GK");
  const gkFull = gks.filter((p) => p.facts.nation && p.facts.sourceStartYear && p.facts.clubs.length > 0);
  L(`  position=GK: ${gks.length}   with FULL facts (nation+debut+clubs): ${gkFull.length}`);

  L(`\n── ERA HISTOGRAM (debutYear by decade) ──`);
  const buckets = new Map<string, number>();
  for (const p of players) {
    const d = p.facts.sourceStartYear?.value;
    if (!d) continue;
    const dec = `${Math.floor(d / 10) * 10}s`;
    buckets.set(dec, (buckets.get(dec) || 0) + 1);
  }
  for (const dec of [...buckets.keys()].sort()) {
    const n = buckets.get(dec)!;
    L(`  ${dec.padEnd(6)} ${String(n).padStart(4)} ${"█".repeat(Math.round(n / 5))}`);
  }

  L(`\n── NATIONS with >=8 fully-sourced players ──`);
  const full = players.filter((p) => p.facts.nation && p.facts.position && p.facts.sourceStartYear && p.facts.clubs.length > 0);
  L(`  (fully-sourced = nation + position + debutYear + >=1 club: ${full.length} players)`);
  const natCount = new Map<string, number>();
  for (const p of full) natCount.set(p.facts.nation!.value, (natCount.get(p.facts.nation!.value) || 0) + 1);
  const bigNats = [...natCount.entries()].filter(([, n]) => n >= 8).sort((a, b) => b[1] - a[1]);
  L(`  ${bigNats.length} nations qualify`);
  for (const [n, c] of bigNats) L(`    ${String(c).padStart(4)}  ${n}`);

  L(`\n── CLUB TAGS with >=6 fully-sourced players ──`);
  const clubCount = new Map<string, number>();
  for (const p of full) for (const c of p.facts.clubs) clubCount.set(c.value, (clubCount.get(c.value) || 0) + 1);
  const bigClubs = [...clubCount.entries()].filter(([, n]) => n >= 6).sort((a, b) => b[1] - a[1]);
  L(`  ${bigClubs.length} club tags qualify`);
  for (const [c, n] of bigClubs.slice(0, 40)) L(`    ${String(n).padStart(4)}  ${c}`);
  if (bigClubs.length > 40) L(`    ... and ${bigClubs.length - 40} more`);

  // Feeds clubAliases.json maintenance: the club names that most often failed to
  // match are the highest-leverage alias-table additions.
  L(`\n── TOP UNMATCHED CLUB NAMES (alias-table queue) ──`);
  const unmatched = new Map<string, number>();
  for (const g of gate) for (const c of g.unmatchedClubNames) unmatched.set(c, (unmatched.get(c) || 0) + 1);
  for (const [c, n] of [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
    L(`    ${String(n).padStart(4)}  ${c}`);
  }
  L("\n══════════════════════════════════════════════════════════════\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE cp-sitelinks: Wikidata sitelink counts — the EDITORIAL fame backbone
// ─────────────────────────────────────────────────────────────────────────────
// The number of Wikipedia language editions carrying an article about a player.
// It is NOT a sourced fact about the player and never becomes one: it backs
// `fameRank`, which BUILD_NOTES has always declared EDITORIAL. It lives here
// because this is the file that is allowed to touch the network.
//
// E0.2: E1 fetched these in an uncommitted build session and threw them away, so
// the fame ordering behind the shipped set was unreproducible. Cached like every
// other stage, so the selector stays pure and offline.
async function cpSitelinks() {
  cpEnsureCache();
  const gate = cpRunGate();
  const winners = [...new Set(gate.filter((g) => g.qid).map((g) => g.qid as string))];
  const cache = readJson<Record<string, number>>(CP_SITELINKS_CACHE, {});
  const pending = winners.filter((q) => !(q in cache));
  console.log(`cp-sitelinks: ${winners.length} gated QIDs, ${pending.length} pending`);

  const chunks = chunk(pending, 200);
  for (let ci = 0; ci < chunks.length; ci++) {
    const values = chunks[ci].map((q) => `wd:${q}`).join(" ");
    const query = `SELECT ?p ?links WHERE { VALUES ?p { ${values} } ?p wikibase:sitelinks ?links. }`;
    try {
      for (const r of await sparql(query, 90000)) {
        const n = Number(r.links?.value);
        if (Number.isFinite(n)) cache[qidOf(r.p.value)] = n;
      }
      // A QID that returned no row has no sitelinks statement: record 0 rather than
      // leave it pending forever.
      for (const q of chunks[ci]) if (!(q in cache)) cache[q] = 0;
    } catch (err) {
      console.error(`  chunk ${ci + 1}/${chunks.length} FAILED: ${String(err).slice(0, 100)}`);
      continue;
    }
    writeJson(CP_SITELINKS_CACHE, cache);
    console.log(`  chunk ${ci + 1}/${chunks.length}`);
  }
  console.log(`cp-sitelinks DONE: ${Object.keys(cache).length} QIDs -> ${path.relative(process.cwd(), CP_SITELINKS_CACHE)}`);
}

// entrypoint (no top-level await — tsx emits cjs here)
async function main() {
  const cmd = process.argv[2];
  if (cmd === "resolve") await resolve();
  else if (cmd === "affiliations") await affiliations();
  else if (cmd === "legends") await legends();
  else if (cmd === "cp-search") await cpSearch();
  else if (cmd === "cp-clubqids") await cpClubQids();
  else if (cmd === "cp-clubdict") await cpClubDict();
  else if (cmd === "cp-facts") await cpFacts();
  else if (cmd === "cp-sitelinks") await cpSitelinks();
  else if (cmd === "cp-emit") cpEmit();
  else if (cmd === "cp-report") cpReport();
  else if (cmd === "cp-assert") cpAssert();
  else if (cmd === "cp-all") {
    await cpSearch();
    await cpClubQids();
    await cpClubDict();
    await cpFacts();
    await cpSitelinks();
    cpReport();
  } else {
    console.error(
      `unknown subcommand "${cmd}". use: resolve | affiliations | legends | ` +
        `cp-search | cp-clubqids | cp-clubdict | cp-facts | cp-sitelinks | cp-emit | cp-report | cp-all`,
    );
    process.exit(1);
  }
}
// Only run when invoked as a script. Importing this module (the E0.3 CI guard
// imports cpAssertFailures) must not execute a stage or exit the process.
const cpInvokedDirectly =
  typeof process !== "undefined" &&
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (cpInvokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
