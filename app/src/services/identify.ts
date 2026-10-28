// Tap to identify: up to three spots tapped in the live camera. After the photo, the spots are drawn into
// the picture as colored rings (so the AI knows exactly what is meant) and Fixify Cloud names each object.
import { profileSummary } from "../core/profile.ts";
import { lang, t } from "../i18n/index.ts";
import { annotate } from "./annotate";
import { encodeForAnalysis } from "./images.ts";
import { identify, ProxyError, type IdentifiedObject } from "./proxy.ts";
import type { Capture } from "./sessions.ts";
import { serverBase, settingsStore } from "./settings.ts";
import { createStore, useStore } from "./store.ts";

export type TapPoint = { x: number; y: number };
export const MAX_TAPS = 3;

type IdentifyState = {
  capture: Capture | null;
  points: TapPoint[];
  status: "idle" | "working" | "done" | "failed";
  objects: IdentifiedObject[];
  error: string | null;
};

export const identifyStore = createStore<IdentifyState>({ capture: null, points: [], status: "idle", objects: [], error: null });
export const useIdentify = () => useStore(identifyStore);

let controller: AbortController | null = null;

/** Starts identifying the tapped objects in a fresh photo. */
export async function startIdentify(capture: Capture, points: TapPoint[]) {
  controller?.abort();
  controller = new AbortController();
  identifyStore.set({ capture, points, status: "working", objects: [], error: null });
  const s = settingsStore.get();
  const base = serverBase(s);
  try {
    if (!base) throw new ProxyError("notConfigured", t("Fixify Cloud is not reachable."));
    const encoded = await encodeForAnalysis(capture);
    const marked = annotate(encoded.base64, encoded.width, encoded.height, points);
    const objects = await identify(base, s.provider === "proxy" ? s.appToken : "", { locale: lang, image: marked, points, profile: profileSummary(s.profile) }, controller.signal);
    identifyStore.set((st) => ({ ...st, status: "done", objects }));
  } catch (e) {
    if (e instanceof ProxyError && e.code === "cancelled") return;
    identifyStore.set((st) => ({ ...st, status: "failed", error: e instanceof Error ? e.message : String(e) }));
  }
}

export function cancelIdentify() {
  controller?.abort();
}

/** A one-line note for the Fix analysis, so it focuses on what was tapped. */
export function identifyNote(objects: IdentifiedObject[]) {
  if (!objects.length) return "";
  return t("Marked in the photo: %@", objects.map((o) => `${o.point}. ${o.name}`).join(", "));
}
