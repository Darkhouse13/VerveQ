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

export type KnowledgeGeographyCieScoreBatchV5Question = KnowledgeQuestionSeed & {
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

const BATCH_ID = "knowledge_geography_cie_score_v5";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v5";
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
  c("intermediate", "Porto-Novo is the capital of which country?", entity("Benin", "Q962"), entity("Porto-Novo", "Q3799"), [
    entity("Togo", "Q945"),
    entity("Niger", "Q1032"),
    entity("Burkina Faso", "Q965"),
  ]),
  c("intermediate", "Niamey serves as the capital city of which country?", entity("Niger", "Q1032"), entity("Niamey", "Q3674"), [
    entity("Chad", "Q657"),
    entity("Mali", "Q912"),
    entity("Benin", "Q962"),
  ]),
  c("hard", "N'Djamena is the capital of which country?", entity("Chad", "Q657"), entity("N'Djamena", "Q3659"), [
    entity("Niger", "Q1032"),
    entity("Sudan", "Q1049"),
    entity("Central African Republic", "Q929"),
  ]),
  c("intermediate", "Libreville is the capital city of which country?", entity("Gabon", "Q1000"), entity("Libreville", "Q3825"), [
    entity("Equatorial Guinea", "Q983"),
    entity("Republic of the Congo", "Q971"),
    entity("Cameroon", "Q1009"),
  ]),
  c("hard", "Which country uses Brazzaville as its capital city?", entity("Republic of the Congo", "Q971"), entity("Brazzaville", "Q3844"), [
    entity("Democratic Republic of the Congo", "Q974"),
    entity("Central African Republic", "Q929"),
    entity("Equatorial Guinea", "Q983"),
  ]),
  c("hard", "Antananarivo is the capital of which island country?", entity("Madagascar", "Q1019"), entity("Antananarivo", "Q3915"), [
    entity("Mauritius", "Q1027"),
    entity("Seychelles", "Q1042"),
    entity("Comoros", "Q970"),
  ]),
  c("hard", "Victoria is the capital city of which country in the Indian Ocean?", entity("Seychelles", "Q1042"), entity("Victoria", "Q3940"), [
    entity("Mauritius", "Q1027"),
    entity("Maldives", "Q826"),
    entity("Comoros", "Q970"),
  ]),
  c("intermediate", "Mogadishu serves as the capital of which country?", entity("Somalia", "Q1045"), entity("Mogadishu", "Q2449"), [
    entity("Djibouti", "Q977"),
    entity("Eritrea", "Q986"),
    entity("Kenya", "Q114"),
  ]),
  c("hard", "Banjul is the capital of which country?", entity("The Gambia", "Q1005"), entity("Banjul", "Q3726"), [
    entity("Senegal", "Q1041"),
    entity("Guinea-Bissau", "Q1007"),
    entity("Sierra Leone", "Q1044"),
  ]),
  c("intermediate", "Gaborone is the capital city of which country?", entity("Botswana", "Q963"), entity("Gaborone", "Q3919"), [
    entity("Namibia", "Q1030"),
    entity("Zimbabwe", "Q954"),
    entity("Zambia", "Q953"),
  ]),
  c("hard", "Maseru serves as the capital of which country?", entity("Lesotho", "Q1013"), entity("Maseru", "Q3909"), [
    entity("Eswatini", "Q1050"),
    entity("Botswana", "Q963"),
    entity("Namibia", "Q1030"),
  ]),
  c("hard", "Port Louis is the capital city of which country?", entity("Mauritius", "Q1027"), entity("Port Louis", "Q3929"), [
    entity("Seychelles", "Q1042"),
    entity("Madagascar", "Q1019"),
    entity("Maldives", "Q826"),
  ]),
  c("hard", "Praia is the capital of which Atlantic island country?", entity("Cape Verde", "Q1011"), entity("Praia", "Q3751"), [
    entity("The Gambia", "Q1005"),
    entity("Guinea-Bissau", "Q1007"),
    entity("Senegal", "Q1041"),
  ]),
  c("intermediate", "Santo Domingo is the capital of which country?", entity("Dominican Republic", "Q786"), entity("Santo Domingo", "Q34820"), [
    entity("Trinidad and Tobago", "Q754"),
    entity("Antigua and Barbuda", "Q781"),
    entity("Saint Kitts and Nevis", "Q763"),
  ]),
  c("hard", "Belmopan is the capital city of which country?", entity("Belize", "Q242"), entity("Belmopan", "Q3043"), [
    entity("Honduras", "Q783"),
    entity("Nicaragua", "Q811"),
    entity("El Salvador", "Q792"),
  ]),
  c("intermediate", "San Salvador is the capital of which country?", entity("El Salvador", "Q792"), entity("San Salvador", "Q3110"), [
    entity("Honduras", "Q783"),
    entity("Guatemala", "Q774"),
    entity("Nicaragua", "Q811"),
  ]),
  c("hard", "Tegucigalpa serves as the capital city of which country?", entity("Honduras", "Q783"), entity("Tegucigalpa", "Q3238"), [
    entity("El Salvador", "Q792"),
    entity("Nicaragua", "Q811"),
    entity("Guatemala", "Q774"),
  ]),
  c("intermediate", "Managua is the capital city of which country?", entity("Nicaragua", "Q811"), entity("Managua", "Q3274"), [
    entity("Honduras", "Q783"),
    entity("Costa Rica", "Q800"),
    entity("Panama", "Q804"),
  ]),
  c("intermediate", "Panama City is the capital of which country?", entity("Panama", "Q804"), entity("Panama City", "Q3306"), [
    entity("Costa Rica", "Q800"),
    entity("Nicaragua", "Q811"),
    entity("Belize", "Q242"),
  ]),
  c("intermediate", "Georgetown is the capital city of which country?", entity("Guyana", "Q734"), entity("Georgetown", "Q10717"), [
    entity("Suriname", "Q730"),
    entity("Trinidad and Tobago", "Q754"),
    entity("Barbados", "Q244"),
  ]),
  c("hard", "Paramaribo is the capital of which country?", entity("Suriname", "Q730"), entity("Paramaribo", "Q3001"), [
    entity("Guyana", "Q734"),
    entity("Barbados", "Q244"),
    entity("Jamaica", "Q766"),
  ]),
  c("intermediate", "Kingston is the capital city of which country?", entity("Jamaica", "Q766"), entity("Kingston", "Q34692"), [
    entity("The Bahamas", "Q778"),
    entity("Barbados", "Q244"),
    entity("Trinidad and Tobago", "Q754"),
  ]),
  c("hard", "Bridgetown serves as the capital of which country?", entity("Barbados", "Q244"), entity("Bridgetown", "Q36168"), [
    entity("The Bahamas", "Q778"),
    entity("Jamaica", "Q766"),
    entity("Grenada", "Q769"),
  ]),
  c("intermediate", "Nassau is the capital city of which country?", entity("The Bahamas", "Q778"), entity("Nassau", "Q2467"), [
    entity("Barbados", "Q244"),
    entity("Jamaica", "Q766"),
    entity("Trinidad and Tobago", "Q754"),
  ]),
  c("hard", "Port of Spain is the capital of which country?", entity("Trinidad and Tobago", "Q754"), entity("Port of Spain", "Q39178"), [
    entity("Dominican Republic", "Q786"),
    entity("Antigua and Barbuda", "Q781"),
    entity("Saint Kitts and Nevis", "Q763"),
  ]),
  b("hard", "Which country is a border neighbor of Niger?", entity("Niger", "Q1032"), entity("Chad", "Q657"), [
    entity("Senegal", "Q1041"),
    entity("Cameroon", "Q1009"),
    entity("Kenya", "Q114"),
  ]),
  b("intermediate", "Chad shares a border with which listed country?", entity("Chad", "Q657"), entity("Sudan", "Q1049"), [
    entity("Senegal", "Q1041"),
    entity("Ghana", "Q117"),
    entity("Ethiopia", "Q115"),
  ]),
  b("hard", "Gabon has a border with which country listed here?", entity("Gabon", "Q1000"), entity("Equatorial Guinea", "Q983"), [
    entity("Ghana", "Q117"),
    entity("Kenya", "Q114"),
    entity("Tanzania", "Q924"),
  ]),
  b("hard", "Which listed country borders the Republic of the Congo?", entity("Republic of the Congo", "Q971"), entity("Gabon", "Q1000"), [
    entity("Ghana", "Q117"),
    entity("Ethiopia", "Q115"),
    entity("Malawi", "Q1020"),
  ]),
  b("hard", "The Democratic Republic of the Congo shares a border with which country?", entity("Democratic Republic of the Congo", "Q974"), entity("Zambia", "Q953"), [
    entity("Ghana", "Q117"),
    entity("Senegal", "Q1041"),
    entity("Ethiopia", "Q115"),
  ]),
  b("intermediate", "Benin has a border with which option?", entity("Benin", "Q962"), entity("Nigeria", "Q1033"), [
    entity("Ghana", "Q117"),
    entity("Senegal", "Q1041"),
    entity("Cameroon", "Q1009"),
  ]),
  b("hard", "Togo shares a border with which listed country?", entity("Togo", "Q945"), entity("Burkina Faso", "Q965"), [
    entity("Mali", "Q912"),
    entity("Senegal", "Q1041"),
    entity("Cameroon", "Q1009"),
  ]),
  b("hard", "Which country shares a border with Sierra Leone?", entity("Sierra Leone", "Q1044"), entity("Liberia", "Q1014"), [
    entity("Ghana", "Q117"),
    entity("The Gambia", "Q1005"),
    entity("Benin", "Q962"),
  ]),
  b("hard", "Liberia has a border with which listed country?", entity("Liberia", "Q1014"), entity("Guinea", "Q1006"), [
    entity("Ghana", "Q117"),
    entity("Togo", "Q945"),
    entity("Senegal", "Q1041"),
  ]),
  b("intermediate", "Which listed country borders Somalia?", entity("Somalia", "Q1045"), entity("Kenya", "Q114"), [
    entity("Sudan", "Q1049"),
    entity("Rwanda", "Q1037"),
    entity("Ghana", "Q117"),
  ]),
  b("intermediate", "Kenya shares a border with which country?", entity("Kenya", "Q114"), entity("Ethiopia", "Q115"), [
    entity("Ghana", "Q117"),
    entity("Zambia", "Q953"),
    entity("Rwanda", "Q1037"),
  ]),
  b("intermediate", "Which country is listed as a border neighbor of Tanzania?", entity("Tanzania", "Q924"), entity("Malawi", "Q1020"), [
    entity("Ghana", "Q117"),
    entity("Ethiopia", "Q115"),
    entity("Namibia", "Q1030"),
  ]),
  b("easy", "Lesotho shares a border with which country?", entity("Lesotho", "Q1013"), entity("South Africa", "Q258"), [
    entity("Botswana", "Q963"),
    entity("Zimbabwe", "Q954"),
    entity("Namibia", "Q1030"),
  ]),
  b("intermediate", "Botswana has a border with which listed country?", entity("Botswana", "Q963"), entity("Zimbabwe", "Q954"), [
    entity("Angola", "Q916"),
    entity("Mozambique", "Q1029"),
    entity("Malawi", "Q1020"),
  ]),
  b("intermediate", "Which country borders Zimbabwe?", entity("Zimbabwe", "Q954"), entity("Zambia", "Q953"), [
    entity("Angola", "Q916"),
    entity("Namibia", "Q1030"),
    entity("Malawi", "Q1020"),
  ]),
  b("easy", "Namibia shares a border with which country?", entity("Namibia", "Q1030"), entity("South Africa", "Q258"), [
    entity("Zimbabwe", "Q954"),
    entity("Mozambique", "Q1029"),
    entity("Malawi", "Q1020"),
  ]),
  b("easy", "Paraguay shares a border with which country?", entity("Paraguay", "Q733"), entity("Brazil", "Q155"), [
    entity("Colombia", "Q739"),
    entity("Uruguay", "Q77"),
    entity("Ecuador", "Q736"),
  ]),
  b("easy", "Uruguay has a border with which option?", entity("Uruguay", "Q77"), entity("Argentina", "Q414"), [
    entity("Paraguay", "Q733"),
    entity("Chile", "Q298"),
    entity("Bolivia", "Q750"),
  ]),
  b("intermediate", "Suriname shares a border with which listed country?", entity("Suriname", "Q730"), entity("Brazil", "Q155"), [
    entity("Colombia", "Q739"),
    entity("Bolivia", "Q750"),
    entity("Uruguay", "Q77"),
  ]),
  b("easy", "Guatemala has a border with which country?", entity("Guatemala", "Q774"), entity("Mexico", "Q96"), [
    entity("Costa Rica", "Q800"),
    entity("Panama", "Q804"),
    entity("Nicaragua", "Q811"),
  ]),
  b("easy", "Which country is a border neighbor of Nicaragua?", entity("Nicaragua", "Q811"), entity("Costa Rica", "Q800"), [
    entity("Belize", "Q242"),
    entity("Panama", "Q804"),
    entity("El Salvador", "Q792"),
  ]),
  b("intermediate", "Panama shares a border with which country?", entity("Panama", "Q804"), entity("Colombia", "Q739"), [
    entity("Honduras", "Q783"),
    entity("Belize", "Q242"),
    entity("Guatemala", "Q774"),
  ]),
  b("easy", "Which listed country borders Spain?", entity("Spain", "Q29"), entity("France", "Q142"), [
    entity("Italy", "Q38"),
    entity("Germany", "Q183"),
    entity("Ireland", "Q27"),
  ]),
  b("easy", "France shares a border with which listed country?", entity("France", "Q142"), entity("Germany", "Q183"), [
    entity("Portugal", "Q45"),
    entity("Ireland", "Q27"),
    entity("Denmark", "Q35"),
  ]),
  b("intermediate", "Austria has a border with which country?", entity("Austria", "Q40"), entity("Italy", "Q38"), [
    entity("Belgium", "Q31"),
    entity("Croatia", "Q224"),
    entity("Poland", "Q36"),
  ]),
];

function buildQuestion(fact: RawFact, index: number): KnowledgeGeographyCieScoreBatchV5Question {
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

export const knowledgeGeographyCieScoreBatchV5Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV5Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV5Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV5Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV5Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV5Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV5Questions;
