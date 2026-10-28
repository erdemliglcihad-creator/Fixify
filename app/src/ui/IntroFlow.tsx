// One-time introduction after the first-launch questions: four swipeable pages, each with a small animated
// replica of the feature. Rendered as a layer above the app (no navigation), shown once, never again.
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewInstance } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/index.ts";
import { Button, LightCatch } from "./components.tsx";
import { Glass } from "./Glass.tsx";
import { areaColors, font, space, textGlow, type, useTheme } from "./theme.ts";
import { VoiceOrb } from "./VoiceOrb";

type Page = { title: () => string; body: () => string; demo: (active: boolean) => ReactNode };

const PAGES: Page[] = [
  {
    title: () => t("Show the problem"),
    body: () => t("Tap the scan button at the bottom right. Fixify marks what matters in the photo and guides you step by step."),
    demo: (active) => <LiveFixDemo active={active} />,
  },
  {
    title: () => t("Talk to FixVoice"),
    body: () => t("Tap the orb to start, tap it again to hang up. Just talk, and interrupt it any time."),
    demo: (active) => <VoiceDemo active={active} />,
  },
  {
    title: () => t("Free, every day"),
    body: () => t("10 photo uploads per day for analyses. Talking to FixVoice has no fixed limit."),
    demo: (active) => <LimitDemo active={active} />,
  },
  {
    title: () => t("Make it yours"),
    body: () => t("Pick FixVoice's voice and light or dark in Settings. Photos are only sent after you agree."),
    demo: (active) => <SettingsDemo active={active} />,
  },
];

export function IntroFlow({ onDone }: { onDone: () => void }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const pager = useRef<ScrollViewInstance>(null);
  const last = page === PAGES.length - 1;

  const finish = onDone;

  function next() {
    if (last) return finish();
    pager.current?.scrollTo({ x: (page + 1) * width, animated: true });
    setPage(page + 1);
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.top, { paddingTop: insets.top + space.s }]}>
        <Dots page={page} total={PAGES.length} />
        <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
          <Text style={{ color: c.secondary, fontFamily: font.medium, fontSize: 15 }}>{t("Skip")}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {PAGES.map((p, i) => (
          <View key={i} style={{ width, paddingHorizontal: space.xl, justifyContent: "center", gap: space.xxl }}>
            <View style={styles.stage}>{p.demo(page === i)}</View>
            <View style={{ gap: space.m }}>
              <Text style={[type.display, { color: c.text, textAlign: "center" }, textGlow(dark)]}>{p.title()}</Text>
              <Text style={[type.body, { color: c.secondary, textAlign: "center" }]}>{p.body()}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.l, paddingTop: space.s }}>
        <Button title={last ? t("Get started") : t("Next")} onPress={next} />
      </View>
    </View>
  );
}

function Dots({ page, total }: { page: number; total: number }) {
  return (
    <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: total, now: page + 1 }}>
      {Array.from({ length: total }, (_, i) => (
        <Dot key={i} on={i === page} />
      ))}
    </View>
  );
}

function Dot({ on }: { on: boolean }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => ({
    width: withSpring(on ? 22 : 7, { duration: 400, dampingRatio: 1 }),
    opacity: withTiming(on ? 1 : 0.35, { duration: 300 }),
  }));
  return <Animated.View style={[styles.dot, { backgroundColor: on ? c.accent : c.text, boxShadow: on ? `0 0 10px ${c.accent}AA` : undefined }, style]} />;
}

/** Restarts a looping 0…1 value whenever the page becomes active. */
function useLoop(active: boolean, duration: number) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    if (active) v.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [active]);
  return v;
}

// --- 1. Live Fix: camera frame, scanning line, markers popping in ------------------------------------------

