import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS } from "./theme";
import { BgKind, makeRng } from "./variants";

// Subtle, static texture painted on the cream ground BEHIND all content. Kept
// low-contrast on purpose: it gives each video its own surface without ever
// competing with the club rows for legibility. No images — CSS gradients and a
// handful of deterministic shapes, so it stays crisp at 1080×1920 and adds
// nothing to render time.
const W = 1080;
const H = 1920;

// a translucent version of an hsl(...) brand token, e.g. hsl(25 100% 50%) →
// hsl(25 100% 50% / 0.08). The tokens are space-separated hsl(), so this is safe.
const alpha = (hsl: string, a: number): string =>
  hsl.replace(/^hsl\(([^)]+)\)$/, `hsl($1 / ${a})`);

export const Background: React.FC<{ kind: BgKind; accent: string; seed: number }> = ({
  kind,
  accent,
  seed,
}) => {
  if (kind === "plain") return null;

  if (kind === "confetti") {
    const rng = makeRng(seed);
    const ink = alpha(COLORS.ink, 0.05);
    const tint = alpha(accent, 0.1);
    const shapes = Array.from({ length: 26 }, () => ({
      x: rng() * W,
      y: rng() * H,
      s: 18 + rng() * 40,
      rot: rng() * 90 - 45,
      circle: rng() > 0.5,
      accent: rng() > 0.5,
    }));
    return (
      <AbsoluteFill>
        {shapes.map((c, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: c.x,
              top: c.y,
              width: c.s,
              height: c.s,
              background: c.accent ? tint : ink,
              borderRadius: c.circle ? "50%" : 6,
              transform: `rotate(${c.rot}deg)`,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }

  const line = alpha(accent, 0.1);
  const dot = alpha(COLORS.ink, 0.06);
  const bg: React.CSSProperties =
    kind === "dots"
      ? {
          backgroundImage: `radial-gradient(${dot} 3px, transparent 3px)`,
          backgroundSize: "54px 54px",
        }
      : kind === "grid"
        ? {
            backgroundImage: `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`,
            backgroundSize: "90px 90px",
          }
        : {
            // hatch
            backgroundImage: `repeating-linear-gradient(45deg, ${line} 0 3px, transparent 3px 26px)`,
          };

  return <AbsoluteFill style={bg} />;
};
