import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Pill, Slam, Pop, Ground, Stripes, spr, wipe, inOut, countTo, shake } from "../kit";
import { DKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// mode chip pinned where the DAY chip lives in rematch — same connective tissue
const ModeChip: React.FC<{ accent?: string }> = ({ accent = COLORS.orange }) => (
  <div style={{ position: "absolute", top: 110, left: 72 }}>
    <div style={{ display: "inline-block", background: accent, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 3, padding: "16px 34px", border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(8), transform: "rotate(-2deg)" }}>
      THE DRAW
    </div>
  </div>
);

const Watermark: React.FC<{ light?: boolean }> = ({ light = true }) => (
  <div style={{ position: "absolute", top: 60, right: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: light ? COLORS.cream : COLORS.ink, opacity: 0.5 }}>VERVEQ</div>
);

// ============================================================ HOOK — 2,431 PTS.
// The law is "readable frame 0 with motion already underway" — so the score
// doesn't sit, it RACES: a slot-machine count from 617 that slams into 2,431
// at 0.67s. Frame 0 already reads as a big score; the spin is the catch.
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const score = countTo(frame, 0, 20, 617, 2431);
  const locked = frame >= 20;
  // a per-frame jitter while it spins, a decaying slam when it locks
  const jitter = locked ? 0 : Math.sin(frame * 3.1) * 6;
  const lockPunch = locked ? interpolate(frame, [20, 27], [1.1, 1], { extrapolateRight: "clamp" }) : 1;
  const sh = shake(frame, 20, 16, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.orange} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <ModeChip />
      {/* readable on frame 0 — and already moving */}
      <div style={{ position: "absolute", top: 540, left: 72, right: 72, transform: `scale(${lockPunch}) translateY(${jitter}px)` }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 250, lineHeight: 0.92, letterSpacing: -8, color: locked ? COLORS.cream : COLORS.orange }}>{score.toLocaleString("en-US")}<br /><span style={{ color: COLORS.cream }}>PTS.</span></div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 88, letterSpacing: -2, color: COLORS.orange, marginTop: 30, opacity: locked ? 1 : 0 }}>ONE TAP FROM GLORY.</div>
      </div>
      <Pop delay={38} style={{ position: "absolute", top: 1330, left: 72, right: 72 }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 50, color: COLORS.cream, opacity: 0.9 }}>He should have walked away.</div>
      </Pop>
      <Watermark />
    </AbsoluteFill>
  );
};

// ============================================================ RUN — the draft, compressed
const OFFERS = [
  { rating: 84, pos: "DEF", tag: "CLUB D", at: 10 },
  { rating: 87, pos: "MID", tag: "CLUB D", at: 18 },
  { rating: 82, pos: "ATT", tag: "CLUB F", at: 26 },
];
const PICK = 1; // the middle card joins the CLUB D spine

const Run: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const picked = frame >= 48;
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      <ModeChip accent={COLORS.blue} />
      <Watermark light={false} />
      <div style={{ position: "absolute", top: 300, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 110, lineHeight: 0.97, letterSpacing: -3, color: COLORS.ink }}>TODAY'S<br />BOARD.</div>
        </Slam>
      </div>
      {/* one draft row — pick 1 of 3 */}
      <div style={{ position: "absolute", top: 700, left: 72, right: 72, display: "flex", gap: 24 }}>
        {OFFERS.map((o, i) => {
          const isPick = i === PICK;
          const dim = picked && !isPick ? 0.35 : 1;
          const lift = picked && isPick ? -14 : 0;
          return (
            <Pop key={i} delay={o.at} from={0.55} style={{ flex: 1 }}>
              <div style={{ ...neo(isPick && picked ? COLORS.blue : COLORS.card, isPick && picked ? 12 : 8, 16), padding: "30px 24px", opacity: dim, transform: `rotate(${i === 0 ? -1.5 : i === 2 ? 1.5 : 0}deg) translateY(${lift}px)`, transition: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, color: isPick && picked ? COLORS.white : COLORS.ink }}>{o.rating}</div>
                <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 2, color: isPick && picked ? COLORS.white : COLORS.ink, opacity: 0.75 }}>{o.pos}</div>
                <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, padding: "8px 18px", borderRadius: 8 }}>{o.tag}</div>
              </div>
            </Pop>
          );
        })}
      </div>
      {/* the chain lights up */}
      <div style={{ position: "absolute", top: 1240, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 62, 13) }}>
        <div style={{ display: "inline-block", background: COLORS.blue, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, letterSpacing: -1, padding: "18px 44px", border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(9), transform: "rotate(-2deg)" }}>
          CLUB D SPINE ×1.33
        </div>
      </div>
      <div style={{ position: "absolute", top: 1400, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 74, 13) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 44, color: COLORS.ink, opacity: 0.8 }}>Draft 6 from 18. Chains multiply.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ GAUNTLET — F1-F3 fall
