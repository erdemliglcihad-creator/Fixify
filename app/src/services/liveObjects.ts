// Live object layer for the camera: tap an object, Fixify grabs a small still from the preview and cuts the
// object out once (core/segment.ts). Then it follows it with a fixed shape: in a fresh still every 0.7 s, the
// object's remembered look is found again (core/track.ts). Expo Go has no per-frame camera access.
import { AlphaType, ColorType, Skia, type SkImage } from "@shopify/react-native-skia";
import type { CameraView } from "expo-camera";
import { useEffect, useRef, useState, type RefObject } from "react";
import { segmentAt, type Segment } from "../core/segment.ts";
import { makeTemplate, restPose, track, type Pose, type Template } from "../core/track.ts";
import { previewToPhoto } from "../core/tap.ts";
import { lang } from "../i18n/index.ts";
import { nameObject } from "./proxy.ts";
import { serverBase, settingsStore } from "./settings.ts";

export type LiveObject = {
  id: number;
  /** The shape found at the tap. It never changes; tracking only moves and scales it (pose). */
  seg: Segment;
  template: Template;
  pose: Pose;
  lost: number;
  /** Name from Fixify Cloud for the live label; undefined while asking, null when unclear. */
  name?: string | null;
};
export const MAX_OBJECTS = 3;
const FRAME_WIDTH = 144;
const TRACK_EVERY = 700;

type Frame = { px: Uint8Array; w: number; h: number; image: SkImage };

/** A small RGBA still from the preview (same framing as a photo). */
async function grabFrame(camera: CameraView): Promise<Frame | null> {
  const pic = await camera.takePictureAsync({ quality: 0.1, base64: true, shutterSound: false });
  if (!pic?.base64) return null;
  const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(pic.base64));
  if (!image) return null;
  const w = FRAME_WIDTH;
  const h = Math.round((FRAME_WIDTH * image.height()) / image.width());
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  surface.getCanvas().drawImageRect(image, Skia.XYWHRect(0, 0, image.width(), image.height()), Skia.XYWHRect(0, 0, w, h), Skia.Paint());
  surface.flush();
  const px = surface.makeImageSnapshot().readPixels(0, 0, { width: w, height: h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  return px instanceof Uint8Array ? { px, w, h, image } : null;
}

/** A JPEG crop around the object (with some margin), small enough for a quick name request. */
function cropAround(frame: Frame, seg: Segment) {
  const iw = frame.image.width();
  const ih = frame.image.height();
  const margin = 0.25;
  const x = Math.max(0, (seg.box.x - seg.box.w * margin) * iw);
  const y = Math.max(0, (seg.box.y - seg.box.h * margin) * ih);
  const w = Math.min(iw - x, seg.box.w * (1 + 2 * margin) * iw);
  const h = Math.min(ih - y, seg.box.h * (1 + 2 * margin) * ih);
  const side = 384;
  const k = side / Math.max(w, h);
  const surface = Skia.Surface.Make(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
  if (!surface) return null;
  surface.getCanvas().drawImageRect(frame.image, Skia.XYWHRect(x, y, w, h), Skia.XYWHRect(0, 0, w * k, h * k), Skia.Paint());
  surface.flush();
  return surface.makeImageSnapshot().encodeToBase64(3 /* JPEG */, 80);
}

export function useLiveObjects(camera: RefObject<CameraView | null>, enabled: boolean, view: { width: number; height: number }) {
  const [objects, setObjects] = useState<LiveObject[]>([]);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const paused = useRef(false);
  const latest = useRef<LiveObject[]>([]);
  latest.current = objects;
  const nextId = useRef(1);

  /** Tap on the preview (view pixels): remove the object there, or cut out a new one. */
  async function tapAt(px: number, py: number) {
    if (!camera.current || working.current) return false;
    const hit = latest.current.find((o) => hitTest(o, px, py, view));
    if (hit) {
      setObjects(latest.current.filter((o) => o.id !== hit.id));
      return true;
    }
    if (latest.current.length >= MAX_OBJECTS) return false;
    working.current = true;
    setBusy(true);
    try {
      const frame = await grabFrame(camera.current);
      if (!frame) return false;
      const seed = previewToPhoto({ x: px / view.width, y: py / view.height }, view, { width: frame.w, height: frame.h });
      const seg = segmentAt(frame.px, frame.w, frame.h, seed);
      if (!seg) return false;
      const id = nextId.current++;
      setObjects([...latest.current, { id, seg, template: makeTemplate(frame.px, seg), pose: restPose, lost: 0 }]);
      askName(id, frame, seg);
      return true;
    } catch {
      return false;
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  /** The live label: ask only for the object's name, from a crop around it. */
  async function askName(id: number, frame: Frame, seg: Segment) {
    let name: string | null = null;
    try {
      const s = settingsStore.get();
      const base = serverBase(s);
      const crop = cropAround(frame, seg);
      if (base && crop) name = await nameObject(base, s.provider === "proxy" ? s.appToken : "", { locale: lang, image: crop });
    } catch {
      name = null;
    }
    setObjects(latest.current.map((o) => (o.id === id ? { ...o, name } : o)));
  }

  // Follow the objects: in a fresh still, find each one's remembered look again (same shape, new place).
  useEffect(() => {
    if (!enabled || !objects.length) return;
    const timer = setInterval(async () => {
      if (working.current || paused.current || !camera.current || !latest.current.length) return;
      working.current = true;
      try {
        const frame = await grabFrame(camera.current);
        if (!frame) return;
        if (frame.w !== latest.current[0]?.seg.width) return;
        const updated = latest.current
          .map((o) => {
            const found = track(o.template, frame.px, frame.w, frame.h, o.pose);
            // Stay in place for a moment when it is briefly lost (motion blur), then let it go.
            return found ? { ...o, pose: found.pose, lost: 0 } : { ...o, lost: o.lost + 1 };
          })
          .filter((o) => o.lost < 4);
        setObjects(updated);
      } catch {
        // Next round.
      } finally {
        working.current = false;
      }
    }, TRACK_EVERY);
    return () => clearInterval(timer);
  }, [enabled, objects.length > 0]);

  return {
    objects,
    busy,
    tapAt,
    clear: () => setObjects([]),
    remove: (id: number) => setObjects(latest.current.filter((o) => o.id !== id)),
    /** Stop grabbing stills while the real photo is taken. */
    pause: (on: boolean) => {
      paused.current = on;
    },
    isWorking: () => working.current,
  };
}

/** Is the tap on this object, where it is now? (Undo the pose, then look in the original shape.) */
function hitTest(o: LiveObject, px: number, py: number, view: { width: number; height: number }) {
  const { seg, template: t, pose } = o;
  const p = previewToPhoto({ x: px / view.width, y: py / view.height }, view, { width: seg.width, height: seg.height });
  const fx = p.x * (seg.width - 1);
  const fy = p.y * (seg.height - 1);
  const x = Math.round(t.cx + (fx - t.cx - pose.dx) / pose.s);
  const y = Math.round(t.cy + (fy - t.cy - pose.dy) / pose.s);
  return x >= 0 && y >= 0 && x < seg.width && y < seg.height && seg.mask[y * seg.width + x] === 1;
}
