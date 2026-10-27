// Fixify cloud server (Cloudflare Workers). Same API as server/ (the local Claude proxy), plus FixBot chat.
// Anyone with the app may use it. Limits: 10 photo uploads per device and day (the same photo counts once),
// a generous hidden fair-use limit for messages, and a shared daily cap on vision calls to protect the free quota.
import { DurableObject } from "cloudflare:workers";
import Anthropic from "@anthropic-ai/sdk";
import { OcrRequestSchema, RequestSchema } from "../../server/src/app.mjs";
import { AnalysisError, createAnalyzer } from "../../server/src/analyze.mjs";
import { createOpenAIAnalyzer } from "./openai.mjs";
import { OcrError, recognizeWithOcrSpace } from "./ocrspace.mjs";
import { ChatRequestSchema, fixbotReply } from "./chat.mjs";
import { TranscribeRequestSchema, transcribe } from "./transcribe.mjs";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-fixify-device",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const DEVICE_ID = /^[0-9a-f-]{16,64}$/i;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...headers } });
const fail = (status, code, message, extra = {}) => json(status, { error: { code, message }, ...extra });

const today = () => new Date().toISOString().slice(0, 10);
const num = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

export function limitsFrom(env) {
  return {
    uploadsDaily: num(env.UPLOADS_DAILY, 10),
    ipUploadsDaily: num(env.IP_UPLOADS_DAILY, 30),
    messagesDaily: num(env.MESSAGES_DAILY, 150),
    globalVisionDaily: num(env.GLOBAL_VISION_DAILY, 50),
    globalOcrDaily: num(env.GLOBAL_OCR_DAILY, 450),
    maxImages: num(env.MAX_IMAGES, 2),
  };
}

const textModels = (env) => String(env.CHAT_MODELS || "openai/gpt-oss-120b,openai/gpt-oss-20b,llama-3.1-8b-instant").split(",").map((m) => m.trim()).filter(Boolean);

function providerInfo(env) {
  if (env.AI_PROVIDER === "anthropic") return { provider: "anthropic", model: env.ANTHROPIC_MODEL || "claude-opus-5-5", configured: Boolean(env.ANTHROPIC_API_KEY) };
  return { provider: env.AI_PROVIDER_NAME || "groq", model: env.AI_MODEL, configured: Boolean(env.AI_API_KEY && env.AI_BASE_URL && env.AI_MODEL) };
}

function analyzerFor(env, withImages) {
  if (env.AI_PROVIDER === "anthropic") {
    // Claude switch for later: set AI_PROVIDER=anthropic and the ANTHROPIC_API_KEY secret.
    return createAnalyzer({
      model: env.ANTHROPIC_MODEL || "claude-opus-5-5",
      effort: env.ANTHROPIC_EFFORT || "medium",
      timeoutMs: 120_000,
      client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 120_000 }),
    });
  }
  // Photos need the vision model; text-only analyses use the chat chain and spare the scarce vision quota.
  return createOpenAIAnalyzer({ baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, models: withImages ? [env.AI_MODEL] : textModels(env) });
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Daily counters and the set of photos each device uploaded today, in SQLite. */
export class Limiter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))");
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS uploads (day TEXT NOT NULL, device TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY (day, device, hash))");
  }

  count(day, key) {
    const row = this.ctx.storage.sql.exec("SELECT n FROM usage WHERE day = ? AND key = ?", day, key).toArray()[0];
    return row ? row.n : 0;
  }

  bump(day, key, by) {
    this.ctx.storage.sql.exec("INSERT INTO usage (day, key, n) VALUES (?, ?, ?) ON CONFLICT (day, key) DO UPDATE SET n = MAX(n + ?, 0)", day, key, Math.max(by, 0), by);
  }

  uploadsUsed(day, device) {
    return this.ctx.storage.sql.exec("SELECT COUNT(*) AS n FROM uploads WHERE day = ? AND device = ?", day, device).one().n;
  }

  /**
   * Checks everything first and only then records, so a refused request costs nothing.
   * hashes: photos in this request (already-uploaded ones are free); vision: does this call use the vision model;
   * message: does it count against the fair-use message limit.
   */
  take(day, { device, ip, hashes = [], vision = false, ocr = false, message = false }, limits) {
    const seen = new Set(this.ctx.storage.sql.exec("SELECT hash FROM uploads WHERE day = ? AND device = ?", day, device).toArray().map((r) => r.hash));
    const fresh = [...new Set(hashes)].filter((h) => !seen.has(h));
    if (seen.size + fresh.length > limits.uploadsDaily) return { ok: false, code: "upload_limit" };
    if (fresh.length && this.count(day, `ip:${ip}`) + fresh.length > limits.ipUploadsDaily) return { ok: false, code: "upload_limit" };
    if (message && this.count(day, `msg:${device}`) >= limits.messagesDaily) return { ok: false, code: "message_limit" };
    if (vision && this.count(day, "vision:global") >= limits.globalVisionDaily) return { ok: false, code: "vision_limit" };
    if (ocr && this.count(day, "ocr:global") >= limits.globalOcrDaily) return { ok: false, code: "ocr_limit" };

    for (const h of fresh) this.ctx.storage.sql.exec("INSERT INTO uploads (day, device, hash) VALUES (?, ?, ?)", day, device, h);
    if (fresh.length) this.bump(day, `ip:${ip}`, fresh.length);
    if (message) this.bump(day, `msg:${device}`, 1);
    if (vision) this.bump(day, "vision:global", 1);
    if (ocr) this.bump(day, "ocr:global", 1);
    this.ctx.storage.sql.exec("DELETE FROM usage WHERE day < ?", day);
    this.ctx.storage.sql.exec("DELETE FROM uploads WHERE day < ?", day);
    return { ok: true, receipt: { device, ip, fresh, vision, ocr, message }, uploadsLeft: Math.max(0, limits.uploadsDaily - seen.size - fresh.length) };
  }

  /** Undoes a take() whose AI call failed: failed requests never count. */
  refund(day, receipt) {
    for (const h of receipt.fresh) this.ctx.storage.sql.exec("DELETE FROM uploads WHERE day = ? AND device = ? AND hash = ?", day, receipt.device, h);
    if (receipt.fresh.length) this.bump(day, `ip:${receipt.ip}`, -receipt.fresh.length);
    if (receipt.message) this.bump(day, `msg:${receipt.device}`, -1);
    if (receipt.vision) this.bump(day, "vision:global", -1);
    if (receipt.ocr) this.bump(day, "ocr:global", -1);
  }

  uploadsLeft(day, device, uploadsDaily) {
    return Math.max(0, uploadsDaily - this.uploadsUsed(day, device));
  }
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new AnalysisError("payload_too_large", "The request is too large.", 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new AnalysisError("payload_too_large", "The request is too large.", 413);
  return JSON.parse(text);
}

