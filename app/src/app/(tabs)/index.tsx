import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { t } from "../../i18n/index.ts";
import { useArea } from "../../services/area.ts";
import { openSession, startScan } from "../../services/nav.ts";
import { useSessions } from "../../services/sessions.ts";
import { isServerConfigured, useSettings } from "../../services/settings.ts";
import { useQuota } from "../../services/usage.ts";
import { CardCarousel, SoftCard } from "../../ui/CardCarousel.tsx";
import { Caption, IconCircle } from "../../ui/components.tsx";
import { CountUp } from "../../ui/CountUp.tsx";
import { Glass } from "../../ui/Glass.tsx";
import { PressScale } from "../../ui/motion.tsx";
import { Reveal } from "../../ui/reveal.tsx";
import { Screen } from "../../ui/Screen.tsx";
import { SOFT, type SoftTone } from "../../ui/soft.ts";
import { SoftSurface } from "../../ui/SoftSurface";
import type { IconName } from "../../ui/categories.ts";
import { font, space, type, useTheme } from "../../ui/theme.ts";

type Action = { id: string; tone: SoftTone; label: string; icon: IconName; title: string; subtitle: string; run: () => void };

export default function Home() {
  useArea("home");
  const { c } = useTheme();
  const sessions = useSessions();
  const settings = useSettings();
  const quota = useQuota();
  const solved = sessions.filter((s) => s.status === "solved");
  const last = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];

  // The three ways in, one big soft card each (swipe sideways).
  const actions: Action[] = [
    { id: "scan", tone: "red", label: "Live Fix", icon: "scan-outline", title: t("Open camera"), subtitle: t("Show it. Fix it."), run: () => startScan() },
    { id: "voice", tone: "crimson", label: "FixVoice", icon: "mic-outline", title: t("Talk to FixVoice"), subtitle: t("Hands-free, by voice"), run: () => router.navigate("/fixvoice") },
    {
      id: "photo",
      tone: "blush",
      label: t("Photo"),
      icon: "images-outline",
      title: t("Choose from photos"),
      subtitle: quota.uploadsLeft !== null && quota.uploadsDaily ? t("%lld left today", quota.uploadsLeft) : t("Photo or screenshot"),
      run: () => startScan({ library: true }),
    },
  ];

  return (
    <Screen contentStyle={{ gap: space.xl }}>
      {/* Header like the reference: round buttons left and right, the name in the middle. */}
      <Reveal kind="fade" style={styles.header}>
        <PressScale onPress={() => router.navigate("/library")} accessibilityLabel={t("Library")}>
          <IconCircle icon="albums-outline" size={50} />
        </PressScale>
        <Text style={[styles.title, { color: c.text }]} accessibilityRole="header">
          Fixify
        </Text>
        <PressScale onPress={() => router.navigate("/settings")} accessibilityLabel={t("Settings")}>
          <IconCircle icon="options-outline" size={50} />
        </PressScale>
      </Reveal>

      <Reveal kind="slideUp" delay={120}>
        <CardCarousel
          items={actions}
          keyOf={(a) => a.id}
          render={(a) => <SoftCard tone={a.tone} label={a.label} icon={a.icon} title={a.title} subtitle={a.subtitle} onPress={a.run} />}
        />
      </Reveal>

      {/* Small tiles, like "Daily Streak", "Training" and "Breath Volume". */}
      <Reveal kind="slideUp" delay={240} style={styles.tiles}>
        <Tile tone="ember" style={{ flex: 1, height: TALL }} onPress={() => router.navigate("/library")} label={t("Solved")}>
          <View style={{ flex: 1, justifyContent: "flex-end", gap: space.m }}>
            <CountUp value={solved.length} style={styles.big} />
            <DotLine filled={Math.min(solved.length, 12)} />
          </View>
        </Tile>
        <View style={{ flex: 1, gap: GAP }}>
          <Tile tone="red" style={{ height: SHORT }} onPress={() => router.navigate("/library")} label={t("Sessions")}>
            <CountUp value={sessions.length} style={styles.small} />
          </Tile>
          <Tile tone="blush" style={{ height: SHORT }} onPress={() => (last ? openSession(last.id) : startScan())} label={t("Last session")}>
            <Text style={styles.smallText} numberOfLines={1}>
              {last ? last.title : t("Nothing yet")}
            </Text>
          </Tile>
        </View>
      </Reveal>

      {!isServerConfigured(settings) && settings.provider === "proxy" && (
        <PressScale onPress={() => router.navigate("/settings")}>
          <Glass interactive style={styles.notice}>
            <Ionicons name="server-outline" size={20} color={c.caution} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.headline, { color: c.text }]}>{t("AI analysis is not set up")}</Text>
              <Caption>{t("Choose an AI service in Settings to get a diagnosis and a guided plan.")}</Caption>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.secondary} />
          </Glass>
        </PressScale>
      )}
    </Screen>
  );
}

const GAP = 12;
const SHORT = 96;
const TALL = SHORT * 2 + GAP;

function Tile({ tone, label, onPress, style, children }: { tone: SoftTone; label: string; onPress: () => void; style?: object; children: ReactNode }) {
  return (
    <PressScale onPress={onPress} accessibilityLabel={label} style={style}>
      <SoftSurface palette={SOFT[tone]} radius={30} glow={0.6} style={styles.tile}>
        <Text style={styles.tileLabel} numberOfLines={1}>
          {label}
        </Text>
        {children}
      </SoftSurface>
    </PressScale>
  );
}

/** A dotted track with a bright mark, like the streak line in the reference. */
function DotLine({ filled }: { filled: number }) {
  return (
    <View style={styles.dotLine}>
      {Array.from({ length: 12 }, (_, i) => (
        <View key={i} style={[styles.lineDot, { opacity: i < filled ? 1 : 0.3 }]} />
      ))}
      <View style={styles.lineMark} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space.s },
  title: { ...font.semibold, fontSize: 24, letterSpacing: -0.3 },
  tiles: { flexDirection: "row", gap: GAP },
  tile: { flex: 1, paddingHorizontal: space.l, paddingVertical: space.m, gap: 2 },
  tileLabel: { color: "#FFFFFFE6", ...font.medium, fontSize: 15, letterSpacing: -0.2 },
  big: { color: "#FFFFFF", ...font.light, fontSize: 48, lineHeight: 52, letterSpacing: -1 },
  small: { color: "#FFFFFF", ...font.light, fontSize: 30, lineHeight: 34, letterSpacing: -0.5 },
  smallText: { color: "#FFFFFF", ...font.regular, fontSize: 15 },
  dotLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  lineDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#FFFFFF" },
  lineMark: { width: 3, height: 14, borderRadius: 1.5, backgroundColor: "#FF3B2F" },
  notice: { flexDirection: "row", alignItems: "center", gap: space.m, padding: space.l, borderRadius: 24, borderCurve: "continuous" },
});
