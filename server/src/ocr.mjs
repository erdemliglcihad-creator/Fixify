// Text recognition for the Expo app, which has no Apple Vision in Expo Go.
// Runs locally on this computer with Tesseract (German + English). Nothing is sent to Anthropic here.
// Returns lines with boxes normalized to the image (origin top-left), the same shape the Swift app gets from Vision.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";

const cachePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".tesseract-cache");
let workerPromise;

function worker() {
  // One worker, created on first use. The language data (~15 MB) is downloaded once and cached.
  workerPromise ??= createWorker(["deu", "eng"], 1, { cachePath });
  return workerPromise;
}

export async function recognizeLines(buffer, { width, height, minConfidence = 35 }) {
  const w = await worker();
  const { data } = await w.recognize(buffer, {}, { blocks: true });
  const lines = (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((p) => p.lines));
  const blocks = [];
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text || line.confidence < minConfidence || !/[\p{L}\p{N}]/u.test(text)) continue;
    const { x0, y0, x1, y1 } = line.bbox;
    blocks.push({
      id: `t${blocks.length + 1}`,
      text,
      confidence: Math.round(line.confidence) / 100,
      box: {
        x: clamp(x0 / width),
        y: clamp(y0 / height),
        width: clamp((x1 - x0) / width),
        height: clamp((y1 - y0) / height),
      },
    });
  }
  return blocks;
}

export async function shutdownOcr() {
  if (workerPromise) await (await workerPromise).terminate();
  workerPromise = undefined;
}

const clamp = (n) => Math.min(1, Math.max(0, n));
