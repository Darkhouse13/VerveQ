import React from "react";
import { useCurrentFrame } from "remotion";
import { ACCENTS, COLORS, Card, FONTS, Footer, POST_W, PAD, Slide, fitSize, neoShadow } from "./kit";

// "Stat receipt" carousel (CONCEPT-SWEEP 2026-09 §3.7): one claim that sounds
// wrong, proven by numbers, then a question. Three slides: claim → receipts →
// ask. Numbers come from VerveQ's own season-stats table (API-Football), and
// the source line on slides 1–2 says so. Frame N = slide N.
export type ReceiptRow = { name: string; /** Label on the cover, e.g. "VINÍCIUS" (surname-splitting fails on "Vinícius Júnior"). */ short: string; club: string; apps: number; goals: number; assists: number; price: number | null };
export type StatReceiptProps = {
  hero: ReceiptRow;
  rivals: ReceiptRow[];
  /** e.g. "LA LIGA 2026-27" */
  competition: string;
  /** e.g. "22 SEP 2026" */
  asOf: string;
  headline: string;
  ask: string;
  accentIndex: number;
};

export const RECEIPT_SLIDES = 3;

const sum = (rows: ReceiptRow[], k: "goals" | "assists" | "price") => rows.reduce((a, r) => a + (r[k] ?? 0), 0);
const fmtPrice = (n: number) => n.toFixed(1);

export const StatReceipt: React.FC<StatReceiptProps> = ({ hero, rivals, competition, asOf, headline, ask, accentIndex }) => {
  const slide = useCurrentFrame();
  const accent = ACCENTS[accentIndex % ACCENTS.length];
  const rivalGoals = sum(rivals, "goals");
  const source = `SOURCE: API-FOOTBALL · ${competition} · AS OF ${asOf}`;
  const frame = (children: React.ReactNode) => (
    <Slide accent={accent} mode="STAT RECEIPT" index={slide} total={RECEIPT_SLIDES}>
      {children}
    </Slide>
  );
  const sourceLine = (
    <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 1.5, opacity: 0.6, textAlign: "center" }}>{source}</div>
  );

  if (slide === 0) {
    const size = fitSize(headline, POST_W - 2 * PAD, 5, [92, 84, 76, 68, 60], 0.58);
    return frame(
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 50 }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: size, lineHeight: 1.02, letterSpacing: -2.5 }}>{headline}</div>
        <div style={{ display: "flex", gap: 24, alignItems: "stretch" }}>
          <Card bg={accent} shadow={12} style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 2 }}>{hero.short.toUpperCase()}</div>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 176, lineHeight: 0.95, letterSpacing: -6 }}>{hero.goals}</div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24 }}>GOALS</div>
          </Card>
          <Card shadow={6} style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, lineHeight: 1.25 }}>
              {rivals.map((r) => r.short.toUpperCase()).join(" + ")}
            </div>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 176, lineHeight: 0.95, letterSpacing: -6 }}>{rivalGoals}</div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24 }}>GOALS, COMBINED</div>
          </Card>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sourceLine}
          <Footer>Swipe for the receipts →</Footer>
        </div>
      </div>,
    );
  }

  if (slide === 1) {
    const rows = [hero, ...rivals];
    const col = (w: number, align: "left" | "right" = "right"): React.CSSProperties => ({ width: w, textAlign: align });
    return frame(
      <div style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 40, gap: 26 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2 }}>THE RECEIPTS · {competition}</div>
        <div
          style={{
            display: "flex",
            fontFamily: FONTS.mono,
            fontWeight: 700,
            fontSize: 22,
            letterSpacing: 1.5,
            padding: "0 28px",
            opacity: 0.7,
          }}
        >
          <span style={col(420, "left")}>PLAYER</span>
          <span style={col(130)}>APPS</span>
          <span style={col(130)}>GOALS</span>
          <span style={col(160)}>ASSISTS</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((r, i) => (
            <Card key={r.name} bg={i === 0 ? accent : COLORS.card} shadow={i === 0 ? 10 : 5} style={{ display: "flex", alignItems: "center", padding: "20px 28px" }}>
              <div style={{ ...col(420, "left"), display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: fitSize(r.name, 400, 1, [48, 42, 38, 34], 0.6), whiteSpace: "nowrap" }}>{r.name}</span>
                <span style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, opacity: 0.7 }}>{r.club.toUpperCase()}</span>
              </div>
              <span style={{ ...col(130), fontFamily: FONTS.head, fontWeight: 700, fontSize: 48 }}>{r.apps}</span>
              <span style={{ ...col(130), fontFamily: FONTS.head, fontWeight: 700, fontSize: 60 }}>{r.goals}</span>
              <span style={{ ...col(160), fontFamily: FONTS.head, fontWeight: 700, fontSize: 48 }}>{r.assists}</span>
            </Card>
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "18px 28px",
              border: `5px dashed ${COLORS.ink}`,
              borderRadius: 18,
            }}
          >
            <span style={{ ...col(420, "left"), fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 1.5 }}>THOSE THREE, COMBINED</span>
            <span style={col(130)} />
            <span style={{ ...col(130), fontFamily: FONTS.head, fontWeight: 700, fontSize: 60 }}>{rivalGoals}</span>
            <span style={{ ...col(160), fontFamily: FONTS.head, fontWeight: 700, fontSize: 48 }}>{sum(rivals, "assists")}</span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {sourceLine}
      </div>,
    );
  }

  const heroPrice = hero.price;
  const rivalPrice = sum(rivals, "price");
  return frame(
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 50 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2 }}>AND THE PRICE TAG · THE WEEKEND</div>
        {heroPrice !== null ? (
          <div style={{ display: "flex", gap: 24 }}>
            <Card bg={accent} shadow={12} style={{ flex: 1, padding: "24px 28px" }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 2 }}>{hero.name.toUpperCase()}</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 140, lineHeight: 1, letterSpacing: -5 }}>{fmtPrice(heroPrice)}</div>
            </Card>
            <Card shadow={6} style={{ flex: 1, padding: "24px 28px" }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 2 }}>THE OTHER THREE</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 140, lineHeight: 1, letterSpacing: -5 }}>{fmtPrice(rivalPrice)}</div>
            </Card>
          </div>
        ) : null}
        <div
          style={{
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: fitSize(ask, POST_W - 2 * PAD, 4, [76, 68, 60, 54], 0.56),
            lineHeight: 1.05,
            letterSpacing: -2,
            background: COLORS.card,
            border: `6px solid ${COLORS.ink}`,
            boxShadow: neoShadow(10),
            padding: "26px 30px",
            borderRadius: 18,
          }}
        >
          {ask}
        </div>
      </div>
      <Footer>Pick your squad free · verveq.com</Footer>
    </div>,
  );
};
