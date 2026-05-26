import type { ContentQuestionSeed } from "./lib/contentQa";
import { skillNodeById, type SkillNodeId } from "./learnSkillGraph";

type SourceType = "structured_open" | "official_record";
type SourceLicense = "CC0-1.0" | "official-record-fact-only";
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

type LearnModeProvenance = {
  claims: ProvenanceClaim[];
  authorModel: string;
  verifierModel: string;
  verdict: Verdict;
  batchId: string;
  workUnitId: string;
};

export type LearnModeDistractor = {
  text: string;
  misconception: string;
  whyChosen: string;
  reveal: string;
};

export type LearnGeographyNonobviousLadderQuestion = ContentQuestionSeed & {
  ladderIndex: number;
  skillNodes: SkillNodeId[];
  distractors: LearnModeDistractor[];
  correctReveal: string;
  provenance: LearnModeProvenance;
};

type RawDistractor = LearnModeDistractor & {
  entity: EntityRef;
};

type TeachingSource = {
  sourceRef: string;
  sourceType: SourceType;
  license: SourceLicense;
  claims: string[];
  facts: Record<string, unknown>;
};

type RawLadderRung = {
  ladderIndex: number;
  difficulty: ContentQuestionSeed["difficulty"];
  question: string;
  country: EntityRef;
  capital: EntityRef;
  options: [EntityRef, EntityRef, EntityRef, EntityRef];
  distractors: [RawDistractor, RawDistractor, RawDistractor];
  correctReveal: string;
  teachingSources?: TeachingSource[];
};

type SourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: SourceLicense;
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "learn_geography_nonobvious_ladder_v1";
const WORK_UNIT_ID = "learn:knowledge:geography:geo.capitals.nonobvious:v1";
const RETRIEVED_AT = "2026-05-26";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "pending_anthropic_verification";
const SKILL_NODE: SkillNodeId = "geo.capitals.nonobvious";

function entity(name: string, qid: string): EntityRef {
  return { name, qid };
}

function capitalRef(country: EntityRef) {
  return `wikidata:${country.qid}:P36:closed-capital-list:snapshot-${RETRIEVED_AT}`;
}

function capitalHistoryRef(country: EntityRef) {
  return `wikidata:${country.qid}:P36:capital-history:snapshot-${RETRIEVED_AT}`;
}

function locatedInCountryRef(city: EntityRef) {
  return `wikidata:${city.qid}:P17:snapshot-${RETRIEVED_AT}`;
}

function instanceOfRef(subject: EntityRef, instance: EntityRef) {
  return `wikidata:${subject.qid}:P31:${instance.qid}:snapshot-${RETRIEVED_AT}`;
}

function inceptionRef(subject: EntityRef) {
  return `wikidata:${subject.qid}:P571:snapshot-${RETRIEVED_AT}`;
}

function capitalOfRef(city: EntityRef, country: EntityRef) {
  return `wikidata:${city.qid}:P1376:${country.qid}:snapshot-${RETRIEVED_AT}`;
}

function populationRef(city: EntityRef, year: string) {
  return `wikidata:${city.qid}:P1082:${year}:snapshot-${RETRIEVED_AT}`;
}

function claim(
  text: string,
  sourceRef: string,
  sourceType: SourceType = "structured_open",
): ProvenanceClaim {
  return {
    claim: text,
    sourceType,
    sourceRef,
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
  };
}

function teachingSource(
  sourceRef: string,
  claims: string[],
  facts: Record<string, unknown>,
  sourceType: SourceType = "structured_open",
  license: SourceLicense = "CC0-1.0",
): TeachingSource {
  return {
    sourceRef,
    sourceType,
    license,
    claims,
    facts,
  };
}

function checksum(index: number) {
  return `${BATCH_ID}_${String(index + 1).padStart(3, "0")}`;
}

function bucket(difficulty: ContentQuestionSeed["difficulty"]) {
  return `knowledge_${difficulty}_capital_cities`;
}

function cityInCountryClaim(city: EntityRef, country: EntityRef) {
  return claim(
    `located_in_country(${city.name}) = ${country.name}`,
    locatedInCountryRef(city),
  );
}

