import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.mjs";
import { AnalysisError } from "../src/analyze.mjs";
import { RateLimiter } from "../src/ratelimit.mjs";
import { validateAnalysis } from "../src/schema.mjs";
import { buildUserContent } from "../src/prompt.mjs";

const sampleAnalysis = () => ({
  title: "Printer offline",
  category: "peripheral",
  summary: "The screen shows a printer offline error.",
  confidenceNote: "Based on the visible message only.",
  canHelp: true,
  cannotHelpReason: null,
  findings: [
    { id: "f1", label: "Error text", detail: "", imageIndex: 0, ocrBlockIds: ["t1", "t9"], box: null, boxConfidence: "none", source: "ocr" },
    { id: "f2", label: "Cable", detail: "", imageIndex: 0, ocrBlockIds: [], box: { x: 0.9, y: 0.2, width: 0.5, height: 0.001 }, boxConfidence: "high", source: "visual" },
    { id: "f3", label: "Other image", detail: "", imageIndex: 3, ocrBlockIds: [], box: null, boxConfidence: "none", source: "visual" },
  ],
  causes: [{ id: "c1", title: "Wi-Fi", explanation: "", likelihood: "likely", evidence: [] }],
  unknowns: [],
  questions: [],
  nextDiagnostic: null,
  steps: [{ id: "s1", title: "Restart", explanation: "", action: "Turn it off and on.", expectedResult: "", pitfalls: [], findingIds: ["f1", "f3"], safetyNote: null }],
  tools: [],
  difficulty: null,
  estimatedMinutes: 5,
  safety: { level: "none", warnings: [], recommendProfessional: false },
  successCriteria: ["Test page prints"],
});

test("validateAnalysis drops dangling references and degenerate boxes", () => {
  const result = validateAnalysis(sampleAnalysis(), { imageCount: 1, ocrIds: new Set(["0:t1"]) });
  assert.equal(result.ok, true);
  const { findings, steps } = result.analysis;
  assert.deepEqual(findings.map((f) => f.id), ["f1", "f2"]);
  assert.deepEqual(findings[0].ocrBlockIds, ["t1"]);
  assert.equal(findings[1].box, null, "box with ~0 height is dropped");
  assert.equal(findings[1].boxConfidence, "none");
  assert.deepEqual(steps[0].findingIds, ["f1"]);
});

test("validateAnalysis clamps boxes into the image", () => {
  const a = sampleAnalysis();
  a.findings[1].box = { x: 0.8, y: -0.1, width: 0.5, height: 0.3 };
  const { analysis } = validateAnalysis(a, { imageCount: 1, ocrIds: new Set() });
  const box = analysis.findings[1].box;
  assert.equal(box.y, 0);
  assert.ok(Math.abs(box.x + box.width - 1) < 1e-9);
});

test("validateAnalysis rejects malformed output", () => {
  const a = sampleAnalysis();
  delete a.steps;
  assert.equal(validateAnalysis(a, { imageCount: 1, ocrIds: new Set() }).ok, false);
});

test("rate limiter enforces minute window and daily cap", () => {
  let t = Date.parse("2026-10-24T10:00:00Z");
  const rl = new RateLimiter({ perMinute: 2, perDay: 3, now: () => t });
  assert.equal(rl.check("a").allowed, true);
  assert.equal(rl.check("a").allowed, true);
  assert.equal(rl.check("a").reason, "minute");
  t += 61_000;
  assert.equal(rl.check("a").allowed, true);
  assert.equal(rl.check("b").reason, "daily");
  t += 86_400_000;
  assert.equal(rl.check("b").allowed, true);
});

test("prompt includes OCR ids and language", () => {
  const content = buildUserContent({
    mode: "initial",
    locale: "de",
    description: "Drucker geht nicht",
    images: [{ mediaType: "image/jpeg", data: "AAAA", ocr: [{ id: "t1", text: "Offline", box: { x: 0.1, y: 0.2, width: 0.3, height: 0.05 } }] }],
  });
  assert.equal(content[1].type, "image");
  const text = content.at(-1).text;
  assert.match(text, /\[t1\] "Offline"/);
  assert.match(text, /German/);
});

async function withServer(options, fn) {
  const server = http.createServer(
    createApp({
      appToken: "secret-token",
      limiter: new RateLimiter({ perMinute: 10, perDay: 100 }),
      info: { version: "test", model: "test-model", configured: true },
      log: { info() {}, warn() {}, error() {} },
      ...options,
    }),
  );
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    server.close();
  }
}

const post = (base, body, token = "secret-token") =>
  fetch(`${base}/v1/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

test("HTTP: auth, validation and success path", async () => {
  let received;
  await withServer(
    {
      analyze: async (req) => {
        received = req;
        return { analysis: sampleAnalysis(), model: "test-model", usage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0 } };
      },
    },
    async (base) => {
      const health = await (await fetch(`${base}/health`)).json();
      assert.equal(health.ok, true);

      assert.equal((await post(base, { mode: "initial", description: "x" }, "wrong")).status, 401);
      assert.equal((await post(base, { mode: "nope" })).status, 400);
      assert.equal((await post(base, { mode: "initial" })).status, 400, "needs image or description");

      const ok = await post(base, { mode: "initial", locale: "de", description: "WLAN weg" });
      assert.equal(ok.status, 200);
      const body = await ok.json();
      assert.equal(body.analysis.title, "Printer offline");
      assert.equal(received.locale, "de");
      assert.deepEqual(received.images, []);
    },
  );
});

test("HTTP: analysis errors map to structured error responses", async () => {
  await withServer(
    {
      analyze: async () => {
        throw new AnalysisError("refused", "declined", 422);
      },
    },
    async (base) => {
      const res = await post(base, { mode: "initial", description: "x" });
      assert.equal(res.status, 422);
      assert.deepEqual(await res.json(), { error: { code: "refused", message: "declined" } });
    },
  );
});
