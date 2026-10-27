import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import { preflight, start } from "../../services/analysis.ts";
import { cancelReply, newChat, retryMessage, sendMessage, setChatContext, useChat, type ChatMessage, type ChatPhoto } from "../../services/chat.ts";
import { openSession } from "../../services/nav.ts";
import { createSession, useSession } from "../../services/sessions.ts";
import { useQuota } from "../../services/usage.ts";
import { settingsStore, updateSettings } from "../../services/settings.ts";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { Caption } from "../../ui/components.tsx";
import { Backdrop, Glass, ScrollEdge } from "../../ui/Glass.tsx";
import { RichText } from "../../ui/RichText.tsx";
import { useTabBarSpace } from "../../ui/Screen.tsx";
import { radius, space, type, useTheme } from "../../ui/theme.ts";

const SUGGESTIONS = [
  "My Wi-Fi keeps dropping. What can I check?",
  "My printer says it is offline.",
  "How do I find out which cable this port needs?",
  "My washing machine shows an error code.",
];

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
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const keyboard = useKeyboardVisible();
  const { messages, sending, contextSessionId } = useChat();
  const quota = useQuota();
  const contextSession = useSession(contextSessionId ?? "");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<ChatPhoto | null>(null);
  const [pendingSend, setPendingSend] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    const id = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [messages.length, sending]);

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

  function attach() {
    if (Platform.OS === "web") return pick("library");
    Alert.alert(t("Add a photo"), noUploadsLeft ? t("No photo uploads left today.") : undefined, [
      { text: t("Take photo"), onPress: () => pick("camera") },
      { text: t("Choose from photos"), onPress: () => pick("library") },
      { text: t("Cancel"), style: "cancel" },
    ]);
  }

  function send(value = text) {
    if (sending || (!value.trim() && !photo)) return;
    // Same rule as the analysis: nothing leaves the iPhone before the user agreed once.
    if (!settingsStore.get().consent) {
      setPendingSend(value);
      return;
    }
    sendMessage(value, photo);
    setText("");
    setPhoto(null);
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
      <Backdrop />
      <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
        <View style={{ flex: 1 }}>
          <Text style={[type.display, { color: c.text }]} accessibilityRole="header">
            FixBot
          </Text>
          <Caption>
            {quota.uploadsLeft !== null && quota.uploadsDaily
              ? t("%lld of %lld photo uploads left today", quota.uploadsLeft, quota.uploadsDaily)
              : t("Ask anything about fixing things.")}
          </Caption>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={newChat} accessibilityRole="button" accessibilityLabel={t("New chat")} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            <Glass interactive style={styles.roundButton}>
              <Ionicons name="create-outline" size={20} color={c.accent} />
            </Glass>
          </Pressable>
        )}
      </View>

      {contextSession && (
        <View style={[styles.context, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="build-outline" size={14} color={c.accent} />
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
        contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xl, flexGrow: 1 }}
      >
        {messages.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", gap: space.l, paddingVertical: space.xl }}>
            <View style={[styles.botBadge, { backgroundColor: c.accent }]}>
              <Ionicons name="chatbubbles" size={28} color="#fff" />
            </View>
            <Text style={[type.title, { color: c.text, textAlign: "center" }]}>{t("Hi, I'm FixBot.")}</Text>
            <Caption style={{ textAlign: "center", fontSize: 15 }}>
              {t("Ask me about devices, Wi-Fi, error messages, appliances or anything you want to fix. Add a photo if it helps.")}
            </Caption>
            <View style={{ gap: space.s }}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => send(t(s))} style={({ pressed }) => [styles.suggestion, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}>
                  <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{t(s)}</Text>
                  <Ionicons name="arrow-up-circle-outline" size={20} color={c.accent} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m) => <Bubble key={m.id} message={m} onRetry={() => retryMessage(m.id)} onStartFix={() => startFix(m)} />)
        )}
        {sending && (
          <View style={[styles.bubble, styles.botBubble, { backgroundColor: c.surface, flexDirection: "row", alignItems: "center", gap: space.s }]}>
            <ActivityIndicator size="small" />
            <Text style={{ color: c.secondary, flex: 1 }}>{t("FixBot is thinking…")}</Text>
            <Pressable onPress={cancelReply} hitSlop={8} accessibilityLabel={t("Stop")}>
              <Ionicons name="stop-circle-outline" size={22} color={c.secondary} />
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Sits above the floating tab bar; with the keyboard open, right above the keyboard. */}
      <View style={{ paddingHorizontal: space.m, paddingBottom: keyboard ? space.s : tabSpace - 14, paddingTop: space.xs }}>
        {photo && (
          <View style={styles.preview}>
            <Image source={{ uri: photo.uri }} style={{ width: 56, height: 56, borderRadius: 10 }} contentFit="cover" />
            <Caption style={{ flex: 1 }}>{t("Uses 1 of your daily photo uploads.")}</Caption>
            <Pressable onPress={() => setPhoto(null)} hitSlop={10} accessibilityLabel={t("Remove photo")}>
              <Ionicons name="close-circle" size={22} color={c.secondary} />
            </Pressable>
          </View>
        )}
        <Glass style={styles.inputBar}>
          <Pressable onPress={attach} hitSlop={6} accessibilityRole="button" accessibilityLabel={t("Add a photo")} style={styles.iconButton}>
            <Ionicons name="camera-outline" size={22} color={c.accent} />
          </Pressable>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t("Ask FixBot…")}
            placeholderTextColor={c.secondary}
            multiline
            style={[styles.input, { color: c.text }]}
            onSubmitEditing={() => send()}
            submitBehavior="blurAndSubmit"
          />
          <Pressable
            onPress={() => send()}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t("Send")}
            style={[styles.sendButton, { backgroundColor: canSend ? c.accent : c.hairline }]}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </Pressable>
        </Glass>
      </View>
      <ScrollEdge />
      <ConsentModal
        visible={pendingSend !== null}
        onDecision={(allowed) => {
          const value = pendingSend ?? "";
          setPendingSend(null);
          updateSettings({ consent: allowed });
          if (allowed) {
            sendMessage(value, photo);
            setText("");
            setPhoto(null);
          }
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Bubble({ message, onRetry, onStartFix }: { message: ChatMessage; onRetry: () => void; onStartFix: () => void }) {
  const { c } = useTheme();
  const mine = message.role === "user";
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: 4 }}>
      <View style={[styles.bubble, mine ? styles.userBubble : styles.botBubble, { backgroundColor: mine ? c.accent : c.surface }]}>
        {message.photo && (
          <Image source={{ uri: message.photo.uri }} style={[styles.photo, { aspectRatio: message.photo.width / Math.max(message.photo.height, 1) }]} contentFit="cover" />
        )}
        {message.text ? mine ? <Text style={[type.body, { color: "#fff" }]}>{message.text}</Text> : <RichText text={message.text} color={c.text} /> : null}
      </View>
      {message.degraded && <Caption style={{ fontSize: 12 }}>{t("Answered by the quick model because FixBot is busy.")}</Caption>}
      {message.failed ? (
        <Pressable onPress={onRetry} style={{ flexDirection: "row", gap: 6, alignItems: "center", maxWidth: "85%" }} accessibilityRole="button">
          <Ionicons name="alert-circle" size={16} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: 13, flexShrink: 1 }}>{message.failed}</Text>
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>{t("Try again")}</Text>
        </Pressable>
      ) : mine && message.photo ? (
        <Pressable onPress={onStartFix} style={{ flexDirection: "row", gap: 4, alignItems: "center" }} accessibilityRole="button">
          <Ionicons name="scan-outline" size={14} color={c.accent} />
          <Text style={{ color: c.accent, fontSize: 13, fontWeight: "600" }}>{t("Analyze as Fix session")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: space.m, paddingHorizontal: space.l, paddingBottom: space.s },
  roundButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  context: { flexDirection: "row", alignItems: "center", gap: space.s, marginHorizontal: space.l, paddingHorizontal: space.m, paddingVertical: 8, borderRadius: 14 },
  botBadge: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: space.s, padding: space.m, borderRadius: radius.control },
  bubble: { maxWidth: "85%", padding: space.m, borderRadius: 20, gap: space.s, borderCurve: "continuous" },
  userBubble: { borderBottomRightRadius: 6 },
  botBubble: { borderBottomLeftRadius: 6 },
  photo: { width: 220, maxWidth: "100%", borderRadius: 14 },
  preview: { flexDirection: "row", alignItems: "center", gap: space.m, marginBottom: space.s },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: space.s, borderRadius: 26, paddingHorizontal: 6, paddingVertical: 6 },
  iconButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, fontSize: 17, maxHeight: 120, paddingTop: 9, paddingBottom: 9 },
  sendButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
