import { useState, useEffect } from "react";

interface BlitzClockProps {
  endTimeMs: number;
  onExpired: () => void;
  penaltyFlash: boolean;
}

export function BlitzClock({ endTimeMs, onExpired, penaltyFlash }: BlitzClockProps) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((endTimeMs - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0) {
        clearInterval(id);
        onExpired();
      }
    }, 100);
    return () => clearInterval(id);
  }, [endTimeMs, onExpired]);

  const isUrgent = remaining <= 10;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="relative text-center">
      <p
        className={`font-mono font-bold text-6xl transition-colors ${
          isUrgent ? "text-destructive animate-pulse-urgent" : "text-foreground"
        }`}
      >
        {display}
      </p>
      {penaltyFlash && (
        <span className="absolute inset-0 flex items-center justify-center font-mono font-bold text-2xl text-destructive animate-flash-red">
          -3s
        </span>
      )}
    </div>
  );
}
