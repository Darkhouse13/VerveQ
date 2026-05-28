export type SourceType = "structured_open" | "official_statistical";
export type QuestionShape = "mcq" | "numeric_estimation" | "which_came_first";
export type CorruptionType = 1 | 2 | 3 | 4 | 5;
export type Label = "clean" | "corrupted";

export type ProvenanceClaim = {
  claim: string;
  sourceType: SourceType;
  sourceRef: string;
  retrievedAt: string;
  volatility: "static" | "volatile";
};

export type SourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  name: string;
  license: string;
  retrievedAt: string;
  volatility: "static" | "volatile";
  facts: Record<string, unknown>;
};

export type GoldenItem = {
  id: string;
  stem: string;
  shape: QuestionShape;
  correctAnswer: string;
  distractors: string[];
  provenance: { claims: ProvenanceClaim[] };
  label: Label;
  corruptionType?: CorruptionType;
  truth?: Record<string, unknown>;
};

const RETRIEVED_AT = "2026-05-25";

function capitalRef(countryCode: string): string {
  return `wikidata:${countryCode}:P36:snapshot-${RETRIEVED_AT}`;
}

function statRef(source: string, entity: string, year: number): string {
  return `${source}:${entity}:${year}:snapshot-${RETRIEVED_AT}`;
}

function orderRef(slug: string): string {
  return `structured-open:capital-order:${slug}:snapshot-${RETRIEVED_AT}`;
}

function capitalSource(
  sourceRef: string,
  country: string,
  capitals: string[],
  knownNonCapitals: string[],
): SourceRecord {
  return {
    sourceRef,
    sourceType: "structured_open",
    name: `Wikidata CC0 local snapshot: ${country} capital property`,
    license: "CC0 structured fact snapshot",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      country,
      capitalPredicate: "P36",
      capitals,
      knownNonCapitals,
      closedCapitalList: true,
    },
  };
}

function populationSource(
  sourceRef: string,
  name: string,
  entity: string,
  year: number,
  population: number,
): SourceRecord {
  return {
    sourceRef,
    sourceType: "official_statistical",
    name,
    license: "Open-data / IGO statistical fact snapshot",
    retrievedAt: RETRIEVED_AT,
    volatility: "volatile",
    facts: {
      entity,
      year,
      population,
      unit: "people",
    },
  };
}

function orderSource(
  sourceRef: string,
  name: string,
  left: { label: string; event: string; date: string },
  right: { label: string; event: string; date: string },
  first: string,
): SourceRecord {
  return {
    sourceRef,
    sourceType: "structured_open",
    name,
    license: "Open structured chronology snapshot",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts: {
      left,
      right,
      first,
    },
  };
}

function claim(
  text: string,
  sourceRef: string,
  sourceType: SourceType,
  volatility: "static" | "volatile",
): ProvenanceClaim {
  return {
    claim: text,
    sourceType,
    sourceRef,
    retrievedAt: RETRIEVED_AT,
    volatility,
  };
}

function capitalClaims(
  country: string,
  answer: string,
  distractors: string[],
  sourceRef: string,
): ProvenanceClaim[] {
  return [
    claim(`capital_of(${country}) = ${answer}`, sourceRef, "structured_open", "static"),
    ...distractors.map((distractor) =>
      claim(
        `not_capital_of(${country}) = ${distractor}`,
        sourceRef,
        "structured_open",
        "static",
      ),
    ),
  ];
}

function populationClaims(
  entity: string,
  year: number,
  answer: string,
  sourceRef: string,
): ProvenanceClaim[] {
  return [
    claim(
      `population(${entity}, ${year}) = ${answer}`,
      sourceRef,
      "official_statistical",
      "volatile",
    ),
  ];
}

function orderClaims(
  left: string,
  right: string,
  answer: string,
  sourceRef: string,
): ProvenanceClaim[] {
  return [
    claim(
      `came_first(${left}, ${right}) = ${answer}`,
      sourceRef,
      "structured_open",
      "static",
    ),
  ];
}

