import type { SkillNodeId } from "./learnSkillGraph";
import type { LearnModeDistractor } from "./learnGeographyNonobviousLadderV1";
import {
  knowledgeScienceCieScoreBatchV1Questions,
  wikidataSourceRecords as scienceWikidataSourceRecords,
} from "./knowledgeScienceCieScoreBatchV1";

// Learn-mode reveal layer over knowledge_science_cie_score_v1 checksums.
//
// DERIVED-ONLY INVARIANT: this layer introduces NO new factual claims. Every
// symbol, atomic number, and unit class in the reveal copy is restated from
// the already cross-family-verified batch facts (Codex authored, Opus
// verified, batch verdict "agree"). validateLearnScienceRecallRevealsV1()
// mechanically proves the derivation: every fact used here must resolve to an
// existing batch wikidataSourceRecord with an identical value, and every
// distractor/answer must match the batch question's own options. Entries that
// fail any check are dropped from the exported map (fail-closed).

type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";

type ProvenanceClaim = {
  claim: string;
  sourceType: SourceType;
  sourceRef: string;
  retrievedAt: string;
  volatility: Volatility;
};

type LearnModeProvenance = {
  claims: ProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: Verdict;
  batchId: string;
  workUnitId: string;
};

export type LearnScienceRecallReveal = {
  skillNodes: SkillNodeId[];
  distractors: LearnModeDistractor[];
  correctReveal: string;
  provenance: LearnModeProvenance;
};

type ElementFact = {
  name: string;
  qid: string;
  symbol: string;
  atomicNumber: number;
};

type SiUnitFact = {
  name: string;
  qid: string;
  symbol: string;
  unitClass: "base" | "special-name";
};

const BATCH_ID = "learn_science_recall_reveals_v1";
const WORK_UNIT_ID = "learn:knowledge:science:recall-reveals:v1";
const SOURCE_BATCH_ID = "knowledge_science_cie_score_v1";
const RETRIEVED_AT = "2026-05-29";
const AUTHOR_MODEL = "anthropic/claude-fable-5";
const VERIFIER_MODEL = "openai/gpt-5-codex";

const SYMBOLS_NODE: SkillNodeId = "sci.elements.symbols";
const NUMBERS_NODE: SkillNodeId = "sci.elements.numbers";
const UNITS_NODE: SkillNodeId = "sci.units.si";

function element(name: string, qid: string, symbol: string, atomicNumber: number): ElementFact {
  return { name, qid, symbol, atomicNumber };
}

function siUnit(name: string, qid: string, symbol: string, unitClass: SiUnitFact["unitClass"]): SiUnitFact {
  return { name, qid, symbol, unitClass };
}

