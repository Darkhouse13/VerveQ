// Learn teaching ladder — History: anchoring major events to their year.
//
// The teach here is that a year sticks when it is anchored to the exact turning
// day and the events around it, not memorized as a bare number. Every distractor
// year is itself a real, nearby historical anchor, so a wrong pick teaches a
// second date. Facts only (Wikidata / public-domain reference); prose authored.

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_history_event_dates_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question:
      "In what year did the French Revolution begin with the storming of the Bastille?",
    correctAnswer: "1789",
    correctReveal:
      "The Bastille was stormed on 14 July 1789 — now France's national day, Bastille Day — the moment that opened the Revolution.",
    distractors: [
      {
        text: "1776",
        misconception: "any 18th-century revolution shares one date",
        whyChosen:
          "1776 is the other famous revolution year, so it lures learners who blur the American and French revolutions.",
        reveal:
          "1776 is the American Declaration of Independence, thirteen years before the Bastille fell.",
      },
      {
        text: "1799",
        misconception: "the Revolution's start and end collapse together",
        whyChosen:
          "1799 is a real Revolution date, so it traps learners who don't separate its opening from its close.",
        reveal:
          "1799 is when Napoleon's coup of 18 Brumaire ended the Revolution — its finish, not its start.",
      },
      {
        text: "1804",
        misconception: "the Revolution and the Empire are the same event",
        whyChosen:
          "1804 belongs to the same Napoleonic arc, making it a plausible near-miss.",
        reveal:
          "1804 is when Napoleon crowned himself Emperor, ending the republic the Revolution had created.",
      },
    ],
    claims: [
      claim(
        "point_in_time(Storming of the Bastille) = 1789-07-14",
        "wikidata:Storming of the Bastille",
      ),
      claim(
        "public_holiday(France) = Bastille Day on 14 July",
        "wikidata:Bastille Day",
      ),
    ],
  },
  {
    difficulty: "easy",
    question: "In what year did Apollo 11 land the first humans on the Moon?",
    correctAnswer: "1969",
    correctReveal:
      "Apollo 11 touched down on 20 July 1969 and Neil Armstrong stepped out, fulfilling Kennedy's end-of-decade pledge.",
    distractors: [
      {
        text: "1961",
        misconception: "the first spaceflight and the first Moon landing are one event",
        whyChosen:
          "1961 is the dawn of human spaceflight, an easy confusion with the Moon landing itself.",
        reveal:
          "1961 is when Yuri Gagarin became the first human in space and Kennedy set the Moon goal — eight years before the landing.",
      },
      {
        text: "1957",
        misconception: "the Space Race began with a crewed landing",
        whyChosen:
          "1957 is the true opening of the Space Race, so it feels early-but-related.",
        reveal:
          "1957 is Sputnik 1, the first artificial satellite — the start of the Space Race, not its Moon climax.",
      },
      {
        text: "1972",
        misconception: "the last Moon mission was the first",
        whyChosen:
          "1972 is a genuine Apollo Moon-landing year, tempting learners who don't track which flight was first.",
        reveal:
          "1972 is Apollo 17, the last crewed Moon landing — the end of the program, not its first landing.",
      },
    ],
    claims: [
      claim("point_in_time(Apollo 11 Moon landing) = 1969-07-20", "wikidata:Apollo 11"),
      claim(
        "first_human_spaceflight(Vostok 1) = 1961-04-12",
        "wikidata:Vostok 1",
      ),
    ],
  },
  {
    difficulty: "easy",
    question: "In what year did World War II end in Europe on VE Day?",
    correctAnswer: "1945",
    correctReveal:
      "Germany's unconditional surrender took effect on 8 May 1945 — Victory in Europe Day; Japan surrendered that September.",
    distractors: [
      {
        text: "1939",
        misconception: "a war's start year is its end year",
        whyChosen:
          "1939 is when the war began, the most common swap for its end.",
        reveal:
          "1939 is when Germany invaded Poland and the war started — six years before it ended.",
      },
      {
        text: "1918",
        misconception: "the two world wars share an armistice",
        whyChosen:
          "1918 is the other great-war end, a classic mix-up between the World Wars.",
        reveal:
          "1918 is the WWI armistice on 11 November — the end of the First World War, not the Second.",
      },
      {
        text: "1944",
        misconception: "the decisive campaign year is the final year",
        whyChosen:
          "1944 hosts D-Day, so learners treat the turning point as the finish.",
        reveal:
          "1944 is D-Day, the Normandy landings — a decisive step, but the war ran on into 1945.",
      },
    ],
    claims: [
      claim("point_in_time(Victory in Europe Day) = 1945-05-08", "wikidata:Victory in Europe Day"),
      claim("start_time(World War II) = 1939-09-01", "wikidata:World War II"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "In what year did the Berlin Wall fall?",
    correctAnswer: "1989",
    correctReveal:
      "On the night of 9 November 1989 East Germany opened the crossings and crowds tore the Wall down — a year before Germany formally reunified.",
    distractors: [
      {
        text: "1961",
        misconception: "the Wall's construction and its fall are one date",
        whyChosen:
          "1961 is when the Wall went up, the mirror-image trap of when it came down.",
        reveal:
          "1961 is when East Germany built the Wall, sealing off West Berlin — it stood for 28 years.",
      },
      {
        text: "1990",
        misconception: "the Wall's fall and German reunification are the same day",
        whyChosen:
          "1990 is the closely following reunification, easy to merge with the fall.",
        reveal:
          "1990 is German reunification on 3 October — the political merger that came a year after the Wall opened.",
      },
      {
        text: "1991",
        misconception: "every end-of-Cold-War milestone shares a year",
        whyChosen:
          "1991 is the Soviet collapse, part of the same era-ending cluster.",
        reveal:
          "1991 is the dissolution of the Soviet Union — the Cold War's final act, two years after the Wall fell.",
      },
    ],
    claims: [
      claim("point_in_time(fall of the Berlin Wall) = 1989-11-09", "wikidata:Berlin Wall"),
      claim("point_in_time(German reunification) = 1990-10-03", "wikidata:German reunification"),
    ],
  },
  {
    difficulty: "intermediate",
    question:
      "In what year did King John seal Magna Carta at Runnymede?",
    correctAnswer: "1215",
    correctReveal:
      "Magna Carta was sealed in June 1215 at Runnymede, forcing King John to accept that the crown was bound by law.",
    distractors: [
      {
        text: "1066",
        misconception: "all medieval English landmarks share the Conquest year",
        whyChosen:
          "1066 is the most memorized English date, a default guess for anything medieval.",
        reveal:
          "1066 is the Norman Conquest and the Battle of Hastings — 149 years before Magna Carta.",
      },
      {
        text: "1086",
        misconception: "any early royal document is Domesday",
        whyChosen:
          "1086 is another famous royal record, so it competes as a document date.",
        reveal:
          "1086 is the Domesday Book, William the Conqueror's survey of England — a census, not a charter of rights.",
      },
      {
        text: "1265",
        misconception: "Magna Carta and the first Parliament are the same event",
        whyChosen:
          "1265 is a nearby constitutional milestone, easy to fuse with Magna Carta.",
        reveal:
          "1265 is Simon de Montfort's Parliament, an early representative assembly — fifty years after Magna Carta.",
      },
    ],
    claims: [
      claim("inception(Magna Carta) = 1215-06", "wikidata:Magna Carta"),
      claim("point_in_time(Norman Conquest / Battle of Hastings) = 1066", "wikidata:Battle of Hastings"),
    ],
  },
  {
    difficulty: "intermediate",
    question:
      "In what year did Columbus's first voyage reach the Americas?",
    correctAnswer: "1492",
    correctReveal:
      "Columbus made landfall in the Bahamas on 12 October 1492, opening sustained European contact with the Americas.",
    distractors: [
      {
        text: "1453",
        misconception: "the Age of Discovery began with the crossing itself",
        whyChosen:
          "1453 is a pivotal 15th-century date that helped drive the search for new sea routes.",
        reveal:
          "1453 is the Ottoman capture of Constantinople, which spurred the search for new routes — a cause, four decades earlier.",
      },
      {
        text: "1498",
        misconception: "all the great voyages happened in one year",
        whyChosen:
          "1498 is another landmark voyage, close enough to blur with Columbus.",
        reveal:
          "1498 is when Vasco da Gama reached India by sea around Africa — a different explorer and route.",
      },
      {
        text: "1521",
        misconception: "discovery and conquest are the same moment",
        whyChosen:
          "1521 belongs to the same era of Spanish expansion in the Americas.",
        reveal:
          "1521 is the fall of Tenochtitlan to Cortes — conquest that came a generation after Columbus's landfall.",
      },
    ],
    claims: [
      claim("point_in_time(Columbus first-voyage landfall) = 1492-10-12", "wikidata:Voyages of Christopher Columbus"),
      claim("point_in_time(fall of Constantinople) = 1453-05-29", "wikidata:Fall of Constantinople"),
    ],
  },
  {
    difficulty: "hard",
    question:
      "In what year was Archduke Franz Ferdinand assassinated, triggering World War I?",
    correctAnswer: "1914",
    correctReveal:
      "Franz Ferdinand was shot in Sarajevo on 28 June 1914 by Gavrilo Princip; the July Crisis it set off pushed Europe into war within weeks.",
    distractors: [
      {
        text: "1918",
        misconception: "a war's spark and its finish share a year",
        whyChosen:
          "1918 is when the war it triggered ended, a tempting bookend swap.",
        reveal:
          "1918 is the WWI armistice — the war's end, four years after the assassination that began it.",
      },
      {
        text: "1912",
        misconception: "the Balkan tinderbox and the spark are one event",
        whyChosen:
          "1912 is a real prelude in the same region, so it feels immediately pre-war.",
        reveal:
          "1912 is the start of the Balkan Wars, which destabilized the region but preceded the assassination by two years.",
      },
      {
        text: "1905",
        misconception: "any early-1900s upheaval is the war's trigger",
        whyChosen:
          "1905 is a period of unrest that shaped the era, close enough to mislead.",
        reveal:
          "1905 is the first Russian Revolution — significant unrest, but a decade before Sarajevo.",
      },
    ],
    claims: [
      claim(
        "point_in_time(assassination of Archduke Franz Ferdinand) = 1914-06-28",
        "wikidata:Assassination of Archduke Franz Ferdinand",
      ),
      claim("end_time(World War I) = 1918-11-11", "wikidata:World War I"),
    ],
  },
];

export const learnHistoryEventDatesLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:history:hist.events.dates:v1",
  skillNode: "hist.events.dates",
  category: "history_event_dates",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Wikidata; public-domain historical reference",
  sourceLicense: "CC0-1.0",
  rungs: RUNGS,
});

export const learnHistoryEventDatesLadderV1Questions =
  learnHistoryEventDatesLadderV1.questions;
export const learnHistoryEventDatesLadderV1ByChecksum =
  learnHistoryEventDatesLadderV1.byChecksum;
export const learnHistoryEventDatesLadderV1Metadata =
  learnHistoryEventDatesLadderV1.metadata;
export const validateLearnHistoryEventDatesLadderV1 =
  learnHistoryEventDatesLadderV1.validate;

export default learnHistoryEventDatesLadderV1Questions;
