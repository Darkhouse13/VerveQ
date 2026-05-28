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

export type KnowledgeGeographyCieScoreBatchV8Question =
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

type RawFact = CurrencyFact | LanguageFact | CoastalStatusFact;

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "knowledge_geography_cie_score_v8";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v8";
const RETRIEVED_AT = "2026-05-28";
const AUTHOR_MODEL = "openai/gpt-5-codex";
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

const lek = entity("Albanian lek", "Q125999");
const dram = entity("Armenian dram", "Q130498");
const manat = entity("Azerbaijani manat", "Q483725");
const bahrainiDinar = entity("Bahraini dinar", "Q201871");
const taka = entity("Bangladeshi taka", "Q194453");
const barbadianDollar = entity("Barbadian dollar", "Q194351");
const ngultrum = entity("ngultrum", "Q201799");
const pula = entity("Botswana pula", "Q186794");
const real = entity("Brazilian real", "Q173117");
const bruneiDollar = entity("Brunei dollar", "Q206319");
const canadianDollar = entity("Canadian dollar", "Q1104069");
const chileanPeso = entity("Chilean peso", "Q200050");
const colombianPeso = entity("Colombian peso", "Q244819");
const czechKoruna = entity("Czech koruna", "Q131016");
const dominicanPeso = entity("Dominican peso", "Q242922");
const egyptianPound = entity("Egyptian pound", "Q199462");
const ghanaCedi = entity("Ghana cedi", "Q183530");

const albanian = entity("Albanian", "Q8748");
const catalan = entity("Catalan", "Q7026");
const armenian = entity("Armenian", "Q8785");
const bangla = entity("Bangla", "Q9610");
const dzongkha = entity("Dzongkha", "Q33081");
const bulgarian = entity("Bulgarian", "Q7918");
const khmer = entity("Khmer", "Q9205");
const croatian = entity("Croatian", "Q6654");
const czech = entity("Czech", "Q9056");
const estonian = entity("Estonian", "Q9072");
const amharic = entity("Amharic", "Q28244");
const german = entity("German", "Q188");
const hungarian = entity("Hungarian", "Q9067");
const icelandic = entity("Icelandic", "Q294");
const indonesian = entity("Indonesian", "Q9240");
const persian = entity("Persian", "Q9168");
const japanese = entity("Japanese", "Q5287");

const afghanistan = landlockedCountry("Afghanistan", "Q889");
const austria = landlockedCountry("Austria", "Q40");
const bhutan = landlockedCountry("Bhutan", "Q917");
const bolivia = landlockedCountry("Bolivia", "Q750");
const botswana = landlockedCountry("Botswana", "Q963");
const hungary = landlockedCountry("Hungary", "Q28");
const kazakhstan = landlockedCountry("Kazakhstan", "Q232");
const laos = landlockedCountry("Laos", "Q819");
const mongolia = landlockedCountry("Mongolia", "Q711");
const nepal = landlockedCountry("Nepal", "Q837");
const switzerland = landlockedCountry("Switzerland", "Q39");
const zambia = landlockedCountry("Zambia", "Q953");
const uganda = landlockedCountry("Uganda", "Q1036");
const chad = landlockedCountry("Chad", "Q657");
const serbia = landlockedCountry("Serbia", "Q403");
const slovakia = landlockedCountry("Slovakia", "Q214");
const malawi = landlockedCountry("Malawi", "Q1020");

const australia = coastalCountry("Australia", "Q408", "34000");
const denmark = coastalCountry("Denmark", "Q35", "7314");
const mexico = coastalCountry("Mexico", "Q96", "9330");
const peru = coastalCountry("Peru", "Q419", "3080");
const turkey = coastalCountry("Turkey", "Q43", "8.333");
const unitedStates = coastalCountry("United States", "Q30", "95471");
const yemen = coastalCountry("Yemen", "Q805", "2500");

