// FixVoice audio: microphone with automatic end-of-turn detection, speech to text via Fixify Cloud,
// and speaking replies (Fish Audio on the server when set up, otherwise the iPhone's own voice).
import { AudioModule, createAudioPlayer, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { cancelAnimation, Easing, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import { defaultVad, levelFromDb, speakable, toBase64, vadStart, vadStep, type VadEvent, type VadOptions, type VadState } from "../core/voice.ts";
import { lang, t } from "../i18n/index.ts";
import { ProxyError, serverSpeech, transcribe, type AudioType } from "./proxy.ts";
import { serverBase, settingsStore, type VoiceGender } from "./settings.ts";

export type Recording = { uri: string; mediaType: AudioType };

/** During a call the session records and plays at once, through the loudspeaker. */
export const callAudioMode = () => setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => {});

async function readBase64(uri: string) {
  const buffer = Platform.OS === "web" ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  return toBase64(new Uint8Array(buffer));
}

function server() {
  const s = settingsStore.get();
  const base = serverBase(s);
  if (!base) throw new ProxyError("notConfigured", t("Choose an AI service in Settings to get a diagnosis and a guided plan."));
  return { base, token: s.provider === "proxy" ? s.appToken : "" };
}

/** Speech to text. Empty string when nothing understandable was said. */
export async function transcribeRecording(rec: Recording, signal?: AbortSignal) {
  const { base, token } = server();
  return transcribe(base, token, { locale: lang, mediaType: rec.mediaType, data: await readBase64(rec.uri) }, signal);
}

export class MicPermissionError extends Error {}

/**
 * Records until the speaker pauses (about 1.1 s of quiet), then hands the recording over.
 * `start({ margin, minSpeechMs })` makes it stricter, e.g. to only react to someone talking over the reply.
 * `level` (0…1) follows the voice for the orb.
 */
export function useListener(onTurn: (rec: Recording | null, event: VadEvent) => void, onHeard?: () => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const status = useAudioRecorderState(recorder, 70);
  const [listening, setListening] = useState(false);
  const level = useSharedValue(0);
  const vad = useRef<VadState | null>(null);
  const options = useRef<VadOptions>(defaultVad);
  const finishing = useRef(false);
  const handler = useRef(onTurn);
  handler.current = onTurn;
  const heardHandler = useRef(onHeard);
  heardHandler.current = onHeard;

  async function start(overrides: Partial<VadOptions> = {}) {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) throw new MicPermissionError(t("Fixify needs the microphone to hear you. You can allow it in the iPhone settings."));
    await callAudioMode();
    await recorder.prepareToRecordAsync();
    recorder.record();
    options.current = { ...defaultVad, ...overrides };
    vad.current = vadStart(Date.now());
    finishing.current = false;
    setListening(true);
  }

  /** Resolves false when nothing was running. */
  async function finish(event: VadEvent, keep: boolean): Promise<boolean> {
    if (finishing.current || !vad.current) return false;
    finishing.current = true;
    const heard = vad.current.heard;
    vad.current = null;
    setListening(false);
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    const uri = recorder.uri;
    handler.current(keep && heard && uri ? { uri, mediaType: Platform.OS === "web" ? "audio/webm" : "audio/m4a" } : null, event);
    return true;
  }

  useEffect(() => {
    if (!listening || !vad.current) return;
    const wasHeard = vad.current.heard;
    const r = vadStep(vad.current, status.metering, Date.now(), options.current);
    vad.current = r.state;
    if (!wasHeard && r.state.heard) heardHandler.current?.();
    level.value = withTiming(levelFromDb(status.metering), { duration: 90 });
    if (r.event !== "none") finish(r.event, r.event !== "noSpeech");
  }, [status.metering, status.durationMillis, listening]);

  useEffect(() => () => void recorder.stop().catch(() => {}), []);

  return {
    start,
    /** Ends the turn now and sends what was said so far. */
    send: () => finish("end", true),
    /** Stops without sending. */
    cancel: () => finish("none", false),
    listening,
    level,
  };
}

// --- Speaking ---------------------------------------------------------------

let player: AudioPlayer | null = null;
let stopCurrent: (() => void) | null = null;
/** Set after the server said it has no voice, so we stop asking during this app run. */
let serverVoiceOff = false;

