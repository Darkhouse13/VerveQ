import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { Mono } from "@/components/ui";
import { color, space } from "@/theme/tokens";

/**
 * The ranked answer window (owner ruling 2026-11-05: 15 s, server-enforced),
 * drawn in the Career Path 10 Path ring style. A leaf: it ticks every 250ms
 * on its own, so the question, answers and image never re-render for it.
 * At 0 it calls `onExpire` once — the caller submits the timeout.
 */
export function AnswerRing({
  deadlineAt,
  totalMs,
  frozen,
  onExpire,
  size = 64,
}: {
  deadlineAt: number;
  totalMs: number;
  frozen: boolean;
  onExpire: () => void;
  size?: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  const fired = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });
  useEffect(() => {
    fired.current = false;
  }, [deadlineAt]);
  useEffect(() => {
    if (frozen) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= deadlineAt && !fired.current) {
        fired.current = true;
        expire.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [frozen, deadlineAt]);

  const msLeft = Math.max(0, Math.min(totalMs, deadlineAt - now));
  const secs = Math.ceil(msLeft / 1000);
  const frac = msLeft / totalMs;
  const C = 2 * Math.PI * 36;
  const tone = secs <= 5 ? color.wrong : color.yellow;
  return (
    <View style={{ width: size, height: size }} accessibilityRole="timer" accessibilityLabel={`${secs} seconds left`}>
      <Svg width={size} height={size} viewBox="0 0 84 84">
        <Circle cx={42} cy={42} r={36} fill="none" stroke={color.surfaceHigh} strokeWidth={7} />
        <Circle
          cx={42}
          cy={42}
          r={36}
          fill="none"
          stroke={tone}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          transform="rotate(-90 42 42)"
        />
      </Svg>
      <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: space.xs }}>
        <Mono s={20} style={{ lineHeight: 22 }}>
          {secs}
        </Mono>
      </View>
    </View>
  );
}
