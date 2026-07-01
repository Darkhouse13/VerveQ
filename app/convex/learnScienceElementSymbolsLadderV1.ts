// Learn teaching ladder — Science: chemical element symbols.
//
// A bare "symbol of X = Y" drill is pure recall, so this ladder is built entirely
// from the symbols that are NOT the English initials — Fe, Na, K, Au, Pb, Hg, W —
// where the symbol comes from a Latin (or German) name. That origin is the teach,
// not a tautology, and it generalizes: once you know the pattern, every one of
// these stops being arbitrary. Distractors are real symbols of other elements, so
// a wrong pick teaches a second element. Facts only (IUPAC / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_science_element_symbols_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "What is the chemical symbol for iron?",
    correctAnswer: "Fe",
    correctReveal:
      "Fe comes from the Latin name for iron, ferrum — which is why the symbol looks nothing like the English word.",
    distractors: [
      {
        text: "Ir",
        misconception: "the symbol is the first letters of the English name",
        whyChosen:
          "'Ir' is the naive English guess for iron, and it is a real symbol — of another element.",
        reveal:
          "Ir is the symbol for iridium, a dense platinum-group metal — not iron.",
      },
      {
        text: "In",
        misconception: "any two letters from the name will do",
        whyChosen:
          "'In' also looks like it could be pulled from 'iron'.",
        reveal:
          "In is the symbol for indium, a soft metal used in touchscreens.",
      },
      {
        text: "Fm",
        misconception: "an F-symbol must be iron",
        whyChosen:
          "It starts with F like ferrum, a subtle near-miss.",
        reveal:
          "Fm is fermium, a synthetic element named after Enrico Fermi.",
      },
    ],
    claims: [
      claim("chemical_symbol(iron) = Fe", "iupac:periodic-table"),
      claim("symbol_origin(Fe) = Latin 'ferrum'", "reference:element-etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the chemical symbol for sodium?",
    correctAnswer: "Na",
    correctReveal:
      "Na comes from the Latin natrium; the same root gives us 'natron', the mineral, and explains the otherwise-mysterious symbol.",
    distractors: [
      {
        text: "S",
        misconception: "the symbol starts with the English name's first letter",
        whyChosen:
          "'S' is the naive first-letter guess for sodium, and is a real element symbol.",
        reveal:
          "S is the symbol for sulfur, not sodium.",
      },
      {
        text: "Sn",
        misconception: "a two-letter S-symbol must be sodium",
        whyChosen:
          "It looks like a plausible abbreviation of 'sodium'.",
        reveal:
          "Sn is tin, from the Latin stannum — another Latin-derived symbol.",
      },
      {
        text: "Sc",
        misconception: "any S-C-like symbol fits",
        whyChosen:
          "It is close in shape to a naive guess.",
        reveal:
          "Sc is scandium, a rare-earth metal.",
      },
    ],
    claims: [
      claim("chemical_symbol(sodium) = Na", "iupac:periodic-table"),
      claim("symbol_origin(Na) = Latin 'natrium'", "reference:element-etymology"),
    ],
  },
  {
    difficulty: "easy",
    question: "What is the chemical symbol for potassium?",
    correctAnswer: "K",
    correctReveal:
      "K comes from the Latin kalium (from Arabic al-qalyah, 'plant ashes') — the source of the word 'alkali'.",
    distractors: [
      {
        text: "P",
        misconception: "the symbol is the English initial",
        whyChosen:
          "'P' is the obvious first-letter guess for potassium, and is a real symbol.",
        reveal:
          "P is phosphorus, not potassium.",
      },
      {
        text: "Po",
        misconception: "a P-symbol with a vowel must be potassium",
        whyChosen:
          "It looks like a shortened 'potassium'.",
        reveal:
          "Po is polonium, the radioactive element named after Poland.",
      },
      {
        text: "Pt",
        misconception: "any P-symbol could be potassium",
        whyChosen:
          "It is another P-starting symbol, a plausible distractor.",
        reveal:
          "Pt is platinum, a precious metal.",
      },
    ],
    claims: [
      claim("chemical_symbol(potassium) = K", "iupac:periodic-table"),
      claim("symbol_origin(K) = Latin 'kalium'", "reference:element-etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the chemical symbol for gold?",
    correctAnswer: "Au",
    correctReveal:
      "Au comes from the Latin aurum, 'shining dawn' — the same reason silver's symbol (Ag, argentum) also looks unrelated to its English name.",
    distractors: [
      {
        text: "Ag",
        misconception: "the two classic precious metals share a symbol pattern",
        whyChosen:
          "Silver is gold's partner metal and also has a Latin symbol, a strong trap.",
        reveal:
          "Ag is silver, from the Latin argentum — a parallel Latin-origin symbol, but a different metal.",
      },
      {
        text: "Ga",
        misconception: "a G-symbol must be gold",
        whyChosen:
          "'Ga' looks like it could abbreviate 'gold'.",
        reveal:
          "Ga is gallium, a metal that melts in your hand.",
      },
      {
        text: "Gd",
        misconception: "any G-symbol fits gold",
        whyChosen:
          "It is another G-starting symbol, a plausible near-miss.",
        reveal:
          "Gd is gadolinium, a rare-earth element.",
      },
    ],
    claims: [
      claim("chemical_symbol(gold) = Au", "iupac:periodic-table"),
      claim("symbol_origin(Au) = Latin 'aurum'", "reference:element-etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the chemical symbol for lead?",
    correctAnswer: "Pb",
    correctReveal:
      "Pb comes from the Latin plumbum — the same root as 'plumber' and 'plumbing', because Roman pipes were made of lead.",
    distractors: [
      {
        text: "Pd",
        misconception: "any P-symbol could be lead",
        whyChosen:
          "It shares the P with plumbum, a subtle near-miss.",
        reveal:
          "Pd is palladium, a platinum-group metal used in catalytic converters.",
      },
      {
        text: "Pu",
        misconception: "a heavy-metal P-symbol must be lead",
        whyChosen:
          "Lead is heavy and toxic, so a heavy-element symbol tempts.",
        reveal:
          "Pu is plutonium, a synthetic radioactive element.",
      },
      {
        text: "Le",
        misconception: "the symbol is the English name's first letters",
        whyChosen:
          "'Le' is the naive English guess for lead.",
        reveal:
          "Le is not a chemical symbol at all — lead is Pb, from plumbum.",
      },
    ],
    claims: [
      claim("chemical_symbol(lead) = Pb", "iupac:periodic-table"),
      claim("symbol_origin(Pb) = Latin 'plumbum'", "reference:element-etymology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "What is the chemical symbol for mercury?",
    correctAnswer: "Hg",
    correctReveal:
      "Hg comes from the Latinized Greek hydrargyrum, 'water-silver', describing the liquid metal's silvery, flowing look.",
    distractors: [
      {
        text: "Mg",
        misconception: "the symbol starts with the English name's first letter",
        whyChosen:
          "'Mg' is the naive guess for mercury, and is a real symbol.",
        reveal:
          "Mg is magnesium, a light metal that burns with a bright white flame.",
      },
      {
        text: "Mn",
        misconception: "an M-symbol must be mercury",
        whyChosen:
          "Another M-starting symbol, a plausible confusion.",
        reveal:
          "Mn is manganese, used to harden steel.",
      },
      {
        text: "Hf",
        misconception: "an H-symbol matches hydrargyrum",
        whyChosen:
          "It starts with H like the Latin root, a subtle trap.",
        reveal:
          "Hf is hafnium, a metal used in nuclear control rods.",
      },
    ],
    claims: [
      claim("chemical_symbol(mercury) = Hg", "iupac:periodic-table"),
      claim("symbol_origin(Hg) = Greek/Latin 'hydrargyrum'", "reference:element-etymology"),
    ],
  },
  {
    difficulty: "hard",
    question: "What is the chemical symbol for tungsten?",
    correctAnswer: "W",
    correctReveal:
      "W comes from wolfram, tungsten's German/Swedish name; 'tungsten' itself is Swedish for 'heavy stone', so neither English word gives the symbol.",
    distractors: [
      {
        text: "Ti",
        misconception: "any T-symbol must be tungsten",
        whyChosen:
          "'Ti' is a naive T-based guess for tungsten.",
        reveal:
          "Ti is titanium, a strong, light metal.",
      },
      {
        text: "Ta",
        misconception: "a hard-metal T-symbol fits tungsten",
        whyChosen:
          "Tantalum sits near tungsten and is another T-symbol, a close trap.",
        reveal:
          "Ta is tantalum, used in electronics capacitors.",
      },
      {
        text: "Tu",
        misconception: "the symbol is the English name's first letters",
        whyChosen:
          "'Tu' is the naive first-letters guess for tungsten.",
        reveal:
          "Tu is not a chemical symbol — tungsten's symbol is W, from wolfram.",
      },
    ],
    claims: [
      claim("chemical_symbol(tungsten) = W", "iupac:periodic-table"),
      claim("symbol_origin(W) = German 'wolfram'", "reference:element-etymology"),
    ],
  },
];

export const learnScienceElementSymbolsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:science:sci.elements.symbols:v1",
  skillNode: "sci.elements.symbols",
  category: "science_element_symbols",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "IUPAC periodic table; Wikidata; element etymology reference",
  sourceLicense: "CC0-1.0; standards-body fact-only",
  rungs: RUNGS,
});

export const learnScienceElementSymbolsLadderV1Questions =
  learnScienceElementSymbolsLadderV1.questions;
export const learnScienceElementSymbolsLadderV1ByChecksum =
  learnScienceElementSymbolsLadderV1.byChecksum;
export const learnScienceElementSymbolsLadderV1Metadata =
  learnScienceElementSymbolsLadderV1.metadata;
export const validateLearnScienceElementSymbolsLadderV1 =
  learnScienceElementSymbolsLadderV1.validate;

export default learnScienceElementSymbolsLadderV1Questions;
