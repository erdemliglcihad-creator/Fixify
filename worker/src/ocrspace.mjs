// Text recognition through OCR.space (free tier: 25,000 requests/month, 1 MB per image).
// Returns lines in the same shape as the local Tesseract proxy and Apple Vision:
// ids t1…tn, boxes normalized to the image with the origin at the top left.

export class OcrError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const clamp = (n) => Math.min(1, Math.max(0, n));

export function linesFromOcrSpace(json, width, height) {
  if (!json || json.IsErroredOnProcessing || json.OCRExitCode >= 3) {
    const detail = Array.isArray(json?.ErrorMessage) ? json.ErrorMessage.join(" ") : json?.ErrorMessage;
    throw new OcrError("ocr_failed", `Text recognition failed${detail ? `: ${detail}` : "."}`);
  }
  const lines = (json.ParsedResults ?? []).flatMap((r) => r?.TextOverlay?.Lines ?? []);
  const blocks = [];
  for (const line of lines) {
    const words = (line.Words ?? []).filter((w) => String(w.WordText ?? "").trim());
    if (!words.length) continue;
    const text = words.map((w) => w.WordText).join(" ").replace(/\s+/g, " ").trim();
    if (!/[\p{L}\p{N}]/u.test(text)) continue;
    const x0 = Math.min(...words.map((w) => w.Left));
    const y0 = Math.min(...words.map((w) => w.Top));
    const x1 = Math.max(...words.map((w) => w.Left + w.Width));
    const y1 = Math.max(...words.map((w) => w.Top + w.Height));
    blocks.push({
      id: `t${blocks.length + 1}`,
      text,
      confidence: 1,
      box: { x: clamp(x0 / width), y: clamp(y0 / height), width: clamp((x1 - x0) / width), height: clamp((y1 - y0) / height) },
    });
  }
  return blocks;
}

export async function recognizeWithOcrSpace({ apiKey, mediaType, data, width, height, endpoint = "https://api.ocr.space/parse/image", fetchImpl = fetch, signal }) {
  // OCR.space rejects files over 1 MB on the free tier (base64 is ~4/3 of the bytes).
  if (data.length * 0.75 > 1_000_000) throw new OcrError("ocr_too_large", "The image is too large for text recognition.", 413);
  const form = new URLSearchParams({
    base64Image: `data:${mediaType};base64,${data}`,
    language: "auto",
    OCREngine: "2",
    isOverlayRequired: "true",
    scale: "true",
  });
  let res;
  try {
    res = await fetchImpl(endpoint, { method: "POST", headers: { apikey: apiKey }, body: form, signal });
  } catch {
    throw new OcrError("ocr_unreachable", "The text recognition service cannot be reached.");
  }
  if (res.status === 403 || res.status === 401) throw new OcrError("ocr_not_configured", "The text recognition key was rejected.", 503);
  if (res.status === 429) throw new OcrError("ocr_rate_limited", "Text recognition is busy right now. Try again later.", 503);
  const json = await res.json().catch(() => null);
  if (typeof json === "string") throw new OcrError("ocr_failed", `Text recognition failed: ${json}`);
  return linesFromOcrSpace(json, width, height);
}
