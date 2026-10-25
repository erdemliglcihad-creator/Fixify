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

export function EvidenceGallery({
  session,
  analysis,
  selected,
  onSelect,
  page,
  setPage,
}: {
  session: FixSession;
  analysis: ProblemAnalysis | null;
  selected: string | null;
  onSelect: (m: ResolvedMarker) => void;
  page: number;
  setPage: (p: number) => void;
}) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [full, setFull] = useState(false);
  const pageWidth = width - space.l * 2;
  const all = session.images.flatMap((img) => markersFor(session, analysis, img));

  return (
    <View style={{ gap: space.s }}>
      <View style={[styles.frame, { backgroundColor: c.surface }]}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageWidth))}
          contentOffset={{ x: page * pageWidth, y: 0 }}
        >
          {session.images.map((img) => (
            <View key={img.id} style={{ width: pageWidth }}>
              <AnnotatedImage image={img} markers={markersFor(session, analysis, img)} selected={selected} onSelect={onSelect} height={340} />
            </View>
          ))}
        </ScrollView>
        <Pressable style={styles.expand} onPress={() => setFull(true)} accessibilityLabel={t("Show image full screen")}>
          <Ionicons name="expand" size={18} color="#fff" />
        </Pressable>
        {session.images.length > 1 && (
          <View style={styles.dots}>
            {session.images.map((img, i) => (
              <View key={img.id} style={[styles.dot, { backgroundColor: i === page ? "#fff" : "#FFFFFF66" }]} />
            ))}
          </View>
        )}
      </View>
      {all.length > 0 && (
        <View style={{ flexDirection: "row", gap: space.l }}>
          {all.some((m) => m.precision === "textMatch") && <Legend dashed={false} text={t("Exact (recognized text)")} />}
          {all.some((m) => m.precision === "estimated") && <Legend dashed text={t("Approximate (AI estimate)")} />}
        </View>
      )}
      <FullScreen visible={full} onClose={() => setFull(false)} session={session} analysis={analysis} page={page} selected={selected} onSelect={onSelect} />
    </View>
  );
}

function Legend({ dashed, text }: { dashed: boolean; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 12, height: 12, borderWidth: 1.5, borderColor: c.secondary, borderStyle: dashed ? "dashed" : "solid", borderRadius: 2 }} />
      <Caption style={{ fontSize: 12 }}>{text}</Caption>
    </View>
  );
}

function FullScreen(props: {
  visible: boolean;
  onClose: () => void;
  session: FixSession;
  analysis: ProblemAnalysis | null;
  page: number;
  selected: string | null;
  onSelect: (m: ResolvedMarker) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const image = props.session.images[props.page];
  return (
    <Modal visible={props.visible} animationType="fade" onRequestClose={props.onClose} supportedOrientations={["portrait"]}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {image && (
          // Pinch to zoom (iOS ScrollView zoom).
          <ScrollView maximumZoomScale={5} minimumZoomScale={1} centerContent contentContainerStyle={{ width, height, justifyContent: "center" }}>
            <AnnotatedImage image={image} markers={markersFor(props.session, props.analysis, image)} selected={props.selected} onSelect={props.onSelect} height={height - insets.top - insets.bottom} />
          </ScrollView>
        )}
        <Pressable onPress={props.onClose} style={[styles.close, { top: insets.top + space.s }]} accessibilityLabel={t("Close")}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.zoomHint, { bottom: insets.bottom + space.l }]}>{t("Pinch to zoom")}</Text>
      </View>
    </Modal>
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
