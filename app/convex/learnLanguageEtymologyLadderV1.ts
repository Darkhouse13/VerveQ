// Learn teaching ladder — Language: word origins (loanwords).
//
// The teach: English is a magpie language, and tracing an everyday word back to
// the tongue it came from is half its story. Distractors are plausible-but-wrong
// donor languages (often the region a learner associates with the concept), so a
// wrong pick corrects the association. Facts only (etymological reference).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_language_etymology_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "From which language does English get the word 'kindergarten'?",
    correctAnswer: "German",
    correctReveal:
      "Kindergarten is German, literally 'children's garden' — the name of the early-schooling idea it describes, coined by educator Friedrich Fröbel.",
    distractors: [
      {
        text: "French",
        misconception: "European loanwords are usually French",
        whyChosen:
          "French is the default guess for a borrowed European word.",
        reveal:
          "French gave English many words, but 'kindergarten' is unmistakably German ('Kinder' + 'Garten').",
      },
      {
        text: "Dutch",
        misconception: "a Germanic-looking word must be Dutch",
        whyChosen:
          "Dutch resembles German, a close near-miss.",
        reveal:
          "Dutch is related to German but 'kindergarten' comes specifically from German.",
      },
      {
        text: "Latin",
        misconception: "formal or educational words come from Latin",
        whyChosen:
          "Education vocabulary often has Latin roots.",
        reveal:
          "Many school words are Latin, but 'kindergarten' is a modern German compound.",
      },
    ],
    claims: [
      claim("origin(kindergarten) = German ('children's garden')", "reference:etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "From which language does English get the word 'sushi'?",
    correctAnswer: "Japanese",
    correctReveal:
      "Sushi is a Japanese word; English borrowed it directly along with the dish as Japanese cuisine spread worldwide.",
    distractors: [
      {
        text: "Chinese",
        misconception: "all East Asian food words are Chinese",
        whyChosen:
          "Chinese is the largest East Asian language, a broad default.",
        reveal:
          "Though rice dishes are widespread in Asia, the word 'sushi' is specifically Japanese.",
      },
      {
        text: "Korean",
        misconception: "neighbouring cuisines share the word",
        whyChosen:
          "Korea is nearby with its own famous cuisine.",
        reveal:
          "Korean cuisine has its own vocabulary; 'sushi' comes from Japanese.",
      },
      {
        text: "Thai",
        misconception: "any Asian dish name could be Thai",
        whyChosen:
          "Thai food is globally popular.",
        reveal:
          "Thai contributes words like 'wok'-era dishes elsewhere, but 'sushi' is Japanese.",
      },
    ],
    claims: [
      claim("origin(sushi) = Japanese", "reference:etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "From which language does English get the word 'algebra'?",
    correctAnswer: "Arabic",
    correctReveal:
      "Algebra comes from the Arabic 'al-jabr' ('the reunion of broken parts'), from the title of a 9th-century mathematics book by al-Khwarizmi.",
    distractors: [
      {
        text: "Greek",
        misconception: "all mathematics words are Greek",
        whyChosen:
          "Greek gave maths many terms (geometry, arithmetic), a strong trap.",
        reveal:
          "Many maths words are Greek, but 'algebra' is Arabic, from 'al-jabr'.",
      },
      {
        text: "Latin",
        misconception: "scholarly words come from Latin",
        whyChosen:
          "Latin is the classic language of scholarship.",
        reveal:
          "'Algebra' passed through Latin but originates in Arabic.",
      },
      {
        text: "Persian",
        misconception: "any Middle Eastern origin will do",
        whyChosen:
          "Persian is another major regional language, a close near-miss.",
        reveal:
          "Al-Khwarizmi wrote in Arabic; 'algebra' is an Arabic word.",
      },
    ],
    claims: [
      claim("origin(algebra) = Arabic ('al-jabr')", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "From which language does English get the word 'yacht'?",
    correctAnswer: "Dutch",
    correctReveal:
      "Yacht comes from the Dutch 'jacht' (a fast hunting ship); English borrowed many seafaring words from Dutch maritime culture.",
    distractors: [
      {
        text: "German",
        misconception: "a Germanic-looking word must be German",
        whyChosen:
          "German resembles Dutch, the strongest near-miss.",
        reveal:
          "The word looks Germanic, but 'yacht' comes specifically from Dutch 'jacht'.",
      },
      {
        text: "Norwegian",
        misconception: "seafaring words come from the Vikings",
        whyChosen:
          "Scandinavian languages are associated with ships and the sea.",
        reveal:
          "Norse gave English some sea words, but 'yacht' is from Dutch.",
      },
      {
        text: "English",
        misconception: "a common English word is native",
        whyChosen:
          "'Yacht' feels thoroughly English by now.",
        reveal:
          "'Yacht' is a borrowing, not native English — it comes from Dutch.",
      },
    ],
    claims: [
      claim("origin(yacht) = Dutch ('jacht')", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "From which language does English get the word 'croissant'?",
    correctAnswer: "French",
    correctReveal:
      "Croissant is a French word meaning 'crescent', describing the pastry's curved shape; English took the word along with the French bakery tradition.",
    distractors: [
      {
        text: "Italian",
        misconception: "all pastry and food words are Italian",
        whyChosen:
          "Italian gives English many food words, a strong default.",
        reveal:
          "Italian supplies words like 'pasta' and 'pizza', but 'croissant' is French for 'crescent'.",
      },
      {
        text: "German",
        misconception: "the pastry's legend makes the word German",
        whyChosen:
          "The croissant has an Austrian origin legend, tempting a German answer.",
        reveal:
          "Whatever the pastry's legend, the English word 'croissant' comes from French.",
      },
      {
        text: "Turkish",
        misconception: "the crescent symbol points to Turkish",
        whyChosen:
          "The crescent is linked to Turkish imagery, a themed trap.",
        reveal:
          "The crescent shape has Turkish associations, but the word 'croissant' is French.",
      },
    ],
    claims: [
      claim("origin(croissant) = French ('crescent')", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "From which language does English get the word 'robot'?",
    correctAnswer: "Czech",
    correctReveal:
      "Robot comes from the Czech 'robota' (forced labour), coined in Karel Čapek's 1920 play R.U.R., which introduced artificial workers.",
    distractors: [
      {
        text: "Russian",
        misconception: "a Slavic-sounding word must be Russian",
        whyChosen:
          "Russian is the best-known Slavic language, the strongest trap.",
        reveal:
          "The word is Slavic, but specifically Czech, from Karel Čapek's play — not Russian.",
      },
      {
        text: "German",
        misconception: "technical or mechanical words come from German",
        whyChosen:
          "German is associated with engineering vocabulary.",
        reveal:
          "'Robot' is Czech in origin, not German, despite its mechanical meaning.",
      },
      {
        text: "Greek",
        misconception: "science-fiction terms come from Greek",
        whyChosen:
          "Greek supplies many science and technology roots.",
        reveal:
          "Unlike many sci-fi words, 'robot' is Czech, from 'robota' (forced labour).",
      },
    ],
    claims: [
      claim("origin(robot) = Czech ('robota', forced labour)", "reference:etymology"),
      claim("coined_in = Karel Capek's play R.U.R. (1920)", "reference:etymology"),
    ],
  },
  {
    difficulty: "hard",
    question: "From which language does English get the word 'shampoo'?",
    correctAnswer: "Hindi",
    correctReveal:
      "Shampoo comes from the Hindi 'chāmpo' (to press or massage), which entered English during British colonial rule in India.",
    distractors: [
      {
        text: "Arabic",
        misconception: "grooming and bathing words are Arabic",
        whyChosen:
          "Arabic gave English words like 'alcohol', a plausible origin for a toiletry word.",
        reveal:
          "'Shampoo' is not Arabic — it comes from Hindi 'chāmpo', to press or massage.",
      },
      {
        text: "Japanese",
        misconception: "any exotic-sounding word could be Japanese",
        whyChosen:
          "The sound of 'shampoo' can feel East Asian.",
        reveal:
          "'Shampoo' is from Hindi, from the era of British India, not Japanese.",
      },
      {
        text: "Portuguese",
        misconception: "colonial-trade words are Portuguese",
        whyChosen:
          "Portuguese spread many trade words worldwide.",
        reveal:
          "Portuguese did lend English some words, but 'shampoo' comes from Hindi.",
      },
    ],
    claims: [
      claim("origin(shampoo) = Hindi ('champo', to press/massage)", "reference:etymology"),
    ],
  },
];

export const learnLanguageEtymologyLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:language:lang.etymology:v1",
  skillNode: "lang.etymology",
  category: "language_etymology",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Etymological reference (open sources)",
  sourceLicense: "CC-BY-SA / public-domain reference",
  rungs: RUNGS,
});

export const learnLanguageEtymologyLadderV1Questions =
  learnLanguageEtymologyLadderV1.questions;
export const learnLanguageEtymologyLadderV1ByChecksum =
  learnLanguageEtymologyLadderV1.byChecksum;
export const learnLanguageEtymologyLadderV1Metadata =
  learnLanguageEtymologyLadderV1.metadata;
export const validateLearnLanguageEtymologyLadderV1 =
  learnLanguageEtymologyLadderV1.validate;

export default learnLanguageEtymologyLadderV1Questions;
