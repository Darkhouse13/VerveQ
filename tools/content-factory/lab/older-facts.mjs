// WHO'S OLDER? — fact gate. Every birth date on screen is Wikidata's (P569,
// day precision) and carries a resolvable ref. The pairs are pinned here; the
// script resolves each name ONCE into lab/older-dob-cache.json (a QID + the
// exact date), cross-checks the description says "footballer", and writes
// src/lab/older/facts.json with the ordering computed — never typed.
//
//   node lab/older-facts.mjs           # resolve what is missing, rebuild facts
//   node lab/older-facts.mjs --check   # offline: re-assert facts.json vs cache
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(dir, "older-dob-cache.json");
const OUT = path.join(dir, "..", "src", "lab", "older", "facts.json");
const UA = "VerveQ-content-factory/1.0 (https://verveq.com; fact gate)";

// Round order IS the escalation: the gap between the two birth dates shrinks
// every round (asserted below), from 17 years to nine days. `a` is the top
// card, `b` the bottom card; who is older is computed, never written down.
export const ROUNDS = [
  { a: "Jude Bellingham", b: "Luka Modrić" },
  { a: "Harry Kane", b: "Erling Haaland" },
  { a: "Kylian Mbappé", b: "Neymar" },
  { a: "Lionel Messi", b: "Cristiano Ronaldo" },
  { a: "Mohamed Salah", b: "Kevin De Bruyne" },
  { a: "Robert Lewandowski", b: "Karim Benzema" },
  { a: "Luka Modrić", b: "Cristiano Ronaldo" },
  { a: "Kevin De Bruyne", b: "Antoine Griezmann" },
  { a: "Son Heung-min", b: "Mohamed Salah" },
  { a: "Erling Haaland", b: "Vinícius Júnior" },
];

// on-screen surnames (brand type, all caps) — display only, never a fact
export const SHOW = {
  "Jude Bellingham": "BELLINGHAM",
  "Luka Modrić": "MODRIĆ",
  "Lionel Messi": "MESSI",
  "Cristiano Ronaldo": "RONALDO",
  "Kylian Mbappé": "MBAPPÉ",
  Neymar: "NEYMAR",
  "Harry Kane": "KANE",
  "Erling Haaland": "HAALAND",
  "Robert Lewandowski": "LEWANDOWSKI",
  "Karim Benzema": "BENZEMA",
  "Mohamed Salah": "SALAH",
  "Kevin De Bruyne": "DE BRUYNE",
  "Antoine Griezmann": "GRIEZMANN",
  "Son Heung-min": "SON",
  "Vinícius Júnior": "VINÍCIUS",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (params) => {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error(`wikidata: gave up on ${url}`);
};

const resolve = async (name) => {
  const s = await api({ action: "wbsearchentities", search: name, language: "en", limit: "5" });
  const hit = (s.search ?? []).find((h) => /footballer|football player/i.test(h.description ?? ""));
  if (!hit) throw new Error(`wikidata: no footballer entity for "${name}": ${JSON.stringify(s.search?.map((h) => h.description))}`);
  await sleep(1200);
  const e = await api({ action: "wbgetentities", ids: hit.id, props: "claims|labels", languages: "en" });
  const ent = e.entities[hit.id];
  // Wikidata ranking: a "preferred" claim outranks "normal" ones (Salah carries
  // a preferred day-precision date beside a normal year-precision one). Take
  // the preferred set if any, else the normal set — and it must be exactly one.
  const live = (ent.claims?.P569 ?? []).filter((c) => c.rank !== "deprecated");
  const preferred = live.filter((c) => c.rank === "preferred");
  const claims = preferred.length > 0 ? preferred : live;
  if (claims.length !== 1) throw new Error(`wikidata: ${name} (${hit.id}) has ${claims.length} candidate P569 claims — resolve by hand`);
  const v = claims[0].mainsnak.datavalue.value;
  if (v.precision !== 11) throw new Error(`wikidata: ${name} P569 precision ${v.precision}, need day (11)`);
  const m = v.time.match(/^\+(\d{4})-(\d{2})-(\d{2})T/);
  return { name, qid: hit.id, label: ent.labels?.en?.value, description: hit.description, dob: `${m[1]}-${m[2]}-${m[3]}`, ref: `https://www.wikidata.org/wiki/${hit.id}#P569` };
};

const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const pretty = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
// gap label — whole units only, rounded DOWN, so a label never overstates
const gapLabel = (days) => {
  if (days >= 365) {
    const y = Math.floor(days / 365.25);
    return `${y} YEAR${y === 1 ? "" : "S"}`;
  }
  if (days >= 60) {
    const mo = Math.floor(days / 30.44);
    return `${mo} MONTHS`;
  }
  if (days >= 14) {
    const w = Math.floor(days / 7);
    return `${w} WEEKS`;
  }
  return `${days} DAYS`;
};

const main = async () => {
  const check = process.argv.includes("--check");
  const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};
  const names = [...new Set(ROUNDS.flatMap((r) => [r.a, r.b]))];
  for (const n of names) {
    if (cache[n]) continue;
    if (check) throw new Error(`older-facts --check: "${n}" not in cache`);
    console.log(`resolving ${n} …`);
    cache[n] = await resolve(n);
    writeFileSync(CACHE, JSON.stringify(cache, null, 1));
    await sleep(1500);
  }
  for (const n of names) if (!SHOW[n]) throw new Error(`no display name for ${n}`);

  const rounds = ROUNDS.map((r, i) => {
    const A = cache[r.a];
    const B = cache[r.b];
    const days = daysBetween(A.dob, B.dob); // >0 ⇒ a born first ⇒ a older
    if (days === 0) throw new Error(`round ${i + 1}: same birthday — not a round`);
    return {
      n: i + 1,
      a: { name: r.a, show: SHOW[r.a], dob: A.dob, date: pretty(A.dob), qid: A.qid, ref: A.ref },
      b: { name: r.b, show: SHOW[r.b], dob: B.dob, date: pretty(B.dob), qid: B.qid, ref: B.ref },
      older: days > 0 ? "a" : "b",
      gapDays: Math.abs(days),
      gap: gapLabel(Math.abs(days)),
    };
  });
  // escalation law: every round's gap is strictly smaller than the last
  for (let i = 1; i < rounds.length; i++) {
    if (rounds[i].gapDays >= rounds[i - 1].gapDays) throw new Error(`escalation broken at round ${i + 1}: ${rounds[i].gapDays}d after ${rounds[i - 1].gapDays}d`);
  }
  const facts = { _doc: "Generated by lab/older-facts.mjs from Wikidata P569 (day precision). Do not edit — re-run the script.", source: "wikidata P569", rounds };
  if (check) {
    const cur = JSON.parse(readFileSync(OUT, "utf8"));
    if (JSON.stringify(cur.rounds) !== JSON.stringify(rounds)) throw new Error("older-facts --check: facts.json drifted from cache — re-run without --check");
    console.log(`older-facts: ${rounds.length} rounds re-asserted against the cache.`);
    return;
  }
  writeFileSync(OUT, JSON.stringify(facts, null, 1));
  for (const r of rounds) console.log(`R${r.n}  ${r.a.show} ${r.a.date}  vs  ${r.b.show} ${r.b.date}  → older: ${r[r.older].show}  gap ${r.gap} (${r.gapDays}d)`);
  console.log(`→ ${OUT}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
