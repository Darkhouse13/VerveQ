import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";
type ScienceCategory =
  | "chemical_element_symbols"
  | "chemical_element_atomic_numbers"
  | "si_unit_symbols";
type WikidataScienceProperty = "P246" | "P1086";

type ElementFact = {
  kind: "element";
  name: string;
  qid: string;
  symbol: string;
  atomicNumber: string;
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

export type KnowledgeScienceCieScoreBatchV4Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeScienceCieScoreBatchV4Question;

type ElementSymbolQuestion = {
  kind: "elementSymbol";
  category: "chemical_element_symbols";
  difficulty: Difficulty;
  direction: "element_to_symbol" | "symbol_to_element";
  question: string;
  subject: ElementFact;
  distractors: [ElementFact, ElementFact, ElementFact];
};

type ElementAtomicNumberQuestion = {
  kind: "elementAtomicNumber";
  category: "chemical_element_atomic_numbers";
  difficulty: Difficulty;
  direction: "element_to_number" | "number_to_element";
  question: string;
  subject: ElementFact;
  distractors: [ElementFact, ElementFact, ElementFact];
};

type RawFact = ElementSymbolQuestion | ElementAtomicNumberQuestion;

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

type ElementSymbolSpec = {
  atomicNumber: number;
  difficulty: Difficulty;
  direction: ElementSymbolQuestion["direction"];
};

type ElementAtomicNumberSpec = {
  atomicNumber: number;
  difficulty: Difficulty;
  direction: ElementAtomicNumberQuestion["direction"];
};

const BATCH_ID = "knowledge_science_cie_score_v4";
const WORK_UNIT_ID = "score-mode:knowledge:science:static:v4";
const RETRIEVED_AT = "2026-05-30";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "claude-opus-4-8";
const VERDICT: Verdict = "agree";

function element(
  name: string,
  qid: string,
  symbol: string,
  atomicNumber: number,
): ElementFact {
  return { kind: "element", name, qid, symbol, atomicNumber: String(atomicNumber) };
}

const ELEMENT_ROWS = [
  ["Lithium", "Q568", "Li", 3],
  ["Beryllium", "Q569", "Be", 4],
  ["Boron", "Q618", "B", 5],
  ["Carbon", "Q623", "C", 6],
  ["Nitrogen", "Q627", "N", 7],
  ["Oxygen", "Q629", "O", 8],
  ["Fluorine", "Q650", "F", 9],
  ["Neon", "Q654", "Ne", 10],
  ["Sodium", "Q658", "Na", 11],
  ["Magnesium", "Q660", "Mg", 12],
  ["Aluminium", "Q663", "Al", 13],
  ["Silicon", "Q670", "Si", 14],
  ["Phosphorus", "Q674", "P", 15],
  ["Sulfur", "Q682", "S", 16],
  ["Chlorine", "Q688", "Cl", 17],
  ["Argon", "Q696", "Ar", 18],
  ["Potassium", "Q703", "K", 19],
  ["Calcium", "Q706", "Ca", 20],
  ["Caesium", "Q1108", "Cs", 55],
  ["Barium", "Q1112", "Ba", 56],
  ["Lanthanum", "Q1801", "La", 57],
  ["Cerium", "Q1385", "Ce", 58],
  ["Praseodymium", "Q1386", "Pr", 59],
  ["Neodymium", "Q1388", "Nd", 60],
  ["Promethium", "Q1809", "Pm", 61],
  ["Samarium", "Q1819", "Sm", 62],
  ["Europium", "Q1396", "Eu", 63],
  ["Gadolinium", "Q1832", "Gd", 64],
  ["Terbium", "Q1838", "Tb", 65],
  ["Dysprosium", "Q1843", "Dy", 66],
  ["Holmium", "Q1846", "Ho", 67],
  ["Erbium", "Q1849", "Er", 68],
  ["Thulium", "Q1853", "Tm", 69],
  ["Ytterbium", "Q1855", "Yb", 70],
  ["Lutetium", "Q1857", "Lu", 71],
  ["Hafnium", "Q1119", "Hf", 72],
  ["Tantalum", "Q1123", "Ta", 73],
  ["Tungsten", "Q743", "W", 74],
  ["Rhenium", "Q737", "Re", 75],
  ["Osmium", "Q751", "Os", 76],
  ["Iridium", "Q877", "Ir", 77],
  ["Platinum", "Q880", "Pt", 78],
  ["Gold", "Q897", "Au", 79],
  ["Mercury", "Q925", "Hg", 80],
  ["Thallium", "Q932", "Tl", 81],
  ["Lead", "Q708", "Pb", 82],
  ["Bismuth", "Q942", "Bi", 83],
  ["Polonium", "Q979", "Po", 84],
  ["Astatine", "Q999", "At", 85],
  ["Radon", "Q1133", "Rn", 86],
  ["Einsteinium", "Q1892", "Es", 99],
  ["Fermium", "Q1896", "Fm", 100],
  ["Mendelevium", "Q1898", "Md", 101],
  ["Nobelium", "Q1901", "No", 102],
  ["Lawrencium", "Q1905", "Lr", 103],
  ["Rutherfordium", "Q1226", "Rf", 104],
  ["Dubnium", "Q1232", "Db", 105],
  ["Seaborgium", "Q1234", "Sg", 106],
  ["Bohrium", "Q1249", "Bh", 107],
  ["Hassium", "Q1252", "Hs", 108],
  ["Meitnerium", "Q1258", "Mt", 109],
  ["Darmstadtium", "Q1266", "Ds", 110],
  ["Roentgenium", "Q1272", "Rg", 111],
  ["Copernicium", "Q1278", "Cn", 112],
  ["Nihonium", "Q1301", "Nh", 113],
  ["Flerovium", "Q1302", "Fl", 114],
  ["Moscovium", "Q1303", "Mc", 115],
  ["Livermorium", "Q1304", "Lv", 116],
  ["Tennessine", "Q1306", "Ts", 117],
  ["Oganesson", "Q1307", "Og", 118],
] as const;

const elementsByAtomicNumber = new Map<number, ElementFact>(
  ELEMENT_ROWS.map(([name, qid, symbol, atomicNumber]) => [
    atomicNumber,
    element(name, qid, symbol, atomicNumber),
  ]),
);

function elementByAtomicNumber(atomicNumber: number): ElementFact {
  const fact = elementsByAtomicNumber.get(atomicNumber);
  if (!fact) throw new Error("Missing element fact for atomic number " + atomicNumber);
  return fact;
}

function nearbyElementDistractors(
  atomicNumber: number,
): [ElementFact, ElementFact, ElementFact] {
  const offsets = [-1, 1, 2, -2, 3, -3, 4, -4];
  const facts = offsets
    .map((offset) => atomicNumber + offset)
    .filter((candidate) => candidate >= 1 && candidate <= 118)
    .filter((candidate) => candidate !== atomicNumber)
    .slice(0, 3)
    .map(elementByAtomicNumber);
  return [facts[0], facts[1], facts[2]];
}

const ELEMENT_SYMBOL_SPECS: ElementSymbolSpec[] = [
  { atomicNumber: 101, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 102, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 103, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 104, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 105, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 106, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 107, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 108, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 109, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 110, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 111, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 112, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 113, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 114, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 115, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 116, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 117, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 4, difficulty: "easy", direction: "symbol_to_element" },
  { atomicNumber: 5, difficulty: "easy", direction: "element_to_symbol" },
  { atomicNumber: 7, difficulty: "easy", direction: "symbol_to_element" },
  { atomicNumber: 9, difficulty: "easy", direction: "element_to_symbol" },
  { atomicNumber: 10, difficulty: "easy", direction: "symbol_to_element" },
  { atomicNumber: 13, difficulty: "intermediate", direction: "element_to_symbol" },
  { atomicNumber: 16, difficulty: "intermediate", direction: "symbol_to_element" },
  { atomicNumber: 18, difficulty: "intermediate", direction: "element_to_symbol" },
];

const ELEMENT_ATOMIC_NUMBER_SPECS: ElementAtomicNumberSpec[] = [
  { atomicNumber: 57, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 58, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 59, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 60, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 61, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 62, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 63, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 64, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 65, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 66, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 67, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 68, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 69, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 70, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 71, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 72, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 73, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 75, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 76, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 77, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 78, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 80, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 81, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 83, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 84, difficulty: "hard", direction: "element_to_number" },
];

function elementSymbol(
  difficulty: Difficulty,
  direction: ElementSymbolQuestion["direction"],
  question: string,
  subject: ElementFact,
  distractors: [ElementFact, ElementFact, ElementFact],
): ElementSymbolQuestion {
  return {
    kind: "elementSymbol",
    category: "chemical_element_symbols",
    difficulty,
    direction,
    question,
    subject,
    distractors,
  };
}

function elementAtomicNumber(
  difficulty: Difficulty,
  direction: ElementAtomicNumberQuestion["direction"],
  question: string,
  subject: ElementFact,
  distractors: [ElementFact, ElementFact, ElementFact],
): ElementAtomicNumberQuestion {
  return {
    kind: "elementAtomicNumber",
    category: "chemical_element_atomic_numbers",
    difficulty,
    direction,
    question,
    subject,
    distractors,
  };
}

const ELEMENT_TO_SYMBOL_STEMS = [
  (name: string) => name + " is abbreviated by which chemical symbol?",
  (name: string) => "Choose the periodic-table symbol assigned to " + name + ".",
  (name: string) => "Which notation represents " + name + " as an element symbol?",
  (name: string) => "For " + name + ", what is the exact IUPAC symbol?",
  (name: string) => "A formula containing " + name + " would use which element symbol?",
  (name: string) => "Identify the one- or two-letter symbol for " + name + ".",
  (name: string) => "Which option is the chemical symbol of " + name + "?",
  (name: string) => "In periodic-table notation, how is " + name + " written?",
  (name: string) => "Select the official element abbreviation for " + name + ".",
  (name: string) => "The element " + name + " appears under which symbol?",
  (name: string) => "Which symbol belongs with " + name + " in the periodic table?",
  (name: string) => "When abbreviated as an element, " + name + " becomes which symbol?",
  (name: string) => "Match " + name + " to its correct chemical symbol.",
];

const SYMBOL_TO_ELEMENT_STEMS = [
  (symbol: string) => "In chemical notation, which element does " + symbol + " name?",
  (symbol: string) => "The periodic-table abbreviation " + symbol + " points to which element?",
  (symbol: string) => "A lab label marked " + symbol + " is using the symbol for which element?",
  (symbol: string) => "Which element has " + symbol + " as its official chemical symbol?",
  (symbol: string) => "The element symbol " + symbol + " corresponds to which name?",
  (symbol: string) => "Decode the chemical symbol " + symbol + ": which element is it?",
  (symbol: string) => "On an element chart, " + symbol + " refers to which element?",
  (symbol: string) => "Which element is abbreviated " + symbol + " in IUPAC notation?",
  (symbol: string) => "What element name is paired with the symbol " + symbol + "?",
  (symbol: string) => "In the periodic table, " + symbol + " is the symbol for which element?",
  (symbol: string) => "The symbol " + symbol + " should be read as which chemical element?",
  (symbol: string) => "Which chemical element is identified by " + symbol + "?",
  (symbol: string) => "Match the symbol " + symbol + " to its element name.",
];

const ELEMENT_TO_NUMBER_STEMS = [
  (name: string) => "What atomic number does " + name + " carry?",
  (name: string) => "The periodic table assigns which number to " + name + "?",
  (name: string) => "Which proton count is listed for " + name + "?",
  (name: string) => "Select the atomic number recorded for " + name + ".",
  (name: string) => "In atomic-number order, where does " + name + " sit?",
  (name: string) => name + " is identified by which periodic-table number?",
  (name: string) => "Which number gives the atomic number of " + name + "?",
  (name: string) => "Find the periodic-table entry number for " + name + ".",
  (name: string) => "What is the atomic number attached to " + name + "?",
  (name: string) => "For " + name + ", which atomic number is correct?",
  (name: string) => "Which listed value is " + name + "'s atomic number?",
  (name: string) => "The element " + name + " has what atomic number?",
  (name: string) => "Match " + name + " to its atomic number.",
];

const NUMBER_TO_ELEMENT_STEMS = [
  (atomicNumber: string) => "Atomic number " + atomicNumber + " identifies which element?",
  (atomicNumber: string) => "Which element occupies periodic-table number " + atomicNumber + "?",
  (atomicNumber: string) => "The entry with atomic number " + atomicNumber + " is which element?",
  (atomicNumber: string) => "Periodic-table number " + atomicNumber + " names which element?",
  (atomicNumber: string) => "Which chemical element has proton count " + atomicNumber + "?",
  (atomicNumber: string) => "Find the element listed at atomic number " + atomicNumber + ".",
  (atomicNumber: string) => "Number " + atomicNumber + " on the element chart refers to which element?",
  (atomicNumber: string) => "Which element is assigned atomic number " + atomicNumber + "?",
  (atomicNumber: string) => "The atomic-number slot " + atomicNumber + " belongs to which element?",
  (atomicNumber: string) => "At position " + atomicNumber + " in atomic-number order, which element appears?",
  (atomicNumber: string) => "Which element matches atomic number " + atomicNumber + "?",
  (atomicNumber: string) => "Decode atomic number " + atomicNumber + " as an element name.",
  (atomicNumber: string) => "What element is represented by atomic number " + atomicNumber + "?",
];

function buildElementSymbolFact(
  spec: ElementSymbolSpec,
  index: number,
): ElementSymbolQuestion {
  const subject = elementByAtomicNumber(spec.atomicNumber);
  const question =
    spec.direction === "element_to_symbol"
      ? ELEMENT_TO_SYMBOL_STEMS[index % ELEMENT_TO_SYMBOL_STEMS.length](subject.name)
      : SYMBOL_TO_ELEMENT_STEMS[index % SYMBOL_TO_ELEMENT_STEMS.length](subject.symbol);
  return elementSymbol(
    spec.difficulty,
    spec.direction,
    question,
    subject,
    nearbyElementDistractors(spec.atomicNumber),
  );
}

function buildElementAtomicNumberFact(
  spec: ElementAtomicNumberSpec,
  index: number,
): ElementAtomicNumberQuestion {
  const subject = elementByAtomicNumber(spec.atomicNumber);
  const question =
    spec.direction === "element_to_number"
      ? ELEMENT_TO_NUMBER_STEMS[index % ELEMENT_TO_NUMBER_STEMS.length](subject.name)
      : NUMBER_TO_ELEMENT_STEMS[index % NUMBER_TO_ELEMENT_STEMS.length](subject.atomicNumber);
  return elementAtomicNumber(
    spec.difficulty,
    spec.direction,
    question,
    subject,
    nearbyElementDistractors(spec.atomicNumber),
  );
}

const RAW_FACTS: RawFact[] = [
  ...ELEMENT_SYMBOL_SPECS.map(buildElementSymbolFact),
  ...ELEMENT_ATOMIC_NUMBER_SPECS.map(buildElementAtomicNumberFact),
];

function sourceRef(qid: string, property: WikidataScienceProperty) {
  return "wikidata:" + qid + ":" + property + ":snapshot-" + RETRIEVED_AT;
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

function bucket(category: ScienceCategory, difficulty: Difficulty) {
  return "knowledge_" + difficulty + "_" + category;
}

function checksum(index: number) {
  return BATCH_ID + "_" + String(index + 1).padStart(3, "0");
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

function elementSymbolAnswer(fact: ElementSymbolQuestion) {
  return fact.direction === "element_to_symbol"
    ? fact.subject.symbol
    : fact.subject.name;
}

function elementSymbolDistractors(
  fact: ElementSymbolQuestion,
): [string, string, string] {
  return fact.direction === "element_to_symbol"
    ? [
        fact.distractors[0].symbol,
        fact.distractors[1].symbol,
        fact.distractors[2].symbol,
      ]
    : [
        fact.distractors[0].name,
        fact.distractors[1].name,
        fact.distractors[2].name,
      ];
}

function elementAtomicNumberAnswer(fact: ElementAtomicNumberQuestion) {
  return fact.direction === "element_to_number"
    ? fact.subject.atomicNumber
    : fact.subject.name;
}

function elementAtomicNumberDistractors(
  fact: ElementAtomicNumberQuestion,
): [string, string, string] {
  return fact.direction === "element_to_number"
    ? [
        fact.distractors[0].atomicNumber,
        fact.distractors[1].atomicNumber,
        fact.distractors[2].atomicNumber,
      ]
    : [
        fact.distractors[0].name,
        fact.distractors[1].name,
        fact.distractors[2].name,
      ];
}

function correctAnswer(fact: RawFact) {
  if (fact.kind === "elementSymbol") return elementSymbolAnswer(fact);
  return elementAtomicNumberAnswer(fact);
}

function distractors(fact: RawFact): [string, string, string] {
  if (fact.kind === "elementSymbol") return elementSymbolDistractors(fact);
  return elementAtomicNumberDistractors(fact);
}

function validateRawFacts(facts: RawFact[]) {
  for (const fact of facts) {
    const answer = correctAnswer(fact);
    for (const distractor of distractors(fact)) {
      if (distractor === answer) {
        throw new Error("Distractor duplicates the answer for " + fact.question);
      }
      if (
        distractor.toLocaleLowerCase("en-US") ===
          answer.toLocaleLowerCase("en-US") &&
        distractor !== answer
      ) {
        throw new Error("Distractor differs from answer only by case for " + fact.question);
      }
    }
    if (Number(fact.subject.atomicNumber) < 1 || Number(fact.subject.atomicNumber) > 118) {
      throw new Error("Element outside atomic-number range 1..118 for " + fact.question);
    }
  }
}

validateRawFacts(RAW_FACTS);

function explanation(fact: RawFact) {
  if (fact.kind === "elementSymbol") {
    return "Wikidata lists " + fact.subject.name + "'s chemical symbol as " + fact.subject.symbol + ".";
  }
  return "Wikidata lists " + fact.subject.name + "'s atomic number as " + fact.subject.atomicNumber + ".";
}

function optionFacts(fact: RawFact): ElementFact[] {
  return [fact.subject, ...fact.distractors];
}

function claims(fact: RawFact): ProvenanceClaim[] {
  if (fact.kind === "elementSymbol") {
    return optionFacts(fact).map((elementFact) =>
      claim(
        "chemical_element_symbol(" + elementFact.name + ") = " + elementFact.symbol,
        sourceRef(elementFact.qid, "P246"),
      ),
    );
  }
  return optionFacts(fact).map((elementFact) =>
    claim(
      "atomic_number(" + elementFact.name + ") = " + elementFact.atomicNumber,
      sourceRef(elementFact.qid, "P1086"),
    ),
  );
}

function buildQuestion(fact: RawFact, index: number): BatchQuestion {
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

function wikidataPropertyLabel(property: WikidataScienceProperty) {
  if (property === "P246") return "element symbol";
  return "atomic number";
}

function makeElementSourceRecord(
  fact: ElementFact,
  property: "P246" | "P1086",
): WikidataSourceRecord {
  return {
    sourceRef: sourceRef(fact.qid, property),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: { name: fact.name, qid: fact.qid },
      property,
      propertyLabel: wikidataPropertyLabel(property),
      value: property === "P246" ? fact.symbol : fact.atomicNumber,
      elementSet: "chemical elements Q11344 with atomic numbers 1..118",
      singleValuedForQuestion: true,
      bijectiveWithinElementSet: true,
    },
  };
}

function sourceRecordsForFact(fact: RawFact): WikidataSourceRecord[] {
  if (fact.kind === "elementSymbol") {
    return optionFacts(fact).map((entry) =>
      makeElementSourceRecord(entry, "P246"),
    );
  }
  return optionFacts(fact).map((entry) =>
    makeElementSourceRecord(entry, "P1086"),
  );
}

function buildWikidataSourceRecords(facts: RawFact[]) {
  const records = new Map<string, WikidataSourceRecord>();
  for (const fact of facts) {
    for (const record of sourceRecordsForFact(fact)) {
      records.set(record.sourceRef, record);
    }
  }
  return Object.fromEntries([...records.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>(
    (counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }),
    {} as Record<T, number>,
  );
}

function factKind(fact: RawFact) {
  return fact.kind;
}

function scienceDirection(fact: RawFact) {
  if (fact.kind === "elementSymbol") return fact.direction;
  return fact.direction;
}

export const knowledgeScienceCieScoreBatchV4Questions =
  RAW_FACTS.map(buildQuestion);
export const questions = knowledgeScienceCieScoreBatchV4Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeScienceCieScoreBatchV4Metadata = {
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
  questionCount: knowledgeScienceCieScoreBatchV4Questions.length,
  countsByCategory: countBy(
    knowledgeScienceCieScoreBatchV4Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeScienceCieScoreBatchV4Questions.map((question) => question.difficulty),
  ),
  countsByScienceFactKind: countBy(RAW_FACTS.map(factKind)),
  countsByScienceDirection: countBy(RAW_FACTS.map(scienceDirection)),
  canonicalScienceCategories: {
    chemical_element_symbols:
      "Wikidata P246; chemical elements Q11344 with atomic numbers 1..118; element-symbol facts are bijective within this element set.",
    chemical_element_atomic_numbers:
      "Wikidata P1086; chemical elements Q11344 with atomic numbers 1..118; element-atomic-number facts are single-valued and bijective.",
    si_unit_symbols:
      "Wikidata P5061; clean SI unit-symbol subjects available to this window were exhausted in science v2/v3, so v4 does not pad with SI rows.",
  },
  wikidataSourcing: {
    chemical_element_symbols:
      "P246 element symbol on Wikidata chemical element items; distractors cite other valid element-symbol records and do not reuse the correct symbol.",
    chemical_element_atomic_numbers:
      "P1086 atomic number on Wikidata chemical element items; distractors cite other valid element-number records and do not reuse the correct number.",
    si_unit_symbols:
      "No SI unit-symbol rows are authored in v4 because the clean remaining P5061 subject set was consumed earlier in the window.",
  },
  collisionRules: {
    chemical_element_symbols:
      "No inverse pair for the same element-symbol fact appears in this batch. Element-to-symbol questions use other valid element symbols as distractors; symbol-to-element questions use other elements with distinct cited symbols.",
    chemical_element_atomic_numbers:
      "No inverse pair for the same element-number fact appears in this batch. Element-to-number questions use other valid atomic numbers as distractors; number-to-element questions use other elements with distinct cited atomic numbers.",
    si_unit_symbols:
      "No SI rows in this batch; no padding after exhaustion.",
  },
  deferredScienceCategories:
    "Chemical compounds and constellations are deferred to a later science batch and are not authored here.",
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeScienceCieScoreBatchV4Questions;
