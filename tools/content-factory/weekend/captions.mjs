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
    "Yamal or Mbappé. One name, comments — the group chat couldn't do it.",
    "",
    "The board says 13.0 vs 12.0. Dave brought up Dembélé's Ballon d'Or and got fact-checked. Dave left the group.",
    "",
    "Play it free, no signup → verveq.com/weekend",
    "",
    "#football #yamal #mbappe #ballondor #fantasyfootball",
  ].join("\n"),
  "wknd-referee": [
    "Olise costs more than Mbappé. Kane costs more than Bellingham. The Ballon d'Or holder is priced below a 19-year-old.",
    "",
    "Six price checks. I'm not deciding a single one — worst price on the board goes in the comments, and the crowd is the referee.",
    "",
    "Play free, no signup → verveq.com/weekend",
    "",
    "#football #mbappe #kane #bellingham #fantasyfootball",
  ].join("\n"),
  "wknd-squad": [
    "Mbappé, Yamal, Kane and Olise all fit in one squad — if the other nine shirts cost 4.5 each.",
    "",
    "13 shirts. 91.0. Eight leagues. So one superstar goes. Which? Comments. My final 13 stays withheld. (Gyökeres is 5.5 by the way. Szczęsny is 4.0.)",
    "",
    "Build yours free, no signup → verveq.com/weekend",
    "",
    "#fantasyfootball #football #mbappe #yamal #premierleague",
  ].join("\n"),

  // ── CF-42H paid-boost reel. Conversion register: declarative, zero
  // ad-speak, the deadline said like a fact, ONE CTA line. The caption shows
  // the clean domain (IG captions aren't clickable — standing doctrine
  // above); the tagged link is the BOOST DESTINATION URL, set in the boost
  // flow, utm_source=ig & utm_medium=boost per ticket, campaign/content per
  // CT-1. The block below the rule is operator setup, never caption text.
  "wknd-42h": [
    "36 games. 4 leagues. 13 players on a 91.0 budget — and every player locks at his own kickoff.",
    "",
    "The first of the 36 kicks off Friday. Telstar–Sparta opens the weekend.",
    "",
    "Play free, no signup → verveq.com/weekend",
    "",
    "——— BOOST SETUP — not caption text, do not paste above the line ———",
    "Destination URL (the boost flow's website field; captions aren't clickable):",
    "  https://verveq.com/weekend?utm_source=ig&utm_medium=boost&utm_campaign=weekend26&utm_content=wknd-42h",
    "CTA button: Play Game (fallback: Learn More)",
  ].join("\n"),

  // ── DILEMMA-B1 · the-dilemma. The VOTE ASK LEADS — this format's job is
  // comments, and comments/1000 is a co-primary read against the ladder band.
  // Then the live-now urgency, then the one CTA line. THE WITHHOLD LAW APPLIES
  // TO THE CAPTION TOO: neither caption names a side, hints at one, or asks a
  // question with a right answer in it. Every price is the prod board's, gated
  // by weekend/dilemma-live.mjs on each render.
  // DILEMMA-WEEKLY slot #2 (Sat 2026-08-16): POST-AS-BUILT — the video is the
  // paid-vs-organic twin and carries no new variables; the caption is free
  // (ticket law) and carries the live CTA + the deadline line. All three named
  // players lock Sunday (earliest kickoff Sun 14:45 UTC, re-verified per
  // render by dilemma-live.mjs), so Sunday is the day the decision expires —
  // day words only, never a clock time.
  "wknd-dilemma-1": [
    "A or B? Same money either way — pick in the comments before Sunday's lock.",
    "",
    "9.5 buys you Febas of Celta, the most expensive player with a fixture this weekend. Or it buys you Dolberg AND Berghuis, both of them Ajax, both at home. One slot or two. I'm not telling you which — I genuinely don't know.",
    "",
    "Live now — every player locks at his own kickoff, and all three of these kick off Sunday. The pick is open till then.",
    "",
    "Play free, no signup → verveq.com/weekend",
    "",
    "#fantasyfootball #football #laliga #eredivisie #ajax",
  ].join("\n"),
  // DILEMMA-WEEKLY v2 MECHANISM PROOF — never posted. The caption exists so
  // the render pipeline and the v2 gate's caption-lead deadline check run the
  // same path a real edition will; the banner line makes it unpostable by
  // accident. Real v2 editions (slots #5/#7/#10) copy this shape WITHOUT the
  // banner: vote ask + deadline lead, receipts line, one CTA line.
  "wknd-dilemma-smoke": [
    "*** MECHANISM PROOF — NOT FOR POSTING (cached v1 take under d2-q) ***",
    "A or B? Same price, one slot — pick in the comments before Sunday's lock.",
    "",
    "Aubameyang, Deportivo's dearest player, at home to Elche on Monday. Or Budimir, Osasuna's dearest, away at Celta on Sunday. Once the first of them kicks off, the choice is gone.",
    "",
    "Play free, no signup → verveq.com/weekend",
    "",
    "#fantasyfootball #football #laliga #aubameyang #budimir",
  ].join("\n"),
  "wknd-dilemma-2": [
    "Two strikers, 8.0 each, one slot. A or B in the comments.",
    "",
    "Aubameyang at Deportivo, at home to Elche on Monday night. Or Budimir at Osasuna, away at Celta on Sunday. Same price, same position, and the board has nothing else to say about it.",
    "",
    "Live now — first kickoff Friday, and every player locks at his own kickoff, so one of these two is still live a day after the other.",
    "",
    "Play free, no signup → verveq.com/weekend",
    "",
    "#fantasyfootball #football #laliga #aubameyang #budimir",
  ].join("\n"),
};

// reels link to /weekend; the tease-era assets keep their shipped bare-/ URLs
const TO_WEEKEND = new Set(["wknd-settleit", "wknd-referee", "wknd-squad", "wknd-dilemma-1", "wknd-dilemma-2", "wknd-dilemma-smoke"]);
// paid placements carry their one tagged link inline — appending the organic
// multi-platform block would hand the booster an untagged-link decision again
const SELF_LINKED = new Set(["wknd-42h"]);

export const buildWeekendCaption = (slug) => {
  const c = CAPTIONS[slug];
  if (!c) throw new Error(`No caption for ${slug}`);
  if (SELF_LINKED.has(slug)) return c + "\n";
  return c + linkBlock(slug, TO_WEEKEND.has(slug)) + "\n";
};
