// Maps a tap on the camera preview to the same spot in the photo. The preview fills the screen ("cover"),
// so the photo is scaled up and its edges are cut off; a tap at 50 % of the screen is not 50 % of the photo.

export type Size = { width: number; height: number };

/** Tap in preview coordinates (0..1 of the view) → spot in the photo (0..1 of the image). */
export function previewToPhoto(tap: { x: number; y: number }, view: Size, photo: Size) {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const shownW = photo.width * scale;
  const shownH = photo.height * scale;
  const offsetX = (shownW - view.width) / 2;
  const offsetY = (shownH - view.height) / 2;
  const clamp = (v: number) => Math.min(Math.max(v, 0), 1);
  return { x: clamp((tap.x * view.width + offsetX) / shownW), y: clamp((tap.y * view.height + offsetY) / shownH) };
}

/** The other way round, to draw labels on a photo shown with "cover" in a view of another shape. */
export function photoToPreview(spot: { x: number; y: number }, view: Size, photo: Size) {
  const scale = Math.max(view.width / photo.width, view.height / photo.height);
  const shownW = photo.width * scale;
  const shownH = photo.height * scale;
  return { x: (spot.x * shownW - (shownW - view.width) / 2) / view.width, y: (spot.y * shownH - (shownH - view.height) / 2) / view.height };
}
