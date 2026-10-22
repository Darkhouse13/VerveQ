/**
 * The VerveQ lockup — the tilted VQ mark and the tracked VERVEQ wordmark — for
 * canvas painters (the daily story image, the WEEKEND receipt).
 *
 * Drawn from the brand's glyph outlines (components/ui/brandMark.geometry.json,
 * the geometry <BrandMark /> renders), so it is the real wordmark whether or
 * not a webfont loaded. Colors come from lib/brandTokens.ts.
 */
import brandGeometry from "@/components/ui/brandMark.geometry.json";
import { brandColor } from "@/lib/brandTokens";

const { mark, wordmark } = brandGeometry;

/** The mark is this many cap heights tall; the gap to the wordmark is GAP caps. */
const MARK_CAPS = 1.9;
const GAP_CAPS = 0.55;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Total width of the lockup at wordmark cap height `cap` px. */
export function brandLockupWidth(cap: number): number {
  const unit = cap / wordmark.capHeight;
  const wordW = (wordmark.text.length * (wordmark.advance + wordmark.tracking) - wordmark.tracking) * unit;
  return cap * MARK_CAPS + cap * GAP_CAPS + wordW;
}

/**
 * Paint the lockup with the wordmark's baseline at `y` and cap height `cap`
 * px. `align: "center"` centers the whole lockup on `x`; "left" starts it there.
 */
export function drawBrandLockup(
  ctx: CanvasRenderingContext2D,
  { x, y, cap, align = "left" }: { x: number; y: number; cap: number; align?: "left" | "center" },
): void {
  const ink = brandColor("ink");
  const cream = brandColor("cream");
  const lime = brandColor("lime");
  const unit = cap / wordmark.capHeight;
  const markPx = cap * MARK_CAPS;
  const left = align === "center" ? x - brandLockupWidth(cap) / 2 : x;

  if (typeof Path2D === "undefined") {
    // No outline support: the wordmark as text is still the brand.
    ctx.save();
    ctx.fillStyle = lime;
    ctx.textAlign = align;
    ctx.font = `700 ${Math.round(cap * 1.35)}px 'JetBrains Mono', monospace`;
    ctx.fillText(wordmark.text, x, y);
    ctx.restore();
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
  roundRectPath(ctx, inset, inset, mark.square.size, mark.square.size, mark.square.radius);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = cream;
  ctx.globalAlpha = 0.25;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.translate(mark.letters.x, mark.letters.baseline);
  ctx.scale(mark.letters.scale, mark.letters.scale);
  ctx.fillStyle = lime;
  for (const glyph of mark.letters.glyphs) {
    ctx.save();
    ctx.translate(glyph.x, 0);
    ctx.fill(new Path2D(glyph.d));
    ctx.restore();
  }
  ctx.restore();

  // Wordmark, in cream like the app's header.
  const glyphs = wordmark.glyphs as Record<string, string>;
  ctx.save();
  ctx.translate(left + markPx + cap * GAP_CAPS, y);
  ctx.scale(unit, unit);
  ctx.fillStyle = cream;
  [...wordmark.text].forEach((ch, i) => {
    ctx.save();
    ctx.translate(i * (wordmark.advance + wordmark.tracking), 0);
    ctx.fill(new Path2D(glyphs[ch]));
    ctx.restore();
  });
  ctx.restore();
}
