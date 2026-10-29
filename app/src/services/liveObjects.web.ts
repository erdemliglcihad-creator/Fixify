// Web preview: no camera stills, so no live object layer.
import type { CameraView } from "expo-camera";
import type { RefObject } from "react";
import type { Segment } from "../core/segment.ts";
import type { Pose, Template } from "../core/track.ts";

export type LiveObject = { id: number; seg: Segment; template: Template; pose: Pose; lost: number; name?: string | null };
export const MAX_OBJECTS = 3;

export function useLiveObjects(_camera: RefObject<CameraView | null>, _enabled: boolean, _view: { width: number; height: number }) {
  return {
    objects: [] as LiveObject[],
    busy: false,
    tapAt: async (_x: number, _y: number) => false,
    clear: () => {},
    remove: (_id: number) => {},
    pause: (_on: boolean) => {},
    isWorking: () => false,
  };
}
