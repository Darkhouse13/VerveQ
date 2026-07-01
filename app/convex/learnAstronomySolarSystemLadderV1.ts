// Learn teaching ladder — Astronomy: the Solar System.
//
// The teach: the planet that is closest, biggest, or hottest is rarely the same
// one, and the famous shortcut ("Mercury is closest, so it must be hottest") is
// exactly the trap. Distractors are the other planets that plausibly hold a
// different superlative, so a wrong pick teaches which planet owns which record.
// Facts only (IAU / NASA / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_astronomy_solar_system_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "Which is the largest planet in the Solar System?",
    correctAnswer: "Jupiter",
    correctReveal:
      "Jupiter is the largest planet — more massive than all the other planets combined — and Saturn is a distant second.",
    distractors: [
      {
        text: "Saturn",
        misconception: "the ringed planet is the biggest",
        whyChosen:
          "Saturn is genuinely the second-largest, so it is the strongest near-miss.",
        reveal:
          "Saturn is the second-largest planet, smaller than Jupiter but famous for its rings.",
      },
      {
        text: "Neptune",
        misconception: "the outermost giant is the largest",
        whyChosen:
          "Neptune is a gas giant far out, so it can seem huge.",
        reveal:
          "Neptune is the fourth-largest planet — a giant, but much smaller than Jupiter.",
      },
      {
        text: "Earth",
        misconception: "our home planet is a large one",
        whyChosen:
          "Earth feels big from where we stand, anchoring the small end.",
        reveal:
          "Earth is tiny next to the gas giants — about eleven Earths would span Jupiter.",
      },
    ],
    claims: [
      claim("largest_planet(Solar System) = Jupiter", "nasa:solar-system"),
      claim("second_largest_planet(Solar System) = Saturn", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which planet is closest to the Sun?",
    correctAnswer: "Mercury",
    correctReveal:
      "Mercury orbits closest to the Sun, at about 58 million kilometres, ahead of Venus in second place.",
    distractors: [
      {
        text: "Venus",
        misconception: "the brightest or hottest planet is the closest",
        whyChosen:
          "Venus is the second planet and the hottest, an easy swap for closest.",
        reveal:
          "Venus is the second planet from the Sun, just beyond Mercury.",
      },
      {
        text: "Earth",
        misconception: "our planet sits near the front",
        whyChosen:
          "Earth is the third planet, close enough to tempt.",
        reveal:
          "Earth is the third planet from the Sun, two orbits out from Mercury.",
      },
      {
        text: "Mars",
        misconception: "a warm-looking planet is near the Sun",
        whyChosen:
          "Mars anchors the outer end of the inner planets.",
        reveal:
          "Mars is the fourth planet, farther from the Sun than Earth.",
      },
    ],
    claims: [
      claim("closest_planet_to_sun = Mercury", "nasa:solar-system"),
      claim("planet_order = Mercury, Venus, Earth, Mars, ...", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which planet is known as the Red Planet?",
    correctAnswer: "Mars",
    correctReveal:
      "Mars looks red because its surface is coated in iron-oxide dust — literally rust — giving it a rusty orange hue.",
    distractors: [
      {
        text: "Jupiter",
        misconception: "the biggest planet must be the famous coloured one",
        whyChosen:
          "Jupiter's Great Red Spot makes 'red' feel plausible.",
        reveal:
          "Jupiter has a Great Red Spot storm, but the planet itself is banded cream and brown, not red.",
      },
      {
        text: "Venus",
        misconception: "the hottest planet glows red",
        whyChosen:
          "Venus is scorching, so learners link heat with a red colour.",
        reveal:
          "Venus is a pale yellow-white, wrapped in thick sulfuric-acid clouds — not red.",
      },
      {
        text: "Mercury",
        misconception: "the closest planet is sun-scorched red",
        whyChosen:
          "Being nearest the Sun suggests a fiery colour.",
        reveal:
          "Mercury is a grey, cratered, rocky world, closer in look to the Moon than to Mars.",
      },
    ],
    claims: [
      claim("nickname(Mars) = the Red Planet", "nasa:solar-system"),
      claim("surface(Mars) = iron-oxide (rust) dust", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which is the hottest planet in the Solar System?",
    correctAnswer: "Venus",
    correctReveal:
      "Venus is the hottest planet — around 465 °C — because its thick carbon-dioxide atmosphere traps heat in a runaway greenhouse effect, even though it is not the closest to the Sun.",
    distractors: [
      {
        text: "Mercury",
        misconception: "closest to the Sun must mean hottest",
        whyChosen:
          "Mercury is nearest the Sun, the single most common wrong answer here.",
        reveal:
          "Mercury is closer to the Sun but has almost no atmosphere to hold heat, so Venus is hotter despite being farther out.",
      },
      {
        text: "Mars",
        misconception: "any inner planet could be the hottest",
        whyChosen:
          "Mars is another inner planet, a plausible near-miss.",
        reveal:
          "Mars is cold — averaging about −60 °C — with a thin atmosphere that keeps little heat.",
      },
      {
        text: "Jupiter",
        misconception: "the biggest planet is the hottest",
        whyChosen:
          "Size can be confused with temperature.",
        reveal:
          "Jupiter's cloud tops are frigid; it is a cold gas giant far from the Sun.",
      },
    ],
    claims: [
      claim("hottest_planet(Solar System) = Venus (~465°C)", "nasa:solar-system"),
      claim("cause(Venus heat) = runaway CO2 greenhouse effect", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which planet has the most prominent ring system?",
    correctAnswer: "Saturn",
    correctReveal:
      "All four giant planets have rings, but Saturn's are by far the brightest and widest, made of countless chunks of ice and rock.",
    distractors: [
      {
        text: "Jupiter",
        misconception: "the largest planet has the biggest rings",
        whyChosen:
          "Jupiter is the biggest planet, so grand rings seem to fit.",
        reveal:
          "Jupiter does have rings, but they are faint and dusty — nothing like Saturn's.",
      },
      {
        text: "Uranus",
        misconception: "any giant's rings rival Saturn's",
        whyChosen:
          "Uranus has real rings, a plausible trap.",
        reveal:
          "Uranus has a set of narrow, dark rings, far less prominent than Saturn's bright bands.",
      },
      {
        text: "Neptune",
        misconception: "the outer giants all have showy rings",
        whyChosen:
          "Neptune is a ringed giant too.",
        reveal:
          "Neptune's rings are thin and clumpy, barely visible compared with Saturn's.",
      },
    ],
    claims: [
      claim("most_prominent_rings = Saturn", "nasa:solar-system"),
      claim("giants_with_rings = Jupiter, Saturn, Uranus, Neptune", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "How many planets are there in the Solar System?",
    correctAnswer: "8",
    correctReveal:
      "There are 8 planets: since 2006 Pluto has been classified as a dwarf planet, dropping the count from the older figure of 9.",
    distractors: [
      {
        text: "9",
        misconception: "Pluto is still counted as a planet",
        whyChosen:
          "9 was the answer for decades and is the top trap.",
        reveal:
          "9 was the count before 2006, when Pluto was reclassified as a dwarf planet.",
      },
      {
        text: "7",
        misconception: "one of the eight is not really a planet",
        whyChosen:
          "7 is a plausible off-by-one guess.",
        reveal:
          "7 is one too few — all eight, from Mercury to Neptune, are full planets.",
      },
      {
        text: "12",
        misconception: "every large body counts as a planet",
        whyChosen:
          "Counting dwarf planets and big moons inflates the total.",
        reveal:
          "12 over-counts by including dwarf planets like Pluto, Ceres, and Eris, which are a separate category.",
      },
    ],
    claims: [
      claim("planet_count(Solar System) = 8", "iau:2006-resolution"),
      claim("reclassification(Pluto) = dwarf planet in 2006", "iau:2006-resolution"),
    ],
  },
  {
    difficulty: "hard",
    question: "Which planet is tilted so far over that it essentially rotates on its side?",
    correctAnswer: "Uranus",
    correctReveal:
      "Uranus has an axial tilt of about 98°, so it rolls around the Sun almost on its side — probably the result of a giant ancient collision.",
    distractors: [
      {
        text: "Venus",
        misconception: "the planet with unusual rotation is the sideways one",
        whyChosen:
          "Venus has famously odd rotation (it spins backwards), a strong near-miss.",
        reveal:
          "Venus is the one that rotates backwards (retrograde), but its axis is nearly upright — it is not tilted on its side.",
      },
      {
        text: "Neptune",
        misconception: "the outermost giant is the tilted one",
        whyChosen:
          "Neptune is Uranus's near-twin, easy to swap.",
        reveal:
          "Neptune has a fairly ordinary tilt of about 28°, similar to Earth's, unlike Uranus.",
      },
      {
        text: "Saturn",
        misconception: "the ringed giant lies on its side",
        whyChosen:
          "Saturn's visible tilt of its rings can suggest an extreme angle.",
        reveal:
          "Saturn's tilt is about 27°, close to Earth's — its rings just make the tilt easy to see.",
      },
    ],
    claims: [
      claim("axial_tilt(Uranus) = ~98 degrees", "nasa:solar-system"),
      claim("rotation(Venus) = retrograde", "nasa:solar-system"),
    ],
  },
];

export const learnAstronomySolarSystemLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:astronomy:astro.solarSystem:v1",
  skillNode: "astro.solarSystem",
  category: "astronomy_solar_system",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "NASA Solar System exploration; IAU; Wikidata",
  sourceLicense: "public-domain (NASA); CC0-1.0",
  rungs: RUNGS,
});

export const learnAstronomySolarSystemLadderV1Questions =
  learnAstronomySolarSystemLadderV1.questions;
export const learnAstronomySolarSystemLadderV1ByChecksum =
  learnAstronomySolarSystemLadderV1.byChecksum;
export const learnAstronomySolarSystemLadderV1Metadata =
  learnAstronomySolarSystemLadderV1.metadata;
export const validateLearnAstronomySolarSystemLadderV1 =
  learnAstronomySolarSystemLadderV1.validate;

export default learnAstronomySolarSystemLadderV1Questions;
