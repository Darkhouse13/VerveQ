// Ready-to-paste post captions for the hero promos — one per promo, written as
// <name>.txt next to each MP4 (same workflow as the quiz clips' captions.mjs).
// Unlike the quiz captions these are NOT spoiler-sensitive (they're ads), so
// each is a single hand-tuned block matched to that video's angle: a hook, a
// comment-bait line (comments are the ranking signal), the verveq.com CTA, and
// discovery hashtags. English only — same reason as everywhere else.
// ---- campaign link tagging (batch 2.5, THE WEEKEND) ----
// Mirrors weekend/captions.mjs exactly, because it is the same campaign and the
// same funnel: every CLICKABLE link is tagged, distinct per channel, with
// utm_content distinct per asset. On-screen end-cards stay clean "verveq.com".
//
// WHICH PATH, AND WHY IT IS `/weekend` AND NOT `/`.
//
// These links land on `/weekend`, the short link added by WKND-FUNNEL
// (app/src/lib/weekendDeepLink.ts — written for this batch by name). That is not
// a preference; the bare `/` in campaign/kits/bio-links-kit.md is a MEASURED
// dead end. A signed-out visitor on `/` gets the cold-entry taste round, which
// carries no WEEKEND card at all, so reel traffic could not reach the waitlist
// without first playing a round. The 30-day read behind that fix: 5 Instagram
// visitors, 4 saw the card, 0 tapped. `/weekend` routes to Home with the teaser
// pinned to the top of the first screen, behind the build flag only — no
// session guard, no account, no round.
//
// Attribution survives the hop: weekendShortLinkTarget() preserves incoming
// params, and the teaser reads `utm_source ?? ref` for its own source property,
// so the tags below land on every waitlist event the visit produces.
//
// WHICH LINK THESE TWO CAPTIONS ASSUME. The video says "link in bio" and the
// card says LINK IN BIO, so what a viewer actually reaches is the CHANNEL BIO
// LINK. It is shown below for checking rather than pasting — it is a one-time
// profile setting, and re-stating it as a per-post line invites a second,
// untagged variant.
//
// !! The kit's bio URLs still point at the bare `/`. Until they are repointed at
// `/weekend`, "link in bio" on these two lands on the taste round and the last
// hop of this funnel is the exact defect WKND-FUNNEL just measured and fixed.
//
// The per-asset links are for placements that take their own URL (IG story
// sticker, YouTube description, an X cross-post), carrying
// `utm_content=<promo-slug>` so a join from this quiz is separable from a join
// from the stinger.
const WKND_UTM = (source, content) =>
  `https://verveq.com/weekend?utm_source=${source}&utm_medium=social&utm_campaign=weekend26&utm_content=${content}`;

const wkndLinks = (slug) =>
  [
    "",
    "LINKS — paste per platform, never post untagged:",
    `  Bio link — CHECK THIS IS WHAT THE PROFILE POINTS AT: ${WKND_UTM("tiktok", "bio")}`,
    `  IG story sticker: ${WKND_UTM("instagram", slug)}`,
    `  YouTube description: ${WKND_UTM("youtube", slug)}`,
    `  X (if cross-posted): ${WKND_UTM("x", slug)}`,
  ].join("\n");

