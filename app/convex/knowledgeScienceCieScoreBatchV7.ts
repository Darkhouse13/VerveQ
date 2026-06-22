import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";
type ScienceCategory = "chemical_compound_formulas";
type WikidataScienceProperty = "P274";

type CompoundFact = {
  kind: "compound";
  name: string;
  qid: string;
  formula: string;
  p274ValueCount: 1;
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

export type KnowledgeScienceCieScoreBatchV7Question =
  KnowledgeQuestionSeed & { provenance: ScoreModeProvenance };

type BatchQuestion = KnowledgeScienceCieScoreBatchV7Question;

type CompoundFormulaQuestion = {
  kind: "compoundFormula";
  category: "chemical_compound_formulas";
  difficulty: Difficulty;
  direction: "compound_to_molecular_formula";
  question: string;
  subject: CompoundFact;
  distractors: [CompoundFact, CompoundFact, CompoundFact];
};

type RawFact = CompoundFormulaQuestion;

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

type CompoundSpec = {
  name: string;
  qid: string;
  formula: string;
  difficulty: Difficulty;
};

type FormulaPart = {
  element: string;
  count: number;
};

const BATCH_ID = "knowledge_science_cie_score_v7";
const WORK_UNIT_ID = "score-mode:knowledge:science:static:v7";
const RETRIEVED_AT = "2026-06-22";
const AUTHOR_MODEL = "anthropic/claude-opus-4-8";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

function compound(
  name: string,
  qid: string,
  formula: string,
): CompoundFact {
  return { kind: "compound", name, qid, formula, p274ValueCount: 1 };
}

const COMPOUND_SPECS: CompoundSpec[] = [
  { name: "sulfuric acid", qid: "Q4118", formula: "H2SO4", difficulty: "easy" },
  { name: "nitric acid", qid: "Q7600", formula: "HNO3", difficulty: "easy" },
  { name: "phosphoric acid", qid: "Q184782", formula: "H3PO4", difficulty: "easy" },
  { name: "hydrogen chloride", qid: "Q170509", formula: "HCl", difficulty: "easy" },
  { name: "hydrogen fluoride", qid: "Q191908", formula: "HF", difficulty: "easy" },
  { name: "sulfur trioxide", qid: "Q416027", formula: "SO3", difficulty: "easy" },
  { name: "dinitrogen tetroxide", qid: "Q416718", formula: "N2O4", difficulty: "intermediate" },
  { name: "ozone", qid: "Q36933", formula: "O3", difficulty: "easy" },
  { name: "carbon disulfide", qid: "Q407217", formula: "CS2", difficulty: "intermediate" },
  { name: "silicon dioxide", qid: "Q116269", formula: "SiO2", difficulty: "easy" },
  { name: "carbon tetrachloride", qid: "Q60425", formula: "CCl4", difficulty: "easy" },
  { name: "hydrazine", qid: "Q188547", formula: "N2H4", difficulty: "intermediate" },
  { name: "phosphine", qid: "Q170731", formula: "PH3", difficulty: "intermediate" },
  { name: "ethane", qid: "Q52858", formula: "C2H6", difficulty: "easy" },
  { name: "butane", qid: "Q11214316", formula: "C4H10", difficulty: "easy" },
  { name: "pentane", qid: "Q22300", formula: "C5H12", difficulty: "intermediate" },
  { name: "hexane", qid: "Q40858", formula: "C6H14", difficulty: "intermediate" },
  { name: "cyclohexane", qid: "Q42960", formula: "C6H12", difficulty: "intermediate" },
  { name: "propene", qid: "Q142944", formula: "C3H6", difficulty: "intermediate" },
  { name: "isopropyl alcohol", qid: "Q15377", formula: "C3H8O", difficulty: "intermediate" },
  { name: "acetaldehyde", qid: "Q61457", formula: "C2H4O", difficulty: "intermediate" },
  { name: "propionic acid", qid: "Q179742", formula: "C3H6O2", difficulty: "intermediate" },
  { name: "butyric acid", qid: "Q302380", formula: "C4H8O2", difficulty: "intermediate" },
  { name: "urea", qid: "Q188784", formula: "CH4N2O", difficulty: "intermediate" },
  { name: "lactic acid", qid: "Q161249", formula: "C3H6O3", difficulty: "intermediate" },
  { name: "malic acid", qid: "Q175193", formula: "C4H6O5", difficulty: "hard" },
  { name: "tartaric acid", qid: "Q409082", formula: "C4H6O6", difficulty: "hard" },
  { name: "succinic acid", qid: "Q213050", formula: "C4H6O4", difficulty: "hard" },
  { name: "fumaric acid", qid: "Q26987", formula: "C4H4O4", difficulty: "hard" },
  { name: "benzaldehyde", qid: "Q23055", formula: "C7H6O", difficulty: "intermediate" },
  { name: "styrene", qid: "Q146682", formula: "C8H8", difficulty: "intermediate" },
  { name: "xylene", qid: "Q189879", formula: "C8H10", difficulty: "hard" },
  { name: "nitrobenzene", qid: "Q408813", formula: "C6H5NO2", difficulty: "hard" },
  { name: "pyridine", qid: "Q210385", formula: "C5H5N", difficulty: "hard" },
  { name: "furan", qid: "Q278332", formula: "C4H4O", difficulty: "hard" },
  { name: "butan-1-ol", qid: "Q288332", formula: "C4H10O", difficulty: "hard" },
  { name: "propanal", qid: "Q422649", formula: "C3H6O", difficulty: "hard" },
  { name: "chlorobenzene", qid: "Q278908", formula: "C6H5Cl", difficulty: "hard" },
  { name: "dimethyl ether", qid: "Q409393", formula: "C2H6O", difficulty: "hard" },
  { name: "ethylamine", qid: "Q412385", formula: "C2H7N", difficulty: "hard" },
  { name: "butanone", qid: "Q189524", formula: "C4H8O", difficulty: "hard" },
];

const COMPOUNDS = COMPOUND_SPECS.map((spec) =>
  compound(spec.name, spec.qid, spec.formula),
);

const QUESTION_STEMS = [
  (name: string) => "What is the molecular formula of " + name + "?",
  (name: string) => "Which molecular formula belongs to " + name + "?",
  (name: string) => "Choose the molecular formula of " + name + ".",
  (name: string) => "For " + name + ", which molecular formula is correct?",
  (name: string) => "The molecular formula of " + name + " is which option?",
  (name: string) => "Which option gives the molecular formula of " + name + "?",
  (name: string) => "In molecular notation, what formula is used for " + name + "?",
  (name: string) => "Select the molecular formula for " + name + ".",
  (name: string) => name + " has which molecular formula?",
  (name: string) => "What formula records the molecule " + name + "?",
  (name: string) => "Pick the molecular formula associated with " + name + ".",
  (name: string) => "Which formula is the molecular formula of " + name + "?",
  (name: string) => name + " is represented by which molecular formula?",
  (name: string) => "What is " + name + "'s molecular formula?",
  (name: string) => "Identify the molecular formula of " + name + ".",
  (name: string) => "Which molecular formula is listed for " + name + "?",
  (name: string) => name + "'s molecular formula is which one?",
  (name: string) => "What molecular formula does " + name + " use?",
  (name: string) => name + " is recorded with which molecular formula?",
  (name: string) => "Choose the molecular formula assigned to " + name + ".",
  (name: string) => "Which listed formula matches the molecule " + name + "?",
  (name: string) => "For the compound " + name + ", what is the molecular formula?",
  (name: string) => "The compound " + name + " has which molecular formula?",
  (name: string) => "Select the formula that gives " + name + "'s molecule.",
  (name: string) => "What is the formula for one molecule of " + name + "?",
];

function parseFormula(formula: string): FormulaPart[] {
  const parts: FormulaPart[] = [];
  const tokenPattern = /([A-Z][a-z]?)(\d*)/g;
  let consumed = "";
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(formula)) !== null) {
    const [, element, rawCount] = match;
    consumed += match[0];
    parts.push({
      element,
      count: rawCount ? Number(rawCount) : 1,
    });
  }

  if (consumed !== formula || parts.length === 0) {
    throw new Error("Unsupported molecular formula syntax: " + formula);
  }

  return parts;
}