function capitalClaims(rung: RawLadderRung): ProvenanceClaim[] {
  return [
    claim(
      `capital_of(${rung.country.name}) = ${rung.capital.name}`,
      capitalRef(rung.country),
    ),
    cityInCountryClaim(rung.capital, rung.country),
    ...rung.distractors.flatMap((distractor) => [
      claim(
        `capital_of(${rung.country.name}) != ${distractor.entity.name}`,
        capitalRef(rung.country),
      ),
      cityInCountryClaim(distractor.entity, rung.country),
    ]),
    ...(rung.teachingSources ?? []).flatMap((source) =>
      source.claims.map((sourceClaim) =>
        claim(sourceClaim, source.sourceRef, source.sourceType),
      ),
    ),
  ];
}

function provenance(rung: RawLadderRung): LearnModeProvenance {
  return {
    claims: capitalClaims(rung),
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict: "pending",
    batchId: BATCH_ID,
    workUnitId: WORK_UNIT_ID,
  };
}

function buildQuestion(
  rung: RawLadderRung,
  index: number,
): LearnGeographyNonobviousLadderQuestion {
  return {
    sport: "knowledge",
    category: "capital_cities",
    question: rung.question,
    options: rung.options.map((option) => option.name),
    correctAnswer: rung.capital.name,
    explanation: rung.correctReveal,
    difficulty: rung.difficulty,
    bucket: bucket(rung.difficulty),
    checksum: checksum(index),
    ladderIndex: rung.ladderIndex,
    skillNodes: [SKILL_NODE],
    distractors: rung.distractors.map(({ entity: _entity, ...distractor }) => ({
      ...distractor,
    })),
    correctReveal: rung.correctReveal,
    provenance: provenance(rung),
  };
}

function d(
  entityRef: EntityRef,
  misconception: string,
  whyChosen: string,
  reveal: string,
): RawDistractor {
  return {
    entity: entityRef,
    text: entityRef.name,
    misconception,
    whyChosen,
    reveal,
  };
}

const france = entity("France", "Q142");
const australia = entity("Australia", "Q408");
const turkey = entity("Turkey", "Q43");
const brazil = entity("Brazil", "Q155");
const nigeria = entity("Nigeria", "Q1033");
const myanmar = entity("Myanmar", "Q836");
const morocco = entity("Morocco", "Q1028");
const paris = entity("Paris", "Q90");
const lyon = entity("Lyon", "Q456");
const toulouse = entity("Toulouse", "Q7880");
const bordeaux = entity("Bordeaux", "Q1479");
const canberra = entity("Canberra", "Q3114");
const sydney = entity("Sydney", "Q3130");
const melbourne = entity("Melbourne", "Q3141");
const brisbane = entity("Brisbane", "Q34932");
const ankara = entity("Ankara", "Q3640");
const istanbul = entity("Istanbul", "Q406");
const izmir = entity("Izmir", "Q35997");
const bursa = entity("Bursa", "Q40738");
const brasilia = entity("Brasilia", "Q2844");
const saoPaulo = entity("Sao Paulo", "Q174");
const rioDeJaneiro = entity("Rio de Janeiro", "Q8678");
const salvador = entity("Salvador", "Q36947");
const abuja = entity("Abuja", "Q3787");
const lagos = entity("Lagos", "Q8673");
const kano = entity("Kano", "Q182984");
const ibadan = entity("Ibadan", "Q183298");
const naypyidaw = entity("Naypyidaw", "Q37400");
const yangon = entity("Yangon", "Q37995");
const mandalay = entity("Mandalay", "Q185518");
const bago = entity("Bago", "Q800122");
const rabat = entity("Rabat", "Q3551");
const casablanca = entity("Casablanca", "Q7903");
const tangier = entity("Tangier", "Q126148");
const fez = entity("Fez", "Q80985");
const plannedNationalCapital = entity("planned national capital", "Q15840617");

function plannedNationalCapitalSource(city: EntityRef) {
  return teachingSource(
    instanceOfRef(city, plannedNationalCapital),
    [`instance_of(${city.name}) includes planned national capital`],
    {
      subject: city,
      property: "P31",
      includedInstance: plannedNationalCapital,
    },
  );
}

function inceptionSource(subject: EntityRef, value: string) {
  return teachingSource(
    inceptionRef(subject),
    [`inception(${subject.name}) = ${value}`],
    {
      subject,
      property: "P571",
      value,
    },
  );
}

