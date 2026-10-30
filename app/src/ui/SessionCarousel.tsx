// Library carousel: one tall card per session, swiped sideways. The centered card is full size,
// its neighbors peek in smaller and dimmer. Color tells the status at a glance.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { formatDate } from "../core/format.ts";
import type { FixSession, SessionStatus } from "../core/types.ts";
import { lang } from "../i18n/index.ts";
import { categoryInfo, statusInfo } from "./categories.ts";
import { font, space, useTheme } from "./theme.ts";

type Tone = "blue" | "violet" | "orange";
const TONE: Record<SessionStatus, Tone> = {
  solved: "blue",
  active: "violet",
  pendingAnalysis: "violet",
  partiallySolved: "violet",
  unresolved: "orange",
  unclear: "orange",
};
const GRADIENT: Record<Tone, { colors: [string, string, string]; rim: string; glow: string }> = {
  blue: { colors: ["#5C6CF2", "#1D2378", "#080A26"], rim: "#8C98FF66", glow: "rgba(70, 90, 255, 0.45)" },
  violet: { colors: ["#D35BB4", "#5E1A5A", "#21071F"], rim: "#F08BD866", glow: "rgba(210, 80, 180, 0.4)" },
  orange: { colors: ["#F2642E", "#7C2516", "#1C0805"], rim: "#FF9A6E66", glow: "rgba(240, 100, 50, 0.4)" },
};

const GAP = 14;

export function SessionCarousel({ sessions, onOpen, onLongPress }: { sessions: FixSession[]; onOpen: (s: FixSession) => void; onLongPress: (s: FixSession) => void }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.72, 340);
  const cardH = cardW * 1.22;
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  return (
    <View style={{ marginHorizontal: -space.l, gap: space.l }}>
      <Animated.ScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingVertical: space.l }}
      >
        {sessions.map((s, i) => (
          <SessionCard key={s.id} session={s} index={i} x={x} step={step} width={cardW} height={cardH} onOpen={onOpen} onLongPress={onLongPress} />
        ))}
      </Animated.ScrollView>
      {sessions.length > 1 && <Dots count={sessions.length} x={x} step={step} />}
    </View>
  );
}

function SessionCard({
  session,
  index,
  x,
  step,
  width,
  height,
  onOpen,
  onLongPress,
}: {
  session: FixSession;
  index: number;
  x: SharedValue<number>;
  step: number;
  width: number;
  height: number;
  onOpen: (s: FixSession) => void;
  onLongPress: (s: FixSession) => void;
}) {
  const tone = GRADIENT[TONE[session.status]];
  const status = statusInfo[session.status];
  const icon = session.category ? categoryInfo[session.category].icon : "construct-outline";
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / step - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.5], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.86], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[{ width, height }, style]}>
      <Pressable
        onPress={() => onOpen(session)}
        onLongPress={() => onLongPress(session)}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityLabel={`${session.title}, ${status.title()}`}
        style={({ pressed }) => [styles.card, { borderColor: tone.rim, boxShadow: `0 18px 48px ${tone.glow}`, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <LinearGradient colors={tone.colors} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        {/* Soft light catching the top edge, like a glass slab. */}
        <LinearGradient pointerEvents="none" colors={["#FFFFFF33", "#FFFFFF00"]} end={{ x: 0.5, y: 0.35 }} style={StyleSheet.absoluteFill} />
        <Arcs />

        <View style={styles.top}>
          <Text style={styles.status} numberOfLines={1}>
            {status.title()}
          </Text>
          <View style={styles.icon}>
            <Ionicons name={icon} size={15} color="#FFFFFFCC" />
          </View>
        </View>

        <View style={styles.middle}>
          <Text style={styles.title} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.7}>
            {session.title}
          </Text>
          <Text style={styles.date}>{formatDate(session.updatedAt, lang)}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Dotted circles near the bottom, a quiet texture like the reference card. */
function Arcs() {
  return (
    <View pointerEvents="none" style={styles.arcs}>
      {[-0.35, 0, 0.35].map((o, i) => (
        <View key={i} style={[styles.arc, { left: `${18 + o * 60}%` }]} />
      ))}
      <View style={[styles.dot, { left: "30%", top: "8%" }]} />
      <View style={[styles.dot, { left: "56%", top: "30%" }]} />
      <View style={[styles.dot, { left: "80%", top: "62%" }]} />
    </View>
  );
}

function Dots({ count, x, step }: { count: number; x: SharedValue<number>; step: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: Math.min(count, 12) }, (_, i) => (
        <Dot key={i} index={i} x={x} step={step} />
      ))}
    </View>
  );
}

function Dot({ index, x, step }: { index: number; x: SharedValue<number>; step: number }) {
  const { c } = useTheme();
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / step - index);
    return { width: interpolate(d, [0, 1], [18, 6], Extrapolation.CLAMP), opacity: interpolate(d, [0, 1], [1, 0.35], Extrapolation.CLAMP) };
  });
  return <Animated.View style={[styles.pageDot, { backgroundColor: c.text }, style]} />;
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 44, overflow: "hidden", borderWidth: 1, padding: space.l + 4 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s },
  status: { flex: 1, color: "#FFFFFFD9", fontFamily: font.medium, fontSize: 15 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF1F" },
  middle: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.s, paddingBottom: "22%" },
  title: { color: "#FFFFFF", fontFamily: font.medium, fontSize: 26, lineHeight: 31, letterSpacing: -0.7, textAlign: "center" },
  date: { color: "#FFFFFFB3", fontFamily: font.regular, fontSize: 14 },
  arcs: { position: "absolute", left: 0, right: 0, bottom: -40, height: "42%" },
  arc: { position: "absolute", top: 0, width: "64%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderStyle: "dotted", borderColor: "#FFFFFF33" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFFE6" },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  pageDot: { height: 6, borderRadius: 3 },
});