// Facts restated 1:1 from knowledge_science_cie_score_v1 — the validator
// cross-checks every row against the batch's source records.
const hydrogen = element("Hydrogen", "Q556", "H", 1);
const helium = element("Helium", "Q560", "He", 2);
const lithium = element("Lithium", "Q568", "Li", 3);
const boron = element("Boron", "Q618", "B", 5);
const carbon = element("Carbon", "Q623", "C", 6);
const nitrogen = element("Nitrogen", "Q627", "N", 7);
const oxygen = element("Oxygen", "Q629", "O", 8);
const fluorine = element("Fluorine", "Q650", "F", 9);
const neon = element("Neon", "Q654", "Ne", 10);
const sodium = element("Sodium", "Q658", "Na", 11);
const magnesium = element("Magnesium", "Q660", "Mg", 12);
const aluminium = element("Aluminium", "Q663", "Al", 13);
const silicon = element("Silicon", "Q670", "Si", 14);
const phosphorus = element("Phosphorus", "Q674", "P", 15);
const sulfur = element("Sulfur", "Q682", "S", 16);
const chlorine = element("Chlorine", "Q688", "Cl", 17);
const argon = element("Argon", "Q696", "Ar", 18);
const potassium = element("Potassium", "Q703", "K", 19);
const calcium = element("Calcium", "Q706", "Ca", 20);
const scandium = element("Scandium", "Q713", "Sc", 21);
const titanium = element("Titanium", "Q716", "Ti", 22);
const chromium = element("Chromium", "Q725", "Cr", 24);
const manganese = element("Manganese", "Q731", "Mn", 25);
const iron = element("Iron", "Q677", "Fe", 26);
const cobalt = element("Cobalt", "Q740", "Co", 27);
const nickel = element("Nickel", "Q744", "Ni", 28);
const copper = element("Copper", "Q753", "Cu", 29);
const zinc = element("Zinc", "Q758", "Zn", 30);
const germanium = element("Germanium", "Q867", "Ge", 32);
const selenium = element("Selenium", "Q876", "Se", 34);
const bromine = element("Bromine", "Q879", "Br", 35);
const krypton = element("Krypton", "Q888", "Kr", 36);
const zirconium = element("Zirconium", "Q1038", "Zr", 40);
const palladium = element("Palladium", "Q1089", "Pd", 46);
const silver = element("Silver", "Q1090", "Ag", 47);
const cadmium = element("Cadmium", "Q1091", "Cd", 48);
const tin = element("Tin", "Q1096", "Sn", 50);
const antimony = element("Antimony", "Q1099", "Sb", 51);
const tellurium = element("Tellurium", "Q1100", "Te", 52);
const iodine = element("Iodine", "Q1103", "I", 53);
const xenon = element("Xenon", "Q1106", "Xe", 54);
const hafnium = element("Hafnium", "Q1119", "Hf", 72);
const tantalum = element("Tantalum", "Q1123", "Ta", 73);
const tungsten = element("Tungsten", "Q743", "W", 74);
const rhenium = element("Rhenium", "Q737", "Re", 75);
const platinum = element("Platinum", "Q880", "Pt", 78);
const gold = element("Gold", "Q897", "Au", 79);
const mercury = element("Mercury", "Q925", "Hg", 80);
const lead = element("Lead", "Q708", "Pb", 82);
const bismuth = element("Bismuth", "Q942", "Bi", 83);
const polonium = element("Polonium", "Q979", "Po", 84);
const thorium = element("Thorium", "Q1115", "Th", 90);
const uranium = element("Uranium", "Q1098", "U", 92);
const neptunium = element("Neptunium", "Q1105", "Np", 93);
const plutonium = element("Plutonium", "Q1102", "Pu", 94);

const second = siUnit("second", "Q11574", "s", "base");
const metre = siUnit("metre", "Q11573", "m", "base");
const kilogram = siUnit("kilogram", "Q11570", "kg", "base");
const ampere = siUnit("ampere", "Q25272", "A", "base");
const kelvin = siUnit("kelvin", "Q11579", "K", "base");
const mole = siUnit("mole", "Q41509", "mol", "base");
const candela = siUnit("candela", "Q83216", "cd", "base");
const hertz = siUnit("hertz", "Q39369", "Hz", "special-name");
const newton = siUnit("newton", "Q12438", "N", "special-name");
const pascal = siUnit("pascal", "Q44395", "Pa", "special-name");
const joule = siUnit("joule", "Q25269", "J", "special-name");
const watt = siUnit("watt", "Q25236", "W", "special-name");
const volt = siUnit("volt", "Q25250", "V", "special-name");
const farad = siUnit("farad", "Q131255", "F", "special-name");
const tesla = siUnit("tesla", "Q163343", "T", "special-name");

type ElementRevealRow = {
  checksum: string;
  node: SkillNodeId;
  /** Whether the MCQ options are symbols/numbers or element names. */
  direction: "to_value" | "to_element";
  /**
   * Which extra fact the correct reveal teaches. "cross" restates the
   * subject's other property (symbol ↔ atomic number) and requires the batch
   * to carry that record; "contrast" restates the distractors' own values —
   * used where the batch has no cross-property record for the subject.
   */
  hook: "cross" | "contrast";
  subject: ElementFact;
  distractors: [ElementFact, ElementFact, ElementFact];
};

type UnitRevealRow = {
  checksum: string;
  subject: SiUnitFact;
  distractors: [SiUnitFact, SiUnitFact, SiUnitFact];
};

