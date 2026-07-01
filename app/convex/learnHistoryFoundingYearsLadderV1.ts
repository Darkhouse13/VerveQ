// Learn teaching ladder — History: founding & independence years.
//
// The teach: institutions and states have birthdays. Tie each founding year to
// its founding act and the era around it, and separate a founding from the later
// milestones it is often confused with (a treaty, a constitution, a republic).
// Every distractor year is a real, related anchor. Facts only; prose authored.

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_history_founding_years_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "In what year were the United Nations founded?",
    correctAnswer: "1945",
    correctReveal:
      "The UN Charter took effect on 24 October 1945 — now UN Day — replacing the defunct League of Nations after World War II.",
    distractors: [
      {
        text: "1919",
        misconception: "the UN and its failed predecessor share a birth year",
        whyChosen:
          "1919 is when the UN's predecessor was born, the classic swap.",
        reveal:
          "1919 is when the Paris Peace Conference created the League of Nations — the body the UN later replaced.",
      },
      {
        text: "1948",
        misconception: "any post-war UN milestone is its founding",
        whyChosen:
          "1948 is a landmark UN document year, close enough to blur with its founding.",
        reveal:
          "1948 is the Universal Declaration of Human Rights, adopted by the UN three years after it formed.",
      },
      {
        text: "1949",
        misconception: "all post-war alliances began together",
        whyChosen:
          "1949 is a major post-war treaty year, a plausible near-miss.",
        reveal:
          "1949 is the founding of NATO, a separate military alliance, not the UN.",
      },
    ],
    claims: [
      claim("inception(United Nations) = 1945-10-24", "wikidata:United Nations"),
      claim("inception(League of Nations) = 1920-01-10", "wikidata:League of Nations"),
    ],
  },
  {
    difficulty: "easy",
    question:
      "In what year was the United States Declaration of Independence adopted?",
    correctAnswer: "1776",
    correctReveal:
      "The Declaration was adopted on 4 July 1776 — Independence Day — though Britain only recognized independence years later.",
    distractors: [
      {
        text: "1783",
        misconception: "declaring independence and winning it are one date",
        whyChosen:
          "1783 is when independence was actually secured, a tempting substitute.",
        reveal:
          "1783 is the Treaty of Paris, in which Britain recognized US independence — the war's end, not the declaration.",
      },
      {
        text: "1787",
        misconception: "the Declaration and the Constitution are the same founding",
        whyChosen:
          "1787 is the other US founding document year, easily merged with 1776.",
        reveal:
          "1787 is when the US Constitution was written — a framework of government drafted eleven years after independence was declared.",
      },
      {
        text: "1789",
        misconception: "independence and the new government began at once",
        whyChosen:
          "1789 is when the republic actually started running, a plausible slip.",
        reveal:
          "1789 is when the Constitution took effect and Washington became the first president — the government's start, not the declaration.",
      },
    ],
    claims: [
      claim(
        "inception(United States Declaration of Independence) = 1776-07-04",
        "wikidata:United States Declaration of Independence",
      ),
      claim("point_in_time(Treaty of Paris) = 1783-09-03", "wikidata:Treaty of Paris (1783)"),
    ],
  },
  {
    difficulty: "easy",
    question: "In what year did the League of Nations come into being?",
    correctAnswer: "1920",
    correctReveal:
      "The League of Nations formally began on 10 January 1920, created by the Paris peace settlement to prevent another world war.",
    distractors: [
      {
        text: "1919",
        misconception: "signing the treaty and starting the League are one date",
        whyChosen:
          "1919 is when the treaty that mandated the League was signed, one year early.",
        reveal:
          "1919 is when the Treaty of Versailles was signed; the League it authorized only came into effect in January 1920.",
      },
      {
        text: "1945",
        misconception: "the League and the UN are interchangeable",
        whyChosen:
          "1945 is the League's successor's founding year, a common confusion.",
        reveal:
          "1945 is when the United Nations replaced the League after the Second World War.",
      },
      {
        text: "1914",
        misconception: "the war and the peace body share a year",
        whyChosen:
          "1914 is the war that prompted the League, a plausible cause-as-date trap.",
        reveal:
          "1914 is when World War I began — the catastrophe the League was later built to prevent.",
      },
    ],
    claims: [
      claim("inception(League of Nations) = 1920-01-10", "wikidata:League of Nations"),
      claim("point_in_time(Treaty of Versailles) = 1919-06-28", "wikidata:Treaty of Versailles"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "In what year did India gain independence from British rule?",
    correctAnswer: "1947",
    correctReveal:
      "India became independent on 15 August 1947 and adopted its constitution to become a republic on 26 January 1950.",
    distractors: [
      {
        text: "1950",
        misconception: "independence and becoming a republic are the same date",
        whyChosen:
          "1950 is a closely following constitutional milestone, easy to merge with independence.",
        reveal:
          "1950 is when India's constitution took effect (Republic Day) — three years after independence.",
      },
      {
        text: "1945",
        misconception: "the end of the war freed the colonies at once",
        whyChosen:
          "1945 ended the war that weakened empires, so it feels like a liberation year.",
        reveal:
          "1945 is the end of World War II; India's independence followed two years later, in 1947.",
      },
      {
        text: "1858",
        misconception: "the start of Crown rule is the date of freedom",
        whyChosen:
          "1858 is a pivotal date in British India, luring learners who reach for any famous year.",
        reveal:
          "1858 is when the British Crown took direct control of India from the East India Company — the start of the Raj, not its end.",
      },
    ],
    claims: [
      claim("inception(Dominion of India / independence) = 1947-08-15", "wikidata:Indian independence"),
      claim("inception(Republic of India constitution) = 1950-01-26", "wikidata:Constitution of India"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "In roughly what year was the Roman Republic founded?",
    correctAnswer: "509 BC",
    correctReveal:
      "Rome expelled its last king around 509 BCE and became a republic; its legendary founding was 753 BCE, and the Republic later gave way to Augustus's empire in 27 BCE.",
    distractors: [
      {
        text: "753 BC",
        misconception: "founding the city and founding the Republic are one event",
        whyChosen:
          "753 BC is Rome's legendary founding date, the most-cited Roman year.",
        reveal:
          "753 BCE is the traditional founding of the city of Rome under the kings — the Republic came over two centuries later.",
      },
      {
        text: "476 AD",
        misconception: "any pivotal Roman date marks the Republic",
        whyChosen:
          "476 AD is Rome's most famous ending, a plausible grab for a Roman date.",
        reveal:
          "476 CE is the fall of the Western Roman Empire — Rome's end, not the Republic's beginning.",
      },
      {
        text: "800 AD",
        misconception: "every 'Roman' title shares an origin",
        whyChosen:
          "800 AD revived a Roman imperial title, tempting learners who see 'Roman'.",
        reveal:
          "800 CE is when Charlemagne was crowned emperor, reviving a Roman title long after the ancient Republic.",
      },
    ],
    claims: [
      claim("inception(Roman Republic) = c. 509 BCE", "wikidata:Roman Republic"),
      claim("inception(city of Rome, traditional) = 753 BCE", "wikidata:Founding of Rome"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "In what year was the United States Constitution signed?",
    correctAnswer: "1787",
    correctReveal:
      "The Constitution was signed on 17 September 1787 at the Philadelphia Convention; it took effect in 1789 and the Bill of Rights was added in 1791.",
    distractors: [
      {
        text: "1776",
        misconception: "the Declaration and the Constitution are one founding",
        whyChosen:
          "1776 is the other US founding year, the most common swap with the Constitution.",
        reveal:
          "1776 is the Declaration of Independence — the break from Britain, written eleven years before the Constitution.",
      },
      {
        text: "1789",
        misconception: "signing and taking effect are the same date",
        whyChosen:
          "1789 is when the Constitution went into force, a close near-miss.",
        reveal:
          "1789 is when the Constitution took effect and the first government convened — two years after it was signed.",
      },
      {
        text: "1791",
        misconception: "the Constitution and its amendments share a date",
        whyChosen:
          "1791 is when the founding amendments were ratified, easy to fold in.",
        reveal:
          "1791 is when the Bill of Rights — the first ten amendments — was ratified, after the Constitution itself.",
      },
    ],
    claims: [
      claim(
        "inception(United States Constitution, signed) = 1787-09-17",
        "wikidata:Constitution of the United States",
      ),
      claim("inception(United States Bill of Rights) = 1791-12-15", "wikidata:United States Bill of Rights"),
    ],
  },
  {
    difficulty: "hard",
    question: "In what year was the People's Republic of China established?",
    correctAnswer: "1949",
    correctReveal:
      "Mao Zedong proclaimed the People's Republic of China on 1 October 1949, after the earlier Republic of China (1912) and the founding of the Communist Party (1921).",
    distractors: [
      {
        text: "1912",
        misconception: "the Republic and the People's Republic are the same state",
        whyChosen:
          "1912 is the founding of the earlier Chinese republic, a direct predecessor trap.",
        reveal:
          "1912 is when the Republic of China was founded as the Qing dynasty fell — a different state, 37 years before the PRC.",
      },
      {
        text: "1921",
        misconception: "founding the party and founding the state are one date",
        whyChosen:
          "1921 is the party's origin, easily merged with the state it later created.",
        reveal:
          "1921 is when the Chinese Communist Party was founded — the party formed decades before it declared the PRC.",
      },
      {
        text: "1911",
        misconception: "the revolution and the new state share a year",
        whyChosen:
          "1911 is the revolution that ended imperial China, a plausible one-year miss.",
        reveal:
          "1911 is the Xinhai Revolution that toppled the empire; the republic was proclaimed on 1 January 1912.",
      },
    ],
    claims: [
      claim(
        "inception(People's Republic of China) = 1949-10-01",
        "wikidata:People's Republic of China",
      ),
      claim("inception(Republic of China) = 1912-01-01", "wikidata:Republic of China (1912-1949)"),
    ],
  },
];

export const learnHistoryFoundingYearsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:history:hist.founding.years:v1",
  skillNode: "hist.founding.years",
  category: "history_founding_years",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Wikidata; public-domain historical reference",
  sourceLicense: "CC0-1.0",
  rungs: RUNGS,
});

export const learnHistoryFoundingYearsLadderV1Questions =
  learnHistoryFoundingYearsLadderV1.questions;
export const learnHistoryFoundingYearsLadderV1ByChecksum =
  learnHistoryFoundingYearsLadderV1.byChecksum;
export const learnHistoryFoundingYearsLadderV1Metadata =
  learnHistoryFoundingYearsLadderV1.metadata;
export const validateLearnHistoryFoundingYearsLadderV1 =
  learnHistoryFoundingYearsLadderV1.validate;

export default learnHistoryFoundingYearsLadderV1Questions;
