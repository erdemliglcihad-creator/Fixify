import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORIES, type ProblemCategory } from "../core/types.ts";
import { t } from "../i18n/index.ts";
import { preflight, recognizeMissingText, start } from "../services/analysis.ts";
import { MAX_CAPTURES, removeCapture, resetDraft, useDraft } from "../services/draft.ts";
import { openSession } from "../services/nav.ts";
import { addImages, createSession } from "../services/sessions.ts";
import { isServerConfigured, updateSettings, useSettings } from "../services/settings.ts";
import { categoryInfo } from "../ui/categories.ts";
import { Button, Card, Caption, InfoRow } from "../ui/components.tsx";
import { ConsentModal } from "../ui/ConsentModal.tsx";
import { radius, space, type, useTheme } from "../ui/theme.ts";

export default function Review() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const draft = useDraft();
  const settings = useSettings();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<ProblemCategory | null>(draft.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askConsent, setAskConsent] = useState(false);

  const adding = Boolean(draft.targetSessionId);
  const server = isServerConfigured(settings);
  const canSubmit = !saving && (draft.captures.length > 0 || text.trim().length > 0);

  function finish(sessionId: string) {
    resetDraft();
    router.back();
    router.navigate("/");
    openSession(sessionId);
  }

  async function save(analyze: boolean) {
    setSaving(true);
    setError(null);
    try {
      if (draft.targetSessionId) {
        await addImages(draft.targetSessionId, draft.captures, text);
        recognizeMissingText(draft.targetSessionId);
        finish(draft.targetSessionId);
        return;
      }
      const session = await createSession(draft.captures, text, category);
      if (analyze && preflight(session, "initial") === "ready") start(session.id, "initial");
      else recognizeMissingText(session.id);
      finish(session.id);
    } catch (e) {
      setError(t("The image could not be saved.") + ` (${String((e as Error).message ?? e)})`);
      setSaving(false);
    }
  }

  function submit() {
    if (!adding && server && !settings.consent) setAskConsent(true);
    else save(true);
  }

  const primary = adding ? t("Add observation") : server ? t("Analyze") : t("Save");

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.l, gap: space.l }} keyboardShouldPersistTaps="handled">
        {draft.captures.length > 0 && (
          <View style={{ gap: space.s }}>
            <Caption>{t("%lld of %lld photos", draft.captures.length, MAX_CAPTURES)}</Caption>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }}>
              {draft.captures.map((cap) => (
                <View key={cap.id}>
                  <Image source={{ uri: cap.uri }} style={styles.photo} contentFit="cover" />
                  <Pressable style={styles.remove} onPress={() => removeCapture(cap.id)} accessibilityLabel={t("Remove photo")} hitSlop={8}>
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ gap: space.s }}>
          <Text style={[type.headline, { color: c.text }]}>{adding ? t("New observation") : t("Description")}</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={adding ? t("What changed? (optional)") : t("What's wrong? What did you already try?")}
            placeholderTextColor={c.secondary}
            multiline
            autoFocus={draft.describeOnly}
            style={[styles.input, { backgroundColor: c.surface, color: c.text, borderColor: c.hairline }]}
          />
          {draft.captures.length === 0 && <Caption>{t("Without a photo, Fixify works from your description only.")}</Caption>}
        </View>

        {!adding && (
          <View style={{ gap: space.s }}>
            <Text style={[type.headline, { color: c.text }]}>{t("Topic")}</Text>
            <View style={styles.chips}>
              {[null, ...CATEGORIES].map((cat) => {
                const selected = category === cat;
                return (
                  <Pressable
                    key={cat ?? "auto"}
                    onPress={() => setCategory(cat)}
                    style={[styles.chip, { backgroundColor: selected ? c.accent : c.surface, borderColor: c.hairline }]}
                    aria-selected={selected}
                  >
                    {cat && <Ionicons name={categoryInfo[cat].icon} size={14} color={selected ? "#fff" : c.accent} />}
                    <Text style={{ color: selected ? "#fff" : c.text, fontSize: 14 }}>{cat ? categoryInfo[cat].title() : t("Let Fixify decide")}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Card>
          {server ? (
            <InfoRow
              icon="lock-closed-outline"
              title={t("Nothing is sent before you tap Analyze.")}
              detail={t("Then the photos (reduced in size) and your description are sent for text recognition and AI analysis.")}
            />
          ) : (
            <InfoRow
              icon="phone-portrait-outline"
              title={t("Saved on this iPhone only.")}
              detail={t("No AI service is active, so there is no text recognition or analysis yet. You can analyze the session later.")}
            />
          )}
        </Card>

        {error && <Caption color={c.danger}>{error}</Caption>}
      </ScrollView>

      <View style={{ padding: space.l, paddingBottom: insets.bottom + space.s }}>
        <Button title={saving ? t("Saving photos") : primary} onPress={submit} disabled={!canSubmit} loading={saving} />
      </View>

      <ConsentModal
        visible={askConsent}
        onDecision={(allowed) => {
          setAskConsent(false);
          updateSettings({ consent: allowed });
          save(allowed);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  photo: { width: 110, height: 150, borderRadius: 14 },
  remove: { position: "absolute", top: 6, right: 6 },
  input: { minHeight: 110, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, padding: space.m, fontSize: 17, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.s },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
});
