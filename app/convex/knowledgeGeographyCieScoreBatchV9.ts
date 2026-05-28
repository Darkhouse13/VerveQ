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

export type KnowledgeGeographyCieScoreBatchV9Question =
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

const BATCH_ID = "knowledge_geography_cie_score_v9";
const WORK_UNIT_ID = "score-mode:knowledge:geography:static:v9";
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

const georgianLari = entity("Georgian lari", "Q4608");
const guatemalanQuetzal = entity("Guatemalan quetzal", "Q207396");
const honduranLempira = entity("Honduran lempira", "Q4719");
const jamaicanDollar = entity("Jamaican dollar", "Q209792");
const kazakhstaniTenge = entity("Kazakhstani tenge", "Q173751");
const kyrgyzSom = entity("Kyrgyz som", "Q35881");
const laoKip = entity("Lao kip", "Q200055");
const malagasyAriary = entity("Malagasy ariary", "Q4584");
const malaysianRinggit = entity("Malaysian ringgit", "Q163712");
const moldovanLeu = entity("Moldovan leu", "Q181129");
const mongolianTogrog = entity("Mongolian togrog", "Q183435");
const nepaleseRupee = entity("Nepalese rupee", "Q202895");
const nigerianNaira = entity("Nigerian naira", "Q203567");
const norwegianKrone = entity("Norwegian krone", "Q132643");
const pakistaniRupee = entity("Pakistani rupee", "Q188289");
const polishZloty = entity("Polish zloty", "Q123213");
const mauritanianOuguiya = entity("Mauritanian ouguiya", "Q207024");
const romanianLeu = entity("Romanian leu", "Q131645");
const serbianDinar = entity("Serbian dinar", "Q172524");
const swedishKrona = entity("Swedish krona", "Q122922");

const kyrgyz = entity("Kyrgyz", "Q9255");
const lao = entity("Lao", "Q9211");
const malay = entity("Malay", "Q9237");
const romanian = entity("Romanian", "Q7913");
const mongolian = entity("Mongolian", "Q9246");
const nepali = entity("Nepali", "Q33823");
const polish = entity("Polish", "Q809");
const serbian = entity("Serbian", "Q9299");
const swedish = entity("Swedish", "Q9027");
const thai = entity("Thai", "Q9217");
const turkish = entity("Turkish", "Q256");
const ukrainian = entity("Ukrainian", "Q8798");
const vietnamese = entity("Vietnamese", "Q9199");
const latvian = entity("Latvian", "Q9078");
const norwegian = entity("Norwegian", "Q9043");

const kyrgyzstan = landlockedCountry("Kyrgyzstan", "Q813");
const moldova = landlockedCountry("Moldova", "Q217");
const northMacedonia = landlockedCountry("North Macedonia", "Q221");
const eswatini = landlockedCountry("Eswatini", "Q1050");
const centralAfricanRepublic = landlockedCountry(
  "Central African Republic",
  "Q929",
);
const burkinaFaso = landlockedCountry("Burkina Faso", "Q965");
const burundi = landlockedCountry("Burundi", "Q967");
const lesotho = landlockedCountry("Lesotho", "Q1013");
const luxembourg = landlockedCountry("Luxembourg", "Q32");
const mali = landlockedCountry("Mali", "Q912");

const australia = coastalCountry("Australia", "Q408", "34000");
const denmark = coastalCountry("Denmark", "Q35", "7314");
const mexico = coastalCountry("Mexico", "Q96", "9330");
const peru = coastalCountry("Peru", "Q419", "3080");
const turkey = coastalCountry("Turkey", "Q43", "8.333");
const unitedStates = coastalCountry("United States", "Q30", "95471");
const yemen = coastalCountry("Yemen", "Q805", "2500");

