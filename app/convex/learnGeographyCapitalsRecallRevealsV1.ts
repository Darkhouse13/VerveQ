import type { SkillNodeId } from "./learnSkillGraph";
import type { LearnModeDistractor } from "./learnGeographyNonobviousLadderV1";

type SourceType = "structured_open";
type SourceLicense = "CC0-1.0";
type Volatility = "static";
type Verdict = "pending" | "agree" | "disagree" | "flag";

type EntityRef = {
  name: string;
  qid: string;
};

type CapitalName = {
  name: string;
};

type ProvenanceClaim = {
  claim: string;
  sourceType: SourceType;
  sourceRef: string;
  retrievedAt: string;
  volatility: Volatility;
};

type SourceClaim = ProvenanceClaim & {
  facts: Record<string, unknown>;
};

type LearnModeProvenance = {
  claims: ProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: Verdict;
  batchId: string;
  workUnitId: string;
};

type SourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: SourceLicense;
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

export type LearnGeographyCapitalsRecallReveal = {
  skillNodes: SkillNodeId[];
  distractors: LearnModeDistractor[];
  correctReveal: string;
  provenance: LearnModeProvenance;
};

type DistractorCapital = {
  country: EntityRef;
  capital: CapitalName;
};

type RawRecallReveal = {
  checksum: string;
  skillNodes: SkillNodeId[];
  country: EntityRef;
  capital: EntityRef;
  correctReveal: string;
  hookClaims: SourceClaim[];
  distractors: [DistractorCapital, DistractorCapital, DistractorCapital];
};

const BATCH_ID = "learn_geography_capitals_recall_reveals_v1";
const WORK_UNIT_ID = "learn:knowledge:geography:capital-recall:v1";
const RETRIEVED_AT = "2026-05-28";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "anthropic/claude-opus-4-8";
const VERIFIED_AT = "2026-05-28";
const RECALL_NODE_IDS = [
  "geo.capitals.core",
  "geo.capitals.europe",
  "geo.capitals.asia",
  "geo.capitals.other",
] as const satisfies readonly SkillNodeId[];

// Independent Anthropic verification of the NEW reveal facts (correctReveal hooks
// and per-distractor capital claims) keyed by the already-verified CIE checksum.
// Each correctReveal hook was fact-checked against its cited Wikidata claim, each
// distractor capital was confirmed correct, and no correctReveal restates the
// answer as a tautology. Fail-closed: any checksum without an explicit "agree"
// (i.e. pending/flag/disagree) is treated as not shippable by the validator.
const VERDICTS_BY_CHECKSUM: Record<string, Verdict> = {
  knowledge_geography_cie_score_v1_001: "agree",
  knowledge_geography_cie_score_v1_002: "agree",
  knowledge_geography_cie_score_v1_003: "agree",
  knowledge_geography_cie_score_v1_004: "agree",
  knowledge_geography_cie_score_v1_005: "agree",
  knowledge_geography_cie_score_v1_007: "agree",
  knowledge_geography_cie_score_v1_010: "agree",
  knowledge_geography_cie_score_v1_011: "agree",
  knowledge_geography_cie_score_v1_012: "agree",
  knowledge_geography_cie_score_v1_013: "agree",
  knowledge_geography_cie_score_v1_014: "agree",
  knowledge_geography_cie_score_v1_015: "agree",
  knowledge_geography_cie_score_v1_016: "agree",
  knowledge_geography_cie_score_v1_018: "agree",
  knowledge_geography_cie_score_v1_019: "agree",
  knowledge_geography_cie_score_v1_021: "agree",
  knowledge_geography_cie_score_v1_022: "agree",
  knowledge_geography_cie_score_v2_003: "agree",
  knowledge_geography_cie_score_v2_005: "agree",
  knowledge_geography_cie_score_v2_009: "agree",
  knowledge_geography_cie_score_v2_017: "agree",
  knowledge_geography_cie_score_v2_020: "agree",
  knowledge_geography_cie_score_v2_023: "agree",
  knowledge_geography_cie_score_v2_024: "agree",
};

function verdictFor(checksum: string): Verdict {
  return VERDICTS_BY_CHECKSUM[checksum] ?? "pending";
}

