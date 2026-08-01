import React from "react";
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from "remotion";
import { COLORS, FONTS, neoShadow } from "../kit";
import { ROWS, DEST_LEN, STATUS_LEN, STAGGER, SPIN_FRAMES, BOARDING_AT, TOTAL } from "./timeline";

// Promo #19 — "DEPARTURES": the group chat as an airport. Every character is
// its own split-flap cell that spins through glyphs and settles left-to-right
// with a column stagger, exactly like a Solari board. One continuous shot;
// the last row to settle IS the CTA (VERVEQ.COM/PLAY — BOARDING), so there is
// no dead endcard — the board is the endcard.

const FLAP = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'./–-";
const CELL_W = 37;
const CELL_H = 56;

const STATUS_COLORS: Record<string, string> = {
  green: COLORS.green,
  orange: COLORS.orange,
  red: COLORS.red,
  blue: COLORS.blue,
  lime: COLORS.lime,
};

// deterministic per-cell jitter so neighbouring cells never settle in sync
const jitter = (row: number, col: number) => ((Math.floor(row * 31 + col * 17) % 9) - 4);

const Cell: React.FC<{ target: string; start: number; frame: number; color: string; glow?: boolean }> = ({ target, start, frame, color, glow }) => {
  const local = frame - start;
  const spin = SPIN_FRAMES + jitter(start, start + Math.abs(target.charCodeAt(0) || 1));
  const spinning = local >= 0 && local < spin;
  const settled = local >= spin;
  // while spinning: cycle glyphs every 2 frames; half-flip illusion via scaleY
  const cycleIdx = Math.floor(local / 2);
  const ch = settled ? target : local < 0 ? " " : FLAP[Math.floor(cycleIdx * 7 + start) % FLAP.length];
  const flipPhase = spinning ? Math.abs(Math.cos(((local % 2) / 2) * Math.PI)) : 1;
  const snap = settled && local - spin < 3 ? 1.08 : 1;
  return (
    <div
      style={{
        width: CELL_W,
        height: CELL_H,
        background: "#1d1d1d",
        borderRadius: 6,
        border: "1px solid #000",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        boxShadow: glow && settled ? `0 0 22px ${color}55` : "none",
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontWeight: 700,
          fontSize: 30,
          color: settled ? color : "#8a8a8a",
          transform: `scaleY(${0.2 + 0.8 * flipPhase}) scale(${snap})`,
        }}
      >
        {ch === " " ? " " : ch}
      </span>
      {/* the Solari midline */}
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "rgba(0,0,0,0.75)" }} />
    </div>
  );
};

const Row: React.FC<{ dest: string; status: string; color: string; at: number; frame: number; isCta: boolean }> = ({ dest, status, color, at, frame, isCta }) => {
  const statusColor = STATUS_COLORS[color];
  // CTA row breathes once settled (slow pulse, ~1/s)
  const settledAll = frame >= at + DEST_LEN * STAGGER + SPIN_FRAMES + 8;
  const pulse = isCta && settledAll ? 1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2) : 1;
  return (
    <div style={{ display: "flex", gap: 4, transform: `scale(${pulse})` }}>
      {dest.split("").map((c, i) => (
        <Cell key={`d${i}`} target={c} start={at + i * STAGGER} frame={frame} color={isCta ? COLORS.lime : COLORS.cream} glow={isCta} />
      ))}
      <div style={{ width: 10 }} />
      {status.split("").map((c, i) => (
        <Cell key={`s${i}`} target={c} start={at + (DEST_LEN + i) * STAGGER} frame={frame} color={statusColor} glow={isCta} />
      ))}
    </div>
  );
};

export const Departures: React.FC = () => {
  const frame = useCurrentFrame();
  // slow push-in over the whole shot — constant subtle motion
  const zoom = interpolate(frame, [0, TOTAL], [1, 1.055]);
  const boarding = frame >= BOARDING_AT;
  return (
    <AbsoluteFill style={{ background: "#0e0e0e" }}>
      <Audio src={staticFile("promo/departures.wav")} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
        {/* hook — static, fully readable at frame 0 */}
        <div style={{ position: "absolute", top: 120, left: 60, right: 60 }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>
            THE GROUP CHAT, AS AN AIRPORT.
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 22 }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, letterSpacing: -3, color: COLORS.yellow }}>DEPARTURES</div>
            {/* the clock reads 9:04 — Dave canon */}
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 44, color: COLORS.cream, opacity: 0.8 }}>
              09:04{Math.floor(frame / 15) % 2 === 0 ? ":" : " "}
            </div>
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 6, color: COLORS.cream, opacity: 0.4, marginTop: 4 }}>
            BANTER INTERNATIONAL · TERMINAL 9–4
          </div>
        </div>

        {/* the board */}
        <div style={{ position: "absolute", top: 480, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ background: "#151515", border: `6px solid #2a2a2a`, borderRadius: 22, padding: "38px 30px", boxShadow: neoShadow(14), display: "flex", flexDirection: "column", gap: 18 }}>
            {/* column headers */}
            <div style={{ display: "flex", gap: 4, paddingLeft: 6, marginBottom: 2 }}>
              <div style={{ width: DEST_LEN * (CELL_W + 4), fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#6a6a6a" }}>DESTINATION</div>
              <div style={{ width: 10 }} />
              <div style={{ width: STATUS_LEN * (CELL_W + 4), fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: "#6a6a6a" }}>STATUS</div>
            </div>
            {ROWS.map((r, i) => (
              <Row key={r.dest} dest={r.dest} status={r.status} color={r.color} at={r.at} frame={frame} isCta={i === ROWS.length - 1} />
            ))}
          </div>
        </div>

        {/* footer — the boarding call */}
        <div style={{ position: "absolute", top: 1300, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 32, letterSpacing: 3, color: boarding ? COLORS.lime : "#5a5a5a" }}>
            {boarding ? "FINAL BOARDING CALL · GATE VQ" : "GATE VQ · FREE · NO SIGN-UP"}
            <span style={{ opacity: Math.floor(frame / 12) % 2 === 0 ? 1 : 0 }}>▌</span>
          </div>
        </div>
        <div style={{ position: "absolute", top: 60, left: 60, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.cream, opacity: 0.35 }}>
          VERVEQ
        </div>
      </div>
    </AbsoluteFill>
  );
};
