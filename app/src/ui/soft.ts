// Color looks for the soft cards (ui/SoftSurface): a vertical gradient, a few blurred color blobs on top,
// and a lighter rim. Colors are 6-digit hex so the blobs can fade to their own transparent version.

/** Blob position and radius are fractions of the card (radius relative to its width). */
export type Blob = { x: number; y: number; r: number; color: string };
export type SoftPalette = { colors: string[]; positions: number[]; blobs: Blob[]; rim: string };

export const SOFT = {
  pink: {
    colors: ["#F24FC2", "#7C1E88", "#2B0B37"],
    positions: [0, 0.45, 1],
    blobs: [
      { x: 0.1, y: 0, r: 0.6, color: "#FF5FD6" },
      { x: 0.85, y: 1, r: 0.6, color: "#FF7A3C" },
    ],
    rim: "#FF9BE6",
  },
  blue: {
    colors: ["#3540B8", "#161B5E", "#0B0E30"],
    positions: [0, 0.5, 1],
    blobs: [
      { x: 0.45, y: 1, r: 0.75, color: "#38C8EC" },
      { x: 1, y: 0.55, r: 0.5, color: "#B45CE0" },
    ],
    rim: "#97A2FF",
  },
  orange: {
    colors: ["#E2312E", "#FF7428", "#FFC34A"],
    positions: [0, 0.55, 1],
    blobs: [{ x: 0.15, y: 0, r: 0.6, color: "#D0145E" }],
    rim: "#FFB98A",
  },
  graphite: {
    colors: ["#2D3242", "#13161F", "#07080C"],
    positions: [0, 0.5, 1],
    blobs: [{ x: 0.95, y: 0, r: 0.65, color: "#3D5BFF" }],
    rim: "#6C7690",
  },
} satisfies Record<string, SoftPalette>;

export type SoftTone = keyof typeof SOFT;

/** Colors rotate like the reference cards: pink, blue, orange. */
export const ROTATION: SoftTone[] = ["pink", "blue", "orange"];
