// Settings > About you: name and the profile answers, editable in place.
import { emptyProfile } from "../../core/profile.ts";
import { t } from "../../i18n/index.ts";
import { useSettings } from "../../services/settings.ts";
import { Caption } from "../../ui/components.tsx";
import { ProfileEditor, SettingsPage } from "../../ui/settingsParts.tsx";

export default function ProfilePage() {
  const s = useSettings();
  return (
    <SettingsPage title={t("About you")}>
      <ProfileEditor profile={s.profile ?? emptyProfile()} />
      <Caption>{t("Your answers stay on this iPhone. FixVoice only gets a short summary so it can help you better.")}</Caption>
    </SettingsPage>
  );
}