const RAW_FACTS: RawFact[] = [
  c("hard", "Which currency does Albania use?", entity("Albania", "Q222"), lek, [
    dram,
    czechKoruna,
    ghanaCedi,
  ]),
  c("hard", "Armenia uses which currency?", entity("Armenia", "Q399"), dram, [
    manat,
    lek,
    pula,
  ]),
  c("hard", "Which currency is listed for Azerbaijan?", entity("Azerbaijan", "Q227"), manat, [
    dram,
    taka,
    ngultrum,
  ]),
  c("intermediate", "Bahrain uses which currency?", entity("Bahrain", "Q398"), bahrainiDinar, [
    egyptianPound,
    dominicanPeso,
    canadianDollar,
  ]),
  c("intermediate", "Which currency does Bangladesh use?", entity("Bangladesh", "Q902"), taka, [
    ngultrum,
    bruneiDollar,
    chileanPeso,
  ]),
  c("hard", "Barbados uses which currency?", entity("Barbados", "Q244"), barbadianDollar, [
    canadianDollar,
    bruneiDollar,
    colombianPeso,
  ]),
  c("hard", "Which currency does Bhutan use?", entity("Bhutan", "Q917"), ngultrum, [
    taka,
    czechKoruna,
    manat,
  ]),
  c("hard", "Botswana uses which currency?", entity("Botswana", "Q963"), pula, [
    ghanaCedi,
    real,
    egyptianPound,
  ]),
  c("easy", "Which currency does Brazil use?", entity("Brazil", "Q155"), real, [
    colombianPeso,
    chileanPeso,
    dominicanPeso,
  ]),
  c("hard", "Brunei uses which currency?", entity("Brunei", "Q921"), bruneiDollar, [
    barbadianDollar,
    canadianDollar,
    chileanPeso,
  ]),
  c("easy", "Which currency does Canada use?", entity("Canada", "Q16"), canadianDollar, [
    barbadianDollar,
    bruneiDollar,
    ghanaCedi,
  ]),
  c("intermediate", "Chile uses which currency?", entity("Chile", "Q298"), chileanPeso, [
    colombianPeso,
    dominicanPeso,
    lek,
  ]),
  c("intermediate", "Which currency does Colombia use?", entity("Colombia", "Q739"), colombianPeso, [
    chileanPeso,
    dominicanPeso,
    real,
  ]),
  c("hard", "Czechia uses which currency?", entity("Czechia", "Q213"), czechKoruna, [
    lek,
    dram,
    taka,
  ]),
  c("intermediate", "Which currency does the Dominican Republic use?", entity("Dominican Republic", "Q786"), dominicanPeso, [
    chileanPeso,
    barbadianDollar,
    bahrainiDinar,
  ]),
  c("intermediate", "Egypt uses which currency?", entity("Egypt", "Q79"), egyptianPound, [
    bahrainiDinar,
    ghanaCedi,
    pula,
  ]),
  c("intermediate", "Which currency does Ghana use?", entity("Ghana", "Q117"), ghanaCedi, [
    pula,
    egyptianPound,
    real,
  ]),
  l("hard", "Which official language is listed for Albania?", entity("Albania", "Q222"), albanian, [
    catalan,
    bulgarian,
    croatian,
  ]),
  l("hard", "Andorra has which official language?", entity("Andorra", "Q228"), catalan, [
    albanian,
    german,
    icelandic,
  ]),
  l("hard", "Armenia's single official language is which one?", entity("Armenia", "Q399"), armenian, [
    persian,
    hungarian,
    estonian,
  ]),
  l("intermediate", "Bangladesh has which official language?", entity("Bangladesh", "Q902"), bangla, [
    khmer,
    dzongkha,
    indonesian,
  ]),
  l("hard", "Which official language is listed for Bhutan?", entity("Bhutan", "Q917"), dzongkha, [
    bangla,
    khmer,
    japanese,
  ]),
  l("intermediate", "Bulgaria has which official language?", entity("Bulgaria", "Q219"), bulgarian, [
    croatian,
    czech,
    albanian,
  ]),
  l("hard", "Which official language is listed for Cambodia?", entity("Cambodia", "Q424"), khmer, [
    bangla,
    dzongkha,
    indonesian,
  ]),
  l("hard", "Croatia has which official language?", entity("Croatia", "Q224"), croatian, [
    bulgarian,
    czech,
    estonian,
  ]),
  l("intermediate", "Which official language is listed for Czechia?", entity("Czechia", "Q213"), czech, [
    croatian,
    hungarian,
    bulgarian,
  ]),
  l("hard", "Estonia has which official language?", entity("Estonia", "Q191"), estonian, [
    icelandic,
    hungarian,
    german,
  ]),
  l("hard", "Which official language is listed for Ethiopia?", entity("Ethiopia", "Q115"), amharic, [
    persian,
    armenian,
    bangla,
  ]),
  l("easy", "Germany has which official language?", entity("Germany", "Q183"), german, [
    icelandic,
    catalan,
    albanian,
  ]),
  l("intermediate", "Which official language is listed for Hungary?", entity("Hungary", "Q28"), hungarian, [
    estonian,
    czech,
    croatian,
  ]),
  l("hard", "Iceland has which official language?", entity("Iceland", "Q189"), icelandic, [
    german,
    estonian,
    catalan,
  ]),
  l("intermediate", "Which official language is listed for Indonesia?", entity("Indonesia", "Q252"), indonesian, [
    khmer,
    bangla,
    japanese,
  ]),
  l("hard", "Iran has which official language?", entity("Iran", "Q794"), persian, [
    armenian,
    amharic,
    dzongkha,
  ]),
  l("easy", "Which official language is listed for Japan?", entity("Japan", "Q17"), japanese, [
    indonesian,
    khmer,
    bangla,
  ]),
  s("intermediate", "Among Afghanistan, Australia, Mexico, and Peru, which country is landlocked?", "landlocked", afghanistan, [
    australia,
    mexico,
    peru,
  ]),
  s("intermediate", "Of Austria, Denmark, Turkey, and Yemen, which one is landlocked?", "landlocked", austria, [
    denmark,
    turkey,
    yemen,
  ]),
  s("hard", "From Bhutan, Australia, Peru, and Mexico, select the landlocked country.", "landlocked", bhutan, [
    australia,
    peru,
    mexico,
  ]),
  s("intermediate", "Among Bolivia, Denmark, United States, and Yemen, which country is landlocked?", "landlocked", bolivia, [
    denmark,
    unitedStates,
    yemen,
  ]),
  s("hard", "Of Botswana, Australia, Turkey, and Peru, which one is landlocked?", "landlocked", botswana, [
    australia,
    turkey,
    peru,
  ]),
  s("intermediate", "From Hungary, Mexico, Denmark, and United States, select the landlocked country.", "landlocked", hungary, [
    mexico,
    denmark,
    unitedStates,
  ]),
  s("hard", "Among Kazakhstan, Australia, Peru, and Yemen, which country is landlocked?", "landlocked", kazakhstan, [
    australia,
    peru,
    yemen,
  ]),
  s("intermediate", "Of Laos, Mexico, Turkey, and Denmark, which one is landlocked?", "landlocked", laos, [
    mexico,
    turkey,
    denmark,
  ]),
  s("hard", "From Mongolia, Australia, United States, and Peru, select the landlocked country.", "landlocked", mongolia, [
    australia,
    unitedStates,
    peru,
  ]),
  s("intermediate", "Among Nepal, Yemen, Mexico, and Denmark, which country is landlocked?", "landlocked", nepal, [
    yemen,
    mexico,
    denmark,
  ]),
  s("intermediate", "Of Switzerland, Australia, Turkey, and United States, which one is landlocked?", "landlocked", switzerland, [
    australia,
    turkey,
    unitedStates,
  ]),
  s("hard", "From Zambia, Peru, Denmark, and Mexico, select the landlocked country.", "landlocked", zambia, [
    peru,
    denmark,
    mexico,
  ]),
  s("easy", "Among Australia, Austria, Hungary, and Laos, which country has a sea coastline?", "coastal", australia, [
    austria,
    hungary,
    laos,
  ]),
  s("hard", "Of Denmark, Switzerland, Mongolia, and Bhutan, which one has a sea coastline?", "coastal", denmark, [
    switzerland,
    mongolia,
    bhutan,
  ]),
  s("intermediate", "From Mexico, Kazakhstan, Bolivia, and Nepal, select the coastal country.", "coastal", mexico, [
    kazakhstan,
    bolivia,
    nepal,
  ]),
  s("intermediate", "Among Peru, Botswana, Uganda, and Chad, which country has a sea coastline?", "coastal", peru, [
    botswana,
    uganda,
    chad,
  ]),
  s("easy", "Of United States, Serbia, Slovakia, and Malawi, which one has a sea coastline?", "coastal", unitedStates, [
    serbia,
    slovakia,
    malawi,
  ]),
];

