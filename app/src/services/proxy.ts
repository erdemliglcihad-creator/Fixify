// Client for the Fixify proxy (server/). The Anthropic key stays on the server; the app only holds an app token.
import type { AnalysisMode, AnsweredQuestion, ProblemAnalysis, ProblemCategory, TextBlock } from "../core/types.ts";
import { InvalidAnalysisError, validateAnalysis } from "../core/analysis.ts";
import { t } from "../i18n/index.ts";

export type FailureCode =
  | "notConfigured"
  | "offline"
  | "unreachable"
  | "unauthorized"
  | "rateLimited"
  | "refused"
  | "timeout"
  | "invalidResponse"
  | "server"
  | "cancelled";

export class ProxyError extends Error {
  constructor(
    public code: FailureCode,
    message: string,
  ) {
    super(message);
  }

  get retryable() {
    return ["offline", "unreachable", "rateLimited", "timeout", "invalidResponse", "server"].includes(this.code);
  }
}

const messages = {
  unreachable: () => t("The Fixify server can't be reached. Check that it is running and that your iPhone is on the same network."),
  unauthorized: () => t("The server rejected the app token. Copy the token from the server window into Settings."),
  refused: () => t("The AI declined to analyze this. Try a different photo or description."),
  timeout: () => t("The analysis took too long. Try again."),
};

async function request(base: string, token: string, path: string, init: RequestInit & { timeoutMs: number }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), init.timeoutMs);
  const outer = init.signal;
  outer?.addEventListener("abort", () => controller.abort("cancelled"));
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => null);
    if (res.ok) return body;
    const code: string | undefined = body?.error?.code;
    const message: string | undefined = body?.error?.message;
    if (res.status === 401) throw new ProxyError("unauthorized", messages.unauthorized());
    if (res.status === 429) {
      const after = Number(res.headers.get("retry-after"));
      throw new ProxyError(
        "rateLimited",
        after ? t("The server is limiting requests. Try again in %lld seconds.", after) : t("The server is limiting requests. Try again later."),
      );
    }
    if (code === "not_configured") throw new ProxyError("notConfigured", t("Your Fixify server has no Anthropic API key. Add it to server/.env and restart the server."));
    if (code === "refused") throw new ProxyError("refused", messages.refused());
    if (code === "upstream_timeout") throw new ProxyError("timeout", messages.timeout());
    if (code === "invalid_model_output") throw new ProxyError("invalidResponse", t("The analysis came back in an unexpected format, so it is not shown. (%@)", message ?? ""));
    throw new ProxyError("server", message ?? t("The server reported an error (%lld).", res.status));
  } catch (err) {
    if (err instanceof ProxyError) throw err;
    if (controller.signal.aborted) {
      if (controller.signal.reason === "cancelled") throw new ProxyError("cancelled", "cancelled");
      throw new ProxyError("timeout", messages.timeout());
    }
    throw new ProxyError("unreachable", messages.unreachable());
  } finally {
    clearTimeout(timer);
  }
}

export type Health = { reachable: true; configured: boolean; ocr: boolean; model?: string };

/** Checks reachability (public /health) and the token (/v1/ping). */
export async function checkServer(base: string, token: string): Promise<Health> {
  const health = await fetch(`${base}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new ProxyError("unreachable", messages.unreachable());
  const ping = await request(base, token, "/v1/ping", { method: "GET", timeoutMs: 8000 });
  return { reachable: true, configured: Boolean(ping.configured), ocr: Boolean(ping.ocr), model: ping.model };
}

export async function recognizeText(
  base: string,
  token: string,
  image: { base64: string; width: number; height: number },
  signal?: AbortSignal,
): Promise<TextBlock[]> {
  const body = await request(base, token, "/v1/ocr", {
    method: "POST",
    signal,
    timeoutMs: 90_000,
    body: JSON.stringify({ mediaType: "image/jpeg", data: image.base64, width: image.width, height: image.height }),
  });
  return Array.isArray(body?.blocks) ? body.blocks : [];
}

export type AnalyzeInput = {
  mode: AnalysisMode;
  locale: "de" | "en";
  description: string;
  categoryHint: ProblemCategory | null;
  images: { label: string; base64: string; blocks: TextBlock[] }[];
  history: { kind: string; text: string }[];
  answers: AnsweredQuestion[];
  feedback: string | null;
  previousAnalysis: ProblemAnalysis | null;
};

export async function analyze(base: string, token: string, input: AnalyzeInput, signal?: AbortSignal) {
  const body = await request(base, token, "/v1/analyze", {
    method: "POST",
    signal,
    timeoutMs: 150_000,
    body: JSON.stringify({
      mode: input.mode,
      locale: input.locale,
      description: input.description.slice(0, 4000),
      categoryHint: input.categoryHint,
      images: input.images.map((i) => ({
        label: i.label,
        mediaType: "image/jpeg",
        data: i.base64,
        ocr: i.blocks.slice(0, 150).map((b) => ({ id: b.id, text: b.text.slice(0, 500), box: b.box })),
      })),
      history: input.history.slice(-60).map((h) => ({ kind: h.kind, text: h.text.slice(0, 1000) })),
      answers: input.answers,
      feedback: input.feedback,
      previousAnalysis: input.previousAnalysis,
    }),
  });
  try {
    return { analysis: validateAnalysis(body?.analysis, input.images.length), model: String(body?.model ?? "claude") };
  } catch (err) {
    if (err instanceof InvalidAnalysisError) {
      throw new ProxyError("invalidResponse", t("The analysis came back in an unexpected format, so it is not shown. (%@)", err.message));
    }
    throw err;
  }
}
