// Color looks for the soft cards (ui/SoftSurface): a vertical gradient, a few color blobs on top, an inner
// glow rising from the bottom edge, a light rim and an outer glow. Four shades per color world (Settings):
// vivid, deep (near black with a hot glow), pale (light) and night (quiet).
// Colors are 6-digit hex so blobs and glows can fade to their own transparent version.
import { useSettings, type ColorTheme } from "../services/settings.ts";

/** Blob position and radius are fractions of the card (radius relative to its width). */
export type Blob = { x: number; y: number; r: number; color: string };
/** `inner` is the light pooling inside the card from its bottom edge. */
export type SoftPalette = { colors: string[]; positions: number[]; blobs: Blob[]; rim: string; glow: string; inner: string };

export type SoftTone = "vivid" | "deep" | "pale" | "night";

// Dark at the top, light rising from the bottom edge, like a lit glass slab.
export const SOFT: Record<ColorTheme, Record<SoftTone, SoftPalette>> = {
  // Station: #CA0808, #120404, #270A0A, white, black.
  red: {
    vivid: {
      colors: ["#270A0A", "#4A0707", "#8E0909"],
      positions: [0, 0.55, 1],
      blobs: [{ x: 0.5, y: 1.05, r: 0.75, color: "#E8231B" }],
      rim: "#FFB3AA",
      glow: "#CA0808",
      inner: "#FF2A1F",
    },
    deep: {
      colors: ["#050101", "#120404", "#2A0606"],
      positions: [0, 0.6, 1],
      blobs: [{ x: 0.5, y: 1.1, r: 0.6, color: "#CA0808" }],
      rim: "#FF8A7A",
      glow: "#CA0808",
      inner: "#FF1A10",
    },
    pale: {
      colors: ["#3A0A0A", "#9A1F1A", "#E0605A"],
      positions: [0, 0.55, 1],
      blobs: [{ x: 0.5, y: 1.05, r: 0.7, color: "#FFB3AA" }],
      rim: "#FFFFFF",
      glow: "#FF5A4F",
      inner: "#FFD2CC",
    },
    night: {
      colors: ["#0A0202", "#120404", "#270A0A"],
      positions: [0, 0.5, 1],
      blobs: [{ x: 0.5, y: 1.1, r: 0.6, color: "#6A0606" }],
      rim: "#B89A9A",
      glow: "#CA0808",
      inner: "#CA0808",
    },
  },
  // Deep Nebula: #000008, #080523, #010094, #261598, #7548D2.
  blue: {
    vivid: {
      colors: ["#080523", "#140C5E", "#261598"],
      positions: [0, 0.55, 1],
      blobs: [{ x: 0.5, y: 1.05, r: 0.75, color: "#3D2BD8" }],
      rim: "#C9B8FF",
      glow: "#261598",
      inner: "#7548D2",
    },
    deep: {
      colors: ["#000008", "#080523", "#120A45"],
      positions: [0, 0.6, 1],
      blobs: [{ x: 0.5, y: 1.1, r: 0.6, color: "#010094" }],
      rim: "#9C7BFF",
      glow: "#010094",
      inner: "#3D2BFF",
    },
    pale: {
      colors: ["#120A45", "#4A2FB0", "#B9A2F0"],
      positions: [0, 0.55, 1],
      blobs: [{ x: 0.5, y: 1.05, r: 0.7, color: "#EDE6FF" }],
      rim: "#FFFFFF",
      glow: "#7548D2",
      inner: "#E6DCFF",
    },
    night: {
      colors: ["#000008", "#080523", "#0E0838"],
      positions: [0, 0.5, 1],
      blobs: [{ x: 0.5, y: 1.1, r: 0.6, color: "#261598" }],
      rim: "#9A96B8",
      glow: "#261598",
      inner: "#261598",
    },
  },
};

/** The card palettes of the color world chosen in Settings. */
export function useSoft() {
  return SOFT[useSettings().colorTheme ?? "red"];
}

/** Colors rotate through the shades, with a quiet card in between. */
export const ROTATION: SoftTone[] = ["vivid", "night", "pale", "deep"];
