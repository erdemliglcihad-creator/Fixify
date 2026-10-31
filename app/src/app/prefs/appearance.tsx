// Settings > Appearance: light, dark or like the iPhone.
import { t } from "../../i18n/index.ts";
import { updateSettings, useSettings, type Appearance } from "../../services/settings.ts";
import { Segmented } from "../../ui/components.tsx";
import { Group, SettingsPage } from "../../ui/settingsParts.tsx";

export default function AppearancePage() {
  const s = useSettings();
  return (
    <SettingsPage title={t("Appearance")}>
      <Group>
        <Segmented<Appearance>
          value={s.appearance}
          options={[["system", t("System")], ["light", t("Light")], ["dark", t("Dark")]]}
          onChange={(appearance) => updateSettings({ appearance })}
        />
      </Group>
    </SettingsPage>
  );
}