function capitalHistorySource(
  country: EntityRef,
  currentCapital: EntityRef,
  currentCapitalStart: string,
  previousCapitals: {
    capital: EntityRef;
    start?: string;
    end: string;
  }[] = [],
) {
  return teachingSource(
    capitalHistoryRef(country),
    [
      `capital_of(${country.name}) = ${currentCapital.name} since ${currentCapitalStart}`,
      ...previousCapitals.map(
        (entry) =>
          `capital_of(${country.name}) = ${entry.capital.name} until ${entry.end}`,
      ),
    ],
    {
      subject: country,
      property: "P36",
      currentCapital,
      currentCapitalStart,
      previousCapitals,
    },
  );
}

function cityCapitalOfSource(
  city: EntityRef,
  country: EntityRef,
  start: string,
) {
  return teachingSource(
    capitalOfRef(city, country),
    [`capital_of_role(${city.name}, ${country.name}) starts ${start}`],
    {
      subject: city,
      property: "P1376",
      capitalOf: country,
      start,
    },
  );
}

function populationSource(
  city: EntityRef,
  year: string,
  population: number,
  pointInTime: string,
) {
  return teachingSource(
    populationRef(city, year),
    [`population(${city.name}, ${year}) = ${population}`],
    {
      subject: city,
      property: "P1082",
      population,
      pointInTime,
    },
  );
}

function fcdaAbujaPlanningSource() {
  return teachingSource(
    `official:fcda.gov.ng:the-history-of-abuja:snapshot-${RETRIEVED_AT}`,
    [
      "official_record(FCDA) supports Abuja as a planned, designed, and developed new capital city",
    ],
    {
      sourceUrl: "https://fcda.gov.ng/the-history-of-abuja/",
      authority: "Federal Capital Development Authority",
      fact:
        "The FCDA was established as the agency responsible for planning, designing, and developing Abuja as the new capital city.",
    },
    "official_record",
    "official-record-fact-only",
  );
}

