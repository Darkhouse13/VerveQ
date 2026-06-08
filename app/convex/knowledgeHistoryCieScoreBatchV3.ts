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

export type KnowledgeHistoryCieScoreBatchV3Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeHistoryCieScoreBatchV3Question;

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

const BATCH_ID = "knowledge_history_cie_score_v3";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v3";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "claude-opus-4-8";
const VERDICT: Verdict = "agree";

const dateFacts: Record<string, HistoricalDateFact> = {
  battleOfAusterlitz: { name: "Battle of Austerlitz", qid: "Q134114", property: "P585", year: "1805", date: "+1805-12-02T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfBorodino: { name: "Battle of Borodino", qid: "Q184320", property: "P585", year: "1812", date: "+1812-09-07T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfNewOrleans: { name: "Battle of New Orleans", qid: "Q41894", property: "P585", year: "1815", date: "+1815-01-08T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  peterlooMassacre: { name: "Peterloo Massacre", qid: "Q876357", property: "P585", year: "1819", date: "+1819-08-16T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfSanJacinto: { name: "Battle of San Jacinto", qid: "Q841278", property: "P585", year: "1836", date: "+1836-04-21T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  treatyOfGuadalupeHidalgo: { name: "Treaty of Guadalupe Hidalgo", qid: "Q616109", property: "P585", year: "1848", date: "+1848-02-02T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfSolferino: { name: "Battle of Solferino", qid: "Q324916", property: "P585", year: "1859", date: "+1859-06-24T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfFortSumter: { name: "Battle of Fort Sumter", qid: "Q543165", property: "P585", year: "1861", date: "+1861-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  gettysburgAddress: { name: "Gettysburg Address", qid: "Q214524", property: "P585", year: "1863", date: "+1863-11-19T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfAppomattoxCourtHouse: { name: "Battle of Appomattox Court House", qid: "Q1355391", property: "P585", year: "1865", date: "+1865-04-09T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  alaskaPurchase: { name: "Alaska Purchase", qid: "Q309029", property: "P585", year: "1867", date: "+1867-03-30T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfIsandlwana: { name: "Battle of Isandlwana", qid: "Q747589", property: "P585", year: "1879", date: "+1879-01-22T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  haymarketAffair: { name: "Haymarket affair", qid: "Q214148", property: "P585", year: "1886", date: "+1886-05-04T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  woundedKneeMassacre: { name: "Wounded Knee Massacre", qid: "Q108413", property: "P585", year: "1890", date: "+1890-12-29T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  battleOfAdwa: { name: "Battle of Adwa", qid: "Q302519", property: "P585", year: "1896", date: "+1896-03-01T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  assassinationOfWilliamMcKinley: { name: "assassination of William McKinley", qid: "Q2866985", property: "P585", year: "1901", date: "+1901-09-06T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  wrightBrothersMaidenFlight: { name: "Wright brothers' maiden flight", qid: "Q46047837", property: "P585", year: "1903", date: "+1903-12-17T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  bloodySunday: { name: "Bloody Sunday", qid: "Q185642", property: "P585", year: "1905", date: "+1905-01-09T00:00:00Z", precision: "day", calendar: "Julian", sourceRefKind: "single-event-year" },
  easterRising: { name: "Easter Rising", qid: "Q193689", property: "P585", year: "1916", date: "+1916-04-00T00:00:00Z", precision: "month", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  treatyOfBrestLitovsk: { name: "Treaty of Brest-Litovsk", qid: "Q122371", property: "P585", year: "1918", date: "+1918-03-03T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-event-year" },
  louvreMuseum: { name: "Louvre Museum", qid: "Q19675", property: "P571", year: "1793", date: "+1793-08-10T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  libraryOfCongress: { name: "Library of Congress", qid: "Q131454", property: "P571", year: "1800", date: "+1800-04-24T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  universityOfLondon: { name: "University of London", qid: "Q170027", property: "P571", year: "1836", date: "+1836-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  worldAllianceOfYMCAs: { name: "World Alliance of YMCAs", qid: "Q157169", property: "P571", year: "1844", date: "+1844-06-06T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  victoriaAndAlbertMuseum: { name: "Victoria and Albert Museum", qid: "Q213322", property: "P571", year: "1852", date: "+1852-01-01T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  americanMuseumOfNaturalHistory: { name: "American Museum of Natural History", qid: "Q217717", property: "P571", year: "1869", date: "+1869-04-06T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  metropolitanMuseumOfArt: { name: "Metropolitan Museum of Art", qid: "Q160236", property: "P571", year: "1870", date: "+1870-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  americanRedCross: { name: "American Red Cross", qid: "Q470110", property: "P571", year: "1881", date: "+1881-05-21T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  nationalGeographicSociety: { name: "National Geographic Society", qid: "Q167186", property: "P571", year: "1888", date: "+1888-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  mayoClinic: { name: "Mayo Clinic", qid: "Q1130172", property: "P571", year: "1889", date: "+1889-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  nationalTrust: { name: "National Trust", qid: "Q333515", property: "P571", year: "1895", date: "+1895-01-12T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  fordMotorCompany: { name: "Ford Motor Company", qid: "Q44294", property: "P571", year: "1903", date: "+1903-06-16T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  scoutingAmerica: { name: "Scouting America", qid: "Q608132", property: "P571", year: "1910", date: "+1910-00-00T00:00:00Z", precision: "year", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  iBM: { name: "IBM", qid: "Q37156", property: "P571", year: "1911", date: "+1911-06-16T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  girlScoutsOfTheUSA: { name: "Girl Scouts of the USA", qid: "Q2576280", property: "P571", year: "1912", date: "+1912-03-12T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  electronicFrontierFoundation: { name: "Electronic Frontier Foundation", qid: "Q624023", property: "P571", year: "1990", date: "+1990-07-10T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
  creativeCommons: { name: "Creative Commons", qid: "Q43449", property: "P571", year: "2001", date: "+2001-01-15T00:00:00Z", precision: "day", calendar: "Gregorian", sourceRefKind: "single-inception-year" },
};

const RAW_FACTS: RawFact[] = [
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Battle of Austerlitz is dated to which year?", answer: dateFacts.battleOfAusterlitz, distractors: ["1784","1818","1839"], explanation: "Wikidata dates the Battle of Austerlitz to 1805." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "In which year did the Battle of Borodino take place?", answer: dateFacts.battleOfBorodino, distractors: ["1795","1821","1840"], explanation: "Wikidata dates the Battle of Borodino to 1812." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Battle of New Orleans occurred in which year?", answer: dateFacts.battleOfNewOrleans, distractors: ["1782","1827","1862"], explanation: "Wikidata dates the Battle of New Orleans to 1815." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "Which year is attached to the Peterloo Massacre?", answer: dateFacts.peterlooMassacre, distractors: ["1807","1837","1858"], explanation: "Wikidata dates the Peterloo Massacre to 1819." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Battle of San Jacinto is dated to which year?", answer: dateFacts.battleOfSanJacinto, distractors: ["1815","1849","1870"], explanation: "Wikidata dates the Battle of San Jacinto to 1836." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "In which year did the Treaty of Guadalupe Hidalgo take place?", answer: dateFacts.treatyOfGuadalupeHidalgo, distractors: ["1831","1857","1876"], explanation: "Wikidata dates the Treaty of Guadalupe Hidalgo to 1848." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Battle of Solferino occurred in which year?", answer: dateFacts.battleOfSolferino, distractors: ["1826","1871","1906"], explanation: "Wikidata dates the Battle of Solferino to 1859." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "Which year is attached to the Battle of Fort Sumter?", answer: dateFacts.battleOfFortSumter, distractors: ["1849","1879","1900"], explanation: "Wikidata dates the Battle of Fort Sumter to 1861." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Gettysburg Address is dated to which year?", answer: dateFacts.gettysburgAddress, distractors: ["1842","1876","1897"], explanation: "Wikidata dates the Gettysburg Address to 1863." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "In which year did the Battle of Appomattox Court House take place?", answer: dateFacts.battleOfAppomattoxCourtHouse, distractors: ["1848","1874","1893"], explanation: "Wikidata dates the Battle of Appomattox Court House to 1865." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Alaska Purchase occurred in which year?", answer: dateFacts.alaskaPurchase, distractors: ["1834","1879","1914"], explanation: "Wikidata dates the Alaska Purchase to 1867." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "Which year is attached to the Battle of Isandlwana?", answer: dateFacts.battleOfIsandlwana, distractors: ["1867","1897","1918"], explanation: "Wikidata dates the Battle of Isandlwana to 1879." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Haymarket affair is dated to which year?", answer: dateFacts.haymarketAffair, distractors: ["1865","1899","1920"], explanation: "Wikidata dates the Haymarket affair to 1886." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "In which year did the Wounded Knee Massacre take place?", answer: dateFacts.woundedKneeMassacre, distractors: ["1873","1899","1918"], explanation: "Wikidata dates the Wounded Knee Massacre to 1890." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "The Battle of Adwa occurred in which year?", answer: dateFacts.battleOfAdwa, distractors: ["1863","1908","1943"], explanation: "Wikidata dates the Battle of Adwa to 1896." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "Which year is attached to the assassination of William McKinley?", answer: dateFacts.assassinationOfWilliamMcKinley, distractors: ["1889","1919","1940"], explanation: "Wikidata dates the assassination of William McKinley to 1901." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "The Wright brothers' maiden flight is dated to which year?", answer: dateFacts.wrightBrothersMaidenFlight, distractors: ["1882","1916","1937"], explanation: "Wikidata dates the Wright brothers' maiden flight to 1903." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "hard", question: "In which year did the Bloody Sunday take place?", answer: dateFacts.bloodySunday, distractors: ["1888","1914","1933"], explanation: "Wikidata dates the Bloody Sunday to 1905." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "easy", question: "The Easter Rising occurred in which year?", answer: dateFacts.easterRising, distractors: ["1883","1928","1963"], explanation: "Wikidata dates the Easter Rising to 1916." },
  { kind: "eventDate", category: "historical_event_dates", difficulty: "intermediate", question: "Which year is attached to the Treaty of Brest-Litovsk?", answer: dateFacts.treatyOfBrestLitovsk, distractors: ["1906","1936","1957"], explanation: "Wikidata dates the Treaty of Brest-Litovsk to 1918." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Louvre Museum was founded in which year?", answer: dateFacts.louvreMuseum, distractors: ["1760","1805","1840"], explanation: "Wikidata lists Louvre Museum's inception year as 1793." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "In which year was Library of Congress established?", answer: dateFacts.libraryOfCongress, distractors: ["1788","1818","1839"], explanation: "Wikidata lists Library of Congress's inception year as 1800." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "University of London traces its inception to which year?", answer: dateFacts.universityOfLondon, distractors: ["1815","1849","1870"], explanation: "Wikidata lists University of London's inception year as 1836." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Which year is listed for the founding of Electronic Frontier Foundation?", answer: dateFacts.electronicFrontierFoundation, distractors: ["1978","2002","2011"], explanation: "Wikidata lists Electronic Frontier Foundation's inception year as 1990." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "Victoria and Albert Museum was founded in which year?", answer: dateFacts.victoriaAndAlbertMuseum, distractors: ["1819","1864","1899"], explanation: "Wikidata lists Victoria and Albert Museum's inception year as 1852." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "In which year was American Museum of Natural History established?", answer: dateFacts.americanMuseumOfNaturalHistory, distractors: ["1857","1887","1908"], explanation: "Wikidata lists American Museum of Natural History's inception year as 1869." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Metropolitan Museum of Art traces its inception to which year?", answer: dateFacts.metropolitanMuseumOfArt, distractors: ["1849","1883","1904"], explanation: "Wikidata lists Metropolitan Museum of Art's inception year as 1870." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "Which year is listed for the founding of American Red Cross?", answer: dateFacts.americanRedCross, distractors: ["1864","1890","1909"], explanation: "Wikidata lists American Red Cross's inception year as 1881." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "National Geographic Society was founded in which year?", answer: dateFacts.nationalGeographicSociety, distractors: ["1855","1900","1935"], explanation: "Wikidata lists National Geographic Society's inception year as 1888." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "In which year was Creative Commons established?", answer: dateFacts.creativeCommons, distractors: ["1989","2012","2020"], explanation: "Wikidata lists Creative Commons's inception year as 2001." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "National Trust traces its inception to which year?", answer: dateFacts.nationalTrust, distractors: ["1874","1908","1929"], explanation: "Wikidata lists National Trust's inception year as 1895." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Which year is listed for the founding of Ford Motor Company?", answer: dateFacts.fordMotorCompany, distractors: ["1886","1912","1931"], explanation: "Wikidata lists Ford Motor Company's inception year as 1903." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "intermediate", question: "Scouting America was founded in which year?", answer: dateFacts.scoutingAmerica, distractors: ["1877","1922","1957"], explanation: "Wikidata lists Scouting America's inception year as 1910." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "hard", question: "In which year was IBM established?", answer: dateFacts.iBM, distractors: ["1899","1929","1950"], explanation: "Wikidata lists IBM's inception year as 1911." },
  { kind: "foundingIndependence", category: "founding_independence_years", difficulty: "easy", question: "Girl Scouts of the USA traces its inception to which year?", answer: dateFacts.girlScoutsOfTheUSA, distractors: ["1891","1925","1946"], explanation: "Wikidata lists Girl Scouts of the USA's inception year as 1912." },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this Napoleonic-era timeline?", options: [{ text: "Battle of Austerlitz", fact: dateFacts.battleOfAusterlitz }, { text: "Battle of Borodino", fact: dateFacts.battleOfBorodino }, { text: "Battle of New Orleans", fact: dateFacts.battleOfNewOrleans }, { text: "Peterloo Massacre", fact: dateFacts.peterlooMassacre }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these 1830s-to-1860s entries?", options: [{ text: "Battle of San Jacinto", fact: dateFacts.battleOfSanJacinto }, { text: "Treaty of Guadalupe Hidalgo", fact: dateFacts.treatyOfGuadalupeHidalgo }, { text: "Battle of Solferino", fact: dateFacts.battleOfSolferino }, { text: "Battle of Fort Sumter", fact: dateFacts.battleOfFortSumter }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this Civil War era sequence?", options: [{ text: "Gettysburg Address", fact: dateFacts.gettysburgAddress }, { text: "Battle of Appomattox Court House", fact: dateFacts.battleOfAppomattoxCourtHouse }, { text: "Alaska Purchase", fact: dateFacts.alaskaPurchase }, { text: "Battle of Isandlwana", fact: dateFacts.battleOfIsandlwana }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which option is latest among these late-19th-century events?", options: [{ text: "Haymarket affair", fact: dateFacts.haymarketAffair }, { text: "Wounded Knee Massacre", fact: dateFacts.woundedKneeMassacre }, { text: "Battle of Adwa", fact: dateFacts.battleOfAdwa }, { text: "assassination of William McKinley", fact: dateFacts.assassinationOfWilliamMcKinley }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which option is earliest in this early-20th-century set?", options: [{ text: "Wright brothers' maiden flight", fact: dateFacts.wrightBrothersMaidenFlight }, { text: "Bloody Sunday", fact: dateFacts.bloodySunday }, { text: "Easter Rising", fact: dateFacts.easterRising }, { text: "Treaty of Brest-Litovsk", fact: dateFacts.treatyOfBrestLitovsk }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which institution in this set was founded latest?", options: [{ text: "Louvre Museum", fact: dateFacts.louvreMuseum }, { text: "Library of Congress", fact: dateFacts.libraryOfCongress }, { text: "University of London", fact: dateFacts.universityOfLondon }, { text: "World Alliance of YMCAs", fact: dateFacts.worldAllianceOfYMCAs }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which museum or institution in this set was founded earliest?", options: [{ text: "Victoria and Albert Museum", fact: dateFacts.victoriaAndAlbertMuseum }, { text: "American Museum of Natural History", fact: dateFacts.americanMuseumOfNaturalHistory }, { text: "Metropolitan Museum of Art", fact: dateFacts.metropolitanMuseumOfArt }, { text: "American Red Cross", fact: dateFacts.americanRedCross }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which listed organization has the most recent founding year?", options: [{ text: "National Geographic Society", fact: dateFacts.nationalGeographicSociety }, { text: "The Mayo Clinic", fact: dateFacts.mayoClinic }, { text: "National Trust", fact: dateFacts.nationalTrust }, { text: "Ford Motor Company", fact: dateFacts.fordMotorCompany }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "earliest", question: "Which listed 1910s entry is earliest?", options: [{ text: "Scouting America", fact: dateFacts.scoutingAmerica }, { text: "IBM", fact: dateFacts.iBM }, { text: "Girl Scouts of the USA", fact: dateFacts.girlScoutsOfTheUSA }, { text: "Easter Rising", fact: dateFacts.easterRising }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "latest", question: "Which option is latest in this 1805-to-1848 timeline?", options: [{ text: "Battle of Austerlitz", fact: dateFacts.battleOfAusterlitz }, { text: "Battle of New Orleans", fact: dateFacts.battleOfNewOrleans }, { text: "University of London", fact: dateFacts.universityOfLondon }, { text: "Treaty of Guadalupe Hidalgo", fact: dateFacts.treatyOfGuadalupeHidalgo }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "earliest", question: "Which option is earliest among these 1860s milestones?", options: [{ text: "Battle of Fort Sumter", fact: dateFacts.battleOfFortSumter }, { text: "Gettysburg Address", fact: dateFacts.gettysburgAddress }, { text: "Battle of Appomattox Court House", fact: dateFacts.battleOfAppomattoxCourtHouse }, { text: "Alaska Purchase", fact: dateFacts.alaskaPurchase }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest in this 1880s-to-1900s sequence?", options: [{ text: "American Red Cross", fact: dateFacts.americanRedCross }, { text: "National Geographic Society", fact: dateFacts.nationalGeographicSociety }, { text: "Battle of Adwa", fact: dateFacts.battleOfAdwa }, { text: "Wright brothers' maiden flight", fact: dateFacts.wrightBrothersMaidenFlight }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "hard", direction: "earliest", question: "Which option is earliest in this institutions-and-events sequence?", options: [{ text: "Louvre Museum", fact: dateFacts.louvreMuseum }, { text: "Battle of Austerlitz", fact: dateFacts.battleOfAusterlitz }, { text: "Library of Congress", fact: dateFacts.libraryOfCongress }, { text: "Peterloo Massacre", fact: dateFacts.peterlooMassacre }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "intermediate", direction: "latest", question: "Which listed 1900s-to-1910s milestone is latest?", options: [{ text: "assassination of William McKinley", fact: dateFacts.assassinationOfWilliamMcKinley }, { text: "Ford Motor Company", fact: dateFacts.fordMotorCompany }, { text: "Scouting America", fact: dateFacts.scoutingAmerica }, { text: "Treaty of Brest-Litovsk", fact: dateFacts.treatyOfBrestLitovsk }] },
  { kind: "chronology", category: "historical_chronology", difficulty: "easy", direction: "latest", question: "Which option is latest in this pre-World War I timeline?", options: [{ text: "Haymarket affair", fact: dateFacts.haymarketAffair }, { text: "Wounded Knee Massacre", fact: dateFacts.woundedKneeMassacre }, { text: "Bloody Sunday", fact: dateFacts.bloodySunday }, { text: "Girl Scouts of the USA", fact: dateFacts.girlScoutsOfTheUSA }] },
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

export const knowledgeHistoryCieScoreBatchV3Questions = RAW_FACTS.map(buildQuestion);
export const questions = knowledgeHistoryCieScoreBatchV3Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV3Metadata = {
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
  questionCount: knowledgeHistoryCieScoreBatchV3Questions.length,
  countsByCategory: countBy(knowledgeHistoryCieScoreBatchV3Questions.map((question) => question.category)),
  countsByDifficulty: countBy(knowledgeHistoryCieScoreBatchV3Questions.map((question) => question.difficulty)),
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

export default knowledgeHistoryCieScoreBatchV3Questions;
