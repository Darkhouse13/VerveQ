import { knowledgeExpansionV1Questions } from "./knowledgeExpansionV1";
import { knowledgeCameFirstExpansionV2Questions } from "./knowledgeCameFirstExpansionV2";
import { knowledgeExpansionV2Questions } from "./knowledgeExpansionV2";

export type KnowledgeQuestionSeed = {
  sport: string;
  category: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  questionKind?: "mcq" | "which_came_first" | "logo_text";
  difficulty: "easy" | "intermediate" | "hard";
  bucket: string;
  checksum: string;
};

export const knowledgeQuestions: KnowledgeQuestionSeed[] = [
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the largest ocean on Earth?",
    "options": [
      "Atlantic Ocean",
      "Indian Ocean",
      "Pacific Ocean",
      "Arctic Ocean"
    ],
    "correctAnswer": "Pacific Ocean",
    "explanation": "The Pacific Ocean covers more area than all land on Earth combined.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_001"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which planet is known as the Red Planet?",
    "options": [
      "Venus",
      "Mars",
      "Jupiter",
      "Mercury"
    ],
    "correctAnswer": "Mars",
    "explanation": "Iron-rich dust gives Mars its reddish appearance.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_002"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What gas do plants absorb from the air for photosynthesis?",
    "options": [
      "Carbon dioxide",
      "Oxygen",
      "Nitrogen",
      "Helium"
    ],
    "correctAnswer": "Carbon dioxide",
    "explanation": "Plants use carbon dioxide, water, and sunlight to make sugars.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_003"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "How many continents are usually taught in the seven-continent model?",
    "options": [
      "7",
      "5",
      "6",
      "8"
    ],
    "correctAnswer": "7",
    "explanation": "The common model names Africa, Antarctica, Asia, Europe, North America, Oceania/Australia, and South America.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_004"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the capital city of Japan?",
    "options": [
      "Kyoto",
      "Osaka",
      "Sapporo",
      "Tokyo"
    ],
    "correctAnswer": "Tokyo",
    "explanation": "Tokyo has been Japan's capital since the imperial court moved there in 1868.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_005"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What force keeps planets in orbit around the Sun?",
    "options": [
      "Gravity",
      "Magnetism",
      "Friction",
      "Electricity"
    ],
    "correctAnswer": "Gravity",
    "explanation": "Gravity attracts masses and keeps planets moving in curved orbits.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_006"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "Water freezes at what temperature on the Celsius scale?",
    "options": [
      "10°C",
      "0°C",
      "32°C",
      "100°C"
    ],
    "correctAnswer": "0°C",
    "explanation": "At standard pressure, pure water freezes at 0°C.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_007"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who is famous for painting the Mona Lisa?",
    "options": [
      "Michelangelo",
      "Vincent van Gogh",
      "Pablo Picasso",
      "Leonardo da Vinci"
    ],
    "correctAnswer": "Leonardo da Vinci",
    "explanation": "Leonardo painted the Mona Lisa during the Italian Renaissance.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_008"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who developed the theory of general relativity?",
    "options": [
      "Isaac Newton",
      "Galileo Galilei",
      "Niels Bohr",
      "Albert Einstein"
    ],
    "correctAnswer": "Albert Einstein",
    "explanation": "Einstein published general relativity in 1915.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_009"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which ancient civilization built the pyramids at Giza?",
    "options": [
      "Romans",
      "Aztecs",
      "Ancient Egyptians",
      "Vikings"
    ],
    "correctAnswer": "Ancient Egyptians",
    "explanation": "The Giza pyramids were built as royal tombs during Egypt's Old Kingdom.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_010"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The first successful airplane flight is associated with which brothers?",
    "options": [
      "Montgolfier brothers",
      "Grimm brothers",
      "Wright brothers",
      "Mayo brothers"
    ],
    "correctAnswer": "Wright brothers",
    "explanation": "Orville and Wilbur Wright flew at Kitty Hawk in 1903.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_011"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who is credited with discovering penicillin?",
    "options": [
      "Marie Curie",
      "Louis Pasteur",
      "Gregor Mendel",
      "Alexander Fleming"
    ],
    "correctAnswer": "Alexander Fleming",
    "explanation": "Fleming noticed Penicillium mold killing bacteria in 1928.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_discoveries",
    "checksum": "knowledge_v1_012"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Which instrument made distant stars and planets much easier to study?",
    "options": [
      "Telescope",
      "Microscope",
      "Barometer",
      "Compass"
    ],
    "correctAnswer": "Telescope",
    "explanation": "Telescopes collect light from distant objects, transforming astronomy.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_discoveries",
    "checksum": "knowledge_v1_013"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Newton's third law says every action has what?",
    "options": [
      "A hidden cost",
      "A random outcome",
      "An equal and opposite reaction",
      "A magnetic field"
    ],
    "correctAnswer": "An equal and opposite reaction",
    "explanation": "Forces between two bodies come in equal and opposite pairs.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_laws_of_universe",
    "checksum": "knowledge_v1_014"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which animal is known for having a very long neck?",
    "options": [
      "Kangaroo",
      "Penguin",
      "Giraffe",
      "Hedgehog"
    ],
    "correctAnswer": "Giraffe",
    "explanation": "Giraffes use long necks to browse high leaves and compete in necking contests.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_015"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "What is the hardest natural substance commonly found on Earth?",
    "options": [
      "Gold",
      "Quartz",
      "Granite",
      "Diamond"
    ],
    "correctAnswer": "Diamond",
    "explanation": "Diamond's carbon crystal structure makes it extremely hard.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_016"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "How many sides does a triangle have?",
    "options": [
      "2",
      "4",
      "3",
      "5"
    ],
    "correctAnswer": "3",
    "explanation": "A triangle is a polygon with three edges and three vertices.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_017"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "Which organ pumps blood around the human body?",
    "options": [
      "Lung",
      "Brain",
      "Liver",
      "Heart"
    ],
    "correctAnswer": "Heart",
    "explanation": "The heart contracts rhythmically to circulate blood.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_018"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who wrote the play Romeo and Juliet?",
    "options": [
      "Jane Austen",
      "William Shakespeare",
      "Charles Dickens",
      "Homer"
    ],
    "correctAnswer": "William Shakespeare",
    "explanation": "Shakespeare wrote Romeo and Juliet in the 1590s.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_019"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which wall divided Berlin during the Cold War?",
    "options": [
      "Hadrian's Wall",
      "Great Wall",
      "Western Wall",
      "Berlin Wall"
    ],
    "correctAnswer": "Berlin Wall",
    "explanation": "The Berlin Wall divided East and West Berlin from 1961 to 1989.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_020"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What molecule carries genetic instructions in most living organisms?",
    "options": [
      "ATP",
      "Insulin",
      "DNA",
      "Chlorophyll"
    ],
    "correctAnswer": "DNA",
    "explanation": "DNA stores hereditary information using sequences of nucleotide bases.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_science",
    "checksum": "knowledge_v1_021"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the most abundant gas in Earth's atmosphere?",
    "options": [
      "Oxygen",
      "Nitrogen",
      "Carbon dioxide",
      "Argon"
    ],
    "correctAnswer": "Nitrogen",
    "explanation": "Nitrogen makes up about 78% of Earth's atmosphere.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_science",
    "checksum": "knowledge_v1_022"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "The second law of thermodynamics is closely associated with the increase of what in an isolated system?",
    "options": [
      "Velocity",
      "Mass",
      "Entropy",
      "Voltage"
    ],
    "correctAnswer": "Entropy",
    "explanation": "In an isolated system, total entropy tends not to decrease.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_023"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Ohm's law relates voltage, current, and what?",
    "options": [
      "Mass",
      "Pressure",
      "Frequency",
      "Resistance"
    ],
    "correctAnswer": "Resistance",
    "explanation": "Ohm's law is V = I × R.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_024"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Einstein's equation E = mc² states that energy is equivalent to mass multiplied by what?",
    "options": [
      "The speed of light squared",
      "Gravity squared",
      "Time squared",
      "Planck's constant"
    ],
    "correctAnswer": "The speed of light squared",
    "explanation": "The equation links mass and energy through the square of light speed.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_025"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Which scientist proposed the laws of planetary motion?",
    "options": [
      "Johannes Kepler",
      "Tycho Brahe",
      "Edwin Hubble",
      "Carl Sagan"
    ],
    "correctAnswer": "Johannes Kepler",
    "explanation": "Kepler described elliptical orbits and planetary motion in the early 1600s.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_026"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered radium and polonium with Pierre Curie?",
    "options": [
      "Rosalind Franklin",
      "Ada Lovelace",
      "Lise Meitner",
      "Marie Curie"
    ],
    "correctAnswer": "Marie Curie",
    "explanation": "Marie Curie's work pioneered radioactivity research.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_027"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "What did Edward Jenner's smallpox work help establish?",
    "options": [
      "Vaccination",
      "X-rays",
      "Anesthesia",
      "Antibiotics"
    ],
    "correctAnswer": "Vaccination",
    "explanation": "Jenner's cowpox experiments helped prove vaccination could prevent smallpox.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_028"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who wrote A Brief History of Time?",
    "options": [
      "Richard Feynman",
      "Carl Sagan",
      "Stephen Hawking",
      "Brian Greene"
    ],
    "correctAnswer": "Stephen Hawking",
    "explanation": "Hawking's 1988 book explained cosmology for general readers.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_029"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who is often called the father of computer science?",
    "options": [
      "Alan Turing",
      "Tim Berners-Lee",
      "Steve Wozniak",
      "John von Neumann"
    ],
    "correctAnswer": "Alan Turing",
    "explanation": "Turing formalized computation and helped break wartime codes.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_030"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The Magna Carta was sealed in which country?",
    "options": [
      "France",
      "Spain",
      "England",
      "Italy"
    ],
    "correctAnswer": "England",
    "explanation": "King John sealed the Magna Carta at Runnymede in 1215.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_history",
    "checksum": "knowledge_v1_031"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which empire was ruled by Genghis Khan?",
    "options": [
      "Mongol Empire",
      "Ottoman Empire",
      "Roman Empire",
      "Inca Empire"
    ],
    "correctAnswer": "Mongol Empire",
    "explanation": "Genghis Khan united Mongol tribes and built a vast empire.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_history",
    "checksum": "knowledge_v1_032"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which language has the most native speakers worldwide?",
    "options": [
      "English",
      "Mandarin Chinese",
      "Spanish",
      "Hindi"
    ],
    "correctAnswer": "Mandarin Chinese",
    "explanation": "Mandarin Chinese has the largest number of native speakers.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_common_knowledge",
    "checksum": "knowledge_v1_033"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the largest organ of the human body?",
    "options": [
      "Liver",
      "Lung",
      "Skin",
      "Heart"
    ],
    "correctAnswer": "Skin",
    "explanation": "Skin is the body's largest organ by surface area and weight.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_common_knowledge",
    "checksum": "knowledge_v1_034"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "A group of crows is traditionally called what?",
    "options": [
      "A parliament",
      "A murder",
      "A pod",
      "A colony"
    ],
    "correctAnswer": "A murder",
    "explanation": "The old collective noun for crows is a murder.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_035"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which planet has the most prominent ring system visible from Earth?",
    "options": [
      "Mars",
      "Mercury",
      "Saturn",
      "Venus"
    ],
    "correctAnswer": "Saturn",
    "explanation": "Saturn's rings are bright and extensive.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_036"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What scale is used to measure earthquake magnitude in many public reports?",
    "options": [
      "Richter scale",
      "Beaufort scale",
      "Mohs scale",
      "pH scale"
    ],
    "correctAnswer": "Richter scale",
    "explanation": "The Richter scale is historically famous, though modern seismology often uses moment magnitude.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_science",
    "checksum": "knowledge_v1_037"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "What does the law of conservation of energy state?",
    "options": [
      "Energy is always heat",
      "Energy cannot be created or destroyed",
      "Energy only exists in stars",
      "Energy equals gravity"
    ],
    "correctAnswer": "Energy cannot be created or destroyed",
    "explanation": "Energy changes form, but total energy remains constant in an isolated system.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_038"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered the structure of DNA with Francis Crick, building on key X-ray data?",
    "options": [
      "Gregor Mendel",
      "James Watson",
      "Louis Pasteur",
      "Max Planck"
    ],
    "correctAnswer": "James Watson",
    "explanation": "Watson and Crick proposed the double helix model in 1953, using crucial data from Franklin and Wilkins.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_039"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who formulated the laws of inheritance using pea plants?",
    "options": [
      "Gregor Mendel",
      "Charles Darwin",
      "Robert Hooke",
      "Antonie van Leeuwenhoek"
    ],
    "correctAnswer": "Gregor Mendel",
    "explanation": "Mendel's pea plant experiments founded classical genetics.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_040"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the name of the boundary around a black hole beyond which light cannot escape?",
    "options": [
      "Photon belt",
      "Singularity shell",
      "Event horizon",
      "Accretion edge"
    ],
    "correctAnswer": "Event horizon",
    "explanation": "The event horizon marks the point where escape velocity exceeds light speed.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_science",
    "checksum": "knowledge_v1_041"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "Which particle is associated with the Higgs field giving mass to elementary particles?",
    "options": [
      "Gluon",
      "Muon neutrino",
      "Higgs boson",
      "Positron"
    ],
    "correctAnswer": "Higgs boson",
    "explanation": "The Higgs boson was observed at CERN in 2012.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_science",
    "checksum": "knowledge_v1_042"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Planck's constant is central to which branch of physics?",
    "options": [
      "Classical thermodynamics",
      "Quantum mechanics",
      "Plate tectonics",
      "Fluid statics"
    ],
    "correctAnswer": "Quantum mechanics",
    "explanation": "Planck's constant sets the scale of quantum effects.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_laws_of_universe",
    "checksum": "knowledge_v1_043"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "What principle says no two identical fermions can occupy the same quantum state simultaneously?",
    "options": [
      "Huygens principle",
      "Pauli exclusion principle",
      "Le Chatelier's principle",
      "Mach's principle"
    ],
    "correctAnswer": "Pauli exclusion principle",
    "explanation": "The Pauli exclusion principle explains electron shell structure.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_laws_of_universe",
    "checksum": "knowledge_v1_044"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who proposed continental drift before plate tectonics became accepted?",
    "options": [
      "Alfred Wegener",
      "James Hutton",
      "Charles Lyell",
      "Marie Tharp"
    ],
    "correctAnswer": "Alfred Wegener",
    "explanation": "Wegener proposed that continents move, though the mechanism was accepted later with plate tectonics.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_045"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who identified the first pulsars with Antony Hewish's team in 1967?",
    "options": [
      "Vera Rubin",
      "Cecilia Payne-Gaposchkin",
      "Jocelyn Bell Burnell",
      "Henrietta Leavitt"
    ],
    "correctAnswer": "Jocelyn Bell Burnell",
    "explanation": "Bell Burnell noticed the regular radio pulses that led to pulsar discovery.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_046"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Which astronomer showed that certain nebulae were separate galaxies beyond the Milky Way?",
    "options": [
      "Nicolas Copernicus",
      "Johannes Kepler",
      "William Herschel",
      "Edwin Hubble"
    ],
    "correctAnswer": "Edwin Hubble",
    "explanation": "Hubble's observations of Cepheid variables established the scale of galaxies.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_047"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who argued that stars are primarily made of hydrogen and helium in a landmark 1925 thesis?",
    "options": [
      "Marie Curie",
      "Emmy Noether",
      "Cecilia Payne-Gaposchkin",
      "Dorothy Hodgkin"
    ],
    "correctAnswer": "Cecilia Payne-Gaposchkin",
    "explanation": "Her thesis transformed understanding of stellar composition.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_human_knowledge",
    "checksum": "knowledge_v1_048"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Noether's theorem connects conservation laws with what?",
    "options": [
      "Symmetries",
      "Chemical bonds",
      "DNA replication",
      "Continental plates"
    ],
    "correctAnswer": "Symmetries",
    "explanation": "Emmy Noether showed that differentiable symmetries imply conserved quantities.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_human_knowledge",
    "checksum": "knowledge_v1_049"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which civilization developed cuneiform writing?",
    "options": [
      "Phoenicians",
      "Minoans",
      "Olmecs",
      "Sumerians"
    ],
    "correctAnswer": "Sumerians",
    "explanation": "Sumerian cuneiform is among the earliest known writing systems.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_history",
    "checksum": "knowledge_v1_050"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The Rosetta Stone helped scholars decipher which writing system?",
    "options": [
      "Mayan glyphs",
      "Linear B",
      "Cuneiform",
      "Egyptian hieroglyphs"
    ],
    "correctAnswer": "Egyptian hieroglyphs",
    "explanation": "The stone contained Greek, Demotic, and hieroglyphic text.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_history",
    "checksum": "knowledge_v1_051"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the SI unit of electric capacitance?",
    "options": [
      "Tesla",
      "Weber",
      "Farad",
      "Ohm"
    ],
    "correctAnswer": "Farad",
    "explanation": "Capacitance is measured in farads, named after Michael Faraday.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_common_knowledge",
    "checksum": "knowledge_v1_052"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which element has the chemical symbol W?",
    "options": [
      "Tin",
      "Titanium",
      "Tungsten",
      "Tellurium"
    ],
    "correctAnswer": "Tungsten",
    "explanation": "W comes from wolfram, another name historically used for tungsten.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_common_knowledge",
    "checksum": "knowledge_v1_053"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Octopuses have what color blood due to copper-based hemocyanin?",
    "options": [
      "Green",
      "Yellow",
      "Blue",
      "Black"
    ],
    "correctAnswer": "Blue",
    "explanation": "Hemocyanin turns bluish when oxygenated.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_fun_facts",
    "checksum": "knowledge_v1_054"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "What is the only mammal capable of sustained powered flight?",
    "options": [
      "Flying squirrel",
      "Bat",
      "Sugar glider",
      "Colugo"
    ],
    "correctAnswer": "Bat",
    "explanation": "Bats actively flap wings; gliders only glide.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_fun_facts",
    "checksum": "knowledge_v1_055"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What enzyme copies RNA into DNA in retroviruses?",
    "options": [
      "DNA ligase",
      "Amylase",
      "Helicase",
      "Reverse transcriptase"
    ],
    "correctAnswer": "Reverse transcriptase",
    "explanation": "Retroviruses use reverse transcriptase to make DNA from RNA.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_science",
    "checksum": "knowledge_v1_056"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "In special relativity, what remains constant for all observers in inertial frames?",
    "options": [
      "Mass of a rocket fuel tank",
      "Sound speed in air",
      "Earth's gravity",
      "Speed of light in vacuum"
    ],
    "correctAnswer": "Speed of light in vacuum",
    "explanation": "Special relativity assumes all inertial observers measure the same vacuum light speed.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_laws_of_universe",
    "checksum": "knowledge_v1_057"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered the first antibiotic effective against tuberculosis, streptomycin, with colleagues?",
    "options": [
      "Alexander Fleming",
      "Robert Koch",
      "Selman Waksman",
      "Joseph Lister"
    ],
    "correctAnswer": "Selman Waksman",
    "explanation": "Waksman's lab discovered streptomycin in the 1940s.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_058"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Who created the first algorithm intended for Charles Babbage's Analytical Engine?",
    "options": [
      "Ada Lovelace",
      "Grace Hopper",
      "Katherine Johnson",
      "Mary Somerville"
    ],
    "correctAnswer": "Ada Lovelace",
    "explanation": "Lovelace's notes included an algorithm for Bernoulli numbers.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_human_knowledge",
    "checksum": "knowledge_v1_059"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which treaty ended World War I between Germany and the Allied powers?",
    "options": [
      "Treaty of Versailles",
      "Treaty of Tordesillas",
      "Treaty of Paris 1783",
      "Treaty of Utrecht"
    ],
    "correctAnswer": "Treaty of Versailles",
    "explanation": "The Treaty of Versailles was signed in 1919.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_history",
    "checksum": "knowledge_v1_060"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "In which year did World War II end?",
    "options": [
      "1939",
      "1918",
      "1945",
      "1950"
    ],
    "correctAnswer": "1945",
    "explanation": "World War II ended in 1945 after the surrender of Germany and Japan.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_061"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What part of the cell contains genetic material in humans?",
    "options": [
      "Nucleus",
      "Ribosome",
      "Cell wall",
      "Vacuole"
    ],
    "correctAnswer": "Nucleus",
    "explanation": "In human cells, most DNA is stored in the nucleus.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_062"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "How many sides does a hexagon have?",
    "options": [
      "5",
      "7",
      "6",
      "8"
    ],
    "correctAnswer": "6",
    "explanation": "A hexagon is a polygon with six sides.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_063"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who is commonly credited with inventing the telephone?",
    "options": [
      "Thomas Edison",
      "Alexander Graham Bell",
      "Nikola Tesla",
      "Guglielmo Marconi"
    ],
    "correctAnswer": "Alexander Graham Bell",
    "explanation": "Alexander Graham Bell received a key telephone patent in 1876.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_064"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which organ pumps blood through the human body?",
    "options": [
      "Liver",
      "Heart",
      "Lung",
      "Kidney"
    ],
    "correctAnswer": "Heart",
    "explanation": "The heart circulates blood through the body using rhythmic contractions.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_065"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which animal is known for having black and white stripes and living in Africa?",
    "options": [
      "Tiger",
      "Zebra",
      "Panda",
      "Skunk"
    ],
    "correctAnswer": "Zebra",
    "explanation": "Zebras are African equids famous for their black and white stripes.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_066"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the main gas found in Earth's atmosphere?",
    "options": [
      "Nitrogen",
      "Oxygen",
      "Carbon dioxide",
      "Hydrogen"
    ],
    "correctAnswer": "Nitrogen",
    "explanation": "Nitrogen makes up about 78% of Earth's atmosphere.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_067"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Who was the first president of the United States?",
    "options": [
      "George Washington",
      "Thomas Jefferson",
      "Abraham Lincoln",
      "John Adams"
    ],
    "correctAnswer": "George Washington",
    "explanation": "George Washington served as the first U.S. president from 1789 to 1797.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_068"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What process do plants use to make food from sunlight?",
    "options": [
      "Photosynthesis",
      "Respiration",
      "Fermentation",
      "Digestion"
    ],
    "correctAnswer": "Photosynthesis",
    "explanation": "Photosynthesis converts light energy, carbon dioxide, and water into sugars.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_069"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "How many minutes are in one hour?",
    "options": [
      "30",
      "90",
      "100",
      "60"
    ],
    "correctAnswer": "60",
    "explanation": "One hour is equal to 60 minutes.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_070"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which invention is Johannes Gutenberg best known for developing in Europe?",
    "options": [
      "Steam engine",
      "Movable-type printing press",
      "Electric light bulb",
      "Radio transmitter"
    ],
    "correctAnswer": "Movable-type printing press",
    "explanation": "Gutenberg developed a movable-type printing press in 15th-century Europe.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_071"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who proposed the theory of evolution by natural selection?",
    "options": [
      "Isaac Newton",
      "Gregor Mendel",
      "Albert Einstein",
      "Charles Darwin"
    ],
    "correctAnswer": "Charles Darwin",
    "explanation": "Charles Darwin presented natural selection as a mechanism of evolution.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_discoveries",
    "checksum": "knowledge_v1_072"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "What does Ohm's law relate?",
    "options": [
      "Voltage, current, and resistance",
      "Mass, force, and acceleration",
      "Pressure and volume",
      "Energy and frequency"
    ],
    "correctAnswer": "Voltage, current, and resistance",
    "explanation": "Ohm's law states that voltage equals current multiplied by resistance.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_073"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which bird is famous for being unable to fly and living naturally in Antarctica?",
    "options": [
      "Ostrich",
      "Emu",
      "Penguin",
      "Kiwi"
    ],
    "correctAnswer": "Penguin",
    "explanation": "Several penguin species live in Antarctica and are adapted for swimming, not flight.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_074"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the pH value of pure water at 25 degrees Celsius?",
    "options": [
      "0",
      "5",
      "7",
      "14"
    ],
    "correctAnswer": "7",
    "explanation": "Pure water is neutral at 25 degrees Celsius, with a pH of 7.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_science",
    "checksum": "knowledge_v1_075"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which river is traditionally considered the longest river in the world?",
    "options": [
      "Amazon River",
      "Yangtze River",
      "Nile River",
      "Mississippi River"
    ],
    "correctAnswer": "Nile River",
    "explanation": "The Nile is traditionally listed as the world's longest river, though measurements are debated.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_076"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The ancient city of Rome was founded on which peninsula?",
    "options": [
      "Iberian Peninsula",
      "Italian Peninsula",
      "Balkan Peninsula",
      "Scandinavian Peninsula"
    ],
    "correctAnswer": "Italian Peninsula",
    "explanation": "Rome was founded in central Italy on the Italian Peninsula.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_077"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which novel begins with the line 'Call me Ishmael'?",
    "options": [
      "The Great Gatsby",
      "Treasure Island",
      "Robinson Crusoe",
      "Moby-Dick"
    ],
    "correctAnswer": "Moby-Dick",
    "explanation": "Herman Melville's 'Moby-Dick' opens with the famous line 'Call me Ishmael.'",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_078"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "Which blood cells are primarily responsible for carrying oxygen?",
    "options": [
      "White blood cells",
      "Platelets",
      "Plasma cells",
      "Red blood cells"
    ],
    "correctAnswer": "Red blood cells",
    "explanation": "Red blood cells contain hemoglobin, which transports oxygen.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_079"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "Which planet has the largest system of rings visible from Earth through telescopes?",
    "options": [
      "Saturn",
      "Jupiter",
      "Uranus",
      "Neptune"
    ],
    "correctAnswer": "Saturn",
    "explanation": "Saturn is famous for its large, bright ring system.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_080"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the freezing point of water at standard atmospheric pressure?",
    "options": [
      "10 degrees Celsius",
      "0 degrees Celsius",
      "32 degrees Celsius",
      "100 degrees Celsius"
    ],
    "correctAnswer": "0 degrees Celsius",
    "explanation": "Water freezes at 0 degrees Celsius at standard atmospheric pressure.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_081"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who invented the first practical incandescent light bulb system?",
    "options": [
      "James Watt",
      "Michael Faraday",
      "Samuel Morse",
      "Thomas Edison"
    ],
    "correctAnswer": "Thomas Edison",
    "explanation": "Thomas Edison developed a practical incandescent lighting system in the late 19th century.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_082"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered the electron?",
    "options": [
      "Ernest Rutherford",
      "J. J. Thomson",
      "Niels Bohr",
      "James Chadwick"
    ],
    "correctAnswer": "J. J. Thomson",
    "explanation": "J. J. Thomson identified the electron through cathode ray experiments in 1897.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_083"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Which principle states that energy cannot be created or destroyed, only transformed?",
    "options": [
      "Law of universal gravitation",
      "Law of conservation of energy",
      "Pauli exclusion principle",
      "Hooke's law"
    ],
    "correctAnswer": "Law of conservation of energy",
    "explanation": "The law of conservation of energy says total energy remains constant in an isolated system.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_084"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "How many bones are in the typical adult human body?",
    "options": [
      "180",
      "206",
      "250",
      "300"
    ],
    "correctAnswer": "206",
    "explanation": "A typical adult human skeleton has 206 bones.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_085"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which mammal is known for laying eggs?",
    "options": [
      "Koala",
      "Kangaroo",
      "Platypus",
      "Otter"
    ],
    "correctAnswer": "Platypus",
    "explanation": "The platypus is a monotreme, a type of egg-laying mammal.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_086"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "Which subatomic particle has a negative electric charge?",
    "options": [
      "Proton",
      "Neutron",
      "Electron",
      "Photon"
    ],
    "correctAnswer": "Electron",
    "explanation": "Electrons carry a negative electric charge.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_087"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Mount Everest lies on the border between Nepal and which region of China?",
    "options": [
      "Xinjiang",
      "Tibet",
      "Yunnan",
      "Inner Mongolia"
    ],
    "correctAnswer": "Tibet",
    "explanation": "Mount Everest is on the Nepal-Tibet border.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_088"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which civilization built the pyramids at Giza?",
    "options": [
      "Ancient Egyptians",
      "Ancient Greeks",
      "Romans",
      "Sumerians"
    ],
    "correctAnswer": "Ancient Egyptians",
    "explanation": "The pyramids at Giza were built by ancient Egyptians during the Old Kingdom.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_089"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which artist painted 'Starry Night'?",
    "options": [
      "Vincent van Gogh",
      "Pablo Picasso",
      "Claude Monet",
      "Salvador Dali"
    ],
    "correctAnswer": "Vincent van Gogh",
    "explanation": "Vincent van Gogh painted 'The Starry Night' in 1889.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_literature_arts",
    "checksum": "knowledge_v1_090"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What molecule carries genetic instructions in living organisms?",
    "options": [
      "Glucose",
      "DNA",
      "Chlorophyll",
      "Hemoglobin"
    ],
    "correctAnswer": "DNA",
    "explanation": "DNA stores hereditary genetic information in living organisms.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_091"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "What is the name of the galaxy that contains our solar system?",
    "options": [
      "Andromeda",
      "Triangulum",
      "Milky Way",
      "Sombrero"
    ],
    "correctAnswer": "Milky Way",
    "explanation": "Our solar system is located in the Milky Way galaxy.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_092"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which language is the most widely spoken native language in the world?",
    "options": [
      "English",
      "Spanish",
      "Hindi",
      "Mandarin Chinese"
    ],
    "correctAnswer": "Mandarin Chinese",
    "explanation": "Mandarin Chinese has the largest number of native speakers.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_common_knowledge",
    "checksum": "knowledge_v1_093"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who invented the World Wide Web?",
    "options": [
      "Bill Gates",
      "Tim Berners-Lee",
      "Steve Jobs",
      "Vint Cerf"
    ],
    "correctAnswer": "Tim Berners-Lee",
    "explanation": "Tim Berners-Lee created the World Wide Web while working at CERN.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_094"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered radioactivity?",
    "options": [
      "Marie Curie",
      "Henri Becquerel",
      "Ernest Rutherford",
      "Wilhelm Roentgen"
    ],
    "correctAnswer": "Henri Becquerel",
    "explanation": "Henri Becquerel discovered natural radioactivity in uranium salts in 1896.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_095"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "What does Newton's law of universal gravitation describe?",
    "options": [
      "Flow of electric current",
      "Expansion of gases",
      "Reflection of light",
      "Attraction between masses"
    ],
    "correctAnswer": "Attraction between masses",
    "explanation": "Newton's law states that masses attract each other with a gravitational force.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_096"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which part of the brain is most associated with balance and coordination?",
    "options": [
      "Cerebrum",
      "Medulla oblongata",
      "Hypothalamus",
      "Cerebellum"
    ],
    "correctAnswer": "Cerebellum",
    "explanation": "The cerebellum helps coordinate movement, posture, and balance.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_097"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which planet rotates on its side compared with most other planets?",
    "options": [
      "Uranus",
      "Mars",
      "Mercury",
      "Jupiter"
    ],
    "correctAnswer": "Uranus",
    "explanation": "Uranus has an axial tilt of about 98 degrees, making it appear to rotate on its side.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_098"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which desert is the largest hot desert in the world?",
    "options": [
      "Sahara Desert",
      "Gobi Desert",
      "Kalahari Desert",
      "Arabian Desert"
    ],
    "correctAnswer": "Sahara Desert",
    "explanation": "The Sahara is the largest hot desert on Earth.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_geography",
    "checksum": "knowledge_v1_099"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who wrote 'Pride and Prejudice'?",
    "options": [
      "Jane Austen",
      "Emily Bronte",
      "Mary Shelley",
      "Virginia Woolf"
    ],
    "correctAnswer": "Jane Austen",
    "explanation": "Jane Austen's 'Pride and Prejudice' was published in 1813.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_literature_arts",
    "checksum": "knowledge_v1_100"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "What is a light-year a measure of?",
    "options": [
      "Distance",
      "Time",
      "Brightness",
      "Mass"
    ],
    "correctAnswer": "Distance",
    "explanation": "A light-year is the distance light travels in one year.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_101"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which continent has the most countries?",
    "options": [
      "Europe",
      "Asia",
      "South America",
      "Africa"
    ],
    "correctAnswer": "Africa",
    "explanation": "Africa has more sovereign countries than any other continent.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_common_knowledge",
    "checksum": "knowledge_v1_102"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who is credited with inventing the first successful airplane with powered flight?",
    "options": [
      "Charles Lindbergh",
      "The Wright brothers",
      "Gustave Eiffel",
      "Leonardo da Vinci"
    ],
    "correctAnswer": "The Wright brothers",
    "explanation": "Orville and Wilbur Wright achieved controlled powered flight in 1903.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_103"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who formulated the laws of planetary motion?",
    "options": [
      "Galileo Galilei",
      "Isaac Newton",
      "Tycho Brahe",
      "Johannes Kepler"
    ],
    "correctAnswer": "Johannes Kepler",
    "explanation": "Johannes Kepler described planetary motion using three mathematical laws.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_104"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Boyle's law describes the relationship between pressure and volume for a gas when which quantity is constant?",
    "options": [
      "Mass density only",
      "Electric charge",
      "Humidity",
      "Temperature"
    ],
    "correctAnswer": "Temperature",
    "explanation": "Boyle's law applies to a fixed amount of gas at constant temperature.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_105"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "What is the main function of the lungs?",
    "options": [
      "Gas exchange",
      "Blood filtration",
      "Hormone production",
      "Food digestion"
    ],
    "correctAnswer": "Gas exchange",
    "explanation": "The lungs exchange oxygen and carbon dioxide between air and blood.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_106"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which substance is harder on the Mohs scale: diamond or quartz?",
    "options": [
      "Quartz",
      "Diamond",
      "They are equal",
      "Neither has a Mohs hardness"
    ],
    "correctAnswer": "Diamond",
    "explanation": "Diamond has a Mohs hardness of 10, while quartz has a hardness of 7.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_107"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the chemical formula for table salt?",
    "options": [
      "KCl",
      "NaCl",
      "NaOH",
      "CaCO3"
    ],
    "correctAnswer": "NaCl",
    "explanation": "Table salt is sodium chloride, written chemically as NaCl.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_108"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which country is both a continent and a country?",
    "options": [
      "Greenland",
      "Madagascar",
      "Australia",
      "New Zealand"
    ],
    "correctAnswer": "Australia",
    "explanation": "Australia is commonly recognized as both a country and a continent.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_geography",
    "checksum": "knowledge_v1_109"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The Magna Carta was signed in which year?",
    "options": [
      "1066",
      "1215",
      "1492",
      "1776"
    ],
    "correctAnswer": "1215",
    "explanation": "King John of England agreed to the Magna Carta in 1215.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_history",
    "checksum": "knowledge_v1_110"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which ancient Greek poet is traditionally credited with composing the 'Iliad' and the 'Odyssey'?",
    "options": [
      "Homer",
      "Sophocles",
      "Virgil",
      "Aristophanes"
    ],
    "correctAnswer": "Homer",
    "explanation": "Homer is traditionally credited with the 'Iliad' and the 'Odyssey.'",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_111"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What is the basic unit of life?",
    "options": [
      "Atom",
      "Cell",
      "Tissue",
      "Organ"
    ],
    "correctAnswer": "Cell",
    "explanation": "Cells are the smallest units that carry out the functions of life.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_112"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "Which planet is the largest in our solar system?",
    "options": [
      "Saturn",
      "Jupiter",
      "Neptune",
      "Earth"
    ],
    "correctAnswer": "Jupiter",
    "explanation": "Jupiter is the largest planet by mass and diameter in the solar system.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_113"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which scientist built an early practical radio communication system?",
    "options": [
      "Alexander Fleming",
      "James Clerk Maxwell",
      "Alessandro Volta",
      "Guglielmo Marconi"
    ],
    "correctAnswer": "Guglielmo Marconi",
    "explanation": "Marconi is known for developing practical wireless radio communication.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_114"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered the neutron?",
    "options": [
      "James Chadwick",
      "J. J. Thomson",
      "Ernest Rutherford",
      "Max Planck"
    ],
    "correctAnswer": "James Chadwick",
    "explanation": "James Chadwick discovered the neutron in 1932.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_115"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "What does the second law of thermodynamics say about entropy in an isolated system?",
    "options": [
      "It always becomes zero",
      "It tends to increase",
      "It turns into mass",
      "It remains negative"
    ],
    "correctAnswer": "It tends to increase",
    "explanation": "The second law states that entropy of an isolated system tends not to decrease.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_laws_of_universe",
    "checksum": "knowledge_v1_116"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which vitamin is produced in human skin when exposed to sunlight?",
    "options": [
      "Vitamin C",
      "Vitamin B12",
      "Vitamin D",
      "Vitamin K"
    ],
    "correctAnswer": "Vitamin D",
    "explanation": "Sunlight helps the skin produce vitamin D.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_117"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "What is the only continent with no native species of ants?",
    "options": [
      "Europe",
      "Australia",
      "North America",
      "Antarctica"
    ],
    "correctAnswer": "Antarctica",
    "explanation": "Antarctica has no native ant species because of its extreme cold environment.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_118"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "Which scientist developed the general theory of relativity?",
    "options": [
      "Albert Einstein",
      "Isaac Newton",
      "Niels Bohr",
      "Galileo Galilei"
    ],
    "correctAnswer": "Albert Einstein",
    "explanation": "Albert Einstein published the general theory of relativity in 1915.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_119"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which mountain range separates Europe and Asia in the traditional geographic boundary?",
    "options": [
      "Alps",
      "Himalayas",
      "Ural Mountains",
      "Andes"
    ],
    "correctAnswer": "Ural Mountains",
    "explanation": "The Ural Mountains are commonly used as part of the boundary between Europe and Asia.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_120"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which event began in 1789 and led to major political change in France?",
    "options": [
      "Industrial Revolution",
      "French Revolution",
      "Russian Revolution",
      "Glorious Revolution"
    ],
    "correctAnswer": "French Revolution",
    "explanation": "The French Revolution began in 1789 and transformed French politics and society.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_121"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who composed the 'Four Seasons' violin concertos?",
    "options": [
      "Johann Sebastian Bach",
      "Wolfgang Amadeus Mozart",
      "Antonio Vivaldi",
      "Ludwig van Beethoven"
    ],
    "correctAnswer": "Antonio Vivaldi",
    "explanation": "Antonio Vivaldi composed 'The Four Seasons' in the early 18th century.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_122"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "Which part of a plant absorbs most water and minerals from the soil?",
    "options": [
      "Roots",
      "Leaves",
      "Flowers",
      "Stem bark"
    ],
    "correctAnswer": "Roots",
    "explanation": "Roots absorb water and minerals and help anchor the plant.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_123"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "What causes the phases of the Moon?",
    "options": [
      "Earth's shadow covering the Moon every night",
      "The Moon changing its own shape",
      "The changing view of the Moon's sunlit half",
      "Clouds blocking part of the Moon"
    ],
    "correctAnswer": "The changing view of the Moon's sunlit half",
    "explanation": "Moon phases occur as we see different portions of its sunlit side during its orbit.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_astronomy",
    "checksum": "knowledge_v1_124"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which instrument is used to measure temperature?",
    "options": [
      "Barometer",
      "Hygrometer",
      "Anemometer",
      "Thermometer"
    ],
    "correctAnswer": "Thermometer",
    "explanation": "A thermometer measures temperature.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_125"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who invented dynamite?",
    "options": [
      "Marie Curie",
      "Alfred Nobel",
      "Robert Fulton",
      "Eli Whitney"
    ],
    "correctAnswer": "Alfred Nobel",
    "explanation": "Alfred Nobel patented dynamite in 1867.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_126"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Which scientist is known for discovering the circulation of blood in the human body?",
    "options": [
      "William Harvey",
      "Andreas Vesalius",
      "Hippocrates",
      "Edward Jenner"
    ],
    "correctAnswer": "William Harvey",
    "explanation": "William Harvey described the systemic circulation of blood in the 17th century.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_discoveries",
    "checksum": "knowledge_v1_127"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Hooke's law describes the force needed to extend or compress which kind of object?",
    "options": [
      "A spinning planet",
      "A chemical battery",
      "An elastic spring",
      "A sound wave"
    ],
    "correctAnswer": "An elastic spring",
    "explanation": "Hooke's law states that force is proportional to displacement for an elastic spring within its limit.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_128"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "What is the name of the pigment that gives human skin, hair, and eyes much of their color?",
    "options": [
      "Keratin",
      "Collagen",
      "Melanin",
      "Insulin"
    ],
    "correctAnswer": "Melanin",
    "explanation": "Melanin is a pigment responsible for much of the color in skin, hair, and eyes.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_129"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which metal is liquid at room temperature?",
    "options": [
      "Mercury",
      "Aluminum",
      "Copper",
      "Iron"
    ],
    "correctAnswer": "Mercury",
    "explanation": "Mercury is a metal that is liquid at typical room temperatures.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_130"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which country has the city of Machu Picchu?",
    "options": [
      "Mexico",
      "Peru",
      "Chile",
      "Colombia"
    ],
    "correctAnswer": "Peru",
    "explanation": "Machu Picchu is an Inca site located in Peru.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_geography",
    "checksum": "knowledge_v1_131"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which wall was built by the Romans across northern Britain?",
    "options": [
      "Hadrian's Wall",
      "Great Wall of China",
      "Antonine Wall",
      "Berlin Wall"
    ],
    "correctAnswer": "Hadrian's Wall",
    "explanation": "Hadrian's Wall was constructed under the Roman emperor Hadrian.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_history",
    "checksum": "knowledge_v1_132"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which Spanish artist painted 'Guernica'?",
    "options": [
      "Diego Velazquez",
      "Pablo Picasso",
      "Francisco Goya",
      "Joan Miro"
    ],
    "correctAnswer": "Pablo Picasso",
    "explanation": "Pablo Picasso painted 'Guernica' in response to the bombing of Guernica in 1937.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_133"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "Which kingdom do mushrooms belong to?",
    "options": [
      "Plants",
      "Fungi",
      "Animals",
      "Protists"
    ],
    "correctAnswer": "Fungi",
    "explanation": "Mushrooms are fungi, not plants.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_134"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "What is the term for a star explosion that can briefly outshine an entire galaxy?",
    "options": [
      "Comet",
      "Supernova",
      "Nebula",
      "Quasar"
    ],
    "correctAnswer": "Supernova",
    "explanation": "A supernova is a powerful stellar explosion.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_astronomy",
    "checksum": "knowledge_v1_135"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which gas do humans primarily breathe in to survive?",
    "options": [
      "Nitrogen",
      "Carbon dioxide",
      "Helium",
      "Oxygen"
    ],
    "correctAnswer": "Oxygen",
    "explanation": "Humans need oxygen for cellular respiration.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_136"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who developed the first effective smallpox vaccine?",
    "options": [
      "Louis Pasteur",
      "Joseph Lister",
      "Edward Jenner",
      "Alexander Fleming"
    ],
    "correctAnswer": "Edward Jenner",
    "explanation": "Edward Jenner developed the smallpox vaccine in 1796.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_137"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered X-rays?",
    "options": [
      "Max Planck",
      "Niels Bohr",
      "Enrico Fermi",
      "Wilhelm Roentgen"
    ],
    "correctAnswer": "Wilhelm Roentgen",
    "explanation": "Wilhelm Roentgen discovered X-rays in 1895.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_138"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Kepler's first law says that planets move around the Sun in what shape of orbit?",
    "options": [
      "Perfect circle",
      "Parabola",
      "Straight line",
      "Ellipse"
    ],
    "correctAnswer": "Ellipse",
    "explanation": "Kepler's first law states that planetary orbits are ellipses with the Sun at one focus.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_laws_of_universe",
    "checksum": "knowledge_v1_139"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which type of teeth are mainly used for cutting food?",
    "options": [
      "Molars",
      "Canines",
      "Premolars",
      "Incisors"
    ],
    "correctAnswer": "Incisors",
    "explanation": "Incisors are the front teeth used mainly for cutting.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_140"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which animal has a blue tongue and is the tallest living land animal?",
    "options": [
      "Elephant",
      "Camel",
      "Giraffe",
      "Moose"
    ],
    "correctAnswer": "Giraffe",
    "explanation": "Giraffes are the tallest living land animals and have dark bluish tongues.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_141"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What type of energy is stored in a stretched rubber band?",
    "options": [
      "Nuclear energy",
      "Elastic potential energy",
      "Thermal energy",
      "Chemical energy"
    ],
    "correctAnswer": "Elastic potential energy",
    "explanation": "A stretched rubber band stores energy because of its elastic deformation.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_science",
    "checksum": "knowledge_v1_142"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which strait separates Spain from Morocco?",
    "options": [
      "Bering Strait",
      "Strait of Hormuz",
      "Strait of Gibraltar",
      "Bosporus Strait"
    ],
    "correctAnswer": "Strait of Gibraltar",
    "explanation": "The Strait of Gibraltar links the Atlantic Ocean and Mediterranean Sea and separates Spain from Morocco.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_143"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which ancient trade route connected China with the Mediterranean world?",
    "options": [
      "Amber Road",
      "Appian Way",
      "Trans-Saharan Route",
      "Silk Road"
    ],
    "correctAnswer": "Silk Road",
    "explanation": "The Silk Road was a network of trade routes linking East Asia and the Mediterranean.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_144"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who wrote 'The Divine Comedy'?",
    "options": [
      "Geoffrey Chaucer",
      "Miguel de Cervantes",
      "John Milton",
      "Dante Alighieri"
    ],
    "correctAnswer": "Dante Alighieri",
    "explanation": "Dante Alighieri wrote 'The Divine Comedy' in the early 14th century.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_145"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What is the largest living species of lizard?",
    "options": [
      "Iguana",
      "Gila monster",
      "Monitor lizard",
      "Komodo dragon"
    ],
    "correctAnswer": "Komodo dragon",
    "explanation": "The Komodo dragon is the largest living lizard species.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_biology",
    "checksum": "knowledge_v1_146"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "Which planet is closest to the Sun?",
    "options": [
      "Venus",
      "Earth",
      "Mars",
      "Mercury"
    ],
    "correctAnswer": "Mercury",
    "explanation": "Mercury is the innermost planet in the solar system.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_147"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the Roman numeral for 50?",
    "options": [
      "C",
      "X",
      "V",
      "L"
    ],
    "correctAnswer": "L",
    "explanation": "In Roman numerals, L represents 50.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_common_knowledge",
    "checksum": "knowledge_v1_148"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which inventor is associated with the cotton gin?",
    "options": [
      "Robert Fulton",
      "Samuel Colt",
      "Eli Whitney",
      "Cyrus McCormick"
    ],
    "correctAnswer": "Eli Whitney",
    "explanation": "Eli Whitney patented the cotton gin in 1794.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_149"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who identified the structure of DNA with Francis Crick?",
    "options": [
      "Linus Pauling",
      "James Watson",
      "Gregor Mendel",
      "Louis Pasteur"
    ],
    "correctAnswer": "James Watson",
    "explanation": "James Watson and Francis Crick proposed the double-helix structure of DNA in 1953.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_150"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "In Einstein's equation E = mc^2, what does c represent?",
    "options": [
      "Electric charge",
      "Heat capacity",
      "Speed of light",
      "Gravitational constant"
    ],
    "correctAnswer": "Speed of light",
    "explanation": "In E = mc^2, c is the speed of light in a vacuum.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_151"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which human sense is primarily associated with the cochlea?",
    "options": [
      "Taste",
      "Smell",
      "Touch",
      "Hearing"
    ],
    "correctAnswer": "Hearing",
    "explanation": "The cochlea is a spiral-shaped structure in the inner ear involved in hearing.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_152"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which natural substance is made by bees from flower nectar?",
    "options": [
      "Maple syrup",
      "Molasses",
      "Sap",
      "Honey"
    ],
    "correctAnswer": "Honey",
    "explanation": "Bees convert nectar into honey and store it in honeycombs.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_153"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "Which scientist formulated the laws of motion and universal gravitation in the 17th century?",
    "options": [
      "Isaac Newton",
      "Albert Einstein",
      "Galileo Galilei",
      "Michael Faraday"
    ],
    "correctAnswer": "Isaac Newton",
    "explanation": "Newton published his laws of motion and law of universal gravitation in Principia Mathematica in 1687.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_physics",
    "checksum": "knowledge_v1_154"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Newton's first law of motion is also known as the law of what?",
    "options": [
      "Inertia",
      "Acceleration",
      "Entropy",
      "Conservation of charge"
    ],
    "correctAnswer": "Inertia",
    "explanation": "Newton's first law states that objects remain at rest or in uniform motion unless acted on by a net external force.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_laws_of_universe",
    "checksum": "knowledge_v1_155"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What molecule carries genetic information in most living organisms?",
    "options": [
      "ATP",
      "DNA",
      "Glucose",
      "Hemoglobin"
    ],
    "correctAnswer": "DNA",
    "explanation": "DNA stores hereditary information used for development, function, and reproduction.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_156"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "Which planet is known for its prominent ring system?",
    "options": [
      "Mars",
      "Venus",
      "Mercury",
      "Saturn"
    ],
    "correctAnswer": "Saturn",
    "explanation": "Saturn has the most extensive and easily visible ring system in the Solar System.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_157"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What is the value of pi rounded to two decimal places?",
    "options": [
      "2.72",
      "3.14",
      "1.62",
      "4.13"
    ],
    "correctAnswer": "3.14",
    "explanation": "Pi is the ratio of a circle's circumference to its diameter, approximately 3.14159.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_mathematics",
    "checksum": "knowledge_v1_158"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who is credited with discovering penicillin in 1928?",
    "options": [
      "Louis Pasteur",
      "Robert Koch",
      "Alexander Fleming",
      "Joseph Lister"
    ],
    "correctAnswer": "Alexander Fleming",
    "explanation": "Fleming observed that a Penicillium mold inhibited bacterial growth.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_discoveries",
    "checksum": "knowledge_v1_159"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who is commonly credited with inventing the World Wide Web?",
    "options": [
      "Tim Berners-Lee",
      "Alan Turing",
      "Vint Cerf",
      "Steve Wozniak"
    ],
    "correctAnswer": "Tim Berners-Lee",
    "explanation": "Tim Berners-Lee created the World Wide Web at CERN in 1989–1990.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_160"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the standard SI unit of electric current?",
    "options": [
      "Volt",
      "Ohm",
      "Ampere",
      "Watt"
    ],
    "correctAnswer": "Ampere",
    "explanation": "The ampere is the SI base unit for electric current.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_161"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "What does Einstein's equation E = mc^2 express?",
    "options": [
      "Universal gravitation",
      "Mass-energy equivalence",
      "Ohm's law",
      "Thermal expansion"
    ],
    "correctAnswer": "Mass-energy equivalence",
    "explanation": "The equation states that mass and energy are equivalent, with c as the speed of light.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_physics",
    "checksum": "knowledge_v1_162"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "What is the pH of a neutral aqueous solution at 25°C?",
    "options": [
      "7",
      "0",
      "1",
      "14"
    ],
    "correctAnswer": "7",
    "explanation": "At 25°C, pure water is neutral with a pH of 7.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_chemistry",
    "checksum": "knowledge_v1_163"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "What scale is commonly used to measure the magnitude of earthquakes?",
    "options": [
      "Richter scale",
      "Beaufort scale",
      "Mohs scale",
      "Celsius scale"
    ],
    "correctAnswer": "Richter scale",
    "explanation": "The Richter scale historically measured earthquake magnitude; modern scales are related and more precise.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_earth_science",
    "checksum": "knowledge_v1_164"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered that Earth orbits the Sun as part of a heliocentric model?",
    "options": [
      "Ptolemy",
      "Nicolaus Copernicus",
      "Tycho Brahe",
      "Aristotle"
    ],
    "correctAnswer": "Nicolaus Copernicus",
    "explanation": "Copernicus proposed a heliocentric model in which Earth and other planets orbit the Sun.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_discoveries",
    "checksum": "knowledge_v1_165"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "What principle states that energy cannot be created or destroyed in an isolated system?",
    "options": [
      "Pauli exclusion principle",
      "Hubble's law",
      "Le Chatelier's principle",
      "Conservation of energy"
    ],
    "correctAnswer": "Conservation of energy",
    "explanation": "The conservation of energy says total energy remains constant in an isolated system.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_laws_of_universe",
    "checksum": "knowledge_v1_166"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which early electronic general-purpose computer was completed in the United States in 1945?",
    "options": [
      "UNIVAC I",
      "Colossus",
      "ENIAC",
      "Apple II"
    ],
    "correctAnswer": "ENIAC",
    "explanation": "ENIAC was completed in 1945 and is one of the earliest general-purpose electronic computers.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_167"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "Which law states that the current through a conductor is proportional to the voltage across it, assuming constant temperature?",
    "options": [
      "Faraday's law",
      "Boyle's law",
      "Hooke's law",
      "Ohm's law"
    ],
    "correctAnswer": "Ohm's law",
    "explanation": "Ohm's law is commonly written as V = IR.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_physics",
    "checksum": "knowledge_v1_168"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What process do plants use to convert light energy into chemical energy?",
    "options": [
      "Photosynthesis",
      "Fermentation",
      "Respiration",
      "Transpiration"
    ],
    "correctAnswer": "Photosynthesis",
    "explanation": "Photosynthesis converts light, carbon dioxide, and water into sugars and oxygen.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_169"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "Which galaxy contains our Solar System?",
    "options": [
      "Andromeda",
      "Triangulum",
      "Milky Way",
      "Whirlpool"
    ],
    "correctAnswer": "Milky Way",
    "explanation": "The Solar System is located in the Milky Way galaxy.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_170"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "In geometry, what is the sum of the interior angles of a triangle?",
    "options": [
      "180 degrees",
      "90 degrees",
      "270 degrees",
      "360 degrees"
    ],
    "correctAnswer": "180 degrees",
    "explanation": "In Euclidean geometry, a triangle's interior angles sum to 180 degrees.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_mathematics",
    "checksum": "knowledge_v1_171"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "What type of rock forms from cooled and solidified magma or lava?",
    "options": [
      "Igneous rock",
      "Sedimentary rock",
      "Metamorphic rock",
      "Evaporite rock"
    ],
    "correctAnswer": "Igneous rock",
    "explanation": "Igneous rocks form when molten rock cools and solidifies.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_earth_science",
    "checksum": "knowledge_v1_172"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Which pair is credited with identifying the double-helix structure of DNA in 1953?",
    "options": [
      "Charles Darwin and Alfred Russel Wallace",
      "James Watson and Francis Crick",
      "Marie Curie and Pierre Curie",
      "Gregor Mendel and Hugo de Vries"
    ],
    "correctAnswer": "James Watson and Francis Crick",
    "explanation": "Watson and Crick proposed the DNA double helix, using key X-ray diffraction evidence from Rosalind Franklin and Maurice Wilkins.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_173"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who invented the practical telephone and received a U.S. patent for it in 1876?",
    "options": [
      "Alexander Graham Bell",
      "Thomas Edison",
      "Nikola Tesla",
      "Guglielmo Marconi"
    ],
    "correctAnswer": "Alexander Graham Bell",
    "explanation": "Bell received a U.S. patent for the telephone in 1876.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_174"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Which law describes the relationship between gas pressure and volume at constant temperature?",
    "options": [
      "Charles's law",
      "Avogadro's law",
      "Dalton's law",
      "Boyle's law"
    ],
    "correctAnswer": "Boyle's law",
    "explanation": "Boyle's law states that pressure and volume are inversely proportional for a fixed amount of gas at constant temperature.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_175"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the SI unit of temperature?",
    "options": [
      "Kelvin",
      "Celsius",
      "Fahrenheit",
      "Joule"
    ],
    "correctAnswer": "Kelvin",
    "explanation": "The kelvin is the SI base unit of thermodynamic temperature.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_176"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "What type of electromagnetic radiation has the shortest wavelength among these options?",
    "options": [
      "Microwaves",
      "Gamma rays",
      "Radio waves",
      "Infrared radiation"
    ],
    "correctAnswer": "Gamma rays",
    "explanation": "Gamma rays have shorter wavelengths and higher frequencies than the other listed forms.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_physics",
    "checksum": "knowledge_v1_177"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "What is the main gas produced when an acid reacts with a carbonate?",
    "options": [
      "Hydrogen",
      "Oxygen",
      "Carbon dioxide",
      "Nitrogen"
    ],
    "correctAnswer": "Carbon dioxide",
    "explanation": "Acids reacting with carbonates typically produce a salt, water, and carbon dioxide.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_chemistry",
    "checksum": "knowledge_v1_178"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "Which scientist is known as the father of genetics for his pea plant experiments?",
    "options": [
      "Charles Darwin",
      "Gregor Mendel",
      "Louis Pasteur",
      "Carl Linnaeus"
    ],
    "correctAnswer": "Gregor Mendel",
    "explanation": "Mendel discovered basic inheritance patterns through experiments with pea plants.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_biology",
    "checksum": "knowledge_v1_179"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "Which planet is the largest in the Solar System?",
    "options": [
      "Saturn",
      "Jupiter",
      "Neptune",
      "Earth"
    ],
    "correctAnswer": "Jupiter",
    "explanation": "Jupiter is the largest planet by mass and diameter in the Solar System.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_180"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What is the name of a number greater than 1 that has no positive divisors other than 1 and itself?",
    "options": [
      "Prime number",
      "Composite number",
      "Rational number",
      "Even number"
    ],
    "correctAnswer": "Prime number",
    "explanation": "A prime number has exactly two positive divisors: 1 and itself.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_mathematics",
    "checksum": "knowledge_v1_181"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "What is the rigid outer layer of Earth called?",
    "options": [
      "Asthenosphere",
      "Lithosphere",
      "Mesosphere",
      "Outer core"
    ],
    "correctAnswer": "Lithosphere",
    "explanation": "The lithosphere includes Earth's crust and the uppermost rigid mantle.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_earth_science",
    "checksum": "knowledge_v1_182"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered radioactivity in 1896?",
    "options": [
      "Henri Becquerel",
      "Marie Curie",
      "Ernest Rutherford",
      "Niels Bohr"
    ],
    "correctAnswer": "Henri Becquerel",
    "explanation": "Becquerel discovered natural radioactivity while studying uranium salts.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_183"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who developed the first successful polio vaccine introduced in the 1950s?",
    "options": [
      "Edward Jenner",
      "Jonas Salk",
      "Alexander Fleming",
      "Robert Koch"
    ],
    "correctAnswer": "Jonas Salk",
    "explanation": "Jonas Salk developed the inactivated polio vaccine, announced as effective in 1955.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_184"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Kepler's first law says that planets move around the Sun in what kind of paths?",
    "options": [
      "Perfect circles",
      "Parabolas only",
      "Straight lines",
      "Ellipses"
    ],
    "correctAnswer": "Ellipses",
    "explanation": "Kepler's first law states that planetary orbits are ellipses with the Sun at one focus.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_185"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which ancient Greek mathematician is associated with a theorem about right triangles?",
    "options": [
      "Euclid",
      "Archimedes",
      "Eratosthenes",
      "Pythagoras"
    ],
    "correctAnswer": "Pythagoras",
    "explanation": "The Pythagorean theorem relates the sides of a right triangle: a^2 + b^2 = c^2.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_186"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "What particle has a negative electric charge and is found outside the atomic nucleus?",
    "options": [
      "Proton",
      "Neutron",
      "Electron",
      "Alpha particle"
    ],
    "correctAnswer": "Electron",
    "explanation": "Electrons are negatively charged particles surrounding the nucleus.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_physics",
    "checksum": "knowledge_v1_187"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "Which scientist arranged the periodic table by atomic properties and predicted undiscovered elements?",
    "options": [
      "Antoine Lavoisier",
      "Dmitri Mendeleev",
      "John Dalton",
      "Robert Boyle"
    ],
    "correctAnswer": "Dmitri Mendeleev",
    "explanation": "Mendeleev created a periodic table that left gaps for elements later discovered.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_chemistry",
    "checksum": "knowledge_v1_188"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What branch of mathematics studies rates of change and accumulation using derivatives and integrals?",
    "options": [
      "Geometry",
      "Number theory",
      "Topology",
      "Calculus"
    ],
    "correctAnswer": "Calculus",
    "explanation": "Calculus deals with derivatives, integrals, limits, and continuous change.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_mathematics",
    "checksum": "knowledge_v1_189"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "What is the name of the supercontinent that existed before breaking apart into today's continents?",
    "options": [
      "Gondwana",
      "Laurasia",
      "Rodinia",
      "Pangaea"
    ],
    "correctAnswer": "Pangaea",
    "explanation": "Pangaea was a late Paleozoic and early Mesozoic supercontinent that later fragmented.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_earth_science",
    "checksum": "knowledge_v1_190"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered the electron in 1897?",
    "options": [
      "Ernest Rutherford",
      "J. J. Thomson",
      "James Chadwick",
      "Max Planck"
    ],
    "correctAnswer": "J. J. Thomson",
    "explanation": "J. J. Thomson identified the electron through cathode ray experiments.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_191"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who is widely credited with inventing the first practical incandescent light bulb?",
    "options": [
      "Benjamin Franklin",
      "James Watt",
      "Thomas Edison",
      "Samuel Morse"
    ],
    "correctAnswer": "Thomas Edison",
    "explanation": "Edison developed a commercially practical incandescent lamp system in the late 19th century.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_192"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "The second law of thermodynamics is most closely associated with the increase of what in isolated systems?",
    "options": [
      "Velocity",
      "Electric charge",
      "Entropy",
      "Momentum"
    ],
    "correctAnswer": "Entropy",
    "explanation": "The second law states that entropy tends to increase in an isolated system.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_193"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the scientific method's usual first step when investigating a phenomenon?",
    "options": [
      "Publish a conclusion",
      "Make an observation",
      "Ignore variables",
      "Choose the desired result"
    ],
    "correctAnswer": "Make an observation",
    "explanation": "Scientific investigation commonly begins with observing a phenomenon and asking a question.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_194"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "What is the speed of light in a vacuum approximately?",
    "options": [
      "30,000 kilometers per second",
      "300,000 kilometers per second",
      "3,000 kilometers per second",
      "300 kilometers per second"
    ],
    "correctAnswer": "300,000 kilometers per second",
    "explanation": "Light travels in vacuum at about 299,792 kilometers per second.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_physics",
    "checksum": "knowledge_v1_195"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "What type of chemical bond involves the sharing of electron pairs between atoms?",
    "options": [
      "Covalent bond",
      "Ionic bond",
      "Metallic bond",
      "Hydrogen bond"
    ],
    "correctAnswer": "Covalent bond",
    "explanation": "Covalent bonds form when atoms share pairs of electrons.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_chemistry",
    "checksum": "knowledge_v1_196"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "What force primarily keeps planets in orbit around the Sun?",
    "options": [
      "Magnetism",
      "Gravity",
      "Friction",
      "Nuclear force"
    ],
    "correctAnswer": "Gravity",
    "explanation": "The Sun's gravity provides the centripetal force that keeps planets in orbit.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_astronomy",
    "checksum": "knowledge_v1_197"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What is 2 raised to the power of 10?",
    "options": [
      "1024",
      "512",
      "1000",
      "2048"
    ],
    "correctAnswer": "1024",
    "explanation": "2^10 equals 1024.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_mathematics",
    "checksum": "knowledge_v1_198"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "What is the process by which water vapor changes into liquid water?",
    "options": [
      "Condensation",
      "Evaporation",
      "Sublimation",
      "Deposition"
    ],
    "correctAnswer": "Condensation",
    "explanation": "Condensation occurs when water vapor cools and becomes liquid.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_earth_science",
    "checksum": "knowledge_v1_199"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered the neutron in 1932?",
    "options": [
      "Niels Bohr",
      "Enrico Fermi",
      "Werner Heisenberg",
      "James Chadwick"
    ],
    "correctAnswer": "James Chadwick",
    "explanation": "James Chadwick discovered the neutron, a neutral particle in the atomic nucleus.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_200"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who invented the first practical steam engine for pumping water from mines in 1712?",
    "options": [
      "James Watt",
      "George Stephenson",
      "Thomas Newcomen",
      "Robert Fulton"
    ],
    "correctAnswer": "Thomas Newcomen",
    "explanation": "Newcomen built an early practical atmospheric steam engine used for pumping water.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_inventions",
    "checksum": "knowledge_v1_201"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Which principle states that no two electrons in an atom can have the same set of four quantum numbers?",
    "options": [
      "Uncertainty principle",
      "Correspondence principle",
      "Pauli exclusion principle",
      "Equivalence principle"
    ],
    "correctAnswer": "Pauli exclusion principle",
    "explanation": "The Pauli exclusion principle explains electron arrangements in atoms.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_laws_of_universe",
    "checksum": "knowledge_v1_202"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which scientist introduced the system of binomial nomenclature for naming organisms?",
    "options": [
      "Gregor Mendel",
      "Carl Linnaeus",
      "Alfred Wegener",
      "Antonie van Leeuwenhoek"
    ],
    "correctAnswer": "Carl Linnaeus",
    "explanation": "Linnaeus formalized the two-part Latin naming system used in taxonomy.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_203"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "Which fundamental force is responsible for beta decay?",
    "options": [
      "Weak nuclear force",
      "Strong nuclear force",
      "Electromagnetic force",
      "Gravitational force"
    ],
    "correctAnswer": "Weak nuclear force",
    "explanation": "The weak nuclear interaction governs processes such as beta decay.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_physics",
    "checksum": "knowledge_v1_204"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "What is Avogadro's number approximately?",
    "options": [
      "3.00 × 10^8",
      "6.02 × 10^23",
      "9.81 × 10^0",
      "1.60 × 10^-19"
    ],
    "correctAnswer": "6.02 × 10^23",
    "explanation": "Avogadro's number is the number of particles in one mole, about 6.022 × 10^23.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_chemistry",
    "checksum": "knowledge_v1_205"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "What is the function of ribosomes in cells?",
    "options": [
      "DNA replication only",
      "Lipid storage",
      "Photosynthesis",
      "Protein synthesis"
    ],
    "correctAnswer": "Protein synthesis",
    "explanation": "Ribosomes translate messenger RNA into proteins.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_biology",
    "checksum": "knowledge_v1_206"
  },
  {
    "sport": "knowledge",
    "category": "astronomy",
    "question": "What type of celestial object is the Sun?",
    "options": [
      "Main-sequence star",
      "White dwarf",
      "Neutron star",
      "Brown dwarf"
    ],
    "correctAnswer": "Main-sequence star",
    "explanation": "The Sun is a G-type main-sequence star that fuses hydrogen into helium.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_astronomy",
    "checksum": "knowledge_v1_207"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What is the derivative of x^2 with respect to x?",
    "options": [
      "x",
      "x^3",
      "2x",
      "2"
    ],
    "correctAnswer": "2x",
    "explanation": "Using the power rule, d(x^2)/dx = 2x.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_mathematics",
    "checksum": "knowledge_v1_208"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "Which layer of Earth is liquid and surrounds the solid inner core?",
    "options": [
      "Outer core",
      "Mantle",
      "Crust",
      "Lithosphere"
    ],
    "correctAnswer": "Outer core",
    "explanation": "Earth's outer core is liquid iron-nickel alloy surrounding the solid inner core.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_earth_science",
    "checksum": "knowledge_v1_209"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who proposed the theory of continental drift in the early 20th century?",
    "options": [
      "Alfred Wegener",
      "Charles Lyell",
      "James Hutton",
      "Harry Hess"
    ],
    "correctAnswer": "Alfred Wegener",
    "explanation": "Wegener proposed that continents move over geological time, a precursor to plate tectonics.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_210"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who is credited with inventing the first successful airplane with powered, controlled, sustained flight?",
    "options": [
      "Gustave Eiffel",
      "The Wright brothers",
      "Igor Sikorsky",
      "Alberto Santos-Dumont"
    ],
    "correctAnswer": "The Wright brothers",
    "explanation": "Orville and Wilbur Wright achieved powered, controlled, sustained flight in 1903.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_211"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Heisenberg's uncertainty principle states that certain pairs of properties cannot both be known exactly. Which pair is the classic example?",
    "options": [
      "Position and momentum",
      "Mass and charge",
      "Temperature and pressure",
      "Energy and entropy"
    ],
    "correctAnswer": "Position and momentum",
    "explanation": "The principle limits simultaneous precision in measuring position and momentum.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_212"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "Which field of science studies heredity and variation in organisms?",
    "options": [
      "Geology",
      "Optics",
      "Meteorology",
      "Genetics"
    ],
    "correctAnswer": "Genetics",
    "explanation": "Genetics studies genes, heredity, and biological variation.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_213"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "What is the SI unit of energy?",
    "options": [
      "Newton",
      "Joule",
      "Watt",
      "Volt"
    ],
    "correctAnswer": "Joule",
    "explanation": "The joule is the SI unit of energy and work.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_physics",
    "checksum": "knowledge_v1_214"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "Which subatomic particle determines the atomic number of an element?",
    "options": [
      "Neutron",
      "Electron",
      "Photon",
      "Proton"
    ],
    "correctAnswer": "Proton",
    "explanation": "An element's atomic number equals the number of protons in its nucleus.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_chemistry",
    "checksum": "knowledge_v1_215"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What is the binary representation of the decimal number 5?",
    "options": [
      "101",
      "110",
      "100",
      "111"
    ],
    "correctAnswer": "101",
    "explanation": "In binary, 101 equals 4 + 0 + 1, which is 5.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_mathematics",
    "checksum": "knowledge_v1_216"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "What is the study of weather called?",
    "options": [
      "Seismology",
      "Oceanography",
      "Mineralogy",
      "Meteorology"
    ],
    "correctAnswer": "Meteorology",
    "explanation": "Meteorology is the scientific study of the atmosphere and weather.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_earth_science",
    "checksum": "knowledge_v1_217"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who developed the first periodic law, showing that element properties recur periodically?",
    "options": [
      "Marie Curie",
      "Amedeo Avogadro",
      "Dmitri Mendeleev",
      "Linus Pauling"
    ],
    "correctAnswer": "Dmitri Mendeleev",
    "explanation": "Mendeleev recognized periodic patterns in element properties and organized the periodic table.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_218"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which inventor developed the Morse code system with Alfred Vail?",
    "options": [
      "Alexander Graham Bell",
      "Guglielmo Marconi",
      "Samuel Morse",
      "Charles Babbage"
    ],
    "correctAnswer": "Samuel Morse",
    "explanation": "Samuel Morse and Alfred Vail developed the code used for telegraph communication.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_219"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Faraday's law of induction relates a changing magnetic field to what?",
    "options": [
      "A decrease in mass",
      "An induced electromotive force",
      "A rise in entropy only",
      "A gravitational wave"
    ],
    "correctAnswer": "An induced electromotive force",
    "explanation": "Faraday's law states that changing magnetic flux induces an electromotive force.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_220"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which scientist is known for developing the germ theory of disease and pasteurization?",
    "options": [
      "Isaac Newton",
      "Niels Bohr",
      "Edwin Hubble",
      "Louis Pasteur"
    ],
    "correctAnswer": "Louis Pasteur",
    "explanation": "Pasteur's work helped establish germ theory and led to pasteurization.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_221"
  },
  {
    "sport": "knowledge",
    "category": "physics",
    "question": "Which physicist introduced the quantum hypothesis in 1900?",
    "options": [
      "Albert Einstein",
      "Richard Feynman",
      "Erwin Schrödinger",
      "Max Planck"
    ],
    "correctAnswer": "Max Planck",
    "explanation": "Planck proposed that energy is emitted or absorbed in discrete quanta.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_physics",
    "checksum": "knowledge_v1_222"
  },
  {
    "sport": "knowledge",
    "category": "chemistry",
    "question": "What is the common name for sodium chloride?",
    "options": [
      "Baking soda",
      "Vinegar",
      "Bleach",
      "Table salt"
    ],
    "correctAnswer": "Table salt",
    "explanation": "Sodium chloride is the chemical compound commonly known as table salt.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_chemistry",
    "checksum": "knowledge_v1_223"
  },
  {
    "sport": "knowledge",
    "category": "biology",
    "question": "Which process produces gametes with half the usual number of chromosomes?",
    "options": [
      "Mitosis",
      "Binary fission",
      "Budding",
      "Meiosis"
    ],
    "correctAnswer": "Meiosis",
    "explanation": "Meiosis reduces chromosome number by half to form gametes.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_biology",
    "checksum": "knowledge_v1_224"
  },
  {
    "sport": "knowledge",
    "category": "mathematics",
    "question": "What is the base of the natural logarithm?",
    "options": [
      "e",
      "pi",
      "10",
      "2"
    ],
    "correctAnswer": "e",
    "explanation": "The constant e, approximately 2.71828, is the base of natural logarithms.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_mathematics",
    "checksum": "knowledge_v1_225"
  },
  {
    "sport": "knowledge",
    "category": "earth_science",
    "question": "Which mineral is used as the reference for hardness 10 on the Mohs scale?",
    "options": [
      "Quartz",
      "Topaz",
      "Diamond",
      "Corundum"
    ],
    "correctAnswer": "Diamond",
    "explanation": "Diamond is assigned hardness 10, the highest value on the Mohs scale.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_earth_science",
    "checksum": "knowledge_v1_226"
  },
  {
    "sport": "knowledge",
    "category": "discoveries",
    "question": "Who discovered X-rays in 1895?",
    "options": [
      "Henri Becquerel",
      "Wilhelm Röntgen",
      "Marie Curie",
      "J. J. Thomson"
    ],
    "correctAnswer": "Wilhelm Röntgen",
    "explanation": "Röntgen discovered X-rays while experimenting with cathode rays.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_discoveries",
    "checksum": "knowledge_v1_227"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which mathematician and inventor designed the Analytical Engine, an early mechanical general-purpose computer concept?",
    "options": [
      "Alan Turing",
      "Blaise Pascal",
      "Charles Babbage",
      "John von Neumann"
    ],
    "correctAnswer": "Charles Babbage",
    "explanation": "Babbage designed the Analytical Engine in the 19th century, though it was not completed in his lifetime.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_228"
  },
  {
    "sport": "knowledge",
    "category": "laws_of_universe",
    "question": "Hubble's law describes the relationship between a galaxy's distance and what observed property?",
    "options": [
      "Its recessional velocity",
      "Its surface temperature",
      "Its chemical density",
      "Its rotation period"
    ],
    "correctAnswer": "Its recessional velocity",
    "explanation": "Hubble's law states that more distant galaxies recede faster, showing cosmic expansion.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_laws_of_universe",
    "checksum": "knowledge_v1_229"
  },
  {
    "sport": "knowledge",
    "category": "science",
    "question": "What is the SI unit of power?",
    "options": [
      "Joule",
      "Ampere",
      "Coulomb",
      "Watt"
    ],
    "correctAnswer": "Watt",
    "explanation": "The watt is the SI unit of power, equal to one joule per second.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_science",
    "checksum": "knowledge_v1_230"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which ancient civilization built the city of Machu Picchu?",
    "options": [
      "Inca",
      "Aztec",
      "Maya",
      "Olmec"
    ],
    "correctAnswer": "Inca",
    "explanation": "Machu Picchu was built by the Inca civilization in the Andes of present-day Peru.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_231"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which river is traditionally considered the longest in the world?",
    "options": [
      "Nile",
      "Amazon",
      "Yangtze",
      "Mississippi"
    ],
    "correctAnswer": "Nile",
    "explanation": "The Nile is traditionally listed as the world's longest river, though the Amazon is sometimes debated.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_geography",
    "checksum": "knowledge_v1_232"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who wrote the novel 'Pride and Prejudice'?",
    "options": [
      "Charlotte Bronte",
      "Mary Shelley",
      "Jane Austen",
      "George Eliot"
    ],
    "correctAnswer": "Jane Austen",
    "explanation": "Jane Austen published 'Pride and Prejudice' in 1813.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_literature_arts",
    "checksum": "knowledge_v1_233"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which Greek philosopher was the teacher of Aristotle?",
    "options": [
      "Plato",
      "Socrates",
      "Epicurus",
      "Zeno"
    ],
    "correctAnswer": "Plato",
    "explanation": "Aristotle studied at Plato's Academy in Athens for about twenty years.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_234"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "Which language family does Spanish belong to?",
    "options": [
      "Germanic",
      "Slavic",
      "Semitic",
      "Romance"
    ],
    "correctAnswer": "Romance",
    "explanation": "Spanish developed from Latin and is part of the Romance language family.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_235"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "The traditional Japanese tea ceremony is most closely associated with which beverage?",
    "options": [
      "Sake",
      "Matcha",
      "Sencha bottled tea",
      "Barley tea"
    ],
    "correctAnswer": "Matcha",
    "explanation": "The Japanese tea ceremony commonly uses powdered green tea called matcha.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_culture",
    "checksum": "knowledge_v1_236"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which organ in the human body pumps blood through the circulatory system?",
    "options": [
      "Liver",
      "Kidney",
      "Lung",
      "Heart"
    ],
    "correctAnswer": "Heart",
    "explanation": "The heart is the muscular organ that pumps blood throughout the body.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_237"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "How many continents are commonly recognized in the seven-continent model?",
    "options": [
      "Five",
      "Six",
      "Seven",
      "Eight"
    ],
    "correctAnswer": "Seven",
    "explanation": "The seven-continent model includes Africa, Antarctica, Asia, Europe, North America, Australia, and South America.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_238"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which empire was ruled by Augustus, its first emperor?",
    "options": [
      "Byzantine Empire",
      "Persian Empire",
      "Roman Empire",
      "Ottoman Empire"
    ],
    "correctAnswer": "Roman Empire",
    "explanation": "Augustus became the first Roman emperor after the end of the Roman Republic.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_239"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "What is the capital city of Canada?",
    "options": [
      "Toronto",
      "Vancouver",
      "Montreal",
      "Ottawa"
    ],
    "correctAnswer": "Ottawa",
    "explanation": "Ottawa is the capital of Canada.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_geography",
    "checksum": "knowledge_v1_240"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "The phrase 'I think, therefore I am' is associated with which philosopher?",
    "options": [
      "Immanuel Kant",
      "Rene Descartes",
      "David Hume",
      "John Locke"
    ],
    "correctAnswer": "Rene Descartes",
    "explanation": "Descartes expressed this idea as 'Cogito, ergo sum.'",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_241"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "Which writing system is used for modern standard Arabic?",
    "options": [
      "Cyrillic script",
      "Devanagari script",
      "Arabic script",
      "Latin script"
    ],
    "correctAnswer": "Arabic script",
    "explanation": "Modern standard Arabic is written with the Arabic script.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_242"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "Diwali is a major festival associated especially with which religion?",
    "options": [
      "Christianity",
      "Shinto",
      "Hinduism",
      "Judaism"
    ],
    "correctAnswer": "Hinduism",
    "explanation": "Diwali is widely celebrated by Hindus and also by some Sikhs, Jains, and Buddhists.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_culture",
    "checksum": "knowledge_v1_243"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "The movable-type printing press in Europe is most associated with whom?",
    "options": [
      "Isaac Newton",
      "Galileo Galilei",
      "James Watt",
      "Johannes Gutenberg"
    ],
    "correctAnswer": "Johannes Gutenberg",
    "explanation": "Gutenberg developed movable metal type printing in Europe in the 15th century.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_244"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which animal is known for having black-and-white stripes unique to each individual?",
    "options": [
      "Giraffe",
      "Zebra",
      "Panda",
      "Tiger shark"
    ],
    "correctAnswer": "Zebra",
    "explanation": "Zebras have stripe patterns that are unique to individuals.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_245"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which gas do plants absorb from the atmosphere during photosynthesis?",
    "options": [
      "Oxygen",
      "Nitrogen",
      "Carbon dioxide",
      "Helium"
    ],
    "correctAnswer": "Carbon dioxide",
    "explanation": "Plants use carbon dioxide, water, and light energy to produce sugars during photosynthesis.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_246"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The Rosetta Stone was crucial for deciphering which ancient writing system?",
    "options": [
      "Mayan glyphs",
      "Cuneiform",
      "Egyptian hieroglyphs",
      "Linear B"
    ],
    "correctAnswer": "Egyptian hieroglyphs",
    "explanation": "The Rosetta Stone contained parallel texts that helped scholars decode Egyptian hieroglyphs.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_history",
    "checksum": "knowledge_v1_247"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who wrote the epic poem 'The Divine Comedy'?",
    "options": [
      "Virgil",
      "Petrarch",
      "Giovanni Boccaccio",
      "Dante Alighieri"
    ],
    "correctAnswer": "Dante Alighieri",
    "explanation": "Dante Alighieri wrote 'The Divine Comedy' in the early 14th century.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_248"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which Chinese philosopher is associated with the Analects?",
    "options": [
      "Laozi",
      "Mencius",
      "Mozi",
      "Confucius"
    ],
    "correctAnswer": "Confucius",
    "explanation": "The Analects preserve sayings and ideas attributed to Confucius and his disciples.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_249"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "What is the term for a word that reads the same backward and forward?",
    "options": [
      "Homonym",
      "Acronym",
      "Palindrome",
      "Antonym"
    ],
    "correctAnswer": "Palindrome",
    "explanation": "A palindrome has the same sequence of letters forward and backward, such as 'level.'",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_250"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "Which country is the origin of flamenco music and dance?",
    "options": [
      "Portugal",
      "Italy",
      "Spain",
      "Greece"
    ],
    "correctAnswer": "Spain",
    "explanation": "Flamenco developed in southern Spain, especially Andalusia.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_culture",
    "checksum": "knowledge_v1_251"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which scientist proposed the laws of motion and universal gravitation?",
    "options": [
      "Albert Einstein",
      "Charles Darwin",
      "Isaac Newton",
      "Niels Bohr"
    ],
    "correctAnswer": "Isaac Newton",
    "explanation": "Newton formulated the laws of motion and universal gravitation in the 17th century.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_human_knowledge",
    "checksum": "knowledge_v1_252"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who developed the first successful practical telephone exchange system in the late 19th century?",
    "options": [
      "Samuel Morse",
      "Eli Whitney",
      "Alessandro Volta",
      "Tivadar Puskas"
    ],
    "correctAnswer": "Tivadar Puskas",
    "explanation": "Tivadar Puskas is credited with important work on the telephone exchange concept.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_inventions",
    "checksum": "knowledge_v1_253"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which bird is famous for its ability to mimic human speech?",
    "options": [
      "Penguin",
      "Parrot",
      "Ostrich",
      "Swan"
    ],
    "correctAnswer": "Parrot",
    "explanation": "Many parrots can imitate sounds, including human speech.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_fun_facts",
    "checksum": "knowledge_v1_254"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the freezing point of water at standard atmospheric pressure in Celsius?",
    "options": [
      "0°C",
      "10°C",
      "32°C",
      "100°C"
    ],
    "correctAnswer": "0°C",
    "explanation": "At standard atmospheric pressure, pure water freezes at 0 degrees Celsius.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_255"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which city was the capital of the Byzantine Empire for most of its history?",
    "options": [
      "Constantinople",
      "Athens",
      "Rome",
      "Alexandria"
    ],
    "correctAnswer": "Constantinople",
    "explanation": "Constantinople served as the Byzantine capital until its fall in 1453.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_256"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Mount Kilimanjaro is located in which country?",
    "options": [
      "Kenya",
      "Uganda",
      "Ethiopia",
      "Tanzania"
    ],
    "correctAnswer": "Tanzania",
    "explanation": "Mount Kilimanjaro, Africa's highest mountain, is in Tanzania.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_257"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which playwright wrote 'Hamlet'?",
    "options": [
      "Christopher Marlowe",
      "Ben Jonson",
      "Moliere",
      "William Shakespeare"
    ],
    "correctAnswer": "William Shakespeare",
    "explanation": "'Hamlet' is one of William Shakespeare's best-known tragedies.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_literature_arts",
    "checksum": "knowledge_v1_258"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which school of philosophy was founded by Zeno of Citium?",
    "options": [
      "Stoicism",
      "Epicureanism",
      "Skepticism",
      "Neoplatonism"
    ],
    "correctAnswer": "Stoicism",
    "explanation": "Zeno of Citium founded Stoicism in Athens around the early 3rd century BCE.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_philosophy",
    "checksum": "knowledge_v1_259"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "Which language is written using the Hangul alphabet?",
    "options": [
      "Japanese",
      "Thai",
      "Korean",
      "Vietnamese"
    ],
    "correctAnswer": "Korean",
    "explanation": "Hangul is the alphabet created for writing the Korean language.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_260"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "The Day of the Dead is a traditional holiday strongly associated with which country?",
    "options": [
      "Mexico",
      "Brazil",
      "Peru",
      "Argentina"
    ],
    "correctAnswer": "Mexico",
    "explanation": "Día de los Muertos is a Mexican tradition honoring deceased loved ones.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_culture",
    "checksum": "knowledge_v1_261"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which invention is associated with the Wright brothers in 1903?",
    "options": [
      "Steam locomotive",
      "Telegraph",
      "Electric light bulb",
      "Powered airplane"
    ],
    "correctAnswer": "Powered airplane",
    "explanation": "The Wright brothers achieved a controlled powered flight in 1903.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_262"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which substance gives many carrots their orange color?",
    "options": [
      "Beta-carotene",
      "Chlorophyll",
      "Melanin",
      "Lycopene"
    ],
    "correctAnswer": "Beta-carotene",
    "explanation": "Beta-carotene is a pigment that gives carrots their orange color.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_263"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which unit is used to measure electrical resistance?",
    "options": [
      "Ohm",
      "Watt",
      "Volt",
      "Ampere"
    ],
    "correctAnswer": "Ohm",
    "explanation": "The ohm is the SI unit of electrical resistance.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_common_knowledge",
    "checksum": "knowledge_v1_264"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which ancient city was buried by the eruption of Mount Vesuvius in 79 CE?",
    "options": [
      "Carthage",
      "Pompeii",
      "Troy",
      "Knossos"
    ],
    "correctAnswer": "Pompeii",
    "explanation": "Pompeii was buried under volcanic ash when Vesuvius erupted in 79 CE.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_history",
    "checksum": "knowledge_v1_265"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which country has the city of Marrakech?",
    "options": [
      "Morocco",
      "Egypt",
      "Tunisia",
      "Algeria"
    ],
    "correctAnswer": "Morocco",
    "explanation": "Marrakech is a historic city in Morocco.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_266"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which composer wrote the 'Moonlight Sonata'?",
    "options": [
      "Wolfgang Amadeus Mozart",
      "Johann Sebastian Bach",
      "Franz Schubert",
      "Ludwig van Beethoven"
    ],
    "correctAnswer": "Ludwig van Beethoven",
    "explanation": "Beethoven composed the Piano Sonata No. 14, popularly called the 'Moonlight Sonata.'",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_267"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which philosopher wrote 'The Republic'?",
    "options": [
      "Aristotle",
      "Seneca",
      "Plato",
      "Thales"
    ],
    "correctAnswer": "Plato",
    "explanation": "'The Republic' is one of Plato's major philosophical dialogues.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_268"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "Which ancient language was used for most Roman inscriptions and official documents?",
    "options": [
      "Greek",
      "Latin",
      "Aramaic",
      "Etruscan"
    ],
    "correctAnswer": "Latin",
    "explanation": "Latin was the principal official language of ancient Rome.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_269"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "Which cuisine is traditionally associated with sushi?",
    "options": [
      "Thai",
      "Korean",
      "Japanese",
      "Chinese"
    ],
    "correctAnswer": "Japanese",
    "explanation": "Sushi is a traditional Japanese dish featuring vinegared rice and various toppings or fillings.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_culture",
    "checksum": "knowledge_v1_270"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which blood type is often called the universal red blood cell donor type?",
    "options": [
      "AB positive",
      "O negative",
      "A positive",
      "B negative"
    ],
    "correctAnswer": "O negative",
    "explanation": "O negative red blood cells lack A, B, and Rh antigens, making them widely compatible.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_271"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "The Magna Carta was sealed in which year?",
    "options": [
      "1215",
      "1066",
      "1492",
      "1603"
    ],
    "correctAnswer": "1215",
    "explanation": "King John of England sealed the Magna Carta in 1215.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_history",
    "checksum": "knowledge_v1_272"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who painted 'The Starry Night'?",
    "options": [
      "Vincent van Gogh",
      "Claude Monet",
      "Pablo Picasso",
      "Edvard Munch"
    ],
    "correctAnswer": "Vincent van Gogh",
    "explanation": "Vincent van Gogh painted 'The Starry Night' in 1889.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_literature_arts",
    "checksum": "knowledge_v1_273"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which philosopher is known for the categorical imperative?",
    "options": [
      "Friedrich Nietzsche",
      "John Stuart Mill",
      "Immanuel Kant",
      "Thomas Hobbes"
    ],
    "correctAnswer": "Immanuel Kant",
    "explanation": "Kant's moral philosophy centers on the categorical imperative.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_philosophy",
    "checksum": "knowledge_v1_274"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "Which language has the most native speakers in the world?",
    "options": [
      "English",
      "Mandarin Chinese",
      "Spanish",
      "Hindi"
    ],
    "correctAnswer": "Mandarin Chinese",
    "explanation": "Mandarin Chinese has the largest number of native speakers globally.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_language",
    "checksum": "knowledge_v1_275"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "Which country is famous for the traditional garment called the kimono?",
    "options": [
      "India",
      "Japan",
      "Vietnam",
      "Mongolia"
    ],
    "correctAnswer": "Japan",
    "explanation": "The kimono is a traditional Japanese garment.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_culture",
    "checksum": "knowledge_v1_276"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Which ancient civilization is credited with inventing paper around the 2nd century CE?",
    "options": [
      "Roman",
      "Greek",
      "Egyptian",
      "Chinese"
    ],
    "correctAnswer": "Chinese",
    "explanation": "Paper-making was developed in ancient China, traditionally linked to Cai Lun's improvements.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_277"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which natural phenomenon creates a rainbow?",
    "options": [
      "Magnetism in clouds",
      "Heat rising from the ground",
      "Refraction and reflection of sunlight in water droplets",
      "Moonlight passing through dust"
    ],
    "correctAnswer": "Refraction and reflection of sunlight in water droplets",
    "explanation": "Rainbows form when sunlight is refracted, reflected, and dispersed by water droplets.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_278"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "What is the main gas in Earth's atmosphere?",
    "options": [
      "Oxygen",
      "Carbon dioxide",
      "Nitrogen",
      "Argon"
    ],
    "correctAnswer": "Nitrogen",
    "explanation": "Earth's atmosphere is about 78 percent nitrogen by volume.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_279"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which mountain range separates Europe and Asia in the conventional geographic boundary?",
    "options": [
      "Alps",
      "Himalayas",
      "Carpathians",
      "Ural Mountains"
    ],
    "correctAnswer": "Ural Mountains",
    "explanation": "The Ural Mountains are commonly used as part of the boundary between Europe and Asia.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_280"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which Russian author wrote 'War and Peace'?",
    "options": [
      "Leo Tolstoy",
      "Fyodor Dostoevsky",
      "Anton Chekhov",
      "Nikolai Gogol"
    ],
    "correctAnswer": "Leo Tolstoy",
    "explanation": "Leo Tolstoy wrote the novel 'War and Peace,' first published in the 1860s.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_281"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which philosopher wrote 'Leviathan'?",
    "options": [
      "John Locke",
      "Thomas Hobbes",
      "Jean-Jacques Rousseau",
      "Baruch Spinoza"
    ],
    "correctAnswer": "Thomas Hobbes",
    "explanation": "Thomas Hobbes published 'Leviathan' in 1651.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_philosophy",
    "checksum": "knowledge_v1_282"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "What does the prefix 'poly-' mean in words such as 'polygon' and 'polyglot'?",
    "options": [
      "Small",
      "Before",
      "Against",
      "Many"
    ],
    "correctAnswer": "Many",
    "explanation": "The prefix 'poly-' comes from Greek and means 'many.'",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_283"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "Which traditional Polynesian navigators used stars, waves, and birds to cross the Pacific?",
    "options": [
      "Samurai",
      "Bedouins",
      "Wayfinders",
      "Vikings"
    ],
    "correctAnswer": "Wayfinders",
    "explanation": "Polynesian wayfinders navigated long ocean voyages using natural signs.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_culture",
    "checksum": "knowledge_v1_284"
  },
  {
    "sport": "knowledge",
    "category": "human_knowledge",
    "question": "Which part of the brain is strongly associated with balance and coordination?",
    "options": [
      "Hippocampus",
      "Amygdala",
      "Medulla",
      "Cerebellum"
    ],
    "correctAnswer": "Cerebellum",
    "explanation": "The cerebellum helps coordinate movement and maintain balance.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_human_knowledge",
    "checksum": "knowledge_v1_285"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "Who is credited with inventing the first practical incandescent light bulb for widespread use?",
    "options": [
      "Michael Faraday",
      "Thomas Edison",
      "James Clerk Maxwell",
      "Benjamin Franklin"
    ],
    "correctAnswer": "Thomas Edison",
    "explanation": "Edison developed a practical long-lasting incandescent bulb and lighting system.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_inventions",
    "checksum": "knowledge_v1_286"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "How many degrees are in a right angle?",
    "options": [
      "45",
      "180",
      "90",
      "360"
    ],
    "correctAnswer": "90",
    "explanation": "A right angle measures exactly 90 degrees.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_287"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which ruler is associated with the Code of Hammurabi?",
    "options": [
      "Cyrus the Great",
      "Ramses II",
      "Ashoka",
      "Hammurabi of Babylon"
    ],
    "correctAnswer": "Hammurabi of Babylon",
    "explanation": "The Code of Hammurabi was issued by the Babylonian king Hammurabi.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_history",
    "checksum": "knowledge_v1_288"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Lake Baikal is located in which country?",
    "options": [
      "Russia",
      "Mongolia",
      "Kazakhstan",
      "China"
    ],
    "correctAnswer": "Russia",
    "explanation": "Lake Baikal is in Siberia, Russia.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_289"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Which art movement is Salvador Dali most associated with?",
    "options": [
      "Surrealism",
      "Impressionism",
      "Cubism",
      "Baroque"
    ],
    "correctAnswer": "Surrealism",
    "explanation": "Salvador Dali was one of the most famous artists of the Surrealist movement.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_290"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which ancient philosopher taught Alexander the Great?",
    "options": [
      "Aristotle",
      "Plato",
      "Socrates",
      "Pythagoras"
    ],
    "correctAnswer": "Aristotle",
    "explanation": "Aristotle served as a tutor to the young Alexander of Macedon.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_291"
  },
  {
    "sport": "knowledge",
    "category": "language",
    "question": "Which language is the primary source of the English words 'ballet,' 'cafe,' and 'genre'?",
    "options": [
      "German",
      "French",
      "Arabic",
      "Russian"
    ],
    "correctAnswer": "French",
    "explanation": "These words entered English from French.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_language",
    "checksum": "knowledge_v1_292"
  },
  {
    "sport": "knowledge",
    "category": "culture",
    "question": "Which ancient wonder stood on the island of Pharos near Alexandria?",
    "options": [
      "Colossus of Rhodes",
      "Lighthouse of Alexandria",
      "Hanging Gardens of Babylon",
      "Temple of Artemis"
    ],
    "correctAnswer": "Lighthouse of Alexandria",
    "explanation": "The Lighthouse of Alexandria was built on Pharos and guided ships into the harbor.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_culture",
    "checksum": "knowledge_v1_293"
  },
  {
    "sport": "knowledge",
    "category": "inventions",
    "question": "The earliest known magnetic compass was developed in which civilization?",
    "options": [
      "Mayan",
      "Roman",
      "Chinese",
      "Norse"
    ],
    "correctAnswer": "Chinese",
    "explanation": "The magnetic compass was first developed in China before spreading elsewhere.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_inventions",
    "checksum": "knowledge_v1_294"
  },
  {
    "sport": "knowledge",
    "category": "fun_facts",
    "question": "Which sea creature has three hearts?",
    "options": [
      "Sea turtle",
      "Dolphin",
      "Jellyfish",
      "Octopus"
    ],
    "correctAnswer": "Octopus",
    "explanation": "Octopuses have three hearts: two pump blood to the gills and one to the body.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_fun_facts",
    "checksum": "knowledge_v1_295"
  },
  {
    "sport": "knowledge",
    "category": "common_knowledge",
    "question": "Which process turns a liquid into a gas at the surface of the liquid?",
    "options": [
      "Condensation",
      "Freezing",
      "Evaporation",
      "Sublimation"
    ],
    "correctAnswer": "Evaporation",
    "explanation": "Evaporation is the change from liquid to gas at a liquid's surface.",
    "difficulty": "easy",
    "bucket": "knowledge_easy_common_knowledge",
    "checksum": "knowledge_v1_296"
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "Which empire built extensive roads including the Royal Road in ancient Persia?",
    "options": [
      "Achaemenid Empire",
      "Mongol Empire",
      "Gupta Empire",
      "Hittite Empire"
    ],
    "correctAnswer": "Achaemenid Empire",
    "explanation": "The Achaemenid Persian Empire developed the Royal Road to improve communication and administration.",
    "difficulty": "hard",
    "bucket": "knowledge_hard_history",
    "checksum": "knowledge_v1_297"
  },
  {
    "sport": "knowledge",
    "category": "geography",
    "question": "Which country contains the ancient city of Petra?",
    "options": [
      "Lebanon",
      "Syria",
      "Iraq",
      "Jordan"
    ],
    "correctAnswer": "Jordan",
    "explanation": "Petra, the rock-cut Nabataean city, is in modern Jordan.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_geography",
    "checksum": "knowledge_v1_298"
  },
  {
    "sport": "knowledge",
    "category": "literature_arts",
    "question": "Who wrote 'One Hundred Years of Solitude'?",
    "options": [
      "Jorge Luis Borges",
      "Gabriel Garcia Marquez",
      "Pablo Neruda",
      "Mario Vargas Llosa"
    ],
    "correctAnswer": "Gabriel Garcia Marquez",
    "explanation": "Gabriel Garcia Marquez wrote this landmark novel of magical realism.",
    "difficulty": "intermediate",
    "bucket": "knowledge_intermediate_literature_arts",
    "checksum": "knowledge_v1_299"
  },
  {
    "sport": "knowledge",
    "category": "philosophy",
    "question": "Which tradition is associated with the concept of the Tao or Dao?",
    "options": [
      "Stoicism",
      "Daoism",
      "Existentialism",
      "Utilitarianism"
    ],
    "correctAnswer": "Daoism",
    "explanation": "Daoism centers on the Dao, often translated as 'the Way.'",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_300"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first powered Wright brothers flight",
      "The first moon landing"
    ],
    "correctAnswer": "The first powered Wright brothers flight",
    "explanation": "1903 came before 1969.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_001"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first iPhone release",
      "The invention of the telephone"
    ],
    "correctAnswer": "The invention of the telephone",
    "explanation": "Bell patented the telephone in 1876; the iPhone launched in 2007.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_002"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The printing of the Gutenberg Bible",
      "The signing of the U.S. Declaration of Independence"
    ],
    "correctAnswer": "The printing of the Gutenberg Bible",
    "explanation": "The Gutenberg Bible was printed in the 1450s; the Declaration was signed in 1776.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_003"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The French Revolution",
      "The fall of Constantinople"
    ],
    "correctAnswer": "The fall of Constantinople",
    "explanation": "Constantinople fell in 1453; the French Revolution began in 1789.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_004"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The discovery of penicillin",
      "The first human heart transplant"
    ],
    "correctAnswer": "The discovery of penicillin",
    "explanation": "Penicillin was discovered in 1928; the first human heart transplant was in 1967.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_005"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first FIFA World Cup",
      "The first modern Olympic Games in Athens"
    ],
    "correctAnswer": "The first modern Olympic Games in Athens",
    "explanation": "The modern Olympics began in 1896; the first FIFA World Cup was in 1930.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_006"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The launch of Sputnik 1",
      "The Apollo 11 Moon landing"
    ],
    "correctAnswer": "The launch of Sputnik 1",
    "explanation": "Sputnik launched in 1957; Apollo 11 landed in 1969.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_007"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The founding of Rome",
      "The building of the Great Pyramid of Giza"
    ],
    "correctAnswer": "The building of the Great Pyramid of Giza",
    "explanation": "The Great Pyramid dates to around 2560 BCE; Rome was traditionally founded in 753 BCE.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_008"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Magna Carta",
      "The English Bill of Rights"
    ],
    "correctAnswer": "The Magna Carta",
    "explanation": "Magna Carta was sealed in 1215; the English Bill of Rights was enacted in 1689.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_009"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Protestant Reformation",
      "The Black Death in Europe"
    ],
    "correctAnswer": "The Black Death in Europe",
    "explanation": "The Black Death peaked in the 1340s; the Reformation began in 1517.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_010"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The birth of Isaac Newton",
      "The birth of Albert Einstein"
    ],
    "correctAnswer": "The birth of Isaac Newton",
    "explanation": "Newton was born in 1642/1643; Einstein was born in 1879.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_011"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The publication of The General Theory of Relativity",
      "The publication of On the Origin of Species"
    ],
    "correctAnswer": "The publication of On the Origin of Species",
    "explanation": "Darwin published in 1859; Einstein presented general relativity in 1915.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_012"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The periodic table proposed by Mendeleev",
      "The discovery of DNA’s double helix structure"
    ],
    "correctAnswer": "The periodic table proposed by Mendeleev",
    "explanation": "Mendeleev published his periodic table in 1869; DNA’s structure was described in 1953.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_013"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The launch of Facebook",
      "The invention of the World Wide Web"
    ],
    "correctAnswer": "The invention of the World Wide Web",
    "explanation": "The Web was proposed in 1989; Facebook launched in 2004.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_014"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The launch of YouTube",
      "The launch of Instagram"
    ],
    "correctAnswer": "The launch of YouTube",
    "explanation": "YouTube launched in 2005; Instagram launched in 2010.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_015"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Twilight book",
      "The first Harry Potter book"
    ],
    "correctAnswer": "The first Harry Potter book",
    "explanation": "Harry Potter and the Philosopher’s Stone appeared in 1997; Twilight appeared in 2005.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_016"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Renaissance",
      "The Industrial Revolution"
    ],
    "correctAnswer": "The Renaissance",
    "explanation": "The Renaissance began centuries before the Industrial Revolution.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_017"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The steam locomotive",
      "The compass used for navigation"
    ],
    "correctAnswer": "The compass used for navigation",
    "explanation": "Magnetic compasses were used for navigation long before steam locomotives.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_018"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The invention of paper in China",
      "The invention of movable metal type in Korea"
    ],
    "correctAnswer": "The invention of paper in China",
    "explanation": "Paper was invented around the 2nd century BCE/CE; metal movable type came much later.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_019"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first antibiotic penicillin",
      "The first successful vaccine for smallpox"
    ],
    "correctAnswer": "The first successful vaccine for smallpox",
    "explanation": "Jenner’s smallpox vaccination work was in 1796; penicillin was discovered in 1928.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_020"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The U.S. Civil War",
      "World War I"
    ],
    "correctAnswer": "The U.S. Civil War",
    "explanation": "The U.S. Civil War ran from 1861 to 1865; World War I began in 1914.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_021"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Russian Revolution",
      "The Meiji Restoration"
    ],
    "correctAnswer": "The Meiji Restoration",
    "explanation": "The Meiji Restoration began in 1868; the Russian Revolution was in 1917.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_022"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first transatlantic telegraph cable",
      "The first transatlantic radio voice broadcast"
    ],
    "correctAnswer": "The first transatlantic telegraph cable",
    "explanation": "The successful telegraph cable was completed in 1866; voice radio came later.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_023"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first motion picture by the Lumière brothers",
      "The first photograph by Niépce"
    ],
    "correctAnswer": "The first photograph by Niépce",
    "explanation": "Niépce made an early photograph in the 1820s; the Lumière screenings were in 1895.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_024"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The discovery of X-rays",
      "The discovery of the electron"
    ],
    "correctAnswer": "The discovery of X-rays",
    "explanation": "Röntgen discovered X-rays in 1895; Thomson identified the electron in 1897.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_025"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The launch of the James Webb Space Telescope",
      "The launch of the Hubble Space Telescope"
    ],
    "correctAnswer": "The launch of the Hubble Space Telescope",
    "explanation": "Hubble launched in 1990; Webb launched in 2021.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_026"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first cloned mammal Dolly the sheep",
      "The completion of the Human Genome Project"
    ],
    "correctAnswer": "The first cloned mammal Dolly the sheep",
    "explanation": "Dolly was announced in 1997; the Human Genome Project was completed in 2003.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_027"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first public website going online",
      "The first email sent on ARPANET"
    ],
    "correctAnswer": "The first email sent on ARPANET",
    "explanation": "Network email began in 1971; the first website went online in 1991.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_028"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The release of Windows 95",
      "The release of the first Android phone"
    ],
    "correctAnswer": "The release of Windows 95",
    "explanation": "Windows 95 launched in 1995; the first Android phone launched in 2008.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_029"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first PlayStation release",
      "The first Nintendo Entertainment System release"
    ],
    "correctAnswer": "The first Nintendo Entertainment System release",
    "explanation": "Nintendo’s Famicom/NES era began in the 1980s; PlayStation launched in the 1990s.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_030"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The invention of the barcode",
      "The invention of the QR code"
    ],
    "correctAnswer": "The invention of the barcode",
    "explanation": "The barcode was patented in the 1950s; the QR code was invented in 1994.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_031"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The construction of the Colosseum",
      "The construction of Stonehenge"
    ],
    "correctAnswer": "The construction of Stonehenge",
    "explanation": "Stonehenge predates the Roman Colosseum by thousands of years.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_032"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The rule of Cleopatra VII",
      "The eruption that buried Pompeii"
    ],
    "correctAnswer": "The rule of Cleopatra VII",
    "explanation": "Cleopatra died in 30 BCE; Pompeii was buried in 79 CE.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_033"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Tang dynasty in China",
      "The Han dynasty in China"
    ],
    "correctAnswer": "The Han dynasty in China",
    "explanation": "The Han dynasty began in 202 BCE; the Tang dynasty began in 618 CE.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_034"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The life of Aristotle",
      "The life of Julius Caesar"
    ],
    "correctAnswer": "The life of Aristotle",
    "explanation": "Aristotle lived in the 4th century BCE; Caesar lived in the 1st century BCE.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_035"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The composition of Stravinsky’s The Rite of Spring",
      "The composition of Beethoven’s Fifth Symphony"
    ],
    "correctAnswer": "The composition of Beethoven’s Fifth Symphony",
    "explanation": "Beethoven’s Fifth premiered in 1808; The Rite of Spring premiered in 1913.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_036"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The painting of the Mona Lisa",
      "The painting of The Starry Night"
    ],
    "correctAnswer": "The painting of the Mona Lisa",
    "explanation": "The Mona Lisa was painted in the early 1500s; The Starry Night was painted in 1889.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_037"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The publication of The Great Gatsby",
      "The publication of Pride and Prejudice"
    ],
    "correctAnswer": "The publication of Pride and Prejudice",
    "explanation": "Pride and Prejudice was published in 1813; The Great Gatsby in 1925.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_038"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Nobel Prizes awarded",
      "The first Academy Awards ceremony"
    ],
    "correctAnswer": "The first Nobel Prizes awarded",
    "explanation": "The first Nobel Prizes were awarded in 1901; the first Oscars ceremony was in 1929.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_039"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The opening of the Panama Canal",
      "The opening of the Suez Canal"
    ],
    "correctAnswer": "The opening of the Suez Canal",
    "explanation": "The Suez Canal opened in 1869; the Panama Canal opened in 1914.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_040"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first successful airplane flight",
      "The first successful helicopter flight by Sikorsky VS-300"
    ],
    "correctAnswer": "The first successful airplane flight",
    "explanation": "The Wright flight was in 1903; the VS-300 flew in 1939.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_041"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first commercial jet airliner service",
      "The sinking of the Titanic"
    ],
    "correctAnswer": "The sinking of the Titanic",
    "explanation": "The Titanic sank in 1912; commercial jet service began in the 1950s.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_042"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first artificial satellite",
      "The first space shuttle launch"
    ],
    "correctAnswer": "The first artificial satellite",
    "explanation": "Sputnik 1 launched in 1957; the first Space Shuttle launch was in 1981.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_043"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The invention of the microprocessor",
      "The invention of the transistor"
    ],
    "correctAnswer": "The invention of the transistor",
    "explanation": "The transistor was invented in 1947; the microprocessor appeared in 1971.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_044"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first programmable electronic computer ENIAC",
      "The first IBM personal computer"
    ],
    "correctAnswer": "The first programmable electronic computer ENIAC",
    "explanation": "ENIAC was completed in the 1940s; the IBM PC launched in 1981.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_045"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The release of the first Matrix film",
      "The release of the first Star Wars film"
    ],
    "correctAnswer": "The release of the first Star Wars film",
    "explanation": "Star Wars premiered in 1977; The Matrix premiered in 1999.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_046"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Super Bowl",
      "The first Rugby World Cup"
    ],
    "correctAnswer": "The first Super Bowl",
    "explanation": "The first Super Bowl was in 1967; the first Rugby World Cup was in 1987.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_047"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Formula One World Championship season",
      "The first Tour de France"
    ],
    "correctAnswer": "The first Tour de France",
    "explanation": "The Tour de France began in 1903; F1’s first championship season was 1950.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_048"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The invention of basketball",
      "The invention of volleyball"
    ],
    "correctAnswer": "The invention of basketball",
    "explanation": "Basketball was invented in 1891; volleyball was invented in 1895.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_049"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first modern Olympic Games",
      "The first Wimbledon Championship"
    ],
    "correctAnswer": "The first Wimbledon Championship",
    "explanation": "Wimbledon began in 1877; the modern Olympics began in 1896.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_050"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The discovery of Neptune",
      "The discovery of Pluto"
    ],
    "correctAnswer": "The discovery of Neptune",
    "explanation": "Neptune was discovered in 1846; Pluto was discovered in 1930.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_051"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Newton’s law of universal gravitation",
      "The proposal of heliocentrism by Copernicus"
    ],
    "correctAnswer": "The proposal of heliocentrism by Copernicus",
    "explanation": "Copernicus published in 1543; Newton published Principia in 1687.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_052"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first use of anaesthesia in surgery",
      "The discovery of insulin"
    ],
    "correctAnswer": "The first use of anaesthesia in surgery",
    "explanation": "Ether anaesthesia was publicly demonstrated in 1846; insulin was discovered in 1921.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_053"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first successful face transplant",
      "The first successful organ transplant kidney"
    ],
    "correctAnswer": "The first successful organ transplant kidney",
    "explanation": "A successful kidney transplant occurred in 1954; face transplants came in the 2000s.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_054"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The launch of Google Search",
      "The launch of TikTok"
    ],
    "correctAnswer": "The launch of Google Search",
    "explanation": "Google Search launched in 1998; TikTok launched internationally much later.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_055"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The launch of Twitter/X",
      "The launch of Wikipedia"
    ],
    "correctAnswer": "The launch of Wikipedia",
    "explanation": "Wikipedia launched in 2001; Twitter launched in 2006.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_056"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Bitcoin block mined",
      "The launch of Ethereum"
    ],
    "correctAnswer": "The first Bitcoin block mined",
    "explanation": "Bitcoin’s genesis block was mined in 2009; Ethereum launched in 2015.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_057"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The COVID-19 pandemic declaration by WHO",
      "The Paris Agreement on climate change"
    ],
    "correctAnswer": "The Paris Agreement on climate change",
    "explanation": "The Paris Agreement was adopted in 2015; WHO declared COVID-19 a pandemic in 2020.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_058"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The fall of the Berlin Wall",
      "The dissolution of the Soviet Union"
    ],
    "correctAnswer": "The fall of the Berlin Wall",
    "explanation": "The Berlin Wall fell in 1989; the Soviet Union dissolved in 1991.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_059"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The creation of the European Union",
      "The creation of the United Nations"
    ],
    "correctAnswer": "The creation of the United Nations",
    "explanation": "The UN was founded in 1945; the EU was established in 1993.",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_060"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Prophet Muhammad founded the community in Medina",
      "The Buddha lived in northern India"
    ],
    "correctAnswer": "The Buddha lived in northern India",
    "explanation": "The Buddha lived in northern India came first (c. 5th century BCE); The Prophet Muhammad founded the community in Medina came later (622 CE).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_061"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Insulin was first used to treat diabetes",
      "Humans first landed on the Moon"
    ],
    "correctAnswer": "Insulin was first used to treat diabetes",
    "explanation": "Insulin was first used to treat diabetes came first (1922); Humans first landed on the Moon came later (1969).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_062"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first image of a black hole was released",
      "Athenian democracy developed under Cleisthenes"
    ],
    "correctAnswer": "Athenian democracy developed under Cleisthenes",
    "explanation": "Athenian democracy developed under Cleisthenes came first (508 BCE); The first image of a black hole was released came later (2019).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_063"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Rosetta Stone was discovered",
      "World War II began in Europe"
    ],
    "correctAnswer": "The Rosetta Stone was discovered",
    "explanation": "The Rosetta Stone was discovered came first (1799); World War II began in Europe came later (1939).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_064"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "ChatGPT was publicly released",
      "YouTube launched"
    ],
    "correctAnswer": "YouTube launched",
    "explanation": "YouTube launched came first (2005); ChatGPT was publicly released came later (2022).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_065"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Constantinople fell to the Ottomans",
      "The American Civil War began"
    ],
    "correctAnswer": "Constantinople fell to the Ottomans",
    "explanation": "Constantinople fell to the Ottomans came first (1453); The American Civil War began came later (1861).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_066"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Curiosity landed on Mars",
      "The Berlin Wall fell"
    ],
    "correctAnswer": "The Berlin Wall fell",
    "explanation": "The Berlin Wall fell came first (1989); Curiosity landed on Mars came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_067"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Colosseum opened in Rome",
      "Newton published Principia Mathematica"
    ],
    "correctAnswer": "The Colosseum opened in Rome",
    "explanation": "The Colosseum opened in Rome came first (80 CE); Newton published Principia Mathematica came later (1687).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_068"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Wikipedia launched",
      "Sputnik 1 was launched"
    ],
    "correctAnswer": "Sputnik 1 was launched",
    "explanation": "Sputnik 1 was launched came first (1957); Wikipedia launched came later (2001).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_069"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Code of Hammurabi was created",
      "The Black Death reached Europe"
    ],
    "correctAnswer": "The Code of Hammurabi was created",
    "explanation": "The Code of Hammurabi was created came first (c. 1754 BCE); The Black Death reached Europe came later (1347).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_070"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The World Wide Web was proposed",
      "Einstein published special relativity"
    ],
    "correctAnswer": "Einstein published special relativity",
    "explanation": "Einstein published special relativity came first (1905); The World Wide Web was proposed came later (1989).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_071"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Colosseum opened in Rome",
      "The Higgs boson discovery was announced"
    ],
    "correctAnswer": "The Colosseum opened in Rome",
    "explanation": "The Colosseum opened in Rome came first (80 CE); The Higgs boson discovery was announced came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_072"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Berlin Wall was built",
      "The steam engine patent by James Watt was granted"
    ],
    "correctAnswer": "The steam engine patent by James Watt was granted",
    "explanation": "The steam engine patent by James Watt was granted came first (1769); The Berlin Wall was built came later (1961).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_073"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The traditional founding of Rome occurred",
      "Wikipedia launched"
    ],
    "correctAnswer": "The traditional founding of Rome occurred",
    "explanation": "The traditional founding of Rome occurred came first (753 BCE); Wikipedia launched came later (2001).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_074"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Insulin was first used to treat diabetes",
      "The Mongol Empire reached its greatest extent"
    ],
    "correctAnswer": "The Mongol Empire reached its greatest extent",
    "explanation": "The Mongol Empire reached its greatest extent came first (13th century); Insulin was first used to treat diabetes came later (1922).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_075"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Space Shuttle launch occurred",
      "The COVID-19 pandemic was declared by WHO"
    ],
    "correctAnswer": "The first Space Shuttle launch occurred",
    "explanation": "The first Space Shuttle launch occurred came first (1981); The COVID-19 pandemic was declared by WHO came later (2020).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_076"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first public steam railway opened",
      "The First Emperor unified China"
    ],
    "correctAnswer": "The First Emperor unified China",
    "explanation": "The First Emperor unified China came first (221 BCE); The first public steam railway opened came later (1825).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_077"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "India became independent",
      "Bitcoin's genesis block was mined"
    ],
    "correctAnswer": "India became independent",
    "explanation": "India became independent came first (1947); Bitcoin's genesis block was mined came later (2009).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_078"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "India's Chandrayaan-3 landed near the Moon's south pole",
      "Shakespeare's Globe Theatre opened"
    ],
    "correctAnswer": "Shakespeare's Globe Theatre opened",
    "explanation": "Shakespeare's Globe Theatre opened came first (1599); India's Chandrayaan-3 landed near the Moon's south pole came later (2023).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_079"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The American Civil War began",
      "Amazon launched as an online bookstore"
    ],
    "correctAnswer": "The American Civil War began",
    "explanation": "The American Civil War began came first (1861); Amazon launched as an online bookstore came later (1995).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_080"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Instagram launched",
      "The Magna Carta was sealed"
    ],
    "correctAnswer": "The Magna Carta was sealed",
    "explanation": "The Magna Carta was sealed came first (1215); Instagram launched came later (2010).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_081"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Shakespeare's Globe Theatre opened",
      "The first Space Shuttle launch occurred"
    ],
    "correctAnswer": "Shakespeare's Globe Theatre opened",
    "explanation": "Shakespeare's Globe Theatre opened came first (1599); The first Space Shuttle launch occurred came later (1981).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_082"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first PlayStation was released",
      "Julius Caesar was assassinated"
    ],
    "correctAnswer": "Julius Caesar was assassinated",
    "explanation": "Julius Caesar was assassinated came first (44 BCE); The first PlayStation was released came later (1994).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_083"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Vikings raided Lindisfarne",
      "DNA's double-helix structure was described"
    ],
    "correctAnswer": "The Vikings raided Lindisfarne",
    "explanation": "The Vikings raided Lindisfarne came first (793 CE); DNA's double-helix structure was described came later (1953).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_084"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first email was sent on ARPANET",
      "The Code of Hammurabi was created"
    ],
    "correctAnswer": "The Code of Hammurabi was created",
    "explanation": "The Code of Hammurabi was created came first (c. 1754 BCE); The first email was sent on ARPANET came later (1971).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_085"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Athenian democracy developed under Cleisthenes",
      "World War I began"
    ],
    "correctAnswer": "Athenian democracy developed under Cleisthenes",
    "explanation": "Athenian democracy developed under Cleisthenes came first (508 BCE); World War I began came later (1914).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_086"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "AlphaGo defeated Lee Sedol",
      "The first Academy Awards ceremony was held"
    ],
    "correctAnswer": "The first Academy Awards ceremony was held",
    "explanation": "The first Academy Awards ceremony was held came first (1929); AlphaGo defeated Lee Sedol came later (2016).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_087"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Rosetta Stone was discovered",
      "The COVID-19 pandemic was declared by WHO"
    ],
    "correctAnswer": "The Rosetta Stone was discovered",
    "explanation": "The Rosetta Stone was discovered came first (1799); The COVID-19 pandemic was declared by WHO came later (2020).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_088"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Twitter launched",
      "The Battle of Waterloo was fought"
    ],
    "correctAnswer": "The Battle of Waterloo was fought",
    "explanation": "The Battle of Waterloo was fought came first (1815); Twitter launched came later (2006).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_089"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Michelangelo completed the Sistine Chapel ceiling",
      "Twitter launched"
    ],
    "correctAnswer": "Michelangelo completed the Sistine Chapel ceiling",
    "explanation": "Michelangelo completed the Sistine Chapel ceiling came first (1512); Twitter launched came later (2006).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_090"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first text message was sent",
      "Columbus reached the Caribbean"
    ],
    "correctAnswer": "Columbus reached the Caribbean",
    "explanation": "Columbus reached the Caribbean came first (1492); The first text message was sent came later (1992).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_091"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Vikings raided Lindisfarne",
      "Nelson Mandela was released from prison"
    ],
    "correctAnswer": "The Vikings raided Lindisfarne",
    "explanation": "The Vikings raided Lindisfarne came first (793 CE); Nelson Mandela was released from prison came later (1990).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_092"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first handheld mobile phone call was made",
      "The Western Roman Empire fell"
    ],
    "correctAnswer": "The Western Roman Empire fell",
    "explanation": "The Western Roman Empire fell came first (476 CE); The first handheld mobile phone call was made came later (1973).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_093"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Library of Alexandria was founded",
      "The Berlin Wall was built"
    ],
    "correctAnswer": "The Library of Alexandria was founded",
    "explanation": "The Library of Alexandria was founded came first (3rd century BCE); The Berlin Wall was built came later (1961).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_094"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "India became independent",
      "The Late Bronze Age collapse began"
    ],
    "correctAnswer": "The Late Bronze Age collapse began",
    "explanation": "The Late Bronze Age collapse began came first (c. 1200 BCE); India became independent came later (1947).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_095"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first known city-states emerged in Sumer",
      "World War I began"
    ],
    "correctAnswer": "The first known city-states emerged in Sumer",
    "explanation": "The first known city-states emerged in Sumer came first (c. 3500 BCE); World War I began came later (1914).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_096"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Paris Agreement was adopted",
      "The Wright brothers made their first powered flight"
    ],
    "correctAnswer": "The Wright brothers made their first powered flight",
    "explanation": "The Wright brothers made their first powered flight came first (1903); The Paris Agreement was adopted came later (2015).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_097"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The United States Declaration of Independence was adopted",
      "The Higgs boson discovery was announced"
    ],
    "correctAnswer": "The United States Declaration of Independence was adopted",
    "explanation": "The United States Declaration of Independence was adopted came first (1776); The Higgs boson discovery was announced came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_098"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The euro entered circulation as cash",
      "The United States Declaration of Independence was adopted"
    ],
    "correctAnswer": "The United States Declaration of Independence was adopted",
    "explanation": "The United States Declaration of Independence was adopted came first (1776); The euro entered circulation as cash came later (2002).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_099"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Black Death reached Europe",
      "Facebook launched"
    ],
    "correctAnswer": "The Black Death reached Europe",
    "explanation": "The Black Death reached Europe came first (1347); Facebook launched came later (2004).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_100"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Chernobyl nuclear disaster occurred",
      "Constantinople fell to the Ottomans"
    ],
    "correctAnswer": "Constantinople fell to the Ottomans",
    "explanation": "Constantinople fell to the Ottomans came first (1453); The Chernobyl nuclear disaster occurred came later (1986).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_101"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Julius Caesar was assassinated",
      "The Mongol Empire reached its greatest extent"
    ],
    "correctAnswer": "Julius Caesar was assassinated",
    "explanation": "Julius Caesar was assassinated came first (44 BCE); The Mongol Empire reached its greatest extent came later (13th century).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_102"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Chernobyl nuclear disaster occurred",
      "The first commercial jet airliner entered service"
    ],
    "correctAnswer": "The first commercial jet airliner entered service",
    "explanation": "The first commercial jet airliner entered service came first (1952); The Chernobyl nuclear disaster occurred came later (1986).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_103"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first known city-states emerged in Sumer",
      "The Roman Empire began under Augustus"
    ],
    "correctAnswer": "The first known city-states emerged in Sumer",
    "explanation": "The first known city-states emerged in Sumer came first (c. 3500 BCE); The Roman Empire began under Augustus came later (27 BCE).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_104"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Sputnik 1 was launched",
      "The first modern Olympic Games were held"
    ],
    "correctAnswer": "The first modern Olympic Games were held",
    "explanation": "The first modern Olympic Games were held came first (1896); Sputnik 1 was launched came later (1957).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_105"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Late Bronze Age collapse began",
      "Curiosity landed on Mars"
    ],
    "correctAnswer": "The Late Bronze Age collapse began",
    "explanation": "The Late Bronze Age collapse began came first (c. 1200 BCE); Curiosity landed on Mars came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_106"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Russian Revolution occurred",
      "Galileo observed Jupiter's moons"
    ],
    "correctAnswer": "Galileo observed Jupiter's moons",
    "explanation": "Galileo observed Jupiter's moons came first (1610); The Russian Revolution occurred came later (1917).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_107"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Amazon launched as an online bookstore",
      "The first image of a black hole was released"
    ],
    "correctAnswer": "Amazon launched as an online bookstore",
    "explanation": "Amazon launched as an online bookstore came first (1995); The first image of a black hole was released came later (2019).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_108"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Battle of Waterloo was fought",
      "The Norman Conquest of England occurred"
    ],
    "correctAnswer": "The Norman Conquest of England occurred",
    "explanation": "The Norman Conquest of England occurred came first (1066); The Battle of Waterloo was fought came later (1815).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_109"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first handheld mobile phone call was made",
      "The first iPhone was released"
    ],
    "correctAnswer": "The first handheld mobile phone call was made",
    "explanation": "The first handheld mobile phone call was made came first (1973); The first iPhone was released came later (2007).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_110"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Martin Luther published the Ninety-five Theses",
      "The Battle of Marathon was fought"
    ],
    "correctAnswer": "The Battle of Marathon was fought",
    "explanation": "The Battle of Marathon was fought came first (490 BCE); Martin Luther published the Ninety-five Theses came later (1517).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_111"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "World War II began in Europe",
      "The first PlayStation was released"
    ],
    "correctAnswer": "World War II began in Europe",
    "explanation": "World War II began in Europe came first (1939); The first PlayStation was released came later (1994).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_112"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The James Webb Space Telescope launched",
      "The Norman Conquest of England occurred"
    ],
    "correctAnswer": "The Norman Conquest of England occurred",
    "explanation": "The Norman Conquest of England occurred came first (1066); The James Webb Space Telescope launched came later (2021).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_113"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first public steam railway opened",
      "The Apple II computer was released"
    ],
    "correctAnswer": "The first public steam railway opened",
    "explanation": "The first public steam railway opened came first (1825); The Apple II computer was released came later (1977).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_114"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first iPhone was released",
      "The First Emperor unified China"
    ],
    "correctAnswer": "The First Emperor unified China",
    "explanation": "The First Emperor unified China came first (221 BCE); The first iPhone was released came later (2007).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_115"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Michelangelo completed the Sistine Chapel ceiling",
      "The first commercial jet airliner entered service"
    ],
    "correctAnswer": "Michelangelo completed the Sistine Chapel ceiling",
    "explanation": "Michelangelo completed the Sistine Chapel ceiling came first (1512); The first commercial jet airliner entered service came later (1952).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_116"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Soviet Union dissolved",
      "The Great Pyramid of Giza was completed"
    ],
    "correctAnswer": "The Great Pyramid of Giza was completed",
    "explanation": "The Great Pyramid of Giza was completed came first (c. 2560 BCE); The Soviet Union dissolved came later (1991).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_117"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Prophet Muhammad founded the community in Medina",
      "Einstein published special relativity"
    ],
    "correctAnswer": "The Prophet Muhammad founded the community in Medina",
    "explanation": "The Prophet Muhammad founded the community in Medina came first (622 CE); Einstein published special relativity came later (1905).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_118"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Paris Agreement was adopted",
      "Martin Luther King Jr. delivered the I Have a Dream speech"
    ],
    "correctAnswer": "Martin Luther King Jr. delivered the I Have a Dream speech",
    "explanation": "Martin Luther King Jr. delivered the I Have a Dream speech came first (1963); The Paris Agreement was adopted came later (2015).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_119"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The traditional founding of Rome occurred",
      "The French Revolution began"
    ],
    "correctAnswer": "The traditional founding of Rome occurred",
    "explanation": "The traditional founding of Rome occurred came first (753 BCE); The French Revolution began came later (1789).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_120"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "YouTube launched",
      "The Russian Revolution occurred"
    ],
    "correctAnswer": "The Russian Revolution occurred",
    "explanation": "The Russian Revolution occurred came first (1917); YouTube launched came later (2005).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_121"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Columbus reached the Caribbean",
      "AlphaGo defeated Lee Sedol"
    ],
    "correctAnswer": "Columbus reached the Caribbean",
    "explanation": "Columbus reached the Caribbean came first (1492); AlphaGo defeated Lee Sedol came later (2016).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_122"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Soviet Union dissolved",
      "The French Revolution began"
    ],
    "correctAnswer": "The French Revolution began",
    "explanation": "The French Revolution began came first (1789); The Soviet Union dissolved came later (1991).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_123"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Charlemagne was crowned emperor",
      "Facebook launched"
    ],
    "correctAnswer": "Charlemagne was crowned emperor",
    "explanation": "Charlemagne was crowned emperor came first (800 CE); Facebook launched came later (2004).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_124"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first email was sent on ARPANET",
      "The printing of Gutenberg's Bible began"
    ],
    "correctAnswer": "The printing of Gutenberg's Bible began",
    "explanation": "The printing of Gutenberg's Bible began came first (1450s); The first email was sent on ARPANET came later (1971).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_125"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Battle of Marathon was fought",
      "The World Wide Web was proposed"
    ],
    "correctAnswer": "The Battle of Marathon was fought",
    "explanation": "The Battle of Marathon was fought came first (490 BCE); The World Wide Web was proposed came later (1989).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_126"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The United Nations was founded",
      "The Roman Empire began under Augustus"
    ],
    "correctAnswer": "The Roman Empire began under Augustus",
    "explanation": "The Roman Empire began under Augustus came first (27 BCE); The United Nations was founded came later (1945).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_127"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "DNA's double-helix structure was described",
      "India's Chandrayaan-3 landed near the Moon's south pole"
    ],
    "correctAnswer": "DNA's double-helix structure was described",
    "explanation": "DNA's double-helix structure was described came first (1953); India's Chandrayaan-3 landed near the Moon's south pole came later (2023).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_128"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first modern Olympic Games were held",
      "The Great Pyramid of Giza was completed"
    ],
    "correctAnswer": "The Great Pyramid of Giza was completed",
    "explanation": "The Great Pyramid of Giza was completed came first (c. 2560 BCE); The first modern Olympic Games were held came later (1896).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_129"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Wright brothers made their first powered flight",
      "CRISPR-Cas9 genome editing was demonstrated in cells"
    ],
    "correctAnswer": "The Wright brothers made their first powered flight",
    "explanation": "The Wright brothers made their first powered flight came first (1903); CRISPR-Cas9 genome editing was demonstrated in cells came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_130"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "CRISPR-Cas9 genome editing was demonstrated in cells",
      "The steam engine patent by James Watt was granted"
    ],
    "correctAnswer": "The steam engine patent by James Watt was granted",
    "explanation": "The steam engine patent by James Watt was granted came first (1769); CRISPR-Cas9 genome editing was demonstrated in cells came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_131"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Newton published Principia Mathematica",
      "The euro entered circulation as cash"
    ],
    "correctAnswer": "Newton published Principia Mathematica",
    "explanation": "Newton published Principia Mathematica came first (1687); The euro entered circulation as cash came later (2002).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_132"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Google was founded",
      "The printing of Gutenberg's Bible began"
    ],
    "correctAnswer": "The printing of Gutenberg's Bible began",
    "explanation": "The printing of Gutenberg's Bible began came first (1450s); Google was founded came later (1998).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_133"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Magna Carta was sealed",
      "The Berlin Wall fell"
    ],
    "correctAnswer": "The Magna Carta was sealed",
    "explanation": "The Magna Carta was sealed came first (1215); The Berlin Wall fell came later (1989).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_134"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Apple II computer was released",
      "The Western Roman Empire fell"
    ],
    "correctAnswer": "The Western Roman Empire fell",
    "explanation": "The Western Roman Empire fell came first (476 CE); The Apple II computer was released came later (1977).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_135"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Library of Alexandria was founded",
      "Martin Luther King Jr. delivered the I Have a Dream speech"
    ],
    "correctAnswer": "The Library of Alexandria was founded",
    "explanation": "The Library of Alexandria was founded came first (3rd century BCE); Martin Luther King Jr. delivered the I Have a Dream speech came later (1963).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_136"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The United Nations was founded",
      "The Buddha lived in northern India"
    ],
    "correctAnswer": "The Buddha lived in northern India",
    "explanation": "The Buddha lived in northern India came first (c. 5th century BCE); The United Nations was founded came later (1945).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_137"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Academy Awards ceremony was held",
      "ChatGPT was publicly released"
    ],
    "correctAnswer": "The first Academy Awards ceremony was held",
    "explanation": "The first Academy Awards ceremony was held came first (1929); ChatGPT was publicly released came later (2022).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_138"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The James Webb Space Telescope launched",
      "Darwin published On the Origin of Species"
    ],
    "correctAnswer": "Darwin published On the Origin of Species",
    "explanation": "Darwin published On the Origin of Species came first (1859); The James Webb Space Telescope launched came later (2021).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_139"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Darwin published On the Origin of Species",
      "Bitcoin's genesis block was mined"
    ],
    "correctAnswer": "Darwin published On the Origin of Species",
    "explanation": "Darwin published On the Origin of Species came first (1859); Bitcoin's genesis block was mined came later (2009).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_140"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Instagram launched",
      "Martin Luther published the Ninety-five Theses"
    ],
    "correctAnswer": "Martin Luther published the Ninety-five Theses",
    "explanation": "Martin Luther published the Ninety-five Theses came first (1517); Instagram launched came later (2010).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_141"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Galileo observed Jupiter's moons",
      "The first text message was sent"
    ],
    "correctAnswer": "Galileo observed Jupiter's moons",
    "explanation": "Galileo observed Jupiter's moons came first (1610); The first text message was sent came later (1992).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_142"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Michelangelo completed the Sistine Chapel ceiling",
      "Charlemagne was crowned emperor"
    ],
    "correctAnswer": "Charlemagne was crowned emperor",
    "explanation": "Charlemagne was crowned emperor came first (800 CE); Michelangelo completed the Sistine Chapel ceiling came later (1512).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_143"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Humans first landed on the Moon",
      "The first text message was sent"
    ],
    "correctAnswer": "Humans first landed on the Moon",
    "explanation": "Humans first landed on the Moon came first (1969); The first text message was sent came later (1992).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_144"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Vikings raided Lindisfarne",
      "The Buddha lived in northern India"
    ],
    "correctAnswer": "The Buddha lived in northern India",
    "explanation": "The Buddha lived in northern India came first (c. 5th century BCE); The Vikings raided Lindisfarne came later (793 CE).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_145"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Insulin was first used to treat diabetes",
      "The first handheld mobile phone call was made"
    ],
    "correctAnswer": "Insulin was first used to treat diabetes",
    "explanation": "Insulin was first used to treat diabetes came first (1922); The first handheld mobile phone call was made came later (1973).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_146"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first image of a black hole was released",
      "The Library of Alexandria was founded"
    ],
    "correctAnswer": "The Library of Alexandria was founded",
    "explanation": "The Library of Alexandria was founded came first (3rd century BCE); The first image of a black hole was released came later (2019).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_147"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Rosetta Stone was discovered",
      "India became independent"
    ],
    "correctAnswer": "The Rosetta Stone was discovered",
    "explanation": "The Rosetta Stone was discovered came first (1799); India became independent came later (1947).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_148"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "YouTube launched",
      "The first known city-states emerged in Sumer"
    ],
    "correctAnswer": "The first known city-states emerged in Sumer",
    "explanation": "The first known city-states emerged in Sumer came first (c. 3500 BCE); YouTube launched came later (2005).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_149"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Constantinople fell to the Ottomans",
      "The Wright brothers made their first powered flight"
    ],
    "correctAnswer": "Constantinople fell to the Ottomans",
    "explanation": "Constantinople fell to the Ottomans came first (1453); The Wright brothers made their first powered flight came later (1903).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_150"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Higgs boson discovery was announced",
      "The Berlin Wall fell"
    ],
    "correctAnswer": "The Berlin Wall fell",
    "explanation": "The Berlin Wall fell came first (1989); The Higgs boson discovery was announced came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_151"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Colosseum opened in Rome",
      "The United States Declaration of Independence was adopted"
    ],
    "correctAnswer": "The Colosseum opened in Rome",
    "explanation": "The Colosseum opened in Rome came first (80 CE); The United States Declaration of Independence was adopted came later (1776).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_152"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Facebook launched",
      "Sputnik 1 was launched"
    ],
    "correctAnswer": "Sputnik 1 was launched",
    "explanation": "Sputnik 1 was launched came first (1957); Facebook launched came later (2004).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_153"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Code of Hammurabi was created",
      "Constantinople fell to the Ottomans"
    ],
    "correctAnswer": "The Code of Hammurabi was created",
    "explanation": "The Code of Hammurabi was created came first (c. 1754 BCE); Constantinople fell to the Ottomans came later (1453).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_154"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Nelson Mandela was released from prison",
      "Einstein published special relativity"
    ],
    "correctAnswer": "Einstein published special relativity",
    "explanation": "Einstein published special relativity came first (1905); Nelson Mandela was released from prison came later (1990).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_155"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Prophet Muhammad founded the community in Medina",
      "The Higgs boson discovery was announced"
    ],
    "correctAnswer": "The Prophet Muhammad founded the community in Medina",
    "explanation": "The Prophet Muhammad founded the community in Medina came first (622 CE); The Higgs boson discovery was announced came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_156"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Humans first landed on the Moon",
      "The steam engine patent by James Watt was granted"
    ],
    "correctAnswer": "The steam engine patent by James Watt was granted",
    "explanation": "The steam engine patent by James Watt was granted came first (1769); Humans first landed on the Moon came later (1969).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_157"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Athenian democracy developed under Cleisthenes",
      "Wikipedia launched"
    ],
    "correctAnswer": "Athenian democracy developed under Cleisthenes",
    "explanation": "Athenian democracy developed under Cleisthenes came first (508 BCE); Wikipedia launched came later (2001).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_158"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "World War II began in Europe",
      "The Mongol Empire reached its greatest extent"
    ],
    "correctAnswer": "The Mongol Empire reached its greatest extent",
    "explanation": "The Mongol Empire reached its greatest extent came first (13th century); World War II began in Europe came later (1939).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_159"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Space Shuttle launch occurred",
      "ChatGPT was publicly released"
    ],
    "correctAnswer": "The first Space Shuttle launch occurred",
    "explanation": "The first Space Shuttle launch occurred came first (1981); ChatGPT was publicly released came later (2022).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_160"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The American Civil War began",
      "The First Emperor unified China"
    ],
    "correctAnswer": "The First Emperor unified China",
    "explanation": "The First Emperor unified China came first (221 BCE); The American Civil War began came later (1861).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_161"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "India became independent",
      "Curiosity landed on Mars"
    ],
    "correctAnswer": "India became independent",
    "explanation": "India became independent came first (1947); Curiosity landed on Mars came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_162"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "India's Chandrayaan-3 landed near the Moon's south pole",
      "Newton published Principia Mathematica"
    ],
    "correctAnswer": "Newton published Principia Mathematica",
    "explanation": "Newton published Principia Mathematica came first (1687); India's Chandrayaan-3 landed near the Moon's south pole came later (2023).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_163"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The American Civil War began",
      "Wikipedia launched"
    ],
    "correctAnswer": "The American Civil War began",
    "explanation": "The American Civil War began came first (1861); Wikipedia launched came later (2001).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_164"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Instagram launched",
      "The Black Death reached Europe"
    ],
    "correctAnswer": "The Black Death reached Europe",
    "explanation": "The Black Death reached Europe came first (1347); Instagram launched came later (2010).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_165"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Shakespeare's Globe Theatre opened",
      "The World Wide Web was proposed"
    ],
    "correctAnswer": "Shakespeare's Globe Theatre opened",
    "explanation": "Shakespeare's Globe Theatre opened came first (1599); The World Wide Web was proposed came later (1989).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_166"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first PlayStation was released",
      "The Colosseum opened in Rome"
    ],
    "correctAnswer": "The Colosseum opened in Rome",
    "explanation": "The Colosseum opened in Rome came first (80 CE); The first PlayStation was released came later (1994).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_167"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Vikings raided Lindisfarne",
      "The Berlin Wall was built"
    ],
    "correctAnswer": "The Vikings raided Lindisfarne",
    "explanation": "The Vikings raided Lindisfarne came first (793 CE); The Berlin Wall was built came later (1961).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_168"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first email was sent on ARPANET",
      "The traditional founding of Rome occurred"
    ],
    "correctAnswer": "The traditional founding of Rome occurred",
    "explanation": "The traditional founding of Rome occurred came first (753 BCE); The first email was sent on ARPANET came later (1971).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_169"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Athenian democracy developed under Cleisthenes",
      "Insulin was first used to treat diabetes"
    ],
    "correctAnswer": "Athenian democracy developed under Cleisthenes",
    "explanation": "Athenian democracy developed under Cleisthenes came first (508 BCE); Insulin was first used to treat diabetes came later (1922).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_170"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The COVID-19 pandemic was declared by WHO",
      "The first Academy Awards ceremony was held"
    ],
    "correctAnswer": "The first Academy Awards ceremony was held",
    "explanation": "The first Academy Awards ceremony was held came first (1929); The COVID-19 pandemic was declared by WHO came later (2020).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_171"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first public steam railway opened",
      "The COVID-19 pandemic was declared by WHO"
    ],
    "correctAnswer": "The first public steam railway opened",
    "explanation": "The first public steam railway opened came first (1825); The COVID-19 pandemic was declared by WHO came later (2020).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_172"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Bitcoin's genesis block was mined",
      "The Battle of Waterloo was fought"
    ],
    "correctAnswer": "The Battle of Waterloo was fought",
    "explanation": "The Battle of Waterloo was fought came first (1815); Bitcoin's genesis block was mined came later (2009).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_173"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Shakespeare's Globe Theatre opened",
      "Twitter launched"
    ],
    "correctAnswer": "Shakespeare's Globe Theatre opened",
    "explanation": "Shakespeare's Globe Theatre opened came first (1599); Twitter launched came later (2006).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_174"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Amazon launched as an online bookstore",
      "Columbus reached the Caribbean"
    ],
    "correctAnswer": "Columbus reached the Caribbean",
    "explanation": "Columbus reached the Caribbean came first (1492); Amazon launched as an online bookstore came later (1995).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_175"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Magna Carta was sealed",
      "Nelson Mandela was released from prison"
    ],
    "correctAnswer": "The Magna Carta was sealed",
    "explanation": "The Magna Carta was sealed came first (1215); Nelson Mandela was released from prison came later (1990).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_176"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Space Shuttle launch occurred",
      "The Western Roman Empire fell"
    ],
    "correctAnswer": "The Western Roman Empire fell",
    "explanation": "The Western Roman Empire fell came first (476 CE); The first Space Shuttle launch occurred came later (1981).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_177"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Julius Caesar was assassinated",
      "The Berlin Wall was built"
    ],
    "correctAnswer": "Julius Caesar was assassinated",
    "explanation": "Julius Caesar was assassinated came first (44 BCE); The Berlin Wall was built came later (1961).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_178"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "DNA's double-helix structure was described",
      "The Late Bronze Age collapse began"
    ],
    "correctAnswer": "The Late Bronze Age collapse began",
    "explanation": "The Late Bronze Age collapse began came first (c. 1200 BCE); DNA's double-helix structure was described came later (1953).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_179"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Code of Hammurabi was created",
      "World War I began"
    ],
    "correctAnswer": "The Code of Hammurabi was created",
    "explanation": "The Code of Hammurabi was created came first (c. 1754 BCE); World War I began came later (1914).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_180"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Paris Agreement was adopted",
      "World War I began"
    ],
    "correctAnswer": "World War I began",
    "explanation": "World War I began came first (1914); The Paris Agreement was adopted came later (2015).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_181"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The United States Declaration of Independence was adopted",
      "AlphaGo defeated Lee Sedol"
    ],
    "correctAnswer": "The United States Declaration of Independence was adopted",
    "explanation": "The United States Declaration of Independence was adopted came first (1776); AlphaGo defeated Lee Sedol came later (2016).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_182"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The euro entered circulation as cash",
      "The Rosetta Stone was discovered"
    ],
    "correctAnswer": "The Rosetta Stone was discovered",
    "explanation": "The Rosetta Stone was discovered came first (1799); The euro entered circulation as cash came later (2002).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_183"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Black Death reached Europe",
      "The steam engine patent by James Watt was granted"
    ],
    "correctAnswer": "The Black Death reached Europe",
    "explanation": "The Black Death reached Europe came first (1347); The steam engine patent by James Watt was granted came later (1769).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_184"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The euro entered circulation as cash",
      "The Chernobyl nuclear disaster occurred"
    ],
    "correctAnswer": "The Chernobyl nuclear disaster occurred",
    "explanation": "The Chernobyl nuclear disaster occurred came first (1986); The euro entered circulation as cash came later (2002).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_185"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Julius Caesar was assassinated",
      "The printing of Gutenberg's Bible began"
    ],
    "correctAnswer": "Julius Caesar was assassinated",
    "explanation": "Julius Caesar was assassinated came first (44 BCE); The printing of Gutenberg's Bible began came later (1450s).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_186"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Berlin Wall fell",
      "The first commercial jet airliner entered service"
    ],
    "correctAnswer": "The first commercial jet airliner entered service",
    "explanation": "The first commercial jet airliner entered service came first (1952); The Berlin Wall fell came later (1989).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_187"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first known city-states emerged in Sumer",
      "The Western Roman Empire fell"
    ],
    "correctAnswer": "The first known city-states emerged in Sumer",
    "explanation": "The first known city-states emerged in Sumer came first (c. 3500 BCE); The Western Roman Empire fell came later (476 CE).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_188"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Martin Luther King Jr. delivered the I Have a Dream speech",
      "The first modern Olympic Games were held"
    ],
    "correctAnswer": "The first modern Olympic Games were held",
    "explanation": "The first modern Olympic Games were held came first (1896); Martin Luther King Jr. delivered the I Have a Dream speech came later (1963).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_189"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Buddha lived in northern India",
      "Curiosity landed on Mars"
    ],
    "correctAnswer": "The Buddha lived in northern India",
    "explanation": "The Buddha lived in northern India came first (c. 5th century BCE); Curiosity landed on Mars came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_190"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Academy Awards ceremony was held",
      "Galileo observed Jupiter's moons"
    ],
    "correctAnswer": "Galileo observed Jupiter's moons",
    "explanation": "Galileo observed Jupiter's moons came first (1610); The first Academy Awards ceremony was held came later (1929).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_191"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Amazon launched as an online bookstore",
      "The James Webb Space Telescope launched"
    ],
    "correctAnswer": "Amazon launched as an online bookstore",
    "explanation": "Amazon launched as an online bookstore came first (1995); The James Webb Space Telescope launched came later (2021).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_192"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Darwin published On the Origin of Species",
      "The Norman Conquest of England occurred"
    ],
    "correctAnswer": "The Norman Conquest of England occurred",
    "explanation": "The Norman Conquest of England occurred came first (1066); Darwin published On the Origin of Species came later (1859).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_193"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first handheld mobile phone call was made",
      "Instagram launched"
    ],
    "correctAnswer": "The first handheld mobile phone call was made",
    "explanation": "The first handheld mobile phone call was made came first (1973); Instagram launched came later (2010).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_194"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Galileo observed Jupiter's moons",
      "The Battle of Marathon was fought"
    ],
    "correctAnswer": "The Battle of Marathon was fought",
    "explanation": "The Battle of Marathon was fought came first (490 BCE); Galileo observed Jupiter's moons came later (1610).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_195"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "World War II began in Europe",
      "Google was founded"
    ],
    "correctAnswer": "World War II began in Europe",
    "explanation": "World War II began in Europe came first (1939); Google was founded came later (1998).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_196"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The James Webb Space Telescope launched",
      "The Mongol Empire reached its greatest extent"
    ],
    "correctAnswer": "The Mongol Empire reached its greatest extent",
    "explanation": "The Mongol Empire reached its greatest extent came first (13th century); The James Webb Space Telescope launched came later (2021).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_197"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first public steam railway opened",
      "The Chernobyl nuclear disaster occurred"
    ],
    "correctAnswer": "The first public steam railway opened",
    "explanation": "The first public steam railway opened came first (1825); The Chernobyl nuclear disaster occurred came later (1986).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_198"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first iPhone was released",
      "The Roman Empire began under Augustus"
    ],
    "correctAnswer": "The Roman Empire began under Augustus",
    "explanation": "The Roman Empire began under Augustus came first (27 BCE); The first iPhone was released came later (2007).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_199"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Michelangelo completed the Sistine Chapel ceiling",
      "Sputnik 1 was launched"
    ],
    "correctAnswer": "Michelangelo completed the Sistine Chapel ceiling",
    "explanation": "Michelangelo completed the Sistine Chapel ceiling came first (1512); Sputnik 1 was launched came later (1957).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_200"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Soviet Union dissolved",
      "The Late Bronze Age collapse began"
    ],
    "correctAnswer": "The Late Bronze Age collapse began",
    "explanation": "The Late Bronze Age collapse began came first (c. 1200 BCE); The Soviet Union dissolved came later (1991).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_201"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Prophet Muhammad founded the community in Medina",
      "The Russian Revolution occurred"
    ],
    "correctAnswer": "The Prophet Muhammad founded the community in Medina",
    "explanation": "The Prophet Muhammad founded the community in Medina came first (622 CE); The Russian Revolution occurred came later (1917).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_202"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first image of a black hole was released",
      "Martin Luther King Jr. delivered the I Have a Dream speech"
    ],
    "correctAnswer": "Martin Luther King Jr. delivered the I Have a Dream speech",
    "explanation": "Martin Luther King Jr. delivered the I Have a Dream speech came first (1963); The first image of a black hole was released came later (2019).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_203"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The traditional founding of Rome occurred",
      "The Battle of Waterloo was fought"
    ],
    "correctAnswer": "The traditional founding of Rome occurred",
    "explanation": "The traditional founding of Rome occurred came first (753 BCE); The Battle of Waterloo was fought came later (1815).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_204"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first iPhone was released",
      "The Russian Revolution occurred"
    ],
    "correctAnswer": "The Russian Revolution occurred",
    "explanation": "The Russian Revolution occurred came first (1917); The first iPhone was released came later (2007).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_205"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Martin Luther published the Ninety-five Theses",
      "AlphaGo defeated Lee Sedol"
    ],
    "correctAnswer": "Martin Luther published the Ninety-five Theses",
    "explanation": "Martin Luther published the Ninety-five Theses came first (1517); AlphaGo defeated Lee Sedol came later (2016).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_206"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first PlayStation was released",
      "The French Revolution began"
    ],
    "correctAnswer": "The French Revolution began",
    "explanation": "The French Revolution began came first (1789); The first PlayStation was released came later (1994).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_207"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Norman Conquest of England occurred",
      "Facebook launched"
    ],
    "correctAnswer": "The Norman Conquest of England occurred",
    "explanation": "The Norman Conquest of England occurred came first (1066); Facebook launched came later (2004).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_208"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Apple II computer was released",
      "The printing of Gutenberg's Bible began"
    ],
    "correctAnswer": "The printing of Gutenberg's Bible began",
    "explanation": "The printing of Gutenberg's Bible began came first (1450s); The Apple II computer was released came later (1977).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_209"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The First Emperor unified China",
      "The World Wide Web was proposed"
    ],
    "correctAnswer": "The First Emperor unified China",
    "explanation": "The First Emperor unified China came first (221 BCE); The World Wide Web was proposed came later (1989).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_210"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first commercial jet airliner entered service",
      "The Roman Empire began under Augustus"
    ],
    "correctAnswer": "The Roman Empire began under Augustus",
    "explanation": "The Roman Empire began under Augustus came first (27 BCE); The first commercial jet airliner entered service came later (1952).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_211"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Great Pyramid of Giza was completed",
      "DNA's double-helix structure was described"
    ],
    "correctAnswer": "The Great Pyramid of Giza was completed",
    "explanation": "The Great Pyramid of Giza was completed came first (c. 2560 BCE); DNA's double-helix structure was described came later (1953).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_212"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Einstein published special relativity",
      "The Great Pyramid of Giza was completed"
    ],
    "correctAnswer": "The Great Pyramid of Giza was completed",
    "explanation": "The Great Pyramid of Giza was completed came first (c. 2560 BCE); Einstein published special relativity came later (1905).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_213"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The French Revolution began",
      "CRISPR-Cas9 genome editing was demonstrated in cells"
    ],
    "correctAnswer": "The French Revolution began",
    "explanation": "The French Revolution began came first (1789); CRISPR-Cas9 genome editing was demonstrated in cells came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_214"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "YouTube launched",
      "Newton published Principia Mathematica"
    ],
    "correctAnswer": "Newton published Principia Mathematica",
    "explanation": "Newton published Principia Mathematica came first (1687); YouTube launched came later (2005).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_215"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Columbus reached the Caribbean",
      "Google was founded"
    ],
    "correctAnswer": "Columbus reached the Caribbean",
    "explanation": "Columbus reached the Caribbean came first (1492); Google was founded came later (1998).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_216"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Soviet Union dissolved",
      "The Magna Carta was sealed"
    ],
    "correctAnswer": "The Magna Carta was sealed",
    "explanation": "The Magna Carta was sealed came first (1215); The Soviet Union dissolved came later (1991).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_217"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Charlemagne was crowned emperor",
      "The Apple II computer was released"
    ],
    "correctAnswer": "Charlemagne was crowned emperor",
    "explanation": "Charlemagne was crowned emperor came first (800 CE); The Apple II computer was released came later (1977).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_218"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first email was sent on ARPANET",
      "The Library of Alexandria was founded"
    ],
    "correctAnswer": "The Library of Alexandria was founded",
    "explanation": "The Library of Alexandria was founded came first (3rd century BCE); The first email was sent on ARPANET came later (1971).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_219"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Battle of Marathon was fought",
      "The United Nations was founded"
    ],
    "correctAnswer": "The Battle of Marathon was fought",
    "explanation": "The Battle of Marathon was fought came first (490 BCE); The United Nations was founded came later (1945).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_220"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "ChatGPT was publicly released",
      "The United Nations was founded"
    ],
    "correctAnswer": "The United Nations was founded",
    "explanation": "The United Nations was founded came first (1945); ChatGPT was publicly released came later (2022).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_221"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Darwin published On the Origin of Species",
      "India's Chandrayaan-3 landed near the Moon's south pole"
    ],
    "correctAnswer": "Darwin published On the Origin of Species",
    "explanation": "Darwin published On the Origin of Species came first (1859); India's Chandrayaan-3 landed near the Moon's south pole came later (2023).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_222"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Bitcoin's genesis block was mined",
      "The first modern Olympic Games were held"
    ],
    "correctAnswer": "The first modern Olympic Games were held",
    "explanation": "The first modern Olympic Games were held came first (1896); Bitcoin's genesis block was mined came later (2009).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_223"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Martin Luther published the Ninety-five Theses",
      "The first public steam railway opened"
    ],
    "correctAnswer": "Martin Luther published the Ninety-five Theses",
    "explanation": "Martin Luther published the Ninety-five Theses came first (1517); The first public steam railway opened came later (1825).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_224"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Bitcoin's genesis block was mined",
      "The first text message was sent"
    ],
    "correctAnswer": "The first text message was sent",
    "explanation": "The first text message was sent came first (1992); Bitcoin's genesis block was mined came later (2009).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_225"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Charlemagne was crowned emperor",
      "Shakespeare's Globe Theatre opened"
    ],
    "correctAnswer": "Charlemagne was crowned emperor",
    "explanation": "Charlemagne was crowned emperor came first (800 CE); Shakespeare's Globe Theatre opened came later (1599).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_226"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Amazon launched as an online bookstore",
      "Humans first landed on the Moon"
    ],
    "correctAnswer": "Humans first landed on the Moon",
    "explanation": "Humans first landed on the Moon came first (1969); Amazon launched as an online bookstore came later (1995).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_227"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Buddha lived in northern India",
      "The Magna Carta was sealed"
    ],
    "correctAnswer": "The Buddha lived in northern India",
    "explanation": "The Buddha lived in northern India came first (c. 5th century BCE); The Magna Carta was sealed came later (1215).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_228"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Space Shuttle launch occurred",
      "Insulin was first used to treat diabetes"
    ],
    "correctAnswer": "Insulin was first used to treat diabetes",
    "explanation": "Insulin was first used to treat diabetes came first (1922); The first Space Shuttle launch occurred came later (1981).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_229"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Julius Caesar was assassinated",
      "The first image of a black hole was released"
    ],
    "correctAnswer": "Julius Caesar was assassinated",
    "explanation": "Julius Caesar was assassinated came first (44 BCE); The first image of a black hole was released came later (2019).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_230"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "DNA's double-helix structure was described",
      "The Rosetta Stone was discovered"
    ],
    "correctAnswer": "The Rosetta Stone was discovered",
    "explanation": "The Rosetta Stone was discovered came first (1799); DNA's double-helix structure was described came later (1953).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_231"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Code of Hammurabi was created",
      "YouTube launched"
    ],
    "correctAnswer": "The Code of Hammurabi was created",
    "explanation": "The Code of Hammurabi was created came first (c. 1754 BCE); YouTube launched came later (2005).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_232"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "World War I began",
      "Constantinople fell to the Ottomans"
    ],
    "correctAnswer": "Constantinople fell to the Ottomans",
    "explanation": "Constantinople fell to the Ottomans came first (1453); World War I began came later (1914).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_233"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Berlin Wall fell",
      "AlphaGo defeated Lee Sedol"
    ],
    "correctAnswer": "The Berlin Wall fell",
    "explanation": "The Berlin Wall fell came first (1989); AlphaGo defeated Lee Sedol came later (2016).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_234"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Rosetta Stone was discovered",
      "The Colosseum opened in Rome"
    ],
    "correctAnswer": "The Colosseum opened in Rome",
    "explanation": "The Colosseum opened in Rome came first (80 CE); The Rosetta Stone was discovered came later (1799).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_235"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Sputnik 1 was launched",
      "Twitter launched"
    ],
    "correctAnswer": "Sputnik 1 was launched",
    "explanation": "Sputnik 1 was launched came first (1957); Twitter launched came later (2006).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_236"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Michelangelo completed the Sistine Chapel ceiling",
      "The Code of Hammurabi was created"
    ],
    "correctAnswer": "The Code of Hammurabi was created",
    "explanation": "The Code of Hammurabi was created came first (c. 1754 BCE); Michelangelo completed the Sistine Chapel ceiling came later (1512).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_237"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Einstein published special relativity",
      "The first text message was sent"
    ],
    "correctAnswer": "Einstein published special relativity",
    "explanation": "Einstein published special relativity came first (1905); The first text message was sent came later (1992).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_238"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Higgs boson discovery was announced",
      "The Vikings raided Lindisfarne"
    ],
    "correctAnswer": "The Vikings raided Lindisfarne",
    "explanation": "The Vikings raided Lindisfarne came first (793 CE); The Higgs boson discovery was announced came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_239"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The steam engine patent by James Watt was granted",
      "The first handheld mobile phone call was made"
    ],
    "correctAnswer": "The steam engine patent by James Watt was granted",
    "explanation": "The steam engine patent by James Watt was granted came first (1769); The first handheld mobile phone call was made came later (1973).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_240"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Wikipedia launched",
      "The Library of Alexandria was founded"
    ],
    "correctAnswer": "The Library of Alexandria was founded",
    "explanation": "The Library of Alexandria was founded came first (3rd century BCE); Wikipedia launched came later (2001).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_241"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Mongol Empire reached its greatest extent",
      "India became independent"
    ],
    "correctAnswer": "The Mongol Empire reached its greatest extent",
    "explanation": "The Mongol Empire reached its greatest extent came first (13th century); India became independent came later (1947).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_242"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The first Space Shuttle launch occurred",
      "The first known city-states emerged in Sumer"
    ],
    "correctAnswer": "The first known city-states emerged in Sumer",
    "explanation": "The first known city-states emerged in Sumer came first (c. 3500 BCE); The first Space Shuttle launch occurred came later (1981).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_243"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The First Emperor unified China",
      "The Wright brothers made their first powered flight"
    ],
    "correctAnswer": "The First Emperor unified China",
    "explanation": "The First Emperor unified China came first (221 BCE); The Wright brothers made their first powered flight came later (1903).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_244"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Higgs boson discovery was announced",
      "India became independent"
    ],
    "correctAnswer": "India became independent",
    "explanation": "India became independent came first (1947); The Higgs boson discovery was announced came later (2012).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_245"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The United States Declaration of Independence was adopted",
      "India's Chandrayaan-3 landed near the Moon's south pole"
    ],
    "correctAnswer": "The United States Declaration of Independence was adopted",
    "explanation": "The United States Declaration of Independence was adopted came first (1776); India's Chandrayaan-3 landed near the Moon's south pole came later (2023).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_246"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Facebook launched",
      "The American Civil War began"
    ],
    "correctAnswer": "The American Civil War began",
    "explanation": "The American Civil War began came first (1861); Facebook launched came later (2004).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_247"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Constantinople fell to the Ottomans",
      "Instagram launched"
    ],
    "correctAnswer": "Constantinople fell to the Ottomans",
    "explanation": "Constantinople fell to the Ottomans came first (1453); Instagram launched came later (2010).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_248"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "Nelson Mandela was released from prison",
      "Shakespeare's Globe Theatre opened"
    ],
    "correctAnswer": "Shakespeare's Globe Theatre opened",
    "explanation": "Shakespeare's Globe Theatre opened came first (1599); Nelson Mandela was released from prison came later (1990).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_249"
  },
  {
    "sport": "knowledge",
    "category": "which_came_first",
    "question": "Which came first?",
    "options": [
      "The Prophet Muhammad founded the community in Medina",
      "The first PlayStation was released"
    ],
    "correctAnswer": "The Prophet Muhammad founded the community in Medina",
    "explanation": "The Prophet Muhammad founded the community in Medina came first (622 CE); The first PlayStation was released came later (1994).",
    "difficulty": "intermediate",
    "bucket": "knowledge_came_first_intermediate",
    "checksum": "knowledge_came_first_v1_250"
  }
];

knowledgeQuestions.push(...knowledgeExpansionV1Questions);
knowledgeQuestions.push(...knowledgeCameFirstExpansionV2Questions);
knowledgeQuestions.push(...knowledgeExpansionV2Questions);
