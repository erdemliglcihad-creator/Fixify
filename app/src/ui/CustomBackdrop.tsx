// Your own picture or video behind every screen, darkened and slightly blurred so text and cards stay
// readable (like an iOS wallpaper behind widgets). Videos loop without sound and pause in the camera.
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import type { CustomBackground } from "../services/settings.ts";
import { useTheme } from "./theme.ts";

export function CustomBackdrop({ background }: { background: CustomBackground }) {
  const { dark } = useTheme();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {background.kind === "video" ? (
        <VideoBackdrop uri={background.uri} />
      ) : (
        <Image source={{ uri: background.uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={12} />
      )}
      {background.kind === "video" && <BlurView intensity={22} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />}
      {/* The veil that keeps everything on top readable. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? "rgba(0, 0, 8, 0.5)" : "rgba(236, 236, 238, 0.45)" }]} />
    </View>
  );
}

function VideoBackdrop({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  // The camera needs the attention (and the battery): the video waits while it is open.
  const inCamera = usePathname() === "/scan";
  useEffect(() => {
    if (inCamera) player.pause();
    else player.play();
  }, [inCamera, player]);
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />;
}
