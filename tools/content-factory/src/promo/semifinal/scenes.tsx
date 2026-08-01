import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { COLORS, FONTS, Slam, Pop, Pill, Ground, Stripes, shake, neo, spr, inOut, countTo, neoShadow } from "../kit";
import { SCENES, START, type SKey } from "./timeline";
import { cueAt } from "./vo";

// ── Rivalry colours ─────────────────────────────────────────────────────────
// Crests are trademarked and permanently banned from these renders, so the two
// nations are carried by brand tokens instead: England red, Argentina blue.
// Both already live in src/theme.ts — the fixture reads instantly, nothing is
// borrowed, and the piece still looks like the app.
const ENG = COLORS.red;
const ARG = COLORS.blue;

type SceneProps = { dur: number };

// Readable on frame 0 with motion already underway — the first batch's
// retention data (70% gone before 3s on a static open) is the law here, and a
// spring that fades up from opacity 0 spends its first frames blank. This
// settles a slight overscale at FULL opacity instead: legible on the thumbnail
// frame, still visibly moving.
const Settle: React.FC<{ delay?: number; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  delay = 0,
  from = 1.12,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spr(frame, fps, delay, 14, 14);
  return <div style={{ ...style, transform: `scale(${from - (from - 1) * s})` }}>{children}</div>;
};

// every scene punches out on its last frames so cuts feel struck, not faded
const Exit: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const k = inOut(frame, dur, 5);
  return <div style={{ position: "absolute", inset: 0, transform: `scale(${0.97 + 0.03 * k})`, opacity: k }}>{children}</div>;
};

const Center: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 50px",
      ...style,
    }}
  >
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = COLORS.ink as string, size = 30 }) => (
  <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: size, letterSpacing: 5, color, opacity: 0.75 }}>{children}</div>
);

// the fixture bug — England red vs Argentina blue, no crests, ever
const Fixture: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
  <Pop delay={delay} style={{ display: "flex", alignItems: "center", gap: 18 }}>
    <Pill bg={ENG} fg={COLORS.white} size={30} rot={-1.5}>
      ENGLAND
    </Pill>
    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 34, color: COLORS.ink }}>v</div>
    <Pill bg={ARG} fg={COLORS.white} size={30} rot={1.5}>
      ARGENTINA
    </Pill>
  </Pop>
);

// `color` typed wide on purpose: COLORS is `as const`, so an inferred default
// would narrow this to the ink literal and reject every accent.
const head = (size: number, color: string = COLORS.ink): React.CSSProperties => ({
  fontFamily: FONTS.head,
  fontWeight: 700,
  fontSize: size,
  lineHeight: 0.92,
  letterSpacing: -1,
  color,
  textAlign: "center",
});

// ── 1. NEVER — the hook ─────────────────────────────────────────────────────
// The whole video in one frame: the greatest player alive, and the one fixture
// he has never played. "NEVER" punches on the exact frame the word is spoken.
const Never: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = cueAt("never", "never");
  const punch = spr(frame, fps, hit, 9, 12);
  const sh = shake(frame, hit, 10, 9);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, gap: 26 }}>
        <Fixture />
        <Settle style={{ marginTop: 14 }}>
          <div style={head(104)}>LIONEL MESSI HAS</div>
        </Settle>
        <div
          style={{
            transform: `scale(${1 + 0.16 * punch * (1 - Math.min(1, (frame - hit) / 12))}) rotate(-2deg)`,
            background: ENG,
            padding: "6px 46px 20px",
            border: `8px solid ${COLORS.ink}`,
            borderRadius: 20,
            boxShadow: neoShadow(16),
          }}
        >
          <div style={head(272, COLORS.white)}>NEVER</div>
        </div>
        <Settle delay={2}>
          <div style={head(104)}>PLAYED ENGLAND</div>
        </Settle>
      </Center>
    </Exit>
  );
};

