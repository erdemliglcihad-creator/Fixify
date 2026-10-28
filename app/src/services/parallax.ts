// Scroll offset of the screen in front, shared with the global backdrop so the glow moves slower than the
// content (depth). Lives on the UI thread; written by Screen, read by Aurora.
import { makeMutable } from "react-native-reanimated";

export const parallaxY = makeMutable(0);
