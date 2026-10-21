/**
 * Pure helpers behind the daily games' share and follow pieces
 * (components/shell/play/whosOlder/DailyShare.tsx, docs/RETURN_LOOP.md).
 */
import type { DailyGame } from "@/components/shell/play/whosOlder/WhosOlderRetention";
import brandGeometry from "@/components/ui/brandMark.geometry.json";
import { brandColor } from "@/lib/brandTokens";

export const INSTAGRAM_HANDLE = "playverveq";
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const SHARE_UI = {
  older: { ns: "whosOlder", tid: "whos-older", prefix: "whos_older", theme: "theme-older", path: "verveq.com/older" },
  letters: { ns: "missingLetters", tid: "missing-letters", prefix: "missing_letters", theme: "theme-letters", path: "verveq.com/letters" },
} as const;

/** The ramp both games share: three easy, three close, three tight, then one. */
const TIER_BREAKS = [3, 6, 9];

/** 🟩🟩🟩 🟩🟥🟩 🟥🟩🟥 🟩 — the result grid, grouped by difficulty tier. */
export function tierGrid(history: Array<{ correct: boolean }>): string {
  return history
    .map((r, i) => (TIER_BREAKS.includes(i) ? " " : "") + (r.correct ? "🟩" : "🟥"))
    .join("");
}

/** Opened inside Instagram's in-app browser, or arrived from Instagram. */
export function isInstagramVisitor(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram/i.test(navigator.userAgent) || /instagram\.com/i.test(document.referrer);
}

// ── Standing ───────────────────────────────────────────────────────────────

/** Below this many finishers "better than N%" is noise. */
export const MIN_FINISHERS_FOR_STANDING = 5;
/**
 * Owner decision 7 (VerveQ ONE): "Better than X% of today's players" is shown
 * only when it flatters — X ≥ 50. Below that the streak takes its place, on
 * the result screen and on the story image alike.
 */
export const MIN_STANDING_PCT = 50;

/** The percentage to show, or null when the standing line stays hidden. */
export function visibleStandingPct(standing: { below: number; finishers: number } | null | undefined): number | null {
  if (!standing || standing.finishers < MIN_FINISHERS_FOR_STANDING) return null;
  const pct = Math.round((standing.below / standing.finishers) * 100);
  return pct >= MIN_STANDING_PCT ? pct : null;
}

// ── Story image ────────────────────────────────────────────────────────────

/**
 * The story's colors are the brand tokens (lib/brandTokens.ts mirrors
 * src/index.css): ink ground, cream type, lime brand line and link, the
 * game's mode accent as the score card over the other game's as its offset.
 */
const STORY_PALETTE = {
  older: { card: brandColor("blue"), offset: brandColor("pink") },
  letters: { card: brandColor("pink"), offset: brandColor("blue") },
} as const;
const INK = brandColor("ink");
const CREAM = brandColor("cream");
const LIME = brandColor("lime");

export type StoryInput = {
  game: DailyGame;
  title: string;
  edition: number;
  score: number;
  total: number;
  history: Array<{ correct: boolean }>;
  /** Today's standing; drawn only when `pct` clears MIN_STANDING_PCT. */
  standing: { pct: number; text: string } | null;
  /** The daily streak; drawn in the standing's place when that is hidden. */
  streak: { days: number; text: string } | null;
  cta: string;
};

/** The one status pill the story carries: standing at ≥ 50%, else the streak. */
export function storyStatus(input: Pick<StoryInput, "standing" | "streak">): string | null {
  if (input.standing && input.standing.pct >= MIN_STANDING_PCT) return input.standing.text;
  if (input.streak && input.streak.days > 0) return input.streak.text;
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Shrinks the font until `text` fits `maxWidth`. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 20 && ctx.measureText(text).width > maxWidth) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
}

/**
 * The VerveQ lockup — the tilted VQ mark and the tracked VERVEQ wordmark —
 * drawn from the brand's glyph outlines (components/ui/brandMark.geometry.json),
 * so it is the real wordmark whether or not a webfont loaded. Centered on
 * `cx`, cap height `cap` px, baseline at `y`.
 */
function drawLockup(ctx: CanvasRenderingContext2D, cx: number, y: number, cap: number) {
  const { mark, wordmark } = brandGeometry;
  const unit = cap / wordmark.capHeight;
  const step = (wordmark.advance + wordmark.tracking) * unit;
  const wordW = wordmark.text.length * step - wordmark.tracking * unit;
  const markPx = cap * 1.9;
  const gap = cap * 0.55;
  const left = cx - (markPx + gap + wordW) / 2;

  if (typeof Path2D === "undefined") {
    ctx.fillStyle = LIME;
    ctx.font = `700 ${Math.round(cap * 1.35)}px 'JetBrains Mono', monospace`;
    ctx.fillText(wordmark.text, cx, y);
    return;
  }

  // Mark: ink square tilted -4°, a faint cream rim so it reads on the ink
  // ground, lime "VQ".
  const s = markPx / mark.viewBox;
  ctx.save();
  ctx.translate(left + markPx / 2, y - cap / 2);
  ctx.rotate((mark.tilt * Math.PI) / 180);
  ctx.translate(-markPx / 2, -markPx / 2);
  ctx.scale(s, s);
  const inset = (mark.viewBox - mark.square.size) / 2;
  roundRect(ctx, inset, inset, mark.square.size, mark.square.size, mark.square.radius);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CREAM;
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.translate(mark.letters.x, mark.letters.baseline);
  ctx.scale(mark.letters.scale, mark.letters.scale);
  ctx.fillStyle = LIME;
  for (const glyph of mark.letters.glyphs) {
    ctx.save();
    ctx.translate(glyph.x, 0);
    ctx.fill(new Path2D(glyph.d));
    ctx.restore();
  }
  ctx.restore();

  // Wordmark, in cream like the app's header eyebrow.
  const glyphs = wordmark.glyphs as Record<string, string>;
  ctx.save();
  ctx.translate(left + markPx + gap, y);
  ctx.scale(unit, unit);
  ctx.fillStyle = CREAM;
  [...wordmark.text].forEach((ch, i) => {
    ctx.save();
    ctx.translate(i * (wordmark.advance + wordmark.tracking), 0);
    ctx.fill(new Path2D(glyphs[ch]));
    ctx.restore();
  });
  ctx.restore();
}

