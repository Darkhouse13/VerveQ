// VerveQ brand tokens, mirrored from app/src/index.css (:root) and
// app/tailwind.config.ts. Videos must read as the same product as the app:
// cream ground, near-black ink, hard offset shadows, no gradients.
export const COLORS = {
  cream: "hsl(30 100% 97%)",
  card: "hsl(30 100% 99%)",
  ink: "hsl(0 0% 7%)",
  orange: "hsl(25 100% 50%)",
  lime: "hsl(75 100% 55%)",
  yellow: "hsl(47 100% 55%)",
  pink: "hsl(318 100% 62%)",
  blue: "hsl(209 100% 50%)",
  red: "hsl(1 100% 60%)",
  green: "hsl(152 100% 41%)",
  white: "hsl(0 0% 100%)",
} as const;

export const DIFFICULTY_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  easy: { bg: COLORS.green, fg: COLORS.white, label: "EASY" },
  medium: { bg: COLORS.yellow, fg: COLORS.ink, label: "MEDIUM" },
  hard: { bg: COLORS.red, fg: COLORS.white, label: "HARD" },
};

// The app's neo-brutalist shadow is 4px/4px at UI scale; video runs at ~3x
// the density of a phone UI, so shadows scale up with it.
export const neoShadow = (px: number) => `${px}px ${px}px 0 ${COLORS.ink}`;
