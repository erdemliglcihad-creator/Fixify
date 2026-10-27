// Fixify cloud server (Cloudflare Workers). Same API as server/ (the local Claude proxy), so the app talks to either.
// Anyone with the app may use it; abuse and cost are capped by daily limits per device, per IP and for everyone together.
import { DurableObject } from "cloudflare:workers";
import Anthropic from "@anthropic-ai/sdk";
import { OcrRequestSchema, RequestSchema } from "../../server/src/app.mjs";
import { AnalysisError, createAnalyzer } from "../../server/src/analyze.mjs";
import { createOpenAIAnalyzer } from "./openai.mjs";
import { OcrError, recognizeWithOcrSpace } from "./ocrspace.mjs";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-fixify-device",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const DEVICE_ID = /^[0-9a-f-]{16,64}$/i;

const json = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS, ...headers } });
const fail = (status, code, message, headers) => json(status, { error: { code, message } }, headers);

const today = () => new Date().toISOString().slice(0, 10);
const num = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);

function limitsFrom(env) {
  return {
    deviceDaily: num(env.DEVICE_DAILY, 10),
    ipDaily: num(env.IP_DAILY, 30),
    globalAnalyzeDaily: num(env.GLOBAL_ANALYZE_DAILY, 30),
    globalOcrDaily: num(env.GLOBAL_OCR_DAILY, 450),
    maxImages: num(env.MAX_IMAGES, 2),
  };
}

function providerInfo(env) {
  if (env.AI_PROVIDER === "anthropic") return { provider: "anthropic", model: env.ANTHROPIC_MODEL || "claude-opus-5-5", configured: Boolean(env.ANTHROPIC_API_KEY) };
  return { provider: env.AI_PROVIDER_NAME || "groq", model: env.AI_MODEL, configured: Boolean(env.AI_API_KEY && env.AI_BASE_URL && env.AI_MODEL) };
}

function analyzerFor(env) {
  if (env.AI_PROVIDER === "anthropic") {
    // Claude switch for later: set AI_PROVIDER=anthropic and the ANTHROPIC_API_KEY secret.
    return createAnalyzer({
      model: env.ANTHROPIC_MODEL || "claude-opus-5-5",
      effort: env.ANTHROPIC_EFFORT || "medium",
      timeoutMs: 120_000,
      client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 120_000 }),
    });
  }
  return createOpenAIAnalyzer({ baseUrl: env.AI_BASE_URL, apiKey: env.AI_API_KEY, model: env.AI_MODEL });
}

/** Daily counters in SQLite. take() checks every key first, then counts all of them, so a refused request costs nothing. */
export class Limiter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))");
  }

  count(day, key) {
    const row = this.ctx.storage.sql.exec("SELECT n FROM usage WHERE day = ? AND key = ?", day, key).toArray()[0];
    return row ? row.n : 0;
  }

  take(day, checks) {
    for (const { key, limit } of checks) {
      if (this.count(day, key) >= limit) return { ok: false, key };
    }
    for (const { key } of checks) {
      this.ctx.storage.sql.exec("INSERT INTO usage (day, key, n) VALUES (?, ?, 1) ON CONFLICT (day, key) DO UPDATE SET n = n + 1", day, key);
    }
    this.ctx.storage.sql.exec("DELETE FROM usage WHERE day < ?", day);
    return { ok: true };
  }

  refund(day, keys) {
    for (const key of keys) this.ctx.storage.sql.exec("UPDATE usage SET n = MAX(n - 1, 0) WHERE day = ? AND key = ?", day, key);
  }

  peek(day, keys) {
    return Object.fromEntries(keys.map((k) => [k, this.count(day, k)]));
  }
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) throw new AnalysisError("payload_too_large", "The request is too large.", 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new AnalysisError("payload_too_large", "The request is too large.", 413);
  return JSON.parse(text);
}

