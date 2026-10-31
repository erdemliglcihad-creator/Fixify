// Small details inside the soft cards. Each one says something about its card, nothing is decoration:
// viewfinder corners for the camera, a voice waveform for FixVoice, a fanned stack of photos for the library.
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export type CardDetail = { kind: "viewfinder" } | { kind: "voice" } | { kind: "photos" } | { kind: "none" };

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

/** Three photos fanned out like a stack in the Photos app; the front one glows with a + to add yours. */
function Photos({ color }: { color: string }) {
  const frames = [
    { rotate: "-12deg", x: -34, opacity: 0.55 },
    { rotate: "10deg", x: 34, opacity: 0.7 },
    { rotate: "0deg", x: 0, opacity: 1 },
  ];
  return (
    <View pointerEvents="none" style={styles.photos}>
      {frames.map((f, i) => {
        const front = i === frames.length - 1;
        return (
          <View key={i} style={[styles.photo, { opacity: f.opacity, transform: [{ translateX: f.x }, { rotate: f.rotate }], borderColor: `${color}88`, boxShadow: front ? `0 8px 24px ${color}66` : undefined }]}>
            <LinearGradient colors={[`${color}55`, `${color}18`]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
            {/* A tiny landscape: sun and hill, so it reads as a photo at a glance. */}
            <View style={[styles.sun, { backgroundColor: `${color}CC` }]} />
            <View style={[styles.hill, { backgroundColor: `${color}66` }]} />
            {front && (
              <View style={[styles.plus, { backgroundColor: "#FFFFFF", boxShadow: `0 0 14px ${color}` }]}>
                <Ionicons name="add" size={18} color="#000008" />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

export function Detail({ detail, color }: { detail: CardDetail; color: string }) {
  if (detail.kind === "viewfinder") return <Viewfinder color={color} />;
  if (detail.kind === "voice") return <Voice color={color} />;
  if (detail.kind === "photos") return <Photos color={color} />;
  return null;
}

const styles = StyleSheet.create({
  finder: { position: "absolute", left: "26%", right: "26%", top: "24%", height: "34%" },
  corner: { position: "absolute", width: 22, height: 22, opacity: 0.85 },
  wave: { position: "absolute", left: 0, right: 0, top: "26%", height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  waveBar: { width: 4, borderRadius: 2 },
  photos: { position: "absolute", left: 0, right: 0, top: "20%", height: 110, alignItems: "center", justifyContent: "center" },
  photo: { position: "absolute", width: 78, height: 100, borderRadius: 14, borderCurve: "continuous", borderWidth: 1, overflow: "hidden", backgroundColor: "#05031A" },
  sun: { position: "absolute", top: 16, right: 16, width: 14, height: 14, borderRadius: 7 },
  hill: { position: "absolute", bottom: -30, left: -10, width: 90, height: 60, borderRadius: 45 },
  plus: { position: "absolute", alignSelf: "center", top: 36, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
