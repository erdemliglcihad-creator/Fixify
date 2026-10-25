// Image storage and preparation.
// Phone: files in the app's document folder, named by content hash so duplicates share one file.
// Web preview: data URIs (there is no file system), so the preview can run without a phone.
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";
const dir = () => new Directory(Paths.document, "images");

export type StoredImage = { uri: string; hash: string; width: number; height: number };
export type EncodedImage = { base64: string; width: number; height: number };

async function render(uri: string, width: number, height: number, longEdge: number, compress: number, base64: boolean) {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > longEdge) {
    context.resize(width >= height ? { width: longEdge, height: null } : { width: null, height: longEdge });
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ compress, format: SaveFormat.JPEG, base64 });
}

/** Normalizes orientation, caps size, stores once. Coordinates everywhere refer to this stored image. */
export async function storeImage(uri: string, width: number, height: number): Promise<StoredImage> {
  const result = await render(uri, width, height, isWeb ? 1600 : 2048, 0.85, true);
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, result.base64 ?? result.uri);
  if (isWeb) {
    return { uri: `data:image/jpeg;base64,${result.base64}`, hash, width: result.width, height: result.height };
  }
  const folder = dir();
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  const target = new File(folder, `${hash}.jpg`);
  if (!target.exists) new File(result.uri).moveSync(target);
  return { uri: target.uri, hash, width: result.width, height: result.height };
}

/** Smaller JPEG for OCR and analysis. Same aspect ratio, so normalized boxes stay valid. */
export async function encodeForAnalysis(image: { uri: string; width: number; height: number }): Promise<EncodedImage> {
  const result = await render(image.uri, image.width, image.height, 1568, 0.72, true);
  return { base64: result.base64 ?? "", width: result.width, height: result.height };
}

/** Deletes stored files no session references any more. */
export function removeUnreferenced(candidates: string[], referenced: Set<string>) {
  if (isWeb) return;
  for (const hash of candidates) {
    if (referenced.has(hash)) continue;
    const file = new File(dir(), `${hash}.jpg`);
    if (file.exists) file.delete();
  }
}

export function storageBytes(): number {
  if (isWeb) return 0;
  const folder = dir();
  if (!folder.exists) return 0;
  return folder.list().reduce((sum, item) => sum + (item instanceof File ? item.size : 0), 0);
}

export function deleteAllImages() {
  if (isWeb) return;
  const folder = dir();
  if (folder.exists) folder.delete();
}
