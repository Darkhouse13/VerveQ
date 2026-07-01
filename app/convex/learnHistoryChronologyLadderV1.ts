// Learn teaching ladder — History: chronology (which came first).
//
// The teach: ordering beats memorizing. Placing events relative to each other is
// how a timeline actually sticks. Each rung lists four real events; the answer is
// the earliest, and every distractor reveal gives that event's date and confirms
// it came later — so the whole ordering is taught, not just the winner. The stems
// vary so no two rungs read alike. Facts only; prose authored.

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_history_chronology_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "Which of these inventions is the oldest?",
    correctAnswer: "The printing press",
    correctReveal:
      "Gutenberg's printing press dates to around 1440 — centuries before the telephone, powered flight, or the Web.",
    distractors: [
      {
        text: "The telephone",
        misconception: "electrical inventions are all roughly contemporary",
        whyChosen:
          "The telephone feels old, so learners may rank it before the press.",
        reveal:
          "The telephone was patented in 1876 — over four centuries after the printing press.",
      },
      {
        text: "Powered flight",
        misconception: "20th-century breakthroughs predate print",
        whyChosen:
          "Powered flight is a foundational modern invention, tempting as 'first'.",
        reveal:
          "Powered flight arrived with the Wright brothers in 1903, far later than the press.",
      },
      {
        text: "The World Wide Web",
        misconception: "the newest invention could be mistaken as oldest",
        whyChosen:
          "It anchors the recent end of the timeline and completes the ramp.",
        reveal:
          "The World Wide Web was invented in 1989 — the most recent of these four.",
      },
    ],
    claims: [
      claim("inception(movable-type printing press) = c. 1440", "wikidata:printing press"),
      claim("inception(telephone) = 1876", "wikidata:telephone"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which of these structures was built first?",
    correctAnswer: "The Great Pyramid of Giza",
    correctReveal:
      "The Great Pyramid was completed around 2560 BCE, thousands of years before any of the other structures listed.",
    distractors: [
      {
        text: "The Colosseum",
        misconception: "all ancient monuments are roughly the same age",
        whyChosen:
          "The Colosseum is ancient too, so it competes for 'oldest'.",
        reveal:
          "The Colosseum was completed around 80 CE — ancient, but over 2,600 years after the Great Pyramid.",
      },
      {
        text: "The Eiffel Tower",
        misconception: "an iconic landmark reads as timeless",
        whyChosen:
          "Its fame can pull it earlier than it belongs.",
        reveal:
          "The Eiffel Tower was finished in 1889 for the Paris World's Fair — a modern structure.",
      },
      {
        text: "The Sydney Opera House",
        misconception: "recognizability implies age",
        whyChosen:
          "It anchors the recent end of the timeline.",
        reveal:
          "The Sydney Opera House opened in 1973, the newest of these four.",
      },
    ],
    claims: [
      claim("inception(Great Pyramid of Giza) = c. 2560 BCE", "wikidata:Great Pyramid of Giza"),
      claim("inception(Colosseum) = c. 80 CE", "wikidata:Colosseum"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which of these wars began first?",
    correctAnswer: "World War I",
    correctReveal:
      "World War I began in 1914, ahead of World War II (1939), the Korean War (1950), and the Gulf War (1990).",
    distractors: [
      {
        text: "World War II",
        misconception: "the two world wars are hard to order",
        whyChosen:
          "Its number and fame make it a frequent (wrong) 'first'.",
        reveal:
          "World War II began in 1939, a quarter-century after World War I.",
      },
      {
        text: "The Korean War",
        misconception: "mid-century conflicts blur together",
        whyChosen:
          "It is a major post-war conflict, plausible if dates are hazy.",
        reveal:
          "The Korean War began in 1950, after both world wars.",
      },
      {
        text: "The Gulf War",
        misconception: "a well-known recent war could seem early",
        whyChosen:
          "It anchors the recent end of the set.",
        reveal:
          "The Gulf War began in 1990 — the most recent of these four.",
      },
    ],
    claims: [
      claim("start_time(World War I) = 1914-07-28", "wikidata:World War I"),
      claim("start_time(World War II) = 1939-09-01", "wikidata:World War II"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which of these revolutions began first?",
    correctAnswer: "The American Revolution",
    correctReveal:
      "The American Revolution's war began in 1775 (independence declared 1776), before the French (1789), Haitian (1791), and Mexican independence struggles.",
    distractors: [
      {
        text: "The French Revolution",
        misconception: "the two great 18th-century revolutions are simultaneous",
        whyChosen:
          "They are constantly paired, so the French one is the top swap.",
        reveal:
          "The French Revolution began in 1789, over a decade after the American Revolution.",
      },
      {
        text: "The Haitian Revolution",
        misconception: "Atlantic revolutions all started together",
        whyChosen:
          "It followed closely and shared Enlightenment roots, a tight near-miss.",
        reveal:
          "The Haitian Revolution began in 1791, inspired in part by the earlier American and French upheavals.",
      },
      {
        text: "The Mexican War of Independence",
        misconception: "all independence movements are one wave",
        whyChosen:
          "It anchors the later end of the revolutionary era.",
        reveal:
          "The Mexican War of Independence began in 1810, decades after the American Revolution.",
      },
    ],
    claims: [
      claim("start_time(American Revolutionary War) = 1775-04-19", "wikidata:American Revolutionary War"),
      claim("start_time(French Revolution) = 1789-07-14", "wikidata:French Revolution"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which of these communication and transport inventions came first?",
    correctAnswer: "The telephone",
    correctReveal:
      "The telephone (1876) predates the practical light bulb (1879), radio (1895), and the airplane (1903).",
    distractors: [
      {
        text: "The practical light bulb",
        misconception: "Edison's inventions all come first",
        whyChosen:
          "Edison's fame makes the light bulb a tempting earliest.",
        reveal:
          "Edison's practical incandescent light bulb dates to 1879, three years after the telephone.",
      },
      {
        text: "Radio",
        misconception: "wireless preceded wired communication",
        whyChosen:
          "Radio feels foundational, so learners may place it before the telephone.",
        reveal:
          "Marconi's radio transmissions came in the mid-1890s, after the wired telephone.",
      },
      {
        text: "The airplane",
        misconception: "transport breakthroughs led the era",
        whyChosen:
          "It anchors the later end of this invention cluster.",
        reveal:
          "The Wright brothers' airplane flew in 1903, the last of these four.",
      },
    ],
    claims: [
      claim("inception(telephone) = 1876", "wikidata:telephone"),
      claim("inception(incandescent light bulb, practical) = 1879", "wikidata:incandescent light bulb"),
    ],
  },
  {
    difficulty: "hard",
    question: "Which of these events of the 15th and 16th centuries came first?",
    correctAnswer: "The fall of Constantinople",
    correctReveal:
      "Constantinople fell in 1453, before Columbus reached the Americas (1492), Luther's 95 Theses (1517), and Magellan's completed circumnavigation (1522).",
    distractors: [
      {
        text: "Columbus reaching the Americas",
        misconception: "the Age of Discovery opens the era",
        whyChosen:
          "1492 is the most-cited date of the period, a strong false 'first'.",
        reveal:
          "Columbus's landfall was in 1492, 39 years after Constantinople fell.",
      },
      {
        text: "Luther's 95 Theses",
        misconception: "the Reformation set the era in motion",
        whyChosen:
          "It is a defining early-modern event, plausible as earliest.",
        reveal:
          "Luther posted the 95 Theses in 1517, well into the 16th century.",
      },
      {
        text: "Magellan's first circumnavigation",
        misconception: "the great voyages all cluster at the start",
        whyChosen:
          "It anchors the later end of this tight cluster.",
        reveal:
          "Magellan's expedition completed the first circumnavigation in 1522 — the last of these four.",
      },
    ],
    claims: [
      claim("point_in_time(fall of Constantinople) = 1453-05-29", "wikidata:Fall of Constantinople"),
      claim("point_in_time(Columbus first-voyage landfall) = 1492-10-12", "wikidata:Voyages of Christopher Columbus"),
    ],
  },
  {
    difficulty: "hard",
    question: "Which of these early-20th-century events came first?",
    correctAnswer: "The Russian Revolution",
    correctReveal:
      "The Russian Revolution of 1917 came before the WWI armistice (1918), the Treaty of Versailles (1919), and the founding of the Soviet Union (1922).",
    distractors: [
      {
        text: "The end of World War I",
        misconception: "the revolution followed the war's end",
        whyChosen:
          "The two are entangled, so their order is easy to reverse.",
        reveal:
          "World War I ended with the armistice of 11 November 1918 — a year after the Russian Revolution.",
      },
      {
        text: "The Treaty of Versailles",
        misconception: "the peace settlement predates the upheaval",
        whyChosen:
          "It is a defining post-war event, plausibly ranked early.",
        reveal:
          "The Treaty of Versailles was signed in 1919, two years after the Russian Revolution.",
      },
      {
        text: "The founding of the Soviet Union",
        misconception: "the revolution and the USSR are the same date",
        whyChosen:
          "The USSR grew out of the revolution, so learners merge them.",
        reveal:
          "The Soviet Union was formally founded in 1922, five years after the 1917 revolution.",
      },
    ],
    claims: [
      claim("point_in_time(October Revolution) = 1917-11-07", "wikidata:October Revolution"),
      claim("inception(Soviet Union) = 1922-12-30", "wikidata:Soviet Union"),
    ],
  },
];

export const learnHistoryChronologyLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:history:hist.chronology:v1",
  skillNode: "hist.chronology",
  category: "history_chronology",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Wikidata; public-domain historical reference",
  sourceLicense: "CC0-1.0",
  rungs: RUNGS,
});

export const learnHistoryChronologyLadderV1Questions =
  learnHistoryChronologyLadderV1.questions;
export const learnHistoryChronologyLadderV1ByChecksum =
  learnHistoryChronologyLadderV1.byChecksum;
export const learnHistoryChronologyLadderV1Metadata =
  learnHistoryChronologyLadderV1.metadata;
export const validateLearnHistoryChronologyLadderV1 =
  learnHistoryChronologyLadderV1.validate;

export default learnHistoryChronologyLadderV1Questions;
