import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";
type HistoryCategory =
  | "historical_event_dates"
  | "founding_independence_years"
  | "historical_chronology";
type WikidataDateProperty = "P585" | "P571";
type DatePrecision = "day" | "month" | "year";

type HistoricalDateFact = {
  name: string;
  qid: string;
  property: WikidataDateProperty;
  year: string;
  date: string;
  precision: DatePrecision;
  calendar: "Gregorian" | "Julian";
  sourceRefKind: "single-event-year" | "single-inception-year";
};

type ProvenanceClaim = {
  claim: string;
  sourceType: SourceType;
  sourceRef: string;
  retrievedAt: string;
  volatility: Volatility;
};

type ScoreModeProvenance = {
  claims: ProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: Verdict;
  batchId: string;
  workUnitId: string;
};

export type KnowledgeHistoryCieScoreBatchV6Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeHistoryCieScoreBatchV6Question;

type YearQuestionFact = {
  kind: "eventDate" | "foundingIndependence";
  category: HistoryCategory;
  difficulty: Difficulty;
  question: string;
  answer: HistoricalDateFact;
  distractors: [string, string, string];
  explanation: string;
};

type ChronologyOption = { text: string; fact: HistoricalDateFact };

type ChronologyFact = {
  kind: "chronology";
  category: HistoryCategory;
  difficulty: Difficulty;
  direction: "earliest" | "latest";
  question: string;
  options: [ChronologyOption, ChronologyOption, ChronologyOption, ChronologyOption];
};

type RawFact = YearQuestionFact | ChronologyFact;

type EventQuestionSpec = {
  difficulty: Difficulty;
  question: string;
  answer: HistoricalDateFact;
};

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "knowledge_history_cie_score_v6";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v6";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

function historicalDate(
  name: string,
  qid: string,
  year: string,
  date: string,
  calendar: "Gregorian" | "Julian",
): HistoricalDateFact {
  return { name, qid, property: "P585", year, date, precision: "day", calendar, sourceRefKind: "single-event-year" };
}

