// FixVoice: talk to Fixify like on the phone. A twisting wave on top that swings with the voices, the call
// time in the middle, light rising from the bottom, and three round buttons: microphone off, talk, hang up.
// The call runs hands-free: FixVoice notices on its own when you have finished talking.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useFrameCallback, useSharedValue, withRepeat, withTiming, ZoomIn, ZoomOut, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { useCall, type CallPhase } from "../../services/call.ts";
import { setChatContext, useChat } from "../../services/chat.ts";
import { useSession } from "../../services/sessions.ts";
import { settingsStore, updateSettings, useSettings, type VoiceGender } from "../../services/settings.ts";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { GlassCard, IconCircle, Segmented } from "../../ui/components.tsx";
import { PressScale } from "../../ui/motion.tsx";
import { useTabBarSpace } from "../../ui/Screen.tsx";
import { font, space, type, useTheme } from "../../ui/theme.ts";
import { follow } from "../../ui/smooth.ts";
import { VoiceWave } from "../../ui/VoiceWave";

const STATUS: Record<CallPhase, () => string> = {
  idle: () => t("Tap to talk…"),
  connecting: () => t("Connecting…"),
  listening: () => t("Listening…"),
  transcribing: () => t("Understanding…"),
  thinking: () => t("Thinking…"),
  speaking: () => t("Speaking"),
};

/** mm:ss since the call started (00:00 before). */
function useCallTime(inCall: boolean) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!inCall) return setStartedAt(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [inCall]);
  const secs = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  return `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

export default function FixVoice() {
  useArea("fixbot");
  const { c, brand } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tabSpace = useTabBarSpace();
  const call = useCall();
  const { contextSessionId } = useChat();
  const contextSession = useSession(contextSessionId ?? "");
  const settings = useSettings();
  const [askConsent, setAskConsent] = useState(false);
  const [voiceMenu, setVoiceMenu] = useState(false);
  const time = useCallTime(call.inCall);

  function start() {
    // Nothing leaves the iPhone before the user agreed once.
    if (!settingsStore.get().consent) return setAskConsent(true);
    call.startCall();
  }

  const waveMode = call.phase === "listening" ? "listening" : call.phase === "speaking" ? "speaking" : call.inCall ? "thinking" : "idle";
  const status = call.inCall && call.muted && call.phase === "listening" ? t("Microphone off") : STATUS[call.phase]();

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.s }}>
      {/* Light in the theme color rising from the bottom, breathing with the voices. */}
      <VoiceGlow level={call.level} active={call.inCall} />

      <View style={styles.top}>
        <PressScale onPress={() => router.navigate("/")} accessibilityLabel={t("Back")}>
          <IconCircle icon="arrow-back" size={46} />
        </PressScale>
        <PressScale onPress={() => setVoiceMenu((v) => !v)} accessibilityLabel={t("Voice")}>
          <IconCircle icon="ellipsis-vertical" size={46} active={voiceMenu} />
        </PressScale>
      </View>

      {voiceMenu && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.menu}>
          <GlassCard style={{ gap: space.s, padding: space.m }}>
            <Text style={[type.caption, { color: c.secondary }]}>{t("Voice")}</Text>
            <Segmented<VoiceGender>
              value={settings.voice}
              options={[["female", t("Female voice")], ["male", t("Male voice")]]}
              onChange={(voice) => {
                updateSettings({ voice });
                setVoiceMenu(false);
              }}
            />
          </GlassCard>
        </Animated.View>
      )}

      <View style={styles.wave}>
        <VoiceWave level={call.level} mode={waveMode} width={width} height={170} colors={brand.orb} />
      </View>

      <View style={styles.middle}>
        <Text style={[styles.time, { color: c.text }]} accessibilityLabel={t("Call time %@", time)}>
          {time}
        </Text>
        <Animated.Text key={status} entering={FadeIn.duration(220)} style={[type.caption, { color: c.secondary }]}>
          {status}
        </Animated.Text>
        {contextSession && (
          <View style={[styles.context, { borderColor: c.hairline }]}>
            <Ionicons name="construct-outline" size={13} color={c.secondary} />
            <Text style={{ color: c.secondary, fontSize: 13, ...font.regular, flexShrink: 1 }} numberOfLines={1}>
              {t("About: %@", contextSession.title)}
            </Text>
            <Pressable onPress={() => setChatContext(null)} hitSlop={10} accessibilityLabel={t("Remove session from chat")}>
              <Ionicons name="close" size={14} color={c.secondary} />
            </Pressable>
          </View>
        )}
        {call.error ? <Text style={[type.caption, { color: c.danger, textAlign: "center" }]}>{call.error}</Text> : null}
      </View>

      <View style={[styles.controls, { paddingBottom: tabSpace }]}>
        {/* Side buttons grow out of the talk button when the call starts and shrink back into it. */}
        <View style={styles.side}>
          {call.inCall && (
            <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(180)}>
              <PressScale onPress={call.toggleMute} haptic={false} accessibilityLabel={call.muted ? t("Unmute microphone") : t("Mute microphone")}>
                <IconCircle icon={call.muted ? "mic-off" : "pause"} size={52} active={call.muted} />
              </PressScale>
            </Animated.View>
          )}
        </View>

        <TalkButton level={call.level} listening={call.phase === "listening" && !call.muted} onPress={call.inCall ? call.tap : start} label={call.inCall ? STATUS[call.phase]() : t("Start call")} />

        <View style={styles.side}>
          {call.inCall && (
            <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(180)}>
              <PressScale onPress={call.endCall} haptic="medium" accessibilityLabel={t("End call")}>
                <IconCircle icon="close" size={52} />
              </PressScale>
            </Animated.View>
          )}
        </View>
      </View>

      <ConsentModal
        visible={askConsent}
        onDecision={(allowed) => {
          setAskConsent(false);
          updateSettings({ consent: allowed });
          if (allowed) call.startCall();
        }}
      />
    </View>
  );
}

/** The big round talk button with soft rings that ripple out while FixVoice is listening. */
function TalkButton({ level, listening, onPress, label }: { level: SharedValue<number>; listening: boolean; onPress: () => void; label: string }) {
  const { c, brand } = useTheme();
  const ripple = useSharedValue(0);
  useEffect(() => {
    ripple.value = 0;
    if (listening) ripple.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
  }, [listening]);
  const ring = (offset: number) =>
    useAnimatedStyle(() => {
      const p = (ripple.value + offset) % 1;
      return { opacity: listening ? (1 - p) * 0.5 : 0, transform: [{ scale: 1 + p * 0.9 + level.value * 0.15 }] };
    });
  const r1 = ring(0);
  const r2 = ring(0.5);
  return (
    <View style={styles.talkWrap}>
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: brand.orb[2] }, r1]} />
      <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: brand.orb[2] }, r2]} />
      <PressScale onPress={onPress} haptic="medium" accessibilityLabel={label} style={[styles.talk, { boxShadow: `0 0 36px ${c.accent}AA, 0 0 0 1px #FFFFFF33` }]}>
        <LinearGradient colors={[brand.orb[2], c.accent, brand.accentDeep]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="mic" size={30} color="#FFFFFF" />
      </PressScale>
    </View>
  );
}

