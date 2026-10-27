import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { t } from "../i18n/index.ts";
import { applyRetention, loadSessions } from "../services/sessions.ts";
import { loadSettings, settingsStore } from "../services/settings.ts";
import { useTheme } from "../ui/theme.ts";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { c, dark } = useTheme();

  useEffect(() => {
    Promise.all([loadSettings(), loadSessions()])
      .then(() => applyRetention(settingsStore.get().autoDeleteDays))
      .finally(() => setReady(true));
  }, []);

  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, primary: c.accent, background: c.background, card: c.surface, text: c.text, border: c.hairline } };

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", contentStyle: { backgroundColor: c.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/[id]" options={{ title: "" }} />
        <Stack.Screen name="review" options={{ presentation: "modal", title: t("Review") }} />
        <Stack.Screen name="privacy" options={{ title: t("What Fixify processes") }} />
        <Stack.Screen name="help" options={{ title: t("How Fixify works") }} />
        <Stack.Screen name="server-help" options={{ title: t("Server setup") }} />
      </Stack>
    </ThemeProvider>
  );
}
