import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];
type SourceKey = keyof typeof knowledgeCameFirstExpansionV2Provenance;

type TimelineItem = {
  label: string;
  date: string;
  sortKey: number;
};

type Timeline = {
  sourceKey: SourceKey;
  items: TimelineItem[];
};

export type CameFirstReviewRow = {
  checksum: string;
  sourceKey: SourceKey;
  earlier: string;
  earlierDate: string;
  later: string;
  laterDate: string;
  markedEarlier: string;
};

export const knowledgeCameFirstExpansionV2Provenance = {
  ancient_states_monuments:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates and public-domain ancient history chronologies for rulers, battles, monuments, and treaties.",
  world_thought_learning:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, public-domain library catalog records, and institutional encyclopedia timelines for works, councils, philosophers, and universities.",
  exploration_world_milestones:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates and public-domain exploration, geography, and intergovernmental timeline records.",
  literature_art_music:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, public-domain bibliographic records, museum collection records, and performance chronologies.",
  science_discovery:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, Nobel/NASA-class institutional records, and public-domain scientific chronology references.",
  inventions_transport_industry:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, patent-office timelines, museum records, and standards/infrastructure histories.",
  medicine_public_health:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, WHO/NIH-class public health records, and public-domain medical history timelines.",
  media_sports_culture:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, public-domain sports records, library records, and publisher or broadcaster release chronologies.",
  computing_internet:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates, public-domain computer history timelines, standards records, and official release histories.",
  aviation_space:
    "Custom VerveQ-authored pairs verified against Wikidata CC0 structured dates and NASA/ESA/FAA-class public aviation and spaceflight records.",
  no_open_trivia_corpus:
    "No OpenTDB, CC-BY-SA trivia corpus, or copied trivia-pack content was ingested; rows are custom-authored from open structured/reference dates.",
} as const;

const difficulty: Difficulty = "intermediate";
const bucket = "knowledge_came_first_intermediate";
const category = "which_came_first";
const questionKind = "which_came_first";

