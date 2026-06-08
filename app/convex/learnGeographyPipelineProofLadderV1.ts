import type { SkillNodeId } from "./learnSkillGraph";
import type { LearnQuestionType } from "./learnGraders";
import type { LearnModeDistractor } from "./learnGeographyNonobviousLadderV1";

// PIPELINE-PROOF FIXTURE ONLY.
//
// This ladder exists to prove the live Learn v2 pipeline can render and grade
// MCQ, text, numeric, and ordering rungs end-to-end. These are deliberately
// trivial geography facts, not shippable verified lesson content. At-scale
// verified content still belongs to the CIE pipeline.

const PROOF_NODE: SkillNodeId = "geo.pipeline.proof";

type ProofDifficulty = "easy" | "intermediate" | "hard";

export type LearnOrderRenderItem = {
  id: string;
  text: string;
};

export type LearnGeographyPipelineProofQuestion = {
  checksum: string;
  type: LearnQuestionType;
  question: string;
  options: string[];
  correctAnswer: string;
  difficulty: ProofDifficulty;
  skillNodes: SkillNodeId[];
  ladderIndex: number;
  distractors: LearnModeDistractor[];
  correctReveal: string;
  acceptedAnswers?: string[];
  textEditDistance?: number;
  numericAnswer?: number;
  numericTolerance?: number;
  numericUnit?: string;
  acceptedUnits?: string[];
  items?: LearnOrderRenderItem[];
  correctOrder?: string[];
};

export const LEARN_GEOGRAPHY_PIPELINE_PROOF_CONCEPT =
  "Pipeline-proof fixture: trivial geography facts used only to verify live MCQ, text, numeric, and ordering rungs.";

export const learnGeographyPipelineProofLadderV1Questions: LearnGeographyPipelineProofQuestion[] =
  [
    {
      checksum: "learn_geo_pipeline_proof_mcq_france_capital",
      type: "mcq",
      question: "Which country has Paris as its capital?",
      options: ["France", "Spain", "Italy", "Germany"],
      correctAnswer: "France",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 1,
      distractors: [
        { text: "Spain", reveal: "Spain's capital is Madrid, not Paris." },
        { text: "Italy", reveal: "Italy's capital is Rome, not Paris." },
        { text: "Germany", reveal: "Germany's capital is Berlin, not Paris." },
      ],
      correctReveal: "Paris is the capital city of France.",
    },
    {
      checksum: "learn_geo_pipeline_proof_text_france_capital",
      type: "text",
      question: "Type the capital city of France.",
      options: [],
      correctAnswer: "Paris",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 2,
      distractors: [],
      correctReveal: "France's capital is Paris.",
      acceptedAnswers: ["Paris"],
      textEditDistance: 1,
    },
    {
      checksum: "learn_geo_pipeline_proof_text_brazil_continent",
      type: "text",
      question: "Type the continent where Brazil is located.",
      options: [],
      correctAnswer: "South America",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 3,
      distractors: [],
      correctReveal: "Brazil is in South America.",
      acceptedAnswers: ["South America"],
      textEditDistance: 1,
    },
    {
      checksum: "learn_geo_pipeline_proof_text_ottawa_country",
      type: "text",
      question: "Type the country whose capital is Ottawa.",
      options: [],
      correctAnswer: "Canada",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 4,
      distractors: [],
      correctReveal: "Ottawa is the capital of Canada.",
      acceptedAnswers: ["Canada"],
      textEditDistance: 1,
    },
    {
      checksum: "learn_geo_pipeline_proof_numeric_hispaniola_countries",
      type: "numeric",
      question: "How many countries share the island of Hispaniola?",
      options: [],
      correctAnswer: "2",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 5,
      distractors: [],
      correctReveal: "Hispaniola is shared by Haiti and the Dominican Republic.",
      numericAnswer: 2,
      numericTolerance: 0,
      numericUnit: "countries",
      acceptedUnits: ["country", "countries"],
    },
    {
      checksum: "learn_geo_pipeline_proof_numeric_us_mexico_border_states",
      type: "numeric",
      question: "How many U.S. states border Mexico?",
      options: [],
      correctAnswer: "4",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 6,
      distractors: [],
      correctReveal:
        "California, Arizona, New Mexico, and Texas border Mexico.",
      numericAnswer: 4,
      numericTolerance: 0,
      numericUnit: "states",
      acceptedUnits: ["state", "states"],
    },
    {
      checksum: "learn_geo_pipeline_proof_numeric_common_continents",
      type: "numeric",
      question: "In the common school model, how many continents are there?",
      options: [],
      correctAnswer: "7",
      difficulty: "easy",
      skillNodes: [PROOF_NODE],
      ladderIndex: 7,
      distractors: [],
      correctReveal:
        "The common school model counts seven continents.",
      numericAnswer: 7,
      numericTolerance: 0,
      numericUnit: "continents",
      acceptedUnits: ["continent", "continents"],
    },
    {
      checksum: "learn_geo_pipeline_proof_order_capitals_west_to_east",
      type: "order",
      question: "Order these capitals from west to east.",
      options: ["Paris", "Berlin", "Warsaw"],
      correctAnswer: "Paris, Berlin, Warsaw",
      difficulty: "intermediate",
      skillNodes: [PROOF_NODE],
      ladderIndex: 8,
      distractors: [],
      correctReveal:
        "Paris is west of Berlin, and Berlin is west of Warsaw.",
      items: [
        { id: "paris", text: "Paris" },
        { id: "warsaw", text: "Warsaw" },
        { id: "berlin", text: "Berlin" },
      ],
      correctOrder: ["paris", "berlin", "warsaw"],
    },
    {
      checksum: "learn_geo_pipeline_proof_order_continents_area",
      type: "order",
      question: "Order these continents from largest area to smallest area.",
      options: ["Asia", "Africa", "North America"],
      correctAnswer: "Asia, Africa, North America",
      difficulty: "intermediate",
      skillNodes: [PROOF_NODE],
      ladderIndex: 9,
      distractors: [],
      correctReveal:
        "By area, Asia is largest, then Africa, then North America.",
      items: [
        { id: "north-america", text: "North America" },
        { id: "asia", text: "Asia" },
        { id: "africa", text: "Africa" },
      ],
      correctOrder: ["asia", "africa", "north-america"],
    },
    {
      checksum: "learn_geo_pipeline_proof_order_capitals_north_to_south",
      type: "order",
      question: "Order these capitals from north to south.",
      options: ["Reykjavik", "Madrid", "Rabat"],
      correctAnswer: "Reykjavik, Madrid, Rabat",
      difficulty: "intermediate",
      skillNodes: [PROOF_NODE],
      ladderIndex: 10,
      distractors: [],
      correctReveal:
        "Reykjavik is farther north than Madrid, and Madrid is farther north than Rabat.",
      items: [
        { id: "rabat", text: "Rabat" },
        { id: "reykjavik", text: "Reykjavik" },
        { id: "madrid", text: "Madrid" },
      ],
      correctOrder: ["reykjavik", "madrid", "rabat"],
    },
  ];

export const learnGeographyPipelineProofLadderV1ByChecksum = Object.fromEntries(
  learnGeographyPipelineProofLadderV1Questions.map((question) => [
    question.checksum,
    {
      skillNodes: question.skillNodes,
      distractors: question.distractors,
      correctReveal: question.correctReveal,
    },
  ]),
);