const limitMessage = (key) =>
  key.startsWith("device:") || key.startsWith("ip:")
    ? ["daily_limit", "You've used today's free analyses on this device. They renew tomorrow."]
    : ["global_limit", "Today's free analyses for all Fixify users are used up. They renew tomorrow."];

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
    const deviceKey = `device:${device}`;

    if (request.method === "GET" && url.pathname === "/health") {
      return json(200, { ok: true, service: "fixify-cloud", version: "1.0.0", configured: info.configured, ocr: Boolean(env.OCR_SPACE_KEY), provider: info.provider });
    }
    if (!["/v1/ping", "/v1/ocr", "/v1/analyze"].includes(url.pathname)) return fail(404, "not_found", "Unknown endpoint.");

    // Optional invite-only mode: set the APP_TOKEN secret and hand the token out.
    if (env.APP_TOKEN && request.headers.get("authorization") !== `Bearer ${env.APP_TOKEN}`) {
      return fail(401, "unauthorized", "The app token is missing or wrong.");
    }
    if (!DEVICE_ID.test(device)) return fail(400, "invalid_request", "Missing device id.");

    if (url.pathname === "/v1/ping") {
      const used = await limiter.peek(day, [deviceKey]);
      return json(200, {
        ok: true,
        configured: info.configured,
        ocr: Boolean(env.OCR_SPACE_KEY),
        provider: info.provider,
        model: info.model,
        remainingToday: Math.max(0, limits.deviceDaily - used[deviceKey]),
        deviceDaily: limits.deviceDaily,
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

    if (url.pathname === "/v1/ocr") {
      if (!env.OCR_SPACE_KEY) return fail(503, "ocr_unavailable", "Text recognition is not set up on the server.");
      const parsed = OcrRequestSchema.safeParse(body);
      if (!parsed.success) return fail(400, "invalid_request", "Invalid OCR request.");
      const keys = ["ocr:global", `ocr:${deviceKey}`];
      const verdict = await limiter.take(day, [
        { key: "ocr:global", limit: limits.globalOcrDaily },
        { key: `ocr:${deviceKey}`, limit: limits.deviceDaily * 4 },
      ]);
      if (!verdict.ok) return fail(429, "ocr_limit", "Today's free text recognition is used up. It renews tomorrow.");
      try {
        const blocks = await recognizeWithOcrSpace({ apiKey: env.OCR_SPACE_KEY, endpoint: env.OCR_SPACE_URL || undefined, ...parsed.data, signal: request.signal });
        return json(200, { blocks });
      } catch (err) {
        await limiter.refund(day, keys);
        if (err instanceof OcrError) return fail(err.status, err.code, err.message);
        return fail(500, "ocr_failed", "Text recognition failed.");
      }
    }

    // /v1/analyze
    if (!info.configured) return fail(503, "not_configured", "The AI service is not set up on the server.");
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return fail(400, "invalid_request", `Invalid request: ${issue.path.join(".")} ${issue.message}`);
    }
    const req = { ...parsed.data, images: parsed.data.images.slice(0, limits.maxImages) };
    if (!req.images.length && !req.description.trim()) return fail(400, "invalid_request", "Send at least one image or a description.");

    const keys = [deviceKey, `ip:${ip}`, "analyze:global"];
    const verdict = await limiter.take(day, [
      { key: deviceKey, limit: limits.deviceDaily },
      { key: `ip:${ip}`, limit: limits.ipDaily },
      { key: "analyze:global", limit: limits.globalAnalyzeDaily },
    ]);
    if (!verdict.ok) {
      const [code, message] = limitMessage(verdict.key);
      return fail(429, code, message);
    }

    try {
      const result = await analyzerFor(env)(req, { signal: request.signal });
      // Small open models place boxes poorly (tested: off by a third of the image height). Unless trusted,
      // only OCR-anchored markers are drawn, so the app never points at the wrong spot.
      if (env.AI_PROVIDER !== "anthropic" && env.TRUST_AI_BOXES !== "true") {
        result.analysis.findings = result.analysis.findings.map((f) => ({ ...f, box: null, boxConfidence: "none" }));
      }
      const used = await limiter.peek(day, [deviceKey]);
      const remainingToday = Math.max(0, limits.deviceDaily - used[deviceKey]);
      return json(200, { requestId: crypto.randomUUID().slice(0, 8), ...result, remainingToday }, { "x-fixify-remaining": String(remainingToday) });
    } catch (err) {
      // Failed analyses do not count against anyone's limit.
      await limiter.refund(day, keys);
      if (err instanceof AnalysisError) return fail(err.status === 499 ? 400 : err.status, err.code, err.message);
      console.error("unexpected", err);
      return fail(500, "internal", "Unexpected server error.");
    }
  },
};
