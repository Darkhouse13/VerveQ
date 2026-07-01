// Learn teaching ladder — Biology: human anatomy.
//
// The teach: each organ has one main job, and knowing the job is how you remember
// which organ (and which system) does what. Distractors are neighbouring organs
// with a different role, so a wrong pick teaches that role too. Facts only
// (anatomy reference / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_biology_anatomy_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "Which organ pumps blood around the body?",
    correctAnswer: "The heart",
    correctReveal:
      "The heart is a muscular pump that pushes blood through the circulatory system; the lungs add oxygen but do not do the pumping.",
    distractors: [
      {
        text: "The lungs",
        misconception: "the organ that handles blood-oxygen also pumps it",
        whyChosen:
          "The lungs work closely with the heart on blood, the strongest trap.",
        reveal:
          "The lungs oxygenate blood and remove carbon dioxide, but the heart is what pumps it.",
      },
      {
        text: "The liver",
        misconception: "the body's biggest internal organ moves the blood",
        whyChosen:
          "The liver processes a lot of blood, so it can seem central.",
        reveal:
          "The liver filters and processes blood chemically, but it does not pump it.",
      },
      {
        text: "The kidneys",
        misconception: "blood-filtering organs also circulate blood",
        whyChosen:
          "The kidneys handle blood too, a plausible confusion.",
        reveal:
          "The kidneys filter waste from blood into urine; pumping is the heart's job.",
      },
    ],
    claims: [
      claim("function(heart) = pumps blood (circulatory system)", "reference:anatomy"),
      claim("function(lungs) = gas exchange (respiratory system)", "reference:anatomy"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which organ filters waste from the blood to make urine?",
    correctAnswer: "The kidneys",
    correctReveal:
      "The kidneys filter the blood and send waste out as urine; the liver also cleans the blood, but chemically, not by making urine.",
    distractors: [
      {
        text: "The liver",
        misconception: "the main detox organ makes urine",
        whyChosen:
          "The liver detoxifies blood, so it is the strongest near-miss.",
        reveal:
          "The liver breaks down toxins and processes nutrients, but urine is produced by the kidneys.",
      },
      {
        text: "The stomach",
        misconception: "any abdominal organ handles fluids",
        whyChosen:
          "The stomach is a well-known abdominal organ.",
        reveal:
          "The stomach digests food; it plays no part in filtering blood or making urine.",
      },
      {
        text: "The spleen",
        misconception: "a lesser-known organ does the filtering",
        whyChosen:
          "The spleen filters blood cells, a plausible trap.",
        reveal:
          "The spleen recycles old red blood cells and aids immunity, but it does not produce urine.",
      },
    ],
    claims: [
      claim("function(kidneys) = filter blood into urine", "reference:anatomy"),
      claim("function(liver) = chemical detoxification", "reference:anatomy"),
    ],
  },
  {
    difficulty: "easy",
    question: "How many chambers does the human heart have?",
    correctAnswer: "4",
    correctReveal:
      "The human heart has 4 chambers — two atria on top that receive blood and two ventricles below that pump it out.",
    distractors: [
      {
        text: "2",
        misconception: "the heart is a single in-and-out pump",
        whyChosen:
          "A simple two-chamber picture is a common under-count.",
        reveal:
          "2 chambers describes a fish heart; humans have four.",
      },
      {
        text: "3",
        misconception: "the heart has one shared pumping chamber",
        whyChosen:
          "Three is a plausible off-by-one guess.",
        reveal:
          "3 chambers describes many amphibian hearts; the human heart has four.",
      },
      {
        text: "6",
        misconception: "more chambers mean a more complex heart",
        whyChosen:
          "Over-counting seems to fit a vital organ.",
        reveal:
          "6 is too many — the human heart has exactly two atria and two ventricles.",
      },
    ],
    claims: [
      claim("chambers(human heart) = 4 (2 atria, 2 ventricles)", "reference:anatomy"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the largest organ of the human body?",
    correctAnswer: "The skin",
    correctReveal:
      "The skin is the body's largest organ by surface area and weight; the liver is the largest organ found inside the body.",
    distractors: [
      {
        text: "The liver",
        misconception: "the biggest organ must be internal",
        whyChosen:
          "The liver is the largest internal organ, the strongest trap.",
        reveal:
          "The liver is the largest organ inside the body, but the skin — covering all of it — is larger overall.",
      },
      {
        text: "The brain",
        misconception: "the most important organ is the largest",
        whyChosen:
          "The brain's importance can be mistaken for size.",
        reveal:
          "The brain is vital but far smaller and lighter than the skin.",
      },
      {
        text: "The lungs",
        misconception: "the biggest chest organs are the largest",
        whyChosen:
          "The lungs fill much of the chest.",
        reveal:
          "The lungs are large but are outsized by the skin, the body's biggest organ.",
      },
    ],
    claims: [
      claim("largest_organ(human body) = skin", "reference:anatomy"),
      claim("largest_internal_organ = liver", "reference:anatomy"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which body system includes the brain and the spinal cord?",
    correctAnswer: "The nervous system",
    correctReveal:
      "The brain and spinal cord form the central nervous system, which processes signals and controls the body; other systems handle blood, air, and food.",
    distractors: [
      {
        text: "The circulatory system",
        misconception: "the control organs belong to the blood system",
        whyChosen:
          "The brain needs lots of blood, so the circulatory system tempts.",
        reveal:
          "The circulatory system is the heart and blood vessels — it supplies the brain but is a different system.",
      },
      {
        text: "The respiratory system",
        misconception: "control of breathing means the brain is respiratory",
        whyChosen:
          "The brain controls breathing, a plausible link.",
        reveal:
          "The respiratory system is the lungs and airways; the brain that controls them is part of the nervous system.",
      },
      {
        text: "The digestive system",
        misconception: "any major system could hold the brain",
        whyChosen:
          "The digestive system is another major body system.",
        reveal:
          "The digestive system handles food, from mouth to intestines — not the brain and spinal cord.",
      },
    ],
    claims: [
      claim("central_nervous_system = brain + spinal cord", "reference:anatomy"),
      claim("circulatory_system = heart + blood vessels", "reference:anatomy"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the longest bone in the human body?",
    correctAnswer: "The femur",
    correctReveal:
      "The femur (thigh bone) is the longest and strongest bone in the body; the smallest is the stapes, deep inside the ear.",
    distractors: [
      {
        text: "The tibia",
        misconception: "any long leg bone is the longest",
        whyChosen:
          "The tibia (shin bone) is another long leg bone, the strongest trap.",
        reveal:
          "The tibia is long but the femur, in the thigh, is longer.",
      },
      {
        text: "The humerus",
        misconception: "the main arm bone is the longest",
        whyChosen:
          "The humerus is the long upper-arm bone.",
        reveal:
          "The humerus is the longest bone in the arm, but shorter than the femur in the leg.",
      },
      {
        text: "The skull",
        misconception: "the largest-looking bone is the longest",
        whyChosen:
          "The skull is a big, prominent bone structure.",
        reveal:
          "The skull is large but is a set of fused flat bones, not the single longest bone.",
      },
    ],
    claims: [
      claim("longest_bone(human body) = femur", "reference:anatomy"),
      claim("smallest_bone(human body) = stapes (ear)", "reference:anatomy"),
    ],
  },
  {
    difficulty: "hard",
    question: "About how many bones are in the adult human body?",
    correctAnswer: "206",
    correctReveal:
      "An adult has about 206 bones; a baby is born with around 300, many of which fuse together as the body grows.",
    distractors: [
      {
        text: "300",
        misconception: "the adult and infant bone counts are the same",
        whyChosen:
          "300 is the infant figure, the single most common trap here.",
        reveal:
          "About 300 is the number a baby is born with; many fuse, leaving roughly 206 in adults.",
      },
      {
        text: "106",
        misconception: "the body has far fewer bones than it does",
        whyChosen:
          "106 is a plausible under-count.",
        reveal:
          "106 is far too few — an adult skeleton has about 206 bones.",
      },
      {
        text: "350",
        misconception: "the adult body keeps its full infant bone count",
        whyChosen:
          "It anchors the high end of the range.",
        reveal:
          "350 over-counts — even newborns have only around 300, and adults have about 206.",
      },
    ],
    claims: [
      claim("bone_count(adult human) = ~206", "reference:anatomy"),
      claim("bone_count(newborn) = ~300 (fuse with age)", "reference:anatomy"),
    ],
  },
];

export const learnBiologyAnatomyLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:biology:bio.anatomy:v1",
  skillNode: "bio.anatomy",
  category: "biology_anatomy",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Human anatomy reference; Wikidata",
  sourceLicense: "CC0-1.0",
  rungs: RUNGS,
});

export const learnBiologyAnatomyLadderV1Questions =
  learnBiologyAnatomyLadderV1.questions;
export const learnBiologyAnatomyLadderV1ByChecksum =
  learnBiologyAnatomyLadderV1.byChecksum;
export const learnBiologyAnatomyLadderV1Metadata =
  learnBiologyAnatomyLadderV1.metadata;
export const validateLearnBiologyAnatomyLadderV1 =
  learnBiologyAnatomyLadderV1.validate;

export default learnBiologyAnatomyLadderV1Questions;
