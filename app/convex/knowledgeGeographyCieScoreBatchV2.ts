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
  verdict: "pending";
  batchId: string;
  workUnitId: string;
};

export type KnowledgeGeographyCieScoreBatchV2Question = KnowledgeQuestionSeed & {
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

const BATCH_ID = "knowledge_geography_cie_score_v2";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v2";
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
  c("easy", "Paris is the capital of which European country?", entity("France", "Q142"), entity("Paris", "Q90"), [
    entity("Belgium", "Q31"),
    entity("Switzerland", "Q39"),
    entity("Italy", "Q38"),
  ]),
  c("easy", "Canberra is the capital of which country in Oceania?", entity("Australia", "Q408"), entity("Canberra", "Q3114"), [
    entity("New Zealand", "Q664"),
    entity("Canada", "Q16"),
    entity("United States", "Q30"),
  ]),
  c("easy", "Which country is governed from Washington, D.C. as its capital?", entity("United States", "Q30"), entity("Washington, D.C.", "Q61"), [
    entity("Canada", "Q16"),
    entity("Mexico", "Q96"),
    entity("Brazil", "Q155"),
  ]),
  c("easy", "Moscow serves as the capital of which country?", entity("Russia", "Q159"), entity("Moscow", "Q649"), [
    entity("Ukraine", "Q212"),
    entity("Poland", "Q36"),
    entity("Kazakhstan", "Q232"),
  ]),
  c("easy", "Beijing is the capital city of which East Asian country?", entity("China", "Q148"), entity("Beijing", "Q956"), [
    entity("Japan", "Q17"),
    entity("South Korea", "Q884"),
    entity("Vietnam", "Q881"),
  ]),
  c("easy", "Which country has Dublin as its capital city?", entity("Ireland", "Q27"), entity("Dublin", "Q1761"), [
    entity("United Kingdom", "Q145"),
    entity("Denmark", "Q35"),
    entity("Netherlands", "Q55"),
  ]),
  c("easy", "The capital city Brussels belongs to which country?", entity("Belgium", "Q31"), entity("Brussels", "Q239"), [
    entity("Netherlands", "Q55"),
    entity("Luxembourg", "Q32"),
    entity("Germany", "Q183"),
  ]),
  c("intermediate", "Bern is the federal capital of which Alpine country?", entity("Switzerland", "Q39"), entity("Bern", "Q70"), [
    entity("Austria", "Q40"),
    entity("Germany", "Q183"),
    entity("France", "Q142"),
  ]),
  c("easy", "Vienna is the capital of which country on the Danube?", entity("Austria", "Q40"), entity("Vienna", "Q1741"), [
    entity("Hungary", "Q28"),
    entity("Slovakia", "Q214"),
    entity("Czechia", "Q213"),
  ]),
  c("easy", "Helsinki is the capital of which Nordic country?", entity("Finland", "Q33"), entity("Helsinki", "Q1757"), [
    entity("Sweden", "Q34"),
    entity("Norway", "Q20"),
    entity("Estonia", "Q191"),
  ]),
  c("easy", "Copenhagen is the capital of which Scandinavian country?", entity("Denmark", "Q35"), entity("Copenhagen", "Q1748"), [
    entity("Sweden", "Q34"),
    entity("Norway", "Q20"),
    entity("Finland", "Q33"),
  ]),
  c("easy", "Which country has Warsaw as its capital in Central Europe?", entity("Poland", "Q36"), entity("Warsaw", "Q270"), [
    entity("Czechia", "Q213"),
    entity("Slovakia", "Q214"),
    entity("Hungary", "Q28"),
  ]),
  c("easy", "Kyiv is the capital of which Eastern European country?", entity("Ukraine", "Q212"), entity("Kyiv", "Q1899"), [
    entity("Romania", "Q218"),
    entity("Moldova", "Q217"),
    entity("Bulgaria", "Q219"),
  ]),
  c("easy", "Bucharest is the capital of which country?", entity("Romania", "Q218"), entity("Bucharest", "Q19660"), [
    entity("Hungary", "Q28"),
    entity("Serbia", "Q403"),
    entity("Bulgaria", "Q219"),
  ]),
  c("easy", "Prague is the capital of which country in Central Europe?", entity("Czechia", "Q213"), entity("Prague", "Q1085"), [
    entity("Slovakia", "Q214"),
    entity("Poland", "Q36"),
    entity("Austria", "Q40"),
  ]),
  c("easy", "Which Danube country has Budapest as its capital?", entity("Hungary", "Q28"), entity("Budapest", "Q1781"), [
    entity("Austria", "Q40"),
    entity("Romania", "Q218"),
    entity("Serbia", "Q403"),
  ]),
  c("intermediate", "Zagreb is the capital city of which Balkan country?", entity("Croatia", "Q224"), entity("Zagreb", "Q1435"), [
    entity("Slovenia", "Q215"),
    entity("Bosnia and Herzegovina", "Q225"),
    entity("Serbia", "Q403"),
  ]),
  c("easy", "Belgrade is the capital of which country?", entity("Serbia", "Q403"), entity("Belgrade", "Q3711"), [
    entity("Croatia", "Q224"),
    entity("Bulgaria", "Q219"),
    entity("Romania", "Q218"),
  ]),
  c("easy", "Sofia is the capital of which country in southeastern Europe?", entity("Bulgaria", "Q219"), entity("Sofia", "Q472"), [
    entity("Romania", "Q218"),
    entity("Serbia", "Q403"),
    entity("Greece", "Q41"),
  ]),
  c("easy", "Riyadh is the capital of which Arabian Peninsula country?", entity("Saudi Arabia", "Q851"), entity("Riyadh", "Q3692"), [
    entity("Jordan", "Q810"),
    entity("Oman", "Q842"),
    entity("United Arab Emirates", "Q878"),
  ]),
  c("easy", "Tehran is the capital of which country?", entity("Iran", "Q794"), entity("Tehran", "Q3616"), [
    entity("Iraq", "Q796"),
    entity("Pakistan", "Q843"),
    entity("Afghanistan", "Q889"),
  ]),
  c("intermediate", "Islamabad is the capital of which South Asian country?", entity("Pakistan", "Q843"), entity("Islamabad", "Q1362"), [
    entity("India", "Q668"),
    entity("Bangladesh", "Q902"),
    entity("Nepal", "Q837"),
  ]),
  c("intermediate", "Dhaka is the capital of which country on the Bay of Bengal?", entity("Bangladesh", "Q902"), entity("Dhaka", "Q1354"), [
    entity("Nepal", "Q837"),
    entity("Sri Lanka", "Q854"),
    entity("Myanmar", "Q836"),
  ]),
  c("intermediate", "Kathmandu is the capital of which Himalayan country?", entity("Nepal", "Q837"), entity("Kathmandu", "Q3037"), [
    entity("Bhutan", "Q917"),
    entity("Bangladesh", "Q902"),
    entity("Pakistan", "Q843"),
  ]),
  c("easy", "Manila is the capital of which country in Southeast Asia?", entity("Philippines", "Q928"), entity("Manila", "Q1461"), [
    entity("Thailand", "Q869"),
    entity("Vietnam", "Q881"),
    entity("Malaysia", "Q833"),
  ]),
  b("easy", "Which country borders France to the northeast?", entity("France", "Q142"), entity("Belgium", "Q31"), [
    entity("Ireland", "Q27"),
    entity("Denmark", "Q35"),
    entity("Poland", "Q36"),
  ]),
  b("easy", "Which country shares a border with Belgium to the north?", entity("Belgium", "Q31"), entity("Netherlands", "Q55"), [
    entity("Spain", "Q29"),
    entity("Italy", "Q38"),
    entity("Poland", "Q36"),
  ]),
  b("hard", "Which small country is a neighbor of Switzerland?", entity("Switzerland", "Q39"), entity("Liechtenstein", "Q347"), [
    entity("Belgium", "Q31"),
    entity("Netherlands", "Q55"),
    entity("Denmark", "Q35"),
  ]),
  b("intermediate", "Which country borders Italy on the northeastern edge?", entity("Italy", "Q38"), entity("Slovenia", "Q215"), [
    entity("Belgium", "Q31"),
    entity("Netherlands", "Q55"),
    entity("Poland", "Q36"),
  ]),
  b("intermediate", "Which country borders Greece to the northwest?", entity("Greece", "Q41"), entity("Albania", "Q222"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Denmark", "Q35"),
  ]),
  b("easy", "Which country lies across Bulgaria's northern border?", entity("Bulgaria", "Q219"), entity("Romania", "Q218"), [
    entity("Italy", "Q38"),
    entity("Poland", "Q36"),
    entity("Spain", "Q29"),
  ]),
  b("easy", "Which country borders Romania to the east?", entity("Romania", "Q218"), entity("Moldova", "Q217"), [
    entity("Austria", "Q40"),
    entity("Greece", "Q41"),
    entity("Belgium", "Q31"),
  ]),
  b("easy", "Which country is a northern neighbor of Hungary?", entity("Hungary", "Q28"), entity("Slovakia", "Q214"), [
    entity("Belgium", "Q31"),
    entity("Greece", "Q41"),
    entity("Denmark", "Q35"),
  ]),
  b("intermediate", "Which country borders Czechia to the south?", entity("Czechia", "Q213"), entity("Austria", "Q40"), [
    entity("Italy", "Q38"),
    entity("Ireland", "Q27"),
    entity("Portugal", "Q45"),
  ]),
  b("intermediate", "Which country borders Croatia along much of its inland south?", entity("Croatia", "Q224"), entity("Bosnia and Herzegovina", "Q225"), [
    entity("North Macedonia", "Q221"),
    entity("Albania", "Q222"),
    entity("Greece", "Q41"),
  ]),
  b("hard", "Which country is one of Serbia's southwestern neighbors?", entity("Serbia", "Q403"), entity("Montenegro", "Q236"), [
    entity("Greece", "Q41"),
    entity("Italy", "Q38"),
    entity("Portugal", "Q45"),
  ]),
  b("easy", "Which country touches Finland along its northwestern frontier?", entity("Finland", "Q33"), entity("Norway", "Q20"), [
    entity("Poland", "Q36"),
    entity("Germany", "Q183"),
    entity("Ireland", "Q27"),
  ]),
  b("easy", "Which country is Denmark's land neighbor to the south?", entity("Denmark", "Q35"), entity("Germany", "Q183"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Greece", "Q41"),
  ]),
  b("intermediate", "Which country borders Iraq at its short southeastern frontier?", entity("Iraq", "Q796"), entity("Kuwait", "Q817"), [
    entity("Lebanon", "Q822"),
    entity("Qatar", "Q846"),
    entity("Bahrain", "Q398"),
  ]),
  b("intermediate", "Which country shares Jordan's western border?", entity("Jordan", "Q810"), entity("Israel", "Q801"), [
    entity("Turkey", "Q43"),
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
  ]),
  b("easy", "Which country borders Syria on the Mediterranean side?", entity("Syria", "Q858"), entity("Lebanon", "Q822"), [
    entity("Oman", "Q842"),
    entity("Pakistan", "Q843"),
    entity("Egypt", "Q79"),
  ]),
  b("hard", "Which country borders Afghanistan across the Panj River region?", entity("Afghanistan", "Q889"), entity("Tajikistan", "Q863"), [
    entity("Sri Lanka", "Q854"),
    entity("Bangladesh", "Q902"),
    entity("Oman", "Q842"),
  ]),
  b("intermediate", "Which country borders Bangladesh to the southeast?", entity("Bangladesh", "Q902"), entity("Myanmar", "Q836"), [
    entity("Nepal", "Q837"),
    entity("Thailand", "Q869"),
    entity("Malaysia", "Q833"),
  ]),
  b("intermediate", "Which country shares a border with Myanmar along the Mekong region?", entity("Myanmar", "Q836"), entity("Laos", "Q819"), [
    entity("Indonesia", "Q252"),
    entity("Philippines", "Q928"),
    entity("Singapore", "Q334"),
  ]),
  b("hard", "Which small country borders Malaysia on Borneo?", entity("Malaysia", "Q833"), entity("Brunei", "Q921"), [
    entity("Vietnam", "Q881"),
    entity("Cambodia", "Q424"),
    entity("Laos", "Q819"),
  ]),
  b("intermediate", "Which country has a land boundary with Indonesia on Timor?", entity("Indonesia", "Q252"), entity("Timor-Leste", "Q574"), [
    entity("Sri Lanka", "Q854"),
    entity("Nepal", "Q837"),
    entity("Oman", "Q842"),
  ]),
  b("intermediate", "Which country borders Laos to the north?", entity("Laos", "Q819"), entity("China", "Q148"), [
    entity("Malaysia", "Q833"),
    entity("Indonesia", "Q252"),
    entity("Philippines", "Q928"),
  ]),
  b("easy", "Which country borders Cambodia to the north?", entity("Cambodia", "Q424"), entity("Laos", "Q819"), [
    entity("Myanmar", "Q836"),
    entity("Malaysia", "Q833"),
    entity("Indonesia", "Q252"),
  ]),
  b("easy", "Which country borders Ecuador to the north?", entity("Ecuador", "Q736"), entity("Colombia", "Q739"), [
    entity("Bolivia", "Q750"),
    entity("Uruguay", "Q77"),
    entity("Paraguay", "Q733"),
  ]),
  b("easy", "Which country borders Chile along the Andes?", entity("Chile", "Q298"), entity("Bolivia", "Q750"), [
    entity("Colombia", "Q739"),
    entity("Venezuela", "Q717"),
    entity("Ecuador", "Q736"),
  ]),
];

function buildQuestion(fact: RawFact, index: number): KnowledgeGeographyCieScoreBatchV2Question {
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

export const knowledgeGeographyCieScoreBatchV2Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV2Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV2Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV2Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV2Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV2Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV2Questions;
