import { useEffect, useRef, useState } from "react";

interface QuestionImageProps {
  imageUrl: string | null | undefined;
  alt?: string;
  onZoom?: () => void;
  /** Maximum retry attempts on load error. Defaults to 2 (3 total tries). */
  maxRetries?: number;
}

export function QuestionImage({
  imageUrl,
  alt = "Question image",
  onZoom,
  maxRetries = 2,
}: QuestionImageProps) {
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoading(true);
    setErrored(false);
    setAttempt(0);
    return () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [imageUrl]);

  if (!imageUrl) return null;

  if (errored) {
    return (
      <div className="w-full neo-border bg-muted/40 p-6 flex items-center justify-center min-h-[160px]">
        <p className="font-heading font-bold text-xs uppercase tracking-wide text-muted-foreground">
          Image unavailable
        </p>
      </div>
    );
  }

  return (
    <div
      className={onZoom ? "relative cursor-pointer" : "relative"}
      onClick={onZoom}
    >
      {loading && (
        <div className="w-full neo-border bg-accent/30 p-6 flex items-center justify-center min-h-[160px]">
          <p className="font-mono font-bold text-xs uppercase tracking-wide animate-pulse">
            Loading media…
          </p>
        </div>
      )}
      <img
        key={`${imageUrl}::${attempt}`}
        src={imageUrl}
        alt={alt}
        decoding="async"
        loading="eager"
        className={`w-full object-contain neo-border ${loading ? "hidden" : ""}`}
        style={{ borderWidth: "3px" }}
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
    </div>
  );
}
