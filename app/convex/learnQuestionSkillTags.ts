import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";
import { learnTaggedCieScoreBatches } from "./knowledgeCieScoreBatchRegistry";
import {
  isPipelineProofNode,
  skillNodeIds,
  skillNodes,
  type SkillNode,
  type SkillNodeId,
} from "./learnSkillGraph";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type CapitalRegionNodeId =
  | "geo.capitals.europe"
  | "geo.capitals.asia"
  | "geo.capitals.other";

type ProvenanceClaim = {
  claim: string;
};

type TaggedKnowledgeQuestion = KnowledgeQuestionSeed & {
  provenance: {
    claims: ProvenanceClaim[];
  };
};

export type VerifiedGeographyCieScoreBatch = {
  batchId: string;
  questions: TaggedKnowledgeQuestion[];
};

// The Learn tagging set is frozen by the registry's learnTagged flag — exactly
// the batches this module imported directly before the registry existed. Only
// batches whose score-mode verification verdict is "agree" may carry the flag.
const learnTaggedBatches = learnTaggedCieScoreBatches;

export const verifiedGeographyCieScoreBatches: VerifiedGeographyCieScoreBatch[] =
  learnTaggedBatches
    .filter((entry) => entry.subject === "geography")
    .map((entry) => ({
      batchId: entry.metadata.batchId,
      questions: [...entry.questions],
    }));

export const verifiedGeographyCieScoreQuestions =
  verifiedGeographyCieScoreBatches.flatMap((batch) => batch.questions);

// History and science wire in through the same verified-batch path.
export const verifiedHistoryCieScoreQuestions: TaggedKnowledgeQuestion[] =
  learnTaggedBatches
    .filter((entry) => entry.subject === "history")
    .flatMap((entry) => entry.questions);

export const verifiedScienceCieScoreQuestions: TaggedKnowledgeQuestion[] =
  learnTaggedBatches
    .filter((entry) => entry.subject === "science")
    .flatMap((entry) => entry.questions);

export const verifiedLearnCieScoreBatchIds = learnTaggedBatches.map(
  (entry) => entry.metadata.batchId,
);

// Every verified CIE question the Learn graph can tag, across all subjects.
export const verifiedLearnCieScoreQuestions: TaggedKnowledgeQuestion[] = [
  ...verifiedGeographyCieScoreQuestions,
  ...verifiedHistoryCieScoreQuestions,
  ...verifiedScienceCieScoreQuestions,
];

export const capitalRegionConvention =
  "Capital questions are assigned by the continent containing the capital city; under this convention Russia is Europe and Turkey is Asia.";

export const coreCapitalProminenceCriterion =
  "Core capitals are country-capital pairs where the capital is the dominant domestic city or an internationally iconic capital anchor; non-obvious capitals are reserved for common traps involving a larger, more famous, or administratively confusing city.";

const capitalRegionByCountry: Record<string, CapitalRegionNodeId> = {
  Argentina: "geo.capitals.other",
  Australia: "geo.capitals.other",
  Austria: "geo.capitals.europe",
  Bangladesh: "geo.capitals.asia",
  Belgium: "geo.capitals.europe",
  Brazil: "geo.capitals.other",
  Bulgaria: "geo.capitals.europe",
  Canada: "geo.capitals.other",
  China: "geo.capitals.asia",
  Croatia: "geo.capitals.europe",
  Czechia: "geo.capitals.europe",
  Denmark: "geo.capitals.europe",
  Egypt: "geo.capitals.other",
  Finland: "geo.capitals.europe",
  France: "geo.capitals.europe",
  Germany: "geo.capitals.europe",
  Greece: "geo.capitals.europe",
  Hungary: "geo.capitals.europe",
  India: "geo.capitals.asia",
  Iran: "geo.capitals.asia",
  Ireland: "geo.capitals.europe",
  Italy: "geo.capitals.europe",
  Japan: "geo.capitals.asia",
  Kenya: "geo.capitals.other",
  Mexico: "geo.capitals.other",
  Morocco: "geo.capitals.other",
  Nepal: "geo.capitals.asia",
  Netherlands: "geo.capitals.europe",
  Nigeria: "geo.capitals.other",
  Norway: "geo.capitals.europe",
  Pakistan: "geo.capitals.asia",
  Peru: "geo.capitals.other",
  Philippines: "geo.capitals.asia",
  Poland: "geo.capitals.europe",
  Portugal: "geo.capitals.europe",
  Romania: "geo.capitals.europe",
  Russia: "geo.capitals.europe",
  "Saudi Arabia": "geo.capitals.asia",
  Serbia: "geo.capitals.europe",
  "South Africa": "geo.capitals.other",
  "South Korea": "geo.capitals.asia",
  Spain: "geo.capitals.europe",
  Sweden: "geo.capitals.europe",
  Switzerland: "geo.capitals.europe",
  Thailand: "geo.capitals.asia",
  Turkey: "geo.capitals.asia",
  Ukraine: "geo.capitals.europe",
  "United Kingdom": "geo.capitals.europe",
  "United States": "geo.capitals.other",
  Vietnam: "geo.capitals.asia",
};

