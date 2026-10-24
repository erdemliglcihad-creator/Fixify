import { timingSafeEqual, randomUUID } from "node:crypto";
import { z } from "zod";
import { AnalysisError } from "./analyze.mjs";
import { CATEGORIES } from "./schema.mjs";

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_BASE64 = 2_800_000; // ≈2 MB JPEG; the app downsizes to 1600 px long edge before sending

const BoxIn = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const RequestSchema = z.object({
  mode: z.enum(["initial", "replan", "followup"]),
  locale: z.enum(["de", "en"]).default("en"),
  description: z.string().max(4000).default(""),
  categoryHint: z.enum(CATEGORIES).nullable().default(null),
  images: z
    .array(
      z.object({
        label: z.string().max(80).optional(),
        mediaType: z.enum(["image/jpeg", "image/png"]),
        data: z.string().min(1).max(MAX_IMAGE_BASE64),
        ocr: z.array(z.object({ id: z.string().max(16), text: z.string().max(500), box: BoxIn })).max(150).default([]),
      }),
    )
    .max(4)
    .default([]),
  history: z.array(z.object({ kind: z.string().max(32), text: z.string().max(1000) })).max(60).default([]),
  answers: z.array(z.object({ question: z.string().max(500), answer: z.string().max(500) })).max(10).default([]),
  feedback: z.string().max(2000).nullable().default(null),
  previousAnalysis: z.record(z.string(), z.unknown()).nullable().default(null),
});

function send(res, status, body, headers = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers });
  res.end(json);
}

function sendError(res, status, code, message, headers) {
  send(res, status, { error: { code, message } }, headers);
}

function tokenMatches(expected, header) {
  const given = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new AnalysisError("payload_too_large", "The request is too large.", 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** HTTP handler. `analyze` is injected so tests can run without calling the API. */
export function createApp({ appToken, limiter, analyze, info, log = console }) {
  return async function handle(req, res) {
    const url = new URL(req.url, "http://localhost");
    const requestId = randomUUID().slice(0, 8);

    if (req.method === "GET" && url.pathname === "/health") {
      // Health is public so the app can tell "server unreachable" from "wrong token".
      return send(res, 200, { ok: true, service: "fixify-proxy", version: info.version, configured: info.configured });
    }

    if (url.pathname !== "/v1/analyze" && url.pathname !== "/v1/ping") {
      return sendError(res, 404, "not_found", "Unknown endpoint.");
    }
    if (!tokenMatches(appToken, req.headers.authorization)) {
      return sendError(res, 401, "unauthorized", "The app token is missing or wrong. Copy it from the proxy console into Fixify settings.");
    }
    if (url.pathname === "/v1/ping") {
      return send(res, 200, { ok: true, model: info.model, configured: info.configured });
    }
    if (req.method !== "POST") return sendError(res, 405, "method_not_allowed", "Use POST.");
    if (!info.configured) {
      return sendError(res, 503, "not_configured", "ANTHROPIC_API_KEY is not set on the proxy.");
    }

    const clientId = req.socket.remoteAddress ?? "unknown";
    const verdict = limiter.check(clientId);
    if (!verdict.allowed) {
      const msg = verdict.reason === "daily" ? "The proxy's daily analysis limit is reached." : "Too many analyses in a short time.";
      return sendError(res, 429, "rate_limited", msg, { "retry-after": String(verdict.retryAfter) });
    }

    let body;
    try {
      body = RequestSchema.safeParse(JSON.parse(await readBody(req)));
    } catch (err) {
      if (err instanceof AnalysisError) return sendError(res, err.status, err.code, err.message);
      return sendError(res, 400, "invalid_request", "The request body is not valid JSON.");
    }
    if (!body.success) {
      const issue = body.error.issues[0];
      return sendError(res, 400, "invalid_request", `Invalid request: ${issue.path.join(".")} ${issue.message}`);
    }
    if (!body.data.images.length && !body.data.description.trim()) {
      return sendError(res, 400, "invalid_request", "Send at least one image or a description.");
    }

    // Cancel the upstream call when the phone goes away (user tapped cancel, app backgrounded).
    const controller = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) controller.abort();
    });

    const started = Date.now();
    try {
      const result = await analyze(body.data, { signal: controller.signal });
      // Log sizes and timing only; never images, OCR text or descriptions.
      log.info(`[${requestId}] ${body.data.mode} images=${body.data.images.length} ${Date.now() - started}ms in=${result.usage.inputTokens} out=${result.usage.outputTokens}`);
      return send(res, 200, { requestId, ...result });
    } catch (err) {
      if (err instanceof AnalysisError) {
        log.warn(`[${requestId}] ${err.code}: ${err.message}`);
        if (err.code === "cancelled") return;
        return sendError(res, err.status, err.code, err.message);
      }
      log.error(`[${requestId}] unexpected`, err);
      return sendError(res, 500, "internal", "Unexpected proxy error.");
    }
  };
}
