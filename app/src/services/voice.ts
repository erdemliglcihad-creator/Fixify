// Microphone with automatic end-of-turn detection, speech to text via Fixify Cloud, and reading replies aloud.
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { File } from "expo-file-system";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import { levelFromDb, speakable, toBase64, vadStart, vadStep, type VadEvent, type VadState } from "../core/voice.ts";
import { lang, t } from "../i18n/index.ts";
import { ProxyError, transcribe, type AudioType } from "./proxy.ts";
import { serverBase, settingsStore } from "./settings.ts";

export type Recording = { uri: string; mediaType: AudioType };

async function readBase64(uri: string) {
  const buffer = Platform.OS === "web" ? await (await fetch(uri)).arrayBuffer() : await new File(uri).arrayBuffer();
  return toBase64(new Uint8Array(buffer));
}

/** Speech to text. Empty string when nothing understandable was said. */
export async function transcribeRecording(rec: Recording, signal?: AbortSignal) {
  const s = settingsStore.get();
  const base = serverBase(s);
  if (!base) throw new ProxyError("notConfigured", t("Choose an AI service in Settings to get a diagnosis and a guided plan."));
  return transcribe(base, s.provider === "proxy" ? s.appToken : "", { locale: lang, mediaType: rec.mediaType, data: await readBase64(rec.uri) }, signal);
}

export class MicPermissionError extends Error {}

/**
 * Records until the speaker pauses (about 1.1 s of quiet), then hands the recording over.
 * `level` (0…1) follows the voice for the orb and the waveform.
 */
export function useListener(onTurn: (rec: Recording | null, event: VadEvent) => void) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const status = useAudioRecorderState(recorder, 70);
  const [listening, setListening] = useState(false);
  const level = useSharedValue(0);
  const vad = useRef<VadState | null>(null);
  const finishing = useRef(false);
  const handler = useRef(onTurn);
  handler.current = onTurn;

  async function start() {
    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) throw new MicPermissionError(t("Fixify needs the microphone to hear you. You can allow it in the iPhone settings."));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    vad.current = vadStart(Date.now());
    finishing.current = false;
    setListening(true);
  }

  async function finish(event: VadEvent, keep: boolean) {
    if (finishing.current || !vad.current) return;
    finishing.current = true;
    const heard = vad.current.heard;
    vad.current = null;
    setListening(false);
    level.value = withTiming(0, { duration: 250 });
    try {
      await recorder.stop();
    } catch {
      // Already stopped.
    }
    const uri = recorder.uri;
    handler.current(keep && heard && uri ? { uri, mediaType: Platform.OS === "web" ? "audio/webm" : "audio/m4a" } : null, event);
  }

  useEffect(() => {
    if (!listening || !vad.current) return;
    const r = vadStep(vad.current, status.metering, Date.now());
    vad.current = r.state;
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

/**
 * Reads a reply aloud through the speaker (even in silent mode). `level` pulses on every word.
 * Resolves when finished or stopped.
 */
export async function speak(markdown: string, level: SharedValue<number>, onProgress?: (charIndex: number) => void): Promise<void> {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
  const text = speakable(markdown);
  return new Promise((resolve) => {
    const done = () => {
      level.value = withTiming(0, { duration: 300 });
      resolve();
    };
    Speech.speak(text, {
      language: lang === "de" ? "de-DE" : "en-US",
      rate: Platform.OS === "ios" ? 0.52 : 1,
      useApplicationAudioSession: true,
      onStart: () => {
        level.value = withTiming(0.35, { duration: 200 });
      },
      onBoundary: (e: { charIndex?: number }) => {
        level.value = 0.75;
        level.value = withTiming(0.3, { duration: 280 });
        if (typeof e?.charIndex === "number") onProgress?.(e.charIndex);
      },
      onDone: done,
      onStopped: done,
      onError: done,
    });
  });
}

export function stopSpeaking() {
  Speech.stop();
}
