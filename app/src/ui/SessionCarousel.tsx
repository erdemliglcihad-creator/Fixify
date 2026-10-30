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
// Like the reference cards: a deep core, color pooling at one end, and light glowing in from every edge
// (an inner glow, no hard border), plus a soft halo of the same color around the card.
type Look = { base: string; colors: [string, string, string]; locations: [number, number, number]; edge: string; halo: string };
const LOOK: Record<Tone, Look> = {
  blue: {
    base: "#05061F",
    colors: ["#4E57D6", "#151A68", "#05061F"],
    locations: [0, 0.36, 0.7],
    edge: "inset 0 0 24px 2px rgba(128, 138, 255, 0.62), inset 0 -26px 40px -6px rgba(112, 122, 255, 0.62)",
    halo: "0 22px 60px -14px rgba(90, 100, 255, 0.55)",
  },
  violet: {
    base: "#26091F",
    colors: ["#C95BA8", "#651C57", "#26091F"],
    locations: [0, 0.36, 0.7],
    edge: "inset 0 0 26px 3px rgba(238, 120, 210, 0.7), inset 0 -26px 40px -6px rgba(232, 108, 200, 0.75)",
    halo: "0 22px 60px -14px rgba(220, 90, 190, 0.5)",
  },
  orange: {
    base: "#1E0906",
    colors: ["#1E0906", "#6E2212", "#E8532A"],
    locations: [0, 0.5, 1],
    edge: "inset 0 0 26px 3px rgba(255, 140, 100, 0.55), inset 0 -26px 40px -6px rgba(255, 120, 70, 0.7)",
    halo: "0 22px 60px -14px rgba(240, 95, 45, 0.5)",
  },
};

const GAP = 14;
const RADIUS = 52;

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
    <View style={{ marginHorizontal: -space.l, gap: space.s }}>
      <Animated.ScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        // Room for the halo, which a horizontal scroller would otherwise clip.
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingTop: space.l, paddingBottom: space.xxl + space.s }}
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
  const look = LOOK[TONE[session.status]];
  const status = statusInfo[session.status];
  const icon = session.category ? categoryInfo[session.category].icon : "construct-outline";
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / step - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.75], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.88], Extrapolation.CLAMP) }],
    };
  });
  return (
    <Animated.View style={[{ width, height, borderRadius: RADIUS, boxShadow: look.halo }, style]}>
      <Pressable
        onPress={() => onOpen(session)}
        onLongPress={() => onLongPress(session)}
        delayLongPress={450}
        accessibilityRole="button"
        accessibilityLabel={`${session.title}, ${status.title()}`}
        style={({ pressed }) => [styles.card, { backgroundColor: look.base, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <LinearGradient colors={look.colors} locations={look.locations} style={StyleSheet.absoluteFill} />
        <Arcs />
        {/* Light glowing in from the edges: drawn on top, since an inset shadow on the card would sit under the gradient. */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.edge, { boxShadow: look.edge }]} />

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
  card: { flex: 1, borderRadius: RADIUS, borderCurve: "continuous", overflow: "hidden", padding: space.l + 6 },
  edge: { borderRadius: RADIUS, borderCurve: "continuous" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s },
  status: { flex: 1, color: "#FFFFFFE6", fontFamily: font.regular, fontSize: 15 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF1A" },
  middle: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.s, paddingBottom: "22%" },
  title: { color: "#FFFFFF", fontFamily: font.medium, fontSize: 26, lineHeight: 31, letterSpacing: -0.7, textAlign: "center" },
  date: { color: "#FFFFFFB3", fontFamily: font.regular, fontSize: 14 },
  arcs: { position: "absolute", left: 0, right: 0, bottom: -40, height: "42%" },
  arc: { position: "absolute", top: 0, width: "64%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderStyle: "dotted", borderColor: "#FFFFFF2E" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFFE6" },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  pageDot: { height: 6, borderRadius: 3 },
});