// ── 2. NOT ONCE — the ink flash ─────────────────────────────────────────────
const NotOnce: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sh = shake(frame, 0, 16, 8);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.ink} />
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <Slam frame={frame} fps={fps} damping={9} from={1.5}>
          <div style={head(215, COLORS.cream)}>NOT ONCE.</div>
        </Slam>
      </Center>
    </Exit>
  );
};

// ── 3. SUSPENDED — the reason ───────────────────────────────────────────────
// 12 Nov 2005, Geneva, Argentina 2–3 England. The only England–Argentina
// fixture of Messi's entire career, and he sat it out.
const Susp: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = cueAt("susp", "suspended");
  const stamp = spr(frame, fps, hit, 8, 12);
  const sh = shake(frame, hit, 12, 9);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, gap: 30 }}>
        <Label>THE LAST TIME THEY MET</Label>
        <Settle>
          <div style={{ ...neo(COLORS.card, 14, 20), padding: "34px 52px", textAlign: "center" }}>
            <div style={head(124)}>12 NOV 2005</div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, marginTop: 14, color: COLORS.ink, opacity: 0.7 }}>
              GENEVA · FRIENDLY
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
              <Pill bg={ARG} fg={COLORS.white} size={26}>
                ARG 2
              </Pill>
              <Pill bg={ENG} fg={COLORS.white} size={26}>
                ENG 3
              </Pill>
            </div>
          </div>
        </Settle>
        <div
          style={{
            transform: `scale(${0.6 + 0.4 * stamp}) rotate(${-4 + 4 * (1 - stamp)}deg)`,
            opacity: Math.min(1, stamp * 2.4),
            background: ENG,
            padding: "14px 40px",
            border: `7px solid ${COLORS.ink}`,
            borderRadius: 14,
            boxShadow: neoShadow(12),
          }}
        >
          <div style={head(86, COLORS.white)}>HE WAS SUSPENDED</div>
        </div>
      </Center>
    </Exit>
  );
};

// ── 4. RED CARD — the absurdity ─────────────────────────────────────────────
// The ban only covered friendlies. Argentina's next friendly was England. It
// cost him that one match and nothing else.
const Red: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = cueAt("red", "red");
  const card = spr(frame, fps, hit, 10, 16);
  const sh = shake(frame, hit, 14, 10);
  const flick = interpolate(card, [0, 1], [-26, -6]);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, gap: 34 }}>
        <Settle>
          <div style={head(90)}>FOR A RED CARD</div>
        </Settle>
        {/* the card itself — a red rectangle is the one football icon that
            belongs to nobody, so it's the one we can actually draw */}
        <div
          style={{
            transform: `scale(${0.3 + 0.7 * card}) rotate(${flick}deg)`,
            opacity: Math.min(1, card * 3),
            width: 300,
            height: 420,
            background: ENG,
            border: `9px solid ${COLORS.ink}`,
            borderRadius: 22,
            boxShadow: neoShadow(18),
          }}
        />
        <Settle delay={2}>
          <div style={head(90)}>SECONDS INTO</div>
        </Settle>
        <Settle delay={4}>
          <div style={head(90)}>HIS DEBUT</div>
        </Settle>
        {/* The debut was against HUNGARY, not England — say so, or the hook
            reads as a contradiction. Lands on the spoken word. */}
        <Pop delay={cueAt("red", "against")} damping={9} from={0.55}>
          <Pill bg={COLORS.ink} fg={COLORS.lime} size={30}>
            AGAINST HUNGARY · 17 AUG 2005
          </Pill>
        </Pop>
      </Center>
    </Exit>
  );
};

