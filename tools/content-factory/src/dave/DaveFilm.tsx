import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import { COLORS, FONTS, Ground, Pill, Slam, Stripes, neo, neoShadow, shake, spr, W, HGT } from "../promo/kit";
import { ACT2, FPS, SNAP, footageFrames, srcToTimeline, type Cue, type Demo as DemoData, type Film } from "./films";

// One component renders every Dave film, because unlike the promo lane — where
// each piece is a bespoke build — the shape here IS the format: footage, then
// the cream act. What varies is what was pointed at Dave, not how it's cut.
// Adding a fifth film is a clip plus a row in FILMS[], and that's the point.

const ACCENT: Record<Film["accent"], string> = {
  orange: COLORS.orange,
  pink: COLORS.pink,
  blue: COLORS.blue,
  lime: COLORS.lime,
  red: COLORS.red,
};

// lime is the one accent too bright to carry white text
const onAccent = (accent: Film["accent"]) => (accent === "lime" ? COLORS.ink : COLORS.white);

/**
 * The ink sticker-band the film opens on, over frame 0 of the footage.
 *
 * It exists because of one number in the README: 70% of batch 1's audience was
 * gone before 3 seconds on a static open. Seedance hands back a beautiful
 * macro of a polygraph needle — which is arresting but not *legible*, and an
 * image nobody can name is an image nobody stays for. So the sentence lands
 * first, on frame 0, in brand type, and then gets out of the way at 1.6s once
 * the footage can speak for itself.
 */
