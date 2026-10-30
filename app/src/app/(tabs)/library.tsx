import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { searchText } from "../../core/session.ts";
import type { FixSession } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { openSession } from "../../services/nav.ts";
import { deleteSession, useSessions } from "../../services/sessions.ts";
import { Caption } from "../../ui/components.tsx";
import { Glass } from "../../ui/Glass.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import { SessionCarousel } from "../../ui/SessionCarousel.tsx";
import { space, type, useTheme } from "../../ui/theme.ts";
import { Screen } from "../../ui/Screen.tsx";
import { useArea } from "../../services/area.ts";

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

  const q = query.trim().toLowerCase();
  const filtered = q ? sessions.filter((s) => searchText(s).includes(q)) : sessions;

  if (!sessions.length) {
    return (
      <View style={styles.empty}>
        <Ionicons name="library-outline" size={44} color={c.secondary} />
        <Text style={[type.title, { color: c.text }]}>{t("Your library is empty")}</Text>
        <Caption style={{ textAlign: "center" }}>{t("Photos, analyses and guides from your sessions are collected here.")}</Caption>
      </View>
    );
  }

  return (
    <Screen title={t("Library")} contentStyle={{ gap: space.l }}>
      <Glass style={styles.search}>
        <Ionicons name="search" size={18} color={c.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t("Search sessions")}
          placeholderTextColor={c.secondary}
          style={{ flex: 1, color: c.text, fontSize: 16 }}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </Glass>

      {filtered.length ? (
        // A new search starts again at the first card.
        <SessionCarousel key={q} sessions={filtered} onOpen={(s) => openSession(s.id)} onLongPress={askDelete} />
      ) : (
        <Caption style={{ textAlign: "center", marginTop: space.xl }}>{t("No results for \"%@\"", query)}</Caption>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.l },
  search: { flexDirection: "row", alignItems: "center", gap: space.s, borderRadius: 999, paddingHorizontal: space.l, paddingVertical: 12 },
});
