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

import { chatCompletion } from "../src/openai.mjs";
import { buildChatMessages, fixbotReply, ChatRequestSchema } from "../src/chat.mjs";

const okReply = (model, content = "Hallo") =>
  new Response(JSON.stringify({ model, choices: [{ finish_reason: "stop", message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));

test("model chain falls back to the next model when one is rate limited", async () => {
  const tried = [];
  const out = await chatCompletion({
    baseUrl: "https://x",
    apiKey: "k",
    models: ["big", "small"],
    messages: [{ role: "user", content: "hi" }],
    fetchImpl: async (_url, init) => {
      const model = JSON.parse(init.body).model;
      tried.push(model);
      return model === "big" ? new Response("{}", { status: 429 }) : okReply(model);
    },
  });
  assert.deepEqual(tried, ["big", "small"]);
  assert.equal(out.model, "small");
  assert.equal(out.degraded, true);
  await assert.rejects(
    chatCompletion({ baseUrl: "https://x", apiKey: "k", models: ["a", "b"], messages: [], fetchImpl: async () => new Response("{}", { status: 429 }) }),
    (e) => e.code === "upstream_rate_limited",
  );
});

test("only a photo in the newest message is sent, older ones become [photo]", () => {
  const img = { mediaType: "image/jpeg", data: "AAA" };
  const older = buildChatMessages(ChatRequestSchema.parse({ locale: "de", messages: [{ role: "user", text: "Was ist das?", image: img }, { role: "assistant", text: "Ein Router." }, { role: "user", text: "Und jetzt?" }] }));
  assert.equal(older.hasImage, false);
  assert.equal(older.messages[1].content, "[photo] Was ist das?");
  assert.match(older.messages[0].content, /German/);
  const newest = buildChatMessages(ChatRequestSchema.parse({ messages: [{ role: "user", text: "", image: img }], context: "Session: Drucker offline" }));
  assert.equal(newest.hasImage, true);
  assert.equal(newest.messages[1].content[0].type, "image_url");
  assert.match(newest.messages[0].content, /Drucker offline/);
});

test("FixBot uses the vision model only for a new photo", async () => {
  const used = [];
  const fetchImpl = async (_url, init) => {
    used.push(JSON.parse(init.body).model);
    return okReply(JSON.parse(init.body).model, "<think>x</think>Antwort");
  };
  const opts = { baseUrl: "https://x", apiKey: "k", textModels: ["text-model"], visionModels: ["vision-model"], fetchImpl };
  const text = await fixbotReply(ChatRequestSchema.parse({ messages: [{ role: "user", text: "WLAN weg" }] }), opts);
  const photo = await fixbotReply(ChatRequestSchema.parse({ messages: [{ role: "user", text: "", image: { mediaType: "image/jpeg", data: "AAA" } }] }), opts);
  assert.deepEqual(used, ["text-model", "vision-model"]);
  assert.equal(text.reply, "Antwort", "reasoning tags are stripped");
  assert.equal(photo.hasImage, true);
});

import { transcribe, TranscribeRequestSchema } from "../src/transcribe.mjs";

test("transcription posts multipart audio and filters silence hallucinations", async () => {
  let sent;
  const fetchImpl = async (url, init) => {
    sent = { url, file: init.body.get("file"), model: init.body.get("model"), language: init.body.get("language") };
    return new Response(JSON.stringify({ text: " Mein Drucker ist offline. " }));
  };
  const req = TranscribeRequestSchema.parse({ locale: "de", mediaType: "audio/m4a", data: btoa("abc") });
  const text = await transcribe({ baseUrl: "https://x/openai/v1", apiKey: "k", model: "whisper-large-v3-turbo", req, fetchImpl });
  assert.equal(text, "Mein Drucker ist offline.");
  assert.equal(sent.url, "https://x/openai/v1/audio/transcriptions");
  assert.equal(sent.model, "whisper-large-v3-turbo");
  assert.equal(sent.language, "de");
  assert.equal(sent.file.name, "speech.m4a");
  const silent = await transcribe({ baseUrl: "https://x", apiKey: "k", model: "m", req, fetchImpl: async () => new Response(JSON.stringify({ text: "Untertitel im Auftrag des ZDF" })) });
  assert.equal(silent, "");
});

test("FixVoice: voice mode adds spoken-answer rules, Fish TTS sends the voice id", async () => {
  const { buildChatMessages } = await import("../src/chat.mjs");
  const { fishSpeech, fishVoice } = await import("../src/tts.mjs");
  const voice = buildChatMessages({ locale: "de", mode: "voice", messages: [{ role: "user", text: "Drucker offline" }] });
  assert.match(voice.messages[0].content, /live phone call/);
  const chatOnly = buildChatMessages({ locale: "de", messages: [{ role: "user", text: "Drucker offline" }] });
  assert.doesNotMatch(chatOnly.messages[0].content, /live phone call/);

  assert.equal(fishVoice({ FISH_VOICE_DE_FEMALE: "abc" }, "de", "female"), "abc");
  assert.equal(fishVoice({}, "en", "male"), null);
  let sent;
  const audio = await fishSpeech({
    apiKey: "k",
    voice: "abc",
    text: "Hallo",
    fetchImpl: async (url, init) => {
      sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    },
  });
  assert.equal(sent.url, "https://api.fish.audio/v1/tts");
  assert.equal(sent.body.reference_id, "abc");
  assert.equal(sent.auth, "Bearer k");
  assert.equal(audio.byteLength, 3);
});

test("Screen questions get the short, direct screen rules", async () => {
  const { buildChatMessages } = await import("../src/chat.mjs");
  const out = buildChatMessages({ locale: "de", mode: "screen", messages: [{ role: "user", text: "Wie heißt dieser Anime?", image: { mediaType: "image/jpeg", data: "AAAA" } }] });
  assert.match(out.messages[0].content, /what is on the user's iPhone screen/);
  assert.equal(out.hasImage, true);
});

test("The user's profile goes into the system prompt only when given", async () => {
  const { buildChatMessages } = await import("../src/chat.mjs");
  const withProfile = buildChatMessages({ locale: "de", mode: "voice", profile: "Their devices: iPhone.", messages: [{ role: "user", text: "Hilfe" }] });
  assert.match(withProfile.messages[0].content, /About the user .*Their devices: iPhone\./s);
  const without = buildChatMessages({ locale: "de", mode: "voice", messages: [{ role: "user", text: "Hilfe" }] });
  assert.doesNotMatch(without.messages[0].content, /About the user/);
});

test("Tap to identify: prompt names the rings, reply is validated and limited to the tapped spots", async () => {
  const { identifyPrompt, identifyObjects } = await import("../src/identify.mjs");
  const req = { locale: "de", image: { mediaType: "image/jpeg", data: "AAAA" }, points: [{ x: 0.4, y: 0.6 }, { x: 0.7, y: 0.2 }] };
  const prompt = identifyPrompt(req);
  assert.match(prompt, /1: the red ring at x=0\.40, y=0\.60/);
  assert.match(prompt, /2: the green ring/);
  assert.match(prompt, /German/);
  const reply = { objects: [{ point: 1, name: "Turbolader", description: "Verdichtet Luft.", parts: ["Verdichtergehäuse", "Wastegate"] }, { point: 3, name: "Zu viel" }] };
  const out = await identifyObjects(req, {
    baseUrl: "https://ai.test/v1",
    apiKey: "k",
    models: ["vision"],
    fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }], model: "vision" }), { status: 200 }),
  });
  assert.equal(out.objects.length, 1);
  assert.equal(out.objects[0].name, "Turbolader");
  assert.deepEqual(out.objects[0].parts, ["Verdichtergehäuse", "Wastegate"]);
});
