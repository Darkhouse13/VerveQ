// The approved mockup design system (owner sign-off 2026-11-04).
// Colors come from docs/BRAND.md; spacing, sizes and radii from the v2 design pass.

export const color = {
  ink: "#121212",
  surface: "#1F1F1F",
  surfaceLow: "#181818",
  surfaceHigh: "#2A2A2A",
  line: "#2E2E2E",
  lineSoft: "#2A2A2A",
  navBg: "#161616",
  navLine: "#242424",
  cream: "#FFF7F0",
  muted: "#C4B8AD",
  dim: "#8F857C",
  lime: "#C6FF1A",
  blue: "#0084FF",
  pink: "#FF3DC5",
  orange: "#FF6A00",
  yellow: "#FFCD1A",
  right: "#00D170",
  wrong: "#FF3633",
  rightBg: "#14241B",
  wrongBg: "#2A1615",
} as const;

// Only these values are allowed for padding, margin and gap.
export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  gutter: 20,
  xl: 24,
  xxl: 32,
  x3: 40,
  x4: 48,
} as const;

export const radius = {
  chip: 8,
  tile: 12,
  input: 16,
  card: 20,
  hero: 24,
  pill: 999,
} as const;

export const font = {
  bold: "SpaceGrotesk_700Bold",
  medium: "SpaceGrotesk_500Medium",
  mono: "JetBrainsMono_700Bold",
} as const;

export const size = {
  h1Tab: 32,
  h1Game: 28,
  cardTitle: 20,
  rowTitle: 17,
  body: 15,
  caption: 13,
  micro: 12,
  eyebrow: 11,
  buttonPrimary: 56,
  buttonSecondary: 48,
  pill: 36,
  iconButton: 48,
  listRow: 64,
  input: 56,
  navBar: 80,
} as const;

export const modeAccent = {
  whosOlder: color.blue,
  missingLetters: color.pink,
  dailyQuiz: color.yellow,
  dailySurvival: color.orange,
} as const;
