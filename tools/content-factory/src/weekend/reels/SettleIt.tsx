// CF-WEEKEND R1 — "SETTLE IT". The group-chat argument, escalating over real
// FT receipts, unresolved on screen (the law: the reel IS the game — the
// product appears only as the payoff frame). Personas are canon: DAVE / JAMIE
// / MO. Charlie reads the receipts and never takes a side.
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, Slam, Ground, Stripes, Pill, spr, inOut, shake, neoShadow } from "../../promo/kit";
import { FPS, SETTLEIT, SETTLEIT_CHAT, SETTLEIT_RECEIPTS, startsOf, totalOf, ChatMsg, Receipt } from "./timeline";
import { hasVo, vo } from "./vo";

const START = startsOf(SETTLEIT.scenes);
export const SETTLEIT_TOTAL = totalOf(SETTLEIT.scenes);

// ── chat furniture (ink-world variant of the GroupChat promo's grammar) ──
const SENDER_COLOR: Record<string, string> = {
  DAVE: COLORS.pink,
  JAMIE: COLORS.lime,
  MO: COLORS.blue,
};

const Bubble: React.FC<{ msg: ChatMsg }> = ({ msg }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = msg.at <= 0 ? 1 : spr(frame, fps, msg.at, 10, 14);
  const settle = msg.at <= 0 ? interpolate(frame, [0, 5], [1.04, 1], { extrapolateRight: "clamp" }) : 1;
  if (msg.at > 0 && frame < msg.at) return null;

  if (msg.kind === "system") {
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "18px 0" }}>
        <div style={{ transform: `scale(${1.3 - 0.3 * s})`, opacity: Math.min(1, s * 2), fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 3, color: COLORS.red, background: COLORS.ink, border: `4px solid ${COLORS.red}`, borderRadius: 12, padding: "14px 30px" }}>
          {msg.text}
        </div>
      </div>
    );
  }

  const right = msg.side === "right";
  const ground = right ? COLORS.lime : COLORS.cream;
  return (
    <div style={{ display: "flex", justifyContent: right ? "flex-end" : "flex-start", marginBottom: 22 }}>
      <div style={{ maxWidth: 820, transform: `scale(${(1.35 - 0.35 * s) * settle})`, opacity: msg.at <= 0 ? 1 : Math.min(1, s * 2), transformOrigin: right ? "bottom right" : "bottom left" }}>
        {msg.sender ? (
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 27, letterSpacing: 2, color: SENDER_COLOR[msg.sender] ?? COLORS.cream, marginBottom: 8, textAlign: right ? "right" : "left" }}>{msg.sender}</div>
        ) : null}
        {msg.kind === "voicenote" ? (
          <div style={{ background: ground, border: `5px solid ${COLORS.ink}`, borderRadius: 26, boxShadow: neoShadow(8), padding: "24px 34px", display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 0, height: 0, borderTop: "16px solid transparent", borderBottom: "16px solid transparent", borderLeft: `26px solid ${COLORS.ink}` }} />
            {Array.from({ length: 14 }, (_, i) => (
              <div key={i} style={{ width: 7, borderRadius: 4, background: COLORS.ink, height: 12 + ((i * 37) % 34) }} />
            ))}
            <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 30, color: COLORS.ink }}>{msg.text}</div>
          </div>
        ) : (
          <div style={{ background: ground, color: COLORS.ink, border: `5px solid ${COLORS.ink}`, borderRadius: 26, borderBottomLeftRadius: right ? 26 : 6, borderBottomRightRadius: right ? 6 : 26, boxShadow: neoShadow(8), padding: "26px 36px", fontFamily: FONTS.body, fontWeight: 700, fontSize: 46, lineHeight: 1.15 }}>
            {msg.text}
          </div>
        )}
      </div>
    </div>
  );
};

const ChatHeader: React.FC = () => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, background: COLORS.ink, borderBottom: `4px solid ${COLORS.lime}`, padding: "54px 60px 26px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 46, letterSpacing: 1, color: COLORS.cream }}>THE GROUP CHAT</div>
    <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 26, letterSpacing: 2, color: COLORS.cream, opacity: 0.5 }}>3 MEMBERS</div>
  </div>
);

const ReceiptCard: React.FC<{ r: Receipt }> = ({ r }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < r.at) return null;
  const s = spr(frame, fps, r.at, 9, 16);
  const sh = shake(frame, r.at, 12, 8);
  return (
    <div style={{ position: "absolute", left: 40, right: 40, bottom: 170, transform: `translate(${sh.x}px, ${sh.y}px) scale(${1.4 - 0.4 * s}) rotate(${-1.5 * (1 - s)}deg)`, opacity: Math.min(1, s * 2) }}>
      <div style={{ background: COLORS.ink, border: `6px solid ${COLORS.lime}`, borderRadius: 20, boxShadow: `12px 12px 0 hsl(75 100% 55% / 0.25)`, padding: "34px 44px", textAlign: "center" }}>
        <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 27, letterSpacing: 4, color: COLORS.lime, marginBottom: 12 }}>FULL TIME · RECEIPT</div>
        <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, letterSpacing: -1, color: COLORS.cream }}>{r.title}</div>
        {r.lines.map((l) => (
          <div key={l} style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 48, color: COLORS.lime, marginTop: 10 }}>{l}</div>
        ))}
      </div>
    </div>
  );
};