// ── 5. THE BAN — the mechanism, and the punchline ───────────────────────────
// Without this scene the story has a hole a football fan drives straight
// through: he played three qualifiers between the August red card and the
// November friendly, so why hadn't he served it? Because the ban only counted
// in friendlies — and it sat there for three months waiting for exactly one
// match. The narrator leaves ~0.55s of true silence after "friendly?" before
// "England." (measured: speech dies at ~4.25s, the word lands at 4.88s). That
// silence is the beat; ENGLAND lands on the word, never on a guessed frame.
const Ban: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const qAt = cueAt("ban", "Argentina's");
  const engAt = cueAt("ban", "England");
  const eng = spr(frame, fps, engAt, 8, 12);
  const sh = shake(frame, engAt, 18, 11);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, gap: 22 }}>
        <Settle>
          <div style={head(74)}>THE BAN ONLY COUNTED IN</div>
        </Settle>
        <Settle delay={2}>
          <div style={{ ...neo(COLORS.yellow, 12, 16), padding: "10px 42px" }}>
            <div style={head(104)}>FRIENDLIES</div>
          </div>
        </Settle>
        <div style={{ width: 460, height: 7, background: COLORS.ink, opacity: 0.25, margin: "10px 0" }} />
        <Pop delay={qAt} damping={13} from={0.7}>
          <div style={head(70)}>ARGENTINA&rsquo;S NEXT FRIENDLY?</div>
        </Pop>
        <div
          style={{
            transform: `scale(${0.35 + 0.65 * eng}) rotate(${-3 + 3 * (1 - eng)}deg)`,
            opacity: Math.min(1, eng * 3),
            background: ENG,
            padding: "8px 54px 22px",
            border: `8px solid ${COLORS.ink}`,
            borderRadius: 20,
            boxShadow: neoShadow(16),
          }}
        >
          <div style={head(160, COLORS.white)}>ENGLAND</div>
        </div>
      </Center>
    </Exit>
  );
};

// ── 6. 7,550 DAYS — the number ──────────────────────────────────────────────
// Counts up across the spoken number and lands exactly on "fifty". Not 21
// years: FIFA and much of the press are doing calendar subtraction. The true
// elapsed gap is 20y 8m 3d — 7,550 days — and the real number is the better
// number anyway.
const Days: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const a = cueAt("days", "seven");
  const b = cueAt("days", "fifty") + 5;
  const n = countTo(frame, a, b, 0, 7550);
  const landed = frame >= b;
  const sh = shake(frame, b, 16, 10);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.cream} ground={COLORS.ink} opacity={0.06} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, gap: 20 }}>
        <Label color={COLORS.cream}>SINCE ENGLAND PLAYED ARGENTINA</Label>
        <div
          style={{
            ...head(320, landed ? COLORS.lime : COLORS.cream),
            fontFamily: FONTS.mono,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: -6,
            // head() runs lineHeight .92 — too short for the comma's descender,
            // which collided with DAYS below. Give the glyphs their own box.
            lineHeight: 1.1,
            transform: `scale(${landed ? 1.06 : 1})`,
          }}
        >
          {n.toLocaleString("en-GB")}
        </div>
        <Settle delay={2}>
          <div style={head(132, COLORS.cream)}>DAYS</div>
        </Settle>
      </Center>
    </Exit>
  );
};

// ── 7. THE HISTORY — 1986 / 1998 / 2002 ─────────────────────────────────────
// Three cards, each landing on its spoken word. No disputed minutes on screen:
// 1998's red card is 47' or 48' depending who you ask, so it gets a name and
// no number. Every claim here survives a screenshot.
const HIST = [
  { year: "1986", label: "THE HAND", who: "MARADONA · AZTECA", cue: "hand", color: ARG },
  { year: "1998", label: "THE RED CARD", who: "BECKHAM · SAINT-ÉTIENNE", cue: "red", color: ARG },
  { year: "2002", label: "THE REVENGE", who: "BECKHAM · SAPPORO", cue: "revenge", color: ENG },
] as const;

