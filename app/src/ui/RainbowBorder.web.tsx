// Web preview version of the rainbow edge: a masked conic gradient whose angle is animated with CSS.
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export const RAINBOW = ["#4F8BFF", "#9B6BFF", "#FF5C7A", "#FFB547", "#3DDC84", "#4F8BFF"];

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

type Props = { children: ReactNode; radius: number; intensity?: number; width?: number; style?: StyleProp<ViewStyle> };

export function RainbowBorder({ children, radius, intensity = 0.7, width = 1.5, style }: Props) {
  injectKeyframes();
  const gradient = `conic-gradient(from var(--fx-angle), ${RAINBOW.join(", ")})`;
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
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: 0.32 * intensity, filter: "blur(7px)", padding: width * 3 })} />
      <View {...({ dataSet: { fx: "rainbow" } } as object)} style={ring({ opacity: 0.85 * intensity })} />
    </View>
  );
}
