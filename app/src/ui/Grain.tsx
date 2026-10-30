// Film grain over a surface (native, Skia): crisp gray noise, one value per pair of display pixels,
// blended with overlay. A hash per pixel stays sharp; smooth fractal noise turns blotchy and blurry.
import { Canvas, Rect, Shader, Skia } from "@shopify/react-native-skia";
import { useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";

/** Grain shader: `density` grains per point (display pixels per point divided by grain size in pixels). */
export const GRAIN = Skia.RuntimeEffect.Make(`
uniform float density;

// Sine-free hash (Dave Hoskins): even, without the banding sin() hashes get at large coordinates.
float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

half4 main(float2 xy) {
  return half4(half3(hash(floor(xy * density))), 1.0);
}
`)!;

/** Two display pixels per grain: fine and crisp on any iPhone. */
export const grainDensity = () => PixelRatio.get() / 2;

export function Grain({ opacity = 0.12 }: { opacity?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.w} height={size.h} opacity={opacity} blendMode="overlay">
            <Shader source={GRAIN} uniforms={{ density: grainDensity() }} />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}
