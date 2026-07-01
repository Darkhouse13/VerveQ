// Subjects registry — the single source of truth for which Learn subjects
// exist. Serving surfaces (queries, pickers, the entry switcher) derive their
// subject lists from here; nothing downstream may hardcode a subject id.
// Adding a subject = add an entry here + author its skill nodes below.
export type LearnSubjectMeta = {
  id: string;
  name: string;
  description: string;
};

export const learnSubjects = [
  {
    id: "geography",
    name: "Geography",
    description: "Capitals, borders, and map reasoning.",
  },
  {
    id: "history",
    name: "History",
    description: "Event dates, founding years, and chronology.",
  },
  {
    id: "science",
    name: "Science",
    description: "Element symbols, atomic numbers, and SI units.",
  },
  {
    id: "astronomy",
    name: "Astronomy",
    description: "Planets, moons, stars, and cosmic scale.",
  },
  {
    id: "biology",
    name: "Biology",
    description: "Classification, human anatomy, and cells.",
  },
  {
    id: "mathematics",
    name: "Mathematics",
    description: "Sequences, constants, and geometry.",
  },
  {
    id: "language",
    name: "Language",
    description: "Greek and Latin roots, affixes, and word origins.",
  },
] as const satisfies readonly LearnSubjectMeta[];

export type LearnSubjectId = (typeof learnSubjects)[number]["id"];

export const DEFAULT_LEARN_SUBJECT: LearnSubjectId = learnSubjects[0].id;

export const learnSubjectById = Object.fromEntries(
  learnSubjects.map((subject) => [subject.id, subject]),
) as Record<LearnSubjectId, LearnSubjectMeta>;

/** Maps unknown/missing subject ids to the default rather than throwing —
 * responses always declare which subject they resolved to. */
export function resolveLearnSubject(subject?: string | null): LearnSubjectId {
  if (subject && subject in learnSubjectById) return subject as LearnSubjectId;
  return DEFAULT_LEARN_SUBJECT;
}

export function isLearnSubject(subject: string): subject is LearnSubjectId {
  return subject in learnSubjectById;
}

export const skillNodeIds = [
  "geo.capitals.core",
  "geo.capitals.europe",
  "geo.capitals.asia",
  "geo.capitals.other",
  "geo.capitals.nonobvious",
  "geo.borders.identify",
  "geo.borders.reasoning",
  "geo.pipeline.proof",
  "hist.events.dates",
  "hist.founding.years",
  "hist.chronology",
  "sci.elements.symbols",
  "sci.elements.numbers",
  "sci.units.si",
  "astro.solarSystem",
  "astro.moons",
  "astro.starsAndScale",
  "bio.taxonomy",
  "bio.anatomy",
  "bio.cells",
  "math.sequences",
  "math.constants",
  "math.geometry",
  "lang.roots",
  "lang.affixes",
  "lang.etymology",
] as const;

export type SkillNodeId = (typeof skillNodeIds)[number];
export const PIPELINE_PROOF_NODE_ID = "geo.pipeline.proof" satisfies SkillNodeId;

export type SkillNode = {
  id: SkillNodeId;
  subject: LearnSubjectId;
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
  {
    id: "hist.events.dates",
    subject: "history",
    name: "Event dates",
    description:
      "Anchoring major battles, treaties, and turning points to their years.",
    prerequisites: [],
  },
  {
    id: "hist.founding.years",
    subject: "history",
    name: "Founding & independence",
    description:
      "Inception years of institutions, organizations, and newly independent states.",
    prerequisites: [],
  },
  {
    id: "hist.chronology",
    subject: "history",
    name: "Chronology",
    description:
      "Ordering events in time: which came first, which came latest, and why.",
    prerequisites: ["hist.events.dates", "hist.founding.years"],
  },
  {
    id: "sci.elements.symbols",
    subject: "science",
    name: "Element symbols",
    description: "Matching chemical elements to their periodic-table symbols.",
    prerequisites: [],
  },
  {
    id: "sci.elements.numbers",
    subject: "science",
    name: "Atomic numbers",
    description: "Placing elements by atomic number on the periodic table.",
    prerequisites: ["sci.elements.symbols"],
  },
  {
    id: "sci.units.si",
    subject: "science",
    name: "SI unit symbols",
    description:
      "SI base and special-named units and the symbols that stand for them.",
    prerequisites: [],
  },
  {
    id: "astro.solarSystem",
    subject: "astronomy",
    name: "The Solar System",
    description:
      "The planets and their order, sizes, and standout traits — including the traps where closest or biggest is not the answer.",
    prerequisites: [],
  },
  {
    id: "astro.moons",
    subject: "astronomy",
    name: "Moons",
    description:
      "Matching major moons to the planets they orbit and the records that make them famous.",
    prerequisites: ["astro.solarSystem"],
  },
  {
    id: "astro.starsAndScale",
    subject: "astronomy",
    name: "Stars & cosmic scale",
    description:
      "Stars, brightness, distances, and the units used to measure a universe far too big for kilometres.",
    prerequisites: ["astro.solarSystem"],
  },
  {
    id: "bio.taxonomy",
    subject: "biology",
    name: "Classification",
    description:
      "Sorting animals into their groups — mammal, reptile, amphibian, arachnid — and the ranks of the taxonomic hierarchy.",
    prerequisites: [],
  },
  {
    id: "bio.anatomy",
    subject: "biology",
    name: "Human anatomy",
    description:
      "The organs, systems, and bones of the human body and what each one does.",
    prerequisites: [],
  },
  {
    id: "bio.cells",
    subject: "biology",
    name: "Cells & genetics",
    description:
      "The parts of a cell, what each organelle does, and the molecules that carry the genetic code.",
    prerequisites: ["bio.taxonomy"],
  },
  {
    id: "math.sequences",
    subject: "mathematics",
    name: "Sequences & patterns",
    description:
      "Continuing number patterns — even numbers, squares, cubes, primes, and the Fibonacci sequence — by finding the rule.",
    prerequisites: [],
  },
  {
    id: "math.constants",
    subject: "mathematics",
    name: "Numbers & constants",
    description:
      "Key mathematical constants and definitions: pi, e, the golden ratio, primes, and powers.",
    prerequisites: [],
  },
  {
    id: "math.geometry",
    subject: "mathematics",
    name: "Geometry",
    description:
      "Polygon names and sides, angle facts, triangle types, and the parts of a right triangle.",
    prerequisites: [],
  },
  {
    id: "lang.roots",
    subject: "language",
    name: "Greek & Latin roots",
    description:
      "The combining roots that build English words — photo, aqua, bio, geo, chrono — and what they mean.",
    prerequisites: [],
  },
  {
    id: "lang.affixes",
    subject: "language",
    name: "Prefixes & suffixes",
    description:
      "The affixes that change meaning — un-, re-, pre-, anti-, -ology, -phobia — and how they work.",
    prerequisites: ["lang.roots"],
  },
  {
    id: "lang.etymology",
    subject: "language",
    name: "Word origins",
    description:
      "The languages English borrowed everyday words from — German, Japanese, Arabic, Czech, and more.",
    prerequisites: ["lang.roots"],
  },
];

export const skillNodeById = Object.fromEntries(
  skillNodes.map((node) => [node.id, node]),
) as Record<SkillNodeId, SkillNode>;

export function isPipelineProofNode(node: SkillNode): boolean {
  return node.contentKind === "pipeline_proof";
}
