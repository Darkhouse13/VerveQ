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

export type KnowledgeHistoryCieScoreBatchV5Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeHistoryCieScoreBatchV5Question;

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

const BATCH_ID = "knowledge_history_cie_score_v5";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v5";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "claude-opus-4-8";
const VERDICT: Verdict = "agree";

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
  battleOfAnkara: historicalDate("Battle of Ankara", "Q209387", "1402", "+1402-07-20T00:00:00Z", "Julian"),
  battleOfKulikovo: historicalDate("Battle of Kulikovo", "Q210354", "1380", "+1380-09-08T00:00:00Z", "Julian"),
  battleOfWhiteMountain: historicalDate("Battle of White Mountain", "Q4373", "1620", "+1620-11-08T00:00:00Z", "Gregorian"),
  battleOfAinJalut: historicalDate("Battle of Ain Jalut", "Q244356", "1260", "+1260-09-03T00:00:00Z", "Julian"),
  battleOfJenaAuerstedt: historicalDate("Battle of Jena-Auerstedt", "Q154426", "1806", "+1806-10-14T00:00:00Z", "Gregorian"),
  battleOfVarna: historicalDate("Battle of Varna", "Q32832", "1444", "+1444-11-10T00:00:00Z", "Gregorian"),
  battleOfNicopolis: historicalDate("Battle of Nicopolis", "Q212220", "1396", "+1396-09-25T00:00:00Z", "Gregorian"),
  battleOfTheKalkaRiver: historicalDate("Battle of the Kalka River", "Q570204", "1223", "+1223-05-31T00:00:00Z", "Julian"),
  battleOfTheNile: historicalDate("Battle of the Nile", "Q243979", "1798", "+1798-08-01T00:00:00Z", "Gregorian"),
  battleOfMarengo: historicalDate("Battle of Marengo", "Q273011", "1800", "+1800-06-14T00:00:00Z", "Gregorian"),
  battleOfLasNavasDeTolosa: historicalDate("Battle of Las Navas de Tolosa", "Q219697", "1212", "+1212-07-16T00:00:00Z", "Julian"),
  battleOfPanipat: historicalDate("Battle of Panipat", "Q605321", "1526", "+1526-05-01T00:00:00Z", "Julian"),
  battleOfTheIce: historicalDate("Battle of the Ice", "Q14689", "1242", "+1242-04-05T00:00:00Z", "Julian"),
  battleOfChaldiran: historicalDate("Battle of Chaldiran", "Q745110", "1514", "+1514-08-23T00:00:00Z", "Julian"),
  dieppeRaid: historicalDate("Dieppe Raid", "Q270517", "1942", "+1942-08-19T00:00:00Z", "Gregorian"),
  battleOfNavarino: historicalDate("Battle of Navarino", "Q238440", "1827", "+1827-10-20T00:00:00Z", "Gregorian"),
  battleOfFalkirk: historicalDate("Battle of Falkirk", "Q589318", "1298", "+1298-07-22T00:00:00Z", "Julian"),
  battleOfStirlingBridge: historicalDate("Battle of Stirling Bridge", "Q499626", "1297", "+1297-09-11T00:00:00Z", "Gregorian"),
  battleOfThePyramids: historicalDate("Battle of the Pyramids", "Q332543", "1798", "+1798-07-21T00:00:00Z", "Gregorian"),
  battleOfFriedland: historicalDate("Battle of Friedland", "Q241108", "1807", "+1807-06-14T00:00:00Z", "Gregorian"),
  charterOfTheUnitedNations: historicalDate("Charter of the United Nations", "Q171328", "1945", "+1945-06-26T00:00:00Z", "Gregorian"),
  kyotoProtocol: historicalDate("Kyoto Protocol", "Q47359", "1997", "+1997-12-11T00:00:00Z", "Gregorian"),
  schengenAgreement: historicalDate("Schengen Agreement", "Q2822795", "1985", "+1985-06-14T00:00:00Z", "Gregorian"),
  maastrichtTreaty: historicalDate("Maastricht Treaty", "Q11146", "1992", "+1992-02-07T00:00:00Z", "Gregorian"),
  peaceOfWestphalia: historicalDate("Peace of Westphalia", "Q150995", "1648", "+1648-10-24T00:00:00Z", "Gregorian"),
  antarcticTreatySystem: historicalDate("Antarctic Treaty System", "Q182814", "1959", "+1959-12-01T00:00:00Z", "Gregorian"),
  treatyOfLisbon: historicalDate("Treaty of Lisbon", "Q52843", "2007", "+2007-12-13T00:00:00Z", "Gregorian"),
  ramsarConvention: historicalDate("Ramsar Convention", "Q170170", "1971", "+1971-02-02T00:00:00Z", "Gregorian"),
  nuclearNonProliferationTreaty: historicalDate("Treaty on the Non-Proliferation of Nuclear Weapons", "Q186444", "1968", "+1968-07-01T00:00:00Z", "Gregorian"),
  treatyOfLausanne: historicalDate("Treaty of Lausanne", "Q193258", "1923", "+1923-07-24T00:00:00Z", "Gregorian"),
  lateranTreaty: historicalDate("Lateran Treaty", "Q193270", "1929", "+1929-02-11T00:00:00Z", "Gregorian"),
  sykesPicotAgreement: historicalDate("Sykes-Picot Agreement", "Q211674", "1916", "+1916-05-16T00:00:00Z", "Gregorian"),
  lisbonEarthquake1755: historicalDate("1755 Lisbon earthquake", "Q191055", "1755", "+1755-11-01T00:00:00Z", "Gregorian"),
  jallianwalaBaghMassacre: historicalDate("Jallianwala Bagh massacre", "Q208855", "1919", "+1919-04-13T00:00:00Z", "Gregorian"),
  greatChicagoFire: historicalDate("Great Chicago Fire", "Q70520", "1871", "+1871-10-08T00:00:00Z", "Gregorian"),
  greatKantoEarthquake: historicalDate("Great Kanto earthquake", "Q274498", "1923", "+1923-09-01T00:00:00Z", "Gregorian"),
  twentyJulyPlot: historicalDate("20 July plot", "Q105570", "1944", "+1944-07-20T00:00:00Z", "Gregorian"),
  chileanCoup1973: historicalDate("1973 Chilean coup d'etat", "Q856670", "1973", "+1973-09-11T00:00:00Z", "Gregorian"),
};

