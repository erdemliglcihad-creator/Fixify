import { ScrollView, View } from "react-native";
import { t } from "../i18n/index.ts";
import { Caption, Card, InfoRow } from "../ui/components.tsx";
import { space, useTheme } from "../ui/theme.ts";

export default function Privacy() {
  const { c } = useTheme();
  const group = (title: string, rows: [Parameters<typeof InfoRow>[0]["icon"], string, string][]) => (
    <View style={{ gap: space.s }}>
      <Caption style={{ textTransform: "uppercase", fontWeight: "600", marginLeft: space.s }}>{title}</Caption>
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
      {group(t("Only when you tap Analyze"), [
        ["desktop-outline", t("Text recognition on your computer"), t("Your Fixify server reads text in the photos locally with Tesseract. This part never leaves your computer.")],
        [
          "server-outline",
          t("Sent to your Fixify server"),
          t("Up to four photos (reduced to about 1600 pixels), the recognized text, your description, answers and the steps you tried in this session."),
        ],
        ["arrow-forward-circle-outline", t("Passed on to Anthropic"), t("Your server forwards this to Claude to create the analysis. The server logs only timing and sizes, never images or text.")],
      ])}
      {group(t("Never"), [
        ["analytics-outline", t("No analytics or tracking"), t("Fixify has no telemetry, ads or third-party SDKs.")],
        ["key-outline", t("No API key in the app"), t("The Claude key stays on your server. The app only stores an app token in the Keychain.")],
      ])}
      <Caption>
        {t("Fixify gives guidance, not guarantees. It does not give medical, legal or electrical diagnoses as fact. For mains electricity, gas, vehicles or anything unsafe, ask a professional.")}
      </Caption>
    </ScrollView>
  );
}
