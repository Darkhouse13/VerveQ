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

export type KnowledgeHistoryCieScoreBatchV1Question =
  KnowledgeQuestionSeed & {
    provenance: ScoreModeProvenance;
  };

type YearQuestionFact = {
  kind: "eventDate" | "foundingIndependence";
  category: HistoryCategory;
  difficulty: Difficulty;
  question: string;
  answer: HistoricalDateFact;
  distractors: [string, string, string];
  explanation: string;
};

type ChronologyOption = {
  text: string;
  fact: HistoricalDateFact;
};

type ChronologyFact = {
  kind: "chronology";
  category: HistoryCategory;
  difficulty: Difficulty;
  direction: "earliest" | "latest";
  question: string;
  options: [
    ChronologyOption,
    ChronologyOption,
    ChronologyOption,
    ChronologyOption,
  ];
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

const BATCH_ID = "knowledge_history_cie_score_v1";
const WORK_UNIT_ID = "score-mode:knowledge:history:static:v1";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "claude-opus-4-8";
const VERDICT: Verdict = "agree";

function historicalDate(
  name: string,
  qid: string,
  property: WikidataDateProperty,
  year: string,
  date: string,
  precision: DatePrecision,
  calendar: "Gregorian" | "Julian",
): HistoricalDateFact {
  return {
    name,
    qid,
    property,
    year,
    date,
    precision,
    calendar,
    sourceRefKind:
      property === "P585" ? "single-event-year" : "single-inception-year",
  };
}

function eventDate(
  difficulty: Difficulty,
  question: string,
  answer: HistoricalDateFact,
  distractors: [string, string, string],
  explanation: string,
): YearQuestionFact {
  return {
    kind: "eventDate",
    category: "historical_event_dates",
    difficulty,
    question,
    answer,
    distractors,
    explanation,
  };
}

function foundingIndependenceYear(
  difficulty: Difficulty,
  question: string,
  answer: HistoricalDateFact,
  distractors: [string, string, string],
  explanation: string,
): YearQuestionFact {
  return {
    kind: "foundingIndependence",
    category: "founding_independence_years",
    difficulty,
    question,
    answer,
    distractors,
    explanation,
  };
}

function chronologyOption(
  text: string,
  fact: HistoricalDateFact,
): ChronologyOption {
  return { text, fact };
}

function chronology(
  difficulty: Difficulty,
  direction: "earliest" | "latest",
  question: string,
  options: [
    ChronologyOption,
    ChronologyOption,
    ChronologyOption,
    ChronologyOption,
  ],
): ChronologyFact {
  return {
    kind: "chronology",
    category: "historical_chronology",
    difficulty,
    direction,
    question,
    options,
  };
}

const battleOfHastings = historicalDate(
  "Battle of Hastings",
  "Q83224",
  "P585",
  "1066",
  "+1066-10-14T00:00:00Z",
  "day",
  "Julian",
);
const battleOfAgincourt = historicalDate(
  "Battle of Agincourt",
  "Q188495",
  "P585",
  "1415",
  "+1415-10-25T00:00:00Z",
  "day",
  "Julian",
);
const battleOfLepanto = historicalDate(
  "Battle of Lepanto",
  "Q165425",
  "P585",
  "1571",
  "+1571-10-07T00:00:00Z",
  "day",
  "Julian",
);
const gunpowderPlot = historicalDate(
  "Gunpowder Plot",
  "Q45810",
  "P585",
  "1605",
  "+1605-11-05T00:00:00Z",
  "day",
  "Julian",
);
const bostonTeaParty = historicalDate(
  "Boston Tea Party",
  "Q19024",
  "P585",
  "1773",
  "+1773-12-16T00:00:00Z",
  "day",
  "Gregorian",
);
const battleOfBunkerHill = historicalDate(
  "Battle of Bunker Hill",
  "Q334029",
  "P585",
  "1775",
  "+1775-06-17T00:00:00Z",
  "day",
  "Gregorian",
);
const stormingOfTheBastille = historicalDate(
  "Storming of the Bastille",
  "Q6539",
  "P585",
  "1789",
  "+1789-07-14T00:00:00Z",
  "day",
  "Gregorian",
);
const louisianaPurchase = historicalDate(
  "Louisiana Purchase",
  "Q193155",
  "P585",
  "1803",
  "+1803-04-30T00:00:00Z",
  "day",
  "Gregorian",
);
const battleOfTrafalgar = historicalDate(
  "Battle of Trafalgar",
  "Q171416",
  "P585",
  "1805",
  "+1805-10-21T00:00:00Z",
  "day",
  "Gregorian",
);
const battleOfWaterloo = historicalDate(
  "Battle of Waterloo",
  "Q48314",
  "P585",
  "1815",
  "+1815-06-18T00:00:00Z",
  "day",
  "Gregorian",
);
const battleOfAntietam = historicalDate(
  "Battle of Antietam",
  "Q719252",
  "P585",
  "1862",
  "+1862-09-17T00:00:00Z",
  "day",
  "Gregorian",
);
const battleOfTheLittleBighorn = historicalDate(
  "Battle of the Little Bighorn",
  "Q205422",
  "P585",
  "1876",
  "+1876-06-25T00:00:00Z",
  "day",
  "Gregorian",
);
const assassinationOfArchdukeFranzFerdinand = historicalDate(
  "assassination of Archduke Franz Ferdinand",
  "Q192050",
  "P585",
  "1914",
  "+1914-06-28T00:00:00Z",
  "day",
  "Gregorian",
);
const treatyOfVersailles = historicalDate(
  "Treaty of Versailles",
  "Q8736",
  "P585",
  "1919",
  "+1919-06-28T00:00:00Z",
  "day",
  "Gregorian",
);
const attackOnPearlHarbor = historicalDate(
  "attack on Pearl Harbor",
  "Q52418",
  "P585",
  "1941",
  "+1941-12-07T00:00:00Z",
  "day",
  "Gregorian",
);
const doolittleRaid = historicalDate(
  "Doolittle Raid",
  "Q713516",
  "P585",
  "1942",
  "+1942-04-18T00:00:00Z",
  "day",
  "Gregorian",
);
const atomicBombingOfHiroshima = historicalDate(
  "atomic bombing of Hiroshima",
  "Q703203",
  "P585",
  "1945",
  "+1945-08-06T00:00:00Z",
  "day",
  "Gregorian",
);
const assassinationOfJohnFKennedy = historicalDate(
  "assassination of John F. Kennedy",
  "Q193484",
  "P585",
  "1963",
  "+1963-11-22T00:00:00Z",
  "day",
  "Gregorian",
);
const chernobylDisaster = historicalDate(
  "Chernobyl disaster",
  "Q486",
  "P585",
  "1986",
  "+1986-04-26T00:00:00Z",
  "day",
  "Gregorian",
);
const fallOfTheBerlinWall = historicalDate(
  "fall of the Berlin Wall",
  "Q69163529",
  "P585",
  "1989",
  "+1989-11-09T00:00:00Z",
  "day",
  "Gregorian",
);

const royalSociety = historicalDate(
  "Royal Society",
  "Q123885",
  "P571",
  "1660",
  "+1660-11-01T00:00:00Z",
  "month",
  "Gregorian",
);
const smithsonianInstitution = historicalDate(
  "Smithsonian Institution",
  "Q131626",
  "P571",
  "1846",
  "+1846-08-10T00:00:00Z",
  "day",
  "Gregorian",
);
const internationalCommitteeOfTheRedCross = historicalDate(
  "International Committee of the Red Cross",
  "Q5987345",
  "P571",
  "1863",
  "+1863-02-17T00:00:00Z",
  "day",
  "Gregorian",
);
const salvationArmy = historicalDate(
  "The Salvation Army",
  "Q188307",
  "P571",
  "1865",
  "+1865-07-02T00:00:00Z",
  "day",
  "Gregorian",
);
const internationalOlympicCommittee = historicalDate(
  "International Olympic Committee",
  "Q40970",
  "P571",
  "1894",
  "+1894-06-23T00:00:00Z",
  "day",
  "Gregorian",
);
const fifa = historicalDate(
  "FIFA",
  "Q253414",
  "P571",
  "1904",
  "+1904-05-21T00:00:00Z",
  "day",
  "Gregorian",
);
const nationalParkService = historicalDate(
  "National Park Service",
  "Q308439",
  "P571",
  "1916",
  "+1916-08-25T00:00:00Z",
  "day",
  "Gregorian",
);
const unesco = historicalDate(
  "UNESCO",
  "Q7809",
  "P571",
  "1945",
  "+1945-11-16T00:00:00Z",
  "day",
  "Gregorian",
);
const india = historicalDate(
  "India",
  "Q668",
  "P571",
  "1947",
  "+1947-08-15T00:00:00Z",
  "day",
  "Gregorian",
);
const worldHealthOrganization = historicalDate(
  "World Health Organization",
  "Q7817",
  "P571",
  "1948",
  "+1948-04-07T00:00:00Z",
  "day",
  "Gregorian",
);
const nato = historicalDate(
  "NATO",
  "Q7184",
  "P571",
  "1949",
  "+1949-04-04T00:00:00Z",
  "day",
  "Gregorian",
);
const ghana = historicalDate(
  "Ghana",
  "Q117",
  "P571",
  "1957",
  "+1957-01-01T00:00:00Z",
  "year",
  "Gregorian",
);
const nasa = historicalDate(
  "NASA",
  "Q23548",
  "P571",
  "1958",
  "+1958-07-29T00:00:00Z",
  "day",
  "Gregorian",
);
const amnestyInternational = historicalDate(
  "Amnesty International",
  "Q42970",
  "P571",
  "1961",
  "+1961-05-28T00:00:00Z",
  "day",
  "Gregorian",
);
const europeanUnion = historicalDate(
  "European Union",
  "Q458",
  "P571",
  "1993",
  "+1993-11-01T00:00:00Z",
  "day",
  "Gregorian",
);

const RAW_FACTS: RawFact[] = [
  eventDate(
    "easy",
    "The Battle of Hastings took place in which year?",
    battleOfHastings,
    ["1054", "1087", "1100"],
    "The Battle of Hastings is dated to 1066.",
  ),
  eventDate(
    "hard",
    "In which year did the Battle of Agincourt take place?",
    battleOfAgincourt,
    ["1314", "1453", "1492"],
    "The Battle of Agincourt is dated to 1415.",
  ),
  eventDate(
    "hard",
    "The naval Battle of Lepanto occurred in which year?",
    battleOfLepanto,
    ["1526", "1588", "1618"],
    "The Battle of Lepanto is dated to 1571.",
  ),
  eventDate(
    "intermediate",
    "The Gunpowder Plot is dated to which year?",
    gunpowderPlot,
    ["1588", "1642", "1666"],
    "The Gunpowder Plot is dated to 1605.",
  ),
  eventDate(
    "easy",
    "The Boston Tea Party took place in which year?",
    bostonTeaParty,
    ["1765", "1776", "1781"],
    "The Boston Tea Party is dated to 1773.",
  ),
  eventDate(
    "intermediate",
    "The Battle of Bunker Hill was fought in which year?",
    battleOfBunkerHill,
    ["1770", "1781", "1789"],
    "The Battle of Bunker Hill is dated to 1775.",
  ),
  eventDate(
    "easy",
    "The Storming of the Bastille occurred in which year?",
    stormingOfTheBastille,
    ["1776", "1793", "1815"],
    "The Storming of the Bastille is dated to 1789.",
  ),
  eventDate(
    "intermediate",
    "The Louisiana Purchase was completed in which year?",
    louisianaPurchase,
    ["1798", "1812", "1820"],
    "The Louisiana Purchase is dated to 1803.",
  ),
  eventDate(
    "hard",
    "The Battle of Trafalgar was fought in which year?",
    battleOfTrafalgar,
    ["1776", "1812", "1815"],
    "The Battle of Trafalgar is dated to 1805.",
  ),
  eventDate(
    "easy",
    "The Battle of Waterloo was fought in which year?",
    battleOfWaterloo,
    ["1805", "1821", "1830"],
    "The Battle of Waterloo is dated to 1815.",
  ),
  eventDate(
    "hard",
    "The Battle of Antietam took place in which year?",
    battleOfAntietam,
    ["1859", "1865", "1876"],
    "The Battle of Antietam is dated to 1862.",
  ),
  eventDate(
    "hard",
    "The Battle of the Little Bighorn took place in which year?",
    battleOfTheLittleBighorn,
    ["1862", "1881", "1890"],
    "The Battle of the Little Bighorn is dated to 1876.",
  ),
  eventDate(
    "easy",
    "The assassination of Archduke Franz Ferdinand occurred in which year?",
    assassinationOfArchdukeFranzFerdinand,
    ["1905", "1917", "1919"],
    "The assassination of Archduke Franz Ferdinand is dated to 1914.",
  ),
  eventDate(
    "easy",
    "The Treaty of Versailles was signed in which year?",
    treatyOfVersailles,
    ["1914", "1917", "1929"],
    "The Treaty of Versailles is dated to 1919.",
  ),
  eventDate(
    "easy",
    "The attack on Pearl Harbor occurred in which year?",
    attackOnPearlHarbor,
    ["1939", "1944", "1945"],
    "The attack on Pearl Harbor is dated to 1941.",
  ),
  eventDate(
    "intermediate",
    "The Doolittle Raid took place in which year?",
    doolittleRaid,
    ["1941", "1944", "1945"],
    "The Doolittle Raid is dated to 1942.",
  ),
  eventDate(
    "easy",
    "The atomic bombing of Hiroshima occurred in which year?",
    atomicBombingOfHiroshima,
    ["1941", "1944", "1950"],
    "The atomic bombing of Hiroshima is dated to 1945.",
  ),
  eventDate(
    "easy",
    "The assassination of John F. Kennedy occurred in which year?",
    assassinationOfJohnFKennedy,
    ["1957", "1968", "1974"],
    "The assassination of John F. Kennedy is dated to 1963.",
  ),
  eventDate(
    "easy",
    "The Chernobyl disaster occurred in which year?",
    chernobylDisaster,
    ["1979", "1989", "1991"],
    "The Chernobyl disaster is dated to 1986.",
  ),
  eventDate(
    "easy",
    "The fall of the Berlin Wall occurred in which year?",
    fallOfTheBerlinWall,
    ["1986", "1991", "1993"],
    "The fall of the Berlin Wall is dated to 1989.",
  ),
  foundingIndependenceYear(
    "hard",
    "The Royal Society was founded in which year?",
    royalSociety,
    ["1648", "1688", "1707"],
    "Wikidata lists the Royal Society's inception year as 1660.",
  ),
  foundingIndependenceYear(
    "intermediate",
    "The Smithsonian Institution was founded in which year?",
    smithsonianInstitution,
    ["1815", "1863", "1876"],
    "Wikidata lists the Smithsonian Institution's inception year as 1846.",
  ),
  foundingIndependenceYear(
    "hard",
    "The International Committee of the Red Cross was founded in which year?",
    internationalCommitteeOfTheRedCross,
    ["1846", "1865", "1894"],
    "Wikidata lists the International Committee of the Red Cross's inception year as 1863.",
  ),
  foundingIndependenceYear(
    "hard",
    "The Salvation Army was founded in which year?",
    salvationArmy,
    ["1846", "1863", "1904"],
    "Wikidata lists The Salvation Army's inception year as 1865.",
  ),
  foundingIndependenceYear(
    "intermediate",
    "The International Olympic Committee was founded in which year?",
    internationalOlympicCommittee,
    ["1865", "1904", "1916"],
    "Wikidata lists the International Olympic Committee's inception year as 1894.",
  ),
  foundingIndependenceYear(
    "intermediate",
    "FIFA was founded in which year?",
    fifa,
    ["1894", "1916", "1930"],
    "Wikidata lists FIFA's inception year as 1904.",
  ),
  foundingIndependenceYear(
    "hard",
    "The National Park Service was founded in which year?",
    nationalParkService,
    ["1904", "1933", "1945"],
    "Wikidata lists the National Park Service's inception year as 1916.",
  ),
  foundingIndependenceYear(
    "intermediate",
    "UNESCO was founded in which year?",
    unesco,
    ["1919", "1948", "1949"],
    "Wikidata lists UNESCO's inception year as 1945.",
  ),
  foundingIndependenceYear(
    "easy",
    "India became independent in which year?",
    india,
    ["1935", "1950", "1957"],
    "Wikidata lists India's inception year as 1947.",
  ),
  foundingIndependenceYear(
    "intermediate",
    "The World Health Organization was founded in which year?",
    worldHealthOrganization,
    ["1945", "1949", "1958"],
    "Wikidata lists the World Health Organization's inception year as 1948.",
  ),
  foundingIndependenceYear(
    "easy",
    "NATO was founded in which year?",
    nato,
    ["1945", "1948", "1955"],
    "Wikidata lists NATO's inception year as 1949.",
  ),
  foundingIndependenceYear(
    "easy",
    "Ghana became independent in which year?",
    ghana,
    ["1947", "1960", "1963"],
    "Wikidata lists Ghana's inception year as 1957.",
  ),
  foundingIndependenceYear(
    "easy",
    "NASA was established in which year?",
    nasa,
    ["1949", "1961", "1969"],
    "Wikidata lists NASA's inception year as 1958.",
  ),
  foundingIndependenceYear(
    "intermediate",
    "Amnesty International was founded in which year?",
    amnestyInternational,
    ["1948", "1958", "1971"],
    "Wikidata lists Amnesty International's inception year as 1961.",
  ),
  foundingIndependenceYear(
    "easy",
    "The European Union came into being in which year?",
    europeanUnion,
    ["1957", "1973", "2002"],
    "Wikidata lists the European Union's inception year as 1993.",
  ),
  chronology(
    "easy",
    "earliest",
    "Among these major historical moments, which came first?",
    [
      chronologyOption("Battle of Hastings", battleOfHastings),
      chronologyOption("Battle of Agincourt", battleOfAgincourt),
      chronologyOption("Storming of the Bastille", stormingOfTheBastille),
      chronologyOption("Battle of Waterloo", battleOfWaterloo),
    ],
  ),
  chronology(
    "hard",
    "latest",
    "Which listed event happened latest in this early-modern timeline?",
    [
      chronologyOption("Battle of Lepanto", battleOfLepanto),
      chronologyOption("Gunpowder Plot", gunpowderPlot),
      chronologyOption("Boston Tea Party", bostonTeaParty),
      chronologyOption("Battle of Trafalgar", battleOfTrafalgar),
    ],
  ),
  chronology(
    "intermediate",
    "earliest",
    "Which event came first in this 1800s-to-1940s set?",
    [
      chronologyOption("Louisiana Purchase", louisianaPurchase),
      chronologyOption("Battle of Antietam", battleOfAntietam),
      chronologyOption("Treaty of Versailles", treatyOfVersailles),
      chronologyOption("attack on Pearl Harbor", attackOnPearlHarbor),
    ],
  ),
  chronology(
    "intermediate",
    "latest",
    "Which listed 20th-century event happened latest?",
    [
      chronologyOption(
        "assassination of Archduke Franz Ferdinand",
        assassinationOfArchdukeFranzFerdinand,
      ),
      chronologyOption("Treaty of Versailles signed", treatyOfVersailles),
      chronologyOption("atomic bombing of Hiroshima", atomicBombingOfHiroshima),
      chronologyOption("Chernobyl disaster", chernobylDisaster),
    ],
  ),
  chronology(
    "intermediate",
    "earliest",
    "Which event is earliest in this American and European timeline?",
    [
      chronologyOption("Battle of Bunker Hill", battleOfBunkerHill),
      chronologyOption("Battle of the Little Bighorn", battleOfTheLittleBighorn),
      chronologyOption(
        "assassination of John F. Kennedy",
        assassinationOfJohnFKennedy,
      ),
      chronologyOption("fall of the Berlin Wall", fallOfTheBerlinWall),
    ],
  ),
  chronology(
    "easy",
    "latest",
    "Which of these 20th-century milestones happened latest?",
    [
      chronologyOption("Doolittle Raid", doolittleRaid),
      chronologyOption("atomic bombing of Hiroshima", atomicBombingOfHiroshima),
      chronologyOption(
        "assassination of John F. Kennedy",
        assassinationOfJohnFKennedy,
      ),
      chronologyOption("fall of the Berlin Wall", fallOfTheBerlinWall),
    ],
  ),
  chronology(
    "hard",
    "earliest",
    "Which institution in this set was founded first?",
    [
      chronologyOption("Royal Society founded", royalSociety),
      chronologyOption("Smithsonian Institution founded", smithsonianInstitution),
      chronologyOption(
        "International Olympic Committee founded",
        internationalOlympicCommittee,
      ),
      chronologyOption("FIFA founded", fifa),
    ],
  ),
  chronology(
    "hard",
    "latest",
    "Which organization or agency in this set was founded latest?",
    [
      chronologyOption(
        "International Committee of the Red Cross founded",
        internationalCommitteeOfTheRedCross,
      ),
      chronologyOption("The Salvation Army founded", salvationArmy),
      chronologyOption("National Park Service founded", nationalParkService),
      chronologyOption("UNESCO founded", unesco),
    ],
  ),
  chronology(
    "intermediate",
    "earliest",
    "Which milestone happened first among these mid-century entries?",
    [
      chronologyOption("UNESCO founded", unesco),
      chronologyOption("India became independent", india),
      chronologyOption("Ghana became independent", ghana),
      chronologyOption("NASA founded", nasa),
    ],
  ),
  chronology(
    "easy",
    "latest",
    "Which institution was established latest in this set?",
    [
      chronologyOption("World Health Organization founded", worldHealthOrganization),
      chronologyOption("NATO founded", nato),
      chronologyOption("Amnesty International founded", amnestyInternational),
      chronologyOption("European Union formed", europeanUnion),
    ],
  ),
  chronology(
    "intermediate",
    "earliest",
    "Which item came first in this treaty-and-organization timeline?",
    [
      chronologyOption("Treaty of Versailles signed", treatyOfVersailles),
      chronologyOption("UNESCO founded", unesco),
      chronologyOption("NATO founded", nato),
      chronologyOption("Chernobyl disaster", chernobylDisaster),
    ],
  ),
  chronology(
    "easy",
    "latest",
    "Which event or agency milestone happened latest in this set?",
    [
      chronologyOption("NASA founded", nasa),
      chronologyOption(
        "assassination of John F. Kennedy",
        assassinationOfJohnFKennedy,
      ),
      chronologyOption("Chernobyl disaster", chernobylDisaster),
      chronologyOption("fall of the Berlin Wall", fallOfTheBerlinWall),
    ],
  ),
  chronology(
    "hard",
    "earliest",
    "Which item came first in this institutions-and-conflict timeline?",
    [
      chronologyOption("Smithsonian Institution founded", smithsonianInstitution),
      chronologyOption(
        "International Committee of the Red Cross founded",
        internationalCommitteeOfTheRedCross,
      ),
      chronologyOption("Battle of the Little Bighorn", battleOfTheLittleBighorn),
      chronologyOption(
        "International Olympic Committee founded",
        internationalOlympicCommittee,
      ),
    ],
  ),
  chronology(
    "hard",
    "latest",
    "Which item happened latest in this 1815-to-1865 timeline?",
    [
      chronologyOption("Battle of Waterloo", battleOfWaterloo),
      chronologyOption("Smithsonian Institution founded", smithsonianInstitution),
      chronologyOption("Battle of Antietam", battleOfAntietam),
      chronologyOption("The Salvation Army founded", salvationArmy),
    ],
  ),
  chronology(
    "intermediate",
    "earliest",
    "Which item came first in this war-and-treaty timeline?",
    [
      chronologyOption("Battle of Trafalgar", battleOfTrafalgar),
      chronologyOption("Battle of Waterloo", battleOfWaterloo),
      chronologyOption("National Park Service founded", nationalParkService),
      chronologyOption("Treaty of Versailles signed", treatyOfVersailles),
    ],
  ),
];

function sourceRef(fact: HistoricalDateFact) {
  return `wikidata:${fact.qid}:${fact.property}:${fact.year}:${fact.sourceRefKind}:snapshot-${RETRIEVED_AT}`;
}

function claimPrefix(fact: HistoricalDateFact) {
  return fact.property === "P585" ? "point_in_time_year" : "inception_year";
}

function claim(text: string, sourceRefValue: string): ProvenanceClaim {
  return {
    claim: text,
    sourceType: "structured_open",
    sourceRef: sourceRefValue,
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
  };
}

function bucket(category: HistoryCategory, difficulty: Difficulty) {
  return `knowledge_${difficulty}_${category}`;
}

function checksum(index: number) {
  return `${BATCH_ID}_${String(index + 1).padStart(3, "0")}`;
}

function rotateOptions(
  correctAnswer: string,
  distractors: [string, string, string],
  index: number,
) {
  const options = [correctAnswer, ...distractors];
  const [correct] = options.splice(0, 1);
  options.splice(index % 4, 0, correct);
  return options;
}

function provenance(claims: ProvenanceClaim[]): ScoreModeProvenance {
  return {
    claims,
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict: VERDICT,
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function yearNumber(fact: HistoricalDateFact) {
  return Number(fact.year);
}

function chronologyAnswer(fact: ChronologyFact) {
  const sorted = [...fact.options].sort(
    (left, right) => yearNumber(left.fact) - yearNumber(right.fact),
  );
  return fact.direction === "earliest" ? sorted[0] : sorted[sorted.length - 1];
}

function chronologyDistractors(fact: ChronologyFact): [string, string, string] {
  const answer = chronologyAnswer(fact);
  const distractors = fact.options
    .filter((option) => option.text !== answer.text)
    .map((option) => option.text);
  return [distractors[0], distractors[1], distractors[2]];
}

function yearClaims(fact: YearQuestionFact): ProvenanceClaim[] {
  const factSourceRef = sourceRef(fact.answer);
  return [
    claim(
      `${claimPrefix(fact.answer)}(${fact.answer.name}) = ${fact.answer.year}`,
      factSourceRef,
    ),
    ...fact.distractors.map((distractor) =>
      claim(
        `${claimPrefix(fact.answer)}(${fact.answer.name}) != ${distractor}`,
        factSourceRef,
      ),
    ),
  ];
}

function chronologyClaims(fact: ChronologyFact): ProvenanceClaim[] {
  const answer = chronologyAnswer(fact);
  return [
    ...fact.options.map((option) =>
      claim(
        `${claimPrefix(option.fact)}(${option.fact.name}) = ${option.fact.year}`,
        sourceRef(option.fact),
      ),
    ),
    claim(
      `chronology_${fact.direction}(${fact.options
        .map((option) => option.text)
        .join(" | ")}) = ${answer.text}`,
      sourceRef(answer.fact),
    ),
  ];
}

function claims(fact: RawFact) {
  return fact.kind === "chronology" ? chronologyClaims(fact) : yearClaims(fact);
}

function chronologyExplanation(fact: ChronologyFact) {
  const answer = chronologyAnswer(fact);
  const datedOptions = fact.options
    .map((option) => `${option.text} (${option.fact.year})`)
    .join("; ");
  return `${answer.text} is the ${fact.direction} option: ${datedOptions}.`;
}

function correctAnswer(fact: RawFact) {
  return fact.kind === "chronology"
    ? chronologyAnswer(fact).text
    : fact.answer.year;
}

function distractors(fact: RawFact): [string, string, string] {
  return fact.kind === "chronology"
    ? chronologyDistractors(fact)
    : fact.distractors;
}

function explanation(fact: RawFact) {
  return fact.kind === "chronology"
    ? chronologyExplanation(fact)
    : fact.explanation;
}

function buildQuestion(
  fact: RawFact,
  index: number,
): KnowledgeHistoryCieScoreBatchV1Question {
  const answer = correctAnswer(fact);

  return {
    sport: "knowledge",
    category: fact.category,
    question: fact.question,
    options: rotateOptions(answer, distractors(fact), index),
    correctAnswer: answer,
    explanation: explanation(fact),
    difficulty: fact.difficulty,
    bucket: bucket(fact.category, fact.difficulty),
    checksum: checksum(index),
    provenance: provenance(claims(fact)),
  };
}

function wikidataPropertyLabel(property: WikidataDateProperty) {
  return property === "P585" ? "point in time" : "inception";
}

function dateFactsForRawFact(fact: RawFact) {
  if (fact.kind !== "chronology") return [fact.answer];
  return fact.options.map((option) => option.fact);
}

function makeSourceRecord(fact: HistoricalDateFact): WikidataSourceRecord {
  return {
    sourceRef: sourceRef(fact),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: {
        name: fact.name,
        qid: fact.qid,
      },
      property: fact.property,
      propertyLabel: wikidataPropertyLabel(fact.property),
      year: fact.year,
      wikidataTimeValue: fact.date,
      precision: fact.precision,
      calendar: fact.calendar,
      singleYearQuestion: true,
      excludedIfContestedOrDateRange: true,
      sourceRefKind: fact.sourceRefKind,
    },
  };
}

function buildWikidataSourceRecords(facts: RawFact[]) {
  const records = new Map<string, WikidataSourceRecord>();
  for (const fact of facts) {
    for (const dateFact of dateFactsForRawFact(fact)) {
      const record = makeSourceRecord(dateFact);
      records.set(record.sourceRef, record);
    }
  }
  return Object.fromEntries(
    [...records.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function factKind(fact: RawFact) {
  return fact.kind;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (counts, value) => ({
      ...counts,
      [value]: (counts[value] ?? 0) + 1,
    }),
    {} as Record<T, number>,
  );
}

export const knowledgeHistoryCieScoreBatchV1Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeHistoryCieScoreBatchV1Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeHistoryCieScoreBatchV1Metadata = {
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
  questionCount: knowledgeHistoryCieScoreBatchV1Questions.length,
  countsByCategory: countBy(
    knowledgeHistoryCieScoreBatchV1Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeHistoryCieScoreBatchV1Questions.map((question) => question.difficulty),
  ),
  countsByHistoryFactKind: countBy(RAW_FACTS.map(factKind)),
  wikidataSourcing: {
    historical_event_dates:
      "P585 point in time; year-only MCQ; single dated event, no ranges or contested/multi-stage dates",
    founding_independence_years:
      "P571 inception; year-only MCQ; organizations use founding/inception year, countries use only widely accepted sovereign-state inception/independence year",
    historical_chronology:
      "P585/P571 date records for all options; standard MCQ asking earliest/latest only when all option years are unique and non-overlapping",
  },
  collisionRules: {
    historical_event_dates:
      "Author only event-to-year direction. The cited event must have one unambiguous accepted year; all distractor years differ from the cited P585 year.",
    founding_independence_years:
      "Author only entity-to-year direction. The cited entity must have one accepted P571 year; exclude staged or disputed independence/founding cases; all distractor years differ from the cited year.",
    historical_chronology:
      "Each option carries a cited P585 or P571 year. The requested earliest/latest option must be unique, with no tied years or date ranges among options.",
  },
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeHistoryCieScoreBatchV1Questions;
