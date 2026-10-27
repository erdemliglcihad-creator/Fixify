import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import * as Crypto from "expo-crypto";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import { preflight, start } from "../../services/analysis.ts";
import { useArea } from "../../services/area.ts";
import { cancelReply, newChat, retryMessage, sendMessage, setChatContext, useChat, type ChatMessage, type ChatPhoto } from "../../services/chat.ts";
import { openSession } from "../../services/nav.ts";
import { createSession, useSession } from "../../services/sessions.ts";
import { settingsStore, updateSettings } from "../../services/settings.ts";
import { useQuota } from "../../services/usage.ts";
import { speak, stopSpeaking, transcribeRecording, useListener } from "../../services/voice.ts";
import { Caption } from "../../ui/components.tsx";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { Glass, ScrollEdge } from "../../ui/Glass.tsx";
import { GradientText, PressScale, Rise } from "../../ui/motion.tsx";
import { RichText } from "../../ui/RichText.tsx";
import { useTabBarSpace } from "../../ui/Screen.tsx";
import { areaColors, space, type, useTheme } from "../../ui/theme.ts";

const SUGGESTIONS: { emoji: string; text: string }[] = [
  { emoji: "📶", text: "My Wi-Fi keeps dropping. What can I check?" },
  { emoji: "🖨️", text: "My printer says it is offline." },
  { emoji: "🔌", text: "How do I find out which cable this port needs?" },
  { emoji: "🧺", text: "My washing machine shows an error code." },
];

const glow = areaColors.fixbot.glow;

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

