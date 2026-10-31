// Color looks for the soft cards (ui/SoftSurface): black inside, an inner glow from the edges that pools at
// the bottom, a thin light rim and an outer glow. Four lights from the blue world (Deep Nebula: #000008,
// #080523, #010094, #261598, #7548D2): vivid (violet), deep (blue), pale (light lilac), night (quiet blue).
// Colors are 6-digit hex so blobs and glows can fade to their own transparent version.

import { useTheme } from "./theme.ts";

/** Blob position and radius are fractions of the card (radius relative to its width). */
export type Blob = { x: number; y: number; r: number; color: string };
/** `inner` is the light pooling inside the card from its bottom edge. */
export type SoftPalette = { colors: string[]; positions: number[]; blobs: Blob[]; rim: string; glow: string; inner: string };

export type SoftTone = "vivid" | "deep" | "pale" | "night";

// Black inside, the color only as light: glowing in from the edges and pooling at the bottom.
export const SOFT: Record<SoftTone, SoftPalette> = {
  vivid: {
    colors: ["#000008", "#03020F", "#0A0630"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.12, r: 0.7, color: "#7548D2" }],
    rim: "#C9B8FF",
    glow: "#7548D2",
    inner: "#9C7BFF",
  },
  deep: {
    colors: ["#000008", "#02010C", "#080523"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.12, r: 0.7, color: "#261598" }],
    rim: "#9C9CFF",
    glow: "#261598",
    inner: "#3D2BFF",
  },
  pale: {
    colors: ["#000008", "#05031A", "#120A45"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.1, r: 0.75, color: "#B9A2F0" }],
    rim: "#FFFFFF",
    glow: "#9C7BFF",
    inner: "#E6DCFF",
  },
  night: {
    colors: ["#000008", "#000008", "#04031A"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.15, r: 0.55, color: "#010094" }],
    rim: "#8A86B0",
    glow: "#010094",
    inner: "#2B3BFF",
  },
};

// Light mode: bright inside (white to a hint of lilac), the same colored light rising from the bottom.
export const SOFT_LIGHT: Record<SoftTone, SoftPalette> = {
  vivid: {
    colors: ["#FFFFFF", "#F7F4FF", "#E7DDFF"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.12, r: 0.7, color: "#9C7BFF" }],
    rim: "#7548D2",
    glow: "#9C7BFF",
    inner: "#7548D2",
  },
  deep: {
    colors: ["#FFFFFF", "#F4F5FF", "#DCDDFF"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.12, r: 0.7, color: "#3D2BD8" }],
    rim: "#261598",
    glow: "#6F63FF",
    inner: "#3D2BFF",
  },
  pale: {
    colors: ["#FFFFFF", "#FAF8FF", "#EFE9FF"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.1, r: 0.75, color: "#C9B8FF" }],
    rim: "#7548D2",
    glow: "#C9B8FF",
    inner: "#B9A2F0",
  },
  night: {
    colors: ["#FFFFFF", "#F3F3F8", "#E2E4F5"],
    positions: [0, 0.6, 1],
    blobs: [{ x: 0.5, y: 1.15, r: 0.55, color: "#5B6BFF" }],
    rim: "#3D3A66",
    glow: "#8A93FF",
    inner: "#4B5BFF",
  },
};

/** The card palettes for the current appearance (black cards in dark mode, bright ones in light mode). */
export function useSoft() {
  return useTheme().dark ? SOFT : SOFT_LIGHT;
}

/** Colors rotate through the shades, with a quiet card in between. */
export const ROTATION: SoftTone[] = ["vivid", "night", "pale", "deep"];