const nonObviousCapitalCountries = new Set([
  "Australia",
  "Brazil",
  "Canada",
  "India",
  "Morocco",
  "Nigeria",
  "Pakistan",
  "South Africa",
  "Switzerland",
  "Turkey",
]);

const coreCapitalCountries = new Set(
  Object.keys(capitalRegionByCountry).filter(
    (country) => !nonObviousCapitalCountries.has(country),
  ),
);

export const coreCapitalCountryCount = coreCapitalCountries.size;

const nodeOrder = new Map<SkillNodeId, number>(
  skillNodeIds.map((id, index) => [id, index]),
);

const difficultyOrder: Difficulty[] = ["easy", "intermediate", "hard"];
const cieSkillNodeIds = skillNodes
  .filter((node) => !isPipelineProofNode(node))
  .map((node) => node.id);

function orderedTags(tags: SkillNodeId[]) {
  return [...new Set(tags)].sort(
    (left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0),
  );
}

function firstClaim(question: TaggedKnowledgeQuestion) {
  return question.provenance.claims[0]?.claim ?? "";
}

function capitalCountry(question: TaggedKnowledgeQuestion) {
  return firstClaim(question).match(/^capital_of\((.+)\) = (.+)$/)?.[1] ?? null;
}

function isPositiveBorderQuestion(question: TaggedKnowledgeQuestion) {
  return firstClaim(question).startsWith("shares_border_with(");
}

function isExplicitNonAdjacencyStem(question: TaggedKnowledgeQuestion) {
  return /\b(?:does not|doesn't|do not|do n't|not)\s+(?:share\s+a\s+border|border|bordering|neighbor|neighbour)|\bwhich\s+(?:country\s+)?(?:does\s+not|is\s+not)\b/i.test(
    question.question,
  );
}

function capitalTags(question: TaggedKnowledgeQuestion): SkillNodeId[] {
  const country = capitalCountry(question);
  if (!country) return [];

  const regionNode = capitalRegionByCountry[country];
  if (!regionNode) return [];

  const tags: SkillNodeId[] = [regionNode];
  const isCore = coreCapitalCountries.has(country);
  const isNonObvious = nonObviousCapitalCountries.has(country);

  if (isCore && isNonObvious) return [];
  if (isCore) tags.push("geo.capitals.core");
  if (isNonObvious) tags.push("geo.capitals.nonobvious");

  return orderedTags(tags);
}

function borderTags(question: TaggedKnowledgeQuestion): SkillNodeId[] {
  if (isExplicitNonAdjacencyStem(question)) {
    return ["geo.borders.reasoning"];
  }

  if (isPositiveBorderQuestion(question)) {
    return ["geo.borders.identify"];
  }

  return [];
}

export function tagGeographyQuestion(question: TaggedKnowledgeQuestion): SkillNodeId[] {
  if (question.category === "capital_cities") {
    return capitalTags(question);
  }

  if (question.category === "country_facts") {
    return borderTags(question);
  }

  return [];
}

// History and science map category → node 1:1; the batch categories were fixed
// during cross-family verification, so no per-question heuristics are needed.
const nodeByCategory: Partial<Record<string, SkillNodeId>> = {
  historical_event_dates: "hist.events.dates",
  founding_independence_years: "hist.founding.years",
  historical_chronology: "hist.chronology",
  chemical_element_symbols: "sci.elements.symbols",
  chemical_element_atomic_numbers: "sci.elements.numbers",
  si_unit_symbols: "sci.units.si",
};

export function tagLearnQuestion(question: TaggedKnowledgeQuestion): SkillNodeId[] {
  const byCategory = nodeByCategory[question.category];
  if (byCategory) return [byCategory];
  return tagGeographyQuestion(question);
}

