// Hands-free voice mode: listen, transcribe, ask FixBot, read the answer aloud, listen again.
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/index.ts";
import { useArea } from "../services/area.ts";
import { cancelReply, sendMessage } from "../services/chat.ts";
import { settingsStore, updateSettings } from "../services/settings.ts";
import { speak, stopSpeaking, transcribeRecording, useListener, type Recording } from "../services/voice.ts";
import { ConsentModal } from "../ui/ConsentModal.tsx";
import { Glass } from "../ui/Glass.tsx";
import { PressScale } from "../ui/motion.tsx";
import { areaColors, space, type, useTheme } from "../ui/theme.ts";
import { VoiceOrb, type OrbMode } from "../ui/VoiceOrb";

type Phase = "idle" | "listening" | "transcribing" | "thinking" | "speaking";

export default function Voice() {
  useArea("fixbot");
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [askConsent, setAskConsent] = useState(!settingsStore.get().consent);
  const alive = useRef(true);

  const listener = useListener((rec, event) => {
    if (!alive.current) return;
    if (!rec) return setPhase(event === "noSpeech" ? "idle" : "idle");
    handleTurn(rec);
  });

  async function listen() {
    setError(null);
    try {
      await listener.start();
      setPhase("listening");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  async function handleTurn(rec: Recording) {
    try {
      setPhase("transcribing");
      const text = await transcribeRecording(rec);
      if (!alive.current) return;
      if (!text) return listen(); // Nothing understood: keep listening, hands-free.
      setHeard(text);
      setReply("");
      setPhase("thinking");
      const answer = await sendMessage(text, null, { voice: true });
      if (!alive.current) return;
      if (!answer) {
        setError(t("FixBot could not answer. Try again."));
        return setPhase("idle");
      }
      setReply(answer.text);
      setPhase("speaking");
      await speak(answer.text, listener.level);
      if (alive.current) listen();
    } catch (e) {
      if (!alive.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  useEffect(() => {
    if (!askConsent) listen();
    return () => {
      alive.current = false;
      stopSpeaking();
      cancelReply();
      listener.cancel();
    };
  }, []);

  // Tap the orb: send now while listening, interrupt while speaking or thinking, start when idle.
  function tap() {
    if (phase === "listening") listener.send();
    else if (phase === "speaking") stopSpeaking();
    else if (phase === "thinking") cancelReply();
    else if (phase === "idle") listen();
  }

  const orbMode: OrbMode = phase === "listening" ? "listening" : phase === "speaking" ? "speaking" : phase === "idle" ? "idle" : "thinking";
  const status = {
    idle: t("Tap to talk"),
    listening: t("Listening…"),
    transcribing: t("Understanding…"),
    thinking: t("FixBot is thinking…"),
    speaking: t("Speaking… tap to interrupt"),
  }[phase];

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.s, paddingBottom: insets.bottom + space.l }}>
      <View style={styles.top}>
        <PressScale onPress={() => router.back()} accessibilityLabel={t("Close")}>
          <Glass interactive style={styles.round}>
            <Ionicons name="close" size={22} color={c.text} />
          </Glass>
        </PressScale>
        <Text style={[type.headline, { color: c.text }]}>FixBot</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.center}>
        <PressScale onPress={tap} haptic="light" scaleTo={0.97} accessibilityLabel={status}>
          <VoiceOrb level={listener.level} mode={orbMode} size={300} colors={areaColors.fixbot.glow} />
        </PressScale>
        <Text style={[type.caption, { color: c.secondary, letterSpacing: 0.3 }]}>{status}</Text>
      </View>

      <View style={{ paddingHorizontal: space.xl, gap: space.m, minHeight: 160 }}>
        {heard ? (
          <Text style={[type.title, { color: c.text, fontSize: 26, lineHeight: 32 }]} numberOfLines={3}>
            {heard}
          </Text>
        ) : (
          <Text style={[type.title, { color: c.secondary, fontSize: 26 }]}>{t("Describe your problem. FixBot answers aloud.")}</Text>
        )}
        {reply ? (
          <Text style={[type.body, { color: c.secondary }]} numberOfLines={5}>
            {reply}
          </Text>
        ) : null}
        {error ? <Text style={{ color: c.danger }}>{error}</Text> : null}
      </View>

      <View style={{ alignItems: "center", marginTop: space.l }}>
        <PressScale onPress={tap} haptic="medium" accessibilityLabel={status}>
          <View style={[styles.mic, { backgroundColor: phase === "listening" ? c.danger : areaColors.fixbot.glow[0] }]}>
            <Ionicons name={phase === "listening" ? "arrow-up" : phase === "idle" ? "mic" : "stop"} size={28} color="#fff" />
          </View>
        </PressScale>
      </View>

      <ConsentModal
        visible={askConsent}
        onDecision={(allowed) => {
          setAskConsent(false);
          updateSettings({ consent: allowed });
          if (allowed) listen();
          else router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.l },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.m },
  mic: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", boxShadow: "0 10px 30px rgba(106, 77, 255, 0.5)" },
});
