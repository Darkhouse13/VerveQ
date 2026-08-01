import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Pill, Slam, Ground, Stripes, spr, wipe, inOut, countTo, W } from "./kit";
import { SceneKey } from "./timeline";

type SceneProps = { dur: number };

// shared: a scene-wide punch-out on the last frames so hard cuts feel intentional
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  const k = inOut(frame, dur, 6);
  return { opacity: k, transform: `scale(${0.985 + k * 0.015})` };
};

// ============================================================ HOOK
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const lines: { t: string; c: string; at: number }[] = [
    { t: "THINK", c: COLORS.cream, at: 0 },
    { t: "YOU KNOW", c: COLORS.cream, at: 16 },
    { t: "FOOTBALL?", c: COLORS.orange, at: 34 },
  ];
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.orange} ground={COLORS.ink} opacity={0.1} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 72, paddingRight: 72, gap: 8 }}>
        {lines.map((l) => (
          <Slam key={l.t} frame={frame} fps={fps} delay={l.at} from={1.5} rot={-2}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, lineHeight: 0.98, letterSpacing: -3, color: l.c, textShadow: l.c === COLORS.orange ? "none" : `6px 6px 0 ${COLORS.orange}` }}>
              {l.t}
            </div>
          </Slam>
        ))}
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.55 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ PROVE
const Prove: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const slash = wipe(frame, fps, 8, 14);
  const riser = interpolate(frame, [10, dur], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.cream} opacity={0.05} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} from={1.6} rot={2} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 230, letterSpacing: -6, color: COLORS.ink }}>PROVE IT.</div>
        </Slam>
        <div style={{ width: 620, height: 26, background: COLORS.orange, border: `4px solid ${COLORS.ink}`, marginTop: 18, transform: `scaleX(${slash})`, transformOrigin: "left" }} />
        <div style={{ marginTop: 60, fontFamily: FONTS.body, fontWeight: 500, fontSize: 46, color: COLORS.ink, opacity: 0.8, textAlign: "center", maxWidth: 820 }}>
          Prove you know more than your mates.
        </div>
      </div>
      {/* riser meter climbing into the drop */}
      <div style={{ position: "absolute", bottom: 90, left: 72, right: 72, height: 16, background: COLORS.card, border: `4px solid ${COLORS.ink}` }}>
        <div style={{ width: `${riser * 100}%`, height: "100%", background: COLORS.pink }} />
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ LOGO DROP
const Logo: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 10, 14);
  const eyebrow = spr(frame, fps, 16, 14);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream} />
      {/* color flash on the drop */}
      <div style={{ position: "absolute", inset: 0, background: COLORS.orange, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} from={1.7} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 280, letterSpacing: -8, color: COLORS.ink }}>VERVEQ</div>
        </Slam>
        <div style={{ width: 640, height: 30, background: COLORS.lime, border: `5px solid ${COLORS.ink}`, boxShadow: neoShadow(8), marginTop: 6, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 54, opacity: eyebrow, transform: `translateY(${(1 - eyebrow) * 20}px)` }}>
          <Pill bg={COLORS.ink} fg={COLORS.cream} size={34} rot={-1.5}>FOOTBALL TRIVIA · HEAD-TO-HEAD</Pill>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- mode card scaffold -----------------------------------------------------