export const SOURCE_RECORDS: Record<string, SourceRecord> = {
  [capitalRef("Q142")]: capitalSource(capitalRef("Q142"), "France", ["Paris"], [
    "Lyon",
    "Marseille",
    "Nice",
  ]),
  [capitalRef("Q408")]: capitalSource(
    capitalRef("Q408"),
    "Australia",
    ["Canberra"],
    ["Sydney", "Melbourne", "Perth"],
  ),
  [capitalRef("Q43")]: capitalSource(capitalRef("Q43"), "Turkey", ["Ankara"], [
    "Istanbul",
    "Izmir",
    "Bursa",
  ]),
  [capitalRef("Q155")]: capitalSource(capitalRef("Q155"), "Brazil", ["Brasilia"], [
    "Rio de Janeiro",
    "Sao Paulo",
    "Salvador",
  ]),
  [capitalRef("Q1033")]: capitalSource(capitalRef("Q1033"), "Nigeria", ["Abuja"], [
    "Lagos",
    "Kano",
    "Ibadan",
  ]),
  [capitalRef("Q16")]: capitalSource(capitalRef("Q16"), "Canada", ["Ottawa"], [
    "Toronto",
    "Montreal",
    "Vancouver",
  ]),
  [capitalRef("Q17")]: capitalSource(capitalRef("Q17"), "Japan", ["Tokyo"], [
    "Osaka",
    "Kyoto",
    "Yokohama",
  ]),
  [capitalRef("Q668")]: capitalSource(capitalRef("Q668"), "India", ["New Delhi"], [
    "Mumbai",
    "Kolkata",
    "Chennai",
  ]),
  [capitalRef("Q664")]: capitalSource(
    capitalRef("Q664"),
    "New Zealand",
    ["Wellington"],
    ["Auckland", "Christchurch", "Hamilton"],
  ),
  [capitalRef("Q79")]: capitalSource(capitalRef("Q79"), "Egypt", ["Cairo"], [
    "Alexandria",
    "Giza",
    "Luxor",
  ]),
  [capitalRef("Q258")]: capitalSource(
    capitalRef("Q258"),
    "South Africa",
    ["Pretoria", "Cape Town", "Bloemfontein"],
    ["Johannesburg", "Durban", "Gqeberha"],
  ),
  [capitalRef("Q183")]: capitalSource(capitalRef("Q183"), "Germany", ["Berlin"], [
    "Munich",
    "Hamburg",
    "Frankfurt",
  ]),
  [capitalRef("Q38")]: capitalSource(capitalRef("Q38"), "Italy", ["Rome"], [
    "Milan",
    "Naples",
    "Turin",
  ]),
  [capitalRef("Q145")]: capitalSource(
    capitalRef("Q145"),
    "United Kingdom",
    ["London"],
    ["Manchester", "Birmingham", "Liverpool"],
  ),
  [capitalRef("Q884")]: capitalSource(
    capitalRef("Q884"),
    "South Korea",
    ["Seoul"],
    ["Busan", "Incheon", "Daegu"],
  ),
  [statRef("un-wpp", "Nigeria", 2023)]: populationSource(
    statRef("un-wpp", "Nigeria", 2023),
    "United Nations World Population Prospects local snapshot",
    "Nigeria",
    2023,
    223804632,
  ),
  [statRef("ibge-census", "Brazil", 2022)]: populationSource(
    statRef("ibge-census", "Brazil", 2022),
    "IBGE 2022 Census local snapshot",
    "Brazil",
    2022,
    203080756,
  ),
  [statRef("abs-census", "Australia", 2021)]: populationSource(
    statRef("abs-census", "Australia", 2021),
    "Australian Bureau of Statistics 2021 Census local snapshot",
    "Australia",
    2021,
    25422788,
  ),
  [statRef("statcan-census", "Canada", 2021)]: populationSource(
    statRef("statcan-census", "Canada", 2021),
    "Statistics Canada 2021 Census local snapshot",
    "Canada",
    2021,
    36991981,
  ),
  [orderRef("ankara-new-delhi")]: orderSource(
    orderRef("ankara-new-delhi"),
    "Capital chronology local snapshot: Ankara vs New Delhi",
    {
      label: "Ankara",
      event: "became capital of Turkey",
      date: "1923-10-13",
    },
    {
      label: "New Delhi",
      event: "was inaugurated as capital of India",
      date: "1931-02-13",
    },
    "Ankara",
  ),
  [orderRef("canberra-brasilia")]: orderSource(
    orderRef("canberra-brasilia"),
    "Capital chronology local snapshot: Canberra vs Brasilia",
    {
      label: "Canberra",
      event: "was named Australia's federal capital",
      date: "1913-03-12",
    },
    {
      label: "Brasilia",
      event: "was inaugurated as Brazil's federal capital",
      date: "1960-04-21",
    },
    "Canberra",
  ),
  [orderRef("ankara-canberra-seat")]: orderSource(
    orderRef("ankara-canberra-seat"),
    "Capital chronology local snapshot: Ankara vs Canberra seat of government",
    {
      label: "Ankara",
      event: "became capital of Turkey",
      date: "1923-10-13",
    },
    {
      label: "Canberra",
      event: "became Australia's seat of government",
      date: "1927-05-09",
    },
    "Ankara",
  ),
  [orderRef("brasilia-islamabad")]: orderSource(
    orderRef("brasilia-islamabad"),
    "Capital chronology local snapshot: Brasilia vs Islamabad",
    {
      label: "Brasilia",
      event: "was inaugurated as Brazil's federal capital",
      date: "1960-04-21",
    },
    {
      label: "Islamabad",
      event: "became capital of Pakistan",
      date: "1967-08-14",
    },
    "Brasilia",
  ),
  [orderRef("berlin-abuja")]: orderSource(
    orderRef("berlin-abuja"),
    "Capital chronology local snapshot: Berlin vs Abuja",
    {
      label: "Berlin",
      event: "was designated capital of reunified Germany",
      date: "1990-10-03",
    },
    {
      label: "Abuja",
      event: "became capital of Nigeria",
      date: "1991-12-12",
    },
    "Berlin",
  ),
};