const Hook: React.FC<{ text: string; accent: string }> = ({ text, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = interpolate(frame, [46, 54], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (out >= 1) return null;
  const s = spr(frame, fps, 0, 13, 14);
  return (
    <div
      style={{
        position: "absolute",
        top: 168,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        // slams in on frame 0, then leaves upward — never dissolves, this
        // brand does not dissolve
        transform: `translateY(${(1 - s) * -90 - out * 130}px) rotate(-1.5deg)`,
        opacity: 1 - out,
      }}
    >
      <div
        style={{
          background: COLORS.ink,
          color: COLORS.cream,
          fontFamily: FONTS.head,
          fontWeight: 700,
          // stepped so the band stays one line and keeps its hard shadow clear
          // of the frame edge — "FOOTBALL OPINIONS ANONYMOUS" is the long one
          fontSize: text.length >= 26 ? 54 : text.length >= 20 ? 62 : 76,
          letterSpacing: -1,
          padding: "22px 40px",
          border: `5px solid ${COLORS.ink}`,
          borderRadius: 14,
          boxShadow: `10px 10px 0 ${accent}`,
          maxWidth: W - 120,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * A title card over the footage, sat clear of the platform UI. Not a subtitle
 * — see the `Cue` docs in films.ts for why that distinction is a correctness
 * rule here and not a stylistic one.
 *
 * Two registers, `quiet` and `loud`, and the gap between them is doing the
 * work: the room is always calm and the line the film was built for never is.
 */
const Caption: React.FC<{ cue: Cue; accent: string }> = ({ cue, accent }) => {
  // sequence-relative: 0 is this cue's own first frame
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spr(frame, fps, 0, 14, 8);
  const loud = cue.tone === "loud";
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        // clear of the TikTok caption/CTA furniture in the bottom ~15%
        bottom: 330,
        display: "flex",
        justifyContent: "center",
        transform: `scale(${0.86 + 0.14 * s})`,
        opacity: Math.min(1, s * 2),
      }}
    >
      <div
        style={{
          background: loud ? accent : COLORS.ink,
          color: loud ? COLORS.ink : COLORS.cream,
          fontFamily: loud ? FONTS.head : FONTS.mono,
          fontWeight: 700,
          // the loud card is ~2.6x the quiet one; that gap is the whole
          // register, so resist the urge to split the difference
          fontSize: loud ? 116 : 44,
          lineHeight: 1.15,
          letterSpacing: loud ? -2 : 0,
          padding: loud ? "18px 44px" : "20px 30px",
          border: `5px solid ${COLORS.ink}`,
          borderRadius: 14,
          boxShadow: neoShadow(9),
          textAlign: "center",
          textTransform: loud ? "none" : "uppercase",
        }}
      >
        {cue.text}
      </div>
    </div>
  );
};

/**
 * Act two, scene one — the ruling, alone on cream.
 *
 * It lands on the hard cut with a shake, so the cut is felt as an impact
 * rather than seen as an edit. It used to share this card with the turn and
 * the lockup; now it gets the two seconds to itself, because it is the
 * punchline and punchlines don't share.
 */
const Verdict: React.FC<{ film: Film }> = ({ film }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = ACCENT[film.accent];
  const sh = shake(frame, 0, 18, 9);
  return (
    <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={accent} ground={COLORS.cream} opacity={0.1} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 70 }}>
          <Slam frame={frame} fps={fps} delay={0} damping={10} from={1.6}>
            <div
              style={{
                fontFamily: FONTS.head,
                fontWeight: 700,
                fontSize: 150,
                lineHeight: 0.94,
                letterSpacing: -4,
                color: COLORS.ink,
                textAlign: "center",
              }}
            >
              {film.verdict}
            </div>
          </Slam>
        </AbsoluteFill>
      </Ground>
    </AbsoluteFill>
  );
};

// The demo's internal clock, relative to its own first frame. Derived from the
// ACT2 grid so films.ts stays the single source of truth.
const D = {
  question: ACT2.question - ACT2.demo,
  count: ACT2.count - ACT2.demo,
  daveTag: ACT2.daveTag - ACT2.demo,
  reveal: ACT2.reveal - ACT2.demo,
  result: ACT2.result - ACT2.demo,
} as const;

/**
 * Act two, scene two — the app, played on screen.
 *
 * This is the scene the confused viewer asked for (see the Demo docs in
 * films.ts). One round of the Daily Quiz in a stylized app frame: question,
 * options, a 3-2-1 countdown the viewer answers inside, the reveal. Dave's
 * pick gets a sticker mid-countdown so the film's subject walks into the
 * product shot and loses there too — the demo carries the comedy so the
 * comedy can carry the demo.
 *
 * The frame is a *stylized* honest shot, not a screen recording: the Daily
 * Quiz really is 10 multiple-choice questions, one attempt a day (the qLabel
 * and the DAILY QUIZ pill are the app's real vocabulary), drawn in the same
 * neo-brutalist tokens the app uses — which is exactly the job the README
 * gives Remotion: frame-exact type, the same brand every time.
 */
const Demo: React.FC<{ film: Film }> = ({ film }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = ACCENT[film.accent];
  const demo: DemoData = film.demo;
  const revealed = frame >= D.reveal;

  // 3 → 2 → 1, one number per two beats; the circle holds a ✓ after the flip.
  // Each flip re-pops; the last pop is the reveal's and it doesn't repeat.
  const count = Math.max(1, Math.min(3, 3 - Math.floor((frame - D.count) / 30)));
  const popAt = revealed ? D.reveal : D.count + Math.min(2, Math.max(0, Math.floor((frame - D.count) / 30))) * 30;
  const countPop = spr(frame, fps, popAt, 9, 10);

  // the Daily Quiz scores speed (faster = more points), so the bar drains for
  // real: question in, reveal out
  const barW = interpolate(frame, [D.question, D.reveal], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const sh = shake(frame, D.reveal, 14, 9);
  const letters = ["A", "B", "C", "D"];

  return (
    <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={accent} ground={COLORS.cream} opacity={0.1} />
      </Ground>

      {/* the film's voice, carried over the app — same band grammar as the
          hook. It holds the top slot until the round is decided, then hands
          the slot to the result so the ruling never covers the board the
          viewer just played on. */}
      <div style={{ position: "absolute", top: 130, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: frame >= D.result ? 0 : 1 }}>
        <Slam frame={frame} fps={fps} delay={0} damping={11} from={1.5} rot={-1.5}>
          <div
            style={{
              background: COLORS.ink,
              color: COLORS.cream,
              fontFamily: FONTS.head,
              fontWeight: 700,
              fontSize: demo.header.length >= 22 ? 58 : 70,
              letterSpacing: -1,
              padding: "20px 40px",
              border: `5px solid ${COLORS.ink}`,
              borderRadius: 14,
              boxShadow: `10px 10px 0 ${accent}`,
              maxWidth: W - 120,
              textAlign: "center",
              transform: "rotate(-1.5deg)",
            }}
          >
            {demo.header}
          </div>
        </Slam>
      </div>

      {/* the app frame */}
      <Slam frame={frame} fps={fps} delay={4} damping={12} from={1.15}>
        <div
          style={{
            position: "absolute",
            top: 360,
            left: 84,
            width: W - 168,
            height: 1150,
            ...neo(COLORS.card, 16, 36),
            padding: "36px 40px",
          }}
        >
          {/* app chrome — the real product's real vocabulary */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: 42, letterSpacing: -1, color: COLORS.ink, transform: "rotate(-2deg)" }}>
              VERVEQ
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <Pill bg={accent} fg={onAccent(film.accent)} size={26} rot={1.5}>
                DAILY QUIZ
              </Pill>
              <Pill bg={COLORS.ink} fg={COLORS.cream} size={26} rot={-1}>
                {demo.qLabel}
              </Pill>
            </div>
          </div>

          {/* speed bar — the Daily Quiz scores fast answers higher, so it drains */}
          <div style={{ marginTop: 30, height: 16, border: `4px solid ${COLORS.ink}`, borderRadius: 8, background: "rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${barW * 100}%`, height: "100%", background: revealed ? COLORS.green : accent }} />
          </div>

          {/* the question */}
          <div style={{ marginTop: 40, minHeight: 190 }}>
            <Slam frame={frame} fps={fps} delay={D.question} damping={11} from={1.3} rot={-0.5}>
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: demo.question.length > 30 ? 58 : 68,
                  lineHeight: 1.02,
                  letterSpacing: -1,
                  color: COLORS.ink,
                  opacity: frame >= D.question ? 1 : 0,
                }}
              >
                {demo.question}
              </div>
            </Slam>
          </div>

          {/* the board */}
          <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 22 }}>
            {demo.options.map((o, i) => {
              const isRight = i === demo.correct;
              const isDave = i === demo.dave;
              const p = spr(frame, fps, D.question + 8 + i * 5, 12, 14);
              const bg = revealed && isRight ? COLORS.green : COLORS.white;
              const dim = revealed && !isRight ? (isDave ? 0.85 : 0.4) : 1;
              return (
                <div key={o} style={{ position: "relative", transform: `scale(${0.75 + 0.25 * p})`, opacity: Math.min(1, p * 2) * dim }}>
                  <div style={{ ...neo(bg, 8, 16), height: 136, display: "flex", alignItems: "center", gap: 26, paddingLeft: 26 }}>
                    <div
                      style={{
                        width: 76,
                        height: 76,
                        flexShrink: 0,
                        borderRadius: 12,
                        background: revealed && isRight ? COLORS.ink : accent,
                        color: revealed && isRight ? COLORS.lime : onAccent(film.accent),
                        border: `3px solid ${COLORS.ink}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: FONTS.mono,
                        fontWeight: 700,
                        fontSize: 40,
                      }}
                    >
                      {revealed && isRight ? "✓" : revealed && isDave ? "✗" : letters[i]}
                    </div>
                    <div style={{ fontFamily: FONTS.head, fontWeight: 700, fontSize: o.length > 12 ? 44 : 54, color: COLORS.ink, lineHeight: 1 }}>
                      {o}
                    </div>
                  </div>
                  {/* Dave's pick, named mid-countdown — the film invades the product shot */}
                  {isDave && frame >= D.daveTag && (
                    <Slam frame={frame} fps={fps} delay={D.daveTag} damping={9} from={1.7} rot={-5}>
                      <div
                        style={{
                          // sits ON Dave's row, right side — straddling a row
                          // boundary read as tagging the neighbour too
                          position: "absolute",
                          top: -100,
                          right: 24,
                          background: COLORS.ink,
                          color: COLORS.cream,
                          fontFamily: FONTS.mono,
                          fontWeight: 700,
                          fontSize: 30,
                          letterSpacing: 1,
                          padding: "10px 22px",
                          border: `4px solid ${COLORS.ink}`,
                          borderRadius: 10,
                          boxShadow: `6px 6px 0 ${accent}`,
                          transform: "rotate(-5deg)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {demo.daveTag}
                      </div>
                    </Slam>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Slam>

      {/* the countdown, hanging off the frame's shoulder */}
      {frame >= D.count && (
        <div
          style={{
            position: "absolute",
            top: 292,
            right: 52,
            width: 148,
            height: 148,
            ...neo(revealed ? COLORS.green : COLORS.white, 8, 999),
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONTS.head,
            fontWeight: 700,
            fontSize: 76,
            color: COLORS.ink,
            transform: `scale(${0.7 + 0.3 * countPop})`,
          }}
        >
          {revealed ? "✓" : count}
        </div>
      )}

      {/* the ruling on the round — takes the header's slot so the revealed
          board stays fully visible underneath it */}
      {frame >= D.result && (
        <div style={{ position: "absolute", top: 110, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <Slam frame={frame} fps={fps} delay={D.result} damping={10} from={1.6} rot={-2}>
            <div
              style={{
                background: accent,
                color: onAccent(film.accent),
                fontFamily: FONTS.head,
                fontWeight: 700,
                fontSize: demo.result.length > 18 ? 76 : 96,
                letterSpacing: -2,
                padding: "16px 42px",
                border: `6px solid ${COLORS.ink}`,
                borderRadius: 16,
                boxShadow: neoShadow(12),
                textAlign: "center",
                transform: "rotate(-2deg)",
                maxWidth: W - 100,
              }}
            >
              {demo.result}
            </div>
          </Slam>
          <Slam frame={frame} fps={fps} delay={D.result + 8} damping={11} from={1.3} rot={1}>
            <div
              style={{
                background: COLORS.ink,
                color: COLORS.cream,
                fontFamily: FONTS.mono,
                fontWeight: 700,
                fontSize: 38,
                letterSpacing: 2,
                padding: "12px 30px",
                borderRadius: 12,
                boxShadow: neoShadow(7),
                transform: "rotate(1deg)",
              }}
            >
              DAVE 0/1 · YOU ?/1
            </div>
          </Slam>
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Act two, scene three — the turn, then the lockup.
 *
 * The turn used to live beside the verdict; it moved here because it means
 * more now. Before the demo it was commentary on Dave. After the viewer has
 * just answered a question themselves — right or wrong — it's addressed to
 * them, and the lockup lands on a person who already knows what the product
 * is. Same Slam/Pill vocabulary as the other twenty promos.
 */
const Outro: React.FC<{ film: Film }> = ({ film }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const accent = ACCENT[film.accent];
  const lockup = ACT2.lockup - ACT2.turn;
  const sh = shake(frame, 0, 14, 8);
  return (
    <AbsoluteFill style={{ transform: `translate(${sh.x}px, ${sh.y}px)` }}>
      <Ground color={COLORS.cream}>
        <Stripes frame={frame} color={accent} ground={COLORS.cream} opacity={0.1} />
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 70 }}>
          <Slam frame={frame} fps={fps} delay={0} damping={10} from={1.55} rot={-2}>
            <div
              style={{
                background: accent,
                color: onAccent(film.accent),
                fontFamily: FONTS.head,
                fontWeight: 700,
                fontSize: 110,
                letterSpacing: -2,
                padding: "16px 42px",
                border: `6px solid ${COLORS.ink}`,
                borderRadius: 16,
                boxShadow: neoShadow(12),
                textAlign: "center",
              }}
            >
              {film.turn}
            </div>
          </Slam>

          <Slam frame={frame} fps={fps} delay={lockup} damping={12} from={1.25}>
            <div style={{ marginTop: 90, textAlign: "center" }}>
              <div
                style={{
                  fontFamily: FONTS.head,
                  fontWeight: 700,
                  fontSize: 150,
                  letterSpacing: -5,
                  color: COLORS.ink,
                  lineHeight: 1,
                }}
              >
                VERVEQ
              </div>
              <div
                style={{
                  fontFamily: FONTS.body,
                  fontWeight: 500,
                  fontSize: 40,
                  color: COLORS.ink,
                  opacity: 0.72,
                  marginTop: 12,
                }}
              >
                {film.cta}
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginTop: 30 }}>
                <Pill bg={accent} fg={onAccent(film.accent)} size={40} rot={-1.2}>
                  verveq.com
                </Pill>
              </div>
              {/* the app's own free-note, verbatim — it answers the last
                  objection a cold viewer has left */}
              <div
                style={{
                  marginTop: 28,
                  fontFamily: FONTS.mono,
                  fontWeight: 700,
                  fontSize: 30,
                  letterSpacing: 1,
                  color: COLORS.ink,
                  opacity: 0.55,
                }}
              >
                Free · no sign-up.
              </div>
            </div>
          </Slam>
        </AbsoluteFill>
      </Ground>
    </AbsoluteFill>
  );
};

export const DaveFilm: React.FC<{ film: Film }> = ({ film }) => {
  const footage = footageFrames(film);
  const accent = ACCENT[film.accent];

  // Lay the kept slices end to end. Each is the same file at a different
  // offset, so a multi-segment film is a jump cut — invisible inside handheld
  // documentary footage, and far cheaper than re-rolling 45 credits hoping
  // Seedance paces it for TikTok next time.
  let acc = 0;
  const cuts = film.segments.map((seg) => {
    const from = acc;
    const dur = Math.round((seg.to - seg.from) * FPS);
    acc += dur;
    return { from, dur, startFrom: Math.round(seg.from * FPS) };
  });

  return (
    <AbsoluteFill style={{ background: COLORS.ink }}>
      {cuts.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.dur}>
          {/* Footage is 720x1280 @24fps into a 1080x1920 @30 composition;
              Remotion resamples both. Shot at 720p on purpose — the platform's
              own encode flattens the difference, and the credits are better
              spent on more films than on pixels TikTok throws away. */}
          <OffthreadVideo
            src={staticFile(`dave/${film.name}.mp4`)}
            startFrom={c.startFrom}
            style={{ width: W, height: HGT, objectFit: "cover" }}
          />
        </Sequence>
      ))}

      <Sequence durationInFrames={footage}>
        <Hook text={film.hook} accent={accent} />
      </Sequence>

      {film.cues.map((cue, i) => {
        // authored in source time; the segment map re-times them, and a cue
        // whose line was cut out simply never renders
        const t = srcToTimeline(film, cue.at);
        if (t === null) return null;
        return (
          <Sequence key={i} from={Math.round(t * FPS)} durationInFrames={Math.round(cue.dur * FPS)}>
            <Caption cue={cue} accent={accent} />
          </Sequence>
        );
      })}

      {/* Act two's score starts ON the cut — the footage keeps its own audio
          (that law didn't move), and the cream world gets the promo lane's
          synthesis: impact on the verdict, ticks under the countdown, the buzz
          Dave has earned. promo/dave-audio.mjs mirrors the ACT2 grid. */}
      <Sequence from={footage} durationInFrames={SNAP}>
        <Audio src={staticFile(`promo/dave-${film.name}.wav`)} />
      </Sequence>

      <Sequence from={footage + ACT2.verdict} durationInFrames={ACT2.demo - ACT2.verdict}>
        <Verdict film={film} />
      </Sequence>

      <Sequence from={footage + ACT2.demo} durationInFrames={ACT2.turn - ACT2.demo}>
        <Demo film={film} />
      </Sequence>

      <Sequence from={footage + ACT2.turn} durationInFrames={SNAP - ACT2.turn}>
        <Outro film={film} />
      </Sequence>
    </AbsoluteFill>
  );
};