const RAW_FACTS: RawFact[] = [
  c("hard", "Which currency does Georgia use?", entity("Georgia", "Q230"), georgianLari, [
    guatemalanQuetzal,
    kyrgyzSom,
    moldovanLeu,
  ]),
  c("hard", "Guatemala uses which currency?", entity("Guatemala", "Q774"), guatemalanQuetzal, [
    honduranLempira,
    jamaicanDollar,
    nigerianNaira,
  ]),
  c("intermediate", "Which currency is listed for Honduras?", entity("Honduras", "Q783"), honduranLempira, [
    guatemalanQuetzal,
    pakistaniRupee,
    polishZloty,
  ]),
  c("hard", "Jamaica uses which currency?", entity("Jamaica", "Q766"), jamaicanDollar, [
    nigerianNaira,
    malaysianRinggit,
    norwegianKrone,
  ]),
  c("hard", "Which currency does Kazakhstan use?", entity("Kazakhstan", "Q232"), kazakhstaniTenge, [
    kyrgyzSom,
    mongolianTogrog,
    georgianLari,
  ]),
  c("hard", "Kyrgyzstan uses which currency?", entity("Kyrgyzstan", "Q813"), kyrgyzSom, [
    kazakhstaniTenge,
    laoKip,
    moldovanLeu,
  ]),
  c("hard", "Which currency does Laos use?", entity("Laos", "Q819"), laoKip, [
    malaysianRinggit,
    nepaleseRupee,
    honduranLempira,
  ]),
  c("hard", "Madagascar uses which currency?", entity("Madagascar", "Q1019"), malagasyAriary, [
    mauritanianOuguiya,
    nigerianNaira,
    georgianLari,
  ]),
  c("intermediate", "Which currency is used by Malaysia?", entity("Malaysia", "Q833"), malaysianRinggit, [
    jamaicanDollar,
    laoKip,
    pakistaniRupee,
  ]),
  c("hard", "Moldova uses which currency?", entity("Moldova", "Q217"), moldovanLeu, [
    romanianLeu,
    serbianDinar,
    polishZloty,
  ]),
  c("hard", "Which currency does Mongolia use?", entity("Mongolia", "Q711"), mongolianTogrog, [
    kazakhstaniTenge,
    kyrgyzSom,
    nepaleseRupee,
  ]),
  c("hard", "Nepal uses which currency?", entity("Nepal", "Q837"), nepaleseRupee, [
    pakistaniRupee,
    laoKip,
    malagasyAriary,
  ]),
  c("intermediate", "Which currency does Nigeria use?", entity("Nigeria", "Q1033"), nigerianNaira, [
    jamaicanDollar,
    guatemalanQuetzal,
    norwegianKrone,
  ]),
  c("intermediate", "Norway uses which currency?", entity("Norway", "Q20"), norwegianKrone, [
    swedishKrona,
    polishZloty,
    malaysianRinggit,
  ]),
  c("intermediate", "Which currency is listed for Pakistan?", entity("Pakistan", "Q843"), pakistaniRupee, [
    nepaleseRupee,
    nigerianNaira,
    honduranLempira,
  ]),
  c("intermediate", "Poland uses which currency?", entity("Poland", "Q36"), polishZloty, [
    norwegianKrone,
    moldovanLeu,
    serbianDinar,
  ]),
  l("hard", "Which official language is listed for Kyrgyzstan?", entity("Kyrgyzstan", "Q813"), kyrgyz, [
    lao,
    nepali,
    latvian,
  ]),
  l("hard", "Laos has which official language?", entity("Laos", "Q819"), lao, [
    thai,
    vietnamese,
    malay,
  ]),
  l("intermediate", "Which official language is listed for Malaysia?", entity("Malaysia", "Q833"), malay, [
    lao,
    thai,
    mongolian,
  ]),
  l("hard", "Moldova's official language is which one?", entity("Moldova", "Q217"), romanian, [
    serbian,
    polish,
    latvian,
  ]),
  l("hard", "Which official language is listed for Mongolia?", entity("Mongolia", "Q711"), mongolian, [
    kyrgyz,
    nepali,
    turkish,
  ]),
  l("hard", "Nepal has which official language?", entity("Nepal", "Q837"), nepali, [
    lao,
    vietnamese,
    romanian,
  ]),
  l("intermediate", "Which official language is listed for Poland?", entity("Poland", "Q36"), polish, [
    romanian,
    latvian,
    serbian,
  ]),
  l("hard", "Serbia has which official language?", entity("Serbia", "Q403"), serbian, [
    polish,
    swedish,
    ukrainian,
  ]),
  l("intermediate", "Which official language is listed for Sweden?", entity("Sweden", "Q34"), swedish, [
    norwegian,
    latvian,
    mongolian,
  ]),
  l("intermediate", "Thailand has which official language?", entity("Thailand", "Q869"), thai, [
    lao,
    malay,
    vietnamese,
  ]),
  l("intermediate", "Which official language is listed for Turkey?", entity("Turkey", "Q43"), turkish, [
    ukrainian,
    romanian,
    serbian,
  ]),
  l("intermediate", "Ukraine has which official language?", entity("Ukraine", "Q212"), ukrainian, [
    polish,
    swedish,
    turkish,
  ]),
  l("intermediate", "Which official language is listed for Vietnam?", entity("Vietnam", "Q881"), vietnamese, [
    thai,
    lao,
    malay,
  ]),
  l("hard", "Latvia has which official language?", entity("Latvia", "Q211"), latvian, [
    swedish,
    polish,
    romanian,
  ]),
  s("hard", "Among Kyrgyzstan, Australia, Denmark, and Mexico, which country is landlocked?", "landlocked", kyrgyzstan, [
    australia,
    denmark,
    mexico,
  ]),
  s("intermediate", "Of Moldova, Peru, Turkey, and Yemen, which one is landlocked?", "landlocked", moldova, [
    peru,
    turkey,
    yemen,
  ]),
  s("hard", "From North Macedonia, United States, Australia, and Denmark, select the landlocked country.", "landlocked", northMacedonia, [
    unitedStates,
    australia,
    denmark,
  ]),
  s("hard", "Among Eswatini, Mexico, Peru, and Turkey, which country is landlocked?", "landlocked", eswatini, [
    mexico,
    peru,
    turkey,
  ]),
  s("hard", "Of Central African Republic, United States, Australia, and Denmark, which one is landlocked?", "landlocked", centralAfricanRepublic, [
    unitedStates,
    australia,
    denmark,
  ]),
  s("hard", "From Burkina Faso, Mexico, United States, and Peru, select the landlocked country.", "landlocked", burkinaFaso, [
    mexico,
    unitedStates,
    peru,
  ]),
  s("hard", "Among Burundi, Turkey, Australia, and Yemen, which country is landlocked?", "landlocked", burundi, [
    turkey,
    australia,
    yemen,
  ]),
  s("hard", "Of Lesotho, Denmark, Mexico, and Peru, which one is landlocked?", "landlocked", lesotho, [
    denmark,
    mexico,
    peru,
  ]),
  s("hard", "From Luxembourg, Australia, Turkey, and United States, select the landlocked country.", "landlocked", luxembourg, [
    australia,
    turkey,
    unitedStates,
  ]),
  s("hard", "Among Mali, Denmark, Mexico, and Yemen, which country is landlocked?", "landlocked", mali, [
    denmark,
    mexico,
    yemen,
  ]),
  b("intermediate", "Portugal shares a land border with which country?", entity("Portugal", "Q45"), entity("Spain", "Q29"), [
    entity("France", "Q142"),
    entity("Italy", "Q38"),
    entity("Germany", "Q183"),
  ]),
  b("intermediate", "The Netherlands has a land border with which listed country?", entity("Netherlands", "Q55"), entity("Germany", "Q183"), [
    entity("Denmark", "Q35"),
    entity("Poland", "Q36"),
    entity("Austria", "Q40"),
  ]),
  b("intermediate", "Which country is Denmark's land-border neighbor?", entity("Denmark", "Q35"), entity("Germany", "Q183"), [
    entity("Netherlands", "Q55"),
    entity("Poland", "Q36"),
    entity("Austria", "Q40"),
  ]),
  b("intermediate", "Norway shares a land border with which listed country?", entity("Norway", "Q20"), entity("Sweden", "Q34"), [
    entity("Denmark", "Q35"),
    entity("Germany", "Q183"),
    entity("Poland", "Q36"),
  ]),
  b("hard", "Turkey has a land border with which country listed here?", entity("Turkey", "Q43"), entity("Georgia", "Q230"), [
    entity("Lebanon", "Q822"),
    entity("Jordan", "Q810"),
    entity("Kuwait", "Q817"),
  ]),
  b("hard", "North Macedonia shares a land border with which country?", entity("North Macedonia", "Q221"), entity("Albania", "Q222"), [
    entity("Romania", "Q218"),
    entity("Croatia", "Q224"),
    entity("Slovenia", "Q215"),
  ]),
  b("intermediate", "Ireland's land border is with which country?", entity("Ireland", "Q27"), entity("United Kingdom", "Q145"), [
    entity("France", "Q142"),
    entity("Netherlands", "Q55"),
    entity("Denmark", "Q35"),
  ]),
  b("intermediate", "Egypt shares a land border with which listed country?", entity("Egypt", "Q79"), entity("Libya", "Q1016"), [
    entity("Tunisia", "Q948"),
    entity("Algeria", "Q262"),
    entity("Morocco", "Q1028"),
  ]),
  b("intermediate", "South Africa has a land border with which country?", entity("South Africa", "Q258"), entity("Mozambique", "Q1029"), [
    entity("Angola", "Q916"),
    entity("Zambia", "Q953"),
    entity("Tanzania", "Q924"),
  ]),
  b("intermediate", "India shares a land border with which listed country?", entity("India", "Q668"), entity("Pakistan", "Q843"), [
    entity("Vietnam", "Q881"),
    entity("Thailand", "Q869"),
    entity("South Korea", "Q884"),
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
): KnowledgeGeographyCieScoreBatchV9Question {
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

export const knowledgeGeographyCieScoreBatchV9Questions =
  RAW_FACTS.map(buildQuestion);

export const questions = knowledgeGeographyCieScoreBatchV9Questions;

export const wikidataSourceRecords = buildWikidataSourceRecords(RAW_FACTS);

export const knowledgeGeographyCieScoreBatchV9Metadata = {
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
  questionCount: knowledgeGeographyCieScoreBatchV9Questions.length,
  countsByCategory: countBy(
    knowledgeGeographyCieScoreBatchV9Questions.map((question) => question.category),
  ),
  countsByDifficulty: countBy(
    knowledgeGeographyCieScoreBatchV9Questions.map((question) => question.difficulty),
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

export default knowledgeGeographyCieScoreBatchV9Questions;
