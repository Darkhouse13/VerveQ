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

export type KnowledgeGeographyCieScoreBatchV10Question =
  KnowledgeQuestionSeed & {
    provenance: ScoreModeProvenance;
  };

type CurrencyFact = {
  kind: "currency";
  difficulty: Difficulty;
  question: string;
  country: EntityRef;
  currency: EntityRef;
  distractors: [EntityRef, EntityRef, EntityRef];
};

type LanguageFact = {
  kind: "language";
  difficulty: Difficulty;
  question: string;
  country: EntityRef;
  language: EntityRef;
  distractors: [EntityRef, EntityRef, EntityRef];
};

type CoastalStatus = "landlocked" | "coastal";

type CoastalStatusOption = EntityRef & {
  status: CoastalStatus;
  coastlineQuantity?: string;
};

type CoastalStatusFact = {
  kind: "coastalStatus";
  difficulty: Difficulty;
  question: string;
  answerType: CoastalStatus;
  correct: CoastalStatusOption;
  distractors: [
    CoastalStatusOption,
    CoastalStatusOption,
    CoastalStatusOption,
  ];
};

type BorderFact = {
  kind: "border";
  difficulty: Difficulty;
  question: string;
  subject: EntityRef;
  neighbor: EntityRef;
  distractors: [EntityRef, EntityRef, EntityRef];
};

type RawFact = CurrencyFact | LanguageFact | CoastalStatusFact | BorderFact;

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "knowledge_geography_cie_score_v10";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v10";
const RETRIEVED_AT = "2026-06-22";
const AUTHOR_MODEL = "anthropic/claude-opus-4-8";
const VERIFIER_MODEL = "pending_anthropic_verification";
const VERDICT: Verdict = "pending";

function entity(name: string, qid: string): EntityRef {
  return { name, qid };
}

function landlockedCountry(name: string, qid: string): CoastalStatusOption {
  return { name, qid, status: "landlocked" };
}

function coastalCountry(
  name: string,
  qid: string,
  coastlineQuantity: string,
): CoastalStatusOption {
  return { name, qid, status: "coastal", coastlineQuantity };
}

function currencyRef(country: EntityRef, currency: EntityRef) {
  return `wikidata:${country.qid}:P38:${currency.qid}:single-currency:snapshot-${RETRIEVED_AT}`;
}

function languageRef(country: EntityRef, language: EntityRef) {
  return `wikidata:${country.qid}:P37:${language.qid}:single-official-language:snapshot-${RETRIEVED_AT}`;
}

function landlockedRef(country: EntityRef) {
  return `wikidata:${country.qid}:P31:Q123480:landlocked-country:snapshot-${RETRIEVED_AT}`;
}

function coastalRef(country: CoastalStatusOption) {
  return `wikidata:${country.qid}:P5141:coastline:snapshot-${RETRIEVED_AT}`;
}

