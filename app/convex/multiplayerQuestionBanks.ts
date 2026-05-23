export type StaticArenaQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  checksum: string;
};

export const CAPITAL_CITY_QUESTIONS: StaticArenaQuestion[] = [
  ["What is the capital of Morocco?", "Rabat", "Casablanca", "Marrakesh", "Fez"],
  ["What is the capital of Japan?", "Tokyo", "Kyoto", "Osaka", "Sapporo"],
  ["What is the capital of Canada?", "Ottawa", "Toronto", "Vancouver", "Montreal"],
  ["What is the capital of Brazil?", "Brasília", "Rio de Janeiro", "São Paulo", "Salvador"],
  ["What is the capital of Australia?", "Canberra", "Sydney", "Melbourne", "Perth"],
  ["What is the capital of Egypt?", "Cairo", "Alexandria", "Giza", "Luxor"],
  ["What is the capital of South Korea?", "Seoul", "Busan", "Incheon", "Daegu"],
  ["What is the capital of Argentina?", "Buenos Aires", "Córdoba", "Rosario", "Mendoza"],
  ["What is the capital of Turkey?", "Ankara", "Istanbul", "Izmir", "Bursa"],
  ["What is the capital of Kenya?", "Nairobi", "Mombasa", "Kisumu", "Nakuru"],
  ["What is the capital of Spain?", "Madrid", "Barcelona", "Valencia", "Seville"],
  ["What is the capital of Germany?", "Berlin", "Munich", "Hamburg", "Frankfurt"],
  ["What is the capital of Italy?", "Rome", "Milan", "Naples", "Turin"],
  ["What is the capital of Portugal?", "Lisbon", "Porto", "Braga", "Coimbra"],
  ["What is the capital of Senegal?", "Dakar", "Touba", "Thiès", "Saint-Louis"],
  ["What is the capital of Nigeria?", "Abuja", "Lagos", "Kano", "Ibadan"],
  ["What is the capital of India?", "New Delhi", "Mumbai", "Bengaluru", "Chennai"],
  ["What is the capital of Indonesia?", "Jakarta", "Bandung", "Surabaya", "Bali"],
  ["What is the capital of Mexico?", "Mexico City", "Guadalajara", "Monterrey", "Puebla"],
  ["What is the capital of Sweden?", "Stockholm", "Gothenburg", "Malmö", "Uppsala"],
].map(([question, correctAnswer, ...wrong], i) => ({
  question,
  correctAnswer,
  options: [correctAnswer, ...wrong],
  checksum: `capital_city_${i}`,
}));

export const LOGO_NAME_QUESTIONS: StaticArenaQuestion[] = [
  ["What is the name of the sportswear logo known as the Swoosh?", "Nike", "Adidas", "Puma", "Reebok"],
  ["What is the name of the car logo with a prancing horse?", "Ferrari", "Porsche", "Lamborghini", "Maserati"],
  ["What is the name of the tech logo shaped like a bitten fruit?", "Apple", "Google", "Samsung", "Microsoft"],
  ["What is the name of the fast-food logo with golden arches?", "McDonald's", "Burger King", "KFC", "Subway"],
  ["What is the name of the football club logo with a red devil?", "Manchester United", "Liverpool", "Arsenal", "Chelsea"],
  ["What is the name of the luxury car logo with four rings?", "Audi", "BMW", "Mercedes-Benz", "Volkswagen"],
  ["What is the name of the coffee logo with a twin-tailed siren?", "Starbucks", "Costa Coffee", "Dunkin'", "Tim Hortons"],
  ["What is the name of the social app logo with a white ghost?", "Snapchat", "TikTok", "Instagram", "Discord"],
  ["What is the name of the football club logo with a cockerel on a ball?", "Tottenham Hotspur", "Everton", "Leeds United", "West Ham"],
  ["What is the name of the browser logo with a red-yellow-green circle and blue center?", "Google Chrome", "Firefox", "Safari", "Edge"],
  ["What is the name of the payment logo with overlapping red and yellow circles?", "Mastercard", "Visa", "PayPal", "American Express"],
  ["What is the name of the car logo with a blue-and-white propeller roundel?", "BMW", "Audi", "Volvo", "Tesla"],
  ["What is the name of the football club logo with a cannon?", "Arsenal", "Chelsea", "Manchester City", "Aston Villa"],
  ["What is the name of the streaming logo that is a red play button?", "YouTube", "Netflix", "Twitch", "Spotify"],
  ["What is the name of the brand logo with three parallel stripes?", "Adidas", "Nike", "Asics", "Fila"],
].map(([question, correctAnswer, ...wrong], i) => ({
  question,
  correctAnswer,
  options: [correctAnswer, ...wrong],
  checksum: `logo_name_${i}`,
}));
