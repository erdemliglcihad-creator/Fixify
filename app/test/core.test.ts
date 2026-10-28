/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawnRect, markersForImage, rectInView, validateAnalysis, InvalidAnalysisError } from "../src/core/analysis.ts";
import { carryOverStates, currentStep, hasNewObservation, imagesToSend, progress, searchText } from "../src/core/session.ts";
import { formatString } from "../src/core/format.ts";
import type { FixSession, ProblemAnalysis, TextBlock } from "../src/core/types.ts";

const analysis = (): ProblemAnalysis => ({
  title: "Printer offline",
  category: "peripheral",
  summary: "The screen shows a printer offline error.",
  confidenceNote: "",
  canHelp: true,
  cannotHelpReason: null,
  findings: [
    { id: "f1", label: "Error text", detail: "", imageIndex: 0, ocrBlockIds: ["t1", "t2"], box: null, boxConfidence: "none", source: "ocr" },
    { id: "f2", label: "Cable", detail: "", imageIndex: 0, ocrBlockIds: [], box: { x: 0.5, y: 0.5, width: 0.2, height: 0.1 }, boxConfidence: "medium", source: "visual" },
    { id: "f3", label: "Light", detail: "", imageIndex: 0, ocrBlockIds: [], box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 }, boxConfidence: "low", source: "visual" },
    { id: "f4", label: "Elsewhere", detail: "", imageIndex: 5, ocrBlockIds: [], box: null, boxConfidence: "none", source: "visual" },
  ],
  causes: [],
  unknowns: [],
  questions: [],
  nextDiagnostic: null,
  steps: [
    { id: "s1", title: "Restart printer", explanation: "", action: "Turn it off and on.", expectedResult: "", pitfalls: [], findingIds: ["f1", "f4"], safetyNote: null },
    { id: "s2", title: "Print test page", explanation: "", action: "Print.", expectedResult: "", pitfalls: [], findingIds: [], safetyNote: null },
  ],
  tools: [],
  difficulty: null,
  estimatedMinutes: null,
  safety: { level: "none", warnings: [], recommendProfessional: false },
  successCriteria: ["A test page prints"],
});

const blocks: TextBlock[] = [
  { id: "t1", text: "Printer", box: { x: 0.1, y: 0.2, width: 0.2, height: 0.05 }, confidence: 1 },
  { id: "t2", text: "offline", box: { x: 0.35, y: 0.2, width: 0.2, height: 0.07 }, confidence: 1 },
];

const session = (a = analysis()): FixSession => ({
  id: "s",
  title: "Drucker",
  createdAt: 0,
  updatedAt: 0,
  status: "active",
  category: null,
  description: "druckt nicht",
  images: [],
  revisions: [{ id: "r1", number: 1, createdAt: 100, analysis: a, provider: "test", trigger: "initial", sentImageIds: [] }],
  events: [],
  stepStates: {},
  answers: [],
  outcomeNote: null,
});

test("OCR findings use the union of their text boxes", () => {
  const m = markersForImage(analysis(), 0, blocks);
  const text = m.find((x) => x.id === "f1")!;
  assert.equal(text.precision, "textMatch");
  assert.ok(Math.abs(text.rect.width - 0.45) < 1e-9);
  assert.ok(Math.abs(text.rect.height - 0.07) < 1e-9);
  assert.deepEqual(m.map((x) => x.id), ["f1", "f2"], "low-confidence and other-image findings are not drawn");
  assert.equal(m[1].precision, "estimated");
});

test("geometry: aspect fit and fill", () => {
  assert.deepEqual(rectInView({ x: 0.5, y: 0.5, width: 0.5, height: 0.25 }, { width: 1000, height: 2000 }, { width: 400, height: 400 }),
    { x: 200, y: 200, width: 100, height: 100 });
  assert.deepEqual(drawnRect({ width: 1000, height: 2000 }, { width: 400, height: 400 }, true), { x: 0, y: -200, width: 400, height: 800 });
});

test("validation drops findings for unsent images and rejects duplicates", () => {
  const v = validateAnalysis(analysis(), 1);
  assert.deepEqual(v.findings.map((f) => f.id), ["f1", "f2", "f3"]);
  assert.deepEqual(v.steps[0].findingIds, ["f1"]);
  const dup = analysis();
  dup.steps[1].id = "s1";
  assert.throws(() => validateAnalysis(dup, 1), InvalidAnalysisError);
  assert.throws(() => validateAnalysis({ title: "x" }, 1), InvalidAnalysisError);
});