const dateFacts = {
  battleOfLegnica: historicalDate("Battle of Legnica", "Q159512", "1241", "+1241-04-09T00:00:00Z", "Julian"),
  battleOfNarva: historicalDate("Battle of Narva", "Q155726", "1700", "+1700-11-30T00:00:00Z", "Gregorian"),
  battleOfTheRiverPlate: historicalDate("Battle of the River Plate", "Q713529", "1939", "+1939-12-13T00:00:00Z", "Gregorian"),
  battleOfBlenheim: historicalDate("Battle of Blenheim", "Q154635", "1704", "+1704-08-13T00:00:00Z", "Gregorian"),
  battleOfTheNeva: historicalDate("Battle of the Neva", "Q521799", "1240", "+1240-07-15T00:00:00Z", "Julian"),
  operationTenGo: historicalDate("Operation Ten-Go", "Q379433", "1945", "+1945-04-07T00:00:00Z", "Gregorian"),
  thirdBattleOfPanipat: historicalDate("Third Battle of Panipat", "Q1259218", "1761", "+1761-01-14T00:00:00Z", "Gregorian"),
  battleOfBalaclava: historicalDate("Battle of Balaclava", "Q464512", "1854", "+1854-10-25T00:00:00Z", "Gregorian"),
  battleOfValmy: historicalDate("Battle of Valmy", "Q4411", "1792", "+1792-09-20T00:00:00Z", "Gregorian"),
  battleOfTheFalklandIslands: historicalDate("Battle of the Falkland Islands", "Q160011", "1914", "+1914-12-08T00:00:00Z", "Gregorian"),
  battleOfSluys: historicalDate("Battle of Sluys", "Q871366", "1340", "+1340-06-24T00:00:00Z", "Julian"),
  battleOfMohi: historicalDate("Battle of Mohi", "Q705874", "1241", "+1241-04-11T00:00:00Z", "Julian"),
  battleOfKoniggratz: historicalDate("Battle of Koniggratz", "Q154942", "1866", "+1866-07-03T00:00:00Z", "Gregorian"),
  battleOfPavia: historicalDate("Battle of Pavia", "Q63468", "1525", "+1525-02-24T00:00:00Z", "Julian"),
  battlesOfLexingtonAndConcord: historicalDate("Battles of Lexington and Concord", "Q778010", "1775", "+1775-04-19T00:00:00Z", "Gregorian"),
  battleOfMontgisard: historicalDate("Battle of Montgisard", "Q847287", "1177", "+1177-11-25T00:00:00Z", "Gregorian"),
  battleOfMaritsa: historicalDate("Battle of Maritsa", "Q939570", "1371", "+1371-09-26T00:00:00Z", "Gregorian"),
  battleOfLutzen: historicalDate("Battle of Lutzen", "Q167259", "1632", "+1632-11-16T00:00:00Z", "Gregorian"),
  firstBattleOfBullRun: historicalDate("First Battle of Bull Run", "Q221469", "1861", "+1861-07-21T00:00:00Z", "Gregorian"),
  battleOfPreveza: historicalDate("Battle of Preveza", "Q1054975", "1538", "+1538-09-28T00:00:00Z", "Julian"),
  cites: historicalDate("CITES", "Q191836", "1973", "+1973-03-03T00:00:00Z", "Gregorian"),
  treatyOfTordesillas: historicalDate("Treaty of Tordesillas", "Q180897", "1494", "+1494-06-07T00:00:00Z", "Julian"),
  antiCominternPact: historicalDate("Anti-Comintern Pact", "Q152195", "1936", "+1936-11-25T00:00:00Z", "Gregorian"),
  kelloggBriandPact: historicalDate("Kellogg-Briand Pact", "Q205073", "1928", "+1928-08-27T00:00:00Z", "Gregorian"),
  treatyOfParis1783: historicalDate("Treaty of Paris (1783)", "Q217450", "1783", "+1783-09-03T00:00:00Z", "Gregorian"),
  genocideConvention: historicalDate("Genocide Convention", "Q865344", "1948", "+1948-12-09T00:00:00Z", "Gregorian"),
  brettonWoodsSystem: historicalDate("Bretton Woods system", "Q188532", "1944", "+1944-07-22T00:00:00Z", "Gregorian"),
  romeStatute: historicalDate("Rome Statute of the International Criminal Court", "Q838958", "1998", "+1998-07-17T00:00:00Z", "Gregorian"),
  fourteenPoints: historicalDate("Fourteen Points", "Q157648", "1918", "+1918-01-08T00:00:00Z", "Gregorian"),
  chemicalWeaponsConvention: historicalDate("Chemical Weapons Convention", "Q547896", "1993", "+1993-01-13T00:00:00Z", "Gregorian"),
  treatyOfSanStefano: historicalDate("Treaty of San Stefano", "Q194113", "1878", "+1878-03-03T00:00:00Z", "Gregorian"),
  surrenderOfJapan: historicalDate("surrender of Japan", "Q6540361", "1945", "+1945-09-02T00:00:00Z", "Gregorian"),
  myLaiMassacre: historicalDate("My Lai Massacre", "Q183421", "1968", "+1968-03-16T00:00:00Z", "Gregorian"),
  kingDavidHotelBombing: historicalDate("King David Hotel bombing", "Q1814446", "1946", "+1946-07-22T00:00:00Z", "Gregorian"),
  sowetoUprising: historicalDate("Soweto uprising", "Q153081", "1976", "+1976-06-16T00:00:00Z", "Gregorian"),
  worldTradeCenterBombing1993: historicalDate("1993 World Trade Center bombing", "Q11240", "1993", "+1993-02-26T00:00:00Z", "Gregorian"),
  decembristRevolt: historicalDate("Decembrist revolt", "Q126306", "1825", "+1825-12-26T00:00:00Z", "Gregorian"),
  kappPutsch: historicalDate("Kapp Putsch", "Q161141", "1920", "+1920-03-13T00:00:00Z", "Gregorian"),
};

