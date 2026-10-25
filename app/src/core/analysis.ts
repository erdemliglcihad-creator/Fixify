// Pure logic shared by screens and tests: marker resolution, image geometry, validation.
import type { NormalizedRect, ProblemAnalysis, ResolvedMarker, TextBlock } from "./types.ts";

export function union(a: NormalizedRect, b: NormalizedRect): NormalizedRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  };
}

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Where an image of `image` size is drawn inside `container` (aspect fit, or fill). */
export function drawnRect(image: Size, container: Size, fill = false): Rect {
  if (image.width <= 0 || image.height <= 0) return { x: 0, y: 0, ...container };
  const sx = container.width / image.width;
  const sy = container.height / image.height;
  const scale = fill ? Math.max(sx, sy) : Math.min(sx, sy);
  const width = image.width * scale;
  const height = image.height * scale;
  return { x: (container.width - width) / 2, y: (container.height - height) / 2, width, height };
}

/** Maps a normalized rect into view coordinates for an image drawn in `container`. */
export function rectInView(r: NormalizedRect, image: Size, container: Size, fill = false): Rect {
  const d = drawnRect(image, container, fill);
  return { x: d.x + r.x * d.width, y: d.y + r.y * d.height, width: r.width * d.width, height: r.height * d.height };
}

/**
 * Markers that can be drawn honestly on image `imageIndex`.
 * OCR-backed findings get exact boxes; AI boxes only when the model is at least moderately sure.
 */
export function markersForImage(analysis: ProblemAnalysis, imageIndex: number, blocks: TextBlock[]): ResolvedMarker[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const result: ResolvedMarker[] = [];
  analysis.findings.forEach((finding, offset) => {
    if (finding.imageIndex !== imageIndex) return;
    const boxes = finding.ocrBlockIds.map((id) => byId.get(id)?.box).filter((b): b is NormalizedRect => Boolean(b));
    if (boxes.length) {
      result.push({ id: finding.id, number: offset + 1, finding, rect: boxes.reduce(union), precision: "textMatch" });
    } else if (finding.box && (finding.boxConfidence === "high" || finding.boxConfidence === "medium")) {
      result.push({ id: finding.id, number: offset + 1, finding, rect: finding.box, precision: "estimated" });
    }
  });
  return result;
}

export function findingNumber(analysis: ProblemAnalysis, id: string): number | null {
  const i = analysis.findings.findIndex((f) => f.id === id);
  return i >= 0 ? i + 1 : null;
}

export class InvalidAnalysisError extends Error {}

/** Client-side checks on top of the proxy's validation: never trust a response just because it parsed. */
export function validateAnalysis(raw: unknown, imageCount: number): ProblemAnalysis {
  const a = raw as ProblemAnalysis;
  if (!a || typeof a !== "object") throw new InvalidAnalysisError("not an object");
  for (const key of ["title", "summary"] as const) {
    if (typeof a[key] !== "string" || !a[key].trim()) throw new InvalidAnalysisError(`missing ${key}`);
  }
  for (const key of ["findings", "causes", "unknowns", "questions", "steps", "tools", "successCriteria"] as const) {
    if (!Array.isArray(a[key])) throw new InvalidAnalysisError(`missing ${key}`);
  }
  if (!a.safety || !Array.isArray(a.safety.warnings)) throw new InvalidAnalysisError("missing safety");
  const stepIds = a.steps.map((s) => s.id);
  if (new Set(stepIds).size !== stepIds.length) throw new InvalidAnalysisError("duplicate step ids");
  const findings = a.findings.filter((f) => f.imageIndex >= 0 && f.imageIndex < imageCount);
  const findingIds = new Set(findings.map((f) => f.id));
  return {
    ...a,
    findings,
    steps: a.steps.map((s) => ({ ...s, findingIds: s.findingIds.filter((id) => findingIds.has(id)) })),
  };
}
