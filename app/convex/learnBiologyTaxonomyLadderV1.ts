// Learn teaching ladder — Biology: classification.
//
// The teach: looks deceive. A whale is not a fish, a bat is not a bird, a spider
// is not an insect — classification follows traits (backbone, warm blood, live
// birth, leg count), not appearances. Each "odd one out" distractor is a real
// member of the group in question, so a wrong pick teaches the boundary. Facts
// only (structured taxonomy / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_biology_taxonomy_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "Which of these animals is NOT a mammal?",
    correctAnswer: "Shark",
    correctReveal:
      "A shark is a fish — it breathes through gills and lays eggs (or bears live young as a fish); the others are mammals that breathe air and nurse their young.",
    distractors: [
      {
        text: "Whale",
        misconception: "sea creatures are all fish",
        whyChosen:
          "A whale lives in the ocean and is shaped like a fish, the strongest trap.",
        reveal:
          "A whale is a mammal: it breathes air through lungs, is warm-blooded, and nurses its calves.",
      },
      {
        text: "Bat",
        misconception: "anything that flies is a bird",
        whyChosen:
          "A bat flies, so it is easily mistaken for a bird rather than a mammal.",
        reveal:
          "A bat is the only mammal capable of true flight — it has fur and feeds its young milk.",
      },
      {
        text: "Dolphin",
        misconception: "fast ocean swimmers are fish",
        whyChosen:
          "A dolphin looks and swims like a fish.",
        reveal:
          "A dolphin is a mammal that surfaces to breathe air and nurses its young.",
      },
    ],
    claims: [
      claim("class(shark) = fish (Chondrichthyes)", "wikidata:shark"),
      claim("class(whale, bat, dolphin) = Mammalia", "wikidata:mammal"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which of these animals is NOT a reptile?",
    correctAnswer: "Frog",
    correctReveal:
      "A frog is an amphibian — it has moist skin and begins life as a water-dwelling tadpole; reptiles have dry, scaly skin.",
    distractors: [
      {
        text: "Crocodile",
        misconception: "amphibious animals are amphibians",
        whyChosen:
          "A crocodile lives partly in water, so 'amphibian' feels tempting.",
        reveal:
          "A crocodile is a reptile with scaly skin that lays hard-shelled eggs on land.",
      },
      {
        text: "Snake",
        misconception: "legless slimy-looking animals are amphibians",
        whyChosen:
          "A snake can look smooth and moist, blurring the line.",
        reveal:
          "A snake is a reptile covered in dry scales, not moist amphibian skin.",
      },
      {
        text: "Turtle",
        misconception: "shelled water animals are their own group",
        whyChosen:
          "A turtle's shell and water habitat can confuse.",
        reveal:
          "A turtle is a reptile — it breathes air and has scaly skin under its shell.",
      },
    ],
    claims: [
      claim("class(frog) = amphibian (Amphibia)", "wikidata:frog"),
      claim("class(crocodile, snake, turtle) = Reptilia", "wikidata:reptile"),
    ],
  },
  {
    difficulty: "easy",
    question: "A spider belongs to which group of animals?",
    correctAnswer: "Arachnid",
    correctReveal:
      "A spider is an arachnid: eight legs and two body segments, unlike insects, which have six legs and three body segments.",
    distractors: [
      {
        text: "Insect",
        misconception: "all small crawling bugs are insects",
        whyChosen:
          "'Insect' is the catch-all guess for any little creepy-crawly.",
        reveal:
          "Insects have six legs and three body parts; a spider has eight legs and two, making it an arachnid.",
      },
      {
        text: "Crustacean",
        misconception: "any many-legged animal is a crustacean",
        whyChosen:
          "Crustaceans also have many legs, a plausible near-miss.",
        reveal:
          "Crustaceans, like crabs and lobsters, are mostly aquatic with hard shells — spiders are land-living arachnids.",
      },
      {
        text: "Mollusk",
        misconception: "any invertebrate fits any group",
        whyChosen:
          "Mollusk is another invertebrate group, a broad guess.",
        reveal:
          "Mollusks are soft-bodied animals like snails and octopuses, not eight-legged arachnids.",
      },
    ],
    claims: [
      claim("group(spider) = Arachnida (8 legs, 2 segments)", "wikidata:spider"),
      claim("group(insects) = 6 legs, 3 body segments", "wikidata:insect"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which of these is an amphibian?",
    correctAnswer: "Salamander",
    correctReveal:
      "A salamander is an amphibian — moist skin, aquatic larvae with gills — while lizards, snakes, and tortoises are all reptiles with dry scales.",
    distractors: [
      {
        text: "Lizard",
        misconception: "any small four-legged animal is an amphibian",
        whyChosen:
          "A lizard looks a lot like a salamander, the strongest trap.",
        reveal:
          "A lizard is a reptile with dry, scaly skin — a salamander has smooth, moist amphibian skin.",
      },
      {
        text: "Snake",
        misconception: "cold, smooth animals are amphibians",
        whyChosen:
          "Snakes are cold-blooded and can look moist.",
        reveal:
          "A snake is a reptile with scales, not an amphibian.",
      },
      {
        text: "Tortoise",
        misconception: "slow, damp-dwelling animals are amphibians",
        whyChosen:
          "A tortoise is another reptile easily miscategorized.",
        reveal:
          "A tortoise is a reptile with a shell and scaly skin, not an amphibian.",
      },
    ],
    claims: [
      claim("class(salamander) = Amphibia", "wikidata:salamander"),
      claim("class(lizard, snake, tortoise) = Reptilia", "wikidata:reptile"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which of these mammals is a marsupial?",
    correctAnswer: "Kangaroo",
    correctReveal:
      "A kangaroo is a marsupial — it carries and nurses its underdeveloped young in a pouch — unlike placental mammals, whose young develop more fully before birth.",
    distractors: [
      {
        text: "Rabbit",
        misconception: "any pouch-less small mammal could be a marsupial",
        whyChosen:
          "A rabbit is a small hopping mammal like a kangaroo, a plausible mix-up.",
        reveal:
          "A rabbit is a placental mammal — it has no pouch and its young develop in the womb.",
      },
      {
        text: "Squirrel",
        misconception: "any mammal with young could carry a pouch",
        whyChosen:
          "A squirrel is a familiar small mammal.",
        reveal:
          "A squirrel is a placental rodent, not a pouched marsupial.",
      },
      {
        text: "Mole",
        misconception: "burrowing mammals are marsupials",
        whyChosen:
          "A mole is an unusual mammal, a plausible odd-one-out.",
        reveal:
          "The common mole is a placental mammal (though a few unrelated 'marsupial moles' exist in Australia).",
      },
    ],
    claims: [
      claim("group(kangaroo) = marsupial (pouched)", "wikidata:kangaroo"),
      claim("group(rabbit, squirrel, mole) = placental mammals", "wikidata:placental mammal"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "To which class does a whale belong?",
    correctAnswer: "Mammals",
    correctReveal:
      "Whales are mammals: warm-blooded, air-breathing through lungs, and nursing their young with milk — they only look like fish because of where they live.",
    distractors: [
      {
        text: "Fish",
        misconception: "if it lives in the sea and is shaped like a fish, it is one",
        whyChosen:
          "Whales live in water and are streamlined like fish, the classic trap.",
        reveal:
          "Fish breathe water through gills; a whale surfaces to breathe air and is a mammal.",
      },
      {
        text: "Reptiles",
        misconception: "large cold-looking sea animals are reptiles",
        whyChosen:
          "Big marine animals can suggest reptiles like sea turtles.",
        reveal:
          "Reptiles have scales and are cold-blooded; whales are warm-blooded mammals.",
      },
      {
        text: "Amphibians",
        misconception: "water-and-air animals are amphibians",
        whyChosen:
          "Whales surface for air, hinting at amphibian life.",
        reveal:
          "Amphibians start life in water with gills; whales are mammals that never had a gilled larval stage.",
      },
    ],
    claims: [
      claim("class(whale) = Mammalia", "wikidata:whale"),
      claim("mammal_traits = warm-blooded, lungs, nurse young", "wikidata:mammal"),
    ],
  },
  {
    difficulty: "hard",
    question:
      "In the standard taxonomic hierarchy, which of these ranks is the broadest?",
    correctAnswer: "Kingdom",
    correctReveal:
      "The ranks run Kingdom > Phylum > Class > Order > Family > Genus > Species, so Kingdom is the broadest grouping and Species the most specific.",
    distractors: [
      {
        text: "Class",
        misconception: "class is near the top of the hierarchy",
        whyChosen:
          "'Class' sounds high-level and is a middle rank, a plausible trap.",
        reveal:
          "Class sits below Kingdom and Phylum in the hierarchy — broader than Order but narrower than Kingdom.",
      },
      {
        text: "Order",
        misconception: "order is a top-level rank",
        whyChosen:
          "'Order' can sound like an overarching category.",
        reveal:
          "Order is a middle rank, below Class and above Family — far from the broadest.",
      },
      {
        text: "Species",
        misconception: "species is the biggest grouping",
        whyChosen:
          "Species is the most familiar rank, so it can seem primary.",
        reveal:
          "Species is the narrowest rank of all — a single kind of organism, the opposite of broadest.",
      },
    ],
    claims: [
      claim(
        "taxonomic_ranks = Kingdom > Phylum > Class > Order > Family > Genus > Species",
        "reference:taxonomy",
      ),
      claim("broadest_rank(listed) = Kingdom", "reference:taxonomy"),
    ],
  },
];

export const learnBiologyTaxonomyLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:biology:bio.taxonomy:v1",
  skillNode: "bio.taxonomy",
  category: "biology_taxonomy",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Structured taxonomy; Wikidata",
  sourceLicense: "CC0-1.0",
  rungs: RUNGS,
});

export const learnBiologyTaxonomyLadderV1Questions =
  learnBiologyTaxonomyLadderV1.questions;
export const learnBiologyTaxonomyLadderV1ByChecksum =
  learnBiologyTaxonomyLadderV1.byChecksum;
export const learnBiologyTaxonomyLadderV1Metadata =
  learnBiologyTaxonomyLadderV1.metadata;
export const validateLearnBiologyTaxonomyLadderV1 =
  learnBiologyTaxonomyLadderV1.validate;

export default learnBiologyTaxonomyLadderV1Questions;
