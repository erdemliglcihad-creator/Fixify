// Sideways carousel of tall soft cards (Home and Library). The centered card is full size,
// its neighbors peek in a little smaller; page dots follow the swipe.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Link, type Href } from "expo-router";
import { useRef, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { SFSymbol } from "sf-symbols-typescript";
import { morphOpen } from "../services/morph.ts";
import { PressScale } from "./motion.tsx";
import type { IconName } from "./categories.ts";
import { Detail, type CardDetail } from "./CardDetails.tsx";
import { SOFT, type SoftTone } from "./soft.ts";
import { SoftSurface } from "./SoftSurface";
import { font, space, useTheme } from "./theme.ts";

const GAP = 12;
/** How far the card glow reaches out; the scroller gets this much room so it is never cut off. */
const GLOW_ROOM = 70;
type Measurable = { measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => void };
export const CARD_RADIUS = 52;

export function CardCarousel<T>({ items, keyOf, render }: { items: T[]; keyOf: (item: T) => string; render: (item: T, index: number) => ReactNode }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.74, 340);
  const cardH = cardW * 1.16;
  const step = cardW + GAP;
  const side = (width - cardW) / 2;
  const x = useSharedValue(0);
  const page = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
    // A light tick each time the next card snaps into the middle, like iOS pickers.
    const now = Math.round(e.contentOffset.x / step);
    if (now !== page.value) {
      page.value = now;
      scheduleOnRN(tick);
    }
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
        // Room for the glow above and below: a horizontal scroller clips everything outside its frame.
        contentContainerStyle={{ paddingHorizontal: side, gap: GAP, paddingVertical: GLOW_ROOM }}
        style={{ marginVertical: space.l - GLOW_ROOM }}
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

const tick = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync();
};

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

export type CardMenuItem = { title: string; icon: SFSymbol; destructive?: boolean; onPress: () => void };

/**
 * Face of a tall soft card: optional label and icon on top, the title in the middle, a line below.
 * With `href` (a screen in the stack) on iOS, the card is a native link: tap opens it with Apple's zoom
 * transition, long press shows the iOS preview of that screen with `menu` underneath.
 */
export function SoftCard({
  tone,
  title,
  subtitle,
  label,
  icon,
  onPress,
  onLongPress,
  accessibilityLabel,
  href,
  menu,
  detail = "gauge",
}: {
  tone: SoftTone;
  title: string;
  subtitle?: string;
  label?: string;
  icon?: IconName;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  href?: Href;
  menu?: CardMenuItem[];
  /** The small instrument drawn inside the card. */
  detail?: CardDetail;
}) {
  if (href && Platform.OS === "ios") {
    return (
      <Link href={href} asChild>
        <Link.Trigger withAppleZoom>
          <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={{ flex: 1 }}>
            <CardFace tone={tone} title={title} subtitle={subtitle} label={label} icon={icon} detail={detail} />
          </Pressable>
        </Link.Trigger>
        <Link.Preview />
        {menu?.length ? (
          <Link.Menu>
            {menu.map((m) => (
              <Link.MenuAction key={m.title} icon={m.icon} destructive={m.destructive} onPress={m.onPress}>
                {m.title}
              </Link.MenuAction>
            ))}
          </Link.Menu>
        ) : null}
      </Link>
    );
  }
  return <MorphCard tone={tone} title={title} subtitle={subtitle} label={label} icon={icon} detail={detail} onPress={onPress} onLongPress={onLongPress} accessibilityLabel={accessibilityLabel} />;
}

/** The card for everything that is not a stack screen (or the web preview): it grows into the next screen itself. */
function MorphCard({
  tone,
  title,
  subtitle,
  label,
  icon,
  detail,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  tone: SoftTone;
  title: string;
  subtitle?: string;
  label?: string;
  icon?: IconName;
  detail: CardDetail;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
}) {
  const ref = useRef<Measurable>(null);
  // Tap: the card grows into the next screen (services/morph), long press stays where it is.
  const open = () => {
    if (!ref.current) return onPress();
    ref.current.measureInWindow((x, y, width, height) => (width ? morphOpen({ x, y, width, height }, tone, CARD_RADIUS, onPress) : onPress()));
  };
  return (
    <PressScale
      onPress={open}
      onLongPress={onLongPress}
      delayLongPress={450}
      haptic="light"
      scaleTo={0.97}
      accessibilityLabel={accessibilityLabel ?? title}
      style={{ flex: 1 }}
    >
      <View ref={ref as never} collapsable={false} style={{ flex: 1 }}>
        <CardFace tone={tone} title={title} subtitle={subtitle} label={label} icon={icon} detail={detail} />
      </View>
    </PressScale>
  );
}

/** Label on top in the card's light, the instrument in the middle, the big title glowing at the bottom. */
function CardFace({ tone, title, subtitle, label, icon, detail }: { tone: SoftTone; title: string; subtitle?: string; label?: string; icon?: IconName; detail: CardDetail }) {
  const palette = SOFT[tone];
  return (
    <SoftSurface palette={palette} radius={CARD_RADIUS} style={styles.card}>
      <Detail kind={detail} color={palette.rim} />
      {(label || icon) && (
        <View style={styles.top}>
          <Text style={[styles.label, { color: palette.rim }]} numberOfLines={1}>
            {label}
          </Text>
          {icon && (
            <View style={styles.icon}>
              <Ionicons name={icon} size={16} color="#FFFFFFD9" />
            </View>
          )}
        </View>
      )}
      <View style={styles.bottom}>
        <Text style={[styles.title, { textShadowColor: `${palette.inner}CC` }]} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.7}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </SoftSurface>
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
  label: { flex: 1, ...font.roundedMedium, fontSize: 16, letterSpacing: 0.1 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF1F", borderWidth: 1, borderColor: "#FFFFFF2A" },
  bottom: { flex: 1, justifyContent: "flex-end", alignItems: "center", gap: 4 },
  title: { color: "#FFFFFF", ...font.rounded, fontSize: 34, lineHeight: 38, letterSpacing: -0.6, textAlign: "center", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18 },
  subtitle: { color: "#FFFFFFB3", ...font.roundedMedium, fontSize: 15 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  pageDot: { height: 6, borderRadius: 3 },
});
