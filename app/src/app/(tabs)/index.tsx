import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { openSession, startScan } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { isServerConfigured, useSettings } from "../../services/settings.ts";
import { useQuota } from "../../services/usage.ts";
import { Caption, Divider, GlassCard } from "../../ui/components.tsx";
import { Glass } from "../../ui/Glass.tsx";
import { GradientText, PressScale, Rise } from "../../ui/motion.tsx";
import { RainbowBorder } from "../../ui/RainbowBorder";
import { Screen } from "../../ui/Screen.tsx";
import { SessionRow } from "../../ui/SessionRow.tsx";
import { font, radius, space, type, useTheme } from "../../ui/theme.ts";

function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? t("Good morning") : h >= 12 && h < 18 ? t("Good afternoon") : t("Good evening");
}

export default function Home() {
  useArea("home");
  const { c, dark } = useTheme();
  const sessions = useSessions();
  const settings = useSettings();
  const quota = useQuota();
  const solved = sessions.filter((s) => s.status === "solved").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  return (
    <Screen contentStyle={{ gap: space.xxl + space.s }}>
      <Rise index={0} style={styles.topRow}>
        <Text style={[styles.wordmark, { color: c.text }]}>Fixify</Text>
        {quota.uploadsLeft !== null && quota.uploadsDaily ? (
          <View
            style={[styles.quota, { borderColor: c.hairline }]}
            accessible
            accessibilityLabel={t("%lld of %lld photo uploads left today", quota.uploadsLeft, quota.uploadsDaily)}
          >
            <Ionicons name="image-outline" size={13} color={quota.uploadsLeft > 0 ? c.secondary : c.caution} />
            <Text style={{ color: quota.uploadsLeft > 0 ? c.secondary : c.caution, fontSize: 13, fontFamily: font.medium }}>
              {quota.uploadsLeft}/{quota.uploadsDaily}
            </Text>
          </View>
        ) : null}
      </Rise>

      <Rise index={1} style={{ gap: space.m, marginTop: space.xl }}>
        <Text style={[type.eyebrow, { color: c.secondary }]}>{greeting()}</Text>
        <GradientText colors={dark ? ["#FFFFFF", "#DCE8FF", "#8DB8FF"] : ["#070B14", "#16357F", "#1E5BFF"]} style={type.hero}>
          {t("What are we fixing today?")}
        </GradientText>
      </Rise>

      <Rise index={2} style={{ gap: space.l }}>
        {/* Live Fix: the one primary action, a clean glass card with a faint blue light from below. */}
        <GlassCard style={styles.hero}>
          <LinearGradient pointerEvents="none" colors={["#1E5BFF00", "#1E5BFF26"]} start={{ x: 0, y: 0.2 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ gap: space.m }}>
            <Text style={[type.eyebrow, { color: c.accent, fontSize: 13, letterSpacing: 1.2 }]}>LIVE FIX</Text>
            <Text style={[type.title, { color: c.text }]}>{t("Show it. Fix it.")}</Text>
            <Text style={[type.body, { color: c.secondary, fontSize: 15, lineHeight: 22 }]}>
              {t("Show the problem. Fixify marks what matters and guides you step by step until you have checked that it works.")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: space.s }}>
            <PressScale style={{ flex: 1 }} haptic="medium" onPress={() => startScan()}>
              <RainbowBorder radius={26} intensity={0.7}>
                <View style={[styles.primary, { backgroundColor: c.text }]}>
                  <Ionicons name="scan-outline" size={18} color={c.background} />
                  <Text style={[type.headline, { color: c.background }]}>{t("Open camera")}</Text>
                </View>
              </RainbowBorder>
            </PressScale>
            <PressScale onPress={() => startScan({ library: true })} accessibilityHint={t("Pick a photo or screenshot of the problem")}>
              <Glass style={styles.secondary}>
                <Ionicons name="images-outline" size={18} color={c.text} />
              </Glass>
            </PressScale>
          </View>
        </GlassCard>

        <PressScale onPress={() => router.navigate("/fixvoice")}>
          <Glass interactive style={styles.row}>
            <View style={[styles.rowIcon, { borderColor: c.hairline }]}>
              <Ionicons name="mic-outline" size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headline, { color: c.text }]}>{t("Talk to FixVoice")}</Text>
              <Caption style={{ fontSize: 13 }}>{t("Hands-free, by voice")}</Caption>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.secondary} />
          </Glass>
        </PressScale>

        {!isServerConfigured(settings) && settings.provider === "proxy" && (
          <PressScale onPress={() => router.navigate("/settings")}>
            <Glass interactive style={styles.row}>
              <Ionicons name="server-outline" size={20} color={c.caution} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.headline, { color: c.text }]}>{t("AI analysis is not set up")}</Text>
                <Caption>{t("Choose an AI service in Settings to get a diagnosis and a guided plan.")}</Caption>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.secondary} />
            </Glass>
          </PressScale>
        )}
      </Rise>

      {solved.length > 0 && (
        <View style={{ gap: space.m }}>
          <Label text={t("Recently solved")} />
          <GlassCard style={{ gap: 0, paddingVertical: space.xs, paddingHorizontal: 0 }}>
            {solved.map((s, i) => (
              <View key={s.id} style={{ paddingHorizontal: space.l }}>
                {i > 0 && <Divider />}
                <SessionRow session={s} onPress={() => openSession(s.id)} />
              </View>
            ))}
          </GlassCard>
        </View>
      )}
    </Screen>
  );
}

/** Quiet section label (Neue Montreal), instead of icon headers. */
function Label({ text }: { text: string }) {
  const { c } = useTheme();
  return (
    <Text style={[type.eyebrow, { color: c.secondary, fontSize: 13, letterSpacing: 1, textTransform: "uppercase" }]} accessibilityRole="header">
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { fontFamily: font.accentMedium, fontSize: 20, letterSpacing: -0.2 },
  quota: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  hero: { padding: space.xl, gap: space.xl },
  primary: { flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center", borderRadius: 999, height: 52 },
  secondary: { width: 52, height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    padding: space.l,
    paddingRight: space.xl,
    borderRadius: radius.card,
    borderCurve: "continuous",
  },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  list: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", borderCurve: "continuous" },
  topic: { flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: 16 },
});
