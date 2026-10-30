// FixVoice: talk to Fixify like on the phone. Calm start screen (orb, greeting, one pill);
// tap the pill and the call runs hands-free until you hang up.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut, useAnimatedReaction, useAnimatedStyle, useFrameCallback, useSharedValue, withSpring, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { useCall, type CallPhase } from "../../services/call.ts";
import { setChatContext, useChat } from "../../services/chat.ts";
import { useSession } from "../../services/sessions.ts";
import { firstName } from "../../core/profile.ts";
import { settingsStore, updateSettings, useSettings } from "../../services/settings.ts";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { Glass } from "../../ui/Glass.tsx";
import { PressScale } from "../../ui/motion.tsx";
import { Grain } from "../../ui/Grain";
import { RainbowBorder } from "../../ui/RainbowBorder";
import { useTabBarSpace } from "../../ui/Screen.tsx";
import { areaColors, font, space, type, useTheme } from "../../ui/theme.ts";
import { VoiceOrb } from "../../ui/VoiceOrb";

const glow = areaColors.fixbot.glow;

function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? t("Good morning") : h >= 12 && h < 18 ? t("Good afternoon") : t("Good evening");
}

const STATUS: Record<CallPhase, () => string> = {
  idle: () => "",
  connecting: () => t("Connecting…"),
  listening: () => t("Listening…"),
  transcribing: () => t("Understanding…"),
  thinking: () => t("Thinking…"),
  speaking: () => t("Speaking"),
};

