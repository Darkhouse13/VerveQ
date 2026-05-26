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

export type KnowledgeGeographyCieScoreBatchV4Question = KnowledgeQuestionSeed & {
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

const BATCH_ID = "knowledge_geography_cie_score_v4";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v4";
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
  c("easy", "Algiers is the capital of which country?", entity("Algeria", "Q262"), entity("Algiers", "Q3561"), [
    entity("Tunisia", "Q948"),
    entity("Libya", "Q1016"),
    entity("Mauritania", "Q1025"),
  ]),
  c("easy", "Tunis is the capital city of which country?", entity("Tunisia", "Q948"), entity("Tunis", "Q3572"), [
    entity("Algeria", "Q262"),
    entity("Libya", "Q1016"),
    entity("Morocco", "Q1028"),
  ]),
  c("intermediate", "Tripoli serves as the capital of which country?", entity("Libya", "Q1016"), entity("Tripoli", "Q3579"), [
    entity("Tunisia", "Q948"),
    entity("Sudan", "Q1049"),
    entity("Algeria", "Q262"),
  ]),
  c("intermediate", "Which country has Khartoum as its capital city?", entity("Sudan", "Q1049"), entity("Khartoum", "Q1963"), [
    entity("South Sudan", "Q958"),
    entity("Eritrea", "Q986"),
    entity("Chad", "Q657"),
  ]),
  c("intermediate", "Juba is the capital city of which country?", entity("South Sudan", "Q958"), entity("Juba", "Q1947"), [
    entity("Sudan", "Q1049"),
    entity("Uganda", "Q1036"),
    entity("Ethiopia", "Q115"),
  ]),
  c("easy", "Dakar is the capital city of which country?", entity("Senegal", "Q1041"), entity("Dakar", "Q3718"), [
    entity("Mali", "Q912"),
    entity("Mauritania", "Q1025"),
    entity("Guinea", "Q1006"),
  ]),
  c("easy", "Bamako serves as the capital of which country?", entity("Mali", "Q912"), entity("Bamako", "Q3703"), [
    entity("Burkina Faso", "Q965"),
    entity("Niger", "Q1032"),
    entity("Senegal", "Q1041"),
  ]),
  c("intermediate", "Nouakchott is the capital of which country?", entity("Mauritania", "Q1025"), entity("Nouakchott", "Q3688"), [
    entity("Senegal", "Q1041"),
    entity("Mali", "Q912"),
    entity("Algeria", "Q262"),
  ]),
  c("intermediate", "The capital city Ouagadougou belongs to which country?", entity("Burkina Faso", "Q965"), entity("Ouagadougou", "Q3777"), [
    entity("Mali", "Q912"),
    entity("Benin", "Q962"),
    entity("Niger", "Q1032"),
  ]),
  c("intermediate", "Conakry is the capital city of which country?", entity("Guinea", "Q1006"), entity("Conakry", "Q3733"), [
    entity("Sierra Leone", "Q1044"),
    entity("Liberia", "Q1014"),
    entity("Guinea-Bissau", "Q1007"),
  ]),
  c("hard", "Bissau is the capital of which country?", entity("Guinea-Bissau", "Q1007"), entity("Bissau", "Q3739"), [
    entity("Guinea", "Q1006"),
    entity("Senegal", "Q1041"),
    entity("The Gambia", "Q1005"),
  ]),
  c("hard", "Which country uses Yamoussoukro as its capital city?", entity("Ivory Coast", "Q1008"), entity("Yamoussoukro", "Q3768"), [
    entity("Ghana", "Q117"),
    entity("Liberia", "Q1014"),
    entity("Burkina Faso", "Q965"),
  ]),
  c("intermediate", "Monrovia is the capital of which country?", entity("Liberia", "Q1014"), entity("Monrovia", "Q3748"), [
    entity("Sierra Leone", "Q1044"),
    entity("Guinea", "Q1006"),
    entity("Ivory Coast", "Q1008"),
  ]),
  c("intermediate", "Freetown serves as the capital of which country?", entity("Sierra Leone", "Q1044"), entity("Freetown", "Q3780"), [
    entity("Liberia", "Q1014"),
    entity("Guinea", "Q1006"),
    entity("The Gambia", "Q1005"),
  ]),
  c("hard", "Bangui is the capital city of which country?", entity("Central African Republic", "Q929"), entity("Bangui", "Q3832"), [
    entity("Democratic Republic of the Congo", "Q974"),
    entity("Republic of the Congo", "Q971"),
    entity("Equatorial Guinea", "Q983"),
  ]),
  c("easy", "Kigali is the capital of which country?", entity("Rwanda", "Q1037"), entity("Kigali", "Q3859"), [
    entity("Burundi", "Q967"),
    entity("Uganda", "Q1036"),
    entity("Tanzania", "Q924"),
  ]),
  c("intermediate", "Which country has Lilongwe as its capital?", entity("Malawi", "Q1020"), entity("Lilongwe", "Q3876"), [
    entity("Mozambique", "Q1029"),
    entity("Zambia", "Q953"),
    entity("Tanzania", "Q924"),
  ]),
  c("easy", "Maputo is the capital city of which country?", entity("Mozambique", "Q1029"), entity("Maputo", "Q3889"), [
    entity("Malawi", "Q1020"),
    entity("Zambia", "Q953"),
    entity("Zimbabwe", "Q954"),
  ]),
  c("easy", "Lusaka is the capital of which country?", entity("Zambia", "Q953"), entity("Lusaka", "Q3881"), [
    entity("Malawi", "Q1020"),
    entity("Mozambique", "Q1029"),
    entity("Angola", "Q916"),
  ]),
  c("easy", "Luanda serves as the capital city of which country?", entity("Angola", "Q916"), entity("Luanda", "Q3897"), [
    entity("Zambia", "Q953"),
    entity("Namibia", "Q1030"),
    entity("Democratic Republic of the Congo", "Q974"),
  ]),
  c("hard", "Bishkek is the capital city of which country?", entity("Kyrgyzstan", "Q813"), entity("Bishkek", "Q9361"), [
    entity("Tajikistan", "Q863"),
    entity("Uzbekistan", "Q265"),
    entity("Kazakhstan", "Q232"),
  ]),
  c("hard", "Ashgabat serves as the capital of which country?", entity("Turkmenistan", "Q874"), entity("Ashgabat", "Q23438"), [
    entity("Uzbekistan", "Q265"),
    entity("Kazakhstan", "Q232"),
    entity("Tajikistan", "Q863"),
  ]),
  c("hard", "Dili is the capital city of which country?", entity("Timor-Leste", "Q574"), entity("Dili", "Q9310"), [
    entity("Indonesia", "Q252"),
    entity("Philippines", "Q928"),
    entity("Brunei", "Q921"),
  ]),
  c("intermediate", "Manama is the capital of which country?", entity("Bahrain", "Q398"), entity("Manama", "Q3882"), [
    entity("Qatar", "Q846"),
    entity("Kuwait", "Q817"),
    entity("Oman", "Q842"),
  ]),
  c("hard", "Bandar Seri Begawan is the capital city of which country?", entity("Brunei", "Q921"), entity("Bandar Seri Begawan", "Q9279"), [
    entity("Malaysia", "Q833"),
    entity("Singapore", "Q334"),
    entity("Timor-Leste", "Q574"),
  ]),
  b("easy", "Which listed country shares a border with Algeria?", entity("Algeria", "Q262"), entity("Tunisia", "Q948"), [
    entity("Cameroon", "Q1009"),
    entity("Senegal", "Q1041"),
    entity("Kenya", "Q114"),
  ]),
  b("easy", "Tunisia has a border with which option?", entity("Tunisia", "Q948"), entity("Libya", "Q1016"), [
    entity("Morocco", "Q1028"),
    entity("Egypt", "Q79"),
    entity("Mali", "Q912"),
  ]),
  b("intermediate", "Which option is a border neighbor of Mali?", entity("Mali", "Q912"), entity("Mauritania", "Q1025"), [
    entity("Cameroon", "Q1009"),
    entity("Kenya", "Q114"),
    entity("Tanzania", "Q924"),
  ]),
  b("intermediate", "Burkina Faso shares a border with which listed country?", entity("Burkina Faso", "Q965"), entity("Benin", "Q962"), [
    entity("Senegal", "Q1041"),
    entity("Cameroon", "Q1009"),
    entity("Kenya", "Q114"),
  ]),
  b("intermediate", "Which country is listed as a border neighbor of Guinea?", entity("Guinea", "Q1006"), entity("Sierra Leone", "Q1044"), [
    entity("Benin", "Q962"),
    entity("The Gambia", "Q1005"),
    entity("Cameroon", "Q1009"),
  ]),
  b("hard", "Guinea-Bissau shares a border with which country?", entity("Guinea-Bissau", "Q1007"), entity("Senegal", "Q1041"), [
    entity("Liberia", "Q1014"),
    entity("Togo", "Q945"),
    entity("Mali", "Q912"),
  ]),
  b("intermediate", "Which listed country borders Ivory Coast?", entity("Ivory Coast", "Q1008"), entity("Liberia", "Q1014"), [
    entity("Senegal", "Q1041"),
    entity("Benin", "Q962"),
    entity("Cameroon", "Q1009"),
  ]),
  b("intermediate", "Cameroon has a border with which country listed here?", entity("Cameroon", "Q1009"), entity("Chad", "Q657"), [
    entity("Senegal", "Q1041"),
    entity("Ethiopia", "Q115"),
    entity("Libya", "Q1016"),
  ]),
  b("hard", "Which option appears in the Central African Republic border list?", entity("Central African Republic", "Q929"), entity("South Sudan", "Q958"), [
    entity("Ghana", "Q117"),
    entity("Senegal", "Q1041"),
    entity("Rwanda", "Q1037"),
  ]),
  b("easy", "Which country shares a border with Rwanda?", entity("Rwanda", "Q1037"), entity("Burundi", "Q967"), [
    entity("Ethiopia", "Q115"),
    entity("Ghana", "Q117"),
    entity("Namibia", "Q1030"),
  ]),
  b("intermediate", "Malawi has a border with which listed country?", entity("Malawi", "Q1020"), entity("Zambia", "Q953"), [
    entity("Ghana", "Q117"),
    entity("Ethiopia", "Q115"),
    entity("Angola", "Q916"),
  ]),
  b("hard", "Which listed country is a border neighbor of Mozambique?", entity("Mozambique", "Q1029"), entity("Eswatini", "Q1050"), [
    entity("Angola", "Q916"),
    entity("Kenya", "Q114"),
    entity("Ghana", "Q117"),
  ]),
  b("intermediate", "Zambia shares a border with which country?", entity("Zambia", "Q953"), entity("Angola", "Q916"), [
    entity("Ghana", "Q117"),
    entity("Ethiopia", "Q115"),
    entity("Senegal", "Q1041"),
  ]),
  b("hard", "Angola has a border with which listed country?", entity("Angola", "Q916"), entity("Republic of the Congo", "Q971"), [
    entity("Central African Republic", "Q929"),
    entity("Equatorial Guinea", "Q983"),
    entity("Sierra Leone", "Q1044"),
  ]),
  b("intermediate", "Which country shares a border with Djibouti?", entity("Djibouti", "Q977"), entity("Eritrea", "Q986"), [
    entity("Ghana", "Q117"),
    entity("Zambia", "Q953"),
    entity("Rwanda", "Q1037"),
  ]),
  b("intermediate", "Eritrea shares a border with which country?", entity("Eritrea", "Q986"), entity("Sudan", "Q1049"), [
    entity("Kenya", "Q114"),
    entity("Ghana", "Q117"),
    entity("Zambia", "Q953"),
  ]),
  b("hard", "Which country is a border neighbor of Kyrgyzstan?", entity("Kyrgyzstan", "Q813"), entity("Tajikistan", "Q863"), [
    entity("Iran", "Q794"),
    entity("Pakistan", "Q843"),
    entity("Mongolia", "Q711"),
  ]),
  b("hard", "Turkmenistan shares a border with which listed country?", entity("Turkmenistan", "Q874"), entity("Afghanistan", "Q889"), [
    entity("Pakistan", "Q843"),
    entity("Kyrgyzstan", "Q813"),
    entity("Mongolia", "Q711"),
  ]),
  b("easy", "Which listed country borders Costa Rica?", entity("Costa Rica", "Q800"), entity("Panama", "Q804"), [
    entity("Belize", "Q242"),
    entity("Honduras", "Q783"),
    entity("Guatemala", "Q774"),
  ]),
  b("easy", "El Salvador has a border with which country?", entity("El Salvador", "Q792"), entity("Honduras", "Q783"), [
    entity("Costa Rica", "Q800"),
    entity("Panama", "Q804"),
    entity("Belize", "Q242"),
  ]),
  b("easy", "Which country appears in Honduras's border list?", entity("Honduras", "Q783"), entity("Nicaragua", "Q811"), [
    entity("Panama", "Q804"),
    entity("Belize", "Q242"),
    entity("Costa Rica", "Q800"),
  ]),
  b("intermediate", "Belize shares a border with which listed country?", entity("Belize", "Q242"), entity("Guatemala", "Q774"), [
    entity("Nicaragua", "Q811"),
    entity("Panama", "Q804"),
    entity("Costa Rica", "Q800"),
  ]),
  b("intermediate", "Guyana has a border with which country listed here?", entity("Guyana", "Q734"), entity("Suriname", "Q730"), [
    entity("Bolivia", "Q750"),
    entity("Uruguay", "Q77"),
    entity("Paraguay", "Q733"),
  ]),
  b("easy", "Which listed country borders Haiti?", entity("Haiti", "Q790"), entity("Dominican Republic", "Q786"), [
    entity("Jamaica", "Q766"),
    entity("Cuba", "Q241"),
    entity("The Bahamas", "Q778"),
  ]),
  b("intermediate", "Papua New Guinea shares a border with which country?", entity("Papua New Guinea", "Q691"), entity("Indonesia", "Q252"), [
    entity("New Zealand", "Q664"),
    entity("Fiji", "Q712"),
    entity("Samoa", "Q683"),
  ]),
];

function buildQuestion(fact: RawFact, index: number): KnowledgeGeographyCieScoreBatchV4Question {
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

export const knowledgeGeographyCieScoreBatchV4Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV4Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV4Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV4Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV4Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV4Questions.map((question) => question.difficulty),
  ),
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV4Questions;