const EVENT_SPECS: EventQuestionSpec[] = [
  { difficulty: "easy", question: "In which year did the Battle of Ankara take place?", answer: dateFacts.battleOfAnkara },
  { difficulty: "intermediate", question: "The Battle of Kulikovo is dated to which year?", answer: dateFacts.battleOfKulikovo },
  { difficulty: "hard", question: "Which year is attached to the Battle of White Mountain?", answer: dateFacts.battleOfWhiteMountain },
  { difficulty: "easy", question: "In which year did the Battle of Ain Jalut take place?", answer: dateFacts.battleOfAinJalut },
  { difficulty: "intermediate", question: "The Battle of Jena-Auerstedt is dated to which year?", answer: dateFacts.battleOfJenaAuerstedt },
  { difficulty: "hard", question: "Which year is attached to the Battle of Varna?", answer: dateFacts.battleOfVarna },
  { difficulty: "easy", question: "In which year did the Battle of Nicopolis take place?", answer: dateFacts.battleOfNicopolis },
  { difficulty: "intermediate", question: "The Battle of the Kalka River is dated to which year?", answer: dateFacts.battleOfTheKalkaRiver },
  { difficulty: "hard", question: "Which year is attached to the Battle of the Nile?", answer: dateFacts.battleOfTheNile },
  { difficulty: "easy", question: "In which year did the Battle of Marengo take place?", answer: dateFacts.battleOfMarengo },
  { difficulty: "intermediate", question: "The Battle of Las Navas de Tolosa is dated to which year?", answer: dateFacts.battleOfLasNavasDeTolosa },
  { difficulty: "hard", question: "Which year is attached to the Battle of Panipat?", answer: dateFacts.battleOfPanipat },
  { difficulty: "easy", question: "In which year did the Battle of the Ice take place?", answer: dateFacts.battleOfTheIce },
  { difficulty: "intermediate", question: "The Battle of Chaldiran is dated to which year?", answer: dateFacts.battleOfChaldiran },
  { difficulty: "hard", question: "Which year is attached to the Dieppe Raid?", answer: dateFacts.dieppeRaid },
  { difficulty: "easy", question: "In which year did the Battle of Navarino take place?", answer: dateFacts.battleOfNavarino },
  { difficulty: "intermediate", question: "The Battle of Falkirk is dated to which year?", answer: dateFacts.battleOfFalkirk },
  { difficulty: "hard", question: "Which year is attached to the Battle of Stirling Bridge?", answer: dateFacts.battleOfStirlingBridge },
  { difficulty: "easy", question: "In which year did the Battle of the Pyramids take place?", answer: dateFacts.battleOfThePyramids },
  { difficulty: "intermediate", question: "The Battle of Friedland is dated to which year?", answer: dateFacts.battleOfFriedland },
  { difficulty: "hard", question: "Which year is attached to the Charter of the United Nations?", answer: dateFacts.charterOfTheUnitedNations },
  { difficulty: "easy", question: "In which year is the Kyoto Protocol dated?", answer: dateFacts.kyotoProtocol },
  { difficulty: "intermediate", question: "The Schengen Agreement is dated to which year?", answer: dateFacts.schengenAgreement },
  { difficulty: "hard", question: "Which year is attached to the Maastricht Treaty?", answer: dateFacts.maastrichtTreaty },
  { difficulty: "easy", question: "In which year is the Peace of Westphalia dated?", answer: dateFacts.peaceOfWestphalia },
  { difficulty: "intermediate", question: "The Antarctic Treaty System is dated to which year?", answer: dateFacts.antarcticTreatySystem },
  { difficulty: "hard", question: "Which year is attached to the Treaty of Lisbon?", answer: dateFacts.treatyOfLisbon },
  { difficulty: "easy", question: "In which year is the Ramsar Convention dated?", answer: dateFacts.ramsarConvention },
  { difficulty: "intermediate", question: "The Treaty on the Non-Proliferation of Nuclear Weapons is dated to which year?", answer: dateFacts.nuclearNonProliferationTreaty },
  { difficulty: "hard", question: "Which year is attached to the Treaty of Lausanne?", answer: dateFacts.treatyOfLausanne },
  { difficulty: "easy", question: "In which year is the Lateran Treaty dated?", answer: dateFacts.lateranTreaty },
  { difficulty: "intermediate", question: "The Sykes-Picot Agreement is dated to which year?", answer: dateFacts.sykesPicotAgreement },
  { difficulty: "hard", question: "Which year is attached to the 1755 Lisbon earthquake?", answer: dateFacts.lisbonEarthquake1755 },
  { difficulty: "easy", question: "In which year did the Jallianwala Bagh massacre take place?", answer: dateFacts.jallianwalaBaghMassacre },
  { difficulty: "intermediate", question: "The Great Chicago Fire is dated to which year?", answer: dateFacts.greatChicagoFire },
  { difficulty: "hard", question: "Which year is attached to the Great Kanto earthquake?", answer: dateFacts.greatKantoEarthquake },
  { difficulty: "easy", question: "In which year did the 20 July plot take place?", answer: dateFacts.twentyJulyPlot },
  { difficulty: "intermediate", question: "The 1973 Chilean coup d'etat is dated to which year?", answer: dateFacts.chileanCoup1973 },
];

