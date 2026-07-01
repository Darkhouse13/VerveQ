// Learn teaching ladder — Language: Greek & Latin roots.
//
// The teach: a handful of Greek and Latin roots unlock thousands of English
// words — learn the root, decode the word. Distractors are meanings that belong
// to OTHER common roots, so a wrong pick still teaches a mapping. Facts only
// (etymological reference / Wiktionary-class open sources).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_language_roots_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What does the Greek root 'photo-' mean?",
    correctAnswer: "Light",
    correctReveal:
      "The root photo- means light, as in photograph ('light-writing') and photosynthesis, where plants build food using light.",
    distractors: [
      {
        text: "Sound",
        misconception: "photo- relates to recording in general",
        whyChosen:
          "Cameras and phones handle sound too, blurring the meaning.",
        reveal:
          "'Sound' is the root phono- (as in telephone, phonics), not photo-.",
      },
      {
        text: "Water",
        misconception: "any science root means water",
        whyChosen:
          "Water roots are common in science words.",
        reveal:
          "'Water' is hydro- (as in hydrant, dehydrate), not photo-.",
      },
      {
        text: "Life",
        misconception: "biology roots are interchangeable",
        whyChosen:
          "'Life' is another frequent science root.",
        reveal:
          "'Life' is bio- (as in biology, biography); photo- means light.",
      },
    ],
    claims: [
      claim("root(photo-) = light (Greek)", "reference:etymology"),
      claim("root(phono-) = sound; hydro- = water; bio- = life", "reference:etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "What does the Latin root 'aqua-' mean?",
    correctAnswer: "Water",
    correctReveal:
      "The root aqua- means water, as in aquarium (a water tank) and aquatic (living in water).",
    distractors: [
      {
        text: "Air",
        misconception: "the four elements share one root",
        whyChosen:
          "Air is another classical element, a plausible mix-up.",
        reveal:
          "'Air' is the root aero- (as in aerobic, aeroplane), not aqua-.",
      },
      {
        text: "Earth",
        misconception: "any nature root means earth",
        whyChosen:
          "Earth is another elemental idea.",
        reveal:
          "'Earth' is terra- or geo- (as in terrain, geography); aqua- means water.",
      },
      {
        text: "Fire",
        misconception: "elemental roots are interchangeable",
        whyChosen:
          "Fire completes the set of classical elements.",
        reveal:
          "'Fire' is pyro- (as in pyrotechnics); aqua- means water.",
      },
    ],
    claims: [
      claim("root(aqua-) = water (Latin)", "reference:etymology"),
      claim("root(aero-) = air; pyro- = fire", "reference:etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "What does the Greek root 'bio-' mean?",
    correctAnswer: "Life",
    correctReveal:
      "The root bio- means life, as in biology (the study of life) and biography (the story of a life).",
    distractors: [
      {
        text: "Body",
        misconception: "bio- refers to the physical body",
        whyChosen:
          "Biology studies bodies, so 'body' feels close.",
        reveal:
          "'Body' is the root corpo- or soma- (as in corpse, somatic); bio- means life itself.",
      },
      {
        text: "Growth",
        misconception: "a living-things root means growth",
        whyChosen:
          "Growth is closely tied to living things.",
        reveal:
          "'Growth' is more like -phyte or auxo-; bio- specifically means life.",
      },
      {
        text: "Death",
        misconception: "biology and its opposite share a root",
        whyChosen:
          "Death is the natural opposite pole to life.",
        reveal:
          "'Death' is the root necro- or mort- (as in necropolis, mortal); bio- means life.",
      },
    ],
    claims: [
      claim("root(bio-) = life (Greek)", "reference:etymology"),
      claim("root(necro-/mort-) = death", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What does the Latin root 'terra-' mean?",
    correctAnswer: "Earth or land",
    correctReveal:
      "The root terra- means earth or land, as in terrain, territory, and extraterrestrial (beyond the Earth).",
    distractors: [
      {
        text: "Sky",
        misconception: "landscape roots point upward",
        whyChosen:
          "Sky and land are paired opposites in nature words.",
        reveal:
          "'Sky' is more like celest- or uran- (celestial, Uranus); terra- means earth or land.",
      },
      {
        text: "Sea",
        misconception: "any geography root means sea",
        whyChosen:
          "Sea is a common geography theme.",
        reveal:
          "'Sea' is the root mar- (as in marine, maritime); terra- means land.",
      },
      {
        text: "Star",
        misconception: "cosmic roots are interchangeable",
        whyChosen:
          "'Star' is a familiar root idea.",
        reveal:
          "'Star' is astro- or stella- (astronomy, stellar); terra- means earth or land.",
      },
    ],
    claims: [
      claim("root(terra-) = earth/land (Latin)", "reference:etymology"),
      claim("root(mar-) = sea; astro- = star", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What does the Greek root 'chrono-' mean?",
    correctAnswer: "Time",
    correctReveal:
      "The root chrono- means time, as in chronology (the order of events in time) and synchronize (to line up in time).",
    distractors: [
      {
        text: "Colour",
        misconception: "chrono- and chromo- are the same root",
        whyChosen:
          "Chromo- ('colour') looks and sounds almost identical, the strongest trap.",
        reveal:
          "'Colour' is chromo- (as in chromosome, monochrome); chrono- with an 'n' means time.",
      },
      {
        text: "Sound",
        misconception: "any Greek root could mean sound",
        whyChosen:
          "Sound roots are common in Greek-derived words.",
        reveal:
          "'Sound' is phono- (telephone, symphony); chrono- means time.",
      },
      {
        text: "Distance",
        misconception: "measurement roots are interchangeable",
        whyChosen:
          "Time and distance are both measured quantities.",
        reveal:
          "'Distance' is more like tele- (far) or -metry (measure); chrono- means time.",
      },
    ],
    claims: [
      claim("root(chrono-) = time (Greek)", "reference:etymology"),
      claim("root(chromo-) = colour; phono- = sound", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What does the Greek root 'geo-' mean?",
    correctAnswer: "Earth",
    correctReveal:
      "The root geo- means earth, as in geography ('earth-writing') and geology (the study of the Earth); the Latin equivalent is terra-.",
    distractors: [
      {
        text: "Water",
        misconception: "any earth-science root means water",
        whyChosen:
          "Geography covers oceans, so 'water' feels connected.",
        reveal:
          "'Water' is hydro- (hydroelectric, dehydrate); geo- means earth.",
      },
      {
        text: "Heat",
        misconception: "geothermal makes geo- mean heat",
        whyChosen:
          "'Geothermal' pairs geo- with heat, a subtle trap.",
        reveal:
          "In 'geothermal' the heat part is thermo-; geo- itself means earth.",
      },
      {
        text: "Life",
        misconception: "science roots all mean life",
        whyChosen:
          "'Life' is a very common root meaning.",
        reveal:
          "'Life' is bio-; geo- means earth.",
      },
    ],
    claims: [
      claim("root(geo-) = earth (Greek)", "reference:etymology"),
      claim("root(thermo-) = heat; hydro- = water", "reference:etymology"),
    ],
  },
  {
    difficulty: "hard",
    question: "What does the Latin root 'omni-' mean?",
    correctAnswer: "All or every",
    correctReveal:
      "The root omni- means all or every, as in omnivore (eats all kinds of food), omnipotent (all-powerful), and omniscient (all-knowing).",
    distractors: [
      {
        text: "None",
        misconception: "omni- is a negative prefix",
        whyChosen:
          "'Omni' can be mistaken for a negating prefix.",
        reveal:
          "'None' is nil- or a-/non-; omni- means the opposite — all.",
      },
      {
        text: "Half",
        misconception: "quantity roots are interchangeable",
        whyChosen:
          "'Half' is another quantity meaning.",
        reveal:
          "'Half' is semi- or hemi- (semicircle, hemisphere); omni- means all.",
      },
      {
        text: "Many",
        misconception: "'all' and 'many' are the same root",
        whyChosen:
          "'Many' is close to 'all', the strongest near-miss.",
        reveal:
          "'Many' is poly- or multi- (polygon, multiple); omni- specifically means all or every.",
      },
    ],
    claims: [
      claim("root(omni-) = all/every (Latin)", "reference:etymology"),
      claim("root(semi-/hemi-) = half; poly-/multi- = many", "reference:etymology"),
    ],
  },
];

export const learnLanguageRootsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:language:lang.roots:v1",
  skillNode: "lang.roots",
  category: "language_roots",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Etymological reference (open sources)",
  sourceLicense: "CC-BY-SA / public-domain reference",
  rungs: RUNGS,
});

export const learnLanguageRootsLadderV1Questions =
  learnLanguageRootsLadderV1.questions;
export const learnLanguageRootsLadderV1ByChecksum =
  learnLanguageRootsLadderV1.byChecksum;
export const learnLanguageRootsLadderV1Metadata =
  learnLanguageRootsLadderV1.metadata;
export const validateLearnLanguageRootsLadderV1 =
  learnLanguageRootsLadderV1.validate;

export default learnLanguageRootsLadderV1Questions;
