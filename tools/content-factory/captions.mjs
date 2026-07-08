// Caption generator — one ready-to-paste caption per video, written next to
// each MP4 as <id>.txt. Rules: NEVER include the answer name (spoiler), always
// include a comment-bait line (comments are the ranking signal this format
// lives on), rotate hooks/tags so a daily feed doesn't read copy-pasted.
const HOOKS = {
  easy: [
    "Everyone knows this one… right? 👀",
    "If you need all {n} clubs for this, we can't be friends 😅",
    "Warm-up round. Prove it.",
    "99% of fans get this before club 3.",
    "This one's free. Don't mess it up.",
  ],
  medium: [
    "Real fans get it before club 4 👀",
    "Casuals need all {n} clubs for this one.",
    "Your dad gets this one faster than you.",
    "Get it before the reveal or you're a casual.",
    "{n} clubs. One player. Clock's ticking.",
  ],
  hard: [
    "Only 1% get this before the reveal 🧠",
    "If you get this one, you're certified elite.",
    "Nobody gets this without cheating. Prove me wrong.",
    "Football encyclopedias only 📚",
    "{n} clubs and you'll still need the reveal 😏",
  ],
};

const ENGAGE = [
  "Drop your answer in the comments — no cheating ⏱️",
  "Answer in the comments before the countdown ends.",
  "Comment the club number where you got it 👇",
  "Tag a mate who gets it faster than you.",
  "How many clubs did you need? Comments 👇",
];

const TAG_SETS = [
  "#football #footballquiz #guesstheplayer #careerpath",
  "#football #footballtiktok #guesstheplayer #quiz",
  "#football #soccer #footballquiz #guesstheplayer",
  "#football #footballtrivia #guesstheplayer #careerpath",
  "#football #footballquiz #guesstheplayer #footballtiktok",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const buildCaption = (entry) => {
  const hook = pick(HOOKS[entry.difficulty] ?? HOOKS.medium).replaceAll(
    "{n}",
    String(entry.clubs.length),
  );
  return `${hook} ${pick(ENGAGE)}\n\n${pick(TAG_SETS)}`;
};
