import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, Ground, spr, shake } from "../kit";
import { LINES, PRINT_FRAMES, BARCODE_AT, TEAR_AT, STAMP_AT } from "./timeline";

// Promo #18 — "RECEIPT": the group chat's season, itemized. Receiptify
// taught the internet to read identity off a till receipt; this one prints
// the banter ledger (147 hot takes, 3 correct, 0 sources), totals it at ONE
// APOLOGY, tears off, and gets stamped. One continuous shot — the CTA is a
// printed line item, not an endcard.

const PAPER_W = 660;
const LINE_H = 36;
const HEAD_H = 34;

// CSS-only zigzag strip (the torn perforation) — classic gradient trick.
const Zigzag: React.FC<{ color: string; up?: boolean }> = ({ color, up }) => (
  <div
    style={{
      height: 14,
      backgroundImage: `linear-gradient(${up ? 45 : -135}deg, ${color} 7px, transparent 0), linear-gradient(${up ? -45 : 135}deg, ${color} 7px, transparent 0)`,
      backgroundSize: "14px 14px",
      backgroundRepeat: "repeat-x",
    }}
  />
);

const lineStyle = (kind: string): React.CSSProperties => {
  switch (kind) {
    case "total":
      return { fontWeight: 700, fontSize: 30, letterSpacing: 0 };
    case "cta":
      return { fontWeight: 700, fontSize: 30, background: COLORS.ink, color: COLORS.cream, padding: "2px 8px" };
    case "rule":
      return { opacity: 0.45, fontSize: 28 };
    case "meta":
      return { opacity: 0.75, fontSize: 26, letterSpacing: 1 };
    default:
      return { fontSize: 29 };
  }
};

export const Receipt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // how much paper exists: header + every line that has started printing
  const printed = LINES.filter((l) => frame >= l.at);
  const active = LINES.find((l) => frame >= l.at && frame < l.at + PRINT_FRAMES);
  const partial = active ? (frame - active.at) / PRINT_FRAMES : 1;
  const paperH =
    HEAD_H +
    printed.reduce((h, l) => h + (l === active ? LINE_H * partial : LINE_H), 0) +
    (frame >= BARCODE_AT ? 96 : 0) +
    28;

  // the tear: receipt detaches, drops and tilts; a stub stays in the slot
  const tear = spr(frame, fps, TEAR_AT, 10, 16);
  const torn = frame >= TEAR_AT;
  const stamp = spr(frame, fps, STAMP_AT, 8, 14);
  const sh = shake(frame, STAMP_AT, 16, 10);

  // frame-1-readable hook settles; nothing fades in late up top
  const settle = interpolate(frame, [0, 6], [1.03, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      <Audio src={staticFile("promo/receipt.wav")} />
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        {/* hook — fully on screen at frame 0 */}
        <div style={{ position: "absolute", top: 96, left: 72, right: 72, transform: `scale(${settle})` }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, lineHeight: 0.96, letterSpacing: -3, color: COLORS.cream }}>
            THE SEASON,<br />ITEMIZED.
          </div>
        </div>
        <div style={{ position: "absolute", top: 60, right: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.45 }}>
          VERVEQ
        </div>

        {/* the printer */}
        <div style={{ position: "absolute", top: 366, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ width: 840, height: 74, background: "#232323", border: `5px solid ${COLORS.cream}`, borderRadius: 20, boxShadow: neoShadow(10), position: "relative", zIndex: 3 }}>
            <div style={{ position: "absolute", left: 70, right: 70, top: 26, height: 16, background: COLORS.ink, borderRadius: 8, border: `3px solid #3a3a3a` }} />
            {/* status LED — blinks while printing (slow: 20f period) */}
            <div style={{ position: "absolute", right: 24, top: 27, width: 14, height: 14, borderRadius: "50%", background: frame < TEAR_AT && Math.floor(frame / 10) % 2 === 0 ? COLORS.lime : "#3a3a3a" }} />
          </div>
        </div>

        {/* stub left behind after the tear */}
        {torn && (
          <div style={{ position: "absolute", top: 436, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 2 }}>
            <div style={{ width: PAPER_W }}>
              <div style={{ height: 18, background: COLORS.card }} />
              <Zigzag color={COLORS.card} up={false} />
            </div>
          </div>
        )}

        {/* the receipt */}
        <div
          style={{
            position: "absolute",
            top: 436,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: torn ? 4 : 1,
            transform: `translateY(${tear * 64}px) rotate(${tear * -3.2}deg)`,
          }}
        >
          <div style={{ width: PAPER_W, filter: torn ? "drop-shadow(0 18px 0 rgba(0,0,0,0.5))" : "none" }}>
            {torn && <Zigzag color={COLORS.card} up />}
            <div style={{ background: COLORS.card, height: paperH, overflow: "hidden", padding: "0 34px", boxSizing: "border-box" }}>
              <div style={{ height: HEAD_H }} />
              {printed.map((l) => {
                const isActive = l === active;
                const chars = isActive ? Math.floor(l.text.length * partial) : l.text.length;
                return (
                  <div key={l.at} style={{ height: LINE_H, position: "relative", fontFamily: FONTS.mono, color: COLORS.ink, whiteSpace: "pre", display: "flex", alignItems: "center", justifyContent: l.kind === "meta" ? "center" : "flex-start", ...lineStyle(l.kind) }}>
                    <span>{l.text.slice(0, chars)}</span>
                    {/* the print head sweep */}
                    {isActive && <div style={{ position: "absolute", left: `${partial * 100}%`, top: 2, bottom: 2, width: 26, background: COLORS.yellow, opacity: 0.55 }} />}
                  </div>
                );
              })}
              {frame >= BARCODE_AT && (
                <div style={{ marginTop: 12 }}>
                  <div
                    style={{
                      height: 56,
                      width: 420,
                      margin: "0 auto",
                      backgroundImage: `repeating-linear-gradient(90deg, ${COLORS.ink} 0 3px, transparent 3px 7px, ${COLORS.ink} 7px 12px, transparent 12px 15px)`,
                      opacity: Math.min(1, (frame - BARCODE_AT) / 8),
                    }}
                  />
                  <div style={{ textAlign: "center", fontFamily: FONTS.mono, fontSize: 22, color: COLORS.ink, opacity: 0.6, marginTop: 6 }}>NO. 9–4 · FREE · NO SIGN-UP</div>
                </div>
              )}
            </div>
            <Zigzag color={COLORS.card} up={false} />
          </div>
        </div>

        {/* the stamp — the payoff, ~86% of runtime */}
        <div
          style={{
            position: "absolute",
            top: 760,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 6,
            transform: `rotate(-11deg) scale(${0.55 + stamp * 0.45})`,
            opacity: Math.min(1, stamp * 2),
          }}
        >
          <div style={{ border: `12px solid ${COLORS.red}`, borderRadius: 18, padding: "18px 44px", textAlign: "center" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, lineHeight: 0.95, letterSpacing: -2, color: COLORS.red }}>
              KEEP THE<br />RECEIPTS.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