export function buildQuestionSkillTags(
  questions: TaggedKnowledgeQuestion[] = verifiedLearnCieScoreQuestions,
) {
  return Object.fromEntries(
    questions.map((question) => [question.checksum, tagLearnQuestion(question)]),
  ) as Record<string, SkillNodeId[]>;
}

export const questionSkillTags = buildQuestionSkillTags();

export type TaggedQuestionSummary = {
  checksum: string;
  category: string;
  difficulty: Difficulty;
  question: string;
  tags: SkillNodeId[];
};

export type DifficultyGap = {
  nodeId: SkillNodeId;
  difficulty: Difficulty;
};

export type UnderpopulatedNode = {
  nodeId: SkillNodeId;
  count: number;
  reason: string;
};

export type LearnSkillGraphValidationReport = {
  batchIds: string[];
  questionCount: number;
  acyclic: boolean;
  cycles: SkillNodeId[][];
  errors: string[];
  orphanNodes: SkillNodeId[];
  underpopulatedNodes: UnderpopulatedNode[];
  difficultyGaps: DifficultyGap[];
  populationByNode: Record<SkillNodeId, number>;
  populationByNodeDifficulty: Record<SkillNodeId, Record<Difficulty, number>>;
  zeroFitQuestions: TaggedQuestionSummary[];
  multiFitQuestions: TaggedQuestionSummary[];
  coreCapitalCount: number;
  regionConvention: string;
  coreCriterion: string;
};

function emptyNodeCounts() {
  return Object.fromEntries(skillNodeIds.map((id) => [id, 0])) as Record<
    SkillNodeId,
    number
  >;
}

function emptyDifficultyCounts() {
  return Object.fromEntries(
    skillNodeIds.map((id) => [
      id,
      Object.fromEntries(difficultyOrder.map((difficulty) => [difficulty, 0])),
    ]),
  ) as Record<SkillNodeId, Record<Difficulty, number>>;
}

function summarizeQuestion(
  question: TaggedKnowledgeQuestion,
  tags: SkillNodeId[],
): TaggedQuestionSummary {
  return {
    checksum: question.checksum,
    category: question.category,
    difficulty: question.difficulty,
    question: question.question,
    tags,
  };
}

function findGraphCycles(nodes: SkillNode[]) {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const cycles: SkillNodeId[][] = [];
  const visiting = new Set<SkillNodeId>();
  const visited = new Set<SkillNodeId>();
  const stack: SkillNodeId[] = [];

  function visit(nodeId: SkillNodeId) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      const start = stack.indexOf(nodeId);
      cycles.push([...stack.slice(start), nodeId]);
      return;
    }

    visiting.add(nodeId);
    stack.push(nodeId);

    const node = nodes.find((candidate) => candidate.id === nodeId);
    for (const prerequisite of node?.prerequisites ?? []) {
      if (nodeIds.has(prerequisite)) visit(prerequisite);
    }

    stack.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of nodes) visit(node.id);
  return cycles;
}

