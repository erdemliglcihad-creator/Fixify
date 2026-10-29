// The blue layer over tapped objects (native, Skia): one semi-transparent area with a few sharp corners,
// no outline. The shape is fixed from the tap; tracking only moves and scales it, and it glides there.
// Drawn over the camera preview with the same "cover" fit, so frame pixels map to screen points.
import { Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { objectShape, type Segment } from "../core/segment.ts";
import type { Pose, Template } from "../core/track.ts";

export const LAYER_BLUE = "#3B9BFF";

export type LayerItem = { id: number; seg: Segment; template: Template; pose: Pose };
type View = { width: number; height: number };

/** Frame pixels → screen points (cover fit). */
function fit(seg: Segment, view: View) {
  const scale = Math.max(view.width / seg.width, view.height / seg.height);
  return { scale, offX: (seg.width * scale - view.width) / 2, offY: (seg.height * scale - view.height) / 2 };
}

export function ObjectLayer({ items, view }: { items: LayerItem[]; view: View }) {
  if (!items.length || view.width < 2) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((item) => (
        <ObjectArea key={item.id} item={item} view={view} />
      ))}
    </Canvas>
  );
}

function ObjectArea({ item, view }: { item: LayerItem; view: View }) {
  const reduceMotion = useReducedMotion();
  const { seg, template, pose } = item;
  const { scale, offX, offY } = fit(seg, view);

  // Fixed polygon with sharp corners, in screen points.
  const path = useMemo(() => {
    const pts = objectShape(seg).map((p) => ({ x: p.x * scale - offX, y: p.y * scale - offY }));
    const b = Skia.PathBuilder.Make();
    if (pts.length < 3) return b.build();
    b.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) b.lineTo(p.x, p.y);
    b.close();
    return b.build();
  }, [seg, scale, offX, offY]);

  // The pose glides: move and scale around the shape's center.
  const cx = template.cx * scale - offX;
  const cy = template.cy * scale - offY;
  const dx = useSharedValue(pose.dx * scale);
  const dy = useSharedValue(pose.dy * scale);
  const s = useSharedValue(pose.s);
  const show = useSharedValue(0);
  useEffect(() => {
    const t = { duration: reduceMotion ? 0 : 550, easing: Easing.out(Easing.cubic) };
    dx.value = withTiming(pose.dx * scale, t);
    dy.value = withTiming(pose.dy * scale, t);
    s.value = withTiming(pose.s, t);
  }, [pose.dx, pose.dy, pose.s, scale]);
  useEffect(() => {
    show.value = reduceMotion ? 1 : withTiming(1, { duration: 280 });
  }, []);

  const transform = useDerivedValue(() => [
    { translateX: cx + dx.value },
    { translateY: cy + dy.value },
    { scale: s.value },
    { translateX: -cx },
    { translateY: -cy },
  ]);
  const opacity = useDerivedValue(() => 0.38 * show.value);

  return (
    <Group transform={transform}>
      <Path path={path} color={LAYER_BLUE} opacity={opacity} />
    </Group>
  );
}

/** Where an object sits on screen now (its box after the pose), for the name label. */
export function objectBoxInView(item: LayerItem, view: View) {
  const { seg, template, pose } = item;
  const { scale, offX, offY } = fit(seg, view);
  const cx = template.cx * scale - offX;
  const cy = template.cy * scale - offY;
  const x0 = seg.box.x * seg.width * scale - offX;
  const y0 = seg.box.y * seg.height * scale - offY;
  const w = seg.box.w * seg.width * scale;
  const h = seg.box.h * seg.height * scale;
  return {
    x: cx + (x0 - cx) * pose.s + pose.dx * scale,
    y: cy + (y0 - cy) * pose.s + pose.dy * scale,
    w: w * pose.s,
    h: h * pose.s,
  };
}