function borderRef(country: EntityRef) {
  return `wikidata:${country.qid}:P47:closed-land-border-list:snapshot-${RETRIEVED_AT}`;
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
    verdict: VERDICT,
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function currencyClaims(fact: CurrencyFact): ProvenanceClaim[] {
  const sourceRef = currencyRef(fact.country, fact.currency);
  return [
    claim(`currency_of(${fact.country.name}) = ${fact.currency.name}`, sourceRef),
    ...fact.distractors.map((distractor) =>
      claim(`currency_of(${fact.country.name}) != ${distractor.name}`, sourceRef),
    ),
  ];
}

function languageClaims(fact: LanguageFact): ProvenanceClaim[] {
  const sourceRef = languageRef(fact.country, fact.language);
  return [
    claim(
      `official_language_of(${fact.country.name}) = ${fact.language.name}`,
      sourceRef,
    ),
    ...fact.distractors.map((distractor) =>
      claim(
        `official_language_of(${fact.country.name}) != ${distractor.name}`,
        sourceRef,
      ),
    ),
  ];
}

function statusClaim(option: CoastalStatusOption): ProvenanceClaim {
  if (option.status === "landlocked") {
    return claim(
      `coastal_status(${option.name}) = landlocked`,
      landlockedRef(option),
    );
  }
  return claim(`coastal_status(${option.name}) = coastal`, coastalRef(option));
}

function coastalStatusClaims(fact: CoastalStatusFact): ProvenanceClaim[] {
  return [fact.correct, ...fact.distractors].map(statusClaim);
}

function borderClaims(fact: BorderFact): ProvenanceClaim[] {
  const sourceRef = borderRef(fact.subject);
  return [
    claim(
      `shares_land_border_with(${fact.subject.name}, ${fact.neighbor.name})`,
      sourceRef,
    ),
    ...fact.distractors.map((distractor) =>
      claim(
        `not_shares_land_border_with(${fact.subject.name}, ${distractor.name})`,
        sourceRef,
      ),
    ),
  ];
}

function c(
  difficulty: Difficulty,
  question: string,
  country: EntityRef,
  currency: EntityRef,
  distractors: [EntityRef, EntityRef, EntityRef],
): CurrencyFact {
  return { kind: "currency", difficulty, question, country, currency, distractors };
}

function l(
  difficulty: Difficulty,
  question: string,
  country: EntityRef,
  language: EntityRef,
  distractors: [EntityRef, EntityRef, EntityRef],
): LanguageFact {
  return { kind: "language", difficulty, question, country, language, distractors };
}

function s(
  difficulty: Difficulty,
  question: string,
  answerType: CoastalStatus,
  correct: CoastalStatusOption,
  distractors: [
    CoastalStatusOption,
    CoastalStatusOption,
    CoastalStatusOption,
  ],
): CoastalStatusFact {
  return {
    kind: "coastalStatus",
    difficulty,
    question,
    answerType,
    correct,
    distractors,
  };
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

const icelandicKrona = entity("Icelandic króna", "Q131473");
const swissFranc = entity("Swiss franc", "Q25344");
const hungarianForint = entity("Hungarian forint", "Q47190");
const romanianLeu = entity("Romanian leu", "Q131645");
const serbianDinar = entity("Serbian dinar", "Q172524");
const swedishKrona = entity("Swedish krona", "Q122922");
const danishKrone = entity("Danish krone", "Q25417");
const thaiBaht = entity("Thai baht", "Q177882");
const vietnameseDong = entity("Vietnamese đồng", "Q192090");
const turkishLira = entity("Turkish lira", "Q172872");
const ukrainianHryvnia = entity("Ukrainian hryvnia", "Q81893");
const indianRupee = entity("Indian rupee", "Q80524");
const philippinePeso = entity("Philippine peso", "Q17193");

const greek = entity("Greek", "Q9129");
const romanianLanguage = entity("Romanian", "Q7913");
const lithuanian = entity("Lithuanian", "Q9083");
const slovene = entity("Slovene", "Q9063");
const slovak = entity("Slovak", "Q9058");
const danish = entity("Danish", "Q9035");
const norwegian = entity("Norwegian", "Q9043");
const italian = entity("Italian", "Q652");
const georgian = entity("Georgian", "Q8108");
const azerbaijani = entity("Azerbaijani", "Q9292");

const niger = landlockedCountry("Niger", "Q1032");
const chad = landlockedCountry("Chad", "Q657");
const zimbabwe = landlockedCountry("Zimbabwe", "Q954");
const uganda = landlockedCountry("Uganda", "Q1036");
const rwanda = landlockedCountry("Rwanda", "Q1037");
const malawi = landlockedCountry("Malawi", "Q1020");
const paraguay = landlockedCountry("Paraguay", "Q733");
const tajikistan = landlockedCountry("Tajikistan", "Q863");

const australia = coastalCountry("Australia", "Q408", "34000");
const denmarkCoast = coastalCountry("Denmark", "Q35", "7314");
const mexico = coastalCountry("Mexico", "Q96", "9330");
const peru = coastalCountry("Peru", "Q419", "3080");
const turkeyCoast = coastalCountry("Turkey", "Q43", "8333");
const unitedStates = coastalCountry("United States", "Q30", "95471");
const yemen = coastalCountry("Yemen", "Q805", "2500");

const RAW_FACTS: RawFact[] = [
  c("intermediate", "Which currency does Iceland use?", entity("Iceland", "Q189"), icelandicKrona, [
    hungarianForint,
    romanianLeu,
    serbianDinar,
  ]),
  c("intermediate", "Switzerland uses which currency?", entity("Switzerland", "Q39"), swissFranc, [
    swedishKrona,
    danishKrone,
    hungarianForint,
  ]),
  c("intermediate", "Which currency is listed for Hungary?", entity("Hungary", "Q28"), hungarianForint, [
    romanianLeu,
    serbianDinar,
    icelandicKrona,
  ]),
  c("intermediate", "Romania uses which currency?", entity("Romania", "Q218"), romanianLeu, [
    serbianDinar,
    hungarianForint,
    ukrainianHryvnia,
  ]),
  c("hard", "Which currency does Serbia use?", entity("Serbia", "Q403"), serbianDinar, [
    romanianLeu,
    hungarianForint,
    ukrainianHryvnia,
  ]),
  c("intermediate", "Sweden uses which currency?", entity("Sweden", "Q34"), swedishKrona, [
    danishKrone,
    icelandicKrona,
    swissFranc,
  ]),
  c("intermediate", "Which currency is listed for Denmark?", entity("Denmark", "Q35"), danishKrone, [
    swedishKrona,
    icelandicKrona,
    hungarianForint,
  ]),
  c("intermediate", "Thailand uses which currency?", entity("Thailand", "Q869"), thaiBaht, [
    philippinePeso,
    indianRupee,
    vietnameseDong,
  ]),
  c("hard", "Which currency does Vietnam use?", entity("Vietnam", "Q881"), vietnameseDong, [
    thaiBaht,
    philippinePeso,
    indianRupee,
  ]),
  c("intermediate", "Turkey uses which currency?", entity("Turkey", "Q43"), turkishLira, [
    ukrainianHryvnia,
    romanianLeu,
    serbianDinar,
  ]),
  c("intermediate", "Which currency is listed for Ukraine?", entity("Ukraine", "Q212"), ukrainianHryvnia, [
    romanianLeu,
    turkishLira,
    serbianDinar,
  ]),
  c("intermediate", "India uses which currency?", entity("India", "Q668"), indianRupee, [
    philippinePeso,
    thaiBaht,
    vietnameseDong,
  ]),
  c("intermediate", "Which currency does the Philippines use?", entity("Philippines", "Q928"), philippinePeso, [
    indianRupee,
    thaiBaht,
    vietnameseDong,
  ]),
  l("intermediate", "Which official language is listed for Greece?", entity("Greece", "Q41"), greek, [
    italian,
    romanianLanguage,
    slovak,
  ]),
  l("hard", "Romania has which official language?", entity("Romania", "Q218"), romanianLanguage, [
    slovak,
    slovene,
    lithuanian,
  ]),
  l("hard", "Which official language is listed for Lithuania?", entity("Lithuania", "Q37"), lithuanian, [
    slovak,
    slovene,
    danish,
  ]),
  l("hard", "Slovenia has which official language?", entity("Slovenia", "Q215"), slovene, [
    slovak,
    greek,
    lithuanian,
  ]),
  l("hard", "Which official language is listed for Slovakia?", entity("Slovakia", "Q214"), slovak, [
    slovene,
    lithuanian,
    danish,
  ]),
  l("intermediate", "Denmark has which official language?", entity("Denmark", "Q35"), danish, [
    norwegian,
    slovene,
    greek,
  ]),
  l("intermediate", "Which official language is listed for Norway?", entity("Norway", "Q20"), norwegian, [
    danish,
    slovak,
    greek,
  ]),
  l("intermediate", "Italy has which official language?", entity("Italy", "Q38"), italian, [
    greek,
    romanianLanguage,
    slovene,
  ]),
  l("hard", "Which official language is listed for Georgia?", entity("Georgia", "Q230"), georgian, [
    azerbaijani,
    greek,
    lithuanian,
  ]),
  l("hard", "Azerbaijan has which official language?", entity("Azerbaijan", "Q227"), azerbaijani, [
    georgian,
    greek,
    slovak,
  ]),
  s("hard", "Among Niger, Australia, Denmark, and Mexico, which country is landlocked?", "landlocked", niger, [
    australia,
    denmarkCoast,
    mexico,
  ]),
  s("hard", "Of Chad, Peru, Turkey, and Yemen, which one is landlocked?", "landlocked", chad, [
    peru,
    turkeyCoast,
    yemen,
  ]),
  s("intermediate", "From Zimbabwe, United States, Australia, and Denmark, select the landlocked country.", "landlocked", zimbabwe, [
    unitedStates,
    australia,
    denmarkCoast,
  ]),
  s("hard", "Among Uganda, Mexico, Peru, and Turkey, which country is landlocked?", "landlocked", uganda, [
    mexico,
    peru,
    turkeyCoast,
  ]),
  s("hard", "Of Rwanda, United States, Australia, and Yemen, which one is landlocked?", "landlocked", rwanda, [
    unitedStates,
    australia,
    yemen,
  ]),
  s("hard", "From Malawi, Mexico, United States, and Peru, select the landlocked country.", "landlocked", malawi, [
    mexico,
    unitedStates,
    peru,
  ]),
  s("intermediate", "Among Paraguay, Turkey, Australia, and Denmark, which country is landlocked?", "landlocked", paraguay, [
    turkeyCoast,
    australia,
    denmarkCoast,
  ]),
  s("hard", "Of Tajikistan, Mexico, Peru, and Yemen, which one is landlocked?", "landlocked", tajikistan, [
    mexico,
    peru,
    yemen,
  ]),
  b("intermediate", "Spain shares a land border with which country?", entity("Spain", "Q29"), entity("Andorra", "Q228"), [
    entity("Italy", "Q38"),
    entity("Greece", "Q41"),
    entity("Switzerland", "Q39"),
  ]),
  b("intermediate", "Germany has a land border with which listed country?", entity("Germany", "Q183"), entity("Czechia", "Q213"), [
    entity("Italy", "Q38"),
    entity("Spain", "Q29"),
    entity("Sweden", "Q34"),
  ]),
  b("intermediate", "Italy shares a land border with which country?", entity("Italy", "Q38"), entity("Austria", "Q40"), [
    entity("Spain", "Q29"),
    entity("Greece", "Q41"),
    entity("Portugal", "Q45"),
  ]),
  b("intermediate", "Greece has a land border with which listed country?", entity("Greece", "Q41"), entity("Bulgaria", "Q219"), [
    entity("Italy", "Q38"),
    entity("Romania", "Q218"),
    entity("Cyprus", "Q229"),
  ]),
  b("intermediate", "Poland shares a land border with which country?", entity("Poland", "Q36"), entity("Czechia", "Q213"), [
    entity("Sweden", "Q34"),
    entity("Austria", "Q40"),
    entity("Hungary", "Q28"),
  ]),
  b("intermediate", "Sweden has a land border with which listed country?", entity("Sweden", "Q34"), entity("Norway", "Q20"), [
    entity("Denmark", "Q35"),
    entity("Germany", "Q183"),
    entity("Estonia", "Q191"),
  ]),
  b("hard", "Switzerland shares a land border with which country?", entity("Switzerland", "Q39"), entity("Austria", "Q40"), [
    entity("Spain", "Q29"),
    entity("Belgium", "Q31"),
    entity("Czechia", "Q213"),
  ]),
];

function factKind(fact: RawFact) {
  return fact.kind === "coastalStatus" ? fact.answerType : fact.kind;
}

function correctAnswer(fact: RawFact) {
  if (fact.kind === "currency") return fact.currency.name;
  if (fact.kind === "language") return fact.language.name;
  if (fact.kind === "border") return fact.neighbor.name;
  return fact.correct.name;
}

function explanation(fact: RawFact) {
  if (fact.kind === "currency") {
    return `${fact.currency.name} is the currency of ${fact.country.name}.`;
  }
  if (fact.kind === "language") {
    return `${fact.language.name} is the official language listed for ${fact.country.name}.`;
  }
  if (fact.kind === "border") {
    return `${fact.neighbor.name} shares a land border with ${fact.subject.name}.`;
  }
  const status =
    fact.correct.status === "landlocked"
      ? "is listed by Wikidata as a landlocked country"
      : "has a Wikidata coastline statement";
  return `${fact.correct.name} ${status}.`;
}

function claims(fact: RawFact) {
  if (fact.kind === "currency") return currencyClaims(fact);
  if (fact.kind === "language") return languageClaims(fact);
  if (fact.kind === "border") return borderClaims(fact);
  return coastalStatusClaims(fact);
}

function distractors(fact: RawFact): [EntityRef, EntityRef, EntityRef] {
  return fact.distractors;
}

function buildQuestion(
  fact: RawFact,
  index: number,
): KnowledgeGeographyCieScoreBatchV10Question {
  const category = "country_facts";
  const answer = correctAnswer(fact);

  return {
    sport: "knowledge",
    category,
    question: fact.question,
    options: rotateOptions(answer, distractors(fact), index),
    correctAnswer: answer,
    explanation: explanation(fact),
    difficulty: fact.difficulty,
    bucket: bucket(category, fact.difficulty),
    checksum: checksum(index),
    provenance: provenance(claims(fact)),
  };
}

function makeCurrencySourceRecord(fact: CurrencyFact): WikidataSourceRecord {
  return {
    sourceRef: currencyRef(fact.country, fact.currency),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: fact.country,
      property: "P38",
      includedCurrency: fact.currency,
      excludedCurrencies: fact.distractors,
      singleCurrencyCountry: true,
    },
  };
}

function makeLanguageSourceRecord(fact: LanguageFact): WikidataSourceRecord {
  return {
    sourceRef: languageRef(fact.country, fact.language),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: fact.country,
      property: "P37",
      includedOfficialLanguage: fact.language,
      excludedOfficialLanguages: fact.distractors,
      singleOfficialLanguageCountry: true,
    },
  };
}

