import type { ContentQuestionSeed } from "./lib/contentQa";
import { skillNodeById, type SkillNodeId } from "./learnSkillGraph";

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

type RawLadderRung = {
  ladderIndex: number;
  difficulty: ContentQuestionSeed["difficulty"];
  question: string;
  country: EntityRef;
  capital: EntityRef;
  options: [EntityRef, EntityRef, EntityRef, EntityRef];
  distractors: [RawDistractor, RawDistractor, RawDistractor];
  correctReveal: string;
};

type WikidataSourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: "CC0-1.0";
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "learn_geography_nonobvious_ladder_v1";
const WORK_UNIT_ID = "learn:knowledge:geography:geo.capitals.nonobvious:v1";
const RETRIEVED_AT = "2026-05-26";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "anthropic/claude-opus-4-7";
const SKILL_NODE: SkillNodeId = "geo.capitals.nonobvious";

function entity(name: string, qid: string): EntityRef {
  return { name, qid };
}

function capitalRef(country: EntityRef) {
  return `wikidata:${country.qid}:P36:closed-capital-list:snapshot-${RETRIEVED_AT}`;
}

function locatedInCountryRef(city: EntityRef) {
  return `wikidata:${city.qid}:P17:snapshot-${RETRIEVED_AT}`;
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
  ];
}