const TIMELINES: Timeline[] = [
  {
    sourceKey: "ancient_states_monuments",
    items: [
      { label: "The Narmer Palette was created", date: "c. 3100 BCE", sortKey: -3100 },
      { label: "The Step Pyramid of Djoser was completed", date: "c. 2650 BCE", sortKey: -2650 },
      { label: "The Code of Hammurabi was inscribed", date: "c. 1754 BCE", sortKey: -1754 },
      { label: "The Egyptian-Hittite peace treaty was signed", date: "c. 1259 BCE", sortKey: -1259 },
      { label: "Rome's traditional founding date occurred", date: "753 BCE", sortKey: -753 },
      { label: "Jerusalem fell to the Neo-Babylonian Empire", date: "587 BCE", sortKey: -587 },
      { label: "Cyrus the Great captured Babylon", date: "539 BCE", sortKey: -539 },
      { label: "The Battle of Salamis was fought", date: "480 BCE", sortKey: -480 },
      { label: "The Parthenon was completed in Athens", date: "432 BCE", sortKey: -432 },
      { label: "Alexander the Great began his Persian campaign", date: "334 BCE", sortKey: -334 },
      { label: "The Qin dynasty unified China", date: "221 BCE", sortKey: -221 },
      { label: "The Rosetta Stone decree was inscribed", date: "196 BCE", sortKey: -196 },
      { label: "Caesar crossed the Rubicon", date: "49 BCE", sortKey: -49 },
      { label: "The reign of Augustus began in Rome", date: "27 BCE", sortKey: -27 },
      { label: "Pompeii was buried by Mount Vesuvius", date: "79 CE", sortKey: 79 },
      { label: "Trajan's Column was completed in Rome", date: "113 CE", sortKey: 113 },
      { label: "Construction began on Hadrian's Wall", date: "122 CE", sortKey: 122 },
      { label: "The Edict of Milan was issued", date: "313 CE", sortKey: 313 },
      { label: "The First Council of Nicaea convened", date: "325 CE", sortKey: 325 },
      { label: "The Western Roman Empire ended", date: "476 CE", sortKey: 476 },
      { label: "Justinian's Hagia Sophia was completed", date: "537 CE", sortKey: 537 },
      { label: "Muhammad migrated from Mecca to Medina", date: "622 CE", sortKey: 622 },
      { label: "The Dome of the Rock was completed", date: "691 CE", sortKey: 691 },
      { label: "Vikings raided Lindisfarne", date: "793 CE", sortKey: 793 },
      { label: "Charlemagne was crowned emperor in Rome", date: "800 CE", sortKey: 800 },
      { label: "The Treaty of Verdun divided the Carolingian Empire", date: "843 CE", sortKey: 843 },
      { label: "The Battle of Hastings was fought", date: "1066 CE", sortKey: 1066 },
      { label: "The Domesday Book was completed", date: "1086 CE", sortKey: 1086 },
      { label: "The First Crusade captured Jerusalem", date: "1099 CE", sortKey: 1099 },
      { label: "The Fourth Lateran Council opened", date: "1215 CE", sortKey: 1215 },
      { label: "The Wars of the Roses began", date: "1455 CE", sortKey: 1455 },
    ],
  },
  {
    sourceKey: "world_thought_learning",
    items: [
      { label: "Confucius was born", date: "551 BCE", sortKey: -551 },
      { label: "Socrates was born", date: "470 BCE", sortKey: -470 },
      { label: "Plato founded the Academy in Athens", date: "c. 387 BCE", sortKey: -387 },
      { label: "Aristotle founded the Lyceum", date: "335 BCE", sortKey: -335 },
      { label: "Ashoka issued rock edicts", date: "c. 260 BCE", sortKey: -260 },
      { label: "Cicero was born in the Roman Republic", date: "106 BCE", sortKey: -106 },
      { label: "Jesus was crucified under Pontius Pilate", date: "c. 30 CE", sortKey: 30 },
      { label: "Jerome completed the Latin Vulgate", date: "c. 405 CE", sortKey: 405 },
      { label: "Benedict wrote the Rule of Saint Benedict", date: "c. 530 CE", sortKey: 530 },
      { label: "Bede completed Ecclesiastical History of the English People", date: "731 CE", sortKey: 731 },
      { label: "Al-Khwarizmi wrote an algebra treatise", date: "c. 820 CE", sortKey: 820 },
      { label: "Al-Azhar was founded in Cairo as a mosque", date: "970 CE", sortKey: 970 },
      { label: "The University of Bologna was founded", date: "1088 CE", sortKey: 1088 },
      { label: "Teaching at Oxford was documented", date: "1096 CE", sortKey: 1096 },
      { label: "Maimonides completed the Mishneh Torah", date: "c. 1180 CE", sortKey: 1180 },
      { label: "The University of Paris received royal recognition", date: "1200 CE", sortKey: 1200 },
      { label: "Thomas Aquinas began the Summa Theologiae", date: "1265 CE", sortKey: 1265 },
      { label: "Dante completed the Divine Comedy", date: "1321 CE", sortKey: 1321 },
      { label: "Erasmus published his Greek New Testament", date: "1516 CE", sortKey: 1516 },
      { label: "Zwingli began preaching reform in Zurich", date: "1519 CE", sortKey: 1519 },
      { label: "The Council of Trent opened", date: "1545 CE", sortKey: 1545 },
      { label: "The King James Bible was published", date: "1611 CE", sortKey: 1611 },
      { label: "Descartes published Discourse on the Method", date: "1637 CE", sortKey: 1637 },
      { label: "Spinoza's Ethics was published", date: "1677 CE", sortKey: 1677 },
      { label: "Kant published Critique of Pure Reason", date: "1781 CE", sortKey: 1781 },
      { label: "Wollstonecraft published Rights of Woman", date: "1792 CE", sortKey: 1792 },
      { label: "The Book of Mormon was first published in New York", date: "1830 CE", sortKey: 1830 },
      { label: "The Communist Manifesto was published by Marx and Engels", date: "1848 CE", sortKey: 1848 },
      { label: "Nietzsche published the first part of Thus Spoke Zarathustra", date: "1883 CE", sortKey: 1883 },
      { label: "Freud published The Interpretation of Dreams", date: "1899 CE", sortKey: 1899 },
      { label: "The Second Vatican Council opened", date: "1962 CE", sortKey: 1962 },
    ],
  },
  {
    sourceKey: "exploration_world_milestones",
    items: [
      { label: "Norse settlement in Greenland began", date: "c. 985 CE", sortKey: 985 },
      { label: "Leif Erikson reached Vinland", date: "c. 1000 CE", sortKey: 1000 },
      { label: "Polo departed Venice for Asia", date: "1271 CE", sortKey: 1271 },
      { label: "Zheng He began his first treasure voyage", date: "1405 CE", sortKey: 1405 },
      { label: "Portugal captured the port of Ceuta", date: "1415 CE", sortKey: 1415 },
      { label: "Bartolomeu Dias rounded the Cape of Good Hope", date: "1488 CE", sortKey: 1488 },
      { label: "The Treaty of Tordesillas was signed", date: "1494 CE", sortKey: 1494 },
      { label: "Vasco da Gama reached India by sea", date: "1498 CE", sortKey: 1498 },
      { label: "Magellan's expedition departed Spain", date: "1519 CE", sortKey: 1519 },
      { label: "The Spanish conquest of Tenochtitlan was completed", date: "1521 CE", sortKey: 1521 },
      { label: "Pizarro captured Atahualpa at Cajamarca", date: "1532 CE", sortKey: 1532 },
      { label: "Jacques Cartier reached the St. Lawrence River", date: "1535 CE", sortKey: 1535 },
      { label: "Francis Drake completed his circumnavigation", date: "1580 CE", sortKey: 1580 },
      { label: "Jamestown was founded in Virginia", date: "1607 CE", sortKey: 1607 },
      { label: "The Mayflower reached Plymouth", date: "1620 CE", sortKey: 1620 },
      { label: "The Hudson's Bay Company was chartered", date: "1670 CE", sortKey: 1670 },
      { label: "James Cook reached eastern Australia", date: "1770 CE", sortKey: 1770 },
      { label: "The Lewis and Clark expedition departed", date: "1804 CE", sortKey: 1804 },
      { label: "Darwin reached the Galapagos on HMS Beagle", date: "1835 CE", sortKey: 1835 },
      { label: "The California Gold Rush began", date: "1848 CE", sortKey: 1848 },
      { label: "The Suez Canal opened", date: "1869 CE", sortKey: 1869 },
      { label: "Stanley met Livingstone near Lake Tanganyika", date: "1871 CE", sortKey: 1871 },
      { label: "The Klondike Gold Rush began", date: "1896 CE", sortKey: 1896 },
      { label: "Amundsen reached the South Pole", date: "1911 CE", sortKey: 1911 },
      { label: "The Panama Canal opened to shipping", date: "1914 CE", sortKey: 1914 },
      { label: "Hillary and Tenzing reached Everest's summit", date: "1953 CE", sortKey: 1953 },
      { label: "The Antarctic Treaty was signed", date: "1959 CE", sortKey: 1959 },
      { label: "The first GPS satellite was launched", date: "1978 CE", sortKey: 1978 },
      { label: "The Channel Tunnel opened", date: "1994 CE", sortKey: 1994 },
      { label: "Hong Kong was handed over to China", date: "1997 CE", sortKey: 1997 },
      { label: "Euro banknotes and coins entered circulation", date: "2002 CE", sortKey: 2002 },
    ],
  },
  {
    sourceKey: "literature_art_music",
    items: [
      { label: "The earliest Gilgamesh poems were copied", date: "c. 2100 BCE", sortKey: -2100 },
      { label: "Sophocles' Antigone was first performed", date: "c. 441 BCE", sortKey: -441 },
      { label: "Virgil completed the Aeneid", date: "c. 19 BCE", sortKey: -19 },
      { label: "The Beowulf manuscript was written", date: "c. 1000 CE", sortKey: 1000 },
      { label: "The Tale of Genji was completed", date: "c. 1010 CE", sortKey: 1010 },
      { label: "The Bayeux Tapestry was completed", date: "c. 1077 CE", sortKey: 1077 },
      { label: "Petrarch was crowned poet laureate in Rome", date: "1341 CE", sortKey: 1341 },
      { label: "Chaucer began The Canterbury Tales", date: "c. 1387 CE", sortKey: 1387 },
      { label: "Leonardo began The Last Supper", date: "1495 CE", sortKey: 1495 },
      { label: "Leonardo began the Mona Lisa", date: "c. 1503 CE", sortKey: 1503 },
      { label: "Michelangelo completed David", date: "1504 CE", sortKey: 1504 },
      { label: "Raphael completed The School of Athens", date: "1511 CE", sortKey: 1511 },
      { label: "Hamlet was first performed", date: "c. 1600 CE", sortKey: 1600 },
      { label: "Don Quixote Part One was published", date: "1605 CE", sortKey: 1605 },
      { label: "Monteverdi's Orfeo premiered", date: "1607 CE", sortKey: 1607 },
      { label: "Paradise Lost was published", date: "1667 CE", sortKey: 1667 },
      { label: "Bach completed the Brandenburg Concertos", date: "1721 CE", sortKey: 1721 },
      { label: "Handel's Messiah premiered", date: "1742 CE", sortKey: 1742 },
      { label: "Mozart's The Marriage of Figaro premiered", date: "1786 CE", sortKey: 1786 },
      { label: "Beethoven's Fifth Symphony premiered", date: "1808 CE", sortKey: 1808 },
      { label: "Shelley published Frankenstein", date: "1818 CE", sortKey: 1818 },
      { label: "The Hunchback of Notre-Dame was published", date: "1831 CE", sortKey: 1831 },
      { label: "Poe's The Raven was published", date: "1845 CE", sortKey: 1845 },
      { label: "Moby-Dick was published", date: "1851 CE", sortKey: 1851 },
      { label: "Wagner's Tristan und Isolde premiered", date: "1865 CE", sortKey: 1865 },
      { label: "Tolstoy completed War and Peace", date: "1869 CE", sortKey: 1869 },
      { label: "Monet exhibited Impression, Sunrise", date: "1874 CE", sortKey: 1874 },
      { label: "Tchaikovsky's Swan Lake premiered", date: "1877 CE", sortKey: 1877 },
      { label: "Van Gogh painted The Starry Night", date: "1889 CE", sortKey: 1889 },
      { label: "The Rite of Spring premiered", date: "1913 CE", sortKey: 1913 },
      { label: "Picasso painted Guernica", date: "1937 CE", sortKey: 1937 },
    ],
  },
  {
    sourceKey: "science_discovery",
    items: [
      { label: "Aristarchus proposed a heliocentric model", date: "c. 270 BCE", sortKey: -270 },
      { label: "Ptolemy completed the Almagest", date: "c. 150 CE", sortKey: 150 },
      { label: "Ibn al-Haytham completed the Book of Optics", date: "c. 1021 CE", sortKey: 1021 },
      { label: "Copernicus published De revolutionibus", date: "1543 CE", sortKey: 1543 },
      { label: "Tycho Brahe observed his supernova", date: "1572 CE", sortKey: 1572 },
      { label: "Kepler published Astronomia nova", date: "1609 CE", sortKey: 1609 },
      { label: "William Harvey published De Motu Cordis", date: "1628 CE", sortKey: 1628 },
      { label: "Robert Boyle published The Sceptical Chymist", date: "1661 CE", sortKey: 1661 },
      { label: "Robert Hooke published Micrographia", date: "1665 CE", sortKey: 1665 },
      { label: "Halley predicted his comet's return", date: "1705 CE", sortKey: 1705 },
      { label: "Lavoisier named the element oxygen", date: "1777 CE", sortKey: 1777 },
      { label: "Herschel discovered Uranus", date: "1781 CE", sortKey: 1781 },
      { label: "Dalton presented modern atomic theory", date: "1803 CE", sortKey: 1803 },
      { label: "Faraday discovered electromagnetic induction", date: "1831 CE", sortKey: 1831 },
      { label: "Joule published the mechanical equivalent of heat", date: "1845 CE", sortKey: 1845 },
      { label: "Mendel presented his pea plant heredity experiments", date: "1865 CE", sortKey: 1865 },
      { label: "Mendeleev published the periodic table", date: "1869 CE", sortKey: 1869 },
      { label: "Rontgen discovered X-rays", date: "1895 CE", sortKey: 1895 },
      { label: "J. J. Thomson announced the electron", date: "1897 CE", sortKey: 1897 },
      { label: "Planck introduced the quantum hypothesis", date: "1900 CE", sortKey: 1900 },
      { label: "Rutherford discovered the atomic nucleus", date: "1911 CE", sortKey: 1911 },
      { label: "Wegener proposed continental drift", date: "1912 CE", sortKey: 1912 },
      { label: "Hubble identified a Cepheid in Andromeda", date: "1924 CE", sortKey: 1924 },
      { label: "Chadwick discovered the neutron", date: "1932 CE", sortKey: 1932 },
      { label: "Hahn and Strassmann reported nuclear fission", date: "1939 CE", sortKey: 1939 },
      { label: "Watson and Crick proposed the DNA double helix", date: "1953 CE", sortKey: 1953 },
      { label: "Penzias and Wilson detected the cosmic microwave background", date: "1965 CE", sortKey: 1965 },
      { label: "Plate tectonics became the standard geological model", date: "c. 1968 CE", sortKey: 1968 },
      { label: "The first confirmed exoplanets were announced", date: "1992 CE", sortKey: 1992 },
      { label: "The Human Genome Project was completed", date: "2003 CE", sortKey: 2003 },
      { label: "The first gravitational waves were announced", date: "2016 CE", sortKey: 2016 },
    ],
  },
  {
    sourceKey: "inventions_transport_industry",
    items: [
      { label: "Huygens patented the pendulum clock", date: "1657 CE", sortKey: 1657 },
      { label: "Newcomen's atmospheric engine first worked", date: "1712 CE", sortKey: 1712 },
      { label: "John Kay patented the flying shuttle", date: "1733 CE", sortKey: 1733 },
      { label: "Franklin performed his kite experiment", date: "1752 CE", sortKey: 1752 },
      { label: "Arkwright patented the water frame", date: "1769 CE", sortKey: 1769 },
      { label: "The Montgolfier brothers made a manned balloon flight", date: "1783 CE", sortKey: 1783 },
      { label: "Eli Whitney received a cotton gin patent", date: "1794 CE", sortKey: 1794 },
      { label: "Volta announced the voltaic pile", date: "1800 CE", sortKey: 1800 },
      { label: "The Jacquard loom was demonstrated", date: "1801 CE", sortKey: 1801 },
      { label: "Trevithick's steam locomotive ran on rails", date: "1804 CE", sortKey: 1804 },
      { label: "Stephenson's Rocket won the Rainhill Trials", date: "1829 CE", sortKey: 1829 },
      { label: "McCormick patented his mechanical reaper", date: "1834 CE", sortKey: 1834 },
      { label: "Morse sent the first Washington-Baltimore telegraph message", date: "1844 CE", sortKey: 1844 },
      { label: "Otis demonstrated the safety elevator", date: "1854 CE", sortKey: 1854 },
      { label: "Bessemer received his steel process patent", date: "1856 CE", sortKey: 1856 },
      { label: "The first transatlantic telegraph cable was completed", date: "1866 CE", sortKey: 1866 },
      { label: "The U.S. transcontinental railroad was completed", date: "1869 CE", sortKey: 1869 },
      { label: "Bell received his telephone patent", date: "1876 CE", sortKey: 1876 },
      { label: "Edison demonstrated the phonograph", date: "1877 CE", sortKey: 1877 },
      { label: "Electric street lighting began in Godalming", date: "1881 CE", sortKey: 1881 },
      { label: "The Benz Patent-Motorwagen was patented", date: "1886 CE", sortKey: 1886 },
      { label: "Rudolf Diesel received his engine patent", date: "1892 CE", sortKey: 1892 },
      { label: "The Lumiere brothers held a public film screening", date: "1895 CE", sortKey: 1895 },
      { label: "A wireless patent was granted to Marconi", date: "1896 CE", sortKey: 1896 },
      { label: "The Ford Model T automobile was introduced", date: "1908 CE", sortKey: 1908 },
      { label: "Cleveland installed an electric traffic signal", date: "1914 CE", sortKey: 1914 },
      { label: "Scheduled U.S. airmail service began", date: "1918 CE", sortKey: 1918 },
      { label: "Baird publicly demonstrated television", date: "1926 CE", sortKey: 1926 },
      { label: "The Golden Gate Bridge opened", date: "1937 CE", sortKey: 1937 },
      { label: "The Boeing 707 entered airline service", date: "1958 CE", sortKey: 1958 },
      { label: "The first TGV commercial service began", date: "1981 CE", sortKey: 1981 },
    ],
  },
  {
    sourceKey: "medicine_public_health",
    items: [
      { label: "The Hippocratic Corpus was compiled", date: "c. 400 BCE", sortKey: -400 },
      { label: "Galen wrote On the Natural Faculties", date: "c. 200 CE", sortKey: 200 },
      { label: "Al-Razi wrote The Comprehensive Book of Medicine", date: "c. 925 CE", sortKey: 925 },
      { label: "Ibn Sina completed The Canon of Medicine", date: "c. 1025 CE", sortKey: 1025 },
      { label: "Vesalius published De humani corporis fabrica", date: "1543 CE", sortKey: 1543 },
      { label: "Leeuwenhoek described bacteria", date: "1676 CE", sortKey: 1676 },
      { label: "Jenner administered a smallpox vaccination", date: "1796 CE", sortKey: 1796 },
      { label: "Laennec invented the stethoscope", date: "1816 CE", sortKey: 1816 },
      { label: "Morton publicly demonstrated ether anesthesia", date: "1846 CE", sortKey: 1846 },
      { label: "Semmelweis introduced a handwashing policy", date: "1847 CE", sortKey: 1847 },
      { label: "John Snow mapped the Soho cholera outbreak", date: "1854 CE", sortKey: 1854 },
      { label: "Pasteur published work on germ theory", date: "1861 CE", sortKey: 1861 },
      { label: "Lister published antiseptic surgery results", date: "1867 CE", sortKey: 1867 },
      { label: "Koch identified the tuberculosis bacillus", date: "1882 CE", sortKey: 1882 },
      { label: "Pasteur's rabies vaccine was first used on a person", date: "1885 CE", sortKey: 1885 },
      { label: "ABO blood groups were discovered", date: "1901 CE", sortKey: 1901 },
      { label: "The Flexner Report was published", date: "1910 CE", sortKey: 1910 },
      { label: "BCG vaccine was first used in humans", date: "1921 CE", sortKey: 1921 },
      { label: "Prontosil was reported as an antibacterial drug", date: "1932 CE", sortKey: 1932 },
      { label: "The first hospital blood bank opened in Chicago", date: "1937 CE", sortKey: 1937 },
      { label: "The WHO constitution came into force", date: "1948 CE", sortKey: 1948 },
      { label: "The first successful kidney transplant was performed", date: "1954 CE", sortKey: 1954 },
      { label: "The Salk polio vaccine was declared effective", date: "1955 CE", sortKey: 1955 },
      { label: "Enovid was approved as an oral contraceptive", date: "1960 CE", sortKey: 1960 },
      { label: "The first human heart transplant was performed", date: "1967 CE", sortKey: 1967 },
      { label: "A CT scan was first used on a patient", date: "1971 CE", sortKey: 1971 },
      { label: "Smallpox eradication was certified", date: "1980 CE", sortKey: 1980 },
      { label: "Lovastatin was approved as the first statin", date: "1987 CE", sortKey: 1987 },
      { label: "The Human Genome Project was launched", date: "1990 CE", sortKey: 1990 },
      { label: "Dolly the sheep cloning was announced", date: "1997 CE", sortKey: 1997 },
      { label: "The COVID-19 genome sequence was published online", date: "2020 CE", sortKey: 2020 },
    ],
  },
  {
    sourceKey: "media_sports_culture",
    items: [
      { label: "The first America's Cup race was held", date: "1851 CE", sortKey: 1851 },
      { label: "The first FA Cup final was played", date: "1872 CE", sortKey: 1872 },
      { label: "The first Wimbledon championship began", date: "1877 CE", sortKey: 1877 },
      { label: "Basketball was invented by James Naismith", date: "1891 CE", sortKey: 1891 },
      { label: "The first modern Olympics opened in Athens", date: "1896 CE", sortKey: 1896 },
      { label: "The first Tour de France began", date: "1903 CE", sortKey: 1903 },
      { label: "The first Indianapolis 500 was held", date: "1911 CE", sortKey: 1911 },
      { label: "The first crossword puzzle was published", date: "1913 CE", sortKey: 1913 },
      { label: "The first Winter Olympics opened", date: "1924 CE", sortKey: 1924 },
      { label: "The first FIFA World Cup began", date: "1930 CE", sortKey: 1930 },
      { label: "Monopoly was first published by Parker Brothers", date: "1935 CE", sortKey: 1935 },
      { label: "The first televised Olympics were broadcast", date: "1936 CE", sortKey: 1936 },
      { label: "The NBA's first season began in North America", date: "1946 CE", sortKey: 1946 },
      { label: "The first Formula One championship race was held", date: "1950 CE", sortKey: 1950 },
      { label: "Disneyland opened in California", date: "1955 CE", sortKey: 1955 },
      { label: "The first UEFA European Championship was held", date: "1960 CE", sortKey: 1960 },
      { label: "The Beatles appeared on Ed Sullivan", date: "1964 CE", sortKey: 1964 },
      { label: "Super Bowl I was played in Los Angeles", date: "1967 CE", sortKey: 1967 },
      { label: "Sesame Street premiered on public television", date: "1969 CE", sortKey: 1969 },
      { label: "The first Earth Day was held", date: "1970 CE", sortKey: 1970 },
      { label: "Pong was released as an arcade game", date: "1972 CE", sortKey: 1972 },
      { label: "Star Wars was released in theaters", date: "1977 CE", sortKey: 1977 },
      { label: "MTV launched as a cable music channel", date: "1981 CE", sortKey: 1981 },
      { label: "Thriller by Michael Jackson was released", date: "1982 CE", sortKey: 1982 },
      { label: "Tetris was released as a puzzle video game", date: "1984 CE", sortKey: 1984 },
      { label: "The Simpsons premiered as a series", date: "1989 CE", sortKey: 1989 },
      { label: "The Premier League's first season began", date: "1992 CE", sortKey: 1992 },
      { label: "Toy Story was released by Pixar", date: "1995 CE", sortKey: 1995 },
      { label: "The Sopranos premiered", date: "1999 CE", sortKey: 1999 },
      { label: "Avatar was released in theaters", date: "2009 CE", sortKey: 2009 },
      { label: "Pokemon Go launched worldwide", date: "2016 CE", sortKey: 2016 },
    ],
  },
  {
    sourceKey: "computing_internet",
    items: [
      { label: "Babbage proposed the Difference Engine", date: "1822 CE", sortKey: 1822 },
      { label: "Ada Lovelace's Analytical Engine notes were published", date: "1843 CE", sortKey: 1843 },
      { label: "Hollerith tabulators were used in the U.S. Census", date: "1890 CE", sortKey: 1890 },
      { label: "Turing published On Computable Numbers", date: "1936 CE", sortKey: 1936 },
      { label: "The Atanasoff-Berry Computer was demonstrated", date: "1942 CE", sortKey: 1942 },
      { label: "ENIAC was publicly announced in Philadelphia", date: "1946 CE", sortKey: 1946 },
      { label: "The Manchester Baby ran its first program", date: "1948 CE", sortKey: 1948 },
      { label: "UNIVAC I was delivered to the Census Bureau", date: "1951 CE", sortKey: 1951 },
      { label: "The IBM 701 computer was announced", date: "1952 CE", sortKey: 1952 },
      { label: "Fortran first appeared", date: "1957 CE", sortKey: 1957 },
      { label: "The COBOL specification was released", date: "1959 CE", sortKey: 1959 },
      { label: "The computer mouse was publicly demonstrated", date: "1968 CE", sortKey: 1968 },
      { label: "Unix first ran at Bell Labs on a PDP-7", date: "1969 CE", sortKey: 1969 },
      { label: "The C programming language first appeared", date: "1972 CE", sortKey: 1972 },
      { label: "Ethernet was invented at Xerox PARC", date: "1973 CE", sortKey: 1973 },
      { label: "The Apple II was released", date: "1977 CE", sortKey: 1977 },
      { label: "VisiCalc was released", date: "1979 CE", sortKey: 1979 },
      { label: "The IBM PC was introduced", date: "1981 CE", sortKey: 1981 },
      { label: "The GNU Project was announced", date: "1983 CE", sortKey: 1983 },
      { label: "The Macintosh was introduced", date: "1984 CE", sortKey: 1984 },
      { label: "The World Wide Web proposal was written", date: "1989 CE", sortKey: 1989 },
      { label: "The Linux kernel was first released", date: "1991 CE", sortKey: 1991 },
      { label: "The Mosaic web browser was released", date: "1993 CE", sortKey: 1993 },
      { label: "Amazon.com opened as an online bookstore", date: "1995 CE", sortKey: 1995 },
      { label: "Google was incorporated in California", date: "1998 CE", sortKey: 1998 },
      { label: "Wikipedia launched as a free encyclopedia", date: "2001 CE", sortKey: 2001 },
      { label: "Facebook opened to Harvard students", date: "2004 CE", sortKey: 2004 },
      { label: "The first iPhone was released", date: "2007 CE", sortKey: 2007 },
      { label: "The Bitcoin white paper was published", date: "2008 CE", sortKey: 2008 },
      { label: "Instagram launched as a photo sharing app", date: "2010 CE", sortKey: 2010 },
      { label: "ChatGPT launched as a public chatbot", date: "2022 CE", sortKey: 2022 },
    ],
  },
  {
    sourceKey: "aviation_space",
    items: [
      { label: "Cayley's model glider flew", date: "1804 CE", sortKey: 1804 },
      { label: "Giffard's steam-powered airship flew", date: "1852 CE", sortKey: 1852 },
      { label: "Zeppelin LZ 1 first flew", date: "1900 CE", sortKey: 1900 },
      { label: "The Wright Flyer made its first powered flight", date: "1903 CE", sortKey: 1903 },
      { label: "Bleriot crossed the English Channel by airplane", date: "1909 CE", sortKey: 1909 },
      { label: "The first scheduled airline service began", date: "1914 CE", sortKey: 1914 },
      { label: "Alcock and Brown completed a nonstop Atlantic flight", date: "1919 CE", sortKey: 1919 },
      { label: "Goddard launched a liquid-fueled rocket", date: "1926 CE", sortKey: 1926 },
      { label: "Lindbergh completed a solo Atlantic flight", date: "1927 CE", sortKey: 1927 },
      { label: "The Heinkel He 178 jet aircraft flew", date: "1939 CE", sortKey: 1939 },
      { label: "The Bell X-1 broke the sound barrier", date: "1947 CE", sortKey: 1947 },
      { label: "Sputnik 2 launched into Earth orbit", date: "1957 CE", sortKey: 1957.9 },
      { label: "Explorer 1 entered orbit for the United States", date: "1958 CE", sortKey: 1958 },
      { label: "Luna 2 reached the Moon as a Soviet probe", date: "1959 CE", sortKey: 1959 },
      { label: "Yuri Gagarin orbited Earth aboard Vostok 1", date: "1961 CE", sortKey: 1961 },
      { label: "Telstar 1 was launched as a communications satellite", date: "1962 CE", sortKey: 1962 },
      { label: "Valentina Tereshkova flew in space", date: "1963 CE", sortKey: 1963 },
      { label: "Luna 9 soft-landed on the Moon", date: "1966 CE", sortKey: 1966 },
      { label: "Apollo 8 orbited the Moon", date: "1968 CE", sortKey: 1968 },
      { label: "Apollo 11 landed on the Moon", date: "1969 CE", sortKey: 1969 },
      { label: "Salyut 1 was launched", date: "1971 CE", sortKey: 1971 },
      { label: "Viking 1 landed on Mars", date: "1976 CE", sortKey: 1976 },
      { label: "Voyager 1 was launched", date: "1977 CE", sortKey: 1977 },
      { label: "Columbia made the first Space Shuttle launch", date: "1981 CE", sortKey: 1981 },
      { label: "Mir's core module was launched", date: "1986 CE", sortKey: 1986 },
      { label: "The Hubble Space Telescope was launched", date: "1990 CE", sortKey: 1990 },
      { label: "Zarya launched as the first ISS module", date: "1998 CE", sortKey: 1998 },
      { label: "SpaceShipOne reached space", date: "2004 CE", sortKey: 2004 },
      { label: "New Horizons flew by Pluto", date: "2015 CE", sortKey: 2015 },
      { label: "Falcon Heavy first launched", date: "2018 CE", sortKey: 2018 },
      { label: "The James Webb first images were released", date: "2022 CE", sortKey: 2022 },
    ],
  },
];

