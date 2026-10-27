import { test } from "node:test";
import assert from "node:assert/strict";
import { linesFromOcrSpace, recognizeWithOcrSpace, OcrError } from "../src/ocrspace.mjs";
import { createOpenAIAnalyzer, extractJson, normalizeLoose, toOpenAIContent } from "../src/openai.mjs";

const ocrResponse = {
  OCRExitCode: 1,
  IsErroredOnProcessing: false,
  ParsedResults: [
    {
      TextOverlay: {
        Lines: [
          { Words: [{ WordText: "Printer", Left: 100, Top: 120, Width: 200, Height: 50 }, { WordText: "offline", Left: 320, Top: 125, Width: 190, Height: 48 }] },
          { Words: [{ WordText: "–", Left: 10, Top: 10, Width: 5, Height: 5 }] },
          { Words: [{ WordText: "0x8007", Left: 100, Top: 560, Width: 160, Height: 30 }] },
        ],
      },
    },
  ],
};

test("OCR.space lines become normalized top-left blocks", () => {
  const blocks = linesFromOcrSpace(ocrResponse, 1200, 800);
  assert.deepEqual(blocks.map((b) => b.text), ["Printer offline", "0x8007"], "punctuation-only lines are dropped");
  assert.deepEqual(blocks.map((b) => b.id), ["t1", "t2"]);
  const b = blocks[0].box;
  assert.ok(Math.abs(b.x - 100 / 1200) < 1e-9 && Math.abs(b.y - 120 / 800) < 1e-9);
  assert.ok(Math.abs(b.width - 410 / 1200) < 1e-9 && Math.abs(b.height - 53 / 800) < 1e-9);
});

test("OCR.space errors and size limits are reported", async () => {
  assert.throws(() => linesFromOcrSpace({ IsErroredOnProcessing: true, ErrorMessage: ["bad"] }, 1, 1), OcrError);
  await assert.rejects(
    recognizeWithOcrSpace({ apiKey: "k", mediaType: "image/jpeg", data: "A".repeat(1_500_000), width: 1, height: 1, fetchImpl: async () => assert.fail("no call") }),
    (e) => e.code === "ocr_too_large",
  );
  let sent;
  const blocks = await recognizeWithOcrSpace({
    apiKey: "key",
    mediaType: "image/jpeg",
    data: "QUJD",
    width: 1200,
    height: 800,
    fetchImpl: async (url, init) => {
      sent = { url, key: init.headers.apikey, body: String(init.body) };
      return new Response(JSON.stringify(ocrResponse));
    },
  });
  assert.equal(blocks.length, 2);
  assert.equal(sent.key, "key");
  assert.match(sent.body, /isOverlayRequired=true/);
  assert.match(sent.body, /base64Image=data%3Aimage%2Fjpeg%3Bbase64%2CQUJD/);
});

test("content blocks convert to OpenAI image_url parts", () => {
  const parts = toOpenAIContent([{ type: "text", text: "hi" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAA" } }]);
  assert.deepEqual(parts, [{ type: "text", text: "hi" }, { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAA" } }]);
});

test("JSON is extracted from fenced or reasoning output", () => {
  assert.deepEqual(extractJson('<think>hmm</think>\n```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => extractJson("no json here"));
});

test("loose normalization fills gaps but never invents content", () => {
  const n = normalizeLoose({ title: "T", summary: "S", category: "Network", steps: [{ title: "Do", action: "Act" }] });
  assert.equal(n.category, "network");
  assert.deepEqual(n.findings, []);
  assert.deepEqual(n.causes, []);
  assert.equal(n.steps.length, 1);
  assert.equal(n.steps[0].id, "s1");
  assert.equal(n.safety.level, "none");
  assert.equal(n.nextDiagnostic, null);
});

const request = {
  mode: "initial",
  locale: "de",
  description: "Drucker offline",
  categoryHint: null,
  images: [{ mediaType: "image/jpeg", data: "AAA", ocr: [{ id: "t1", text: "Printer offline", box: { x: 0.1, y: 0.1, width: 0.3, height: 0.05 } }] }],
  history: [],
  answers: [],
  feedback: null,
  previousAnalysis: null,
};

const modelOutput = {
  title: "Drucker offline",
  category: "peripheral",
  summary: "Der Drucker ist nicht erreichbar.",
  confidenceNote: "Nur anhand der Meldung.",
  canHelp: true,
  cannotHelpReason: null,
  findings: [{ id: "f1", label: "Meldung", detail: "", imageIndex: 0, ocrBlockIds: ["t1", "t9"], box: null, boxConfidence: "none", source: "ocr" }],
  causes: [],
  unknowns: [],
  questions: [],
  nextDiagnostic: null,
  steps: [{ id: "s1", title: "Neu starten", explanation: "", action: "Aus und an.", expectedResult: "", pitfalls: [], findingIds: ["f1"], safetyNote: null }],
  tools: [],
  difficulty: "easy",
  estimatedMinutes: 5,
  safety: { level: "none", warnings: [], recommendProfessional: false },
  successCriteria: ["Testseite druckt"],
};

test("analyzer sends system + image to the provider and validates the answer", async () => {
  let sent;
  const analyze = createOpenAIAnalyzer({
    baseUrl: "https://api.example.com/openai/v1/",
    apiKey: "secret",
    model: "vision-model",
    fetchImpl: async (url, init) => {
      sent = { url, auth: init.headers.authorization, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({ model: "vision-model", choices: [{ finish_reason: "stop", message: { content: JSON.stringify(modelOutput) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }));
    },
  });
  const result = await analyze(request);
  assert.equal(sent.url, "https://api.example.com/openai/v1/chat/completions");
  assert.equal(sent.auth, "Bearer secret");
  assert.equal(sent.body.response_format.type, "json_object");
  assert.equal(sent.body.messages[0].role, "system");
  assert.match(sent.body.messages[0].content, /JSON Schema/);
  assert.ok(sent.body.messages[1].content.some((p) => p.type === "image_url"));
  assert.match(sent.body.messages[1].content.at(-1).text, /\[t1\] "Printer offline"/);
  assert.deepEqual(result.analysis.findings[0].ocrBlockIds, ["t1"], "unknown OCR ids are dropped");
  assert.equal(result.usage.outputTokens, 20);
});

test("provider errors map to clear codes", async () => {
  const withStatus = (status) => createOpenAIAnalyzer({ baseUrl: "https://x", apiKey: "k", model: "m", fetchImpl: async () => new Response("{}", { status }) });
  await assert.rejects(withStatus(429)(request), (e) => e.code === "upstream_rate_limited");
  await assert.rejects(withStatus(401)(request), (e) => e.code === "not_configured");
  const garbage = createOpenAIAnalyzer({
    baseUrl: "https://x",
    apiKey: "k",
    model: "m",
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"title":""}' } }] })),
  });
  await assert.rejects(garbage(request), (e) => e.code === "invalid_model_output");
});
