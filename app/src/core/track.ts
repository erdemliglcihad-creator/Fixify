// Follows a tapped object from frame to frame without changing its shape: at the tap, the brightness pattern
// inside the object's shape is remembered (the "template"); in each new frame, the template is searched
// around the last position, also slightly larger or smaller. Brightness is compared relative to its own
// average, so a change in light does not throw it off. Only the position and size change, never the shape.
import type { Segment } from "./segment.ts";

export type Template = {
  /** Sample points inside the shape, relative to the shape's center (frame pixels). */
  xs: Float32Array;
  ys: Float32Array;
  /** Brightness at those points minus their average. */
  vals: Float32Array;
  /** Shape center in the frame where it was tapped. */
  cx: number;
  cy: number;
  /** The object's own contrast (mean absolute deviation), so scores mean the same for any object. */
  contrast: number;
};

/** Where the object is now: moved by dx, dy (frame pixels) and scaled by s around its center. */
export type Pose = { dx: number; dy: number; s: number };

export const restPose: Pose = { dx: 0, dy: 0, s: 1 };

const luma = (rgba: Uint8Array, i: number) => 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];

/** Remembers the object's look from the frame it was tapped in. */
export function makeTemplate(rgba: Uint8Array, seg: Segment, step = 2): Template {
  const { width: w, height: h, mask } = seg;
  const cx = seg.cx * (w - 1);
  const cy = seg.cy * (h - 1);
  const xs: number[] = [];
  const ys: number[] = [];
  const vals: number[] = [];
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (!mask[y * w + x]) continue;
      xs.push(x - cx);
      ys.push(y - cy);
      vals.push(luma(rgba, (y * w + x) * 4));
    }
  }
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
  const centered = vals.map((v) => v - mean);
  const contrast = Math.max(centered.reduce((a, b) => a + Math.abs(b), 0) / Math.max(centered.length, 1), 4);
  return { xs: Float32Array.from(xs), ys: Float32Array.from(ys), vals: Float32Array.from(centered), cx, cy, contrast };
}

/** Average difference between the template and the frame at a pose (lower = better match). */
function score(t: Template, rgba: Uint8Array, w: number, h: number, px: number, py: number, s: number, stride = 1) {
  let sum = 0;
  let n = 0;
  const samples: number[] = [];
  for (let k = 0; k < t.xs.length; k += stride) {
    const x = Math.round(px + t.xs[k] * s);
    const y = Math.round(py + t.ys[k] * s);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const v = luma(rgba, (y * w + x) * 4);
    samples.push(v);
    sum += v;
    n++;
  }
  // Mostly outside the picture: not a usable match.
  if (n < (t.xs.length / stride) * 0.6) return Infinity;
  const mean = sum / n;
  let diff = 0;
  let j = 0;
  for (let k = 0; k < t.xs.length; k += stride) {
    const x = Math.round(px + t.xs[k] * s);
    const y = Math.round(py + t.ys[k] * s);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    diff += Math.abs(samples[j++] - mean - t.vals[k]);
  }
  // Relative to the object's own contrast: 0 = perfect, about 1 = no better than a flat area.
  return diff / n / t.contrast;
}

/** A match must be clearly better to change size or move far: keeps the layer calm. */
function steady(sc: number, s: number, prevS: number, dx: number, dy: number) {
  return sc + 0.6 * Math.abs(Math.log(s / prevS)) + 0.0015 * Math.hypot(dx, dy);
}

/**
 * Finds the object again near its last pose. Coarse search over position and size, then a fine search
 * around the best spot. Returns null when nothing matches well enough (covered, out of view).
 */
export function track(t: Template, rgba: Uint8Array, w: number, h: number, prev: Pose, radius = 26, maxScore = 0.6): { pose: Pose; score: number } | null {
  const baseX = t.cx + prev.dx;
  const baseY = t.cy + prev.dy;
  const stride = t.xs.length > 1200 ? 3 : t.xs.length > 500 ? 2 : 1;
  let best = { x: baseX, y: baseY, s: prev.s, sc: Infinity, raw: Infinity };
  for (const ds of [0.9, 1, 1.1]) {
    const s = Math.min(Math.max(prev.s * ds, 0.4), 2.5);
    // Symmetric grid that always includes "not moved".
    const steps = Math.floor(radius / 3);
    for (let iy = -steps; iy <= steps; iy++) {
      for (let ix = -steps; ix <= steps; ix++) {
        const dx = ix * 3;
        const dy = iy * 3;
        const raw = score(t, rgba, w, h, baseX + dx, baseY + dy, s, stride);
        const sc = steady(raw, s, prev.s, dx, dy);
        if (sc < best.sc) best = { x: baseX + dx, y: baseY + dy, s, sc, raw };
      }
    }
  }
  // Fine: pixel steps and smaller size steps around the coarse winner.
  const coarse = best;
  for (const ds of [0.96, 1, 1.04]) {
    const s = Math.min(Math.max(coarse.s * ds, 0.4), 2.5);
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const raw = score(t, rgba, w, h, coarse.x + dx, coarse.y + dy, s, 1);
        const sc = steady(raw, s, prev.s, coarse.x + dx - baseX, coarse.y + dy - baseY);
        if (sc < best.sc) best = { x: coarse.x + dx, y: coarse.y + dy, s, sc, raw };
      }
    }
  }
  if (!Number.isFinite(best.raw) || best.raw > maxScore) return null;
  return { pose: { dx: best.x - t.cx, dy: best.y - t.cy, s: best.s }, score: best.raw };
}
