// Learn teaching ladder — Mathematics: numbers & constants.
//
// The teach: the famous constants each answer one question — a circle (pi),
// growth (e), the golden ratio (phi) — so pairing each value to its meaning locks
// it in. Distractors are the OTHER constants, so a wrong pick teaches a second
// value. Verified by computation / definition (per the sourcing policy's math
// rule).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_math_constants_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT, "computed");

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What is the value of pi (π) to two decimal places?",
    correctAnswer: "3.14",
    correctReveal:
      "Pi is about 3.14159, the ratio of a circle's circumference to its diameter — the number that links a circle's size to the distance around it.",
    distractors: [
      {
        text: "3.41",
        misconception: "the digits of pi can be shuffled",
        whyChosen:
          "3.41 swaps the digits after the point, a careless-recall trap.",
        reveal:
          "3.41 reverses the decimals; pi begins 3.14, not 3.41.",
      },
      {
        text: "2.14",
        misconception: "pi is just over two",
        whyChosen:
          "2.14 keeps the decimals but drops the whole part to 2.",
        reveal:
          "2.14 starts with the wrong whole number; pi is a little over 3.",
      },
      {
        text: "3.12",
        misconception: "any 3.1-something is close enough",
        whyChosen:
          "3.12 is near the right value, a plausible rounding slip.",
        reveal:
          "3.12 is close but wrong; to two places pi is 3.14.",
      },
    ],
    claims: [
      claim("value(pi) = 3.14159... (~3.14)", "computed:definition"),
      claim("definition(pi) = circumference / diameter", "computed:definition"),
    ],
  },
  {
    difficulty: "easy",
    question:
      "What is the name for the ratio of a circle's circumference to its diameter?",
    correctAnswer: "Pi (π)",
    correctReveal:
      "That ratio is pi, roughly 3.14159; the golden ratio and Euler's number are separate constants with their own values.",
    distractors: [
      {
        text: "Phi (φ)",
        misconception: "any famous constant fits any definition",
        whyChosen:
          "Phi is another celebrated constant, the strongest near-miss.",
        reveal:
          "Phi is the golden ratio, about 1.618 — a different constant from the circle's pi.",
      },
      {
        text: "Euler's number (e)",
        misconception: "the growth constant defines the circle",
        whyChosen:
          "Euler's number is a headline constant too.",
        reveal:
          "Euler's number e (about 2.718) is the base of natural logarithms, not the circle ratio.",
      },
      {
        text: "Theta (θ)",
        misconception: "any Greek letter names the ratio",
        whyChosen:
          "Theta is a familiar Greek symbol in geometry.",
        reveal:
          "Theta usually stands for an angle, not the circumference-to-diameter ratio.",
      },
    ],
    claims: [
      claim("name(circumference/diameter ratio) = pi", "computed:definition"),
      claim("value(phi) = 1.618; value(e) = 2.718", "computed:definition"),
    ],
  },
  {
    difficulty: "easy",
    question: "What do we call a whole number divisible only by 1 and itself?",
    correctAnswer: "Prime number",
    correctReveal:
      "A whole number with exactly two divisors — 1 and itself — is prime; a number with more divisors is called composite.",
    distractors: [
      {
        text: "Even number",
        misconception: "primes and even numbers are the same",
        whyChosen:
          "Even is a basic number category, an easy confusion.",
        reveal:
          "Even means divisible by 2; most even numbers (like 4, 6, 8) have several divisors and are not prime.",
      },
      {
        text: "Square number",
        misconception: "any special number is prime",
        whyChosen:
          "Square numbers are another named category.",
        reveal:
          "A square number (like 4, 9, 16) is a number times itself, and such numbers have extra divisors — not prime.",
      },
      {
        text: "Composite number",
        misconception: "the opposite term means the same thing",
        whyChosen:
          "Composite is the direct opposite, the strongest trap.",
        reveal:
          "Composite is the opposite of prime — it means a number WITH more than two divisors.",
      },
    ],
    claims: [
      claim("definition(prime) = exactly two divisors (1 and itself)", "computed:definition"),
      claim("definition(composite) = more than two divisors", "computed:definition"),
    ],
  },
  {
    difficulty: "intermediate",
    question:
      "The golden ratio (about 1.618) is denoted by which Greek letter?",
    correctAnswer: "Phi (φ)",
    correctReveal:
      "The golden ratio is written as phi and is about 1.618; pi (roughly 3.14159) is a different constant, tied to circles.",
    distractors: [
      {
        text: "Pi (π)",
        misconception: "the most famous constant covers this one too",
        whyChosen:
          "Pi is the best-known Greek-letter constant, the top trap.",
        reveal:
          "Pi (about 3.14159) is the circle ratio, not the golden ratio, which is phi.",
      },
      {
        text: "Delta (δ)",
        misconception: "any Greek letter could be the golden ratio",
        whyChosen:
          "Delta is a common mathematical symbol.",
        reveal:
          "Delta usually means a change or difference, not the golden ratio.",
      },
      {
        text: "Sigma (σ)",
        misconception: "a well-known Greek letter names the ratio",
        whyChosen:
          "Sigma is a familiar symbol in maths.",
        reveal:
          "Sigma commonly denotes a sum or standard deviation, not the golden ratio.",
      },
    ],
    claims: [
      claim("symbol(golden ratio) = phi", "computed:definition"),
      claim("value(golden ratio) = ~1.618", "computed:definition"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Euler's number (e) is approximately equal to which value?",
    correctAnswer: "2.72",
    correctReveal:
      "Euler's number e is about 2.71828, the base of natural logarithms and a constant of continuous growth.",
    distractors: [
      {
        text: "3.14",
        misconception: "the two headline constants share a value",
        whyChosen:
          "3.14 is pi, the most-confused constant with e.",
        reveal:
          "3.14 is pi, the circle ratio; Euler's number e is about 2.72.",
      },
      {
        text: "1.62",
        misconception: "any famous constant is around the same size",
        whyChosen:
          "1.62 is the golden ratio, another celebrated value.",
        reveal:
          "1.62 is roughly the golden ratio (phi), not Euler's number.",
      },
      {
        text: "1.41",
        misconception: "small irrational numbers are interchangeable",
        whyChosen:
          "1.41 is the square root of 2, a plausible near-value.",
        reveal:
          "1.41 is about the square root of 2; e is about 2.72.",
      },
    ],
    claims: [
      claim("value(e) = 2.71828... (~2.72)", "computed:definition"),
      claim("role(e) = base of natural logarithms", "computed:definition"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "The square root of 2 is approximately equal to which value?",
    correctAnswer: "1.41",
    correctReveal:
      "The square root of 2 is an irrational number, about 1.414; by comparison the square root of 3 is about 1.732.",
    distractors: [
      {
        text: "1.73",
        misconception: "the square roots of 2 and 3 are the same",
        whyChosen:
          "1.73 is the square root of 3, the closest near-miss.",
        reveal:
          "1.73 is about the square root of 3, not of 2 (which is 1.41).",
      },
      {
        text: "1.62",
        misconception: "any irrational near 1.5 will do",
        whyChosen:
          "1.62 is the golden ratio, a nearby irrational value.",
        reveal:
          "1.62 is roughly the golden ratio, not the square root of 2.",
      },
      {
        text: "2.00",
        misconception: "the square root of 2 is 2",
        whyChosen:
          "Confusing a number with its square root gives 2.",
        reveal:
          "2 is the number itself; its square root is about 1.41, since 1.41 × 1.41 ≈ 2.",
      },
    ],
    claims: [
      claim("value(sqrt 2) = 1.41421... (~1.41)", "computed:definition"),
      claim("value(sqrt 3) = ~1.732", "computed:definition"),
    ],
  },
  {
    difficulty: "hard",
    question: "What is 2 raised to the power of 10 (2¹⁰)?",
    correctAnswer: "1024",
    correctReveal:
      "Two multiplied by itself ten times gives 1024 — which is why a kilobyte is 1024 bytes, just over a plain thousand.",
    distractors: [
      {
        text: "1000",
        misconception: "a power of 2 lands on a round thousand",
        whyChosen:
          "1000 is the round number a kilobyte is loosely called, the top trap.",
        reveal:
          "1000 is the everyday 'kilo', but 2 to the 10th is exactly 1024.",
      },
      {
        text: "512",
        misconception: "the answer is one doubling too low",
        whyChosen:
          "512 is 2 to the 9th power, one step short.",
        reveal:
          "512 is 2⁹; one more doubling reaches 2¹⁰ = 1024.",
      },
      {
        text: "2048",
        misconception: "the answer is one doubling too high",
        whyChosen:
          "2048 is 2 to the 11th power, one step too far.",
        reveal:
          "2048 is 2¹¹; the tenth power is 1024.",
      },
    ],
    claims: [
      claim("value(2^10) = 1024", "computed:arithmetic"),
      claim("2^9 = 512; 2^11 = 2048", "computed:arithmetic"),
    ],
  },
];

export const learnMathConstantsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:mathematics:math.constants:v1",
  skillNode: "math.constants",
  category: "math_constants",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceType: "computed",
  sourceName: "Verified by computation / definition",
  sourceLicense: "computed-fact",
  rungs: RUNGS,
});

export const learnMathConstantsLadderV1Questions =
  learnMathConstantsLadderV1.questions;
export const learnMathConstantsLadderV1ByChecksum =
  learnMathConstantsLadderV1.byChecksum;
export const learnMathConstantsLadderV1Metadata =
  learnMathConstantsLadderV1.metadata;
export const validateLearnMathConstantsLadderV1 =
  learnMathConstantsLadderV1.validate;

export default learnMathConstantsLadderV1Questions;