const FIXTURES = [
  { label: "F1 · WALL", need: 350, at: 8 },
  { label: "F2 · BLITZ", need: 443, at: 26 },
  { label: "F3 · ENGINE", need: 560, at: 44 },
];

const Gauntlet: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const total = countTo(frame, 8, 78, 612, 2431);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.green} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <ModeChip accent={COLORS.green} />
      <Watermark />
      <div style={{ position: "absolute", top: 290, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, letterSpacing: -3, color: COLORS.cream }}>THE GAUNTLET.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 500, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 26 }}>
        {FIXTURES.map((fx, i) => (
          <Pop key={fx.label} delay={fx.at} from={0.6}>
            <div style={{ ...neo(COLORS.card, 8, 14), padding: "26px 34px", display: "flex", justifyContent: "space-between", alignItems: "center", transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)` }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 2, color: COLORS.ink }}>{fx.label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 48, color: COLORS.ink, opacity: 0.55 }}>{fx.need}</div>
                <div style={{ background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 40, padding: "10px 24px", border: `4px solid ${COLORS.ink}`, transform: "rotate(-4deg)" }}>CLEARED</div>
              </div>
            </div>
          </Pop>
        ))}
      </div>
      {/* the counter climbs */}
      <div style={{ position: "absolute", top: 1150, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 4, color: COLORS.cream, opacity: 0.6 }}>TOTAL</div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 230, letterSpacing: -6, color: COLORS.lime, lineHeight: 1 }}>{total.toLocaleString("en-US")}</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ FORK — bank or push
const Fork: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.orange} ground={COLORS.cream} opacity={0.06} />
      </Ground>
      <ModeChip />
      <Watermark light={false} />
      <div style={{ position: "absolute", top: 300, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} damping={10} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, letterSpacing: -4, color: COLORS.ink }}>YOUR CALL.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 560, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 40 }}>
        <Slam frame={frame} fps={fps} delay={12} from={1.3} rot={-1.5}>
          <div style={{ ...neo(COLORS.green, 14, 20), padding: "44px 46px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -2, color: COLORS.white }}>BANK</div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 42, letterSpacing: 2, color: COLORS.white, marginTop: 10, opacity: 0.95 }}>KEEP 2,431 PTS</div>
          </div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={26} from={1.3} rot={1.5}>
          <div style={{ ...neo(COLORS.red, 14, 20), padding: "44px 46px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -2, color: COLORS.white }}>PUSH</div>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 42, letterSpacing: 2, color: COLORS.white, marginTop: 10, opacity: 0.95 }}>F4 CLEARS AT 708</div>
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 1460, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 56, 13) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, color: COLORS.ink, opacity: 0.85 }}>Bust and you keep 15%. That's the game.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ COUNT — 3-2-1, the viewer answers
const NUMS = [
  { n: "3", at: 0, color: COLORS.lime },
  { n: "2", at: 30, color: COLORS.yellow },
  { n: "1", at: 60, color: COLORS.pink },
];

const Count: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const active = NUMS.filter((x) => frame >= x.at).pop() ?? NUMS[0];
  const pulse = Math.sin(frame / 4) * 0.5 + 0.5; // BANK/PUSH pills trade emphasis
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={active.color} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 44, letterSpacing: 5, color: COLORS.cream }}>LOCK YOUR CALL</div>
      </div>
      <Slam key={active.n} frame={frame} fps={fps} delay={active.at} from={2.0} damping={9}>
        <div style={{ position: "absolute", top: 480, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 640, lineHeight: 1, color: active.color, textShadow: `14px 14px 0 ${COLORS.cream}` }}>{active.n}</div>
      </Slam>
      <div style={{ position: "absolute", top: 1330, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 40 }}>
        <div style={{ transform: `scale(${1 + pulse * 0.08})` }}>
          <Pill bg={COLORS.green} fg={COLORS.white} size={46} rot={-2}>BANK</Pill>
        </div>
        <div style={{ transform: `scale(${1 + (1 - pulse) * 0.08})` }}>
          <Pill bg={COLORS.red} fg={COLORS.white} size={46} rot={2}>PUSH</Pill>
        </div>
      </div>
      <div style={{ position: "absolute", top: 1530, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.cream, opacity: 0.75 }}>Comment your call. No edits.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ REVEAL — he pushed. busted.
const Reveal: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const busted = frame >= 34;
  const sh = shake(frame, 34, 18, 11);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      {busted ? (
        <Ground color={COLORS.ink}>
          {/* the app's bust aesthetic — red/black hazard stripes */}
          <div style={{ position: "absolute", inset: -40, opacity: 0.25, backgroundImage: `repeating-linear-gradient(45deg, ${COLORS.red} 0 44px, transparent 44px 110px)` }} />
        </Ground>
      ) : (
        <Ground color={COLORS.cream} />
      )}
      {!busted ? (
        <div style={{ position: "absolute", top: 800, left: 0, right: 0, textAlign: "center" }}>
          <Slam frame={frame} fps={fps} from={1.5} damping={10}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 190, letterSpacing: -5, color: COLORS.ink }}>HE PUSHED.</div>
          </Slam>
        </div>
      ) : (
        <>
          <div style={{ position: "absolute", top: 640, left: 0, right: 0, display: "flex", justifyContent: "center", transform: "rotate(-8deg)" }}>
            <Slam frame={frame} fps={fps} delay={34} from={1.8} damping={8}>
              <div style={{ background: COLORS.red, border: `7px solid ${COLORS.ink}`, boxShadow: `12px 12px 0 ${COLORS.cream}`, padding: "26px 64px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 180, letterSpacing: -4, color: COLORS.white }}>BUSTED.</div>
            </Slam>
          </div>
          <Pop delay={62} style={{ position: "absolute", top: 1080, left: 0, right: 0, textAlign: "center" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 86, letterSpacing: -2, color: COLORS.cream }}>KEPT 365.</div>
            <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.cream, opacity: 0.75, marginTop: 14 }}>Scraps.</div>
          </Pop>
        </>
      )}
    </AbsoluteFill>
  );
};

// ============================================================ CTA — would YOU have banked?
const LINE = [
  { bg: COLORS.lime, mark: "✓", at: 30 },
  { bg: COLORS.lime, mark: "✓", at: 36 },
  { bg: COLORS.lime, mark: "✓", at: 42 },
  { bg: COLORS.red, mark: "✕", at: 48 },
];

const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 58, 14);
  const btn = spr(frame, fps, 66, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.blue} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 128, letterSpacing: -3, color: COLORS.white, textShadow: `9px 9px 0 ${COLORS.ink}`, textAlign: "center", lineHeight: 1.0 }}>WOULD YOU<br />HAVE BANKED?</div>
        </Slam>
        {/* his line, in the share grammar */}
        <div style={{ display: "flex", gap: 22, marginTop: 56 }}>
          {LINE.map((c, i) => (
            <Pop key={i} delay={c.at} from={0.4}>
              <div style={{ width: 110, height: 110, background: c.bg, border: `6px solid ${COLORS.ink}`, borderRadius: 14, boxShadow: neoShadow(8), display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, color: COLORS.ink, transform: `rotate(${i % 2 === 0 ? -3 : 3}deg)` }}>{c.mark}</div>
            </Pop>
          ))}
        </div>
        <div style={{ width: 680, height: 24, background: COLORS.ink, marginTop: 48, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 56, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, letterSpacing: -1, padding: "28px 58px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM/DRAW</div>
        </div>
        <div style={{ marginTop: 44, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white, opacity: spr(frame, fps, 80, 13) }}>One board. Everyone. Daily. Free.</div>
      </div>
    </AbsoluteFill>
  );
};

export const DRAW_SCENES: Record<DKey, React.FC<SceneProps>> = {
  hook: Hook,
  run: Run,
  gauntlet: Gauntlet,
  fork: Fork,
  count: Count,
  reveal: Reveal,
  cta: Cta,
};
