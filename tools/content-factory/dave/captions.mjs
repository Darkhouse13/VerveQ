// Ready-to-paste post captions for the Dave films — one per film, written as
// dave-<name>.txt next to each MP4 (same workflow as promo/captions.mjs).
//
// These have one job the promo captions don't: **cast the viewer's mate as
// Dave.** The films work as comedy on their own, but the share only happens if
// someone recognises a specific person in their life and sends it to them. So
// every caption ends on a tag prompt aimed at a person, not at an opinion —
// "tag the Dave in your group chat" is a much easier action than "what do you
// think?", and a tag is worth more than a comment to the algorithm because it
// drags a new viewer in with it.
//
// Nothing here spoils the film's own punchline, and none of it claims Dave is
// real. English only — same reason as everywhere else.
//
// Since batch 2 each film ends on a played quiz round, which hands the caption
// a second, even easier action than the tag: say what YOU answered. An answer
// is the cheapest comment there is, comments feed distribution, and every
// wrong one under a video about being wrong is content.
export const DAVE_CAPTIONS = {
  polygraph:
    "We hooked a football fan up to a lie detector and asked him one question. " +
    "🚨 The machine has never been more certain. His retest is at the end — " +
    "drop your answer before the reveal, and tag someone who would FAIL 👇 " +
    "Free at verveq.com" +
    "\n\n#football #footballquiz #footballtrivia #liedetector #footballtiktok",

  "support-group":
    "Football Opinions Anonymous, Tuesday nights, church hall. 🎙️ \"My name's " +
    "Dave. And he's not even top 10 all time.\" Nobody clapped. Step 1 is at " +
    "the end — did you pass it? Settle it properly, free at verveq.com. Tag " +
    "the Dave in your group chat 👇" +
    "\n\n#football #footballbanter #footballquiz #hottake #footballtiktok",

  nature:
    "Rare footage of the common football man asserting dominance in his natural " +
    "habitat. 🔍 He has no evidence. He has never needed any. The specimen " +
    "attempts one real question at the end — beat him in the comments and tag " +
    "the one you know 👇 Free at verveq.com" +
    "\n\n#football #footballbanter #naturedocumentary #footballtiktok #groupchat",

  warning:
    "A public information film they should have made in 1978. 📽️ Football " +
    "ignorance affects thousands of men every year. It can happen to anyone. " +
    "The screening test is at the end — post your answer. Get tested free at " +
    "verveq.com — tag a man at risk 👇" +
    "\n\n#football #footballquiz #publicinformationfilm #retro #footballtiktok",
};

export const buildDaveCaption = (name) => DAVE_CAPTIONS[name] ?? "";