const EVENT_SPECS: EventQuestionSpec[] = [
  { difficulty: "easy", question: "In which year did the Battle of Legnica take place?", answer: dateFacts.battleOfLegnica },
  { difficulty: "intermediate", question: "The Battle of Narva is dated to which year?", answer: dateFacts.battleOfNarva },
  { difficulty: "hard", question: "Which year is attached to the Battle of the River Plate?", answer: dateFacts.battleOfTheRiverPlate },
  { difficulty: "easy", question: "In which year did the Battle of Blenheim take place?", answer: dateFacts.battleOfBlenheim },
  { difficulty: "intermediate", question: "The Battle of the Neva is dated to which year?", answer: dateFacts.battleOfTheNeva },
  { difficulty: "hard", question: "Which year is attached to Operation Ten-Go?", answer: dateFacts.operationTenGo },
  { difficulty: "easy", question: "In which year did the Third Battle of Panipat take place?", answer: dateFacts.thirdBattleOfPanipat },
  { difficulty: "intermediate", question: "The Battle of Balaclava is dated to which year?", answer: dateFacts.battleOfBalaclava },
  { difficulty: "hard", question: "Which year is attached to the Battle of Valmy?", answer: dateFacts.battleOfValmy },
  { difficulty: "easy", question: "In which year did the Battle of the Falkland Islands take place?", answer: dateFacts.battleOfTheFalklandIslands },
  { difficulty: "intermediate", question: "The Battle of Sluys is dated to which year?", answer: dateFacts.battleOfSluys },
  { difficulty: "hard", question: "Which year is attached to the Battle of Mohi?", answer: dateFacts.battleOfMohi },
  { difficulty: "easy", question: "In which year did the Battle of Koniggratz take place?", answer: dateFacts.battleOfKoniggratz },
  { difficulty: "intermediate", question: "Wikidata assigns which year to the Battle of Pavia?", answer: dateFacts.battleOfPavia },
  { difficulty: "hard", question: "Which year is attached to the Battles of Lexington and Concord?", answer: dateFacts.battlesOfLexingtonAndConcord },
  { difficulty: "easy", question: "In which year did the Battle of Montgisard take place?", answer: dateFacts.battleOfMontgisard },
  { difficulty: "intermediate", question: "The Battle of Maritsa is dated to which year?", answer: dateFacts.battleOfMaritsa },
  { difficulty: "hard", question: "Which year is attached to the Battle of Lutzen?", answer: dateFacts.battleOfLutzen },
  { difficulty: "easy", question: "In which year did the First Battle of Bull Run take place?", answer: dateFacts.firstBattleOfBullRun },
  { difficulty: "intermediate", question: "The Battle of Preveza is dated to which year?", answer: dateFacts.battleOfPreveza },
  { difficulty: "hard", question: "Which year is attached to CITES?", answer: dateFacts.cites },
  { difficulty: "easy", question: "In which year is the Treaty of Tordesillas dated?", answer: dateFacts.treatyOfTordesillas },
  { difficulty: "intermediate", question: "The Anti-Comintern Pact is dated to which year?", answer: dateFacts.antiCominternPact },
  { difficulty: "hard", question: "Which year is attached to the Kellogg-Briand Pact?", answer: dateFacts.kelloggBriandPact },
  { difficulty: "easy", question: "In which year is the Treaty of Paris (1783) dated?", answer: dateFacts.treatyOfParis1783 },
  { difficulty: "intermediate", question: "The Genocide Convention is dated to which year?", answer: dateFacts.genocideConvention },
  { difficulty: "hard", question: "Which year is attached to the Bretton Woods system?", answer: dateFacts.brettonWoodsSystem },
  { difficulty: "easy", question: "In which year is the Rome Statute of the International Criminal Court dated?", answer: dateFacts.romeStatute },
  { difficulty: "intermediate", question: "The Fourteen Points are dated to which year?", answer: dateFacts.fourteenPoints },
  { difficulty: "hard", question: "Which year is attached to the Chemical Weapons Convention?", answer: dateFacts.chemicalWeaponsConvention },
  { difficulty: "easy", question: "In which year is the Treaty of San Stefano dated?", answer: dateFacts.treatyOfSanStefano },
  { difficulty: "intermediate", question: "The surrender of Japan is dated to which year?", answer: dateFacts.surrenderOfJapan },
  { difficulty: "hard", question: "Which year is attached to the My Lai Massacre?", answer: dateFacts.myLaiMassacre },
  { difficulty: "easy", question: "In which year did the King David Hotel bombing take place?", answer: dateFacts.kingDavidHotelBombing },
  { difficulty: "intermediate", question: "The Soweto uprising is dated to which year?", answer: dateFacts.sowetoUprising },
  { difficulty: "hard", question: "Which year is attached to the 1993 World Trade Center bombing?", answer: dateFacts.worldTradeCenterBombing1993 },
  { difficulty: "easy", question: "In which year did the Decembrist revolt take place?", answer: dateFacts.decembristRevolt },
  { difficulty: "intermediate", question: "The Kapp Putsch is dated to which year?", answer: dateFacts.kappPutsch },
];