export default function FixVoice() {
  useArea("fixbot");
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const call = useCall();
  const { contextSessionId } = useChat();
  const contextSession = useSession(contextSessionId ?? "");
  const [askConsent, setAskConsent] = useState(false);
  const name = firstName(useSettings().profile);

  function start() {
    // Nothing leaves the iPhone before the user agreed once.
    if (!settingsStore.get().consent) return setAskConsent(true);
    call.startCall();
  }

  const orbMode = call.phase === "listening" ? "listening" : call.phase === "speaking" ? "speaking" : call.inCall ? "thinking" : "idle";

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.xl }}>
      {/* Red light rising from the bottom. */}
      <VoiceGlow level={call.level} active={call.inCall} />

      <View style={styles.orbArea}>
        {/* The orb is the on/off switch: tap to start talking, tap again to hang up. */}
        <Pressable onPress={call.inCall ? call.endCall : start} accessibilityRole="button" accessibilityLabel={call.inCall ? t("End call") : t("Start call")}>
          <VoiceOrb level={call.level} mode={orbMode} size={240} colors={glow} />
        </Pressable>
      </View>

      <View style={styles.textArea}>
        {/* During a call the middle stays empty, like a phone call: just the orb; the status is in the pill. */}
        {!call.inCall && (
          <Animated.View key="idle" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ gap: space.s, alignItems: "center" }}>
            <Text style={[type.eyebrow, { color: c.secondary }]}>{name ? `${greeting()}, ${name}` : greeting()}</Text>
            <Text style={[styles.headline, { color: c.text }]} accessibilityRole="header">
              {t("How can I help you today?")}
            </Text>
          </Animated.View>
        )}
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

      <View style={{ paddingHorizontal: space.l, paddingBottom: tabSpace }}>
        {/* Soft rainbow edge, a little stronger while the call is live. */}
        <RainbowBorder radius={32} width={1.25} glow={0.6} intensity={call.inCall ? 1 : 0.85}>
          <Glass style={styles.pill}>
            <LinearGradient pointerEvents="none" colors={["#FF6A5A33", "#CA08081F"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <Grain opacity={0.3} />
            <PressScale
              onPress={call.inCall ? call.tap : start}
              haptic={false}
              scaleTo={0.98}
              accessibilityLabel={call.inCall ? STATUS[call.phase]() : t("Start call")}
              style={styles.pillMain}
            >
              <Text style={[styles.pillText, { color: call.inCall ? c.text : c.secondary }]} numberOfLines={1}>
                {call.inCall ? (call.phase === "speaking" ? t("Tap or talk to interrupt") : call.phase === "listening" ? t("Tap when you are done") : STATUS[call.phase]()) : t("Tap to talk…")}
              </Text>
              <Bars level={call.level} active={call.inCall} />
            </PressScale>
            {/* The hang-up button grows out of the pill when the call starts and shrinks back into it. */}
            {call.inCall && (
              <Animated.View entering={ZoomIn.springify().damping(16)} exiting={ZoomOut.duration(180)}>
                <PressScale onPress={call.endCall} haptic="medium" accessibilityLabel={t("End call")} style={[styles.hangUp, { backgroundColor: c.danger }]}>
                  <Ionicons name="close" size={20} color="#fff" />
                </PressScale>
              </Animated.View>
            )}
          </Glass>
        </RainbowBorder>
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

/**
 * Red light rising from the bottom. While talking it breathes with the voice (yours or FixVoice's):
 * a little taller and brighter, and it drifts sideways a touch. Springs keep it smooth, never jumpy.
 */
function VoiceGlow({ level, active }: { level: SharedValue<number>; active: boolean }) {
  const energy = useSharedValue(0);
  useAnimatedReaction(
    () => (active ? level.value : 0),
    (target) => {
      energy.value = withSpring(target, { duration: 500, dampingRatio: 1 });
    },
    [active],
  );
  const style = useAnimatedStyle(() => ({
    opacity: 0.8 + energy.value * 0.2,
    transform: [{ translateY: -energy.value * 40 }, { translateX: (energy.value - 0.3) * 24 }, { scaleY: 1 + energy.value * 0.25 }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.bottomGlow, style]}>
      <LinearGradient colors={["#00000000", "#270A0A88", "#CA0808B0", "#FF6A5AA8"]} locations={[0, 0.55, 0.85, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/** Five thin bars, like a sound wave. They move with the voice during a call. */
function Bars({ level, active }: { level: SharedValue<number>; active: boolean }) {
  const { c } = useTheme();
  const time = useSharedValue(0);
  useFrameCallback((f) => {
    time.value = (f.timeSinceFirstFrame ?? 0) / 1000;
  });
  const shape = [0.45, 0.8, 1, 0.7, 0.4];
  return (
    <View style={styles.bars}>
      {shape.map((s, i) => (
        <Bar key={i} index={i} scale={s} level={level} time={time} active={active} color={active ? c.text : c.secondary} />
      ))}
    </View>
  );
}

function Bar({ index, scale, level, time, active, color }: { index: number; scale: number; level: SharedValue<number>; time: SharedValue<number>; active: boolean; color: string }) {
  const style = useAnimatedStyle(() => {
    const wobble = active ? 0.5 + 0.5 * Math.sin(time.value * 9 + index * 1.3) : 0;
    const h = 6 + scale * (active ? 6 + level.value * 18 * (0.6 + 0.4 * wobble) : 10);
    return { height: h };
  });
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  bottomGlow: { position: "absolute", left: -30, right: -30, bottom: -60, height: "55%", transformOrigin: "bottom" },
  orbArea: { alignItems: "center", justifyContent: "center", marginTop: space.l },
  textArea: { flex: 1, alignItems: "center", paddingHorizontal: space.xl, gap: space.l, paddingTop: space.l },
  headline: { ...font.medium, fontSize: 34, lineHeight: 40, letterSpacing: -1, textAlign: "center" },
  context: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, maxWidth: "100%" },
  pill: { flexDirection: "row", alignItems: "center", height: 64, borderRadius: 32, paddingRight: 8, gap: space.s },
  pillMain: { flex: 1, flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingLeft: space.l, gap: space.m },
  pillText: { flex: 1, ...font.accent, fontSize: 17, letterSpacing: 0.1 },
  bars: { flexDirection: "row", alignItems: "center", gap: 3, height: 32, paddingRight: space.s },
  bar: { width: 2.5, borderRadius: 2 },
  hangUp: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
