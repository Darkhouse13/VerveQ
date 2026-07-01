// Learn teaching ladder — Science: SI units and their symbols.
//
// The teach: SI symbols are exact, and knowing whether a unit is a base unit or a
// derived unit named after a scientist makes the symbol memorable (units named
// after people are capitalized: N, Pa, J, W, A). Each rung fixes a physical
// quantity to its unit; distractors are neighbouring units for related
// quantities, so a wrong pick teaches what that unit actually measures. Facts
// only (BIPM SI brochure / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_science_si_units_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What is the SI base unit of length?",
    correctAnswer: "Metre (m)",
    correctReveal:
      "The metre (m) is one of the seven SI base units; the litre measures volume and the gram mass, so neither is the base unit of length.",
    distractors: [
      {
        text: "Litre (L)",
        misconception: "any everyday measure is an SI base unit",
        whyChosen:
          "The litre is a familiar metric measure, so it feels foundational.",
        reveal:
          "The litre (L) measures volume, and it is a non-SI unit accepted for use, not a base unit.",
      },
      {
        text: "Gram (g)",
        misconception: "length and mass units are interchangeable",
        whyChosen:
          "The gram is another core metric unit, a plausible base-unit guess.",
        reveal:
          "The gram (g) measures mass, not length — and the SI base mass unit is the kilogram, not the gram.",
      },
      {
        text: "Newton (N)",
        misconception: "physics units all measure size",
        whyChosen:
          "The newton is a fundamental-sounding unit, a tempting near-miss.",
        reveal:
          "The newton (N) measures force, a derived quantity, not length.",
      },
    ],
    claims: [
      claim("si_base_unit(length) = metre (m)", "bipm:si-brochure"),
      claim("quantity(litre) = volume", "bipm:si-brochure"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the SI base unit of mass?",
    correctAnswer: "Kilogram (kg)",
    correctReveal:
      "The kilogram (kg) is the SI base unit of mass — unusually, the base unit already carries a prefix; the gram is one-thousandth of it.",
    distractors: [
      {
        text: "Gram (g)",
        misconception: "the base unit is the one without a prefix",
        whyChosen:
          "The gram looks like the 'plain' unit, so it seems like the base.",
        reveal:
          "The gram (g) is 1/1000 of a kilogram; the SI base unit is the kilogram, prefix and all.",
      },
      {
        text: "Pound (lb)",
        misconception: "any weight unit could be SI",
        whyChosen:
          "The pound is a common weight unit, a plausible distractor.",
        reveal:
          "The pound (lb) is an imperial unit, not part of SI at all.",
      },
      {
        text: "Newton (N)",
        misconception: "mass and weight are the same",
        whyChosen:
          "Weight is a force, so the newton tempts learners who conflate mass and weight.",
        reveal:
          "The newton (N) measures force (weight), not mass — mass is measured in kilograms.",
      },
    ],
    claims: [
      claim("si_base_unit(mass) = kilogram (kg)", "bipm:si-brochure"),
      claim("relation(gram) = 0.001 kilogram", "bipm:si-brochure"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the SI base unit of time?",
    correctAnswer: "Second (s)",
    correctReveal:
      "The second (s) is the SI base unit of time; hertz measures frequency (events per second), and minutes and hours are non-SI multiples of the second.",
    distractors: [
      {
        text: "Hertz (Hz)",
        misconception: "time and frequency use the same unit",
        whyChosen:
          "Hertz is defined per second, so it is closely related and tempting.",
        reveal:
          "The hertz (Hz) measures frequency — one cycle per second — not a duration of time.",
      },
      {
        text: "Minute (min)",
        misconception: "the everyday time unit is the SI base unit",
        whyChosen:
          "The minute is the familiar unit of time, so it feels basic.",
        reveal:
          "The minute (min) is a non-SI unit equal to 60 seconds; the base unit is the second.",
      },
      {
        text: "Hour (h)",
        misconception: "any common time unit is SI",
        whyChosen:
          "The hour is another everyday time unit, a plausible guess.",
        reveal:
          "The hour (h) is a non-SI unit of 3,600 seconds, not the base unit.",
      },
    ],
    claims: [
      claim("si_base_unit(time) = second (s)", "bipm:si-brochure"),
      claim("quantity(hertz) = frequency (per second)", "bipm:si-brochure"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the SI unit of force?",
    correctAnswer: "Newton (N)",
    correctReveal:
      "Force is measured in newtons (N), a derived unit equal to kg·m/s², named after Isaac Newton — which is why the symbol is capitalized.",
    distractors: [
      {
        text: "Joule (J)",
        misconception: "force and energy share a unit",
        whyChosen:
          "Energy and force are closely linked (a joule is a newton-metre), a strong trap.",
        reveal:
          "The joule (J) measures energy (force applied over a distance), not force itself.",
      },
      {
        text: "Pascal (Pa)",
        misconception: "force and pressure are the same",
        whyChosen:
          "Pressure is force per area, so the pascal is a close conceptual near-miss.",
        reveal:
          "The pascal (Pa) measures pressure — force spread over an area — not force alone.",
      },
      {
        text: "Watt (W)",
        misconception: "all mechanics units are interchangeable",
        whyChosen:
          "The watt is another named mechanics unit, a plausible distractor.",
        reveal:
          "The watt (W) measures power — energy per second — not force.",
      },
    ],
    claims: [
      claim("si_unit(force) = newton (N)", "bipm:si-brochure"),
      claim("definition(newton) = kg·m/s²", "bipm:si-brochure"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the SI unit of energy?",
    correctAnswer: "Joule (J)",
    correctReveal:
      "Energy is measured in joules (J), a derived unit equal to a newton-metre (N·m), named after James Prescott Joule.",
    distractors: [
      {
        text: "Watt (W)",
        misconception: "energy and power are the same",
        whyChosen:
          "Power is energy per time, the single most common energy/power mix-up.",
        reveal:
          "The watt (W) measures power — the rate of energy use — not the energy itself (a watt is a joule per second).",
      },
      {
        text: "Newton (N)",
        misconception: "energy and force use one unit",
        whyChosen:
          "A joule is a newton-metre, so the newton is a close near-miss.",
        reveal:
          "The newton (N) measures force; multiply it by a distance to get energy in joules.",
      },
      {
        text: "Calorie (cal)",
        misconception: "any energy unit is SI",
        whyChosen:
          "The calorie is a familiar energy unit, tempting as the 'real' answer.",
        reveal:
          "The calorie (cal) does measure energy, but it is a non-SI unit; the SI unit is the joule.",
      },
    ],
    claims: [
      claim("si_unit(energy) = joule (J)", "bipm:si-brochure"),
      claim("definition(joule) = newton·metre", "bipm:si-brochure"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the SI unit of power?",
    correctAnswer: "Watt (W)",
    correctReveal:
      "Power is measured in watts (W), a derived unit equal to a joule per second (J/s), named after James Watt.",
    distractors: [
      {
        text: "Joule (J)",
        misconception: "power and energy share a unit",
        whyChosen:
          "Energy and power are constantly confused; the joule is the top trap.",
        reveal:
          "The joule (J) measures energy; power is how fast that energy is delivered — one watt is one joule per second.",
      },
      {
        text: "Volt (V)",
        misconception: "all electrical units measure power",
        whyChosen:
          "Power appears on electrical labels, so the volt tempts.",
        reveal:
          "The volt (V) measures electric potential difference, not power.",
      },
      {
        text: "Ampere (A)",
        misconception: "current and power are the same",
        whyChosen:
          "Current is part of electrical power (power = volts × amps), a close trap.",
        reveal:
          "The ampere (A) measures electric current, not power.",
      },
    ],
    claims: [
      claim("si_unit(power) = watt (W)", "bipm:si-brochure"),
      claim("definition(watt) = joule/second", "bipm:si-brochure"),
    ],
  },
  {
    difficulty: "hard",
    question: "What is the SI base unit of electric current?",
    correctAnswer: "Ampere (A)",
    correctReveal:
      "The ampere (A) is the SI base unit of electric current — one of the seven base units — named after André-Marie Ampère, so its symbol is capitalized.",
    distractors: [
      {
        text: "Volt (V)",
        misconception: "current and voltage are the same",
        whyChosen:
          "Volts and amps are constantly confused, making the volt the strongest trap.",
        reveal:
          "The volt (V) measures electric potential difference (a derived unit), not current.",
      },
      {
        text: "Coulomb (C)",
        misconception: "current and charge use one unit",
        whyChosen:
          "Charge and current are tightly linked (an ampere is a coulomb per second), a close near-miss.",
        reveal:
          "The coulomb (C) measures electric charge; current is charge per second, measured in amperes.",
      },
      {
        text: "Ohm (Ω)",
        misconception: "all electrical units are interchangeable",
        whyChosen:
          "The ohm is another core electrical unit, a plausible distractor.",
        reveal:
          "The ohm (Ω) measures electrical resistance, not current.",
      },
    ],
    claims: [
      claim("si_base_unit(electric current) = ampere (A)", "bipm:si-brochure"),
      claim("relation(ampere) = coulomb/second", "bipm:si-brochure"),
    ],
  },
];

export const learnScienceSiUnitsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:science:sci.units.si:v1",
  skillNode: "sci.units.si",
  category: "science_si_units",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "BIPM SI brochure; Wikidata",
  sourceLicense: "CC0-1.0; standards-body fact-only",
  rungs: RUNGS,
});

export const learnScienceSiUnitsLadderV1Questions =
  learnScienceSiUnitsLadderV1.questions;
export const learnScienceSiUnitsLadderV1ByChecksum =
  learnScienceSiUnitsLadderV1.byChecksum;
export const learnScienceSiUnitsLadderV1Metadata =
  learnScienceSiUnitsLadderV1.metadata;
export const validateLearnScienceSiUnitsLadderV1 =
  learnScienceSiUnitsLadderV1.validate;

export default learnScienceSiUnitsLadderV1Questions;
