import { Image } from "expo-image";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../i18n/index.ts";
import { updateSettings } from "../services/settings.ts";
import { Button, Caption, Card, InfoRow } from "../ui/components.tsx";
import { space, type, useTheme } from "../ui/theme.ts";
import { useArea } from "../services/area.ts";

/** Shown once on first launch: what Fixify does, the free daily limits, and what is sent where. */
export default function Welcome() {
  useArea("home");
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const done = () => {
    updateSettings({ seenWelcome: true });
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.xl }}>
        <View style={{ alignItems: "center", gap: space.m }}>
          <Image source={require("../../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors />
          <Text style={[type.display, { color: c.text, textAlign: "center" }]}>{t("Welcome to Fixify")}</Text>
          <Caption style={{ textAlign: "center", fontSize: 16 }}>{t("See the problem. Understand it. Fix it.")}</Caption>
        </View>

        <Card style={{ gap: space.l }}>
          <InfoRow icon="scan-outline" title={t("Live Fix")} detail={t("Show the problem with the camera. Fixify explains it and guides you step by step.")} />
          <InfoRow icon="mic-outline" title="FixVoice" detail={t("Talk to Fixify like on the phone, hands-free.")} />
          <InfoRow icon="ribbon-outline" title={t("Check the result")} detail={t("You confirm yourself whether it is really fixed. Fixify never claims that on its own.")} />
        </Card>

        <Card style={{ gap: space.m }}>
          <Text style={[type.headline, { color: c.text }]}>{t("Free, with a daily limit")}</Text>
          <InfoRow icon="images-outline" title={t("10 photo uploads per day")} detail={t("For photo analyses. The same photo counts only once.")} />
          <InfoRow
            icon="chatbubble-ellipses-outline"
            title={t("Messages without a fixed limit")}
            detail={t("Ask as much as you need within fair use. When it is very busy, a faster model answers automatically.")}
          />
          <Caption>{t("Limits renew every day. You can see what is left on the start screen.")}</Caption>
        </Card>

        <Card>
          <InfoRow
            icon="shield-checkmark-outline"
            title={t("Your data")}
            detail={t("Sessions stay on this iPhone. Photos and text are only sent for analysis after you agree, to Groq (AI) and OCR.space (text recognition).")}
          />
        </Card>
      </ScrollView>
      <View style={{ paddingHorizontal: space.xl, paddingBottom: insets.bottom + space.l, paddingTop: space.s }}>
        <Button title={t("Get started")} onPress={done} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { width: 88, height: 88, borderRadius: 20 },
});
