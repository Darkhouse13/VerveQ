import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadHeading } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { COLORS, DIFFICULTY_STYLE, neoShadow } from "./theme";
import { phases } from "./timing";

// latin-ext is non-negotiable: the dataset has Šeško, Çalhanoğlu, Gvardiol…
const heading = loadHeading("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const body = loadBody("normal", {
  weights: ["500", "700"],
  subsets: ["latin", "latin-ext"],
});
const mono = loadMono("normal", { weights: ["700"], subsets: ["latin"] });

export type CareerPathEntry = {
  id: string;
  answerName: string;
  clubs: string[];
  difficulty: "easy" | "medium" | "hard";
};

export type CareerPathRevealProps = { entry: CareerPathEntry };

const W = 1080;

const pillStyle = (bg: string, fg: string): React.CSSProperties => ({
  display: "inline-block",
  background: bg,
  color: fg,
  fontFamily: mono.fontFamily,
  fontWeight: 700,
  fontSize: 30,
  letterSpacing: 2,
  padding: "12px 28px",
  border: `3px solid ${COLORS.ink}`,
  borderRadius: 10,
  boxShadow: neoShadow(6),
});

export const CareerPathReveal: React.FC<CareerPathRevealProps> = ({ entry }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = phases(entry.clubs.length);
  const diff = DIFFICULTY_STYLE[entry.difficulty] ?? DIFFICULTY_STYLE.medium;

  const pop = (start: number, damping = 12) =>
    spring({ frame: frame - start, fps, config: { damping }, durationInFrames: 24 });

  // ---- header (persistent until the CTA covers it) ----
  const headerIn = pop(4);

  // ---- club list geometry: up to 10 rows must fit between header and footer ----
  const n = entry.clubs.length;
  const listTop = 400;
  const listHeight = 1360;
  const rowH = Math.min(140, Math.floor(listHeight / n));
  const cardH = rowH - 16;
  const clubFontSize = Math.min(48, Math.floor(cardH * 0.42));

  // ---- countdown ----
  const inCountdown = frame >= p.clubsEnd && frame < p.countdownEnd;
  const countIdx = Math.min(2, Math.floor((frame - p.clubsEnd) / 30));
  const countValue = 3 - countIdx;
  const countPop = pop(p.clubsEnd + countIdx * 30, 10);

  // ---- reveal ----
  const inReveal = frame >= p.countdownEnd;
  const revealPop = pop(p.countdownEnd, 11);
  const name = entry.answerName.toUpperCase();
  const nameFontSize = Math.min(108, Math.floor(2300 / name.length) + 20);

  // ---- CTA ----
  const ctaStart = p.revealEnd;
  const ctaSlide = spring({
    frame: frame - ctaStart,
    fps,
    config: { damping: 15 },
    durationInFrames: 28,
  });
  const inCta = frame >= ctaStart;

  // progress bar fills from first club to the reveal moment
  const progress = interpolate(frame, [p.hookEnd, p.countdownEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.cream, fontFamily: body.fontFamily }}>
      {/* progress bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: 16,
          background: COLORS.cream,
          borderBottom: `3px solid ${COLORS.ink}`,
        }}
      >
        <div style={{ width: progress * W, height: "100%", background: COLORS.orange }} />
      </div>

      {/* header */}
      <div
        style={{
          position: "absolute",
          top: 64,
          left: 56,
          right: 56,
          transform: `translateY(${(1 - headerIn) * -60}px)`,
          opacity: headerIn,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={pillStyle(COLORS.orange, COLORS.white)}>CAREER PATH</span>
          <span style={pillStyle(diff.bg, diff.fg)}>{diff.label}</span>
        </div>
        <div
          style={{
            fontFamily: heading.fontFamily,
            fontWeight: 700,
            fontSize: 92,
            lineHeight: 1.02,
            color: COLORS.ink,
            marginTop: 36,
            letterSpacing: -1,
          }}
        >
          NAME THE PLAYER
        </div>
        <div style={{ fontSize: 38, fontWeight: 500, color: COLORS.ink, marginTop: 12, opacity: 0.75 }}>
          Every club of his career, in order.
        </div>
      </div>

      {/* club list */}
      <div style={{ position: "absolute", top: listTop, left: 56, right: 56 }}>
        {entry.clubs.map((club, i) => {
          const appearAt = p.hookEnd + i * 42;
          const s = pop(appearAt, 11);
          const tilt = i % 2 === 0 ? -1.2 : 1.2;
          return (
            <div
              key={`${club}-${i}`}
              style={{
                height: cardH,
                marginBottom: rowH - cardH,
                display: "flex",
                alignItems: "center",
                gap: 24,
                background: COLORS.card,
                border: `3px solid ${COLORS.ink}`,
                borderRadius: 12,
                boxShadow: neoShadow(7),
                paddingLeft: 20,
                paddingRight: 20,
                opacity: s,
                transform: `scale(${0.7 + s * 0.3}) rotate(${(1 - s) * 8 + tilt}deg)`,
              }}
            >
              <div
                style={{
                  width: cardH - 36,
                  height: cardH - 36,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: COLORS.orange,
                  color: COLORS.white,
                  border: `3px solid ${COLORS.ink}`,
                  borderRadius: 10,
                  fontFamily: mono.fontFamily,
                  fontWeight: 700,
                  fontSize: clubFontSize * 0.8,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontFamily: heading.fontFamily,
                  fontWeight: 700,
                  fontSize: club.length > 20 ? clubFontSize * 0.82 : clubFontSize,
                  color: COLORS.ink,
                  whiteSpace: "nowrap",
                }}
              >
                {club.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>

      {/* countdown overlay */}
      {inCountdown ? (
        <AbsoluteFill
          style={{
            background: "hsl(30 100% 97% / 0.72)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              ...pillStyle(COLORS.ink, COLORS.cream),
              fontSize: 54,
              padding: "20px 48px",
              marginBottom: 70,
              transform: `rotate(-2deg)`,
            }}
          >
            WHO IS HE?
          </div>
          <div
            style={{
              width: 400,
              height: 400,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: COLORS.yellow,
              border: `5px solid ${COLORS.ink}`,
              borderRadius: 24,
              boxShadow: neoShadow(12),
              transform: `rotate(3deg) scale(${0.5 + countPop * 0.5})`,
            }}
          >
            <span
              style={{
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: 240,
                color: COLORS.ink,
              }}
            >
              {countValue}
            </span>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* reveal overlay */}
      {inReveal ? (
        <AbsoluteFill
          style={{
            background: "hsl(30 100% 97% / 0.82)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: W - 140,
              background: COLORS.lime,
              border: `5px solid ${COLORS.ink}`,
              borderRadius: 20,
              boxShadow: neoShadow(14),
              padding: "70px 48px",
              textAlign: "center",
              transform: `rotate(-2deg) scale(${0.6 + revealPop * 0.4})`,
              opacity: revealPop,
            }}
          >
            <div
              style={{
                fontFamily: mono.fontFamily,
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: 4,
                color: COLORS.ink,
                marginBottom: 28,
              }}
            >
              THE ANSWER
            </div>
            <div
              style={{
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: nameFontSize,
                lineHeight: 1.05,
                color: COLORS.ink,
              }}
            >
              {name}
            </div>
          </div>
        </AbsoluteFill>
      ) : null}

      {/* CTA end card */}
      {inCta ? (
        <AbsoluteFill
          style={{
            background: COLORS.ink,
            alignItems: "center",
            justifyContent: "center",
            transform: `translateY(${(1 - ctaSlide) * 1920}px)`,
          }}
        >
          <div
            style={{
              fontFamily: heading.fontFamily,
              fontWeight: 700,
              fontSize: 150,
              color: COLORS.cream,
              letterSpacing: -2,
            }}
          >
            VERVEQ
          </div>
          <div style={{ width: 340, height: 14, background: COLORS.lime, marginTop: 8 }} />
          <div
            style={{
              fontSize: 44,
              fontWeight: 500,
              color: COLORS.cream,
              marginTop: 56,
              opacity: 0.9,
            }}
          >
            A new football challenge every day.
          </div>
          <div style={{ ...pillStyle(COLORS.orange, COLORS.white), fontSize: 44, padding: "24px 56px", marginTop: 64 }}>
            PLAY AT VERVEQ.COM
          </div>
          <div
            style={{
              fontFamily: mono.fontFamily,
              fontWeight: 700,
              fontSize: 28,
              letterSpacing: 2,
              color: COLORS.cream,
              opacity: 0.55,
              marginTop: 80,
            }}
          >
            DAILY QUIZ · SURVIVAL · CAREER PATH
          </div>
        </AbsoluteFill>
      ) : null}

      {/* watermark */}
      {!inCta ? (
        <div
          style={{
            position: "absolute",
            bottom: 36,
            width: W,
            textAlign: "center",
            fontFamily: mono.fontFamily,
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: 3,
            color: COLORS.ink,
            opacity: 0.5,
          }}
        >
          verveq.com
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
