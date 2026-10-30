// A card whose edges melt softly into the background (Skia): gradient, color blobs and a lighter rim
// are drawn as one blurred layer, then fine grain on top. Children sit above it.
import { Blur, Canvas, Circle, ColorMatrix, FractalNoise, Group, LinearGradient, Paint, RadialGradient, Rect, RoundedRect, rect, rrect, vec } from "@shopify/react-native-skia";
import { useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { SoftPalette } from "./soft.ts";

const GRAY = [0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0];

export function SoftSurface({
  palette,
  radius,
  feather = 9,
  grain = 0.28,
  style,
  children,
}: {
  palette: SoftPalette;
  radius: number;
  /** How far the edge fades out, in points. */
  feather?: number;
  grain?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The blur spills past the card, so the canvas gets room around it.
  const pad = feather * 3;
  const { w, h } = size;
  return (
    <View style={style} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 && (
        <Canvas pointerEvents="none" style={{ position: "absolute", left: -pad, top: -pad, width: w + pad * 2, height: h + pad * 2 }}>
          <Group
            layer={
              <Paint>
                <Blur blur={feather} />
              </Paint>
            }
          >
            <Group clip={rrect(rect(pad, pad, w, h), radius, radius)}>
              <Rect x={pad} y={pad} width={w} height={h}>
                <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={palette.colors} positions={palette.positions} />
              </Rect>
              {palette.blobs.map((b, i) => (
                <Circle key={i} cx={pad + b.x * w} cy={pad + b.y * h} r={b.r * w}>
                  <RadialGradient c={vec(pad + b.x * w, pad + b.y * h)} r={b.r * w} colors={[b.color, `${b.color}00`]} />
                </Circle>
              ))}
            </Group>
            {/* Lighter rim just inside the edge, softened by the layer blur into a frosted glow. */}
            <RoundedRect x={pad + 3} y={pad + 3} width={w - 6} height={h - 6} r={radius - 3} style="stroke" strokeWidth={6} color={palette.rim} opacity={0.55} />
          </Group>
          <Group clip={rrect(rect(pad + feather, pad + feather, w - feather * 2, h - feather * 2), radius, radius)}>
            <Rect x={pad} y={pad} width={w} height={h} opacity={grain} blendMode="overlay">
              <FractalNoise freqX={0.6} freqY={0.6} octaves={3} seed={3} />
              <ColorMatrix matrix={GRAY} />
            </Rect>
          </Group>
        </Canvas>
      )}
      {children}
    </View>
  );
}
