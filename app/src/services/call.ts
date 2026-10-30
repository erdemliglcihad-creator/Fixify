// FixVoice call: a hands-free conversation like a phone call.
// listen → (pause) → transcribe → FixVoice answers → speak → listen again. Talking over the reply interrupts it,
// and what you say then becomes the next turn. The conversation history lives in the chat store (no chat UI).
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { useDerivedValue, useSharedValue } from "react-native-reanimated";
import { t } from "../i18n/index.ts";
import { cancelReply, sendMessage } from "./chat.ts";
import { speak, stopSpeaking, transcribeRecording, useListener, type Recording } from "./voice.ts";

export type CallPhase = "idle" | "connecting" | "listening" | "transcribing" | "thinking" | "speaking";

/**
 * While FixVoice talks, its own voice comes back through the mic. Echo mode learns how loud that is during the
 * first 1.2 s and then only counts a voice clearly above it, so the answer is not cut off by itself.
 */
const BARGE_IN = { margin: 8, minSpeechMs: 450, noSpeechMs: 120_000, echo: true, calibrateMs: 1200 };
/**
 * Your turn, tuned to not be annoying: FixVoice waits 1.5 s of quiet before it answers (short thinking pauses
 * don't cut you off), and only a voice of a third of a second or more counts, so clicks and taps don't start a turn.
 */
const TURN = { margin: 12, minSpeechMs: 320, silenceMs: 1500, noSpeechMs: 30_000 };
/** Quiet turns in a row before the call hangs up by itself (about a minute of silence). */
const MAX_SILENT_TURNS = 2;

const tick = () => {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export function useCall() {
  const [phase, setPhase] = useState<CallPhase>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [spokenTo, setSpokenTo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const speechLevel = useSharedValue(0);

  const active = useRef(false);
  const mutedRef = useRef(false);
  const mode = useRef<"turn" | "barge">("turn");
  const bargedIn = useRef(false);
  const ignoreNext = useRef(false);
  const silentTurns = useRef(0);
  const phaseRef = useRef<CallPhase>("idle");
  const go = (p: CallPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const listener = useListener(
    (rec, event) => {
      if (ignoreNext.current) {
        ignoreNext.current = false;
        return;
      }
      if (!active.current) return;
      if (rec) {
        silentTurns.current = 0;
        handleTurn(rec);
        return;
      }
      if (event === "noSpeech" && ++silentTurns.current >= MAX_SILENT_TURNS) return endCall();
      listen();
    },
    () => {
      // Someone talks over the reply: stop speaking right away and keep recording as their turn.
      if (mode.current === "barge" && phaseRef.current === "speaking") interrupt();
    },
  );

  const level = useDerivedValue(() => Math.max(listener.level.value, speechLevel.value));

  async function stopListening() {
    ignoreNext.current = true;
    if (!(await listener.cancel())) ignoreNext.current = false;
  }

  async function listen() {
    if (!active.current) return;
    mode.current = "turn";
    // Muted: the call stays open, the microphone stays off until you turn it back on.
    if (mutedRef.current) return go("listening");
    try {
      await listener.start(TURN);
      go("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      endCall();
    }
  }

  async function handleTurn(rec: Recording) {
    try {
      go("transcribing");
      const text = await transcribeRecording(rec);
      if (!active.current) return;
      if (!text) return listen(); // Nothing understood: keep listening.
      setHeard(text);
      setReply("");
      setSpokenTo(0);
      go("thinking");
      const answer = await sendMessage(text, null, { voice: true });
      if (!active.current) return;
      if (!answer) {
        setError(t("FixVoice could not answer. Say it again."));
        return listen();
      }
      setError(null);
      setReply(answer.text);
      go("speaking");
      tick();
      // Listen for interruptions while speaking.
      mode.current = "barge";
      bargedIn.current = false;
      if (!mutedRef.current) await listener.start(BARGE_IN).catch(() => {});
      await speak(answer.text, speechLevel, setSpokenTo);
      if (!active.current || bargedIn.current) return; // Interrupted: the running recording is the next turn.
      await stopListening();
      listen();
    } catch (e) {
      if (!active.current) return;
      setError(e instanceof Error ? e.message : String(e));
      listen();
    }
  }

  function interrupt() {
    bargedIn.current = true;
    mode.current = "turn";
    stopSpeaking();
    go("listening");
    tick();
  }

  async function startCall() {
    if (active.current) return;
    active.current = true;
    silentTurns.current = 0;
    mutedRef.current = false;
    setMuted(false);
    setError(null);
    setHeard("");
    setReply("");
    go("connecting");
    tick();
    await listen();
  }

  function endCall() {
    if (!active.current && phaseRef.current === "idle") return;
    active.current = false;
    stopSpeaking();
    cancelReply();
    stopListening();
    go("idle");
    tick();
  }

  /** Microphone off and on again during the call. While off, FixVoice can still finish its answer. */
  async function toggleMute() {
    if (!active.current) return;
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    tick();
    if (mutedRef.current) {
      if (phaseRef.current === "listening") await stopListening();
    } else if (phaseRef.current === "listening") {
      listen();
    }
  }

  /** Tap during the call: send now while listening, interrupt while speaking. */
  function tap() {
    if (phaseRef.current === "listening") listener.send();
    else if (phaseRef.current === "speaking") interrupt();
  }

  useEffect(
    () => () => {
      active.current = false;
      stopSpeaking();
      cancelReply();
      listener.cancel();
    },
    [],
  );

  return { phase, heard, reply, spokenTo, error, level, muted, inCall: phase !== "idle", startCall, endCall, tap, toggleMute };
}