test("progress and current step follow step states", () => {
  const s = session();
  assert.equal(progress(s), 0);
  assert.equal(currentStep(s)?.id, "s1");
  s.stepStates = { s1: "failed" };
  assert.equal(currentStep(s)?.id, "s1", "a failed step stays current");
  s.stepStates = { s1: "done", s2: "skipped" };
  assert.equal(progress(s), 1);
  assert.equal(currentStep(s), null);
});

test("replanning keeps state only for identical steps", () => {
  const next = analysis();
  next.steps[1].title = "Reinstall driver";
  assert.deepEqual(carryOverStates(analysis(), { s1: "done", s2: "failed" }, next), { s1: "done" });
});

test("new observation is detected after the latest analysis", () => {
  const s = session();
  assert.equal(hasNewObservation(s), false);
  s.images.push({ id: "i", createdAt: 200, uri: "", hash: "", width: 1, height: 1, source: "camera", blocks: [] });
  assert.equal(hasNewObservation(s), true);
});

test("images to send: original first, then newest", () => {
  assert.deepEqual(imagesToSend([1, 2, 3, 4, 5], 2), [1, 5]);
  assert.deepEqual(imagesToSend([1, 2, 3, 4, 5], 4), [1, 3, 4, 5]);
  assert.deepEqual(imagesToSend([1], 4), [1]);
  assert.deepEqual(imagesToSend([1, 2], 1), [1]);
});

test("search text covers description, analysis and steps", () => {
  const t = searchText(session());
  for (const s of ["druckt nicht", "printer offline", "print test page"]) assert.ok(t.includes(s), s);
});

test("format strings use catalog placeholders", () => {
  assert.equal(formatString("Step %lld of %lld", [2, 5]), "Step 2 of 5");
  assert.equal(formatString("Schritt %1$lld von %2$lld", [2, 5]), "Schritt 2 von 5");
  assert.equal(formatString("Next: %@", ["Restart"]), "Next: Restart");
  assert.equal(formatString("100%%", []), "100%");
});

test("relative dates work without Intl", async () => {
  const { agoParts, formatDate, formatDateTime } = await import("../src/core/format.ts");
  const now = new Date(2026, 9, 27, 15, 0).getTime();
  assert.deepEqual(agoParts(now - 20_000, now), { unit: "now", n: 0 });
  assert.deepEqual(agoParts(now - 5 * 60_000, now), { unit: "minutes", n: 5 });
  assert.deepEqual(agoParts(now - 3 * 3_600_000, now), { unit: "hours", n: 3 });
  assert.deepEqual(agoParts(now - 30 * 3_600_000, now), { unit: "yesterday", n: 1 });
  assert.deepEqual(agoParts(now - 4 * 86_400_000, now), { unit: "days", n: 4 });
  assert.equal(agoParts(now - 10 * 86_400_000, now).unit, "date");
  assert.equal(formatDate(now, "de"), "27.10.2026");
  assert.equal(formatDate(now, "en"), "10/27/2026");
  assert.equal(formatDateTime(new Date(2026, 9, 27, 9, 5).getTime(), "de"), "27.10.2026, 09:05");
});

// --- Profile from the first-launch questions ---
import { emptyProfile, firstName, profileSummary } from "../src/core/profile.ts";

test("profile summary describes the user for the AI and leaves out the source", () => {
  const p = { ...emptyProfile(), name: "  Cihad Erdem ", why: "family" as const, topics: ["network" as const, "tv" as const], devices: ["iphone" as const], help: "voice" as const, source: "tiktok" as const };
  const s = profileSummary(p)!;
  assert.match(s, /Their name is Cihad Erdem/);
  assert.match(s, /helps family and friends/);
  assert.match(s, /Wi-Fi and internet, TV and streaming/);
  assert.match(s, /iPhone/);
  assert.match(s, /talking it through/);
  assert.doesNotMatch(s, /tiktok/i);
  assert.equal(firstName(p), "Cihad");
});

test("an empty or skipped profile sends nothing", () => {
  assert.equal(profileSummary(null), null);
  assert.equal(profileSummary(emptyProfile()), null);
  assert.equal(firstName(emptyProfile()), null);
});

// --- Tap to identify: preview taps → photo spots ---
import { photoToPreview, previewToPhoto } from "../src/core/tap.ts";

