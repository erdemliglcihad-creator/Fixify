import { ScrollView } from "react-native";
import { t } from "../i18n/index.ts";
import { Card, InfoRow } from "../ui/components.tsx";
import { space, useTheme } from "../ui/theme.ts";

export default function ServerHelp() {
  const { c } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.l }}>
      <Card>
        <InfoRow icon="logo-nodejs" title={t("Install Node.js 22 or newer on your computer.")} />
        <InfoRow
          icon="folder-open-outline"
          title={t("In the project's server folder, run npm install.")}
          detail={t("Then put your Anthropic API key into server/.env as ANTHROPIC_API_KEY.")}
        />
        <InfoRow icon="play-outline" title={t("Start it with npm start.")} detail={t("The window shows a server address and an app token.")} />
        <InfoRow
          icon="phone-portrait-outline"
          title={t("Enter both in Settings → AI analysis and tap Test connection.")}
          detail={t("Your iPhone and computer must be on the same Wi-Fi. Allow the local network prompt and, on Windows, the firewall prompt.")}
        />
      </Card>
    </ScrollView>
  );
}