const RAW_RUNGS: RawLadderRung[] = [
  {
    ladderIndex: 1,
    difficulty: "easy",
    question: "Frame-setter: which city is the capital of France?",
    country: france,
    capital: paris,
    options: [paris, lyon, toulouse, bordeaux],
    distractors: [
      d(
        lyon,
        "major city in the country = capital",
        "It is a city in France, so it can feel plausible before the learner checks the capital fact.",
        "Lyon is a French-city recognition trap; this baseline rung expects Paris before the later non-obvious capitals.",
      ),
      d(
        toulouse,
        "important regional city = capital",
        "It is a city in France, which makes it a plausible but unchecked substitute.",
        "Toulouse is a French-city trap; this baseline rung expects Paris before the later non-obvious capitals.",
      ),
      d(
        bordeaux,
        "recognizable city name = capital",
        "It is a city in France, so recognition can pull the learner away from the sourced capital.",
        "Bordeaux is a French-city trap; this baseline rung expects Paris before the later non-obvious capitals.",
      ),
    ],
    correctReveal:
      "Paris is the baseline because, in this first rung, the expected capital is correct before the ladder starts breaking the famous-city shortcut.",
  },
  {
    ladderIndex: 2,
    difficulty: "easy",
    question:
      "Australia tests the famous-city shortcut: which city is its capital?",
    country: australia,
    capital: canberra,
    options: [sydney, canberra, melbourne, brisbane],
    distractors: [
      d(
        sydney,
        "most familiar city = capital",
        "It is a city in Australia and the classic trap when a learner substitutes recognition for the capital fact.",
        "Sydney is the recognition trap; Canberra was planned as the national capital instead.",
      ),
      d(
        melbourne,
        "large city = capital",
        "It is a city in Australia, so it can look right if the learner is choosing by city prominence.",
        "Melbourne is the former-capital trap; Canberra took over the capital role in 1927.",
      ),
      d(
        brisbane,
        "known city in the country = capital",
        "It is a city in Australia, which makes it a plausible but unsupported guess.",
        "Brisbane is only a country-city match here; Canberra was planned as the national capital.",
      ),
    ],
    correctReveal:
      "Canberra is the answer because it was founded as a planned national capital and took over the capital role in 1927 instead of Sydney or Melbourne.",
    teachingSources: [
      plannedNationalCapitalSource(canberra),
      inceptionSource(canberra, "+1913-03-12T00:00:00Z"),
      capitalHistorySource(australia, canberra, "+1927-05-09T00:00:00Z", [
        {
          capital: melbourne,
          start: "+1901-01-01T00:00:00Z",
          end: "+1927-05-09T00:00:00Z",
        },
      ]),
    ],
  },
  {
    ladderIndex: 3,
    difficulty: "easy",
    question: "Turkey has Istanbul as a tempting option; which city is the capital?",
    country: turkey,
    capital: ankara,
    options: [istanbul, ankara, izmir, bursa],
    distractors: [
      d(
        istanbul,
        "historic or famous city = capital",
        "It is a city in Turkey and a strong recognition trap for this country.",
        "Istanbul is the recognition trap; Ankara became Turkey's capital in 1923.",
      ),
      d(
        izmir,
        "well-known city in the country = capital",
        "It is a city in Turkey, so it can feel plausible without checking the capital claim.",
        "Izmir is a country-city trap; Ankara became Turkey's capital in 1923.",
      ),
      d(
        bursa,
        "recognized city = capital",
        "It is a city in Turkey, which can tempt a learner using city familiarity alone.",
        "Bursa is a country-city trap; Ankara became Turkey's capital in 1923.",
      ),
    ],
    correctReveal:
      "Ankara is the answer because Turkey made it the capital in 1923, tying the modern capital to the new state rather than Istanbul.",
    teachingSources: [
      capitalHistorySource(turkey, ankara, "+1923-10-29T00:00:00Z"),
      inceptionSource(turkey, "+1923-10-29T00:00:00Z"),
    ],
  },
  {
    ladderIndex: 4,
    difficulty: "intermediate",
    question: "Apply the pattern to Brazil: which city is listed as its capital?",
    country: brazil,
    capital: brasilia,
    options: [saoPaulo, rioDeJaneiro, brasilia, salvador],
    distractors: [
      d(
        saoPaulo,
        "big city = capital",
        "It is a city in Brazil, so it is a strong trap when the learner equates city scale with capital status.",
        "Sao Paulo is the city-scale trap; Brazil moved the capital to planned Brasilia in 1960.",
      ),
      d(
        rioDeJaneiro,
        "famous city = capital",
        "It is a city in Brazil, which makes it a tempting recognition-based answer.",
        "Rio de Janeiro is the former-capital trap; Brazil moved the capital to Brasilia in 1960.",
      ),
      d(
        salvador,
        "known city in the country = capital",
        "It is a city in Brazil, so it can distract if the learner has not anchored the capital fact.",
        "Salvador is a country-city trap; Brazil moved the capital to planned Brasilia in 1960.",
      ),
    ],
    correctReveal:
      "Brasilia is the answer because Brazil moved the capital from Rio de Janeiro to a newly founded planned national capital in 1960.",
    teachingSources: [
      plannedNationalCapitalSource(brasilia),
      inceptionSource(brasilia, "+1960-04-21T00:00:00Z"),
      capitalHistorySource(brazil, brasilia, "+1960-04-22T00:00:00Z", [
        {
          capital: rioDeJaneiro,
          end: "+1960-04-22T00:00:00Z",
        },
      ]),
    ],
  },
  {
    ladderIndex: 5,
    difficulty: "intermediate",
    question: "For Nigeria, which city is the national capital?",
    country: nigeria,
    capital: abuja,
    options: [lagos, abuja, kano, ibadan],
    distractors: [
      d(
        lagos,
        "biggest or best-known city = capital",
        "It is a city in Nigeria and a common trap for learners using recognition instead of the capital fact.",
        "Lagos is the former-capital trap; Nigeria moved the capital to Abuja in 1991.",
      ),
      d(
        kano,
        "major city = capital",
        "It is a city in Nigeria, which can make it feel plausible in a country-city list.",
        "Kano is a country-city trap; Nigeria moved the capital to Abuja in 1991.",
      ),
      d(
        ibadan,
        "large city in the country = capital",
        "It is a city in Nigeria, so it can look tempting if capital status is not checked.",
        "Ibadan is a country-city trap; Nigeria moved the capital to Abuja in 1991.",
      ),
    ],
    correctReveal:
      "Abuja is the answer because Nigeria planned and developed it as a new federal capital and moved the capital there from Lagos in 1991.",
    teachingSources: [
      fcdaAbujaPlanningSource(),
      capitalHistorySource(nigeria, abuja, "+1991-12-12T00:00:00Z", [
        {
          capital: lagos,
          start: "+1914-00-00T00:00:00Z",
          end: "+1991-12-12T00:00:00Z",
        },
      ]),
    ],
  },
  {
    ladderIndex: 6,
    difficulty: "hard",
    question: "Myanmar is another non-obvious case: which city is its capital?",
    country: myanmar,
    capital: naypyidaw,
    options: [yangon, mandalay, naypyidaw, bago],
    distractors: [
      d(
        yangon,
        "familiar former-associated city = capital",
        "It is a city in Myanmar and the strongest recognition trap in this rung.",
        "Yangon is the former-capital trap; Myanmar moved the capital to planned Naypyidaw in 2005.",
      ),
      d(
        mandalay,
        "known city = capital",
        "It is a city in Myanmar, so a learner may pick it from name recognition.",
        "Mandalay is a country-city trap; Myanmar moved the capital to planned Naypyidaw in 2005.",
      ),
      d(
        bago,
        "city in the country = capital",
        "It is a city in Myanmar, which makes it a plausible but unsupported option.",
        "Bago is a country-city trap; Myanmar moved the capital to planned Naypyidaw in 2005.",
      ),
    ],
    correctReveal:
      "Naypyidaw is the answer because Myanmar created a planned national capital in 2005 and moved the capital there from Yangon.",
    teachingSources: [
      plannedNationalCapitalSource(naypyidaw),
      inceptionSource(naypyidaw, "+2005-00-00T00:00:00Z"),
      capitalHistorySource(myanmar, naypyidaw, "+2005-11-06T00:00:00Z", [
        {
          capital: yangon,
          start: "+1948-01-04T00:00:00Z",
          end: "+2005-11-06T00:00:00Z",
        },
      ]),
    ],
  },
  {
    ladderIndex: 7,
    difficulty: "hard",
    question: "Synthesis: apply the pattern to Morocco and pick its capital.",
    country: morocco,
    capital: rabat,
    options: [casablanca, rabat, tangier, fez],
    distractors: [
      d(
        casablanca,
        "famous city = capital",
        "It is a city in Morocco and the recognition trap this synthesis rung expects the learner to resist.",
        "Casablanca is the larger-city trap; Rabat is Morocco's capital.",
      ),
      d(
        tangier,
        "recognizable city = capital",
        "It is a city in Morocco, so recognition can make it feel like the capital.",
        "Tangier is a recognition trap; Rabat is Morocco's capital.",
      ),
      d(
        fez,
        "historic city = capital",
        "It is a city in Morocco, which can tempt a learner who is matching the country to a familiar place.",
        "Fez is a recognition trap; Rabat is Morocco's capital.",
      ),
    ],
    correctReveal:
      "Rabat is the answer because Morocco's capital role belongs to Rabat even though Casablanca is the much larger city-name trap.",
    teachingSources: [
      cityCapitalOfSource(rabat, morocco, "+1956-00-00T00:00:00Z"),
      populationSource(
        casablanca,
        "2014",
        3359818,
        "+2014-01-01T00:00:00Z",
      ),
      populationSource(rabat, "2014", 572717, "+2014-00-00T00:00:00Z"),
    ],
  },
];