const cs = (n: string) => `${SOURCE_BATCH_ID}_${n}`;

const SYMBOL_REVEAL_ROWS: ElementRevealRow[] = [
  { checksum: cs("001"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: oxygen, distractors: [nitrogen, carbon, hydrogen] },
  { checksum: cs("002"), node: SYMBOLS_NODE, direction: "to_element", hook: "cross", subject: helium, distractors: [hydrogen, lithium, neon] },
  { checksum: cs("003"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: carbon, distractors: [oxygen, nitrogen, boron] },
  { checksum: cs("004"), node: SYMBOLS_NODE, direction: "to_element", hook: "cross", subject: magnesium, distractors: [manganese, mercury, calcium] },
  { checksum: cs("005"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: sodium, distractors: [potassium, magnesium, aluminium] },
  { checksum: cs("006"), node: SYMBOLS_NODE, direction: "to_element", hook: "cross", subject: silicon, distractors: [sulfur, silver, selenium] },
  { checksum: cs("007"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: iron, distractors: [copper, silver, gold] },
  { checksum: cs("008"), node: SYMBOLS_NODE, direction: "to_element", hook: "contrast", subject: phosphorus, distractors: [potassium, palladium, polonium] },
  { checksum: cs("009"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: chlorine, distractors: [fluorine, bromine, iodine] },
  { checksum: cs("010"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: potassium, distractors: [sodium, calcium, magnesium] },
  { checksum: cs("011"), node: SYMBOLS_NODE, direction: "to_element", hook: "cross", subject: calcium, distractors: [carbon, cadmium, cobalt] },
  { checksum: cs("012"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: copper, distractors: [cobalt, chromium, calcium] },
  { checksum: cs("013"), node: SYMBOLS_NODE, direction: "to_element", hook: "cross", subject: zinc, distractors: [zirconium, tin, xenon] },
  { checksum: cs("014"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: silver, distractors: [gold, aluminium, argon] },
  { checksum: cs("015"), node: SYMBOLS_NODE, direction: "to_element", hook: "contrast", subject: tin, distractors: [antimony, selenium, sodium] },
  { checksum: cs("016"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: uranium, distractors: [plutonium, neptunium, thorium] },
  { checksum: cs("017"), node: SYMBOLS_NODE, direction: "to_element", hook: "cross", subject: gold, distractors: [silver, copper, platinum] },
  { checksum: cs("018"), node: SYMBOLS_NODE, direction: "to_value", hook: "cross", subject: iodine, distractors: [bromine, chlorine, fluorine] },
];

const NUMBER_REVEAL_ROWS: ElementRevealRow[] = [
  { checksum: cs("019"), node: NUMBERS_NODE, direction: "to_value", hook: "cross", subject: nitrogen, distractors: [carbon, oxygen, neon] },
  { checksum: cs("020"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: helium, distractors: [hydrogen, lithium, neon] },
  { checksum: cs("021"), node: NUMBERS_NODE, direction: "to_value", hook: "cross", subject: neon, distractors: [oxygen, magnesium, argon] },
  { checksum: cs("022"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: sodium, distractors: [magnesium, potassium, neon] },
  { checksum: cs("023"), node: NUMBERS_NODE, direction: "to_value", hook: "cross", subject: aluminium, distractors: [magnesium, silicon, germanium] },
  { checksum: cs("024"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: calcium, distractors: [potassium, scandium, magnesium] },
  { checksum: cs("025"), node: NUMBERS_NODE, direction: "to_value", hook: "cross", subject: argon, distractors: [chlorine, potassium, krypton] },
  { checksum: cs("026"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: iron, distractors: [cobalt, nickel, chromium] },
  { checksum: cs("027"), node: NUMBERS_NODE, direction: "to_value", hook: "contrast", subject: titanium, distractors: [scandium, chromium, zirconium] },
  { checksum: cs("028"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: silver, distractors: [gold, cadmium, palladium] },
  { checksum: cs("029"), node: NUMBERS_NODE, direction: "to_value", hook: "contrast", subject: nickel, distractors: [cobalt, copper, zinc] },
  { checksum: cs("030"), node: NUMBERS_NODE, direction: "to_element", hook: "contrast", subject: tungsten, distractors: [tantalum, rhenium, hafnium] },
  { checksum: cs("031"), node: NUMBERS_NODE, direction: "to_value", hook: "cross", subject: bromine, distractors: [selenium, krypton, iodine] },
  { checksum: cs("032"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: gold, distractors: [platinum, mercury, silver] },
  { checksum: cs("033"), node: NUMBERS_NODE, direction: "to_value", hook: "cross", subject: iodine, distractors: [bromine, xenon, tellurium] },
  { checksum: cs("034"), node: NUMBERS_NODE, direction: "to_element", hook: "cross", subject: uranium, distractors: [neptunium, thorium, plutonium] },
  { checksum: cs("035"), node: NUMBERS_NODE, direction: "to_value", hook: "contrast", subject: lead, distractors: [mercury, bismuth, polonium] },
];

const UNIT_REVEAL_ROWS: UnitRevealRow[] = [
  { checksum: cs("036"), subject: metre, distractors: [second, kilogram, candela] },
  { checksum: cs("037"), subject: second, distractors: [metre, mole, ampere] },
  { checksum: cs("038"), subject: kilogram, distractors: [mole, candela, metre] },
  { checksum: cs("039"), subject: ampere, distractors: [kelvin, candela, mole] },
  { checksum: cs("040"), subject: kelvin, distractors: [ampere, candela, mole] },
  { checksum: cs("041"), subject: mole, distractors: [candela, kilogram, metre] },
  { checksum: cs("042"), subject: candela, distractors: [mole, kilogram, ampere] },
  { checksum: cs("043"), subject: hertz, distractors: [newton, pascal, watt] },
  { checksum: cs("044"), subject: newton, distractors: [joule, watt, pascal] },
  { checksum: cs("045"), subject: pascal, distractors: [joule, watt, volt] },
  { checksum: cs("046"), subject: joule, distractors: [watt, newton, pascal] },
  { checksum: cs("047"), subject: watt, distractors: [joule, volt, farad] },
  { checksum: cs("048"), subject: volt, distractors: [ampere, tesla, farad] },
  { checksum: cs("049"), subject: farad, distractors: [volt, tesla, hertz] },
  { checksum: cs("050"), subject: tesla, distractors: [hertz, volt, newton] },
];

function sourceRef(qid: string, property: "P246" | "P1086" | "P5061"): string {
  return `wikidata:${qid}:${property}:snapshot-${RETRIEVED_AT}`;
}

function claim(text: string, ref: string): ProvenanceClaim {
  return {
    claim: text,
    sourceType: "structured_open",
    sourceRef: ref,
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
  };
}

// Claim strings mirror the batch's own vocabulary exactly, so reveal claims
// can be string-matched against the question's verified claims.
function symbolClaim(fact: ElementFact): ProvenanceClaim {
  return claim(`chemical_element_symbol(${fact.name}) = ${fact.symbol}`, sourceRef(fact.qid, "P246"));
}

function atomicNumberClaim(fact: ElementFact): ProvenanceClaim {
  return claim(`atomic_number(${fact.name}) = ${fact.atomicNumber}`, sourceRef(fact.qid, "P1086"));
}

function unitClaim(fact: SiUnitFact): ProvenanceClaim {
  return claim(`si_unit_symbol(${fact.name}) = ${fact.symbol}`, sourceRef(fact.qid, "P5061"));
}

function provenance(claims: ProvenanceClaim[], verdict: Verdict): LearnModeProvenance {
  return {
    claims,
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict,
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function lower(name: string): string {
  return name.toLowerCase();
}

function symbolDistractor(row: ElementRevealRow, distractor: ElementFact): LearnModeDistractor {
  if (row.direction === "to_value") {
    return {
      text: distractor.symbol,
      misconception: "neighboring symbol recall",
      whyChosen: "It is a plausible symbol from the same recall neighborhood.",
      reveal: `${distractor.symbol} is ${lower(distractor.name)}'s symbol — ${lower(row.subject.name)} is ${row.subject.symbol}.`,
    };
  }
  return {
    text: distractor.name,
    misconception: "similar element-name recall",
    whyChosen: "Its name or symbol is easy to confuse with the answer's.",
    reveal: `${distractor.name}'s symbol is ${distractor.symbol} — ${row.subject.symbol} belongs to ${lower(row.subject.name)}.`,
  };
}

function numberDistractor(row: ElementRevealRow, distractor: ElementFact): LearnModeDistractor {
  // whyChosen stays claim-free: option sets are not always periodic-table
  // neighbors, so no proximity is asserted anywhere in this copy.
  if (row.direction === "to_value") {
    return {
      text: String(distractor.atomicNumber),
      misconception: "atomic-number mix-up",
      whyChosen: "It is another atomic number from the question's own option set.",
      reveal: `${distractor.atomicNumber} is ${lower(distractor.name)} — ${lower(row.subject.name)} sits at ${row.subject.atomicNumber}.`,
    };
  }
  return {
    text: distractor.name,
    misconception: "atomic-number mix-up",
    whyChosen: "It is another element from the question's own option set.",
    reveal: `${distractor.name} is element ${distractor.atomicNumber} — atomic number ${row.subject.atomicNumber} is ${lower(row.subject.name)}.`,
  };
}

function unitDistractor(row: UnitRevealRow, distractor: SiUnitFact): LearnModeDistractor {
  return {
    text: distractor.symbol,
    misconception: "SI symbol mix-up",
    whyChosen: "It is another SI unit symbol from the same set.",
    reveal: `${distractor.symbol} is the symbol for the ${distractor.name} — the ${row.subject.name} is ${row.subject.symbol}.`,
  };
}

function symbolCorrectReveal(row: ElementRevealRow): string {
  if (row.hook === "contrast") {
    const traps = row.distractors
      .map((distractor) => `${lower(distractor.name)} is ${distractor.symbol}`)
      .join(", ");
    return `${row.subject.symbol} belongs to ${lower(row.subject.name)} — the traps have their own symbols: ${traps}.`;
  }
  return `${row.subject.name} is element ${row.subject.atomicNumber} on the periodic table — symbol ${row.subject.symbol}.`;
}

function numberCorrectReveal(row: ElementRevealRow): string {
  if (row.hook === "contrast") {
    const traps = row.distractors
      .map((distractor) => `${lower(distractor.name)} at ${distractor.atomicNumber}`)
      .join(", ");
    return `${row.subject.name} sits at ${row.subject.atomicNumber} — the traps hold their own slots: ${traps}.`;
  }
  return `${row.subject.name} sits at ${row.subject.atomicNumber} — its symbol is ${row.subject.symbol}.`;
}

function unitCorrectReveal(row: UnitRevealRow): string {
  const classLine =
    row.subject.unitClass === "base"
      ? "an SI base unit"
      : "a special-named SI unit";
  return `The ${row.subject.name} is ${classLine} — symbol ${row.subject.symbol}.`;
}

const questionByChecksum = new Map(
  knowledgeScienceCieScoreBatchV1Questions.map((question) => [
    question.checksum,
    question,
  ]),
);

type BatchRecord = { facts: Record<string, unknown> };
const records = scienceWikidataSourceRecords as Record<string, BatchRecord>;

function validateElementRecord(
  fact: ElementFact,
  property: "P246" | "P1086",
  checksum: string,
  errors: string[],
) {
  const record = records[sourceRef(fact.qid, property)];
  if (!record) {
    errors.push(`${checksum}: no batch ${property} record for ${fact.name}`);
    return;
  }
  const facts = record.facts as { subject?: { name?: string }; value?: unknown };
  if (facts.subject?.name !== fact.name) {
    errors.push(`${checksum}: batch ${property} record name mismatch for ${fact.name}`);
  }
  // Exact representation match — the batch declares atomic numbers as strings,
  // and any drift in its representation should fail loudly, not be coerced.
  const expected = property === "P246" ? fact.symbol : String(fact.atomicNumber);
  if (facts.value !== expected) {
    errors.push(`${checksum}: batch ${property} record value mismatch for ${fact.name}`);
  }
}

function validateUnitRecord(fact: SiUnitFact, checksum: string, errors: string[]) {
  const record = records[sourceRef(fact.qid, "P5061")];
  if (!record) {
    errors.push(`${checksum}: no batch P5061 record for ${fact.name}`);
    return;
  }
  const facts = record.facts as {
    subject?: { name?: string };
    value?: unknown;
    unitClass?: unknown;
  };
  if (facts.subject?.name !== fact.name) {
    errors.push(`${checksum}: batch P5061 record name mismatch for ${fact.name}`);
  }
  if (facts.value !== fact.symbol) {
    errors.push(`${checksum}: batch P5061 record symbol mismatch for ${fact.name}`);
  }
  if (facts.unitClass !== fact.unitClass) {
    errors.push(`${checksum}: batch P5061 record unit-class mismatch for ${fact.name}`);
  }
}

function validateOptions(
  checksum: string,
  correctText: string,
  distractorTexts: string[],
  errors: string[],
) {
  const question = questionByChecksum.get(checksum);
  if (!question) {
    errors.push(`${checksum}: not present in ${SOURCE_BATCH_ID}`);
    return;
  }
  if (question.correctAnswer !== correctText) {
    errors.push(`${checksum}: correct answer mismatch (${correctText} vs ${question.correctAnswer})`);
  }
  const expected = [...question.options].filter((option) => option !== question.correctAnswer).sort();
  const actual = [...distractorTexts].sort();
  if (expected.length !== actual.length || expected.some((option, i) => option !== actual[i])) {
    errors.push(`${checksum}: distractor texts do not match batch options`);
  }
}

function elementRowTexts(row: ElementRevealRow, valueOf: (fact: ElementFact) => string) {
  const correct = row.direction === "to_value" ? valueOf(row.subject) : row.subject.name;
  const distractorTexts = row.distractors.map((distractor) =>
    row.direction === "to_value" ? valueOf(distractor) : distractor.name,
  );
  return { correct, distractorTexts };
}

function elementClaimText(fact: ElementFact, property: "P246" | "P1086"): string {
  return property === "P246"
    ? `chemical_element_symbol(${fact.name}) = ${fact.symbol}`
    : `atomic_number(${fact.name}) = ${fact.atomicNumber}`;
}

function validateElementRow(
  row: ElementRevealRow,
  property: "P246" | "P1086",
  valueOf: (fact: ElementFact) => string,
): string[] {
  const errors: string[] = [];
  const { correct, distractorTexts } = elementRowTexts(row, valueOf);
  validateOptions(row.checksum, correct, distractorTexts, errors);
  validateElementRecord(row.subject, property, row.checksum, errors);
  const other = property === "P246" ? ("P1086" as const) : ("P246" as const);
  // A "cross" hook restates the subject's other property, so that record must
  // exist; a "contrast" hook is only allowed when it genuinely cannot — it is
  // the fallback, not a free choice.
  if (row.hook === "cross") {
    validateElementRecord(row.subject, other, row.checksum, errors);
  } else if (records[sourceRef(row.subject.qid, other)]) {
    errors.push(
      `${row.checksum}: contrast hook is unnecessary — ${row.subject.name} has a batch ${other} record`,
    );
  }
  for (const distractor of row.distractors) {
    validateElementRecord(distractor, property, row.checksum, errors);
  }
  // Bind every declared fact to THIS checksum's own verified claims — a
  // same-value fact about a different element must not pass.
  const question = questionByChecksum.get(row.checksum);
  if (question) {
    const claims = question.provenance.claims.map((entry) => entry.claim);
    for (const fact of [row.subject, ...row.distractors]) {
      if (!claims.includes(elementClaimText(fact, property))) {
        errors.push(
          `${row.checksum}: question claims do not bind ${fact.name} for ${property}`,
        );
      }
    }
  }
  return errors;
}

function validateUnitRow(row: UnitRevealRow): string[] {
  const errors: string[] = [];
  validateOptions(
    row.checksum,
    row.subject.symbol,
    row.distractors.map((distractor) => distractor.symbol),
    errors,
  );
  validateUnitRecord(row.subject, row.checksum, errors);
  for (const distractor of row.distractors) {
    validateUnitRecord(distractor, row.checksum, errors);
  }
  const question = questionByChecksum.get(row.checksum);
  if (question) {
    const claims = question.provenance.claims.map((entry) => entry.claim);
    for (const fact of [row.subject, ...row.distractors]) {
      if (!claims.includes(`si_unit_symbol(${fact.name}) = ${fact.symbol}`)) {
        errors.push(`${row.checksum}: question claims do not bind ${fact.name}`);
      }
    }
  }
  return errors;
}

export type LearnScienceRecallRevealsValidationReport = {
  ok: boolean;
  errors: string[];
  revealCount: number;
};

function buildAll(): {
  byChecksum: Record<string, LearnScienceRecallReveal>;
  report: LearnScienceRecallRevealsValidationReport;
} {
  const byChecksum: Record<string, LearnScienceRecallReveal> = {};
  const errors: string[] = [];

  for (const row of SYMBOL_REVEAL_ROWS) {
    const rowErrors = validateElementRow(row, "P246", (fact) => fact.symbol);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    byChecksum[row.checksum] = {
      skillNodes: [row.node],
      distractors: row.distractors.map((distractor) => symbolDistractor(row, distractor)),
      correctReveal: symbolCorrectReveal(row),
      provenance: provenance(
        [
          symbolClaim(row.subject),
          ...(row.hook === "cross" ? [atomicNumberClaim(row.subject)] : []),
          ...row.distractors.map(symbolClaim),
        ],
        "agree",
      ),
    };
  }

  for (const row of NUMBER_REVEAL_ROWS) {
    const rowErrors = validateElementRow(row, "P1086", (fact) => String(fact.atomicNumber));
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    byChecksum[row.checksum] = {
      skillNodes: [row.node],
      distractors: row.distractors.map((distractor) => numberDistractor(row, distractor)),
      correctReveal: numberCorrectReveal(row),
      provenance: provenance(
        [
          atomicNumberClaim(row.subject),
          ...(row.hook === "cross" ? [symbolClaim(row.subject)] : []),
          ...row.distractors.map(atomicNumberClaim),
        ],
        "agree",
      ),
    };
  }

  for (const row of UNIT_REVEAL_ROWS) {
    const rowErrors = validateUnitRow(row);
    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }
    byChecksum[row.checksum] = {
      skillNodes: [UNITS_NODE],
      distractors: row.distractors.map((distractor) => unitDistractor(row, distractor)),
      correctReveal: unitCorrectReveal(row),
      provenance: provenance(
        [unitClaim(row.subject), ...row.distractors.map(unitClaim)],
        "agree",
      ),
    };
  }

  return {
    byChecksum,
    report: {
      ok: errors.length === 0,
      errors,
      revealCount: Object.keys(byChecksum).length,
    },
  };
}

const built = buildAll();

export const learnScienceRecallRevealsV1ByChecksum = built.byChecksum;

export function validateLearnScienceRecallRevealsV1(): LearnScienceRecallRevealsValidationReport {
  return built.report;
}

export const learnScienceRecallRevealChecksumsByNode: Record<string, string[]> = {
  [SYMBOLS_NODE]: SYMBOL_REVEAL_ROWS.map((row) => row.checksum),
  [NUMBERS_NODE]: NUMBER_REVEAL_ROWS.map((row) => row.checksum),
  [UNITS_NODE]: UNIT_REVEAL_ROWS.map((row) => row.checksum),
};

export const learnScienceRecallRevealsV1Metadata = {
  batchId: BATCH_ID,
  mode: "learn",
  layer: "checksum_reveals",
  workUnitId: WORK_UNIT_ID,
  sourceBatchId: SOURCE_BATCH_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "agree" as Verdict,
};
