// A quiet grid of small dots (white on dark, dark on light) behind the home screen (Skia shader: one surface, not thousands of views).
// Dots sit on a fixed raster, are anti-aliased, and fade out toward the bottom so the cards stay in front.
import { Canvas, Rect, Shader, Skia } from "@shopify/react-native-skia";
import { StyleSheet, useWindowDimensions } from "react-native";
import { useTheme } from "./theme.ts";

const DOTS = Skia.RuntimeEffect.Make(`
uniform float spacing;
uniform float radius;
uniform float alpha;
uniform float height;
uniform float tone;

half4 main(float2 xy) {
  float2 cell = fract(xy / spacing) - 0.5;
  float d = length(cell) * spacing;
  float dot = 1.0 - smoothstep(radius - 0.5, radius + 0.5, d);
  float fade = 1.0 - smoothstep(0.35, 1.0, xy.y / height);
  float a = dot * alpha * (0.35 + 0.65 * fade);
  return half4(tone * a, tone * a, tone * a, a);
}
`)!;

export function DotGrid({ spacing = 18, radius = 1.1, alpha = 0.16 }: { spacing?: number; radius?: number; alpha?: number }) {
  const { width, height } = useWindowDimensions();
  const { dark } = useTheme();
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <Shader source={DOTS} uniforms={{ spacing, radius, alpha: dark ? alpha : alpha * 0.8, height, tone: dark ? 1 : 0 }} />
      </Rect>
    </Canvas>
  );
}
