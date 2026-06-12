import type { SkillNodeId } from "./learnSkillGraph";
import type { LearnModeDistractor } from "./learnGeographyNonobviousLadderV1";
import {
  knowledgeHistoryCieScoreBatchV1Questions,
  wikidataSourceRecords as historyWikidataSourceRecords,
} from "./knowledgeHistoryCieScoreBatchV1";

// Learn-mode reveal layer over knowledge_history_cie_score_v1 checksums.
//
// DERIVED-ONLY INVARIANT: this layer introduces NO new factual claims. Every
// date, year, and entity in the reveal copy is restated verbatim from the
// already cross-family-verified batch facts (Codex authored, Opus verified,
// batch verdict "agree"). The reveal text is template-built from those facts,
// and validateLearnHistoryDatesRevealsV1() mechanically proves the derivation:
// each fact used here must resolve to an existing batch wikidataSourceRecord
// with identical year/date/precision, and each distractor/answer must match
// the batch question's own options. Entries that fail any check are dropped
// from the exported map (fail-closed) and reported as validation errors.

type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";
type WikidataDateProperty = "P585" | "P571";
type DatePrecision = "day" | "month" | "year";
type Calendar = "Gregorian" | "Julian";

type ProvenanceClaim = {
  claim: string;
  sourceType: SourceType;
  sourceRef: string;
  retrievedAt: string;
  volatility: Volatility;
};

type LearnModeProvenance = {
  claims: ProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: Verdict;
  batchId: string;
  workUnitId: string;
};

export type LearnHistoryDatesReveal = {
  skillNodes: SkillNodeId[];
  distractors: LearnModeDistractor[];
  correctReveal: string;
  provenance: LearnModeProvenance;
};

type DateFact = {
  /** Exact entity name as it appears in the batch source records. */
  name: string;
  /** Prose-ready name (leading article where natural). */
  displayName: string;
  qid: string;
  property: WikidataDateProperty;
  year: string;
  date: string;
  precision: DatePrecision;
  calendar: Calendar;
};

const BATCH_ID = "learn_history_dates_reveals_v1";
const WORK_UNIT_ID = "learn:knowledge:history:dates-reveals:v1";
const SOURCE_BATCH_ID = "knowledge_history_cie_score_v1";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "anthropic/claude-fable-5";
// The reveal copy restates batch claims verified by the batch's own
// cross-family pass; the mechanical validator below enforces that derivation.
const VERIFIER_MODEL = "openai/gpt-5-codex";

const EVENTS_NODE: SkillNodeId = "hist.events.dates";
const FOUNDING_NODE: SkillNodeId = "hist.founding.years";
const CHRONOLOGY_NODE: SkillNodeId = "hist.chronology";

function dateFact(
  name: string,
  displayName: string,
  qid: string,
  property: WikidataDateProperty,
  year: string,
  date: string,
  precision: DatePrecision,
  calendar: Calendar = "Gregorian",
): DateFact {
  return { name, displayName, qid, property, year, date, precision, calendar };
}

