import type { KnowledgeQuestionSeed } from "./knowledgeQuestions";

type Difficulty = KnowledgeQuestionSeed["difficulty"];

export type KnowledgeGeographyBreadthShape =
  | "standard_recall"
  | "odd_one_out"
  | "negative_exception"
  | "numeric_estimation"
  | "superlative_comparison"
  | "connected_clue";

type SourceKey = keyof typeof knowledgeGeographyBreadthProvenance;

type RawGeographyFact = {
  category: string;
  difficulty: Difficulty;
  shape: KnowledgeGeographyBreadthShape;
  question: string;
  correctAnswer: string;
  distractors: [string, string, string];
  explanation: string;
  sourceKey: SourceKey;
};

export type KnowledgeGeographyBreadthReviewRow = {
  ref: string;
  category: string;
  shape: KnowledgeGeographyBreadthShape;
  difficulty: Difficulty;
  answer: string;
  question: string;
  sourceKey: SourceKey;
};

export const knowledgeGeographyBreadthProvenance = {
  currencies_structured:
    "Custom VerveQ-authored currency prompts verified against Wikidata CC0 structured country/currency statements, ISO 4217-style currency records, and CIA World Factbook country profiles.",
  largest_cities_structured:
    "Custom VerveQ-authored city prompts verified against Wikidata CC0 structured place/population statements, UN urbanization references, and public national statistical summaries where city-rank wording required caution.",
  landmarks_structured:
    "Custom VerveQ-authored landmark prompts verified against Wikidata CC0 structured place/country/heritage statements and public-domain country references.",
  physical_geography_structured:
    "Custom VerveQ-authored physical-geography prompts verified against Wikidata CC0 structured natural-feature statements, CIA World Factbook geography fields, USGS/NOAA public-domain references, and Natural Earth-style public map facts.",
  country_facts_structured:
    "Custom VerveQ-authored country-fact prompts verified against Wikidata CC0 structured statements, CIA World Factbook country profiles, and United Nations M49 region/classification data.",
  no_open_trivia_corpus:
    "No OpenTDB or CC-BY-SA trivia corpus was ingested; rows are custom-authored from open structured/reference facts.",
} as const;

function q(
  category: string,
  difficulty: Difficulty,
  shape: KnowledgeGeographyBreadthShape,
  question: string,
  correctAnswer: string,
  distractors: [string, string, string],
  explanation: string,
  sourceKey: SourceKey,
): RawGeographyFact {
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
  return `knowledge_geography_breadth_v1_${String(index + 1).padStart(3, "0")}`;
}

