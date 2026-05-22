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
      "Flying squirrel",
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
  },
  {
    "sport": "knowledge",
    "category": "history",
    "question": "In which year did World War II end?",
    "options": [
      "1945",
      "1939",
      "1918",
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
      "6",
      "5",
      "7",
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
      "Alexander Graham Bell",
      "Thomas Edison",
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
      "Heart",
      "Liver",
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
      "Zebra",
      "Tiger",
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
      "60",
      "30",
      "90",
      "100"
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
      "Movable-type printing press",
      "Steam engine",
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
      "Charles Darwin",
      "Isaac Newton",
      "Gregor Mendel",
      "Albert Einstein"
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
      "Penguin",
      "Ostrich",
      "Emu",
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
      "7",
      "0",
      "5",
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
      "Nile River",
      "Amazon River",
      "Yangtze River",
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
      "Italian Peninsula",
      "Iberian Peninsula",
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
      "Moby-Dick",
      "The Great Gatsby",
      "Treasure Island",
      "Robinson Crusoe"
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
      "Red blood cells",
      "White blood cells",
      "Platelets",
      "Plasma cells"
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
      "0 degrees Celsius",
      "10 degrees Celsius",
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
      "Thomas Edison",
      "James Watt",
      "Michael Faraday",
      "Samuel Morse"
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
      "J. J. Thomson",
      "Ernest Rutherford",
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
      "Law of conservation of energy",
      "Law of universal gravitation",
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
      "206",
      "180",
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
      "Platypus",
      "Koala",
      "Kangaroo",
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
      "Electron",
      "Proton",
      "Neutron",
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
      "Tibet",
      "Xinjiang",
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
      "DNA",
      "Glucose",
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
      "Milky Way",
      "Andromeda",
      "Triangulum",
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
      "Mandarin Chinese",
      "English",
      "Spanish",
      "Hindi"
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
      "Tim Berners-Lee",
      "Bill Gates",
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
      "Henri Becquerel",
      "Marie Curie",
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
      "Attraction between masses",
      "Flow of electric current",
      "Expansion of gases",
      "Reflection of light"
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
      "Cerebellum",
      "Cerebrum",
      "Medulla oblongata",
      "Hypothalamus"
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
      "Africa",
      "Europe",
      "Asia",
      "South America"
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
      "The Wright brothers",
      "Charles Lindbergh",
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
      "Johannes Kepler",
      "Galileo Galilei",
      "Isaac Newton",
      "Tycho Brahe"
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
      "Temperature",
      "Mass density only",
      "Electric charge",
      "Humidity"
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
      "Diamond",
      "Quartz",
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
      "NaCl",
      "KCl",
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
      "Australia",
      "Greenland",
      "Madagascar",
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
      "1215",
      "1066",
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
      "Cell",
      "Atom",
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
      "Jupiter",
      "Saturn",
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
      "Guglielmo Marconi",
      "Alexander Fleming",
      "James Clerk Maxwell",
      "Alessandro Volta"
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
      "It tends to increase",
      "It always becomes zero",
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
      "Vitamin D",
      "Vitamin C",
      "Vitamin B12",
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
      "Antarctica",
      "Europe",
      "Australia",
      "North America"
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
      "Ural Mountains",
      "Alps",
      "Himalayas",
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
      "French Revolution",
      "Industrial Revolution",
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
      "Antonio Vivaldi",
      "Johann Sebastian Bach",
      "Wolfgang Amadeus Mozart",
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
      "The changing view of the Moon's sunlit half",
      "Earth's shadow covering the Moon every night",
      "The Moon changing its own shape",
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
      "Thermometer",
      "Barometer",
      "Hygrometer",
      "Anemometer"
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
      "Alfred Nobel",
      "Marie Curie",
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
      "An elastic spring",
      "A spinning planet",
      "A chemical battery",
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
      "Melanin",
      "Keratin",
      "Collagen",
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
      "Peru",
      "Mexico",
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
      "Pablo Picasso",
      "Diego Velazquez",
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
      "Fungi",
      "Plants",
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
      "Supernova",
      "Comet",
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
      "Oxygen",
      "Nitrogen",
      "Carbon dioxide",
      "Helium"
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
      "Edward Jenner",
      "Louis Pasteur",
      "Joseph Lister",
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
      "Wilhelm Roentgen",
      "Max Planck",
      "Niels Bohr",
      "Enrico Fermi"
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
      "Ellipse",
      "Perfect circle",
      "Parabola",
      "Straight line"
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
      "Incisors",
      "Molars",
      "Canines",
      "Premolars"
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
      "Giraffe",
      "Elephant",
      "Camel",
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
      "Elastic potential energy",
      "Nuclear energy",
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
      "Strait of Gibraltar",
      "Bering Strait",
      "Strait of Hormuz",
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
      "Silk Road",
      "Amber Road",
      "Appian Way",
      "Trans-Saharan Route"
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
      "Dante Alighieri",
      "Geoffrey Chaucer",
      "Miguel de Cervantes",
      "John Milton"
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
      "Komodo dragon",
      "Iguana",
      "Gila monster",
      "Monitor lizard"
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
      "Mercury",
      "Venus",
      "Earth",
      "Mars"
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
      "L",
      "C",
      "X",
      "V"
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
      "Eli Whitney",
      "Robert Fulton",
      "Samuel Colt",
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
      "James Watson",
      "Linus Pauling",
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
      "Speed of light",
      "Electric charge",
      "Heat capacity",
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
      "Hearing",
      "Taste",
      "Smell",
      "Touch"
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
      "Honey",
      "Maple syrup",
      "Molasses",
      "Sap"
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
      "DNA",
      "ATP",
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
      "Saturn",
      "Mars",
      "Venus",
      "Mercury"
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
      "3.14",
      "2.72",
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
      "Alexander Fleming",
      "Louis Pasteur",
      "Robert Koch",
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
      "Ampere",
      "Volt",
      "Ohm",
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
      "Mass-energy equivalence",
      "Universal gravitation",
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
      "Nicolaus Copernicus",
      "Ptolemy",
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
      "Conservation of energy",
      "Pauli exclusion principle",
      "Hubble's law",
      "Le Chatelier's principle"
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
      "ENIAC",
      "UNIVAC I",
      "Colossus",
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
      "Ohm's law",
      "Faraday's law",
      "Boyle's law",
      "Hooke's law"
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
      "Milky Way",
      "Andromeda",
      "Triangulum",
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
      "James Watson and Francis Crick",
      "Charles Darwin and Alfred Russel Wallace",
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
      "Boyle's law",
      "Charles's law",
      "Avogadro's law",
      "Dalton's law"
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
      "Gamma rays",
      "Microwaves",
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
      "Carbon dioxide",
      "Hydrogen",
      "Oxygen",
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
      "Gregor Mendel",
      "Charles Darwin",
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
      "Jupiter",
      "Saturn",
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
      "Lithosphere",
      "Asthenosphere",
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
      "Jonas Salk",
      "Edward Jenner",
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
      "Ellipses",
      "Perfect circles",
      "Parabolas only",
      "Straight lines"
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
      "Pythagoras",
      "Euclid",
      "Archimedes",
      "Eratosthenes"
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
      "Electron",
      "Proton",
      "Neutron",
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
      "Dmitri Mendeleev",
      "Antoine Lavoisier",
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
      "Calculus",
      "Geometry",
      "Number theory",
      "Topology"
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
      "Pangaea",
      "Gondwana",
      "Laurasia",
      "Rodinia"
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
      "J. J. Thomson",
      "Ernest Rutherford",
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
      "Thomas Edison",
      "Benjamin Franklin",
      "James Watt",
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
      "Entropy",
      "Velocity",
      "Electric charge",
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
      "Make an observation",
      "Publish a conclusion",
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
      "300,000 kilometers per second",
      "30,000 kilometers per second",
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
      "Gravity",
      "Magnetism",
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
      "James Chadwick",
      "Niels Bohr",
      "Enrico Fermi",
      "Werner Heisenberg"
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
      "Thomas Newcomen",
      "James Watt",
      "George Stephenson",
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
      "Pauli exclusion principle",
      "Uncertainty principle",
      "Correspondence principle",
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
      "Carl Linnaeus",
      "Gregor Mendel",
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
      "6.02 × 10^23",
      "3.00 × 10^8",
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
      "Protein synthesis",
      "DNA replication only",
      "Lipid storage",
      "Photosynthesis"
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
      "2x",
      "x",
      "x^3",
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
      "The Wright brothers",
      "Gustave Eiffel",
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
      "Genetics",
      "Geology",
      "Optics",
      "Meteorology"
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
      "Joule",
      "Newton",
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
      "Proton",
      "Neutron",
      "Electron",
      "Photon"
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
      "Meteorology",
      "Seismology",
      "Oceanography",
      "Mineralogy"
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
      "Dmitri Mendeleev",
      "Marie Curie",
      "Amedeo Avogadro",
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
      "Samuel Morse",
      "Alexander Graham Bell",
      "Guglielmo Marconi",
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
      "An induced electromotive force",
      "A decrease in mass",
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
      "Louis Pasteur",
      "Isaac Newton",
      "Niels Bohr",
      "Edwin Hubble"
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
      "Max Planck",
      "Albert Einstein",
      "Richard Feynman",
      "Erwin Schrödinger"
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
      "Table salt",
      "Baking soda",
      "Vinegar",
      "Bleach"
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
      "Meiosis",
      "Mitosis",
      "Binary fission",
      "Budding"
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
      "Diamond",
      "Quartz",
      "Topaz",
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
      "Wilhelm Röntgen",
      "Henri Becquerel",
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
      "Charles Babbage",
      "Alan Turing",
      "Blaise Pascal",
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
      "Watt",
      "Joule",
      "Ampere",
      "Coulomb"
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
      "Jane Austen",
      "Charlotte Bronte",
      "Mary Shelley",
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
      "Romance",
      "Germanic",
      "Slavic",
      "Semitic"
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
      "Matcha",
      "Sake",
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
      "Heart",
      "Liver",
      "Kidney",
      "Lung"
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
      "Seven",
      "Five",
      "Six",
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
      "Roman Empire",
      "Byzantine Empire",
      "Persian Empire",
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
      "Ottawa",
      "Toronto",
      "Vancouver",
      "Montreal"
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
      "Rene Descartes",
      "Immanuel Kant",
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
      "Arabic script",
      "Cyrillic script",
      "Devanagari script",
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
      "Hinduism",
      "Christianity",
      "Shinto",
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
      "Johannes Gutenberg",
      "Isaac Newton",
      "Galileo Galilei",
      "James Watt"
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
      "Zebra",
      "Giraffe",
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
      "Carbon dioxide",
      "Oxygen",
      "Nitrogen",
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
      "Egyptian hieroglyphs",
      "Mayan glyphs",
      "Cuneiform",
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
      "Dante Alighieri",
      "Virgil",
      "Petrarch",
      "Giovanni Boccaccio"
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
      "Confucius",
      "Laozi",
      "Mencius",
      "Mozi"
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
      "Palindrome",
      "Homonym",
      "Acronym",
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
      "Spain",
      "Portugal",
      "Italy",
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
      "Isaac Newton",
      "Albert Einstein",
      "Charles Darwin",
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
      "Tivadar Puskas",
      "Samuel Morse",
      "Eli Whitney",
      "Alessandro Volta"
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
      "Parrot",
      "Penguin",
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
      "Tanzania",
      "Kenya",
      "Uganda",
      "Ethiopia"
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
      "William Shakespeare",
      "Christopher Marlowe",
      "Ben Jonson",
      "Moliere"
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
      "Korean",
      "Japanese",
      "Thai",
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
      "Powered airplane",
      "Steam locomotive",
      "Telegraph",
      "Electric light bulb"
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
      "Pompeii",
      "Carthage",
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
      "Ludwig van Beethoven",
      "Wolfgang Amadeus Mozart",
      "Johann Sebastian Bach",
      "Franz Schubert"
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
      "Plato",
      "Aristotle",
      "Seneca",
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
      "Latin",
      "Greek",
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
      "Japanese",
      "Thai",
      "Korean",
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
      "O negative",
      "AB positive",
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
      "Immanuel Kant",
      "Friedrich Nietzsche",
      "John Stuart Mill",
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
      "Mandarin Chinese",
      "English",
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
      "Japan",
      "India",
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
      "Chinese",
      "Roman",
      "Greek",
      "Egyptian"
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
      "Refraction and reflection of sunlight in water droplets",
      "Magnetism in clouds",
      "Heat rising from the ground",
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
      "Nitrogen",
      "Oxygen",
      "Carbon dioxide",
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
      "Ural Mountains",
      "Alps",
      "Himalayas",
      "Carpathians"
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
      "Thomas Hobbes",
      "John Locke",
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
      "Many",
      "Small",
      "Before",
      "Against"
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
      "Wayfinders",
      "Samurai",
      "Bedouins",
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
      "Cerebellum",
      "Hippocampus",
      "Amygdala",
      "Medulla"
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
      "Thomas Edison",
      "Michael Faraday",
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
      "90",
      "45",
      "180",
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
      "Hammurabi of Babylon",
      "Cyrus the Great",
      "Ramses II",
      "Ashoka"
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
      "French",
      "German",
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
      "Lighthouse of Alexandria",
      "Colossus of Rhodes",
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
      "Chinese",
      "Mayan",
      "Roman",
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
      "Octopus",
      "Sea turtle",
      "Dolphin",
      "Jellyfish"
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
      "Evaporation",
      "Condensation",
      "Freezing",
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
      "Jordan",
      "Lebanon",
      "Syria",
      "Iraq"
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
      "Gabriel Garcia Marquez",
      "Jorge Luis Borges",
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
      "Daoism",
      "Stoicism",
      "Existentialism",
      "Utilitarianism"
    ],
    "correctAnswer": "Daoism",
    "explanation": "Daoism centers on the Dao, often translated as 'the Way.'",
    "difficulty": "easy",
    "bucket": "knowledge_easy_philosophy",
    "checksum": "knowledge_v1_300"
  }
];