function makeLandlockedSourceRecord(
  country: CoastalStatusOption,
): WikidataSourceRecord {
  return {
    sourceRef: landlockedRef(country),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: entity(country.name, country.qid),
      property: "P31",
      includedInstance: entity("landlocked country", "Q123480"),
      landlockedCountry: true,
    },
  };
}

function makeCoastalSourceRecord(
  country: CoastalStatusOption,
): WikidataSourceRecord {
  return {
    sourceRef: coastalRef(country),
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      subject: entity(country.name, country.qid),
      property: "P5141",
      coastlineQuantity: country.coastlineQuantity,
      hasCoastlineStatement: true,
    },
  };
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
      includedLandBorder: fact.neighbor,
      excludedLandBorders: fact.distractors,
      landBordersOnly: true,
      closedLandBorderList: true,
    },
  };
}

function upsertStatusSourceRecord(
  records: Map<string, WikidataSourceRecord>,
  country: CoastalStatusOption,
) {
  const record =
    country.status === "landlocked"
      ? makeLandlockedSourceRecord(country)
      : makeCoastalSourceRecord(country);
  records.set(record.sourceRef, record);
}

function buildWikidataSourceRecords(facts: RawFact[]) {
  const records = new Map<string, WikidataSourceRecord>();
  for (const fact of facts) {
    if (fact.kind === "currency") {
      const record = makeCurrencySourceRecord(fact);
      records.set(record.sourceRef, record);
      continue;
    }
    if (fact.kind === "language") {
      const record = makeLanguageSourceRecord(fact);
      records.set(record.sourceRef, record);
      continue;
    }
    if (fact.kind === "border") {
      const record = makeBorderSourceRecord(fact);
      records.set(record.sourceRef, record);
      continue;
    }
    upsertStatusSourceRecord(records, fact.correct);
    for (const distractor of fact.distractors) {
      upsertStatusSourceRecord(records, distractor);
    }
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

export const knowledgeGeographyCieScoreBatchV10Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV10Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV10Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV10Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV10Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV10Questions.map((question) => question.difficulty),
  ),
  countsByCountryFactKind: countBy(RAW_FACTS.map(factKind)),
  wikidataSourcing: {
    currency: "P38, single-currency country direction only",
    language: "P37, single-official-language country direction only",
    landlocked: "P31 instance of Q123480 landlocked country",
    coastal: "P5141 coastline statement present",
    borders: "P47 shares-border-with, land borders only",
  },
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV10Questions;