export default function FixBot() {
  useArea("fixbot");
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const keyboard = useKeyboardVisible();
  const { messages, sending, contextSessionId } = useChat();
  const quota = useQuota();
  const contextSession = useSession(contextSessionId ?? "");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [pendingSend, setPendingSend] = useState<string | null>(null);
  const [dictating, setDictating] = useState<"off" | "listening" | "transcribing">("off");
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const speechLevel = useSharedValue(0);
  const scroll = useRef<ScrollViewInstance>(null);

  // Mic in the input field: dictate, the text lands in the field so you can check it before sending.
  const listener = useListener(async (rec) => {
    if (!rec) return setDictating("off");
    setDictating("transcribing");
    try {
      const said = await transcribeRecording(rec);
      if (said) setText((prev) => (prev.trim() ? `${prev.trim()} ${said}` : said));
    } catch (e) {
      setDictationError(e instanceof Error ? e.message : String(e));
    } finally {
      setDictating("off");
    }
  });

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length, sending]);

  useEffect(() => () => stopSpeaking(), []);

  const noUploadsLeft = quota.uploadsLeft === 0;

  async function pick(source: "camera" | "library") {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 1 };
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
    }
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setPhoto({ uri: a.uri, width: a.width, height: a.height });
    }
  }

  function needsConsent(value: string) {
    // Same rule as the analysis: nothing leaves the iPhone before the user agreed once.
    if (settingsStore.get().consent) return false;
    setPendingSend(value);
    return true;
  }

  function send(value = text) {
    if (sending || (!value.trim() && !photo)) return;
    if (needsConsent(value)) return;
    sendMessage(value, photo);
    setText("");
    setPhoto(null);
  }

  async function toggleDictation() {
    setDictationError(null);
    if (dictating === "listening") return listener.send();
    if (dictating !== "off" || needsConsent("")) return;
    try {
      stopSpeaking();
      await listener.start();
      setDictating("listening");
    } catch (e) {
      setDictationError(e instanceof Error ? e.message : String(e));
    }
  }

  async function readAloud(message: ChatMessage) {
    if (speakingId === message.id) return stopSpeaking();
    stopSpeaking();
    setSpeakingId(message.id);
    await speak(message.text, speechLevel);
    setSpeakingId((id) => (id === message.id ? null : id));
  }

  async function startFix(message: ChatMessage) {
    if (!message.photo) return;
    const session = await createSession(
      [{ id: Crypto.randomUUID(), uri: message.photo.uri, width: message.photo.width, height: message.photo.height, source: "library" }],
      message.text,
      null,
    );
    if (preflight(session, "initial") === "ready") start(session.id, "initial");
    openSession(session.id);
  }

  const canSend = !sending && (text.trim().length > 0 || photo !== null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
        <BotAvatar size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[type.title, { color: c.text }]} accessibilityRole="header">
            FixBot
          </Text>
          <Caption style={{ fontSize: 13 }}>
            {quota.uploadsLeft !== null && quota.uploadsDaily
              ? `📸 ${t("%lld of %lld photo uploads left today", quota.uploadsLeft, quota.uploadsDaily)}`
              : t("Ask anything about fixing things.")}
          </Caption>
        </View>
        <PressScale onPress={() => router.push("/voice")} accessibilityLabel={t("Talk to FixBot")}>
          <Glass interactive style={styles.roundButton}>
            <Ionicons name="radio-outline" size={20} color={areaColors.fixbot.accent} />
          </Glass>
        </PressScale>
        {messages.length > 0 && (
          <PressScale onPress={newChat} accessibilityLabel={t("New chat")}>
            <Glass interactive style={styles.roundButton}>
              <Ionicons name="create-outline" size={20} color={areaColors.fixbot.accent} />
            </Glass>
          </PressScale>
        )}
      </View>

      {contextSession && (
        <View style={[styles.context, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <Text style={{ fontSize: 13 }}>🔧</Text>
          <Text style={{ color: c.text, flex: 1, fontSize: 13 }} numberOfLines={1}>
            {t("About: %@", contextSession.title)}
          </Text>
          <Pressable onPress={() => setChatContext(null)} hitSlop={10} accessibilityLabel={t("Remove session from chat")}>
            <Ionicons name="close" size={16} color={c.secondary} />
          </Pressable>
        </View>
      )}

      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: space.xl, flexGrow: 1 }}
      >
        {messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", gap: space.l, paddingVertical: space.l }}>
            <Rise index={0} style={{ alignItems: "center" }}>
              <BotAvatar size={72} />
            </Rise>
            <Rise index={1} style={{ gap: space.s }}>
              <GradientText colors={dark ? ["#FFFFFF", "#C9BDFF", "#8FA8FF"] : ["#10131A", "#5B3FD6", "#2453FF"]} style={[type.display, { textAlign: "center" }]}>
                {t("Hi, I'm FixBot.")} 👋
              </GradientText>
              <Caption style={{ textAlign: "center", fontSize: 15, lineHeight: 21 }}>
                {t("Ask me about devices, Wi-Fi, error messages, appliances or anything you want to fix. Add a photo if it helps.")}
              </Caption>
            </Rise>
            <View style={styles.grid}>
              {SUGGESTIONS.map((s, i) => (
                <Rise key={s.text} index={2 + i} style={styles.cell}>
                  <PressScale onPress={() => send(t(s.text))} style={[styles.suggestion, { backgroundColor: c.surface, borderColor: c.hairline }]}>
                    <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                    <Text style={{ color: c.text, fontSize: 14, fontWeight: "500", lineHeight: 19 }} numberOfLines={3}>
                      {t(s.text)}
                    </Text>
                  </PressScale>
                </Rise>
              ))}
            </View>
            <Rise index={6}>
              <PressScale onPress={() => router.push("/voice")} style={{ alignSelf: "center" }}>
                <LinearGradient colors={[glow[2], glow[0], glow[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.voiceCta}>
                  <Ionicons name="mic" size={18} color="#fff" />
                  <Text style={[type.headline, { color: "#fff" }]}>{t("Talk to FixBot")}</Text>
                </LinearGradient>
              </PressScale>
            </Rise>
          </View>
        ) : (
          messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              speaking={speakingId === m.id}
              onRetry={() => retryMessage(m.id)}
              onStartFix={() => startFix(m)}
              onReadAloud={() => readAloud(m)}
            />
          ))
        )}
        {sending && (
          <Animated.View entering={FadeIn} style={{ gap: space.s }}>
            <Label mine={false} />
            <View style={[styles.botCard, { backgroundColor: c.surface, borderColor: c.hairline, flexDirection: "row", alignItems: "center", gap: space.s }]}>
              <ActivityIndicator size="small" color={areaColors.fixbot.accent} />
              <Text style={{ color: c.secondary, flex: 1 }}>{t("FixBot is thinking…")}</Text>
              <Pressable onPress={cancelReply} hitSlop={8} accessibilityLabel={t("Stop")}>
                <Ionicons name="stop-circle-outline" size={22} color={c.secondary} />
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Sits above the floating tab bar; with the keyboard open, right above the keyboard. */}
      <View style={{ paddingHorizontal: space.m, paddingBottom: keyboard ? space.s : tabSpace - 4, paddingTop: space.xs, gap: space.s }}>
        {photo && (
          <View style={styles.preview}>
            <Image source={{ uri: photo.uri }} style={{ width: 56, height: 56, borderRadius: 12 }} contentFit="cover" />
            <Caption style={{ flex: 1 }}>{noUploadsLeft ? t("No photo uploads left today.") : t("Uses 1 of your daily photo uploads.")}</Caption>
            <Pressable onPress={() => setPhoto(null)} hitSlop={10} accessibilityLabel={t("Remove photo")}>
              <Ionicons name="close-circle" size={22} color={c.secondary} />
            </Pressable>
          </View>
        )}
        {dictationError ? <Caption style={{ color: c.danger, paddingHorizontal: space.s }}>{dictationError}</Caption> : null}
        <Glass style={styles.inputBar}>
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={dictating === "listening" ? t("Listening…") : dictating === "transcribing" ? t("Understanding…") : t("Ask FixBot…")}
              placeholderTextColor={dictating === "off" ? c.secondary : areaColors.fixbot.accent}
              multiline
              style={[styles.input, { color: c.text }]}
              onSubmitEditing={() => send()}
              submitBehavior="blurAndSubmit"
            />
          </View>
          <View style={styles.tools}>
            <ToolButton icon="image-outline" label={t("Choose from photos")} onPress={() => pick("library")} />
            {Platform.OS !== "web" && <ToolButton icon="camera-outline" label={t("Take photo")} onPress={() => pick("camera")} />}
            <View style={{ flex: 1 }} />
            {canSend ? (
              <PressScale onPress={() => send()} haptic="light" accessibilityLabel={t("Send")}>
                <LinearGradient colors={[glow[2], glow[0]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendButton}>
                  <Ionicons name="arrow-up" size={20} color="#fff" />
                </LinearGradient>
              </PressScale>
            ) : (
              <MicButton state={dictating} level={listener.level} onPress={toggleDictation} />
            )}
          </View>
        </Glass>
      </View>
      <ScrollEdge />
      <ConsentModal
        visible={pendingSend !== null}
        onDecision={(allowed) => {
          const value = pendingSend ?? "";
          setPendingSend(null);
          updateSettings({ consent: allowed });
          if (allowed && (value.trim() || photo)) {
            sendMessage(value, photo);
            setText("");
            setPhoto(null);
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

function BotAvatar({ size }: { size: number }) {
  return (
    <LinearGradient
      colors={[glow[2], glow[0], glow[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", boxShadow: `0 6px 20px ${glow[0]}66` }}
    >
      <Text style={{ fontSize: size * 0.5 }}>🤖</Text>
    </LinearGradient>
  );
}

function Label({ mine }: { mine: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.label, mine && { alignSelf: "flex-end" }]}>
      {mine ? (
        <View style={[styles.userDot, { backgroundColor: c.raised }]}>
          <Text style={{ fontSize: 12 }}>🙂</Text>
        </View>
      ) : (
        <BotAvatar size={22} />
      )}
      <Text style={{ color: c.secondary, fontSize: 13, fontWeight: "600" }}>{mine ? t("You") : "FixBot"}</Text>
    </View>
  );
}

function ToolButton({ icon, label, onPress }: { icon: "image-outline" | "camera-outline"; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} style={styles.tool}>
      <Ionicons name={icon} size={21} color={c.secondary} />
    </PressScale>
  );
}

function MicButton({ state, level, onPress }: { state: "off" | "listening" | "transcribing"; level: ReturnType<typeof useSharedValue<number>>; onPress: () => void }) {
  const { c } = useTheme();
  // The ring grows with your voice while dictating.
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: 1 + level.value * 0.5 }], opacity: state === "listening" ? 0.35 + level.value * 0.4 : 0 }));
  return (
    <PressScale onPress={onPress} haptic="light" accessibilityLabel={state === "listening" ? t("Stop and insert") : t("Dictate")}>
      <View style={styles.sendButton}>
        <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 19, backgroundColor: c.danger }, ring]} />
        <View style={[StyleSheet.absoluteFill, { borderRadius: 19, backgroundColor: state === "listening" ? c.danger : c.raised }]} />
        {state === "transcribing" ? <ActivityIndicator size="small" color={c.text} /> : <Ionicons name={state === "listening" ? "stop" : "mic"} size={19} color={state === "listening" ? "#fff" : c.text} />}
      </View>
    </PressScale>
  );
}

