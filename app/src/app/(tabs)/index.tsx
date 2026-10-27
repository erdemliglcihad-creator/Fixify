import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { isOpen } from "../../core/session.ts";
import { t } from "../../i18n/index.ts";
import { openSession, startScan } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { isServerConfigured, useSettings } from "../../services/settings.ts";
import { categoryInfo, suggestedCategories } from "../../ui/categories.ts";
import { Caption, Card, Divider, SectionTitle } from "../../ui/components.tsx";
import { ActiveCard, SessionRow } from "../../ui/SessionRow.tsx";
import { radius, space, type, useTheme } from "../../ui/theme.ts";
import { Screen } from "../../ui/Screen.tsx";
import { Glass, GlassGroup } from "../../ui/Glass.tsx";
import { LinearGradient } from "expo-linear-gradient";

function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? t("Good morning") : h >= 12 && h < 18 ? t("Good afternoon") : t("Good evening");
}

export default function Home() {
  const { c } = useTheme();
  const sessions = useSessions();
  const settings = useSettings();
  const open = sessions.filter((s) => isOpen(s.status)).sort((a, b) => b.updatedAt - a.updatedAt);
  const solved = sessions.filter((s) => s.status === "solved").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Text style={[type.display, { color: c.text }]}>{greeting()}</Text>
        <Text style={[type.body, { color: c.secondary, fontSize: 20 }]}>{t("What needs fixing?")}</Text>
      </View>

      <LinearGradient colors={["#2F6BFF", "#1C3FC4", "#25208F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flexDirection: "row", gap: space.m }}>
          <View style={{ flex: 1, gap: space.s }}>
            <Text style={[type.title, { color: "#fff" }]}>Live Fix</Text>
            <Text style={[type.body, { color: "#FFFFFFD9" }]}>
              {t("Show the problem. Fixify marks what matters and guides you step by step until you have checked that it works.")}
            </Text>
          </View>
          <Ionicons name="scan-outline" size={34} color="#FFFFFFE6" />
        </View>
        <GlassGroup style={{ flexDirection: "row", gap: space.m }}>
          <Pressable
            style={({ pressed }) => [{ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            onPress={() => startScan()}
            accessibilityRole="button"
          >
            <Glass interactive tint="#FFFFFFEE" style={styles.heroButton}>
              <Ionicons name="camera" size={18} color={c.hero} />
              <Text style={[type.headline, { color: c.hero }]}>{t("Open camera")}</Text>
            </Glass>
          </Pressable>
          <Pressable
            style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            onPress={() => startScan({ library: true })}
            accessibilityRole="button"
            accessibilityHint={t("Pick a photo or screenshot of the problem")}
          >
            <Glass interactive variant="clear" tint="#FFFFFF2E" style={[styles.heroButton, { paddingHorizontal: space.l }]}>
              <Ionicons name="images-outline" size={18} color="#fff" />
              <Text style={[type.headline, { color: "#fff" }]}>{t("Photos")}</Text>
            </Glass>
          </Pressable>
        </GlassGroup>
      </LinearGradient>

      {!isServerConfigured(settings) && settings.provider === "proxy" && (
        <Pressable onPress={() => router.navigate("/settings")} accessibilityRole="button">
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="server-outline" size={26} color={c.caution} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headline, { color: c.text }]}>{t("AI analysis is not set up")}</Text>
              <Caption>{t("Choose an AI service in Settings to get a diagnosis and a guided plan.")}</Caption>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.secondary} />
          </Card>
        </Pressable>
      )}

      {open.length > 0 && (
        <View style={{ gap: space.m }}>
          <SectionTitle title={t("In progress")} icon="build-outline" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.m }} style={{ overflow: "visible" }}>
            {open.slice(0, 8).map((s) => (
              <ActiveCard key={s.id} session={s} onPress={() => openSession(s.id)} />
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ gap: space.m }}>
        <SectionTitle title={t("Start with a topic")} icon="grid-outline" />
        <View style={styles.grid}>
          {suggestedCategories.map((cat) => (
            <Pressable
              key={cat}
              onPress={() => startScan({ category: cat })}
              style={({ pressed }) => [styles.tile, { backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 }]}
              accessibilityRole="button"
            >
              <Ionicons name={categoryInfo[cat].icon} size={20} color={c.accent} />
              <Text style={{ color: c.text, fontSize: 15, fontWeight: "500", flex: 1 }}>{categoryInfo[cat].title()}</Text>
            </Pressable>
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

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: space.xl, gap: space.l, borderCurve: "continuous", overflow: "hidden", boxShadow: "0 12px 32px rgba(31, 70, 214, 0.28)" },
  heroButton: { flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center", borderRadius: radius.control, paddingVertical: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.m },
  tile: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: space.s, padding: space.m, minHeight: 56, borderRadius: radius.control },
});
