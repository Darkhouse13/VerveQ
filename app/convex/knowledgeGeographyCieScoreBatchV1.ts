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

export type KnowledgeGeographyCieScoreQuestion = KnowledgeQuestionSeed & {
  provenance: ScoreModeProvenance;
};

type CapitalFact = {
  kind: "capital";
  difficulty: Difficulty;
  country: EntityRef;
  capital: EntityRef;
  distractors: [EntityRef, EntityRef, EntityRef];
};

type BorderFact = {
  kind: "border";
  difficulty: Difficulty;
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

const BATCH_ID = "knowledge_geography_cie_score_v1";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v1";
const RETRIEVED_AT = "2026-05-26";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "anthropic/claude-opus-4-7";

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
    verdict: "agree",
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
  country: EntityRef,
  capital: EntityRef,
  distractors: [EntityRef, EntityRef, EntityRef],
): CapitalFact {
  return { kind: "capital", difficulty, country, capital, distractors };
}

function b(
  difficulty: Difficulty,
  subject: EntityRef,
  neighbor: EntityRef,
  distractors: [EntityRef, EntityRef, EntityRef],
): BorderFact {
  return { kind: "border", difficulty, subject, neighbor, distractors };
}

const RAW_FACTS: RawFact[] = [
  c("easy", entity("Japan", "Q17"), entity("Tokyo", "Q1490"), [
    entity("South Korea", "Q884"),
    entity("China", "Q148"),
    entity("Vietnam", "Q881"),
  ]),
  c("easy", entity("Canada", "Q16"), entity("Ottawa", "Q1930"), [
    entity("United States", "Q30"),
    entity("Australia", "Q408"),
    entity("New Zealand", "Q664"),
  ]),
  c("easy", entity("Brazil", "Q155"), entity("Brasilia", "Q2844"), [
    entity("Argentina", "Q414"),
    entity("Colombia", "Q739"),
    entity("Peru", "Q419"),
  ]),
  c("easy", entity("Egypt", "Q79"), entity("Cairo", "Q85"), [
    entity("Morocco", "Q1028"),
    entity("Algeria", "Q262"),
    entity("Tunisia", "Q948"),
  ]),
  c("easy", entity("Germany", "Q183"), entity("Berlin", "Q64"), [
    entity("Austria", "Q40"),
    entity("Switzerland", "Q39"),
    entity("Netherlands", "Q55"),
  ]),
  c("easy", entity("India", "Q668"), entity("New Delhi", "Q987"), [
    entity("Pakistan", "Q843"),
    entity("Bangladesh", "Q902"),
    entity("Sri Lanka", "Q854"),
  ]),
  c("easy", entity("Mexico", "Q96"), entity("Mexico City", "Q1489"), [
    entity("Guatemala", "Q774"),
    entity("Colombia", "Q739"),
    entity("Chile", "Q298"),
  ]),
  c("easy", entity("Turkey", "Q43"), entity("Ankara", "Q3640"), [
    entity("Greece", "Q41"),
    entity("Iran", "Q794"),
    entity("Bulgaria", "Q219"),
  ]),
  c("easy", entity("Morocco", "Q1028"), entity("Rabat", "Q3551"), [
    entity("Algeria", "Q262"),
    entity("Tunisia", "Q948"),
    entity("Egypt", "Q79"),
  ]),
  c("easy", entity("Norway", "Q20"), entity("Oslo", "Q585"), [
    entity("Sweden", "Q34"),
    entity("Finland", "Q33"),
    entity("Denmark", "Q35"),
  ]),
  c("intermediate", entity("Kenya", "Q114"), entity("Nairobi", "Q3870"), [
    entity("Tanzania", "Q924"),
    entity("Uganda", "Q1036"),
    entity("Ethiopia", "Q115"),
  ]),
  c("easy", entity("Portugal", "Q45"), entity("Lisbon", "Q597"), [
    entity("Spain", "Q29"),
    entity("Italy", "Q38"),
    entity("Greece", "Q41"),
  ]),
  c("easy", entity("Greece", "Q41"), entity("Athens", "Q1524"), [
    entity("Cyprus", "Q229"),
    entity("Turkey", "Q43"),
    entity("Italy", "Q38"),
  ]),
  c("easy", entity("Thailand", "Q869"), entity("Bangkok", "Q1861"), [
    entity("Vietnam", "Q881"),
    entity("Cambodia", "Q424"),
    entity("Malaysia", "Q833"),
  ]),
  c("easy", entity("Vietnam", "Q881"), entity("Hanoi", "Q1858"), [
    entity("Laos", "Q819"),
    entity("Cambodia", "Q424"),
    entity("Thailand", "Q869"),
  ]),
  c("intermediate", entity("Peru", "Q419"), entity("Lima", "Q2868"), [
    entity("Bolivia", "Q750"),
    entity("Ecuador", "Q736"),
    entity("Chile", "Q298"),
  ]),
  c("easy", entity("Sweden", "Q34"), entity("Stockholm", "Q1754"), [
    entity("Norway", "Q20"),
    entity("Denmark", "Q35"),
    entity("Finland", "Q33"),
  ]),
  c("easy", entity("Italy", "Q38"), entity("Rome", "Q220"), [
    entity("France", "Q142"),
    entity("Spain", "Q29"),
    entity("Germany", "Q183"),
  ]),
  c("easy", entity("Spain", "Q29"), entity("Madrid", "Q2807"), [
    entity("Portugal", "Q45"),
    entity("France", "Q142"),
    entity("Italy", "Q38"),
  ]),
  c("easy", entity("United Kingdom", "Q145"), entity("London", "Q84"), [
    entity("Ireland", "Q27"),
    entity("Belgium", "Q31"),
    entity("Netherlands", "Q55"),
  ]),
  c("easy", entity("South Korea", "Q884"), entity("Seoul", "Q8684"), [
    entity("Japan", "Q17"),
    entity("North Korea", "Q423"),
    entity("China", "Q148"),
  ]),
  c("easy", entity("Argentina", "Q414"), entity("Buenos Aires", "Q1486"), [
    entity("Chile", "Q298"),
    entity("Uruguay", "Q77"),
    entity("Paraguay", "Q733"),
  ]),
  c("intermediate", entity("Nigeria", "Q1033"), entity("Abuja", "Q3787"), [
    entity("Ghana", "Q117"),
    entity("Cameroon", "Q1009"),
    entity("Niger", "Q1032"),
  ]),
  c("intermediate", entity("South Africa", "Q258"), entity("Pretoria", "Q3926"), [
    entity("Botswana", "Q963"),
    entity("Namibia", "Q1030"),
    entity("Zimbabwe", "Q954"),
  ]),
  c("easy", entity("Netherlands", "Q55"), entity("Amsterdam", "Q727"), [
    entity("Belgium", "Q31"),
    entity("Luxembourg", "Q32"),
    entity("Germany", "Q183"),
  ]),
  b("easy", entity("Germany", "Q183"), entity("Poland", "Q36"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Greece", "Q41"),
  ]),
  b("easy", entity("Austria", "Q40"), entity("Hungary", "Q28"), [
    entity("Spain", "Q29"),
    entity("Greece", "Q41"),
    entity("Denmark", "Q35"),
  ]),
  b("easy", entity("Spain", "Q29"), entity("Portugal", "Q45"), [
    entity("Germany", "Q183"),
    entity("Italy", "Q38"),
    entity("Poland", "Q36"),
  ]),
  b("intermediate", entity("China", "Q148"), entity("Mongolia", "Q711"), [
    entity("Thailand", "Q869"),
    entity("Malaysia", "Q833"),
    entity("Singapore", "Q334"),
  ]),
  b("easy", entity("Brazil", "Q155"), entity("Uruguay", "Q77"), [
    entity("Chile", "Q298"),
    entity("Ecuador", "Q736"),
    entity("Panama", "Q804"),
  ]),
  b("intermediate", entity("Turkey", "Q43"), entity("Georgia", "Q230"), [
    entity("Saudi Arabia", "Q851"),
    entity("Romania", "Q218"),
    entity("Italy", "Q38"),
  ]),
  b("easy", entity("India", "Q668"), entity("Nepal", "Q837"), [
    entity("Iran", "Q794"),
    entity("Thailand", "Q869"),
    entity("Malaysia", "Q833"),
  ]),
  b("easy", entity("South Africa", "Q258"), entity("Botswana", "Q963"), [
    entity("Kenya", "Q114"),
    entity("Angola", "Q916"),
    entity("Zambia", "Q953"),
  ]),
  b("intermediate", entity("Kenya", "Q114"), entity("Uganda", "Q1036"), [
    entity("Nigeria", "Q1033"),
    entity("South Africa", "Q258"),
    entity("Morocco", "Q1028"),
  ]),
  b("easy", entity("Morocco", "Q1028"), entity("Algeria", "Q262"), [
    entity("Libya", "Q1016"),
    entity("Egypt", "Q79"),
    entity("Ghana", "Q117"),
  ]),
  b("easy", entity("Sweden", "Q34"), entity("Finland", "Q33"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Greece", "Q41"),
  ]),
  b("hard", entity("Norway", "Q20"), entity("Russia", "Q159"), [
    entity("Estonia", "Q191"),
    entity("Poland", "Q36"),
    entity("Iceland", "Q189"),
  ]),
  b("easy", entity("Portugal", "Q45"), entity("Spain", "Q29"), [
    entity("France", "Q142"),
    entity("Italy", "Q38"),
    entity("Morocco", "Q1028"),
  ]),
  b("intermediate", entity("Poland", "Q36"), entity("Lithuania", "Q37"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Greece", "Q41"),
  ]),
  b("intermediate", entity("Ukraine", "Q212"), entity("Romania", "Q218"), [
    entity("Czechia", "Q213"),
    entity("Belgium", "Q31"),
    entity("Greece", "Q41"),
  ]),
  b("intermediate", entity("Saudi Arabia", "Q851"), entity("Jordan", "Q810"), [
    entity("Turkey", "Q43"),
    entity("Pakistan", "Q843"),
    entity("Morocco", "Q1028"),
  ]),
  b("intermediate", entity("Iran", "Q794"), entity("Pakistan", "Q843"), [
    entity("Lebanon", "Q822"),
    entity("Jordan", "Q810"),
    entity("Thailand", "Q869"),
  ]),
  b("intermediate", entity("Pakistan", "Q843"), entity("Afghanistan", "Q889"), [
    entity("Nepal", "Q837"),
    entity("Bangladesh", "Q902"),
    entity("Oman", "Q842"),
  ]),
  b("easy", entity("Thailand", "Q869"), entity("Laos", "Q819"), [
    entity("Indonesia", "Q252"),
    entity("Philippines", "Q928"),
    entity("Singapore", "Q334"),
  ]),
  b("easy", entity("Vietnam", "Q881"), entity("Cambodia", "Q424"), [
    entity("Myanmar", "Q836"),
    entity("Malaysia", "Q833"),
    entity("Indonesia", "Q252"),
  ]),
  b("intermediate", entity("Bolivia", "Q750"), entity("Paraguay", "Q733"), [
    entity("Colombia", "Q739"),
    entity("Uruguay", "Q77"),
    entity("Ecuador", "Q736"),
  ]),
  b("intermediate", entity("Peru", "Q419"), entity("Ecuador", "Q736"), [
    entity("Argentina", "Q414"),
    entity("Paraguay", "Q733"),
    entity("Uruguay", "Q77"),
  ]),
  b("easy", entity("Colombia", "Q739"), entity("Venezuela", "Q717"), [
    entity("Chile", "Q298"),
    entity("Uruguay", "Q77"),
    entity("Bolivia", "Q750"),
  ]),
  b("easy", entity("Argentina", "Q414"), entity("Chile", "Q298"), [
    entity("Ecuador", "Q736"),
    entity("Colombia", "Q739"),
    entity("Venezuela", "Q717"),
  ]),
  b("hard", entity("Kazakhstan", "Q232"), entity("Uzbekistan", "Q265"), [
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
    entity("Mongolia", "Q711"),
  ]),
];

