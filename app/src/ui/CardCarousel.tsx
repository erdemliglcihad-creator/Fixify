// Sideways carousel of tall soft cards (Home and Library). The centered card is full size,
// its neighbors peek in a little smaller; page dots follow the swipe.
import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import type { IconName } from "./categories.ts";
import { SOFT, type SoftTone } from "./soft.ts";
import { SoftSurface } from "./SoftSurface";
import { font, space, useTheme } from "./theme.ts";

const GAP = 12;
export const CARD_RADIUS = 52;

export function CardCarousel<T>({ items, keyOf, render }: { items: T[]; keyOf: (item: T) => string; render: (item: T, index: number) => ReactNode }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.74, 340);
  const cardH = cardW * 1.16;
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  return (
    <View style={{ marginHorizontal: -space.l, gap: space.m }}>
      <Animated.ScrollView
        horizontal
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        // Room for the soft edge, which a horizontal scroller would otherwise clip.
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingVertical: space.l }}
      >
        {items.map((item, i) => (
          <Slide key={keyOf(item)} index={i} x={x} step={step} width={cardW} height={cardH}>
            {render(item, i)}
          </Slide>
        ))}
      </Animated.ScrollView>
      {items.length > 1 && <Dots count={items.length} x={x} step={step} />}
    </View>
  );
}

function Slide({ index, x, step, width, height, children }: { index: number; x: SharedValue<number>; step: number; width: number; height: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(x.value / step - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.8], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.9], Extrapolation.CLAMP) }],
    };
  });
  return <Animated.View style={[{ width, height }, style]}>{children}</Animated.View>;
}

/** Face of a tall soft card: optional label and icon on top, the title in the middle, a line below. */
export function SoftCard({
  tone,
  title,
  subtitle,
  label,
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  tone: SoftTone;
  title: string;
  subtitle?: string;
  label?: string;
  icon?: IconName;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={450}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <SoftSurface palette={SOFT[tone]} radius={CARD_RADIUS} style={styles.card}>
        <Arcs />
        {(label || icon) && (
          <View style={styles.top}>
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            {icon && (
              <View style={styles.icon}>
                <Ionicons name={icon} size={16} color="#FFFFFFD9" />
              </View>
            )}
          </View>
        )}
        <View style={styles.middle}>
          <Text style={styles.title} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.7}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </SoftSurface>
    </Pressable>
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
      <View style={[styles.dot, { left: "78%", top: "58%" }]} />
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
  card: { flex: 1, padding: space.l + 8, overflow: "visible" },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.s },
  label: { flex: 1, color: "#FFFFFFE6", ...font.regular, fontSize: 16, letterSpacing: -0.2 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF1F", borderWidth: 1, borderColor: "#FFFFFF2A" },
  middle: { flex: 1, justifyContent: "center", alignItems: "center", gap: space.s, paddingBottom: "20%" },
  title: { color: "#FFFFFF", ...font.semibold, fontSize: 27, lineHeight: 32, letterSpacing: -0.4, textAlign: "center" },
  subtitle: { color: "#FFFFFFBF", ...font.regular, fontSize: 15 },
  arcs: { position: "absolute", left: 14, right: 14, bottom: 4, height: "40%", overflow: "hidden", borderBottomLeftRadius: CARD_RADIUS, borderBottomRightRadius: CARD_RADIUS },
  arc: { position: "absolute", top: 0, width: "64%", aspectRatio: 1, borderRadius: 999, borderWidth: 1, borderStyle: "dotted", borderColor: "#FFFFFF33" },
  dot: { position: "absolute", width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFFE6" },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  pageDot: { height: 6, borderRadius: 3 },
});
