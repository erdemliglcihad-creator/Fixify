// Small details inside the soft cards. Each one says something about its card, nothing is decoration:
// viewfinder corners for the camera, a voice waveform for FixVoice, today's photo uploads as dots.
import { StyleSheet, View } from "react-native";

export type CardDetail = { kind: "viewfinder" } | { kind: "voice" } | { kind: "quota"; used: number; total: number } | { kind: "none" };

/** Four corner brackets around the middle of the card, like a camera viewfinder. */
function Viewfinder({ color }: { color: string }) {
  const corner = (pos: object, borders: object) => <View style={[styles.corner, pos, borders, { borderColor: color }]} />;
  return (
    <View pointerEvents="none" style={styles.finder}>
      {corner({ top: 0, left: 0 }, { borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 10 })}
      {corner({ top: 0, right: 0 }, { borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 10 })}
      {corner({ bottom: 0, left: 0 }, { borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 10 })}
      {corner({ bottom: 0, right: 0 }, { borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 10 })}
    </View>
  );
}

const WAVE = [0.25, 0.45, 0.7, 0.4, 0.9, 0.6, 1, 0.55, 0.8, 0.35, 0.6, 0.3, 0.2];

/** A short voice waveform in the middle of the card. */
function Voice({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={styles.wave}>
      {WAVE.map((v, i) => (
        <View key={i} style={[styles.waveBar, { height: 8 + v * 44, backgroundColor: i === 6 ? "#FFFFFF" : color, opacity: 0.45 + v * 0.5 }]} />
      ))}
    </View>
  );
}

/** Today's photo uploads: filled dots are still free, faint ones are used. */
function Quota({ color, used, total }: { color: string; used: number; total: number }) {
  return (
    <View pointerEvents="none" style={styles.quota}>
      {Array.from({ length: total }, (_, i) => {
        const free = i >= used;
        return <View key={i} style={[styles.quotaDot, { backgroundColor: free ? "#FFFFFF" : color, opacity: free ? 0.9 : 0.25, boxShadow: free ? `0 0 8px ${color}` : undefined }]} />;
      })}
    </View>
  );
}

export function Detail({ detail, color }: { detail: CardDetail; color: string }) {
  if (detail.kind === "viewfinder") return <Viewfinder color={color} />;
  if (detail.kind === "voice") return <Voice color={color} />;
  if (detail.kind === "quota") return <Quota color={color} used={detail.used} total={detail.total} />;
  return null;
}

const styles = StyleSheet.create({
  finder: { position: "absolute", left: "26%", right: "26%", top: "24%", height: "34%" },
  corner: { position: "absolute", width: 22, height: 22, opacity: 0.85 },
  wave: { position: "absolute", left: 0, right: 0, top: "26%", height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  waveBar: { width: 4, borderRadius: 2 },
  quota: { position: "absolute", left: "18%", right: "18%", top: "30%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  quotaDot: { width: 12, height: 12, borderRadius: 6 },
});
