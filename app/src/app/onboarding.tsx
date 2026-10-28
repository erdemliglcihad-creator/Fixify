// "Answer the questions again" from Settings. On first launch the same flow runs as a layer in the root layout.
import { router } from "expo-router";
import { settingsStore, updateSettings } from "../services/settings.ts";
import { OnboardingFlow } from "../ui/OnboardingFlow.tsx";

export default function Onboarding() {
  return (
    <OnboardingFlow
      initial={settingsStore.get().profile}
      onDone={(profile) => {
        updateSettings({ profile, onboardingDone: true });
        if (router.canGoBack()) router.back();
        else router.navigate("/");
      }}
    />
  );
}
