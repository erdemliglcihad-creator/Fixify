// Pure helpers for the voice mode: turn detection on mic levels, speakable text and base64.

export type VadOptions = {
  /** dB above the measured room noise that counts as speech. */
  margin: number;
  /** Speech must stay loud this long before it counts (filters clicks). */
  minSpeechMs: number;
  /** Quiet this long after speech ends the turn. */
  silenceMs: number;
  /** Nothing said for this long: stop listening. */
  noSpeechMs: number;
  /** Hard cap for one turn. */
  maxMs: number;
};

export const defaultVad: VadOptions = { margin: 10, minSpeechMs: 220, silenceMs: 1100, noSpeechMs: 15_000, maxMs: 30_000 };

export type VadState = {
  startedAt: number;
  /** Running estimate of the room noise in dB. */
  floor: number | null;
  loudSince: number | null;
  heard: boolean;
  lastLoudAt: number | null;
};

export type VadEvent = "none" | "end" | "noSpeech" | "cap";

export const vadStart = (now: number): VadState => ({ startedAt: now, floor: null, loudSince: null, heard: false, lastLoudAt: null });

/** Mic metering in dB (about -160…0) mapped to 0…1 for the orb. */
export function levelFromDb(db: number | undefined) {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.min(Math.max((db + 55) / 50, 0), 1);
}

/** One metering sample. Returns the new state and whether the turn is over. */
export function vadStep(state: VadState, db: number | undefined, now: number, o: VadOptions = defaultVad): { state: VadState; event: VadEvent } {
  const elapsed = now - state.startedAt;
  if (elapsed >= o.maxMs) return { state, event: state.heard ? "cap" : "noSpeech" };
  if (db === undefined || !Number.isFinite(db)) return { state, event: "none" };

  // The noise floor drops quickly, rises slowly, and is frozen while someone speaks, so speech never raises it.
  const prev = state.floor ?? db;
  const threshold = Math.max(prev + o.margin, -50);
  const loud = db >= threshold;
  const floor = loud ? prev : db < prev ? prev * 0.7 + db * 0.3 : prev * 0.98 + db * 0.02;
  const next: VadState = { ...state, floor };

  if (loud) {
    next.loudSince = state.loudSince ?? now;
    next.lastLoudAt = now;
    if (now - next.loudSince >= o.minSpeechMs) next.heard = true;
  } else {
    next.loudSince = null;
  }

  if (next.heard && next.lastLoudAt !== null && now - next.lastLoudAt >= o.silenceMs) return { state: next, event: "end" };
  if (!next.heard && elapsed >= o.noSpeechMs) return { state: next, event: "noSpeech" };
  return { state: next, event: "none" };
}

/** FixBot answers in light markdown; read it aloud without the symbols. */
export function speakable(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Base64 for audio bytes (no dependency on btoa or Buffer). */
export function toBase64(bytes: Uint8Array) {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + "==";
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + "=";
  }
  return out;
}
