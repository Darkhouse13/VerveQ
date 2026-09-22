// LAB lane captions — one comment ask leads (answerable in one word or one
// number), the scoring bar lives in the caption (FACELESS_WINNER_SPEC #24),
// then one tagged link. No product pitch: the standalone promo lane is
// retired and these are participation formats. Links carry utm_campaign=lab26
// and a per-reel utm_content so the three concepts can be read apart.
const UTM = (source, content) =>
  `https://verveq.com/v2/career-path?utm_source=${source}&utm_medium=social&utm_campaign=lab26&utm_content=${content}`;

const linkBlock = (slug) =>
  [
    "",
    "LINKS — paste per platform, never post untagged:",
    `  TikTok (bio only; captions aren't clickable): ${UTM("tiktok", "bio")}`,
    `  IG story sticker / bio: ${UTM("instagram", slug)}`,
    `  YouTube description: ${UTM("youtube", slug)}`,
    `  X (if cross-posted): ${UTM("x", slug)}`,
  ].join("\n");

const CAPTIONS = {
  "lab-guesswho": [
    "Nine names. Six questions. Two left — and I'm not flipping the last one.",
    "",
    "Which one is he? One name in the comments. If you had him before question 4, say which question.",
    "",
    "#football #guesswho #footballquiz #premierleague #seriea",
  ].join("\n"),
  "lab-older": [
    "Who's older? Ten rounds, and the gap shrinks every round — 17 years down to 9 days.",
    "",
    "Your streak, 0 to 10, in the comments. Round 7 gets everyone.",
    "",
    "#football #whosolder #footballquiz #ronaldo #modric #haaland",
  ].join("\n"),
  "lab-xi": [
    "Eleven players. One club connects every one of them.",
    "",
    "Which name gave it away? Honest answers only — and tell me the one you'd forgotten played there.",
    "",
    "#football #footballquiz #seriea #inter #premierleague",
  ].join("\n"),
};

export const buildLabCaption = (slug) => {
  const body = CAPTIONS[slug];
  if (!body) throw new Error(`no caption for ${slug}`);
  return `${body}\n${linkBlock(slug)}\n`;
};