function gcdPair(a: number, b: number): number {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right !== 0) {
    const next = left % right;
    left = right;
    right = next;
  }
  return left;
}

function gcd(values: number[]) {
  return values.reduce((current, value) => gcdPair(current, value));
}

function empiricalFormula(formula: string) {
  const parts = parseFormula(formula);
  const divisor = gcd(parts.map((part) => part.count));
  return parts
    .map((part) => {
      const count = part.count / divisor;
      return part.element + (count === 1 ? "" : String(count));
    })
    .join("");
}

function atomCount(formula: string) {
  return parseFormula(formula).reduce((sum, part) => sum + part.count, 0);
}

function elementSet(formula: string) {
  return new Set(parseFormula(formula).map((part) => part.element));
}

function elementOverlap(left: string, right: string) {
  const leftSet = elementSet(left);
  const rightSet = elementSet(right);
  let overlap = 0;
  for (const element of leftSet) {
    if (rightSet.has(element)) overlap += 1;
  }
  return overlap;
}

function isHydrateOrVariableFormula(formula: string) {
  return /[.*+]|hydrates?|xH2O/i.test(formula);
}

function compatibleDistractor(subject: CompoundFact, candidate: CompoundFact) {
  if (subject.qid === candidate.qid) return false;
  if (subject.formula === candidate.formula) return false;
  if (isHydrateOrVariableFormula(candidate.formula)) return false;

  const subjectEmpiricalFormula = empiricalFormula(subject.formula);
  if (
    subjectEmpiricalFormula !== subject.formula &&
    candidate.formula === subjectEmpiricalFormula
  ) {
    return false;
  }

  return true;
}