function assertStrictTimeline(timeline: Timeline) {
  for (let index = 0; index < timeline.items.length - 1; index += 1) {
    const earlier = timeline.items[index];
    const later = timeline.items[index + 1];
    if (earlier.sortKey >= later.sortKey) {
      throw new Error(
        `which_came_first timeline ${timeline.sourceKey} is not strictly ordered at ${earlier.label} / ${later.label}`,
      );
    }
  }
}

function buildRows() {
  const rows: KnowledgeQuestionSeed[] = [];
  const reviewRows: CameFirstReviewRow[] = [];
  let index = 1;

  for (const timeline of TIMELINES) {
    assertStrictTimeline(timeline);
    for (let itemIndex = 0; itemIndex < timeline.items.length - 1; itemIndex += 1) {
      const earlier = timeline.items[itemIndex];
      const later = timeline.items[itemIndex + 1];
      const checksum = `knowledge_came_first_v2_${String(index).padStart(3, "0")}`;
      const options =
        index % 2 === 1
          ? [earlier.label, later.label]
          : [later.label, earlier.label];

      rows.push({
        sport: "knowledge",
        category,
        question: "Which came first?",
        options,
        correctAnswer: earlier.label,
        explanation: `${earlier.label} came first (${earlier.date}); ${later.label} came later (${later.date}).`,
        difficulty,
        bucket,
        checksum,
        questionKind,
      });

      reviewRows.push({
        checksum,
        sourceKey: timeline.sourceKey,
        earlier: earlier.label,
        earlierDate: earlier.date,
        later: later.label,
        laterDate: later.date,
        markedEarlier: earlier.label,
      });

      index += 1;
    }
  }

  return { rows, reviewRows };
}

const built = buildRows();

export const knowledgeCameFirstExpansionV2Questions = built.rows;
export const knowledgeCameFirstExpansionV2ReviewRows = built.reviewRows;
export const questions = knowledgeCameFirstExpansionV2Questions;
export default knowledgeCameFirstExpansionV2Questions;
