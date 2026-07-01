// Learn teaching ladder — Astronomy: moons.
//
// The teach: match each famous moon to the planet it orbits, and the record that
// makes it famous (largest, thick atmosphere, retrograde orbit, volcanic). The
// distractor planets are the other gas giants a learner might guess, so a wrong
// pick still teaches which giant hosts which moon. Facts only (NASA / IAU).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_astronomy_moons_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "Titan, the only moon with a thick atmosphere, orbits which planet?",
    correctAnswer: "Saturn",
    correctReveal:
      "Titan orbits Saturn and is the second-largest moon in the Solar System — the only moon wrapped in a dense, hazy atmosphere.",
    distractors: [
      {
        text: "Jupiter",
        misconception: "the biggest planet hosts every famous moon",
        whyChosen:
          "Jupiter has many famous moons, so it is the default wrong guess.",
        reveal:
          "Jupiter's big moons are the Galilean four (Io, Europa, Ganymede, Callisto) — Titan belongs to Saturn.",
      },
      {
        text: "Neptune",
        misconception: "a distant moon must orbit the farthest giant",
        whyChosen:
          "Neptune is a far gas giant, a plausible host.",
        reveal:
          "Neptune's largest moon is Triton, not Titan.",
      },
      {
        text: "Mars",
        misconception: "any planet can host a large moon",
        whyChosen:
          "Mars is a well-known planet, anchoring the inner Solar System.",
        reveal:
          "Mars has only two tiny moons, Phobos and Deimos — nothing the size of Titan.",
      },
    ],
    claims: [
      claim("orbits(Titan) = Saturn", "nasa:solar-system"),
      claim("only_moon_with_thick_atmosphere = Titan", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "easy",
    question:
      "Ganymede, the largest moon in the Solar System, orbits which planet?",
    correctAnswer: "Jupiter",
    correctReveal:
      "Ganymede orbits Jupiter and is the largest moon of all — bigger even than the planet Mercury.",
    distractors: [
      {
        text: "Saturn",
        misconception: "the ringed planet has the biggest moon",
        whyChosen:
          "Saturn has the second-largest moon (Titan), a close trap.",
        reveal:
          "Saturn's largest moon is Titan, which is second in size to Ganymede.",
      },
      {
        text: "Uranus",
        misconception: "any outer giant hosts the largest moon",
        whyChosen:
          "Uranus is a giant with several moons.",
        reveal:
          "Uranus's largest moon, Titania, is far smaller than Ganymede.",
      },
      {
        text: "Earth",
        misconception: "our familiar Moon is the biggest",
        whyChosen:
          "Earth's Moon is the one we know best.",
        reveal:
          "Earth's Moon is only the fifth-largest moon — Ganymede is much bigger.",
      },
    ],
    claims: [
      claim("orbits(Ganymede) = Jupiter", "nasa:solar-system"),
      claim("largest_moon(Solar System) = Ganymede", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "easy",
    question: "How many natural satellites (moons) does Earth have?",
    correctAnswer: "1",
    correctReveal:
      "Earth has exactly one natural satellite, the Moon; the occasional 'second moon' headlines describe small temporary asteroids, not true moons.",
    distractors: [
      {
        text: "2",
        misconception: "Earth has a hidden second moon",
        whyChosen:
          "Stories of 'mini-moons' make two seem possible.",
        reveal:
          "2 is wrong — Earth captures tiny temporary asteroids at times, but it has only one permanent moon.",
      },
      {
        text: "0",
        misconception: "the Moon might not count as a satellite",
        whyChosen:
          "It anchors the low end of the range.",
        reveal:
          "0 is wrong — the Moon is Earth's genuine natural satellite.",
      },
      {
        text: "4",
        misconception: "Earth is like the moon-rich giants",
        whyChosen:
          "Gas giants have many moons, inflating the guess.",
        reveal:
          "4 belongs to giant planets; Earth has just one moon.",
      },
    ],
    claims: [
      claim("moon_count(Earth) = 1", "nasa:solar-system"),
      claim("name(Earth's moon) = the Moon", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which of these planets has no moons at all?",
    correctAnswer: "Venus",
    correctReveal:
      "Venus has no moons — it and Mercury are the only two planets without any, while every planet beyond Earth has at least two.",
    distractors: [
      {
        text: "Mars",
        misconception: "small rocky planets have no moons",
        whyChosen:
          "Mars is small like Venus, so 'no moons' feels plausible.",
        reveal:
          "Mars has two small moons, Phobos and Deimos.",
      },
      {
        text: "Jupiter",
        misconception: "any planet could lack moons",
        whyChosen:
          "It anchors the moon-rich end of the set.",
        reveal:
          "Jupiter has dozens of moons, including the four large Galilean moons.",
      },
      {
        text: "Saturn",
        misconception: "a ringed planet might have rings instead of moons",
        whyChosen:
          "Saturn's rings can distract from its many moons.",
        reveal:
          "Saturn has dozens of moons in addition to its rings.",
      },
    ],
    claims: [
      claim("moon_count(Venus) = 0", "nasa:solar-system"),
      claim("moonless_planets = Mercury, Venus", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Phobos and Deimos are the two small moons of which planet?",
    correctAnswer: "Mars",
    correctReveal:
      "Phobos and Deimos orbit Mars; they are tiny, lumpy, and likely captured asteroids, named for the Greek words for fear and dread.",
    distractors: [
      {
        text: "Earth",
        misconception: "our neighbour planet shares Earth's moon situation",
        whyChosen:
          "Earth is the nearby rocky planet, an easy swap.",
        reveal:
          "Earth has one large Moon, not two small ones like Mars.",
      },
      {
        text: "Mercury",
        misconception: "any inner planet could host these moons",
        whyChosen:
          "Mercury is another inner planet.",
        reveal:
          "Mercury has no moons at all.",
      },
      {
        text: "Jupiter",
        misconception: "a moon-rich giant owns these too",
        whyChosen:
          "Jupiter has many moons, so it can seem to fit.",
        reveal:
          "Jupiter's famous moons are the large Galilean four, not Phobos and Deimos.",
      },
    ],
    claims: [
      claim("moons(Mars) = Phobos, Deimos", "nasa:solar-system"),
      claim("moon_count(Mercury) = 0", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "hard",
    question:
      "Triton, a large moon that orbits its planet backwards, belongs to which planet?",
    correctAnswer: "Neptune",
    correctReveal:
      "Triton orbits Neptune in a retrograde direction — opposite to the planet's spin — which is strong evidence it was a Kuiper-belt object captured by Neptune's gravity.",
    distractors: [
      {
        text: "Uranus",
        misconception: "the two outer twins share their big moons",
        whyChosen:
          "Uranus is Neptune's near-twin, the strongest trap.",
        reveal:
          "Uranus's largest moon is Titania; Triton belongs to Neptune.",
      },
      {
        text: "Saturn",
        misconception: "the ringed giant hosts the odd-orbit moon",
        whyChosen:
          "Saturn has many moons, a plausible host.",
        reveal:
          "Saturn's largest moon is Titan; Triton orbits Neptune.",
      },
      {
        text: "Jupiter",
        misconception: "the biggest planet owns the big moons",
        whyChosen:
          "Jupiter is the default 'many moons' answer.",
        reveal:
          "Jupiter's large moons orbit in the normal (prograde) direction; Triton's backward orbit is a Neptune feature.",
      },
    ],
    claims: [
      claim("orbits(Triton) = Neptune", "nasa:solar-system"),
      claim("orbit(Triton) = retrograde (captured object)", "nasa:solar-system"),
    ],
  },
  {
    difficulty: "hard",
    question:
      "Which moon is the most volcanically active body in the Solar System?",
    correctAnswer: "Io",
    correctReveal:
      "Io, a moon of Jupiter, is the most volcanically active body known — its interior is kept molten by tidal heating as Jupiter's gravity flexes it.",
    distractors: [
      {
        text: "Europa",
        misconception: "any big Jupiter moon is the volcanic one",
        whyChosen:
          "Europa is Io's neighbour at Jupiter, a close trap.",
        reveal:
          "Europa is icy, with a hidden ocean under its crust — not volcanic like Io.",
      },
      {
        text: "Titan",
        misconception: "the atmosphere-bearing moon is the active one",
        whyChosen:
          "Titan is famous and geologically interesting.",
        reveal:
          "Titan has lakes of liquid methane and a thick atmosphere, but it is not the volcanic record-holder.",
      },
      {
        text: "Ganymede",
        misconception: "the largest moon is the most active",
        whyChosen:
          "Ganymede's size can be confused with activity.",
        reveal:
          "Ganymede is the largest moon, but geologically quiet compared with fiery Io.",
      },
    ],
    claims: [
      claim("most_volcanically_active_body = Io", "nasa:solar-system"),
      claim("cause(Io volcanism) = tidal heating by Jupiter", "nasa:solar-system"),
    ],
  },
];

export const learnAstronomyMoonsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:astronomy:astro.moons:v1",
  skillNode: "astro.moons",
  category: "astronomy_moons",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "NASA Solar System exploration; IAU; Wikidata",
  sourceLicense: "public-domain (NASA); CC0-1.0",
  rungs: RUNGS,
});

export const learnAstronomyMoonsLadderV1Questions =
  learnAstronomyMoonsLadderV1.questions;
export const learnAstronomyMoonsLadderV1ByChecksum =
  learnAstronomyMoonsLadderV1.byChecksum;
export const learnAstronomyMoonsLadderV1Metadata =
  learnAstronomyMoonsLadderV1.metadata;
export const validateLearnAstronomyMoonsLadderV1 =
  learnAstronomyMoonsLadderV1.validate;

export default learnAstronomyMoonsLadderV1Questions;
