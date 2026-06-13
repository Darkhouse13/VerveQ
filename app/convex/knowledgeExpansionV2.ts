import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];

export type KnowledgeExpansionV2Shape =
  | "standard_recall"
  | "odd_one_out"
  | "negative_exception"
  | "numeric_estimation"
  | "superlative_comparison"
  | "connected_clue";

type SourceKey = keyof typeof knowledgeExpansionV2Provenance;

type RawShapeFact = {
  category: string;
  difficulty: Difficulty;
  shape: KnowledgeExpansionV2Shape;
  question: string;
  correctAnswer: string;
  distractors: [string, string, string];
  explanation: string;
  sourceKey: SourceKey;
};

export type KnowledgeExpansionV2ReviewRow = {
  ref: string;
  category: string;
  shape: KnowledgeExpansionV2Shape;
  difficulty: Difficulty;
  answer: string;
  question: string;
  sourceKey: SourceKey;
};

export const knowledgeExpansionV2Provenance = {
  science_structured:
    "Custom VerveQ-authored science prompts verified against Wikidata CC0 structured statements, NASA planetary fact sheets, NIST/CODATA chemistry references, and USGS/NOAA earth-science references.",
  places_structured:
    "Custom VerveQ-authored geography prompts verified against Wikidata CC0 structured place facts, CIA World Factbook profiles, Natural Earth-style public map facts, and UNESCO World Heritage records.",
  history_structured:
    "Custom VerveQ-authored history and inventions prompts verified against Wikidata CC0 structured event/person records, Library of Congress records, Nobel Prize records, and public museum/standards-office timelines.",
  language_culture_structured:
    "Custom VerveQ-authored language, arts, and culture prompts verified against Wikidata CC0 structured work/person records, ISO/Library of Congress language data, Project Gutenberg-style public-domain metadata, and open museum catalog facts.",
  no_open_trivia_corpus:
    "No OpenTDB or CC-BY-SA trivia corpus was ingested; rows are custom-authored from open structured/reference facts.",
} as const;

function q(
  category: string,
  difficulty: Difficulty,
  shape: KnowledgeExpansionV2Shape,
  question: string,
  correctAnswer: string,
  distractors: [string, string, string],
  explanation: string,
  sourceKey: SourceKey,
): RawShapeFact {
  return {
    category,
    difficulty,
    shape,
    question,
    correctAnswer,
    distractors,
    explanation,
    sourceKey,
  };
}

function rotateOptions(
  correctAnswer: string,
  distractors: [string, string, string],
  index: number,
) {
  const options = [correctAnswer, ...distractors];
  const targetIndex = index % 4;
  const [correct] = options.splice(0, 1);
  options.splice(targetIndex, 0, correct);
  return options;
}

function bucket(category: string, difficulty: Difficulty) {
  return `knowledge_${difficulty}_${category}`;
}

function checksum(index: number) {
  return `knowledge_expansion_v2_${String(index + 1).padStart(3, "0")}`;
}

function buildRows(facts: (RawShapeFact | null)[]) {
  const rows: KnowledgeQuestionSeed[] = [];
  const reviewRows: KnowledgeExpansionV2ReviewRow[] = [];

  facts.forEach((fact, index) => {
    if (fact === null) {
      return;
    }
    const ref = checksum(index);
    rows.push({
      sport: "knowledge",
      category: fact.category,
      question: fact.question,
      options: rotateOptions(fact.correctAnswer, fact.distractors, index),
      correctAnswer: fact.correctAnswer,
      explanation: fact.explanation,
      difficulty: fact.difficulty,
      bucket: bucket(fact.category, fact.difficulty),
      checksum: ref,
    });
    reviewRows.push({
      ref,
      category: fact.category,
      shape: fact.shape,
      difficulty: fact.difficulty,
      answer: fact.correctAnswer,
      question: fact.question,
      sourceKey: fact.sourceKey,
    });
  });

  return { rows, reviewRows };
}

