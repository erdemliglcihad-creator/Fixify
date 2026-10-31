// Settings > Notifications: reminders for open sessions, and nothing else.
import { Switch } from "react-native";
import { t } from "../../i18n/index.ts";
import { cancelAllReminders } from "../../services/reminders.ts";
import { updateSettings, useSettings } from "../../services/settings.ts";
import { Group, Label, Row, SettingsPage, tick } from "../../ui/settingsParts.tsx";
import { useTheme } from "../../ui/theme.ts";

export default function NotificationsPage() {
  const { c } = useTheme();
  const s = useSettings();
  return (
    <SettingsPage title={t("Notifications")}>
      <Group footer={t("Only when you ask for a reminder in a session. Fixify sends no other notifications.")}>
        <Row>
          <Label>{t("Reminders for open sessions")}</Label>
          <Switch
            trackColor={{ true: c.success }}
            thumbColor="#FFFFFF"
            value={s.reminders}
            onValueChange={(reminders) => {
              tick();
              updateSettings({ reminders });
              if (!reminders) cancelAllReminders();
            }}
          />
        </Row>
      </Group>
    </SettingsPage>
  );
}
