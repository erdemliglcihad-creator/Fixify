// Settings > Storage: what is kept on the iPhone, automatic clean-up, and deleting.
import { useState } from "react";
import { Platform, Text } from "react-native";
import { isOpen } from "../../core/session.ts";
import { t } from "../../i18n/index.ts";
import { storageBytes } from "../../services/images.ts";
import { cancelAllReminders } from "../../services/reminders.ts";
import { deleteEverything, deletePhotos, useSessions } from "../../services/sessions.ts";
import { updateSettings, useSettings } from "../../services/settings.ts";
import { Caption, Segmented } from "../../ui/components.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import { Group, Label, Link, Row, SettingsPage } from "../../ui/settingsParts.tsx";
import { type, useTheme } from "../../ui/theme.ts";

export default function StoragePage() {
  const { c } = useTheme();
  const s = useSettings();
  const sessions = useSessions();
  const [bytes, setBytes] = useState(() => storageBytes());
  return (
    <SettingsPage title={t("Storage")}>
      <Group footer={Platform.OS === "web" ? t("In the web preview, photos are kept in the browser.") : t("Photos are stored once even if used in several sessions.")}>
        <Row>
          <Label>{t("Sessions")}</Label>
          <Caption>{String(sessions.length)}</Caption>
        </Row>
        <Row>
          <Label>{t("Photos")}</Label>
          <Caption>{`${(bytes / 1_000_000).toFixed(1)} MB`}</Caption>
        </Row>
      </Group>
      <Group>
        <Text style={[type.body, { color: c.text }]}>{t("Delete photos of solved sessions")}</Text>
        <Segmented<string>
          value={String(s.autoDeleteDays)}
          options={[["0", t("Never")], ["7", "7 d"], ["30", "30 d"], ["90", "90 d"]]}
          onChange={(v) => updateSettings({ autoDeleteDays: Number(v) })}
        />
      </Group>
      <Group>
        <Link
          icon="images-outline"
          title={t("Delete photos of completed sessions now")}
          onPress={() => {
            sessions.filter((x) => !isOpen(x.status) && x.images.length).forEach((x) => deletePhotos(x.id));
            setBytes(storageBytes());
          }}
        />
        <Link
          icon="trash-outline"
          danger
          title={t("Delete all Fixify data")}
          onPress={() =>
            confirmDestructive(t("Delete all Fixify data?"), t("All sessions, photos, analyses and history are removed from this iPhone. Your settings stay."), t("Delete everything"), async () => {
              await deleteEverything();
              cancelAllReminders();
              setBytes(storageBytes());
            })
          }
        />
      </Group>
    </SettingsPage>
  );
}