function aggregateVerdict(verdicts: Verdict[]): Verdict {
  if (verdicts.length === 0 || verdicts.some((v) => v === "pending")) return "pending";
  if (verdicts.some((v) => v === "disagree")) return "disagree";
  if (verdicts.some((v) => v === "flag")) return "flag";
  return "agree";
}

function entity(name: string, qid: string): EntityRef {
  return { name, qid };
}

function capitalName(name: string): CapitalName {
  return { name };
}

function capitalRef(country: EntityRef) {
  return `wikidata:${country.qid}:P36:closed-capital-list:snapshot-${RETRIEVED_AT}`;
}

function propertyRef(subject: EntityRef, property: string, value?: EntityRef) {
  return `wikidata:${subject.qid}:${property}${
    value ? `:${value.qid}` : ""
  }:snapshot-${RETRIEVED_AT}`;
}

function sourceClaim(
  claim: string,
  sourceRef: string,
  facts: Record<string, unknown>,
): SourceClaim {
  return {
    claim,
    sourceType: "structured_open",
    sourceRef,
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts,
  };
}

function capitalClaim(country: EntityRef, capital: CapitalName): SourceClaim {
  return sourceClaim(`capital_of(${country.name}) = ${capital.name}`, capitalRef(country), {
    subject: country,
    property: "P36",
    capital,
  });
}

function locatedOnFeature(city: EntityRef, feature: EntityRef): SourceClaim {
  return sourceClaim(
    `located_on_feature(${city.name}) = ${feature.name}`,
    propertyRef(city, "P206", feature),
    {
      subject: city,
      property: "P206",
      value: feature,
    },
  );
}

function locatedOnTerrainFeature(city: EntityRef, feature: EntityRef): SourceClaim {
  return sourceClaim(
    `located_on_terrain_feature(${city.name}) = ${feature.name}`,
    propertyRef(city, "P706", feature),
    {
      subject: city,
      property: "P706",
      value: feature,
    },
  );
}

function instanceOf(city: EntityRef, instance: EntityRef): SourceClaim {
  return sourceClaim(
    `instance_of(${city.name}) = ${instance.name}`,
    propertyRef(city, "P31", instance),
    {
      subject: city,
      property: "P31",
      value: instance,
    },
  );
}

function inception(city: EntityRef, date: string): SourceClaim {
  return sourceClaim(`inception(${city.name}) = ${date}`, propertyRef(city, "P571"), {
    subject: city,
    property: "P571",
    value: date,
  });
}

function capitalOfEntity(city: EntityRef, polity: EntityRef): SourceClaim {
  return sourceClaim(
    `capital_of_entity(${city.name}) = ${polity.name}`,
    propertyRef(city, "P1376", polity),
    {
      subject: city,
      property: "P1376",
      value: polity,
    },
  );
}

function d(country: EntityRef, capital: string): DistractorCapital {
  return {
    country,
    capital: capitalName(capital),
  };
}

function reveal(
  checksum: string,
  skillNodes: SkillNodeId[],
  country: EntityRef,
  capital: EntityRef,
  correctReveal: string,
  hookClaims: SourceClaim[],
  distractors: [DistractorCapital, DistractorCapital, DistractorCapital],
): RawRecallReveal {
  return {
    checksum,
    skillNodes,
    country,
    capital,
    correctReveal,
    hookClaims,
    distractors,
  };
}

function provenanceClaims(raw: RawRecallReveal): SourceClaim[] {
  return [
    capitalClaim(raw.country, raw.capital),
    ...raw.distractors.map((distractor) =>
      capitalClaim(distractor.country, distractor.capital),
    ),
    ...raw.hookClaims,
  ];
}

function publicClaim({ facts: _facts, ...claim }: SourceClaim): ProvenanceClaim {
  return claim;
}