const FEMALE = ["anna", "helena", "petra", "marlene", "vicki", "samantha", "ava", "allison", "susan", "zoe", "nicky", "karen", "serena"];
const MALE = ["markus", "martin", "yannick", "hans", "viktor", "aaron", "alex", "evan", "nathan", "tom", "fred", "daniel", "arthur", "rishi"];
const voiceCache = new Map<string, string | undefined>();

/** Picks an installed iPhone voice for the language and gender, preferring enhanced quality. */
async function deviceVoice(gender: VoiceGender) {
  const key = `${lang}-${gender}`;
  if (voiceCache.has(key)) return voiceCache.get(key);
  let id: string | undefined;
  try {
    const names = gender === "female" ? FEMALE : MALE;
    const voices = (await Speech.getAvailableVoicesAsync()).filter((v) => v.language?.toLowerCase().startsWith(lang));
    const matches = voices.filter((v) => names.some((n) => v.name?.toLowerCase().includes(n)));
    const best = matches.find((v) => String(v.quality).toLowerCase() === "enhanced") ?? matches[0];
    id = best?.identifier;
  } catch {
    id = undefined;
  }
  voiceCache.set(key, id);
  return id;
}

/** Gentle pulse while audio plays and no per-word events exist. */
function pulse(level: SharedValue<number>) {
  level.value = withRepeat(
    withSequence(withTiming(0.55, { duration: 220, easing: Easing.out(Easing.quad) }), withTiming(0.25, { duration: 300, easing: Easing.inOut(Easing.quad) })),
    -1,
  );
}

async function speakWithServer(text: string, gender: VoiceGender, level: SharedValue<number>): Promise<boolean> {
  if (serverVoiceOff) return false;
  let bytes: ArrayBuffer | null = null;
  try {
    const { base, token } = server();
    bytes = await serverSpeech(base, token, { locale: lang, gender, text });
  } catch {
    bytes = null;
  }
  if (!bytes) {
    serverVoiceOff = true;
    return false;
  }
  let uri: string;
  if (Platform.OS === "web") {
    uri = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
  } else {
    const file = new File(Paths.cache, `fixvoice-${Date.now()}.mp3`);
    file.write(new Uint8Array(bytes));
    uri = file.uri;
  }
  await new Promise<void>((resolve) => {
    player?.remove();
    const p = createAudioPlayer({ uri });
    player = p;
    const done = () => {
      sub.remove();
      stopCurrent = null;
      resolve();
    };
    const sub = p.addListener("playbackStatusUpdate", (s) => {
      if (s.didJustFinish) done();
    });
    stopCurrent = () => {
      p.pause();
      done();
    };
    pulse(level);
    p.play();
  });
  return true;
}

function speakWithDevice(text: string, voice: string | undefined, level: SharedValue<number>, onProgress?: (charIndex: number) => void) {
  return new Promise<void>((resolve) => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      stopCurrent = null;
      resolve();
    };
    stopCurrent = () => {
      Speech.stop();
      done();
    };
    Speech.speak(text, {
      language: lang === "de" ? "de-DE" : "en-US",
      voice,
      rate: Platform.OS === "ios" ? 0.53 : 1,
      useApplicationAudioSession: true,
      onStart: () => {
        level.value = withTiming(0.3, { duration: 200 });
      },
      onBoundary: (e: { charIndex?: number }) => {
        level.value = withSequence(withTiming(0.7, { duration: 70 }), withTiming(0.28, { duration: 260 }));
        if (typeof e?.charIndex === "number") onProgress?.(e.charIndex);
      },
      onDone: done,
      onStopped: done,
      onError: done,
    });
  });
}

/**
 * Speaks a reply through the loudspeaker (also in silent mode) and resolves when finished or stopped.
 * Keeps the microphone session open so the caller can talk over it.
 */
export async function speak(markdown: string, level: SharedValue<number>, onProgress?: (charIndex: number) => void) {
  stopSpeaking();
  await callAudioMode();
  const text = speakable(markdown);
  const gender = settingsStore.get().voice;
  try {
    if (!(await speakWithServer(text, gender, level))) await speakWithDevice(text, await deviceVoice(gender), level, onProgress);
  } finally {
    cancelAnimation(level);
    level.value = withTiming(0, { duration: 300 });
  }
}

export function stopSpeaking() {
  stopCurrent?.();
  Speech.stop();
}
