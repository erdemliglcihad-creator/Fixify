// Web preview: no Skia, no live object layer.
import type { Segment } from "../core/segment.ts";
import type { Pose, Template } from "../core/track.ts";

export const LAYER_BLUE = "#3B9BFF";
export type LayerItem = { id: number; seg: Segment; template: Template; pose: Pose };

export function ObjectLayer(_props: { items: LayerItem[]; view: { width: number; height: number } }) {
  return null;
}

export function objectBoxInView(_item: LayerItem, _view: { width: number; height: number }) {
  return { x: 0, y: 0, w: 0, h: 0 };
}
