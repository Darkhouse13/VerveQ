import React from "react";
import { useCurrentFrame } from "remotion";
import { ACCENTS, COLORS, Card, FONTS, Footer, POST_W, PAD, Pill, Slide, difficultyStyle, fitSize, neoShadow } from "./kit";

// "Guess the player" carousel: a cover, one slide per club (the path builds
// up row by row), and the reveal. Frame N = slide N. Names only — no photos,
// no crests (factory rules).
export type CarouselClub = { name: string; loan: boolean };
export type CareerCarouselProps = {
  answerName: string;
  clubs: CarouselClub[];
  difficulty: string;
  accentIndex: number;
};

export const carouselSlides = (clubs: number) => clubs + 2;

const ROW_GAP = 16;

export const CareerCarousel: React.FC<CareerCarouselProps> = ({ answerName, clubs, difficulty, accentIndex }) => {
  const slide = useCurrentFrame();
  const accent = ACCENTS[accentIndex % ACCENTS.length];
  const n = clubs.length;
  const total = carouselSlides(n);
  const diff = difficultyStyle(difficulty);
  const frame = (children: React.ReactNode) => (
    <Slide accent={accent} mode="CAREER PATH" index={slide} total={total}>
      {children}
    </Slide>
  );

  if (slide === 0) {
    return frame(
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 70 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <Pill bg={diff.bg} fg={diff.fg}>{diff.label}</Pill>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 168, lineHeight: 1, letterSpacing: -6 }}>{n} CLUBS.</div>
          <div
            style={{
              alignSelf: "flex-start",
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: 168,
              lineHeight: 1.05,
              letterSpacing: -6,
              background: accent,
              padding: "0 22px 8px",
              border: `6px solid ${COLORS.ink}`,
              boxShadow: neoShadow(10),
            }}
          >
            1 PLAYER.
          </div>
          <div style={{ fontFamily: FONTS.head, fontWeight: 500, fontSize: 46, lineHeight: 1.2, maxWidth: 860 }}>
            One club per slide. Name him before the last one.
          </div>
        </div>
        <Footer>Swipe to start →</Footer>
      </div>,
    );
  }

  if (slide <= n) {
    const shown = clubs.slice(0, slide);
    const rowH = Math.min(150, Math.floor((1350 - 2 * PAD - 60 - 110 - 150 - ROW_GAP * (n - 1)) / n));
    const nameSizes = rowH >= 130 ? [72, 64, 56, 48, 40] : [58, 52, 46, 40, 36];
    return frame(
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 34 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2, marginBottom: 26 }}>
          CLUB {slide} OF {n}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: ROW_GAP, paddingTop: 10 }}>
          {shown.map((club, i) => {
            const latest = i === slide - 1;
            const size = fitSize(club.name, POST_W - 2 * PAD - 220, 1, nameSizes, 0.6);
            return (
              <Card
                key={i}
                bg={latest ? accent : COLORS.card}
                shadow={latest ? 10 : 5}
                style={{ height: rowH, display: "flex", alignItems: "center", gap: 26, padding: "0 26px", opacity: latest ? 1 : 0.82 }}
              >
                <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, width: 56 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: size, flex: 1, whiteSpace: "nowrap" }}>{club.name}</span>
                {club.loan ? (
                  <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, border: `3px solid ${COLORS.ink}`, borderRadius: 8, padding: "4px 10px" }}>
                    LOAN
                  </span>
                ) : null}
              </Card>
            );
          })}
        </div>
        <Footer>{slide < n ? "Got him? Comment before you swipe →" : "Last chance. Swipe for the answer →"}</Footer>
      </div>,
    );
  }

  const size = fitSize(answerName.toUpperCase(), POST_W - 2 * PAD, 2, [150, 130, 112, 96, 84], 0.62);
  const path = clubs.map((c) => c.name).join("  →  ");
  return frame(
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 70 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3 }}>IT'S…</div>
        <Card bg={accent} shadow={12} style={{ padding: "34px 36px" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: size, lineHeight: 0.95, letterSpacing: -3 }}>
            {answerName.toUpperCase()}
          </div>
        </Card>
        <div style={{ fontFamily: FONTS.head, fontWeight: 500, fontSize: fitSize(path, POST_W - 2 * PAD, 4, [40, 36, 32, 28]), lineHeight: 1.3 }}>
          {path}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 44, textAlign: "center" }}>How many clubs did you need?</div>
        <Footer>A new career path every day · verveq.com</Footer>
      </div>
    </div>,
  );
};
