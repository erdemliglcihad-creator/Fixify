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
import { serverBase, updateSettings, useSettings, type Appearance, type Provider } from "../../services/settings.ts";
import { analysesLeft, limits, useUsage } from "../../services/usage.ts";
import { isOpen } from "../../core/session.ts";
import { Caption, Divider } from "../../ui/components.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import type { IconName } from "../../ui/categories.ts";
import { radius, space, type, useTheme } from "../../ui/theme.ts";

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
          <Text style={{ color: c.text, fontSize: 14, fontWeight: value === v ? "600" : "400" }}>{label}</Text>
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
      <Caption style={{ textTransform: "uppercase", fontWeight: "600", marginLeft: space.s }}>{title}</Caption>
      <View style={[styles.group, { backgroundColor: c.surface }]}>{children}</View>
      {footer ? <Caption style={{ marginHorizontal: space.s }}>{footer}</Caption> : null}
    </View>
  );
}

export default function Settings() {
  const { c } = useTheme();
  const s = useSettings();
  const usage = useUsage();
  const sessions = useSessions();
  const [connection, setConnection] = useState<Connection>({ state: "idle" });
  const [bytes, setBytes] = useState(() => storageBytes());

  async function test() {
    const base = serverBase(s);
    if (!base) return;
    setConnection({ state: "checking" });
    try {
      const h = await checkServer(base, s.appToken.trim());
      setConnection({ state: "ok", configured: h.configured, ocr: h.ocr });
    } catch (e) {
      setConnection({ state: "failed", message: e instanceof ProxyError ? e.message : t("Not reachable") });
    }
  }

  const input = [styles.input, { color: c.text, backgroundColor: c.background, borderColor: c.hairline }];

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.l, gap: space.xl }} keyboardShouldPersistTaps="handled">
      <Section title={t("Appearance")}>
        <Segmented<Appearance>
          value={s.appearance}
          options={[["system", t("System")], ["light", t("Light")], ["dark", t("Dark")]]}
          onChange={(appearance) => updateSettings({ appearance })}
        />
      </Section>

      <Section
        title={t("AI analysis")}
        footer={
          s.provider === "proxy"
            ? t("Your Fixify server holds the Claude API key, so no key is stored in the app. Start it on your computer and copy the address and token it shows.")
            : t("Fixify only saves photos and your notes. No text recognition, diagnosis or plan.")
        }
      >
        <Segmented<Provider>
          value={s.provider}
          options={[["proxy", t("Fixify server (Claude)")], ["off", t("Off")]]}
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
            <Pressable onPress={test} disabled={!serverBase(s) || !s.appToken.trim()} style={styles.row} accessibilityRole="button">
              <Text style={[type.body, { color: c.accent, flex: 1, opacity: serverBase(s) && s.appToken.trim() ? 1 : 0.4 }]}>{t("Test connection")}</Text>
              {connection.state === "checking" && <ActivityIndicator />}
              {connection.state === "ok" && (
                <Text style={{ color: connection.configured ? c.success : c.caution, fontSize: 14, fontWeight: "600" }}>
                  {connection.configured ? t("Connected") : t("Server has no API key")}
                </Text>
              )}
            </Pressable>
            {connection.state === "failed" && <Caption color={c.danger}>{connection.message}</Caption>}
            {connection.state === "ok" && !connection.ocr && <Caption color={c.caution}>{t("This server version has no text recognition. Update the server folder.")}</Caption>}
            <Divider />
            <Row>
              <Label>{t("Analyses left this month")}</Label>
              <Caption>{`${analysesLeft(usage)} / ${limits.analysesPerMonth}`}</Caption>
            </Row>
          </>
        )}
      </Section>

      <Section title={t("Privacy")} footer={t("When off, nothing leaves this iPhone, and Fixify asks before the next analysis.")}>
        <Row>
          <Label>{t("Allow sending to my Fixify server")}</Label>
          <Switch value={s.consent} onValueChange={(consent) => updateSettings({ consent })} />
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
            value={s.reminders}
            onValueChange={(reminders) => {
              updateSettings({ reminders });
              if (!reminders) cancelAllReminders();
            }}
          />
        </Row>
      </Section>

      <Section title="Fixify Pro">
        <Link icon="sparkles-outline" title={t("See Fixify Pro")} onPress={() => router.push({ pathname: "/paywall", params: { reason: "browse" } })} />
      </Section>

      <Section title={t("Help & feedback")}>
        <Link icon="help-circle-outline" title={t("How Fixify works")} onPress={() => router.push("/help")} />
        <Link icon="server-outline" title={t("Set up the Fixify server")} onPress={() => router.push("/server-help")} />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: radius.card, padding: space.l, gap: space.m },
  row: { flexDirection: "row", alignItems: "center", gap: space.m, minHeight: 32 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 2 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: space.m, paddingVertical: 11, fontSize: 16 },
});
