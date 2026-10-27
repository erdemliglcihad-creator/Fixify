// Analysis through any OpenAI-compatible chat API with image input (Groq today, Mistral or others later).
// Prompt and schema are shared with the Claude proxy (server/src), so every provider produces the same analysis shape.
import { ANALYSIS_JSON_SCHEMA, CATEGORIES, validateAnalysis } from "../../server/src/schema.mjs";
import { SYSTEM_PROMPT, buildUserContent } from "../../server/src/prompt.mjs";
import { AnalysisError } from "../../server/src/analyze.mjs";

export const JSON_INSTRUCTIONS = `

Output format
Reply with one JSON object and nothing else. It must match this JSON Schema exactly; every key is required, use null or [] when something does not apply:
${JSON.stringify(ANALYSIS_JSON_SCHEMA)}`;

/** Converts the shared (Anthropic-style) content blocks to OpenAI chat content. */
export function toOpenAIContent(blocks) {
  return blocks.map((b) =>
    b.type === "image" ? { type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } } : { type: "text", text: b.text },
  );
}

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v, fallback = "") => (typeof v === "string" ? v : fallback);
const strOrNull = (v) => (typeof v === "string" && v.trim() ? v : null);
const strArr = (v) => arr(v).filter((x) => typeof x === "string");
const oneOf = (v, allowed, fallback) => (allowed.includes(v) ? v : fallback);

/**
 * Smaller open models sometimes omit keys or use slightly different casing.
 * This fills structural gaps with empty values only; it never invents findings, causes or steps.
 */
export function normalizeLoose(raw) {
  const a = raw && typeof raw === "object" ? raw : {};
  return {
    title: str(a.title).slice(0, 120),
    category: oneOf(String(a.category ?? "").toLowerCase(), CATEGORIES, "general"),
    summary: str(a.summary),
    confidenceNote: str(a.confidenceNote),
    canHelp: typeof a.canHelp === "boolean" ? a.canHelp : true,
    cannotHelpReason: strOrNull(a.cannotHelpReason),
    findings: arr(a.findings).map((f, i) => ({
      id: str(f?.id, `f${i + 1}`) || `f${i + 1}`,
      label: str(f?.label),
      detail: str(f?.detail),
      imageIndex: Number.isInteger(f?.imageIndex) ? f.imageIndex : 0,
      ocrBlockIds: strArr(f?.ocrBlockIds),
      box: f?.box && typeof f.box === "object" && ["x", "y", "width", "height"].every((k) => typeof f.box[k] === "number") ? f.box : null,
      boxConfidence: oneOf(f?.boxConfidence, ["high", "medium", "low", "none"], "none"),
      source: oneOf(f?.source, ["ocr", "visual", "user"], "visual"),
    })),
    causes: arr(a.causes).map((c, i) => ({
      id: str(c?.id, `c${i + 1}`) || `c${i + 1}`,
      title: str(c?.title),
      explanation: str(c?.explanation),
      likelihood: oneOf(c?.likelihood, ["likely", "possible", "unlikely"], "possible"),
      evidence: strArr(c?.evidence),
    })),
    unknowns: strArr(a.unknowns),
    questions: arr(a.questions).map((q, i) => ({ id: str(q?.id, `q${i + 1}`) || `q${i + 1}`, question: str(q?.question), options: strArr(q?.options) })),
    nextDiagnostic:
      a.nextDiagnostic && typeof a.nextDiagnostic === "object" && str(a.nextDiagnostic.title) && str(a.nextDiagnostic.instruction)
        ? { title: a.nextDiagnostic.title, instruction: a.nextDiagnostic.instruction, reason: str(a.nextDiagnostic.reason) }
        : null,
    steps: arr(a.steps).map((s, i) => ({
      id: str(s?.id, `s${i + 1}`) || `s${i + 1}`,
      title: str(s?.title),
      explanation: str(s?.explanation),
      action: str(s?.action),
      expectedResult: str(s?.expectedResult),
      pitfalls: strArr(s?.pitfalls),
      findingIds: strArr(s?.findingIds),
      safetyNote: strOrNull(s?.safetyNote),
    })),
    tools: strArr(a.tools),
    difficulty: oneOf(a.difficulty, ["easy", "moderate", "hard", "expert"], null),
    estimatedMinutes: Number.isInteger(a.estimatedMinutes) && a.estimatedMinutes >= 0 ? a.estimatedMinutes : null,
    safety: {
      level: oneOf(a.safety?.level, ["none", "caution", "danger"], "none"),
      warnings: strArr(a.safety?.warnings),
      recommendProfessional: a.safety?.recommendProfessional === true,
    },
    successCriteria: strArr(a.successCriteria),
  };
}

/** Pulls the JSON object out of a reply that may carry reasoning tags or code fences. */
export function extractJson(text) {
  const cleaned = String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/```(?:json)?/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new AnalysisError("invalid_model_output", "The AI did not return an analysis.", 502);
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AnalysisError("invalid_model_output", "The AI returned malformed JSON.", 502);
  }
}

export function createOpenAIAnalyzer({ baseUrl, apiKey, model, timeoutMs = 90_000, fetchImpl = fetch }) {
  return async function analyze(req, { signal } = {}) {
    const ocrIds = new Set(req.images.flatMap((img, i) => (img.ocr ?? []).map((b) => `${i}:${b.id}`)));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener("abort", () => controller.abort());

    let res;
    try {
      res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT + JSON_INSTRUCTIONS },
            { role: "user", content: toOpenAIContent(buildUserContent(req)) },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_completion_tokens: 3000,
        }),
      });
    } catch {
      if (signal?.aborted) throw new AnalysisError("cancelled", "The request was cancelled.", 499);
      if (controller.signal.aborted) throw new AnalysisError("upstream_timeout", "The AI service took too long to answer.", 504);
      throw new AnalysisError("upstream_unreachable", "The server cannot reach the AI service.", 502);
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 401 || res.status === 403) throw new AnalysisError("not_configured", "The server's AI key was rejected.", 503);
    if (res.status === 429) {
      throw new AnalysisError("upstream_rate_limited", "The free AI quota is used up for the moment. Try again later.", 503);
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new AnalysisError("upstream_error", `AI service error (${res.status}${body?.error?.message ? `: ${body.error.message}` : ""}).`, 502);
    }

    const body = await res.json();
    const choice = body?.choices?.[0];
    if (choice?.finish_reason === "length") throw new AnalysisError("invalid_model_output", "The analysis was cut off before it was complete.", 502);
    const result = validateAnalysis(normalizeLoose(extractJson(choice?.message?.content)), { imageCount: req.images.length, ocrIds });
    if (!result.ok) {
      throw new AnalysisError("invalid_model_output", `The analysis did not match the expected format (${result.issues.join("; ")}).`, 502);
    }
    return {
      analysis: result.analysis,
      model: body.model ?? model,
      usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0, cacheReadTokens: 0 },
    };
  };
}
