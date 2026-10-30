import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { markersForImage, rectInView } from "../../core/analysis.ts";
import { latestRevision } from "../../core/session.ts";
import type { FixSession, ProblemAnalysis, ResolvedMarker, SessionImage } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { Caption, MarkerBadge } from "../components.tsx";
import { radius, space, useTheme } from "../theme.ts";

/** Markers that can be drawn honestly on one stored image of the session. */
export function markersFor(session: FixSession, analysis: ProblemAnalysis | null, image: SessionImage): ResolvedMarker[] {
  const index = latestRevision(session)?.sentImageIds.indexOf(image.id) ?? -1;
  if (!analysis || index < 0) return [];
  return markersForImage(analysis, index, image.blocks ?? []);
}

/**
 * Image with numbered markers. Solid boxes come from text recognition and are exact;
 * dashed ones are AI estimates. Findings without a reliable position get no marker.
 */
export function AnnotatedImage({
  image,
  markers,
  selected,
  onSelect,
  height,
}: {
  image: SessionImage;
  markers: ResolvedMarker[];
  selected: string | null;
  onSelect: (m: ResolvedMarker) => void;
  height: number;
}) {
  const { c } = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  return (
    <View style={{ height, width: "100%" }} onLayout={onLayout}>
      <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} contentFit="contain" accessibilityIgnoresInvertColors />
      {size.width > 0 &&
        markers.map((m) => {
          const r = rectInView(m.rect, image, size);
          const isSel = selected === m.id;
          const dim = selected !== null && !isSel;
          // Badge sits left of the box so it never covers the text it points at; above it when there is no room.
          const roomLeft = r.x - 32 >= 2;
          const badgeX = roomLeft ? r.x - 32 : Math.min(Math.max(r.x, 2), size.width - 30);
          const badgeY = roomLeft ? Math.min(Math.max(r.y + r.height / 2 - 14, 2), size.height - 30) : Math.max(r.y - 32, 2);
          return (
            <View key={m.id} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: r.x,
                  top: r.y,
                  width: Math.max(r.width, 14),
                  height: Math.max(r.height, 14),
                  borderWidth: isSel ? 3 : 2,
                  borderStyle: m.precision === "estimated" ? "dashed" : "solid",
                  borderColor: c.marker,
                  borderRadius: 6,
                  backgroundColor: c.marker + (isSel ? "30" : "10"),
                  opacity: dim ? 0.35 : 1,
                }}
              />
              <Pressable
                onPress={() => onSelect(m)}
                hitSlop={10}
                style={{ position: "absolute", left: badgeX, top: badgeY }}
                accessibilityRole="button"
                accessibilityLabel={t("Marker %lld: %@", m.number, m.finding.label)}
                accessibilityHint={t("Shows what Fixify found here")}
              >
                <MarkerBadge number={m.number} size={isSel ? 30 : 26} estimated={m.precision === "estimated"} dimmed={dim} />
              </Pressable>
            </View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.card, overflow: "hidden" },
  expand: { position: "absolute", right: 10, bottom: 10, width: 36, height: 36, borderRadius: 18, backgroundColor: "#00000077", alignItems: "center", justifyContent: "center" },
  dots: { position: "absolute", bottom: 14, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  close: { position: "absolute", right: space.l, width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF26", alignItems: "center", justifyContent: "center" },
  zoomHint: { position: "absolute", alignSelf: "center", color: "#FFFFFF99", fontSize: 13 },
});
