import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Slam, Pop, Ground, Stripes, spr, wipe, inOut, shake } from "../kit";
import { LKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// typewriter for the form fields (same idiom as breaking's headline)
const Type: React.FC<{ text: string; start: number; cps?: number; style?: React.CSSProperties }> = ({ text, start, cps = 1.6, style }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.floor((frame - start) * cps));
  return <span style={style}>{text.slice(0, n)}</span>;
};

// ============================================================ DECREE
const Decree: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const settle = interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" });
  const sh = shake(frame, 40, 12, 9);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.blue}>
        <Stripes frame={frame} color={COLORS.white} ground={COLORS.blue} opacity={0.09} />
      </Ground>
      {/* readable on frame 0 — the absurd premise IS the hook */}
      <div style={{ position: "absolute", top: 420, left: 72, right: 72, transform: `scale(${settle})` }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, padding: "14px 32px" }}>
          ⚠ PUBLIC NOTICE
        </div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 118, lineHeight: 0.97, letterSpacing: -3, color: COLORS.white, textShadow: `7px 7px 0 ${COLORS.ink}`, marginTop: 40 }}>
          FOOTBALL OPINIONS<br />NOW REQUIRE<br />A LICENSE.
        </div>
      </div>
      <div style={{ position: "absolute", top: 1220, left: 72, transform: `rotate(-6deg) scale(${0.5 + spr(frame, fps, 40, 9, 14) * 0.5})`, opacity: Math.min(1, spr(frame, fps, 40, 9, 14) * 2) }}>
        <div style={{ display: "inline-block", background: COLORS.red, color: COLORS.white, fontFamily: FONTS.head, fontWeight: 700, fontSize: 60, letterSpacing: -1, padding: "14px 36px", border: `6px solid ${COLORS.white}`, boxShadow: `8px 8px 0 ${COLORS.ink}` }}>
          EFFECTIVE IMMEDIATELY.
        </div>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.white, opacity: 0.6 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ---- the license card ---------------------------------------------------------
const HOLO = [COLORS.orange, COLORS.pink, COLORS.blue, COLORS.lime, COLORS.yellow];

