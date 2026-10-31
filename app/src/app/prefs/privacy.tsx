// Settings > Privacy: whether photos may be sent for analysis, and what Fixify processes.
import { router } from "expo-router";
import { Switch } from "react-native";
import { t } from "../../i18n/index.ts";
import { updateSettings, useSettings } from "../../services/settings.ts";
import { Divider } from "../../ui/components.tsx";
import { Group, Label, Link, Row, SettingsPage, tick } from "../../ui/settingsParts.tsx";
import { useTheme } from "../../ui/theme.ts";

export default function PrivacyPage() {
  const { c } = useTheme();
  const s = useSettings();
  return (
    <SettingsPage title={t("Privacy")}>
      <Group footer={t("When off, nothing leaves this iPhone, and Fixify asks before the next analysis.")}>
        <Row>
          <Label>{t("Allow sending photos for analysis")}</Label>
          <Switch
            value={s.consent}
            onValueChange={(consent) => {
              tick();
              updateSettings({ consent });
            }}
            trackColor={{ true: c.success }}
            thumbColor="#FFFFFF"
          />
        </Row>
        <Divider />
        <Link icon="shield-checkmark-outline" title={t("What Fixify processes")} onPress={() => router.push("/privacy")} />
      </Group>
    </SettingsPage>
  );
}
