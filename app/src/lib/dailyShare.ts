/**
 * Pure helpers behind the daily games' share and follow pieces
 * (components/shell/play/whosOlder/DailyShare.tsx, docs/RETURN_LOOP.md).
 */
import type { DailyGame } from "@/components/shell/play/whosOlder/WhosOlderRetention";

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

// ── Story image ────────────────────────────────────────────────────────────

/** Mirrors the stage tokens in src/index.css (.theme-older / .theme-letters). */
const STORY_PALETTE = {
  older: { ground: "#121212", card: "#0080ff", offset: "#ff3dc8", accent: "#c6ff1a", good: "#1fa463", bad: "#e5383b", ink: "#fff8f0" },
  letters: { ground: "#121212", card: "#3070b8", offset: "#c23f93", accent: "#a9cf3f", good: "#318c5f", bad: "#d4443d", ink: "#fff8f0" },
} as const;

type StoryInput = {
  game: DailyGame;
  title: string;
  edition: number;
  score: number;
  total: number;
  history: Array<{ correct: boolean }>;
  standing: string | null;
  cta: string;
};

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
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Brand line + game title
  ctx.fillStyle = p.accent;
  ctx.font = `700 40px ${MONO}`;
  ctx.fillText("VERVEQ", W / 2, TOP + 60);
  ctx.fillStyle = p.ink;
  fitFont(ctx, input.title.toUpperCase(), 700, 110, HEAD, W - SIDE * 2);
  ctx.fillText(input.title.toUpperCase(), W / 2, TOP + 190);
  ctx.font = `700 52px ${MONO}`;
  ctx.fillText(`#${input.edition}`, W / 2, TOP + 270);

  // Score card: blue over a pink offset, ink border — the reel's card.
  const cx = SIDE + 60, cy = TOP + 340, cw = W - (SIDE + 60) * 2, ch = 420, r = 28;
  ctx.fillStyle = p.offset;
  roundRect(ctx, cx + 18, cy + 18, cw, ch, r);
  ctx.fill();
  ctx.fillStyle = p.card;
  roundRect(ctx, cx, cy, cw, ch, r);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#111111";
  ctx.stroke();
  const scoreText = String(input.score);
  ctx.font = `700 260px ${HEAD}`;
  const scoreW = ctx.measureText(scoreText).width;
  ctx.font = `700 120px ${HEAD}`;
  const totalText = `/${input.total}`;
  const totalW = ctx.measureText(totalText).width;
  const startX = W / 2 - (scoreW + totalW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "#111111";
  ctx.font = `700 260px ${HEAD}`;
  ctx.fillText(scoreText, startX + 8, cy + 300 + 8);
  ctx.fillStyle = p.ink;
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
    ctx.fillStyle = h.correct ? p.good : p.bad;
    roundRect(ctx, gx, gy, sq, sq, 12);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
    gx += sq + gap;
  });

  // Standing pill
  let y = gy + sq + 110;
  if (input.standing) {
    ctx.font = `700 46px ${HEAD}`;
    const tw = Math.min(ctx.measureText(input.standing).width, W - SIDE * 2 - 80);
    const pw = tw + 80, ph = 92;
    ctx.fillStyle = p.accent;
    roundRect(ctx, W / 2 - pw / 2, y - 64, pw, ph, ph / 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#111111";
    ctx.stroke();
    ctx.fillStyle = "#111111";
    fitFont(ctx, input.standing, 700, 46, HEAD, W - SIDE * 2 - 80);
    ctx.fillText(input.standing, W / 2, y);
    y += 140;
  }

  // CTA + link, kept above the bottom safe strip.
  const footY = Math.min(Math.max(y + 60, H - BOTTOM - 130), H - BOTTOM - 70);
  ctx.fillStyle = p.ink;
  fitFont(ctx, input.cta, 700, 64, HEAD, W - SIDE * 2);
  ctx.fillText(input.cta, W / 2, footY);
  ctx.fillStyle = p.accent;
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
