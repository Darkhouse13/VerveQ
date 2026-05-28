import type { ContentQuestionSeed } from "./lib/contentQa";
import { skillNodeById, type SkillNodeId } from "./learnSkillGraph";

type SourceType = "structured_open";
type SourceLicense = "CC0-1.0";
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

export type LearnGeographyBorderReasoningLadderQuestion =
  ContentQuestionSeed & {
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
  subject: EntityRef;
  nonNeighbor: EntityRef;
  options: [EntityRef, EntityRef, EntityRef, EntityRef];
  distractors: [RawDistractor, RawDistractor, RawDistractor];
  correctReveal: string;
  allP47Neighbors: EntityRef[];
};

type SourceRecord = {
  sourceRef: string;
  sourceType: SourceType;
  license: SourceLicense;
  retrievedAt: string;
  volatility: Volatility;
  facts: Record<string, unknown>;
};

const BATCH_ID = "learn_geography_border_reasoning_ladder_v1";
const WORK_UNIT_ID = "learn:knowledge:geography:geo.borders.reasoning:v1";
const RETRIEVED_AT = "2026-05-28";
const AUTHOR_MODEL = "openai/gpt-5-codex";
const VERIFIER_MODEL = "anthropic/claude-opus-4-8";
const SKILL_NODE: SkillNodeId = "geo.borders.reasoning";

