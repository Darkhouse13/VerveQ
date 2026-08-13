/**
 * FW-RECEIPT — the receipt as pixels.
 *
 * Paints the settlement receipt onto a 1080×1920 canvas (9:16, group-chat
 * native) so "share" can hand over an actual image file and "download" can
 * save one, with no DOM-rasterising dependency. The palette is the WEEKEND
 * theme's, stated literally: near-black ground, cream ink, lime accent —
 * the same numbers `.theme-weekend` derives from (index.css).
 *
 * Honesty rule: every string painted here comes from the receipt payload —
 * the same numbers the on-screen card shows. No club crests, no likenesses:
 * type and geometry only.
 */
import { formatPoints } from "../../convex/lib/fantasyScoring";
import type { SquadReceipt } from "../../convex/fantasyReceipts";

const W = 1080;
const H = 1920;

// .theme-weekend, resolved (index.css): hsl(0 0% 5%), hsl(30 100% 97%),
// hsl(74 100% 50%), border hsl(30 40% 90%).
const BG = "#0d0d0d";
const INK = "#fff8f0";
const LIME = "#c6ff00";
const MUTED = "#a89f94";
const CARD = "#161616";

const HEADING = "'Space Grotesk', sans-serif";
const MONO = "'JetBrains Mono', monospace";

function signed(points: number): string {
  return points >= 0 ? `+${formatPoints(points)}` : formatPoints(points);
}

