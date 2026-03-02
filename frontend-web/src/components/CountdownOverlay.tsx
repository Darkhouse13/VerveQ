import { useState, useEffect } from "react";

interface CountdownOverlayProps {
  onComplete: () => void;
}

export function CountdownOverlay({ onComplete }: CountdownOverlayProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [count, onComplete]);

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