const ModeCard: React.FC<{
  dur: number;
  index: number;
  label: string;
  tagline: string;
  accent: string;
  accentFg: string;
  dir: number; // entrance direction (-1 left, 1 right)
  children?: React.ReactNode; // the motif
}> = ({ dur, index, label, tagline, accent, accentFg, dir, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spr(frame, fps, 0, 13, 16);
  const exitK = inOut(frame, dur, 6);
  const slideIn = (1 - enter) * 900 * dir;
  const slideOut = (1 - exitK) * -160 * dir;
  return (
    <AbsoluteFill style={{ opacity: Math.min(1, enter * 2) }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={accent} ground={COLORS.cream} opacity={0.1} />
      </Ground>
      {/* index / count chip */}
      <div style={{ position: "absolute", top: 70, left: 72 }}>
        <Pill bg={accent} fg={accentFg} size={30} rot={-2}>{`MODE 0${index + 1} / 05`}</Pill>
      </div>
      <div style={{ position: "absolute", top: 70, right: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.ink, opacity: 0.4 }}>VERVEQ</div>

      <div style={{ position: "absolute", top: 300, left: 72, right: 72, transform: `translateX(${slideIn + slideOut}px)` }}>
        {/* accent block behind the label */}
        <div style={{ display: "inline-block", background: accent, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(14), padding: "10px 30px", transform: "rotate(-1.5deg)" }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: label.length > 8 ? 118 : 150, letterSpacing: -3, color: accentFg, lineHeight: 1 }}>{label}</div>
        </div>
        <div style={{ marginTop: 34, fontFamily: FONTS.body, fontWeight: 700, fontSize: 52, color: COLORS.ink }}>{tagline}</div>
      </div>

      {/* motif zone */}
      <div style={{ position: "absolute", top: 780, left: 72, right: 72, bottom: 160, transform: `translateX(${slideIn * 0.6}px)` }}>{children}</div>
    </AbsoluteFill>
  );
};

// small helper: element that pops at a local delay
const Pop: React.FC<{ delay?: number; damping?: number; from?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({ delay = 0, damping = 12, from = 0.5, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spr(frame, fps, delay, damping, 16);
  return <div style={{ ...style, transform: `scale(${from + (1 - from) * s})`, opacity: Math.min(1, s * 2) }}>{children}</div>;
};

// ============================================================ QUIZ
const Quiz: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const opts = ["A", "B", "C", "D"];
  const correct = 2;
  const reveal = frame >= 24;
  return (
    <ModeCard dur={dur} index={0} label="QUIZ" tagline="10 questions. Beat the clock." accent={COLORS.orange} accentFg={COLORS.white} dir={-1}>
      <div style={{ display: "flex", gap: 24, height: 150 }}>
        {opts.map((o, i) => {
          const on = reveal && i === correct;
          return (
            <Pop key={o} delay={6 + i * 4} style={{ flex: 1 }}>
              <div style={{ ...neo(on ? COLORS.lime : COLORS.card, 8, 14), height: 150, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 70, color: COLORS.ink }}>
                {on ? "✓" : o}
              </div>
            </Pop>
          );
        })}
      </div>
      <Pop delay={10} style={{ marginTop: 40 }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 2, color: COLORS.ink, opacity: 0.75 }}>
          FASTER ANSWERS SCORE MORE ⚡
        </div>
      </Pop>
    </ModeCard>
  );
};

// ============================================================ SURVIVAL
const Survival: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const livesLost = frame >= 26 ? 1 : 0;
  return (
    <ModeCard dur={dur} index={1} label="SURVIVAL" tagline="Name players by their initials." accent={COLORS.pink} accentFg={COLORS.white} dir={1}>
      <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <Pop delay={8} from={0.4}>
          <div style={{ ...neo(COLORS.yellow, 10, 16), width: 260, height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 120, color: COLORS.ink }}>
            M.K.
          </div>
        </Pop>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {[0, 1, 2].map((i) => (
              <Pop key={i} delay={12 + i * 3} from={0.3}>
                <div style={{ fontSize: 84, lineHeight: 1, color: i >= 3 - livesLost ? "transparent" : COLORS.red, textShadow: i >= 3 - livesLost ? `0 0 0 ${COLORS.ink}` : "none", opacity: i >= 3 - livesLost ? 0.25 : 1 }}>♥</div>
              </Pop>
            ))}
          </div>
          <Pop delay={16}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 38, letterSpacing: 2, color: COLORS.ink, opacity: 0.75 }}>3 LIVES · GO ON A STREAK</div>
          </Pop>
        </div>
      </div>
    </ModeCard>
  );
};

// ============================================================ CAREER PATH
const Career: React.FC<SceneProps> = ({ dur }) => {
  const clubs = ["BARCELONA", "PARIS SG", "INTER MIAMI"];
  return (
    <ModeCard dur={dur} index={2} label="CAREER PATH" tagline="Name him from his clubs." accent={COLORS.blue} accentFg={COLORS.white} dir={-1}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {clubs.map((c, i) => (
          <Pop key={c} delay={6 + i * 6} from={0.6}>
            <div style={{ ...neo(COLORS.card, 7, 12), height: 96, display: "flex", alignItems: "center", gap: 22, paddingLeft: 18, paddingRight: 24 }}>
              <div style={{ width: 60, height: 60, background: COLORS.blue, border: `3px solid ${COLORS.ink}`, borderRadius: 8, color: COLORS.white, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>{`0${i + 1}`}</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 54, color: COLORS.ink }}>{c}</div>
            </div>
          </Pop>
        ))}
        <Pop delay={26} from={0.3}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 90, color: COLORS.blue, textShadow: `5px 5px 0 ${COLORS.ink}`, marginTop: 6 }}>WHO IS HE? →</div>
        </Pop>
      </div>
    </ModeCard>
  );
};

// ============================================================ BLITZ
const Blitz: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const n = countTo(frame, 6, dur - 4, 60, 41);
  const shrink = interpolate(frame, [6, dur - 4], [1, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <ModeCard dur={dur} index={3} label="BLITZ" tagline="60 seconds. Go." accent={COLORS.yellow} accentFg={COLORS.ink} dir={1}>
      <div style={{ display: "flex", alignItems: "center", gap: 44 }}>
        <Pop delay={4} from={0.3}>
          <div style={{ ...neo(COLORS.ink, 12, 24), width: 300, height: 220, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, color: COLORS.yellow }}>{n}</div>
        </Pop>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, color: COLORS.ink, letterSpacing: -1 }}>SECONDS ⚡</div>
          <div style={{ height: 34, background: COLORS.card, border: `4px solid ${COLORS.ink}`, boxShadow: neoShadow(6) }}>
            <div style={{ width: `${shrink * 100}%`, height: "100%", background: COLORS.red }} />
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: COLORS.ink, opacity: 0.7 }}>HOW MANY CAN YOU HIT?</div>
        </div>
      </div>
    </ModeCard>
  );
};

