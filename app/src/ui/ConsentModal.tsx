import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, ScrollView, Text, View } from "react-native";
import { t } from "../i18n/index.ts";
import { Button, Caption, InfoRow } from "./components.tsx";
import { space, type, useTheme } from "./theme.ts";

/** Asked once before anything is sent to the configured server. */
export function ConsentModal({ visible, onDecision }: { visible: boolean; onDecision: (allowed: boolean) => void }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onDecision(false)}>
      <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ padding: space.xl, gap: space.l }}>
        <Ionicons name="hand-left-outline" size={40} color={c.accent} />
        <Text style={[type.title, { color: c.text }]}>{t("Send this problem for analysis?")}</Text>
        <View style={{ gap: space.m }}>
          <InfoRow icon="image-outline" title={t("Photos, reduced to about 1600 pixels")} />
          <InfoRow icon="text-outline" title={t("Text found in the photos")} />
          <InfoRow icon="chatbubble-ellipses-outline" title={t("Your description, answers and the steps you tried")} />
        </View>
        <Caption style={{ fontSize: 16 }}>
          {t("With Fixify Cloud they go to OCR.space for text recognition and to Groq for the AI analysis (servers in the USA). With your own server they go there instead. Nothing is sent in the background. Avoid photographing passwords, IDs or other people.")}
        </Caption>
        <Caption>{t("You can change this anytime in Settings → Privacy.")}</Caption>
        <Button title={t("Allow and analyze")} onPress={() => onDecision(true)} />
        <Button title={t("Only save on this iPhone")} kind="secondary" onPress={() => onDecision(false)} />
      </ScrollView>
    </Modal>
  );
}
