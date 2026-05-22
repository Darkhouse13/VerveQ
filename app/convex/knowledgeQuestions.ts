export type KnowledgeQuestionSeed = {
  sport: string;
  category: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
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
      "Oxygen",
      "Carbon dioxide",
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
      "5",
      "6",
      "7",
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
      "Tokyo",
      "Sapporo"
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
      "Magnetism",
      "Gravity",
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
      "0°C",
      "10°C",
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
      "Leonardo da Vinci",
      "Vincent van Gogh",
      "Pablo Picasso"
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
      "Albert Einstein",
      "Galileo Galilei",
      "Niels Bohr"
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
      "Ancient Egyptians",
      "Aztecs",
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
      "Wright brothers",
      "Montgolfier brothers",
      "Grimm brothers",
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
      "Alexander Fleming",
      "Louis Pasteur",
      "Gregor Mendel"
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
      "Microscope",
      "Telescope",
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
      "An equal and opposite reaction",
      "A random outcome",
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
      "Giraffe",
      "Kangaroo",
      "Penguin",
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
      "Diamond",
      "Quartz",
      "Granite"
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
      "3",
      "4",
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
      "Heart",
      "Liver"
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
      "William Shakespeare",
      "Jane Austen",
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
      "Berlin Wall",
      "Western Wall"
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
      "DNA",
      "ATP",
      "Insulin",
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
      "Carbon dioxide",
      "Nitrogen",
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
      "Entropy",
      "Velocity",
      "Mass",
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
      "Resistance",
      "Mass",
      "Pressure",
      "Frequency"
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
      "Marie Curie",
      "Ada Lovelace",
      "Lise Meitner"
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
      "Stephen Hawking",
      "Carl Sagan",
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
      "England",
      "Spain",
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
      "Spanish",
      "Mandarin Chinese",
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
      "Skin",
      "Lung",
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
      "Saturn",
      "Mars",
      "Mercury",
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
      "Energy cannot be created or destroyed",
      "Energy is always heat",
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
      "James Watson",
      "Gregor Mendel",
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
      "Event horizon",
      "Singularity shell",
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
      "Higgs boson",
      "Muon neutrino",
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
      "Quantum mechanics",
      "Classical thermodynamics",
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
      "Pauli exclusion principle",
      "Huygens principle",
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
      "Jocelyn Bell Burnell",
      "Vera Rubin",
      "Cecilia Payne-Gaposchkin",
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
      "Edwin Hubble",
      "Nicolas Copernicus",
      "Johannes Kepler",
      "William Herschel"
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
      "Cecilia Payne-Gaposchkin",
      "Marie Curie",
      "Emmy Noether",
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
      "Sumerians",
      "Phoenicians",
      "Minoans",
      "Olmecs"
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
      "Egyptian hieroglyphs",
      "Mayan glyphs",
      "Linear B",
      "Cuneiform"
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
      "Farad",
      "Tesla",
      "Weber",
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
      "Tungsten",
      "Tin",
      "Titanium",
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
      "Blue",
      "Green",
      "Yellow",
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
      "Bat",
      "Sugar glider",
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
      "Reverse transcriptase",
      "DNA ligase",
      "Amylase",
      "Helicase"
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
      "Speed of light in vacuum",
      "Mass of a rocket fuel tank",
      "Sound speed in air",
      "Earth's gravity"
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
      "Selman Waksman",
      "Alexander Fleming",
      "Robert Koch",
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
  }
];
