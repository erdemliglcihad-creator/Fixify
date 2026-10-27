import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { isOpen } from "../../core/session.ts";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { openSession, startScan } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { isServerConfigured, useSettings } from "../../services/settings.ts";
import { useQuota } from "../../services/usage.ts";
import { categoryInfo, suggestedCategories } from "../../ui/categories.ts";
import { Caption, Divider } from "../../ui/components.tsx";
import { Glass } from "../../ui/Glass.tsx";
import { GradientText, PressScale, Rise } from "../../ui/motion.tsx";
import { Screen } from "../../ui/Screen.tsx";
import { ActiveCard, SessionRow } from "../../ui/SessionRow.tsx";
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
  const open = sessions.filter((s) => isOpen(s.status)).sort((a, b) => b.updatedAt - a.updatedAt);
  const solved = sessions.filter((s) => s.status === "solved").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  return (
    <Screen contentStyle={{ gap: space.xxl }}>
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

      <Rise index={1} style={{ gap: space.s }}>
        <Text style={[type.eyebrow, { color: c.secondary }]}>{greeting()}</Text>
        <GradientText colors={dark ? ["#FFFFFF", "#DCE8FF", "#8DB8FF"] : ["#070B14", "#16357F", "#1E5BFF"]} style={type.hero}>
          {t("What are we fixing today?")}
        </GradientText>
      </Rise>

      <Rise index={2} style={{ gap: space.m }}>
        {/* Live Fix: the one primary action, a calm dark card lit from below. */}
        <View style={[styles.hero, { backgroundColor: c.surface, borderColor: c.hairline }]}>
          <LinearGradient pointerEvents="none" colors={["#1E5BFF00", "#1E5BFF33"]} start={{ x: 0, y: 0.2 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ gap: space.s }}>
            <Text style={[type.eyebrow, { color: c.accent, fontSize: 13, letterSpacing: 1.2 }]}>LIVE FIX</Text>
            <Text style={[type.title, { color: c.text }]}>{t("Show it. Fix it.")}</Text>
            <Text style={[type.body, { color: c.secondary, fontSize: 15, lineHeight: 22 }]}>
              {t("Show the problem. Fixify marks what matters and guides you step by step until you have checked that it works.")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: space.s }}>
            <PressScale style={{ flex: 1 }} haptic="medium" onPress={() => startScan()}>
              <View style={[styles.primary, { backgroundColor: c.text }]}>
                <Ionicons name="scan-outline" size={18} color={c.background} />
                <Text style={[type.headline, { color: c.background }]}>{t("Open camera")}</Text>
              </View>
            </PressScale>
            <PressScale onPress={() => startScan({ library: true })} accessibilityHint={t("Pick a photo or screenshot of the problem")}>
              <Glass style={styles.secondary}>
                <Ionicons name="images-outline" size={18} color={c.text} />
              </Glass>
            </PressScale>
          </View>
        </View>

        <PressScale onPress={() => router.navigate("/fixvoice")}>
          <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.hairline }]}>
            <View style={[styles.rowIcon, { borderColor: c.hairline }]}>
              <Ionicons name="mic-outline" size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headline, { color: c.text }]}>{t("Talk to FixVoice")}</Text>
              <Caption style={{ fontSize: 13 }}>{t("Hands-free, by voice")}</Caption>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.secondary} />
          </View>
        </PressScale>

        {!isServerConfigured(settings) && settings.provider === "proxy" && (
          <PressScale onPress={() => router.navigate("/settings")}>
            <View style={[styles.row, { backgroundColor: c.surface, borderColor: c.hairline }]}>
              <Ionicons name="server-outline" size={20} color={c.caution} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.headline, { color: c.text }]}>{t("AI analysis is not set up")}</Text>
                <Caption>{t("Choose an AI service in Settings to get a diagnosis and a guided plan.")}</Caption>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.secondary} />
            </View>
          </PressScale>
        )}
      </Rise>

      {open.length > 0 && (
        <Rise index={3} style={{ gap: space.m }}>
          <Label text={t("In progress")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }} style={{ overflow: "visible" }}>
            {open.slice(0, 8).map((s) => (
              <ActiveCard key={s.id} session={s} onPress={() => openSession(s.id)} />
            ))}
          </ScrollView>
        </Rise>
      )}

      <Rise index={4} style={{ gap: space.m }}>
        <Label text={t("Start with a topic")} />
        <View style={[styles.list, { borderColor: c.hairline }]}>
          {suggestedCategories.map((cat, i) => (
            <View key={cat}>
              {i > 0 && <Divider />}
              <PressScale onPress={() => startScan({ category: cat })} scaleTo={0.98} style={styles.topic}>
                <Ionicons name={categoryInfo[cat].icon} size={20} color={c.secondary} />
                <Text style={[type.body, { color: c.text, flex: 1 }]}>{categoryInfo[cat].title()}</Text>
                <Ionicons name="arrow-forward" size={16} color={c.secondary} />
              </PressScale>
            </View>
          ))}
        </View>
      </Rise>

      {solved.length > 0 && (
        <View style={{ gap: space.m }}>
          <Label text={t("Recently solved")} />
          <View style={[styles.list, { borderColor: c.hairline, paddingVertical: space.xs }]}>
            {solved.map((s, i) => (
              <View key={s.id} style={{ paddingHorizontal: space.l }}>
                {i > 0 && <Divider />}
                <SessionRow session={s} onPress={() => openSession(s.id)} />
              </View>
            ))}
          </View>
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
  hero: { borderRadius: radius.card, padding: space.l, gap: space.l, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderCurve: "continuous" },
  primary: { flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center", borderRadius: radius.control, height: 52 },
  secondary: { width: 52, height: 52, borderRadius: radius.control, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.m,
    padding: space.m,
    paddingRight: space.l,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  rowIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  list: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", borderCurve: "continuous" },
  topic: { flexDirection: "row", alignItems: "center", gap: space.m, paddingHorizontal: space.l, paddingVertical: 16 },
});
