// Daily photo-upload quota as reported by Fixify Cloud. The server enforces it; the app only shows it.
import { createStore, useStore } from "./store.ts";

export const limits = { imagesPerAnalysis: 2 };

export type Quota = { uploadsLeft: number | null; uploadsDaily: number | null };
export const quotaStore = createStore<Quota>({ uploadsLeft: null, uploadsDaily: null });
export const useQuota = () => useStore(quotaStore);

export function setQuota(patch: Partial<Quota>) {
  quotaStore.set((q) => ({ ...q, ...patch }));
}

/** Reads uploadsLeft/uploadsDaily from any cloud response. */
export function noteQuota(body: unknown) {
  const b = body as { uploadsLeft?: unknown; uploadsDaily?: unknown } | null;
  if (b && typeof b.uploadsLeft === "number") setQuota({ uploadsLeft: b.uploadsLeft, uploadsDaily: typeof b.uploadsDaily === "number" ? b.uploadsDaily : null });
}
