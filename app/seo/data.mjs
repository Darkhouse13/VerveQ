/**
 * Data layer for the programmatic SEO pages. Reads the SAME sourced player
 * facts the game modes are built on (convex/data/playersSourced.json:
 * Wikidata-cited clubs with spells, nation, position, birth year) plus the
 * curated career paths, and exposes them in page-friendly shapes.
 *
 * Only `sourceQuality: "green"` club/nation facts are used — the amber tier is
 * what the game itself treats as unconfirmed.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { slugify } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(HERE, "../convex/data");

function readJson(name) {
  return JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8"));
}

// Wikidata labels are formal ("Real Madrid Club de Fútbol"); search queries
// use the everyday name. Explicit first, then a conservative affix strip.
const CLUB_NAMES = {
  "Real Madrid Club de Fútbol": "Real Madrid",
  "AC Milan": "AC Milan",
  "FC Barcelona": "Barcelona",
  "Chelsea F.C.": "Chelsea",
  "Liverpool F.C.": "Liverpool",
  "Juventus FC": "Juventus",
  "Arsenal F.C.": "Arsenal",
  "Manchester United F.C.": "Manchester United",
  "Manchester City F.C.": "Manchester City",
  "FC Bayern Munich": "Bayern Munich",
  "Paris Saint-Germain FC": "Paris Saint-Germain",
  "Tottenham Hotspur F.C.": "Tottenham",
  "AS Roma": "Roma",
  "Olympique de Marseille": "Marseille",
  "AS Monaco FC": "Monaco",
  "AFC Ajax": "Ajax",
  "Newcastle United F.C.": "Newcastle",
  "West Ham United F.C.": "West Ham",
  "S.L. Benfica": "Benfica",
  "Aston Villa F.C.": "Aston Villa",
  "SS Lazio": "Lazio",
  "Sevilla FC": "Sevilla",
  "Olympique Lyonnais": "Lyon",
  "Valencia CF": "Valencia",
  "ACF Fiorentina": "Fiorentina",
  "Fenerbahçe Istanbul": "Fenerbahçe",
  "Everton F.C.": "Everton",
  "FC Porto": "Porto",
  "PSV Eindhoven": "PSV",
  "Galatasaray S.K.": "Galatasaray",
  "Parma Calcio 1913": "Parma",
  "SSC Napoli": "Napoli",
  "Fulham F.C.": "Fulham",
  "Bayer 04 Leverkusen": "Bayer Leverkusen",
  "Southampton F.C.": "Southampton",
  "Crystal Palace F.C.": "Crystal Palace",
  "Club Atlético River Plate": "River Plate",
  "Blackburn Rovers F.C.": "Blackburn Rovers",
  "U.C. Sampdoria": "Sampdoria",
  "Lille OSC": "Lille",
  "Villarreal CF": "Villarreal",
  "Udinese Calcio": "Udinese",
  "Middlesbrough F.C.": "Middlesbrough",
  "Sunderland A.F.C.": "Sunderland",
  "S.C. Corinthians Paulista": "Corinthians",
  "Beşiktaş J.K. (Football)": "Beşiktaş",
  "Clube de Regatas do Flamengo": "Flamengo",
  "Celtic F.C.": "Celtic",
  "Genoa CFC": "Genoa",
  "Atalanta BC": "Atalanta",
  "FC Girondins de Bordeaux": "Bordeaux",
  "VfL Wolfsburg": "Wolfsburg",
  "Birmingham City F.C.": "Birmingham City",
  "Leicester City F.C.": "Leicester City",
  "Feyenoord Rotterdam": "Feyenoord",
  "Olympiacos F.C.": "Olympiacos",
  "Stade Rennais F.C.": "Rennes",
  "Portsmouth F.C.": "Portsmouth",
  "Leeds United F.C.": "Leeds United",
  "São Paulo FC": "São Paulo",
  "Bolton Wanderers F.C.": "Bolton Wanderers",
  "Nottingham Forest F.C.": "Nottingham Forest",
  "SV Werder Bremen": "Werder Bremen",
  "West Bromwich Albion F.C.": "West Brom",
  "Wolverhampton Wanderers F.C.": "Wolves",
  "Rangers F.C.": "Rangers",
  "S.C. Internacional": "Internacional",
  "Queens Park Rangers F.C.": "QPR",
  "RCD Espanyol de Barcelona": "Espanyol",
  "Grêmio FBPA": "Grêmio",
  "R.S.C. Anderlecht": "Anderlecht",
  "OGC Nice": "Nice",
  "Stoke City F.C.": "Stoke City",
  "Coventry City F.C.": "Coventry City",
  "1. FC Köln": "FC Köln",
  "AS Saint-Étienne": "Saint-Étienne",
  "Brighton & Hove Albion F.C.": "Brighton",
  "Torino FC": "Torino",
  "R.C. Lens": "Lens",
  "Málaga CF": "Málaga",
  "AFC Bournemouth": "Bournemouth",
  "CR Vasco da Gama": "Vasco da Gama",
  "Burnley F.C.": "Burnley",
  "Wigan Athletic F.C.": "Wigan Athletic",
  "Hellas Verona FC": "Hellas Verona",
  "Santos F.C.": "Santos",
  "Al Hilal SFC": "Al Hilal",
  "Fluminense F.C.": "Fluminense",
  "Sociedade Esportiva Palmeiras": "Palmeiras",
  "FC Zenit Saint Petersburg": "Zenit",
  "Watford F.C.": "Watford",
  "Cruzeiro E.C.": "Cruzeiro",
  "GNK Dinamo Zagreb": "Dinamo Zagreb",
  "Bologna F.C. 1909": "Bologna",
  "FC Nantes": "Nantes",
  "AJ Auxerre": "Auxerre",
  "Real Betis Balompié": "Real Betis",
  "TSG 1899 Hoffenheim": "Hoffenheim",
  "Charlton Athletic F.C.": "Charlton Athletic",
  "Swansea City A.F.C.": "Swansea City",
  "Deportivo de A Coruña": "Deportivo La Coruña",
  "Clube Atlético Mineiro": "Atlético Mineiro",
  "Derby County F.C.": "Derby County",
  "RCD Mallorca": "Mallorca",
  "Cardiff City F.C.": "Cardiff City",
  "Sheffield United F.C.": "Sheffield United",
  "Cagliari Calcio": "Cagliari",
  "AZ Alkmaar": "AZ Alkmaar",
  "Brescia Calcio": "Brescia",
  "Norwich City F.C.": "Norwich City",
  "RC Celta de Vigo": "Celta Vigo",
  "Shanghai Shenhua F.C.": "Shanghai Shenhua",
  "Brentford F.C.": "Brentford",
  "Reading F.C.": "Reading",
  "FC Red Bull Salzburg": "Red Bull Salzburg",
  "Al Ittihad FC": "Al-Ittihad",
  "K.R.C. Genk": "Genk",
  "AS Reggina 1914": "Reggina",
  "AEK Athens F.C.": "AEK Athens",
  "Hull City A.F.C.": "Hull City",
  "Levante UD": "Levante",
  "FC Shakhtar Donetsk": "Shakhtar Donetsk",
  "Club Brugge K.V.": "Club Brugge",
  "Club Nacional de Football": "Nacional",
  "Como 1907": "Como",
  "Palermo F.C.": "Palermo",
  "Club Social y Deportivo Colo Colo": "Colo-Colo",
  "Panathinaikos F.C.": "Panathinaikos",
  "FC Lokomotiv Moscow": "Lokomotiv Moscow",
  "Sheffield Wednesday F.C.": "Sheffield Wednesday",
  "Al Sadd Sports Club": "Al Sadd",
  "New York Red Bulls": "New York Red Bulls",
  "Hertha BSC": "Hertha Berlin",
  "Empoli FC": "Empoli",
  "FC Metz": "Metz",
  "FC Basel": "Basel",
  "FC Groningen": "Groningen",
  "Brøndby IF": "Brøndby",
  "Standard Liège": "Standard Liège",
  "Sydney FC": "Sydney FC",
  "Los Angeles FC": "LAFC",
  "FC Seoul": "FC Seoul",
  "Guangzhou F.C.": "Guangzhou FC",
  "Guangzhou FC": "Guangzhou FC",
  "Toronto FC": "Toronto FC",
  "Qatar SC": "Qatar SC",
  "Bridge F.C.": "Bridge FC",
  "Valencia CF Mestalla": "Valencia Mestalla",
  "Tours FC.": "Tours",
  "Tours FC": "Tours",
  "Montpellier Hérault Sport Club": "Montpellier",
  "Shabab AlAhli Dubai Club": "Shabab Al-Ahli",
  "Al-Shabab Football Club": "Al-Shabab",
  "Al Jazira Club": "Al Jazira",
  "İstanbul Başakşehir F.K.": "Başakşehir",
  "FK Crvena zvezda": "Red Star Belgrade",
  "FK Partizan": "Partizan",
  "SBV Vitesse": "Vitesse",
  "SC Heerenveen": "Heerenveen",
  "PFC CSKA Moscow": "CSKA Moscow",
  "PFC CSKA Sofia": "CSKA Sofia",
  "Grasshopper Club Zürich": "Grasshoppers",
  "Club de Fútbol Monterrey": "Monterrey",
  "CF Pachuca": "Pachuca",
  "AC Cesena": "Cesena",
  "U.S. Salernitana": "Salernitana",
  "U.S. Salernitana 1919": "Salernitana",
  "AC Sparta Prague": "Sparta Prague",
  "AS Cannes": "Cannes",
  "SC Bastia": "Bastia",
  "RC Strasbourg Alsace": "Strasbourg",
  "ES Troyes AC": "Troyes",
  "AC ChievoVerona": "Chievo Verona",
  "E.C. Vitória": "EC Vitória",
  "KAA Gent": "Gent",
  "US Lecce": "Lecce",
  "US Livorno": "Livorno",
  "US Livorno 1915": "Livorno",
  "Stade Brestois 29": "Brest",
  "Albacete Balompié": "Albacete",
  "Sint-Truidense V.V.": "Sint-Truiden",
  "Rosenborg BK": "Rosenborg",
  "Le Havre AC": "Le Havre",
  "Al-Wahda S.C.C.": "Al-Wahda",
  "N.E.C.": "NEC Nijmegen",
  "Lyn 1896 FK": "Lyn",
  "AIK Fotboll": "AIK",
  "UD Las Palmas": "Las Palmas",
  "AC Monza": "Monza",
  "US Cremonese": "Cremonese",
  "A.C. Reggiana": "Reggiana",
  "A.C. Reggiana 1919": "Reggiana",
  "A.C. Perugia": "Perugia",
  "A.C. Perugia Calcio": "Perugia",
  "F.C. Copenhagen": "FC Copenhagen",
  "F.C. Lorient": "Lorient",
  "Vålerenga Fotball": "Vålerenga",
  "SC Freiburg": "Freiburg",
  "Club Atlético Osasuna": "Osasuna",
  "Club Atlético Vélez Sarsfield": "Vélez Sarsfield",
  "Club Atlético Independiente": "Independiente",
  "Club Atlético Peñarol": "Peñarol",
  "Club Atlético Rosario Central": "Rosario Central",
  "Club Olimpia": "Olimpia",
  "Club Libertad": "Libertad",
  "Club Universidad de Chile": "Universidad de Chile",
  "Club Sport Emelec": "Emelec",
  "Club León": "León",
  "Club Necaxa": "Necaxa",
  "Guarani Futebol Clube": "Guarani",
  "Liga Deportiva Universitaria de Quito": "LDU Quito",
  "Delfino Pescara 1936": "Pescara",
  "Delfino Pescara": "Pescara",
  "Athletic Club": "Athletic Bilbao",
  "Helsingin Jalkapalloklubi": "HJK Helsinki",
  "Botafogo F.R.": "Botafogo",
  "1. FC Kaiserslautern": "Kaiserslautern",
  "1. FC Nürnberg": "Nürnberg",
  "1. FSV Mainz 05": "Mainz 05",
  "1. FC Saarbrücken": "Saarbrücken",
  "Deportivo Independiente Medellín": "Independiente Medellín",
  "Tiburones Rojos de Veracruz": "Veracruz",
  "Royal Charleroi": "Charleroi",
  "R. Charleroi S.C.": "Charleroi",
  "Karlsruher SC": "Karlsruher SC",
  "Stade de Reims": "Reims",
  "FC Sochaux-Montbéliard": "Sochaux",
  "Deportivo Alavés": "Alavés",
  "Royal Antwerp F.C.": "Royal Antwerp",
  "Qatar Sports Club": "Qatar SC",
};

export function clubName(label) {
  if (CLUB_NAMES[label]) return CLUB_NAMES[label];
  let s = label
    .replace(/\s*\((?:football|football club|soccer)\)$/i, "")
    .replace(/\s+(?:F\.C\.|A\.F\.C\.|FC|CF|AFC|SC|S\.C\.|S\.K\.|K\.V\.|SFC|FBPA|CFC|BC)$/u, "")
    .replace(/\s+(?:Calcio)?\s*\d{4}$/u, "")
    .replace(/\s+Calcio$/u, "")
    .replace(/^(?:FC|AFC|SSC|SS|ACF|GNK|CR|US|AC|AS|SC|FK|PFC|UD|CF|RC|KAA)\s+/u, "")
    .replace(/^(?:[A-Z]\.){1,4}\s+/u, "")
    .replace(/^1\.\s+(?:FC|FSV)\s+/u, "")
    .replace(/^Club Atlético\s+/u, "")
    .replace(/\s+(?:Futebol Clube|Football Club|Fútbol Club|Sport Club)$/u, "");
  s = s.trim();
  // "Qatar SC" must not become "Qatar", nor "Sydney FC" "Sydney": a bare place
  // name reads as the country/city, not the club.
  if (!s || NATION_ADJ[s] || /^(?:Sydney|Seoul|Toronto|Los Angeles|Guangzhou|Melbourne|Bridge|Tokyo|Dubai|Istanbul|Moscow)$/.test(s)) {
    return label.replace(/\.$/, "");
  }
  return s;
}

const NATION_ADJ = {
  France: "French", England: "English", Brazil: "Brazilian", Germany: "German",
  Spain: "Spanish", Italy: "Italian", Argentina: "Argentine", Netherlands: "Dutch",
  Portugal: "Portuguese", Belgium: "Belgian", Denmark: "Danish", Colombia: "Colombian",
  Nigeria: "Nigerian", Sweden: "Swedish", Uruguay: "Uruguayan", Mexico: "Mexican",
  "United States": "American", "Ivory Coast": "Ivorian", Japan: "Japanese",
  Cameroon: "Cameroonian", Norway: "Norwegian", Croatia: "Croatian", Ghana: "Ghanaian",
  Senegal: "Senegalese", "South Korea": "South Korean", Chile: "Chilean",
  Australia: "Australian", Paraguay: "Paraguayan", Poland: "Polish", Serbia: "Serbian",
  Ecuador: "Ecuadorian", Iceland: "Icelandic", "Czech Republic": "Czech", Turkey: "Turkish",
  Russia: "Russian", Ukraine: "Ukrainian", Morocco: "Moroccan", Finland: "Finnish",
  Algeria: "Algerian", Iran: "Iranian", Scotland: "Scottish", Wales: "Welsh",
  "Republic of Ireland": "Irish", Ireland: "Irish", "Northern Ireland": "Northern Irish",
  Austria: "Austrian", Switzerland: "Swiss", Greece: "Greek", Egypt: "Egyptian",
  Peru: "Peruvian", Venezuela: "Venezuelan", Mali: "Malian", Slovakia: "Slovak",
  Slovenia: "Slovenian", Romania: "Romanian", Bulgaria: "Bulgarian", Hungary: "Hungarian",
  Canada: "Canadian", "Bosnia and Herzegovina": "Bosnian", Montenegro: "Montenegrin",
  Georgia: "Georgian", Guinea: "Guinean", Gabon: "Gabonese", Tunisia: "Tunisian",
  "DR Congo": "Congolese", "Costa Rica": "Costa Rican", Jamaica: "Jamaican",
  Israel: "Israeli", Albania: "Albanian", "North Macedonia": "Macedonian",
};

export function nationAdjective(nation) {
  return NATION_ADJ[nation] ?? null;
}

const POSITION_LABEL = { GK: "Goalkeeper", DEF: "Defender", MID: "Midfielder", ATT: "Forward" };

function spellText(spells) {
  return spells
    .map((s) => (s.start && s.end ? (s.start === s.end ? `${s.start}` : `${s.start}–${s.end}`) : s.start ? `${s.start}–present` : "?"))
    .join(", ");
}

let cache = null;

/**
 * One entry per sourced player:
 * { id, name, nation, nationAdj, position, birthYear, clubs:[{name, slug, qid, spells, spellText, firstYear}], careerPath }
 */