const CHRONOLOGY_FACTS: ChronologyFact[] = [
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest among these medieval battles?", options: [{ text: "Las Navas de Tolosa", fact: dateFacts.battleOfLasNavasDeTolosa }, { text: "Kalka River", fact: dateFacts.battleOfTheKalkaRiver }, { text: "Battle of the Ice", fact: dateFacts.battleOfTheIce }, { text: "Ain Jalut", fact: dateFacts.battleOfAinJalut }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest in this late-medieval battle set?", options: [{ text: "Falkirk", fact: dateFacts.battleOfFalkirk }, { text: "Kulikovo", fact: dateFacts.battleOfKulikovo }, { text: "Nicopolis", fact: dateFacts.battleOfNicopolis }, { text: "Ankara", fact: dateFacts.battleOfAnkara }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest among these 15th-to-17th-century entries?", options: [{ text: "Varna", fact: dateFacts.battleOfVarna }, { text: "Chaldiran", fact: dateFacts.battleOfChaldiran }, { text: "Panipat", fact: dateFacts.battleOfPanipat }, { text: "White Mountain", fact: dateFacts.battleOfWhiteMountain }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these Napoleonic-era battles?", options: [{ text: "Battle of the Nile", fact: dateFacts.battleOfTheNile }, { text: "Battle of Marengo", fact: dateFacts.battleOfMarengo }, { text: "Jena-Auerstedt", fact: dateFacts.battleOfJenaAuerstedt }, { text: "Friedland", fact: dateFacts.battleOfFriedland }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest in this treaty-and-disaster sequence?", options: [{ text: "Peace of Westphalia", fact: dateFacts.peaceOfWestphalia }, { text: "1755 Lisbon earthquake", fact: dateFacts.lisbonEarthquake1755 }, { text: "Battle of Navarino", fact: dateFacts.battleOfNavarino }, { text: "Great Chicago Fire", fact: dateFacts.greatChicagoFire }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest among these early-20th-century entries?", options: [{ text: "Sykes-Picot Agreement", fact: dateFacts.sykesPicotAgreement }, { text: "Jallianwala Bagh massacre", fact: dateFacts.jallianwalaBaghMassacre }, { text: "Treaty of Lausanne", fact: dateFacts.treatyOfLausanne }, { text: "Lateran Treaty", fact: dateFacts.lateranTreaty }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest among these wartime and postwar entries?", options: [{ text: "Dieppe Raid", fact: dateFacts.dieppeRaid }, { text: "20 July plot", fact: dateFacts.twentyJulyPlot }, { text: "Charter of the United Nations", fact: dateFacts.charterOfTheUnitedNations }, { text: "Antarctic Treaty System", fact: dateFacts.antarcticTreatySystem }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest in this late-20th-century set?", options: [{ text: "Nuclear Non-Proliferation Treaty", fact: dateFacts.nuclearNonProliferationTreaty }, { text: "Ramsar Convention", fact: dateFacts.ramsarConvention }, { text: "1973 Chilean coup d'etat", fact: dateFacts.chileanCoup1973 }, { text: "Schengen Agreement", fact: dateFacts.schengenAgreement }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest among these modern treaty dates?", options: [{ text: "NPT", fact: dateFacts.nuclearNonProliferationTreaty }, { text: "Maastricht Treaty", fact: dateFacts.maastrichtTreaty }, { text: "Kyoto Protocol", fact: dateFacts.kyotoProtocol }, { text: "Treaty of Lisbon", fact: dateFacts.treatyOfLisbon }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these diplomatic milestones?", options: [{ text: "Charter of the United Nations", fact: dateFacts.charterOfTheUnitedNations }, { text: "Antarctic Treaty System", fact: dateFacts.antarcticTreatySystem }, { text: "Schengen Agreement", fact: dateFacts.schengenAgreement }, { text: "Kyoto Protocol", fact: dateFacts.kyotoProtocol }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest in this mixed battle-and-treaty set?", options: [{ text: "Nicopolis", fact: dateFacts.battleOfNicopolis }, { text: "Panipat", fact: dateFacts.battleOfPanipat }, { text: "Peace of Westphalia", fact: dateFacts.peaceOfWestphalia }, { text: "Battle of the Nile", fact: dateFacts.battleOfTheNile }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest among these disaster and diplomacy entries?", options: [{ text: "Great Chicago Fire", fact: dateFacts.greatChicagoFire }, { text: "Sykes-Picot Agreement", fact: dateFacts.sykesPicotAgreement }, { text: "Great Kanto earthquake", fact: dateFacts.greatKantoEarthquake }, { text: "1973 Chilean coup d'etat", fact: dateFacts.chileanCoup1973 }] },
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

export const knowledgeHistoryCieScoreBatchV5Questions = RAW_FACTS.map(buildQuestion);
export const questions = knowledgeHistoryCieScoreBatchV5Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV5Metadata = {
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
  questionCount: knowledgeHistoryCieScoreBatchV5Questions.length,
  countsByCategory: countBy(knowledgeHistoryCieScoreBatchV5Questions.map((question) => question.category)),
  countsByDifficulty: countBy(knowledgeHistoryCieScoreBatchV5Questions.map((question) => question.difficulty)),
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

export default knowledgeHistoryCieScoreBatchV5Questions;