// Entity facts restated 1:1 from knowledge_history_cie_score_v1 — the
// validator cross-checks every row against the batch's source records.
const hastings = dateFact("Battle of Hastings", "the Battle of Hastings", "Q83224", "P585", "1066", "+1066-10-14T00:00:00Z", "day", "Julian");
const agincourt = dateFact("Battle of Agincourt", "the Battle of Agincourt", "Q188495", "P585", "1415", "+1415-10-25T00:00:00Z", "day", "Julian");
const lepanto = dateFact("Battle of Lepanto", "the Battle of Lepanto", "Q165425", "P585", "1571", "+1571-10-07T00:00:00Z", "day", "Julian");
const gunpowderPlot = dateFact("Gunpowder Plot", "the Gunpowder Plot", "Q45810", "P585", "1605", "+1605-11-05T00:00:00Z", "day", "Julian");
const bostonTeaParty = dateFact("Boston Tea Party", "the Boston Tea Party", "Q19024", "P585", "1773", "+1773-12-16T00:00:00Z", "day");
const bunkerHill = dateFact("Battle of Bunker Hill", "the Battle of Bunker Hill", "Q334029", "P585", "1775", "+1775-06-17T00:00:00Z", "day");
const bastille = dateFact("Storming of the Bastille", "the Storming of the Bastille", "Q6539", "P585", "1789", "+1789-07-14T00:00:00Z", "day");
const louisianaPurchase = dateFact("Louisiana Purchase", "the Louisiana Purchase", "Q193155", "P585", "1803", "+1803-04-30T00:00:00Z", "day");
const trafalgar = dateFact("Battle of Trafalgar", "the Battle of Trafalgar", "Q171416", "P585", "1805", "+1805-10-21T00:00:00Z", "day");
const waterloo = dateFact("Battle of Waterloo", "the Battle of Waterloo", "Q48314", "P585", "1815", "+1815-06-18T00:00:00Z", "day");
const antietam = dateFact("Battle of Antietam", "the Battle of Antietam", "Q719252", "P585", "1862", "+1862-09-17T00:00:00Z", "day");
const littleBighorn = dateFact("Battle of the Little Bighorn", "the Battle of the Little Bighorn", "Q205422", "P585", "1876", "+1876-06-25T00:00:00Z", "day");
const franzFerdinand = dateFact("assassination of Archduke Franz Ferdinand", "the assassination of Archduke Franz Ferdinand", "Q192050", "P585", "1914", "+1914-06-28T00:00:00Z", "day");
const versailles = dateFact("Treaty of Versailles", "the Treaty of Versailles", "Q8736", "P585", "1919", "+1919-06-28T00:00:00Z", "day");
const pearlHarbor = dateFact("attack on Pearl Harbor", "the attack on Pearl Harbor", "Q52418", "P585", "1941", "+1941-12-07T00:00:00Z", "day");
const doolittleRaid = dateFact("Doolittle Raid", "the Doolittle Raid", "Q713516", "P585", "1942", "+1942-04-18T00:00:00Z", "day");
const hiroshima = dateFact("atomic bombing of Hiroshima", "the atomic bombing of Hiroshima", "Q703203", "P585", "1945", "+1945-08-06T00:00:00Z", "day");
const jfk = dateFact("assassination of John F. Kennedy", "the assassination of John F. Kennedy", "Q193484", "P585", "1963", "+1963-11-22T00:00:00Z", "day");
const chernobyl = dateFact("Chernobyl disaster", "the Chernobyl disaster", "Q486", "P585", "1986", "+1986-04-26T00:00:00Z", "day");
const berlinWall = dateFact("fall of the Berlin Wall", "the fall of the Berlin Wall", "Q69163529", "P585", "1989", "+1989-11-09T00:00:00Z", "day");
const royalSociety = dateFact("Royal Society", "the Royal Society", "Q123885", "P571", "1660", "+1660-11-01T00:00:00Z", "month");
const smithsonian = dateFact("Smithsonian Institution", "the Smithsonian Institution", "Q131626", "P571", "1846", "+1846-08-10T00:00:00Z", "day");
const icrc = dateFact("International Committee of the Red Cross", "the International Committee of the Red Cross", "Q5987345", "P571", "1863", "+1863-02-17T00:00:00Z", "day");
const salvationArmy = dateFact("The Salvation Army", "The Salvation Army", "Q188307", "P571", "1865", "+1865-07-02T00:00:00Z", "day");
const ioc = dateFact("International Olympic Committee", "the International Olympic Committee", "Q40970", "P571", "1894", "+1894-06-23T00:00:00Z", "day");
const fifa = dateFact("FIFA", "FIFA", "Q253414", "P571", "1904", "+1904-05-21T00:00:00Z", "day");
const nationalParkService = dateFact("National Park Service", "the National Park Service", "Q308439", "P571", "1916", "+1916-08-25T00:00:00Z", "day");
const unesco = dateFact("UNESCO", "UNESCO", "Q7809", "P571", "1945", "+1945-11-16T00:00:00Z", "day");
const india = dateFact("India", "India", "Q668", "P571", "1947", "+1947-08-15T00:00:00Z", "day");
const ghana = dateFact("Ghana", "Ghana", "Q117", "P571", "1957", "+1957-01-01T00:00:00Z", "year");
const who = dateFact("World Health Organization", "the World Health Organization", "Q7817", "P571", "1948", "+1948-04-07T00:00:00Z", "day");
const nato = dateFact("NATO", "NATO", "Q7184", "P571", "1949", "+1949-04-04T00:00:00Z", "day");
const nasa = dateFact("NASA", "NASA", "Q23548", "P571", "1958", "+1958-07-29T00:00:00Z", "day");
const amnesty = dateFact("Amnesty International", "Amnesty International", "Q42970", "P571", "1961", "+1961-05-28T00:00:00Z", "day");
const europeanUnion = dateFact("European Union", "the European Union", "Q458", "P571", "1993", "+1993-11-01T00:00:00Z", "day");