test("a tap on the cropped camera preview lands on the right spot in the photo", () => {
  const view = { width: 390, height: 844 }; // iPhone screen
  const photo = { width: 3024, height: 4032 }; // 3:4 portrait photo, sides cut off in the preview
  assert.deepEqual(previewToPhoto({ x: 0.5, y: 0.5 }, view, photo), { x: 0.5, y: 0.5 });
  const left = previewToPhoto({ x: 0, y: 0.5 }, view, photo);
  assert.ok(left.x > 0.15 && left.x < 0.2, `left edge of the screen is ${left.x} of the photo`);
  assert.equal(left.y, 0.5);
  const back = photoToPreview(previewToPhoto({ x: 0.3, y: 0.7 }, view, photo), view, photo);
  assert.ok(Math.abs(back.x - 0.3) < 1e-9 && Math.abs(back.y - 0.7) < 1e-9);
});

// --- Tap to cut out an object (no ML) ---
import { maskRuns, segmentAt } from "../src/core/segment.ts";

/** 120×160 frame: grey gradient background with a red "device" (30..70 × 40..110) and a bright glare spot inside. */
function frame() {
  const w = 120, h = 160;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= 30 && x < 70 && y >= 40 && y < 110;
      const glare = x >= 45 && x < 50 && y >= 60 && y < 65;
      const bg = 90 + Math.round((x + y) / 6);
      px[i] = glare ? 250 : inside ? 200 + ((x * 7 + y) % 9) : bg;
      px[i + 1] = glare ? 250 : inside ? 40 + ((x + y * 3) % 7) : bg;
      px[i + 2] = glare ? 250 : inside ? 35 : bg;
      px[i + 3] = 255;
    }
  }
  return { px, w, h };
}

test("tapping the object cuts out its shape, fills glare holes and gives its center for tracking", () => {
  const { px, w, h } = frame();
  const s = segmentAt(px, w, h, { x: 50 / 119, y: 75 / 159 })!;
  assert.ok(s, "found an object");
  assert.equal(s.area, 40 * 70); // the whole red rectangle, glare hole filled
  assert.ok(Math.abs(s.box.x - 30 / 120) < 0.01 && Math.abs(s.box.w - 40 / 120) < 0.01);
  assert.ok(Math.abs(s.cx - 49.5 / 119) < 0.01 && Math.abs(s.cy - 74.5 / 159) < 0.01);
  assert.equal(maskRuns(s).length, 70); // one run per row
});

test("tapping plain background is not treated as an object", () => {
  const w = 60, h = 80;
  const px = new Uint8Array(w * h * 4).fill(128);
  assert.equal(segmentAt(px, w, h, { x: 0.5, y: 0.5 }), null);
});

test("the outline of a cut-out object goes all the way around it", async () => {
  const { maskOutline } = await import("../src/core/segment.ts");
  const { px, w, h } = frame();
  const s = segmentAt(px, w, h, { x: 50 / 119, y: 75 / 159 })!;
  const outline = maskOutline(s, 1);
  // Perimeter of a 40×70 block traced pixel by pixel.
  assert.ok(outline.length >= 2 * (40 + 70) - 8 && outline.length <= 2 * (40 + 70), `outline has ${outline.length} points`);
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  assert.equal(Math.min(...xs), 30.5);
  assert.equal(Math.max(...xs), 69.5);
  assert.equal(Math.min(...ys), 40.5);
  assert.equal(Math.max(...ys), 109.5);
});

test("the layer shape is one calm area with only a few corners", async () => {
  const { objectShape } = await import("../src/core/segment.ts");
  // A ragged blob: a block with jagged teeth along its top edge.
  const w = 100, h = 100;
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const tooth = y >= 25 && y < 30 && x % 6 < 3;
      const inside = x >= 20 && x < 80 && ((y >= 30 && y < 80) || tooth);
      px[i] = inside ? 30 : 230;
      px[i + 1] = inside ? 90 : 230;
      px[i + 2] = inside ? 220 : 230;
      px[i + 3] = 255;
    }
  }
  const s = segmentAt(px, w, h, { x: 0.5, y: 0.55 })!;
  const shape = objectShape(s);
  assert.ok(shape.length >= 3 && shape.length <= 8, `${shape.length} corners`);
  const xs = shape.map((p) => p.x);
  assert.ok(Math.min(...xs) <= 21 && Math.max(...xs) >= 79, "still covers the whole width");
});
