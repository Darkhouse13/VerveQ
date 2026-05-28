import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceType = "structured_open";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";

type EntityRef = {
  name: string;
  qid: string;
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

export type KnowledgeGeographyCieScoreBatchV7Question =
  KnowledgeQuestionSeed & {
    provenance: ScoreModeProvenance;
  };

type CapitalFact = {
  kind: "capital";
  difficulty: Difficulty;
  question: string;
  country: EntityRef;
  capital: EntityRef;
  distractors: [EntityRef, EntityRef, EntityRef];
};

type BorderFact = {
  kind: "border";
  difficulty: Difficulty;
  question: string;
  subject: EntityRef;
  neighbor: EntityRef;
  distractors: [EntityRef, EntityRef, EntityRef];
};

type RawFact = CapitalFact | BorderFact;

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "knowledge_geography_cie_score_v7";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v7";
const RETRIEVED_AT = "2026-05-28";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "pending_anthropic_verification";

function entity(name: string, qid: string): EntityRef {
  return { name, qid };
}

function capitalRef(country: EntityRef) {
  return `wikidata:${country.qid}:P36:closed-capital-list:snapshot-${RETRIEVED_AT}`;
}

function borderRef(country: EntityRef) {
  return `wikidata:${country.qid}:P47:closed-border-list:snapshot-${RETRIEVED_AT}`;
}

function claim(text: string, sourceRef: string): ProvenanceClaim {
  return {
    claim: text,
    sourceType: "structured_open",
    sourceRef,
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
  };
}

function bucket(category: string, difficulty: Difficulty) {
  return `knowledge_${difficulty}_${category}`;
}

function checksum(index: number) {
  return `${BATCH_ID}_${String(index + 1).padStart(3, "0")}`;
}

function rotateOptions(
  correctAnswer: string,
  distractors: [EntityRef, EntityRef, EntityRef],
  index: number,
) {
  const options = [correctAnswer, ...distractors.map((entry) => entry.name)];
  const [correct] = options.splice(0, 1);
  options.splice(index % 4, 0, correct);
  return options;
}

function provenance(claims: ProvenanceClaim[]): ScoreModeProvenance {
  return {
    claims,
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict: "pending",
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function capitalClaims(fact: CapitalFact): ProvenanceClaim[] {
  return [
    claim(
      `capital_of(${fact.country.name}) = ${fact.capital.name}`,
      capitalRef(fact.country),
    ),
    ...fact.distractors.map((distractor) =>
      claim(
        `capital_of(${distractor.name}) != ${fact.capital.name}`,
        capitalRef(distractor),
      ),
    ),
  ];
}

function borderClaims(fact: BorderFact): ProvenanceClaim[] {
  const sourceRef = borderRef(fact.subject);
  return [
    claim(
      `shares_border_with(${fact.subject.name}, ${fact.neighbor.name})`,
      sourceRef,
    ),
    ...fact.distractors.map((distractor) =>
      claim(
        `not_shares_border_with(${fact.subject.name}, ${distractor.name})`,
        sourceRef,
      ),
    ),
  ];
}

function c(
  difficulty: Difficulty,
  question: string,
  country: EntityRef,
  capital: EntityRef,
  distractors: [EntityRef, EntityRef, EntityRef],
): CapitalFact {
  return { kind: "capital", difficulty, question, country, capital, distractors };
}

function b(
  difficulty: Difficulty,
  question: string,
  subject: EntityRef,
  neighbor: EntityRef,
  distractors: [EntityRef, EntityRef, EntityRef],
): BorderFact {
  return { kind: "border", difficulty, question, subject, neighbor, distractors };
}

const RAW_FACTS: RawFact[] = [
  c("hard", "Andorra la Vella is the capital city of which country?", entity("Andorra", "Q228"), entity("Andorra la Vella", "Q1863"), [
    entity("San Marino", "Q238"),
    entity("Liechtenstein", "Q347"),
    entity("Monaco", "Q235"),
  ]),
  c("intermediate", "Minsk is the capital of which country?", entity("Belarus", "Q184"), entity("Minsk", "Q2280"), [
    entity("Latvia", "Q211"),
    entity("Lithuania", "Q37"),
    entity("Moldova", "Q217"),
  ]),
  c("hard", "Sarajevo serves as the capital of which country?", entity("Bosnia and Herzegovina", "Q225"), entity("Sarajevo", "Q11194"), [
    entity("North Macedonia", "Q221"),
    entity("Montenegro", "Q236"),
    entity("Croatia", "Q224"),
  ]),
  c("hard", "Gitega is the capital city of which country?", entity("Burundi", "Q967"), entity("Gitega", "Q167551"), [
    entity("Rwanda", "Q1037"),
    entity("Uganda", "Q1036"),
    entity("Tanzania", "Q924"),
  ]),
  c("intermediate", "Yaounde is the capital of which country?", entity("Cameroon", "Q1009"), entity("Yaounde", "Q3808"), [
    entity("Nigeria", "Q1033"),
    entity("Gabon", "Q1000"),
    entity("Chad", "Q657"),
  ]),
  c("easy", "Santiago serves as the capital city of which country?", entity("Chile", "Q298"), entity("Santiago", "Q2887"), [
    entity("Peru", "Q419"),
    entity("Argentina", "Q414"),
    entity("Bolivia", "Q750"),
  ]),
  c("easy", "Bogota is the capital of which country?", entity("Colombia", "Q739"), entity("Bogota", "Q2841"), [
    entity("Ecuador", "Q736"),
    entity("Venezuela", "Q717"),
    entity("Panama", "Q804"),
  ]),
  c("intermediate", "San Jose is the capital city of which country?", entity("Costa Rica", "Q800"), entity("San Jose", "Q3070"), [
    entity("Nicaragua", "Q811"),
    entity("Honduras", "Q783"),
    entity("El Salvador", "Q792"),
  ]),
  c("easy", "Havana is the capital of which island country?", entity("Cuba", "Q241"), entity("Havana", "Q1563"), [
    entity("Jamaica", "Q766"),
    entity("Dominican Republic", "Q786"),
    entity("Haiti", "Q790"),
  ]),
  c("hard", "Kinshasa serves as the capital of which country?", entity("Democratic Republic of the Congo", "Q974"), entity("Kinshasa", "Q3838"), [
    entity("Central African Republic", "Q929"),
    entity("Republic of the Congo", "Q971"),
    entity("South Sudan", "Q958"),
  ]),
  c("intermediate", "Quito is the capital city of which country?", entity("Ecuador", "Q736"), entity("Quito", "Q2900"), [
    entity("Colombia", "Q739"),
    entity("Peru", "Q419"),
    entity("Bolivia", "Q750"),
  ]),
  c("hard", "Asmara is the capital of which country?", entity("Eritrea", "Q986"), entity("Asmara", "Q3642"), [
    entity("Ethiopia", "Q115"),
    entity("Djibouti", "Q977"),
    entity("Somalia", "Q1045"),
  ]),
  c("hard", "Lome is the capital city of which country?", entity("Togo", "Q945"), entity("Lome", "Q3792"), [
    entity("Benin", "Q962"),
    entity("Ghana", "Q117"),
    entity("Burkina Faso", "Q965"),
  ]),
  c("intermediate", "Guatemala City serves as the capital of which country?", entity("Guatemala", "Q774"), entity("Guatemala City", "Q1555"), [
    entity("Honduras", "Q783"),
    entity("Belize", "Q242"),
    entity("El Salvador", "Q792"),
  ]),
  c("intermediate", "Reykjavik is the capital of which country?", entity("Iceland", "Q189"), entity("Reykjavik", "Q1764"), [
    entity("Norway", "Q20"),
    entity("Ireland", "Q27"),
    entity("Denmark", "Q35"),
  ]),
  c("easy", "Jakarta is the capital city of which country?", entity("Indonesia", "Q252"), entity("Jakarta", "Q3630"), [
    entity("Malaysia", "Q833"),
    entity("Philippines", "Q928"),
    entity("Thailand", "Q869"),
  ]),
  c("intermediate", "Vientiane is the capital of which country?", entity("Laos", "Q819"), entity("Vientiane", "Q9326"), [
    entity("Cambodia", "Q424"),
    entity("Myanmar", "Q836"),
    entity("Vietnam", "Q881"),
  ]),
  c("hard", "Vaduz serves as the capital of which country?", entity("Liechtenstein", "Q347"), entity("Vaduz", "Q1844"), [
    entity("Luxembourg", "Q32"),
    entity("Andorra", "Q228"),
    entity("San Marino", "Q238"),
  ]),
  c("easy", "Kuala Lumpur is the capital city of which country?", entity("Malaysia", "Q833"), entity("Kuala Lumpur", "Q1865"), [
    entity("Indonesia", "Q252"),
    entity("Singapore", "Q334"),
    entity("Brunei", "Q921"),
  ]),
  c("intermediate", "Asuncion is the capital of which country?", entity("Paraguay", "Q733"), entity("Asuncion", "Q2933"), [
    entity("Uruguay", "Q77"),
    entity("Bolivia", "Q750"),
    entity("Peru", "Q419"),
  ]),
  c("hard", "Chisinau is the capital city of which country?", entity("Moldova", "Q217"), entity("Chisinau", "Q21197"), [
    entity("Romania", "Q218"),
    entity("Ukraine", "Q212"),
    entity("Belarus", "Q184"),
  ]),
  c("hard", "Podgorica is the capital of which country?", entity("Montenegro", "Q236"), entity("Podgorica", "Q23564"), [
    entity("Serbia", "Q403"),
    entity("Albania", "Q222"),
    entity("North Macedonia", "Q221"),
  ]),
  c("hard", "Naypyidaw serves as the capital of which country?", entity("Myanmar", "Q836"), entity("Naypyidaw", "Q37400"), [
    entity("Thailand", "Q869"),
    entity("Laos", "Q819"),
    entity("Cambodia", "Q424"),
  ]),
  c("easy", "Wellington is the capital city of which country?", entity("New Zealand", "Q664"), entity("Wellington", "Q23661"), [
    entity("Australia", "Q408"),
    entity("Fiji", "Q712"),
    entity("Samoa", "Q683"),
  ]),
  c("intermediate", "Skopje is the capital of which country?", entity("North Macedonia", "Q221"), entity("Skopje", "Q384"), [
    entity("Albania", "Q222"),
    entity("Bulgaria", "Q219"),
    entity("Greece", "Q41"),
  ]),
  b("intermediate", "Andorra shares a border with which country?", entity("Andorra", "Q228"), entity("France", "Q142"), [
    entity("Portugal", "Q45"),
    entity("Italy", "Q38"),
    entity("Belgium", "Q31"),
  ]),
  b("hard", "Belarus has a border with which listed country?", entity("Belarus", "Q184"), entity("Latvia", "Q211"), [
    entity("Romania", "Q218"),
    entity("Bulgaria", "Q219"),
    entity("Hungary", "Q28"),
  ]),
  b("hard", "Bosnia and Herzegovina borders which listed country?", entity("Bosnia and Herzegovina", "Q225"), entity("Montenegro", "Q236"), [
    entity("Slovenia", "Q215"),
    entity("North Macedonia", "Q221"),
    entity("Bulgaria", "Q219"),
  ]),
  b("hard", "Burundi shares a border with which country?", entity("Burundi", "Q967"), entity("Tanzania", "Q924"), [
    entity("Kenya", "Q114"),
    entity("Uganda", "Q1036"),
    entity("Ethiopia", "Q115"),
  ]),
  b("intermediate", "Cameroon has a border with which country?", entity("Cameroon", "Q1009"), entity("Nigeria", "Q1033"), [
    entity("Ghana", "Q117"),
    entity("Kenya", "Q114"),
    entity("Senegal", "Q1041"),
  ]),
  b("intermediate", "Chile shares a border with which listed country?", entity("Chile", "Q298"), entity("Peru", "Q419"), [
    entity("Ecuador", "Q736"),
    entity("Paraguay", "Q733"),
    entity("Uruguay", "Q77"),
  ]),
  b("intermediate", "Colombia has a border with which country?", entity("Colombia", "Q739"), entity("Peru", "Q419"), [
    entity("Bolivia", "Q750"),
    entity("Chile", "Q298"),
    entity("Uruguay", "Q77"),
  ]),
  b("hard", "Which listed country borders the Democratic Republic of the Congo?", entity("Democratic Republic of the Congo", "Q974"), entity("Rwanda", "Q1037"), [
    entity("Kenya", "Q114"),
    entity("Ghana", "Q117"),
    entity("Senegal", "Q1041"),
  ]),
  b("hard", "Djibouti shares a border with which country?", entity("Djibouti", "Q977"), entity("Somalia", "Q1045"), [
    entity("Kenya", "Q114"),
    entity("Sudan", "Q1049"),
    entity("Uganda", "Q1036"),
  ]),
  b("hard", "Eritrea has a border with which listed country?", entity("Eritrea", "Q986"), entity("Ethiopia", "Q115"), [
    entity("Somalia", "Q1045"),
    entity("Kenya", "Q114"),
    entity("Uganda", "Q1036"),
  ]),
  b("hard", "The Gambia shares its only land border with which country?", entity("The Gambia", "Q1005"), entity("Senegal", "Q1041"), [
    entity("Guinea-Bissau", "Q1007"),
    entity("Guinea", "Q1006"),
    entity("Sierra Leone", "Q1044"),
  ]),
  b("intermediate", "Guatemala borders which listed country?", entity("Guatemala", "Q774"), entity("Honduras", "Q783"), [
    entity("Costa Rica", "Q800"),
    entity("Panama", "Q804"),
    entity("Nicaragua", "Q811"),
  ]),
  b("hard", "Luxembourg has a border with which country?", entity("Luxembourg", "Q32"), entity("Belgium", "Q31"), [
    entity("Netherlands", "Q55"),
    entity("Denmark", "Q35"),
    entity("Croatia", "Q224"),
  ]),
  b("intermediate", "Myanmar shares a border with which listed country?", entity("Myanmar", "Q836"), entity("China", "Q148"), [
    entity("Vietnam", "Q881"),
    entity("Cambodia", "Q424"),
    entity("Malaysia", "Q833"),
  ]),
  b("intermediate", "North Macedonia borders which listed country?", entity("North Macedonia", "Q221"), entity("Greece", "Q41"), [
    entity("Romania", "Q218"),
    entity("Croatia", "Q224"),
    entity("Slovenia", "Q215"),
  ]),
  b("intermediate", "Paraguay has a border with which country?", entity("Paraguay", "Q733"), entity("Argentina", "Q414"), [
    entity("Chile", "Q298"),
    entity("Uruguay", "Q77"),
    entity("Ecuador", "Q736"),
  ]),
  b("hard", "San Marino is bordered by which country?", entity("San Marino", "Q238"), entity("Italy", "Q38"), [
    entity("France", "Q142"),
    entity("Austria", "Q40"),
    entity("Switzerland", "Q39"),
  ]),
  b("hard", "Togo shares a border with which listed country?", entity("Togo", "Q945"), entity("Benin", "Q962"), [
    entity("Niger", "Q1032"),
    entity("Nigeria", "Q1033"),
    entity("Senegal", "Q1041"),
  ]),
  b("hard", "Uganda has a border with which country?", entity("Uganda", "Q1036"), entity("Rwanda", "Q1037"), [
    entity("Ethiopia", "Q115"),
    entity("Somalia", "Q1045"),
    entity("Ghana", "Q117"),
  ]),
  b("hard", "Kazakhstan shares a border with which listed country?", entity("Kazakhstan", "Q232"), entity("China", "Q148"), [
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
    entity("Mongolia", "Q711"),
  ]),
  b("intermediate", "Finland has a border with which country?", entity("Finland", "Q33"), entity("Russia", "Q159"), [
    entity("Estonia", "Q191"),
    entity("Poland", "Q36"),
    entity("Iceland", "Q189"),
  ]),
  b("hard", "North Korea shares a border with which country?", entity("North Korea", "Q423"), entity("China", "Q148"), [
    entity("Mongolia", "Q711"),
    entity("Vietnam", "Q881"),
    entity("Thailand", "Q869"),
  ]),
  b("intermediate", "Czechia shares a border with which country?", entity("Czechia", "Q213"), entity("Poland", "Q36"), [
    entity("Slovenia", "Q215"),
    entity("Croatia", "Q224"),
    entity("Lithuania", "Q37"),
  ]),
  b("intermediate", "Croatia has a border with which listed country?", entity("Croatia", "Q224"), entity("Slovenia", "Q215"), [
    entity("Belgium", "Q31"),
    entity("Netherlands", "Q55"),
    entity("Luxembourg", "Q32"),
  ]),
  b("intermediate", "Bulgaria has a border with which listed country?", entity("Bulgaria", "Q219"), entity("Greece", "Q41"), [
    entity("Croatia", "Q224"),
    entity("Slovenia", "Q215"),
    entity("Lithuania", "Q37"),
  ]),
];

function buildQuestion(
  fact: RawFact,
  index: number,
): KnowledgeGeographyCieScoreBatchV7Question {
  const isCapital = fact.kind === "capital";
  const category = isCapital ? "capital_cities" : "country_facts";
  const correctAnswer = isCapital ? fact.country.name : fact.neighbor.name;
  const explanation = isCapital
    ? `${fact.capital.name} is the capital of ${fact.country.name}.`
    : `${fact.neighbor.name} shares a border with ${fact.subject.name}.`;

  return {
    sport: "knowledge",
    category,
    question: fact.question,
    options: rotateOptions(correctAnswer, fact.distractors, index),
    correctAnswer,
    explanation,
    difficulty: fact.difficulty,
    bucket: bucket(category, fact.difficulty),
    checksum: checksum(index),
    provenance: provenance(isCapital ? capitalClaims(fact) : borderClaims(fact)),
  };
}

function makeCapitalSourceRecord(
  subject: EntityRef,
  includedCapital?: EntityRef,
  excludedCapital?: EntityRef,
): WikidataSourceRecord {
  return {
    sourceRef: capitalRef(subject),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject,
      property: "P36",
      includedCapitals: includedCapital ? [includedCapital] : [],
      excludedCapitals: excludedCapital ? [excludedCapital] : [],
      closedCapitalList: true,
    },
  };
}

function mergeEntityRef(values: EntityRef[], next: EntityRef) {
  if (!values.some((value) => value.qid === next.qid)) {
    values.push(next);
  }
}

function upsertCapitalSourceRecord(
  records: Map<string, WikidataSourceRecord>,
  subject: EntityRef,
  includedCapital?: EntityRef,
  excludedCapital?: EntityRef,
) {
  const sourceRef = capitalRef(subject);
  const existing = records.get(sourceRef);
  if (!existing) {
    records.set(sourceRef, makeCapitalSourceRecord(subject, includedCapital, excludedCapital));
    return;
  }

  const facts = existing.facts as {
    includedCapitals: EntityRef[];
    excludedCapitals: EntityRef[];
  };
  if (includedCapital) mergeEntityRef(facts.includedCapitals, includedCapital);
  if (excludedCapital) mergeEntityRef(facts.excludedCapitals, excludedCapital);
}

function makeBorderSourceRecord(fact: BorderFact): WikidataSourceRecord {
  return {
    sourceRef: borderRef(fact.subject),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: fact.subject,
      property: "P47",
      includedBorder: fact.neighbor,
      excludedBorders: fact.distractors,
      closedBorderList: true,
    },
  };
}

function buildWikidataSourceRecords(facts: RawFact[]) {
  const records = new Map<string, WikidataSourceRecord>();
  for (const fact of facts) {
    if (fact.kind === "capital") {
      upsertCapitalSourceRecord(records, fact.country, fact.capital);
      for (const distractor of fact.distractors) {
        upsertCapitalSourceRecord(records, distractor, undefined, fact.capital);
      }
      continue;
    }
    records.set(borderRef(fact.subject), makeBorderSourceRecord(fact));
  }
  return Object.fromEntries([...records.entries()].sort(([a], [b]) => a.localeCompare(b)));
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

export const knowledgeGeographyCieScoreBatchV7Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV7Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV7Metadata = {
  batchId: BATCH_ID,
  mode: "score",
  workUnitId: WORK_UNIT_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "pending",
  questionCount: knowledgeGeographyCieScoreBatchV7Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV7Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV7Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV7Questions;
