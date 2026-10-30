import { ScrollView, View } from "react-native";
import { t } from "../i18n/index.ts";
import { Caption, Card, InfoRow } from "../ui/components.tsx";
import { space, useTheme, font } from "../ui/theme.ts";

export default function Privacy() {
  const { c } = useTheme();
  const group = (title: string, rows: [Parameters<typeof InfoRow>[0]["icon"], string, string][]) => (
    <View style={{ gap: space.s }}>
      <Caption style={{ textTransform: "uppercase", ...font.semibold, marginLeft: space.s }}>{title}</Caption>
      <Card>
        {rows.map(([icon, title, detail]) => (
          <InfoRow key={title} icon={icon} title={title} detail={detail} />
        ))}
      </Card>
    </View>
  );
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.l, gap: space.xl }}>
      {group(t("Always on this iPhone"), [
        ["phone-portrait-outline", t("Your sessions"), t("Photos, analyses and history are stored only in Fixify on this iPhone.")],
      ])}
      {group(t("Only when you tap Analyze (Fixify Cloud)"), [
        ["cloud-outline", t("Fixify Cloud"), t("Receives up to two photos (reduced to about 1600 pixels), your description, answers and the steps you tried. It does not store them and logs no photos or text.")],
        ["text-outline", t("OCR.space"), t("Recognizes the text in the photos so markers can point at it exactly.")],
        ["sparkles-outline", t("Groq"), t("Runs the AI that writes the analysis and the steps. Servers in the USA.")],
      ])}
      {group(t("Never"), [
        ["analytics-outline", t("No analytics or tracking"), t("Fixify has no telemetry, ads or third-party SDKs.")],
        ["key-outline", t("No AI keys in the app"), t("All AI keys stay on the server. The app only sends a random device id for the daily limit.")],
      ])}
      <Caption>
        {t("Fixify gives guidance, not guarantees. It does not give medical, legal or electrical diagnoses as fact. For mains electricity, gas, vehicles or anything unsafe, ask a professional.")}
      </Caption>
    </ScrollView>
  );
}
