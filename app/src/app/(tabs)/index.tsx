import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isOpen } from "../../core/session.ts";
import { t } from "../../i18n/index.ts";
import { openSession, startScan } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { isServerConfigured, useSettings } from "../../services/settings.ts";
import { categoryInfo, suggestedCategories } from "../../ui/categories.ts";
import { Caption, Card, Divider, SectionTitle } from "../../ui/components.tsx";
import { ActiveCard, SessionRow } from "../../ui/SessionRow.tsx";
import { radius, space, type, useTheme } from "../../ui/theme.ts";

function greeting() {
  const h = new Date().getHours();
  return h >= 5 && h < 12 ? t("Good morning") : h >= 12 && h < 18 ? t("Good afternoon") : t("Good evening");
}

export default function Home() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const sessions = useSessions();
  const settings = useSettings();
  const open = sessions.filter((s) => isOpen(s.status)).sort((a, b) => b.updatedAt - a.updatedAt);
  const solved = sessions.filter((s) => s.status === "solved").sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl }]}>
      <View style={{ gap: space.xs }}>
        <Text style={[type.display, { color: c.text }]}>{greeting()}</Text>
        <Text style={[type.body, { color: c.secondary, fontSize: 20 }]}>{t("What needs fixing?")}</Text>
      </View>

      <View style={[styles.hero, { backgroundColor: c.hero }]}>
        <View style={{ flexDirection: "row", gap: space.m }}>
          <View style={{ flex: 1, gap: space.s }}>
            <Text style={[type.title, { color: "#fff" }]}>Live Fix</Text>
            <Text style={[type.body, { color: "#FFFFFFD0" }]}>
              {t("Show the problem. Fixify marks what matters and guides you step by step until you have checked that it works.")}
            </Text>
          </View>
          <Ionicons name="scan-outline" size={34} color="#FFFFFFE6" />
        </View>
        <View style={{ flexDirection: "row", gap: space.m }}>
          <Pressable style={({ pressed }) => [styles.heroPrimary, { opacity: pressed ? 0.8 : 1 }]} onPress={() => startScan()} accessibilityRole="button">
            <Ionicons name="camera" size={18} color={c.hero} />
            <Text style={[type.headline, { color: c.hero }]}>{t("Open camera")}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.heroSecondary, { opacity: pressed ? 0.8 : 1 }]}
            onPress={() => startScan({ library: true })}
            accessibilityRole="button"
            accessibilityHint={t("Pick a photo or screenshot of the problem")}
          >
            <Ionicons name="images-outline" size={18} color="#fff" />
            <Text style={[type.headline, { color: "#fff" }]}>{t("Photos")}</Text>
          </Pressable>
        </View>
      </View>

      {!isServerConfigured(settings) && settings.provider === "proxy" && (
        <Pressable onPress={() => router.navigate("/settings")} accessibilityRole="button">
          <Card style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="server-outline" size={26} color={c.caution} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headline, { color: c.text }]}>{t("AI analysis is not set up")}</Text>
              <Caption>{t("Connect your Fixify server in Settings. It recognizes text and creates the analysis.")}</Caption>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.l, paddingBottom: space.xxl, gap: space.xl },
  hero: { borderRadius: 28, padding: space.xl, gap: space.l, borderCurve: "continuous" },
  heroPrimary: { flex: 1, flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderRadius: radius.control, paddingVertical: 13 },
  heroSecondary: { flexDirection: "row", gap: space.s, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF26", borderRadius: radius.control, paddingVertical: 13, paddingHorizontal: space.l },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.m },
  tile: { flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: space.s, padding: space.m, minHeight: 56, borderRadius: radius.control },
});