type YearRevealRow = {
  checksum: string;
  node: SkillNodeId;
  fact: DateFact;
  distractorYears: [string, string, string];
  /**
   * Required for year-precision facts, whose display date adds nothing beyond
   * the answer: the hook then anchors relative to another in-batch dated fact.
   */
  anchor?: DateFact;
};

type ChronologyOptionRow = {
  text: string;
  fact: DateFact;
};

type ChronologyRevealRow = {
  checksum: string;
  direction: "earliest" | "latest";
  answer: ChronologyOptionRow;
  others: [ChronologyOptionRow, ChronologyOptionRow, ChronologyOptionRow];
};

const cs = (n: string) => `${SOURCE_BATCH_ID}_${n}`;

const YEAR_REVEAL_ROWS: YearRevealRow[] = [
  { checksum: cs("001"), node: EVENTS_NODE, fact: hastings, distractorYears: ["1054", "1087", "1100"] },
  { checksum: cs("002"), node: EVENTS_NODE, fact: agincourt, distractorYears: ["1314", "1453", "1492"] },
  { checksum: cs("003"), node: EVENTS_NODE, fact: lepanto, distractorYears: ["1526", "1588", "1618"] },
  { checksum: cs("004"), node: EVENTS_NODE, fact: gunpowderPlot, distractorYears: ["1588", "1642", "1666"] },
  { checksum: cs("005"), node: EVENTS_NODE, fact: bostonTeaParty, distractorYears: ["1765", "1776", "1781"] },
  { checksum: cs("006"), node: EVENTS_NODE, fact: bunkerHill, distractorYears: ["1770", "1781", "1789"] },
  { checksum: cs("007"), node: EVENTS_NODE, fact: bastille, distractorYears: ["1776", "1793", "1815"] },
  { checksum: cs("008"), node: EVENTS_NODE, fact: louisianaPurchase, distractorYears: ["1798", "1812", "1820"] },
  { checksum: cs("009"), node: EVENTS_NODE, fact: trafalgar, distractorYears: ["1776", "1812", "1815"] },
  { checksum: cs("010"), node: EVENTS_NODE, fact: waterloo, distractorYears: ["1805", "1821", "1830"] },
  { checksum: cs("011"), node: EVENTS_NODE, fact: antietam, distractorYears: ["1859", "1865", "1876"] },
  { checksum: cs("012"), node: EVENTS_NODE, fact: littleBighorn, distractorYears: ["1862", "1881", "1890"] },
  { checksum: cs("013"), node: EVENTS_NODE, fact: franzFerdinand, distractorYears: ["1905", "1917", "1919"] },
  { checksum: cs("014"), node: EVENTS_NODE, fact: versailles, distractorYears: ["1914", "1917", "1929"] },
  { checksum: cs("015"), node: EVENTS_NODE, fact: pearlHarbor, distractorYears: ["1939", "1944", "1945"] },
  { checksum: cs("016"), node: EVENTS_NODE, fact: doolittleRaid, distractorYears: ["1941", "1944", "1945"] },
  { checksum: cs("017"), node: EVENTS_NODE, fact: hiroshima, distractorYears: ["1941", "1944", "1950"] },
  { checksum: cs("018"), node: EVENTS_NODE, fact: jfk, distractorYears: ["1957", "1968", "1974"] },
  { checksum: cs("019"), node: EVENTS_NODE, fact: chernobyl, distractorYears: ["1979", "1989", "1991"] },
  { checksum: cs("020"), node: EVENTS_NODE, fact: berlinWall, distractorYears: ["1986", "1991", "1993"] },
  { checksum: cs("021"), node: FOUNDING_NODE, fact: royalSociety, distractorYears: ["1648", "1688", "1707"] },
  { checksum: cs("022"), node: FOUNDING_NODE, fact: smithsonian, distractorYears: ["1815", "1863", "1876"] },
  { checksum: cs("023"), node: FOUNDING_NODE, fact: icrc, distractorYears: ["1846", "1865", "1894"] },
  { checksum: cs("024"), node: FOUNDING_NODE, fact: salvationArmy, distractorYears: ["1846", "1863", "1904"] },
  { checksum: cs("025"), node: FOUNDING_NODE, fact: ioc, distractorYears: ["1865", "1904", "1916"] },
  { checksum: cs("026"), node: FOUNDING_NODE, fact: fifa, distractorYears: ["1894", "1916", "1930"] },
  { checksum: cs("027"), node: FOUNDING_NODE, fact: nationalParkService, distractorYears: ["1904", "1933", "1945"] },
  { checksum: cs("028"), node: FOUNDING_NODE, fact: unesco, distractorYears: ["1919", "1948", "1949"] },
  { checksum: cs("029"), node: FOUNDING_NODE, fact: india, distractorYears: ["1935", "1950", "1957"] },
  { checksum: cs("030"), node: FOUNDING_NODE, fact: who, distractorYears: ["1945", "1949", "1958"] },
  { checksum: cs("031"), node: FOUNDING_NODE, fact: nato, distractorYears: ["1945", "1948", "1955"] },
  { checksum: cs("032"), node: FOUNDING_NODE, fact: ghana, distractorYears: ["1947", "1960", "1963"], anchor: india },
  { checksum: cs("033"), node: FOUNDING_NODE, fact: nasa, distractorYears: ["1949", "1961", "1969"] },
  { checksum: cs("034"), node: FOUNDING_NODE, fact: amnesty, distractorYears: ["1948", "1958", "1971"] },
  { checksum: cs("035"), node: FOUNDING_NODE, fact: europeanUnion, distractorYears: ["1957", "1973", "2002"] },
];

