// Color looks for the soft cards (ui/SoftSurface): a vertical gradient, a few color blobs on top, an inner
// glow rising from the bottom edge, a light rim and an outer glow. Four shades of the red world (Station:
// #CA0808, #120404, #270A0A, white, black): vivid, deep (near black with a hot glow), pale (light), night (quiet).
// Colors are 6-digit hex so blobs and glows can fade to their own transparent version.

/** Blob position and radius are fractions of the card (radius relative to its width). */
export type Blob = { x: number; y: number; r: number; color: string };
/** `inner` is the light pooling inside the card from its bottom edge. */
export type SoftPalette = { colors: string[]; positions: number[]; blobs: Blob[]; rim: string; glow: string; inner: string };

export type SoftTone = "vivid" | "deep" | "pale" | "night";

// Dark at the top, light rising from the bottom edge, like a lit glass slab.
export const SOFT: Record<SoftTone, SoftPalette> = {
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
};

/** Colors rotate through the shades, with a quiet card in between. */
export const ROTATION: SoftTone[] = ["vivid", "night", "pale", "deep"];
