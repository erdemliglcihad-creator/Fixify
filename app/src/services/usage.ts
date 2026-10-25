import AsyncStorage from "@react-native-async-storage/async-storage";
import { FREE, recorded, remaining, type UsageState } from "../core/usage.ts";
import { createStore, useStore } from "./store.ts";

// No purchases in Expo Go, so everyone uses the free limits here.
export const limits = FREE;

const KEY = "usage.v1";
export const usageStore = createStore<UsageState>({ month: "", count: 0, lifetime: 0 });
export const useUsage = () => useStore(usageStore);

export async function loadUsage() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) usageStore.set(JSON.parse(raw) as UsageState);
}

export function recordAnalysis() {
  usageStore.set((u) => recorded(u, new Date()));
  AsyncStorage.setItem(KEY, JSON.stringify(usageStore.get()));
}

export const analysesLeft = (u: UsageState) => remaining(u, limits, new Date());