const CHRONOLOGY_FACTS: ChronologyFact[] = [
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest among these medieval and early-modern entries?", options: [{ text: "Montgisard", fact: dateFacts.battleOfMontgisard }, { text: "Sluys", fact: dateFacts.battleOfSluys }, { text: "Battle of Maritsa", fact: dateFacts.battleOfMaritsa }, { text: "Treaty of Tordesillas", fact: dateFacts.treatyOfTordesillas }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest in this medieval-to-early-modern battle set?", options: [{ text: "Battle of the Neva", fact: dateFacts.battleOfTheNeva }, { text: "Battle of Legnica", fact: dateFacts.battleOfLegnica }, { text: "Battle of Pavia", fact: dateFacts.battleOfPavia }, { text: "Battle of Preveza", fact: dateFacts.battleOfPreveza }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest among these 17th- and 18th-century entries?", options: [{ text: "Battle of Lutzen", fact: dateFacts.battleOfLutzen }, { text: "Battle of Narva", fact: dateFacts.battleOfNarva }, { text: "Battle of Blenheim", fact: dateFacts.battleOfBlenheim }, { text: "Third Battle of Panipat", fact: dateFacts.thirdBattleOfPanipat }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest in this Age of Revolution sequence?", options: [{ text: "Battle of Valmy", fact: dateFacts.battleOfValmy }, { text: "Russian Decembrist revolt", fact: dateFacts.decembristRevolt }, { text: "Battle of Balaclava", fact: dateFacts.battleOfBalaclava }, { text: "First Bull Run", fact: dateFacts.firstBattleOfBullRun }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest among these late-19th and early-20th-century entries?", options: [{ text: "Battle of Koniggratz", fact: dateFacts.battleOfKoniggratz }, { text: "Treaty of San Stefano", fact: dateFacts.treatyOfSanStefano }, { text: "Battle of the Falkland Islands", fact: dateFacts.battleOfTheFalklandIslands }, { text: "Fourteen Points", fact: dateFacts.fourteenPoints }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest among these interwar entries?", options: [{ text: "Kapp Putsch", fact: dateFacts.kappPutsch }, { text: "Kellogg-Briand Pact", fact: dateFacts.kelloggBriandPact }, { text: "Anti-Comintern Pact", fact: dateFacts.antiCominternPact }, { text: "Battle of the River Plate", fact: dateFacts.battleOfTheRiverPlate }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this 1940s sequence?", options: [{ text: "Bretton Woods system", fact: dateFacts.brettonWoodsSystem }, { text: "Operation Ten-Go", fact: dateFacts.operationTenGo }, { text: "King David Hotel bombing", fact: dateFacts.kingDavidHotelBombing }, { text: "Genocide Convention", fact: dateFacts.genocideConvention }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these postwar treaty and protest entries?", options: [{ text: "My Lai Massacre", fact: dateFacts.myLaiMassacre }, { text: "CITES", fact: dateFacts.cites }, { text: "Soweto uprising", fact: dateFacts.sowetoUprising }, { text: "Rome Statute", fact: dateFacts.romeStatute }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this modern events set?", options: [{ text: "Kapp Putsch", fact: dateFacts.kappPutsch }, { text: "CITES", fact: dateFacts.cites }, { text: "Chemical Weapons Convention", fact: dateFacts.chemicalWeaponsConvention }, { text: "Rome Statute", fact: dateFacts.romeStatute }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these treaty dates?", options: [{ text: "Treaty of Paris (1783)", fact: dateFacts.treatyOfParis1783 }, { text: "Kellogg-Briand Pact", fact: dateFacts.kelloggBriandPact }, { text: "Genocide Convention", fact: dateFacts.genocideConvention }, { text: "Chemical Weapons Convention", fact: dateFacts.chemicalWeaponsConvention }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest among these global agreement dates?", options: [{ text: "Treaty of Tordesillas", fact: dateFacts.treatyOfTordesillas }, { text: "Anti-Comintern Pact", fact: dateFacts.antiCominternPact }, { text: "Bretton Woods system", fact: dateFacts.brettonWoodsSystem }, { text: "CITES", fact: dateFacts.cites }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest in this 20th-century conflict and crisis sequence?", options: [{ text: "Battle of the Falkland Islands", fact: dateFacts.battleOfTheFalklandIslands }, { text: "Battle of the River Plate", fact: dateFacts.battleOfTheRiverPlate }, { text: "Operation Ten-Go", fact: dateFacts.operationTenGo }, { text: "King David Hotel bombing", fact: dateFacts.kingDavidHotelBombing }] },
];

function yearDistractors(year: string, index: number): [string, string, string] {
  const numericYear = Number(year);
  const patterns: [number, number, number][] = [
    [-121, -43, 68],
    [-86, 28, 74],
    [-57, 19, 103],
    [-142, -61, 37],
    [-73, -24, 56],
    [-95, 31, 82],
  ];
  const values = patterns[index % patterns.length].map((offset) => {
    const candidate = numericYear + offset;
    if (candidate > 2025) return numericYear - Math.abs(offset) - 7;
    return candidate;
  });
  return [String(values[0]), String(values[1]), String(values[2])];
}
function eventQuestion(spec: EventQuestionSpec, index: number): YearQuestionFact {
  return { kind: "eventDate", category: "historical_event_dates", difficulty: spec.difficulty, question: spec.question, answer: spec.answer, distractors: yearDistractors(spec.answer.year, index), explanation: "Wikidata dates " + spec.answer.name + " to " + spec.answer.year + "." };
}

const RAW_FACTS: RawFact[] = [...EVENT_SPECS.map(eventQuestion), ...CHRONOLOGY_FACTS];

function sourceRef(fact: HistoricalDateFact) {
  return "wikidata:" + fact.qid + ":" + fact.property + ":" + fact.year + ":" + fact.sourceRefKind + ":snapshot-" + RETRIEVED_AT;
}
function claimPrefix(fact: HistoricalDateFact) {
  return fact.property === "P585" ? "point_in_time_year" : "inception_year";
}
function claim(text: string, sourceRefValue: string): ProvenanceClaim {
  return { claim: text, sourceType: "structured_open", sourceRef: sourceRefValue, retrievedAt: RETRIEVED_AT, volatility: "static" };
}
function bucket(category: HistoryCategory, difficulty: Difficulty) {
  return "knowledge_" + difficulty + "_" + category;
}
function checksum(index: number) {
  return BATCH_ID + "_" + String(index + 1).padStart(3, "0");
}
function rotateOptions(correctAnswer: string, distractors: [string, string, string], index: number) {
  const options = [correctAnswer, ...distractors];
  const [correct] = options.splice(0, 1);
  options.splice(index % 4, 0, correct);
  return options;
}
function provenance(claims: ProvenanceClaim[]): ScoreModeProvenance {
  return { claims, authorModel: AUTHOR_MODEL, verifierModel: VERIFIER_MODEL, verdict: VERDICT, batchId: BATCH_ID, workUnitId: WORK_UNIT_ID };
}
function yearNumber(fact: HistoricalDateFact) { return Number(fact.year); }
function chronologyAnswer(fact: ChronologyFact) {
  const sorted = [...fact.options].sort((left, right) => yearNumber(left.fact) - yearNumber(right.fact));
  return fact.direction === "earliest" ? sorted[0] : sorted[sorted.length - 1];
}
function chronologyDistractors(fact: ChronologyFact): [string, string, string] {
  const answer = chronologyAnswer(fact);
  const distractors = fact.options.filter((option) => option.text !== answer.text).map((option) => option.text);
  return [distractors[0], distractors[1], distractors[2]];
}
function yearClaims(fact: YearQuestionFact): ProvenanceClaim[] {
  const factSourceRef = sourceRef(fact.answer);
  return [
    claim(claimPrefix(fact.answer) + "(" + fact.answer.name + ") = " + fact.answer.year, factSourceRef),
    ...fact.distractors.map((distractor) => claim(claimPrefix(fact.answer) + "(" + fact.answer.name + ") != " + distractor, factSourceRef)),
  ];
}
function chronologyClaims(fact: ChronologyFact): ProvenanceClaim[] {
  const answer = chronologyAnswer(fact);
  return [
    ...fact.options.map((option) => claim(claimPrefix(option.fact) + "(" + option.fact.name + ") = " + option.fact.year, sourceRef(option.fact))),
    claim("chronology_" + fact.direction + "(" + fact.options.map((option) => option.text).join(" | ") + ") = " + answer.text, sourceRef(answer.fact)),
  ];
}
function claims(fact: RawFact) { return fact.kind === "chronology" ? chronologyClaims(fact) : yearClaims(fact); }
function chronologyExplanation(fact: ChronologyFact) {
  const answer = chronologyAnswer(fact);
  const datedOptions = fact.options.map((option) => option.text + " (" + option.fact.year + ")").join("; ");
  return answer.text + " is the " + fact.direction + " option: " + datedOptions + ".";
}
function correctAnswer(fact: RawFact) { return fact.kind === "chronology" ? chronologyAnswer(fact).text : fact.answer.year; }
function distractors(fact: RawFact): [string, string, string] { return fact.kind === "chronology" ? chronologyDistractors(fact) : fact.distractors; }
function explanation(fact: RawFact) { return fact.kind === "chronology" ? chronologyExplanation(fact) : fact.explanation; }
function buildQuestion(fact: RawFact, index: number): BatchQuestion {
  const answer = correctAnswer(fact);
  return { sport: "knowledge", category: fact.category, question: fact.question, options: rotateOptions(answer, distractors(fact), index), correctAnswer: answer, explanation: explanation(fact), difficulty: fact.difficulty, bucket: bucket(fact.category, fact.difficulty), checksum: checksum(index), provenance: provenance(claims(fact)) };
}
function wikidataPropertyLabel(property: WikidataDateProperty) { return property === "P585" ? "point in time" : "inception"; }
function dateFactsForRawFact(fact: RawFact) { if (fact.kind !== "chronology") return [fact.answer]; return fact.options.map((option) => option.fact); }
function makeSourceRecord(fact: HistoricalDateFact): WikidataSourceRecord {
  return { sourceRef: sourceRef(fact), sourceType: "structured_open", license: "CC0-1.0", retrievedAt: RETRIEVED_AT, volatility: "static", facts: { subject: { name: fact.name, qid: fact.qid }, property: fact.property, propertyLabel: wikidataPropertyLabel(fact.property), year: fact.year, wikidataTimeValue: fact.date, precision: fact.precision, calendar: fact.calendar, singleYearQuestion: true, excludedIfContestedOrDateRange: true, sourceRefKind: fact.sourceRefKind } };
}
function buildWikidataSourceRecords(facts: RawFact[]) {
  const records = new Map<string, WikidataSourceRecord>();
  for (const fact of facts) for (const dateFact of dateFactsForRawFact(fact)) { const record = makeSourceRecord(dateFact); records.set(record.sourceRef, record); }
  return Object.fromEntries([...records.entries()].sort(([a], [b]) => a.localeCompare(b)));
}
function factKind(fact: RawFact) { return fact.kind; }
function countBy<T extends string>(values: T[]) { return values.reduce<Record<T, number>>((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {} as Record<T, number>); }

export const knowledgeHistoryCieScoreBatchV6Questions = RAW_FACTS.map(buildQuestion);
export const questions = knowledgeHistoryCieScoreBatchV6Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV6Metadata = {
  batchId: BATCH_ID,
  mode: "score",
  workUnitId: WORK_UNIT_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: VERDICT,
  questionCount: knowledgeHistoryCieScoreBatchV6Questions.length,
  countsByCategory: countBy(knowledgeHistoryCieScoreBatchV6Questions.map((question) => question.category)),
  countsByDifficulty: countBy(knowledgeHistoryCieScoreBatchV6Questions.map((question) => question.difficulty)),
  countsByHistoryFactKind: countBy(RAW_FACTS.map(factKind)),
  wikidataSourcing: {
    historical_event_dates: "P585 point in time; year-only MCQ; single dated event, no ranges or contested/multi-stage dates",
    founding_independence_years: "P571 inception; year-only MCQ; single-valued founding/inception records only, default-denying contested declared/recognized/effective-date cases",
    historical_chronology: "P585/P571 date records for all options; 4-option MCQ asking earliest/latest only when all option years are unique and non-overlapping",
  },
  collisionRules: {
    historical_event_dates: "Author only event-to-year direction. The cited event has one unambiguous accepted P585 year; all distractor years differ from the cited P585 year.",
    founding_independence_years: "Author only entity-to-year direction. The cited entity has one accepted P571 year; exclude staged or disputed independence/founding cases; all distractor years differ from the cited year.",
    historical_chronology: "Each option carries a cited P585 or P571 year. The requested earliest/latest option is unique, with no tied years or date ranges among options.",
  },
  checksumConvention: "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeHistoryCieScoreBatchV6Questions;
