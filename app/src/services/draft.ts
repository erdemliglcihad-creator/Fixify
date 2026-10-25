// Captures waiting between the camera and the review screen.
import type { ProblemCategory } from "../core/types.ts";
import type { Capture } from "./sessions.ts";
import { createStore, useStore } from "./store.ts";

export type Draft = {
  captures: Capture[];
  category: ProblemCategory | null;
  /** When set, captures are added to this session as a new observation. */
  targetSessionId: string | null;
  describeOnly: boolean;
};

export const MAX_CAPTURES = 4;

const empty: Draft = { captures: [], category: null, targetSessionId: null, describeOnly: false };
export const draftStore = createStore<Draft>(empty);
export const useDraft = () => useStore(draftStore);

export function resetDraft(patch: Partial<Draft> = {}) {
  draftStore.set({ ...empty, ...patch });
}

export function addCaptures(captures: Capture[]) {
  draftStore.set((d) => ({ ...d, captures: [...d.captures, ...captures].slice(0, MAX_CAPTURES) }));
}

export function removeCapture(id: string) {
  draftStore.set((d) => ({ ...d, captures: d.captures.filter((c) => c.id !== id) }));
}
