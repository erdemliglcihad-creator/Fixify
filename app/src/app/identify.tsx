// Result of "tap to identify": the photo full screen with holographic labels at the tapped objects
// (name, what it is, notable parts), like an AR overlay. From here the Fix analysis starts with that focus.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { photoToPreview } from "../core/tap.ts";
import { t } from "../i18n/index.ts";
import { addCaptures, draftStore } from "../services/draft.ts";
import { cancelIdentify, identifyNote, startIdentify, useIdentify } from "../services/identify.ts";
import type { IdentifiedObject } from "../services/proxy.ts";
import { Button } from "../ui/components.tsx";
import { Glass } from "../ui/Glass.tsx";
import { HOLO, HoloMarker } from "../ui/HoloMarker.tsx";
import { font, space } from "../ui/theme.ts";

const LABEL_W = 176;

export default function Identify() {
  const insets = useSafeAreaInsets();
  const { capture, points, status, objects, error } = useIdentify();
  const [view, setView] = useState({ width: 1, height: 1 });

  if (!capture) {
    return <View style={styles.root} />;
  }

  const photo = { width: capture.width, height: capture.height };
  const spots = points.map((p) => photoToPreview(p, view, photo)).map((p) => ({ x: p.x * view.width, y: p.y * view.height }));

  function close() {
    cancelIdentify();
    router.back();
  }

  function startFix() {
    if (!capture) return;
    addCaptures([capture]);
    draftStore.set((d) => ({ ...d, note: identifyNote(objects) }));
    router.replace("/review");
  }

  return (
    <View style={styles.root} onLayout={(e) => setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <Image source={{ uri: capture.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      {/* Darken a little so the cyan labels read on any photo. */}
      <LinearGradient pointerEvents="none" colors={["#000000AA", "#00000033", "#00000055", "#000000CC"]} locations={[0, 0.25, 0.7, 1]} style={StyleSheet.absoluteFill} />

      {spots.map((s, i) => (
        <HoloMarker key={i} x={s.x} y={s.y} n={i + 1} />
      ))}

      {status === "done" &&
        objects.map((o, i) => {
          const spot = spots[o.point - 1];
          return spot ? <HoloLabel key={o.point} object={o} spot={spot} view={view} index={i} /> : null;
        })}

      <View style={[styles.top, { paddingTop: insets.top + space.s }]}>
        <Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("Close")}>
          <Glass dark variant="clear" style={styles.round}>
            <Ionicons name="close" size={22} color="#fff" />
          </Glass>
        </Pressable>
        <Glass dark variant="clear" style={styles.statusPill}>
          {status === "working" ? <ActivityIndicator size="small" color={HOLO} /> : <Ionicons name={status === "done" ? "scan" : "alert-circle"} size={15} color={status === "done" ? HOLO : "#FF8A8A"} />}
          <Text style={styles.statusText}>{status === "working" ? t("Identifying objects…") : status === "done" ? t("%lld objects identified", objects.length) : t("Not identified")}</Text>
        </Glass>
        <View style={{ width: 44 }} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + space.l }]}>
        {status === "failed" && (
          <Animated.View entering={FadeIn} style={styles.error}>
            <Text style={styles.errorText}>{error ?? t("The objects could not be identified. Try again.")}</Text>
          </Animated.View>
        )}
        {status === "failed" ? (
          <Button title={t("Try again")} icon="refresh" onPress={() => startIdentify(capture, points)} />
        ) : (
          <Button title={t("Start the Fix analysis")} icon="sparkles-outline" disabled={status !== "done"} onPress={startFix} />
        )}
        <Button title={t("Retake photo")} kind="plain" compact onPress={close} />
      </View>
    </View>
  );
}

/** Label beside the spot (left or right, whichever has room), joined by a glowing leader line. */
function HoloLabel({ object, spot, view, index }: { object: IdentifiedObject; spot: { x: number; y: number }; view: { width: number; height: number }; index: number }) {
  const right = spot.x < view.width / 2;
  const gap = 58;
  const left = right ? Math.min(spot.x + gap, view.width - LABEL_W - 12) : Math.max(spot.x - gap - LABEL_W, 12);
  const top = Math.min(Math.max(spot.y - 40, 110), view.height - 260);
  const lineStart = right ? spot.x + 30 : left + LABEL_W;
  const lineEnd = right ? left : spot.x - 30;
  return (
    <>
      <Animated.View
        entering={FadeIn.delay(150 + index * 120).duration(400)}
        pointerEvents="none"
        style={[styles.leader, { left: Math.min(lineStart, lineEnd), width: Math.max(Math.abs(lineEnd - lineStart), 0), top: spot.y }]}
      />
      <Animated.View entering={FadeInDown.delay(220 + index * 120).duration(420)} style={[styles.label, { left, top }]}>
        <Text style={styles.labelName} numberOfLines={2}>
          {object.name.toUpperCase()}
        </Text>
        {object.description ? (
          <Text style={styles.labelBody} numberOfLines={3}>
            {object.description}
          </Text>
        ) : null}
        {object.parts.length > 0 && (
          <View style={styles.parts}>
            {object.parts.map((part) => (
              <View key={part} style={styles.part}>
                <Text style={styles.partText} numberOfLines={1}>
                  {part}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  top: { position: "absolute", left: 0, right: 0, top: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.l },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  statusText: { color: "#fff", fontFamily: font.semibold, fontSize: 13 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, gap: space.s },
  error: { backgroundColor: "#00000099", borderRadius: 14, padding: space.m },
  errorText: { color: "#FFB3B3", fontFamily: font.medium, fontSize: 14, textAlign: "center" },
  leader: { position: "absolute", height: 1.5, backgroundColor: HOLO, boxShadow: `0 0 8px ${HOLO}` },
  label: {
    position: "absolute",
    width: LABEL_W,
    padding: 12,
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${HOLO}CC`,
    backgroundColor: "#03161ACC",
    boxShadow: `0 0 22px ${HOLO}55, inset 0 0 14px ${HOLO}22`,
  },
  labelName: { color: "#E8FDFF", fontFamily: font.bold, fontSize: 13, letterSpacing: 0.8, textShadowColor: `${HOLO}AA`, textShadowRadius: 10 },
  labelBody: { color: "#BDEFF5", fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  parts: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  part: { borderWidth: StyleSheet.hairlineWidth, borderColor: `${HOLO}99`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  partText: { color: HOLO, fontFamily: font.medium, fontSize: 10.5 },
});
