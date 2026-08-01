// On-screen copy pools — distinct from captions.mjs (which writes the post
// text). Every line here is spoiler-free and brand-safe; the variant picks one
// per slot so two videos rarely say the same thing on screen. English only —
// same rule as the caption pools and the same reason (broadest audience).
export const COPY = {
  // sits under the "N CLUBS. 1 PLAYER." heading
  subhead: [
    "Name him before the reveal.",
    "Guess the player.",
    "One player. Every club.",
    "Can you name him?",
    "Beat the countdown.",
  ],
  // the big prompt over the 3-2-1 countdown
  countdown: [
    "WHO IS HE?",
    "NAME HIM",
    "GUESS THE PLAYER",
    "WHO AM I?",
    "NAME THE PLAYER",
  ],
  // The comment-bait pill under the countdown. Every line must name what the
  // viewer is being asked FOR — a name, a club number, a guess. "COMMENT
  // BELOW" was in this pool and it asked for nothing, so it collected nothing;
  // the ask has to be a specific, cheap, typeable thing.
  comment: [
    "COMMENT HIS NAME",
    "DROP YOUR GUESS",
    "NAME HIM BELOW",
    "GUESS IN THE COMMENTS",
    "WHICH CLUB GAVE IT AWAY?",
  ],
  // the little label above the revealed name
  revealLabel: ["THE ANSWER", "IT'S…", "THE PLAYER IS", "REVEALED"],
  // the tagline on the VERVEQ end card
  cta: [
    "A new football challenge every day.",
    "Football quizzes, every single day.",
    "Test your football brain daily.",
    "A new football puzzle every day.",
  ],
} as const;