function factKind(fact: RawFact) {
  return fact.kind === "coastalStatus" ? fact.answerType : fact.kind;
}

function correctAnswer(fact: RawFact) {
  if (fact.kind === "currency") return fact.currency.name;
  if (fact.kind === "language") return fact.language.name;
  return fact.correct.name;
}

function explanation(fact: RawFact) {
  if (fact.kind === "currency") {
    return `${fact.currency.name} is the currency of ${fact.country.name}.`;
  }
  if (fact.kind === "language") {
    return `${fact.language.name} is the official language listed for ${fact.country.name}.`;
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
  return coastalStatusClaims(fact);
}

function distractors(fact: RawFact): [EntityRef, EntityRef, EntityRef] {
  return fact.distractors;
}

function buildQuestion(
  fact: RawFact,
  index: number,
): KnowledgeGeographyCieScoreBatchV8Question {
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

export const knowledgeGeographyCieScoreBatchV8Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV8Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV8Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV8Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV8Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV8Questions.map((question) => question.difficulty),
  ),
  countsByCountryFactKind: countBy(RAW_FACTS.map(factKind)),
  wikidataSourcing: {
    currency: "P38, single-currency country direction only",
    language: "P37, single-official-language country direction only",
    landlocked: "P31 instance of Q123480 landlocked country",
    coastal: "P5141 coastline statement present",
  },
  checksumConvention:
    "Bundled seed module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
  checksumPrefix: BATCH_ID,
} as const;

export default knowledgeGeographyCieScoreBatchV8Questions;
