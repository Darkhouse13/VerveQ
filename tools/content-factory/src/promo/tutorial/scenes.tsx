import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { TKey, SHUTTER_AT } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// shared step scaffolding: chip top-left, statement, dry footnote
const StepChip: React.FC<{ n: number; fg: string; bg: string }> = ({ n, fg, bg }) => (
  <div style={{ display: "inline-block", background: bg, color: fg, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 40, letterSpacing: 4, padding: "14px 34px", border: `5px solid ${COLORS.ink}`, borderRadius: 12, boxShadow: neoShadow(7) }}>
    STEP {n} / 3
  </div>
);

// ============================================================ HOOK
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 6], [1.04, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", top: 470, left: 72, right: 72, transform: `scale(${settle})` }}>
        {/* frame-0 readable: the promise IS the hook */}
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 112, lineHeight: 0.98, letterSpacing: -3, color: COLORS.ink }}>
          HOW TO WIN<br />ANY FOOTBALL<br />ARGUMENT.
        </div>
        <div style={{ marginTop: 44, opacity: spr(frame, fps, 18, 13) }}>
          <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, padding: "14px 32px" }}>
            A TUTORIAL. WORKS EVERY TIME.
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.ink, opacity: 0.4 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ STEP 1 — STOP TALKING.
const Step1: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.blue}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.blue} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 300, left: 72 }}>
        <StepChip n={1} fg={COLORS.ink} bg={COLORS.card} />
      </div>
      <div style={{ position: "absolute", top: 560, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} delay={6} from={1.5} damping={10} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 168, lineHeight: 0.94, letterSpacing: -5, color: COLORS.white, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
            STOP<br />TALKING.
          </div>
        </Slam>
        <div style={{ marginTop: 60, fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, color: COLORS.white, opacity: spr(frame, fps, 30, 13) }}>
          Words have never settled anything.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ STEP 2 — SEND ONE LINK.
const Step2: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const fly = spr(frame, fps, 26, 13, 18);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.yellow}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.yellow} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 300, left: 72 }}>
        <StepChip n={2} fg={COLORS.cream} bg={COLORS.ink} />
      </div>
      <div style={{ position: "absolute", top: 560, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} delay={6} from={1.5} damping={10} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 168, lineHeight: 0.94, letterSpacing: -5, color: COLORS.ink, textShadow: `9px 9px 0 ${COLORS.white}` }}>
            SEND<br />ONE LINK.
          </div>
        </Slam>
      </div>
      {/* the link, sent — slides in like a message bubble */}
      <div style={{ position: "absolute", top: 1130, left: 72, right: 72, transform: `translateX(${(1 - fly) * 700}px)`, opacity: Math.min(1, fly * 2) }}>
        <div style={{ display: "inline-block", background: COLORS.card, border: `5px solid ${COLORS.ink}`, borderRadius: 22, boxShadow: neoShadow(9), padding: "26px 40px", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 46, color: COLORS.blue }}>
          verveq.com/play ↗
        </div>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, color: COLORS.ink, opacity: 0.6, marginTop: 16 }}>delivered ✓✓</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ STEP 3 — SCREENSHOT THE RESULT.
const Step3: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const flash = frame >= SHUTTER_AT && frame < SHUTTER_AT + 5 ? interpolate(frame, [SHUTTER_AT, SHUTTER_AT + 5], [0.9, 0]) : 0;
  const snapped = frame >= SHUTTER_AT;
  const sh = shake(frame, SHUTTER_AT, 10, 8);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.pink}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.pink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 300, left: 72 }}>
        <StepChip n={3} fg={COLORS.ink} bg={COLORS.card} />
      </div>
      <div style={{ position: "absolute", top: 490, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} delay={6} from={1.4} damping={11}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 128, lineHeight: 0.95, letterSpacing: -4, color: COLORS.white, textShadow: `8px 8px 0 ${COLORS.ink}` }}>
            SCREENSHOT<br />THE RESULT.
          </div>
        </Slam>
      </div>
      {/* the scorecard — becomes a "photo" at the shutter */}
      <div style={{ position: "absolute", top: 920, left: 110, right: 110, transform: snapped ? "rotate(-2.5deg) scale(0.96)" : "none", transition: "none" }}>
        <Pop delay={14} damping={13} from={0.7}>
          <div style={{ ...neo(COLORS.card, 12, 20), padding: snapped ? "44px 44px 76px" : "44px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, color: COLORS.ink }}>YOU</div>
              <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 96, color: COLORS.ink }}>9 – 4</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, color: COLORS.ink, opacity: 0.55 }}>DAVE</div>
            </div>
            {snapped && (
              <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: COLORS.ink, opacity: 0.5 }}>
                SAVED TO CAMERA ROLL
              </div>
            )}
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", top: 1400, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, SHUTTER_AT + 12, 13) }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 36, letterSpacing: 2, color: COLORS.white }}>attach. send. mute.</div>
      </div>
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

// ============================================================ DONE — the deadpan
const Done: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 5], [1.02, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ ...exit }}>
      {/* dead-quiet cream frame — the music drops out with it */}
      <Ground color={COLORS.cream} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${settle})` }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, lineHeight: 1.15, letterSpacing: -2, color: COLORS.ink, textAlign: "center" }}>
          that's it.<br />that's the tutorial.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ CTA
const Cta: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const bar = wipe(frame, fps, 30, 14);
  const btn = spr(frame, fps, 40, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.blue, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 170, lineHeight: 0.92, letterSpacing: -5, color: COLORS.blue, textShadow: `10px 10px 0 ${COLORS.cream}`, textAlign: "center" }}>CLASS<br />DISMISSED.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.blue, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.blue, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 64, letterSpacing: -1, padding: "28px 60px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM/PLAY</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.cream }}>Free · no sign-up · step 1 is optional</div>
      </div>
    </AbsoluteFill>
  );
};

export const TUTORIAL_SCENES: Record<TKey, React.FC<SceneProps>> = {
  hook: Hook,
  step1: Step1,
  step2: Step2,
  step3: Step3,
  done: Done,
  cta: Cta,
};