function buildQuestion(fact: RawFact, index: number): KnowledgeGeographyCieScoreQuestion {
  const isCapital = fact.kind === "capital";
  const category = isCapital ? "capital_cities" : "country_facts";
  const correctAnswer = isCapital ? fact.country.name : fact.neighbor.name;
  const capitalTemplates = [
    (capital: string) => `Which country has ${capital} as its capital?`,
    (capital: string) => `${capital} is the capital of which country?`,
    (capital: string) => `Which nation uses ${capital} as its capital city?`,
    (capital: string) => `The capital city ${capital} belongs to which country?`,
  ];
  const borderTemplates = [
    (subject: string) => `Which country shares a border with ${subject}?`,
    (subject: string) => `Which listed country borders ${subject}?`,
    (subject: string) => `Which option is a border neighbor of ${subject}?`,
    (subject: string) => `${subject} has a border with which country listed here?`,
  ];
  const question = isCapital
    ? fact.country.name === "South Africa"
      ? "Which country lists Pretoria among its capitals?"
      : fact.country.name === "United Kingdom"
        ? "London is the capital of which country in this set?"
      : capitalTemplates[index % capitalTemplates.length](fact.capital.name)
    : fact.subject.name === "Sweden"
      ? "In Sweden's border list, which country appears?"
      : fact.subject.name === "Ukraine"
        ? "Which option appears among Ukraine's border neighbors?"
        : borderTemplates[index % borderTemplates.length](fact.subject.name);
  const explanation = isCapital
    ? fact.country.name === "South Africa"
      ? "Pretoria is one of South Africa's capitals."
      : `${fact.capital.name} is the capital of ${fact.country.name}.`
    : `${fact.neighbor.name} shares a border with ${fact.subject.name}.`;

  return {
    sport: "knowledge",
    category,
    question,
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

export const knowledgeGeographyCieScoreBatchV1Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV1Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV1Metadata = {
  batchId: BATCH_ID,
  mode: "score",
  workUnitId: WORK_UNIT_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "agree",
  questionCount: knowledgeGeographyCieScoreBatchV1Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV1Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV1Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV1Questions;