function Message({
  message,
  speaking,
  onRetry,
  onStartFix,
  onReadAloud,
}: {
  message: ChatMessage;
  speaking: boolean;
  onRetry: () => void;
  onStartFix: () => void;
  onReadAloud: () => void;
}) {
  const { c } = useTheme();
  const mine = message.role === "user";
  const [copied, setCopied] = useState(false);
  return (
    <Animated.View entering={FadeIn.duration(260)} style={{ gap: space.s, alignItems: mine ? "flex-end" : "stretch" }}>
      <Label mine={mine} />
      {mine ? (
        <LinearGradient colors={[glow[0], glow[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
          {message.photo && (
            <Image source={{ uri: message.photo.uri }} style={[styles.photo, { aspectRatio: message.photo.width / Math.max(message.photo.height, 1) }]} contentFit="cover" />
          )}
          {message.text ? (
            <Text style={[type.body, { color: "#fff" }]}>
              {message.voice ? "🎙️ " : ""}
              {message.text}
            </Text>
          ) : null}
        </LinearGradient>
      ) : (
        <View style={[styles.botCard, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <RichText text={message.text} color={c.text} />
        </View>
      )}
      {!mine && (
        <View style={styles.actions}>
          <Pressable
            onPress={async () => {
              await Clipboard.setStringAsync(message.text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            hitSlop={8}
            accessibilityLabel={t("Copy")}
            style={styles.action}
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={16} color={c.secondary} />
            <Text style={{ color: c.secondary, fontSize: 12 }}>{copied ? t("Copied") : t("Copy")}</Text>
          </Pressable>
          <Pressable onPress={onReadAloud} hitSlop={8} accessibilityLabel={speaking ? t("Stop") : t("Read aloud")} style={styles.action}>
            <Ionicons name={speaking ? "stop-circle-outline" : "volume-high-outline"} size={16} color={speaking ? areaColors.fixbot.accent : c.secondary} />
            <Text style={{ color: speaking ? areaColors.fixbot.accent : c.secondary, fontSize: 12 }}>{speaking ? t("Stop") : t("Read aloud")}</Text>
          </Pressable>
          {message.degraded && <Caption style={{ fontSize: 12, flexShrink: 1 }}>⚡ {t("Answered by the quick model because FixBot is busy.")}</Caption>}
        </View>
      )}
      {message.failed ? (
        <Pressable onPress={onRetry} style={{ flexDirection: "row", gap: 6, alignItems: "center", maxWidth: "85%" }} accessibilityRole="button">
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: 13, flexShrink: 1 }}>{message.failed}</Text>
          <Text style={{ color: areaColors.fixbot.accent, fontSize: 13, fontWeight: "600" }}>{t("Try again")}</Text>
        </Pressable>
      ) : mine && message.photo ? (
        <Pressable onPress={onStartFix} style={{ flexDirection: "row", gap: 4, alignItems: "center" }} accessibilityRole="button">
          <Ionicons name="scan-outline" size={14} color={areaColors.fixbot.accent} />
          <Text style={{ color: areaColors.fixbot.accent, fontSize: 13, fontWeight: "600" }}>{t("Analyze as Fix session")}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingBottom: space.s },
  roundButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  context: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s,
    marginHorizontal: space.l,
    paddingHorizontal: space.m,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.m },
  cell: { flexBasis: "47%", flexGrow: 1 },
  suggestion: { gap: space.s, padding: space.m, borderRadius: 22, minHeight: 116, borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous" },
  voiceCta: { flexDirection: "row", alignItems: "center", gap: space.s, paddingHorizontal: space.l, paddingVertical: 12, borderRadius: 24 },
  label: { flexDirection: "row", alignItems: "center", gap: 6 },
  userDot: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  userBubble: { maxWidth: "85%", padding: space.m, paddingHorizontal: space.l, borderRadius: 22, borderTopRightRadius: 8, gap: space.s, overflow: "hidden", borderCurve: "continuous" },
  botCard: { padding: space.l, borderRadius: 22, borderTopLeftRadius: 8, borderWidth: StyleSheet.hairlineWidth, gap: space.s, borderCurve: "continuous" },
  photo: { width: 220, maxWidth: "100%", borderRadius: 14 },
  actions: { flexDirection: "row", alignItems: "center", gap: space.l, paddingHorizontal: space.xs, flexWrap: "wrap" },
  action: { flexDirection: "row", alignItems: "center", gap: 4 },
  preview: { flexDirection: "row", alignItems: "center", gap: space.m },
  inputBar: { borderRadius: 26, paddingHorizontal: space.s, paddingTop: 4, paddingBottom: 6 },
  inputRow: { paddingHorizontal: space.s },
  input: { fontSize: 17, maxHeight: 120, minHeight: 40, paddingTop: 10, paddingBottom: 6 },
  tools: { flexDirection: "row", alignItems: "center", gap: 2 },
  tool: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  sendButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", overflow: "visible" },
});
