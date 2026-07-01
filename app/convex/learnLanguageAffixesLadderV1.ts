// Learn teaching ladder — Language: prefixes & suffixes.
//
// The teach: affixes are meaning-modifiers — un- flips a word, re- repeats it,
// -ology studies it. Distractors are meanings that belong to OTHER affixes, so a
// wrong pick teaches a second one. Facts only (etymological reference).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_language_affixes_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What does the prefix 'un-' (as in 'unhappy') mean?",
    correctAnswer: "Not or opposite",
    correctReveal:
      "The prefix un- reverses a word: unhappy is not happy, and unlock is the opposite of lock.",
    distractors: [
      {
        text: "Again",
        misconception: "un- and re- do the same job",
        whyChosen:
          "'re-' (again) is another everyday prefix, an easy swap.",
        reveal:
          "'Again' is the prefix re- (redo, replay); un- means not or the opposite.",
      },
      {
        text: "Before",
        misconception: "any short prefix means before",
        whyChosen:
          "'Before' is a common prefix meaning.",
        reveal:
          "'Before' is pre- (preview, prehistoric); un- means not.",
      },
      {
        text: "Under",
        misconception: "un- is short for under",
        whyChosen:
          "'Un' looks like the start of 'under'.",
        reveal:
          "'Under' is sub- (submarine, subway); un- means not or the opposite.",
      },
    ],
    claims: [
      claim("prefix(un-) = not / opposite", "reference:etymology"),
      claim("prefix(re-) = again; pre- = before; sub- = under", "reference:etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "What does the prefix 're-' (as in 'rewrite') mean?",
    correctAnswer: "Again or back",
    correctReveal:
      "The prefix re- means again or back: rewrite is to write again, and return is to go back.",
    distractors: [
      {
        text: "Not",
        misconception: "re- is a negating prefix",
        whyChosen:
          "Negation is the most common prefix job, an easy default.",
        reveal:
          "'Not' is un- or non- (unhappy, nonsense); re- means again.",
      },
      {
        text: "Before",
        misconception: "any prefix could mean before",
        whyChosen:
          "'Before' is a frequent prefix meaning.",
        reveal:
          "'Before' is pre-; re- means again or back.",
      },
      {
        text: "Away",
        misconception: "re- sends something away",
        whyChosen:
          "'Return' can suggest movement away.",
        reveal:
          "'Away' is more like de- or ab- (depart, absent); re- means again or back.",
      },
    ],
    claims: [
      claim("prefix(re-) = again / back", "reference:etymology"),
      claim("prefix(un-/non-) = not; ab- = away", "reference:etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "What does the prefix 'pre-' (as in 'preview') mean?",
    correctAnswer: "Before",
    correctReveal:
      "The prefix pre- means before: a preview comes before the main event, and prehistoric means before recorded history.",
    distractors: [
      {
        text: "After",
        misconception: "pre- and post- are the same",
        whyChosen:
          "'post-' (after) is the direct opposite, the strongest trap.",
        reveal:
          "'After' is post- (postpone, postwar); pre- means before.",
      },
      {
        text: "Against",
        misconception: "any prefix could mean against",
        whyChosen:
          "'Against' is a common prefix meaning.",
        reveal:
          "'Against' is anti- (antifreeze, antisocial); pre- means before.",
      },
      {
        text: "Within",
        misconception: "prefixes of place mean within",
        whyChosen:
          "'Within' is a plausible positional meaning.",
        reveal:
          "'Within' is intra- or in- (internal, inside); pre- means before.",
      },
    ],
    claims: [
      claim("prefix(pre-) = before", "reference:etymology"),
      claim("prefix(post-) = after; anti- = against", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What does the suffix '-ology' (as in 'biology') mean?",
    correctAnswer: "The study of",
    correctReveal:
      "The suffix -ology means the study of: biology is the study of life and geology the study of the Earth.",
    distractors: [
      {
        text: "The fear of",
        misconception: "any -o- suffix names an emotion",
        whyChosen:
          "'-phobia' (fear of) is a famous suffix, the strongest trap.",
        reveal:
          "'The fear of' is -phobia (arachnophobia); -ology means the study of.",
      },
      {
        text: "The love of",
        misconception: "study and passion suffixes overlap",
        whyChosen:
          "'-philia' (love of) is another feeling suffix.",
        reveal:
          "'The love of' is -philia; -ology means the study of.",
      },
      {
        text: "The making of",
        misconception: "action suffixes are interchangeable",
        whyChosen:
          "'Making' is a plausible productive meaning.",
        reveal:
          "'The making of' is more like -genesis (creation); -ology means the study of.",
      },
    ],
    claims: [
      claim("suffix(-ology) = the study of", "reference:etymology"),
      claim("suffix(-phobia) = fear of; -philia = love of", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What does the prefix 'anti-' (as in 'antifreeze') mean?",
    correctAnswer: "Against",
    correctReveal:
      "The prefix anti- means against or opposing: an antibody fights invaders and antisocial means against society; its opposite is pro- (in favour of).",
    distractors: [
      {
        text: "With",
        misconception: "anti- signals togetherness",
        whyChosen:
          "'With' is a plausible cooperative meaning.",
        reveal:
          "'With' is co- or sym-/syn- (cooperate, sympathy); anti- means against.",
      },
      {
        text: "Around",
        misconception: "anti- describes position",
        whyChosen:
          "'Around' is a common positional prefix meaning.",
        reveal:
          "'Around' is circum- or peri- (circumference, perimeter); anti- means against.",
      },
      {
        text: "Above",
        misconception: "any prefix could mean above",
        whyChosen:
          "'Above' is a familiar positional meaning.",
        reveal:
          "'Above' is super- or supra- (superscript); anti- means against.",
      },
    ],
    claims: [
      claim("prefix(anti-) = against / opposing", "reference:etymology"),
      claim("prefix(pro-) = for; circum- = around; super- = above", "reference:etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What does the suffix '-phobia' (as in 'arachnophobia') mean?",
    correctAnswer: "Fear of",
    correctReveal:
      "The suffix -phobia means fear of: arachnophobia is fear of spiders and claustrophobia fear of enclosed spaces; its opposite is -philia (love of).",
    distractors: [
      {
        text: "Love of",
        misconception: "the emotion suffixes are the same",
        whyChosen:
          "'-philia' (love of) is the direct opposite, the strongest trap.",
        reveal:
          "'Love of' is -philia; -phobia means fear of.",
      },
      {
        text: "Study of",
        misconception: "any Greek suffix means study",
        whyChosen:
          "'-ology' (study of) is a very common suffix.",
        reveal:
          "'Study of' is -ology; -phobia means fear of.",
      },
      {
        text: "Absence of",
        misconception: "negative feelings mean absence",
        whyChosen:
          "Fear and absence can feel related.",
        reveal:
          "'Absence of' is a- or an- (asymptomatic); -phobia specifically means fear of.",
      },
    ],
    claims: [
      claim("suffix(-phobia) = fear of", "reference:etymology"),
      claim("suffix(-philia) = love of; -ology = study of", "reference:etymology"),
    ],
  },
  {
    difficulty: "hard",
    question:
      "What does the prefix 'a-' or 'an-' (as in 'atypical' or 'anonymous') mean?",
    correctAnswer: "Without or not",
    correctReveal:
      "The prefix a-/an- means without or not: atypical is not typical, anonymous is without a name, and asymmetry is a lack of symmetry.",
    distractors: [
      {
        text: "Toward",
        misconception: "a- signals direction",
        whyChosen:
          "'Toward' is a plausible directional meaning (as in 'ad-').",
        reveal:
          "'Toward' is ad- (advance, adhere); a-/an- means without or not.",
      },
      {
        text: "Between",
        misconception: "any short prefix marks position",
        whyChosen:
          "'Between' is a common positional meaning.",
        reveal:
          "'Between' is inter- (international, interval); a-/an- means without.",
      },
      {
        text: "Beyond",
        misconception: "a- reaches past a limit",
        whyChosen:
          "'Beyond' is a plausible extending meaning.",
        reveal:
          "'Beyond' is ultra- or trans- (ultraviolet, transatlantic); a-/an- means without or not.",
      },
    ],
    claims: [
      claim("prefix(a-/an-) = without / not", "reference:etymology"),
      claim("prefix(ad-) = toward; inter- = between; trans- = beyond", "reference:etymology"),
    ],
  },
];

export const learnLanguageAffixesLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:language:lang.affixes:v1",
  skillNode: "lang.affixes",
  category: "language_affixes",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Etymological reference (open sources)",
  sourceLicense: "CC-BY-SA / public-domain reference",
  rungs: RUNGS,
});

export const learnLanguageAffixesLadderV1Questions =
  learnLanguageAffixesLadderV1.questions;
export const learnLanguageAffixesLadderV1ByChecksum =
  learnLanguageAffixesLadderV1.byChecksum;
export const learnLanguageAffixesLadderV1Metadata =
  learnLanguageAffixesLadderV1.metadata;
export const validateLearnLanguageAffixesLadderV1 =
  learnLanguageAffixesLadderV1.validate;

export default learnLanguageAffixesLadderV1Questions;
