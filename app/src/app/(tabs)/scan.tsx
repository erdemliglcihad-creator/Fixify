import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Crypto from "expo-crypto";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useIsFocused, useLocalSearchParams } from "expo-router";
import * as VideoThumbnails from "expo-video-thumbnails";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useLiveObjects } from "../../services/liveObjects";
import { objectBoxInView, ObjectLayer } from "../../ui/ObjectLayer";
import type { LiveObject } from "../../services/liveObjects";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { t } from "../../i18n/index.ts";
import { addCaptures, draftStore, MAX_CAPTURES, removeCapture, useDraft } from "../../services/draft.ts";
import type { Capture } from "../../services/sessions.ts";
import { space, type, font } from "../../ui/theme.ts";
import { Glass as GlassSurface } from "../../ui/Glass.tsx";

type Mode = "photo" | "video";
type CamState = "starting" | "ready" | "capturing" | "recording" | "extracting";

const MARKER = "#FFB61E";

/** Clear Liquid Glass over the live camera (dark scheme, so white symbols stay legible). */
function Glass({ children, style, interactive }: { children: ReactNode; style?: object; interactive?: boolean }) {
  return (
    <GlassSurface variant="clear" dark interactive={interactive} style={style}>
      {children}
    </GlassSurface>
  );
}

