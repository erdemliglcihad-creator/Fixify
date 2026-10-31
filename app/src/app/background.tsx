// Settings > Background, full screen like a wallpaper picker: the default look, your uploads, and a tile to
// add more. Tap one to use it right away; Edit shows a delete button on each upload.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { t } from "../i18n/index.ts";
import { addBackgrounds, deleteBackground, selectBackground } from "../services/background.ts";
import { useSettings, type CustomBackground } from "../services/settings.ts";
import { Caption } from "../ui/components.tsx";
import { confirmDestructive } from "../ui/confirm.ts";
import { PressScale } from "../ui/motion.tsx";
import { brand, font, space, useTheme } from "../ui/theme.ts";

const COLUMNS = 3;
const GAP = 12;

const tick = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync();
};

export default function BackgroundScreen() {
  const { c } = useTheme();
  const { backgrounds = [], backgroundId } = useSettings();
  const { width } = useWindowDimensions();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const tileW = (width - space.l * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  async function add() {
    setAdding(true);
    try {
      if (await addBackgrounds()) tick();
    } finally {
      setAdding(false);
    }
  }

  function remove(bg: CustomBackground) {
    confirmDestructive(t("Delete this background?"), t("It is removed from Fixify. The original stays in your photos."), t("Delete"), () => {
      tick();
      deleteBackground(bg.id);
    });
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t("Background"),
          headerRight: backgrounds.length
            ? () => (
                <Pressable onPress={() => setEditing((e) => !e)} hitSlop={10}>
                  <Text style={{ color: c.accent, fontSize: 17, ...(editing ? font.semibold : font.regular) }}>{editing ? t("Done editing") : t("Edit")}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: space.xxl * 2 }}>
        <Caption>{t("Your own picture or video behind every screen, darkened so everything stays readable. Videos play without sound.")}</Caption>
        <View style={styles.grid}>
          {/* The default look: night blue with the two soft lights. */}
          <Tile width={tileW} active={!backgroundId} onPress={() => (tick(), selectBackground(null))} label={t("Default")}>
            <LinearGradient colors={["#000008", brand.lights[0], "#080523", brand.lights[1]]} locations={[0, 0.35, 0.6, 1]} start={{ x: 0.9, y: 0 }} end={{ x: 0.1, y: 1 }} style={StyleSheet.absoluteFill} />
          </Tile>

          {backgrounds.map((bg) => (
            <View key={bg.id}>
              <Tile width={tileW} active={bg.id === backgroundId} onPress={() => (editing ? remove(bg) : (tick(), selectBackground(bg.id)))} label={bg.kind === "video" ? t("Your video") : t("Your picture")}>
                {bg.kind === "image" || bg.thumb ? (
                  <Image source={{ uri: bg.kind === "image" ? bg.uri : bg.thumb! }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.raised }]}>
                    <Ionicons name="videocam" size={24} color={c.secondary} />
                  </View>
                )}
                {bg.kind === "video" && (
                  <View style={styles.videoBadge}>
                    <Ionicons name="play" size={10} color="#FFFFFF" />
                  </View>
                )}
                {editing && (
                  <Animated.View entering={FadeIn.duration(150)} style={styles.delete}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Animated.View>
                )}
              </Tile>
            </View>
          ))}

          {/* Add one or several at once; the first one picked is used right away. */}
          {!editing && (
            <PressScale onPress={add} disabled={adding} accessibilityLabel={t("Choose picture or video")} style={[styles.tile, styles.center, { width: tileW, height: tileW * 1.8, borderColor: c.hairline, backgroundColor: `${c.raised}99` }]}>
              <Ionicons name={adding ? "hourglass-outline" : "add"} size={30} color={c.text} />
              <Text style={[styles.addLabel, { color: c.secondary }]}>{t("Add")}</Text>
            </PressScale>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function Tile({ width, active, onPress, label, children }: { width: number; active: boolean; onPress: () => void; label: string; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <PressScale onPress={onPress} haptic={false} accessibilityLabel={label} aria-selected={active} style={{ width }}>
      <View style={[styles.tile, { height: width * 1.8, borderColor: active ? c.accent : c.hairline, borderWidth: active ? 2.5 : StyleSheet.hairlineWidth, boxShadow: active ? `0 0 18px ${c.accent}99` : undefined }]}>
        {children}
        {active && (
          <View style={[styles.check, { backgroundColor: c.accent }]}>
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </View>
        )}
      </View>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: { borderRadius: 18, borderCurve: "continuous", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  center: { alignItems: "center", justifyContent: "center", gap: 4 },
  addLabel: { ...font.medium, fontSize: 13 },
  check: { position: "absolute", right: 8, bottom: 8, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  videoBadge: { position: "absolute", left: 8, top: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: "#00000088", alignItems: "center", justifyContent: "center" },
  delete: { position: "absolute", right: 6, top: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: "#FF3B30", alignItems: "center", justifyContent: "center" },
});
