// Card morph: a tapped card grows into the full screen, the next screen opens behind it,
// then the color fades away (ui/MorphLayer draws it).
import type { SoftTone } from "../ui/soft.ts";
import { createStore } from "./store.ts";

export type MorphFrame = { x: number; y: number; width: number; height: number };
export type Morph = { id: number; frame: MorphFrame; tone: SoftTone; radius: number; run: () => void };

export const morphStore = createStore<Morph | null>(null);
let next = 1;

export function morphOpen(frame: MorphFrame, tone: SoftTone, radius: number, run: () => void) {
  // A second tap while one is running just waits for the first.
  if (morphStore.get()) return;
  morphStore.set({ id: next++, frame, tone, radius, run });
}

export function morphDone() {
  morphStore.set(null);
}