export const PROMO_CAPTIONS = {
  "settle-it":
    "You think you know football? One app, every mode, a new challenge every " +
    "day — free, no sign-up. ⚽ Play at verveq.com. Which mode are you starting " +
    "with? 👇\n\n#football #footballquiz #footballtrivia #guesstheplayer #footballtiktok",

  versus:
    "Your mate swears he knows more football than you. He doesn't. Send the " +
    "link, go head-to-head, settle it. ⚔️ verveq.com — tag the mate you're " +
    "calling out 👇\n\n#football #footballquiz #footballbanter #headtohead #footballtiktok",

  quiz:
    "Most 'fans' get under half. How good are you REALLY? Play along and comment " +
    "your score — no cheating ⏱️🧠 A new football quiz every day, free at " +
    "verveq.com\n\n#football #footballquiz #footballtrivia #guessthefootballer #footballtiktok",

  "group-chat":
    "4,000 messages. Zero answers. Every group chat has THAT argument — one " +
    "quiz settles it. ⚔️ Send the duel link, screenshot the score, enjoy the " +
    "silence. Free at verveq.com. Tag your chat's worst hot-take merchant 👇" +
    "\n\n#football #footballquiz #footballbanter #groupchat #footballtiktok",

  "one-more":
    "\"One game,\" you said. Three hours ago. 🕐 The most dangerously moreish " +
    "football trivia on the internet — free at verveq.com, no sign-up. What's " +
    "your record for 'one more'? Be honest 👇\n\n#football #footballquiz " +
    "#footballtrivia #relatable #footballtiktok",

  anthem:
    "Every pub. Every office. Every group chat. Same argument. There's a " +
    "website for this now — verveq.com, free, no sign-up. Talk is cheap 🗣️ " +
    "What's the debate YOUR lot can never settle? 👇\n\n#football " +
    "#footballquiz #footballtrivia #footballbanter #footballtiktok",

  breaking:
    "🚨 BREAKING: local man loses the same football argument for the 47th " +
    "time. OFFICIAL: there's now a way to settle it — verveq.com, free, no " +
    "sign-up. Here we go. Tag someone who argues with zero evidence 👇\n\n" +
    "#football #footballquiz #footballnews #footballbanter #footballtiktok",

  wrapped:
    "Your season in football arguments: 147 started, 0 won (self-reported: " +
    "147) 📊 New season, new stat: PROOF. Free at verveq.com. Drop your " +
    "honest arguments-won number below — we'll wait 👇\n\n#football " +
    "#footballquiz #footballtrivia #wrapped #footballtiktok",

  "fan-types":
    "The 5 types of football fans. Every group chat has all five — and one " +
    "quiz exposes everyone 🎯 Free at verveq.com, no sign-up. Which one are " +
    "you? Tag the other four 👇\n\n#football #footballquiz #footballbanter " +
    "#footballfans #footballtiktok",

  rematch:
    "Day 1: lost 9–4. Day 2–29: one quiz a day. Day 30: revenge ⚔️ The " +
    "rematch button exists for a reason — verveq.com, free, no sign-up. Tag " +
    "someone you owe a rematch 👇\n\n#football #footballquiz #revenge " +
    "#footballbanter #footballtiktok",

  remember:
    "You stayed up for the group stages. You kept the sticker album. You " +
    "still know the squad numbers 🧠 20 years of football live in your head " +
    "— put it to work at verveq.com, free, no sign-up. What's the first " +
    "World Cup you remember? 👇\n\n#football #footballquiz #footballnostalgia " +
    "#footballmemories #footballtiktok",

  license:
    "PUBLIC NOTICE: football opinions now require a license 📋 Qualify at " +
    "verveq.com — free, no sign-up, results are final. Tag someone whose " +
    "application would get DENIED (reason: vibes only) 👇\n\n#football " +
    "#footballquiz #footballbanter #footballfans #footballtiktok",

  // ---- batch 5 — CTAs point at the /play short link (lands straight in the
  // marketed mode with attribution; see app PR #35).
  final:
    "The final is JULY 19. The players are warming up — are you? ⚽ Get " +
    "match fit before kickoff at verveq.com/play — free, no sign-up. Who's " +
    "lifting it? Call it now 👇\n\n#football #worldcup #footballquiz " +
    "#footballtrivia #footballtiktok",

  horror:
    "THIS SUMMER… the two scariest words in football: \"prove it\" 😱 Face " +
    "your fear at verveq.com/play — free, no sign-up, survivors post " +
    "screenshots. Tag someone who would NOT survive the scoreboard 👇\n\n" +
    "#football #footballquiz #footballbanter #footballfans #footballtiktok",

  asmr:
    "🔊 SOUND ON. The most satisfying sound in football is being right. Get " +
    "your fix at verveq.com/play — free, no sign-up, dangerously satisfying. " +
    "What's your longest win streak? Be honest 👇\n\n#football #footballquiz " +
    "#asmr #oddlysatisfying #footballtiktok",

  speedrun:
    "Argument any% — NEW WORLD RECORD: 0:09.94 🏆 Opinion → \"source?\" → " +
    "one link → 9–4 → silence. Think you can beat the record? " +
    "verveq.com/play — free, no sign-up. Drop your PB below 👇\n\n#football " +
    "#footballquiz #speedrun #footballbanter #footballtiktok",

  tutorial:
    "How to win any football argument: 1) stop talking 2) send one link " +
    "3) screenshot the result. That's it. That's the tutorial 🎓 " +
    "verveq.com/play — free, no sign-up, step 1 is optional. Tag someone " +
    "who needs this class 👇\n\n#football #footballquiz #howto " +
    "#footballbanter #footballtiktok",

  // ---- batch 6 — research-informed: captions engineered for DM-sends
  // ("send this to…"), not mechanical comment bait; CTAs at /play.
  receipt:
    "The group chat's season, itemized 🧾 147 hot takes. 3 correct. 0 " +
    "sources cited. TOTAL OWED: one apology. Keep the receipts at " +
    "verveq.com/play — free, no sign-up. Send this to the mate whose " +
    "receipt would be the longest 👇\n\n#football #footballquiz " +
    "#footballbanter #groupchat #footballtiktok",

  departures:
    "Now departing from Banter International ✈️ Dave's excuses: ON TIME. " +
    "His first win: CANCELLED. The rematch: BOARDING at Gate VQ — " +
    "verveq.com/play, free, no sign-up. Send this to the mate who's been " +
    "DELAYED since 2019 👇\n\n#football #footballquiz #footballbanter " +
    "#airport #footballtiktok",

  loop:
    "Day 847 of the same argument 🔁 It never ends. (Neither does this " +
    "video — watch it twice, you won't find the seam.) End it for real at " +
    "verveq.com/play — free, no sign-up. Send this to your group chat. You " +
    "know exactly which argument 👇\n\n#football #footballquiz " +
    "#footballbanter #groupchat #footballtiktok",
  // Dated one-off — England v Argentina semi-final, 15 Jul 2026, posted ~1hr
  // before an 8pm BST kickoff. Unlike the evergreen promos this leads with the
  // FACT (it's the hook, and it's the thing people will argue with in the
  // replies), then asks for a prediction — the one comment ask that always
  // clears on matchday. Fixture hashtags first for same-day discovery, brand
  // tags after. Every number here is fact-checked; don't loosen them.
  "semi-final":
    "Lionel Messi has never played against England. Not once. ⚽\n\n" +
    "The only time these two have met in his entire career was 12 Nov 2005 " +
    "in Geneva — and he was suspended for it, serving a ban for a red card he " +
    "picked up seconds into his debut against HUNGARY, three months earlier. " +
    "The ban didn't count in World Cup qualifiers — he played three of those " +
    "in between and still hadn't served it. It only counted in friendlies. And " +
    "Argentina's next friendly was England. It cost him that one game and " +
    "nothing else.\n\n" +
    "That was 7,550 days ago. Bellingham was 2 years old. Messi hadn't even " +
    "scored for Argentina yet — he's got 8 in this tournament alone.\n\n" +
    "Tonight, finally. 🏴󠁧󠁢󠁥󠁮󠁧󠁿🇦🇷\n\n" +
    "Did you actually know that? And what's your score prediction? 👇\n\n" +
    "Think you know your football history? Prove it — free, no sign-up: " +
    "verveq.com/play\n\n" +
    "#EnglandvArgentina #WorldCup #Messi #Bellingham #football #footballquiz " +
    "#footballtrivia #footballtiktok",
  // THE DRAW v2 — "THE DECISION". The video makes the viewer pick BANK or
  // PUSH on the 3-2-1, so the caption's one job is to collect the answer in
  // the comments (a binary is the fastest comment war there is) and dare
  // them to back it up on today's board. Numbers mirror the video and are
  // engine-exact (c13-1: bust keeps 15%, 2,431 × 0.1501 = 365).
  "the-decision":
    "2,431 points. One tap between him and glory. He pushed. He kept 365. 💥\n\n" +
    "THE DRAW — draft 6 from 18, run the gauntlet, then BANK or PUSH. One " +
    "board a day, same for everyone, bust and you keep scraps.\n\n" +
    "You made your call on the countdown — BANK or PUSH? Drop it below, then " +
    "prove it on today's board. Free, no sign-up: verveq.com/draw 👇\n\n" +
    "#football #footballquiz #dailygame #bankorpush #footballtiktok",

  // The retention lane. Each caption's only job is to collect the answer the
  // video deliberately withholds — the video and the caption are one unit, so
  // don't "fix" one without the other.
  //
  // LAW for all three (30d IG read, and it is not a style preference): the last
  // line of prose is a QUESTION THE VIDEO DOES NOT ANSWER, and it points at the
  // withheld slot by its number, not at the video in general. "What do you
  // think?" collects nothing. "Who's rung 5?" collects a name. The verveq.com
  // line sits ABOVE the question so the question is the last thing read — and
  // it is always a bare URL, never "link in bio".
  ladder:
    "Five career paths. Easy to impossible. We answered four of them on " +
    "screen 🧠\n\n" +
    // Dataset-only: the three clubs are cp-michel-platini's path, verbatim.
    // An earlier draft added his Ballon d'Or count — true, but not a fact this
    // dataset carries, and this lane does not assert what it cannot source.
    "Rung 5 is Nancy → Saint-Étienne → Juventus. One man played all three, " +
    "and we are not putting his name in this video.\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "So: who's rung 5? And how far did you actually get — 1, 2, 3, or 4? 👇\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  chain:
    "Real Madrid AND Manchester United. We put up four: Beckham, Van " +
    "Nistelrooy, Di María, Casemiro 👀\n\n" +
    "We left out the obvious one on purpose. You already know who it is, and " +
    "it's killing you.\n\n" +
    "Slot 5 is staying empty. VerveGrid is built out of squares exactly like " +
    "this one — free at verveq.com\n\n" +
    "Who's the obvious one we left out — and who's your slot 5? 👇\n\n" +
    "#football #footballquiz #realmadrid #manchesterunited #footballtiktok",

  wall:
    "Nine career paths. One player each. Get 7 and you're built different ⏱️\n\n" +
    "We answered 01 and 05. The other seven are sealed and staying sealed — " +
    "pause it, you'll need to.\n\n" +
    "All seven are in the app — free, no sign-up: verveq.com\n\n" +
    "What's your score /9, and which sealed one broke you — 02, 03, 04, 06, " +
    "07, 08 or 09? 👇\n\n" +
    "#football #footballquiz #guessthefootballer #careerpath #footballtiktok",

  // ---- the format-test batch (2026-07-25) ----
  // These three captions are not interchangeable with their videos. Each one
  // carries the bait its hypothesis is actually testing, so editing a caption
  // without editing its piece breaks the experiment. See RESEARCH_DIGEST.md.

  // H1: the question has NO checkable answer, which is the entire variable
  // being moved against `chain`. Do not add the answer to this caption.
  "pick-a-side":
    "Four men played for Real Madrid AND Manchester United. Only one of them " +
    "is still claimed by both sets of fans.\n\n" +
    "We said Beckham. Madrid fans will disagree. United fans will disagree " +
    "harder.\n\n" +
    "Pick a side 👇 — and if you think we picked the wrong man, say who.\n\n" +
    "Settle it properly — free, no sign-up: verveq.com\n\n" +
    "#football #realmadrid #manchesterunited #footballdebate #footballtiktok",

  // H3: the length test. Naming the count ("fourteen") is deliberate — it
  // licenses a long tail of replies instead of one right answer ending it.
  "long-chain":
    "Six club pairs. Name a player who played for both.\n\n" +
    "We answered five. We are not answering the sixth, and we're not going " +
    "to. Manchester United AND Manchester City — fourteen men have done it. " +
    "Name one.\n\n" +
    "First correct answer in the comments wins the argument 👇 Wrong answers " +
    "will be corrected by strangers, which is the point.\n\n" +
    "Free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #premierleague #manchesterderby #footballtiktok",

  // H2: withholding taken to its limit. The nearest app competitor promises
  // "before the answer appears" and has taken 0 comments across 9 reels — so
  // the refusal here is stated as attitude, not as a tease.
  "not-telling":
    "Liverpool. Real Madrid. Newcastle. Manchester United. Stoke.\n" +
    "One man. One Ballon d'Or.\n\n" +
    "We're not telling you who it is. Every other account would have shown " +
    "you by now — that's exactly why nobody argues in their comments.\n\n" +
    "Name him 👇 No cheating. We'll know.\n\n" +
    "The answer's in the app — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  // ---- LADDER-LONG (2026-08-01) — four editions, one caption shape.
  //
  // Two comment engines stacked, because FACELESS_WINNER_SPEC found both
  // working and they cost nothing together:
  //   • the TERMINAL WITHHOLD (spec #23a) — rung 10's path is printed verbatim
  //     and its name never appears. pitch.quiz's exact mechanic, and the
  //     biggest number in the studied cohort (232,932 views).
  //   • the SCORE ASK (spec #23b/#24) — "how many of the nine did you get?"
  //     gugum's mechanic, which carried the cohort's best comment rate
  //     (0.00271/view). A number is the cheapest thing on earth to type.
  //
  // Club paths below are copied verbatim from football_career_paths.json. This
  // lane asserts nothing the dataset does not carry — no honours, no counts, no
  // "the only player to…". If it isn't in the dataset it isn't in the caption.
  "ladder-long-all-timers":
    "Ten career paths, easy to impossible. We answered nine on screen 🧠\n\n" +
    // cp-modric, path verbatim. Name never stated, here or in the video.
    "Rung 10: Dinamo Zagreb → Zrinjski Mostar → Inter Zaprešić → Dinamo " +
    "Zagreb → Tottenham → Real Madrid → AC Milan. One man. We're not typing " +
    "his name and neither is the video.\n\n" +
    "So — who's rung 10? And how many of the nine did you actually get? " +
    "Drop both 👇\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-premier-league":
    "Ten career paths. Nine answers on screen. One we're keeping ⚽\n\n" +
    // cp-mascherano, path verbatim.
    "Rung 10: River Plate → Corinthians → West Ham → Liverpool → Barcelona → " +
    "Hebei China Fortune → Estudiantes. If you know it, you know it.\n\n" +
    "Name him 👇 And be honest about your score out of nine — the rail's " +
    "right there on screen.\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #premierleague #careerpath #footballtiktok",

  "ladder-long-modern":
    "Ten career paths from the modern game. We answered nine 🧠\n\n" +
    // cp-rakitic, path verbatim.
    "Rung 10: Basel → Schalke → Sevilla → Barcelona → Sevilla → Al-Shabab → " +
    "Hajduk Split. That's the whole path. That's all you're getting.\n\n" +
    "Who is he? And how far did YOU get before the rail beat you? 👇\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-journeymen":
    "Ten career paths. The long way round. Nine answered, one not 🧠\n\n" +
    // cp-riquelme, path verbatim.
    "Rung 10: Boca Juniors → Barcelona → Villarreal → Boca Juniors → " +
    "Argentinos Juniors. Yes, that Barcelona. No, we're not saying it.\n\n" +
    "Name him 👇 Then tell us your score out of nine. Wrong answers will be " +
    "corrected by strangers, which is the point.\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  // ---- LADDER-LONG batch 2 (2026-08-05) — the cadence A/B + running score.
  //
  // One change from batch 1's caption shape, and it mirrors the change on
  // screen: the SCORE ASK LEADS. Batch 1 put the withhold first and the score
  // second, which is the right order for the people who finished and the wrong
  // order for everyone else — and everyone else is most of them. "x/9" is
  // typeable by someone who bailed at rung 4; the name is only typeable by
  // someone who reached 68s. Cheap ask first.
  //
  // Unchanged: club paths are verbatim from football_career_paths.json, and the
  // withheld name appears nowhere — not in the caption, not in the video, not
  // in the filename.
  "ladder-long-number-ones":
    "Ten career paths. Every single one of them a goalkeeper 🧤\n\n" +
    "What's your score out of nine? Drop the number 👇\n\n" +
    // cp-schmeichel, path verbatim. Name never stated, here or in the video.
    "Then rung 10, which we never answered: Gladsaxe-Hero → Hvidovre → " +
    "Brøndby → Manchester United → Sporting CP → Aston Villa → Manchester " +
    "City. Nobody starts a career in a stranger place and ends it at two of " +
    "those.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #goalkeeper #careerpath #footballtiktok",

  "ladder-long-hard-way-up":
    "Ten career paths that all started a very long way down 🪜\n\n" +
    "Score out of nine in the comments — be honest, the rail was right " +
    "there 👇\n\n" +
    // cp-vardy, path verbatim.
    "And rung 10, the one we kept: Stocksbridge Park Steels → FC Halifax " +
    "Town → Fleetwood Town → Leicester City → Cremonese. If you know it you " +
    "already know it.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-old-guard":
    "Ten career paths from back when the shirts were baggy 🧠\n\n" +
    "How many of the nine did you get? Number in the comments 👇\n\n" +
    // cp-zola, path verbatim.
    "Rung 10 we're not answering: Nuorese → Torres → Napoli → Parma → " +
    "Chelsea → Cagliari. Two of those clubs are the tell.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #retrofootball #careerpath #footballtiktok",

  "ladder-long-grand-tour":
    "Ten career paths, and barely one of them stayed in a single country ✈️\n\n" +
    "Your score out of nine 👇\n\n" +
    // cp-robben, path verbatim.
    "Rung 10 stays blank: Groningen → PSV Eindhoven → Chelsea → Real Madrid " +
    "→ Bayern Munich → Groningen. He finished exactly where he started and " +
    "we're still not typing it.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  // ---- LADDER-LONG batch 2.5 (2026-08-05) — the two WEEKEND-cast editions.
  //
  // Batch 2's caption shape is kept intact, including the order it fought for:
  // SCORE ASK FIRST (typeable by someone who bailed at rung 4), withhold second
  // (only typeable by someone who reached 68s). The campaign paragraph is a
  // THIRD block that sits after both asks and before the verveq.com line — it
  // never displaces a comment ask, because the comment is still what ranks the
  // post and the waitlist click is the thing that happens to people who already
  // stopped scrolling.
  //
  // Unchanged from every other caption in this lane: club paths verbatim from
  // football_career_paths.json, no honours, no counts, no invented facts, and
  // the withheld name appears nowhere — not here, not in the video, not in the
  // filename. Campaign rules on top: launch copy says "late August" and never a
  // date, and no sim-tunable number appears anywhere.
  "ladder-long-five-leagues":
    "Ten career paths. One player from each of the five big leagues — then " +
    "all five over again 🌍\n\n" +
    "What's your score out of nine? Drop the number 👇\n\n" +
    // cp-kvaratskhelia, path verbatim. Name never stated, here or in the video.
    "Then rung 10, the one we never answer: Dinamo Tbilisi → Rustavi → " +
    "Lokomotiv Moscow → Rubin Kazan → Dinamo Batumi → Napoli → Paris " +
    "Saint-Germain. Four clubs you can't place, two you can.\n\n" +
    "Every name on this board is one you could draft this weekend. THE " +
    "WEEKEND — five leagues, one squad, a fresh draft every week and no " +
    "season-long grind. Late August, waitlist open now → link in bio.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #fantasyfootball #footballtiktok" +
    wkndLinks("ladder-long-five-leagues"),

  "ladder-long-one-squad":
    "Ten career paths. Ten players you could actually draft this weekend 📋\n\n" +
    "Score out of nine in the comments — the rail was right there 👇\n\n" +
    // cp-kim-min-jae, path verbatim.
    "And rung 10, which stays blank: Gyeongju KHNP → Jeonbuk Hyundai Motors → " +
    "Beijing Guoan → Fenerbahçe → Napoli → Bayern Munich. Nobody gets from the " +
    "first two to the last two by accident.\n\n" +
    "Draft them for real — THE WEEKEND. Five leagues, one squad, a fresh draft " +
    "every week, and the crowd rates the players instead of an algorithm. Late " +
    "August, waitlist open now → link in bio.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #fantasyfootball #footballtiktok" +
    wkndLinks("ladder-long-one-squad"),

  // ---- LADDER-LONG "THE DUGOUT" (2026-08-11) — first deck cut after the
  // cadence A/B reported. Not a campaign edition, so batch 2's caption law
  // applies unchanged: score ask first, withhold second, daily line, tags.
  // The hook states the deck's premise the way number-ones' did — the card
  // never says it, the caption may: it is the casting claim the Edition
  // verified two sources deep, not a dataset assertion.
  "ladder-long-dugout":
    "Ten career paths. Every one of these men ended up a manager 📋\n\n" +
    "What's your score out of nine? Drop the number 👇\n\n" +
    // cp-fabio-grosso, path verbatim. Name never stated, here or in the video.
    "Rung 10 we're not answering: Renato Curi Angolana → Chieti → Perugia → " +
    "Palermo → Inter Milan → Lyon → Juventus. Two clubs you can't place, then " +
    "a run you definitely can. Still not typing it.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  // ---- LADDER-LONG batch 3 (2026-08-14, LADDER-LONG-B3) — the Aug 15-31
  // slate's eleven editions. Batch 2's caption law unchanged: score ask first,
  // withheld path second (verbatim from football_career_paths.json, name
  // nowhere), daily line, tags. A theme hook may lead the caption where the
  // deck's casting was verified for it (the dugout precedent) — it is a
  // casting claim, never a dataset assertion, and never a fee, count or
  // honour. The two WEEKEND-cast entries carry the campaign block THIRD,
  // after both asks — and THE WEEKEND is LIVE now, so the copy says so
  // (no date, CT-1 stands) and every tagged link lands on /weekend.
  "ladder-long-south-american-kings":
    "Ten career paths. Brazilian and Argentine royalty, all of them made in " +
    "Europe too 👑\n\n" +
    "What's your score out of nine? Drop the number 👇\n\n" +
    // cp-juninho-pernambucano, path verbatim. Name never stated, here or in the video.
    "Then rung 10, which we never answered: Sport Recife → Vasco da Gama → " +
    "Lyon → Al-Gharafa → Vasco da Gama → New York Red Bulls → Vasco da Gama. " +
    "The middle club is the giveaway, if you were watching in the 2000s.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-one-club-almost":
    "Ten men you remember at exactly one club. The cards say otherwise 🧠\n\n" +
    "Score out of nine in the comments — be honest, the rail counted with " +
    "you 👇\n\n" +
    // cp-iago-aspas, path verbatim.
    "Rung 10 stays blank: Celta Vigo → Liverpool → Sevilla → Celta Vigo. He " +
    "went away twice, came home, and never left again. Still not typing " +
    "it.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-bosman-bargains":
    "Ten careers built on free transfers. Not one of these paths needed a " +
    "record fee 🧾\n\n" +
    "What's your score out of nine? Number in the comments 👇\n\n" +
    // cp-cambiasso, path verbatim.
    "Rung 10, the one we kept: Independiente → River Plate → Real Madrid → " +
    "Inter Milan → Leicester City → Olympiacos. Madrid let him walk and " +
    "spent the next decade watching what walked.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-absurd-loop":
    "Ten career paths and every single one is a loop. One of them goes home. " +
    "Twice 🔁\n\n" +
    "Score out of nine first 👇\n\n" +
    // cp-maxi-rodriguez, path verbatim.
    "Then rung 10, the man who couldn't stay away: Newell's Old Boys → " +
    "Espanyol → Atlético Madrid → Liverpool → Newell's Old Boys → Peñarol → " +
    "Newell's Old Boys. Three spells at the same club and we're still not " +
    "naming him.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-cup-final-men":
    "Ten careers. One final each made them 🏆\n\n" +
    "How many of the nine did you get? Drop the number 👇\n\n" +
    // cp-vladimir-smicer, path verbatim.
    "Rung 10 we're not answering: Slavia Prague → Lens → Liverpool → " +
    "Bordeaux → Slavia Prague. If you know what happened in Istanbul, you " +
    "know exactly who this is.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #championsleague #careerpath #footballtiktok",

  "ladder-long-journeymen-deluxe":
    "Ten career paths. Seven clubs each. Nobody stayed anywhere 🧳\n\n" +
    "Your score out of nine 👇\n\n" +
    // cp-leandro-trossard, path verbatim.
    "Rung 10 stays sealed: Genk → Lommel United → Westerlo → Lommel United → " +
    "OH Leuven → Brighton → Arsenal. Five Belgian clubs deep before anyone " +
    "in England had heard the name.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-number-nines":
    "Ten number nines, easy to impossible ⚽\n\n" +
    "Score out of nine in the comments — the rail was right there 👇\n\n" +
    // cp-di-natale, path verbatim.
    "And rung 10, which we never answered: Empoli → Iperzola → Varese → " +
    "Viareggio → Empoli → Udinese. One club at the end is the entire " +
    "career, and the entire clue.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #striker #careerpath #footballtiktok",

  "ladder-long-never-left-england":
    "Ten career paths. Not one club outside England on any card 🏴\n\n" +
    "What's your score out of nine? Drop the number 👇\n\n" +
    // cp-david-seaman, path verbatim.
    "Rung 10, the one we kept: Peterborough United → Birmingham City → " +
    "Queens Park Rangers → Arsenal → Manchester City. The last two clubs " +
    "give it away — the first three are why nobody gets it from the top.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #premierleague #careerpath #footballtiktok",

  "ladder-long-goat-tier":
    "Ten career paths. You know all ten names. Prove it 🐐\n\n" +
    "Score out of nine first — then the one we didn't answer 👇\n\n" +
    // cp-graeme-souness, path verbatim.
    "Rung 10: Tottenham → Montreal Olympique → Middlesbrough → West " +
    "Adelaide → Liverpool → Sampdoria → Rangers. Nobody remembers where it " +
    "started. Everybody knows where it peaked.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #guesstheplayer #footballtiktok",

  "ladder-long-five-leagues-2":
    "Ten career paths. One player from each of the five big leagues — then " +
    "all five over again 🌍\n\n" +
    "What's your score out of nine? Drop the number 👇\n\n" +
    // cp-tanguy-ndombele, path verbatim. Name never stated, here or in the video.
    "Then rung 10, the one we never answer: Amiens → Lyon → Tottenham → " +
    "Lyon → Napoli → Galatasaray → Nice. The London club in the middle is " +
    "the tell — and the reason you'll kick yourself.\n\n" +
    "Every name on this board is one you could draft tonight. THE WEEKEND " +
    "is LIVE — five leagues, one squad, a fresh draft every week, no " +
    "season-long grind. Pick for real → link in bio.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #fantasyfootball #footballtiktok" +
    wkndLinks("ladder-long-five-leagues-2"),

  "ladder-long-differentials":
    "Ten paths your mates can't name. Every one of them is draftable this " +
    "weekend 📋\n\n" +
    "Score out of nine in the comments — be honest 👇\n\n" +
    // cp-antoine-semenyo, path verbatim.
    "Rung 10 stays blank: Highworth Town → Bristol City → Bath City → " +
    "Newport County → Sunderland → Bournemouth → Manchester City. From " +
    "step one to step seven is the whole point of this game.\n\n" +
    "Draft them for real — THE WEEKEND is LIVE. Five leagues, one squad, a " +
    "fresh draft every week. Pick before kickoff → link in bio.\n\n" +
    "New gauntlet daily. Career Path mode — free, no sign-up: verveq.com\n\n" +
    "#football #footballquiz #careerpath #fantasyfootball #footballtiktok" +
    wkndLinks("ladder-long-differentials"),

  // ---- CHAIN-LONG batch 1 (2026-08-10) — the experiment lane's first format.
  //
  // Caption shape is batch 2's law with the relay's own asks: SCORE ASK FIRST
  // (a number is typeable by someone who bailed at slot 4), then the TWO
  // withholds this format runs — the omission and slot 10 — pointed at by
  // name-of-slot, never by name-of-player. The omission is never identified
  // here in any form (withhold discipline, CHAIN-LONG-B1: not in VO, captions,
  // cards, or files), and unlike ladder-long there is NO path printed — a path
  // is a fingerprint, and the caption that prints one has named him.
  //
  // Facts law unchanged: nothing asserted the dataset does not carry. "Every
  // one of them played for both" is the dataset's own claim about the nine
  // names on screen; no counts, no honours, no "only man to". Standard links,
  // NOT campaign — a first read of a new format carries zero extra variables,
  // and the campaign field stays available for a WEEKEND-cast edition later.
  "chain-long-liverpool-city":
    "Liverpool AND Manchester City. Nine names on the board — every one of " +
    "them played for both 🔗\n\n" +
    "How many of the nine did you actually know? Drop the number 👇\n\n" +
    "Slot 10 is empty on purpose. And the obvious one? We left him out. You " +
    "already know who it is, and it's killing you.\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "So: who did we leave out — and who's your slot 10? 👇\n\n" +
    "#football #footballquiz #liverpool #mancity #footballtiktok",

  "chain-long-chelsea-marseille":
    "Chelsea AND Marseille. Nine names, one chain — every one of them played " +
    "for both 🔗\n\n" +
    "Your score out of nine in the comments — be honest, the rail counted " +
    "with you 👇\n\n" +
    "Slot 10 stays empty. And yes, we left out the obvious one. On purpose. " +
    "Saying it first is the whole game.\n\n" +
    "Career Path mode — free, no sign-up: verveq.com\n\n" +
    "Who's the one we left out — and who's your slot 10? 👇\n\n" +
    "#football #footballquiz #chelsea #marseille #footballtiktok",
};

export const buildPromoCaption = (name) => PROMO_CAPTIONS[name] ?? "";
