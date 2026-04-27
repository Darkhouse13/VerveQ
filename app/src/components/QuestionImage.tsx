import { useState } from "react";

interface QuestionImageProps {
  imageUrl: string | null | undefined;
  alt?: string;
  onZoom?: () => void;
}

export function QuestionImage({ imageUrl, alt = "Question image", onZoom }: QuestionImageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!imageUrl) return null;

  if (error) {
    return (
      <div className="w-full neo-border bg-destructive/10 p-6 flex items-center justify-center min-h-[120px]">
        <p className="font-heading font-bold text-sm uppercase text-destructive tracking-wide">
          IMAGE FAILED TO LOAD
        </p>
      </div>
    );
  }

  return (
    <div className="relative cursor-pointer" onClick={onZoom}>
      {loading && (
        <div className="w-full neo-border bg-accent/30 p-6 flex items-center justify-center min-h-[160px]">
          <p className="font-mono font-bold text-sm uppercase tracking-wide animate-pulse">
            LOADING MEDIA...
          </p>
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className={`w-full object-contain neo-border ${loading ? "hidden" : ""}`}
        style={{ borderWidth: "3px" }}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </div>
  );
}