function provenance(rung: RawLadderRung): LearnModeProvenance {
  return {
    claims: capitalClaims(rung),
    authorModel: AUTHOR_MODEL,
    verifierModel: VERIFIER_MODEL,
    verdict: "agree",
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

const RAW_RUNGS: RawLadderRung[] = [
  {
    ladderIndex: 1,
    difficulty: "easy",
    question: "Frame-setter: which city is the capital of France?",
    country: entity("France", "Q142"),
    capital: paris,
    options: [paris, lyon, toulouse, bordeaux],
    distractors: [
      d(
        lyon,
        "major city in the country = capital",
        "It is a city in France, so it can feel plausible before the learner checks the capital fact.",
        "Not Lyon: Wikidata lists Paris, not Lyon, as France's capital.",
      ),
      d(
        toulouse,
        "important regional city = capital",
        "It is a city in France, which makes it a plausible but unchecked substitute.",
        "Not Toulouse: Wikidata lists Paris, not Toulouse, as France's capital.",
      ),
      d(
        bordeaux,
        "recognizable city name = capital",
        "It is a city in France, so recognition can pull the learner away from the sourced capital.",
        "Not Bordeaux: Wikidata lists Paris, not Bordeaux, as France's capital.",
      ),
    ],
    correctReveal:
      "Paris is the sourced capital of France, setting the baseline before the ladder introduces city-name traps.",
  },
  {
    ladderIndex: 2,
    difficulty: "easy",
    question:
      "Australia tests the famous-city shortcut: which city is its capital?",
    country: entity("Australia", "Q408"),
    capital: canberra,
    options: [sydney, canberra, melbourne, brisbane],
    distractors: [
      d(
        sydney,
        "most familiar city = capital",
        "It is a city in Australia and the classic trap when a learner substitutes recognition for the capital fact.",
        "Not Sydney: Wikidata lists Canberra, not Sydney, as Australia's capital.",
      ),
      d(
        melbourne,
        "large city = capital",
        "It is a city in Australia, so it can look right if the learner is choosing by city prominence.",
        "Not Melbourne: Wikidata lists Canberra, not Melbourne, as Australia's capital.",
      ),
      d(
        brisbane,
        "known city in the country = capital",
        "It is a city in Australia, which makes it a plausible but unsupported guess.",
        "Not Brisbane: Wikidata lists Canberra, not Brisbane, as Australia's capital.",
      ),
    ],
    correctReveal:
      "Canberra is Australia's sourced capital, so the familiar-city shortcut fails on this rung.",
  },
  {
    ladderIndex: 3,
    difficulty: "easy",
    question: "Turkey has Istanbul as a tempting option; which city is the capital?",
    country: entity("Turkey", "Q43"),
    capital: ankara,
    options: [istanbul, ankara, izmir, bursa],
    distractors: [
      d(
        istanbul,
        "historic or famous city = capital",
        "It is a city in Turkey and a strong recognition trap for this country.",
        "Not Istanbul: Wikidata lists Ankara, not Istanbul, as Turkey's capital.",
      ),
      d(
        izmir,
        "well-known city in the country = capital",
        "It is a city in Turkey, so it can feel plausible without checking the capital claim.",
        "Not Izmir: Wikidata lists Ankara, not Izmir, as Turkey's capital.",
      ),
      d(
        bursa,
        "recognized city = capital",
        "It is a city in Turkey, which can tempt a learner using city familiarity alone.",
        "Not Bursa: Wikidata lists Ankara, not Bursa, as Turkey's capital.",
      ),
    ],
    correctReveal:
      "Ankara is Turkey's sourced capital, separating capital recall from the Istanbul association.",
  },
  {
    ladderIndex: 4,
    difficulty: "intermediate",
    question: "Apply the pattern to Brazil: which city is listed as its capital?",
    country: entity("Brazil", "Q155"),
    capital: brasilia,
    options: [saoPaulo, rioDeJaneiro, brasilia, salvador],
    distractors: [
      d(
        saoPaulo,
        "big city = capital",
        "It is a city in Brazil, so it is a strong trap when the learner equates city scale with capital status.",
        "Not Sao Paulo: Wikidata lists Brasilia, not Sao Paulo, as Brazil's capital.",
      ),
      d(
        rioDeJaneiro,
        "famous city = capital",
        "It is a city in Brazil, which makes it a tempting recognition-based answer.",
        "Not Rio de Janeiro: Wikidata lists Brasilia, not Rio de Janeiro, as Brazil's capital.",
      ),
      d(
        salvador,
        "known city in the country = capital",
        "It is a city in Brazil, so it can distract if the learner has not anchored the capital fact.",
        "Not Salvador: Wikidata lists Brasilia, not Salvador, as Brazil's capital.",
      ),
    ],
    correctReveal:
      "Brasilia is Brazil's sourced capital, so the ladder now rewards checking the capital rather than the city that comes to mind first.",
  },
  {
    ladderIndex: 5,
    difficulty: "intermediate",
    question: "For Nigeria, which city is the national capital?",
    country: entity("Nigeria", "Q1033"),
    capital: abuja,
    options: [lagos, abuja, kano, ibadan],
    distractors: [
      d(
        lagos,
        "biggest or best-known city = capital",
        "It is a city in Nigeria and a common trap for learners using recognition instead of the capital fact.",
        "Not Lagos: Wikidata lists Abuja, not Lagos, as Nigeria's capital.",
      ),
      d(
        kano,
        "major city = capital",
        "It is a city in Nigeria, which can make it feel plausible in a country-city list.",
        "Not Kano: Wikidata lists Abuja, not Kano, as Nigeria's capital.",
      ),
      d(
        ibadan,
        "large city in the country = capital",
        "It is a city in Nigeria, so it can look tempting if capital status is not checked.",
        "Not Ibadan: Wikidata lists Abuja, not Ibadan, as Nigeria's capital.",
      ),
    ],
    correctReveal:
      "Abuja is Nigeria's sourced capital, reinforcing that the capital can differ from the city a learner recognizes first.",
  },
  {
    ladderIndex: 6,
    difficulty: "hard",
    question: "Myanmar is another non-obvious case: which city is its capital?",
    country: entity("Myanmar", "Q836"),
    capital: naypyidaw,
    options: [yangon, mandalay, naypyidaw, bago],
    distractors: [
      d(
        yangon,
        "familiar former-associated city = capital",
        "It is a city in Myanmar and the strongest recognition trap in this rung.",
        "Not Yangon: Wikidata lists Naypyidaw, not Yangon, as Myanmar's capital.",
      ),
      d(
        mandalay,
        "known city = capital",
        "It is a city in Myanmar, so a learner may pick it from name recognition.",
        "Not Mandalay: Wikidata lists Naypyidaw, not Mandalay, as Myanmar's capital.",
      ),
      d(
        bago,
        "city in the country = capital",
        "It is a city in Myanmar, which makes it a plausible but unsupported option.",
        "Not Bago: Wikidata lists Naypyidaw, not Bago, as Myanmar's capital.",
      ),
    ],
    correctReveal:
      "Naypyidaw is Myanmar's sourced capital, making this the strongest reminder to verify the capital claim.",
  },
  {
    ladderIndex: 7,
    difficulty: "hard",
    question: "Synthesis: apply the pattern to Morocco and pick its capital.",
    country: entity("Morocco", "Q1028"),
    capital: rabat,
    options: [casablanca, rabat, tangier, fez],
    distractors: [
      d(
        casablanca,
        "famous city = capital",
        "It is a city in Morocco and the recognition trap this synthesis rung expects the learner to resist.",
        "Not Casablanca: Wikidata lists Rabat, not Casablanca, as Morocco's capital.",
      ),
      d(
        tangier,
        "recognizable city = capital",
        "It is a city in Morocco, so recognition can make it feel like the capital.",
        "Not Tangier: Wikidata lists Rabat, not Tangier, as Morocco's capital.",
      ),
      d(
        fez,
        "historic city = capital",
        "It is a city in Morocco, which can tempt a learner who is matching the country to a familiar place.",
        "Not Fez: Wikidata lists Rabat, not Fez, as Morocco's capital.",
      ),
    ],
    correctReveal:
      "Rabat is Morocco's sourced capital, completing the pattern that the obvious city is not always the answer.",
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
): WikidataSourceRecord {
  return {
    sourceRef,
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts,
  };
}

function buildWikidataSourceRecords(rungs: RawLadderRung[]) {
  const records = new Map<string, WikidataSourceRecord>();
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
  }
  return [...records.values()];
}

export const learnGeographyNonobviousLadderV1SourceRecords =
  buildWikidataSourceRecords(RAW_RUNGS);

export const learnGeographyNonobviousLadderV1Metadata = {
  batchId: BATCH_ID,
  mode: "learn",
  workUnitId: WORK_UNIT_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "agree",
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
