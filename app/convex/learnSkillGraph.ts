export const skillNodeIds = [
  "geo.capitals.core",
  "geo.capitals.europe",
  "geo.capitals.asia",
  "geo.capitals.other",
  "geo.capitals.nonobvious",
  "geo.borders.identify",
  "geo.borders.reasoning",
] as const;

export type SkillNodeId = (typeof skillNodeIds)[number];

export type SkillNode = {
  id: SkillNodeId;
  subject: "geography";
  name: string;
  description: string;
  prerequisites: SkillNodeId[];
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
];

export const skillNodeById = Object.fromEntries(
  skillNodes.map((node) => [node.id, node]),
) as Record<SkillNodeId, SkillNode>;
