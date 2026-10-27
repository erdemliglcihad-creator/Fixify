import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { t } from "../../i18n/index.ts";
import { storageBytes } from "../../services/images.ts";
import { checkServer, ProxyError } from "../../services/proxy.ts";
import { cancelAllReminders } from "../../services/reminders.ts";
import { deleteEverything, deletePhotos, useSessions } from "../../services/sessions.ts";
import { CLOUD_URL, isServerConfigured, serverBase, updateSettings, useSettings, type Appearance, type Provider, type VoiceGender } from "../../services/settings.ts";
import { useQuota } from "../../services/usage.ts";
import { isOpen } from "../../core/session.ts";
import { Caption, Divider } from "../../ui/components.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import type { IconName } from "../../ui/categories.ts";
import { radius, space, type, useTheme, font } from "../../ui/theme.ts";
import { Screen } from "../../ui/Screen.tsx";
import { useArea } from "../../services/area.ts";

type Connection = { state: "idle" } | { state: "checking" } | { state: "ok"; configured: boolean; ocr: boolean } | { state: "failed"; message: string };

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Label({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[type.body, { color: c.text, flex: 1 }]}>{children}</Text>;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const { c } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: c.hairline }]}>
      {options.map(([v, label]) => (
        <Pressable key={v} onPress={() => onChange(v)} style={[styles.segmentItem, value === v && { backgroundColor: c.surface }]} aria-selected={value === v}>
          <Text style={{ color: c.text, fontSize: 14, fontFamily: value === v ? font.semibold : font.regular }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Link({ icon, title, onPress, danger }: { icon: IconName; title: string; onPress: () => void; danger?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={danger ? c.danger : c.accent} />
      <Text style={[type.body, { color: danger ? c.danger : c.text, flex: 1 }]}>{title}</Text>
      {!danger && <Ionicons name="chevron-forward" size={16} color={c.secondary} />}
    </Pressable>
  );
}

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <Caption style={{ textTransform: "uppercase", fontFamily: font.semibold, marginLeft: space.s }}>{title}</Caption>
      <View style={[styles.group, { backgroundColor: c.surface }]}>{children}</View>
      {footer ? <Caption style={{ marginHorizontal: space.s }}>{footer}</Caption> : null}
    </View>
  );
}

function providerFooter(p: Provider) {
  if (p === "cloud") return t("Free for everyone, no setup. Photos and text go to Fixify Cloud, which uses Groq (AI) and OCR.space (text recognition). 10 photo uploads per day; messages to FixVoice are free within fair use.");
  if (p === "proxy") return t("For your own Fixify server (server/ folder), e.g. with Claude. Enter the address and token it shows.");
  return t("Fixify only saves photos and your notes. No text recognition, diagnosis or plan.");
}

export default function Settings() {
  useArea("settings");
  const { c } = useTheme();
  const s = useSettings();
  const quota = useQuota();
  const sessions = useSessions();
  const [connection, setConnection] = useState<Connection>({ state: "idle" });
  const [bytes, setBytes] = useState(() => storageBytes());

  async function test() {
    const base = serverBase(s);
    if (!base) return;
    setConnection({ state: "checking" });
    try {
      const h = await checkServer(base, s.provider === "proxy" ? s.appToken.trim() : "");
      setConnection({ state: "ok", configured: h.configured, ocr: h.ocr });
    } catch (e) {
      setConnection({ state: "failed", message: e instanceof ProxyError ? e.message : t("Not reachable") });
    }
  }

  const input = [styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.hairline }];

  return (
    <Screen title={t("Settings")}>
      <Section title={t("Appearance")}>
        <Segmented<Appearance>
          value={s.appearance}
          options={[["system", t("System")], ["light", t("Light")], ["dark", t("Dark")]]}
          onChange={(appearance) => updateSettings({ appearance })}
        />
      </Section>

      <Section title="FixVoice" footer={t("German or English follows the app language. Uses the iPhone's built-in voices for now.")}>
        <Segmented<VoiceGender>
          value={s.voice}
          options={[["female", t("Female voice")], ["male", t("Male voice")]]}
          onChange={(voice) => updateSettings({ voice })}
        />
      </Section>

      <Section title={t("AI analysis")} footer={providerFooter(s.provider)}>
        <Segmented<Provider>
          value={s.provider}
          options={[["cloud", t("Fixify Cloud")], ["proxy", t("Own server")], ["off", t("Off")]]}
          onChange={(provider) => {
            updateSettings({ provider });
            setConnection({ state: "idle" });
          }}
        />
        {s.provider === "proxy" && (
          <>
            <TextInput
              value={s.serverURL}
              onChangeText={(serverURL) => {
                updateSettings({ serverURL });
                setConnection({ state: "idle" });
              }}
              placeholder={t("Server address, e.g. 192.168.1.20:8787")}
              placeholderTextColor={c.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={input}
            />
            <TextInput
              value={s.appToken}
              onChangeText={(appToken) => {
                updateSettings({ appToken });
                setConnection({ state: "idle" });
              }}
              placeholder={t("App token")}
              placeholderTextColor={c.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={input}
            />
          </>
        )}
        {s.provider === "cloud" && !CLOUD_URL && <Caption color={c.caution}>{t("This build has no Fixify Cloud address yet.")}</Caption>}
        {s.provider !== "off" && (
          <>
            <Pressable onPress={test} disabled={!isServerConfigured(s)} style={styles.row} accessibilityRole="button">
              <Text style={[type.body, { color: c.accent, flex: 1, opacity: isServerConfigured(s) ? 1 : 0.4 }]}>{t("Test connection")}</Text>
              {connection.state === "checking" && <ActivityIndicator />}
              {connection.state === "ok" && (
                <Text style={{ color: connection.configured ? c.success : c.caution, fontSize: 14, fontFamily: font.semibold }}>
                  {connection.configured ? t("Connected") : t("AI not set up on the server")}
                </Text>
              )}
            </Pressable>
            {connection.state === "failed" && <Caption color={c.danger}>{connection.message}</Caption>}
            {connection.state === "ok" && !connection.ocr && <Caption color={c.caution}>{t("This server has no text recognition.")}</Caption>}
          </>
        )}
        {s.provider === "cloud" && quota.uploadsLeft !== null && (
          <>
            <Divider />
            <Row>
              <Label>{t("Photo uploads left today")}</Label>
              <Caption>{quota.uploadsDaily ? `${quota.uploadsLeft} / ${quota.uploadsDaily}` : String(quota.uploadsLeft)}</Caption>
            </Row>
          </>
        )}
      </Section>

      <Section title={t("Privacy")} footer={t("When off, nothing leaves this iPhone, and Fixify asks before the next analysis.")}>
        <Row>
          <Label>{t("Allow sending photos for analysis")}</Label>
          <Switch value={s.consent} onValueChange={(consent) => updateSettings({ consent })} trackColor={{ true: c.success }} thumbColor="#FFFFFF" />
        </Row>
        <Divider />
        <Link icon="shield-checkmark-outline" title={t("What Fixify processes")} onPress={() => router.push("/privacy")} />
      </Section>

      <Section title={t("Storage")} footer={Platform.OS === "web" ? t("In the web preview, photos are kept in the browser.") : t("Photos are stored once even if used in several sessions.")}>
        <Row>
          <Label>{t("Sessions")}</Label>
          <Caption>{String(sessions.length)}</Caption>
        </Row>
        <Row>
          <Label>{t("Photos")}</Label>
          <Caption>{`${(bytes / 1_000_000).toFixed(1)} MB`}</Caption>
        </Row>
        <Divider />
        <Text style={[type.body, { color: c.text }]}>{t("Delete photos of solved sessions")}</Text>
        <Segmented<string>
          value={String(s.autoDeleteDays)}
          options={[["0", t("Never")], ["7", "7 d"], ["30", "30 d"], ["90", "90 d"]]}
          onChange={(v) => updateSettings({ autoDeleteDays: Number(v) })}
        />
        <Divider />
        <Link
          icon="images-outline"
          title={t("Delete photos of completed sessions now")}
          onPress={() => {
            sessions.filter((x) => !isOpen(x.status) && x.images.length).forEach((x) => deletePhotos(x.id));
            setBytes(storageBytes());
          }}
        />
        <Link
          icon="trash-outline"
          danger
          title={t("Delete all Fixify data")}
          onPress={() =>
            confirmDestructive(t("Delete all Fixify data?"), t("All sessions, photos, analyses and history are removed from this iPhone. Your settings stay."), t("Delete everything"), async () => {
              await deleteEverything();
              cancelAllReminders();
              setBytes(storageBytes());
            })
          }
        />
      </Section>

      <Section title={t("Notifications")} footer={t("Only when you ask for a reminder in a session. Fixify sends no other notifications.")}>
        <Row>
          <Label>{t("Reminders for open sessions")}</Label>
          <Switch
            trackColor={{ true: c.success }}
            thumbColor="#FFFFFF"
            value={s.reminders}
            onValueChange={(reminders) => {
              updateSettings({ reminders });
              if (!reminders) cancelAllReminders();
            }}
          />
        </Row>
      </Section>

      <Section title={t("Help & feedback")}>
        <Link icon="help-circle-outline" title={t("How Fixify works")} onPress={() => router.push("/help")} />
        <Link icon="server-outline" title={t("Use your own server")} onPress={() => router.push("/server-help")} />
        <Link
          icon="mail-outline"
          title={t("Send feedback")}
          onPress={() => Share.share({ message: t("Fixify feedback (version %@, iOS %@)\n\nWhat happened:\n\nWhat I expected:\n", Constants.expoConfig?.version ?? "", String(Platform.Version)) })}
        />
        <Row>
          <Label>{t("Version")}</Label>
          <Caption>{`${Constants.expoConfig?.version ?? "–"} · Expo Go`}</Caption>
        </Row>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, padding: space.l, gap: space.m },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 32 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 2 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: space.m, paddingVertical: 11, fontSize: 16 },
});