function LiveFixDemo({ active }: { active: boolean }) {
  const { c, dark } = useTheme();
  const scan = useLoop(active, 1600);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: scan.value * 150 }], opacity: 0.4 + scan.value * 0.6 }));
  return (
    <Glass style={styles.frame}>
      <LightCatch dark={dark} />
      {(["tl", "tr", "bl", "br"] as const).map((k) => (
        <View key={k} style={[styles.corner, cornerStyle(k), { borderColor: c.text }]} />
      ))}
      <Animated.View style={[styles.scanLine, { backgroundColor: c.accent, boxShadow: `0 0 14px ${c.accent}` }, line]} />
      <Marker n={1} x={58} y={60} delay={400} active={active} />
      <Marker n={2} x={150} y={112} delay={800} active={active} />
    </Glass>
  );
}

function cornerStyle(k: "tl" | "tr" | "bl" | "br") {
  const top = k[0] === "t";
  const left = k[1] === "l";
  return {
    top: top ? 14 : undefined,
    bottom: top ? undefined : 14,
    left: left ? 14 : undefined,
    right: left ? undefined : 14,
    borderTopWidth: top ? 2.5 : 0,
    borderBottomWidth: top ? 0 : 2.5,
    borderLeftWidth: left ? 2.5 : 0,
    borderRightWidth: left ? 0 : 2.5,
    borderTopLeftRadius: k === "tl" ? 10 : 0,
    borderTopRightRadius: k === "tr" ? 10 : 0,
    borderBottomLeftRadius: k === "bl" ? 10 : 0,
    borderBottomRightRadius: k === "br" ? 10 : 0,
  };
}

function Marker({ n, x, y, delay, active }: { n: number; x: number; y: number; delay: number; active: boolean }) {
  const { c } = useTheme();
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = 0;
    if (active) s.value = withDelay(delay, withSpring(1, { duration: 500, dampingRatio: 0.6 }));
  }, [active]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
  return (
    <Animated.View style={[styles.marker, { left: x, top: y, backgroundColor: c.marker, boxShadow: `0 0 16px ${c.marker}AA` }, style]}>
      <Text style={{ color: "#000", fontFamily: font.bold, fontSize: 13 }}>{n}</Text>
    </Animated.View>
  );
}

// --- 2. FixVoice: the real orb with a talking level and a tap ripple ---------------------------------------

function VoiceDemo({ active }: { active: boolean }) {
  const { c } = useTheme();
  const talk = useLoop(active, 900);
  const level = useDerivedValue(() => 0.15 + Math.abs(Math.sin(talk.value * Math.PI * 3)) * 0.6 * talk.value);
  const ripple = useSharedValue(0);
  useEffect(() => {
    ripple.value = 0;
    if (active) ripple.value = withRepeat(withSequence(withTiming(0, { duration: 600 }), withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) })), -1);
  }, [active]);
  const ring = useAnimatedStyle(() => ({ opacity: (1 - ripple.value) * 0.7, transform: [{ scale: 0.4 + ripple.value * 0.9 }] }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {active && <VoiceOrb level={level} mode="speaking" size={210} colors={areaColors.fixbot.glow} />}
      <Animated.View pointerEvents="none" style={[styles.ripple, { borderColor: c.text }, ring]} />
      <Ionicons name="hand-left-outline" size={26} color={c.text} style={{ position: "absolute", bottom: 18, right: 46, opacity: 0.85 }} />
    </View>
  );
}

// --- 3. Daily limit: ten photo dots light up one after another ---------------------------------------------

function LimitDemo({ active }: { active: boolean }) {
  const { c } = useTheme();
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = 0;
    if (active) fill.value = withRepeat(withSequence(withTiming(10, { duration: 2200, easing: Easing.linear }), withDelay(900, withTiming(0, { duration: 500 }))), -1);
  }, [active]);
  return (
    <View style={styles.limit}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        return <LimitDot key={i} index={i} fill={fill} x={Math.cos(a) * 82} y={Math.sin(a) * 82} />;
      })}
      <Text style={[type.hero, { color: c.text }, textGlow(true)]}>10</Text>
      <Text style={{ color: c.secondary, fontFamily: font.medium, fontSize: 13, marginTop: -4 }}>{t("photos / day")}</Text>
    </View>
  );
}

