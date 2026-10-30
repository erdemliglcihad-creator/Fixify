// Chat pieces for the scan answer: bubbles, the three dots while Fixify thinks, and text that types itself.
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { font, space, useTheme } from "./theme.ts";

/** One message. Fixify's on the left on a raised surface, yours on the right in the accent color. */
export function Bubble({ from, children, style }: { from: "fixify" | "you"; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c, brand } = useTheme();
  const mine = from === "you";
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      style={[
        styles.bubble,
        mine
          ? { alignSelf: "flex-end", backgroundColor: c.accent, borderBottomRightRadius: 8, boxShadow: `0 10px 30px rgba(${brand.glowRgb}, 0.35)` }
          : { alignSelf: "flex-start", backgroundColor: c.raised, borderBottomLeftRadius: 8, borderColor: c.hairline, borderWidth: StyleSheet.hairlineWidth },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Three dots bouncing one after another while the answer is being written. */
export function TypingDots() {
  const { c } = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel="…">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 140} color={c.secondary} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withSequence(withTiming(-5, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 320 })), -1));
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: 0.5 - y.value * 0.08 }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

/**
 * Text that types itself word by word (only when `animate`), with a soft tap when it is done.
 * Long words and line breaks keep their place, so the bubble grows smoothly instead of jumping.
 */
export function TypeText({ text, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const words = text.split(/(\s+)/);
  const [shown, setShown] = useState(animate && !reduceMotion ? 0 : words.length);
  const done = useRef(shown >= words.length);

  useEffect(() => {
    if (shown >= words.length) {
      if (!done.current) {
        done.current = true;
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDone?.();
      }
      return;
    }
    // About 30 words a second, a short breath after each sentence.
    const prev = words[shown - 1] ?? "";
    const id = setTimeout(() => setShown((n) => n + 2), /[.!?:]$/.test(prev) ? 140 : 32);
    return () => clearTimeout(id);
  }, [shown, words.length]);

  return (
    <Text style={[styles.text, { color: c.text }]} accessibilityLabel={text}>
      {words.slice(0, shown).join("")}
      {shown < words.length ? <Text style={{ color: c.accent }}> ▍</Text> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: "88%", borderRadius: 24, borderCurve: "continuous", paddingHorizontal: space.l, paddingVertical: space.m, overflow: "hidden" },
  dots: { flexDirection: "row", gap: 6, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...font.regular, fontSize: 17, lineHeight: 25 },
});
