// Settings > FixVoice: which voice answers.
import { t } from "../../i18n/index.ts";
import { updateSettings, useSettings, type VoiceGender } from "../../services/settings.ts";
import { Segmented } from "../../ui/components.tsx";
import { Group, SettingsPage } from "../../ui/settingsParts.tsx";

export default function VoicePage() {
  const s = useSettings();
  return (
    <SettingsPage title="FixVoice">
      <Group footer={t("German or English follows the app language. Uses the iPhone's built-in voices for now.")}>
        <Segmented<VoiceGender>
          value={s.voice}
          options={[["female", t("Female voice")], ["male", t("Male voice")]]}
          onChange={(voice) => updateSettings({ voice })}
        />
      </Group>
    </SettingsPage>
  );
}