function LimitDot({ index, fill, x, y }: { index: number; fill: SharedValue<number>; x: number; y: number }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => {
    const on = Math.min(Math.max(fill.value - index, 0), 1);
    return { opacity: 0.2 + on * 0.8, transform: [{ scale: 0.75 + on * 0.25 }] };
  });
  return (
    <Animated.View style={[styles.limitDot, { transform: [{ translateX: x }, { translateY: y }] }]}>
      <Animated.View style={[styles.limitDotInner, { backgroundColor: c.accent, boxShadow: `0 0 12px ${c.accent}` }, style]}>
        <Ionicons name="image" size={12} color="#fff" />
      </Animated.View>
    </Animated.View>
  );
}

// --- 4. Settings: a voice switcher that flips by itself, and the privacy line --------------------------------

function SettingsDemo({ active }: { active: boolean }) {
  const { c, dark } = useTheme();
  const flip = useSharedValue(0);
  useEffect(() => {
    flip.value = 0;
    if (active) flip.value = withRepeat(withSequence(withDelay(900, withSpring(1, { duration: 420, dampingRatio: 0.9 })), withDelay(900, withSpring(0, { duration: 420, dampingRatio: 0.9 }))), -1);
  }, [active]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: flip.value * 118 }] }));
  return (
    <View style={{ gap: space.m, width: 260 }}>
      <Glass style={styles.miniSegment}>
        <Animated.View style={[styles.miniPill, { backgroundColor: dark ? "#FFFFFF24" : "#FFFFFFF2" }, pill]} />
        <Text style={[styles.miniLabel, { color: c.text }]}>{t("Female voice")}</Text>
        <Text style={[styles.miniLabel, { color: c.text }]}>{t("Male voice")}</Text>
      </Glass>
      <Glass style={styles.miniRow}>
        <LightCatch dark={dark} />
        <Ionicons name={dark ? "moon" : "sunny"} size={18} color={c.accent} />
        <Text style={{ color: c.text, fontFamily: font.medium, fontSize: 14, flex: 1 }}>{t("Appearance")}</Text>
        <Text style={{ color: c.secondary, fontFamily: font.medium, fontSize: 13 }}>{dark ? t("Dark") : t("Light")}</Text>
      </Glass>
      <Glass style={styles.miniRow}>
        <LightCatch dark={dark} />
        <Ionicons name="lock-closed" size={18} color={c.success} />
        <Text style={{ color: c.text, fontFamily: font.medium, fontSize: 14, flex: 1 }}>{t("Only after you agree")}</Text>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl },
  dots: { flexDirection: "row", gap: 6, alignItems: "center" },
  dot: { height: 7, borderRadius: 4 },
  stage: { height: 280, alignItems: "center", justifyContent: "center" },
  frame: { width: 230, height: 230, borderRadius: 32, borderCurve: "continuous" },
  corner: { position: "absolute", width: 28, height: 28 },
  scanLine: { position: "absolute", left: 24, right: 24, top: 36, height: 2, borderRadius: 1 },
  marker: { position: "absolute", width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#FFFFFFE6" },
  ripple: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 2 },
  limit: { width: 220, height: 220, alignItems: "center", justifyContent: "center" },
  limitDot: { position: "absolute", left: 110 - 14, top: 110 - 14, width: 28, height: 28 },
  limitDotInner: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  miniSegment: { flexDirection: "row", borderRadius: 999, padding: 4, height: 46, alignItems: "center" },
  miniPill: { position: "absolute", left: 4, top: 4, bottom: 4, width: 126, borderRadius: 999 },
  miniLabel: { flex: 1, textAlign: "center", fontFamily: font.medium, fontSize: 13 },
  miniRow: { flexDirection: "row", alignItems: "center", gap: space.m, borderRadius: 18, paddingHorizontal: space.l, height: 52 },
});