const CHRONOLOGY_REVEAL_ROWS: ChronologyRevealRow[] = [
  {
    checksum: cs("036"),
    direction: "earliest",
    answer: { text: "Battle of Hastings", fact: hastings },
    others: [
      { text: "Battle of Agincourt", fact: agincourt },
      { text: "Storming of the Bastille", fact: bastille },
      { text: "Battle of Waterloo", fact: waterloo },
    ],
  },
  {
    checksum: cs("037"),
    direction: "latest",
    answer: { text: "Battle of Trafalgar", fact: trafalgar },
    others: [
      { text: "Battle of Lepanto", fact: lepanto },
      { text: "Gunpowder Plot", fact: gunpowderPlot },
      { text: "Boston Tea Party", fact: bostonTeaParty },
    ],
  },
  {
    checksum: cs("038"),
    direction: "earliest",
    answer: { text: "Louisiana Purchase", fact: louisianaPurchase },
    others: [
      { text: "Battle of Antietam", fact: antietam },
      { text: "Treaty of Versailles", fact: versailles },
      { text: "attack on Pearl Harbor", fact: pearlHarbor },
    ],
  },
  {
    checksum: cs("039"),
    direction: "latest",
    answer: { text: "Chernobyl disaster", fact: chernobyl },
    others: [
      { text: "assassination of Archduke Franz Ferdinand", fact: franzFerdinand },
      { text: "Treaty of Versailles signed", fact: versailles },
      { text: "atomic bombing of Hiroshima", fact: hiroshima },
    ],
  },
  {
    checksum: cs("040"),
    direction: "earliest",
    answer: { text: "Battle of Bunker Hill", fact: bunkerHill },
    others: [
      { text: "Battle of the Little Bighorn", fact: littleBighorn },
      { text: "assassination of John F. Kennedy", fact: jfk },
      { text: "fall of the Berlin Wall", fact: berlinWall },
    ],
  },
  {
    checksum: cs("041"),
    direction: "latest",
    answer: { text: "fall of the Berlin Wall", fact: berlinWall },
    others: [
      { text: "Doolittle Raid", fact: doolittleRaid },
      { text: "atomic bombing of Hiroshima", fact: hiroshima },
      { text: "assassination of John F. Kennedy", fact: jfk },
    ],
  },
  {
    checksum: cs("042"),
    direction: "earliest",
    answer: { text: "Royal Society founded", fact: royalSociety },
    others: [
      { text: "Smithsonian Institution founded", fact: smithsonian },
      { text: "International Olympic Committee founded", fact: ioc },
      { text: "FIFA founded", fact: fifa },
    ],
  },
  {
    checksum: cs("043"),
    direction: "latest",
    answer: { text: "UNESCO founded", fact: unesco },
    others: [
      { text: "International Committee of the Red Cross founded", fact: icrc },
      { text: "The Salvation Army founded", fact: salvationArmy },
      { text: "National Park Service founded", fact: nationalParkService },
    ],
  },
  {
    checksum: cs("044"),
    direction: "earliest",
    answer: { text: "UNESCO founded", fact: unesco },
    others: [
      { text: "India became independent", fact: india },
      { text: "Ghana became independent", fact: ghana },
      { text: "NASA founded", fact: nasa },
    ],
  },
  {
    checksum: cs("045"),
    direction: "latest",
    answer: { text: "European Union formed", fact: europeanUnion },
    others: [
      { text: "World Health Organization founded", fact: who },
      { text: "NATO founded", fact: nato },
      { text: "Amnesty International founded", fact: amnesty },
    ],
  },
  {
    checksum: cs("046"),
    direction: "earliest",
    answer: { text: "Treaty of Versailles signed", fact: versailles },
    others: [
      { text: "UNESCO founded", fact: unesco },
      { text: "NATO founded", fact: nato },
      { text: "Chernobyl disaster", fact: chernobyl },
    ],
  },
  {
    checksum: cs("047"),
    direction: "latest",
    answer: { text: "fall of the Berlin Wall", fact: berlinWall },
    others: [
      { text: "NASA founded", fact: nasa },
      { text: "assassination of John F. Kennedy", fact: jfk },
      { text: "Chernobyl disaster", fact: chernobyl },
    ],
  },
  {
    checksum: cs("048"),
    direction: "earliest",
    answer: { text: "Smithsonian Institution founded", fact: smithsonian },
    others: [
      { text: "International Committee of the Red Cross founded", fact: icrc },
      { text: "Battle of the Little Bighorn", fact: littleBighorn },
      { text: "International Olympic Committee founded", fact: ioc },
    ],
  },
  {
    checksum: cs("049"),
    direction: "latest",
    answer: { text: "The Salvation Army founded", fact: salvationArmy },
    others: [
      { text: "Battle of Waterloo", fact: waterloo },
      { text: "Smithsonian Institution founded", fact: smithsonian },
      { text: "Battle of Antietam", fact: antietam },
    ],
  },
  {
    checksum: cs("050"),
    direction: "earliest",
    answer: { text: "Battle of Trafalgar", fact: trafalgar },
    others: [
      { text: "Battle of Waterloo", fact: waterloo },
      { text: "National Park Service founded", fact: nationalParkService },
      { text: "Treaty of Versailles signed", fact: versailles },
    ],
  },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "+1066-10-14T00:00:00Z" at day precision → "14 October 1066". */
function displayDate(fact: DateFact): string {
  const match = fact.date.match(/^\+(\d+)-(\d{2})-(\d{2})T/);
  if (!match) return fact.year;
  const [, year, month, day] = match;
  const monthName = MONTH_NAMES[Number(month) - 1] ?? "";
  if (fact.precision === "day") return `${Number(day)} ${monthName} ${Number(year)}`;
  if (fact.precision === "month") return `${monthName} ${Number(year)}`;
  return String(Number(year));
}

function capFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function sourceRefKind(property: WikidataDateProperty): string {
  return property === "P585" ? "single-event-year" : "single-inception-year";
}

function sourceRef(fact: DateFact): string {
  return `wikidata:${fact.qid}:${fact.property}:${fact.year}:${sourceRefKind(fact.property)}:snapshot-${RETRIEVED_AT}`;
}

// Mirrors the batch's claim vocabulary exactly so reveal claims string-match
// the question's own verified claims.
function claimPrefix(fact: DateFact): string {
  return fact.property === "P585" ? "point_in_time_year" : "inception_year";
}

function dateClaim(fact: DateFact): ProvenanceClaim {
  return {
    claim: `${claimPrefix(fact)}(${fact.name}) = ${fact.year}`,
    sourceType: "structured_open",
    sourceRef: sourceRef(fact),
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
  };
}

function provenance(claims: ProvenanceClaim[], verdict: Verdict): LearnModeProvenance {
  return {
    claims,
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict,
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function julianNote(fact: DateFact): string {
  return fact.calendar === "Julian" ? " (Julian calendar)" : "";
}

function yearDistractor(row: YearRevealRow, year: string): LearnModeDistractor {
  const gap = Math.abs(Number(year) - Number(row.fact.year));
  const direction = Number(year) < Number(row.fact.year) ? "early" : "late";
  const subject =
    row.fact.property === "P585"
      ? row.fact.displayName
      : `the inception of ${row.fact.displayName}`;
  return {
    text: year,
    misconception: "near-miss year recall",
    whyChosen: "It is a plausible nearby year for the same event.",
    reveal: `${year} is ${gap} year${gap === 1 ? "" : "s"} too ${direction} — ${subject} is dated ${displayDate(row.fact)}${julianNote(row.fact)}.`,
  };
}

function yearCorrectReveal(row: YearRevealRow): string {
  // Year-precision facts carry no extra date detail; the hook instead anchors
  // against another in-batch dated fact (validated like any other claim).
  if (row.fact.precision === "year" && row.anchor) {
    const gap = Math.abs(Number(row.fact.year) - Number(row.anchor.year));
    const relation = Number(row.fact.year) > Number(row.anchor.year) ? "after" : "before";
    return `Wikidata lists the inception of ${row.fact.displayName} as ${row.fact.year} — ${gap} years ${relation} ${row.anchor.displayName} (${row.anchor.year}).`;
  }
  const date = displayDate(row.fact);
  if (row.fact.property === "P585") {
    return `Wikidata pins ${row.fact.displayName} to ${date}${julianNote(row.fact)} — remember the exact ${row.fact.precision} and the year ${row.fact.year} comes free.`;
  }
  return `Wikidata dates the inception of ${row.fact.displayName} to ${date} — tie the year ${row.fact.year} to that founding ${row.fact.precision === "day" ? "date" : "month"}.`;
}

function chronologyDistractor(
  row: ChronologyRevealRow,
  option: ChronologyOptionRow,
): LearnModeDistractor {
  const relation = row.direction === "earliest" ? "came earlier" : "came later";
  return {
    text: option.text,
    misconception: "timeline ordering confusion",
    whyChosen: "It is a real event from the same set with a nearby date.",
    reveal: `${capFirst(option.fact.displayName)} is dated ${option.fact.year} — ${row.answer.fact.displayName} (${row.answer.fact.year}) ${relation}.`,
  };
}

function chronologyCorrectReveal(row: ChronologyRevealRow): string {
  const ordered = [row.answer, ...row.others].sort(
    (left, right) => Number(left.fact.year) - Number(right.fact.year),
  );
  const timeline = ordered
    .map((option) => `${option.fact.displayName} (${option.fact.year})`)
    .join(" → ");
  return `Timeline: ${timeline} — ${row.answer.fact.displayName} is the ${row.direction} of the set.`;
}

const questionByChecksum = new Map(
  knowledgeHistoryCieScoreBatchV1Questions.map((question) => [
    question.checksum,
    question,
  ]),
);

type ValidationOutcome = {
  errors: string[];
};

function validateFact(fact: DateFact, checksum: string, errors: string[]) {
  const record = (historyWikidataSourceRecords as Record<string, { facts: Record<string, unknown> }>)[
    sourceRef(fact)
  ];
  if (!record) {
    errors.push(`${checksum}: no batch source record for ${fact.name} (${sourceRef(fact)})`);
    return;
  }
  const facts = record.facts as {
    subject?: { name?: string };
    year?: string;
    wikidataTimeValue?: string;
    precision?: string;
    calendar?: string;
  };
  if (facts.subject?.name !== fact.name) {
    errors.push(`${checksum}: batch record name mismatch for ${fact.name}`);
  }
  if (facts.year !== fact.year) {
    errors.push(`${checksum}: batch record year mismatch for ${fact.name}`);
  }
  if (facts.wikidataTimeValue !== fact.date) {
    errors.push(`${checksum}: batch record date mismatch for ${fact.name}`);
  }
  if (facts.precision !== fact.precision) {
    errors.push(`${checksum}: batch record precision mismatch for ${fact.name}`);
  }
  if (facts.calendar !== fact.calendar) {
    errors.push(`${checksum}: batch record calendar mismatch for ${fact.name}`);
  }
}

function validateOptions(
  checksum: string,
  correctText: string,
  distractorTexts: string[],
  errors: string[],
) {
  const question = questionByChecksum.get(checksum);
  if (!question) {
    errors.push(`${checksum}: not present in ${SOURCE_BATCH_ID}`);
    return;
  }
  if (question.correctAnswer !== correctText) {
    errors.push(`${checksum}: correct answer mismatch (${correctText} vs ${question.correctAnswer})`);
  }
  const expected = [...question.options].filter((option) => option !== question.correctAnswer).sort();
  const actual = [...distractorTexts].sort();
  if (expected.length !== actual.length || expected.some((option, i) => option !== actual[i])) {
    errors.push(`${checksum}: distractor texts do not match batch options`);
  }
}

function validateYearRow(row: YearRevealRow): ValidationOutcome {
  const errors: string[] = [];
  validateOptions(row.checksum, row.fact.year, row.distractorYears, errors);
  validateFact(row.fact, row.checksum, errors);
  if (row.anchor) {
    // The anchor binds at record level only — it is intentionally a fact from
    // a different question, so it cannot appear in this question's claims.
    validateFact(row.anchor, row.checksum, errors);
  }
  // Non-tautology: the correct reveal must carry more than the bare year —
  // either real date precision or an explicit anchor against another fact.
  if (displayDate(row.fact) === row.fact.year && !row.anchor) {
    errors.push(`${row.checksum}: fact has only year precision — reveal would restate the answer`);
  }
  const question = questionByChecksum.get(row.checksum);
  if (question) {
    // Bind the declared fact to THIS checksum's own verified claims — a
    // same-year fact about a different entity must not pass.
    const claims = question.provenance.claims.map((entry) => entry.claim);
    if (!claims.includes(`${claimPrefix(row.fact)}(${row.fact.name}) = ${row.fact.year}`)) {
      errors.push(`${row.checksum}: question claims do not bind ${row.fact.name} = ${row.fact.year}`);
    }
    for (const year of row.distractorYears) {
      if (!claims.includes(`${claimPrefix(row.fact)}(${row.fact.name}) != ${year}`)) {
        errors.push(`${row.checksum}: question claims do not exclude ${year}`);
      }
    }
    if (yearCorrectReveal(row) === question.explanation) {
      errors.push(`${row.checksum}: correct reveal duplicates the batch explanation`);
    }
  }
  return { errors };
}

function validateChronologyRow(row: ChronologyRevealRow): ValidationOutcome {
  const errors: string[] = [];
  validateOptions(
    row.checksum,
    row.answer.text,
    row.others.map((option) => option.text),
    errors,
  );
  for (const option of [row.answer, ...row.others]) {
    validateFact(option.fact, row.checksum, errors);
  }
  const question = questionByChecksum.get(row.checksum);
  if (question) {
    const claims = question.provenance.claims.map((entry) => entry.claim);
    for (const option of [row.answer, ...row.others]) {
      // Each declared fact must be one of THIS question's own claims, and the
      // option text must pair with that fact's year in the batch explanation —
      // together these reject swapped text/fact pairings.
      if (
        !claims.includes(
          `${claimPrefix(option.fact)}(${option.fact.name}) = ${option.fact.year}`,
        )
      ) {
        errors.push(
          `${row.checksum}: question claims do not bind ${option.fact.name} = ${option.fact.year}`,
        );
      }
      if (!question.explanation?.includes(`${option.text} (${option.fact.year})`)) {
        errors.push(
          `${row.checksum}: explanation does not pair "${option.text}" with ${option.fact.year}`,
        );
      }
    }
    const directionClaim = claims.find((entry) =>
      entry.startsWith(`chronology_${row.direction}(`),
    );
    if (!directionClaim || !directionClaim.endsWith(`= ${row.answer.text}`)) {
      errors.push(
        `${row.checksum}: chronology ${row.direction} claim missing or answer mismatch`,
      );
    }
  }
  const years = [row.answer, ...row.others].map((option) => Number(option.fact.year));
  const answerYear = Number(row.answer.fact.year);
  const extreme = row.direction === "earliest" ? Math.min(...years) : Math.max(...years);
  if (answerYear !== extreme) {
    errors.push(`${row.checksum}: answer is not the ${row.direction} year of the set`);
  }
  return { errors };
}

function buildYearReveal(row: YearRevealRow): LearnHistoryDatesReveal {
  return {
    skillNodes: [row.node],
    distractors: row.distractorYears.map((year) => yearDistractor(row, year)),
    correctReveal: yearCorrectReveal(row),
    // The anchor fact is part of the reveal copy, so it must be cited too.
    provenance: provenance(
      [dateClaim(row.fact), ...(row.anchor ? [dateClaim(row.anchor)] : [])],
      "agree",
    ),
  };
}

function buildChronologyReveal(row: ChronologyRevealRow): LearnHistoryDatesReveal {
  return {
    skillNodes: [CHRONOLOGY_NODE],
    distractors: row.others.map((option) => chronologyDistractor(row, option)),
    correctReveal: chronologyCorrectReveal(row),
    provenance: provenance(
      [row.answer, ...row.others].map((option) => dateClaim(option.fact)),
      "agree",
    ),
  };
}

export type LearnHistoryDatesRevealsValidationReport = {
  ok: boolean;
  errors: string[];
  revealCount: number;
};

function buildAll(): {
  byChecksum: Record<string, LearnHistoryDatesReveal>;
  report: LearnHistoryDatesRevealsValidationReport;
} {
  const byChecksum: Record<string, LearnHistoryDatesReveal> = {};
  const errors: string[] = [];

  for (const row of YEAR_REVEAL_ROWS) {
    const outcome = validateYearRow(row);
    if (outcome.errors.length > 0) {
      errors.push(...outcome.errors);
      continue;
    }
    byChecksum[row.checksum] = buildYearReveal(row);
  }

  for (const row of CHRONOLOGY_REVEAL_ROWS) {
    const outcome = validateChronologyRow(row);
    if (outcome.errors.length > 0) {
      errors.push(...outcome.errors);
      continue;
    }
    byChecksum[row.checksum] = buildChronologyReveal(row);
  }

  return {
    byChecksum,
    report: {
      ok: errors.length === 0,
      errors,
      revealCount: Object.keys(byChecksum).length,
    },
  };
}

const built = buildAll();

export const learnHistoryDatesRevealsV1ByChecksum = built.byChecksum;

export function validateLearnHistoryDatesRevealsV1(): LearnHistoryDatesRevealsValidationReport {
  return built.report;
}

export const learnHistoryDatesRevealChecksumsByNode: Record<string, string[]> = {
  [EVENTS_NODE]: YEAR_REVEAL_ROWS.filter((row) => row.node === EVENTS_NODE).map(
    (row) => row.checksum,
  ),
  [FOUNDING_NODE]: YEAR_REVEAL_ROWS.filter((row) => row.node === FOUNDING_NODE).map(
    (row) => row.checksum,
  ),
  [CHRONOLOGY_NODE]: CHRONOLOGY_REVEAL_ROWS.map((row) => row.checksum),
};

export const learnHistoryDatesRevealsV1Metadata = {
  batchId: BATCH_ID,
  mode: "learn",
  layer: "checksum_reveals",
  workUnitId: WORK_UNIT_ID,
  sourceBatchId: SOURCE_BATCH_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "agree" as Verdict,
};
