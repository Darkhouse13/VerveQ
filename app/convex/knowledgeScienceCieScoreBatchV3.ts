import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";
type ScienceCategory =
  | "chemical_element_symbols"
  | "chemical_element_atomic_numbers"
  | "si_unit_symbols";
type WikidataScienceProperty = "P246" | "P1086" | "P5061";

type ElementFact = {
  kind: "element";
  name: string;
  qid: string;
  symbol: string;
  atomicNumber: string;
};

type SiUnitFact = {
  kind: "siUnit";
  name: string;
  qid: string;
  symbol: string;
  unitClass: "base" | "special-name";
  symbolLanguage: "en" | "mul";
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

export type KnowledgeScienceCieScoreBatchV3Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeScienceCieScoreBatchV3Question;

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

type SiUnitSymbolQuestion = {
  kind: "siUnitSymbol";
  category: "si_unit_symbols";
  difficulty: Difficulty;
  question: string;
  subject: SiUnitFact;
  distractors: [SiUnitFact, SiUnitFact, SiUnitFact];
};

type RawFact =
  | ElementSymbolQuestion
  | ElementAtomicNumberQuestion
  | SiUnitSymbolQuestion;

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

type SiUnitSymbolSpec = {
  key: string;
  difficulty: Difficulty;
  distractorKeys: [string, string, string];
};

const BATCH_ID = "knowledge_science_cie_score_v3";
const WORK_UNIT_ID = "score-mode:knowledge:science:static:v3";
const RETRIEVED_AT = "2026-05-30";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

function element(
  name: string,
  qid: string,
  symbol: string,
  atomicNumber: number,
): ElementFact {
  return { kind: "element", name, qid, symbol, atomicNumber: String(atomicNumber) };
}

function siUnit(
  name: string,
  qid: string,
  symbol: string,
  unitClass: SiUnitFact["unitClass"],
  symbolLanguage: SiUnitFact["symbolLanguage"] = "en",
): SiUnitFact {
  return { kind: "siUnit", name, qid, symbol, unitClass, symbolLanguage };
}

const ELEMENT_ROWS = [
  ["Copper", "Q753", "Cu", 29],
  ["Zinc", "Q758", "Zn", 30],
  ["Gallium", "Q861", "Ga", 31],
  ["Germanium", "Q867", "Ge", 32],
  ["Arsenic", "Q871", "As", 33],
  ["Selenium", "Q876", "Se", 34],
  ["Bromine", "Q879", "Br", 35],
  ["Krypton", "Q888", "Kr", 36],
  ["Rubidium", "Q895", "Rb", 37],
  ["Strontium", "Q938", "Sr", 38],
  ["Yttrium", "Q941", "Y", 39],
  ["Zirconium", "Q1038", "Zr", 40],
  ["Niobium", "Q1046", "Nb", 41],
  ["Molybdenum", "Q1053", "Mo", 42],
  ["Technetium", "Q1054", "Tc", 43],
  ["Ruthenium", "Q1086", "Ru", 44],
  ["Rhodium", "Q1087", "Rh", 45],
  ["Palladium", "Q1089", "Pd", 46],
  ["Silver", "Q1090", "Ag", 47],
  ["Cadmium", "Q1091", "Cd", 48],
  ["Indium", "Q1094", "In", 49],
  ["Tin", "Q1096", "Sn", 50],
  ["Antimony", "Q1099", "Sb", 51],
  ["Tellurium", "Q1100", "Te", 52],
  ["Iodine", "Q1103", "I", 53],
  ["Xenon", "Q1106", "Xe", 54],
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
  ["Francium", "Q671", "Fr", 87],
  ["Radium", "Q1128", "Ra", 88],
  ["Actinium", "Q1121", "Ac", 89],
  ["Thorium", "Q1115", "Th", 90],
  ["Protactinium", "Q1109", "Pa", 91],
  ["Uranium", "Q1098", "U", 92],
  ["Neptunium", "Q1105", "Np", 93],
  ["Plutonium", "Q1102", "Pu", 94],
  ["Americium", "Q1872", "Am", 95],
  ["Curium", "Q1876", "Cm", 96],
  ["Berkelium", "Q1882", "Bk", 97],
  ["Californium", "Q1888", "Cf", 98],
  ["Einsteinium", "Q1892", "Es", 99],
  ["Fermium", "Q1896", "Fm", 100],
  ["Mendelevium", "Q1898", "Md", 101],
  ["Nobelium", "Q1901", "No", 102],
] as const;

const SI_UNIT_ROWS = [
  ["gray", "gray", "Q190095", "Gy", "special-name", "en"],
  ["sievert", "sievert", "Q103246", "Sv", "special-name", "en"],
  ["katal", "katal", "Q208634", "kat", "special-name", "en"],
  ["becquerel", "becquerel", "Q102573", "Bq", "special-name", "en"],
  ["lumen", "lumen", "Q484092", "lm", "special-name", "en"],
] as const;

const elementsByAtomicNumber = new Map(
  ELEMENT_ROWS.map(([name, qid, symbol, atomicNumber]) => [
    atomicNumber,
    element(name, qid, symbol, atomicNumber),
  ]),
);

const siUnitsByKey = new Map(
  SI_UNIT_ROWS.map(([key, name, qid, symbol, unitClass, symbolLanguage]) => [
    key,
    siUnit(name, qid, symbol, unitClass, symbolLanguage),
  ]),
);

function elementByAtomicNumber(atomicNumber: number): ElementFact {
  const fact = elementsByAtomicNumber.get(atomicNumber);
  if (!fact) throw new Error("Missing element fact for atomic number " + atomicNumber);
  return fact;
}

function siUnitByKey(key: string): SiUnitFact {
  const fact = siUnitsByKey.get(key);
  if (!fact) throw new Error("Missing SI unit fact for " + key);
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
  { atomicNumber: 63, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 64, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 65, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 66, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 67, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 68, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 69, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 70, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 71, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 76, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 77, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 81, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 85, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 86, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 87, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 88, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 89, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 91, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 95, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 96, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 97, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 98, difficulty: "hard", direction: "symbol_to_element" },
  { atomicNumber: 99, difficulty: "hard", direction: "element_to_symbol" },
  { atomicNumber: 100, difficulty: "hard", direction: "symbol_to_element" },
];

const ELEMENT_ATOMIC_NUMBER_SPECS: ElementAtomicNumberSpec[] = [
  { atomicNumber: 31, difficulty: "intermediate", direction: "element_to_number" },
  { atomicNumber: 32, difficulty: "intermediate", direction: "number_to_element" },
  { atomicNumber: 33, difficulty: "intermediate", direction: "element_to_number" },
  { atomicNumber: 34, difficulty: "intermediate", direction: "number_to_element" },
  { atomicNumber: 36, difficulty: "intermediate", direction: "element_to_number" },
  { atomicNumber: 37, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 38, difficulty: "intermediate", direction: "element_to_number" },
  { atomicNumber: 39, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 40, difficulty: "intermediate", direction: "element_to_number" },
  { atomicNumber: 41, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 42, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 43, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 44, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 45, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 46, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 48, difficulty: "intermediate", direction: "number_to_element" },
  { atomicNumber: 49, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 50, difficulty: "intermediate", direction: "number_to_element" },
  { atomicNumber: 51, difficulty: "hard", direction: "element_to_number" },
  { atomicNumber: 52, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 54, difficulty: "intermediate", direction: "element_to_number" },
  { atomicNumber: 55, difficulty: "hard", direction: "number_to_element" },
  { atomicNumber: 56, difficulty: "intermediate", direction: "element_to_number" },
];

const SI_UNIT_SYMBOL_SPECS: SiUnitSymbolSpec[] = [
  { key: "gray", difficulty: "hard", distractorKeys: ["sievert", "katal", "becquerel"] },
  { key: "sievert", difficulty: "hard", distractorKeys: ["gray", "katal", "lumen"] },
  { key: "katal", difficulty: "hard", distractorKeys: ["becquerel", "gray", "sievert"] },
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

function siUnitSymbol(
  difficulty: Difficulty,
  question: string,
  subject: SiUnitFact,
  distractors: [SiUnitFact, SiUnitFact, SiUnitFact],
): SiUnitSymbolQuestion {
  return {
    kind: "siUnitSymbol",
    category: "si_unit_symbols",
    difficulty,
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

const SI_UNIT_STEMS = [
  (name: string) => "The SI unit " + name + " uses which symbol?",
  (name: string) => "Which symbol is used for the SI unit " + name + "?",
  (name: string) => "Select the SI symbol for " + name + ".",
  (name: string) => name + " is written with which SI unit symbol?",
  (name: string) => "In SI notation, how is " + name + " abbreviated?",
  (name: string) => "What is the official SI symbol for " + name + "?",
  (name: string) => "Choose the unit symbol paired with " + name + ".",
  (name: string) => "The unit name " + name + " corresponds to which SI symbol?",
  (name: string) => "Match " + name + " to its case-sensitive SI symbol.",
  (name: string) => "Which option gives the SI abbreviation for " + name + "?",
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

function buildSiUnitSymbolFact(
  spec: SiUnitSymbolSpec,
  index: number,
): SiUnitSymbolQuestion {
  const subject = siUnitByKey(spec.key);
  return siUnitSymbol(
    spec.difficulty,
    SI_UNIT_STEMS[index % SI_UNIT_STEMS.length](subject.name),
    subject,
    [
      siUnitByKey(spec.distractorKeys[0]),
      siUnitByKey(spec.distractorKeys[1]),
      siUnitByKey(spec.distractorKeys[2]),
    ],
  );
}

const RAW_FACTS: RawFact[] = [
  ...ELEMENT_SYMBOL_SPECS.map(buildElementSymbolFact),
  ...ELEMENT_ATOMIC_NUMBER_SPECS.map(buildElementAtomicNumberFact),
  ...SI_UNIT_SYMBOL_SPECS.map(buildSiUnitSymbolFact),
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

function siUnitAnswer(fact: SiUnitSymbolQuestion) {
  return fact.subject.symbol;
}

function siUnitDistractors(fact: SiUnitSymbolQuestion): [string, string, string] {
  return [
    fact.distractors[0].symbol,
    fact.distractors[1].symbol,
    fact.distractors[2].symbol,
  ];
}

function correctAnswer(fact: RawFact) {
  if (fact.kind === "elementSymbol") return elementSymbolAnswer(fact);
  if (fact.kind === "elementAtomicNumber") return elementAtomicNumberAnswer(fact);
  return siUnitAnswer(fact);
}

function distractors(fact: RawFact): [string, string, string] {
  if (fact.kind === "elementSymbol") return elementSymbolDistractors(fact);
  if (fact.kind === "elementAtomicNumber") {
    return elementAtomicNumberDistractors(fact);
  }
  return siUnitDistractors(fact);
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
    if (
      (fact.kind === "elementSymbol" || fact.kind === "elementAtomicNumber") &&
      (Number(fact.subject.atomicNumber) < 1 || Number(fact.subject.atomicNumber) > 118)
    ) {
      throw new Error("Element outside atomic-number range 1..118 for " + fact.question);
    }
  }
}

validateRawFacts(RAW_FACTS);

function explanation(fact: RawFact) {
  if (fact.kind === "elementSymbol") {
    return "Wikidata lists " + fact.subject.name + "'s chemical symbol as " + fact.subject.symbol + ".";
  }
  if (fact.kind === "elementAtomicNumber") {
    return "Wikidata lists " + fact.subject.name + "'s atomic number as " + fact.subject.atomicNumber + ".";
  }
  return "Wikidata lists the SI unit symbol for " + fact.subject.name + " as " + fact.subject.symbol + ".";
}

function optionFacts(fact: RawFact): Array<ElementFact | SiUnitFact> {
  return [fact.subject, ...fact.distractors];
}

function claims(fact: RawFact): ProvenanceClaim[] {
  if (fact.kind === "elementSymbol") {
    return optionFacts(fact).map((entry) => {
      const elementFact = entry as ElementFact;
      return claim(
        "chemical_element_symbol(" + elementFact.name + ") = " + elementFact.symbol,
        sourceRef(elementFact.qid, "P246"),
      );
    });
  }
  if (fact.kind === "elementAtomicNumber") {
    return optionFacts(fact).map((entry) => {
      const elementFact = entry as ElementFact;
      return claim(
        "atomic_number(" + elementFact.name + ") = " + elementFact.atomicNumber,
        sourceRef(elementFact.qid, "P1086"),
      );
    });
  }
  return optionFacts(fact).map((entry) => {
    const unitFact = entry as SiUnitFact;
    return claim(
      "si_unit_symbol(" + unitFact.name + ") = " + unitFact.symbol,
      sourceRef(unitFact.qid, "P5061"),
    );
  });
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
  if (property === "P1086") return "atomic number";
  return "unit symbol";
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

function makeSiUnitSourceRecord(fact: SiUnitFact): WikidataSourceRecord {
  return {
    sourceRef: sourceRef(fact.qid, "P5061"),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: { name: fact.name, qid: fact.qid },
      property: "P5061",
      propertyLabel: wikidataPropertyLabel("P5061"),
      value: fact.symbol,
      symbolLanguage: fact.symbolLanguage,
      unitSystem: "SI",
      unitClass: fact.unitClass,
      directionAllowed: "unit_to_symbol_only",
      caseSensitive: true,
    },
  };
}

function sourceRecordsForFact(fact: RawFact): WikidataSourceRecord[] {
  if (fact.kind === "elementSymbol") {
    return optionFacts(fact).map((entry) =>
      makeElementSourceRecord(entry as ElementFact, "P246"),
    );
  }
  if (fact.kind === "elementAtomicNumber") {
    return optionFacts(fact).map((entry) =>
      makeElementSourceRecord(entry as ElementFact, "P1086"),
    );
  }
  return optionFacts(fact).map((entry) =>
    makeSiUnitSourceRecord(entry as SiUnitFact),
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
  if (fact.kind === "elementAtomicNumber") return fact.direction;
  return "unit_to_symbol";
}

export const knowledgeScienceCieScoreBatchV3Questions =
  RAW_FACTS.map(buildQuestion);
export const questions = knowledgeScienceCieScoreBatchV3Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeScienceCieScoreBatchV3Metadata = {
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
  questionCount: knowledgeScienceCieScoreBatchV3Questions.length,
  countsByCategory: countBy(
    knowledgeScienceCieScoreBatchV3Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeScienceCieScoreBatchV3Questions.map((question) => question.difficulty),
  ),
  countsByScienceFactKind: countBy(RAW_FACTS.map(factKind)),
  countsByScienceDirection: countBy(RAW_FACTS.map(scienceDirection)),
  canonicalScienceCategories: {
    chemical_element_symbols:
      "Wikidata P246; chemical elements Q11344 with atomic numbers 1..118; element-symbol facts are bijective within this element set.",
    chemical_element_atomic_numbers:
      "Wikidata P1086; chemical elements Q11344 with atomic numbers 1..118; element-atomic-number facts are single-valued and bijective.",
    si_unit_symbols:
      "Wikidata P5061; remaining clean SI special-name unit subjects after science v1/v2; authored only in the unit-to-symbol direction.",
  },
  wikidataSourcing: {
    chemical_element_symbols:
      "P246 element symbol on Wikidata chemical element items; distractors cite other valid element-symbol records and do not reuse the correct symbol.",
    chemical_element_atomic_numbers:
      "P1086 atomic number on Wikidata chemical element items; distractors cite other valid element-number records and do not reuse the correct number.",
    si_unit_symbols:
      "P5061 unit symbol on Wikidata SI unit items; distractors are other valid SI unit symbols, with case-sensitive symbols preserved.",
  },
  collisionRules: {
    chemical_element_symbols:
      "No inverse pair for the same element-symbol fact appears in this batch. Element-to-symbol questions use other valid element symbols as distractors; symbol-to-element questions use other elements with distinct cited symbols.",
    chemical_element_atomic_numbers:
      "No inverse pair for the same element-number fact appears in this batch. Element-to-number questions use other valid atomic numbers as distractors; number-to-element questions use other elements with distinct cited atomic numbers.",
    si_unit_symbols:
      "Only unit-to-symbol questions are authored. Distractors are valid SI unit symbols, do not include another symbol for the subject unit, and do not differ from the answer only by case.",
  },
  deferredScienceCategories:
    "Chemical compounds and constellations are deferred to a later science batch and are not authored here.",
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeScienceCieScoreBatchV3Questions;
