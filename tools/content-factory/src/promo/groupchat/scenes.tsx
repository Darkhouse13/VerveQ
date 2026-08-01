import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, neoShadow, neo, Slam, Pop, Ground, Stripes, spr, wipe, inOut, countTo, shake } from "../kit";
import { GKey } from "./timeline";

type SceneProps = { dur: number };
const useExit = (dur: number) => {
  const frame = useCurrentFrame();
  return { opacity: inOut(frame, dur, 6) };
};

// ---- chat furniture ---------------------------------------------------------
// A neo-brutalist chat bubble. One squared-off bottom corner stands in for the
// tail so it still reads as a message without leaving the brand language.
const Bubble: React.FC<{
  at: number;
  side: "left" | "right";
  sender?: string;
  bg?: string;
  fg?: string;
  size?: number;
  rot?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ at, side, sender, bg, fg, size = 46, rot = 0, style, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // at <= 0 → pre-landed (readable on frame 0), with a 4-frame settle so it
  // still has life; otherwise a slam entrance.
  const s = at <= 0 ? 1 : spr(frame, fps, at, 10, 14);
  const settle = at <= 0 ? interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" }) : 1;
  const ground = bg ?? (side === "right" ? COLORS.blue : COLORS.card);
  const ink = fg ?? (side === "right" ? COLORS.white : COLORS.ink);
  return (
    <div style={{ display: "flex", justifyContent: side === "right" ? "flex-end" : "flex-start", ...style }}>
      <div style={{ maxWidth: 800, transform: `scale(${(1.35 - 0.35 * s) * settle}) rotate(${rot * (1 - s) + rot * 0.3}deg)`, opacity: at <= 0 ? 1 : Math.min(1, s * 2), transformOrigin: side === "right" ? "bottom right" : "bottom left" }}>
        {sender ? <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: COLORS.ink, opacity: 0.55, marginBottom: 8, textAlign: side === "right" ? "right" : "left" }}>{sender}</div> : null}
        <div
          style={{
            background: ground,
            color: ink,
            border: `5px solid ${COLORS.ink}`,
            borderRadius: 26,
            borderBottomLeftRadius: side === "left" ? 6 : 26,
            borderBottomRightRadius: side === "right" ? 6 : 26,
            boxShadow: neoShadow(8),
            padding: "26px 36px",
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 1.15,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// chat header bar — the "THE BOYS FC" title strip, shared by hook + pileon
const ChatHeader: React.FC<{ unread: number }> = ({ unread }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 150, background: COLORS.ink, borderBottom: `6px solid ${COLORS.ink}`, display: "flex", alignItems: "center", justifyContent: "space-between", paddingLeft: 60, paddingRight: 60 }}>
    <div>
      <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 52, letterSpacing: -1, color: COLORS.cream }}>THE BOYS FC</div>
      <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 24, letterSpacing: 2, color: COLORS.cream, opacity: 0.55, marginTop: 4 }}>SAME ARGUMENT SINCE 2019</div>
    </div>
    <div style={{ minWidth: 96, height: 96, borderRadius: 999, background: COLORS.pink, border: `5px solid ${COLORS.cream}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONTS.mono, fontWeight: 700, fontSize: unread > 99 ? 34 : 40, color: COLORS.white, padding: "0 14px" }}>
      {unread > 999 ? "999+" : unread}
    </div>
  </div>
);

// ============================================================ HOOK — the take
const Hook: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const exit = useExit(dur);
  const sh = shake(frame, 52, 10, 8);
  const landed = [0, 13, 26, 52].filter((at) => frame >= at).length;
  const typing = frame >= 36 && frame < 52;
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.06} />
      </Ground>
      <ChatHeader unread={216 + landed} />
      <div style={{ position: "absolute", top: 230, left: 56, right: 56, display: "flex", flexDirection: "column", gap: 34 }}>
        {/* readable on frame 0 — the rage-bait take IS the hook */}
        <Bubble at={0} side="left" sender="DAVE" size={62}>He's not even top 10 all time. Sorry.</Bubble>
        <Bubble at={13} side="right" rot={2}>BLOCKED.</Bubble>
        <Bubble at={26} side="left" sender="JAMIE" rot={-2}>43 trophies mate. FORTY. THREE.</Bubble>
        {typing ? (
          <div style={{ display: "flex" }}>
            <div style={{ ...neo(COLORS.card, 6, 26), padding: "26px 34px", display: "flex", gap: 14 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 18, height: 18, borderRadius: 999, background: COLORS.ink, opacity: 0.25 + 0.75 * Math.abs(Math.sin((frame - 36) / 5 + i)) }} />
              ))}
            </div>
          </div>
        ) : null}
        {frame >= 52 ? <Bubble at={52} side="left" sender="MO" rot={-1.5}>you watch one league and it shows</Bubble> : null}
      </div>
      <div style={{ position: "absolute", bottom: 54, left: 60, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.ink, opacity: 0.4 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ PILE-ON — meltdown
const RAIN: { t: string; side: "left" | "right"; at: number; y: number; x: number; rot: number; bg?: string; fg?: string }[] = [
  { t: "WHO WON MORE? EXACTLY.", side: "left", at: 0, y: 190, x: 0, rot: -3 },
  { t: "you weren't even born in 2005", side: "right", at: 9, y: 330, x: -20, rot: 2 },
  { t: "GOOGLE IT", side: "left", at: 17, y: 470, x: 30, rot: -5 },
  { t: "source???", side: "right", at: 24, y: 600, x: -40, rot: 4 },
  { t: "ask your dad", side: "left", at: 31, y: 730, x: 10, rot: -2 },
  { t: "IT'S NOT EVEN CLOSE", side: "right", at: 37, y: 860, x: -10, rot: 5 },
  { t: "im done with this chat", side: "left", at: 42, y: 990, x: 40, rot: -6 },
  { t: "ADMIN. MUTE HIM.", side: "right", at: 47, y: 1120, x: -30, rot: 3, bg: COLORS.pink, fg: COLORS.white },
  { t: "END OF DISCUSSION", side: "left", at: 51, y: 1250, x: 20, rot: -4, bg: COLORS.yellow, fg: COLORS.ink },
  { t: "nothing was discussed", side: "right", at: 55, y: 1380, x: 0, rot: 2 },
];

const PileOn: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  // the last landings rattle the screen; the whole chat slowly zooms as it melts
  const sh = RAIN.filter((b) => b.at >= 31).reduce(
    (a, b) => {
      const s = shake(frame, b.at, 9, 7);
      return { x: a.x + s.x, y: a.y + s.y };
    },
    { x: 0, y: 0 }
  );
  const zoom = 1 + interpolate(frame, [40, dur], [0, 0.05], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const unread = countTo(frame, 0, 60, 220, 340);
  return (
    <AbsoluteFill style={{ ...exit }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.pink} ground={COLORS.cream} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom}) translate(${sh.x}px, ${sh.y}px)` }}>
        <ChatHeader unread={unread} />
        {RAIN.map((b) =>
          frame >= b.at ? (
            <div key={b.t} style={{ position: "absolute", top: b.y, left: 56 + b.x, right: 56 - b.x }}>
              <Bubble at={b.at} side={b.side} rot={b.rot} bg={b.bg} fg={b.fg} size={44}>{b.t}</Bubble>
            </div>
          ) : null
        )}
      </div>
      <div style={{ position: "absolute", bottom: 130, left: 0, right: 0, textAlign: "center", opacity: spr(frame, fps, 58, 14) }}>
        <div style={{ display: "inline-block", background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, padding: "16px 36px", border: `4px solid ${COLORS.cream}`, boxShadow: neoShadow(7), transform: "rotate(-2deg)" }}>
          EVERY. SINGLE. WEEK.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================================ SNAP — the verdict on the chat
