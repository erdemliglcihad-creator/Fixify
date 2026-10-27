// Which area is on screen, so the global backdrop can morph to its colors.
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import type { Area } from "../ui/theme.ts";
import { createStore, useStore } from "./store.ts";

export const areaStore = createStore<Area>("home");
export const useCurrentArea = () => useStore(areaStore);

/** Call in a screen: when it gains focus, the backdrop morphs to this area's glow. */
export function useArea(area: Area) {
  useFocusEffect(useCallback(() => areaStore.set(area), [area]));
}