// Checksums are positional (index + 1), so shipped rows must never be removed by
// deleting array entries: a `null` tombstone holds the slot (emitting no row) so
// every later row keeps its original checksum.
const RAW_SHAPE_FACTS: (RawShapeFact | null)[] = [
  q("chemistry", "easy", "standard_recall", "What element gives table salt its metallic half?", "Sodium", ["Potassium", "Lithium", "Calcium"], "Table salt is sodium chloride, so sodium is the metallic element in it.", "science_structured"),
  q("chemistry", "easy", "standard_recall", "Which element has the chemical symbol Fe?", "Iron", ["Copper", "Tin", "Silver"], "Fe comes from ferrum, the Latin name for iron.", "science_structured"),
  q("chemistry", "easy", "standard_recall", "What type of particle has a negative electric charge?", "Electron", ["Proton", "Neutron", "Alpha particle"], "Electrons carry negative charge; protons carry positive charge.", "science_structured"),
  q("chemistry", "easy", "standard_recall", "Which gas makes up most of Earth's atmosphere?", "Nitrogen", ["Oxygen", "Argon", "Carbon dioxide"], "Dry air is mostly nitrogen by volume.", "science_structured"),
  q("chemistry", "intermediate", "standard_recall", "Which scientist created the first widely used periodic table arrangement?", "Dmitri Mendeleev", ["Antoine Lavoisier", "Lothar Meyer", "Robert Boyle"], "Mendeleev arranged elements by periodic patterns and predicted missing elements.", "history_structured"),
  q("chemistry", "easy", "standard_recall", "What is the pH value of a neutral solution at 25 C?", "7", ["1", "5", "14"], "At 25 C, neutral water has pH 7.", "science_structured"),
  q("chemistry", "intermediate", "standard_recall", "Which bond involves atoms sharing pairs of electrons?", "Covalent bond", ["Ionic bond", "Metallic bond", "Hydrogen bond"], "Covalent bonds form when atoms share electron pairs.", "science_structured"),
  q("chemistry", "easy", "standard_recall", "What is the common kitchen name for sodium bicarbonate?", "Baking soda", ["Table salt", "Washing soda", "Bleach"], "Sodium bicarbonate is commonly sold as baking soda.", "science_structured"),
  q("chemistry", "easy", "standard_recall", "Which element is the main ingredient of diamond?", "Carbon", ["Silicon", "Boron", "Sulfur"], "Diamond is a crystalline form of carbon.", "science_structured"),
  q("chemistry", "easy", "odd_one_out", "Which of these is NOT a noble gas?", "Nitrogen", ["Helium", "Neon", "Argon"], "Helium, neon, and argon are noble gases; nitrogen is not.", "science_structured"),
  q("chemistry", "intermediate", "odd_one_out", "Which of these is NOT an alkali metal?", "Calcium", ["Lithium", "Sodium", "Potassium"], "Lithium, sodium, and potassium are alkali metals; calcium is an alkaline earth metal.", "science_structured"),
  q("chemistry", "easy", "odd_one_out", "Which of these is NOT a halogen?", "Oxygen", ["Fluorine", "Chlorine", "Bromine"], "Fluorine, chlorine, and bromine are halogens; oxygen is not.", "science_structured"),
  q("chemistry", "intermediate", "odd_one_out", "Which of these is NOT a greenhouse gas?", "Helium", ["Carbon dioxide", "Methane", "Nitrous oxide"], "Carbon dioxide, methane, and nitrous oxide are greenhouse gases; helium is not.", "science_structured"),
  q("chemistry", "easy", "odd_one_out", "Which of these is NOT a common state of matter in school chemistry?", "Momentum", ["Solid", "Liquid", "Gas"], "Solid, liquid, and gas are common states of matter; momentum is a physical quantity.", "science_structured"),
  q("chemistry", "intermediate", "odd_one_out", "Which of these is NOT a subatomic particle found in atoms?", "Photon", ["Proton", "Neutron", "Electron"], "Protons, neutrons, and electrons are atomic particles; photons are light quanta.", "science_structured"),
  q("chemistry", "hard", "negative_exception", "Which element is NOT named after a place?", "Carbon", ["Californium", "Polonium", "Europium"], "Californium, polonium, and europium are place-derived names; carbon is not.", "science_structured"),
  q("chemistry", "intermediate", "negative_exception", "Which substance is NOT a main product when vinegar reacts with baking soda?", "Oxygen", ["Carbon dioxide", "Water", "Sodium acetate"], "The reaction forms carbon dioxide, water, and sodium acetate, not oxygen.", "science_structured"),
  q("chemistry", "easy", "negative_exception", "Which compound is NOT an acid?", "Sodium hydroxide", ["Hydrochloric acid", "Acetic acid", "Sulfuric acid"], "Sodium hydroxide is a base; the others are acids.", "science_structured"),
  q("chemistry", "intermediate", "negative_exception", "Which of these is NOT a metal?", "Bromine", ["Mercury", "Gallium", "Sodium"], "Mercury, gallium, and sodium are metals; bromine is a nonmetal halogen.", "science_structured"),
  q("chemistry", "easy", "numeric_estimation", "Carbon's atomic number is what value?", "6", ["5", "7", "8"], "Atomic number 6 identifies carbon.", "science_structured"),
  q("chemistry", "easy", "numeric_estimation", "How many protons are in an oxygen atom?", "8", ["6", "7", "9"], "Oxygen has atomic number 8, so it has 8 protons.", "science_structured"),
  q("chemistry", "easy", "numeric_estimation", "On the Celsius scale, pure water boils at about what temperature at sea level?", "100", ["90", "110", "120"], "At standard pressure, pure water boils at about 100 C.", "science_structured"),
  q("chemistry", "hard", "numeric_estimation", "How many naturally occurring noble gases are in group 18 if oganesson is excluded?", "6", ["5", "7", "8"], "Helium through radon make six naturally occurring noble gases.", "science_structured"),
  q("chemistry", "easy", "superlative_comparison", "Which listed element has the lowest atomic number?", "Hydrogen", ["Helium", "Lithium", "Carbon"], "Hydrogen is element 1.", "science_structured"),
  q("chemistry", "intermediate", "superlative_comparison", "Which listed halogen has the highest atomic number?", "Iodine", ["Fluorine", "Chlorine", "Bromine"], "Iodine is below fluorine, chlorine, and bromine in the halogen group.", "science_structured"),
  q("chemistry", "hard", "superlative_comparison", "Which listed element has the greatest atomic mass?", "Uranium", ["Iron", "Lead", "Gold"], "Uranium has a greater standard atomic mass than iron, lead, or gold.", "science_structured"),
  q("chemistry", "easy", "superlative_comparison", "Which gas is most abundant in Earth's atmosphere?", "Nitrogen", ["Oxygen", "Argon", "Carbon dioxide"], "Nitrogen is the largest component of dry air.", "science_structured"),
  q("chemistry", "intermediate", "superlative_comparison", "Which listed substance is hardest on the Mohs scale?", "Diamond", ["Quartz", "Topaz", "Corundum"], "Diamond is rated 10 on the Mohs hardness scale.", "science_structured"),
  q("chemistry", "intermediate", "connected_clue", "A candle burns in oxygen and produces carbon dioxide plus water; what kind of reaction is this?", "Combustion", ["Fermentation", "Distillation", "Neutralization"], "Combustion reactions burn a fuel in oxygen and commonly produce carbon dioxide and water.", "science_structured"),
  q("chemistry", "easy", "connected_clue", "An atom has 11 protons and forms Na+ in table salt; which element is it?", "Sodium", ["Magnesium", "Neon", "Aluminum"], "Atomic number 11 and the symbol Na identify sodium.", "science_structured"),

  q("astronomy", "easy", "standard_recall", "Which planet is known as the Red Planet?", "The planet Mars", ["The planet Venus", "The planet Mercury", "The planet Jupiter"], "Iron-rich dust gives Mars its reddish color.", "science_structured"),
  q("astronomy", "easy", "standard_recall", "What is the closest star to Earth?", "The Sun", ["Proxima Centauri", "Sirius", "Vega"], "The Sun is the star at the center of our Solar System.", "science_structured"),
  null, // was knowledge_expansion_v2_033 — removed as exact duplicate of knowledge_v1_180
  q("astronomy", "easy", "standard_recall", "Which galaxy contains the Solar System?", "Milky Way", ["Andromeda", "Triangulum", "Sombrero Galaxy"], "The Sun is one of the stars in the Milky Way.", "science_structured"),
  q("astronomy", "easy", "standard_recall", "Which planet is famous for its broad, bright ring system?", "The planet Saturn", ["The planet Mars", "The planet Venus", "The planet Mercury"], "Saturn's ring system is the most visually prominent from Earth.", "science_structured"),
  q("astronomy", "easy", "standard_recall", "Which dwarf planet was once taught as the ninth planet?", "Pluto", ["Ceres", "Eris", "Haumea"], "Pluto was reclassified as a dwarf planet in 2006.", "science_structured"),
  q("astronomy", "easy", "standard_recall", "Which instrument made distant galaxies practical to observe in detail?", "Telescope", ["Microscope", "Barometer", "Thermometer"], "Telescopes collect light from distant objects.", "science_structured"),
  q("astronomy", "easy", "standard_recall", "What is Earth's natural satellite called?", "Moon", ["Phobos", "Titan", "Europa"], "The Moon is Earth's only natural satellite.", "science_structured"),
  q("astronomy", "easy", "standard_recall", "Who was the first person to walk on the Moon?", "Neil Armstrong", ["Yuri Gagarin", "Buzz Aldrin", "Michael Collins"], "Neil Armstrong stepped onto the lunar surface during Apollo 11.", "history_structured"),
  q("astronomy", "easy", "odd_one_out", "Which of these is NOT a terrestrial planet?", "The planet Jupiter", ["The planet Mercury", "The planet Venus", "The planet Mars"], "Mercury, Venus, and Mars are rocky terrestrial planets; Jupiter is a giant planet.", "science_structured"),
  q("astronomy", "intermediate", "odd_one_out", "Which of these is NOT one of Jupiter's Galilean moons?", "Titan", ["Io", "Europa", "Ganymede"], "Io, Europa, and Ganymede are Galilean moons; Titan orbits Saturn.", "science_structured"),
  q("astronomy", "easy", "odd_one_out", "Which of these is NOT an outer planet?", "Mercury", ["Jupiter", "Saturn", "Neptune"], "Jupiter, Saturn, and Neptune are outer planets; Mercury is an inner planet.", "science_structured"),
  q("astronomy", "hard", "odd_one_out", "Which Apollo mission listed here did NOT land astronauts on the Moon?", "Apollo 8", ["Apollo 11", "Apollo 12", "Apollo 14"], "Apollo 8 orbited the Moon; Apollo 11, 12, and 14 landed astronauts.", "history_structured"),
  q("astronomy", "intermediate", "odd_one_out", "Which of these is NOT a zodiac constellation?", "Orion", ["Aries", "Taurus", "Leo"], "Aries, Taurus, and Leo lie on the zodiac; Orion does not.", "science_structured"),
  q("astronomy", "hard", "odd_one_out", "Which of these was NOT among the first four asteroids discovered?", "Hygiea", ["Ceres", "Pallas", "Vesta"], "Ceres, Pallas, and Vesta were among the first four; Hygiea was discovered later.", "science_structured"),
  q("astronomy", "intermediate", "negative_exception", "Which world did Voyager 2 NOT fly by?", "Pluto", ["Jupiter", "Uranus", "Neptune"], "Voyager 2 flew by Jupiter, Uranus, and Neptune, but not Pluto.", "science_structured"),
  q("astronomy", "intermediate", "negative_exception", "Which body is NOT currently classified as a dwarf planet by the IAU?", "Titan", ["Pluto", "Eris", "Ceres"], "Titan is a moon of Saturn; Pluto, Eris, and Ceres are dwarf planets.", "science_structured"),
  q("astronomy", "easy", "negative_exception", "Which Apollo mission did NOT land people on the Moon?", "Apollo 13", ["Apollo 11", "Apollo 12", "Apollo 15"], "Apollo 13 returned safely after an in-flight emergency and did not land.", "history_structured"),
  q("astronomy", "intermediate", "negative_exception", "Which planet listed here does NOT have a known ring system?", "Mercury", ["Jupiter", "Saturn", "Uranus"], "Jupiter, Saturn, and Uranus all have rings; Mercury does not.", "science_structured"),
  q("astronomy", "easy", "numeric_estimation", "How many planets are officially recognized in the Solar System?", "8", ["7", "9", "10"], "The Solar System has eight recognized planets.", "science_structured"),
  q("astronomy", "intermediate", "numeric_estimation", "The Moon completes one orbit around Earth in about how many days?", "27", ["24", "30", "35"], "The Moon's sidereal orbital period is about 27.3 days.", "science_structured"),
  q("astronomy", "easy", "numeric_estimation", "Light from the Sun takes about how many minutes to reach Earth?", "8", ["4", "12", "20"], "Sunlight reaches Earth in roughly 8 minutes.", "science_structured"),
  q("astronomy", "easy", "numeric_estimation", "Jupiter has how many large Galilean moons?", "4", ["2", "3", "5"], "The Galilean moons are Io, Europa, Ganymede, and Callisto.", "science_structured"),
  q("astronomy", "intermediate", "superlative_comparison", "Which is the largest moon in the Solar System?", "Ganymede", ["Titan", "Callisto", "Earth's Moon"], "Ganymede, a moon of Jupiter, is the Solar System's largest moon.", "science_structured"),
  q("astronomy", "easy", "superlative_comparison", "Which planet is usually the brightest planet in Earth's night sky?", "The planet Venus", ["The planet Mars", "The planet Jupiter", "The planet Saturn"], "Venus is often the brightest planet seen from Earth.", "science_structured"),
  q("astronomy", "easy", "superlative_comparison", "Which recognized planet is the smallest?", "The planet Mercury", ["The planet Mars", "The planet Venus", "The planet Earth"], "Mercury is the smallest recognized planet.", "science_structured"),
  q("astronomy", "intermediate", "superlative_comparison", "Which planet has the longest orbital period?", "Neptune", ["Uranus", "Saturn", "Jupiter"], "Neptune takes about 165 Earth years to orbit the Sun.", "science_structured"),
  q("astronomy", "easy", "superlative_comparison", "Which planet has the hottest average surface temperature?", "The planet Venus", ["The planet Mercury", "The planet Mars", "The planet Earth"], "Venus's dense atmosphere produces extreme surface temperatures.", "science_structured"),
  q("astronomy", "hard", "connected_clue", "A planet is an ice giant, tilted about 98 degrees, and was visited by Voyager 2 in 1986. Which is it?", "Uranus", ["Neptune", "Saturn", "Jupiter"], "Uranus is the highly tilted ice giant Voyager 2 visited in 1986.", "science_structured"),
  q("astronomy", "easy", "connected_clue", "A 24-hour day, liquid surface water, and one large Moon point to which planet?", "The planet Earth", ["The planet Mars", "The planet Venus", "The planet Mercury"], "Earth has liquid surface water and one large natural satellite.", "science_structured"),

  q("biology", "easy", "standard_recall", "Which molecule carries genetic instructions in living things?", "DNA", ["ATP", "Glucose", "Insulin"], "DNA stores hereditary information in cells.", "science_structured"),
  q("biology", "easy", "standard_recall", "Which organelles are often called the powerhouses of the cell?", "Mitochondria", ["Ribosomes", "Lysosomes", "Vacuoles"], "Mitochondria release usable energy from food molecules.", "science_structured"),
  q("biology", "easy", "standard_recall", "Which green pigment helps plants capture light for photosynthesis?", "Chlorophyll", ["Hemoglobin", "Melanin", "Keratin"], "Chlorophyll absorbs light energy used in photosynthesis.", "science_structured"),
  q("biology", "easy", "standard_recall", "Which monk is known as the father of genetics?", "Gregor Mendel", ["Charles Darwin", "Louis Pasteur", "Carl Linnaeus"], "Mendel inferred inheritance patterns from pea-plant experiments.", "history_structured"),
  null, // was knowledge_expansion_v2_065 — removed as exact duplicate of knowledge_v1_034
  q("biology", "easy", "standard_recall", "Which blood cells carry most oxygen through the human body?", "Red blood cells", ["Platelets", "White blood cells", "Stem cells"], "Red blood cells contain hemoglobin, which binds oxygen.", "science_structured"),
  q("biology", "easy", "standard_recall", "Which gas do plants absorb from the air during photosynthesis?", "Carbon dioxide", ["Oxygen", "Helium", "Nitrogen"], "Photosynthesis uses carbon dioxide and water to make sugars.", "science_structured"),
  null, // was knowledge_expansion_v2_068 — removed as exact duplicate of knowledge_v1_112
  q("biology", "intermediate", "standard_recall", "Which taxonomic rank usually comes directly below kingdom?", "Phylum", ["Genus", "Species", "Family"], "In standard Linnaean ranks, phylum comes below kingdom.", "science_structured"),
  q("biology", "easy", "odd_one_out", "Which of these is NOT a mammal?", "Crocodile", ["Whale", "Bat", "Dolphin"], "Whales, bats, and dolphins are mammals; crocodiles are reptiles.", "science_structured"),
  q("biology", "easy", "odd_one_out", "Which of these is NOT a bird?", "Bat", ["Eagle", "Penguin", "Ostrich"], "Eagles, penguins, and ostriches are birds; bats are mammals.", "science_structured"),
  q("biology", "easy", "odd_one_out", "Which of these is NOT an insect?", "Spider", ["Ant", "Bee", "Butterfly"], "Ants, bees, and butterflies are insects; spiders are arachnids.", "science_structured"),
  q("biology", "easy", "odd_one_out", "Which of these is NOT a vertebrate?", "Earthworm", ["Salmon", "Frog", "Lizard"], "Salmon, frogs, and lizards have backbones; earthworms do not.", "science_structured"),
  q("biology", "easy", "odd_one_out", "Which of these is NOT a plant organ?", "Lung", ["Root", "Stem", "Leaf"], "Roots, stems, and leaves are plant organs; lungs are animal organs.", "science_structured"),
  q("biology", "easy", "odd_one_out", "Which of these is NOT an ABO blood type?", "Type C", ["Type A", "Type B", "Type AB"], "The ABO system includes A, B, AB, and O, but not Type C.", "science_structured"),
  q("biology", "hard", "negative_exception", "Which process does NOT occur in mature human red blood cells?", "Mitosis", ["Oxygen transport", "Carbon dioxide transport", "Hemoglobin binding"], "Mature human red blood cells lack nuclei and do not divide by mitosis.", "science_structured"),
  q("biology", "easy", "negative_exception", "Which base is NOT used in DNA?", "Uracil", ["Adenine", "Cytosine", "Guanine"], "Uracil is used in RNA; DNA uses adenine, cytosine, guanine, and thymine.", "science_structured"),
  q("biology", "intermediate", "negative_exception", "Which term is NOT one of the three domains of life?", "Protista", ["Bacteria", "Archaea", "Eukarya"], "The three domains are Bacteria, Archaea, and Eukarya.", "science_structured"),
  q("biology", "hard", "negative_exception", "Which cell structure is NOT surrounded by a double membrane?", "Ribosome", ["Nucleus", "Mitochondrion", "Chloroplast"], "Ribosomes are not membrane-bound; the others have double membranes.", "science_structured"),
  q("biology", "easy", "numeric_estimation", "Human adults usually have how many pairs of chromosomes?", "23", ["22", "24", "46"], "Humans usually have 23 pairs of chromosomes.", "science_structured"),
  q("biology", "easy", "numeric_estimation", "DNA uses how many standard bases?", "4", ["3", "5", "6"], "DNA uses adenine, cytosine, guanine, and thymine.", "science_structured"),
  q("biology", "easy", "numeric_estimation", "How many chambers does a human heart have?", "4", ["2", "3", "5"], "The human heart has two atria and two ventricles.", "science_structured"),
  q("biology", "easy", "numeric_estimation", "Adult insects have how many legs?", "6", ["4", "8", "10"], "Adult insects have three pairs of legs.", "science_structured"),
  q("biology", "easy", "superlative_comparison", "Which is the largest living species?", "Blue whale", ["African elephant", "Giraffe", "Whale shark"], "The blue whale is the largest known living species.", "science_structured"),
  q("biology", "easy", "superlative_comparison", "Which is the fastest land animal?", "Cheetah", ["Pronghorn", "Lion", "Horse"], "Cheetahs are widely recognized as the fastest land animals.", "science_structured"),
  q("biology", "intermediate", "superlative_comparison", "Which is the tallest living tree species?", "Coast redwood", ["Giant sequoia", "Douglas fir", "Sitka spruce"], "Coast redwoods include the tallest measured living trees.", "science_structured"),
  q("biology", "easy", "superlative_comparison", "Which is the largest human organ?", "Skin", ["Liver", "Brain", "Lung"], "Skin is the largest organ of the human body.", "science_structured"),
  q("biology", "intermediate", "superlative_comparison", "Which bird has the largest wingspan among living birds?", "Wandering albatross", ["Bald eagle", "Andean condor", "Mute swan"], "The wandering albatross has the largest wingspan of any living bird.", "science_structured"),
  q("biology", "easy", "connected_clue", "A pea-plant monk tracking traits through generations points to which scientist?", "Gregor Mendel", ["Charles Darwin", "Louis Pasteur", "Carl Linnaeus"], "Mendel's pea experiments became foundational to genetics.", "history_structured"),
  q("biology", "intermediate", "connected_clue", "A cell structure has its own DNA and releases energy from food; what is it?", "Mitochondrion", ["Ribosome", "Lysosome", "Golgi apparatus"], "Mitochondria contain their own DNA and help make ATP.", "science_structured"),

  q("earth_science", "easy", "standard_recall", "What is Earth's outermost solid layer called?", "Crust", ["Mantle", "Outer core", "Inner core"], "The crust is Earth's outermost solid layer.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "Which scale is commonly associated with earthquake magnitude?", "Richter scale", ["Beaufort scale", "Mohs scale", "Fujita scale"], "The Richter scale is historically associated with earthquake magnitude.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "What process breaks down rock at Earth's surface?", "Weathering", ["Subduction", "Condensation", "Photosynthesis"], "Weathering breaks rock into smaller pieces or dissolved material.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "What is molten rock below Earth's surface called?", "Magma", ["Lava", "Basalt", "Obsidian"], "Molten rock underground is magma; at the surface it is lava.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "Which atmospheric layer contains most weather?", "Troposphere", ["Stratosphere", "Mesosphere", "Thermosphere"], "Most clouds and weather occur in the troposphere.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "Which scale ranks minerals by scratch hardness?", "Mohs scale", ["Richter scale", "pH scale", "Saffir-Simpson scale"], "The Mohs scale compares mineral hardness.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "Which fossil fuel formed largely from ancient plant material?", "Coal", ["Natural gas", "Petroleum", "Propane"], "Coal forms mostly from ancient plant matter compressed over time.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "What is Earth's central region called?", "Core", ["Crust", "Lithosphere", "Hydrosphere"], "Earth's core lies at the planet's center.", "science_structured"),
  q("earth_science", "easy", "standard_recall", "Which instrument measures air pressure?", "Barometer", ["Anemometer", "Seismometer", "Hygrometer"], "Barometers measure atmospheric pressure.", "science_structured"),
  q("earth_science", "easy", "odd_one_out", "Which of these is NOT a type of rock?", "Glacier", ["Igneous", "Sedimentary", "Metamorphic"], "Igneous, sedimentary, and metamorphic are rock types; a glacier is ice.", "science_structured"),
  q("earth_science", "intermediate", "odd_one_out", "Which of these is NOT a plate-boundary type?", "Evaporative", ["Convergent", "Divergent", "Transform"], "Convergent, divergent, and transform are plate-boundary types.", "science_structured"),
  q("earth_science", "easy", "odd_one_out", "Which of these is NOT an atmospheric layer?", "Hydrosphere", ["Troposphere", "Stratosphere", "Mesosphere"], "The hydrosphere is Earth's water system, not an atmospheric layer.", "science_structured"),
  q("earth_science", "easy", "odd_one_out", "Pick the atmospheric gas that is not classified as a greenhouse gas.", "Argon", ["Carbon dioxide", "Methane", "Water vapor"], "Carbon dioxide, methane, and water vapor are greenhouse gases; argon is not.", "science_structured"),
  q("earth_science", "easy", "odd_one_out", "Which of these is NOT a basic cloud type?", "Basalt", ["Cirrus", "Stratus", "Cumulus"], "Cirrus, stratus, and cumulus are cloud types; basalt is a rock.", "science_structured"),
  q("earth_science", "hard", "odd_one_out", "Which of these is NOT a standard soil horizon label?", "Z horizon", ["O horizon", "A horizon", "B horizon"], "O, A, and B are standard soil horizons; Z is not.", "science_structured"),
  q("earth_science", "easy", "negative_exception", "Which process is NOT part of the water cycle?", "Photosynthesis", ["Evaporation", "Condensation", "Precipitation"], "Evaporation, condensation, and precipitation are water-cycle processes.", "science_structured"),
  q("earth_science", "intermediate", "negative_exception", "Which material is NOT technically a mineral?", "Obsidian", ["Quartz", "Feldspar", "Calcite"], "Obsidian is volcanic glass and is usually classed as a mineraloid.", "science_structured"),
  q("earth_science", "easy", "negative_exception", "Which of these is NOT a sedimentary rock?", "Granite", ["Limestone", "Shale", "Sandstone"], "Granite is igneous; limestone, shale, and sandstone are sedimentary.", "science_structured"),
  q("earth_science", "intermediate", "negative_exception", "Which phenomenon is NOT mainly driven by plate tectonics?", "Daily tides", ["Earthquakes", "Volcanoes", "Mountain building"], "Daily tides are mainly caused by gravitational forces, not plate tectonics.", "science_structured"),
  q("earth_science", "intermediate", "numeric_estimation", "Earth has about how many major tectonic plates?", "7", ["5", "10", "15"], "Introductory geology commonly groups Earth's surface into about seven major plates.", "science_structured"),
  q("earth_science", "intermediate", "numeric_estimation", "Standard sea-level air pressure is about how many hectopascals?", "1013", ["900", "1100", "1200"], "Standard atmospheric pressure is about 1013 hPa.", "science_structured"),
  q("earth_science", "hard", "numeric_estimation", "A one-step increase in Richter magnitude means about how many times more wave amplitude?", "10", ["2", "5", "100"], "Each whole Richter magnitude step is about ten times the measured amplitude.", "science_structured"),
  q("earth_science", "intermediate", "numeric_estimation", "Earth's mean radius is about how many kilometers?", "6371", ["4879", "69911", "1737"], "Earth's mean radius is about 6371 km.", "science_structured"),
  q("earth_science", "easy", "superlative_comparison", "Which is Earth's largest ocean?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Southern Ocean"], "The Pacific Ocean is the largest ocean by area.", "science_structured"),
  q("earth_science", "intermediate", "superlative_comparison", "Which is the deepest known ocean trench?", "The Mariana Trench", ["Tonga Trench", "Java Trench", "Puerto Rico Trench"], "The Mariana Trench contains the deepest known ocean point.", "science_structured"),
  q("earth_science", "easy", "superlative_comparison", "Which mountain is tallest above sea level?", "Mount Everest", ["K2", "Kangchenjunga", "Lhotse"], "Mount Everest has the highest summit above sea level.", "science_structured"),
  q("earth_science", "easy", "superlative_comparison", "Which is the largest hot desert?", "Sahara Desert", ["Arabian Desert", "Gobi Desert", "Kalahari Desert"], "The Sahara is the largest hot desert.", "science_structured"),
  q("earth_science", "easy", "superlative_comparison", "Which gas is most abundant in the atmosphere?", "Nitrogen", ["Oxygen", "Argon", "Carbon dioxide"], "Nitrogen makes up most of Earth's atmosphere.", "science_structured"),
  q("earth_science", "easy", "connected_clue", "A cloud is low, gray, and blanket-like; which basic cloud type is it?", "Stratus", ["Cirrus", "Cumulus", "Cumulonimbus"], "Stratus clouds often form low, layered blankets.", "science_structured"),
  q("earth_science", "easy", "connected_clue", "Waves arrive after an undersea megathrust quake; what hazard may follow?", "Tsunami", ["Drought", "Tornado", "Heat wave"], "Undersea earthquakes can displace water and generate tsunamis.", "science_structured"),

  null, // was knowledge_expansion_v2_121 — removed as exact duplicate of challenge_arena_capitals_v1_003
  q("geography", "easy", "standard_recall", "Which river flows through Egypt and into the Mediterranean Sea?", "Nile", ["Amazon", "Danube", "Mekong"], "The Nile flows north through Egypt to the Mediterranean.", "places_structured"),
  q("geography", "easy", "standard_recall", "Which country includes the island of Honshu?", "Japan", ["Indonesia", "Philippines", "New Zealand"], "Honshu is Japan's largest island.", "places_structured"),
  q("geography", "easy", "standard_recall", "Which continent contains the Andes mountain range?", "South America", ["Africa", "Europe", "Australia"], "The Andes run along western South America.", "places_structured"),
  q("geography", "easy", "standard_recall", "Which country is famously shaped like a boot?", "Italy", ["Greece", "Chile", "Norway"], "Italy's peninsula is often compared to a boot.", "places_structured"),
  q("geography", "easy", "standard_recall", "What is Japan's currency?", "Yen", ["Won", "Peso", "Rupee"], "The yen is Japan's official currency.", "places_structured"),
  q("geography", "intermediate", "standard_recall", "Which city sits on the Bosporus strait?", "Istanbul", ["Athens", "Cairo", "Lisbon"], "Istanbul spans the Bosporus between Europe and Asia.", "places_structured"),
  q("geography", "easy", "standard_recall", "Machu Picchu is in which country?", "Peru", ["Mexico", "Chile", "Colombia"], "Machu Picchu is an Inca site in Peru.", "places_structured"),
  q("geography", "easy", "standard_recall", "Which island nation lies just south of India?", "Sri Lanka", ["Maldives", "Madagascar", "Cyprus"], "Sri Lanka is an island country south of India.", "places_structured"),
  q("geography", "easy", "odd_one_out", "Which of these is NOT in Africa?", "Peru", ["Kenya", "Ghana", "Morocco"], "Kenya, Ghana, and Morocco are in Africa; Peru is in South America.", "places_structured"),
  q("geography", "easy", "odd_one_out", "Which of these is NOT a U.S. state?", "Ontario", ["Texas", "Oregon", "Florida"], "Texas, Oregon, and Florida are U.S. states; Ontario is a Canadian province.", "places_structured"),
  q("geography", "intermediate", "odd_one_out", "Which of these is NOT landlocked?", "Vietnam", ["Bolivia", "Mongolia", "Nepal"], "Bolivia, Mongolia, and Nepal are landlocked; Vietnam has a coastline.", "places_structured"),
  q("geography", "intermediate", "odd_one_out", "Which of these is NOT a Nordic country?", "Estonia", ["Norway", "Sweden", "Denmark"], "Norway, Sweden, and Denmark are Nordic countries; Estonia is Baltic.", "places_structured"),
  q("geography", "easy", "odd_one_out", "Which of these is NOT one of North America's Great Lakes?", "Great Salt Lake", ["Lake Superior", "Lake Michigan", "Lake Erie"], "Superior, Michigan, and Erie are Great Lakes; Great Salt Lake is in Utah.", "places_structured"),
  q("geography", "intermediate", "odd_one_out", "Which of these is NOT crossed by the equator?", "Egypt", ["Ecuador", "Kenya", "Indonesia"], "Ecuador, Kenya, and Indonesia are crossed by the equator; Egypt is not.", "places_structured"),
  q("geography", "easy", "negative_exception", "Which capital is NOT in Europe?", "Canberra", ["Madrid", "Prague", "Warsaw"], "Canberra is in Australia; Madrid, Prague, and Warsaw are in Europe.", "places_structured"),
  q("geography", "intermediate", "negative_exception", "Which country does NOT border Germany?", "Portugal", ["France", "Poland", "Denmark"], "France, Poland, and Denmark border Germany; Portugal does not.", "places_structured"),
  q("geography", "intermediate", "negative_exception", "Which sea is NOT part of the Mediterranean region?", "Baltic Sea", ["Adriatic Sea", "Aegean Sea", "Ionian Sea"], "The Adriatic, Aegean, and Ionian are Mediterranean seas; the Baltic is in northern Europe.", "places_structured"),
  q("geography", "easy", "negative_exception", "Which city is NOT a national capital?", "Sydney", ["Cairo", "Seoul", "Nairobi"], "Sydney is not Australia's capital; Cairo, Seoul, and Nairobi are national capitals.", "places_structured"),
  q("geography", "easy", "numeric_estimation", "How many countries border mainland Portugal?", "1", ["0", "2", "3"], "Mainland Portugal borders only Spain.", "places_structured"),
  q("geography", "easy", "numeric_estimation", "How many countries make up the United Kingdom?", "4", ["3", "5", "6"], "The United Kingdom consists of England, Scotland, Wales, and Northern Ireland.", "places_structured"),
  q("geography", "easy", "numeric_estimation", "How many U.S. states are there?", "50", ["48", "49", "52"], "The United States has 50 states.", "places_structured"),
  q("geography", "easy", "numeric_estimation", "How many continents are in the common seven-continent model?", "7", ["5", "6", "8"], "The common classroom model counts seven continents.", "places_structured"),
  q("geography", "easy", "superlative_comparison", "Which is the largest country by land area?", "Russia", ["Canada", "China", "United States"], "Russia is the world's largest country by area.", "places_structured"),
  q("geography", "easy", "superlative_comparison", "Which is the smallest country by area?", "Vatican City", ["Monaco", "Nauru", "San Marino"], "Vatican City is the smallest sovereign state by area.", "places_structured"),
  q("geography", "easy", "superlative_comparison", "Which is the largest island?", "Greenland", ["New Guinea", "Borneo", "Madagascar"], "Greenland is generally listed as the world's largest island.", "places_structured"),
  q("geography", "intermediate", "superlative_comparison", "Which waterfall has the greatest uninterrupted drop?", "Angel Falls", ["Niagara Falls", "Victoria Falls", "Iguazu Falls"], "Angel Falls in Venezuela is famous for the highest uninterrupted waterfall drop.", "places_structured"),
  q("geography", "intermediate", "superlative_comparison", "Which is the largest freshwater lake by surface area?", "Lake Superior", ["Lake Victoria", "Lake Huron", "Lake Baikal"], "Lake Superior is the largest freshwater lake by surface area.", "places_structured"),
  q("geography", "intermediate", "connected_clue", "A country spans Europe and Asia, and its largest city is Istanbul. Which country is it?", "Turkey", ["Greece", "Bulgaria", "Iran"], "Turkey straddles Europe and Asia, with Istanbul on the Bosporus.", "places_structured"),
  q("geography", "hard", "connected_clue", "An Andean city sits high above sea level and serves as Bolivia's seat of government. Which city is it?", "La Paz", ["Lima", "Quito", "Bogota"], "La Paz is Bolivia's administrative seat and sits high in the Andes.", "places_structured"),

  q("history", "easy", "standard_recall", "In which country was the Magna Carta sealed?", "England", ["France", "Spain", "Italy"], "King John sealed Magna Carta in England in 1215.", "history_structured"),
  null, // was knowledge_expansion_v2_152 — removed as exact duplicate of knowledge_v1_068
  q("history", "easy", "standard_recall", "The Great Wall is most closely associated with which country?", "China", ["India", "Japan", "Mongolia"], "The Great Wall is a landmark of China.", "history_structured"),
  null, // was knowledge_expansion_v2_154 — removed as exact duplicate of knowledge_v1_051
  q("history", "easy", "standard_recall", "The Black Death devastated Europe during which century?", "14th century", ["11th century", "16th century", "19th century"], "The Black Death peaked in Europe in the mid-14th century.", "history_structured"),
  q("history", "easy", "standard_recall", "In what year did the Berlin Wall fall?", "1989", ["1961", "1979", "1991"], "The Berlin Wall opened and began falling in November 1989.", "history_structured"),
  q("history", "easy", "standard_recall", "Who is strongly associated with movable-type printing in Europe?", "Johannes Gutenberg", ["Isaac Newton", "Benjamin Franklin", "Galileo Galilei"], "Gutenberg's press transformed European printing in the 15th century.", "history_structured"),
  q("history", "easy", "standard_recall", "Which ancient city was buried by Mount Vesuvius in 79 CE?", "Pompeii", ["Athens", "Carthage", "Troy"], "Pompeii was buried by Vesuvius ash in 79 CE.", "history_structured"),
  q("history", "easy", "standard_recall", "Which document declared the American colonies independent in 1776?", "U.S. independence declaration", ["Bill of Rights", "Articles of Confederation", "Magna Carta"], "The Declaration of Independence was adopted in 1776.", "history_structured"),
  q("history", "easy", "odd_one_out", "Which of these is NOT an ancient wonder of the world?", "Eiffel Tower", ["Great Pyramid of Giza", "Hanging Gardens of Babylon", "Colossus of Rhodes"], "The Eiffel Tower is modern; the other three are ancient wonders.", "history_structured"),
  q("history", "easy", "odd_one_out", "Which of these was NOT a Roman emperor?", "Pericles", ["Vespasian", "Nero", "Trajan"], "Vespasian, Nero, and Trajan were Roman emperors; Pericles was Athenian.", "history_structured"),
  q("history", "easy", "odd_one_out", "Which of these was NOT an Allied power in World War II?", "Spain", ["United States", "Soviet Union", "United Kingdom"], "Spain was neutral; the other three were major Allied powers.", "history_structured"),
  q("history", "easy", "odd_one_out", "Which of these was NOT one of the first four U.S. presidents?", "Benjamin Franklin", ["George Washington", "John Adams", "Thomas Jefferson"], "Franklin was never president; the other three were among the first four.", "history_structured"),
  q("history", "intermediate", "odd_one_out", "Which of these was NOT a Mesoamerican civilization?", "Vikings", ["Classic-era Maya", "Aztec", "Olmec"], "The Maya, Aztec, and Olmec were Mesoamerican; Vikings were Scandinavian.", "history_structured"),
  q("history", "easy", "odd_one_out", "Which of these was NOT an Egyptian pharaoh?", "Hammurabi", ["Tutankhamun", "Ramses II", "Hatshepsut"], "Hammurabi ruled Babylon; the other three were Egyptian pharaohs.", "history_structured"),
  q("history", "hard", "negative_exception", "Which country did NOT sign the 1957 Treaty of Rome that founded the EEC?", "United Kingdom", ["France", "Italy", "West Germany"], "France, Italy, and West Germany were among the six signatories; the UK was not.", "history_structured"),
  q("history", "intermediate", "negative_exception", "Which event did NOT occur in 1969?", "Fall of the Berlin Wall", ["Apollo 11 Moon landing", "Woodstock festival", "First ARPANET message"], "The Berlin Wall fell in 1989; the other events occurred in 1969.", "history_structured"),
  q("history", "intermediate", "negative_exception", "Which empire did NOT have Constantinople as a capital?", "Mongol Empire", ["Byzantine Empire", "Latin Empire", "Ottoman Empire"], "The Mongol Empire did not use Constantinople as a capital.", "history_structured"),
  q("history", "intermediate", "negative_exception", "Which colony was NOT one of the original 13 U.S. states?", "Vermont", ["Virginia", "Pennsylvania", "Georgia"], "Vermont joined the United States after the original 13 states.", "history_structured"),
  q("history", "easy", "numeric_estimation", "Magna Carta was sealed in what year?", "1215", ["1066", "1492", "1776"], "Magna Carta was sealed in 1215.", "history_structured"),
  q("history", "easy", "numeric_estimation", "Columbus's first voyage reached the Americas in which year?", "1492", ["1215", "1607", "1776"], "Columbus's first voyage reached the Caribbean in 1492.", "history_structured"),
  q("history", "easy", "numeric_estimation", "The Berlin Wall fell in which year?", "1989", ["1979", "1991", "2001"], "The Berlin Wall fell in 1989.", "history_structured"),
  q("history", "intermediate", "numeric_estimation", "The first modern Olympic Games were held in Athens in which year?", "1896", ["1888", "1900", "1924"], "The first modern Olympics were held in Athens in 1896.", "history_structured"),
  q("history", "intermediate", "superlative_comparison", "Which of these civilizations is earliest?", "Sumer", ["Roman Republic", "Aztec Empire", "Inca Empire"], "Sumer emerged far earlier than the Roman Republic, Aztec Empire, or Inca Empire.", "history_structured"),
  q("history", "easy", "superlative_comparison", "Who is the longest-reigning British monarch?", "Elizabeth II", ["Victoria", "George III", "Henry VIII"], "Elizabeth II reigned longer than any other British monarch.", "history_structured"),
  q("history", "intermediate", "superlative_comparison", "Which writing system is earliest among these?", "Cuneiform", ["Latin alphabet", "Cyrillic alphabet", "Hangul"], "Cuneiform is one of the earliest known writing systems.", "history_structured"),
  q("history", "intermediate", "superlative_comparison", "Which empire was largest by land area?", "British Empire", ["Roman Empire", "Mongol Empire", "Spanish Empire"], "The British Empire reached the greatest land area among these empires.", "history_structured"),
  q("history", "hard", "superlative_comparison", "Which university is oldest among these?", "University of Bologna", ["Harvard University", "University of Oxford", "University of Salamanca"], "The University of Bologna is traditionally dated to 1088.", "history_structured"),
  q("history", "intermediate", "connected_clue", "A 1799 stone with Greek, Demotic, and hieroglyphic text unlocked what script?", "Egyptian hieroglyphs", ["Linear B", "Cuneiform", "Phoenician"], "The Rosetta Stone helped scholars decipher Egyptian hieroglyphs.", "history_structured"),
  q("history", "easy", "connected_clue", "A 1066 battle after William's invasion points to which battle?", "Battle of Hastings", ["Battle of Agincourt", "Battle of Waterloo", "Battle of Tours"], "William defeated Harold at the Battle of Hastings in 1066.", "history_structured"),

  q("inventions", "easy", "standard_recall", "Who is most associated with inventing the telephone?", "Alexander Graham Bell", ["Thomas Edison", "Nikola Tesla", "Guglielmo Marconi"], "Bell received the famous early telephone patent in 1876.", "history_structured"),
  q("inventions", "easy", "standard_recall", "Who discovered penicillin in 1928?", "Alexander Fleming", ["Louis Pasteur", "Gertrude Elion", "Joseph Lister"], "Fleming observed Penicillium mold killing bacteria.", "history_structured"),
  null, // was knowledge_expansion_v2_183 — removed as exact duplicate of knowledge_v1_094
  q("inventions", "easy", "standard_recall", "Which inventor is strongly linked with the practical incandescent light bulb?", "Thomas Edison", ["Samuel Morse", "Eli Whitney", "James Watt"], "Edison developed and commercialized a practical incandescent lighting system.", "history_structured"),
  null, // was knowledge_expansion_v2_185 — removed as exact duplicate of knowledge_v1_126
  q("inventions", "intermediate", "standard_recall", "Which early electronic computer is often described as general-purpose and programmable?", "ENIAC", ["UNIVAC I", "Colossus", "Apple II"], "ENIAC is often cited as an early general-purpose electronic digital computer.", "history_structured"),
  q("inventions", "easy", "standard_recall", "Who created the raised-dot reading system called Braille?", "Louis Braille", ["Samuel Morse", "Johannes Gutenberg", "Alexander Fleming"], "Louis Braille developed the tactile reading system named for him.", "history_structured"),
  q("inventions", "easy", "standard_recall", "Which scientist gave pasteurization its name?", "Louis Pasteur", ["Robert Koch", "Gregor Mendel", "Antonie van Leeuwenhoek"], "Pasteurization is named after Louis Pasteur.", "history_structured"),
  q("inventions", "easy", "standard_recall", "Which device measures temperature?", "Thermometer", ["Barometer", "Compass", "Stethoscope"], "Thermometers measure temperature.", "science_structured"),
  q("inventions", "easy", "odd_one_out", "Which of these is NOT a communication invention?", "Seed drill", ["Telegraph", "Telephone", "Radio"], "The telegraph, telephone, and radio transmit information; the seed drill is agricultural.", "history_structured"),
  q("inventions", "easy", "odd_one_out", "Which of these is NOT a writing technology?", "Stethoscope", ["Typewriter", "Ballpoint pen", "Printing press"], "Typewriters, ballpoint pens, and printing presses are writing or text technologies.", "history_structured"),
  q("inventions", "intermediate", "odd_one_out", "Which of these is NOT an early calculating tool?", "Barometer", ["Abacus", "Slide rule", "Pascaline"], "Abacuses, slide rules, and Pascalines are calculating tools; barometers measure pressure.", "history_structured"),
  q("inventions", "intermediate", "odd_one_out", "Which of these is NOT an aviation pioneer?", "Thomas Edison", ["Wright brothers", "Otto Lilienthal", "Alberto Santos-Dumont"], "The Wright brothers, Lilienthal, and Santos-Dumont are aviation pioneers.", "history_structured"),
  q("inventions", "easy", "odd_one_out", "Which of these is NOT an energy-storage device?", "Telescope", ["Battery", "Capacitor", "Flywheel"], "Batteries, capacitors, and flywheels store energy; telescopes collect light.", "science_structured"),
  q("inventions", "easy", "odd_one_out", "Which of these is NOT a medical imaging method?", "Phonograph", ["X-ray", "MRI", "Ultrasound"], "X-ray, MRI, and ultrasound are medical imaging methods.", "science_structured"),
  q("inventions", "easy", "negative_exception", "Which invention was NOT created in the 20th century?", "Printing press", ["Airplane", "Transistor", "World Wide Web"], "The printing press predates the 20th century; the others are 20th-century inventions.", "history_structured"),
  q("inventions", "intermediate", "negative_exception", "Which item was NOT patented by Thomas Edison?", "Telephone", ["Phonograph", "Kinetograph", "Electric lamp"], "Bell patented the telephone; Edison patented phonograph, kinetograph, and lamp improvements.", "history_structured"),
  q("inventions", "easy", "negative_exception", "Which technology did NOT depend on electricity in its earliest common form?", "Bicycle", ["Telegraph", "Telephone", "Radio"], "The bicycle is mechanical; telegraph, telephone, and radio systems used electricity.", "history_structured"),
  q("inventions", "easy", "negative_exception", "Which device is NOT primarily used to magnify distant objects?", "Microscope", ["Telescope", "Binoculars", "Spotting scope"], "Microscopes magnify small nearby objects; the others are used for distant viewing.", "science_structured"),
  q("inventions", "easy", "numeric_estimation", "The Wright brothers' first powered flight happened in which year?", "1903", ["1896", "1914", "1927"], "The Wright Flyer flew at Kitty Hawk in 1903.", "history_structured"),
  q("inventions", "intermediate", "numeric_estimation", "Tim Berners-Lee's World Wide Web proposal was written in which year?", "1989", ["1979", "1995", "2001"], "The Web proposal dates to 1989.", "history_structured"),
  q("inventions", "easy", "numeric_estimation", "The first iPhone was introduced in which year?", "2007", ["2001", "2010", "2014"], "Apple introduced the first iPhone in 2007.", "history_structured"),
  q("inventions", "intermediate", "numeric_estimation", "The Gutenberg Bible was printed around which year?", "1455", ["1215", "1600", "1750"], "The Gutenberg Bible is usually dated to the mid-1450s.", "history_structured"),
  q("inventions", "easy", "superlative_comparison", "Which invention is oldest among these?", "Wheel", ["Telegraph", "Airplane", "Microchip"], "The wheel predates the telegraph, airplane, and microchip by millennia.", "history_structured"),
  q("inventions", "easy", "superlative_comparison", "Which invention came latest among these?", "World Wide Web", ["Telephone", "Printing press", "Steam engine"], "The World Wide Web came after the telephone, printing press, and steam engine.", "history_structured"),
  q("inventions", "intermediate", "superlative_comparison", "Which aircraft achieved the first controlled powered flight?", "Wright Flyer", ["Spirit of St. Louis", "Bell X-1", "Concorde"], "The Wright Flyer made the first controlled, sustained powered flight.", "history_structured"),
  q("inventions", "easy", "superlative_comparison", "Which technology sends information fastest over long distances?", "Fiber-optic cable", ["Postal mail", "Semaphore tower", "Handwritten courier"], "Fiber-optic cables transmit data at extremely high speeds using light.", "science_structured"),
  q("inventions", "intermediate", "superlative_comparison", "Which device changed sound recording earliest among these?", "Phonograph", ["Cassette tape", "Compact disc", "MP3 player"], "The phonograph predates cassette tapes, compact discs, and MP3 players.", "history_structured"),
  q("inventions", "easy", "connected_clue", "A raised-dot reading system created after a childhood eye injury points to which inventor?", "Louis Braille", ["Samuel Morse", "Johannes Gutenberg", "Charles Babbage"], "Louis Braille created the tactile reading system named for him.", "history_structured"),
  q("inventions", "easy", "connected_clue", "A prize endowed by the inventor of dynamite bears which surname?", "Nobel", ["Pasteur", "Watt", "Bell"], "Alfred Nobel invented dynamite and funded the Nobel Prizes.", "history_structured"),

  q("language", "easy", "standard_recall", "Spanish and French belong to which language family branch?", "Romance languages", ["Germanic languages", "Slavic languages", "Celtic languages"], "Spanish and French developed from Latin and are Romance languages.", "language_culture_structured"),
  q("language", "easy", "standard_recall", "Japanese uses which pair of phonetic kana scripts?", "Hiragana and katakana", ["Hangul and hanja", "Greek and Latin", "Cyrillic and Glagolitic"], "Modern Japanese uses hiragana and katakana as kana syllabaries.", "language_culture_structured"),
  q("language", "intermediate", "standard_recall", "Sanskrit is an ancient language in which Indo-European branch?", "Indo-Aryan", ["Germanic", "Celtic", "Baltic"], "Sanskrit is an ancient Indo-Aryan language.", "language_culture_structured"),
  q("language", "easy", "standard_recall", "Arabic is normally written in which direction?", "Right to left", ["Left to right", "Top to bottom", "Bottom to top"], "Arabic script is normally written from right to left.", "language_culture_structured"),
  q("language", "easy", "standard_recall", "Who created Esperanto?", "L. L. Zamenhof", ["J. R. R. Tolkien", "Noam Chomsky", "Ferdinand de Saussure"], "Zamenhof published Esperanto in 1887.", "language_culture_structured"),
  q("language", "easy", "standard_recall", "What is the Korean alphabet called?", "Hangul", ["Kana", "Devanagari", "Cyrillic"], "Hangul is the Korean alphabet.", "language_culture_structured"),
  q("language", "easy", "standard_recall", "What does etymology study?", "Word origins", ["Sentence diagrams", "Handwriting styles", "Speech volume"], "Etymology is the study of word origins and histories.", "language_culture_structured"),
  q("language", "intermediate", "standard_recall", "What is the smallest sound unit that can distinguish meaning called?", "Phoneme", ["Morpheme", "Grapheme", "Syllable"], "A phoneme is a sound unit that can distinguish words.", "language_culture_structured"),
  q("language", "easy", "standard_recall", "A bilingual person uses how many languages?", "Two", ["One", "Three", "Four"], "The prefix bi- means two.", "language_culture_structured"),
  q("language", "easy", "odd_one_out", "Which of these is NOT a Romance language?", "German", ["Spanish", "Portuguese", "Italian"], "Spanish, Portuguese, and Italian are Romance languages; German is Germanic.", "language_culture_structured"),
  q("language", "intermediate", "odd_one_out", "Which of these is NOT a Germanic language?", "Finnish", ["English", "Dutch", "Swedish"], "English, Dutch, and Swedish are Germanic languages; Finnish is Uralic.", "language_culture_structured"),
  q("language", "intermediate", "odd_one_out", "Which of these is NOT a Slavic language?", "Greek", ["Polish", "Russian", "Czech"], "Polish, Russian, and Czech are Slavic languages; Greek is Hellenic.", "language_culture_structured"),
  q("language", "hard", "odd_one_out", "Which of these is NOT a Semitic language?", "Hindi", ["Arabic", "Hebrew", "Amharic"], "Arabic, Hebrew, and Amharic are Semitic languages; Hindi is Indo-Aryan.", "language_culture_structured"),
  q("language", "easy", "odd_one_out", "Which of these is NOT an official United Nations language?", "Portuguese", ["Arabic", "Chinese", "Russian"], "Arabic, Chinese, and Russian are UN official languages; Portuguese is not.", "language_culture_structured"),
  q("language", "easy", "odd_one_out", "Which of these is NOT a writing system?", "Esperanto", ["Latin alphabet", "Cyrillic alphabet", "Devanagari"], "Esperanto is a language; the other three are writing systems.", "language_culture_structured"),
  q("language", "easy", "negative_exception", "Which language does NOT normally use the Latin alphabet as its primary script?", "Greek", ["English", "Spanish", "Indonesian"], "Greek uses the Greek alphabet; the others normally use Latin script.", "language_culture_structured"),
  q("language", "easy", "negative_exception", "Which word is NOT a palindrome?", "Planet", ["Level", "Radar", "Civic"], "Level, radar, and civic read the same backward; planet does not.", "language_culture_structured"),
  q("language", "easy", "negative_exception", "Which term is NOT a part of speech?", "Paragraph", ["Noun", "Verb", "Adjective"], "Nouns, verbs, and adjectives are parts of speech; paragraph is a text unit.", "language_culture_structured"),
  q("language", "intermediate", "negative_exception", "Which language is NOT written right-to-left in ordinary modern use?", "Thai", ["Arabic", "Hebrew", "Persian"], "Arabic, Hebrew, and Persian are written right-to-left; Thai is not.", "language_culture_structured"),
  q("language", "easy", "numeric_estimation", "How many letters are in the modern English alphabet?", "26", ["24", "27", "30"], "The modern English alphabet has 26 letters.", "language_culture_structured"),
  q("language", "easy", "numeric_estimation", "How many official languages does the United Nations have?", "6", ["4", "5", "7"], "The UN has six official languages.", "language_culture_structured"),
  q("language", "intermediate", "numeric_estimation", "The Morse code signal SOS has how many total dots and dashes?", "9", ["6", "8", "12"], "SOS is three dots, three dashes, and three dots: nine signals total.", "language_culture_structured"),
  q("language", "intermediate", "numeric_estimation", "How many grammatical cases are commonly taught for modern German?", "4", ["2", "3", "5"], "Modern German is commonly taught with nominative, accusative, dative, and genitive cases.", "language_culture_structured"),
  q("language", "intermediate", "superlative_comparison", "Which language has the most native speakers among these?", "Mandarin Chinese", ["Spanish", "English", "Hindi"], "Mandarin Chinese is generally listed with the most native speakers.", "language_culture_structured"),
  q("language", "hard", "superlative_comparison", "Which writing system has the largest alphabet among these?", "Khmer", ["Greek", "Hebrew", "Latin"], "Khmer is known for an especially large alphabet.", "language_culture_structured"),
  q("language", "intermediate", "superlative_comparison", "Which writing system is oldest among these?", "Cuneiform", ["Hangul", "Latin alphabet", "Cyrillic alphabet"], "Cuneiform is much older than Hangul, Latin, or Cyrillic writing.", "history_structured"),
  q("language", "easy", "superlative_comparison", "Which writing system is most widely used among these?", "Latin alphabet", ["Cyrillic alphabet", "Greek alphabet", "Georgian script"], "The Latin alphabet is the most widely used writing system among these.", "language_culture_structured"),
  q("language", "intermediate", "superlative_comparison", "Which language has the most native speakers in Europe among these?", "Russian", ["German", "French", "Italian"], "Russian has more native speakers in Europe than the other listed languages.", "language_culture_structured"),
  q("language", "easy", "connected_clue", "A planned international language launched in 1887 by Zamenhof is which language?", "Esperanto", ["Volapuk", "Interlingua", "Klingon"], "Zamenhof introduced Esperanto in 1887.", "language_culture_structured"),
  q("language", "easy", "connected_clue", "A Korean king commissioned a featural alphabet in the 1400s; what is it called?", "Hangul", ["Kanji", "Hanja", "Hiragana"], "King Sejong's court created Hangul in the 15th century.", "language_culture_structured"),

  q("literature_arts", "easy", "standard_recall", "Who painted the Mona Lisa?", "Leonardo da Vinci", ["Michelangelo", "Raphael", "Caravaggio"], "Leonardo da Vinci painted the Mona Lisa.", "language_culture_structured"),
  null, // was knowledge_expansion_v2_242 — removed as exact duplicate of knowledge_v1_273
  q("literature_arts", "easy", "standard_recall", "Who wrote Hamlet?", "William Shakespeare", ["Christopher Marlowe", "Oscar Wilde", "John Milton"], "Hamlet is one of Shakespeare's tragedies.", "language_culture_structured"),
  q("literature_arts", "easy", "standard_recall", "The Odyssey is traditionally attributed to which poet?", "Homer", ["Virgil", "Ovid", "Sophocles"], "The Odyssey is traditionally attributed to Homer.", "language_culture_structured"),
  q("literature_arts", "easy", "standard_recall", "Pride and Prejudice is by which author surname?", "Austen", ["Bronte", "Shelley", "Eliot"], "Jane Austen published Pride and Prejudice in 1813.", "language_culture_structured"),
  q("literature_arts", "easy", "standard_recall", "Who composed Symphony No. 5 in C minor?", "Ludwig van Beethoven", ["Wolfgang Amadeus Mozart", "Johannes Brahms", "Franz Schubert"], "Beethoven composed the famous Fifth Symphony.", "language_culture_structured"),
  q("literature_arts", "easy", "standard_recall", "Who composed the ballet Swan Lake?", "Pyotr Ilyich Tchaikovsky", ["Igor Stravinsky", "Sergei Prokofiev", "Gustav Mahler"], "Tchaikovsky composed Swan Lake.", "language_culture_structured"),
  q("literature_arts", "easy", "standard_recall", "Who wrote The Great Gatsby?", "F. Scott Fitzgerald", ["Ernest Hemingway", "John Steinbeck", "Sinclair Lewis"], "Fitzgerald published The Great Gatsby in 1925.", "language_culture_structured"),
  q("literature_arts", "easy", "standard_recall", "Who sculpted David in marble in Florence?", "Michelangelo", ["Donatello", "Bernini", "Rodin"], "Michelangelo's marble David is a Renaissance landmark.", "language_culture_structured"),
  q("literature_arts", "easy", "odd_one_out", "Which of these is NOT a Shakespeare play?", "Moby-Dick", ["Hamlet", "Macbeth", "Othello"], "Hamlet, Macbeth, and Othello are Shakespeare plays; Moby-Dick is a novel.", "language_culture_structured"),
  q("literature_arts", "easy", "odd_one_out", "Which of these is NOT a Jane Austen novel?", "Wuthering Heights", ["Pride and Prejudice", "Emma", "Sense and Sensibility"], "Wuthering Heights is by Emily Bronte; the others are Austen novels.", "language_culture_structured"),
  q("literature_arts", "easy", "odd_one_out", "Which of these is NOT a Van Gogh painting?", "Guernica", ["The Starry Night", "Sunflowers", "Bedroom in Arles"], "Guernica is by Picasso; the others are Van Gogh works.", "language_culture_structured"),
  q("literature_arts", "intermediate", "odd_one_out", "Which of these is NOT a Beethoven symphony nickname?", "Jupiter", ["Eroica", "Pastoral", "Choral"], "Jupiter is associated with Mozart's Symphony No. 41; the others are Beethoven symphony nicknames.", "language_culture_structured"),
  q("literature_arts", "easy", "odd_one_out", "Which of these was NOT a Renaissance artist?", "Andy Warhol", ["Leonardo da Vinci", "Michelangelo", "Raphael"], "Warhol was a 20th-century Pop artist; the others were Renaissance artists.", "language_culture_structured"),
  q("literature_arts", "easy", "odd_one_out", "Which of these is NOT a literary genre?", "Watercolor", ["Fiction novel", "Lyric poetry", "Drama"], "Fiction novel, lyric poetry, and drama are literary genres; watercolor is an art medium.", "language_culture_structured"),
  q("literature_arts", "easy", "negative_exception", "Which title was NOT written by Charles Dickens?", "Bronte's Jane Eyre", ["Oliver Twist", "David Copperfield", "Bleak House"], "Jane Eyre is by Charlotte Bronte; the other titles are by Dickens.", "language_culture_structured"),
  q("literature_arts", "intermediate", "negative_exception", "Which artwork is NOT by Leonardo da Vinci?", "The Birth of Venus", ["Mona Lisa", "The Last Supper", "Vitruvian Man"], "The Birth of Venus is by Botticelli; the others are by Leonardo.", "language_culture_structured"),
  q("literature_arts", "hard", "negative_exception", "Which composer did NOT belong mainly to the Classical period?", "Claude Debussy", ["Wolfgang Amadeus Mozart", "Joseph Haydn", "Ludwig van Beethoven"], "Debussy is associated with later Impressionist music; the others are central Classical-era composers.", "language_culture_structured"),
  q("literature_arts", "easy", "negative_exception", "Which title is NOT a play?", "The Hobbit", ["Macbeth", "Antigone", "A Doll's House"], "The Hobbit is a novel; the other titles are plays.", "language_culture_structured"),
  q("literature_arts", "intermediate", "numeric_estimation", "How many sonnets are in Shakespeare's published sonnet sequence?", "154", ["100", "120", "200"], "The 1609 sequence contains 154 sonnets.", "language_culture_structured"),
  q("literature_arts", "easy", "numeric_estimation", "How many numbered symphonies did Beethoven complete?", "9", ["5", "7", "12"], "Beethoven completed nine numbered symphonies.", "language_culture_structured"),
  q("literature_arts", "intermediate", "numeric_estimation", "Dante's Divine Comedy has how many main parts?", "3", ["2", "4", "7"], "The Divine Comedy is divided into Inferno, Purgatorio, and Paradiso.", "language_culture_structured"),
  q("literature_arts", "easy", "numeric_estimation", "Traditional Western note names from A through G total how many letters?", "7", ["5", "8", "12"], "The basic note names are A, B, C, D, E, F, and G.", "language_culture_structured"),
  q("literature_arts", "intermediate", "superlative_comparison", "Which listed literary work is oldest?", "Iliad", ["Hamlet", "Don Quixote", "Moby-Dick"], "The Iliad is ancient Greek epic poetry, older than the other listed works.", "language_culture_structured"),
  q("literature_arts", "intermediate", "superlative_comparison", "Which artist is earliest among these?", "Giotto", ["Caravaggio", "Monet", "Picasso"], "Giotto worked centuries before Caravaggio, Monet, or Picasso.", "language_culture_structured"),
  q("literature_arts", "intermediate", "superlative_comparison", "Which classic novel is longest among these?", "War and Peace", ["Animal Farm", "The Great Gatsby", "Frankenstein"], "War and Peace is far longer than the other listed novels.", "language_culture_structured"),
  q("literature_arts", "easy", "superlative_comparison", "Which is the highest standard singing voice type?", "Soprano", ["Alto", "Tenor", "Bass"], "Soprano is the highest standard vocal range listed.", "language_culture_structured"),
  q("literature_arts", "easy", "superlative_comparison", "Which is the lowest standard orchestral string instrument?", "Double bass", ["Violin", "Viola", "Cello"], "The double bass has the lowest range in the standard orchestral string family.", "language_culture_structured"),
  q("literature_arts", "easy", "connected_clue", "A windmill fight and Sancho Panza point to which novel?", "Don Quixote", ["Robinson Crusoe", "Gulliver's Travels", "The Decameron"], "Don Quixote includes Sancho Panza and the famous windmill episode.", "language_culture_structured"),
  q("literature_arts", "easy", "connected_clue", "A smile, Louvre crowds, and Leonardo point to which painting?", "Mona Lisa", ["The Scream", "Las Meninas", "Girl with a Pearl Earring"], "The Mona Lisa is Leonardo's famous portrait in the Louvre.", "language_culture_structured"),

  q("fun_facts", "easy", "standard_recall", "Which spice comes from dried flower buds?", "Cloves", ["Cinnamon", "Nutmeg", "Paprika"], "Cloves are dried aromatic flower buds.", "language_culture_structured"),
  q("fun_facts", "easy", "standard_recall", "Which country gave the world the LEGO brick?", "Denmark", ["Sweden", "Germany", "Netherlands"], "LEGO began in Denmark.", "language_culture_structured"),
  q("fun_facts", "easy", "standard_recall", "Which planet has a day longer than its year?", "Venus", ["Earth", "Mercury", "Jupiter"], "Venus rotates so slowly that its day is longer than its orbit around the Sun.", "science_structured"),
  q("fun_facts", "easy", "standard_recall", "Which fruit is botanically a berry?", "Banana", ["Apple", "Strawberry", "Peach"], "Botanically, bananas are berries; strawberries are aggregate accessory fruits.", "science_structured"),
  q("fun_facts", "easy", "standard_recall", "Which metal is liquid at ordinary room temperature?", "Mercury", ["Iron", "Copper", "Aluminum"], "Mercury is liquid near ordinary room temperature.", "science_structured"),
  q("fun_facts", "easy", "standard_recall", "Which color is at the outer edge of a primary rainbow?", "Red", ["Blue", "Green", "Violet"], "Red appears on the outer edge of a primary rainbow.", "science_structured"),
  q("fun_facts", "easy", "standard_recall", "Which kitchen staple is made by fermenting ethanol into acetic acid?", "Vinegar", ["Olive oil", "Baking powder", "Molasses"], "Vinegar contains acetic acid produced by fermentation.", "science_structured"),
  q("fun_facts", "easy", "standard_recall", "What is the only even prime number?", "2", ["1", "3", "9"], "Two is prime and even; every larger even number is divisible by 2.", "science_structured"),
  q("fun_facts", "intermediate", "standard_recall", "Which symbol is used for the chemical element gold?", "Au", ["Ag", "Gd", "Go"], "Gold's chemical symbol is Au, from aurum.", "science_structured"),
  q("fun_facts", "easy", "odd_one_out", "Which of these is NOT an Olympic ring color?", "Purple", ["Blue", "Yellow", "Green"], "Blue, yellow, and green are Olympic ring colors; purple is not.", "language_culture_structured"),
  q("fun_facts", "easy", "odd_one_out", "Which of these is NOT a chess piece?", "Archer", ["Rook", "Bishop", "Knight"], "Rooks, bishops, and knights are chess pieces; archer is not.", "language_culture_structured"),
  q("fun_facts", "intermediate", "odd_one_out", "Which of these is NOT an SI base unit?", "Liter", ["Meter", "Kilogram", "Second"], "Meter, kilogram, and second are SI base units; liter is not.", "science_structured"),
  q("fun_facts", "easy", "odd_one_out", "Which of these is NOT a primary additive light color?", "Yellow", ["Red", "Green", "Blue"], "Additive primary light colors are red, green, and blue.", "science_structured"),
  q("fun_facts", "easy", "odd_one_out", "Which of these is NOT a face value on a standard six-sided die?", "0", ["1", "4", "6"], "A standard die has faces numbered 1 through 6.", "language_culture_structured"),
  q("fun_facts", "easy", "odd_one_out", "Which of these is NOT in the rainbow mnemonic ROYGBIV?", "Pink", ["Red", "Indigo", "Violet"], "ROYGBIV includes red, indigo, and violet, but not pink.", "science_structured"),
  q("fun_facts", "intermediate", "negative_exception", "Which metal is NOT ferromagnetic at room temperature?", "Copper", ["Iron", "Cobalt", "Nickel"], "Iron, cobalt, and nickel are ferromagnetic at room temperature; copper is not.", "science_structured"),
  q("fun_facts", "easy", "negative_exception", "Which shape is NOT a Platonic solid?", "Cylinder", ["Tetrahedron", "Cube", "Dodecahedron"], "The tetrahedron, cube, and dodecahedron are Platonic solids; cylinder is not.", "science_structured"),
  q("fun_facts", "easy", "negative_exception", "Which taste is NOT one of the common five basic tastes?", "Spicy", ["Sweet", "Sour", "Umami"], "Sweet, sour, and umami are basic tastes; spicy is a pain/heat sensation.", "science_structured"),
  q("fun_facts", "easy", "negative_exception", "Which month does NOT have 31 days?", "April", ["January", "March", "July"], "April has 30 days; January, March, and July have 31.", "language_culture_structured"),
  q("fun_facts", "easy", "numeric_estimation", "A standard Rubik's Cube shows how many small face stickers or tiles?", "54", ["48", "56", "64"], "A 3 by 3 by 3 cube has 9 visible squares on each of 6 faces.", "language_culture_structured"),
  q("fun_facts", "easy", "numeric_estimation", "A standard deck without jokers has how many cards?", "52", ["48", "54", "60"], "A standard deck has 52 cards before jokers.", "language_culture_structured"),
  q("fun_facts", "easy", "numeric_estimation", "How many squares are on a standard chessboard?", "64", ["49", "72", "81"], "A chessboard is 8 by 8, making 64 squares.", "language_culture_structured"),
  q("fun_facts", "easy", "numeric_estimation", "How many rings are on the Olympic flag?", "5", ["4", "6", "7"], "The Olympic flag has five interlaced rings.", "language_culture_structured"),
  q("fun_facts", "easy", "superlative_comparison", "Which common sports ball is largest by standard diameter?", "Basketball", ["Tennis ball", "Baseball", "Golf ball"], "A basketball is larger in diameter than the other listed balls.", "language_culture_structured"),
  q("fun_facts", "intermediate", "superlative_comparison", "Which planet has the lowest average density?", "Saturn", ["Jupiter", "Uranus", "Neptune"], "Saturn is the least dense planet.", "science_structured"),
  q("fun_facts", "easy", "superlative_comparison", "Which animal is tallest?", "Giraffe", ["Elephant", "Camel", "Horse"], "Giraffes are the tallest living land animals.", "science_structured"),
  q("fun_facts", "easy", "superlative_comparison", "Which chemical element is most abundant in the universe?", "Hydrogen", ["Helium", "Oxygen", "Carbon"], "Hydrogen is the most abundant element in the universe.", "science_structured"),
  q("fun_facts", "hard", "superlative_comparison", "Which spacecraft holds record-setting solar-speed marks?", "Parker Solar Probe", ["Voyager 1", "Apollo 10", "New Horizons"], "Parker Solar Probe has set record speeds while passing close to the Sun.", "science_structured"),
  q("fun_facts", "easy", "connected_clue", "Six faces, opposite sides adding to seven, and board games point to what object?", "Standard die", ["Chess knight", "Playing card", "Domino tile"], "A standard die has six faces with opposite sides that add to seven.", "language_culture_structured"),
  q("fun_facts", "easy", "connected_clue", "A sour condiment, acetic acid, and fermented alcohol point to what kitchen staple?", "Vinegar", ["Soy sauce", "Olive oil", "Baking soda"], "Vinegar's sourness comes mainly from acetic acid.", "science_structured"),
];

const built = buildRows(RAW_SHAPE_FACTS);

export const knowledgeExpansionV2Questions = built.rows;
export const knowledgeExpansionV2ReviewRows = built.reviewRows;
export const questions = knowledgeExpansionV2Questions;
export default knowledgeExpansionV2Questions;