const Hist: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ gap: 26 }}>
        <Label>A RIVALRY WITH A BODY COUNT</Label>
        {HIST.map((h, i) => {
          const hit = cueAt("hist", h.cue);
          const s = spr(frame, fps, hit, 9, 14);
          const sh = shake(frame, hit, 8, 7);
          return (
            <div
              key={h.year}
              style={{
                transform: `translate(${sh.x}px, ${sh.y}px) scale(${0.55 + 0.45 * s}) rotate(${(i % 2 === 0 ? -1.5 : 1.5) * (1 - s)}deg)`,
                opacity: Math.min(1, s * 2.4),
                ...neo(COLORS.card, 12, 18),
                padding: "22px 34px",
                display: "flex",
                alignItems: "center",
                gap: 26,
                width: 960,
              }}
            >
              <div style={{ ...head(100, h.color), minWidth: 228, textAlign: "left" }}>{h.year}</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ ...head(68), textAlign: "left" }}>{h.label}</div>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 22, letterSpacing: 2, opacity: 0.6, marginTop: 6 }}>{h.who}</div>
              </div>
            </div>
          );
        })}
      </Center>
    </Exit>
  );
};

// ── 8. UNTIL TONIGHT — the turn ─────────────────────────────────────────────
// The only split ground in the piece: red one side, blue the other. The fixture
// itself, finally.
const Tonight: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sh = shake(frame, 0, 20, 10);
  const split = spr(frame, fps, 0, 16, 12);
  return (
    <Exit dur={dur}>
      <Ground color={ARG}>
        <div style={{ position: "absolute", inset: 0, background: ENG, clipPath: `polygon(0 0, ${52 * split}% 0, ${44 * split}% 100%, 0 100%)` }} />
        <Stripes frame={frame} color={COLORS.ink} ground={ARG} opacity={0.08} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
        <Slam frame={frame} fps={fps} damping={8} from={1.6}>
          <div style={{ ...head(168, COLORS.white), textShadow: `13px 13px 0 ${COLORS.ink}` }}>UNTIL TONIGHT.</div>
        </Slam>
      </Center>
    </Exit>
  );
};

// ── 9. THE ASK ──────────────────────────────────────────────────────────────
const Ask: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ gap: 16 }}>
        <Settle>
          <div style={head(118)}>HOW MUCH OF THAT</div>
        </Settle>
        <Settle delay={cueAt("ask", "know")}>
          <div style={{ ...head(118, ENG), textShadow: `11px 11px 0 ${COLORS.ink}` }}>DID YOU KNOW?</div>
        </Settle>
      </Center>
    </Exit>
  );
};

// ── 10. PROVE IT ────────────────────────────────────────────────────────────
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sh = shake(frame, 0, 14, 9);
  return (
    <Exit dur={dur}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <Center style={{ transform: `translate(${sh.x}px, ${sh.y}px)`, gap: 40 }}>
        <Slam frame={frame} fps={fps} damping={9} from={1.5}>
          <div style={head(205)}>PROVE IT.</div>
        </Slam>
        <Pop delay={12}>
          <div style={{ ...neo(COLORS.ink, 14, 18), padding: "24px 56px" }}>
            {/* /play, not bare verveq.com — the social short link drops
                straight into Career Path and carries ?ref attribution (f0f6b50).
                An off-platform promo pointing at the root is a scent break and
                a blind funnel. */}
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, color: COLORS.lime, letterSpacing: -1 }}>verveq.com/play</div>
          </div>
        </Pop>
        <Pop delay={22}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 4, color: COLORS.ink, opacity: 0.72 }}>
            THE DAILY FOOTBALL QUIZ
          </div>
        </Pop>
        <Fixture delay={30} />
        <Pop delay={36}>
          <Pill bg={COLORS.yellow} fg={COLORS.ink} size={26} rot={-1}>
            SEMI-FINAL · TONIGHT 8PM BST
          </Pill>
        </Pop>
      </Center>
    </Exit>
  );
};

export const SEMI_SCENES: Record<SKey, React.FC<SceneProps>> = {
  never: Never,
  notonce: NotOnce,
  susp: Susp,
  red: Red,
  ban: Ban,
  days: Days,
  hist: Hist,
  tonight: Tonight,
  ask: Ask,
  cta: Cta,
};

export { SCENES, START };