export default function Scan() {
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ library?: string; n?: string }>();
  const draft = useDraft();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [mode, setMode] = useState<Mode>("photo");
  // Tap to identify: tapped objects are cut out and covered by a blue layer that follows them.
  const [view, setView] = useState({ width: 1, height: 1 });
  const [state, setState] = useState<CamState>("starting");
  const live = useLiveObjects(camera, focused && state === "ready" && mode === "photo", view);
  useEffect(() => {
    if (mode !== "photo") live.clear();
  }, [mode]);
  const [torch, setTorch] = useState(false);
  // Pinch to zoom: 0 = widest, 1 = the device's maximum. Small steps feel natural for the finger.
  const [zoom, setZoom] = useState(0);
  const zoomStart = useRef(0);
  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onBegin(() => {
      zoomStart.current = zoom;
    })
    .onUpdate((e) => {
      setZoom(Math.min(Math.max(zoomStart.current + (e.scale - 1) * 0.18, 0), 1));
    });
  const tap = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(12)
    .onEnd((e) => toggleObject(e.x, e.y));
  const cameraGestures = Gesture.Simultaneous(pinch, tap);

  /** Tap an object to cut it out and cover it (up to three); tap it again to remove it. */
  async function toggleObject(px: number, py: number) {
    if (mode !== "photo" || state !== "ready") return;
    // Only taps into the picture itself, not near the buttons at the top and bottom.
    if (py < insets.top + 80 || py > view.height - insets.bottom - 230) return;
    const changed = await live.tapAt(px, py);
    if (Platform.OS !== "web") {
      if (changed) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordStart, setRecordStart] = useState(0);
  const [now, setNow] = useState(Date.now());
  const handledLibrary = useRef<string | undefined>(undefined);

  const full = draft.captures.length >= MAX_CAPTURES;
  const category = draft.category ?? "general";

  useEffect(() => {
    if (focused && permission && !permission.granted && permission.canAskAgain) requestPermission();
  }, [focused, permission, requestPermission]);

  useEffect(() => {
    // Opened from "Photos": show the picker once per navigation.
    if (focused && params.library === "1" && handledLibrary.current !== params.n) {
      handledLibrary.current = params.n;
      pickFromLibrary();
    }
  }, [focused, params.library, params.n]);

  useEffect(() => {
    if (state !== "recording") return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [state]);

  function close() {
    setTorch(false);
    if (router.canGoBack()) router.back();
    else router.navigate("/");
  }

  function add(captures: Capture[]) {
    if (!captures.length) return;
    addCaptures(captures);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function takePhoto() {
    if (!camera.current || state !== "ready") return;
    setState("capturing");
    setFlash(true);
    try {
      // The live layer grabs small stills to follow objects; let it finish before the real photo.
      live.pause(true);
      for (let i = 0; i < 30 && live.isWorking(); i++) await new Promise((r) => setTimeout(r, 50));
      const pic = await camera.current.takePictureAsync({ quality: 0.9, shutterSound: false });
      const capture: Capture = { id: Crypto.randomUUID(), uri: pic.uri, width: pic.width, height: pic.height, source: "camera" };
      // Named objects go along as a note, so the Fix analysis knows what was marked.
      const names = live.objects.map((o) => o.name).filter((n): n is string => Boolean(n));
      if (names.length) draftStore.set((d) => ({ ...d, note: t("Marked in the photo: %@", names.join(", ")) }));
      live.clear();
      add([capture]);
    } catch {
      setError(t("The photo could not be taken. Try again."));
    } finally {
      setFlash(false);
      live.pause(false);
      setState("ready");
    }
  }

  async function toggleRecording() {
    if (!camera.current) return;
    if (state === "recording") {
      camera.current.stopRecording();
      return;
    }
    if (state !== "ready") return;
    setState("recording");
    const started = Date.now();
    setRecordStart(started);
    try {
      const video = await camera.current.recordAsync({ maxDuration: 10 });
      const duration = Math.max(500, Date.now() - started);
      if (!video?.uri) return;
      setState("extracting");
      // Three evenly spaced frames are analyzed like photos. There is no continuous video analysis.
      const frames: Capture[] = [];
      for (const f of [0.15, 0.5, 0.85]) {
        const thumb = await VideoThumbnails.getThumbnailAsync(video.uri, { time: Math.round(duration * f), quality: 0.9 });
        frames.push({ id: Crypto.randomUUID(), uri: thumb.uri, width: thumb.width, height: thumb.height, source: "videoFrame" });
      }
      add(frames.slice(0, MAX_CAPTURES - draftStore.get().captures.length));
    } catch {
      setError(t("The video could not be recorded. Try again."));
    } finally {
      setState("ready");
    }
  }

  async function pickFromLibrary() {
    const room = MAX_CAPTURES - draftStore.get().captures.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: room, quality: 1 });
    if (result.canceled) return;
    add(result.assets.map((a) => ({ id: Crypto.randomUUID(), uri: a.uri, width: a.width, height: a.height, source: "library" as const })));
  }

  function next(describeOnly = false) {
    draftStore.set((d) => ({ ...d, describeOnly }));
    router.push("/review");
  }

  const denied = permission && !permission.granted;
  const status = denied
    ? t("No camera access")
    : state === "starting"
      ? t("Starting camera")
      : state === "capturing"
        ? t("Capturing")
        : state === "recording"
          ? `${t("Recording")} ${Math.floor((now - recordStart) / 1000)} s`
          : state === "extracting"
            ? t("Taking frames from the video")
            : mode === "video"
              ? t("Ready · up to 10 s")
              : t("Ready");


  return (
    <View style={styles.root} onLayout={(e) => setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      {focused && permission?.granted ? (
        <GestureDetector gesture={cameraGestures}>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode={mode === "video" ? "video" : "picture"}
          mute
          enableTorch={torch}
          // No system shutter flash: the live object layer takes small stills in the background. The real
          // photo still gets Fixify's own flash (only when the photo button is pressed).
          animateShutter={false}
          // "off" = keep refocusing automatically. ("on" focuses once and then locks, which felt slow.)
          autofocus="off"
          zoom={zoom}
          onCameraReady={() => setState("ready")}
          onMountError={() => setError(t("No camera is available on this device."))}
        />
        </GestureDetector>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { padding: space.xxl, gap: space.l }]}>
          {denied && (
            <>
              <Ionicons name="camera-outline" size={44} color="#FFFFFFCC" />
              <Text style={[type.title, { color: "#fff", textAlign: "center" }]}>{t("Camera access is off")}</Text>
              <Text style={[type.body, { color: "#FFFFFFBB", textAlign: "center" }]}>
                {t("You can still choose a photo or screenshot, or describe the problem in words.")}
              </Text>
              {permission?.canAskAgain ? (
                <GlassButton label={t("Allow camera")} onPress={requestPermission} />
              ) : (
                <GlassButton label={t("Open iOS Settings")} onPress={() => Linking.openSettings()} />
              )}
            </>
          )}
        </View>
      )}

      <ObjectLayer items={live.objects} view={view} />
      {live.objects.map((o) => (
        <ObjectName key={o.id} object={o} view={view} onRemove={() => live.remove(o.id)} />
      ))}

      {flash && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#ffffff88" }]} />}

      <View style={[styles.overlay, { paddingTop: insets.top + space.s, paddingBottom: insets.bottom + space.s }]} pointerEvents="box-none">
        <View style={styles.topBar}>
          <RoundButton icon="close" label={t("Close camera")} onPress={close} />
          {/* Only while something is happening (recording, frames); no hints over the picture otherwise. */}
          {state === "recording" || state === "extracting" ? (
            <Glass style={styles.statusPill}>
              <View style={[styles.dot, { backgroundColor: state === "recording" ? "#FF3B30" : "#FFFFFF60" }]} />
              <Text style={styles.statusText}>{status}</Text>
            </Glass>
          ) : (
            <View />
          )}
          <RoundButton icon={torch ? "flashlight" : "flashlight-outline"} label={torch ? t("Turn light off") : t("Turn light on")} onPress={() => setTorch((v) => !v)} />
        </View>

        {zoom > 0.01 && (
          <Pressable onPress={() => setZoom(0)} style={styles.zoomPill} accessibilityRole="button" accessibilityLabel={t("Reset zoom")}>
            <Glass style={styles.zoomInner}>
              <Ionicons name="search" size={13} color="#fff" />
              <Text style={styles.statusText}>{`${Math.round(zoom * 100)}%`}</Text>
            </Glass>
          </Pressable>
        )}

        <View style={{ flex: 1 }} pointerEvents="none" />

        {draft.captures.length > 0 && (
          <View style={styles.stripRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.s, paddingTop: 8 }}>
              {draft.captures.map((cap) => (
                <View key={cap.id}>
                  <Image source={{ uri: cap.uri }} style={styles.thumb} contentFit="cover" />
                  <Pressable style={styles.remove} onPress={() => removeCapture(cap.id)} accessibilityLabel={t("Remove photo")} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
            <Pressable style={styles.next} onPress={() => next()} accessibilityRole="button">
              <Text style={[type.headline, { color: "#000" }]}>{t("Next")}</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </Pressable>
          </View>
        )}

        <Glass style={styles.modes}>
          {(["photo", "video"] as const).map((m) => (
            <Pressable
              key={m}
              disabled={state === "recording" || state === "extracting"}
              onPress={() => {
                setMode(m);
                setState(permission?.granted ? "starting" : "ready");
              }}
              style={[styles.mode, mode === m && { backgroundColor: MARKER }]}
              aria-selected={mode === m}
            >
              <Text style={{ color: mode === m ? "#000" : "#fff", fontFamily: font.semibold, fontSize: 13 }}>{m === "photo" ? t("Photo") : t("Video")}</Text>
            </Pressable>
          ))}
        </Glass>

        <View style={styles.controls}>
          <RoundButton icon="images-outline" size={52} label={t("Choose from photos")} onPress={pickFromLibrary} disabled={full} />
          <Pressable
            onPress={mode === "photo" ? takePhoto : toggleRecording}
            disabled={full || !(state === "ready" || state === "recording")}
            style={[styles.shutter, { opacity: full ? 0.4 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={mode === "video" ? (state === "recording" ? t("Stop recording") : t("Record video")) : t("Take photo")}
            accessibilityHint={full ? t("Maximum number of photos reached") : undefined}
          >
            {state === "recording" ? (
              <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: "#FF3B30" }} />
            ) : (
              <View style={[styles.shutterInner, { backgroundColor: mode === "video" ? "#FF3B30" : "#fff" }]}>
                {(state === "capturing" || state === "extracting") && <ActivityIndicator color="#000" />}
              </View>
            )}
          </Pressable>
          <RoundButton icon="chatbubble-ellipses-outline" size={52} label={t("Describe the problem instead")} onPress={() => next(true)} />
        </View>
      </View>

      {error && (
        <Pressable style={[styles.error, { top: insets.top + 70 }]} onPress={() => setError(null)}>
          <Text style={{ color: "#fff", fontSize: 14 }}>{error}</Text>
        </Pressable>
      )}
    </View>
  );
}

function RoundButton({ icon, label, onPress, size = 44, disabled }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; size?: number; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ opacity: disabled ? 0.4 : 1 }}>
      <Glass interactive style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={size * 0.45} color="#fff" />
      </Glass>
    </Pressable>
  );
}

function GlassButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Glass interactive style={{ borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 }}>
        <Text style={[type.headline, { color: "#fff" }]}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

/** The object's name, floating just above it (follows it). Tapping the name removes the object's area. */
function ObjectName({ object, view, onRemove }: { object: LiveObject; view: { width: number; height: number }; onRemove: () => void }) {
  if (object.name === null) return null;
  const box = objectBoxInView(object, view);
  const cx = Math.min(Math.max(box.x + box.w / 2, 70), view.width - 70);
  const top = Math.max(box.y - 44, 90);
  return (
    <View pointerEvents="box-none" style={[styles.nameWrap, { left: cx - 120, top }]}>
      <Pressable onPress={onRemove} hitSlop={10} accessibilityRole="button" accessibilityLabel={t("Remove %@", object.name ?? "")}>
        <Glass style={styles.namePill}>
          {object.name === undefined ? <ActivityIndicator size="small" color="#BFE3FF" /> : <Text style={styles.nameText}>{object.name}</Text>}
        </Glass>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  nameWrap: { position: "absolute", width: 240, alignItems: "center" },
  namePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#5BB0FF99", boxShadow: "0 0 18px #3B9BFF88" },
  nameText: { color: "#fff", fontFamily: font.semibold, fontSize: 14, letterSpacing: 0.2 },
  zoomPill: { alignSelf: "center", marginTop: space.s },
  zoomInner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, paddingHorizontal: space.l, gap: space.m },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  statusText: { color: "#fff", fontSize: 13, fontFamily: font.semibold },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stripRow: { flexDirection: "row", alignItems: "center", gap: space.s },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  remove: { position: "absolute", top: -8, right: -8 },
  next: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: MARKER, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11 },
  modes: { flexDirection: "row", alignSelf: "center", borderRadius: 22, padding: 4, gap: 4 },
  mode: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.s },
  shutter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: "#fff", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  error: { position: "absolute", left: space.l, right: space.l, backgroundColor: "#C62828E6", padding: space.m, borderRadius: 12 },
});
