// Web preview: no Skia, the photo goes as it is; the coordinates in the request still say where was tapped.
export function annotate(base64: string, _width: number, _height: number, _points: { x: number; y: number }[]) {
  return base64;
}
