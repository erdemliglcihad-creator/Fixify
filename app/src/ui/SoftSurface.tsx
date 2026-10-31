// A lit glass slab (Skia): black inside, colored light glowing in from the edges and pooling at the bottom,
// a thin light rim, a round glow spilling out underneath, fine grain, and a smooth round outline.
// Children sit above it.
import { BlurMask, Canvas, Circle, Group, LinearGradient, RadialGradient, Rect, RoundedRect, Shader, Skia, rect, rrect, vec } from "@shopify/react-native-skia";
import { useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { GRAIN, grainDensity } from "./Grain";
import type { SoftPalette } from "./soft.ts";

// Edge mask: distance to the rounded rectangle, faded smoothly over `feather` points with a little noise
// mixed in, so the outline is soft and slightly grainy, never a hard straight line.
const EDGE = Skia.RuntimeEffect.Make(`
uniform float2 origin;
uniform float2 size;
uniform float radius;
uniform float feather;
uniform float density;

float roundBox(float2 p, float2 b, float r) {
  float2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

half4 main(float2 xy) {
  float d = roundBox(xy - origin - size * 0.5, size * 0.5, radius);
  // Same crisp pixel grain as the card surface, so the edge reads as part of it.
  float n = hash(floor(xy * density)) - 0.5;
  float a = 1.0 - smoothstep(-feather, feather * 0.5, d + n * feather * 0.3);
  return half4(a);
}
`)!;

export function SoftSurface({
  palette,
  radius,
  glow = 1,
  grain = 0.18,
  feather = 1.5,
  style,
  children,
}: {
  palette: SoftPalette;
  radius: number;
  /** Strength of the outer glow (0 to 1). */
  glow?: number;
  grain?: number;
  /** How soft the outline is, in points. */
  feather?: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  // The outer glow reaches about three blur radii past the card: the canvas must be that much larger,
  // otherwise the glow is cut off in a rectangle (that made the glow look angular).
  const pad = 90;
  const { w, h } = size;
  const shape = rrect(rect(pad, pad, w, h), radius, radius);
  // Content is drawn a little past the shape; the edge mask decides what stays.
  const over = rect(pad - feather, pad - feather, w + feather * 2, h + feather * 2);
  return (
    <View style={style} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w > 0 && (
        <Canvas pointerEvents="none" style={{ position: "absolute", left: -pad, top: -pad, width: w + pad * 2, height: h + pad * 2 }}>
          {/* Outer glow: a soft halo of the card's color, strongest below where the inner light spills out. */}
          <Group transform={[{ translateY: 12 }]}>
            <RoundedRect rect={shape} color={palette.glow} opacity={0.6 * glow}>
              <BlurMask blur={26} style="outer" />
            </RoundedRect>
          </Group>

          <Group layer>
            {/* Black inside. */}
            <Rect rect={over}>
              <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={palette.colors} positions={palette.positions} />
            </Rect>
            {/* Light pooling at the bottom, rising into the black. */}
            {palette.blobs.map((b, i) => (
              <Circle key={i} cx={pad + b.x * w} cy={pad + b.y * h} r={b.r * w}>
                <RadialGradient c={vec(pad + b.x * w, pad + b.y * h)} r={b.r * w} colors={[b.color, `${b.color}00`]} />
              </Circle>
            ))}
            {/* Inner glow along every edge: faint at the top, strong and bright at the bottom. */}
            <RoundedRect rect={shape} style="stroke" strokeWidth={34}>
              <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={[`${palette.inner}18`, `${palette.inner}55`, palette.inner]} positions={[0, 0.5, 1]} />
              <BlurMask blur={18} style="normal" />
            </RoundedRect>
            <RoundedRect rect={shape} style="stroke" strokeWidth={12}>
              <LinearGradient start={vec(0, pad + h * 0.55)} end={vec(0, pad + h)} colors={[`${palette.inner}00`, "#FFFFFF"]} />
              <BlurMask blur={6} style="normal" />
            </RoundedRect>
            {/* Thin light rim: a hairline catching the light, brightest where the glow is. */}
            <RoundedRect rect={rrect(rect(pad + 0.75, pad + 0.75, w - 1.5, h - 1.5), radius - 0.75, radius - 0.75)} style="stroke" strokeWidth={1.5}>
              <LinearGradient start={vec(0, pad)} end={vec(0, pad + h)} colors={[`${palette.rim}66`, `${palette.rim}26`, `${palette.rim}DD`]} positions={[0, 0.5, 1]} />
            </RoundedRect>
            {/* Crisp, even grain over the whole card, the same texture as the backdrop. */}
            <Rect rect={over} opacity={grain} blendMode="overlay">
              <Shader source={GRAIN} uniforms={{ density: grainDensity() }} />
            </Rect>
            {/* Smooth, round outline with a hair of softness. */}
            <Rect x={0} y={0} width={w + pad * 2} height={h + pad * 2} blendMode="dstIn">
              <Shader source={EDGE} uniforms={{ origin: vec(pad, pad), size: vec(w, h), radius, feather, density: grainDensity() }} />
            </Rect>
          </Group>
        </Canvas>
      )}
      {children}
    </View>
  );
}
