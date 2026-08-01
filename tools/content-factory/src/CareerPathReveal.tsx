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
import { COUNTDOWN_FRAMES, clubAppearAt, phases } from "./timing";
import { getVariant, motionProfile } from "./variants";
import { Background } from "./backgrounds";
import { Sfx } from "./Sfx";

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

// A club is a bare name (permanent spell) or { name, loan } for a loan spell.
// Duplicated from app/convex/lib/careerPathClubs — the factory is a separate
// project (same boundary as the theme-token duplication).
export type CareerPathClub = string | { name: string; loan?: boolean };
export type CareerPathEntry = {
  id: string;
  answerName: string;
  clubs: CareerPathClub[];
  difficulty: "easy" | "medium" | "hard";
};

const clubName = (club: CareerPathClub): string =>
  typeof club === "string" ? club : club.name;
const clubIsLoan = (club: CareerPathClub): boolean =>
  typeof club !== "string" && club.loan === true;

// Condense enormous paths (Abreu 37, Túlio 39) so rows stay legible in a
// vertical video. Display only — mirrors app/convex/lib/careerPathClubs.
export const MAX_DISPLAY_CLUBS = 12;
export type ClubRow =
  | { kind: "club"; name: string; loan: boolean; position: number }
  | { kind: "gap"; hidden: number };
