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

export type KnowledgeScienceCieScoreBatchV1Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeScienceCieScoreBatchV1Question;

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

const BATCH_ID = "knowledge_science_cie_score_v1";
const WORK_UNIT_ID = "score-mode:knowledge:science:static:v1";
const RETRIEVED_AT = "2026-05-29";
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

const elements = {
  hydrogen: element("Hydrogen", "Q556", "H", 1),
  helium: element("Helium", "Q560", "He", 2),
  lithium: element("Lithium", "Q568", "Li", 3),
  beryllium: element("Beryllium", "Q569", "Be", 4),
  boron: element("Boron", "Q618", "B", 5),
  carbon: element("Carbon", "Q623", "C", 6),
  nitrogen: element("Nitrogen", "Q627", "N", 7),
  oxygen: element("Oxygen", "Q629", "O", 8),
  fluorine: element("Fluorine", "Q650", "F", 9),
  neon: element("Neon", "Q654", "Ne", 10),
  sodium: element("Sodium", "Q658", "Na", 11),
  magnesium: element("Magnesium", "Q660", "Mg", 12),
  aluminium: element("Aluminium", "Q663", "Al", 13),
  silicon: element("Silicon", "Q670", "Si", 14),
  phosphorus: element("Phosphorus", "Q674", "P", 15),
  sulfur: element("Sulfur", "Q682", "S", 16),
  chlorine: element("Chlorine", "Q688", "Cl", 17),
  argon: element("Argon", "Q696", "Ar", 18),
  potassium: element("Potassium", "Q703", "K", 19),
  calcium: element("Calcium", "Q706", "Ca", 20),
  scandium: element("Scandium", "Q713", "Sc", 21),
  titanium: element("Titanium", "Q716", "Ti", 22),
  chromium: element("Chromium", "Q725", "Cr", 24),
  manganese: element("Manganese", "Q731", "Mn", 25),
  iron: element("Iron", "Q677", "Fe", 26),
  cobalt: element("Cobalt", "Q740", "Co", 27),
  nickel: element("Nickel", "Q744", "Ni", 28),
  copper: element("Copper", "Q753", "Cu", 29),
  zinc: element("Zinc", "Q758", "Zn", 30),
  germanium: element("Germanium", "Q867", "Ge", 32),
  selenium: element("Selenium", "Q876", "Se", 34),
  bromine: element("Bromine", "Q879", "Br", 35),
  krypton: element("Krypton", "Q888", "Kr", 36),
  zirconium: element("Zirconium", "Q1038", "Zr", 40),
  palladium: element("Palladium", "Q1089", "Pd", 46),
  silver: element("Silver", "Q1090", "Ag", 47),
  cadmium: element("Cadmium", "Q1091", "Cd", 48),
  tin: element("Tin", "Q1096", "Sn", 50),
  antimony: element("Antimony", "Q1099", "Sb", 51),
  tellurium: element("Tellurium", "Q1100", "Te", 52),
  iodine: element("Iodine", "Q1103", "I", 53),
  xenon: element("Xenon", "Q1106", "Xe", 54),
  hafnium: element("Hafnium", "Q1119", "Hf", 72),
  tantalum: element("Tantalum", "Q1123", "Ta", 73),
  tungsten: element("Tungsten", "Q743", "W", 74),
  rhenium: element("Rhenium", "Q737", "Re", 75),
  platinum: element("Platinum", "Q880", "Pt", 78),
  gold: element("Gold", "Q897", "Au", 79),
  mercury: element("Mercury", "Q925", "Hg", 80),
  lead: element("Lead", "Q708", "Pb", 82),
  bismuth: element("Bismuth", "Q942", "Bi", 83),
  polonium: element("Polonium", "Q979", "Po", 84),
  thorium: element("Thorium", "Q1115", "Th", 90),
  uranium: element("Uranium", "Q1098", "U", 92),
  neptunium: element("Neptunium", "Q1105", "Np", 93),
  plutonium: element("Plutonium", "Q1102", "Pu", 94),
  oganesson: element("Oganesson", "Q1307", "Og", 118),
} as const;