const Snap: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 13, 16, 10);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.red} ground={COLORS.ink} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 560, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.45} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 124, letterSpacing: -3, lineHeight: 0.98, color: COLORS.cream }}>4,000 MESSAGES.</div>
        </Slam>
        <Slam frame={frame} fps={fps} delay={13} from={1.7} damping={9} rot={2}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 158, letterSpacing: -4, lineHeight: 0.95, color: COLORS.orange, textShadow: `8px 8px 0 ${COLORS.cream}`, marginTop: 18 }}>ZERO<br />ANSWERS.</div>
        </Slam>
      </div>
      <div style={{ position: "absolute", top: 60, left: 72, fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, letterSpacing: 4, color: COLORS.cream, opacity: 0.5 }}>VERVEQ</div>
    </AbsoluteFill>
  );
};

// ============================================================ SCORE — the receipt
const Score: React.FC<SceneProps> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = useExit(dur);
  const sh = shake(frame, 38, 14, 10);
  const stamp = spr(frame, fps, 38, 9, 14);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={COLORS.blue} ground={COLORS.cream} opacity={0.08} />
      </Ground>
      <div style={{ position: "absolute", top: 250, left: 72, right: 72 }}>
        <Slam frame={frame} fps={fps} from={1.4} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 122, letterSpacing: -3, lineHeight: 0.96, color: COLORS.ink }}>ONE QUIZ<br />SETTLES IT.</div>
        </Slam>
      </div>
      {/* the duel receipt */}
      <div style={{ position: "absolute", top: 720, left: 72, right: 72 }}>
        <Pop delay={12} from={0.7}>
          <div style={{ ...neo(COLORS.card, 12, 18), padding: "40px 48px", position: "relative" }}>
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 28, letterSpacing: 3, color: COLORS.ink, opacity: 0.5 }}>FINAL SCORE</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 14 }}>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, color: COLORS.ink }}>YOU</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 130, color: COLORS.blue }}>9</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, color: COLORS.ink, opacity: 0.5 }}>—</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 130, color: COLORS.pink }}>4</div>
              <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 66, color: COLORS.ink }}>DAVE</div>
            </div>
            {/* the rubber stamp */}
            <div style={{ position: "absolute", right: 30, top: -46, transform: `rotate(-10deg) scale(${0.5 + stamp * 0.5})`, opacity: Math.min(1, stamp * 2) }}>
              <div style={{ background: COLORS.lime, border: `6px solid ${COLORS.ink}`, boxShadow: neoShadow(8), padding: "14px 32px", fontFamily: FONTS.head, fontWeight: 700, fontSize: 58, letterSpacing: -1, color: COLORS.ink }}>SETTLED ✓</div>
            </div>
          </div>
        </Pop>
        <Pop delay={52} style={{ marginTop: 44 }}>
          <div style={{ fontFamily: FONTS.body, fontWeight: 700, fontSize: 48, color: COLORS.ink, textAlign: "center" }}>Screenshot it. Send it. Enjoy the silence.</div>
        </Pop>
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
  const btn = spr(frame, fps, 38, 11, 18);
  const pulse = 1 + Math.sin(frame / 6) * 0.03;
  return (
    <AbsoluteFill>
      <Ground color={COLORS.pink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.white, opacity: flash }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <Slam frame={frame} fps={fps} delay={4} from={1.6} damping={9} rot={-1.5}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 168, lineHeight: 0.92, letterSpacing: -5, color: COLORS.white, textShadow: `9px 9px 0 ${COLORS.ink}`, textAlign: "center" }}>END THE<br />ARGUMENT.</div>
        </Slam>
        <div style={{ width: 680, height: 24, background: COLORS.ink, marginTop: 26, transform: `scaleX(${bar})`, transformOrigin: "center" }} />
        <div style={{ marginTop: 60, transform: `scale(${(0.6 + btn * 0.4) * pulse})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ background: COLORS.ink, color: COLORS.cream, fontFamily: FONTS.head, fontWeight: 700, fontSize: 72, letterSpacing: -1, padding: "28px 66px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
        </div>
        <div style={{ marginTop: 46, fontFamily: FONTS.body, fontWeight: 700, fontSize: 42, color: COLORS.white, opacity: 0.95 }}>Duels · send a link · free, no sign-up</div>
      </div>
    </AbsoluteFill>
  );
};

export const GROUPCHAT_SCENES: Record<GKey, React.FC<SceneProps>> = {
  hook: Hook,
  pileon: PileOn,
  snap: Snap,
  score: Score,
  cta: Cta,
};
