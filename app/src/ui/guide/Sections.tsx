// Cards around the scan chat: the gate before the first analysis, and the hint after a new photo.
import type { Preflight } from "../../services/analysis.ts";
import { t } from "../../i18n/index.ts";
import type { IconName } from "../categories.ts";
import { Button, Caption, Card, SectionTitle } from "../components.tsx";

export function GateCard({
  preflight,
  hasPhotos,
  onAnalyze,
  onSettings,
}: {
  preflight: Preflight;
  hasPhotos: boolean;
  onAnalyze: () => void;
  onSettings: () => void;
}) {
  const saved = hasPhotos ? t("Your photos are saved on this iPhone.") : t("Your description is saved on this iPhone.");
  const content: Record<Preflight, { icon: IconName; title: string; text: string; action: [string, () => void] }> = {
    ready: { icon: "search", title: t("Ready to analyze"), text: saved, action: [t("Analyze"), onAnalyze] },
    needsConsent: { icon: "search", title: t("Ready to analyze"), text: saved, action: [t("Analyze"), onAnalyze] },
    needsSetup: {
      icon: "server-outline",
      title: t("AI analysis is not set up"),
      text: t("Choose an AI service in Settings to get text recognition, a diagnosis and a guided plan."),
      action: [t("Open Settings"), onSettings],
    },
    off: { icon: "phone-portrait-outline", title: t("AI analysis is off"), text: t("Turn on an AI service in Settings to get a guided plan."), action: [t("Open Settings"), onSettings] },
  };
  const g = content[preflight];
  return (
    <Card>
      <SectionTitle title={g.title} icon={g.icon} />
      {g.text ? <Caption>{g.text}</Caption> : null}
      <Button title={g.action[0]} onPress={g.action[1]} kind={preflight === "ready" || preflight === "needsConsent" ? "primary" : "secondary"} />
    </Card>
  );
}

export function UpdateSuggestion({ enabled, onUpdate }: { enabled: boolean; onUpdate: () => void }) {
  return (
    <Card>
      <SectionTitle title={t("New observation added")} icon="add-circle-outline" />
      <Caption>{t("The current plan doesn't know about it yet.")}</Caption>
      <Button title={t("Update the plan")} icon="git-branch-outline" disabled={!enabled} onPress={onUpdate} />
    </Card>
  );
}
