import Anthropic from "@anthropic-ai/sdk";
import { ANALYSIS_JSON_SCHEMA, validateAnalysis } from "./schema.mjs";
import { SYSTEM_PROMPT, buildUserContent } from "./prompt.mjs";

export class AnalysisError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/**
 * Creates the function that turns a validated app request into a validated analysis.
 * One Claude call per request; structured outputs constrain the JSON, zod re-checks it.
 */
export function createAnalyzer({ model, effort, timeoutMs, client = new Anthropic({ maxRetries: 1, timeout: timeoutMs }) }) {
  return async function analyze(req, { signal } = {}) {
    const ocrIds = new Set(req.images.flatMap((img, i) => (img.ocr ?? []).map((b) => `${i}:${b.id}`)));

    let message;
    try {
      const stream = client.beta.messages.stream(
        {
          model,
          max_tokens: 32000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort, format: { type: "json_schema", schema: ANALYSIS_JSON_SCHEMA } },
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: buildUserContent(req) }],
        },
        { signal, timeout: timeoutMs },
      );
      message = await stream.finalMessage();
    } catch (err) {
      if (signal?.aborted) throw new AnalysisError("cancelled", "The request was cancelled.", 499);
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new AnalysisError("upstream_timeout", "The AI service took too long to answer.", 504);
      }
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw new AnalysisError("not_configured", "The proxy's Anthropic API key was rejected.", 502);
      }
      if (err instanceof Anthropic.RateLimitError) {
        throw new AnalysisError("upstream_rate_limited", "The AI service is rate limiting this key. Try again shortly.", 503);
      }
      if (err instanceof Anthropic.BadRequestError) {
        throw new AnalysisError("upstream_rejected", `The AI service rejected the request: ${err.message}`, 502);
      }
      if (err instanceof Anthropic.APIConnectionError) {
        throw new AnalysisError("upstream_unreachable", "The proxy cannot reach the AI service.", 502);
      }
      if (err instanceof Anthropic.APIError) {
        throw new AnalysisError("upstream_error", `AI service error (${err.status ?? "unknown"}).`, 502);
      }
      throw err;
    }

    if (message.stop_reason === "refusal") {
      throw new AnalysisError("refused", "The AI service declined to analyze this request.", 422);
    }
    if (message.stop_reason === "max_tokens") {
      throw new AnalysisError("invalid_model_output", "The analysis was cut off before it was complete.", 502);
    }

    const text = message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let raw;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AnalysisError("invalid_model_output", "The AI service returned malformed JSON.", 502);
    }
    const result = validateAnalysis(raw, { imageCount: req.images.length, ocrIds });
    if (!result.ok) {
      throw new AnalysisError("invalid_model_output", `The analysis did not match the expected format (${result.issues.join("; ")}).`, 502);
    }

    return {
      analysis: result.analysis,
      model: message.model,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      },
    };
  };
}
