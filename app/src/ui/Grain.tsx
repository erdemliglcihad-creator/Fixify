// Fine gray film grain over a surface (native, Skia fractal noise, desaturated).
import { Canvas, ColorMatrix, FractalNoise, Rect } from "@shopify/react-native-skia";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

// Luminance to gray, alpha kept: turns the colored noise into neutral grain.
const GRAY = [0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0.33, 0.33, 0.33, 0, 0, 0, 0, 0, 1, 0];

export function Grain({ opacity = 0.12 }: { opacity?: number }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Rect x={0} y={0} width={size.w} height={size.h} opacity={opacity} blendMode="overlay">
            <FractalNoise freqX={0.9} freqY={0.9} octaves={3} seed={7} />
            <ColorMatrix matrix={GRAY} />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}