export const learnGeographyNonobviousLadderV1Questions =
  RAW_RUNGS.map(buildQuestion);

export const learnGeographyNonobviousLadderV1ByChecksum = Object.fromEntries(
  learnGeographyNonobviousLadderV1Questions.map((question) => [
    question.checksum,
    {
      skillNodes: question.skillNodes,
      ladderIndex: question.ladderIndex,
      distractors: question.distractors,
      correctReveal: question.correctReveal,
      provenance: question.provenance,
    },
  ]),
) as Record<
  string,
  Pick<
    LearnGeographyNonobviousLadderQuestion,
    "skillNodes" | "ladderIndex" | "distractors" | "correctReveal" | "provenance"
  >
>;

function sourceRecord(
  sourceRef: string,
  facts: Record<string, unknown>,
  sourceType: SourceType = "structured_open",
  license: SourceLicense = "CC0-1.0",
): SourceRecord {
  return {
    sourceRef,
    sourceType,
    license,
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts,
  };
}

function buildSourceRecords(rungs: RawLadderRung[]) {
  const records = new Map<string, SourceRecord>();
  for (const rung of rungs) {
    records.set(
      capitalRef(rung.country),
      sourceRecord(capitalRef(rung.country), {
        subject: rung.country,
        property: "P36",
        includedCapitals: [rung.capital],
        excludedCapitals: rung.distractors.map((distractor) => distractor.entity),
        closedCapitalList: true,
      }),
    );

    for (const city of [rung.capital, ...rung.distractors.map((d) => d.entity)]) {
      records.set(
        locatedInCountryRef(city),
        sourceRecord(locatedInCountryRef(city), {
          subject: city,
          property: "P17",
          country: rung.country,
        }),
      );
    }

    for (const source of rung.teachingSources ?? []) {
      records.set(
        source.sourceRef,
        sourceRecord(
          source.sourceRef,
          source.facts,
          source.sourceType,
          source.license,
        ),
      );
    }
  }
  return [...records.values()];
}

