// The blue layer over cut-out objects (native, Skia): a calm semi-transparent area in the object's shape
// (few rounded corners) with a glowing contour, like an AR overlay. Drawn over the camera preview or a photo that
// is shown with "cover", so frame pixels are mapped the same way.
import { BlurMask, Canvas, Group, Path, Skia } from "@shopify/react-native-skia";
import { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import { Easing, useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { objectShape, type Segment } from "../core/segment.ts";

export const LAYER_BLUE = "#3B9BFF";

export function ObjectLayer({ segments, view }: { segments: Segment[]; view: { width: number; height: number } }) {
  if (!segments.length || view.width < 2) return null;
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      {segments.map((s, i) => (
        <ObjectShape key={i} seg={s} view={view} />
      ))}
    </Canvas>
  );
}

function ObjectShape({ seg, view }: { seg: Segment; view: { width: number; height: number } }) {
  const reduceMotion = useReducedMotion();
  const show = useSharedValue(0);
  useEffect(() => {
    show.value = reduceMotion ? 1 : withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) });
  }, []);

  // Frame pixels → view, the same "cover" fit as the preview.
  const scale = Math.max(view.width / seg.width, view.height / seg.height);
  const offX = (seg.width * scale - view.width) / 2;
  const offY = (seg.height * scale - view.height) / 2;

  // One calm area: the object's hull with a few corners, rounded softly through the edge midpoints.
  const path = useMemo(() => {
    const pts = objectShape(seg).map((p) => ({ x: p.x * scale - offX, y: p.y * scale - offY }));
    const b = Skia.PathBuilder.Make();
    if (pts.length < 3) return b.build();
    const mid = (a: { x: number; y: number }, c: { x: number; y: number }) => ({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
    const first = mid(pts[pts.length - 1], pts[0]);
    b.moveTo(first.x, first.y);
    for (let i = 0; i < pts.length; i++) {
      const m = mid(pts[i], pts[(i + 1) % pts.length]);
      b.quadTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    b.close();
    return b.build();
  }, [seg, scale, offX, offY]);

  const fill = useDerivedValue(() => 0.28 * show.value);
  const glow = useDerivedValue(() => 0.5 * show.value);
  return (
    <Group>
      <Path path={path} style="stroke" strokeWidth={12} color={LAYER_BLUE} opacity={glow}>
        <BlurMask blur={14} style="normal" />
      </Path>
      <Path path={path} color={LAYER_BLUE} opacity={fill} />
      <Path path={path} style="stroke" strokeWidth={2} color="#BFE3FF" opacity={show} strokeJoin="round">
        <BlurMask blur={1.5} style="solid" />
      </Path>
    </Group>
  );
}

/** Where an object sits on screen (its box in view points), for the name label. */
export function objectBoxInView(seg: Segment, view: { width: number; height: number }) {
  const scale = Math.max(view.width / seg.width, view.height / seg.height);
  const offX = (seg.width * scale - view.width) / 2;
  const offY = (seg.height * scale - view.height) / 2;
  return {
    x: seg.box.x * seg.width * scale - offX,
    y: seg.box.y * seg.height * scale - offY,
    w: seg.box.w * seg.width * scale,
    h: seg.box.h * seg.height * scale,
  };
}
