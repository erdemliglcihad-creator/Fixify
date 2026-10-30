// A number that counts up to its value when it appears (and rolls on when the value changes).
import { useEffect, useRef, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

export function CountUp({ value, duration = 900, style }: { value: number; duration?: number; style?: StyleProp<TextStyle> }) {
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const from = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) return setShown(value);
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const v = Math.round(start + (value - start) * ease(t));
      setShown(v);
      from.current = v;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduceMotion]);

  return (
    <Text style={[{ fontVariant: ["tabular-nums"] }, style]} accessibilityLabel={String(value)}>
      {shown}
    </Text>
  );
}
