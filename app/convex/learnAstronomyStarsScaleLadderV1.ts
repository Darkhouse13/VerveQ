// Learn teaching ladder — Astronomy: stars & cosmic scale.
//
// The teach: distance, brightness, and a star's fate all come back to scale, and
// the units (the light-year, the astronomical unit) are chosen because kilometres
// run out of room. Distractors are the famous-but-wrong picks — the star everyone
// names for the wrong reason (Polaris), the closest-sounding star (Alpha Centauri
// A) — so a wrong pick corrects a common misconception. Facts only (IAU / NASA).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_astronomy_stars_scale_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What type of star is the Sun?",
    correctAnswer: "A yellow dwarf",
    correctReveal:
      "The Sun is a yellow dwarf — a G-type main-sequence star — steadily fusing hydrogen; it will swell into a red giant only near the end of its life.",
    distractors: [
      {
        text: "A red giant",
        misconception: "the Sun is already in its giant phase",
        whyChosen:
          "The Sun's future as a red giant is often mistaken for its present.",
        reveal:
          "A red giant is what the Sun will become in billions of years, not what it is now.",
      },
      {
        text: "A white dwarf",
        misconception: "the Sun is a dense burnt-out star",
        whyChosen:
          "White dwarf is the Sun's eventual endpoint, a plausible trap.",
        reveal:
          "A white dwarf is the Sun's final stage, after it sheds its outer layers — not its current form.",
      },
      {
        text: "A neutron star",
        misconception: "any star can be an exotic remnant",
        whyChosen:
          "Neutron star sounds impressive and stellar.",
        reveal:
          "A neutron star forms only from a much more massive star's supernova — the Sun is far too small.",
      },
    ],
    claims: [
      claim("classification(Sun) = G-type main-sequence (yellow dwarf)", "nasa:sun"),
      claim("future(Sun) = red giant then white dwarf", "nasa:sun"),
    ],
  },
  {
    difficulty: "easy",
    question: "Apart from the Sun, what is the closest star to Earth?",
    correctAnswer: "Proxima Centauri",
    correctReveal:
      "Proxima Centauri is the nearest star to us after the Sun, about 4.24 light-years away, and is part of the Alpha Centauri system.",
    distractors: [
      {
        text: "Alpha Centauri A",
        misconception: "the brightest star of the nearest system is the closest",
        whyChosen:
          "Alpha Centauri A is in the same system and slightly farther, the strongest near-miss.",
        reveal:
          "Alpha Centauri A is a touch farther than its small companion Proxima Centauri, which is the closest of the three.",
      },
      {
        text: "Sirius",
        misconception: "the brightest night-sky star is the nearest",
        whyChosen:
          "Sirius is the brightest star we see, so 'closest' feels natural.",
        reveal:
          "Sirius is bright partly because it is close-ish (8.6 light-years), but that is twice as far as Proxima Centauri.",
      },
      {
        text: "Betelgeuse",
        misconception: "a prominent bright star must be near",
        whyChosen:
          "Betelgeuse is a famous bright star.",
        reveal:
          "Betelgeuse is a red supergiant hundreds of light-years away — very far, not close.",
      },
    ],
    claims: [
      claim("closest_star_after_sun = Proxima Centauri (~4.24 ly)", "nasa:nearest-stars"),
      claim("distance(Sirius) = 8.6 light-years", "nasa:nearest-stars"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the brightest star in Earth's night sky?",
    correctAnswer: "Sirius",
    correctReveal:
      "Sirius, the 'Dog Star' in Canis Major, is the brightest star in the night sky — bright because it is both luminous and relatively close.",
    distractors: [
      {
        text: "Polaris",
        misconception: "the North Star is the brightest star",
        whyChosen:
          "Polaris is the most famous star, so people assume it is the brightest — the classic trap.",
        reveal:
          "Polaris is famous for marking north, not for brightness; it is only moderately bright.",
      },
      {
        text: "Betelgeuse",
        misconception: "a huge supergiant is the brightest",
        whyChosen:
          "Betelgeuse is enormous, so it seems it should dominate.",
        reveal:
          "Betelgeuse is very luminous but far away, so it appears dimmer than Sirius from Earth.",
      },
      {
        text: "Vega",
        misconception: "any famous bright star could top the list",
        whyChosen:
          "Vega is a genuinely bright, well-known star.",
        reveal:
          "Vega is bright, but Sirius outshines it in Earth's sky.",
      },
    ],
    claims: [
      claim("brightest_night_sky_star = Sirius", "iau:star-brightness"),
      claim("role(Polaris) = marks celestial north", "iau:star-brightness"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "About how long does light from the Sun take to reach Earth?",
    correctAnswer: "About 8 minutes",
    correctReveal:
      "Sunlight takes about 8 minutes and 20 seconds to cross the roughly 150 million kilometres to Earth, so we always see the Sun as it was 8 minutes ago.",
    distractors: [
      {
        text: "About 8 seconds",
        misconception: "light is effectively instant across the Solar System",
        whyChosen:
          "Light is so fast that seconds feel plausible.",
        reveal:
          "8 seconds is far too short — light covers the Earth-Sun distance in about 8 minutes, not seconds.",
      },
      {
        text: "About 1 hour",
        misconception: "the Sun is much farther than it is",
        whyChosen:
          "An hour overestimates the distance, a plausible over-guess.",
        reveal:
          "An hour is too long; sunlight reaches Earth in roughly 8 minutes.",
      },
      {
        text: "About 1 day",
        misconception: "even light takes days to arrive",
        whyChosen:
          "It anchors the far end of the range.",
        reveal:
          "A day is enormously too long — that is closer to how long light takes to cross the Solar System several times over.",
      },
    ],
    claims: [
      claim("light_travel_time(Sun to Earth) = ~8 min 20 s", "nasa:sun"),
      claim("distance(Sun to Earth) = ~150 million km (1 AU)", "nasa:sun"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "A light-year is a measure of what?",
    correctAnswer: "Distance",
    correctReveal:
      "A light-year is a distance — how far light travels in one year, about 9.46 trillion kilometres — even though the name sounds like a length of time.",
    distractors: [
      {
        text: "Time",
        misconception: "'year' in the name means it measures time",
        whyChosen:
          "The word 'year' strongly suggests time — the central trap.",
        reveal:
          "Despite the 'year', a light-year measures distance, not time; the year describes how far light goes in that period.",
      },
      {
        text: "Brightness",
        misconception: "a stellar unit must measure how bright a star is",
        whyChosen:
          "Brightness is another star property, a plausible confusion.",
        reveal:
          "Brightness is measured in magnitudes, not light-years.",
      },
      {
        text: "Speed",
        misconception: "anything with 'light' measures the speed of light",
        whyChosen:
          "'Light' hints at the speed of light.",
        reveal:
          "The speed of light is a speed; a light-year built from it is a distance.",
      },
    ],
    claims: [
      claim("quantity(light-year) = distance (~9.46 trillion km)", "iau:units"),
      claim("definition(light-year) = distance light travels in one year", "iau:units"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Our Solar System lies within which galaxy?",
    correctAnswer: "The Milky Way",
    correctReveal:
      "The Sun and all its planets sit in the Milky Way galaxy; Andromeda is the nearest large galaxy to us, about 2.5 million light-years away.",
    distractors: [
      {
        text: "Andromeda",
        misconception: "the nearest big galaxy is our own",
        whyChosen:
          "Andromeda is the most-named neighbouring galaxy, the top trap.",
        reveal:
          "Andromeda is our nearest large galactic neighbour, not the galaxy we live in.",
      },
      {
        text: "The Whirlpool Galaxy",
        misconception: "any famous galaxy could be home",
        whyChosen:
          "The Whirlpool is a well-photographed galaxy.",
        reveal:
          "The Whirlpool Galaxy is a distant spiral tens of millions of light-years away.",
      },
      {
        text: "Triangulum",
        misconception: "a nearby galaxy is our own",
        whyChosen:
          "Triangulum is part of our Local Group, a plausible mix-up.",
        reveal:
          "Triangulum is a separate small galaxy in our Local Group, not the one containing the Sun.",
      },
    ],
    claims: [
      claim("home_galaxy(Solar System) = Milky Way", "nasa:milky-way"),
      claim("nearest_large_galaxy = Andromeda (~2.5 million ly)", "nasa:milky-way"),
    ],
  },
  {
    difficulty: "hard",
    question: "What will a star like our Sun eventually become at the end of its life?",
    correctAnswer: "A white dwarf",
    correctReveal:
      "A Sun-mass star ends as a white dwarf: after swelling into a red giant and shedding its outer layers, only the hot, dense core remains — too light to become a neutron star or black hole.",
    distractors: [
      {
        text: "A black hole",
        misconception: "every star collapses into a black hole",
        whyChosen:
          "Black holes are the dramatic default guess for a star's end.",
        reveal:
          "A black hole forms only from a very massive star's core — far heavier than the Sun.",
      },
      {
        text: "A neutron star",
        misconception: "any dying star leaves a neutron star",
        whyChosen:
          "Neutron stars are another famous remnant.",
        reveal:
          "A neutron star needs a much more massive progenitor than the Sun; the Sun's core becomes a white dwarf.",
      },
      {
        text: "A supernova",
        misconception: "the Sun will explode as a supernova",
        whyChosen:
          "Supernovae are the best-known stellar deaths.",
        reveal:
          "A supernova is the explosive death of a massive star; the Sun is far too light to go supernova.",
      },
    ],
    claims: [
      claim("stellar_endpoint(Sun-mass star) = white dwarf", "nasa:stellar-evolution"),
      claim("requirement(neutron star / black hole) = high-mass star", "nasa:stellar-evolution"),
    ],
  },
];

export const learnAstronomyStarsScaleLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:astronomy:astro.starsAndScale:v1",
  skillNode: "astro.starsAndScale",
  category: "astronomy_stars_scale",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "NASA; IAU; Wikidata",
  sourceLicense: "public-domain (NASA); CC0-1.0",
  rungs: RUNGS,
});

export const learnAstronomyStarsScaleLadderV1Questions =
  learnAstronomyStarsScaleLadderV1.questions;
export const learnAstronomyStarsScaleLadderV1ByChecksum =
  learnAstronomyStarsScaleLadderV1.byChecksum;
export const learnAstronomyStarsScaleLadderV1Metadata =
  learnAstronomyStarsScaleLadderV1.metadata;
export const validateLearnAstronomyStarsScaleLadderV1 =
  learnAstronomyStarsScaleLadderV1.validate;

export default learnAstronomyStarsScaleLadderV1Questions;