/** A Neo panel: hard border, hard offset shadow, no blur. */
function panel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
): void {
  ctx.fillStyle = "#000000";
  ctx.fillRect(x + 10, y + 10, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
}

export function receiptFilename(receipt: SquadReceipt): string {
  return `verveq-gw${receipt.gwNumber}-receipt.png`;
}

/**
 * Render the receipt. Waits for the app's fonts so the card matches the
 * product; falls back to the generic families if they never load.
 */
export async function paintReceipt(receipt: SquadReceipt): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    /* generic families still paint */
  }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (ctx === null) throw new Error("no 2d context");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const M = 72; // outer margin
  let y = 100;

  // Eyebrow + title
  ctx.fillStyle = LIME;
  ctx.font = `bold 34px ${MONO}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("THE WEEKEND — SETTLED", M, y);
  y += 70;
  ctx.fillStyle = INK;
  ctx.font = `bold 80px ${HEADING}`;
  ctx.fillText(`Gameweek ${receipt.gwNumber} receipt`, M, y);
  y += 40;
  ctx.fillStyle = MUTED;
  ctx.font = `28px ${MONO}`;
  ctx.fillText(
    `${receipt.season} · settled ${new Date(receipt.settledAt).toLocaleDateString()}`,
    M,
    y,
  );
  y += 36;

  // The total
  panel(ctx, M, y, W - 2 * M, 210, CARD);
  ctx.fillStyle = LIME;
  ctx.font = `bold 150px ${MONO}`;
  const totalText = formatPoints(receipt.total);
  const totalWidth = ctx.measureText(totalText).width;
  ctx.fillText(totalText, M + 44, y + 158);
  ctx.fillStyle = MUTED;
  ctx.font = `bold 34px ${MONO}`;
  ctx.fillText("PTS FINAL", M + 44 + totalWidth + 28, y + 158);
  y += 210 + 40;

  // The 13
  const filled = receipt.slots.filter((slot) => slot.playerId !== null);
  const rowH = 56;
  const listH = filled.length * rowH + 32;
  panel(ctx, M, y, W - 2 * M, listH, CARD);
  let rowY = y + 58;
  for (const slot of filled) {
    ctx.fillStyle = MUTED;
    ctx.font = `bold 26px ${MONO}`;
    ctx.fillText(`${slot.slotRole}${slot.isFinisher ? "·F" : ""}`, M + 40, rowY);
    ctx.fillStyle = INK;
    ctx.font = `bold 34px ${HEADING}`;
    const name =
      (slot.playerName ?? "—").length > 26
        ? `${(slot.playerName ?? "—").slice(0, 25)}…`
        : (slot.playerName ?? "—");
    ctx.fillText(name, M + 170, rowY);
    ctx.font = `bold 34px ${MONO}`;
    ctx.textAlign = "right";
    if (slot.points === null) {
      ctx.fillStyle = MUTED;
      ctx.fillText("awaiting", W - M - 40, rowY);
    } else {
      ctx.fillStyle = slot.points >= 0 ? INK : "#ff6b6b";
      ctx.fillText(formatPoints(slot.points), W - M - 40, rowY);
    }
    ctx.textAlign = "left";
    rowY += rowH;
  }
  y += listH + 40;

  // Superlatives — factual, never advice.
  if (receipt.best !== null && receipt.worst !== null) {
    panel(ctx, M, y, W - 2 * M, 150, CARD);
    ctx.font = `bold 30px ${MONO}`;
    ctx.fillStyle = LIME;
    ctx.fillText("BEST CALL", M + 40, y + 58);
    ctx.fillStyle = INK;
    ctx.font = `bold 34px ${HEADING}`;
    ctx.fillText(
      `${receipt.best.playerName} ${signed(receipt.best.points)}`,
      M + 260,
      y + 58,
    );
    ctx.fillStyle = MUTED;
    ctx.font = `bold 30px ${MONO}`;
    ctx.fillText("WORST CALL", M + 40, y + 112);
    ctx.fillStyle = INK;
    ctx.font = `bold 34px ${HEADING}`;
    ctx.fillText(
      `${receipt.worst.playerName} ${signed(receipt.worst.points)}`,
      M + 260,
      y + 112,
    );
    y += 150 + 40;
  }

  // One crowd-verdict line, if the crowd moved anything.
  if (receipt.crowdMoved.length > 0) {
    const strongest = [...receipt.crowdMoved].sort(
      (a, b) => Math.abs(b.crowdFactor) - Math.abs(a.crowdFactor),
    )[0];
    const pct = Math.round(strongest.crowdFactor * 100);
    ctx.fillStyle = MUTED;
    ctx.font = `28px ${MONO}`;
    ctx.fillText(
      receipt.crowdMoved.length === 1
        ? `The crowd's verdict moved ${strongest.playerName} ${pct >= 0 ? "+" : ""}${pct}%`
        : `The crowd's verdict moved ${receipt.crowdMoved.length} of your 13 — biggest: ${strongest.playerName} ${pct >= 0 ? "+" : ""}${pct}%`,
      M,
      y + 8,
    );
    y += 56;
  }

  // The stamped standing: percentile (budget) or room rank (crew).
  if (receipt.percentile !== null && receipt.percentile.population > 1) {
    const pct = Math.round(
      (100 * receipt.percentile.beatCount) / receipt.percentile.population,
    );
    panel(ctx, M, y, W - 2 * M, 170, LIME);
    ctx.fillStyle = "#0d0d0d";
    ctx.font = `bold 64px ${HEADING}`;
    ctx.fillText(`Beat ${pct}% of budget squads`, M + 44, y + 105);
  } else if (receipt.crewRank !== null) {
    panel(ctx, M, y, W - 2 * M, 170, LIME);
    ctx.fillStyle = "#0d0d0d";
    ctx.font = `bold 64px ${HEADING}`;
    ctx.fillText(
      `${receipt.crewRank.tied ? "T" : ""}${receipt.crewRank.rank} of ${receipt.crewRank.of} in the room`,
      M + 44,
      y + 105,
    );
  }

  // Wordmark, bottom-left.
  ctx.fillStyle = MUTED;
  ctx.font = `bold 32px ${MONO}`;
  ctx.fillText("verveq.com/weekend", M, H - 90);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob === null ? reject(new Error("toBlob failed")) : resolve(blob)),
      "image/png",
    );
  });
}
