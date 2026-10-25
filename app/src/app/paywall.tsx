import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { FREE, PRO } from "../core/usage.ts";
import { t } from "../i18n/index.ts";
import { Caption, Card, Divider, InfoRow } from "../ui/components.tsx";
import { space, type, useTheme } from "../ui/theme.ts";

// Shown only after a limit is reached or on request. No timers, no purchase buttons that cannot work:
// Expo Go cannot sell subscriptions, so this page only explains the limits.
export default function Paywall() {
  const { c } = useTheme();
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const lead =
    reason === "monthlyLimit"
      ? t("You've used your %lld free analyses this month. They renew on the 1st.", FREE.analysesPerMonth)
      : reason === "sessionLimit"
        ? t("This session reached the %lld free plan updates. Pro allows longer, connected troubleshooting.", FREE.updatesPerSession)
        : reason === "storedSessions"
          ? t("You've saved %lld sessions. Delete old ones, or keep your full repair history with Pro.", FREE.storedSessions ?? 0)
          : t("For longer troubleshooting and a complete repair history.");

  const row = (label: string, free: string, pro: string) => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Caption style={{ flex: 1, color: c.text }}>{label}</Caption>
      <Caption style={{ width: 70, textAlign: "center" }}>{free}</Caption>
      <Caption style={{ width: 80, textAlign: "center", color: c.accent, fontWeight: "600" }}>{pro}</Caption>
    </View>
  );

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
      <View style={{ gap: space.s }}>
        <Ionicons name="sparkles" size={36} color={c.accent} />
        <Text style={[type.display, { color: c.text }]}>Fixify Pro</Text>
        <Caption style={{ fontSize: 16 }}>{lead}</Caption>
      </View>
      <Card>
        {row("", "Free", "Pro")}
        <Divider />
        {row(t("AI analyses per month"), String(FREE.analysesPerMonth), String(PRO.analysesPerMonth))}
        {row(t("Plan updates per session"), String(FREE.updatesPerSession), String(PRO.updatesPerSession))}
        {row(t("Photos per analysis"), String(FREE.imagesPerAnalysis), String(PRO.imagesPerAnalysis))}
        {row(t("Saved sessions"), String(FREE.storedSessions), t("Unlimited"))}
      </Card>
      <Card>
        <InfoRow
          icon="information-circle-outline"
          title={t("Not available in Expo Go")}
          detail={t("Subscriptions need the App Store version of Fixify. Until then everyone uses the free limits, and they renew every month.")}
        />
      </Card>
    </ScrollView>
  );
}
