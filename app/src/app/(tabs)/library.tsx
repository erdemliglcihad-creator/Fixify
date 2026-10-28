import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { currentAnalysis, searchText } from "../../core/session.ts";
import { CATEGORIES, type FixSession, type ProblemCategory } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { openSession } from "../../services/nav.ts";
import { deleteSession, useSessions } from "../../services/sessions.ts";
import { categoryInfo } from "../../ui/categories.ts";
import { Caption, Chip, Divider, GlassCard, Segmented, StatusBadge } from "../../ui/components.tsx";
import { Glass, GlassGroup } from "../../ui/Glass.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import { SessionRow } from "../../ui/SessionRow.tsx";
import { radius, space, type, useTheme, font } from "../../ui/theme.ts";
import { Screen } from "../../ui/Screen.tsx";
import { useArea } from "../../services/area.ts";

type Scope = "sessions" | "photos" | "guides";

/** Long press on a session: delete it after a confirmation (same wording as on the session screen). */
function askDelete(session: FixSession) {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  confirmDestructive(
    t("Delete this session?"),
    t("The analysis, steps, history and photos of this session are removed from this iPhone."),
    t("Delete session and photos"),
    () => deleteSession(session.id),
  );
}

export default function Library() {
  useArea("library");
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
      <View style={styles.empty}>
        <Ionicons name="library-outline" size={44} color={c.secondary} />
        <Text style={[type.title, { color: c.text }]}>{t("Your library is empty")}</Text>
        <Caption style={{ textAlign: "center" }}>{t("Photos, analyses and guides from your sessions are collected here.")}</Caption>
      </View>
    );
  }

  const noResults = <Caption style={{ textAlign: "center", marginTop: space.xl }}>{t("No results for \"%@\"", query)}</Caption>;

  return (
    <Screen title={t("Library")} contentStyle={{ gap: space.l }}>
      <Glass style={styles.search}>
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
      </Glass>

      <Segmented<Scope>
        value={scope}
        options={[["sessions", t("Sessions")], ["photos", t("Photos")], ["guides", t("Guides")]]}
        onChange={setScope}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, paddingVertical: 2 }} style={{ overflow: "visible" }}>
        <GlassGroup style={{ flexDirection: "row", gap: space.s }}>
          {[null, ...CATEGORIES].map((cat) => {
            const on = category === cat;
            return (
              <Pressable key={cat ?? "all"} onPress={() => setCategory(cat)} aria-selected={on} accessibilityRole="button">
                <Glass interactive tint={on ? c.accent : undefined} style={styles.filter}>
                  <Text style={{ color: on ? "#fff" : c.text, fontSize: 13, fontFamily: on ? font.semibold : font.medium }}>{cat ? categoryInfo[cat].title() : t("All topics")}</Text>
                </Glass>
              </Pressable>
            );
          })}
        </GlassGroup>
      </ScrollView>

      {scope === "sessions" &&
        (filtered.length ? (
          <GlassCard style={{ gap: 0, paddingVertical: space.s }}>
            {filtered.map((s, i) => (
              <View key={s.id}>
                {i > 0 && <Divider />}
                <SessionRow session={s} thumbnail={false} onPress={() => openSession(s.id)} onLongPress={() => askDelete(s)} />
              </View>
            ))}
          </GlassCard>
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
                  <GlassCard>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Chip text={categoryInfo[a.category].title()} icon={categoryInfo[a.category].icon} />
                      <StatusBadge status={s.status} />
                    </View>
                    <Text style={[type.headline, { color: c.text }]}>{a.title}</Text>
                    <Caption>{a.steps.slice(0, 3).map((st, i) => `${i + 1}. ${st.title}`).join("\n")}</Caption>
                    {a.steps.length > 3 && <Caption>{t("+ %lld more steps", a.steps.length - 3)}</Caption>}
                  </GlassCard>
                </Pressable>
              );
            })
          : noResults)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.l },
  search: { flexDirection: "row", alignItems: "center", gap: space.s, borderRadius: 999, paddingHorizontal: space.l, paddingVertical: 12 },
  filter: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  cell: { width: "32.6%", aspectRatio: 1, borderRadius: 14, overflow: "hidden" },
  badge: { position: "absolute", left: 4, bottom: 4, backgroundColor: "#00000088", borderRadius: 4, padding: 3 },
});