export const learnGeographyNonobviousLadderV1SourceRecords =
  buildSourceRecords(RAW_RUNGS);

export const learnGeographyNonobviousLadderV1Metadata = {
  batchId: BATCH_ID,
  mode: "learn",
  workUnitId: WORK_UNIT_ID,
  sourceType: "mixed_approved",
  sourceName: "Wikidata; official government records",
  sourceLicense: "CC0-1.0; official-record-fact-only",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "pending",
  skillNodes: [SKILL_NODE],
  questionCount: learnGeographyNonobviousLadderV1Questions.length,
  checksumPrefix: BATCH_ID,
  checksumConvention:
    "Bundled learn-mode ladder module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
} as const;

export function validateLearnGeographyNonobviousLadderV1() {
  const errors: string[] = [];
  const checksums = new Set<string>();
  const ladderIndexes = new Set<number>();

  learnGeographyNonobviousLadderV1Questions.forEach((question, index) => {
    if (question.ladderIndex !== index + 1) {
      errors.push(`${question.checksum} has ladderIndex ${question.ladderIndex}`);
    }
    if (ladderIndexes.has(question.ladderIndex)) {
      errors.push(`${question.checksum} duplicates ladderIndex ${question.ladderIndex}`);
    }
    ladderIndexes.add(question.ladderIndex);

    if (checksums.has(question.checksum)) {
      errors.push(`${question.checksum} is duplicated in the batch`);
    }
    checksums.add(question.checksum);

    for (const nodeId of question.skillNodes) {
      if (!skillNodeById[nodeId]) {
        errors.push(`${question.checksum} references unknown skill node ${nodeId}`);
      }
    }
    if (question.skillNodes.length !== 1 || question.skillNodes[0] !== SKILL_NODE) {
      errors.push(`${question.checksum} must be tagged only to ${SKILL_NODE}`);
    }

    if (!question.correctReveal.trim()) {
      errors.push(`${question.checksum} is missing correctReveal`);
    }

    if (question.distractors.length !== 3) {
      errors.push(`${question.checksum} must have exactly 3 learn distractors`);
    }

    for (const distractor of question.distractors) {
      if (!question.options.includes(distractor.text)) {
        errors.push(`${question.checksum} distractor ${distractor.text} is not an option`);
      }
      if (distractor.text === question.correctAnswer) {
        errors.push(`${question.checksum} marks the correct answer as a distractor`);
      }
      if (!distractor.misconception.trim()) {
        errors.push(`${question.checksum} distractor ${distractor.text} is missing misconception`);
      }
      if (!distractor.reveal.trim()) {
        errors.push(`${question.checksum} distractor ${distractor.text} is missing reveal`);
      }
    }

    if (question.provenance.verdict === "pending") {
      errors.push(`${question.checksum} is still pending cross-family verification`);
    }
    if (question.provenance.verifierModel !== VERIFIER_MODEL) {
      errors.push(`${question.checksum} has unexpected verifierModel`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    questionCount: learnGeographyNonobviousLadderV1Questions.length,
    sourceRecordCount: learnGeographyNonobviousLadderV1SourceRecords.length,
  };
}

export const questions = learnGeographyNonobviousLadderV1Questions;
export default learnGeographyNonobviousLadderV1Questions;
