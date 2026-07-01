// Learn teaching ladder — Science: atomic numbers.
//
// The atomic number is the element's address on the periodic table — the number
// of protons — and its neighbours (and its mass number) are the classic traps.
// Every distractor is a real nearby number: an adjacent element, a same-group
// element, or the element's own mass number, so a wrong pick teaches the layout.
// Facts only (IUPAC / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_science_atomic_numbers_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What is the atomic number of hydrogen?",
    correctAnswer: "1",
    correctReveal:
      "Hydrogen has one proton, so its atomic number is 1 — it is the first and lightest element, the top-left of the periodic table.",
    distractors: [
      {
        text: "2",
        misconception: "the most common element is number one everywhere",
        whyChosen:
          "2 is hydrogen's immediate neighbour, a one-step miss.",
        reveal:
          "2 is helium, the second element and the next-lightest.",
      },
      {
        text: "3",
        misconception: "small elements are interchangeable at the top",
        whyChosen:
          "3 is another low, plausible number.",
        reveal:
          "3 is lithium, the first metal on the table.",
      },
      {
        text: "8",
        misconception: "a familiar element must have a low number",
        whyChosen:
          "8 is a well-known element's number, tempting for a famous gas.",
        reveal:
          "8 is oxygen — famous, but far from the top of the table.",
      },
    ],
    claims: [
      claim("atomic_number(hydrogen) = 1", "iupac:periodic-table"),
      claim("atomic_number(helium) = 2", "iupac:periodic-table"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the atomic number of carbon?",
    correctAnswer: "6",
    correctReveal:
      "Carbon has 6 protons, so its atomic number is 6; the 12 you often see is its mass number (protons plus neutrons), not its address on the table.",
    distractors: [
      {
        text: "12",
        misconception: "the atomic number and the mass number are the same",
        whyChosen:
          "Carbon-12 is everywhere, making 12 the single most common wrong answer.",
        reveal:
          "12 is carbon's most common mass number (6 protons + 6 neutrons), not its atomic number.",
      },
      {
        text: "5",
        misconception: "neighbouring elements blur together",
        whyChosen:
          "5 is carbon's left-hand neighbour, a one-step miss.",
        reveal:
          "5 is boron, the element just before carbon.",
      },
      {
        text: "7",
        misconception: "adjacent elements are easy to swap",
        whyChosen:
          "7 is carbon's right-hand neighbour.",
        reveal:
          "7 is nitrogen, the element just after carbon.",
      },
    ],
    claims: [
      claim("atomic_number(carbon) = 6", "iupac:periodic-table"),
      claim("mass_number(carbon-12) = 12", "reference:nuclide-table"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the atomic number of oxygen?",
    correctAnswer: "8",
    correctReveal:
      "Oxygen has 8 protons, placing it between nitrogen (7) and fluorine (9) in the second row of the periodic table.",
    distractors: [
      {
        text: "6",
        misconception: "the common gases cluster at one number",
        whyChosen:
          "6 is a nearby second-row element, a plausible miss.",
        reveal:
          "6 is carbon, two places before oxygen.",
      },
      {
        text: "7",
        misconception: "adjacent elements are interchangeable",
        whyChosen:
          "7 is oxygen's left-hand neighbour, a one-step miss.",
        reveal:
          "7 is nitrogen, which sits just before oxygen.",
      },
      {
        text: "9",
        misconception: "the next element over is the same",
        whyChosen:
          "9 is oxygen's right-hand neighbour.",
        reveal:
          "9 is fluorine, the element just after oxygen.",
      },
    ],
    claims: [
      claim("atomic_number(oxygen) = 8", "iupac:periodic-table"),
      claim("atomic_number(fluorine) = 9", "iupac:periodic-table"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the atomic number of gold?",
    correctAnswer: "79",
    correctReveal:
      "Gold sits at 79, right after platinum (78) and just before mercury (80); silver (47) lies directly above it in the same group.",
    distractors: [
      {
        text: "47",
        misconception: "elements in the same group share a number",
        whyChosen:
          "47 is silver, gold's group-mate directly above — a strong periodic-table trap.",
        reveal:
          "47 is silver, which sits above gold in the same column, not gold itself.",
      },
      {
        text: "78",
        misconception: "neighbouring heavy metals are interchangeable",
        whyChosen:
          "78 is gold's left-hand neighbour, a one-step miss.",
        reveal:
          "78 is platinum, the element just before gold.",
      },
      {
        text: "80",
        misconception: "adjacent heavy metals blur",
        whyChosen:
          "80 is gold's right-hand neighbour.",
        reveal:
          "80 is mercury, the element just after gold.",
      },
    ],
    claims: [
      claim("atomic_number(gold) = 79", "iupac:periodic-table"),
      claim("atomic_number(silver) = 47", "iupac:periodic-table"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the atomic number of helium?",
    correctAnswer: "2",
    correctReveal:
      "Helium has 2 protons, so its atomic number is 2; its mass number of 4 (2 protons + 2 neutrons) is the usual confusion.",
    distractors: [
      {
        text: "4",
        misconception: "the atomic number and mass number are the same",
        whyChosen:
          "Helium-4 is the common isotope, so 4 is the classic wrong answer.",
        reveal:
          "4 is helium's mass number (2 protons + 2 neutrons), not its atomic number.",
      },
      {
        text: "1",
        misconception: "the lightest gases share a number",
        whyChosen:
          "1 is helium's left-hand neighbour, a one-step miss.",
        reveal:
          "1 is hydrogen, the element just before helium.",
      },
      {
        text: "10",
        misconception: "all noble gases have the same number",
        whyChosen:
          "10 is the next noble gas, a same-group trap.",
        reveal:
          "10 is neon, the next noble gas below helium, not helium itself.",
      },
    ],
    claims: [
      claim("atomic_number(helium) = 2", "iupac:periodic-table"),
      claim("mass_number(helium-4) = 4", "reference:nuclide-table"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the atomic number of uranium?",
    correctAnswer: "92",
    correctReveal:
      "Uranium's atomic number is 92 — historically the heaviest naturally occurring element; anything past it (like plutonium, 94) is essentially synthetic.",
    distractors: [
      {
        text: "94",
        misconception: "the famous nuclear elements share a number",
        whyChosen:
          "94 is plutonium, uranium's nuclear cousin, a strong near-miss.",
        reveal:
          "94 is plutonium, a synthetic element just beyond uranium.",
      },
      {
        text: "90",
        misconception: "the heavy radioactive elements blur together",
        whyChosen:
          "90 is a nearby actinide, plausible for a heavy element.",
        reveal:
          "90 is thorium, another natural radioactive element, two places before uranium.",
      },
      {
        text: "82",
        misconception: "any heavy metal is around the same number",
        whyChosen:
          "82 is a famous heavy metal's number, a plausible grab.",
        reveal:
          "82 is lead, the stable end-point of many radioactive decay chains, not uranium.",
      },
    ],
    claims: [
      claim("atomic_number(uranium) = 92", "iupac:periodic-table"),
      claim("atomic_number(plutonium) = 94", "iupac:periodic-table"),
    ],
  },
  {
    difficulty: "hard",
    question: "What is the atomic number of iron?",
    correctAnswer: "26",
    correctReveal:
      "Iron sits at 26, flanked by manganese (25), cobalt (27), and nickel (28); iron-56 lies at the 'iron peak' of nuclear binding energy, where fusion in stars stops releasing energy.",
    distractors: [
      {
        text: "27",
        misconception: "neighbouring transition metals are interchangeable",
        whyChosen:
          "27 is iron's right-hand neighbour, a one-step miss.",
        reveal:
          "27 is cobalt, the element just after iron.",
      },
      {
        text: "28",
        misconception: "the magnetic metals share a number",
        whyChosen:
          "28 is nickel, another magnetic metal near iron, a close trap.",
        reveal:
          "28 is nickel, two places after iron.",
      },
      {
        text: "25",
        misconception: "adjacent transition metals blur",
        whyChosen:
          "25 is iron's left-hand neighbour.",
        reveal:
          "25 is manganese, the element just before iron.",
      },
    ],
    claims: [
      claim("atomic_number(iron) = 26", "iupac:periodic-table"),
      claim("atomic_number(cobalt) = 27", "iupac:periodic-table"),
    ],
  },
];

export const learnScienceAtomicNumbersLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:science:sci.elements.numbers:v1",
  skillNode: "sci.elements.numbers",
  category: "science_atomic_numbers",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "IUPAC periodic table; Wikidata",
  sourceLicense: "CC0-1.0; standards-body fact-only",
  rungs: RUNGS,
});

export const learnScienceAtomicNumbersLadderV1Questions =
  learnScienceAtomicNumbersLadderV1.questions;
export const learnScienceAtomicNumbersLadderV1ByChecksum =
  learnScienceAtomicNumbersLadderV1.byChecksum;
export const learnScienceAtomicNumbersLadderV1Metadata =
  learnScienceAtomicNumbersLadderV1.metadata;
export const validateLearnScienceAtomicNumbersLadderV1 =
  learnScienceAtomicNumbersLadderV1.validate;

export default learnScienceAtomicNumbersLadderV1Questions;
