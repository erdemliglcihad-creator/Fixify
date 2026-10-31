// Your own backgrounds: pictures and videos from the photo library, copied into the app so they stay after
// the picker's cache is cleared. Several can be kept; one (or the default look) is in use at a time.
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as VideoThumbnails from "expo-video-thumbnails";
import { Platform } from "react-native";
import { settingsStore, updateSettings, type CustomBackground } from "./settings.ts";

const isWeb = Platform.OS === "web";
const folder = () => new Directory(Paths.document, "background");

/** Copies a picked file into the app. If that fails, the picked file is used as is, so the choice still works. */
function keep(uri: string, name: string): string {
  if (isWeb) return uri;
  try {
    const dir = folder();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const target = new File(dir, name);
    new File(uri).copy(target);
    return target.uri;
  } catch {
    return uri;
  }
}

function remove(uri: string | null) {
  if (!uri || isWeb || !uri.includes("/background/")) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

/**
 * Opens the photo library for one or more pictures or videos and adds them. The first one picked
 * is put in use right away. Returns how many were added.
 */
export async function addBackgrounds(): Promise<number> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], allowsMultipleSelection: true, selectionLimit: 10, quality: 1, videoMaxDuration: 60 });
  if (result.canceled || !result.assets.length) return 0;
  const added: CustomBackground[] = [];
  for (const asset of result.assets) {
    const id = Crypto.randomUUID();
    const kind = asset.type === "video" ? "video" : "image";
    const ext = asset.uri.split(".").pop()?.split("?")[0]?.slice(0, 5) || (kind === "video" ? "mov" : "jpg");
    const uri = keep(asset.uri, `${id}.${isWeb ? "bin" : ext}`);
    let thumb: string | null = null;
    if (kind === "video" && !isWeb) {
      try {
        const still = await VideoThumbnails.getThumbnailAsync(uri, { time: 0, quality: 0.7 });
        thumb = keep(still.uri, `${id}-thumb.jpg`);
      } catch {
        thumb = null;
      }
    }
    added.push({ id, uri, kind, thumb });
  }
  const s = settingsStore.get();
  updateSettings({ backgrounds: [...added, ...(s.backgrounds ?? [])], backgroundId: added[0].id });
  return added.length;
}

/** Puts a background in use (null = the default look). */
export function selectBackground(id: string | null) {
  updateSettings({ backgroundId: id });
}

export function deleteBackground(id: string) {
  const s = settingsStore.get();
  const bg = s.backgrounds.find((b) => b.id === id);
  if (!bg) return;
  remove(bg.uri);
  remove(bg.thumb);
  updateSettings({ backgrounds: s.backgrounds.filter((b) => b.id !== id), backgroundId: s.backgroundId === id ? null : s.backgroundId });
}
