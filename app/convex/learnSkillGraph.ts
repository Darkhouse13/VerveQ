export const skillNodeIds = [
  "geo.capitals.core",
  "geo.capitals.europe",
  "geo.capitals.asia",
  "geo.capitals.other",
  "geo.capitals.nonobvious",
  "geo.borders.identify",
  "geo.borders.reasoning",
  "geo.pipeline.proof",
] as const;

export type SkillNodeId = (typeof skillNodeIds)[number];
export const PIPELINE_PROOF_NODE_ID = "geo.pipeline.proof" satisfies SkillNodeId;

export type SkillNode = {
  id: SkillNodeId;
  subject: "geography";
  name: string;
  description: string;
  prerequisites: SkillNodeId[];
  contentKind?: "verified" | "pipeline_proof";
};

export const skillNodes: SkillNode[] = [
  {
    id: "geo.capitals.core",
    subject: "geography",
    name: "Core capitals",
    description:
      "Obvious or iconic capital-city anchors used as the easy on-ramp for capital recall.",
    prerequisites: [],
  },
  {
    id: "geo.capitals.europe",
    subject: "geography",
    name: "European capitals",
    description: "Capital recall for countries assigned to Europe.",
    prerequisites: ["geo.capitals.core"],
  },
  {
    id: "geo.capitals.asia",
    subject: "geography",
    name: "Asian capitals",
    description: "Capital recall for countries assigned to Asia.",
    prerequisites: ["geo.capitals.core"],
  },
  {
    id: "geo.capitals.other",
    subject: "geography",
    name: "Other-region capitals",
    description: "Capital recall for Africa, the Americas, and Oceania.",
    prerequisites: ["geo.capitals.core"],
  },
  {
    id: "geo.capitals.nonobvious",
    subject: "geography",
    name: "Non-obvious capitals",
    description:
      "Capital recall where a larger, more famous, or administratively confusing city is a common trap.",
    prerequisites: ["geo.capitals.core"],
  },
  {
    id: "geo.borders.identify",
    subject: "geography",
    name: "Border identification",
    description: "Positive identification of which country borders a named country.",
    prerequisites: [],
  },
  {
    id: "geo.borders.reasoning",
    subject: "geography",
    name: "Border reasoning",
    description:
      "Explicit non-adjacency reasoning, including prompts asking which country does not border another.",
    prerequisites: ["geo.borders.identify"],
  },
  {
    id: PIPELINE_PROOF_NODE_ID,
    subject: "geography",
    name: "Pipeline proof fixture",
    description:
      "Pipeline-proof fixture only: trivial geography facts for validating live MCQ, text, numeric, and ordering rungs. Not shippable verified CIE content.",
    prerequisites: [],
    contentKind: "pipeline_proof",
  },
];

export const skillNodeById = Object.fromEntries(
  skillNodes.map((node) => [node.id, node]),
) as Record<SkillNodeId, SkillNode>;

export function isPipelineProofNode(node: SkillNode): boolean {
  return node.contentKind === "pipeline_proof";
}
