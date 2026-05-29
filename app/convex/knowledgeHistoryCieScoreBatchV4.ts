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

export type KnowledgeHistoryCieScoreBatchV4Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeHistoryCieScoreBatchV4Question;

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

const BATCH_ID = "knowledge_history_cie_score_v4";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v4";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

const dateFacts: Record<string, HistoricalDateFact> = {
  armisticeOfCompiegne: { name: "Armistice of Compiegne", qid: "Q253224", property: "P585", year: "1918", date: "+1918-11-11T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  marchOnRome: { name: "March on Rome", qid: "Q468823", property: "P585", year: "1922", date: "+1922-10-01T00:00:00Z", precision: "month", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  beerHallPutsch: { name: "Beer Hall Putsch", qid: "Q36749", property: "P585", year: "1923", date: "+1923-11-09T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  stValentineSDayMassacre: { name: "St. Valentine's Day Massacre", qid: "Q1164263", property: "P585", year: "1929", date: "+1929-02-14T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  saltMarch: { name: "Salt March", qid: "Q239344", property: "P585", year: "1930", date: "+1930-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  reichstagFire: { name: "Reichstag fire", qid: "Q153992", property: "P585", year: "1933", date: "+1933-02-27T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  hindenburgDisaster: { name: "Hindenburg disaster", qid: "Q3182723", property: "P585", year: "1937", date: "+1937-05-06T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  munichAgreement: { name: "Munich Agreement", qid: "Q154255", property: "P585", year: "1938", date: "+1938-09-30T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  wannseeConference: { name: "Wannsee Conference", qid: "Q152120", property: "P585", year: "1942", date: "+1942-01-20T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  atomicBombingOfNagasaki: { name: "atomic bombing of Nagasaki", qid: "Q4382340", property: "P585", year: "1945", date: "+1945-08-09T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  assassinationOfMahatmaGandhi: { name: "assassination of Mahatma Gandhi", qid: "Q3350154", property: "P585", year: "1948", date: "+1948-01-30T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  sharpevilleMassacre: { name: "Sharpeville massacre", qid: "Q518753", property: "P585", year: "1960", date: "+1960-03-21T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  marchOnWashingtonForJobsAndFreedom: { name: "March on Washington for Jobs and Freedom", qid: "Q1128871", property: "P585", year: "1963", date: "+1963-08-28T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  assassinationOfMartinLutherKingJr: { name: "assassination of Martin Luther King Jr.", qid: "Q757963", property: "P585", year: "1968", date: "+1968-04-04T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  kentStateShootings: { name: "Kent State shootings", qid: "Q482635", property: "P585", year: "1970", date: "+1970-05-04T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  munichMassacre: { name: "Munich massacre", qid: "Q229007", property: "P585", year: "1972", date: "+1972-09-00T00:00:00Z", precision: "month", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  carnationRevolution: { name: "Carnation Revolution", qid: "Q193245", property: "P585", year: "1974", date: "+1974-04-25T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  fallOfSaigon: { name: "Fall of Saigon", qid: "Q482456", property: "P585", year: "1975", date: "+1975-04-30T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  spaceShuttleChallengerDisaster: { name: "Space Shuttle Challenger disaster", qid: "Q858145", property: "P585", year: "1986", date: "+1986-01-28T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  goodFridayAgreement: { name: "Good Friday Agreement", qid: "Q208958", property: "P585", year: "1998", date: "+1998-04-10T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  federalReserveSystem: { name: "Federal Reserve System", qid: "Q53536", property: "P571", year: "1913", date: "+1913-12-23T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  brookingsInstitution: { name: "Brookings Institution", qid: "Q929154", property: "P571", year: "1916", date: "+1916-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  timeMagazine: { name: "Time magazine", qid: "Q43297", property: "P571", year: "1923", date: "+1923-03-03T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  museumOfModernArt: { name: "Museum of Modern Art", qid: "Q188740", property: "P571", year: "1929", date: "+1929-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  nationalGalleryOfArt: { name: "National Gallery of Art", qid: "Q214867", property: "P571", year: "1937", date: "+1937-03-24T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  samsungGroup: { name: "Samsung Group", qid: "Q20716", property: "P571", year: "1938", date: "+1938-01-01T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  oxfam: { name: "Oxfam", qid: "Q267941", property: "P571", year: "1942", date: "+1942-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  iKEA: { name: "IKEA", qid: "Q54078", property: "P571", year: "1943", date: "+1943-07-28T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  rANDCorporation: { name: "RAND Corporation", qid: "Q861141", property: "P571", year: "1948", date: "+1948-05-14T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  councilOfEurope: { name: "Council of Europe", qid: "Q8908", property: "P571", year: "1949", date: "+1949-05-05T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  europeanBroadcastingUnion: { name: "European Broadcasting Union", qid: "Q166400", property: "P571", year: "1950", date: "+1950-02-12T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  cERN: { name: "CERN", qid: "Q42944", property: "P571", year: "1954", date: "+1954-09-29T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  worldWideFundForNature: { name: "World Wide Fund for Nature", qid: "Q117892", property: "P571", year: "1961", date: "+1961-04-29T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  europeanSpaceAgency: { name: "European Space Agency", qid: "Q42262", property: "P571", year: "1975", date: "+1975-05-30T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  microsoft: { name: "Microsoft", qid: "Q2283", property: "P571", year: "1975", date: "+1975-04-04T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
};

const RAW_FACTS: RawFact[] = [
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Armistice of Compiegne is dated to which year?", answer: dateFacts.armisticeOfCompiegne, distractors: ["1897","1931","1952"], explanation: "Wikidata dates the Armistice of Compiegne to 1918." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "In which year did the March on Rome take place?", answer: dateFacts.marchOnRome, distractors: ["1905","1931","1950"], explanation: "Wikidata dates the March on Rome to 1922." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Beer Hall Putsch occurred in which year?", answer: dateFacts.beerHallPutsch, distractors: ["1890","1935","1970"], explanation: "Wikidata dates the Beer Hall Putsch to 1923." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "Which year is attached to the St. Valentine's Day Massacre?", answer: dateFacts.stValentineSDayMassacre, distractors: ["1917","1947","1968"], explanation: "Wikidata dates the St. Valentine's Day Massacre to 1929." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Salt March is dated to which year?", answer: dateFacts.saltMarch, distractors: ["1909","1943","1964"], explanation: "Wikidata dates the Salt March to 1930." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "In which year did the Reichstag fire take place?", answer: dateFacts.reichstagFire, distractors: ["1916","1942","1961"], explanation: "Wikidata dates the Reichstag fire to 1933." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Hindenburg disaster occurred in which year?", answer: dateFacts.hindenburgDisaster, distractors: ["1904","1949","1984"], explanation: "Wikidata dates the Hindenburg disaster to 1937." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "Which year is attached to the Munich Agreement?", answer: dateFacts.munichAgreement, distractors: ["1926","1956","1977"], explanation: "Wikidata dates the Munich Agreement to 1938." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Wannsee Conference is dated to which year?", answer: dateFacts.wannseeConference, distractors: ["1921","1955","1976"], explanation: "Wikidata dates the Wannsee Conference to 1942." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "In which year did the atomic bombing of Nagasaki take place?", answer: dateFacts.atomicBombingOfNagasaki, distractors: ["1928","1954","1973"], explanation: "Wikidata dates the atomic bombing of Nagasaki to 1945." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The assassination of Mahatma Gandhi occurred in which year?", answer: dateFacts.assassinationOfMahatmaGandhi, distractors: ["1915","1960","1995"], explanation: "Wikidata dates the assassination of Mahatma Gandhi to 1948." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "Which year is attached to the Sharpeville massacre?", answer: dateFacts.sharpevilleMassacre, distractors: ["1948","1978","1999"], explanation: "Wikidata dates the Sharpeville massacre to 1960." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The March on Washington for Jobs and Freedom is dated to which year?", answer: dateFacts.marchOnWashingtonForJobsAndFreedom, distractors: ["1942","1976","1997"], explanation: "Wikidata dates the March on Washington for Jobs and Freedom to 1963." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "In which year did the assassination of Martin Luther King Jr. take place?", answer: dateFacts.assassinationOfMartinLutherKingJr, distractors: ["1951","1977","1996"], explanation: "Wikidata dates the assassination of Martin Luther King Jr. to 1968." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Kent State shootings occurred in which year?", answer: dateFacts.kentStateShootings, distractors: ["1937","1982","2017"], explanation: "Wikidata dates the Kent State shootings to 1970." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "Which year is attached to the Munich massacre?", answer: dateFacts.munichMassacre, distractors: ["1960","1990","2011"], explanation: "Wikidata dates the Munich massacre to 1972." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Carnation Revolution is dated to which year?", answer: dateFacts.carnationRevolution, distractors: ["1953","1987","2008"], explanation: "Wikidata dates the Carnation Revolution to 1974." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "In which year did the Fall of Saigon take place?", answer: dateFacts.fallOfSaigon, distractors: ["1958","1984","2003"], explanation: "Wikidata dates the Fall of Saigon to 1975." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Space Shuttle Challenger disaster occurred in which year?", answer: dateFacts.spaceShuttleChallengerDisaster, distractors: ["1953","1998","2033"], explanation: "Wikidata dates the Space Shuttle Challenger disaster to 1986." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "Which year is attached to the Good Friday Agreement?", answer: dateFacts.goodFridayAgreement, distractors: ["1986","2016","2037"], explanation: "Wikidata dates the Good Friday Agreement to 1998." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Federal Reserve System was founded in which year?", answer: dateFacts.federalReserveSystem, distractors: ["1880","1925","1960"], explanation: "Wikidata lists Federal Reserve System's inception year as 1913." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "In which year was Brookings Institution established?", answer: dateFacts.brookingsInstitution, distractors: ["1904","1934","1955"], explanation: "Wikidata lists Brookings Institution's inception year as 1916." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Time magazine traces its inception to which year?", answer: dateFacts.timeMagazine, distractors: ["1902","1936","1957"], explanation: "Wikidata lists Time magazine's inception year as 1923." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Which year is listed for the founding of Museum of Modern Art?", answer: dateFacts.museumOfModernArt, distractors: ["1912","1938","1957"], explanation: "Wikidata lists Museum of Modern Art's inception year as 1929." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "National Gallery of Art was founded in which year?", answer: dateFacts.nationalGalleryOfArt, distractors: ["1904","1949","1984"], explanation: "Wikidata lists National Gallery of Art's inception year as 1937." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "In which year was Samsung Group established?", answer: dateFacts.samsungGroup, distractors: ["1926","1956","1977"], explanation: "Wikidata lists Samsung Group's inception year as 1938." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Oxfam traces its inception to which year?", answer: dateFacts.oxfam, distractors: ["1921","1955","1976"], explanation: "Wikidata lists Oxfam's inception year as 1942." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "Which year is listed for the founding of IKEA?", answer: dateFacts.iKEA, distractors: ["1926","1952","1971"], explanation: "Wikidata lists IKEA's inception year as 1943." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "RAND Corporation was founded in which year?", answer: dateFacts.rANDCorporation, distractors: ["1915","1960","1995"], explanation: "Wikidata lists RAND Corporation's inception year as 1948." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "In which year was Council of Europe established?", answer: dateFacts.councilOfEurope, distractors: ["1937","1967","1988"], explanation: "Wikidata lists Council of Europe's inception year as 1949." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "European Broadcasting Union traces its inception to which year?", answer: dateFacts.europeanBroadcastingUnion, distractors: ["1929","1963","1984"], explanation: "Wikidata lists European Broadcasting Union's inception year as 1950." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Which year is listed for the founding of CERN?", answer: dateFacts.cERN, distractors: ["1937","1963","1982"], explanation: "Wikidata lists CERN's inception year as 1954." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "World Wide Fund for Nature was founded in which year?", answer: dateFacts.worldWideFundForNature, distractors: ["1928","1973","2008"], explanation: "Wikidata lists World Wide Fund for Nature's inception year as 1961." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "In which year was European Space Agency established?", answer: dateFacts.europeanSpaceAgency, distractors: ["1963","1993","2014"], explanation: "Wikidata lists European Space Agency's inception year as 1975." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Microsoft traces its inception to which year?", answer: dateFacts.microsoft, distractors: ["1954","1988","2009"], explanation: "Wikidata lists Microsoft's inception year as 1975." },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this interwar-period timeline?", options: [{ text: "Armistice of Compiegne", fact: dateFacts.armisticeOfCompiegne }, { text: "Rome march", fact: dateFacts.marchOnRome }, { text: "Beer Hall Putsch", fact: dateFacts.beerHallPutsch }, { text: "St. Valentine's Day Massacre", fact: dateFacts.stValentineSDayMassacre }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these 1930s and wartime entries?", options: [{ text: "Salt March", fact: dateFacts.saltMarch }, { text: "Reichstag fire", fact: dateFacts.reichstagFire }, { text: "Hindenburg disaster", fact: dateFacts.hindenburgDisaster }, { text: "Wannsee Conference", fact: dateFacts.wannseeConference }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this 1940s-to-1960s sequence?", options: [{ text: "atomic bombing of Nagasaki", fact: dateFacts.atomicBombingOfNagasaki }, { text: "assassination of Mahatma Gandhi", fact: dateFacts.assassinationOfMahatmaGandhi }, { text: "Sharpeville massacre", fact: dateFacts.sharpevilleMassacre }, { text: "Washington civil-rights march", fact: dateFacts.marchOnWashingtonForJobsAndFreedom }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these 1960s and 1970s events?", options: [{ text: "assassination of Martin Luther King Jr.", fact: dateFacts.assassinationOfMartinLutherKingJr }, { text: "Kent State shootings", fact: dateFacts.kentStateShootings }, { text: "Munich massacre", fact: dateFacts.munichMassacre }, { text: "Fall of Saigon", fact: dateFacts.fallOfSaigon }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest in this late-20th-century set?", options: [{ text: "Carnation Revolution", fact: dateFacts.carnationRevolution }, { text: "Space Shuttle Challenger disaster", fact: dateFacts.spaceShuttleChallengerDisaster }, { text: "Good Friday Agreement", fact: dateFacts.goodFridayAgreement }, { text: "Reichstag fire", fact: dateFacts.reichstagFire }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which organization in this set was founded earliest?", options: [{ text: "Federal Reserve System", fact: dateFacts.federalReserveSystem }, { text: "Brookings Institution", fact: dateFacts.brookingsInstitution }, { text: "Time magazine", fact: dateFacts.timeMagazine }, { text: "Museum of Modern Art", fact: dateFacts.museumOfModernArt }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which institution or company in this set was founded latest?", options: [{ text: "National Gallery of Art", fact: dateFacts.nationalGalleryOfArt }, { text: "Samsung Group", fact: dateFacts.samsungGroup }, { text: "Oxfam", fact: dateFacts.oxfam }, { text: "IKEA", fact: dateFacts.iKEA }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which postwar organization in this set is earliest?", options: [{ text: "RAND Corporation", fact: dateFacts.rANDCorporation }, { text: "Council of Europe", fact: dateFacts.councilOfEurope }, { text: "European Broadcasting Union", fact: dateFacts.europeanBroadcastingUnion }, { text: "CERN", fact: dateFacts.cERN }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these organizations and events?", options: [{ text: "World Wide Fund for Nature", fact: dateFacts.worldWideFundForNature }, { text: "European Space Agency", fact: dateFacts.europeanSpaceAgency }, { text: "Space Shuttle Challenger disaster", fact: dateFacts.spaceShuttleChallengerDisaster }, { text: "Good Friday Agreement", fact: dateFacts.goodFridayAgreement }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this events-and-institutions sequence?", options: [{ text: "Federal Reserve System", fact: dateFacts.federalReserveSystem }, { text: "Armistice of Compiegne", fact: dateFacts.armisticeOfCompiegne }, { text: "Time magazine", fact: dateFacts.timeMagazine }, { text: "Salt March", fact: dateFacts.saltMarch }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest among these 1937-to-1943 entries?", options: [{ text: "National Gallery of Art", fact: dateFacts.nationalGalleryOfArt }, { text: "Munich Agreement", fact: dateFacts.munichAgreement }, { text: "Oxfam", fact: dateFacts.oxfam }, { text: "IKEA", fact: dateFacts.iKEA }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which listed postwar institution has the oldest date?", options: [{ text: "RAND Corporation", fact: dateFacts.rANDCorporation }, { text: "Council of Europe", fact: dateFacts.councilOfEurope }, { text: "CERN", fact: dateFacts.cERN }, { text: "World Wide Fund for Nature", fact: dateFacts.worldWideFundForNature }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest in this Cold War era sequence?", options: [{ text: "Sharpeville massacre", fact: dateFacts.sharpevilleMassacre }, { text: "Washington civil-rights march", fact: dateFacts.marchOnWashingtonForJobsAndFreedom }, { text: "assassination of Martin Luther King Jr.", fact: dateFacts.assassinationOfMartinLutherKingJr }, { text: "Kent State shootings", fact: dateFacts.kentStateShootings }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest among these 1970s entries?", options: [{ text: "Kent State shootings", fact: dateFacts.kentStateShootings }, { text: "Munich massacre", fact: dateFacts.munichMassacre }, { text: "Carnation Revolution", fact: dateFacts.carnationRevolution }, { text: "Fall of Saigon", fact: dateFacts.fallOfSaigon }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest in this organizations-and-events timeline?", options: [{ text: "European Broadcasting Union", fact: dateFacts.europeanBroadcastingUnion }, { text: "World Wide Fund for Nature", fact: dateFacts.worldWideFundForNature }, { text: "European Space Agency", fact: dateFacts.europeanSpaceAgency }, { text: "Space Shuttle Challenger disaster", fact: dateFacts.spaceShuttleChallengerDisaster }] },
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

export const knowledgeHistoryCieScoreBatchV4Questions = RAW_FACTS.map(buildQuestion);
export const questions = knowledgeHistoryCieScoreBatchV4Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV4Metadata = {
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
  questionCount: knowledgeHistoryCieScoreBatchV4Questions.length,
  countsByCategory: countBy(knowledgeHistoryCieScoreBatchV4Questions.map((question) => question.category)),
  countsByDifficulty: countBy(knowledgeHistoryCieScoreBatchV4Questions.map((question) => question.difficulty)),
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

export default knowledgeHistoryCieScoreBatchV4Questions;
