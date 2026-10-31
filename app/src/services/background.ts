// Your own background: a picture or video from the photo library, copied into the app so it stays after
// the picker's cache is cleared. Only one at a time; choosing a new one deletes the old file.
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import { settingsStore, updateSettings, type CustomBackground } from "./settings.ts";

const folder = () => new Directory(Paths.document, "background");

function deleteFile(bg: CustomBackground | null) {
  if (!bg || Platform.OS === "web") return;
  try {
    const f = new File(bg.uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/** Opens the photo library for one picture or video. Returns false when nothing was chosen. */
export async function pickBackground(): Promise<boolean> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 1, videoMaxDuration: 60 });
  if (result.canceled || !result.assets[0]) return false;
  const asset = result.assets[0];
  const kind = asset.type === "video" ? "video" : "image";
  let uri = asset.uri;
  if (Platform.OS !== "web") {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const ext = asset.uri.split(".").pop()?.split("?")[0] || (kind === "video" ? "mov" : "jpg");
    const target = new File(dir, `background-${Date.now()}.${ext}`);
    new File(asset.uri).copy(target);
    uri = target.uri;
  }
  const previous = settingsStore.get().background;
  updateSettings({ background: { uri, kind } });
  deleteFile(previous);
  return true;
}

export function removeBackground() {
  deleteFile(settingsStore.get().background);
  updateSettings({ background: null });
}
