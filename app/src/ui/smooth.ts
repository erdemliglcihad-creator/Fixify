/**
 * Eases `current` toward `target` in one frame (frame-rate independent, never overshoots).
 * Voice levels arrive in uneven steps; following them like this keeps visuals calm, where restarting
 * a spring for every new value makes them twitch.
 */
export function follow(current: number, target: number, frameMs: number, timeMs: number) {
  "worklet";
  return current + (target - current) * (1 - Math.exp(-frameMs / timeMs));
}
