// Web preview version of the rainbow edge: a masked conic gradient whose angle is animated with CSS.
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

// Like the reference: saturated blue, white-hot yellow and orange, purple and red, flowing into each other.
export const RAINBOW = ["#2F7BFF", "#7CC4FF", "#FF7A1A", "#FFD84D", "#FFF6D8", "#3AA0FF", "#B14DFF", "#FF5C3A", "#2F7BFF"];

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
  const gradient = `conic-gradient(from var(--fx-angle), ${RAINBOW.join(", ")})`;
  const ring = (extra: object) =>
    ({
      position: "absolute",
      inset: 0,
      borderRadius: radius,
      padding: width,
      backgroundImage: gradient,
      animation: "fx-rainbow 6s linear infinite",
      WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
      WebkitMaskComposite: "xor",
      maskComposite: "exclude",
      pointerEvents: "none",
      ...extra,
    }) as unknown as ViewStyle;
  return (
    <View style={style}>
      {children}
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: 0.5 * intensity * glow, filter: `blur(${11 * glow}px)`, padding: width * 4, inset: -width * 1.5 })} />
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: 0.9 * intensity, filter: "blur(3px)", padding: width * 2, inset: -width / 2 })} />
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: intensity })} />
    </View>
  );
}