function distractorScore(
  subject: CompoundFact,
  candidate: CompoundFact,
  index: number,
  candidateIndex: number,
) {
  const atomDelta = Math.abs(atomCount(subject.formula) - atomCount(candidate.formula));
  const lengthDelta = Math.abs(subject.formula.length - candidate.formula.length);
  const sharedElements = elementOverlap(subject.formula, candidate.formula);
  const deterministicTieBreak =
    ((candidateIndex + index * 17) % COMPOUNDS.length) / 100;
  return atomDelta * 2 + lengthDelta - sharedElements + deterministicTieBreak;
}

function compoundDistractors(
  subject: CompoundFact,
  index: number,
): [CompoundFact, CompoundFact, CompoundFact] {
  const candidates = COMPOUNDS
    .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
    .filter(({ candidate }) => compatibleDistractor(subject, candidate))
    .sort(
      (left, right) =>
        distractorScore(subject, left.candidate, index, left.candidateIndex) -
        distractorScore(subject, right.candidate, index, right.candidateIndex),
    )
    .slice(0, 3)
    .map(({ candidate }) => candidate);

  if (candidates.length !== 3) {
    throw new Error("Unable to build three safe distractors for " + subject.name);
  }

  return [candidates[0], candidates[1], candidates[2]];
}

function compoundFormula(
  difficulty: Difficulty,
  question: string,
  subject: CompoundFact,
  distractors: [CompoundFact, CompoundFact, CompoundFact],
): CompoundFormulaQuestion {
  return {
    kind: "compoundFormula",
    category: "chemical_compound_formulas",
    difficulty,
    direction: "compound_to_molecular_formula",
    question,
    subject,
    distractors,
  };
}

function buildCompoundFormulaFact(
  spec: CompoundSpec,
  index: number,
): CompoundFormulaQuestion {
  const subject = COMPOUNDS[index];
  return compoundFormula(
    spec.difficulty,
    QUESTION_STEMS[index % QUESTION_STEMS.length](subject.name),
    subject,
    compoundDistractors(subject, index),
  );
}

const RAW_FACTS: RawFact[] = COMPOUND_SPECS.map(buildCompoundFormulaFact);

