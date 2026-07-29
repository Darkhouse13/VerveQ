import { useEffect, useRef, useState } from "react";

interface QuestionImageProps {
  imageUrl: string | null | undefined;
  alt?: string;
  onZoom?: () => void;
  /** Maximum retry attempts on load error. Defaults to 2 (3 total tries). */
  maxRetries?: number;
  /** Extra classes for the <img> inside the box. */
  imgClassName?: string;
  /** Override the box's viewport-relative height (e.g. "h-[20dvh]"). */
  boxClassName?: string;
}

/**
 * The media slot of a question card. Renders a FIXED-size box scaled to the
 * player's viewport (dvh-based) and letterboxes the image inside it — the box
 * never changes size between loading, loaded, and error states, so the
 * question/options below never shift and the play column fits the screen
 * without scrolling on any device.
 */
export function QuestionImage({
  imageUrl,
  alt = "Question image",
  onZoom,
  maxRetries = 2,
  imgClassName = "",
  boxClassName = "h-[22dvh] md:h-[clamp(140px,24vh,320px)]",
}: QuestionImageProps) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [renderedUrl, setRenderedUrl] = useState(imageUrl);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset for a new URL during render, NOT in a passive effect. A post-paint
  // effect reset races the <img>'s load event: on a cache hit the browser can
  // fire `load` (→ loading=false) before the effect runs (→ loading=true),
  // and since `load` never fires twice the overlay is stranded on screen
  // forever. Resetting synchronously here commits loading=true together with
  // the new <img> element, so no load event can precede it.
  if (imageUrl !== renderedUrl) {
    setRenderedUrl(imageUrl);
    setLoading(true);
    setErrored(false);
    setAttempt(0);
  }

  // Belt and braces for the same race: if the image finished decoding before
  // React attached its handlers (img.complete on an instant cache hit), the
  // load event is already gone — reconcile from the element itself.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoading(false);
    }
  }, [imageUrl, attempt]);

  useEffect(() => {
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [imageUrl]);

  if (!imageUrl) return null;

  return (
    <div
      className={`relative w-full neo-border bg-muted/30 overflow-hidden ${boxClassName} ${
        onZoom ? "cursor-pointer" : ""
      }`}
      style={{ borderWidth: "3px" }}
      onClick={onZoom}
    >
      {errored ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground">
            Image unavailable
          </p>
        </div>
      ) : (
        <>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-accent/30">
              <p className="font-mono font-bold text-xs uppercase tracking-wide animate-pulse">
                Loading media…
              </p>
            </div>
          )}
          <img
            key={`${imageUrl}::${attempt}`}
            ref={imgRef}
            src={imageUrl}
            alt={alt}
            decoding="async"
            loading="eager"
            className={`w-full h-full object-contain ${imgClassName} ${loading ? "invisible" : ""}`}
            onLoad={() => setLoading(false)}
            onError={() => {
              if (attempt < maxRetries) {
                const delay = 300 * (attempt + 1);
                retryTimer.current = setTimeout(() => {
                  setLoading(true);
                  setAttempt((a) => a + 1);
                }, delay);
              } else {
                setLoading(false);
                setErrored(true);
              }
            }}
          />
        </>
      )}
    </div>
  );
}
