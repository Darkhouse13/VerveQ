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

export type KnowledgeGeographyCieScoreBatchV6Question = KnowledgeQuestionSeed & {
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

const BATCH_ID = "knowledge_geography_cie_score_v6";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v6";
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
  c("hard", "St. John's is the capital city of which country?", entity("Antigua and Barbuda", "Q781"), entity("St. John's", "Q36262"), [
    entity("Saint Kitts and Nevis", "Q763"),
    entity("Saint Lucia", "Q760"),
    entity("Dominica", "Q784"),
  ]),
  c("hard", "Moroni is the capital of which island country?", entity("Comoros", "Q970"), entity("Moroni", "Q3901"), [
    entity("Seychelles", "Q1042"),
    entity("Mauritius", "Q1027"),
    entity("Madagascar", "Q1019"),
  ]),
  c("hard", "Roseau serves as the capital of which country?", entity("Dominica", "Q784"), entity("Roseau", "Q36281"), [
    entity("Saint Lucia", "Q760"),
    entity("Grenada", "Q769"),
    entity("Barbados", "Q244"),
  ]),
  c("hard", "Palikir is the capital city of which country?", entity("Federated States of Micronesia", "Q702"), entity("Palikir", "Q42751"), [
    entity("Saint Vincent and the Grenadines", "Q757"),
    entity("Papua New Guinea", "Q691"),
    entity("Solomon Islands", "Q685"),
  ]),
  c("intermediate", "Suva is the capital of which Pacific country?", entity("Fiji", "Q712"), entity("Suva", "Q38807"), [
    entity("Samoa", "Q683"),
    entity("Tonga", "Q678"),
    entity("Vanuatu", "Q686"),
  ]),
  c("hard", "St. George's is the capital city of which country?", entity("Grenada", "Q769"), entity("St. George's", "Q41547"), [
    entity("Barbados", "Q244"),
    entity("Saint Lucia", "Q760"),
    entity("Dominica", "Q784"),
  ]),
  c("intermediate", "Port-au-Prince is the capital of which country?", entity("Haiti", "Q790"), entity("Port-au-Prince", "Q34261"), [
    entity("Dominican Republic", "Q786"),
    entity("Jamaica", "Q766"),
    entity("The Bahamas", "Q778"),
  ]),
  c("hard", "South Tarawa is the capital of which country?", entity("Kiribati", "Q710"), entity("South Tarawa", "Q131233"), [
    entity("Nauru", "Q697"),
    entity("Tuvalu", "Q672"),
    entity("Federated States of Micronesia", "Q702"),
  ]),
  c("hard", "Male is the capital city of which country?", entity("Maldives", "Q826"), entity("Male", "Q9347"), [
    entity("Seychelles", "Q1042"),
    entity("Mauritius", "Q1027"),
    entity("Comoros", "Q970"),
  ]),
  c("hard", "Funafuti is the capital of which country?", entity("Tuvalu", "Q672"), entity("Funafuti", "Q34126"), [
    entity("Federated States of Micronesia", "Q702"),
    entity("Solomon Islands", "Q685"),
    entity("Papua New Guinea", "Q691"),
  ]),
  c("intermediate", "Windhoek serves as the capital city of which country?", entity("Namibia", "Q1030"), entity("Windhoek", "Q3935"), [
    entity("Botswana", "Q963"),
    entity("Zimbabwe", "Q954"),
    entity("Zambia", "Q953"),
  ]),
  c("hard", "Yaren District is listed as the capital district of which country?", entity("Nauru", "Q697"), entity("Yaren District", "Q31026"), [
    entity("Kiribati", "Q710"),
    entity("Tuvalu", "Q672"),
    entity("Federated States of Micronesia", "Q702"),
  ]),
  c("hard", "Ngerulmud is the capital city of which country?", entity("Palau", "Q695"), entity("Ngerulmud", "Q515229"), [
    entity("Federated States of Micronesia", "Q702"),
    entity("Tuvalu", "Q672"),
    entity("Nauru", "Q697"),
  ]),
  c("intermediate", "Port Moresby is the capital of which country?", entity("Papua New Guinea", "Q691"), entity("Port Moresby", "Q36526"), [
    entity("Solomon Islands", "Q685"),
    entity("Vanuatu", "Q686"),
    entity("Fiji", "Q712"),
  ]),
  c("hard", "Basseterre is the capital city of which country?", entity("Saint Kitts and Nevis", "Q763"), entity("Basseterre", "Q41295"), [
    entity("Antigua and Barbuda", "Q781"),
    entity("Dominica", "Q784"),
    entity("Saint Lucia", "Q760"),
  ]),
  c("hard", "Castries serves as the capital of which country?", entity("Saint Lucia", "Q760"), entity("Castries", "Q41699"), [
    entity("Dominica", "Q784"),
    entity("Grenada", "Q769"),
    entity("Barbados", "Q244"),
  ]),
  c("hard", "Kingstown is the capital of which country?", entity("Saint Vincent and the Grenadines", "Q757"), entity("Kingstown", "Q41474"), [
    entity("Saint Kitts and Nevis", "Q763"),
    entity("Antigua and Barbuda", "Q781"),
    entity("Trinidad and Tobago", "Q754"),
  ]),
  c("hard", "Apia is the capital city of which country?", entity("Samoa", "Q683"), entity("Apia", "Q36260"), [
    entity("Tonga", "Q678"),
    entity("Fiji", "Q712"),
    entity("Vanuatu", "Q686"),
  ]),
  c("hard", "Sao Tome is the capital of which country?", entity("Sao Tome and Principe", "Q1039"), entity("Sao Tome", "Q3932"), [
    entity("Cape Verde", "Q1011"),
    entity("Comoros", "Q970"),
    entity("Seychelles", "Q1042"),
  ]),
  c("hard", "Honiara serves as the capital city of which country?", entity("Solomon Islands", "Q685"), entity("Honiara", "Q40921"), [
    entity("Vanuatu", "Q686"),
    entity("Fiji", "Q712"),
    entity("Papua New Guinea", "Q691"),
  ]),
  c("intermediate", "Damascus is the capital of which country?", entity("Syria", "Q858"), entity("Damascus", "Q3766"), [
    entity("Lebanon", "Q822"),
    entity("Jordan", "Q810"),
    entity("Iraq", "Q796"),
  ]),
  c("hard", "Dushanbe is the capital city of which country?", entity("Tajikistan", "Q863"), entity("Dushanbe", "Q9365"), [
    entity("Kyrgyzstan", "Q813"),
    entity("Uzbekistan", "Q265"),
    entity("Turkmenistan", "Q874"),
  ]),
  c("hard", "Nuku'alofa is the capital of which country?", entity("Tonga", "Q678"), entity("Nuku'alofa", "Q38834"), [
    entity("Samoa", "Q683"),
    entity("Fiji", "Q712"),
    entity("Vanuatu", "Q686"),
  ]),
  c("hard", "Port Vila is the capital city of which country?", entity("Vanuatu", "Q686"), entity("Port Vila", "Q37806"), [
    entity("Solomon Islands", "Q685"),
    entity("Fiji", "Q712"),
    entity("Samoa", "Q683"),
  ]),
  c("intermediate", "Harare is the capital of which country?", entity("Zimbabwe", "Q954"), entity("Harare", "Q3921"), [
    entity("Zambia", "Q953"),
    entity("Botswana", "Q963"),
    entity("Namibia", "Q1030"),
  ]),
  b("hard", "Armenia shares a border with which listed country?", entity("Armenia", "Q399"), entity("Iran", "Q794"), [
    entity("Iraq", "Q796"),
    entity("Syria", "Q858"),
    entity("Jordan", "Q810"),
  ]),
  b("hard", "Austria has a border with which small country?", entity("Austria", "Q40"), entity("Liechtenstein", "Q347"), [
    entity("Belgium", "Q31"),
    entity("Luxembourg", "Q32"),
    entity("Croatia", "Q224"),
  ]),
  b("easy", "Bangladesh shares a border with which country?", entity("Bangladesh", "Q902"), entity("India", "Q668"), [
    entity("Nepal", "Q837"),
    entity("Sri Lanka", "Q854"),
    entity("Thailand", "Q869"),
  ]),
  b("hard", "Which listed country borders Bhutan?", entity("Bhutan", "Q917"), entity("China", "Q148"), [
    entity("Pakistan", "Q843"),
    entity("Bangladesh", "Q902"),
    entity("Myanmar", "Q836"),
  ]),
  b("easy", "Cambodia has a border with which country?", entity("Cambodia", "Q424"), entity("Thailand", "Q869"), [
    entity("Myanmar", "Q836"),
    entity("Malaysia", "Q833"),
    entity("Indonesia", "Q252"),
  ]),
  b("hard", "The Democratic Republic of the Congo borders which listed country?", entity("Democratic Republic of the Congo", "Q974"), entity("Uganda", "Q1036"), [
    entity("Kenya", "Q114"),
    entity("Ghana", "Q117"),
    entity("Senegal", "Q1041"),
  ]),
  b("hard", "Equatorial Guinea shares a border with which country?", entity("Equatorial Guinea", "Q983"), entity("Cameroon", "Q1009"), [
    entity("Ghana", "Q117"),
    entity("Kenya", "Q114"),
    entity("Tanzania", "Q924"),
  ]),
  b("intermediate", "France shares a border with which listed country?", entity("France", "Q142"), entity("Switzerland", "Q39"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Denmark", "Q35"),
  ]),
  b("intermediate", "Germany has a border with which country?", entity("Germany", "Q183"), entity("Luxembourg", "Q32"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Greece", "Q41"),
  ]),
  b("intermediate", "Guyana shares a border with which country?", entity("Guyana", "Q734"), entity("Brazil", "Q155"), [
    entity("Bolivia", "Q750"),
    entity("Uruguay", "Q77"),
    entity("Paraguay", "Q733"),
  ]),
  b("intermediate", "Indonesia has a border with which listed country?", entity("Indonesia", "Q252"), entity("Malaysia", "Q833"), [
    entity("Cambodia", "Q424"),
    entity("Laos", "Q819"),
    entity("Myanmar", "Q836"),
  ]),
  b("intermediate", "Iran shares a border with which country?", entity("Iran", "Q794"), entity("Afghanistan", "Q889"), [
    entity("Lebanon", "Q822"),
    entity("Jordan", "Q810"),
    entity("Thailand", "Q869"),
  ]),
  b("intermediate", "Jordan has a border with which listed country?", entity("Jordan", "Q810"), entity("Syria", "Q858"), [
    entity("Iran", "Q794"),
    entity("Lebanon", "Q822"),
    entity("Oman", "Q842"),
  ]),
  b("intermediate", "Kuwait shares a border with which country?", entity("Kuwait", "Q817"), entity("Saudi Arabia", "Q851"), [
    entity("Qatar", "Q846"),
    entity("Bahrain", "Q398"),
    entity("Oman", "Q842"),
  ]),
  b("intermediate", "Laos has a border with which country?", entity("Laos", "Q819"), entity("Vietnam", "Q881"), [
    entity("Malaysia", "Q833"),
    entity("Indonesia", "Q252"),
    entity("Philippines", "Q928"),
  ]),
  b("easy", "Malaysia shares a border with which listed country?", entity("Malaysia", "Q833"), entity("Thailand", "Q869"), [
    entity("Vietnam", "Q881"),
    entity("Cambodia", "Q424"),
    entity("Laos", "Q819"),
  ]),
  b("intermediate", "Myanmar has a border with which country?", entity("Myanmar", "Q836"), entity("Thailand", "Q869"), [
    entity("Malaysia", "Q833"),
    entity("Indonesia", "Q252"),
    entity("Philippines", "Q928"),
  ]),
  b("intermediate", "Namibia shares a border with which listed country?", entity("Namibia", "Q1030"), entity("Zambia", "Q953"), [
    entity("Zimbabwe", "Q954"),
    entity("Mozambique", "Q1029"),
    entity("Malawi", "Q1020"),
  ]),
  b("intermediate", "Poland has a border with which country?", entity("Poland", "Q36"), entity("Belarus", "Q184"), [
    entity("Estonia", "Q191"),
    entity("Finland", "Q33"),
    entity("Hungary", "Q28"),
  ]),
  b("intermediate", "Saudi Arabia shares a border with which country?", entity("Saudi Arabia", "Q851"), entity("Yemen", "Q805"), [
    entity("Turkey", "Q43"),
    entity("Pakistan", "Q843"),
    entity("Morocco", "Q1028"),
  ]),
  b("hard", "Spain has a border with which small country?", entity("Spain", "Q29"), entity("Andorra", "Q228"), [
    entity("Belgium", "Q31"),
    entity("Netherlands", "Q55"),
    entity("Luxembourg", "Q32"),
  ]),
  b("intermediate", "Switzerland shares a border with which country?", entity("Switzerland", "Q39"), entity("Germany", "Q183"), [
    entity("Belgium", "Q31"),
    entity("Netherlands", "Q55"),
    entity("Denmark", "Q35"),
  ]),
  b("intermediate", "Syria has a border with which listed country?", entity("Syria", "Q858"), entity("Turkey", "Q43"), [
    entity("Oman", "Q842"),
    entity("Qatar", "Q846"),
    entity("Kuwait", "Q817"),
  ]),
  b("hard", "Tajikistan shares a border with which country?", entity("Tajikistan", "Q863"), entity("Uzbekistan", "Q265"), [
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
    entity("Mongolia", "Q711"),
  ]),
  b("intermediate", "Zimbabwe has a border with which listed country?", entity("Zimbabwe", "Q954"), entity("South Africa", "Q258"), [
    entity("Angola", "Q916"),
    entity("Namibia", "Q1030"),
    entity("Malawi", "Q1020"),
  ]),
];

function buildQuestion(fact: RawFact, index: number): KnowledgeGeographyCieScoreBatchV6Question {
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

export const knowledgeGeographyCieScoreBatchV6Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV6Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV6Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV6Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV6Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV6Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV6Questions;