function buildRows(facts: RawGeographyFact[]) {
  const rows: KnowledgeQuestionSeed[] = [];
  const reviewRows: KnowledgeGeographyBreadthReviewRow[] = [];

  facts.forEach((fact, index) => {
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

const RAW_GEOGRAPHY_FACTS: RawGeographyFact[] = [
  q("currencies", "easy", "standard_recall", "Which currency is used in Switzerland and Liechtenstein?", "Swiss franc", ["Euro", "Danish krone", "Pound sterling"], "Switzerland and Liechtenstein both use the Swiss franc.", "currencies_structured"),
  q("currencies", "easy", "standard_recall", "Which currency is used in Japan?", "Japanese yen", ["South Korean won", "Chinese yuan", "Thai baht"], "Japan's currency is the Japanese yen.", "currencies_structured"),
  q("currencies", "easy", "standard_recall", "Which currency is used in Mexico?", "Mexican peso", ["Chilean peso", "Colombian peso", "Argentine peso"], "Mexico uses the Mexican peso.", "currencies_structured"),
  q("currencies", "easy", "standard_recall", "Which currency is used in South Africa?", "South African rand", ["Zambian kwacha", "Botswana pula", "Namibian dollar"], "South Africa's currency is the rand.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Morocco?", "Moroccan dirham", ["Tunisian dinar", "Algerian dinar", "Egyptian pound"], "Morocco uses the Moroccan dirham.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Poland?", "Polish zloty", ["Czech koruna", "Hungarian forint", "Romanian leu"], "Poland uses the Polish zloty.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Croatia after its 2023 currency switch?", "Euro", ["Croatian kuna", "Serbian dinar", "Bosnia and Herzegovina convertible mark"], "Croatia adopted the euro on January 1, 2023.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is shared by Kenya, Tanzania, and Uganda in name only, with national versions?", "Shilling", ["Franc", "Peso", "Dinar"], "Kenya, Tanzania, and Uganda each use a national shilling.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Brazil?", "Brazilian real", ["Peruvian sol", "Uruguayan peso", "Bolivian boliviano"], "Brazil uses the Brazilian real.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Thailand?", "Thai baht", ["Vietnamese dong", "Cambodian riel", "Lao kip"], "Thailand uses the Thai baht.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Vietnam?", "Vietnamese dong", ["Thai baht", "Philippine peso", "Indonesian rupiah"], "Vietnam uses the Vietnamese dong.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Indonesia?", "Indonesian rupiah", ["Malaysian ringgit", "Singapore dollar", "Brunei dollar"], "Indonesia uses the Indonesian rupiah.", "currencies_structured"),
  q("currencies", "intermediate", "standard_recall", "Which currency is used in Turkey?", "Turkish lira", ["Georgian lari", "Armenian dram", "Azerbaijani manat"], "Turkey uses the Turkish lira.", "currencies_structured"),
  q("currencies", "hard", "standard_recall", "Which currency is used in Bhutan?", "Bhutanese ngultrum", ["Nepalese rupee", "Indian rupee", "Bangladeshi taka"], "Bhutan uses the ngultrum, with the Indian rupee also widely accepted.", "currencies_structured"),
  q("currencies", "hard", "standard_recall", "Which currency is used in Ethiopia?", "Ethiopian birr", ["Eritrean nakfa", "Somali shilling", "Djiboutian franc"], "Ethiopia uses the Ethiopian birr.", "currencies_structured"),
  q("currencies", "hard", "standard_recall", "Which currency is used in Madagascar?", "Malagasy ariary", ["Mauritian rupee", "Seychellois rupee", "Comorian franc"], "Madagascar uses the Malagasy ariary.", "currencies_structured"),
  q("currencies", "hard", "standard_recall", "Which currency is used in Georgia?", "Georgian lari", ["Armenian dram", "Azerbaijani manat", "Moldovan leu"], "Georgia uses the Georgian lari.", "currencies_structured"),
  q("currencies", "hard", "standard_recall", "Which currency is used in Laos?", "Lao kip", ["Cambodian riel", "Myanmar kyat", "Vietnamese dong"], "Laos uses the Lao kip.", "currencies_structured"),
  q("currencies", "easy", "odd_one_out", "Which of these is NOT a currency named peso?", "Peruvian sol", ["Mexican peso", "Philippine peso", "Chilean peso"], "Mexico, the Philippines, and Chile use pesos; Peru uses the sol.", "currencies_structured"),
  q("currencies", "easy", "odd_one_out", "Three options are dollar currencies. Which option breaks the pattern?", "Norwegian krone", ["Canadian dollar", "Australian dollar", "Singapore dollar"], "Canada, Australia, and Singapore use dollars; Norway uses the krone.", "currencies_structured"),
  q("currencies", "intermediate", "odd_one_out", "Which of these is NOT a currency named dinar?", "Moroccan dirham", ["Kuwaiti dinar", "Jordanian dinar", "Serbian dinar"], "Kuwait, Jordan, and Serbia use dinars; Morocco uses the dirham.", "currencies_structured"),
  q("currencies", "intermediate", "odd_one_out", "Which of these is NOT a currency named franc?", "Tongan pa'anga", ["Swiss franc", "Rwandan franc", "Burundian franc"], "Switzerland, Rwanda, and Burundi use francs; Tonga uses the pa'anga.", "currencies_structured"),
  q("currencies", "easy", "odd_one_out", "Which of these is NOT used by a Nordic country?", "Polish zloty", ["Danish krone", "Swedish krona", "Norwegian krone"], "Denmark, Sweden, and Norway use krone/krona currencies; Poland uses the zloty.", "currencies_structured"),
  q("currencies", "intermediate", "odd_one_out", "Which of these is NOT a currency used in Europe?", "Moroccan dirham", ["Euro", "Swiss franc", "Polish zloty"], "The dirham is used in Morocco; the other three currencies are used in Europe.", "currencies_structured"),
  q("currencies", "intermediate", "odd_one_out", "Which of these is NOT a currency used in the Andean region?", "Thai baht", ["Peruvian sol", "Bolivian boliviano", "Colombian peso"], "Peru, Bolivia, and Colombia are Andean countries; Thailand is not.", "currencies_structured"),
  q("currencies", "intermediate", "odd_one_out", "Which of these is NOT a currency used in the Caribbean?", "Czech koruna", ["Jamaican dollar", "Barbadian dollar", "Trinidad and Tobago dollar"], "The listed dollar currencies are Caribbean; the Czech koruna is Central European.", "currencies_structured"),
  q("currencies", "hard", "odd_one_out", "Which of these is NOT a currency used by a landlocked country?", "Icelandic krona", ["Swiss franc", "Lao kip", "Paraguayan guarani"], "Switzerland, Laos, and Paraguay are landlocked; Iceland is an island country.", "currencies_structured"),
  q("currencies", "hard", "odd_one_out", "Which of these is NOT pegged or closely linked to the euro?", "Japanese yen", ["Danish krone", "Bosnia and Herzegovina convertible mark", "West African CFA franc"], "The Danish krone, convertible mark, and West African CFA franc are linked to the euro; the yen floats independently.", "currencies_structured"),
  q("currencies", "hard", "odd_one_out", "Which of these is NOT issued by an African country?", "Nepalese rupee", ["Ghanaian cedi", "Botswana pula", "Eritrean nakfa"], "Ghana, Botswana, and Eritrea are in Africa; Nepal is in Asia.", "currencies_structured"),
  q("currencies", "intermediate", "odd_one_out", "Which of these is NOT a currency used in East Africa?", "Mexican peso", ["Kenyan shilling", "Tanzanian shilling", "Ethiopian birr"], "Mexico is in North America; Kenya, Tanzania, and Ethiopia are East African countries.", "currencies_structured"),
  q("currencies", "intermediate", "negative_exception", "Which country does NOT use the euro as its official currency?", "Denmark", ["Finland", "Ireland", "Portugal"], "Denmark is an EU member with the Danish krone; Finland, Ireland, and Portugal use the euro.", "currencies_structured"),
  q("currencies", "intermediate", "negative_exception", "Which country does NOT use a currency named rupee?", "Bangladesh", ["India", "Pakistan", "Sri Lanka"], "Bangladesh uses the taka; India, Pakistan, and Sri Lanka use rupees.", "currencies_structured"),
  q("currencies", "intermediate", "negative_exception", "Which country does NOT use the West African CFA franc?", "Ghana", ["Senegal", "Benin", "Cote d'Ivoire"], "Ghana uses the cedi; Senegal, Benin, and Cote d'Ivoire use the West African CFA franc.", "currencies_structured"),
  q("currencies", "intermediate", "negative_exception", "Which country does NOT use a currency called krone or krona?", "Finland", ["Norway", "Denmark", "Sweden"], "Finland uses the euro; Norway, Denmark, and Sweden use krone/krona currencies.", "currencies_structured"),
  q("currencies", "hard", "negative_exception", "Which country does NOT use the East Caribbean dollar?", "Barbados", ["Dominica", "Grenada", "Saint Lucia"], "Barbados uses the Barbadian dollar; the others use the East Caribbean dollar.", "currencies_structured"),
  q("currencies", "intermediate", "negative_exception", "Which country does NOT use a currency named pound?", "Israel", ["Egypt", "Lebanon", "Syria"], "Israel uses the new shekel; Egypt, Lebanon, and Syria use pounds.", "currencies_structured"),
  q("currencies", "hard", "negative_exception", "Which country does NOT use a currency named dollar?", "Mexico", ["Canada", "Australia", "New Zealand"], "Mexico uses the peso; Canada, Australia, and New Zealand use dollar currencies.", "currencies_structured"),
  q("currencies", "hard", "negative_exception", "Which country does NOT use a currency named rial or riyal?", "Azerbaijan", ["Oman", "Iran", "Qatar"], "Azerbaijan uses the manat; Oman, Iran, and Qatar use rial/riyal currencies.", "currencies_structured"),
  q("currencies", "easy", "numeric_estimation", "Euro coins have how many standard denominations?", "8", ["6", "7", "9"], "Euro coins are issued as 1, 2, 5, 10, 20, and 50 cents plus 1 and 2 euros.", "currencies_structured"),
  q("currencies", "easy", "numeric_estimation", "One Japanese yen is divided into how many sen in the decimal currency system?", "100", ["10", "1,000", "50"], "The yen is historically divided into 100 sen, though sen are not used in everyday cash.", "currencies_structured"),
  q("currencies", "easy", "numeric_estimation", "One Mexican peso is divided into how many centavos?", "100", ["10", "20", "1,000"], "The Mexican peso is divided into 100 centavos.", "currencies_structured"),
  q("currencies", "intermediate", "numeric_estimation", "The Swiss franc is divided into how many rappen in German?", "100", ["20", "50", "1,000"], "The Swiss franc is divided into 100 rappen in German, or centimes in French.", "currencies_structured"),
  q("currencies", "intermediate", "numeric_estimation", "The ISO 4217 numeric code for the euro is what?", "978", ["840", "826", "392"], "ISO 4217 assigns the euro the numeric code 978.", "currencies_structured"),
  q("currencies", "intermediate", "numeric_estimation", "The ISO 4217 numeric code for the US dollar is what?", "840", ["978", "124", "036"], "ISO 4217 assigns the US dollar the numeric code 840.", "currencies_structured"),
  q("currencies", "intermediate", "numeric_estimation", "The ISO 4217 numeric code for the pound sterling is what?", "826", ["840", "978", "392"], "ISO 4217 assigns pound sterling the numeric code 826.", "currencies_structured"),
  q("currencies", "hard", "numeric_estimation", "The ISO 4217 numeric code for the Japanese yen is what?", "392", ["156", "410", "764"], "ISO 4217 assigns the Japanese yen the numeric code 392.", "currencies_structured"),
  q("currencies", "easy", "superlative_comparison", "Which listed currency unit is usually the highest value per single unit?", "Kuwaiti dinar", ["Japanese yen", "Indonesian rupiah", "Vietnamese dong"], "A single Kuwaiti dinar is worth far more than a yen, rupiah, or dong.", "currencies_structured"),
  q("currencies", "intermediate", "superlative_comparison", "Which listed currency belongs to the country farthest north?", "Icelandic krona", ["Moroccan dirham", "Thai baht", "Brazilian real"], "Iceland is far north of Morocco, Thailand, and Brazil.", "currencies_structured"),
  q("currencies", "intermediate", "superlative_comparison", "Which listed currency belongs to the most populous country?", "Indian rupee", ["Canadian dollar", "Australian dollar", "New Zealand dollar"], "India has a much larger population than Canada, Australia, or New Zealand.", "currencies_structured"),
  q("currencies", "intermediate", "superlative_comparison", "Which listed currency belongs to the largest country by land area?", "Russian ruble", ["Mexican peso", "Turkish lira", "South African rand"], "Russia is the world's largest country by land area.", "currencies_structured"),
  q("currencies", "hard", "superlative_comparison", "Which listed currency belongs to the smallest sovereign country by area?", "Vatican euro", ["Swiss franc", "Singapore dollar", "Bahraini dinar"], "Vatican City uses the euro and is the smallest sovereign state by area.", "currencies_structured"),
  q("currencies", "intermediate", "superlative_comparison", "Which listed currency belongs to the largest island country by area?", "Indonesian rupiah", ["Sri Lankan rupee", "Icelandic krona", "Jamaican dollar"], "Indonesia is the largest island country among those listed.", "currencies_structured"),
  q("currencies", "intermediate", "superlative_comparison", "Which listed currency is used by a country with the most time zones, including overseas territories?", "Euro used by France", ["Japanese yen", "Kenyan shilling", "Peruvian sol"], "France spans many time zones through overseas territories and uses the euro in metropolitan France and several territories.", "currencies_structured"),
  q("currencies", "hard", "superlative_comparison", "Which listed currency is used by the highest-elevation country on average among these?", "Bhutanese ngultrum", ["Dutch euro", "Bangladeshi taka", "Qatari riyal"], "Bhutan's Himalayan terrain gives it a much higher average elevation than the Netherlands, Bangladesh, or Qatar.", "currencies_structured"),
  q("currencies", "hard", "superlative_comparison", "Which listed currency belongs to a country with the longest coastline among these?", "Canadian dollar", ["Polish zloty", "Hungarian forint", "Czech koruna"], "Canada has the longest coastline among the countries listed.", "currencies_structured"),
  q("currencies", "intermediate", "superlative_comparison", "Which listed currency belongs to the southernmost country among these?", "New Zealand dollar", ["Norwegian krone", "Egyptian pound", "South Korean won"], "New Zealand lies farthest south among the countries listed.", "currencies_structured"),
  q("currencies", "easy", "connected_clue", "A yen symbol, Tokyo prices, and coins with holes on some denominations point to which currency?", "Japanese yen", ["Chinese yuan", "South Korean won", "Thai baht"], "The yen is Japan's currency and some yen coins have center holes.", "currencies_structured"),
  q("currencies", "intermediate", "connected_clue", "A currency named for 'royal', Brazil, and the ISO code BRL point to which money?", "Brazilian real", ["Mexican peso", "Peruvian sol", "Argentine peso"], "Brazil's currency is the real, with ISO code BRL.", "currencies_structured"),
  q("currencies", "intermediate", "connected_clue", "A Himalayan kingdom, code BTN, and parity with the Indian rupee point to which currency?", "Bhutanese ngultrum", ["Nepalese rupee", "Bangladeshi taka", "Sri Lankan rupee"], "The Bhutanese ngultrum uses ISO code BTN and is pegged to the Indian rupee.", "currencies_structured"),
  q("currencies", "hard", "connected_clue", "A pula means rain, Gaborone's country uses it, and BWP is the code. Which currency is it?", "Botswana pula", ["Ghanaian cedi", "Zambian kwacha", "Namibian dollar"], "Botswana's currency is the pula, whose name means rain.", "currencies_structured"),

  q("largest_cities", "easy", "standard_recall", "Which city is Brazil's largest by population?", "Sao Paulo", ["Rio de Janeiro", "Salvador", "Belo Horizonte"], "Sao Paulo is Brazil's largest city.", "largest_cities_structured"),
  q("largest_cities", "easy", "standard_recall", "Which city is Turkey's largest by population?", "Istanbul", ["Ankara", "Izmir", "Bursa"], "Istanbul is Turkey's largest city.", "largest_cities_structured"),
  q("largest_cities", "easy", "standard_recall", "Which city is the largest in New South Wales, Australia?", "Sydney", ["Melbourne", "Brisbane", "Perth"], "Sydney is the largest city in the Australian state of New South Wales.", "largest_cities_structured"),
  q("largest_cities", "easy", "standard_recall", "Which city is Canada's largest by population?", "Toronto", ["Montreal", "Vancouver", "Calgary"], "Toronto is Canada's largest city.", "largest_cities_structured"),
  q("largest_cities", "easy", "standard_recall", "Which city is the largest in the United States by population?", "New York City", ["Los Angeles", "Chicago", "Houston"], "New York City is the most populous city in the United States.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Morocco's largest by population?", "Casablanca", ["Agadir", "Fez", "Tangier"], "Casablanca is Morocco's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is South Africa's largest by population?", "Johannesburg", ["Cape Town", "Durban", "Pretoria"], "Johannesburg is generally listed as South Africa's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Vietnam's largest by population?", "Ho Chi Minh City", ["Hanoi", "Da Nang", "Can Tho"], "Ho Chi Minh City is Vietnam's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Pakistan's largest by population?", "Karachi", ["Lahore", "Faisalabad", "Rawalpindi"], "Karachi is Pakistan's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Nigeria's largest by population?", "Lagos", ["Kano", "Ibadan", "Port Harcourt"], "Lagos is Nigeria's largest city and largest urban area.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is the largest in the United Arab Emirates?", "Dubai", ["Abu Dhabi", "Sharjah", "Al Ain"], "Dubai is the UAE's largest city by population.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Kazakhstan's largest by population?", "Almaty", ["Astana", "Shymkent", "Karaganda"], "Almaty remains Kazakhstan's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Ecuador's largest by population?", "Guayaquil", ["Quito", "Cuenca", "Manta"], "Guayaquil is Ecuador's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Benin's largest by population?", "Cotonou", ["Porto-Novo", "Parakou", "Djougou"], "Cotonou is Benin's largest city and main port.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is Tanzania's largest by population?", "Dar es Salaam", ["Arusha", "Mwanza", "Dodoma"], "Dar es Salaam is Tanzania's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "standard_recall", "Which city is New Zealand's largest by population?", "Auckland", ["Wellington", "Christchurch", "Hamilton"], "Auckland is New Zealand's largest urban area.", "largest_cities_structured"),
  q("largest_cities", "hard", "standard_recall", "Which city is Cote d'Ivoire's largest by population?", "Abidjan", ["Yamoussoukro", "Bouake", "San Pedro"], "Abidjan is Cote d'Ivoire's largest city.", "largest_cities_structured"),
  q("largest_cities", "hard", "standard_recall", "Which city is Myanmar's largest by population?", "Yangon", ["Naypyidaw", "Mandalay", "Mawlamyine"], "Yangon is Myanmar's largest city.", "largest_cities_structured"),
  q("largest_cities", "easy", "odd_one_out", "Which of these is NOT one of Brazil's largest major cities?", "Cusco", ["Sao Paulo", "Rio de Janeiro", "Salvador"], "Cusco is in Peru; the other three are major Brazilian cities.", "largest_cities_structured"),
  q("largest_cities", "easy", "odd_one_out", "Which of these is NOT a major Canadian city?", "Seattle", ["Toronto", "Montreal", "Vancouver"], "Seattle is in the United States; the other three are Canadian cities.", "largest_cities_structured"),
  q("largest_cities", "easy", "odd_one_out", "Which of these is NOT a major Australian city?", "Wellington", ["Sydney", "Melbourne", "Brisbane"], "Wellington is in New Zealand; the other three are Australian cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "odd_one_out", "Which of these is NOT a major Moroccan city?", "Tunis", ["Casablanca", "Fez", "Tangier"], "Tunis is in Tunisia; the other three are Moroccan cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "odd_one_out", "Which of these is NOT a major South African city?", "Gaborone", ["Johannesburg", "Cape Town", "Durban"], "Gaborone is in Botswana; the other three are South African cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "odd_one_out", "Which of these is NOT a major Turkish city?", "Thessaloniki", ["Istanbul", "Ankara", "Izmir"], "Thessaloniki is in Greece; the other three are Turkish cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "odd_one_out", "Which of these is NOT a major Vietnamese city?", "Chiang Mai", ["Ho Chi Minh City", "Hanoi", "Da Nang"], "Chiang Mai is in Thailand; the other three are Vietnamese cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "odd_one_out", "Which of these is NOT a major Pakistani city?", "Kabul", ["Karachi", "Lahore", "Faisalabad"], "Kabul is in Afghanistan; the other three are Pakistani cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "odd_one_out", "Which of these is NOT a major Nigerian city?", "Accra", ["Lagos", "Kano", "Ibadan"], "Accra is in Ghana; the other three are Nigerian cities.", "largest_cities_structured"),
  q("largest_cities", "hard", "odd_one_out", "Which of these is NOT a major city in Cote d'Ivoire?", "Kumasi", ["Abidjan", "Bouake", "San Pedro"], "Kumasi is in Ghana; the other three are in Cote d'Ivoire.", "largest_cities_structured"),
  q("largest_cities", "hard", "odd_one_out", "Which of these is NOT a major city in Ecuador?", "Arequipa", ["Guayaquil", "Quito", "Cuenca"], "Arequipa is in Peru; the other three are in Ecuador.", "largest_cities_structured"),
  q("largest_cities", "hard", "odd_one_out", "Which of these is NOT a major city in Kazakhstan?", "Bishkek", ["Almaty", "Astana", "Shymkent"], "Bishkek is in Kyrgyzstan; the other three are in Kazakhstan.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "negative_exception", "Which city is NOT larger than its country's administrative seat of government?", "Madrid", ["Sao Paulo", "Istanbul", "Casablanca"], "Madrid is itself Spain's main national seat; the other cities are larger than separate seats such as Brasilia, Ankara, and Rabat.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "negative_exception", "Which city is NOT in the Southern Hemisphere?", "Toronto", ["Sydney", "Auckland", "Johannesburg"], "Toronto is in the Northern Hemisphere; Sydney, Auckland, and Johannesburg are south of the equator.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "negative_exception", "Which city is NOT on or near a major sea coast?", "Almaty", ["Karachi", "Lagos", "Casablanca"], "Almaty is inland; Karachi, Lagos, and Casablanca are coastal cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "negative_exception", "Which city is NOT in Asia?", "Lagos", ["Karachi", "Ho Chi Minh City", "Istanbul"], "Lagos is in Africa; Karachi, Ho Chi Minh City, and Istanbul are in Asia or partly in Asia.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "negative_exception", "Which city is NOT in Africa?", "Guayaquil", ["Casablanca", "Dar es Salaam", "Abidjan"], "Guayaquil is in Ecuador; the other three are African cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "negative_exception", "Which city is NOT in the Americas?", "Dubai", ["Toronto", "New York City", "Sao Paulo"], "Dubai is in Asia; the other three are in the Americas.", "largest_cities_structured"),
  q("largest_cities", "hard", "negative_exception", "Which city is NOT a port city?", "Almaty", ["Karachi", "Guayaquil", "Abidjan"], "Almaty is inland; the others are port cities.", "largest_cities_structured"),
  q("largest_cities", "hard", "negative_exception", "Which city is NOT primarily associated with a desert or arid setting?", "Auckland", ["Dubai", "Lima", "Phoenix"], "Auckland has a maritime climate; Dubai, Lima, and Phoenix are strongly associated with arid settings.", "largest_cities_structured"),
  q("largest_cities", "easy", "numeric_estimation", "New York City has about how many boroughs?", "5", ["3", "4", "6"], "New York City is divided into five boroughs.", "largest_cities_structured"),
  q("largest_cities", "easy", "numeric_estimation", "Istanbul is famous for spanning about how many continents?", "2", ["1", "3", "4"], "Istanbul spans Europe and Asia across the Bosporus.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "numeric_estimation", "Toronto's CN Tower is about how tall?", "553 m", ["353 m", "753 m", "953 m"], "The CN Tower is about 553 meters tall.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "numeric_estimation", "Dubai's Burj Khalifa is about how tall?", "828 m", ["628 m", "728 m", "928 m"], "The Burj Khalifa is about 828 meters tall.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "numeric_estimation", "Sydney's Harbour Bridge main span is about how long?", "503 m", ["303 m", "703 m", "903 m"], "The Sydney Harbour Bridge has a main span of about 503 meters.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "numeric_estimation", "Ho Chi Minh City sits only about how many meters above sea level?", "19 m", ["190 m", "490 m", "900 m"], "Ho Chi Minh City is a low-lying delta city, roughly 19 meters above sea level.", "largest_cities_structured"),
  q("largest_cities", "hard", "numeric_estimation", "La Paz's central elevation is roughly how high?", "3,650 m", ["1,650 m", "2,650 m", "4,650 m"], "La Paz sits at roughly 3,650 meters above sea level.", "largest_cities_structured"),
  q("largest_cities", "hard", "numeric_estimation", "Johannesburg's elevation is roughly how high?", "1,750 m", ["750 m", "1,250 m", "2,750 m"], "Johannesburg is on the Highveld at roughly 1,750 meters above sea level.", "largest_cities_structured"),
  q("largest_cities", "easy", "superlative_comparison", "Which listed city is the largest by population?", "New York City", ["Denver", "Portland", "Miami"], "New York City is much larger than Denver, Portland, or Miami.", "largest_cities_structured"),
  q("largest_cities", "easy", "superlative_comparison", "Which listed Brazilian city is largest by population?", "Sao Paulo", ["Rio de Janeiro", "Brasilia", "Recife"], "Sao Paulo is Brazil's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "superlative_comparison", "Which listed city is farthest south?", "Auckland", ["Toronto", "Istanbul", "Karachi"], "Auckland lies farthest south among the listed cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "superlative_comparison", "Among these cities, which one lies at the highest northern latitude?", "Toronto", ["Casablanca", "Lagos", "Dar es Salaam"], "Toronto is farther north than Casablanca, Lagos, or Dar es Salaam.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "superlative_comparison", "Which listed city is highest above sea level?", "La Paz", ["Lagos", "Sydney", "Karachi"], "La Paz is one of the world's highest large cities.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "superlative_comparison", "Which listed city is closest to the equator?", "Quito", ["Toronto", "Sydney", "Istanbul"], "Quito lies very close to the equator.", "largest_cities_structured"),
  q("largest_cities", "hard", "superlative_comparison", "Which listed city has the largest metropolitan population?", "Shanghai", ["Auckland", "Casablanca", "Zurich"], "Shanghai's metropolitan population is far larger than the other listed cities.", "largest_cities_structured"),
  q("largest_cities", "hard", "superlative_comparison", "Which listed city is the most inland from an ocean coast?", "Urumqi", ["Casablanca", "Lagos", "Sydney"], "Urumqi in northwest China is much farther inland than the coastal cities listed.", "largest_cities_structured"),
  q("largest_cities", "hard", "superlative_comparison", "Which listed city is on the largest island?", "Jakarta", ["Auckland", "Reykjavik", "Manama"], "Jakarta is on Java, larger than the islands hosting Auckland, Reykjavik, or Manama.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "superlative_comparison", "Which listed city is in the country with the largest land area?", "Sydney", ["Auckland", "Casablanca", "Johannesburg"], "Sydney is in Australia, larger by land area than New Zealand, Morocco, or South Africa.", "largest_cities_structured"),
  q("largest_cities", "easy", "connected_clue", "A Bosporus crossing, a two-continent city, and Turkey's largest urban population point to which city?", "Istanbul", ["Ankara", "Izmir", "Bursa"], "Istanbul sits on the Bosporus and is Turkey's largest city.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "connected_clue", "A port on the Atlantic, Morocco's largest city, and Hassan II Mosque point to which city?", "Casablanca", ["Tangier", "Fez", "Agadir"], "Casablanca is Morocco's largest city and home to Hassan II Mosque.", "largest_cities_structured"),
  q("largest_cities", "intermediate", "connected_clue", "A city on the Guayas River, Ecuador's largest urban center, and a Pacific port point to which city?", "Guayaquil", ["Quito", "Cuenca", "Manta"], "Guayaquil is Ecuador's largest city and major Pacific port.", "largest_cities_structured"),
  q("largest_cities", "hard", "connected_clue", "A former capital, Shwedagon Pagoda, and Myanmar's largest city point to which place?", "Yangon", ["Mandalay", "Naypyidaw", "Bagan"], "Yangon is Myanmar's largest city and home to Shwedagon Pagoda.", "largest_cities_structured"),

  q("landmarks", "easy", "standard_recall", "The Giant's Causeway is in which country?", "United Kingdom", ["Ireland", "Iceland", "Norway"], "The Giant's Causeway is in Northern Ireland, part of the United Kingdom.", "landmarks_structured"),
  q("landmarks", "easy", "standard_recall", "The Alhambra is in which country?", "Spain", ["Morocco", "Portugal", "Italy"], "The Alhambra palace complex is in Granada, Spain.", "landmarks_structured"),
  q("landmarks", "easy", "standard_recall", "Borobudur temple is in which country?", "Indonesia", ["Cambodia", "Thailand", "Myanmar"], "Borobudur is a major Buddhist temple in Indonesia.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "Bagan's plain of temples is in which country?", "Myanmar", ["Laos", "Vietnam", "Bangladesh"], "Bagan is an archaeological landscape in Myanmar.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "Sigiriya rock fortress is in which country?", "Sri Lanka", ["India", "Nepal", "Bhutan"], "Sigiriya is a rock fortress and palace site in Sri Lanka.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "The moai statues of Rapa Nui are in which country?", "Chile", ["Peru", "Ecuador", "New Zealand"], "Rapa Nui, also called Easter Island, is a special territory of Chile.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "Meteora's cliff-top monasteries are in which country?", "Greece", ["Bulgaria", "Albania", "Serbia"], "Meteora is a monastery landscape in Greece.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "Mont Saint-Michel is in which country?", "France", ["Belgium", "Spain", "United Kingdom"], "Mont Saint-Michel is a tidal island and abbey in France.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "The ancient city of Persepolis is in which country?", "Iran", ["Iraq", "Turkey", "Syria"], "Persepolis is an ancient Achaemenid site in Iran.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "Baalbek's Roman temple complex is in which country?", "Lebanon", ["Jordan", "Israel", "Cyprus"], "Baalbek is an ancient temple complex in Lebanon.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "The ruins of Carthage are in which country?", "Tunisia", ["Algeria", "Libya", "Morocco"], "The archaeological site of Carthage is in Tunisia.", "landmarks_structured"),
  q("landmarks", "intermediate", "standard_recall", "Great Zimbabwe is in which country?", "Zimbabwe", ["Zambia", "Botswana", "Mozambique"], "Great Zimbabwe is a medieval stone city site in Zimbabwe.", "landmarks_structured"),
  q("landmarks", "hard", "standard_recall", "Skara Brae is in which country?", "United Kingdom", ["Ireland", "Denmark", "Netherlands"], "Skara Brae is a Neolithic settlement in Orkney, Scotland, within the United Kingdom.", "landmarks_structured"),
  q("landmarks", "hard", "standard_recall", "The Banaue Rice Terraces are in which country?", "Philippines", ["Indonesia", "Vietnam", "Malaysia"], "The Banaue Rice Terraces are in the Philippines.", "landmarks_structured"),
  q("landmarks", "hard", "standard_recall", "Leptis Magna's ruins are in which country?", "Libya", ["Tunisia", "Egypt", "Algeria"], "Leptis Magna is an ancient Roman city site in Libya.", "landmarks_structured"),
  q("landmarks", "hard", "standard_recall", "The Potala Palace is in which country?", "China", ["Nepal", "Bhutan", "Mongolia"], "The Potala Palace is in Lhasa, Tibet Autonomous Region, China.", "landmarks_structured"),
  q("landmarks", "hard", "standard_recall", "Kotor's fortified old town is in which country?", "Montenegro", ["Croatia", "Slovenia", "Albania"], "Kotor is a fortified coastal town in Montenegro.", "landmarks_structured"),
  q("landmarks", "hard", "standard_recall", "The rock art of Twyfelfontein is in which country?", "Namibia", ["Botswana", "South Africa", "Angola"], "Twyfelfontein is a rock-engraving site in Namibia.", "landmarks_structured"),
  q("landmarks", "easy", "odd_one_out", "Which of these is NOT in Spain?", "Meteora", ["Alhambra", "Sagrada Familia", "Mezquita of Cordoba"], "Meteora is in Greece; the other landmarks are in Spain.", "landmarks_structured"),
  q("landmarks", "easy", "odd_one_out", "Which of these is NOT in Italy?", "Mont Saint-Michel", ["Colosseum", "Pompeii", "Leaning Tower of Pisa"], "Mont Saint-Michel is in France; the other landmarks are in Italy.", "landmarks_structured"),
  q("landmarks", "easy", "odd_one_out", "Which of these is NOT in the United Kingdom?", "Blarney Castle", ["Stonehenge", "Giant's Causeway", "Skara Brae"], "Blarney Castle is in Ireland; the other landmarks are in the United Kingdom.", "landmarks_structured"),
  q("landmarks", "intermediate", "odd_one_out", "Which of these is NOT in Indonesia?", "Bagan", ["Borobudur", "Prambanan", "Komodo National Park"], "Bagan is in Myanmar; the other landmarks are in Indonesia.", "landmarks_structured"),
  q("landmarks", "intermediate", "odd_one_out", "Which of these is NOT in Greece?", "Alhambra", ["Meteora", "Delphi", "Acropolis of Athens"], "The Alhambra is in Spain; the other landmarks are in Greece.", "landmarks_structured"),
  q("landmarks", "intermediate", "odd_one_out", "Which of these is NOT in Iran?", "Baalbek", ["Persepolis", "Naqsh-e Jahan Square", "Shushtar Historical Hydraulic System"], "Baalbek is in Lebanon; the other landmarks are in Iran.", "landmarks_structured"),
  q("landmarks", "intermediate", "odd_one_out", "Which of these is NOT in North Africa?", "Sigiriya", ["Carthage", "Leptis Magna", "Abu Simbel"], "Sigiriya is in Sri Lanka; the other landmarks are in North Africa.", "landmarks_structured"),
  q("landmarks", "hard", "odd_one_out", "Which of these is NOT a rock-cut or cliffside landmark?", "Salar de Uyuni", ["Sigiriya", "Meteora", "Petra"], "Salar de Uyuni is a salt flat; Sigiriya, Meteora, and Petra are rock or cliff-associated landmarks.", "landmarks_structured"),
  q("landmarks", "hard", "odd_one_out", "Which of these is NOT primarily an archaeological ruin?", "Hassan II Mosque", ["Great Zimbabwe", "Carthage", "Leptis Magna"], "Hassan II Mosque is a modern mosque; the other three are archaeological ruins.", "landmarks_structured"),
  q("landmarks", "hard", "odd_one_out", "Which of these is NOT on an island?", "Persepolis", ["Skara Brae", "Sigiriya", "Moai of Rapa Nui"], "Persepolis is inland in Iran; the others are on islands.", "landmarks_structured"),
  q("landmarks", "hard", "odd_one_out", "Which of these is NOT in the Americas?", "Meteora", ["Chichen Itza", "Tikal", "Teotihuacan"], "Meteora is in Greece; the other sites are in the Americas.", "landmarks_structured"),
  q("landmarks", "intermediate", "odd_one_out", "Which of these is NOT in France?", "Alhambra", ["Mont Saint-Michel", "Pont du Gard", "Palace of Versailles"], "The Alhambra is in Spain; the other landmarks are in France.", "landmarks_structured"),
  q("landmarks", "intermediate", "negative_exception", "Which landmark is NOT in a Mediterranean country?", "Skara Brae", ["Alhambra", "Carthage", "Baalbek"], "Skara Brae is in Orkney in the North Atlantic; the other landmarks are in Mediterranean countries.", "landmarks_structured"),
  q("landmarks", "intermediate", "negative_exception", "Which landmark is NOT associated with ancient Rome?", "Sigiriya", ["Colosseum", "Leptis Magna", "Baalbek"], "Sigiriya is a Sri Lankan rock fortress; the other landmarks have major Roman connections.", "landmarks_structured"),
  q("landmarks", "intermediate", "negative_exception", "Which landmark is NOT a UNESCO World Heritage Site?", "Las Vegas Strip", ["Giant's Causeway", "Alhambra", "Borobudur"], "The Las Vegas Strip is not a UNESCO World Heritage Site; the others are.", "landmarks_structured"),
  q("landmarks", "hard", "negative_exception", "Which landmark is NOT in South or Southeast Asia?", "Carthage", ["Sigiriya", "Borobudur", "Bagan"], "Carthage is in Tunisia; Sigiriya, Borobudur, and Bagan are in South or Southeast Asia.", "landmarks_structured"),
  q("landmarks", "intermediate", "negative_exception", "Which landmark is NOT a fortified old town or fortress site?", "Borobudur", ["Sigiriya", "Kotor", "Masada"], "Borobudur is a temple; Sigiriya, Kotor, and Masada are fortress or fortified sites.", "landmarks_structured"),
  q("landmarks", "hard", "negative_exception", "Which landmark is NOT in the Balkan Peninsula?", "Persepolis", ["Meteora", "Kotor", "Butrint"], "Persepolis is in Iran; Meteora, Kotor, and Butrint are Balkan sites.", "landmarks_structured"),
  q("landmarks", "hard", "negative_exception", "Which landmark is NOT primarily made of stone ruins or masonry?", "Great Barrier Reef", ["Great Zimbabwe", "Skara Brae", "Leptis Magna"], "The Great Barrier Reef is natural coral; the others are built stone sites.", "landmarks_structured"),
  q("landmarks", "hard", "negative_exception", "Which landmark is NOT in Asia?", "Kotor", ["Sigiriya", "Borobudur", "Bagan"], "Kotor is in Montenegro; Sigiriya, Borobudur, and Bagan are in Asia.", "landmarks_structured"),
  q("landmarks", "easy", "numeric_estimation", "The Burj Khalifa is about how many meters tall?", "828 m", ["428 m", "628 m", "1,028 m"], "The Burj Khalifa is about 828 meters tall.", "landmarks_structured"),
  q("landmarks", "easy", "numeric_estimation", "The Eiffel Tower is about how many meters tall including antennas?", "330 m", ["130 m", "230 m", "530 m"], "The Eiffel Tower is about 330 meters tall including antennas.", "landmarks_structured"),
  q("landmarks", "intermediate", "numeric_estimation", "The Great Pyramid of Giza was originally about how tall?", "147 m", ["47 m", "247 m", "347 m"], "The Great Pyramid originally stood about 147 meters tall.", "landmarks_structured"),
  q("landmarks", "intermediate", "numeric_estimation", "The CN Tower is about how many meters tall?", "553 m", ["253 m", "453 m", "753 m"], "The CN Tower in Toronto is about 553 meters tall.", "landmarks_structured"),
  q("landmarks", "intermediate", "numeric_estimation", "The Gateway Arch in St. Louis is about how many meters tall?", "192 m", ["92 m", "292 m", "392 m"], "The Gateway Arch is about 192 meters tall.", "landmarks_structured"),
  q("landmarks", "hard", "numeric_estimation", "Borobudur has roughly how many relief panels?", "2,672", ["672", "1,672", "4,672"], "Borobudur is commonly described as having about 2,672 relief panels.", "landmarks_structured"),
  q("landmarks", "hard", "numeric_estimation", "Stonehenge's main sarsen circle is roughly how many meters across?", "33 m", ["13 m", "63 m", "93 m"], "Stonehenge's main sarsen circle is roughly 33 meters across.", "landmarks_structured"),
  q("landmarks", "hard", "numeric_estimation", "The moai statues on Rapa Nui number roughly how many?", "900", ["90", "300", "3,000"], "Rapa Nui has roughly 900 known moai statues.", "landmarks_structured"),
  q("landmarks", "easy", "superlative_comparison", "Which listed landmark is tallest?", "Burj Khalifa", ["Eiffel Tower", "Gateway Arch", "Leaning Tower of Pisa"], "The Burj Khalifa is much taller than the other listed landmarks.", "landmarks_structured"),
  q("landmarks", "easy", "superlative_comparison", "Which listed landmark is oldest?", "Stonehenge", ["Eiffel Tower", "Sydney Opera House", "Burj Khalifa"], "Stonehenge is prehistoric, older than the modern landmarks listed.", "landmarks_structured"),
  q("landmarks", "intermediate", "superlative_comparison", "Which listed landmark is farthest south?", "Moai of Rapa Nui", ["Giant's Causeway", "Alhambra", "Baalbek"], "Rapa Nui lies in the South Pacific, far south of the other listed landmarks.", "landmarks_structured"),
  q("landmarks", "intermediate", "superlative_comparison", "Which site lies nearest the Arctic among these landmarks?", "Skara Brae", ["Carthage", "Persepolis", "Borobudur"], "Skara Brae in Orkney is farther north than the other listed sites.", "landmarks_structured"),
  q("landmarks", "intermediate", "superlative_comparison", "Which listed site covers the largest ancient urban area?", "Bagan", ["Skara Brae", "Gateway Arch", "Leaning Tower of Pisa"], "Bagan spreads across a large plain of temples and ruins.", "landmarks_structured"),
  q("landmarks", "intermediate", "superlative_comparison", "Which listed landmark is closest to the equator?", "Borobudur", ["Alhambra", "Mont Saint-Michel", "Giant's Causeway"], "Borobudur in Java is much closer to the equator.", "landmarks_structured"),
  q("landmarks", "hard", "superlative_comparison", "Which listed landmark is in the country with the largest population?", "Potala Palace", ["Alhambra", "Giant's Causeway", "Great Zimbabwe"], "The Potala Palace is in China, the most populous country among the options.", "landmarks_structured"),
  q("landmarks", "hard", "superlative_comparison", "Which listed landmark is in the largest country by area?", "Skara Brae", ["Sigiriya", "Baalbek", "Carthage"], "Skara Brae is in the United Kingdom, larger by area than Sri Lanka, Lebanon, or Tunisia.", "landmarks_structured"),
  q("landmarks", "hard", "superlative_comparison", "Which listed landmark is at the highest elevation?", "Potala Palace", ["Carthage", "Giant's Causeway", "Mont Saint-Michel"], "The Potala Palace in Lhasa sits at a high plateau elevation.", "landmarks_structured"),
  q("landmarks", "intermediate", "superlative_comparison", "Which listed landmark is nearest to the Atlantic Ocean?", "Giant's Causeway", ["Borobudur", "Persepolis", "Sigiriya"], "The Giant's Causeway is on the North Atlantic coast of Northern Ireland.", "landmarks_structured"),
  q("landmarks", "easy", "connected_clue", "A tidal island, Normandy, and an abbey rising above mudflats point to which landmark?", "Mont Saint-Michel", ["Skara Brae", "Meteora", "Baalbek"], "Mont Saint-Michel is a tidal island abbey in Normandy.", "landmarks_structured"),
  q("landmarks", "intermediate", "connected_clue", "Basalt columns, Northern Ireland, and a legendary giant point to which landmark?", "Giant's Causeway", ["Stonehenge", "Cliffs of Moher", "Skara Brae"], "The Giant's Causeway is a basalt-column coastline in Northern Ireland.", "landmarks_structured"),
  q("landmarks", "intermediate", "connected_clue", "A Buddhist mandala plan, Java, and hundreds of stupas point to which temple?", "Borobudur", ["Bagan", "Angkor Thom", "Shwedagon Pagoda"], "Borobudur is a massive Buddhist temple in Java.", "landmarks_structured"),
  q("landmarks", "hard", "connected_clue", "A stone city, soapstone birds, and a country named for the ruins point to which site?", "Great Zimbabwe", ["Carthage", "Leptis Magna", "Twyfelfontein"], "Great Zimbabwe gave modern Zimbabwe its name and is known for stone ruins and soapstone birds.", "landmarks_structured"),

  q("physical_geography", "easy", "standard_recall", "Which ocean lies east of Africa and west of Australia?", "Indian Ocean", ["Atlantic Ocean", "Pacific Ocean", "Arctic Ocean"], "The Indian Ocean lies between Africa, Asia, Australia, and Antarctica.", "physical_geography_structured"),
  q("physical_geography", "easy", "standard_recall", "Which mountain range runs along the western edge of South America?", "Andes", ["Rockies", "Alps", "Atlas Mountains"], "The Andes run along western South America.", "physical_geography_structured"),
  q("physical_geography", "easy", "standard_recall", "Which desert covers much of northern China and southern Mongolia?", "Gobi Desert", ["Atacama Desert", "Namib Desert", "Mojave Desert"], "The Gobi Desert spans parts of northern China and southern Mongolia.", "physical_geography_structured"),
  q("physical_geography", "easy", "standard_recall", "Which sea is the world's saltiest large lake and sits below sea level?", "Dead Sea", ["Caspian Sea", "Aral Sea", "Black Sea"], "The Dead Sea is a hypersaline lake below sea level.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which river forms much of the border between Mexico and the United States?", "Rio Grande", ["Colorado River", "Columbia River", "Mississippi River"], "The Rio Grande forms a long stretch of the US-Mexico border.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which river flows through Paris?", "Seine", ["Rhone", "Loire", "Garonne"], "The Seine flows through Paris.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which river flows through Vienna, Budapest, and Belgrade?", "Danube", ["Rhine", "Elbe", "Vistula"], "The Danube passes through or along several European capitals and major cities.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which lake is the world's deepest freshwater lake?", "Lake Baikal", ["Lake Tanganyika", "Lake Superior", "Lake Tahoe"], "Lake Baikal is the deepest freshwater lake.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which island is the largest in the Mediterranean Sea?", "Sicily", ["Sardinia", "Cyprus", "Crete"], "Sicily is the largest island in the Mediterranean.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which strait separates mainland Asia from North America?", "Bering Strait", ["Dover Strait", "Hormuz Strait", "Malacca Strait"], "The Bering Strait separates Siberia from Alaska.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "standard_recall", "Which waterfall system lies on the border of Zambia and Zimbabwe?", "Victoria Falls", ["Iguazu Falls", "Niagara Falls", "Angel Falls"], "Victoria Falls is on the Zambezi River between Zambia and Zimbabwe.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which desert is one of the driest non-polar deserts on Earth?", "Atacama Desert", ["Thar Desert", "Sonoran Desert", "Great Victoria Desert"], "The Atacama Desert is famous for extreme aridity.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which sea is connected to the Atlantic by the Strait of Gibraltar?", "Mediterranean Sea", ["Red Sea", "Baltic Sea", "Caspian Sea"], "The Mediterranean connects to the Atlantic through the Strait of Gibraltar.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which plateau covers much of Tibet and is often called the roof of the world?", "Tibetan Plateau", ["Iranian Plateau", "Colorado Plateau", "Anatolian Plateau"], "The Tibetan Plateau is extremely high and broad.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which island is shared by Indonesia, Malaysia, and Brunei?", "Borneo", ["Sumatra", "New Guinea", "Sulawesi"], "Borneo is divided among Indonesia, Malaysia, and Brunei.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which gulf lies between Iran and the Arabian Peninsula?", "Persian Gulf", ["Gulf of Aden", "Gulf of Aqaba", "Gulf of Thailand"], "The Persian Gulf lies between Iran and the Arabian Peninsula.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which mountain range includes Mont Blanc?", "Alps", ["Carpathians", "Apennines", "Caucasus"], "Mont Blanc is in the Alps.", "physical_geography_structured"),
  q("physical_geography", "hard", "standard_recall", "Which sea lies between the Arabian Peninsula and northeast Africa?", "Red Sea", ["Arabian Sea", "Black Sea", "Aegean Sea"], "The Red Sea separates Arabia from northeast Africa.", "physical_geography_structured"),
  q("physical_geography", "easy", "odd_one_out", "Which of these is NOT an ocean?", "Mediterranean Sea", ["Pacific Ocean", "Atlantic Ocean", "Indian Ocean"], "The Mediterranean is a sea; the other three are oceans.", "physical_geography_structured"),
  q("physical_geography", "easy", "odd_one_out", "Which of these is NOT a desert?", "Amazon Basin", ["Gobi Desert", "Atacama Desert", "Namib Desert"], "The Amazon Basin is a humid river basin; the others are deserts.", "physical_geography_structured"),
  q("physical_geography", "easy", "odd_one_out", "Which of these is NOT a mountain range?", "Danube", ["Andes", "Alps", "Himalayas"], "The Danube is a river; the others are mountain ranges.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "odd_one_out", "Which of these is NOT an island?", "Caspian Sea", ["Sicily", "Borneo", "Madagascar"], "The Caspian Sea is an inland body of water; the others are islands.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "odd_one_out", "Which of these is NOT a strait?", "Lake Baikal", ["Bering Strait", "Dover Strait", "Malacca Strait"], "Lake Baikal is a lake; the others are straits.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "odd_one_out", "Which physical feature listed here sits outside Africa?", "Gobi Desert", ["Namib Desert", "Atlas Mountains", "Lake Malawi"], "The Gobi is in Asia; the others are African physical features.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "odd_one_out", "Which of these is NOT in Europe?", "Atacama Desert", ["Alps", "Danube", "Baltic Sea"], "The Atacama is in South America; the others are European features.", "physical_geography_structured"),
  q("physical_geography", "hard", "odd_one_out", "Which of these is NOT part of the Nile river system?", "Mekong", ["White Nile", "Blue Nile", "Atbara"], "The Mekong is in Southeast Asia; the other three are part of the Nile system.", "physical_geography_structured"),
  q("physical_geography", "hard", "odd_one_out", "Which of these is NOT a Great Rift Valley lake?", "Lake Superior", ["Lake Tanganyika", "Lake Malawi", "Lake Turkana"], "Lake Superior is in North America; the others are associated with the East African Rift.", "physical_geography_structured"),
  q("physical_geography", "hard", "odd_one_out", "Which of these is NOT a sea connected to the Mediterranean?", "Baltic Sea", ["Adriatic Sea", "Aegean Sea", "Ionian Sea"], "The Baltic is in northern Europe; the others are Mediterranean seas.", "physical_geography_structured"),
  q("physical_geography", "hard", "odd_one_out", "Which of these is NOT a Pacific island group?", "Azores", ["Fiji", "Samoa", "Solomon Islands"], "The Azores are in the Atlantic; the others are in the Pacific.", "physical_geography_structured"),
  q("physical_geography", "hard", "odd_one_out", "Which of these is NOT a river delta?", "Tibetan Plateau", ["Nile Delta", "Mekong Delta", "Ganges Delta"], "The Tibetan Plateau is a plateau; the others are river deltas.", "physical_geography_structured"),
  q("physical_geography", "easy", "negative_exception", "Which body of water is NOT landlocked?", "Red Sea", ["Caspian Sea", "Dead Sea", "Aral Sea"], "The Red Sea connects to the ocean via the Bab el-Mandeb; the others are inland bodies of water.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "negative_exception", "Which river does NOT flow into the Atlantic Ocean or one of its marginal seas?", "Mekong", ["Amazon", "Congo", "Rhine"], "The Mekong flows to the South China Sea in the Pacific system; the others drain to the Atlantic system.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "negative_exception", "Which mountain range is NOT in Asia?", "Andes", ["Himalayas", "Kunlun Mountains", "Zagros Mountains"], "The Andes are in South America; the others are Asian mountain ranges.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "negative_exception", "Which desert is NOT in the Southern Hemisphere?", "Gobi Desert", ["Atacama Desert", "Namib Desert", "Great Victoria Desert"], "The Gobi is north of the equator; the others listed are in the Southern Hemisphere.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "negative_exception", "Which island is NOT in the Indian Ocean?", "Iceland", ["Madagascar", "Sri Lanka", "Socotra"], "Iceland is in the North Atlantic; the others are in the Indian Ocean region.", "physical_geography_structured"),
  q("physical_geography", "hard", "negative_exception", "Which sea is NOT mostly enclosed by Europe?", "Arabian Sea", ["Baltic Sea", "Adriatic Sea", "Aegean Sea"], "The Arabian Sea is between Arabia and India; the others are European seas.", "physical_geography_structured"),
  q("physical_geography", "hard", "negative_exception", "Which feature is NOT on or near the Ring of Fire?", "Atlas Mountains", ["Andes", "Japan Trench", "Cascades"], "The Atlas Mountains are in northwest Africa; the others are associated with the Pacific Ring of Fire.", "physical_geography_structured"),
  q("physical_geography", "hard", "negative_exception", "Which lake is NOT one of Africa's Great Lakes?", "Lake Titicaca", ["Lake Victoria", "Lake Tanganyika", "Lake Malawi"], "Lake Titicaca is in the Andes; the others are African Great Lakes.", "physical_geography_structured"),
  q("physical_geography", "easy", "numeric_estimation", "Mount Everest is about how high above sea level?", "8,849 m", ["6,849 m", "7,849 m", "9,849 m"], "Mount Everest's accepted height is about 8,849 meters.", "physical_geography_structured"),
  q("physical_geography", "easy", "numeric_estimation", "The Mariana Trench's Challenger Deep is roughly how deep?", "10,900 m", ["5,900 m", "8,900 m", "14,900 m"], "Challenger Deep is roughly 10,900 meters below sea level.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "numeric_estimation", "The Amazon River is roughly how long?", "6,400 km", ["2,400 km", "4,400 km", "8,400 km"], "The Amazon is commonly listed at roughly 6,400 kilometers long.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "numeric_estimation", "Lake Baikal is roughly how deep at its deepest point?", "1,642 m", ["642 m", "1,142 m", "2,642 m"], "Lake Baikal reaches about 1,642 meters deep.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "numeric_estimation", "The Caspian Sea is roughly how many square kilometers in area?", "371,000 sq km", ["171,000 sq km", "571,000 sq km", "771,000 sq km"], "The Caspian Sea covers roughly 371,000 square kilometers.", "physical_geography_structured"),
  q("physical_geography", "hard", "numeric_estimation", "The Bering Strait is roughly how wide at its narrowest?", "82 km", ["22 km", "182 km", "382 km"], "The Bering Strait is roughly 82 kilometers wide at its narrowest.", "physical_geography_structured"),
  q("physical_geography", "hard", "numeric_estimation", "Victoria Falls is roughly how wide?", "1,700 m", ["700 m", "2,700 m", "4,700 m"], "Victoria Falls is roughly 1,700 meters wide.", "physical_geography_structured"),
  q("physical_geography", "hard", "numeric_estimation", "The Dead Sea shore is roughly how far below sea level?", "430 m", ["30 m", "230 m", "830 m"], "The Dead Sea shore lies roughly 430 meters below sea level.", "physical_geography_structured"),
  q("physical_geography", "easy", "superlative_comparison", "Which listed ocean is largest?", "Pacific Ocean", ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean"], "The Pacific Ocean is the largest ocean.", "physical_geography_structured"),
  q("physical_geography", "easy", "superlative_comparison", "Which listed mountain range is longest on land?", "Andes", ["Alps", "Atlas Mountains", "Carpathians"], "The Andes are the longest continental mountain range.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "superlative_comparison", "Which listed lake is deepest?", "Lake Baikal", ["Lake Superior", "Lake Victoria", "Lake Erie"], "Lake Baikal is the deepest lake listed.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "superlative_comparison", "Which listed island is largest?", "Borneo", ["Sicily", "Crete", "Cyprus"], "Borneo is much larger than the Mediterranean islands listed.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "superlative_comparison", "Which listed desert is driest?", "Atacama Desert", ["Thar Desert", "Kalahari Desert", "Mojave Desert"], "The Atacama is among the driest non-polar deserts.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "superlative_comparison", "Which listed sea is largest by area?", "Caspian Sea", ["Black Sea", "Red Sea", "Baltic Sea"], "The Caspian Sea is the largest enclosed inland body of water.", "physical_geography_structured"),
  q("physical_geography", "hard", "superlative_comparison", "Which listed river carries the most water by discharge?", "Amazon", ["Danube", "Rio Grande", "Seine"], "The Amazon has by far the greatest discharge among the listed rivers.", "physical_geography_structured"),
  q("physical_geography", "hard", "superlative_comparison", "Which listed waterfall system is widest?", "Victoria Falls", ["Niagara Falls", "Yosemite Falls", "Sutherland Falls"], "Victoria Falls is famous for its broad curtain of falling water.", "physical_geography_structured"),
  q("physical_geography", "hard", "superlative_comparison", "Which listed strait is narrowest?", "Dover Strait", ["Bering Strait", "Taiwan Strait", "Korea Strait"], "The Dover Strait is narrower than the other listed straits.", "physical_geography_structured"),
  q("physical_geography", "hard", "superlative_comparison", "Which listed island lies farthest north?", "Iceland", ["Madagascar", "Sri Lanka", "Borneo"], "Iceland is in the North Atlantic near the Arctic Circle.", "physical_geography_structured"),
  q("physical_geography", "easy", "connected_clue", "A high plateau, Himalayan rain shadow, and 'roof of the world' point to which feature?", "Tibetan Plateau", ["Mongolian Plateau", "Patagonian Plateau", "Colorado Plateau"], "The Tibetan Plateau is often called the roof of the world.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "connected_clue", "A river, Vienna to Budapest, and a Black Sea delta point to which waterway?", "Danube", ["Rhine", "Seine", "Vistula"], "The Danube passes Vienna and Budapest and drains into the Black Sea.", "physical_geography_structured"),
  q("physical_geography", "intermediate", "connected_clue", "A desert, coastal fog, Namibia, and ancient dunes point to which desert?", "Namib Desert", ["Gobi Desert", "Thar Desert", "Mojave Desert"], "The Namib Desert is a fog-influenced coastal desert in Namibia.", "physical_geography_structured"),
  q("physical_geography", "hard", "connected_clue", "A narrow passage, Alaska, Siberia, and two Diomede Islands point to which strait?", "Bering Strait", ["Dover Strait", "Hormuz Strait", "Cook Strait"], "The Bering Strait separates Alaska from Siberia and contains the Diomede Islands.", "physical_geography_structured"),

  q("country_facts", "easy", "standard_recall", "Which narrow country follows the lower Gambia River and is almost surrounded by Senegal?", "The Gambia", ["Senegal", "Guinea-Bissau", "Sierra Leone"], "The Gambia follows the Gambia River and is mostly surrounded by Senegal except for its Atlantic coast.", "country_facts_structured"),
  q("country_facts", "easy", "standard_recall", "Which country lies between France and Spain in the Pyrenees?", "Andorra", ["Monaco", "Liechtenstein", "Luxembourg"], "Andorra is a small country in the Pyrenees between France and Spain.", "country_facts_structured"),
  q("country_facts", "easy", "standard_recall", "Which country borders both the Atlantic Ocean and the Mediterranean Sea?", "Morocco", ["Tunisia", "Egypt", "Lebanon"], "Morocco has coastlines on both the Atlantic and the Mediterranean.", "country_facts_structured"),
  q("country_facts", "easy", "standard_recall", "Which country is made up of England, Scotland, Wales, and Northern Ireland?", "United Kingdom", ["Ireland", "Netherlands", "Denmark"], "The United Kingdom consists of England, Scotland, Wales, and Northern Ireland.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country has the North African exclave Ceuta?", "Spain", ["Portugal", "France", "Italy"], "Ceuta is a Spanish autonomous city on the North African coast.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country has two main parts separated by the South China Sea?", "Malaysia", ["Thailand", "Cambodia", "Bangladesh"], "Malaysia has Peninsular Malaysia and East Malaysia on Borneo.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country occupies most of the Jutland Peninsula?", "Denmark", ["Netherlands", "Belgium", "Poland"], "Most of the Jutland Peninsula belongs to Denmark.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country shares the island of Hispaniola with Haiti?", "Dominican Republic", ["Cuba", "Jamaica", "Puerto Rico"], "The Dominican Republic and Haiti share Hispaniola.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country shares the island of Timor with Indonesia?", "Timor-Leste", ["Brunei", "Papua New Guinea", "Singapore"], "Timor-Leste occupies the eastern part of Timor and an exclave on the island.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country is bordered by Spain on one side and the Atlantic on the other?", "Portugal", ["Andorra", "Monaco", "Slovenia"], "Mainland Portugal has Spain as its only land neighbor and a long Atlantic coast.", "country_facts_structured"),
  q("country_facts", "intermediate", "standard_recall", "Which country is the only one with a coastline on both the Red Sea and the Persian Gulf?", "Saudi Arabia", ["Oman", "Yemen", "United Arab Emirates"], "Saudi Arabia has coastlines on the Red Sea and the Persian Gulf.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country has Baarle-Hertog enclaves inside the Netherlands?", "Belgium", ["Germany", "France", "Luxembourg"], "Baarle-Hertog is a Belgian municipality with enclaves in the Netherlands.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country contains the Cabinda exclave separated by the Democratic Republic of the Congo?", "Angola", ["Republic of the Congo", "Gabon", "Cameroon"], "Cabinda is an Angolan exclave separated from the rest of Angola.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country has the Kaliningrad exclave on the Baltic Sea?", "Russia", ["Poland", "Lithuania", "Belarus"], "Kaliningrad Oblast is a Russian exclave on the Baltic Sea.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country is doubly landlocked in Central Asia?", "Uzbekistan", ["Kazakhstan", "Mongolia", "Afghanistan"], "Uzbekistan is one of the world's two doubly landlocked countries.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country is doubly landlocked in Europe?", "Liechtenstein", ["Luxembourg", "Andorra", "Moldova"], "Liechtenstein is doubly landlocked because its neighbors are landlocked.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country is divided into 26 cantons?", "Switzerland", ["Austria", "Belgium", "Czechia"], "Switzerland is a federal country made up of 26 cantons.", "country_facts_structured"),
  q("country_facts", "hard", "standard_recall", "Which country uses the UN M49 subregion name Melanesia?", "Fiji", ["Samoa", "Tonga", "Kiribati"], "Fiji is classified in Melanesia under the UN geoscheme.", "country_facts_structured"),
  q("country_facts", "easy", "odd_one_out", "Which of these countries has a coastline?", "Vietnam", ["Laos", "Mongolia", "Nepal"], "Vietnam has a coastline; Laos, Mongolia, and Nepal are landlocked.", "country_facts_structured"),
  q("country_facts", "easy", "odd_one_out", "Which of these is NOT an island country?", "Laos", ["Iceland", "Madagascar", "Sri Lanka"], "Laos is landlocked on mainland Asia; the others are island countries.", "country_facts_structured"),
  q("country_facts", "easy", "odd_one_out", "Which of these is NOT in South America?", "Panama", ["Peru", "Chile", "Uruguay"], "Panama is in Central America; the other three are South American countries.", "country_facts_structured"),
  q("country_facts", "intermediate", "odd_one_out", "Which of these is NOT in the Caucasus region?", "Slovakia", ["Georgia", "Armenia", "Azerbaijan"], "Slovakia is in Central Europe; the other three are Caucasus countries.", "country_facts_structured"),
  q("country_facts", "intermediate", "odd_one_out", "Which of these is NOT in the Horn of Africa?", "Ghana", ["Ethiopia", "Eritrea", "Djibouti"], "Ghana is in West Africa; the others are in or commonly associated with the Horn of Africa.", "country_facts_structured"),
  q("country_facts", "intermediate", "odd_one_out", "Which of these is NOT in the Baltic region?", "Slovenia", ["Estonia", "Latvia", "Lithuania"], "Slovenia is in Central/Southeastern Europe; the others are Baltic states.", "country_facts_structured"),
  q("country_facts", "intermediate", "odd_one_out", "Which of these is NOT in the Maghreb?", "Jordan", ["Morocco", "Algeria", "Tunisia"], "Jordan is in Western Asia; Morocco, Algeria, and Tunisia are Maghreb countries.", "country_facts_structured"),
  q("country_facts", "intermediate", "odd_one_out", "Which of these is NOT a microstate in Europe?", "Iceland", ["Andorra", "Monaco", "Liechtenstein"], "Iceland is larger and not usually grouped as a European microstate; the others are.", "country_facts_structured"),
  q("country_facts", "hard", "odd_one_out", "Which of these is NOT an enclave country?", "Eswatini", ["Lesotho", "San Marino", "Vatican City"], "Eswatini borders South Africa and Mozambique; the others are fully enclosed by one country.", "country_facts_structured"),
  q("country_facts", "hard", "odd_one_out", "Which of these is NOT a country with territory on Borneo?", "Philippines", ["Indonesia", "Malaysia", "Brunei"], "Indonesia, Malaysia, and Brunei share Borneo; the Philippines does not.", "country_facts_structured"),
  q("country_facts", "hard", "odd_one_out", "Which of these is NOT one of the Benelux countries?", "Denmark", ["Belgium", "Netherlands", "Luxembourg"], "Benelux is Belgium, the Netherlands, and Luxembourg.", "country_facts_structured"),
  q("country_facts", "hard", "odd_one_out", "Which of these is NOT in Polynesia under common UN-style regional grouping?", "Fiji", ["Samoa", "Tonga", "Tuvalu"], "Fiji is in Melanesia; Samoa, Tonga, and Tuvalu are commonly grouped in Polynesia.", "country_facts_structured"),
  q("country_facts", "easy", "negative_exception", "Which country does NOT border Austria?", "Belgium", ["Germany", "Italy", "Hungary"], "Belgium does not border Austria; Germany, Italy, and Hungary do.", "country_facts_structured"),
  q("country_facts", "intermediate", "negative_exception", "Which country does NOT border China?", "Thailand", ["Mongolia", "Vietnam", "Kazakhstan"], "Thailand does not border China; Mongolia, Vietnam, and Kazakhstan do.", "country_facts_structured"),
  q("country_facts", "intermediate", "negative_exception", "Which country does NOT border Brazil?", "Chile", ["Peru", "Bolivia", "Uruguay"], "Chile does not border Brazil; Peru, Bolivia, and Uruguay do.", "country_facts_structured"),
  q("country_facts", "intermediate", "negative_exception", "Which country does NOT border the Mediterranean Sea?", "Portugal", ["Spain", "Greece", "Lebanon"], "Portugal has an Atlantic coast but no Mediterranean coast; the others border the Mediterranean.", "country_facts_structured"),
  q("country_facts", "intermediate", "negative_exception", "Which country does NOT have an Arctic coastline?", "Sweden", ["Canada", "Russia", "Norway"], "Sweden reaches the Arctic region but lacks an Arctic Ocean coastline; the others have Arctic coastlines.", "country_facts_structured"),
  q("country_facts", "hard", "negative_exception", "Which country does NOT border Lake Victoria?", "Rwanda", ["Tanzania", "Uganda", "Kenya"], "Rwanda does not border Lake Victoria; Tanzania, Uganda, and Kenya do.", "country_facts_structured"),
  q("country_facts", "hard", "negative_exception", "Which country does NOT border the Caspian Sea?", "Uzbekistan", ["Kazakhstan", "Turkmenistan", "Azerbaijan"], "Uzbekistan is landlocked away from the Caspian shore; the others border it.", "country_facts_structured"),
  q("country_facts", "hard", "negative_exception", "Which country does NOT share a land border with Turkey?", "Jordan", ["Greece", "Georgia", "Iran"], "Jordan does not border Turkey; Greece, Georgia, and Iran do.", "country_facts_structured"),
  q("country_facts", "easy", "numeric_estimation", "How many countries border Austria?", "8", ["6", "7", "9"], "Austria has eight land neighbors.", "country_facts_structured"),
  q("country_facts", "easy", "numeric_estimation", "How many countries border Norway by land?", "3", ["1", "2", "4"], "Norway borders Sweden, Finland, and Russia by land.", "country_facts_structured"),
  q("country_facts", "intermediate", "numeric_estimation", "How many countries border Germany?", "9", ["7", "8", "10"], "Germany has nine land neighbors.", "country_facts_structured"),
  q("country_facts", "intermediate", "numeric_estimation", "How many countries border Brazil?", "10", ["8", "9", "11"], "Brazil borders ten countries in South America.", "country_facts_structured"),
  q("country_facts", "intermediate", "numeric_estimation", "How many countries border China by land?", "14", ["10", "12", "16"], "China has fourteen land neighbors by common counts.", "country_facts_structured"),
  q("country_facts", "hard", "numeric_estimation", "How many sovereign states are doubly landlocked?", "2", ["1", "3", "4"], "Only Liechtenstein and Uzbekistan are doubly landlocked sovereign states.", "country_facts_structured"),
  q("country_facts", "hard", "numeric_estimation", "How many countries are fully surrounded by one other country?", "3", ["2", "4", "5"], "Lesotho, San Marino, and Vatican City are sovereign states enclosed by one country.", "country_facts_structured"),
  q("country_facts", "hard", "numeric_estimation", "How many countries share a land border with both Germany and Italy?", "2", ["1", "3", "4"], "Austria and Switzerland border both Germany and Italy.", "country_facts_structured"),
  q("country_facts", "easy", "superlative_comparison", "Which listed country has the largest land area?", "Canada", ["Japan", "Germany", "Morocco"], "Canada is much larger than the other listed countries.", "country_facts_structured"),
  q("country_facts", "easy", "superlative_comparison", "Which listed country has the most land neighbors?", "China", ["Australia", "Iceland", "New Zealand"], "China has many land neighbors; the island countries listed have none.", "country_facts_structured"),
  q("country_facts", "intermediate", "superlative_comparison", "Which listed country is farthest north?", "Norway", ["Morocco", "Vietnam", "Uruguay"], "Norway extends much farther north than the other listed countries.", "country_facts_structured"),
  q("country_facts", "intermediate", "superlative_comparison", "Among these countries, which one reaches farthest toward Antarctica?", "New Zealand", ["Canada", "Portugal", "Japan"], "New Zealand lies farthest south among the listed countries.", "country_facts_structured"),
  q("country_facts", "intermediate", "superlative_comparison", "Which listed country is smallest by area?", "Monaco", ["Belgium", "Denmark", "Slovenia"], "Monaco is far smaller than the other countries listed.", "country_facts_structured"),
  q("country_facts", "intermediate", "superlative_comparison", "Which listed country has the longest coastline?", "Canada", ["Germany", "Poland", "Hungary"], "Canada has the world's longest coastline.", "country_facts_structured"),
  q("country_facts", "hard", "superlative_comparison", "Which listed landlocked country is largest by area?", "Kazakhstan", ["Mongolia", "Chad", "Bolivia"], "Kazakhstan is the world's largest landlocked country.", "country_facts_structured"),
  q("country_facts", "hard", "superlative_comparison", "Which listed island country is largest by area?", "Madagascar", ["Iceland", "Sri Lanka", "Jamaica"], "Madagascar is larger than the other listed island countries.", "country_facts_structured"),
  q("country_facts", "hard", "superlative_comparison", "Which listed country has the highest average elevation?", "Bhutan", ["Netherlands", "Bangladesh", "Qatar"], "Bhutan's Himalayan landscape gives it a high average elevation.", "country_facts_structured"),
  q("country_facts", "hard", "superlative_comparison", "Which listed country spans the most time zones when overseas territories are included?", "France", ["Japan", "Kenya", "Peru"], "France spans many time zones through overseas territories.", "country_facts_structured"),
  q("country_facts", "easy", "connected_clue", "Two tiny neighbors, Alps, doubly landlocked, and a Rhine border point to which country?", "Liechtenstein", ["Luxembourg", "Andorra", "Monaco"], "Liechtenstein is an Alpine, doubly landlocked country on the Rhine.", "country_facts_structured"),
  q("country_facts", "intermediate", "connected_clue", "Cabinda, oil coast, and a main territory south of the Congo River point to which country?", "Angola", ["Gabon", "Cameroon", "Namibia"], "Angola includes the Cabinda exclave north of its main territory.", "country_facts_structured"),
  q("country_facts", "intermediate", "connected_clue", "A Caribbean island split between two sovereign states points to which island?", "Hispaniola", ["Jamaica", "Cuba", "Trinidad"], "Hispaniola is shared by Haiti and the Dominican Republic.", "country_facts_structured"),
  q("country_facts", "hard", "connected_clue", "A country of two main landmasses, Borneo states, and the Strait of Malacca points to which country?", "Malaysia", ["Indonesia", "Philippines", "Thailand"], "Malaysia includes Peninsular Malaysia and East Malaysian states on Borneo.", "country_facts_structured"),
];

const built = buildRows(RAW_GEOGRAPHY_FACTS);

export const knowledgeGeographyBreadthQuestions = built.rows;
export const knowledgeGeographyBreadthReviewRows = built.reviewRows;
export const questions = knowledgeGeographyBreadthQuestions;
export default knowledgeGeographyBreadthQuestions;
