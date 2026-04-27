import { useState, useEffect } from "react";

interface CountdownOverlayProps {
  onComplete: () => void;
  endsAt?: number;
}

export function CountdownOverlay({ onComplete, endsAt }: CountdownOverlayProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (!endsAt) return;

    const update = () => {
      const remaining = Math.ceil((endsAt - Date.now()) / 1000);
      setCount(Math.max(0, remaining));
      if (remaining <= 0) onComplete();
    };
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [endsAt, onComplete]);

  useEffect(() => {
    if (endsAt) return;
    if (count <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, endsAt, onComplete]);

  return (
    <div className="fixed inset-0 bg-background/95 z-50 flex items-center justify-center">
      <div className="text-center">
        <p className="font-heading font-bold text-8xl animate-pulse">
          {count > 0 ? count : "GO!"}
        </p>
      </div>
    </div>
  );
}
