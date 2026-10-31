// Settings > Help & feedback.
import Constants from "expo-constants";
import { router } from "expo-router";
import { Platform, Share } from "react-native";
import { t } from "../../i18n/index.ts";
import { Caption } from "../../ui/components.tsx";
import { Group, Label, Link, Row, SettingsPage } from "../../ui/settingsParts.tsx";

export default function HelpPage() {
  return (
    <SettingsPage title={t("Help & feedback")}>
      <Group>
        <Link icon="help-circle-outline" title={t("How Fixify works")} onPress={() => router.push("/help")} />
        <Link icon="server-outline" title={t("Use your own server")} onPress={() => router.push("/server-help")} />
        <Link
          icon="mail-outline"
          title={t("Send feedback")}
          onPress={() => Share.share({ message: t("Fixify feedback (version %@, iOS %@)\n\nWhat happened:\n\nWhat I expected:\n", Constants.expoConfig?.version ?? "", String(Platform.Version)) })}
        />
      </Group>
      <Group>
        <Row>
          <Label>{t("Version")}</Label>
          <Caption>{`${Constants.expoConfig?.version ?? "–"} · Expo Go`}</Caption>
        </Row>
      </Group>
    </SettingsPage>
  );
}
