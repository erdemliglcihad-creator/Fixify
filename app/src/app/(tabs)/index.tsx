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
import { Caption, Card, Divider, SectionTitle } from "../../ui/components.tsx";
import { Glass, GlassGroup } from "../../ui/Glass.tsx";
import { GradientText, PressScale, Rise } from "../../ui/motion.tsx";
import { Screen } from "../../ui/Screen.tsx";
import { ActiveCard, SessionRow } from "../../ui/SessionRow.tsx";
import { areaColors, radius, space, type, useTheme } from "../../ui/theme.ts";

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
  const glow = areaColors.home.glow;
  const open = sessions.filter((s) => isOpen(s.status)).sort((a, b) => b.updatedAt - a.updatedAt);
  const solved = sessions.filter((s) => s.status === "solved").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  return (
    <Screen>
      <Rise index={0} style={styles.topRow}>
        <View style={styles.brand}>
          <LinearGradient colors={[glow[2], glow[0], glow[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.brandDot}>
            <Text style={{ fontSize: 16 }}>🛠️</Text>
          </LinearGradient>
          <Text style={[type.headline, { color: c.text }]}>Fixify</Text>
        </View>
        {quota.uploadsLeft !== null && quota.uploadsDaily ? (
          <Glass style={styles.quota}>
            <View accessible accessibilityLabel={t("%lld of %lld photo uploads left today", quota.uploadsLeft, quota.uploadsDaily)} style={styles.quotaInner}>
              <Text style={{ fontSize: 13 }}>📸</Text>
              <Text style={{ color: quota.uploadsLeft > 0 ? c.text : c.caution, fontSize: 13, fontWeight: "700" }}>
                {quota.uploadsLeft}/{quota.uploadsDaily}
              </Text>
            </View>
          </Glass>
        ) : null}
      </Rise>

      <Rise index={1} style={{ gap: space.xs }}>
        <Text style={[type.body, { color: c.secondary, fontSize: 19, fontWeight: "500" }]}>{greeting()} 👋</Text>
        <GradientText colors={dark ? ["#FFFFFF", "#BFD0FF", "#9C86FF"] : ["#10131A", "#2F4FD8", "#6A4DFF"]} style={type.hero}>
          {t("What are we fixing today?")}
        </GradientText>
      </Rise>

      <Rise index={2}>
        <LinearGradient
          colors={[glow[0], "#2533C9", "#3A1C9E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.hero, { boxShadow: `0 18px 48px ${glow[0]}55` }]}
        >
          {/* Soft light spill in the corner, like light catching the card. */}
          <View pointerEvents="none" style={[styles.heroGlow, { backgroundColor: glow[2] }]} />
          <View style={{ flexDirection: "row", gap: space.m, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: space.s }}>
              <View style={styles.liveChip}>
                <View style={styles.liveDot} />
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700", letterSpacing: 0.4 }}>LIVE FIX</Text>
              </View>
              <Text style={[type.title, { color: "#fff", fontSize: 24 }]}>{t("Show it. Fix it.")}</Text>
              <Text style={[type.body, { color: "#FFFFFFD0", fontSize: 15, lineHeight: 21 }]}>
                {t("Show the problem. Fixify marks what matters and guides you step by step until you have checked that it works.")}
              </Text>
            </View>
            <Text style={{ fontSize: 44 }}>🔍</Text>
          </View>
          <GlassGroup style={{ flexDirection: "row", gap: space.m }}>
            <PressScale style={{ flex: 1 }} haptic="medium" onPress={() => startScan()}>
              <Glass interactive tint="#FFFFFFF0" style={styles.heroButton}>
                <Ionicons name="camera" size={18} color={c.hero} />
                <Text style={[type.headline, { color: c.hero }]}>{t("Open camera")}</Text>
              </Glass>
            </PressScale>
            <PressScale onPress={() => startScan({ library: true })} accessibilityHint={t("Pick a photo or screenshot of the problem")}>
              <Glass interactive variant="clear" tint="#FFFFFF2E" style={[styles.heroButton, { paddingHorizontal: space.l }]}>
                <Ionicons name="images-outline" size={18} color="#fff" />
                <Text style={[type.headline, { color: "#fff" }]}>{t("Photos")}</Text>
              </Glass>
            </PressScale>
          </GlassGroup>
        </LinearGradient>
      </Rise>

      <Rise index={3} style={{ flexDirection: "row", gap: space.m }}>
        <QuickCard emoji="🤖" title={t("Ask FixBot")} detail={t("Type or send a photo")} colors={["#6A4DFF", "#2453FF"]} onPress={() => router.navigate("/fixbot")} />
        <QuickCard emoji="🎙️" title={t("Talk to FixBot")} detail={t("Hands-free, by voice")} colors={["#C04DFF", "#6A4DFF"]} onPress={() => router.push("/voice")} />
      </Rise>

      {!isServerConfigured(settings) && settings.provider === "proxy" && (
        <PressScale onPress={() => router.navigate("/settings")}>
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 24 }}>🔌</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headline, { color: c.text }]}>{t("AI analysis is not set up")}</Text>
              <Caption>{t("Choose an AI service in Settings to get a diagnosis and a guided plan.")}</Caption>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.secondary} />
          </Card>
        </PressScale>
      )}

      {open.length > 0 && (
        <Rise index={4} style={{ gap: space.m }}>
          <SectionTitle title={t("In progress")} icon="build-outline" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }} style={{ overflow: "visible" }}>
            {open.slice(0, 8).map((s) => (
              <ActiveCard key={s.id} session={s} onPress={() => openSession(s.id)} />
            ))}
          </ScrollView>
        </Rise>
      )}

      <View style={{ gap: space.m }}>
        <Rise index={5}>
          <SectionTitle title={t("Start with a topic")} icon="grid-outline" />
        </Rise>
        <View style={styles.grid}>
          {suggestedCategories.map((cat, i) => (
            <Rise key={cat} index={6 + i} style={styles.tileWrap}>
              <PressScale onPress={() => startScan({ category: cat })} style={[styles.tile, { backgroundColor: c.surface, borderColor: c.hairline }]}>
                <View style={[styles.tileEmoji, { backgroundColor: c.raised }]}>
                  <Text style={{ fontSize: 22 }}>{categoryInfo[cat].emoji}</Text>
                </View>
                <Text style={{ color: c.text, fontSize: 15, fontWeight: "600", letterSpacing: -0.2 }} numberOfLines={2}>
                  {categoryInfo[cat].title()}
                </Text>
              </PressScale>
            </Rise>
          ))}
        </View>
      </View>

      {solved.length > 0 && (
        <View style={{ gap: space.m }}>
          <SectionTitle title={t("Recently solved")} icon="checkmark-done-outline" />
          <Card style={{ gap: 0, paddingVertical: space.s }}>
            {solved.map((s, i) => (
              <View key={s.id}>
                {i > 0 && <Divider />}
                <SessionRow session={s} onPress={() => openSession(s.id)} />
              </View>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

function QuickCard({ emoji, title, detail, colors, onPress }: { emoji: string; title: string; detail: string; colors: [string, string]; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressScale onPress={onPress} style={{ flex: 1 }}>
      <View style={[styles.quick, { backgroundColor: c.surface, borderColor: c.hairline }]}>
        <LinearGradient colors={[colors[0] + "55", colors[1] + "00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={{ fontSize: 28 }}>{emoji}</Text>
        <View style={{ gap: 2 }}>
          <Text style={[type.headline, { color: c.text }]}>{title}</Text>
          <Caption style={{ fontSize: 13 }}>{detail}</Caption>
        </View>
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.xs },
  brand: { flexDirection: "row", alignItems: "center", gap: space.s },
  brandDot: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
  quota: { borderRadius: 16 },
  quotaInner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7 },
  hero: { borderRadius: radius.card, padding: space.l, paddingTop: space.xl, gap: space.l, borderCurve: "continuous", overflow: "hidden" },
  heroGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, top: -110, right: -60, opacity: 0.45, filter: [{ blur: 40 }] },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#FFFFFF24", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#7CFFB2" },
  heroButton: { flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center", borderRadius: radius.control, paddingVertical: 14 },
  quick: {
    borderRadius: 24,
    padding: space.l,
    gap: space.m,
    minHeight: 132,
    justifyContent: "space-between",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderCurve: "continuous",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.m },
  tileWrap: { flexBasis: "47%", flexGrow: 1 },
  tile: { gap: space.m, padding: space.m, paddingVertical: space.l, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, minHeight: 112, borderCurve: "continuous" },
  tileEmoji: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderCurve: "continuous" },
});
