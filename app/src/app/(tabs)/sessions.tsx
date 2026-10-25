import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, Text, View } from "react-native";
import { isOpen } from "../../core/session.ts";
import { t } from "../../i18n/index.ts";
import { openSession, startScan } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { Button, Card, Caption, Divider } from "../../ui/components.tsx";
import { SessionRow } from "../../ui/SessionRow.tsx";
import { space, type, useTheme } from "../../ui/theme.ts";
import type { FixSession } from "../../core/types.ts";

export default function Sessions() {
  const { c } = useTheme();
  const sessions = [...useSessions()].sort((a, b) => b.updatedAt - a.updatedAt);
  const open = sessions.filter((s) => isOpen(s.status));
  const done = sessions.filter((s) => !isOpen(s.status));

  if (!sessions.length) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: space.xxl, gap: space.l, backgroundColor: c.background }}>
        <Ionicons name="build-outline" size={44} color={c.secondary} />
        <Text style={[type.title, { color: c.text }]}>{t("No fix sessions yet")}</Text>
        <Caption style={{ textAlign: "center" }}>{t("Each problem you scan becomes a session with its analysis, steps and result.")}</Caption>
        <Button title={t("Start Live Fix")} icon="camera" onPress={() => startScan()} />
      </View>
    );
  }

  const section = (title: string, items: FixSession[]) =>
    items.length > 0 && (
      <View style={{ gap: space.s }}>
        <Caption style={{ textTransform: "uppercase", fontWeight: "600", marginLeft: space.s }}>{title}</Caption>
        <Card style={{ gap: 0, paddingVertical: space.s }}>
          {items.map((s, i) => (
            <View key={s.id}>
              {i > 0 && <Divider />}
              <SessionRow session={s} onPress={() => openSession(s.id)} />
            </View>
          ))}
        </Card>
      </View>
    );

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.l, gap: space.xl }}>
      {section(t("Active"), open)}
      {section(t("Completed"), done)}
      <Caption style={{ textAlign: "center" }}>{t("Open a session to delete it.")}</Caption>
    </ScrollView>
  );
}