export function loadPlayers() {
  if (cache) return cache;
  const sourced = readJson("playersSourced.json");
  const careerPaths = readJson("football_career_paths.json");
  const cpById = new Map(careerPaths.map((c) => [c.id, c]));
  const players = [];
  for (const p of sourced) {
    const f = p.facts;
    const clubs = [];
    const seen = new Set();
    for (const c of f.clubs) {
      if (c.sourceQuality !== "green") continue;
      const name = clubName(c.value);
      const slug = slugify(name);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      const spells = (c.spells ?? []).filter((s) => s.start || s.end);
      clubs.push({
        name,
        slug,
        qid: c.clubQid,
        spells,
        spellText: spellText(spells),
        firstYear: spells.length ? Math.min(...spells.map((s) => s.start ?? 9999)) : 9999,
        lastYear: spells.length ? Math.max(...spells.map((s) => s.end ?? 9999)) : 0,
      });
    }
    const nation = f.nation?.sourceQuality === "green" ? f.nation.value : null;
    players.push({
      id: p.careerPathId,
      qid: p.qid,
      name: p.answerName,
      nation,
      nationAdj: nation ? nationAdjective(nation) : null,
      position: POSITION_LABEL[f.position?.value] ?? null,
      birthYear: f.birthYear?.value ?? null,
      clubs,
      careerPath: cpById.get(p.careerPathId) ?? null,
    });
  }
  cache = { players, careerPaths };
  return cache;
}
