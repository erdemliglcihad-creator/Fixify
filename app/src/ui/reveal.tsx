// Scroll-triggered entrances. Each element checks on the UI thread whether it has scrolled into view and then
// animates once: so a screen builds up as you scroll, not all at once. Critically damped springs (no bounce),
// short travel; Reduce Motion shows everything right away.
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState, type ComponentType, type ReactElement, type ReactNode } from "react";
import { Platform, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  measure,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Grain } from "./Grain";

const SPRING = { duration: 700, dampingRatio: 1 } as const;

/** Becomes true once the element's top has scrolled into the lower part of the screen. */
function useInView() {
  const ref = useAnimatedRef<Animated.View>();
  const inView = useSharedValue(false);
  const { height } = useWindowDimensions();
  const watcher = useFrameCallback(() => {
    if (inView.value) return;
    const m = measure(ref);
    if (!m || m.height === 0) return;
    if (m.pageY < height * 0.9 && m.pageY + m.height > 0) inView.value = true;
  });
  const stop = () => watcher.setActive(false);
  useAnimatedReaction(
    () => inView.value,
    (now, before) => {
      if (now && !before) scheduleOnRN(stop);
    },
  );
  return { ref, inView };
}

/** 0 → 1 once the element is in view (after an optional delay). */
function useRevealProgress(delay: number) {
  const { ref, inView } = useInView();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useAnimatedReaction(
    () => inView.value,
    (now) => {
      if (now && progress.value === 0) progress.value = withDelay(delay, withSpring(1, SPRING));
    },
  );
  return { ref, progress };
}

export type RevealKind = "slideUp" | "pop" | "fade" | "build" | "noise";

/**
 * - slideUp: rises a few points and fades in (default, for blocks of content)
 * - pop: grows from slightly smaller (for buttons and small things you can tap)
 * - fade: only fades (for footnotes)
 * - build: rises less and grows a touch (for cards and groups)
 * - noise: emerges out of film grain that dissolves (for the one hero element on a screen)
 */
export function Reveal({
  children,
  kind = "slideUp",
  delay = 0,
  style,
  radius = 0,
}: {
  children: ReactNode;
  kind?: RevealKind;
  delay?: number;
  style?: StyleProp<ViewStyle>;
  /** Corner radius of the content, so the noise dissolve follows its shape. */
  radius?: number;
}) {
  const { ref, progress } = useRevealProgress(delay);
  const animated = useAnimatedStyle(() => {
    const p = progress.value;
    switch (kind) {
      case "pop":
        return { opacity: p, transform: [{ scale: 0.92 + p * 0.08 }] };
      case "fade":
        return { opacity: p };
      case "build":
        return { opacity: p, transform: [{ translateY: (1 - p) * 10 }, { scale: 0.97 + p * 0.03 }] };
      case "noise":
        return { opacity: Math.min(1, p * 1.6), transform: [{ translateY: (1 - p) * 8 }] };
      default:
        return { opacity: p, transform: [{ translateY: (1 - p) * 18 }] };
    }
  });
  const grain = useAnimatedStyle(() => ({ opacity: kind === "noise" ? (1 - progress.value) * 0.9 : 0 }));
  return (
    <Animated.View ref={ref} style={[style, animated]}>
      {children}
      {kind === "noise" && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }, grain]}>
          <Grain opacity={0.9} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

/** Text that slides up word by word once it scrolls into view. */
export function RevealWords({
  text,
  style,
  delay = 0,
  stagger = 45,
  align = "left",
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  delay?: number;
  stagger?: number;
  align?: "left" | "center";
}) {
  const { ref, inView } = useInView();
  const reduceMotion = useReducedMotion();
  const words = text.split(/\s+/).filter(Boolean);
  const per = 520;
  const total = words.length * stagger + per;
  const clock = useSharedValue(reduceMotion ? total : 0);
  useAnimatedReaction(
    () => inView.value,
    (now) => {
      if (now && clock.value === 0) clock.value = withDelay(delay, withTiming(total, { duration: total, easing: Easing.linear }));
    },
  );
  return (
    <Animated.View
      ref={ref}
      accessible
      accessibilityLabel={text}
      style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start" }}
    >
      {words.map((word, i) => (
        <Word key={`${i}-${word}`} word={word} index={i} clock={clock} stagger={stagger} per={per} style={style} last={i === words.length - 1} />
      ))}
    </Animated.View>
  );
}

function Word({
  word,
  index,
  clock,
  stagger,
  per,
  style,
  last,
}: {
  word: string;
  index: number;
  clock: SharedValue<number>;
  stagger: number;
  per: number;
  style?: StyleProp<TextStyle>;
  last: boolean;
}) {
  const animated = useAnimatedStyle(() => {
    const x = Math.min(Math.max((clock.value - index * stagger) / per, 0), 1);
    const eased = 1 - (1 - x) * (1 - x) * (1 - x);
    return { opacity: eased, transform: [{ translateY: (1 - eased) * 10 }] };
  });
  return (
    <Animated.Text importantForAccessibility="no" accessibilityElementsHidden style={[style, animated]}>
      {last ? word : `${word} `}
    </Animated.Text>
  );
}

// The package still ships class typings that React 19 types reject; the runtime component is fine.
const Masked = MaskedView as unknown as ComponentType<{ maskElement: ReactElement; children: ReactNode; style?: StyleProp<ViewStyle> }>;

/** Gradient text whose colors slowly drift through the letters (one pass every few seconds). */
export function FlowingGradientText({ children, colors, style, duration = 6000 }: { children: string; colors: string[]; style?: StyleProp<TextStyle>; duration?: number }) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const shift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion || !width) return;
    shift.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion, width]);
  const band = useAnimatedStyle(() => ({ transform: [{ translateX: -shift.value * width }] }));
  // Colors repeated so the band can slide one text-width without showing an edge.
  const loop = [...colors, ...colors.slice(1)] as [string, string, ...string[]];

  if (Platform.OS === "web") {
    return <FlowingGradientTextWeb colors={colors} style={style} duration={duration}>{children}</FlowingGradientTextWeb>;
  }
  return (
    <Masked maskElement={<Text style={style}>{children}</Text>}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
        {width > 0 && (
          <Animated.View style={[StyleSheet.absoluteFill, { width: width * 2 }, band]}>
            <LinearGradient colors={loop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.3 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        )}
      </View>
    </Masked>
  );
}

let webInjected = false;
function FlowingGradientTextWeb({ children, colors, style, duration }: { children: string; colors: string[]; style?: StyleProp<TextStyle>; duration: number }) {
  if (!webInjected && typeof document !== "undefined") {
    webInjected = true;
    const tag = document.createElement("style");
    tag.textContent = `@keyframes fx-flow { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
@media (prefers-reduced-motion: reduce) { [data-fx="flow"] { animation: none !important; } }`;
    document.head.appendChild(tag);
  }
  const web = {
    backgroundImage: `linear-gradient(90deg, ${[...colors, ...colors.slice(1)].join(", ")})`,
    backgroundSize: "200% 100%",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
    animation: `fx-flow ${duration}ms ease-in-out infinite alternate`,
  } as unknown as TextStyle;
  return (
    <Text {...({ dataSet: { fx: "flow" } } as object)} style={[style, web]}>
      {children}
    </Text>
  );
}
