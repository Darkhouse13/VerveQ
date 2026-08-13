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
// Post-launch reels point at /weekend directly — WKND-FUNNEL (ea66823)
// measured bare `/` as a dead end for reel traffic; the tease-era assets
// above predate that ruling and keep their shipped URLs.
const UTM = (source, content) =>
  `https://verveq.com/?utm_source=${source}&utm_medium=social&utm_campaign=weekend26&utm_content=${content}`;
const UTM_WKND = (source, content) =>
  `https://verveq.com/weekend?utm_source=${source}&utm_medium=social&utm_campaign=weekend26&utm_content=${content}`;

const linkBlock = (slug, toWeekend = false) => {
  const u = toWeekend ? UTM_WKND : UTM;
  return [
    "",
    "LINKS — paste per platform, never post untagged:",
    `  TikTok (bio only; captions aren't clickable): ${u("tiktok", "bio")}`,
    `  IG story sticker / bio: ${u("instagram", slug)}`,
    `  YouTube description: ${u("youtube", slug)}`,
    `  X (if cross-posted): ${u("x", slug)}`,
  ].join("\n");
};

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

  // ── CF-WEEKEND reels (post-launch: live product, no waitlist copy).
  // Confident-take register, never sponsor voice; comment ask leads; one CTA
  // line max. Every stat here is FT + double-sourced (REELS_CFWEEKEND.md).
  "wknd-settleit": [
    "Paciência or Naujoks. One name, comments — the chat couldn't do it.",
    "",
    "Two in three minutes against Nacional, or two away from home in a 0-4. Dave said André Silva. Both of André Silva's were penalties. Dave left the group.",
    "",
    "Play it free, no signup → verveq.com/weekend",
    "",
    "#football #eredivisie #ligaportugal #fantasyfootball #openingweekend",
  ].join("\n"),
  "wknd-referee": [
    "Same weekend. Same numbers. One word in the comments: Prestianni or Meulensteen.",
    "",
    "A goal and an assist each, both against promoted sides, both at home. One in an empty Luz, one in a 4-1. The board prices them 7.5 and 5.0. The stats won't settle this one — that's what the crowd is for.",
    "",
    "Play free, no signup → verveq.com/weekend",
    "",
    "#football #benfica #eredivisie #ligaportugal #fantasyfootball",
  ].join("\n"),
  "wknd-squad": [
    "13 shirts. 91.0. Eight leagues. Yamal, Olise, Kane and Mbappé all fit — if the other nine cost 4.5 each.",
    "",
    "So one of them goes. Which? Comments. My final 13 stays withheld.",
    "",
    "Build yours free, no signup → verveq.com/weekend",
    "",
    "#fantasyfootball #football #premierleague #laliga #bundesliga",
  ].join("\n"),
};

// reels link to /weekend; the tease-era assets keep their shipped bare-/ URLs
const TO_WEEKEND = new Set(["wknd-settleit", "wknd-referee", "wknd-squad"]);

export const buildWeekendCaption = (slug) => {
  const c = CAPTIONS[slug];
  if (!c) throw new Error(`No caption for ${slug}`);
  return c + linkBlock(slug, TO_WEEKEND.has(slug)) + "\n";
};
