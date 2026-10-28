// Rainbow ring (native, Skia): a thin, crisp sweep-gradient stroke with a colored glow.
// The colors slowly travel around the shape; the shape itself stays still. Reduce Motion freezes it.
import { BlurMask, Canvas, Group, RoundedRect, SweepGradient, vec } from "@shopify/react-native-skia";
import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

// Like the reference: saturated blue, white-hot yellow and orange, purple and red, flowing into each other.
export const RAINBOW = ["#2F7BFF", "#7CC4FF", "#FF7A1A", "#FFD84D", "#FFF6D8", "#3AA0FF", "#B14DFF", "#FF5C3A", "#2F7BFF"];

type Props = {
  children: ReactNode;
  /** Corner radius of the wrapped shape. */
  radius: number;
  /** 0…1, how present the ring is. */
  intensity?: number;
  /** Multiplier for the outer glow (lower it inside cards that clip their edges). */
  glow?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
};

const GLOW = 30;

export function RainbowBorder({ children, radius, intensity = 1, glow = 1, width = 2, style }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(1, { duration: 6_000, easing: Easing.linear }), -1, false);
  }, [reduceMotion]);

  const cx = size.w / 2 + GLOW;
  const cy = size.h / 2 + GLOW;
  // Rotate the gradient (not the shape) around the center.
  const shader = useDerivedValue(() => [{ translateX: cx }, { translateY: cy }, { rotate: turn.value * Math.PI * 2 }, { translateX: -cx }, { translateY: -cy }]);

  return (
    <View style={style} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {children}
      {size.w > 0 && (
        <Canvas pointerEvents="none" style={{ position: "absolute", left: -GLOW, top: -GLOW, width: size.w + GLOW * 2, height: size.h + GLOW * 2 }}>
          {/* Glow in the ring's colors: a soft halo and a brighter, tighter glow on top. */}
          <Group opacity={0.5 * intensity * glow}>
            <RoundedRect x={GLOW} y={GLOW} width={size.w} height={size.h} r={radius} style="stroke" strokeWidth={width * 5}>
              <SweepGradient c={vec(cx, cy)} colors={RAINBOW} transform={shader} />
              <BlurMask blur={11 * glow} style="normal" />
            </RoundedRect>
          </Group>
          <Group opacity={0.9 * intensity}>
            <RoundedRect x={GLOW} y={GLOW} width={size.w} height={size.h} r={radius} style="stroke" strokeWidth={width * 2.5}>
              <SweepGradient c={vec(cx, cy)} colors={RAINBOW} transform={shader} />
              <BlurMask blur={4} style="normal" />
            </RoundedRect>
          </Group>
          {/* The crisp ring itself. */}
          <RoundedRect
            x={GLOW + width / 2}
            y={GLOW + width / 2}
            width={size.w - width}
            height={size.h - width}
            r={Math.max(radius - width / 2, 0)}
            style="stroke"
            strokeWidth={width}
            opacity={intensity}
          >
            <SweepGradient c={vec(cx, cy)} colors={RAINBOW} transform={shader} />
          </RoundedRect>
          {/* Thin glassy highlight just inside the ring. */}
          <RoundedRect
            x={GLOW + width + 0.5}
            y={GLOW + width + 0.5}
            width={size.w - width * 2 - 1}
            height={size.h - width * 2 - 1}
            r={Math.max(radius - width, 0)}
            style="stroke"
            strokeWidth={1}
            color="#FFFFFF"
            opacity={0.12 * intensity}
          />
        </Canvas>
      )}
    </View>
  );
}
