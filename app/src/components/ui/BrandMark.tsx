import { cn } from "@/lib/utils";
import geometry from "./brandMark.geometry.json";

/**
 * The VerveQ brand (VerveQ ONE decision 3) — the one logo in the app.
 *
 *  - mark:     an ink rounded square tilted -4° with "VQ" in lime, Space
 *              Grotesk 700. The letters are real outlines (from the
 *              self-hosted font, see brandMark.geometry.json), so the mark
 *              renders identically before the font loads and everywhere else.
 *  - wordmark: "VERVEQ" in JetBrains Mono 700, uppercase, wide tracking. Real
 *              text in the current foreground color.
 *  - lockup:   mark + wordmark side by side.
 *
 * In sentences the name is "VerveQ"; the orange split-Q is retired.
 * scripts/exportBrandMark.mjs writes the same geometry to public/brand/*.svg
 * for icons and other off-app uses.
 */

export type BrandMarkVariant = "mark" | "wordmark" | "lockup";
export type BrandMarkSize = "sm" | "md" | "lg";

interface BrandMarkProps {
  variant?: BrandMarkVariant;
  size?: BrandMarkSize;
  className?: string;
}

const MARK_SIZE: Record<BrandMarkSize, string> = {
  sm: "w-7 h-7", // 28px
  md: "w-10 h-10", // 40px
  lg: "w-16 h-16", // 64px
};

const WORDMARK_SIZE: Record<BrandMarkSize, string> = {
  sm: "text-eyebrow",
  md: "text-meta",
  lg: "text-title-sm",
};

const LOCKUP_GAP: Record<BrandMarkSize, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
};

const { mark } = geometry;
const VIEW = mark.viewBox;
const HALF = VIEW / 2;
const SQUARE = mark.square.size;
const INSET = (VIEW - SQUARE) / 2;

function Mark({
  size,
  className,
  decorative = false,
}: {
  size: BrandMarkSize;
  className?: string;
  decorative?: boolean;
}) {
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": "VerveQ" } as const);
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
      className={cn("shrink-0", MARK_SIZE[size], className)}
      {...a11y}
    >
      <g transform={`rotate(${mark.tilt} ${HALF} ${HALF})`}>
        <rect
          x={INSET}
          y={INSET}
          width={SQUARE}
          height={SQUARE}
          rx={mark.square.radius}
          className="fill-ink"
        />
        {/* Inner rim in the border color: invisible on cream (border IS ink),
            a faint edge on the ink ground so the square doesn't dissolve. */}
        <rect
          x={INSET + 0.75}
          y={INSET + 0.75}
          width={SQUARE - 1.5}
          height={SQUARE - 1.5}
          rx={mark.square.radius - 0.75}
          strokeWidth={1.5}
          strokeOpacity={0.2}
          className="fill-none stroke-border"
        />
        <g
          transform={`translate(${mark.letters.x} ${mark.letters.baseline}) scale(${mark.letters.scale})`}
          className="fill-lime"
        >
          {mark.letters.glyphs.map((glyph) => (
            <path key={glyph.char} d={glyph.d} transform={`translate(${glyph.x} 0)`} />
          ))}
        </g>
      </g>
    </svg>
  );
}

function Wordmark({ size, className }: { size: BrandMarkSize; className?: string }) {
  return (
    // Real text: reads "VerveQ" to assistive tech, rendered uppercase. The
    // negative right margin cancels the trailing letter-space so centered
    // and lockup layouts sit optically true.
    <span
      className={cn(
        "font-mono font-bold uppercase tracking-brand whitespace-nowrap -mr-[0.18em] leading-none",
        WORDMARK_SIZE[size],
        className,
      )}
    >
      VerveQ
    </span>
  );
}

export function BrandMark({ variant = "mark", size = "md", className }: BrandMarkProps) {
  if (variant === "mark") return <Mark size={size} className={className} />;
  if (variant === "wordmark") return <Wordmark size={size} className={className} />;
  return (
    <span className={cn("inline-flex items-center", LOCKUP_GAP[size], className)}>
      <Mark size={size} decorative />
      <Wordmark size={size} />
    </span>
  );
}
