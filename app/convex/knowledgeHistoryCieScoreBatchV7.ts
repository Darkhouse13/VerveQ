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

export type KnowledgeHistoryCieScoreBatchV7Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeHistoryCieScoreBatchV7Question;

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

type FoundingQuestionSpec = {
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

const BATCH_ID = "knowledge_history_cie_score_v7";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v7";
const RETRIEVED_AT = "2026-06-22";
const AUTHOR_MODEL = "anthropic/claude-opus-4-8";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

function eventDate(
  name: string,
  qid: string,
  year: string,
  date: string,
  calendar: "Gregorian" | "Julian",
): HistoricalDateFact {
  return { name, qid, property: "P585", year, date, precision: "day", calendar, sourceRefKind: "single-event-year" };
}

function inceptionDate(
  name: string,
  qid: string,
  year: string,
  date: string,
  precision: DatePrecision,
  calendar: "Gregorian" | "Julian",
): HistoricalDateFact {
  return { name, qid, property: "P571", year, date, precision, calendar, sourceRefKind: "single-inception-year" };
}

const dateFacts = {
  battleOfTours: eventDate("Battle of Tours", "Q173077", "732", "+0732-10-10T00:00:00Z", "Julian"),
  battleOfTowton: eventDate("Battle of Towton", "Q634629", "1461", "+1461-03-29T00:00:00Z", "Julian"),
  battleOfFlodden: eventDate("Battle of Flodden", "Q1300742", "1513", "+1513-09-09T00:00:00Z", "Julian"),
  secondDefenestrationOfPrague: eventDate("Second Defenestration of Prague", "Q13365740", "1618", "+1618-05-23T00:00:00Z", "Gregorian"),
  battleOfRocroi: eventDate("Battle of Rocroi", "Q728480", "1643", "+1643-05-19T00:00:00Z", "Gregorian"),
  battleOfMarstonMoor: eventDate("Battle of Marston Moor", "Q326417", "1644", "+1644-07-02T00:00:00Z", "Gregorian"),
  battleOfNaseby: eventDate("Battle of Naseby", "Q949724", "1645", "+1645-06-14T00:00:00Z", "Gregorian"),
  battleOfTheBoyne: eventDate("Battle of the Boyne", "Q644960", "1690", "+1690-07-11T00:00:00Z", "Gregorian"),
  battleOfPoltava: eventDate("Battle of Poltava", "Q152486", "1709", "+1709-07-08T00:00:00Z", "Gregorian"),
  battleOfFontenoy: eventDate("Battle of Fontenoy", "Q569953", "1745", "+1745-05-11T00:00:00Z", "Gregorian"),
  battleOfPlassey: eventDate("Battle of Plassey", "Q203233", "1757", "+1757-06-23T00:00:00Z", "Gregorian"),
  battlesOfSaratoga: eventDate("Battles of Saratoga", "Q846674", "1777", "+1777-10-07T00:00:00Z", "Gregorian"),
  battleOfMagenta: eventDate("Battle of Magenta", "Q681430", "1859", "+1859-06-04T00:00:00Z", "Gregorian"),
  battleOfOmdurman: eventDate("Battle of Omdurman", "Q1137302", "1898", "+1898-09-02T00:00:00Z", "Gregorian"),
  battleOfTsushima: eventDate("Battle of Tsushima", "Q208127", "1905", "+1905-05-28T00:00:00Z", "Gregorian"),
  academieFrancaise: inceptionDate("Academie francaise", "Q161806", "1635", "+1635-01-01T00:00:00Z", "year", "Gregorian"),
  royalObservatoryGreenwich: inceptionDate("Royal Observatory, Greenwich", "Q192988", "1675", "+1675-03-04T00:00:00Z", "day", "Gregorian"),
  bankOfEngland: inceptionDate("Bank of England", "Q183231", "1694", "+1694-07-27T00:00:00Z", "day", "Gregorian"),
  rijksmuseum: inceptionDate("Rijksmuseum", "Q190804", "1800", "+1800-01-01T00:00:00Z", "year", "Gregorian"),
  museoDelPrado: inceptionDate("Museo del Prado", "Q160112", "1819", "+1819-01-01T00:00:00Z", "year", "Gregorian"),
  massachusettsInstituteOfTechnology: inceptionDate("Massachusetts Institute of Technology", "Q49108", "1861", "+1861-04-10T00:00:00Z", "day", "Gregorian"),
  cornellUniversity: inceptionDate("Cornell University", "Q49115", "1865", "+1865-01-01T00:00:00Z", "year", "Gregorian"),
  nokia: inceptionDate("Nokia", "Q1418", "1865", "+1865-05-12T00:00:00Z", "day", "Gregorian"),
  johnsHopkinsUniversity: inceptionDate("Johns Hopkins University", "Q193727", "1876", "+1876-01-01T00:00:00Z", "year", "Gregorian"),
  stanfordUniversity: inceptionDate("Stanford University", "Q41506", "1885", "+1885-01-01T00:00:00Z", "year", "Gregorian"),
  tateBritain: inceptionDate("Tate Britain", "Q195436", "1897", "+1897-01-01T00:00:00Z", "year", "Gregorian"),
  greenpeace: inceptionDate("Greenpeace", "Q81307", "1971", "+1971-01-01T00:00:00Z", "year", "Gregorian"),
  doctorsWithoutBorders: inceptionDate("Doctors Without Borders", "Q49330", "1971", "+1971-12-21T00:00:00Z", "day", "Gregorian"),
};

const EVENT_SPECS: EventQuestionSpec[] = [
  { difficulty: "easy", question: "In which year did the Battle of Tours take place?", answer: dateFacts.battleOfTours },
  { difficulty: "intermediate", question: "The Battle of Towton is dated to which year?", answer: dateFacts.battleOfTowton },
  { difficulty: "hard", question: "Which year is attached to the Battle of Flodden?", answer: dateFacts.battleOfFlodden },
  { difficulty: "easy", question: "In which year did the Second Defenestration of Prague take place?", answer: dateFacts.secondDefenestrationOfPrague },
  { difficulty: "intermediate", question: "The Battle of Rocroi is dated to which year?", answer: dateFacts.battleOfRocroi },
  { difficulty: "hard", question: "Which year is attached to the Battle of Marston Moor?", answer: dateFacts.battleOfMarstonMoor },
  { difficulty: "easy", question: "In which year did the Battle of Naseby take place?", answer: dateFacts.battleOfNaseby },
  { difficulty: "intermediate", question: "The Battle of the Boyne is dated to which year?", answer: dateFacts.battleOfTheBoyne },
  { difficulty: "hard", question: "Which year is attached to the Battle of Poltava?", answer: dateFacts.battleOfPoltava },
  { difficulty: "easy", question: "In which year did the Battle of Fontenoy take place?", answer: dateFacts.battleOfFontenoy },
  { difficulty: "intermediate", question: "The Battle of Plassey is dated to which year?", answer: dateFacts.battleOfPlassey },
  { difficulty: "hard", question: "Which year is attached to the Battles of Saratoga?", answer: dateFacts.battlesOfSaratoga },
  { difficulty: "easy", question: "In which year did the Battle of Magenta take place?", answer: dateFacts.battleOfMagenta },
  { difficulty: "intermediate", question: "The Battle of Omdurman is dated to which year?", answer: dateFacts.battleOfOmdurman },
  { difficulty: "hard", question: "Which year is attached to the Battle of Tsushima?", answer: dateFacts.battleOfTsushima },
];

const FOUNDING_SPECS: FoundingQuestionSpec[] = [
  { difficulty: "hard", question: "The Academie francaise traces its inception to which year?", answer: dateFacts.academieFrancaise },
  { difficulty: "intermediate", question: "In which year was the Royal Observatory, Greenwich established?", answer: dateFacts.royalObservatoryGreenwich },
  { difficulty: "easy", question: "The Bank of England was founded in which year?", answer: dateFacts.bankOfEngland },
  { difficulty: "intermediate", question: "Which year is listed for the founding of the Rijksmuseum?", answer: dateFacts.rijksmuseum },
  { difficulty: "hard", question: "The Museo del Prado traces its inception to which year?", answer: dateFacts.museoDelPrado },
  { difficulty: "easy", question: "In which year was the Massachusetts Institute of Technology established?", answer: dateFacts.massachusettsInstituteOfTechnology },
  { difficulty: "intermediate", question: "Cornell University was founded in which year?", answer: dateFacts.cornellUniversity },
  { difficulty: "hard", question: "Which year is listed for the founding of Nokia?", answer: dateFacts.nokia },
  { difficulty: "easy", question: "Johns Hopkins University traces its inception to which year?", answer: dateFacts.johnsHopkinsUniversity },
  { difficulty: "intermediate", question: "In which year was Stanford University established?", answer: dateFacts.stanfordUniversity },
  { difficulty: "hard", question: "Tate Britain was founded in which year?", answer: dateFacts.tateBritain },
  { difficulty: "easy", question: "Which year is listed for the founding of Greenpeace?", answer: dateFacts.greenpeace },
  { difficulty: "intermediate", question: "Doctors Without Borders was founded in which year?", answer: dateFacts.doctorsWithoutBorders },
];

const CHRONOLOGY_FACTS: ChronologyFact[] = [
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest among these medieval and early-modern battles?", options: [{ text: "Battle of Tours", fact: dateFacts.battleOfTours }, { text: "Battle of Towton", fact: dateFacts.battleOfTowton }, { text: "Battle of Flodden", fact: dateFacts.battleOfFlodden }, { text: "Second Defenestration of Prague", fact: dateFacts.secondDefenestrationOfPrague }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest in this 17th-century conflict set?", options: [{ text: "Second Defenestration of Prague", fact: dateFacts.secondDefenestrationOfPrague }, { text: "Battle of Rocroi", fact: dateFacts.battleOfRocroi }, { text: "Battle of Marston Moor", fact: dateFacts.battleOfMarstonMoor }, { text: "Battle of the Boyne", fact: dateFacts.battleOfTheBoyne }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest among these 17th- and 18th-century battles?", options: [{ text: "Battle of Naseby", fact: dateFacts.battleOfNaseby }, { text: "Battle of Poltava", fact: dateFacts.battleOfPoltava }, { text: "Battle of Fontenoy", fact: dateFacts.battleOfFontenoy }, { text: "Battle of Plassey", fact: dateFacts.battleOfPlassey }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest in this 18th- and 19th-century battle sequence?", options: [{ text: "Battle of Fontenoy", fact: dateFacts.battleOfFontenoy }, { text: "Battles of Saratoga", fact: dateFacts.battlesOfSaratoga }, { text: "Battle of Magenta", fact: dateFacts.battleOfMagenta }, { text: "Battle of Omdurman", fact: dateFacts.battleOfOmdurman }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest among these 18th- to early-20th-century battles?", options: [{ text: "Battle of Magenta", fact: dateFacts.battleOfMagenta }, { text: "Battle of Omdurman", fact: dateFacts.battleOfOmdurman }, { text: "Battle of Tsushima", fact: dateFacts.battleOfTsushima }, { text: "Battle of Plassey", fact: dateFacts.battleOfPlassey }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest among these institutional foundings?", options: [{ text: "Academie francaise", fact: dateFacts.academieFrancaise }, { text: "Royal Observatory, Greenwich", fact: dateFacts.royalObservatoryGreenwich }, { text: "Bank of England", fact: dateFacts.bankOfEngland }, { text: "Rijksmuseum", fact: dateFacts.rijksmuseum }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest among these cultural and scientific landmark foundings?", options: [{ text: "Rijksmuseum", fact: dateFacts.rijksmuseum }, { text: "Museo del Prado", fact: dateFacts.museoDelPrado }, { text: "Tate Britain", fact: dateFacts.tateBritain }, { text: "Royal Observatory", fact: dateFacts.royalObservatoryGreenwich }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these university foundings?", options: [{ text: "Massachusetts Institute of Technology", fact: dateFacts.massachusettsInstituteOfTechnology }, { text: "Cornell University", fact: dateFacts.cornellUniversity }, { text: "Johns Hopkins University", fact: dateFacts.johnsHopkinsUniversity }, { text: "Stanford University", fact: dateFacts.stanfordUniversity }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest among these foundings spanning four centuries?", options: [{ text: "Academie francaise", fact: dateFacts.academieFrancaise }, { text: "Bank of England", fact: dateFacts.bankOfEngland }, { text: "Museo del Prado", fact: dateFacts.museoDelPrado }, { text: "Stanford University", fact: dateFacts.stanfordUniversity }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these landmark foundings?", options: [{ text: "Bank of England", fact: dateFacts.bankOfEngland }, { text: "Massachusetts Institute of Technology", fact: dateFacts.massachusettsInstituteOfTechnology }, { text: "Tate Britain", fact: dateFacts.tateBritain }, { text: "Greenpeace", fact: dateFacts.greenpeace }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest among these events and foundings?", options: [{ text: "Battle of the Boyne", fact: dateFacts.battleOfTheBoyne }, { text: "Royal Observatory, Greenwich", fact: dateFacts.royalObservatoryGreenwich }, { text: "Bank of England", fact: dateFacts.bankOfEngland }, { text: "Rijksmuseum", fact: dateFacts.rijksmuseum }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest in this set spanning battles and foundings?", options: [{ text: "Battle of Tsushima", fact: dateFacts.battleOfTsushima }, { text: "Stanford University", fact: dateFacts.stanfordUniversity }, { text: "Johns Hopkins University", fact: dateFacts.johnsHopkinsUniversity }, { text: "Greenpeace", fact: dateFacts.greenpeace }] },
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
    if (candidate < 1) return numericYear + Math.abs(offset) + 11;
    return candidate;
  });
  return [String(values[0]), String(values[1]), String(values[2])];
}
function eventQuestion(spec: EventQuestionSpec, index: number): YearQuestionFact {
  return { kind: "eventDate", category: "historical_event_dates", difficulty: spec.difficulty, question: spec.question, answer: spec.answer, distractors: yearDistractors(spec.answer.year, index), explanation: "Wikidata dates " + spec.answer.name + " to " + spec.answer.year + "." };
}
function foundingQuestion(spec: FoundingQuestionSpec, index: number): YearQuestionFact {
  return { kind: "foundingIndependence", category: "founding_independence_years", difficulty: spec.difficulty, question: spec.question, answer: spec.answer, distractors: yearDistractors(spec.answer.year, index + 2), explanation: "Wikidata records the inception of " + spec.answer.name + " as " + spec.answer.year + "." };
}

const RAW_FACTS: RawFact[] = [
  ...EVENT_SPECS.map(eventQuestion),
  ...FOUNDING_SPECS.map(foundingQuestion),
  ...CHRONOLOGY_FACTS,
];

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

export const knowledgeHistoryCieScoreBatchV7Questions = RAW_FACTS.map(buildQuestion);
export const questions = knowledgeHistoryCieScoreBatchV7Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV7Metadata = {
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
  questionCount: knowledgeHistoryCieScoreBatchV7Questions.length,
  countsByCategory: countBy(knowledgeHistoryCieScoreBatchV7Questions.map((question) => question.category)),
  countsByDifficulty: countBy(knowledgeHistoryCieScoreBatchV7Questions.map((question) => question.difficulty)),
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

export default knowledgeHistoryCieScoreBatchV7Questions;
