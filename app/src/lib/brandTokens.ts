/**
 * The VerveQ ONE brand colors as HSL triples, for surfaces CSS can't reach —
 * the 1080×1920 story PNG (lib/dailyShare.ts) and the WEEKEND receipt PNG
 * (lib/receiptImage.ts), both painted on a canvas.
 *
 * The source of truth is `src/index.css` (`:root`); `brandTokens.test.ts`
 * reads that file and fails when a value here drifts from it.
 */
export type Hsl = readonly [h: number, s: number, l: number];

export const BRAND_HSL = {
  ink: [0, 0, 7],
  cream: [30, 100, 97],
  lime: [75, 100, 55],
  /** `--electric-blue`: Who's Older's mode accent. */
  blue: [209, 100, 50],
  /** `--hot-pink`: Missing Letters' mode accent. */
  pink: [318, 100, 62],
  /** `--right` / `--wrong`: answer feedback only. */
  right: [152, 100, 41],
  wrong: [1, 100, 60],
  /** `--card` on the ink ground: a raised panel. */
  card: [0, 0, 12],
  /** `--muted-foreground` on the ink ground: secondary text. */
  mutedText: [30, 20, 72],
  /** `--neo-shadow-color` on the ink ground: the hard offset shadow. */
  shadow: [0, 0, 0],
} as const satisfies Record<string, Hsl>;

export type BrandColor = keyof typeof BRAND_HSL;

/** A canvas/CSS color string for a brand token (legacy comma syntax: every canvas parses it). */
export function brandColor(name: BrandColor): string {
  const [h, s, l] = BRAND_HSL[name];
  return `hsl(${h}, ${s}%, ${l}%)`;
}