export const GOLDEN_GEOGRAPHY_ITEMS: GoldenItem[] = [
  {
    id: "geo-001",
    stem: "What is the capital of France?",
    shape: "mcq",
    correctAnswer: "Paris",
    distractors: ["Lyon", "Marseille", "Nice"],
    provenance: { claims: capitalClaims("France", "Paris", ["Lyon", "Marseille", "Nice"], capitalRef("Q142")) },
    label: "clean",
  },
  {
    id: "geo-002",
    stem: "Which city is Australia's capital?",
    shape: "mcq",
    correctAnswer: "Canberra",
    distractors: ["Sydney", "Melbourne", "Perth"],
    provenance: { claims: capitalClaims("Australia", "Canberra", ["Sydney", "Melbourne", "Perth"], capitalRef("Q408")) },
    label: "clean",
  },
  {
    id: "geo-003",
    stem: "What is the capital of Turkey?",
    shape: "mcq",
    correctAnswer: "Ankara",
    distractors: ["Istanbul", "Izmir", "Bursa"],
    provenance: { claims: capitalClaims("Turkey", "Ankara", ["Istanbul", "Izmir", "Bursa"], capitalRef("Q43")) },
    label: "clean",
  },
  {
    id: "geo-004",
    stem: "Which purpose-built city is Brazil's capital?",
    shape: "mcq",
    correctAnswer: "Brasilia",
    distractors: ["Rio de Janeiro", "Sao Paulo", "Salvador"],
    provenance: { claims: capitalClaims("Brazil", "Brasilia", ["Rio de Janeiro", "Sao Paulo", "Salvador"], capitalRef("Q155")) },
    label: "clean",
  },
  {
    id: "geo-005",
    stem: "What is the capital of Nigeria?",
    shape: "mcq",
    correctAnswer: "Abuja",
    distractors: ["Lagos", "Kano", "Ibadan"],
    provenance: { claims: capitalClaims("Nigeria", "Abuja", ["Lagos", "Kano", "Ibadan"], capitalRef("Q1033")) },
    label: "clean",
  },
  {
    id: "geo-006",
    stem: "What is the capital of Canada?",
    shape: "mcq",
    correctAnswer: "Ottawa",
    distractors: ["Toronto", "Montreal", "Vancouver"],
    provenance: { claims: capitalClaims("Canada", "Ottawa", ["Toronto", "Montreal", "Vancouver"], capitalRef("Q16")) },
    label: "clean",
  },
  {
    id: "geo-007",
    stem: "What is Japan's capital?",
    shape: "mcq",
    correctAnswer: "Tokyo",
    distractors: ["Osaka", "Kyoto", "Yokohama"],
    provenance: { claims: capitalClaims("Japan", "Tokyo", ["Osaka", "Kyoto", "Yokohama"], capitalRef("Q17")) },
    label: "clean",
  },
  {
    id: "geo-008",
    stem: "Which city is India's capital?",
    shape: "mcq",
    correctAnswer: "New Delhi",
    distractors: ["Mumbai", "Kolkata", "Chennai"],
    provenance: { claims: capitalClaims("India", "New Delhi", ["Mumbai", "Kolkata", "Chennai"], capitalRef("Q668")) },
    label: "clean",
  },
  {
    id: "geo-009",
    stem: "What is the capital of New Zealand?",
    shape: "mcq",
    correctAnswer: "Wellington",
    distractors: ["Auckland", "Christchurch", "Hamilton"],
    provenance: { claims: capitalClaims("New Zealand", "Wellington", ["Auckland", "Christchurch", "Hamilton"], capitalRef("Q664")) },
    label: "clean",
  },
  {
    id: "geo-010",
    stem: "What is the capital of Egypt?",
    shape: "mcq",
    correctAnswer: "Cairo",
    distractors: ["Alexandria", "Giza", "Luxor"],
    provenance: { claims: capitalClaims("Egypt", "Cairo", ["Alexandria", "Giza", "Luxor"], capitalRef("Q79")) },
    label: "clean",
  },
  {
    id: "geo-011",
    stem: "Which city is an official capital of South Africa?",
    shape: "mcq",
    correctAnswer: "Bloemfontein",
    distractors: ["Johannesburg", "Durban", "Gqeberha"],
    provenance: { claims: capitalClaims("South Africa", "Bloemfontein", ["Johannesburg", "Durban", "Gqeberha"], capitalRef("Q258")) },
    label: "clean",
  },
  {
    id: "geo-012",
    stem: "According to the 2023 UN population snapshot, what was Nigeria's population?",
    shape: "numeric_estimation",
    correctAnswer: "223,804,632",
    distractors: ["120,000,000", "175,000,000", "301,000,000"],
    provenance: { claims: populationClaims("Nigeria", 2023, "223,804,632", statRef("un-wpp", "Nigeria", 2023)) },
    label: "clean",
  },
  {
    id: "geo-013",
    stem: "According to the 2021 census snapshot, what was Canada's population?",
    shape: "numeric_estimation",
    correctAnswer: "36,991,981",
    distractors: ["25,422,788", "58,000,000", "18,500,000"],
    provenance: { claims: populationClaims("Canada", 2021, "36,991,981", statRef("statcan-census", "Canada", 2021)) },
    label: "clean",
  },
  {
    id: "geo-014",
    stem: "Which became or was inaugurated as a national capital earlier: Ankara or New Delhi?",
    shape: "which_came_first",
    correctAnswer: "Ankara",
    distractors: ["New Delhi"],
    provenance: { claims: orderClaims("Ankara", "New Delhi", "Ankara", orderRef("ankara-new-delhi")) },
    label: "clean",
  },
  {
    id: "geo-015",
    stem: "Which purpose-built capital milestone came first: Canberra being named or Brasilia being inaugurated?",
    shape: "which_came_first",
    correctAnswer: "Canberra",
    distractors: ["Brasilia"],
    provenance: { claims: orderClaims("Canberra", "Brasilia", "Canberra", orderRef("canberra-brasilia")) },
    label: "clean",
  },
  {
    id: "geo-016",
    stem: "What is the capital of Nigeria?",
    shape: "mcq",
    correctAnswer: "Lagos",
    distractors: ["Abuja", "Kano", "Ibadan"],
    provenance: { claims: capitalClaims("Nigeria", "Lagos", ["Abuja", "Kano", "Ibadan"], capitalRef("Q1033")) },
    label: "corrupted",
    corruptionType: 1,
    truth: { correctAnswer: "Abuja", corruption: "Wrong answer: Lagos is not Nigeria's capital." },
  },
  {
    id: "geo-017",
    stem: "Which city is Australia's capital?",
    shape: "mcq",
    correctAnswer: "Sydney",
    distractors: ["Canberra", "Melbourne", "Perth"],
    provenance: { claims: capitalClaims("Australia", "Sydney", ["Canberra", "Melbourne", "Perth"], capitalRef("Q408")) },
    label: "corrupted",
    corruptionType: 1,
    truth: { correctAnswer: "Canberra", corruption: "Wrong answer: Sydney is not Australia's capital." },
  },
  {
    id: "geo-018",
    stem: "What is the capital of Turkey?",
    shape: "mcq",
    correctAnswer: "Istanbul",
    distractors: ["Ankara", "Izmir", "Bursa"],
    provenance: { claims: capitalClaims("Turkey", "Istanbul", ["Ankara", "Izmir", "Bursa"], capitalRef("Q43")) },
    label: "corrupted",
    corruptionType: 1,
    truth: { correctAnswer: "Ankara", corruption: "Wrong answer: Istanbul is not Turkey's capital." },
  },
  {
    id: "geo-019",
    stem: "Which city is an official capital of South Africa?",
    shape: "mcq",
    correctAnswer: "Pretoria",
    distractors: ["Cape Town", "Johannesburg", "Durban"],
    provenance: { claims: capitalClaims("South Africa", "Pretoria", ["Cape Town", "Johannesburg", "Durban"], capitalRef("Q258")) },
    label: "corrupted",
    corruptionType: 2,
    truth: { alsoCorrectDistractor: "Cape Town", corruption: "Cape Town is also an official capital of South Africa." },
  },
  {
    id: "geo-020",
    stem: "Which city is an official capital of South Africa?",
    shape: "mcq",
    correctAnswer: "Cape Town",
    distractors: ["Bloemfontein", "Johannesburg", "Durban"],
    provenance: { claims: capitalClaims("South Africa", "Cape Town", ["Bloemfontein", "Johannesburg", "Durban"], capitalRef("Q258")) },
    label: "corrupted",
    corruptionType: 2,
    truth: { alsoCorrectDistractor: "Bloemfontein", corruption: "Bloemfontein is also an official capital of South Africa." },
  },
  {
    id: "geo-021",
    stem: "Which city is an official capital of South Africa?",
    shape: "mcq",
    correctAnswer: "Bloemfontein",
    distractors: ["Pretoria", "Johannesburg", "Durban"],
    provenance: { claims: capitalClaims("South Africa", "Bloemfontein", ["Pretoria", "Johannesburg", "Durban"], capitalRef("Q258")) },
    label: "corrupted",
    corruptionType: 2,
    truth: { alsoCorrectDistractor: "Pretoria", corruption: "Pretoria is also an official capital of South Africa." },
  },
  {
    id: "geo-022",
    stem: "According to the 2023 UN population snapshot, what was Nigeria's population?",
    shape: "numeric_estimation",
    correctAnswer: "120,000,000",
    distractors: ["223,804,632", "175,000,000", "301,000,000"],
    provenance: { claims: populationClaims("Nigeria", 2023, "120,000,000", statRef("un-wpp", "Nigeria", 2023)) },
    label: "corrupted",
    corruptionType: 3,
    truth: { correctAnswer: "223,804,632", corruption: "Stale/wrong volatile number far below the source value." },
  },
  {
    id: "geo-023",
    stem: "According to the 2022 census snapshot, what was Brazil's population?",
    shape: "numeric_estimation",
    correctAnswer: "120,000,000",
    distractors: ["203,080,756", "78,000,000", "301,000,000"],
    provenance: { claims: populationClaims("Brazil", 2022, "120,000,000", statRef("ibge-census", "Brazil", 2022)) },
    label: "corrupted",
    corruptionType: 3,
    truth: { correctAnswer: "203,080,756", corruption: "Stale/wrong volatile number far below the census value." },
  },
  {
    id: "geo-024",
    stem: "According to the 2021 census snapshot, what was Australia's population?",
    shape: "numeric_estimation",
    correctAnswer: "12,000,000",
    distractors: ["25,422,788", "36,991,981", "55,000,000"],
    provenance: { claims: populationClaims("Australia", 2021, "12,000,000", statRef("abs-census", "Australia", 2021)) },
    label: "corrupted",
    corruptionType: 3,
    truth: { correctAnswer: "25,422,788", corruption: "Stale/wrong volatile number far below the census value." },
  },
  {
    id: "geo-025",
    stem: "Which became its country's seat or capital earlier: Ankara or Canberra?",
    shape: "which_came_first",
    correctAnswer: "Canberra",
    distractors: ["Ankara"],
    provenance: { claims: orderClaims("Ankara", "Canberra", "Canberra", orderRef("ankara-canberra-seat")) },
    label: "corrupted",
    corruptionType: 4,
    truth: { correctAnswer: "Ankara", corruption: "Date/ordering flip: Ankara 1923 predates Canberra's seat-of-government milestone in 1927." },
  },
  {
    id: "geo-026",
    stem: "Which purpose-built capital was inaugurated or became capital earlier: Brasilia or Islamabad?",
    shape: "which_came_first",
    correctAnswer: "Islamabad",
    distractors: ["Brasilia"],
    provenance: { claims: orderClaims("Brasilia", "Islamabad", "Islamabad", orderRef("brasilia-islamabad")) },
    label: "corrupted",
    corruptionType: 4,
    truth: { correctAnswer: "Brasilia", corruption: "Date/ordering flip: Brasilia 1960 predates Islamabad 1967." },
  },
  {
    id: "geo-027",
    stem: "Which capital designation happened earlier: Berlin for reunified Germany or Abuja for Nigeria?",
    shape: "which_came_first",
    correctAnswer: "Abuja",
    distractors: ["Berlin"],
    provenance: { claims: orderClaims("Berlin", "Abuja", "Abuja", orderRef("berlin-abuja")) },
    label: "corrupted",
    corruptionType: 4,
    truth: { correctAnswer: "Berlin", corruption: "Date/ordering flip: Berlin 1990 predates Abuja 1991." },
  },
  {
    id: "geo-028",
    stem: "What is the capital of France?",
    shape: "mcq",
    correctAnswer: "Paris",
    distractors: ["Lyon", "Marseille", "Nice"],
    provenance: { claims: capitalClaims("France", "Paris", ["Lyon", "Marseille", "Nice"], capitalRef("Q38")) },
    label: "corrupted",
    corruptionType: 5,
    truth: { correctAnswer: "Paris", corruption: "Correct fact with provenance mismatch: sourceRef is Italy's capital record." },
  },
  {
    id: "geo-029",
    stem: "What is Japan's capital?",
    shape: "mcq",
    correctAnswer: "Tokyo",
    distractors: ["Osaka", "Kyoto", "Yokohama"],
    provenance: { claims: capitalClaims("Japan", "Tokyo", ["Osaka", "Kyoto", "Yokohama"], capitalRef("Q183")) },
    label: "corrupted",
    corruptionType: 5,
    truth: { correctAnswer: "Tokyo", corruption: "Correct fact with provenance mismatch: sourceRef is Germany's capital record." },
  },
  {
    id: "geo-030",
    stem: "Which city is Australia's capital?",
    shape: "mcq",
    correctAnswer: "Canberra",
    distractors: ["Sydney", "Melbourne", "Perth"],
    provenance: { claims: capitalClaims("Australia", "Canberra", ["Sydney", "Melbourne", "Perth"], capitalRef("Q155")) },
    label: "corrupted",
    corruptionType: 5,
    truth: { correctAnswer: "Canberra", corruption: "Correct fact with provenance mismatch: sourceRef is Brazil's capital record." },
  },
];

export function resolveSourcesForItem(item: GoldenItem): SourceRecord[] {
  const refs = new Set(item.provenance.claims.map((entry) => entry.sourceRef));
  return [...refs].map((ref) => {
    const source = SOURCE_RECORDS[ref];
    if (!source) {
      throw new Error(`Missing source record for ${item.id}: ${ref}`);
    }
    return source;
  });
}

export function verifierVisibleItem(item: GoldenItem): {
  id: string;
  stem: string;
  shape: QuestionShape;
  correctAnswer: string;
  distractors: string[];
  provenance: { claims: ProvenanceClaim[] };
  resolvedSources: SourceRecord[];
} {
  return {
    id: item.id,
    stem: item.stem,
    shape: item.shape,
    correctAnswer: item.correctAnswer,
    distractors: item.distractors,
    provenance: item.provenance,
    resolvedSources: resolveSourcesForItem(item),
  };
}