/**
 * Light in the theme color rising from the bottom. While talking it breathes with the voice (yours or FixVoice's):
 * a little taller and brighter, and it drifts sideways a touch. Springs keep it smooth, never jumpy.
 */
function VoiceGlow({ level, active }: { level: SharedValue<number>; active: boolean }) {
  const { c, brand } = useTheme();
  const energy = useSharedValue(0);
  const on = useSharedValue(active ? 1 : 0);
  on.value = active ? 1 : 0;
  // Eased every frame instead of a new spring per voice value, so the light breathes without twitching.
  useFrameCallback((f) => {
    energy.value = follow(energy.value, on.value * level.value, f.timeSincePreviousFrame ?? 16, 260);
  });
  const style = useAnimatedStyle(() => ({
    opacity: 0.85 + energy.value * 0.15,
    transform: [{ translateY: -energy.value * 40 }, { translateX: (energy.value - 0.3) * 24 }, { scaleY: 1 + energy.value * 0.25 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.bottomGlow, style]}>
      <LinearGradient colors={[`${c.background}00`, `${brand.orb[1]}AA`, `${brand.orb[0]}D0`, `${brand.orb[2]}C0`]} locations={[0, 0.45, 0.8, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bottomGlow: { position: "absolute", left: -30, right: -30, bottom: -60, height: "60%", transformOrigin: "bottom" },
  top: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space.l, zIndex: 2 },
  menu: { position: "absolute", top: 110, right: space.l, width: 260, zIndex: 3 },
  wave: { marginTop: space.xl, alignItems: "center" },
  middle: { flex: 1, alignItems: "center", gap: space.s, paddingTop: space.l, paddingHorizontal: space.xl },
  time: { ...font.light, fontSize: 40, letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
  context: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, maxWidth: "100%", marginTop: space.s },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.xl },
  side: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  talkWrap: { width: 120, height: 120, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: 76, height: 76, borderRadius: 38, borderWidth: 1.5 },
  talk: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", overflow: "hidden" },
});
