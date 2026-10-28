// FixVoice: talk to Fixify like on the phone. Calm start screen (orb, greeting, one pill);
// tap the pill and the call runs hands-free until you hang up.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useFrameCallback, useSharedValue, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { useCall, type CallPhase } from "../../services/call.ts";
import { setChatContext, useChat } from "../../services/chat.ts";
import { useSession } from "../../services/sessions.ts";
import { settingsStore, updateSettings } from "../../services/settings.ts";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { Glass } from "../../ui/Glass.tsx";
import { PressScale } from "../../ui/motion.tsx";
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

  function start() {
    // Nothing leaves the iPhone before the user agreed once.
    if (!settingsStore.get().consent) return setAskConsent(true);
    call.startCall();
  }

  const orbMode = call.phase === "listening" ? "listening" : call.phase === "speaking" ? "speaking" : call.inCall ? "thinking" : "idle";

  return (
    <View style={{ flex: 1, paddingTop: insets.top + space.xl }}>
      {/* Blue light rising from the bottom, like the reference screen. */}
      <LinearGradient pointerEvents="none" colors={["#02040900", "#0B2A6B88", "#1E5BFFAA"]} locations={[0, 0.6, 1]} style={styles.bottomGlow} />

      <View style={styles.orbArea}>
        {/* The orb is the on/off switch: tap to start talking, tap again to hang up. */}
        <Pressable onPress={call.inCall ? call.endCall : start} accessibilityRole="button" accessibilityLabel={call.inCall ? t("End call") : t("Start call")}>
          <VoiceOrb level={call.level} mode={orbMode} size={240} colors={glow} />
        </Pressable>
      </View>

      <View style={styles.textArea}>
        {call.inCall ? (
          <Animated.View key="call" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ gap: space.m, alignItems: "center" }}>
            <Text style={[type.eyebrow, { color: c.secondary }]}>{STATUS[call.phase]()}</Text>
            <Live call={call} />
          </Animated.View>
        ) : (
          <Animated.View key="idle" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ gap: space.s, alignItems: "center" }}>
            <Text style={[type.eyebrow, { color: c.secondary }]}>{greeting()}</Text>
            <Text style={[styles.headline, { color: c.text }]} accessibilityRole="header">
              {t("How can I help you today?")}
            </Text>
          </Animated.View>
        )}
        {contextSession && (
          <View style={[styles.context, { borderColor: c.hairline }]}>
            <Ionicons name="construct-outline" size={13} color={c.secondary} />
            <Text style={{ color: c.secondary, fontSize: 13, fontFamily: font.regular, flexShrink: 1 }} numberOfLines={1}>
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
        <RainbowBorder radius={32} intensity={call.inCall ? 0.95 : 0.55}>
          <Glass style={styles.pill}>
            <LinearGradient pointerEvents="none" colors={["#5AA8FF33", "#1E5BFF14"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
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
            {call.inCall && (
              <PressScale onPress={call.endCall} haptic="medium" accessibilityLabel={t("End call")} style={[styles.hangUp, { backgroundColor: c.danger }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </PressScale>
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

/** The words on screen: what you said while FixVoice thinks, then its reply, lit up as it is spoken. */
function Live({ call }: { call: ReturnType<typeof useCall> }) {
  const { c } = useTheme();
  if (call.phase === "speaking" && call.reply) {
    const plain = call.reply.replace(/[*_#`>]/g, "").replace(/\s+/g, " ").trim();
    const cut = call.spokenTo > 0 ? Math.min(plain.indexOf(" ", call.spokenTo) === -1 ? plain.length : plain.indexOf(" ", call.spokenTo), plain.length) : 0;
    return (
      <Text style={[styles.live, { color: c.secondary }]} numberOfLines={7}>
        <Text style={{ color: c.text }}>{plain.slice(0, cut)}</Text>
        {plain.slice(cut)}
      </Text>
    );
  }
  if (call.heard && call.phase !== "listening") {
    return (
      <Text style={[styles.live, { color: c.text }]} numberOfLines={5}>
        {call.heard}
      </Text>
    );
  }
  return <Text style={[styles.live, { color: c.secondary }]}>{t("Just talk. I'm listening.")}</Text>;
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
  bottomGlow: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
  orbArea: { alignItems: "center", justifyContent: "center", marginTop: space.l },
  textArea: { flex: 1, alignItems: "center", paddingHorizontal: space.xl, gap: space.l, paddingTop: space.l },
  headline: { fontFamily: font.medium, fontSize: 34, lineHeight: 40, letterSpacing: -1, textAlign: "center" },
  live: { fontFamily: font.medium, fontSize: 24, lineHeight: 32, letterSpacing: -0.5, textAlign: "center" },
  context: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, maxWidth: "100%" },
  pill: { flexDirection: "row", alignItems: "center", height: 64, borderRadius: 32, paddingRight: 8, gap: space.s },
  pillMain: { flex: 1, flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingLeft: space.l, gap: space.m },
  pillText: { flex: 1, fontFamily: font.accent, fontSize: 17, letterSpacing: 0.1 },
  bars: { flexDirection: "row", alignItems: "center", gap: 3, height: 32, paddingRight: space.s },
  bar: { width: 2.5, borderRadius: 2 },
  hangUp: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