// one scene of chat = header + its bubbles + any receipt that lands inside it
const ChatScene: React.FC<{ sceneKey: string; dur: number }> = ({ sceneKey, dur }) => {
  const frame = useCurrentFrame();
  const exit = { opacity: inOut(frame, dur, 6) };
  const msgs = SETTLEIT_CHAT.find((s) => s.scene === sceneKey)?.msgs ?? [];
  const receipts = SETTLEIT_RECEIPTS.filter((r) => r.scene === sceneKey);
  return (
    <AbsoluteFill style={exit}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.05} />
      </Ground>
      <ChatHeader />
      <div style={{ position: "absolute", top: 210, left: 56, right: 56, bottom: 150, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
        {msgs.map((m, i) => (
          <Bubble key={i} msg={m} />
        ))}
      </div>
      {receipts.map((r) => (
        <ReceiptCard key={r.title} r={r} />
      ))}
    </AbsoluteFill>
  );
};

// ── the turn: out of the chat, into the verdict world ──
const Turn: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exit = { opacity: inOut(frame, dur, 6) };
  const sh = shake(frame, 0, 12, 8);
  const second = spr(frame, fps, 120, 11, 16);
  return (
    <AbsoluteFill style={{ ...exit, transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.ink}>
        <Stripes frame={frame} color={COLORS.lime} ground={COLORS.ink} opacity={0.07} />
      </Ground>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 70px", textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.5} damping={10}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 104, letterSpacing: -3, lineHeight: 0.95, color: COLORS.cream, textShadow: `9px 9px 0 ${COLORS.ink}` }}>
            STILL 2-2<br />IN THE CHAT.
          </div>
        </Slam>
        <div style={{ marginTop: 70, transform: `scale(${0.7 + second * 0.3})`, opacity: Math.min(1, second * 2) }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 88, letterSpacing: -2, lineHeight: 1.0, color: COLORS.lime, textShadow: `8px 8px 0 ${COLORS.ink}` }}>
            THERE'S A<br />SCOREBOARD<br />FOR THIS NOW.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Cta: React.FC<{ dur: number }> = ({ dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flash = interpolate(frame, [0, 6], [1, 0], { extrapolateRight: "clamp" });
  const btn = spr(frame, fps, 30, 11, 16);
  return (
    <AbsoluteFill>
      <Ground color={COLORS.ink} />
      <div style={{ position: "absolute", inset: 0, background: COLORS.lime, opacity: flash * 0.9 }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 60px", textAlign: "center" }}>
        <Slam frame={frame} fps={fps} from={1.4} damping={10}>
          <Pill bg={COLORS.cream} fg={COLORS.ink} size={34} rot={-1.5}>SETTLE IT</Pill>
        </Slam>
        <Slam frame={frame} fps={fps} delay={8} from={1.5} damping={9}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 92, letterSpacing: -2, color: COLORS.cream, marginTop: 40 }}>
            PACIÊNCIA<br />
            <span style={{ color: COLORS.lime }}>OR</span> NAUJOKS?
          </div>
          <div style={{ fontFamily: FONTS.mono, fontWeight: 700, fontSize: 34, letterSpacing: 4, color: COLORS.lime, marginTop: 20 }}>COMMENTS. ONE NAME.</div>
        </Slam>
        <div style={{ marginTop: 66, transform: `scale(${0.6 + btn * 0.4})`, opacity: Math.min(1, btn * 2) }}>
          <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 56, letterSpacing: 6, color: COLORS.cream }}>THE WEEKEND</div>
          <div style={{ marginTop: 24, background: COLORS.lime, color: COLORS.ink, fontFamily: FONTS.head, fontWeight: 700, fontSize: 62, padding: "24px 56px", border: `6px solid ${COLORS.cream}`, borderRadius: 18, boxShadow: `10px 10px 0 ${COLORS.cream}` }}>VERVEQ.COM</div>
          <div style={{ marginTop: 26, fontFamily: FONTS.body, fontWeight: 500, fontSize: 36, color: COLORS.cream, opacity: 0.85 }}>Play free · no signup</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const SettleIt: React.FC = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Audio src={staticFile("promo/wknd-settleit.wav")} />
    {hasVo
      ? SETTLEIT.cues.map((c) => {
          const line = vo(c.key);
          if (!line) return null;
          return (
            <Sequence key={c.key} from={c.at} durationInFrames={Math.ceil(line.dur * FPS) + 8} layout="none">
              <Audio src={staticFile(`promo/vo-wknd/${c.key}.mp3`)} />
            </Sequence>
          );
        })
      : null}
    {SETTLEIT.scenes.map((s) => (
      <Sequence key={s.key} from={START[s.key]} durationInFrames={s.dur} layout="none">
        {s.key === "turn" ? <Turn dur={s.dur} /> : s.key === "cta" ? <Cta dur={s.dur} /> : <ChatScene sceneKey={s.key} dur={s.dur} />}
      </Sequence>
    ))}
  </AbsoluteFill>
);