export const clubsForDisplay = (
  clubs: CareerPathClub[],
  max = MAX_DISPLAY_CLUBS,
): ClubRow[] => {
  const row = (club: CareerPathClub, index: number): ClubRow => ({
    kind: "club",
    name: clubName(club),
    loan: clubIsLoan(club),
    position: index + 1,
  });
  if (clubs.length <= max) return clubs.map(row);
  const shown = max - 1;
  const head = Math.ceil(shown / 2);
  const tail = shown - head;
  const rows: ClubRow[] = clubs.slice(0, head).map(row);
  rows.push({ kind: "gap", hidden: clubs.length - head - tail });
  const tailStart = clubs.length - tail;
  clubs.slice(tailStart).forEach((club, i) => rows.push(row(club, tailStart + i)));
  return rows;
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
  const rows = clubsForDisplay(entry.clubs);
  const p = phases(rows.length);
  const diff = DIFFICULTY_STYLE[entry.difficulty] ?? DIFFICULTY_STYLE.medium;

  // Everything below that looks different per player flows from this one seed.
  const v = getVariant(entry.id);
  const pal = v.palette;
  const motion = motionProfile(v.motion);

  const pop = (start: number, damping = motion.damping) =>
    spring({ frame: frame - start, fps, config: { damping }, durationInFrames: 24 });

  // ---- header (persistent until the CTA covers it) ----
  // Frame 0 must already read as content — no fade-in from blank cream.
  // The heading settles from a slight overscale instead of appearing.
  const headerSettle = spring({
    frame,
    fps,
    config: { damping: 14 },
    durationInFrames: 18,
  });

  // ---- club list geometry: up to MAX_DISPLAY_CLUBS rows fit between header/footer ----
  const n = rows.length;
  const listTop = 400;
  const listHeight = 1360;
  const rowH = Math.min(140, Math.floor(listHeight / n));
  const cardH = rowH - 16;
  const clubFontSize = Math.min(48, Math.floor(cardH * 0.42));

  // ---- header layout (axis 3) ----
  const centered = v.header === "center";
  const band = v.header === "band";
  const headAlign = centered ? "center" : ("flex-start" as const);
  const headText = centered ? "center" : ("left" as const);
  const headOrigin = centered ? "top center" : "top left";
  // band wraps the heading in an ink sticker, so shrink it a touch to keep the
  // padded, overscaled frame-0 block inside the safe area
  const headFs = band ? (n >= 10 ? 78 : 86) : n >= 10 ? 84 : 92;

  // ---- club-row style (axis 4) ----
  const rs = v.row;
  const rowRadius = rs === "card" ? 12 : rs === "slab" ? 4 : 42;
  const rowShadow = rs === "card" ? 7 : rs === "slab" ? 11 : 5;
  const badgeCircle = rs === "ticket";
  const badgeRadius = rs === "slab" ? 4 : 10;
  const badgeBg = rs === "slab" ? COLORS.ink : pal.lead; // slab inverts the badge
  const badgeFg = rs === "slab" ? pal.lead : pal.leadFg;
  const tiltFor = (i: number) =>
    rs === "slab" ? 0 : (i % 2 === 0 ? -1 : 1) * (rs === "ticket" ? 0.8 : 1.2);

  // ---- countdown ----
  const perDigit = COUNTDOWN_FRAMES / 3;
  const inCountdown = frame >= p.clubsEnd && frame < p.countdownEnd;
  const countIdx = Math.min(2, Math.floor((frame - p.clubsEnd) / perDigit));
  const countValue = 3 - countIdx;
  const countPop = pop(p.clubsEnd + countIdx * perDigit, 10);

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
      {/* per-video surface texture, behind everything */}
      <Background kind={v.bg} accent={pal.lead} seed={v.seed} />

      {/* baked, synced sound layer (no music) */}
      <Sfx kit={v.kit} rowCount={n} phases={p} />

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
        <div style={{ width: progress * W, height: "100%", background: pal.lead }} />
      </div>

      {/* header */}
      <div style={{ position: "absolute", top: 64, left: 56, right: 56 }}>
        <div
          style={{
            display: "flex",
            justifyContent: centered ? "center" : "space-between",
            alignItems: "center",
            gap: centered ? 20 : 0,
          }}
        >
          <span style={pillStyle(pal.lead, pal.leadFg)}>CAREER PATH</span>
          <span style={pillStyle(diff.bg, diff.fg)}>{diff.label}</span>
        </div>
        {/* the settle scales only the heading block — the pills above must
            stay pinned inside the frame on frame 0 */}
        <div style={{ transform: `scale(${1.08 - headerSettle * 0.08})`, transformOrigin: headOrigin }}>
          <div style={{ display: "flex", justifyContent: headAlign, marginTop: 36 }}>
            <div
              style={{
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: headFs,
                lineHeight: 1.02,
                letterSpacing: -1,
                textAlign: headText,
                color: band ? COLORS.cream : COLORS.ink,
                background: band ? COLORS.ink : "transparent",
                border: band ? `4px solid ${COLORS.ink}` : "none",
                boxShadow: band ? neoShadow(8) : "none",
                borderRadius: band ? 10 : 0,
                padding: band ? "10px 22px" : 0,
                transform: band ? "rotate(-1.5deg)" : "none",
              }}
            >
              {n} CLUBS. 1 PLAYER.
            </div>
          </div>
          <div
            style={{
              fontSize: 38,
              fontWeight: 500,
              color: COLORS.ink,
              marginTop: band ? 20 : 12,
              opacity: 0.75,
              textAlign: headText,
            }}
          >
            {v.copy.subhead}
          </div>
        </div>
      </div>

      {/* club list */}
      <div style={{ position: "absolute", top: listTop, left: 56, right: 56 }}>
        {rows.map((r, i) => {
          const s = pop(clubAppearAt(i));
          if (r.kind === "gap") {
            return (
              <div
                key={`gap-${i}`}
                style={{
                  height: cardH,
                  marginBottom: rowH - cardH,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: s,
                  transform: `scale(${0.7 + s * 0.3})`,
                  fontFamily: mono.fontFamily,
                  fontWeight: 700,
                  fontSize: clubFontSize * 0.62,
                  letterSpacing: 3,
                  color: COLORS.ink,
                }}
              >
                + {r.hidden} MORE CLUBS
              </div>
            );
          }
          const clubLabel = r.name;
          const loan = r.loan;
          return (
            <div
              key={`${clubLabel}-${r.position}`}
              style={{
                height: cardH,
                marginBottom: rowH - cardH,
                display: "flex",
                alignItems: "center",
                gap: 24,
                background: COLORS.card,
                border: `3px solid ${COLORS.ink}`,
                borderRadius: rowRadius,
                boxShadow: neoShadow(rowShadow),
                paddingLeft: 20,
                paddingRight: 20,
                opacity: s,
                transform: motion.entrance(s, tiltFor(i)),
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
                  background: badgeBg,
                  color: badgeFg,
                  border: `3px solid ${COLORS.ink}`,
                  borderRadius: badgeCircle ? "50%" : badgeRadius,
                  fontFamily: mono.fontFamily,
                  fontWeight: 700,
                  fontSize: clubFontSize * 0.8,
                }}
              >
                {String(r.position).padStart(2, "0")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: heading.fontFamily,
                    fontWeight: 700,
                    fontSize: clubLabel.length > 20 ? clubFontSize * 0.82 : clubFontSize,
                    color: COLORS.ink,
                    whiteSpace: "nowrap",
                  }}
                >
                  {clubLabel.toUpperCase()}
                </div>
                {loan ? (
                  <div
                    style={{
                      flexShrink: 0,
                      fontFamily: mono.fontFamily,
                      fontWeight: 700,
                      fontSize: clubFontSize * 0.42,
                      letterSpacing: 2,
                      color: COLORS.ink,
                      background: COLORS.yellow,
                      border: `3px solid ${COLORS.ink}`,
                      borderRadius: 8,
                      padding: "4px 14px",
                    }}
                  >
                    LOAN
                  </div>
                ) : null}
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
            {v.copy.countdown}
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
          <div
            style={{
              ...pillStyle(pal.lead, pal.leadFg),
              fontSize: 36,
              marginTop: 80,
              transform: "rotate(-1.5deg)",
            }}
          >
            {v.copy.comment}
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
              background: pal.reveal,
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
                color: pal.revealFg,
                marginBottom: 28,
                opacity: 0.85,
              }}
            >
              {v.copy.revealLabel}
            </div>
            <div
              style={{
                fontFamily: heading.fontFamily,
                fontWeight: 700,
                fontSize: nameFontSize,
                lineHeight: 1.05,
                color: pal.revealFg,
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
          <div style={{ width: 340, height: 14, background: pal.lead, marginTop: 8 }} />
          <div
            style={{
              fontSize: 44,
              fontWeight: 500,
              color: COLORS.cream,
              marginTop: 56,
              opacity: 0.9,
            }}
          >
            {v.copy.cta}
          </div>
          <div style={{ ...pillStyle(pal.lead, pal.leadFg), fontSize: 44, padding: "24px 56px", marginTop: 64 }}>
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
