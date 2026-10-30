// A lit glass slab (Skia): dark at the top, colored light pooling inside from the bottom edge, a thin
// light rim, a glow spilling out underneath, fine grain over everything, and an outline that dissolves
// pixel by pixel into the background instead of cutting a clean line. Children sit above it.
import { BlurMask, Canvas, Circle, ColorMatrix, FractalNoise, Group, LinearGradient, RadialGradient, Rect, RoundedRect, Shader, Skia, rect, rrect, vec } from "@shopify/react-native-skia";
import { useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import type { SoftPalette } from "./soft.ts";

// Noise to neutral gray (alpha kept): grain over the whole card.
const GRAY = [0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0];

// Edge mask: distance to the rounded rectangle, shaken by per-pixel noise, so the outline breaks up
// into grains over `feather` points (dithered, never a smooth blur and never a straight line).
const EDGE = Skia.RuntimeEffect.Make(`
uniform float2 origin;
uniform float2 size;
uniform float radius;
uniform float feather;

float roundBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453);
}

half4 main(float2 xy) {
  float d = roundBox(xy - origin - size * 0.5, size * 0.5, radius);
  // Coarse grains: one noise value per 2.5 point block, so the edge breaks up into visible specks.
  float n = hash(floor(xy / 2.5)) - 0.5;
  float a = 1.0 - smoothstep(-feather * 0.6, feather * 0.4, d + n * feather * 1.8);
  return half4(a);
}
`)!;

export function SoftSurface({
  palette,
  radius,
  glow = 1,
  grain = 0.24,
  feather = 4,
  style,
  children,
}: {
  palette: SoftPalette;
  radius: number;
  /** Strength of the outer glow (0 to 1). */
  glow?: number;
  grain?: number;
  /** How wide the grainy edge is, in points. */
  feather?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The outer glow reaches past the card, so the canvas gets room around it.
  const pad = 30;
  const { w, h } = size;
  const shape = rrect(rect(pad, pad, w, h), radius, radius);
  // Content is drawn a little past the shape; the edge mask decides what stays.
  const over = rect(pad - feather, pad - feather, w + feather * 2, h + feather * 2);
  return (
    <View style={style} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 && (
        <Canvas pointerEvents="none" style={{ position: "absolute", left: -pad, top: -pad, width: w + pad * 2, height: h + pad * 2 }}>
          {/* Outer glow, strongest below the card where the inner light spills out. */}
          <Group transform={[{ translateY: 10 }]}>
            <RoundedRect rect={shape} color={palette.glow} opacity={0.55 * glow}>
              <BlurMask blur={26} style="outer" />
            </RoundedRect>
          </Group>

          <Group layer>
            <Rect rect={over}>
              <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={palette.colors} positions={palette.positions} />
            </Rect>
            {palette.blobs.map((b, i) => (
              <Circle key={i} cx={pad + b.x * w} cy={pad + b.y * h} r={b.r * w}>
                <RadialGradient c={vec(pad + b.x * w, pad + b.y * h)} r={b.r * w} colors={[b.color, `${b.color}00`]} />
              </Circle>
            ))}
            {/* Inner glow: light along the inside of the edge, faint at the top, bright at the bottom. */}
            <RoundedRect rect={shape} style="stroke" strokeWidth={26}>
              <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={[`${palette.inner}10`, `${palette.inner}40`, palette.inner]} positions={[0, 0.55, 1]} />
              <BlurMask blur={14} style="normal" />
            </RoundedRect>
            <RoundedRect rect={shape} style="stroke" strokeWidth={8}>
              <LinearGradient start={vec(0, pad + h * 0.6)} end={vec(0, pad + h)} colors={[`${palette.inner}00`, palette.inner]} />
              <BlurMask blur={4} style="normal" />
            </RoundedRect>
            {/* Thin light rim, a little brighter where the light comes from. */}
            <RoundedRect rect={rrect(rect(pad + 1, pad + 1, w - 2, h - 2), radius - 1, radius - 1)} style="stroke" strokeWidth={1.5}>
              <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={[`${palette.rim}55`, `${palette.rim}22`, `${palette.rim}AA`]} positions={[0, 0.5, 1]} />
            </RoundedRect>
            {/* Coarse, even grain over the whole card, the same texture as the backdrop. */}
            <Rect rect={over} opacity={grain} blendMode="overlay">
              <FractalNoise freqX={0.32} freqY={0.32} octaves={2} seed={3} />
              <ColorMatrix matrix={GRAY} />
            </Rect>
            {/* Keep only what the grainy edge mask lets through. */}
            <Rect x={0} y={0} width={w + pad * 2} height={h + pad * 2} blendMode="dstIn">
              <Shader source={EDGE} uniforms={{ origin: vec(pad, pad), size: vec(w, h), radius, feather }} />
            </Rect>
          </Group>
        </Canvas>
      )}
      {children}
    </View>
  );
}
