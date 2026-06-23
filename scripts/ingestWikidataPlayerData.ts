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
  "VerveQ-data-ingest/1.0 (hamza.bentaieb@verveq.com; VerveGrid coverage rebuild)";
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

// entrypoint (no top-level await — tsx emits cjs here)
async function main() {
  const cmd = process.argv[2];
  if (cmd === "resolve") await resolve();
  else if (cmd === "affiliations") await affiliations();
  else if (cmd === "legends") await legends();
  else {
    console.error(`unknown subcommand "${cmd}". use: resolve | affiliations | legends`);
    process.exit(1);
  }
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