/**
 * 1080×1920, everything inside the reels' safe zone (top 220 / bottom 320 /
 * sides 60) so Instagram's story chrome never covers the score.
 */
export async function renderStoryImage(input: StoryInput): Promise<Blob> {
  const W = 1080, H = 1920, SIDE = 60, TOP = 220, BOTTOM = 320;
  const p = STORY_PALETTE[input.game];
  const HEAD = "'Space Grotesk', sans-serif";
  const MONO = "'JetBrains Mono', monospace";
  try {
    await Promise.all([document.fonts.load(`700 100px ${HEAD}`), document.fonts.load(`700 40px ${MONO}`)]);
  } catch {
    // A missing webfont falls back to the stack; the image still renders.
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Brand lockup + game title
  drawLockup(ctx, W / 2, TOP + 50, 40);
  ctx.fillStyle = CREAM;
  fitFont(ctx, input.title.toUpperCase(), 700, 110, HEAD, W - SIDE * 2);
  ctx.fillText(input.title.toUpperCase(), W / 2, TOP + 190);
  ctx.font = `700 52px ${MONO}`;
  ctx.fillText(`#${input.edition}`, W / 2, TOP + 270);

  // Score card: the mode's color over the other game's offset, ink border —
  // the reel's card, its cream score dropping an ink shadow.
  const cx = SIDE + 60, cy = TOP + 340, cw = W - (SIDE + 60) * 2, ch = 420, r = 28;
  ctx.fillStyle = p.offset;
  roundRect(ctx, cx + 18, cy + 18, cw, ch, r);
  ctx.fill();
  ctx.fillStyle = p.card;
  roundRect(ctx, cx, cy, cw, ch, r);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const scoreText = String(input.score);
  ctx.font = `700 260px ${HEAD}`;
  const scoreW = ctx.measureText(scoreText).width;
  ctx.font = `700 120px ${HEAD}`;
  const totalText = `/${input.total}`;
  const totalW = ctx.measureText(totalText).width;
  const startX = W / 2 - (scoreW + totalW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `700 260px ${HEAD}`;
  ctx.fillText(scoreText, startX + 8, cy + 300 + 8);
  ctx.fillStyle = CREAM;
  ctx.fillText(scoreText, startX, cy + 300);
  ctx.globalAlpha = 0.85;
  ctx.font = `700 120px ${HEAD}`;
  ctx.fillText(totalText, startX + scoreW, cy + 300);
  ctx.globalAlpha = 1;
  ctx.textAlign = "center";

  // The grid, grouped by tier.
  const n = input.history.length;
  const groups = n > 0 ? TIER_BREAKS.filter((b) => b < n).length : 0;
  const sq = 64, gap = 14, groupGap = 40;
  const gridW = n * sq + (n - 1 - groups) * gap + groups * groupGap;
  let gx = W / 2 - gridW / 2;
  const gy = cy + ch + 90;
  input.history.forEach((h, i) => {
    if (TIER_BREAKS.includes(i)) gx += groupGap - gap;
    ctx.fillStyle = h.correct ? brandColor("right") : brandColor("wrong");
    roundRect(ctx, gx, gy, sq, sq, 12);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    gx += sq + gap;
  });

  // Status pill: the standing when it flatters, else the streak (decision 7).
  let y = gy + sq + 110;
  const status = storyStatus(input);
  if (status) {
    ctx.font = `700 46px ${HEAD}`;
    const tw = Math.min(ctx.measureText(status).width, W - SIDE * 2 - 80);
    const pw = tw + 80, ph = 92;
    ctx.fillStyle = CREAM;
    roundRect(ctx, W / 2 - pw / 2, y - 64, pw, ph, ph / 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = INK;
    fitFont(ctx, status, 700, 46, HEAD, W - SIDE * 2 - 80);
    ctx.fillText(status, W / 2, y);
    y += 140;
  }

  // CTA + link, kept above the bottom safe strip.
  const footY = Math.min(Math.max(y + 60, H - BOTTOM - 130), H - BOTTOM - 70);
  ctx.fillStyle = CREAM;
  fitFont(ctx, input.cta, 700, 64, HEAD, W - SIDE * 2);
  ctx.fillText(input.cta, W / 2, footY);
  ctx.fillStyle = LIME;
  ctx.font = `700 48px ${MONO}`;
  ctx.fillText(SHARE_UI[input.game].path, W / 2, footY + 80);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
  );
}

/**
 * Inside Instagram's in-app browser itself (user agent only). The streak-link
 * offer shows only here: this is the browser a player leaves, and their streak
 * stays behind unless they carry it out.
 */
export function isInstagramInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Instagram/i.test(navigator.userAgent);
}

/** The link that carries a streak to another browser (docs/RETURN_LOOP.md part C). */
export function streakLinkUrl(base: string, game: DailyGame, token: string): string {
  const path = game === "letters" ? "letters" : "older";
  return `${base}/${path}?st=${token}&ref=streak_link`;
}
