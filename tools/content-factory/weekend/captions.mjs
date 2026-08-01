// Captions for THE WEEKEND campaign assets. Every caption ends with the
// campaign's UTM block — the untagged-link funnel hole is a known failure and
// this campaign does not repeat it (CT-1 hard rule): every clickable link is
// tagged, distinct per channel, utm_content distinct per asset. On-screen
// end-cards stay clean "verveq.com"; the tagged links live where links are
// clickable (bio, sticker, description, post).
//
// X copy is NOT here — the X series runs in the confident-take register and
// ships from campaign/x/ as post-ready threads. These captions are for
// TikTok / IG Reels / YouTube Shorts uploads.
const UTM = (source, content) =>
  `https://verveq.com/?utm_source=${source}&utm_medium=social&utm_campaign=weekend26&utm_content=${content}`;

const linkBlock = (slug) => [
  "",
  "LINKS — paste per platform, never post untagged:",
  `  TikTok (bio only; captions aren't clickable): ${UTM("tiktok", "bio")}`,
  `  IG story sticker / bio: ${UTM("instagram", slug)}`,
  `  YouTube description: ${UTM("youtube", slug)}`,
  `  X (if cross-posted): ${UTM("x", slug)}`,
].join("\n");

const CAPTIONS = {
  "wknd-stinger": [
    "Five leagues. One squad. Every weekend.",
    "",
    "THE WEEKEND — a new way to play fantasy football. Fresh draft every week, no season-long grind, and the crowd rates the players — not an algorithm.",
    "",
    "Kicks off with the season — late August. Waitlist open now → link in bio.",
    "",
    "#fantasyfootball #football #premierleague #fpl #fantasydraft",
  ].join("\n"),
  "wknd-manifesto": [
    "We deleted the grind, the transfer math, the chips and the price casino. What's left is the weekend.",
    "",
    "THE WEEKEND: fresh squad every week · five leagues, one squad · the crowd is the referee · the bench is a real role · draft with your crew.",
    "",
    "Late August. Waitlist open now → link in bio.",
    "",
    "#fantasyfootball #football #premierleague #fpl #fantasydraft",
  ].join("\n"),
};

export const buildWeekendCaption = (slug) => {
  const c = CAPTIONS[slug];
  if (!c) throw new Error(`No caption for ${slug}`);
  return c + linkBlock(slug) + "\n";
};