function provenance(raw: RawRecallReveal): LearnModeProvenance {
  return {
    claims: provenanceClaims(raw).map(publicClaim),
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict: verdictFor(raw.checksum),
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function buildDistractor(
  targetCapital: EntityRef,
  distractor: DistractorCapital,
): LearnModeDistractor {
  return {
    text: distractor.country.name,
    misconception: "same-region capital recall distractor",
    whyChosen:
      "It is a plausible country option in the same recall neighborhood as the answer.",
    reveal: `The capital of ${distractor.country.name} is ${distractor.capital.name}, not ${targetCapital.name}.`,
  };
}

function buildReveal(raw: RawRecallReveal): LearnGeographyCapitalsRecallReveal {
  return {
    skillNodes: raw.skillNodes,
    distractors: raw.distractors.map((distractor) =>
      buildDistractor(raw.capital, distractor),
    ),
    correctReveal: raw.correctReveal,
    provenance: provenance(raw),
  };
}

const core: SkillNodeId = "geo.capitals.core";
const europe: SkillNodeId = "geo.capitals.europe";
const asia: SkillNodeId = "geo.capitals.asia";
const other: SkillNodeId = "geo.capitals.other";

const japan = entity("Japan", "Q17");
const southKorea = entity("South Korea", "Q884");
const china = entity("China", "Q148");
const vietnam = entity("Vietnam", "Q881");
const egypt = entity("Egypt", "Q79");
const morocco = entity("Morocco", "Q1028");
const algeria = entity("Algeria", "Q262");
const tunisia = entity("Tunisia", "Q948");
const germany = entity("Germany", "Q183");
const austria = entity("Austria", "Q40");
const switzerland = entity("Switzerland", "Q39");
const netherlands = entity("Netherlands", "Q55");
const mexico = entity("Mexico", "Q96");
const guatemala = entity("Guatemala", "Q774");
const colombia = entity("Colombia", "Q739");
const chile = entity("Chile", "Q298");
const norway = entity("Norway", "Q20");
const sweden = entity("Sweden", "Q34");
const finland = entity("Finland", "Q33");
const denmark = entity("Denmark", "Q35");
const thailand = entity("Thailand", "Q869");
const cambodia = entity("Cambodia", "Q424");
const malaysia = entity("Malaysia", "Q833");
const kenya = entity("Kenya", "Q114");
const tanzania = entity("Tanzania", "Q924");
const uganda = entity("Uganda", "Q1036");
const ethiopia = entity("Ethiopia", "Q115");
const bangladesh = entity("Bangladesh", "Q902");
const nepal = entity("Nepal", "Q837");
const sriLanka = entity("Sri Lanka", "Q854");
const myanmar = entity("Myanmar", "Q836");
const portugal = entity("Portugal", "Q45");
const spain = entity("Spain", "Q29");
const italy = entity("Italy", "Q38");
const greece = entity("Greece", "Q41");
const cyprus = entity("Cyprus", "Q229");
const turkey = entity("Turkey", "Q43");
const france = entity("France", "Q142");
const croatia = entity("Croatia", "Q224");
const slovenia = entity("Slovenia", "Q215");
const bosniaHerzegovina = entity("Bosnia and Herzegovina", "Q225");
const serbia = entity("Serbia", "Q403");
const hungary = entity("Hungary", "Q28");
const slovakia = entity("Slovakia", "Q214");
const czechia = entity("Czechia", "Q213");
const saudiArabia = entity("Saudi Arabia", "Q851");
const jordan = entity("Jordan", "Q810");
const oman = entity("Oman", "Q842");
const unitedArabEmirates = entity("United Arab Emirates", "Q878");
const laos = entity("Laos", "Q819");
const northKorea = entity("North Korea", "Q423");
const bhutan = entity("Bhutan", "Q917");
const pakistan = entity("Pakistan", "Q843");
const canada = entity("Canada", "Q16");
const unitedStates = entity("United States", "Q30");
const australia = entity("Australia", "Q408");
const newZealand = entity("New Zealand", "Q664");
const brazil = entity("Brazil", "Q155");
const argentina = entity("Argentina", "Q414");
const peru = entity("Peru", "Q419");
const bolivia = entity("Bolivia", "Q750");
const ecuador = entity("Ecuador", "Q736");
const uruguay = entity("Uruguay", "Q77");
const paraguay = entity("Paraguay", "Q733");

const tokyo = entity("Tokyo", "Q1490");
const cairo = entity("Cairo", "Q85");
const berlin = entity("Berlin", "Q64");
const mexicoCity = entity("Mexico City", "Q1489");
const oslo = entity("Oslo", "Q585");
const bangkok = entity("Bangkok", "Q1861");
const nairobi = entity("Nairobi", "Q3870");
const dhaka = entity("Dhaka", "Q1354");
const lisbon = entity("Lisbon", "Q597");
const athens = entity("Athens", "Q1524");
const rome = entity("Rome", "Q220");
const madrid = entity("Madrid", "Q2807");
const vienna = entity("Vienna", "Q1741");
const zagreb = entity("Zagreb", "Q1435");
const hanoi = entity("Hanoi", "Q1858");
const seoul = entity("Seoul", "Q8684");
const beijing = entity("Beijing", "Q956");
const riyadh = entity("Riyadh", "Q3692");
const kathmandu = entity("Kathmandu", "Q3037");
const ottawa = entity("Ottawa", "Q1930");
const brasilia = entity("Brasilia", "Q2844");
const lima = entity("Lima", "Q2868");
const buenosAires = entity("Buenos Aires", "Q1486");
const washingtonDc = entity("Washington, D.C.", "Q61");

const tokyoBay = entity("Tokyo Bay", "Q141017");
const nile = entity("Nile", "Q3392");
const spree = entity("Spree", "Q1684");
const lakeTexcoco = entity("Lake Texcoco", "Q13700");
const oslofjord = entity("Oslofjord", "Q667456");
const chaoPhrayaRiver = entity("Chao Phraya River", "Q118850");
const eastPakistan = entity("East Pakistan", "Q842931");
const tagusRiver = entity("Tagus River", "Q14294");
const attica = entity("Attica", "Q122443");
const tiber = entity("Tiber", "Q13712");
const manzanares = entity("Manzanares", "Q16512");
const danube = entity("Danube", "Q1653");
const sava = entity("Sava", "Q14383");
const redRiver = entity("Red River", "Q206850");
const hanRiver = entity("Han River", "Q55500");
const directAdministeredMunicipality = entity(
  "direct-administered municipality",
  "Q1208802",
);
const bagmatiRiver = entity("Bagmati River", "Q4461769");
const ottawaRiver = entity("Ottawa River", "Q60974");
const plannedNationalCapital = entity("planned national capital", "Q15840617");
const rimacRiver = entity("Rimac River", "Q1343245");
const rioDeLaPlata = entity("Rio de la Plata", "Q35827");
const potomacRiver = entity("Potomac River", "Q179444");

const RAW_REVEALS: RawRecallReveal[] = [
  reveal(
    "knowledge_geography_cie_score_v1_001",
    [core, asia],
    japan,
    tokyo,
    "Tokyo sits on Tokyo Bay, so pair Japan with the capital that carries the bay-name anchor.",
    [locatedOnFeature(tokyo, tokyoBay)],
    [d(southKorea, "Seoul"), d(china, "Beijing"), d(vietnam, "Hanoi")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_004",
    [core, other],
    egypt,
    cairo,
    "Cairo sits on the Nile, giving Egypt's capital an immediate river anchor.",
    [locatedOnFeature(cairo, nile)],
    [d(morocco, "Rabat"), d(algeria, "Algiers"), d(tunisia, "Tunis")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_005",
    [core, europe],
    germany,
    berlin,
    "Berlin sits on the Spree, a compact river hook for Germany's capital.",
    [locatedOnFeature(berlin, spree)],
    [d(austria, "Vienna"), d(switzerland, "Bern"), d(netherlands, "Amsterdam")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_007",
    [core, other],
    mexico,
    mexicoCity,
    "Mexico City is recorded on Lake Texcoco, tying Mexico's capital to a lake-name anchor.",
    [locatedOnFeature(mexicoCity, lakeTexcoco)],
    [d(guatemala, "Guatemala City"), d(colombia, "Bogota"), d(chile, "Santiago")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_010",
    [core, europe],
    norway,
    oslo,
    "Oslo sits on the Oslofjord, so Norway's capital shares its name with a fjord.",
    [locatedOnFeature(oslo, oslofjord)],
    [d(sweden, "Stockholm"), d(finland, "Helsinki"), d(denmark, "Copenhagen")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_011",
    [core, other],
    kenya,
    nairobi,
    "Nairobi's inception is recorded as 1899, giving Kenya's capital a clear year anchor.",
    [inception(nairobi, "1899-01-01")],
    [d(tanzania, "Dodoma"), d(uganda, "Kampala"), d(ethiopia, "Addis Ababa")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_014",
    [core, asia],
    thailand,
    bangkok,
    "Bangkok sits on the Chao Phraya River, the river anchor for Thailand's capital.",
    [locatedOnFeature(bangkok, chaoPhrayaRiver)],
    [d(vietnam, "Hanoi"), d(cambodia, "Phnom Penh"), d(malaysia, "Kuala Lumpur")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_023",
    [core, asia],
    bangladesh,
    dhaka,
    "Dhaka was also a capital of East Pakistan, a strong history anchor for Bangladesh.",
    [capitalOfEntity(dhaka, eastPakistan)],
    [
      d(nepal, "Kathmandu"),
      d(sriLanka, "Sri Jayawardenepura Kotte"),
      d(myanmar, "Naypyidaw"),
    ],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_012",
    [europe],
    portugal,
    lisbon,
    "Lisbon sits on the Tagus River, a river-name anchor for Portugal's capital.",
    [locatedOnFeature(lisbon, tagusRiver)],
    [d(spain, "Madrid"), d(italy, "Rome"), d(greece, "Athens")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_013",
    [europe],
    greece,
    athens,
    "Athens lies in Attica, a regional hook that points back to Greece.",
    [locatedOnTerrainFeature(athens, attica)],
    [d(cyprus, "Nicosia"), d(turkey, "Ankara"), d(italy, "Rome")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_018",
    [europe],
    italy,
    rome,
    "Rome sits on the Tiber, a clean river anchor for Italy's capital.",
    [locatedOnFeature(rome, tiber)],
    [d(france, "Paris"), d(spain, "Madrid"), d(germany, "Berlin")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_019",
    [europe],
    spain,
    madrid,
    "Madrid sits on the Manzanares River, a river hook for Spain's capital.",
    [locatedOnFeature(madrid, manzanares)],
    [d(portugal, "Lisbon"), d(france, "Paris"), d(italy, "Rome")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_009",
    [europe],
    austria,
    vienna,
    "Vienna sits on the Danube, tying Austria's capital to the Danube river name.",
    [locatedOnFeature(vienna, danube)],
    [d(hungary, "Budapest"), d(slovakia, "Bratislava"), d(czechia, "Prague")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_017",
    [europe],
    croatia,
    zagreb,
    "Zagreb sits on the Sava River, a river anchor for Croatia's capital.",
    [locatedOnFeature(zagreb, sava)],
    [
      d(slovenia, "Ljubljana"),
      d(bosniaHerzegovina, "Sarajevo"),
      d(serbia, "Belgrade"),
    ],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_015",
    [asia],
    vietnam,
    hanoi,
    "Hanoi sits on the Red River, a color-name anchor for Vietnam's capital.",
    [locatedOnFeature(hanoi, redRiver)],
    [d(laos, "Vientiane"), d(cambodia, "Phnom Penh"), d(thailand, "Bangkok")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_021",
    [asia],
    southKorea,
    seoul,
    "Seoul sits on the Han River, a short river hook for South Korea's capital.",
    [locatedOnFeature(seoul, hanRiver)],
    [d(japan, "Tokyo"), d(northKorea, "Pyongyang"), d(china, "Beijing")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_005",
    [asia],
    china,
    beijing,
    "Beijing is a direct-administered municipality, so China's capital is also a top-level city unit.",
    [instanceOf(beijing, directAdministeredMunicipality)],
    [d(japan, "Tokyo"), d(southKorea, "Seoul"), d(vietnam, "Hanoi")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_020",
    [asia],
    saudiArabia,
    riyadh,
    "Riyadh's inception is recorded as 1746, giving Saudi Arabia's capital an 18th-century date hook.",
    [inception(riyadh, "1746")],
    [d(jordan, "Amman"), d(oman, "Muscat"), d(unitedArabEmirates, "Abu Dhabi")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_024",
    [asia],
    nepal,
    kathmandu,
    "Kathmandu sits on the Bagmati River, a river-name anchor for Nepal's capital.",
    [locatedOnFeature(kathmandu, bagmatiRiver)],
    [d(bhutan, "Thimphu"), d(bangladesh, "Dhaka"), d(pakistan, "Islamabad")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_002",
    [other],
    canada,
    ottawa,
    "Ottawa sits on the Ottawa River, giving Canada's capital a same-name river anchor.",
    [locatedOnFeature(ottawa, ottawaRiver)],
    [
      d(unitedStates, "Washington, D.C."),
      d(australia, "Canberra"),
      d(newZealand, "Wellington"),
    ],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_003",
    [other],
    brazil,
    brasilia,
    "Brasilia is recorded as a planned national capital with a 1960 inception date.",
    [instanceOf(brasilia, plannedNationalCapital), inception(brasilia, "1960-04-21")],
    [d(argentina, "Buenos Aires"), d(colombia, "Bogota"), d(peru, "Lima")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_016",
    [other],
    peru,
    lima,
    "Lima sits on the Rimac River, a river-name anchor for Peru's capital.",
    [locatedOnFeature(lima, rimacRiver)],
    [d(bolivia, "Sucre"), d(ecuador, "Quito"), d(chile, "Santiago")],
  ),
  reveal(
    "knowledge_geography_cie_score_v1_022",
    [other],
    argentina,
    buenosAires,
    "Buenos Aires sits on the Rio de la Plata, a waterway anchor for Argentina's capital.",
    [locatedOnFeature(buenosAires, rioDeLaPlata)],
    [d(chile, "Santiago"), d(uruguay, "Montevideo"), d(paraguay, "Asuncion")],
  ),
  reveal(
    "knowledge_geography_cie_score_v2_003",
    [other],
    unitedStates,
    washingtonDc,
    "Washington, D.C. sits on the Potomac River, a river anchor for the United States capital.",
    [locatedOnFeature(washingtonDc, potomacRiver)],
    [d(canada, "Ottawa"), d(mexico, "Mexico City"), d(brazil, "Brasilia")],
  ),
];

export const learnGeographyCapitalsRecallSelectedChecksumsByNode = {
  "geo.capitals.core": [
    "knowledge_geography_cie_score_v1_001",
    "knowledge_geography_cie_score_v1_004",
    "knowledge_geography_cie_score_v1_005",
    "knowledge_geography_cie_score_v1_007",
    "knowledge_geography_cie_score_v1_010",
    "knowledge_geography_cie_score_v1_014",
    "knowledge_geography_cie_score_v1_011",
    "knowledge_geography_cie_score_v2_023",
  ],
  "geo.capitals.europe": [
    "knowledge_geography_cie_score_v1_005",
    "knowledge_geography_cie_score_v1_010",
    "knowledge_geography_cie_score_v1_012",
    "knowledge_geography_cie_score_v1_013",
    "knowledge_geography_cie_score_v1_018",
    "knowledge_geography_cie_score_v1_019",
    "knowledge_geography_cie_score_v2_009",
    "knowledge_geography_cie_score_v2_017",
  ],
  "geo.capitals.asia": [
    "knowledge_geography_cie_score_v1_001",
    "knowledge_geography_cie_score_v1_014",
    "knowledge_geography_cie_score_v1_015",
    "knowledge_geography_cie_score_v1_021",
    "knowledge_geography_cie_score_v2_005",
    "knowledge_geography_cie_score_v2_020",
    "knowledge_geography_cie_score_v2_023",
    "knowledge_geography_cie_score_v2_024",
  ],
  "geo.capitals.other": [
    "knowledge_geography_cie_score_v1_002",
    "knowledge_geography_cie_score_v1_003",
    "knowledge_geography_cie_score_v1_004",
    "knowledge_geography_cie_score_v1_007",
    "knowledge_geography_cie_score_v1_022",
    "knowledge_geography_cie_score_v2_003",
    "knowledge_geography_cie_score_v1_011",
    "knowledge_geography_cie_score_v1_016",
  ],
} as const satisfies Record<(typeof RECALL_NODE_IDS)[number], readonly string[]>;

export const learnGeographyCapitalsRecallRevealsV1ByChecksum = Object.fromEntries(
  RAW_REVEALS.map((raw) => [raw.checksum, buildReveal(raw)]),
) as Record<string, LearnGeographyCapitalsRecallReveal>;

function sourceRecord(claim: SourceClaim): SourceRecord {
  return {
    sourceRef: claim.sourceRef,
    sourceType: claim.sourceType,
    license: "CC0-1.0",
    retrievedAt: claim.retrievedAt,
    volatility: claim.volatility,
    facts: claim.facts,
  };
}

function buildSourceRecords(rawReveals: RawRecallReveal[]) {
  const records = new Map<string, SourceRecord>();
  for (const raw of rawReveals) {
    for (const claim of provenanceClaims(raw)) {
      records.set(claim.sourceRef, sourceRecord(claim));
    }
  }
  return [...records.values()];
}

export const learnGeographyCapitalsRecallRevealsV1SourceRecords =
  buildSourceRecords(RAW_REVEALS);

export const learnGeographyCapitalsRecallRevealsV1Metadata = {
  batchId: BATCH_ID,
  mode: "learn",
  layer: "checksum_reveals",
  workUnitId: WORK_UNIT_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verifiedAt: VERIFIED_AT,
  verdict: aggregateVerdict(RAW_REVEALS.map((raw) => verdictFor(raw.checksum))),
  verdictsByChecksum: VERDICTS_BY_CHECKSUM,
  skillNodes: RECALL_NODE_IDS,
  revealCount: RAW_REVEALS.length,
  sourceRecordCount: learnGeographyCapitalsRecallRevealsV1SourceRecords.length,
  selectedChecksumsByNode: learnGeographyCapitalsRecallSelectedChecksumsByNode,
  checksumConvention:
    "Additive Learn-mode reveal metadata keyed to already-verified CIE score question checksums.",
} as const;

export function validateLearnGeographyCapitalsRecallRevealsV1() {
  const errors: string[] = [];
  const checksums = new Set<string>();

  for (const raw of RAW_REVEALS) {
    if (checksums.has(raw.checksum)) {
      errors.push(`${raw.checksum} is duplicated in the reveal layer`);
    }
    checksums.add(raw.checksum);

    if (!raw.correctReveal.trim()) {
      errors.push(`${raw.checksum} is missing correctReveal`);
    }
    if (raw.distractors.length !== 3) {
      errors.push(`${raw.checksum} must have exactly three distractor reveals`);
    }
    if (raw.hookClaims.length === 0) {
      errors.push(`${raw.checksum} is missing an enriching sourced hook claim`);
    }
    const verdict = verdictFor(raw.checksum);
    if (verdict === "pending") {
      errors.push(`${raw.checksum} has no verifier verdict stamped`);
    }
    if (verdict === "flag" || verdict === "disagree") {
      errors.push(
        `${raw.checksum} is ${verdict} and not shippable until the reveal is fixed`,
      );
    }
    for (const nodeId of raw.skillNodes) {
      if (!RECALL_NODE_IDS.includes(nodeId as (typeof RECALL_NODE_IDS)[number])) {
        errors.push(`${raw.checksum} references non-recall node ${nodeId}`);
      }
    }
    for (const claim of provenanceClaims(raw)) {
      if (!claim.claim.trim()) {
        errors.push(`${raw.checksum} has a blank provenance claim`);
      }
      if (!claim.sourceRef.startsWith("wikidata:")) {
        errors.push(`${raw.checksum} has non-Wikidata sourceRef ${claim.sourceRef}`);
      }
      if (claim.volatility !== "static") {
        errors.push(`${raw.checksum} has non-static claim ${claim.claim}`);
      }
    }
  }

  for (const [nodeId, selected] of Object.entries(
    learnGeographyCapitalsRecallSelectedChecksumsByNode,
  )) {
    if (selected.length < 7 || selected.length > 8) {
      errors.push(`${nodeId} should select 7-8 recall reveals, got ${selected.length}`);
    }
    for (const checksum of selected) {
      const revealForChecksum = learnGeographyCapitalsRecallRevealsV1ByChecksum[checksum];
      if (!revealForChecksum) {
        errors.push(`${nodeId} selects missing checksum ${checksum}`);
        continue;
      }
      if (!revealForChecksum.skillNodes.includes(nodeId as SkillNodeId)) {
        errors.push(`${checksum} is selected by ${nodeId} but not scoped to it`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    revealCount: RAW_REVEALS.length,
    sourceRecordCount: learnGeographyCapitalsRecallRevealsV1SourceRecords.length,
    selectedChecksumsByNode: learnGeographyCapitalsRecallSelectedChecksumsByNode,
  };
}

export default learnGeographyCapitalsRecallRevealsV1ByChecksum;