function sameTags(left: SkillNodeId[], right: SkillNodeId[]) {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

export function validateLearnSkillGraph(options?: { minNodePopulation?: number }) {
  const minNodePopulation = options?.minNodePopulation ?? 5;
  const nodeIds = new Set(skillNodeIds);
  const errors: string[] = [];
  const populationByNode = emptyNodeCounts();
  const populationByNodeDifficulty = emptyDifficultyCounts();
  const zeroFitQuestions: TaggedQuestionSummary[] = [];
  const multiFitQuestions: TaggedQuestionSummary[] = [];
  const seenChecksums = new Set<string>();

  for (const node of skillNodes) {
    for (const prerequisite of node.prerequisites) {
      if (!nodeIds.has(prerequisite)) {
        errors.push(`${node.id} references unknown prerequisite ${prerequisite}`);
      }
    }
  }

  for (const question of verifiedLearnCieScoreQuestions) {
    if (seenChecksums.has(question.checksum)) {
      errors.push(`Duplicate verified CIE checksum ${question.checksum}`);
    }
    seenChecksums.add(question.checksum);

    const tags = questionSkillTags[question.checksum] ?? [];
    const derivedTags = tagLearnQuestion(question);
    if (!sameTags(tags, derivedTags)) {
      errors.push(`Stored tags for ${question.checksum} differ from derived tags`);
    }

    for (const tag of tags) {
      if (!nodeIds.has(tag)) {
        errors.push(`${question.checksum} references unknown skill node ${tag}`);
        continue;
      }
      populationByNode[tag] += 1;
      populationByNodeDifficulty[tag][question.difficulty] += 1;
    }

    if (tags.length === 0) {
      zeroFitQuestions.push(summarizeQuestion(question, tags));
    }

    if (tags.length > 1) {
      multiFitQuestions.push(summarizeQuestion(question, tags));
    }

    if (question.category === "capital_cities") {
      const regionTags = tags.filter(
        (tag): tag is CapitalRegionNodeId =>
          tag === "geo.capitals.europe" ||
          tag === "geo.capitals.asia" ||
          tag === "geo.capitals.other",
      );
      if (regionTags.length !== 1) {
        errors.push(`${question.checksum} must have exactly one capital region tag`);
      }
      if (
        tags.includes("geo.capitals.core") &&
        tags.includes("geo.capitals.nonobvious")
      ) {
        errors.push(`${question.checksum} cannot be both core and non-obvious`);
      }
    }

    if (
      question.category === "country_facts" &&
      isPositiveBorderQuestion(question) &&
      !isExplicitNonAdjacencyStem(question) &&
      tags.includes("geo.borders.reasoning")
    ) {
      errors.push(`${question.checksum} positive border stem was tagged as reasoning`);
    }
  }

  const cycles = findGraphCycles(skillNodes);
  const orphanNodes = cieSkillNodeIds.filter((id) => populationByNode[id] === 0);
  const underpopulatedNodes = cieSkillNodeIds
    .filter((id) => populationByNode[id] < minNodePopulation)
    .map((id) => ({
      nodeId: id,
      count: populationByNode[id],
      reason:
        populationByNode[id] === 0
          ? "orphan node with no tagged questions"
          : `below minimum node population ${minNodePopulation}`,
    }));
  const difficultyGaps = cieSkillNodeIds.flatMap((nodeId) =>
    difficultyOrder
      .filter((difficulty) => populationByNodeDifficulty[nodeId][difficulty] === 0)
      .map((difficulty) => ({ nodeId, difficulty })),
  );

  return {
    batchIds: verifiedLearnCieScoreBatchIds,
    questionCount: verifiedLearnCieScoreQuestions.length,
    acyclic: cycles.length === 0,
    cycles,
    errors,
    orphanNodes,
    underpopulatedNodes,
    difficultyGaps,
    populationByNode,
    populationByNodeDifficulty,
    zeroFitQuestions,
    multiFitQuestions,
    coreCapitalCount: coreCapitalCountryCount,
    regionConvention: capitalRegionConvention,
    coreCriterion: coreCapitalProminenceCriterion,
  } satisfies LearnSkillGraphValidationReport;
}

export function formatLearnSkillGraphValidationReport(
  report: LearnSkillGraphValidationReport,
) {
  const lines = [
    "# Learn skill graph validation",
    "",
    `Batches: ${report.batchIds.join(", ")}`,
    `Questions: ${report.questionCount}`,
    `Prerequisite graph acyclic: ${report.acyclic ? "yes" : "no"}`,
    `Core capital tags: ${report.coreCapitalCount}`,
    `Zero-fit questions: ${report.zeroFitQuestions.length}`,
    `Multi-fit questions: ${report.multiFitQuestions.length}`,
    `Orphan nodes: ${report.orphanNodes.length ? report.orphanNodes.join(", ") : "none"}`,
    "",
    "Population by node:",
    "| node | total | easy | intermediate | hard |",
    "|---|---:|---:|---:|---:|",
  ];

  for (const nodeId of cieSkillNodeIds) {
    const byDifficulty = report.populationByNodeDifficulty[nodeId];
    lines.push(
      `| ${nodeId} | ${report.populationByNode[nodeId]} | ${byDifficulty.easy} | ${byDifficulty.intermediate} | ${byDifficulty.hard} |`,
    );
  }

  lines.push("", "Underpopulated nodes:");
  if (report.underpopulatedNodes.length === 0) {
    lines.push("- none");
  } else {
    for (const node of report.underpopulatedNodes) {
      lines.push(`- ${node.nodeId}: ${node.count} (${node.reason})`);
    }
  }

  lines.push("", "Difficulty gaps:");
  if (report.difficultyGaps.length === 0) {
    lines.push("- none");
  } else {
    for (const gap of report.difficultyGaps) {
      lines.push(`- ${gap.nodeId}: ${gap.difficulty}`);
    }
  }

  if (report.errors.length > 0) {
    lines.push("", "Errors:");
    for (const error of report.errors) lines.push(`- ${error}`);
  }

  return lines.join("\n");
}
