// Learn teaching ladder — Biology: cells & genetics.
//
// The teach: a cell is a tiny factory — the nucleus holds the plans and each
// organelle runs one part of the line. Distractors are other organelles or
// molecules with a different job, so a wrong pick teaches what that part does.
// Facts only (cell-biology reference / Wikidata).

import {
  buildLearnLadderModule,
  makeClaimFactory,
  type LadderRawRung,
} from "./learnLadderKit";

const BATCH_ID = "learn_biology_cells_ladder_v1";
const RETRIEVED_AT = "2026-07-01";
const claim = makeClaimFactory(RETRIEVED_AT);

const RUNGS: LadderRawRung[] = [
  {
    difficulty: "easy",
    question: "Which part of the cell is called the 'powerhouse of the cell'?",
    correctAnswer: "The mitochondria",
    correctReveal:
      "Mitochondria are the powerhouse: they release energy from food as ATP through respiration; the nucleus, by contrast, stores the cell's instructions.",
    distractors: [
      {
        text: "The nucleus",
        misconception: "the control centre is also the power source",
        whyChosen:
          "The nucleus is the most famous organelle, an easy default.",
        reveal:
          "The nucleus is the control centre that stores DNA — energy is produced by the mitochondria.",
      },
      {
        text: "The ribosome",
        misconception: "a busy organelle must make the energy",
        whyChosen:
          "Ribosomes are active workers, a plausible guess.",
        reveal:
          "Ribosomes build proteins; they use energy but do not generate it.",
      },
      {
        text: "The vacuole",
        misconception: "any large organelle powers the cell",
        whyChosen:
          "The vacuole is a big, obvious structure in plant cells.",
        reveal:
          "The vacuole mainly stores water and substances — the mitochondria make the energy.",
      },
    ],
    claims: [
      claim("function(mitochondria) = ATP energy via respiration", "reference:cell-biology"),
      claim("function(nucleus) = stores DNA", "reference:cell-biology"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which part of the cell contains most of its genetic material (DNA)?",
    correctAnswer: "The nucleus",
    correctReveal:
      "The nucleus holds the cell's chromosomes — its DNA blueprint; mitochondria carry a tiny bit of their own DNA, but the main store is the nucleus.",
    distractors: [
      {
        text: "The cytoplasm",
        misconception: "the DNA floats loose in the cell fluid",
        whyChosen:
          "The cytoplasm fills the cell, so DNA seems to sit there.",
        reveal:
          "The cytoplasm is the jelly-like fluid around the organelles; in complex cells the DNA is packed inside the nucleus, not loose in it.",
      },
      {
        text: "The cell membrane",
        misconception: "the outer boundary stores the genes",
        whyChosen:
          "The membrane surrounds everything, a plausible container.",
        reveal:
          "The cell membrane is the outer barrier that controls what enters and leaves — it does not store DNA.",
      },
      {
        text: "The mitochondria",
        misconception: "the energy organelle holds all the DNA",
        whyChosen:
          "Mitochondria do carry a little DNA, a subtle trap.",
        reveal:
          "Mitochondria have a small amount of their own DNA, but the bulk of the cell's genetic material is in the nucleus.",
      },
    ],
    claims: [
      claim("location(main cell DNA) = nucleus", "reference:cell-biology"),
      claim("function(cell membrane) = controls entry/exit", "reference:cell-biology"),
    ],
  },
  {
    difficulty: "easy",
    question: "Which molecule carries the genetic code in living organisms?",
    correctAnswer: "DNA",
    correctReveal:
      "DNA stores the genetic code as a double helix; RNA is a related molecule that helps read that code and build proteins.",
    distractors: [
      {
        text: "RNA",
        misconception: "RNA is the permanent store of the genes",
        whyChosen:
          "RNA is DNA's close relative and helper, the strongest trap.",
        reveal:
          "RNA carries copies of the code and helps make proteins, but the master genetic code is stored in DNA.",
      },
      {
        text: "ATP",
        misconception: "the energy molecule holds the genes",
        whyChosen:
          "ATP is a famous cellular molecule.",
        reveal:
          "ATP is the cell's energy currency, not a carrier of genetic information.",
      },
      {
        text: "Glucose",
        misconception: "a key biological molecule must carry the code",
        whyChosen:
          "Glucose is central to biology, a plausible pick.",
        reveal:
          "Glucose is a sugar used for energy — it stores no genetic information.",
      },
    ],
    claims: [
      claim("genetic_code_molecule = DNA", "reference:cell-biology"),
      claim("role(RNA) = read code, help build proteins", "reference:cell-biology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Which structure is found in plant cells but NOT in animal cells?",
    correctAnswer: "The cell wall",
    correctReveal:
      "Plant cells have a rigid cell wall (and chloroplasts) outside the membrane; animal cells have only the flexible cell membrane.",
    distractors: [
      {
        text: "The nucleus",
        misconception: "plant-only structures include the nucleus",
        whyChosen:
          "The nucleus is a headline organelle, a tempting 'special' answer.",
        reveal:
          "Both plant and animal cells have a nucleus — the cell wall is the plant-only structure here.",
      },
      {
        text: "The mitochondria",
        misconception: "energy organelles are plant-specific",
        whyChosen:
          "Mitochondria feel important enough to be special.",
        reveal:
          "Both plant and animal cells contain mitochondria; the cell wall is unique to plants.",
      },
      {
        text: "The cell membrane",
        misconception: "only plants have an outer boundary",
        whyChosen:
          "The membrane sounds like the plant's protective layer.",
        reveal:
          "Every cell has a cell membrane; only plant cells add a rigid cell wall around it.",
      },
    ],
    claims: [
      claim("plant_only_structure = cell wall (and chloroplasts)", "reference:cell-biology"),
      claim("shared(plant, animal cells) = nucleus, mitochondria, membrane", "reference:cell-biology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "In a plant cell, where does photosynthesis take place?",
    correctAnswer: "The chloroplast",
    correctReveal:
      "Chloroplasts capture sunlight and turn it into sugar through photosynthesis; their green pigment, chlorophyll, is what makes plants green.",
    distractors: [
      {
        text: "The mitochondria",
        misconception: "the energy organelle also does photosynthesis",
        whyChosen:
          "Mitochondria handle energy, so they seem to fit — the strongest trap.",
        reveal:
          "Mitochondria do respiration (releasing energy from sugar); photosynthesis (making sugar) happens in chloroplasts.",
      },
      {
        text: "The nucleus",
        misconception: "the control centre runs photosynthesis",
        whyChosen:
          "The nucleus directs the cell, a plausible location.",
        reveal:
          "The nucleus stores DNA and directs the cell but does not carry out photosynthesis.",
      },
      {
        text: "The ribosome",
        misconception: "a manufacturing organelle makes sugar",
        whyChosen:
          "Ribosomes are the cell's makers, a plausible confusion.",
        reveal:
          "Ribosomes build proteins, not sugars; photosynthesis occurs in chloroplasts.",
      },
    ],
    claims: [
      claim("location(photosynthesis) = chloroplast", "reference:cell-biology"),
      claim("function(mitochondria) = respiration", "reference:cell-biology"),
    ],
  },
  {
    difficulty: "intermediate",
    question: "Bacteria are what type of cell?",
    correctAnswer: "Prokaryotic",
    correctReveal:
      "Bacteria are prokaryotic — their DNA floats freely with no membrane-bound nucleus; plants, animals, and fungi are eukaryotic, with a true nucleus.",
    distractors: [
      {
        text: "Eukaryotic",
        misconception: "all cells have a nucleus",
        whyChosen:
          "Eukaryotic is the other cell type, the direct opposite trap.",
        reveal:
          "Eukaryotic cells (plants, animals, fungi) have a nucleus; bacteria are prokaryotic and lack one.",
      },
      {
        text: "Multicellular",
        misconception: "cell type describes how many cells there are",
        whyChosen:
          "'Multicellular' sounds like a classification of cells.",
        reveal:
          "Multicellular describes organisms made of many cells; bacteria are single prokaryotic cells.",
      },
      {
        text: "Plant",
        misconception: "any tiny living thing is plant-like",
        whyChosen:
          "Bacteria are sometimes lumped with microscopic plants.",
        reveal:
          "Bacteria are their own domain of prokaryotes, not plants (which are eukaryotic).",
      },
    ],
    claims: [
      claim("cell_type(bacteria) = prokaryotic (no nucleus)", "reference:cell-biology"),
      claim("cell_type(plants, animals, fungi) = eukaryotic", "reference:cell-biology"),
    ],
  },
  {
    difficulty: "hard",
    question: "Ribosomes are responsible for making which type of molecule?",
    correctAnswer: "Proteins",
    correctReveal:
      "Ribosomes read messenger RNA and assemble amino acids into proteins — a process called translation; copying DNA happens separately, in the nucleus.",
    distractors: [
      {
        text: "Lipids",
        misconception: "ribosomes build the cell's fats",
        whyChosen:
          "Lipids are another class of biological molecule, a plausible product.",
        reveal:
          "Lipids (fats) are mostly made by the smooth endoplasmic reticulum, not ribosomes.",
      },
      {
        text: "DNA",
        misconception: "the code-reading organelle also copies DNA",
        whyChosen:
          "Ribosomes work with genetic information, so DNA seems close.",
        reveal:
          "DNA is copied (replicated) in the nucleus; ribosomes use a copy of it (mRNA) to build proteins.",
      },
      {
        text: "Sugars",
        misconception: "a busy organelle makes the cell's fuel",
        whyChosen:
          "Sugars are central to the cell, a plausible output.",
        reveal:
          "Sugars come from photosynthesis or digestion; ribosomes specialize in proteins.",
      },
    ],
    claims: [
      claim("product(ribosome) = proteins (translation)", "reference:cell-biology"),
      claim("location(DNA replication) = nucleus", "reference:cell-biology"),
    ],
  },
];

export const learnBiologyCellsLadderV1 = buildLearnLadderModule({
  batchId: BATCH_ID,
  workUnitId: "learn:knowledge:biology:bio.cells:v1",
  skillNode: "bio.cells",
  category: "biology_cells",
  retrievedAt: RETRIEVED_AT,
  authorModel: "anthropic/claude-opus-4-8",
  verifierModel: "anthropic/claude-opus-4-8",
  sourceName: "Cell-biology reference; Wikidata",
  sourceLicense: "CC0-1.0",
  rungs: RUNGS,
});

export const learnBiologyCellsLadderV1Questions =
  learnBiologyCellsLadderV1.questions;
export const learnBiologyCellsLadderV1ByChecksum =
  learnBiologyCellsLadderV1.byChecksum;
export const learnBiologyCellsLadderV1Metadata =
  learnBiologyCellsLadderV1.metadata;
export const validateLearnBiologyCellsLadderV1 =
  learnBiologyCellsLadderV1.validate;

export default learnBiologyCellsLadderV1Questions;
