// Web fallback for the Skia aurora (the preview has no CanvasKit): CSS radial gradients with a cross-fade.
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useCurrentArea } from "../services/area.ts";
import { areaColors, useTheme } from "./theme.ts";

export function Aurora() {
  const { dark, c } = useTheme();
  const area = useCurrentArea();
  const [layers, setLayers] = useState([{ area, key: 0 }]);

  useEffect(() => {
    setLayers((l) => [...l.slice(-1), { area, key: (l.at(-1)?.key ?? 0) + 1 }]);
  }, [area]);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.background, overflow: "hidden" }]}>
      {layers.map((layer, i) => {
        const [a, b, d] = areaColors[layer.area].glow;
        const alpha = dark ? "88" : "44";
        return (
          <View
            key={layer.key}
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: i === layers.length - 1 ? 1 : 0,
                // @ts-expect-error web-only style properties
                transition: "opacity 900ms cubic-bezier(0.22, 1, 0.36, 1)",
                backgroundImage: `radial-gradient(60% 40% at 15% 5%, ${a}${alpha}, transparent 70%), radial-gradient(55% 38% at 90% 10%, ${b}${alpha}, transparent 70%), radial-gradient(50% 30% at 50% 30%, ${d}88, transparent 70%), linear-gradient(to bottom, transparent 20%, ${c.background} 62%)`,
              },
            ]}
          />
        );
      })}
    </View>
  );
}
