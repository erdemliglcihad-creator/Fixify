// Cuts out the object under a tap in a small camera frame, without any ML: the region grows from the tapped
// pixel over similar colors and stops at edges (big color jumps). Good for things with a clear color or
// outline (a device, a part, a cable); it returns null when the "object" would be the whole background.

export type Segment = {
  /** 1 = object, 0 = background; w × h. */
  mask: Uint8Array;
  width: number;
  height: number;
  area: number;
  /** Center of the object, 0..1 of the frame (used as the seed for the next frame: simple tracking). */
  cx: number;
  cy: number;
  /** Bounding box, 0..1 of the frame. */
  box: { x: number; y: number; w: number; h: number };
};

type Options = {
  /** How far a pixel may differ from the tapped color. */
  tolerance: number;
  /** How far a pixel may differ from its neighbor (edge stop). */
  edge: number;
  /** Larger than this share of the frame = background, not an object. */
  maxShare: number;
  /** Smaller than this share = too little to show. */
  minShare: number;
};

const DEFAULTS: Options = { tolerance: 70, edge: 30, maxShare: 0.45, minShare: 0.004 };

/** Perceptual-ish RGB distance ("redmean"), about 0…765. */
function dist(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

function grow(rgba: Uint8Array, w: number, h: number, sx: number, sy: number, o: Options) {
  // Average color around the seed, so one noisy pixel does not decide.
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Math.max(0, sy - 2); y <= Math.min(h - 1, sy + 2); y++) {
    for (let x = Math.max(0, sx - 2); x <= Math.min(w - 1, sx + 2); x++) {
      const i = (y * w + x) * 4;
      r += rgba[i];
      g += rgba[i + 1];
      b += rgba[i + 2];
      n++;
    }
  }
  r /= n;
  g /= n;
  b /= n;

  const mask = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  mask[sy * w + sx] = 1;
  let area = 1;
  const limit = w * h * o.maxShare;
  while (stack.length) {
    const p = stack.pop()!;
    const px = p % w;
    const py = (p - px) / w;
    const i = p * 4;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const q = ny * w + nx;
      if (mask[q]) continue;
      const j = q * 4;
      if (dist(rgba[j], rgba[j + 1], rgba[j + 2], r, g, b) > o.tolerance) continue;
      if (dist(rgba[j], rgba[j + 1], rgba[j + 2], rgba[i], rgba[i + 1], rgba[i + 2]) > o.edge) continue;
      mask[q] = 1;
      area++;
      if (area > limit) return { mask, area };
      stack.push(q);
    }
  }
  return { mask, area };
}

/** Fills holes (background pockets fully inside the object), so glare spots do not punch holes. */
function fillHoles(mask: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    const p = y * w + x;
    if (!mask[p] && !outside[p]) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  for (let p = 0; p < w * h; p++) if (!outside[p]) mask[p] = 1;
}

export function segmentAt(rgba: Uint8Array, w: number, h: number, seed: { x: number; y: number }, options: Partial<Options> = {}): Segment | null {
  const o = { ...DEFAULTS, ...options };
  const sx = Math.min(Math.max(Math.round(seed.x * (w - 1)), 0), w - 1);
  const sy = Math.min(Math.max(Math.round(seed.y * (h - 1)), 0), h - 1);

  // Try normal, then stricter (if it ran into the background), then looser (if it caught almost nothing).
  let result = grow(rgba, w, h, sx, sy, o);
  if (result.area > w * h * o.maxShare) result = grow(rgba, w, h, sx, sy, { ...o, tolerance: o.tolerance * 0.55, edge: o.edge * 0.7 });
  if (result.area > w * h * o.maxShare) return null;
  if (result.area < w * h * o.minShare) result = grow(rgba, w, h, sx, sy, { ...o, tolerance: o.tolerance * 1.5, edge: o.edge * 1.4 });
  if (result.area < w * h * o.minShare || result.area > w * h * o.maxShare) return null;

  const mask = result.mask;
  fillHoles(mask, w, h);

  let area = 0, sumX = 0, sumY = 0, minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      area++;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return {
    mask,
    width: w,
    height: h,
    area,
    cx: sumX / area / (w - 1),
    cy: sumY / area / (h - 1),
    box: { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h },
  };
}

/** Horizontal runs of the mask, for drawing it as one shape: [y, xStart, xEnd] in pixels. */
export function maskRuns(s: Segment): [number, number, number][] {
  const runs: [number, number, number][] = [];
  for (let y = 0; y < s.height; y++) {
    let start = -1;
    for (let x = 0; x <= s.width; x++) {
      const on = x < s.width && s.mask[y * s.width + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push([y, start, x]);
        start = -1;
      }
    }
  }
  return runs;
}

/**
 * The object's outline as one closed polygon (frame pixels, pixel corners), traced clockwise around the
 * mask with Moore-neighbor tracing and thinned so it draws as a smooth contour.
 */
export function maskOutline(s: Segment, step = 2): { x: number; y: number }[] {
  const { mask, width: w, height: h } = s;
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let start = -1;
  for (let p = 0; p < w * h; p++) {
    if (mask[p]) {
      start = p;
      break;
    }
  }
  if (start < 0) return [];
  // Clockwise neighbors starting west.
  const dirs = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const sx = start % w;
  const sy = (start - sx) / w;
  let x = sx;
  let y = sy;
  let back = 0; // we "came from" the west of the first pixel (nothing is to its left on this row)
  const points: { x: number; y: number }[] = [];
  const maxSteps = w * h * 4;
  for (let i = 0; i < maxSteps; i++) {
    points.push({ x: x + 0.5, y: y + 0.5 });
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (back + k) % 8;
      const nx = x + dirs[d][0];
      const ny = y + dirs[d][1];
      if (at(nx, ny)) {
        // Next search starts just after the direction pointing back to where we came from.
        back = (d + 4) % 8;
        x = nx;
        y = ny;
        found = true;
        break;
      }
    }
    if (!found || (x === sx && y === sy)) break;
  }
  return step > 1 ? points.filter((_, i) => i % step === 0) : points;
}

type Pt = { x: number; y: number };

/** Convex hull (monotone chain): the object as one calm area without dents. */
export function convexHull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Drops hull corners that barely change the shape, so only a few clear corners remain. */
export function fewCorners(hull: Pt[], maxCorners = 8, minTurnDeg = 14): Pt[] {
  let poly = hull;
  const turn = (a: Pt, b: Pt, c: Pt) => {
    const a1 = Math.atan2(b.y - a.y, b.x - a.x);
    const a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = Math.abs(a2 - a1) * (180 / Math.PI);
    if (d > 180) d = 360 - d;
    return d;
  };
  // Repeatedly remove the corner with the smallest turn until all are clear corners and few enough.
  while (poly.length > 3) {
    let weakest = -1;
    let weakestTurn = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const t = turn(poly[(i - 1 + poly.length) % poly.length], poly[i], poly[(i + 1) % poly.length]);
      if (t < weakestTurn) {
        weakestTurn = t;
        weakest = i;
      }
    }
    if (weakestTurn >= minTurnDeg && poly.length <= maxCorners) break;
    poly = poly.filter((_, i) => i !== weakest);
  }
  return poly;
}

/** The calm shape drawn over an object: its hull reduced to a few corners (frame pixels). */
export function objectShape(s: Segment, maxCorners = 8): Pt[] {
  return fewCorners(convexHull(maskOutline(s, 1)), maxCorners);
}