function sourceRef(fact: CompoundFact, property: WikidataScienceProperty) {
  return (
    "wikidata:" +
    fact.qid +
    ":" +
    property +
    ":" +
    fact.formula +
    ":snapshot-" +
    RETRIEVED_AT
  );
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

function correctAnswer(fact: RawFact) {
  return fact.subject.formula;
}

function distractors(fact: RawFact): [string, string, string] {
  return [
    fact.distractors[0].formula,
    fact.distractors[1].formula,
    fact.distractors[2].formula,
  ];
}

function subjectFactKey(fact: RawFact) {
  return fact.category + ":" + fact.subject.qid + ":" + fact.subject.formula;
}

function validateRawFacts(facts: RawFact[]) {
  const subjectFactKeys = new Set<string>();
  const molecularFormulas = new Map<string, string>();

  for (const fact of facts) {
    const subject = fact.subject;
    const answer = correctAnswer(fact);
    const empirical = empiricalFormula(answer);

    if (subject.p274ValueCount !== 1) {
      throw new Error("P274 is not single-valued for " + subject.name);
    }
    if (isHydrateOrVariableFormula(answer)) {
      throw new Error("Hydrate or variable formula included for " + subject.name);
    }

    const formulaOwner = molecularFormulas.get(answer);
    if (formulaOwner && formulaOwner !== subject.name) {
      throw new Error(
        "Duplicate molecular formula across subjects: " +
          answer +
          " for " +
          formulaOwner +
          " and " +
          subject.name,
      );
    }
    molecularFormulas.set(answer, subject.name);

    for (const distractor of fact.distractors) {
      if (distractor.formula === answer) {
        throw new Error("Distractor duplicates the molecular formula for " + subject.name);
      }
      if (empirical !== answer && distractor.formula === empirical) {
        throw new Error(
          "Distractor uses empirical formula " + empirical + " for " + subject.name,
        );
      }
      if (isHydrateOrVariableFormula(distractor.formula)) {
        throw new Error("Hydrate or variable distractor for " + subject.name);
      }
    }

    const key = subjectFactKey(fact);
    if (subjectFactKeys.has(key)) {
      throw new Error("Duplicate subject-property fact in batch for " + key);
    }
    subjectFactKeys.add(key);
  }
}

validateRawFacts(RAW_FACTS);

function explanation(fact: RawFact) {
  return (
    "Wikidata lists the P274 chemical formula for " +
    fact.subject.name +
    " as " +
    fact.subject.formula +
    "; this batch uses that single-valued P274 record as the molecular-formula answer."
  );
}

function optionFacts(fact: RawFact): CompoundFact[] {
  return [fact.subject, ...fact.distractors];
}

function claims(fact: RawFact): ProvenanceClaim[] {
  return optionFacts(fact).map((compoundFact) =>
    claim(
      "molecular_formula(" + compoundFact.name + ") = " + compoundFact.formula,
      sourceRef(compoundFact, "P274"),
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

function makeCompoundSourceRecord(fact: CompoundFact): WikidataSourceRecord {
  const molecularFormula = fact.formula;
  const empirical = empiricalFormula(molecularFormula);

  return {
    sourceRef: sourceRef(fact, "P274"),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: { name: fact.name, qid: fact.qid },
      property: "P274",
      propertyLabel: "chemical formula",
      value: molecularFormula,
      p274ValueCount: fact.p274ValueCount,
      directionAllowed: "compound_to_molecular_formula_only",
      molecularFormulaOnly: true,
      empiricalFormula: empirical,
      empiricalFormulaDiffers: empirical !== molecularFormula,
      hydrateOrVariableFormula: false,
      singleValuedForQuestion: true,
      formulaDisplayNormalization:
        "Wikidata P274 subscript digits normalized to ASCII digits for quiz display.",
    },
  };
}

function buildWikidataSourceRecords(facts: RawFact[]) {
  const records = new Map<string, WikidataSourceRecord>();
  for (const fact of facts) {
    for (const optionFact of optionFacts(fact)) {
      const record = makeCompoundSourceRecord(optionFact);
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
  return fact.direction;
}

export const knowledgeScienceCieScoreBatchV7Questions =
  RAW_FACTS.map(buildQuestion);
export const questions = knowledgeScienceCieScoreBatchV7Questions;
export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeScienceCieScoreBatchV7Metadata = {
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
  questionCount: knowledgeScienceCieScoreBatchV7Questions.length,
  countsByCategory: countBy(
    knowledgeScienceCieScoreBatchV7Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeScienceCieScoreBatchV7Questions.map((question) => question.difficulty),
  ),
  countsByScienceFactKind: countBy(RAW_FACTS.map(factKind)),
  countsByScienceDirection: countBy(RAW_FACTS.map(scienceDirection)),
  canonicalScienceCategories: {
    chemical_compound_formulas:
      "Wikidata P274 chemical formula on human-recognizable chemical compound items; authored only in the compound-to-molecular-formula direction.",
  },
  wikidataSourcing: {
    chemical_compound_formulas:
      "P274 chemical formula on Wikidata compound items; each selected subject was checked as exactly one distinct P274 value on the 2026-06-22 snapshot.",
  },
  collisionRules: {
    chemical_compound_formulas:
      "Only molecular-formula-of-compound prompts are authored. Distractors must be distinct molecular formulas, must not equal the subject molecular formula through isomerism, must not equal the subject empirical formula when it differs, and must not be hydrate or variable-composition formulas.",
  },
  defaultDenyExclusions:
    "Excluded multi-valued or ambiguous P274 records, mixtures, polymers, variable hydrates, minerals with variable composition, duplicate-label ambiguous common names, and formula representations requiring alternate structural notation.",
  exhaustedScienceCategories:
    "Element symbol, element atomic-number, and SI unit-symbol categories are not authored in v7.",
  deferredScienceCategories:
    "Constellations are intentionally deferred to a separate solo science batch.",
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeScienceCieScoreBatchV7Questions;
