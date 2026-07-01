// Learn teaching ladder — Mathematics: sequences & patterns.
//
// The teach: a sequence sticks once you find its RULE — add a constant, double,
// square, cube, or sum the previous two — not by memorizing the numbers. Every
// answer is verified by computation, and each distractor is the result of a
// plausible WRONG rule, so a wrong pick exposes the mistaken pattern. Verified by
// computation (per the sourcing policy's math rule), not by citation.

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_math_sequences_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT, "computed");

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What number comes next: 2, 4, 6, 8, __ ?",
    correctAnswer: "10",
    correctReveal:
      "These are the even numbers, each two more than the last, so after 8 comes 10.",
    distractors: [
      {
        text: "9",
        misconception: "the sequence counts up by one",
        whyChosen:
          "Adding one to 8 gives 9, the mistake of ignoring the step size.",
        reveal:
          "9 would follow if the rule were +1, but each term here rises by 2.",
      },
      {
        text: "12",
        misconception: "the gap grows as the sequence goes on",
        whyChosen:
          "Jumping by 4 to 12 assumes an increasing step.",
        reveal:
          "12 overshoots — the step stays a constant +2, giving 10, not 12.",
      },
      {
        text: "16",
        misconception: "the sequence doubles each time",
        whyChosen:
          "Doubling 8 gives 16, confusing addition with multiplication.",
        reveal:
          "16 is 8 doubled, but this pattern adds 2 rather than doubling.",
      },
    ],
    claims: [
      claim("rule(2,4,6,8) = add 2 (even numbers)", "computed:arithmetic"),
      claim("next_term = 8 + 2 = 10", "computed:arithmetic"),
    ],
  },
  {
    difficulty: "easy",
    question: "What number comes next: 1, 4, 9, 16, __ ?",
    correctAnswer: "25",
    correctReveal:
      "These are the perfect squares — 1×1, 2×2, 3×3, 4×4 — so the next is 5×5 = 25.",
    distractors: [
      {
        text: "20",
        misconception: "the gap between terms is fixed",
        whyChosen:
          "Adding the last gap (16−9 = 7... rounded) suggests a steady jump.",
        reveal:
          "20 assumes a constant step, but the gaps grow (3, 5, 7, 9); the next square is 25.",
      },
      {
        text: "24",
        misconception: "the sequence adds the previous term's root",
        whyChosen:
          "16 + 8 = 24 mixes up the doubling of the root.",
        reveal:
          "24 comes from a wrong rule; 5 squared is 25, not 24.",
      },
      {
        text: "32",
        misconception: "the sequence doubles",
        whyChosen:
          "Doubling 16 gives 32, confusing squares with doubling.",
        reveal:
          "32 is 16 doubled; the pattern squares the counting numbers, giving 25.",
      },
    ],
    claims: [
      claim("rule(1,4,9,16) = n squared", "computed:arithmetic"),
      claim("next_term = 5^2 = 25", "computed:arithmetic"),
    ],
  },
  {
    difficulty: "easy",
    question: "What number comes next in the Fibonacci sequence: 1, 1, 2, 3, 5, 8, __ ?",
    correctAnswer: "13",
    correctReveal:
      "In the Fibonacci sequence each term is the sum of the previous two, so 5 + 8 = 13.",
    distractors: [
      {
        text: "11",
        misconception: "the sequence adds a fixed number",
        whyChosen:
          "Adding 3 to 8 gives 11, treating it as an arithmetic sequence.",
        reveal:
          "11 assumes a constant step; Fibonacci adds the two previous terms, giving 5 + 8 = 13.",
      },
      {
        text: "16",
        misconception: "the sequence doubles the last term",
        whyChosen:
          "Doubling 8 gives 16, a plausible growth rule.",
        reveal:
          "16 is 8 doubled; the Fibonacci rule sums the last two terms instead.",
      },
      {
        text: "15",
        misconception: "the sequence adds the position number",
        whyChosen:
          "8 + 7 = 15 mixes in the term's index.",
        reveal:
          "15 comes from a wrong rule; the correct sum is 5 + 8 = 13.",
      },
    ],
    claims: [
      claim("rule(Fibonacci) = each term = sum of previous two", "computed:arithmetic"),
      claim("next_term = 5 + 8 = 13", "computed:arithmetic"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which of these is a prime number?",
    correctAnswer: "17",
    correctReveal:
      "17 is prime — it has no divisors other than 1 and itself; the others all factor into smaller whole numbers.",
    distractors: [
      {
        text: "21",
        misconception: "odd numbers are automatically prime",
        whyChosen:
          "21 is odd, so it looks prime at a glance.",
        reveal:
          "21 = 3 × 7, so it is composite, not prime.",
      },
      {
        text: "27",
        misconception: "any odd number could be prime",
        whyChosen:
          "27 is odd and not obviously divisible.",
        reveal:
          "27 = 3 × 3 × 3, so it is composite.",
      },
      {
        text: "15",
        misconception: "smaller odd numbers are prime",
        whyChosen:
          "15 is a small odd number, a plausible pick.",
        reveal:
          "15 = 3 × 5, so it is composite, not prime.",
      },
    ],
    claims: [
      claim("prime(17) = true (divisors 1, 17 only)", "computed:factorization"),
      claim("21 = 3×7; 27 = 3^3; 15 = 3×5 (composite)", "computed:factorization"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What number comes next: 1, 3, 6, 10, 15, __ ?",
    correctAnswer: "21",
    correctReveal:
      "These are the triangular numbers: the gaps grow by one each time (+2, +3, +4, +5), so the next gap is +6, giving 15 + 6 = 21.",
    distractors: [
      {
        text: "20",
        misconception: "the gap stays the same as the last one",
        whyChosen:
          "Adding the last gap of 5 gives 20, ignoring that the gaps grow.",
        reveal:
          "20 uses a +5 step, but the gaps increase; the next is +6, giving 21.",
      },
      {
        text: "18",
        misconception: "the sequence adds a small fixed number",
        whyChosen:
          "18 assumes a smaller constant step.",
        reveal:
          "18 is too small — the growing gaps take 15 up to 21.",
      },
      {
        text: "25",
        misconception: "the sequence jumps to the next square",
        whyChosen:
          "25 is a nearby perfect square, a tempting round target.",
        reveal:
          "25 is a square number; this triangular sequence gives 21 next.",
      },
    ],
    claims: [
      claim("rule(1,3,6,10,15) = triangular numbers, gap grows by 1", "computed:arithmetic"),
      claim("next_term = 15 + 6 = 21", "computed:arithmetic"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What number comes next: 1, 2, 4, 8, 16, __ ?",
    correctAnswer: "32",
    correctReveal:
      "Each term is double the one before (powers of 2), so 16 × 2 = 32.",
    distractors: [
      {
        text: "24",
        misconception: "the gap between terms is constant",
        whyChosen:
          "Adding the last gap of 8 gives 24, treating it as arithmetic.",
        reveal:
          "24 assumes +8, but the rule doubles each term, giving 32.",
      },
      {
        text: "20",
        misconception: "the sequence steps up by a small fixed amount",
        whyChosen:
          "20 is a plausible steady-step guess.",
        reveal:
          "20 is far too small — doubling 16 gives 32.",
      },
      {
        text: "64",
        misconception: "the sequence skips a term",
        whyChosen:
          "64 is the term after 32, an over-shoot by one doubling.",
        reveal:
          "64 is one step too far (16 → 32 → 64); the very next term is 32.",
      },
    ],
    claims: [
      claim("rule(1,2,4,8,16) = double each term (powers of 2)", "computed:arithmetic"),
      claim("next_term = 16 × 2 = 32", "computed:arithmetic"),
    ],
  },
  {
    difficulty: "hard",
    question: "What number comes next: 1, 8, 27, 64, __ ?",
    correctAnswer: "125",
    correctReveal:
      "These are the perfect cubes — 1³, 2³, 3³, 4³ — so the next is 5³ = 125.",
    distractors: [
      {
        text: "216",
        misconception: "the sequence skips a cube",
        whyChosen:
          "216 is 6³, the term after the answer, a tempting cube.",
        reveal:
          "216 is 6 cubed — one step too far; the next term is 5³ = 125.",
      },
      {
        text: "100",
        misconception: "the pattern switches to squares",
        whyChosen:
          "100 is a familiar round square (10²), a plausible target.",
        reveal:
          "100 is a square, not a cube; this sequence cubes the counting numbers, giving 125.",
      },
      {
        text: "96",
        misconception: "the sequence adds the previous gap",
        whyChosen:
          "64 + 32 = 96 extends the last gap, ignoring the cubing rule.",
        reveal:
          "96 comes from a wrong additive rule; 5 cubed is 125.",
      },
    ],
    claims: [
      claim("rule(1,8,27,64) = n cubed", "computed:arithmetic"),
      claim("next_term = 5^3 = 125", "computed:arithmetic"),
    ],
  },
];

export const learnMathSequencesLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:mathematics:math.sequences:v1",
  skillNode: "math.sequences",
  category: "math_sequences",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceType: "computed",
  sourceName: "Verified by computation",
  sourceLicense: "computed-fact",
  rungs: RUNGS,
});

export const learnMathSequencesLadderV1Questions =
  learnMathSequencesLadderV1.questions;
export const learnMathSequencesLadderV1ByChecksum =
  learnMathSequencesLadderV1.byChecksum;
export const learnMathSequencesLadderV1Metadata =
  learnMathSequencesLadderV1.metadata;
export const validateLearnMathSequencesLadderV1 =
  learnMathSequencesLadderV1.validate;

export default learnMathSequencesLadderV1Questions;