// ============================================================ ARENA
const Arena: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const code = "K7X2QP".split("");
  return (
    <ModeCard dur={dur} index={4} label="ARENA" tagline="Live rooms. One code." accent={COLORS.green} accentFg={COLORS.white} dir={-1}>
      <div style={{ display: "flex", gap: 14, marginBottom: 34 }}>
        {code.map((ch, i) => (
          <Pop key={i} delay={5 + i * 3} from={0.3}>
            <div style={{ ...neo(COLORS.card, 7, 12), width: 128, height: 150, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 84, color: COLORS.ink }}>{ch}</div>
          </Pop>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <div style={{ display: "flex", gap: 14 }}>
          {[COLORS.orange, COLORS.pink, COLORS.blue, COLORS.lime].map((c, i) => {
            const on = frame >= 18 + i * 3;
            return <Pop key={i} delay={18 + i * 3} from={0.2}><div style={{ width: 74, height: 74, borderRadius: "50%", background: on ? c : COLORS.card, border: `4px solid ${COLORS.ink}`, boxShadow: neoShadow(5) }} /></Pop>;
          })}
        </div>
        <Pop delay={26}>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 2, color: COLORS.ink, opacity: 0.8 }}>1v1 · 2v2 · FFA</div>
        </Pop>
      </div>
    </ModeCard>
  );
};

// ============================================================ RANKS
const Ranks: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const tiers = [
    { t: "BRONZE", c: "hsl(28 60% 45%)" },
    { t: "SILVER", c: "hsl(0 0% 62%)" },
    { t: "GOLD", c: COLORS.yellow },
    { t: "PLATINUM", c: COLORS.blue },
  ];
  const elo = countTo(frame, 14, dur - 10, 1200, 2400);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.yellow} ground={COLORS.ink} opacity={0.09} />
      </Ground>
      <div style={{ position: "absolute", top: 130, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, letterSpacing: -3, color: COLORS.cream }}>CLIMB THE<br />RANKS</div>
        </Slam>
      </div>
      {/* tier ladder rising */}
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 470, display: "flex", alignItems: "flex-end", gap: 22, height: 520 }}>
        {tiers.map((tier, i) => {
          const s = spr(frame, fps, 10 + i * 8, 12, 16);
          const h = 180 + i * 100;
          return (
            <div key={tier.t} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, transform: `translateY(${(1 - s) * 60}px)`, opacity: Math.min(1, s * 2) }}>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 1, color: COLORS.cream }}>{tier.t}</div>
              <div style={{ width: "100%", height: h * s, background: tier.c, border: `5px solid ${COLORS.cream}`, borderRadius: 10, boxShadow: `6px 6px 0 ${COLORS.cream}` }} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", bottom: 150, left: 72, right: 72, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, color: COLORS.cream }}>Every game counts.</div>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 64, color: COLORS.lime }}>{elo} ELO</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ FREE
const Free: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.lime}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.lime} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <Slam frame={frame} fps={fps} from={1.5} rot={-2}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 210, letterSpacing: -5, color: COLORS.ink }}>FREE.</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={12} from={1.5} rot={1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 120, letterSpacing: -3, color: COLORS.ink }}>NO SIGN-UP.</div>
        </Slam>
        <div style={{ marginTop: 44, opacity: spr(frame, fps, 22, 14), transform: `translateY(${(1 - spr(frame, fps, 22, 14)) * 16}px)` }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 50, color: COLORS.ink }}>Play first. Claim a name after.</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 7], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 12, 14);
  const btn = spr(frame, fps, 26, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  const ticker = "QUIZ · SURVIVAL · CAREER PATH · BLITZ · ARENA · ".repeat(4);
  const scroll = (frame * 5) % 1200;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} from={1.8} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 200, lineHeight: 0.9, letterSpacing: -5, color: COLORS.cream, textShadow: `8px 8px 0 ${COLORS.orange}`, textAlign: "center" }}>
            SETTLE<br />IT.
          </div>
        </Slam>
        <div style={{ width: 700, height: 26, background: COLORS.orange, marginTop: 10, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 66, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.orange, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 74, letterSpacing: -1, padding: "30px 70px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>
            VERVEQ.COM
          </div>
        </div>
        <div style={{ marginTop: 50, fontFamily: FONTS.body, fontWeight: 500, fontSize: 42, color: COLORS.cream, opacity: 0.85 }}>A new football challenge every day.</div>
      </div>
      {/* mode ticker along the bottom */}
      <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
        <div style={{ display: "inline-block", transform: `translateX(${-scroll}px)`, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 32, letterSpacing: 3, color: COLORS.cream, opacity: 0.4 }}>{ticker}</div>
      </div>
    </AbsoluteFill>
  );
};

export const SCENE_COMPONENTS: Record<SceneKey, React.FC<SceneProps>> = {
  hook: Hook,
  prove: Prove,
  logo: Logo,
  quiz: Quiz,
  survival: Survival,
  career: Career,
  blitz: Blitz,
  arena: Arena,
  ranks: Ranks,
  free: Free,
  cta: Cta,
};