const LIMIT_MESSAGES = {
  upload_limit: "You've used today's photo uploads on this device. They renew tomorrow; you can keep asking without a photo.",
  message_limit: "You've sent a lot of messages today. FixBot is available again tomorrow.",
  vision_limit: "Photo analysis is fully booked for today for all users. It renews tomorrow; text questions still work.",
  ocr_limit: "Today's free text recognition is used up. It renews tomorrow.",
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const limits = limitsFrom(env);
    const info = providerInfo(env);
    const limiter = env.LIMITER.getByName("global");
    const day = today();
    const device = request.headers.get("x-fixify-device") ?? "";
    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, service: "fixify-cloud", version: "1.2.0", configured: info.configured, ocr: Boolean(env.OCR_SPACE_KEY), chat: true, voice: true, provider: info.provider });
    }
    if (!["/v1/ping", "/v1/ocr", "/v1/analyze", "/v1/chat", "/v1/transcribe"].includes(url.pathname)) return fail(404, "not_found", "Unknown endpoint.");

    // Optional invite-only mode: set the APP_TOKEN secret and hand the token out.
    if (env.APP_TOKEN && request.headers.get("authorization") !== `Bearer ${env.APP_TOKEN}`) {
      return fail(401, "unauthorized", "The app token is missing or wrong.");
    }
    if (!DEVICE_ID.test(device)) return fail(400, "invalid_request", "Missing device id.");

    if (url.pathname === "/v1/ping") {
      return json(200, {
        ok: true,
        configured: info.configured,
        ocr: Boolean(env.OCR_SPACE_KEY),
        chat: true,
        provider: info.provider,
        model: info.model,
        uploadsLeft: await limiter.uploadsLeft(day, device, limits.uploadsDaily),
        uploadsDaily: limits.uploadsDaily,
      });
    }
    if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

    let body;
    try {
      body = await readJson(request);
    } catch (err) {
      if (err instanceof AnalysisError) return fail(err.status, err.code, err.message);
      return fail(400, "invalid_request", "The request body is not valid JSON.");
    }

    const take = async (spec) => {
      const verdict = await limiter.take(day, { device, ip, ...spec }, limits);
      return verdict.ok ? verdict : { ...verdict, response: fail(429, verdict.code, LIMIT_MESSAGES[verdict.code], { uploadsDaily: limits.uploadsDaily }) };
    };
    const quota = (left) => ({ uploadsLeft: left, uploadsDaily: limits.uploadsDaily });

    if (url.pathname === "/v1/ocr") {
      if (!env.OCR_SPACE_KEY) return fail(503, "ocr_unavailable", "Text recognition is not set up on the server.");
      const parsed = OcrRequestSchema.safeParse(body);
      if (!parsed.success) return fail(400, "invalid_request", "Invalid OCR request.");
      // The same photo is sent for the analysis right after, so it counts as one upload.
      const verdict = await take({ hashes: [await sha256(parsed.data.data)], ocr: true });
      if (!verdict.ok) return verdict.response;
      try {
        const blocks = await recognizeWithOcrSpace({ apiKey: env.OCR_SPACE_KEY, endpoint: env.OCR_SPACE_URL || undefined, ...parsed.data, signal: request.signal });
        return json(200, { blocks, ...quota(verdict.uploadsLeft) });
      } catch (err) {
        await limiter.refund(day, verdict.receipt);
        if (err instanceof OcrError) return fail(err.status, err.code, err.message);
        return fail(500, "ocr_failed", "Text recognition failed.");
      }
    }

    if (!info.configured) return fail(503, "not_configured", "The AI service is not set up on the server.");

    if (url.pathname === "/v1/transcribe") {
      const parsed = TranscribeRequestSchema.safeParse(body);
      if (!parsed.success) return fail(400, "invalid_request", "Invalid audio.");
      // Voice turns share the fair-use message budget with typed messages.
      const verdict = await take({ message: true });
      if (!verdict.ok) return verdict.response;
      try {
        const text = await transcribe({ baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.STT_MODEL || "whisper-large-v3-turbo", req: parsed.data, signal: request.signal });
        if (!text) await limiter.refund(day, verdict.receipt);
        return json(200, { text });
      } catch (err) {
        await limiter.refund(day, verdict.receipt);
        if (err instanceof AnalysisError) return fail(err.status, err.code, err.message);
        return fail(502, "upstream_error", "Speech recognition failed.");
      }
    }

    if (url.pathname === "/v1/chat") {
      const parsed = ChatRequestSchema.safeParse(body);
      if (!parsed.success) return fail(400, "invalid_request", "Invalid chat request.");
      const lastMessage = parsed.data.messages.at(-1);
      const image = lastMessage.role === "user" ? lastMessage.image : null;
      const verdict = await take({ hashes: image ? [await sha256(image.data)] : [], vision: Boolean(image), message: true });
      if (!verdict.ok) return verdict.response;
      try {
        const out = await fixbotReply(parsed.data, {
          baseUrl: env.AI_BASE_URL,
          apiKey: env.AI_API_KEY,
          textModels: textModels(env),
          visionModels: [env.AI_MODEL],
          signal: request.signal,
        });
        return json(200, { reply: out.reply, model: out.model, degraded: out.degraded, ...quota(verdict.uploadsLeft) });
      } catch (err) {
        await limiter.refund(day, verdict.receipt);
        if (err instanceof AnalysisError) return fail(err.status === 499 ? 400 : err.status, err.code, err.message);
        console.error("chat failed", err);
        return fail(502, "upstream_error", "FixBot could not answer.");
      }
    }

    // /v1/analyze
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(400, "invalid_request", `Invalid request: ${issue.path.join(".")} ${issue.message}`);
    }
    const req = { ...parsed.data, images: parsed.data.images.slice(0, limits.maxImages) };
    if (!req.images.length && !req.description.trim()) return fail(400, "invalid_request", "Send at least one image or a description.");

    const withImages = req.images.length > 0;
    const verdict = await take({ hashes: await Promise.all(req.images.map((i) => sha256(i.data))), vision: withImages, message: !withImages });
    if (!verdict.ok) return verdict.response;

    try {
      const result = await analyzerFor(env, withImages)(req, { signal: request.signal });
      // Small open models place boxes poorly (tested: off by a third of the image height). Unless trusted,
      // only OCR-anchored markers are drawn, so the app never points at the wrong spot.
      if (env.AI_PROVIDER !== "anthropic" && env.TRUST_AI_BOXES !== "true") {
        result.analysis.findings = result.analysis.findings.map((f) => ({ ...f, box: null, boxConfidence: "none" }));
      }
      return json(200, { requestId: crypto.randomUUID().slice(0, 8), ...result, ...quota(verdict.uploadsLeft) });
    } catch (err) {
      // Failed analyses do not count against anyone's limit.
      await limiter.refund(day, verdict.receipt);
      if (err instanceof AnalysisError) return fail(err.status === 499 ? 400 : err.status, err.code, err.message);
      console.error("unexpected", err);
      return fail(500, "internal", "Unexpected server error.");
    }
  },
};
