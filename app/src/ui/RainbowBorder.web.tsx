// Web preview version of the rainbow edge: a masked conic gradient whose angle is animated with CSS.
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

// Gemini colors (blue, red, yellow, green) in crisp bands with short, hard transitions.
export const RAINBOW = ["#4285F4", "#4285F4", "#EA4335", "#EA4335", "#FBBC04", "#FBBC04", "#34A853", "#34A853", "#4285F4"];
export const RAINBOW_STOPS = [0, 0.21, 0.25, 0.46, 0.5, 0.71, 0.75, 0.96, 1];

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const css = `@property --fx-angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@keyframes fx-rainbow { to { --fx-angle: 360deg; } }
@media (prefers-reduced-motion: reduce) { [data-fx="rainbow"] { animation: none !important; } }`;
  const tag = document.createElement("style");
  tag.textContent = css;
  document.head.appendChild(tag);
}

type Props = { children: ReactNode; radius: number; intensity?: number; glow?: number; width?: number; style?: StyleProp<ViewStyle> };

export function RainbowBorder({ children, radius, intensity = 1, glow = 1, width = 2, style }: Props) {
  injectKeyframes();
  const gradient = `conic-gradient(from var(--fx-angle), ${RAINBOW.map((color, i) => `${color} ${RAINBOW_STOPS[i] * 360}deg`).join(", ")})`;
  const ring = (extra: object) =>
    ({
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      padding: width,
      backgroundImage: gradient,
      animation: "fx-rainbow 10s linear infinite",
      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
      WebkitMaskComposite: "xor",
      maskComposite: "exclude",
      pointerEvents: "none",
      ...extra,
    }) as unknown as ViewStyle;
  return (
    <View style={style}>
      {children}
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: 0.55 * intensity * glow, filter: "blur(3px)", padding: width * 1.5, inset: -width / 2 })} />
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: intensity })} />
    </View>
  );
}