const LicenseCard: React.FC<{ name: string; status: string; statusColor: string; typed?: boolean }> = ({ name, status, statusColor, typed }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ ...neo(COLORS.card, 14, 22), padding: "44px 48px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `5px solid ${COLORS.ink}`, paddingBottom: 22 }}>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 54, letterSpacing: -1, color: COLORS.ink }}>VERVEQ FAN LICENSE</div>
        {/* the "hologram" — flickers through brand accents only */}
        <div style={{ width: 54, height: 54, borderRadius: "50%", background: HOLO[Math.floor(frame / 8) % HOLO.length], border: `4px solid ${COLORS.ink}` }} />
      </div>
      <div style={{ display: "flex", gap: 40, marginTop: 34 }}>
        {/* photo box */}
        <div style={{ width: 220, height: 270, background: COLORS.cream, border: `5px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 130, color: COLORS.ink, opacity: 0.3 }}>?</div>
        </div>
        {/* fields */}
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 38, color: COLORS.ink, display: "flex", flexDirection: "column", gap: 26, paddingTop: 8 }}>
          <div>NAME: {typed ? <Type text={name} start={14} /> : name}</div>
          <div>CLASS: {typed ? <Type text="FOOTBALL" start={34} /> : "FOOTBALL"}</div>
          <div>KNOWS BALL: {typed ? <Type text="TBD" start={52} /> : "NO"}</div>
          <div style={{ color: statusColor }}>STATUS: {typed ? <Type text={status} start={64} /> : status}</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================ CARD — application pending
const Card: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.06} />
      </Ground>
      <div style={{ position: "absolute", top: 220, left: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} damping={12} rot={-1.5}>
          <div style={{ display: "inline-block", background: COLORS.blue, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(12), padding: "12px 34px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -1, color: COLORS.white }}>YOUR APPLICATION:</div>
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 480, left: 72, right: 72 }}>
        <Pop delay={8} damping={13} from={0.75}>
          <LicenseCard name="YOU" status="PENDING…" statusColor={COLORS.orange} typed />
        </Pop>
      </div>
      <div style={{ position: "absolute", top: 1250, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 74, 13) }}>
        <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.ink }}>Talking a good game doesn't count.</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ REQS — the checklist
const REQS = [
  { t: "SCORE 7/10 OR BETTER", at: 14 },
  { t: "NAME HIM FROM HIS CLUBS", at: 38 },
  { t: "SURVIVE 10 ROUNDS", at: 62 },
];

const Reqs: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.yellow}>
        <Stripes frame={frame} color={COLORS.ink} ground={COLORS.yellow} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 240, left: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} damping={12} rot={-1.5}>
          <div style={{ display: "inline-block", background: COLORS.ink, boxShadow: neoShadow(10), padding: "14px 36px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 96, letterSpacing: -2, color: COLORS.cream }}>TO QUALIFY:</div>
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 540, left: 72, right: 72, display: "flex", flexDirection: "column", gap: 34 }}>
        {REQS.map((r) => {
          const checked = frame >= r.at + 10;
          return (
            <Pop key={r.t} delay={r.at} damping={13} from={0.65}>
              <div style={{ ...neo(COLORS.card, 9, 16), display: "flex", alignItems: "center", gap: 30, padding: "30px 36px" }}>
                <div style={{ width: 80, height: 80, flexShrink: 0, background: checked ? COLORS.lime : COLORS.cream, border: `5px solid ${COLORS.ink}`, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, color: COLORS.ink }}>
                  {checked ? "✓" : ""}
                </div>
                <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, letterSpacing: -1, color: COLORS.ink }}>{r.t}</div>
              </div>
            </Pop>
          );
        })}
      </div>
      <div style={{ position: "absolute", top: 1270, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 78, 13) }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 2, color: COLORS.ink, opacity: 0.75 }}>QUIZ · CAREER PATH · SURVIVAL</div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ DENIED — dave's application
const Denied: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const stamp = spr(frame, fps, 22, 8, 14);
  const sh = shake(frame, 22, 18, 11);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.red} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 240, left: 72 }}>
        <Slam frame={frame} fps={fps} from={1.35} damping={12} rot={-1.5}>
          <div style={{ display: "inline-block", background: COLORS.red, border: `6px solid ${COLORS.cream}`, boxShadow: `10px 10px 0 ${COLORS.cream}`, padding: "12px 34px" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 84, letterSpacing: -1, color: COLORS.white }}>DAVE'S APPLICATION:</div>
          </div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 500, left: 72, right: 72 }}>
        <Pop delay={6} damping={13} from={0.75}>
          <div style={{ position: "relative" }}>
            <LicenseCard name="DAVE" status="UNPROVEN" statusColor={COLORS.red} />
            {/* the stamp */}
            <div style={{ position: "absolute", top: 90, left: 0, right: 0, display: "flex", justifyContent: "center", transform: `rotate(-14deg) scale(${0.5 + stamp * 0.5})`, opacity: Math.min(1, stamp * 2) }}>
              <div style={{ background: "transparent", border: `12px solid ${COLORS.red}`, borderRadius: 14, padding: "10px 40px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 150, letterSpacing: 2, color: COLORS.red }}>DENIED</div>
            </div>
          </div>
        </Pop>
      </div>
      <div style={{ position: "absolute", top: 1280, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 46, 13) }}>
        <div style={{ display: "inline-block", background: COLORS.cream, color: COLORS.ink, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 38, letterSpacing: 2, padding: "16px 36px", border: `5px solid ${COLORS.red}`, transform: "rotate(-2deg)" }}>
          REASON: VIBES ONLY.
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
      <div style={{ position: "absolute", inset: 0, background: COLORS.yellow, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.7} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 200, lineHeight: 0.92, letterSpacing: -6, color: COLORS.yellow, textShadow: `10px 10px 0 ${COLORS.cream}`, textAlign: "center" }}>EARN<br />YOURS.</div>
        </Slam>
        <div style={{ width: 660, height: 24, background: COLORS.yellow, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.yellow, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.cream }}>Free · no sign-up · results are final</div>
      </div>
    </AbsoluteFill>
  );
};

export const LICENSE_SCENES: Record<LKey, React.FC<SceneProps>> = {
  decree: Decree,
  card: Card,
  reqs: Reqs,
  denied: Denied,
  cta: Cta,
};
