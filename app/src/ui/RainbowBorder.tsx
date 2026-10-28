// Subtle Gemini-style rainbow edge (native, Skia): a thin sweep-gradient stroke plus a soft blurred glow.
// The colors slowly travel around the shape; the shape itself stays still. Reduce Motion freezes it.
import { BlurMask, Canvas, Group, RoundedRect, SweepGradient, vec } from "@shopify/react-native-skia";
import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

export const RAINBOW = ["#4F8BFF", "#9B6BFF", "#FF5C7A", "#FFB547", "#3DDC84", "#4F8BFF"];

type Props = {
  children: ReactNode;
  /** Corner radius of the wrapped shape. */
  radius: number;
  /** 0…1, how present the edge is. Keep it low; it should be felt more than seen. */
  intensity?: number;
  width?: number;
  style?: StyleProp<ViewStyle>;
};

const GLOW = 14;

export function RainbowBorder({ children, radius, intensity = 0.7, width = 1.5, style }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(1, { duration: 10_000, easing: Easing.linear }), -1, false);
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
          <Group opacity={0.32 * intensity}>
            <RoundedRect x={GLOW} y={GLOW} width={size.w} height={size.h} r={radius} style="stroke" strokeWidth={width * 4}>
              <SweepGradient c={vec(cx, cy)} colors={RAINBOW} transform={shader} />
              <BlurMask blur={9} style="normal" />
            </RoundedRect>
          </Group>
          <RoundedRect
            x={GLOW + width / 2}
            y={GLOW + width / 2}
            width={size.w - width}
            height={size.h - width}
            r={Math.max(radius - width / 2, 0)}
            style="stroke"
            strokeWidth={width}
            opacity={0.85 * intensity}
          >
            <SweepGradient c={vec(cx, cy)} colors={RAINBOW} transform={shader} />
          </RoundedRect>
        </Canvas>
      )}
    </View>
  );
}
