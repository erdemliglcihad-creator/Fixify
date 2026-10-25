import { ScrollView } from "react-native";
import { t } from "../i18n/index.ts";
import { Caption, Card, InfoRow } from "../ui/components.tsx";
import { space, useTheme } from "../ui/theme.ts";

export default function Help() {
  const { c } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.l, gap: space.l }}>
      <Card>
        <InfoRow icon="scan-outline" title={t("1. Show the problem")} detail={t("Photograph the error message, device or part. Video records up to 10 seconds and uses three frames.")} />
        <InfoRow
          icon="search"
          title={t("2. Understand it")}
          detail={t("The analysis separates what is visible from what is guessed, lists possible causes and says what is still unknown.")}
        />
        <InfoRow
          icon="locate-outline"
          title={t("3. Look where it matters")}
          detail={t("Numbered markers point to findings. Solid boxes come from recognized text and are exact; dashed boxes are AI estimates.")}
        />
        <InfoRow
          icon="checkbox-outline"
          title={t("4. Fix it step by step")}
          detail={t("Mark each step as done or tell Fixify it didn't work. The plan is adjusted with what you report.")}
        />
        <InfoRow icon="ribbon-outline" title={t("5. Verify")} detail={t("You check the success criteria yourself. Fixify never marks a problem as solved on its own.")} />
      </Card>
      <Caption>
        {t("Fixify can be wrong. It cannot read things a photo doesn't show, like whether Bluetooth is on or a wire is live. When it needs that, it asks you.")}
      </Caption>
    </ScrollView>
  );
}
