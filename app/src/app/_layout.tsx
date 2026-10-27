import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { t } from "../i18n/index.ts";
import { applyRetention, loadSessions } from "../services/sessions.ts";
import { isServerConfigured, loadSettings, serverBase, settingsStore } from "../services/settings.ts";
import { loadChat } from "../services/chat.ts";
import { refreshQuota } from "../services/proxy.ts";
import { Aurora } from "../ui/Aurora";
import { useTheme } from "../ui/theme.ts";

// iOS 26 headers bring their own Liquid Glass scroll edge effect; an extra blur would stack on top of it.
const IOS_26 = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const { c, dark } = useTheme();

  useEffect(() => {
    Promise.all([loadSettings(), loadSessions(), loadChat()])
      .then(() => {
        const s = settingsStore.get();
        applyRetention(s.autoDeleteDays);
        const base = serverBase(s);
        if (base && isServerConfigured(s)) refreshQuota(base, s.provider === "proxy" ? s.appToken : "");
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    // First launch: explain what Fixify does, the daily limits and privacy, once.
    if (ready && !settingsStore.get().seenWelcome) router.push("/welcome");
  }, [ready]);

  const base = dark ? DarkTheme : DefaultTheme;
  // Screens are transparent: one global aurora glows behind all of them and morphs per area.
  const navTheme = { ...base, colors: { ...base.colors, primary: c.accent, background: "transparent", card: c.surface, text: c.text, border: c.hairline } };

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
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.background }}>
      <Aurora />
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* iOS: translucent native header (Liquid Glass on iOS 26); content scrolls under it. */}
        <Stack.Screen
          name="session/[id]"
          options={{ title: "", headerTransparent: Platform.OS === "ios", headerBlurEffect: Platform.OS === "ios" && !IOS_26 ? "systemChromeMaterial" : undefined }}
        />
        <Stack.Screen name="review" options={{ presentation: "modal", title: t("Review") }} />
        <Stack.Screen name="welcome" options={{ presentation: "fullScreenModal", headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="privacy" options={{ title: t("What Fixify processes") }} />
        <Stack.Screen name="help" options={{ title: t("How Fixify works") }} />
        <Stack.Screen name="server-help" options={{ title: t("Server setup") }} />
        <Stack.Screen name="voice" options={{ presentation: "fullScreenModal", headerShown: false, animation: "fade" }} />
      </Stack>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
