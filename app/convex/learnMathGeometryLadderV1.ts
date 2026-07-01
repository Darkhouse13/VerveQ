// Learn teaching ladder — Mathematics: geometry.
//
// The teach: Greek number-roots name the polygons (hexa-, octa-, dodeca-) and the
// angles always add up to a fixed total — geometry rewards spotting the pattern.
// Distractors are neighbouring shapes or angle facts, so a wrong pick teaches a
// second fact. Verified by definition / computation.

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_math_geometry_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT, "computed");

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "How many sides does a hexagon have?",
    correctAnswer: "6",
    correctReveal:
      "A hexagon has six sides — 'hexa' means six; a pentagon has five and an octagon has eight.",
    distractors: [
      {
        text: "5",
        misconception: "hexagon and pentagon are the same",
        whyChosen:
          "A pentagon (5 sides) is the neighbouring shape, the strongest trap.",
        reveal:
          "5 sides make a pentagon; 'hexa' means six.",
      },
      {
        text: "7",
        misconception: "the count is off by one",
        whyChosen:
          "7 is a plausible off-by-one guess.",
        reveal:
          "7 sides make a heptagon; a hexagon has six.",
      },
      {
        text: "8",
        misconception: "hexagon and octagon are confused",
        whyChosen:
          "An octagon (8 sides) sounds similar to hexagon.",
        reveal:
          "8 sides make an octagon; 'hexa' means six, not eight.",
      },
    ],
    claims: [
      claim("sides(hexagon) = 6", "computed:definition"),
      claim("root(hexa) = six", "computed:definition"),
    ],
  },
  {
    difficulty: "easy",
    question: "How many degrees are there in a right angle?",
    correctAnswer: "90",
    correctReveal:
      "A right angle is 90 degrees — a quarter turn; a straight line is 180 degrees and a full turn is 360.",
    distractors: [
      {
        text: "45",
        misconception: "a right angle is half of what it is",
        whyChosen:
          "45° is exactly half a right angle, a tempting near-value.",
        reveal:
          "45 degrees is half a right angle; a full right angle is 90.",
      },
      {
        text: "180",
        misconception: "a right angle is a straight line",
        whyChosen:
          "180° is a straight line, easily confused with 'right'.",
        reveal:
          "180 degrees is a straight line (two right angles); one right angle is 90.",
      },
      {
        text: "360",
        misconception: "a right angle is a full turn",
        whyChosen:
          "360° is a complete circle, the far end of the range.",
        reveal:
          "360 degrees is a full turn; a right angle is a quarter of that, 90.",
      },
    ],
    claims: [
      claim("degrees(right angle) = 90", "computed:definition"),
      claim("straight line = 180; full turn = 360", "computed:definition"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is a triangle with all three sides equal called?",
    correctAnswer: "Equilateral",
    correctReveal:
      "A triangle with all sides equal is equilateral, and its angles are all equal too; two equal sides make it isosceles, and none scalene.",
    distractors: [
      {
        text: "Isosceles",
        misconception: "any triangle with equal sides is isosceles",
        whyChosen:
          "Isosceles also has equal sides, the closest near-miss.",
        reveal:
          "Isosceles has exactly two equal sides; all three equal makes it equilateral.",
      },
      {
        text: "Scalene",
        misconception: "the named triangles are interchangeable",
        whyChosen:
          "Scalene is another triangle type.",
        reveal:
          "Scalene has no equal sides at all — the opposite of equilateral.",
      },
      {
        text: "Right-angled",
        misconception: "a special triangle must have a right angle",
        whyChosen:
          "Right-angled is the most famous triangle type.",
        reveal:
          "Right-angled describes a 90° corner, not equal sides.",
      },
    ],
    claims: [
      claim("triangle(all sides equal) = equilateral", "computed:definition"),
      claim("isosceles = two equal sides; scalene = none", "computed:definition"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "The interior angles of any triangle add up to how many degrees?",
    correctAnswer: "180",
    correctReveal:
      "The three inside angles of any triangle always add up to 180 degrees; a four-sided shape's angles total 360.",
    distractors: [
      {
        text: "360",
        misconception: "a triangle's angles sum like a quadrilateral's",
        whyChosen:
          "360° is the sum for a four-sided shape, the strongest trap.",
        reveal:
          "360 degrees is the total for a quadrilateral; a triangle's angles sum to 180.",
      },
      {
        text: "90",
        misconception: "the angles add to one right angle",
        whyChosen:
          "90° is a single right angle, a plausible small total.",
        reveal:
          "90 degrees is one right angle; the three angles of a triangle add to 180.",
      },
      {
        text: "270",
        misconception: "the sum is three right angles",
        whyChosen:
          "270° = three right angles, a plausible multiple.",
        reveal:
          "270 degrees is three right angles; a triangle's interior angles total 180.",
      },
    ],
    claims: [
      claim("interior_angle_sum(triangle) = 180 degrees", "computed:definition"),
      claim("interior_angle_sum(quadrilateral) = 360 degrees", "computed:definition"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "How many sides does a dodecagon have?",
    correctAnswer: "12",
    correctReveal:
      "A dodecagon has twelve sides — 'dodeca' means twelve; a decagon has ten and an octagon eight.",
    distractors: [
      {
        text: "10",
        misconception: "dodecagon and decagon are the same",
        whyChosen:
          "A decagon (10 sides) is the closest-sounding shape, the strongest trap.",
        reveal:
          "10 sides make a decagon; 'dodeca' means twelve.",
      },
      {
        text: "20",
        misconception: "'dodeca' points to twenty",
        whyChosen:
          "'Do' can suggest a doubling toward twenty.",
        reveal:
          "20 sides make an icosagon; a dodecagon has twelve.",
      },
      {
        text: "8",
        misconception: "any many-sided polygon is an octagon",
        whyChosen:
          "8 is a familiar polygon count.",
        reveal:
          "8 sides make an octagon; a dodecagon has twelve.",
      },
    ],
    claims: [
      claim("sides(dodecagon) = 12", "computed:definition"),
      claim("root(dodeca) = twelve; decagon = 10", "computed:definition"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the name for a polygon with 8 sides?",
    correctAnswer: "Octagon",
    correctReveal:
      "An eight-sided polygon is an octagon — 'octa' means eight, like an octopus's arms; a seven-sided shape is a heptagon.",
    distractors: [
      {
        text: "Hexagon",
        misconception: "hexagon and octagon are the same",
        whyChosen:
          "A hexagon (6 sides) is the neighbouring shape, the strongest trap.",
        reveal:
          "A hexagon has six sides; eight sides make an octagon.",
      },
      {
        text: "Heptagon",
        misconception: "the count is off by one",
        whyChosen:
          "A heptagon (7 sides) is one short.",
        reveal:
          "A heptagon has seven sides; the eight-sided shape is an octagon.",
      },
      {
        text: "Nonagon",
        misconception: "the count is off by one the other way",
        whyChosen:
          "A nonagon (9 sides) is one over.",
        reveal:
          "A nonagon has nine sides; eight sides make an octagon.",
      },
    ],
    claims: [
      claim("polygon(8 sides) = octagon", "computed:definition"),
      claim("root(octa) = eight; heptagon = 7; nonagon = 9", "computed:definition"),
    ],
  },
  {
    difficulty: "hard",
    question:
      "In a right-angled triangle, what is the longest side, opposite the right angle, called?",
    correctAnswer: "The hypotenuse",
    correctReveal:
      "The side opposite the right angle is the hypotenuse, always the longest side; Pythagoras' rule says a² + b² = c², where c is the hypotenuse.",
    distractors: [
      {
        text: "The adjacent",
        misconception: "any named triangle side is the longest",
        whyChosen:
          "'Adjacent' is a real triangle-side term, the strongest trap.",
        reveal:
          "The adjacent is one of the two shorter sides next to a chosen angle, not the longest.",
      },
      {
        text: "The radius",
        misconception: "circle terms apply to triangles",
        whyChosen:
          "'Radius' is a familiar geometry word.",
        reveal:
          "A radius belongs to a circle, not a triangle's sides.",
      },
      {
        text: "The diameter",
        misconception: "the longest line in any shape is the diameter",
        whyChosen:
          "'Diameter' names the longest line across a circle.",
        reveal:
          "A diameter is the longest line across a circle; a right triangle's longest side is the hypotenuse.",
      },
    ],
    claims: [
      claim("longest_side(right triangle) = hypotenuse (opposite the right angle)", "computed:definition"),
      claim("Pythagoras: a^2 + b^2 = c^2, c = hypotenuse", "computed:definition"),
    ],
  },
];

export const learnMathGeometryLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:mathematics:math.geometry:v1",
  skillNode: "math.geometry",
  category: "math_geometry",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceType: "computed",
  sourceName: "Verified by definition / computation",
  sourceLicense: "computed-fact",
  rungs: RUNGS,
});

export const learnMathGeometryLadderV1Questions =
  learnMathGeometryLadderV1.questions;
export const learnMathGeometryLadderV1ByChecksum =
  learnMathGeometryLadderV1.byChecksum;
export const learnMathGeometryLadderV1Metadata =
  learnMathGeometryLadderV1.metadata;
export const validateLearnMathGeometryLadderV1 =
  learnMathGeometryLadderV1.validate;

export default learnMathGeometryLadderV1Questions;
