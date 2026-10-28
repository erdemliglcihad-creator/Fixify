// Draws the tapped spots into the photo as colored rings (1 red, 2 green, 3 blue), so the AI knows exactly
// which object is meant. Native only (Skia); the web preview sends the photo unchanged (annotate.web.ts).
import { Skia } from "@shopify/react-native-skia";

const RINGS = ["#FF2D2D", "#22E06B", "#2F6BFF"];

export function annotate(base64: string, width: number, height: number, points: { x: number; y: number }[]) {
  try {
    const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBase64(base64));
    const surface = Skia.Surface.Make(width, height);
    if (!image || !surface) return base64;
    const canvas = surface.getCanvas();
    canvas.drawImage(image, 0, 0);
    const r = Math.max(width, height) * 0.045;
    points.forEach((p, i) => {
      const paint = Skia.Paint();
      paint.setAntiAlias(true);
      paint.setStyle(1); // stroke
      paint.setStrokeWidth(r * 0.28);
      paint.setColor(Skia.Color(RINGS[i]));
      canvas.drawCircle(p.x * width, p.y * height, r, paint);
    });
    surface.flush();
    return surface.makeImageSnapshot().encodeToBase64(3 /* JPEG */, 85);
  } catch {
    return base64;
  }
}
