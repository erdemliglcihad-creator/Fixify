import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Appearance, Platform, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { t } from "../i18n/index.ts";
import { applyRetention, loadSessions } from "../services/sessions.ts";
import { isServerConfigured, loadSettings, serverBase, settingsStore, updateSettings, useSettings } from "../services/settings.ts";
import { IntroFlow } from "../ui/IntroFlow.tsx";
import { OnboardingFlow } from "../ui/OnboardingFlow.tsx";
import { loadChat } from "../services/chat.ts";
import { refreshQuota } from "../services/proxy.ts";
import { useTheme } from "../ui/theme.ts";

// iOS 26 headers bring their own Liquid Glass scroll edge effect; an extra blur would stack on top of it.
const IOS_26 = Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const introShown = useRef(false);
  const { c, dark } = useTheme();
  const { appearance, onboardingDone, introDone } = useSettings();
  const firstLaunch = !onboardingDone || !introDone;

  useEffect(() => {
    // Native parts (Liquid Glass, keyboard, alerts) follow the app's choice, not only the iPhone's.
    if (Platform.OS !== "web") Appearance.setColorScheme(appearance === "system" ? "unspecified" : appearance);
  }, [appearance]);
  const [fontsLoaded, fontError] = useFonts({
    "Montserrat-Light": require("../../assets/fonts/Montserrat-Light.ttf"),
    "Montserrat-Regular": require("../../assets/fonts/Montserrat-Regular.ttf"),
    "Montserrat-Medium": require("../../assets/fonts/Montserrat-Medium.ttf"),
    "Montserrat-SemiBold": require("../../assets/fonts/Montserrat-SemiBold.ttf"),
    "Montserrat-Bold": require("../../assets/fonts/Montserrat-Bold.ttf"),
    // Demo license: these files stay on this PC (gitignored).
    "NeueMontreal-Light": require("../../assets/fonts/NeueMontreal-Light.otf"),
    "NeueMontreal-Regular": require("../../assets/fonts/NeueMontreal-Regular.otf"),
    "NeueMontreal-Medium": require("../../assets/fonts/NeueMontreal-Medium.otf"),
    "NeueMontreal-Bold": require("../../assets/fonts/NeueMontreal-Bold.otf"),
  });

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
    // Only once per launch (effects can run twice in development).
    if (!ready || introShown.current) return;
    introShown.current = true;
    // New installs get the questions and the introduction as a layer below (then straight into the app).
    // Earlier installs that never saw the welcome screen still get it once.
    const s = settingsStore.get();
    if (s.onboardingDone && s.introDone && !s.seenWelcome) router.push("/welcome");
  }, [ready]);

  const base = dark ? DarkTheme : DefaultTheme;
  // Screens are transparent over the plain background of the root view.
  const navTheme = { ...base, colors: { ...base.colors, primary: c.accent, background: "transparent", card: c.surface, text: c.text, border: c.hairline } };

  if (!ready || !(fontsLoaded || fontError)) {
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
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal", contentStyle: { backgroundColor: "transparent" } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        {/* iOS: translucent native header (Liquid Glass on iOS 26); content scrolls under it. */}
        <Stack.Screen
          name="session/[id]"
          options={{ title: "", headerTransparent: Platform.OS === "ios", headerBlurEffect: Platform.OS === "ios" && !IOS_26 ? "systemChromeMaterial" : undefined }}
        />
        <Stack.Screen name="review" options={{ presentation: "modal", title: t("Review") }} />
        <Stack.Screen name="welcome" options={{ presentation: "fullScreenModal", headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal", headerShown: false, animation: "fade" }} />
        <Stack.Screen name="privacy" options={{ title: t("What Fixify processes") }} />
        <Stack.Screen name="help" options={{ title: t("How Fixify works") }} />
        <Stack.Screen name="server-help" options={{ title: t("Server setup") }} />
      </Stack>
      {/* First launch: questions, then the introduction, above the app without any navigation. */}
      {firstLaunch && (
        <Animated.View exiting={FadeOut.duration(350)} style={[StyleSheet.absoluteFill, { backgroundColor: c.background }]}>
          {!onboardingDone ? (
            <OnboardingFlow onDone={(profile) => updateSettings({ profile, onboardingDone: true })} />
          ) : (
            <Animated.View entering={FadeIn.duration(350)} style={{ flex: 1 }}>
              <IntroFlow onDone={() => updateSettings({ introDone: true, seenWelcome: true })} />
            </Animated.View>
          )}
        </Animated.View>
      )}
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
