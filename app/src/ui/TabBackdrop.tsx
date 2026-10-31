// The backdrop (lights, or your own picture or video) drawn inside a tab screen. The native iOS tab bar keeps
// its own background behind each tab, so the backdrop in the root layout does not show through there.
// Only the visible tab draws it, so at most one video plays in the tabs at a time.
import { useIsFocused } from "expo-router";
import { Ambient } from "./Ambient";

export function TabBackdrop() {
  return useIsFocused() ? <Ambient /> : null;
}
