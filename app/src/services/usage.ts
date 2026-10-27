// Daily quota as reported by Fixify Cloud. The server enforces it; the app only shows it.
import { createStore, useStore } from "./store.ts";

export const limits = { imagesPerAnalysis: 2 };

export type Quota = { remainingToday: number | null; deviceDaily: number | null };
export const quotaStore = createStore<Quota>({ remainingToday: null, deviceDaily: null });
export const useQuota = () => useStore(quotaStore);

export function setQuota(patch: Partial<Quota>) {
  quotaStore.set((q) => ({ ...q, ...patch }));
}
