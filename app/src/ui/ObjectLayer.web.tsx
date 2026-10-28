// Web preview: no Skia, no live object layer.
import type { Segment } from "../core/segment.ts";

export const LAYER_BLUE = "#3B9BFF";

export function ObjectLayer(_props: { segments: Segment[]; view: { width: number; height: number } }) {
  return null;
}

export function objectBoxInView(seg: Segment, view: { width: number; height: number }) {
  const scale = Math.max(view.width / seg.width, view.height / seg.height);
  const offX = (seg.width * scale - view.width) / 2;
  const offY = (seg.height * scale - view.height) / 2;
  return { x: seg.box.x * seg.width * scale - offX, y: seg.box.y * seg.height * scale - offY, w: seg.box.w * seg.width * scale, h: seg.box.h * seg.height * scale };
}
