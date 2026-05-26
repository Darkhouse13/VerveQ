import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceType = "structured_open";
type Volatility = "static";

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
  verdict: "pending" | "agree" | "disagree" | "flag";
  batchId: string;
  workUnitId: string;
};

export type KnowledgeGeographyCieScoreBatchV3Question = KnowledgeQuestionSeed & {
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

const BATCH_ID = "knowledge_geography_cie_score_v3";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v3";
const RETRIEVED_AT = "2026-05-26";
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
  c("intermediate", "Tirana is the capital city of which country?", entity("Albania", "Q222"), entity("Tirana", "Q19689"), [
    entity("Slovenia", "Q215"),
    entity("Montenegro", "Q236"),
    entity("North Macedonia", "Q221"),
  ]),
  c("intermediate", "Which country uses Ljubljana as its capital city?", entity("Slovenia", "Q215"), entity("Ljubljana", "Q437"), [
    entity("Croatia", "Q224"),
    entity("Slovakia", "Q214"),
    entity("Austria", "Q40"),
  ]),
  c("easy", "Bratislava serves as the capital of which country?", entity("Slovakia", "Q214"), entity("Bratislava", "Q1780"), [
    entity("Slovenia", "Q215"),
    entity("Hungary", "Q28"),
    entity("Croatia", "Q224"),
  ]),
  c("easy", "The capital city Vilnius belongs to which country?", entity("Lithuania", "Q37"), entity("Vilnius", "Q216"), [
    entity("Latvia", "Q211"),
    entity("Estonia", "Q191"),
    entity("Belarus", "Q184"),
  ]),
  c("easy", "Riga is the capital of which country?", entity("Latvia", "Q211"), entity("Riga", "Q1773"), [
    entity("Lithuania", "Q37"),
    entity("Estonia", "Q191"),
    entity("Poland", "Q36"),
  ]),
  c("easy", "Which country has Tallinn as its capital?", entity("Estonia", "Q191"), entity("Tallinn", "Q1770"), [
    entity("Latvia", "Q211"),
    entity("Finland", "Q33"),
    entity("Lithuania", "Q37"),
  ]),
  c("intermediate", "Valletta is the capital city of which country?", entity("Malta", "Q233"), entity("Valletta", "Q23800"), [
    entity("Cyprus", "Q229"),
    entity("Luxembourg", "Q32"),
    entity("Slovenia", "Q215"),
  ]),
  c("intermediate", "Which country has Nicosia as its capital city?", entity("Cyprus", "Q229"), entity("Nicosia", "Q3856"), [
    entity("Malta", "Q233"),
    entity("Greece", "Q41"),
    entity("Lebanon", "Q822"),
  ]),
  c("intermediate", "Yerevan is the capital of which country?", entity("Armenia", "Q399"), entity("Yerevan", "Q1953"), [
    entity("Georgia", "Q230"),
    entity("Azerbaijan", "Q227"),
    entity("Turkey", "Q43"),
  ]),
  c("intermediate", "Baku serves as the capital city of which country?", entity("Azerbaijan", "Q227"), entity("Baku", "Q9248"), [
    entity("Armenia", "Q399"),
    entity("Georgia", "Q230"),
    entity("Kazakhstan", "Q232"),
  ]),
  c("intermediate", "Tbilisi is the capital city of which country?", entity("Georgia", "Q230"), entity("Tbilisi", "Q994"), [
    entity("Armenia", "Q399"),
    entity("Azerbaijan", "Q227"),
    entity("Bulgaria", "Q219"),
  ]),
  c("easy", "Which country has Baghdad as its capital?", entity("Iraq", "Q796"), entity("Baghdad", "Q1530"), [
    entity("Syria", "Q858"),
    entity("Jordan", "Q810"),
    entity("Kuwait", "Q817"),
  ]),
  c("easy", "Amman is the capital of which country?", entity("Jordan", "Q810"), entity("Amman", "Q3805"), [
    entity("Lebanon", "Q822"),
    entity("Syria", "Q858"),
    entity("Iraq", "Q796"),
  ]),
  c("intermediate", "Which country uses Beirut as its capital city?", entity("Lebanon", "Q822"), entity("Beirut", "Q3820"), [
    entity("Jordan", "Q810"),
    entity("Syria", "Q858"),
    entity("Cyprus", "Q229"),
  ]),
  c("intermediate", "Muscat serves as the capital of which country?", entity("Oman", "Q842"), entity("Muscat", "Q3826"), [
    entity("Qatar", "Q846"),
    entity("United Arab Emirates", "Q878"),
    entity("Yemen", "Q805"),
  ]),
  c("easy", "Doha is the capital city of which country?", entity("Qatar", "Q846"), entity("Doha", "Q3861"), [
    entity("Oman", "Q842"),
    entity("Bahrain", "Q398"),
    entity("Kuwait", "Q817"),
  ]),
  c("easy", "Which country has Abu Dhabi as its capital?", entity("United Arab Emirates", "Q878"), entity("Abu Dhabi", "Q1519"), [
    entity("Qatar", "Q846"),
    entity("Oman", "Q842"),
    entity("Saudi Arabia", "Q851"),
  ]),
  c("easy", "Kuwait City is the capital of which country?", entity("Kuwait", "Q817"), entity("Kuwait City", "Q35178"), [
    entity("Qatar", "Q846"),
    entity("Bahrain", "Q398"),
    entity("United Arab Emirates", "Q878"),
  ]),
  c("hard", "Thimphu serves as the capital of which country?", entity("Bhutan", "Q917"), entity("Thimphu", "Q9270"), [
    entity("Nepal", "Q837"),
    entity("Sri Lanka", "Q854"),
    entity("Maldives", "Q826"),
  ]),
  c("intermediate", "Phnom Penh is the capital city of which country?", entity("Cambodia", "Q424"), entity("Phnom Penh", "Q1850"), [
    entity("Laos", "Q819"),
    entity("Myanmar", "Q836"),
    entity("Malaysia", "Q833"),
  ]),
  c("hard", "Which country has Ulaanbaatar as its capital city?", entity("Mongolia", "Q711"), entity("Ulaanbaatar", "Q23430"), [
    entity("Kazakhstan", "Q232"),
    entity("Uzbekistan", "Q265"),
    entity("Kyrgyzstan", "Q813"),
  ]),
  c("intermediate", "Tashkent is the capital of which country?", entity("Uzbekistan", "Q265"), entity("Tashkent", "Q269"), [
    entity("Tajikistan", "Q863"),
    entity("Kyrgyzstan", "Q813"),
    entity("Turkmenistan", "Q874"),
  ]),
  c("intermediate", "Addis Ababa serves as the capital city of which country?", entity("Ethiopia", "Q115"), entity("Addis Ababa", "Q3624"), [
    entity("Kenya", "Q114"),
    entity("Uganda", "Q1036"),
    entity("Tanzania", "Q924"),
  ]),
  c("easy", "Accra is the capital city of which country?", entity("Ghana", "Q117"), entity("Accra", "Q3761"), [
    entity("Senegal", "Q1041"),
    entity("Togo", "Q945"),
    entity("Benin", "Q962"),
  ]),
  c("intermediate", "Which country has Dodoma as its capital?", entity("Tanzania", "Q924"), entity("Dodoma", "Q3866"), [
    entity("Uganda", "Q1036"),
    entity("Rwanda", "Q1037"),
    entity("Kenya", "Q114"),
  ]),
  b("intermediate", "Which country shares a border with Albania?", entity("Albania", "Q222"), entity("Montenegro", "Q236"), [
    entity("Slovenia", "Q215"),
    entity("Bulgaria", "Q219"),
    entity("Romania", "Q218"),
  ]),
  b("intermediate", "Which listed country borders Slovenia?", entity("Slovenia", "Q215"), entity("Austria", "Q40"), [
    entity("Slovakia", "Q214"),
    entity("Albania", "Q222"),
    entity("Romania", "Q218"),
  ]),
  b("intermediate", "Which option is a border neighbor of Slovakia?", entity("Slovakia", "Q214"), entity("Poland", "Q36"), [
    entity("Slovenia", "Q215"),
    entity("Serbia", "Q403"),
    entity("Romania", "Q218"),
  ]),
  b("intermediate", "Lithuania shares a border with which listed country?", entity("Lithuania", "Q37"), entity("Latvia", "Q211"), [
    entity("Estonia", "Q191"),
    entity("Norway", "Q20"),
    entity("Hungary", "Q28"),
  ]),
  b("easy", "Which country shares a border with Latvia?", entity("Latvia", "Q211"), entity("Estonia", "Q191"), [
    entity("Poland", "Q36"),
    entity("Finland", "Q33"),
    entity("Germany", "Q183"),
  ]),
  b("intermediate", "Which country is a border neighbor of Estonia?", entity("Estonia", "Q191"), entity("Russia", "Q159"), [
    entity("Lithuania", "Q37"),
    entity("Finland", "Q33"),
    entity("Belarus", "Q184"),
  ]),
  b("intermediate", "Which listed country borders Belarus?", entity("Belarus", "Q184"), entity("Lithuania", "Q37"), [
    entity("Estonia", "Q191"),
    entity("Finland", "Q33"),
    entity("Moldova", "Q217"),
  ]),
  b("easy", "Moldova shares a border with which country?", entity("Moldova", "Q217"), entity("Ukraine", "Q212"), [
    entity("Poland", "Q36"),
    entity("Bulgaria", "Q219"),
    entity("Slovakia", "Q214"),
  ]),
  b("intermediate", "Which country is listed as a border neighbor of Armenia?", entity("Armenia", "Q399"), entity("Georgia", "Q230"), [
    entity("Iraq", "Q796"),
    entity("Syria", "Q858"),
    entity("Uzbekistan", "Q265"),
  ]),
  b("hard", "Which country shares a border with Azerbaijan?", entity("Azerbaijan", "Q227"), entity("Russia", "Q159"), [
    entity("Lebanon", "Q822"),
    entity("Jordan", "Q810"),
    entity("Iraq", "Q796"),
  ]),
  b("easy", "Which listed country borders Iraq?", entity("Iraq", "Q796"), entity("Turkey", "Q43"), [
    entity("Oman", "Q842"),
    entity("Qatar", "Q846"),
    entity("Lebanon", "Q822"),
  ]),
  b("intermediate", "Oman shares a border with which country?", entity("Oman", "Q842"), entity("Yemen", "Q805"), [
    entity("Kuwait", "Q817"),
    entity("Qatar", "Q846"),
    entity("Jordan", "Q810"),
  ]),
  b("easy", "Which country is a border neighbor of the United Arab Emirates?", entity("United Arab Emirates", "Q878"), entity("Oman", "Q842"), [
    entity("Qatar", "Q846"),
    entity("Kuwait", "Q817"),
    entity("Iraq", "Q796"),
  ]),
  b("easy", "Which country shares a border with Qatar?", entity("Qatar", "Q846"), entity("Saudi Arabia", "Q851"), [
    entity("Oman", "Q842"),
    entity("Kuwait", "Q817"),
    entity("Bahrain", "Q398"),
  ]),
  b("intermediate", "Which listed country borders Bhutan?", entity("Bhutan", "Q917"), entity("India", "Q668"), [
    entity("Nepal", "Q837"),
    entity("Bangladesh", "Q902"),
    entity("Myanmar", "Q836"),
  ]),
  b("easy", "Mongolia shares a border with which country?", entity("Mongolia", "Q711"), entity("Russia", "Q159"), [
    entity("Kazakhstan", "Q232"),
    entity("Kyrgyzstan", "Q813"),
    entity("Uzbekistan", "Q265"),
  ]),
  b("hard", "Which country is a border neighbor of Uzbekistan?", entity("Uzbekistan", "Q265"), entity("Turkmenistan", "Q874"), [
    entity("Mongolia", "Q711"),
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
  ]),
  b("hard", "Which listed country shares a border with Tajikistan?", entity("Tajikistan", "Q863"), entity("Kyrgyzstan", "Q813"), [
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
    entity("Mongolia", "Q711"),
  ]),
  b("intermediate", "Ethiopia shares a border with which country?", entity("Ethiopia", "Q115"), entity("Djibouti", "Q977"), [
    entity("Ghana", "Q117"),
    entity("Tanzania", "Q924"),
    entity("Uganda", "Q1036"),
  ]),
  b("easy", "Which country borders Ghana?", entity("Ghana", "Q117"), entity("Togo", "Q945"), [
    entity("Ethiopia", "Q115"),
    entity("Uganda", "Q1036"),
    entity("Senegal", "Q1041"),
  ]),
  b("hard", "Tanzania has a border with which country listed here?", entity("Tanzania", "Q924"), entity("Rwanda", "Q1037"), [
    entity("Ghana", "Q117"),
    entity("Ethiopia", "Q115"),
    entity("Namibia", "Q1030"),
  ]),
  b("intermediate", "Uganda shares a border with which country?", entity("Uganda", "Q1036"), entity("South Sudan", "Q958"), [
    entity("Ethiopia", "Q115"),
    entity("Ghana", "Q117"),
    entity("Namibia", "Q1030"),
  ]),
  b("easy", "Which listed country borders Zimbabwe?", entity("Zimbabwe", "Q954"), entity("Mozambique", "Q1029"), [
    entity("Namibia", "Q1030"),
    entity("Angola", "Q916"),
    entity("Malawi", "Q1020"),
  ]),
  b("easy", "Botswana shares a border with which country?", entity("Botswana", "Q963"), entity("Namibia", "Q1030"), [
    entity("Angola", "Q916"),
    entity("Mozambique", "Q1029"),
    entity("Malawi", "Q1020"),
  ]),
  b("easy", "Which country is a border neighbor of Namibia?", entity("Namibia", "Q1030"), entity("Angola", "Q916"), [
    entity("Zimbabwe", "Q954"),
    entity("Mozambique", "Q1029"),
    entity("Malawi", "Q1020"),
  ]),
];

function buildQuestion(fact: RawFact, index: number): KnowledgeGeographyCieScoreBatchV3Question {
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

export const knowledgeGeographyCieScoreBatchV3Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV3Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV3Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV3Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV3Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV3Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV3Questions;
