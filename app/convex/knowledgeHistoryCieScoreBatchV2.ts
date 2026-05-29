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

export type KnowledgeHistoryCieScoreBatchV2Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeHistoryCieScoreBatchV2Question;

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

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "knowledge_history_cie_score_v2";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v2";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

const dateFacts: Record<string, HistoricalDateFact> = {
  battleOfStamfordBridge: { name: "Battle of Stamford Bridge", qid: "Q203225", property: "P585", year: "1066", date: "+1066-09-25T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfManzikert: { name: "Battle of Manzikert", qid: "Q200032", property: "P585", year: "1071", date: "+1071-08-26T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  sackOfConstantinople: { name: "Sack of Constantinople", qid: "Q1750892", property: "P585", year: "1204", date: "+1204-04-13T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfTheGoldenSpurs: { name: "Battle of the Golden Spurs", qid: "Q44732", property: "P585", year: "1302", date: "+1302-07-11T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfCrecy: { name: "Battle of Crecy", qid: "Q27759", property: "P585", year: "1346", date: "+1346-08-26T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfPoitiers: { name: "Battle of Poitiers", qid: "Q201692", property: "P585", year: "1356", date: "+1356-09-19T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfKosovo: { name: "Battle of Kosovo", qid: "Q179288", property: "P585", year: "1389", date: "+1389-06-28T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfGrunwald: { name: "Battle of Grunwald", qid: "Q33570", property: "P585", year: "1410", date: "+1410-07-15T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfBosworthField: { name: "Battle of Bosworth Field", qid: "Q222013", property: "P585", year: "1485", date: "+1485-08-22T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  dietOfWorms: { name: "Diet of Worms", qid: "Q536822", property: "P585", year: "1521", date: "+1521-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfMohacs: { name: "Battle of Mohacs", qid: "Q178510", property: "P585", year: "1526", date: "+1526-08-29T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  stBartholomewSDayMassacre: { name: "St. Bartholomew's Day massacre", qid: "Q163891", property: "P585", year: "1572", date: "+1572-08-24T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfSekigahara: { name: "Battle of Sekigahara", qid: "Q234188", property: "P585", year: "1600", date: "+1600-10-21T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  executionOfCharlesI: { name: "execution of Charles I", qid: "Q65088700", property: "P585", year: "1649", date: "+1649-01-30T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  battleOfVienna: { name: "Battle of Vienna", qid: "Q200855", property: "P585", year: "1683", date: "+1683-09-12T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfCulloden: { name: "Battle of Culloden", qid: "Q651919", property: "P585", year: "1746", date: "+1746-04-27T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  bostonMassacre: { name: "Boston Massacre", qid: "Q215687", property: "P585", year: "1770", date: "+1770-03-05T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  unitedStatesDeclarationOfIndependence: { name: "United States Declaration of Independence", qid: "Q127912", property: "P585", year: "1776", date: "+1776-07-04T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  siegeOfYorktown: { name: "Siege of Yorktown", qid: "Q459447", property: "P585", year: "1781", date: "+1781-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  executionOfLouisXVI: { name: "execution of Louis XVI", qid: "Q3062714", property: "P585", year: "1793", date: "+1793-01-21T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  universityOfBologna: { name: "University of Bologna", qid: "Q131262", property: "P571", year: "1088", date: "+1088-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-inception-year" },
  universityOfCambridge: { name: "University of Cambridge", qid: "Q35794", property: "P571", year: "1209", date: "+1209-01-01T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  universityOfSalamanca: { name: "University of Salamanca", qid: "Q308963", property: "P571", year: "1218", date: "+1218-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-inception-year" },
  universityOfPadua: { name: "University of Padua", qid: "Q193510", property: "P571", year: "1222", date: "+1222-09-00T00:00:00Z", precision: "month", calendar: "Julian", sourceRefKind: "single-inception-year" },
  universityOfCoimbra: { name: "University of Coimbra", qid: "Q368643", property: "P571", year: "1290", date: "+1290-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-inception-year" },
  universityOfVienna: { name: "University of Vienna", qid: "Q165980", property: "P571", year: "1365", date: "+1365-03-12T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-inception-year" },
  heidelbergUniversity: { name: "Heidelberg University", qid: "Q151510", property: "P571", year: "1386", date: "+1386-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-inception-year" },
  universityOfStAndrews: { name: "University of St Andrews", qid: "Q216273", property: "P571", year: "1413", date: "+1413-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-inception-year" },
  uppsalaUniversity: { name: "Uppsala University", qid: "Q185246", property: "P571", year: "1477", date: "+1477-00-00T00:00:00Z", precision: "year", calendar: "Julian", sourceRefKind: "single-inception-year" },
  universityOfCopenhagen: { name: "University of Copenhagen", qid: "Q186285", property: "P571", year: "1479", date: "+1479-06-01T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-inception-year" },
  trinityCollegeDublin: { name: "Trinity College Dublin", qid: "Q258464", property: "P571", year: "1592", date: "+1592-03-03T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  harvardUniversity: { name: "Harvard University", qid: "Q13371", property: "P571", year: "1636", date: "+1636-09-08T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  yaleUniversity: { name: "Yale University", qid: "Q49112", property: "P571", year: "1701", date: "+1701-01-01T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  princetonUniversity: { name: "Princeton University", qid: "Q21578", property: "P571", year: "1746", date: "+1746-01-01T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  britishMuseum: { name: "British Museum", qid: "Q6373", property: "P571", year: "1753", date: "+1753-01-01T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
};

const RAW_FACTS: RawFact[] = [
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Battle of Stamford Bridge is dated to which year?", answer: dateFacts.battleOfStamfordBridge, distractors: ["1045","1079","1100"], explanation: "Wikidata dates the Battle of Stamford Bridge to 1066." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "In which year did the Battle of Manzikert take place?", answer: dateFacts.battleOfManzikert, distractors: ["1054","1080","1099"], explanation: "Wikidata dates the Battle of Manzikert to 1071." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Sack of Constantinople occurred in which year?", answer: dateFacts.sackOfConstantinople, distractors: ["1171","1216","1251"], explanation: "Wikidata dates the Sack of Constantinople to 1204." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "Which year is attached to the Battle of the Golden Spurs?", answer: dateFacts.battleOfTheGoldenSpurs, distractors: ["1290","1320","1341"], explanation: "Wikidata dates the Battle of the Golden Spurs to 1302." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Battle of Crecy is dated to which year?", answer: dateFacts.battleOfCrecy, distractors: ["1325","1359","1380"], explanation: "Wikidata dates the Battle of Crecy to 1346." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "In which year did the Battle of Poitiers take place?", answer: dateFacts.battleOfPoitiers, distractors: ["1339","1365","1384"], explanation: "Wikidata dates the Battle of Poitiers to 1356." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Battle of Kosovo occurred in which year?", answer: dateFacts.battleOfKosovo, distractors: ["1356","1401","1436"], explanation: "Wikidata dates the Battle of Kosovo to 1389." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "Which year is attached to the Battle of Grunwald?", answer: dateFacts.battleOfGrunwald, distractors: ["1398","1428","1449"], explanation: "Wikidata dates the Battle of Grunwald to 1410." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Battle of Bosworth Field is dated to which year?", answer: dateFacts.battleOfBosworthField, distractors: ["1464","1498","1519"], explanation: "Wikidata dates the Battle of Bosworth Field to 1485." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "In which year did the Diet of Worms take place?", answer: dateFacts.dietOfWorms, distractors: ["1504","1530","1549"], explanation: "Wikidata dates the Diet of Worms to 1521." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Battle of Mohacs occurred in which year?", answer: dateFacts.battleOfMohacs, distractors: ["1493","1538","1573"], explanation: "Wikidata dates the Battle of Mohacs to 1526." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "Which year is attached to the St. Bartholomew's Day massacre?", answer: dateFacts.stBartholomewSDayMassacre, distractors: ["1560","1590","1611"], explanation: "Wikidata dates the St. Bartholomew's Day massacre to 1572." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Battle of Sekigahara is dated to which year?", answer: dateFacts.battleOfSekigahara, distractors: ["1579","1613","1634"], explanation: "Wikidata dates the Battle of Sekigahara to 1600." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "In which year did the execution of Charles I take place?", answer: dateFacts.executionOfCharlesI, distractors: ["1632","1658","1677"], explanation: "Wikidata dates the execution of Charles I to 1649." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Battle of Vienna occurred in which year?", answer: dateFacts.battleOfVienna, distractors: ["1650","1695","1730"], explanation: "Wikidata dates the Battle of Vienna to 1683." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "Which year is attached to the Battle of Culloden?", answer: dateFacts.battleOfCulloden, distractors: ["1734","1764","1785"], explanation: "Wikidata dates the Battle of Culloden to 1746." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Boston Massacre is dated to which year?", answer: dateFacts.bostonMassacre, distractors: ["1749","1783","1804"], explanation: "Wikidata dates the Boston Massacre to 1770." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "In which year did the United States Declaration of Independence take place?", answer: dateFacts.unitedStatesDeclarationOfIndependence, distractors: ["1759","1785","1804"], explanation: "Wikidata dates the United States Declaration of Independence to 1776." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Siege of Yorktown occurred in which year?", answer: dateFacts.siegeOfYorktown, distractors: ["1748","1793","1828"], explanation: "Wikidata dates the Siege of Yorktown to 1781." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "Which year is attached to the execution of Louis XVI?", answer: dateFacts.executionOfLouisXVI, distractors: ["1781","1811","1832"], explanation: "Wikidata dates the execution of Louis XVI to 1793." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "University of Bologna was founded in which year?", answer: dateFacts.universityOfBologna, distractors: ["1055","1100","1135"], explanation: "Wikidata lists University of Bologna's inception year as 1088." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "In which year was University of Cambridge established?", answer: dateFacts.universityOfCambridge, distractors: ["1197","1227","1248"], explanation: "Wikidata lists University of Cambridge's inception year as 1209." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "University of Salamanca traces its inception to which year?", answer: dateFacts.universityOfSalamanca, distractors: ["1197","1231","1252"], explanation: "Wikidata lists University of Salamanca's inception year as 1218." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Which year is listed for the founding of University of Padua?", answer: dateFacts.universityOfPadua, distractors: ["1205","1231","1250"], explanation: "Wikidata lists University of Padua's inception year as 1222." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "University of Coimbra was founded in which year?", answer: dateFacts.universityOfCoimbra, distractors: ["1257","1302","1337"], explanation: "Wikidata lists University of Coimbra's inception year as 1290." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "In which year was University of Vienna established?", answer: dateFacts.universityOfVienna, distractors: ["1353","1383","1404"], explanation: "Wikidata lists University of Vienna's inception year as 1365." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Heidelberg University traces its inception to which year?", answer: dateFacts.heidelbergUniversity, distractors: ["1365","1399","1420"], explanation: "Wikidata lists Heidelberg University's inception year as 1386." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "Which year is listed for the founding of University of St Andrews?", answer: dateFacts.universityOfStAndrews, distractors: ["1396","1422","1441"], explanation: "Wikidata lists University of St Andrews's inception year as 1413." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Uppsala University was founded in which year?", answer: dateFacts.uppsalaUniversity, distractors: ["1444","1489","1524"], explanation: "Wikidata lists Uppsala University's inception year as 1477." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "In which year was University of Copenhagen established?", answer: dateFacts.universityOfCopenhagen, distractors: ["1467","1497","1518"], explanation: "Wikidata lists University of Copenhagen's inception year as 1479." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "Trinity College Dublin traces its inception to which year?", answer: dateFacts.trinityCollegeDublin, distractors: ["1571","1605","1626"], explanation: "Wikidata lists Trinity College Dublin's inception year as 1592." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Which year is listed for the founding of Harvard University?", answer: dateFacts.harvardUniversity, distractors: ["1619","1645","1664"], explanation: "Wikidata lists Harvard University's inception year as 1636." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Yale University was founded in which year?", answer: dateFacts.yaleUniversity, distractors: ["1668","1713","1748"], explanation: "Wikidata lists Yale University's inception year as 1701." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "In which year was Princeton University established?", answer: dateFacts.princetonUniversity, distractors: ["1734","1764","1785"], explanation: "Wikidata lists Princeton University's inception year as 1746." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "British Museum traces its inception to which year?", answer: dateFacts.britishMuseum, distractors: ["1732","1766","1787"], explanation: "Wikidata lists British Museum's inception year as 1753." },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this medieval battle timeline?", options: [{ text: "Battle of Stamford Bridge", fact: dateFacts.battleOfStamfordBridge }, { text: "Battle of Manzikert", fact: dateFacts.battleOfManzikert }, { text: "Battle of the Golden Spurs", fact: dateFacts.battleOfTheGoldenSpurs }, { text: "Battle of Crecy", fact: dateFacts.battleOfCrecy }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these medieval and Renaissance conflicts?", options: [{ text: "Battle of Poitiers", fact: dateFacts.battleOfPoitiers }, { text: "Battle of Kosovo", fact: dateFacts.battleOfKosovo }, { text: "Battle of Grunwald", fact: dateFacts.battleOfGrunwald }, { text: "Battle of Bosworth Field", fact: dateFacts.battleOfBosworthField }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this Constantinople-to-Reformation set?", options: [{ text: "Sack of Constantinople", fact: dateFacts.sackOfConstantinople }, { text: "Diet of Worms", fact: dateFacts.dietOfWorms }, { text: "Battle of Mohacs", fact: dateFacts.battleOfMohacs }, { text: "St. Bartholomew's Day massacre", fact: dateFacts.stBartholomewSDayMassacre }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these early-modern milestones?", options: [{ text: "Battle of Sekigahara", fact: dateFacts.battleOfSekigahara }, { text: "execution of Charles I", fact: dateFacts.executionOfCharlesI }, { text: "Battle of Vienna", fact: dateFacts.battleOfVienna }, { text: "Battle of Culloden", fact: dateFacts.battleOfCulloden }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this American and French Revolution set?", options: [{ text: "Boston Massacre", fact: dateFacts.bostonMassacre }, { text: "United States Declaration of Independence", fact: dateFacts.unitedStatesDeclarationOfIndependence }, { text: "Siege of Yorktown", fact: dateFacts.siegeOfYorktown }, { text: "execution of Louis XVI", fact: dateFacts.executionOfLouisXVI }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which listed university has the most recent inception year?", options: [{ text: "University of Bologna", fact: dateFacts.universityOfBologna }, { text: "University of Cambridge", fact: dateFacts.universityOfCambridge }, { text: "University of Salamanca", fact: dateFacts.universityOfSalamanca }, { text: "University of Padua", fact: dateFacts.universityOfPadua }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which listed university has the oldest inception year?", options: [{ text: "University of Coimbra", fact: dateFacts.universityOfCoimbra }, { text: "University of Vienna", fact: dateFacts.universityOfVienna }, { text: "Heidelberg University", fact: dateFacts.heidelbergUniversity }, { text: "University of St Andrews", fact: dateFacts.universityOfStAndrews }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which listed academic institution was founded latest?", options: [{ text: "Uppsala University", fact: dateFacts.uppsalaUniversity }, { text: "University of Copenhagen", fact: dateFacts.universityOfCopenhagen }, { text: "Trinity College Dublin", fact: dateFacts.trinityCollegeDublin }, { text: "Harvard University", fact: dateFacts.harvardUniversity }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this 1700s set?", options: [{ text: "Yale University", fact: dateFacts.yaleUniversity }, { text: "Princeton University", fact: dateFacts.princetonUniversity }, { text: "British Museum", fact: dateFacts.britishMuseum }, { text: "Boston Massacre", fact: dateFacts.bostonMassacre }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest in this 1300s-to-1600s sequence?", options: [{ text: "Battle of Kosovo", fact: dateFacts.battleOfKosovo }, { text: "Battle of Grunwald", fact: dateFacts.battleOfGrunwald }, { text: "Battle of Sekigahara", fact: dateFacts.battleOfSekigahara }, { text: "execution of Charles I", fact: dateFacts.executionOfCharlesI }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this universities-and-conflicts sequence?", options: [{ text: "University of Bologna", fact: dateFacts.universityOfBologna }, { text: "Sack of Constantinople", fact: dateFacts.sackOfConstantinople }, { text: "Battle of the Golden Spurs", fact: dateFacts.battleOfTheGoldenSpurs }, { text: "University of Vienna", fact: dateFacts.universityOfVienna }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these 1700s milestones?", options: [{ text: "Yale University", fact: dateFacts.yaleUniversity }, { text: "Princeton University", fact: dateFacts.princetonUniversity }, { text: "British Museum", fact: dateFacts.britishMuseum }, { text: "U.S. independence declaration", fact: dateFacts.unitedStatesDeclarationOfIndependence }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest in this 1500s-to-1700s sequence?", options: [{ text: "Diet of Worms", fact: dateFacts.dietOfWorms }, { text: "Battle of Mohacs", fact: dateFacts.battleOfMohacs }, { text: "Trinity College Dublin", fact: dateFacts.trinityCollegeDublin }, { text: "Battle of Vienna", fact: dateFacts.battleOfVienna }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest among these late-medieval entries?", options: [{ text: "Battle of Crecy", fact: dateFacts.battleOfCrecy }, { text: "Battle of Poitiers", fact: dateFacts.battleOfPoitiers }, { text: "Battle of Kosovo", fact: dateFacts.battleOfKosovo }, { text: "Battle of Grunwald", fact: dateFacts.battleOfGrunwald }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which event is latest in this revolutionary-era timeline?", options: [{ text: "Battle of Culloden", fact: dateFacts.battleOfCulloden }, { text: "Boston Massacre", fact: dateFacts.bostonMassacre }, { text: "Siege of Yorktown", fact: dateFacts.siegeOfYorktown }, { text: "execution of Louis XVI", fact: dateFacts.executionOfLouisXVI }] },
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

export const knowledgeHistoryCieScoreBatchV2Questions = RAW_FACTS.map(buildQuestion);
export const questions = knowledgeHistoryCieScoreBatchV2Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV2Metadata = {
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
  questionCount: knowledgeHistoryCieScoreBatchV2Questions.length,
  countsByCategory: countBy(knowledgeHistoryCieScoreBatchV2Questions.map((question) => question.category)),
  countsByDifficulty: countBy(knowledgeHistoryCieScoreBatchV2Questions.map((question) => question.difficulty)),
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

export default knowledgeHistoryCieScoreBatchV2Questions;