function entity(name: string, qid: string): EntityRef {
  return { name, qid };
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

function checksum(index: number) {
  return `${BATCH_ID}_${String(index + 1).padStart(3, "0")}`;
}

function bucket(difficulty: ContentQuestionSeed["difficulty"]) {
  return `knowledge_${difficulty}_country_facts`;
}

function borderClaims(rung: RawLadderRung): ProvenanceClaim[] {
  const sourceRef = borderRef(rung.subject);
  return [
    claim(
      `not_shares_border_with(${rung.subject.name}, ${rung.nonNeighbor.name})`,
      sourceRef,
    ),
    ...rung.distractors.map((distractor) =>
      claim(
        `shares_border_with(${rung.subject.name}, ${distractor.entity.name})`,
        sourceRef,
      ),
    ),
  ];
}

function provenance(rung: RawLadderRung): LearnModeProvenance {
  return {
    claims: borderClaims(rung),
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
): LearnGeographyBorderReasoningLadderQuestion {
  return {
    sport: "knowledge",
    category: "country_facts",
    question: rung.question,
    options: rung.options.map((option) => option.name),
    correctAnswer: rung.nonNeighbor.name,
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
const portugal = entity("Portugal", "Q45");
const spain = entity("Spain", "Q29");
const belgium = entity("Belgium", "Q31");
const germany = entity("Germany", "Q183");
const andorra = entity("Andorra", "Q228");
const brazil = entity("Brazil", "Q155");
const italy = entity("Italy", "Q38");
const kingdomOfTheNetherlands = entity("Kingdom of the Netherlands", "Q29999");
const luxembourg = entity("Luxembourg", "Q32");
const monaco = entity("Monaco", "Q235");
const suriname = entity("Suriname", "Q730");
const switzerland = entity("Switzerland", "Q39");

const poland = entity("Poland", "Q36");
const austria = entity("Austria", "Q40");
const czechia = entity("Czechia", "Q213");
const denmark = entity("Denmark", "Q35");
const netherlands = entity("Netherlands", "Q55");

const chile = entity("Chile", "Q298");
const argentina = entity("Argentina", "Q414");
const bolivia = entity("Bolivia", "Q750");
const peru = entity("Peru", "Q419");
const colombia = entity("Colombia", "Q739");
const frenchGuiana = entity("French Guiana", "Q3769");
const guyana = entity("Guyana", "Q734");
const paraguay = entity("Paraguay", "Q733");
const uruguay = entity("Uruguay", "Q77");
const venezuela = entity("Venezuela", "Q717");

const ecuador = entity("Ecuador", "Q736");

const croatia = entity("Croatia", "Q224");
const hungary = entity("Hungary", "Q28");
const liechtenstein = entity("Liechtenstein", "Q347");
const slovakia = entity("Slovakia", "Q214");
const slovenia = entity("Slovenia", "Q215");

const belarus = entity("Belarus", "Q184");
const lithuania = entity("Lithuania", "Q37");
const russia = entity("Russia", "Q159");
const ukraine = entity("Ukraine", "Q212");

const kazakhstan = entity("Kazakhstan", "Q232");
const mongolia = entity("Mongolia", "Q711");
const china = entity("China", "Q148");
const uzbekistan = entity("Uzbekistan", "Q265");
const kyrgyzstan = entity("Kyrgyzstan", "Q813");
const turkmenistan = entity("Turkmenistan", "Q874");

const RAW_RUNGS: RawLadderRung[] = [
  {
    ladderIndex: 1,
    difficulty: "easy",
    question: "Frame-setter: which country does NOT border France?",
    subject: france,
    nonNeighbor: portugal,
    options: [spain, portugal, belgium, germany],
    distractors: [
      d(
        spain,
        "nearby country = non-border candidate",
        "Spain is close to Portugal, so it tests whether the learner checks the actual France border list.",
        "Spain does border France, so it is a real neighbor rather than the non-border answer.",
      ),
      d(
        belgium,
        "small nearby country = easy to overlook",
        "Belgium can be missed when the learner focuses on the larger western European countries.",
        "Belgium does border France, so it belongs on France's neighbor list.",
      ),
      d(
        germany,
        "familiar nearby country = unchecked guess",
        "Germany is a familiar neighbor and keeps the option set anchored in real adjacency.",
        "Germany does border France, so it cannot be the country that does not border France.",
      ),
    ],
    correctReveal:
      "Portugal does not border France because Spain lies between Portugal and France.",
    allP47Neighbors: [
      andorra,
      belgium,
      brazil,
      germany,
      italy,
      kingdomOfTheNetherlands,
      luxembourg,
      monaco,
      spain,
      suriname,
      switzerland,
    ],
  },
  {
    ladderIndex: 2,
    difficulty: "easy",
    question:
      "Germany has many neighbors; which listed country does NOT border it?",
    subject: germany,
    nonNeighbor: italy,
    options: [france, poland, italy, austria],
    distractors: [
      d(
        france,
        "well-known country nearby = possible non-border answer",
        "France is a large neighbor, so it reinforces that the learner must separate proximity from the inverse prompt.",
        "France does border Germany, so it is one of Germany's real neighbors.",
      ),
      d(
        poland,
        "east-of-Germany recognition = unchecked answer",
        "Poland is geographically obvious but still needs to be treated as a sourced border claim.",
        "Poland does border Germany, so it is not the non-border country.",
      ),
      d(
        austria,
        "same-language-region association = border uncertainty",
        "Austria is culturally and geographically associated with Germany, making it a good real-neighbor distractor.",
        "Austria does border Germany, so it belongs in Germany's P47 neighbor set.",
      ),
    ],
    correctReveal:
      "Italy does not border Germany because Austria and Switzerland sit between them.",
    allP47Neighbors: [
      austria,
      belgium,
      czechia,
      denmark,
      france,
      luxembourg,
      netherlands,
      poland,
      switzerland,
    ],
  },
  {
    ladderIndex: 3,
    difficulty: "intermediate",
    question:
      "South America near-miss: which country does NOT border Brazil?",
    subject: brazil,
    nonNeighbor: chile,
    options: [chile, argentina, bolivia, peru],
    distractors: [
      d(
        argentina,
        "regional neighbor = possible near-miss",
        "Argentina is another major South American country, so it checks whether the learner knows the actual shared frontier.",
        "Argentina does border Brazil, so it is a real neighbor in this set.",
      ),
      d(
        bolivia,
        "interior-country confusion = unchecked guess",
        "Bolivia sits between several South American countries and can feel ambiguous without the border list.",
        "Bolivia does border Brazil, so it cannot be the non-neighbor.",
      ),
      d(
        peru,
        "western Amazon proximity = plausible trap",
        "Peru feels farther west, but the Amazon frontier makes it a real adjacency claim to check.",
        "Peru does border Brazil, so it is one of Brazil's real neighbors.",
      ),
    ],
    correctReveal:
      "Chile does not border Brazil because Bolivia, Peru, and Argentina separate Chile from Brazil.",
    allP47Neighbors: [
      argentina,
      bolivia,
      colombia,
      france,
      frenchGuiana,
      guyana,
      paraguay,
      peru,
      suriname,
      uruguay,
      venezuela,
    ],
  },
  {
    ladderIndex: 4,
    difficulty: "intermediate",
    question: "Andes check: which country does NOT border Bolivia?",
    subject: bolivia,
    nonNeighbor: ecuador,
    options: [argentina, ecuador, chile, peru],
    distractors: [
      d(
        argentina,
        "southern cone proximity = unchecked option",
        "Argentina is close enough to be plausible, and the learner must notice that it is actually adjacent.",
        "Argentina does border Bolivia, so it is a real neighbor.",
      ),
      d(
        chile,
        "Andes corridor = possible confusion",
        "Chile is a narrow western neighbor and helps test whether the learner follows the border line rather than the region.",
        "Chile does border Bolivia, so it belongs in Bolivia's border list.",
      ),
      d(
        peru,
        "nearby Andean country = likely trap",
        "Peru is the key separator for the correct answer, so it must appear as a real-neighbor distractor.",
        "Peru does border Bolivia, so it is not the non-border answer.",
      ),
    ],
    correctReveal:
      "Ecuador does not border Bolivia because Peru lies between Ecuador and Bolivia.",
    allP47Neighbors: [argentina, brazil, chile, paraguay, peru],
  },
  {
    ladderIndex: 5,
    difficulty: "intermediate",
    question: "Central Europe trap: which country does NOT border Austria?",
    subject: austria,
    nonNeighbor: croatia,
    options: [germany, croatia, italy, hungary],
    distractors: [
      d(
        germany,
        "large adjacent country = too obvious to check",
        "Germany is a familiar neighbor, which keeps the learner focused on the inverse wording.",
        "Germany does border Austria, so it is a real neighbor.",
      ),
      d(
        italy,
        "Alps proximity = possible uncertainty",
        "Italy's Alpine frontier with Austria is easy to overlook in a compact regional option set.",
        "Italy does border Austria, so it belongs in Austria's P47 neighbor set.",
      ),
      d(
        hungary,
        "former imperial association = border shortcut",
        "Hungary is a plausible real neighbor and also tests whether historical association is being substituted for adjacency.",
        "Hungary does border Austria, so it is not the non-border answer.",
      ),
    ],
    correctReveal:
      "Croatia does not border Austria because Slovenia and Hungary sit between them.",
    allP47Neighbors: [
      czechia,
      germany,
      hungary,
      italy,
      liechtenstein,
      slovakia,
      slovenia,
      switzerland,
    ],
  },
  {
    ladderIndex: 6,
    difficulty: "hard",
    question:
      "Carpathian shortcut test: which country does NOT border Poland?",
    subject: poland,
    nonNeighbor: hungary,
    options: [germany, czechia, hungary, slovakia],
    distractors: [
      d(
        germany,
        "major western neighbor = easy recognition",
        "Germany is a real neighbor, preventing the learner from solving by broad central-European familiarity.",
        "Germany does border Poland, so it cannot be the non-neighbor.",
      ),
      d(
        czechia,
        "central Europe cluster = adjacency blur",
        "Czechia is in the same regional cluster and is a real neighbor that can be confused with nearby non-neighbors.",
        "Czechia does border Poland, so it belongs in Poland's border list.",
      ),
      d(
        slovakia,
        "separator country = likely overlooked",
        "Slovakia is the country that separates Poland from the correct near-miss, so it is an important real-neighbor distractor.",
        "Slovakia does border Poland, so it is not the country that fails to border Poland.",
      ),
    ],
    correctReveal:
      "Hungary does not border Poland because Slovakia lies between them.",
    allP47Neighbors: [
      belarus,
      czechia,
      germany,
      lithuania,
      russia,
      slovakia,
      ukraine,
    ],
  },
  {
    ladderIndex: 7,
    difficulty: "hard",
    question:
      "Steppe near-miss synthesis: which country does NOT border Kazakhstan?",
    subject: kazakhstan,
    nonNeighbor: mongolia,
    options: [russia, mongolia, china, uzbekistan],
    distractors: [
      d(
        russia,
        "huge nearby country = unchecked assumption",
        "Russia is a long real neighbor, so it anchors the set in true adjacency.",
        "Russia does border Kazakhstan, so it is a real neighbor.",
      ),
      d(
        china,
        "eastern edge proximity = possible miss",
        "China is close to both Kazakhstan and Mongolia, making it a useful real-neighbor distractor.",
        "China does border Kazakhstan, so it belongs in Kazakhstan's P47 neighbor set.",
      ),
      d(
        uzbekistan,
        "Central Asia cluster = regional shortcut",
        "Uzbekistan is another Central Asian country and checks whether the learner is relying on a region label instead of adjacency.",
        "Uzbekistan does border Kazakhstan, so it cannot be the non-border answer.",
      ),
    ],
    correctReveal:
      "Mongolia does not border Kazakhstan because Russia and China separate the two countries.",
    allP47Neighbors: [kyrgyzstan, china, russia, turkmenistan, uzbekistan],
  },
];

export const learnGeographyBorderReasoningLadderV1Questions =
  RAW_RUNGS.map(buildQuestion);

export const learnGeographyBorderReasoningLadderV1ByChecksum =
  Object.fromEntries(
    learnGeographyBorderReasoningLadderV1Questions.map((question) => [
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
      LearnGeographyBorderReasoningLadderQuestion,
      | "skillNodes"
      | "ladderIndex"
      | "distractors"
      | "correctReveal"
      | "provenance"
    >
  >;

function sourceRecord(
  sourceRef: string,
  facts: Record<string, unknown>,
): SourceRecord {
  return {
    sourceRef,
    sourceType: "structured_open",
    license: "CC0-1.0",
    retrievedAt: RETRIEVED_AT,
    volatility: "static",
    facts,
  };
}

function buildSourceRecords(rungs: RawLadderRung[]) {
  return rungs.map((rung) =>
    sourceRecord(borderRef(rung.subject), {
      subject: rung.subject,
      property: "P47",
      includedBorders: rung.distractors.map((distractor) => distractor.entity),
      excludedBorders: [rung.nonNeighbor],
      allP47Neighbors: rung.allP47Neighbors,
      closedBorderList: true,
    }),
  );
}

export const learnGeographyBorderReasoningLadderV1SourceRecords =
  buildSourceRecords(RAW_RUNGS);

export const learnGeographyBorderReasoningLadderV1Metadata = {
  batchId: BATCH_ID,
  mode: "learn",
  workUnitId: WORK_UNIT_ID,
  sourceType: "structured_open",
  sourceName: "Wikidata P47 shares border with",
  sourceLicense: "CC0-1.0",
  retrievedAt: RETRIEVED_AT,
  authorModel: AUTHOR_MODEL,
  verifierModel: VERIFIER_MODEL,
  verdict: "agree",
  skillNodes: [SKILL_NODE],
  questionCount: learnGeographyBorderReasoningLadderV1Questions.length,
  checksumPrefix: BATCH_ID,
  checksumConvention:
    "Bundled learn-mode ladder module stable human-readable ID; content QA separately checks normalized prompt-plus-answer duplicates.",
} as const;

export function validateLearnGeographyBorderReasoningLadderV1() {
  const errors: string[] = [];
  const checksums = new Set<string>();
  const ladderIndexes = new Set<number>();

  RAW_RUNGS.forEach((rung, index) => {
    const question = learnGeographyBorderReasoningLadderV1Questions[index];
    const neighborQids = new Set(
      rung.allP47Neighbors.map((neighbor) => neighbor.qid),
    );

    if (question.ladderIndex !== index + 1) {
      errors.push(`${question.checksum} has ladderIndex ${question.ladderIndex}`);
    }
    if (ladderIndexes.has(question.ladderIndex)) {
      errors.push(
        `${question.checksum} duplicates ladderIndex ${question.ladderIndex}`,
      );
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

    if (!question.options.includes(question.correctAnswer)) {
      errors.push(`${question.checksum} is missing the correct answer option`);
    }
    if (!question.correctReveal.trim()) {
      errors.push(`${question.checksum} is missing correctReveal`);
    }

    if (question.distractors.length !== 3) {
      errors.push(`${question.checksum} must have exactly 3 learn distractors`);
    }

    if (neighborQids.has(rung.nonNeighbor.qid)) {
      errors.push(
        `${question.checksum} correct answer ${rung.nonNeighbor.name} appears in ${rung.subject.name}'s P47 neighbors`,
      );
    }

    rung.distractors.forEach((rawDistractor, distractorIndex) => {
      const distractor = question.distractors[distractorIndex];
      if (!neighborQids.has(rawDistractor.entity.qid)) {
        errors.push(
          `${question.checksum} distractor ${rawDistractor.entity.name} is absent from ${rung.subject.name}'s P47 neighbors`,
        );
      }
      if (!question.options.includes(distractor.text)) {
        errors.push(
          `${question.checksum} distractor ${distractor.text} is not an option`,
        );
      }
      if (distractor.text === question.correctAnswer) {
        errors.push(`${question.checksum} marks the correct answer as a distractor`);
      }
      if (!distractor.misconception.trim()) {
        errors.push(
          `${question.checksum} distractor ${distractor.text} is missing misconception`,
        );
      }
      if (!distractor.whyChosen.trim()) {
        errors.push(
          `${question.checksum} distractor ${distractor.text} is missing whyChosen`,
        );
      }
      if (!distractor.reveal.trim()) {
        errors.push(
          `${question.checksum} distractor ${distractor.text} is missing reveal`,
        );
      }
    });

    if (question.provenance.verdict === "pending") {
      errors.push(`${question.checksum} must carry a cross-family verification verdict`);
    }
    if (question.provenance.verifierModel !== VERIFIER_MODEL) {
      errors.push(`${question.checksum} has unexpected verifierModel`);
    }
  });

  return {
    ok: errors.length === 0,
    errors,
    questionCount: learnGeographyBorderReasoningLadderV1Questions.length,
    sourceRecordCount: learnGeographyBorderReasoningLadderV1SourceRecords.length,
  };
}

export const questions = learnGeographyBorderReasoningLadderV1Questions;
export default learnGeographyBorderReasoningLadderV1Questions;