const siUnits = {
  second: siUnit("second", "Q11574", "s", "base"),
  metre: siUnit("metre", "Q11573", "m", "base"),
  kilogram: siUnit("kilogram", "Q11570", "kg", "base"),
  ampere: siUnit("ampere", "Q25272", "A", "base"),
  kelvin: siUnit("kelvin", "Q11579", "K", "base"),
  mole: siUnit("mole", "Q41509", "mol", "base"),
  candela: siUnit("candela", "Q83216", "cd", "base"),
  hertz: siUnit("hertz", "Q39369", "Hz", "special-name"),
  newton: siUnit("newton", "Q12438", "N", "special-name"),
  pascal: siUnit("pascal", "Q44395", "Pa", "special-name"),
  joule: siUnit("joule", "Q25269", "J", "special-name"),
  watt: siUnit("watt", "Q25236", "W", "special-name"),
  volt: siUnit("volt", "Q25250", "V", "special-name"),
  farad: siUnit("farad", "Q131255", "F", "special-name"),
  tesla: siUnit("tesla", "Q163343", "T", "special-name"),
} as const;

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

const RAW_FACTS: RawFact[] = [
  elementSymbol("easy", "element_to_symbol", "Oxygen uses which chemical element symbol?", elements.oxygen, [
    elements.nitrogen,
    elements.carbon,
    elements.hydrogen,
  ]),
  elementSymbol("easy", "symbol_to_element", "The chemical symbol He belongs to which element?", elements.helium, [
    elements.hydrogen,
    elements.lithium,
    elements.neon,
  ]),
  elementSymbol("easy", "element_to_symbol", "Which symbol represents the element carbon?", elements.carbon, [
    elements.oxygen,
    elements.nitrogen,
    elements.boron,
  ]),
  elementSymbol("intermediate", "symbol_to_element", "Mg is the chemical symbol for which element?", elements.magnesium, [
    elements.manganese,
    elements.mercury,
    elements.calcium,
  ]),
  elementSymbol("easy", "element_to_symbol", "In the periodic table, sodium is abbreviated by which symbol?", elements.sodium, [
    elements.potassium,
    elements.magnesium,
    elements.aluminium,
  ]),
  elementSymbol("intermediate", "symbol_to_element", "Which element is written with the symbol Si?", elements.silicon, [
    elements.sulfur,
    elements.silver,
    elements.selenium,
  ]),
  elementSymbol("easy", "element_to_symbol", "Select the chemical symbol for iron.", elements.iron, [
    elements.copper,
    elements.silver,
    elements.gold,
  ]),
  elementSymbol("intermediate", "symbol_to_element", "The one-letter symbol P identifies which element?", elements.phosphorus, [
    elements.potassium,
    elements.palladium,
    elements.polonium,
  ]),
  elementSymbol("intermediate", "element_to_symbol", "Chlorine's chemical symbol is which option?", elements.chlorine, [
    elements.fluorine,
    elements.bromine,
    elements.iodine,
  ]),
  elementSymbol("easy", "element_to_symbol", "Which element symbol is assigned to potassium?", elements.potassium, [
    elements.sodium,
    elements.calcium,
    elements.magnesium,
  ]),
  elementSymbol("intermediate", "symbol_to_element", "Ca is the symbol of which chemical element?", elements.calcium, [
    elements.carbon,
    elements.cadmium,
    elements.cobalt,
  ]),
  elementSymbol("easy", "element_to_symbol", "Copper appears on the periodic table under which symbol?", elements.copper, [
    elements.cobalt,
    elements.chromium,
    elements.calcium,
  ]),
  elementSymbol("intermediate", "symbol_to_element", "Which element has Zn as its chemical symbol?", elements.zinc, [
    elements.zirconium,
    elements.tin,
    elements.xenon,
  ]),
  elementSymbol("easy", "element_to_symbol", "What chemical symbol is used for silver?", elements.silver, [
    elements.gold,
    elements.aluminium,
    elements.argon,
  ]),
  elementSymbol("hard", "symbol_to_element", "On the periodic table, Sn names which element?", elements.tin, [
    elements.antimony,
    elements.selenium,
    elements.sodium,
  ]),
  elementSymbol("intermediate", "element_to_symbol", "Uranium is represented by which chemical symbol?", elements.uranium, [
    elements.plutonium,
    elements.neptunium,
    elements.thorium,
  ]),
  elementSymbol("hard", "symbol_to_element", "The symbol Au maps to which element?", elements.gold, [
    elements.silver,
    elements.copper,
    elements.platinum,
  ]),
  elementSymbol("intermediate", "element_to_symbol", "Which symbol denotes iodine?", elements.iodine, [
    elements.bromine,
    elements.chlorine,
    elements.fluorine,
  ]),
  elementAtomicNumber("easy", "element_to_number", "Nitrogen has which atomic number?", elements.nitrogen, [
    elements.carbon,
    elements.oxygen,
    elements.neon,
  ]),
  elementAtomicNumber("easy", "number_to_element", "Atomic number 2 identifies which element?", elements.helium, [
    elements.hydrogen,
    elements.lithium,
    elements.neon,
  ]),
  elementAtomicNumber("easy", "element_to_number", "Which atomic number is assigned to neon?", elements.neon, [
    elements.oxygen,
    elements.magnesium,
    elements.argon,
  ]),
  elementAtomicNumber("intermediate", "number_to_element", "The element with atomic number 11 is which one?", elements.sodium, [
    elements.magnesium,
    elements.potassium,
    elements.neon,
  ]),
  elementAtomicNumber("intermediate", "element_to_number", "Aluminium's atomic number is which value?", elements.aluminium, [
    elements.magnesium,
    elements.silicon,
    elements.germanium,
  ]),
  elementAtomicNumber("easy", "number_to_element", "Which element occupies atomic number 20?", elements.calcium, [
    elements.potassium,
    elements.scandium,
    elements.magnesium,
  ]),
  elementAtomicNumber("intermediate", "element_to_number", "Argon corresponds to which atomic number?", elements.argon, [
    elements.chlorine,
    elements.potassium,
    elements.krypton,
  ]),
  elementAtomicNumber("intermediate", "number_to_element", "Atomic number 26 belongs to which chemical element?", elements.iron, [
    elements.cobalt,
    elements.nickel,
    elements.chromium,
  ]),
  elementAtomicNumber("hard", "element_to_number", "Titanium is listed with which atomic number?", elements.titanium, [
    elements.scandium,
    elements.chromium,
    elements.zirconium,
  ]),
  elementAtomicNumber("intermediate", "number_to_element", "Which element is tied to atomic number 47?", elements.silver, [
    elements.gold,
    elements.cadmium,
    elements.palladium,
  ]),
  elementAtomicNumber("hard", "element_to_number", "Nickel's atomic number is which option?", elements.nickel, [
    elements.cobalt,
    elements.copper,
    elements.zinc,
  ]),
  elementAtomicNumber("hard", "number_to_element", "The atomic number 74 entry is which element?", elements.tungsten, [
    elements.tantalum,
    elements.rhenium,
    elements.hafnium,
  ]),
  elementAtomicNumber("hard", "element_to_number", "Bromine carries which atomic number?", elements.bromine, [
    elements.selenium,
    elements.krypton,
    elements.iodine,
  ]),
  elementAtomicNumber("intermediate", "number_to_element", "Periodic-table number 79 names which element?", elements.gold, [
    elements.platinum,
    elements.mercury,
    elements.silver,
  ]),
  elementAtomicNumber("intermediate", "element_to_number", "Iodine is assigned which atomic number?", elements.iodine, [
    elements.bromine,
    elements.xenon,
    elements.tellurium,
  ]),
  elementAtomicNumber("hard", "number_to_element", "Which element has atomic number 92?", elements.uranium, [
    elements.neptunium,
    elements.thorium,
    elements.plutonium,
  ]),
  elementAtomicNumber("hard", "element_to_number", "Lead is the element with which atomic number?", elements.lead, [
    elements.mercury,
    elements.bismuth,
    elements.polonium,
  ]),
  siUnitSymbol("easy", "The SI unit metre uses which symbol?", siUnits.metre, [
    siUnits.second,
    siUnits.kilogram,
    siUnits.candela,
  ]),
  siUnitSymbol("easy", "Which symbol is used for the SI unit second?", siUnits.second, [
    siUnits.metre,
    siUnits.mole,
    siUnits.ampere,
  ]),
  siUnitSymbol("easy", "Select the SI symbol for kilogram.", siUnits.kilogram, [
    siUnits.mole,
    siUnits.candela,
    siUnits.metre,
  ]),
  siUnitSymbol("easy", "Ampere is written with which SI symbol?", siUnits.ampere, [
    siUnits.kelvin,
    siUnits.candela,
    siUnits.mole,
  ]),
  siUnitSymbol("intermediate", "Which SI symbol denotes kelvin?", siUnits.kelvin, [
    siUnits.ampere,
    siUnits.candela,
    siUnits.mole,
  ]),
  siUnitSymbol("intermediate", "The SI base unit mole has which symbol?", siUnits.mole, [
    siUnits.candela,
    siUnits.kilogram,
    siUnits.metre,
  ]),
  siUnitSymbol("intermediate", "What is the SI symbol for candela?", siUnits.candela, [
    siUnits.mole,
    siUnits.kilogram,
    siUnits.ampere,
  ]),
  siUnitSymbol("easy", "Hertz uses which SI unit symbol?", siUnits.hertz, [
    siUnits.newton,
    siUnits.pascal,
    siUnits.watt,
  ]),
  siUnitSymbol("easy", "Which SI symbol stands for newton?", siUnits.newton, [
    siUnits.joule,
    siUnits.watt,
    siUnits.pascal,
  ]),
  siUnitSymbol("intermediate", "Pascal is represented by which SI symbol?", siUnits.pascal, [
    siUnits.joule,
    siUnits.watt,
    siUnits.volt,
  ]),
  siUnitSymbol("easy", "Choose the SI symbol for joule.", siUnits.joule, [
    siUnits.watt,
    siUnits.newton,
    siUnits.pascal,
  ]),
  siUnitSymbol("easy", "Watt has which SI unit symbol?", siUnits.watt, [
    siUnits.joule,
    siUnits.volt,
    siUnits.farad,
  ]),
  siUnitSymbol("intermediate", "Which SI symbol is used for volt?", siUnits.volt, [
    siUnits.ampere,
    siUnits.tesla,
    siUnits.farad,
  ]),
  siUnitSymbol("hard", "Farad is abbreviated by which SI symbol?", siUnits.farad, [
    siUnits.volt,
    siUnits.tesla,
    siUnits.hertz,
  ]),
  siUnitSymbol("hard", "The SI unit tesla uses which symbol?", siUnits.tesla, [
    siUnits.hertz,
    siUnits.volt,
    siUnits.newton,
  ]),
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

export const knowledgeScienceCieScoreBatchV1Questions =
  RAW_FACTS.map(buildQuestion);
export const questions = knowledgeScienceCieScoreBatchV1Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeScienceCieScoreBatchV1Metadata = {
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
  questionCount: knowledgeScienceCieScoreBatchV1Questions.length,
  countsByCategory: countBy(
    knowledgeScienceCieScoreBatchV1Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeScienceCieScoreBatchV1Questions.map((question) => question.difficulty),
  ),
  countsByScienceFactKind: countBy(RAW_FACTS.map(factKind)),
  countsByScienceDirection: countBy(RAW_FACTS.map(scienceDirection)),
  canonicalScienceCategories: {
    chemical_element_symbols:
      "Wikidata P246; chemical elements Q11344 with atomic numbers 1..118; element-symbol facts are bijective within this element set.",
    chemical_element_atomic_numbers:
      "Wikidata P1086; chemical elements Q11344 with atomic numbers 1..118; element-atomic-number facts are single-valued and bijective.",
    si_unit_symbols:
      "Wikidata P5061; SI base units plus SI special-name units; authored only in the unit-to-symbol direction.",
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
      "Only unit-to-symbol questions are authored. Distractors are valid SI unit symbols and do not include another symbol for the subject unit or a case-only collision for that subject.",
  },
  deferredScienceCategories:
    "Chemical compounds and constellations are deferred to a later science batch and are not authored here.",
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeScienceCieScoreBatchV1Questions;
