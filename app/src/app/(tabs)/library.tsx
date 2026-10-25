import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { currentAnalysis, searchText } from "../../core/session.ts";
import { CATEGORIES, type ProblemCategory } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { openSession } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { categoryInfo } from "../../ui/categories.ts";
import { Caption, Card, Chip, Divider, StatusBadge } from "../../ui/components.tsx";
import { SessionRow } from "../../ui/SessionRow.tsx";
import { radius, space, type, useTheme } from "../../ui/theme.ts";

type Scope = "sessions" | "photos" | "guides";

export default function Library() {
  const { c } = useTheme();
  const sessions = [...useSessions()].sort((a, b) => b.updatedAt - a.updatedAt);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("sessions");
  const [category, setCategory] = useState<ProblemCategory | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = sessions.filter((s) => (!category || s.category === category) && (!q || searchText(s).includes(q)));
  const photos = filtered.flatMap((s) => s.images.map((img) => ({ img, session: s })));
  const guides = filtered.filter((s) => (currentAnalysis(s)?.steps.length ?? 0) > 0);

  if (!sessions.length) {
    return (
      <View style={[styles.empty, { backgroundColor: c.background }]}>
        <Ionicons name="library-outline" size={44} color={c.secondary} />
        <Text style={[type.title, { color: c.text }]}>{t("Your library is empty")}</Text>
        <Caption style={{ textAlign: "center" }}>{t("Photos, analyses and guides from your sessions are collected here.")}</Caption>
      </View>
    );
  }

  const noResults = <Caption style={{ textAlign: "center", marginTop: space.xl }}>{t("No results for \"%@\"", query)}</Caption>;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.l, gap: space.l }} keyboardShouldPersistTaps="handled">
      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.hairline }]}>
        <Ionicons name="search" size={18} color={c.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("Search problems, steps and recognized text")}
          placeholderTextColor={c.secondary}
          style={{ flex: 1, color: c.text, fontSize: 16 }}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      <View style={[styles.segment, { backgroundColor: c.hairline }]}>
        {(["sessions", "photos", "guides"] as const).map((s) => (
          <Pressable key={s} onPress={() => setScope(s)} style={[styles.segmentItem, scope === s && { backgroundColor: c.surface }]} aria-selected={scope === s}>
            <Text style={{ color: c.text, fontWeight: scope === s ? "600" : "400", fontSize: 14 }}>
              {s === "sessions" ? t("Sessions") : s === "photos" ? t("Photos") : t("Guides")}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s }}>
        {[null, ...CATEGORIES].map((cat) => (
          <Pressable
            key={cat ?? "all"}
            onPress={() => setCategory(cat)}
            style={[styles.filter, { backgroundColor: category === cat ? c.accent : c.surface, borderColor: c.hairline }]}
          >
            <Text style={{ color: category === cat ? "#fff" : c.text, fontSize: 13 }}>{cat ? categoryInfo[cat].title() : t("All topics")}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {scope === "sessions" &&
        (filtered.length ? (
          <Card style={{ gap: 0, paddingVertical: space.s }}>
            {filtered.map((s, i) => (
              <View key={s.id}>
                {i > 0 && <Divider />}
                <SessionRow session={s} onPress={() => openSession(s.id)} />
              </View>
            ))}
          </Card>
        ) : (
          noResults
        ))}

      {scope === "photos" &&
        (photos.length ? (
          <View style={styles.grid}>
            {photos.map(({ img, session }) => (
              <Pressable key={img.id} onPress={() => openSession(session.id)} style={styles.cell} accessibilityLabel={currentAnalysis(session)?.title ?? session.title}>
                <Image source={{ uri: img.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                {img.blocks?.length ? (
                  <View style={styles.badge}>
                    <Ionicons name="text" size={11} color="#fff" />
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          noResults
        ))}

      {scope === "guides" &&
        (guides.length
          ? guides.map((s) => {
              const a = currentAnalysis(s)!;
              return (
                <Pressable key={s.id} onPress={() => openSession(s.id)}>
                  <Card>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Chip text={categoryInfo[a.category].title()} icon={categoryInfo[a.category].icon} />
                      <StatusBadge status={s.status} />
                    </View>
                    <Text style={[type.headline, { color: c.text }]}>{a.title}</Text>
                    <Caption>{a.steps.slice(0, 3).map((st, i) => `${i + 1}. ${st.title}`).join("\n")}</Caption>
                    {a.steps.length > 3 && <Caption>{t("+ %lld more steps", a.steps.length - 3)}</Caption>}
                  </Card>
                </Pressable>
              );
            })
          : noResults)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.l },
  search: { flexDirection: "row", alignItems: "center", gap: space.s, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.m, paddingVertical: 10 },
  segment: { flexDirection: "row", borderRadius: 10, padding: 2 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 8 },
  filter: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: { width: "32.6%", aspectRatio: 1, borderRadius: 8, overflow: "hidden" },
  badge: { position: "absolute", left: 4, bottom: 4, backgroundColor: "#00000088", borderRadius: 4, padding: 3 },
});
