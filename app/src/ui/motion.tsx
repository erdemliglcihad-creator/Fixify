// Motion building blocks. Everything runs on the UI thread (Reanimated), so it keeps up with 120 Hz ProMotion
// screens. Springs instead of fixed durations: they start from the current value and can be interrupted.
import MaskedView from "@react-native-masked-view/masked-view";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { Platform, Pressable, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

/** Critically damped: settles without overshoot. For things that appear or follow the finger. */
export const SNAP = { duration: 260, dampingRatio: 1 } as const;
/** A little bounce, only after a gesture that carried momentum (release, flick). */
export const BOUNCE = { duration: 420, dampingRatio: 0.72 } as const;

// The package still ships class typings that React 19 types reject; the runtime component is fine.
const Masked = MaskedView as unknown as ComponentType<{ maskElement: ReactElement; children: ReactNode }>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressScaleProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  /** How far it sinks while held. */
  scaleTo?: number;
  haptic?: "selection" | "light" | "medium" | false;
};

/** Sinks on touch-down (instant feedback) and springs back with a small bounce on release. */
export function PressScale({ style, children, scaleTo = 0.95, haptic = "selection", onPressIn, onPressOut, onPress, ...rest }: PressScaleProps) {
  // Squish, not just shrink: the shape gets a touch wider and flatter under the finger (a small morph),
  // then springs back into form.
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.value }, { scaleY: sy.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => {
        sx.value = withSpring(1 - (1 - scaleTo) * 0.35, SNAP);
        sy.value = withSpring(scaleTo - (1 - scaleTo) * 0.4, SNAP);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        sx.value = withSpring(1, BOUNCE);
        sy.value = withSpring(1, BOUNCE);
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== "web") {
          if (haptic === "selection") Haptics.selectionAsync();
          else Haptics.impactAsync(haptic === "light" ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Staggered entrance: rises a few points and fades in. Reduce Motion turns it off (system setting). */
export function Rise({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 10) * 55).springify().damping(20).stiffness(170)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Text filled with a gradient (titles, greeting). */
export function GradientText({ children, colors, style }: { children: ReactNode; colors: readonly [string, string, ...string[]]; style?: StyleProp<TextStyle> }) {
  if (Platform.OS === "web") {
    const web = {
      backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    } as unknown as TextStyle;
    return <Text style={[style, web]}>{children}</Text>;
  }
  return (
    <Masked maskElement={<Text style={style}>{children}</Text>}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.4 }}>
        <Text style={[style, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </Masked>
  );
}
