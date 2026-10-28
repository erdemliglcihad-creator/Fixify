// Client for Fixify Cloud (worker/) and the self-hosted proxy (server/). Both speak the same API.
// AI keys stay on the server; the app only sends a random device id (and an app token for a self-hosted server).
import { deviceId } from "./settings.ts";
import { noteQuota } from "./usage.ts";
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
  | "uploadLimit"
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
  unreachable: () => t("The Fixify server can't be reached. Check your internet connection and try again."),
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
      headers: {
        "content-type": "application/json",
        "x-fixify-device": deviceId,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });
    const body = await res.json().catch(() => null);
    noteQuota(body);
    if (res.ok) return body;
    const code: string | undefined = body?.error?.code;
    const message: string | undefined = body?.error?.message;
    if (res.status === 401) throw new ProxyError("unauthorized", messages.unauthorized());
    if (code === "upload_limit") {
      throw new ProxyError("uploadLimit", t("You've used today's %lld photo uploads. They renew tomorrow; you can keep asking without a photo.", body?.uploadsDaily ?? 10));
    }
    if (code === "message_limit") throw new ProxyError("rateLimited", t("You've sent a lot of messages today. FixVoice is available again tomorrow."));
    if (code === "vision_limit") throw new ProxyError("rateLimited", t("Photo analysis is fully booked for today for all users. Text questions still work."));
    if (code === "ocr_limit") throw new ProxyError("rateLimited", t("Today's free text recognition is used up. It renews tomorrow."));
    if (code === "upstream_rate_limited") throw new ProxyError("rateLimited", t("FixVoice is very busy right now. Try again in a few minutes."));
    if (res.status === 429) {
      const after = Number(res.headers.get("retry-after"));
      throw new ProxyError(
        "rateLimited",
        after ? t("The server is limiting requests. Try again in %lld seconds.", after) : t("The server is limiting requests. Try again later."),
      );
    }
    if (code === "not_configured") throw new ProxyError("notConfigured", t("The AI service is not set up on the server yet."));
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

export type Health = { reachable: true; configured: boolean; ocr: boolean; chat: boolean; model?: string; provider?: string };

/** Checks reachability (public /health) and the token (/v1/ping). */
export async function checkServer(base: string, token: string): Promise<Health> {
  const health = await fetch(`${base}/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) throw new ProxyError("unreachable", messages.unreachable());
  const ping = await request(base, token, "/v1/ping", { method: "GET", timeoutMs: 8000 });
  return { reachable: true, configured: Boolean(ping.configured), ocr: Boolean(ping.ocr), chat: Boolean(ping.chat), model: ping.model, provider: ping.provider };
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
    return {
      analysis: validateAnalysis(body?.analysis, input.images.length),
      model: String(body?.model ?? "ai"),
    };
  } catch (err) {
    if (err instanceof InvalidAnalysisError) {
      throw new ProxyError("invalidResponse", t("The analysis came back in an unexpected format, so it is not shown. (%@)", err.message));
    }
    throw err;
  }
}

export type ChatTurn = { role: "user" | "assistant"; text: string; image?: { base64: string } | null };

/** One FixVoice reply. Only a photo in the newest turn is sent; the server picks the model. */
export async function chat(
  base: string,
  token: string,
  input: { locale: "de" | "en"; turns: ChatTurn[]; context: string | null; mode?: "chat" | "voice"; profile?: string | null },
  signal?: AbortSignal,
) {
  const body = await request(base, token, "/v1/chat", {
    method: "POST",
    signal,
    timeoutMs: 75_000,
    body: JSON.stringify({
      locale: input.locale,
      context: input.context,
      mode: input.mode ?? "chat",
      profile: input.profile ?? null,
      messages: input.turns.map((m, i) => ({
        role: m.role,
        text: m.text.slice(0, 4000),
        image: m.image && i === input.turns.length - 1 ? { mediaType: "image/jpeg", data: m.image.base64 } : null,
      })),
    }),
  });
  if (typeof body?.reply !== "string" || !body.reply.trim()) throw new ProxyError("invalidResponse", t("FixVoice could not answer. Try again."));
  return { reply: body.reply as string, model: String(body.model ?? ""), degraded: Boolean(body.degraded) };
}

export type AudioType = "audio/m4a" | "audio/mp4" | "audio/webm" | "audio/wav" | "audio/mpeg";

/** Speech to text for the voice mode (Whisper on the server). Empty string when nothing was said. */
export async function transcribe(base: string, token: string, input: { locale: "de" | "en"; mediaType: AudioType; data: string }, signal?: AbortSignal) {
  const body = await request(base, token, "/v1/transcribe", { method: "POST", signal, timeoutMs: 30_000, body: JSON.stringify(input) });
  return typeof body?.text === "string" ? body.text.trim() : "";
}

/** Server voice (Fish Audio). Resolves with MP3 bytes, or null when the server has no voice set up. */
export async function serverSpeech(base: string, token: string, input: { locale: "de" | "en"; gender: "female" | "male"; text: string }, signal?: AbortSignal) {
  const res = await fetch(`${base}/v1/tts`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-fixify-device": deviceId, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...input, text: input.text.slice(0, 1500) }),
  });
  if (!res.ok) return null;
  return res.arrayBuffer();
}

/** Refreshes the upload quota (e.g. at app start). */
export async function refreshQuota(base: string, token: string) {
  try {
    await request(base, token, "/v1/ping", { method: "GET", timeoutMs: 8000 });
  } catch {
    // Quota display is optional; errors show up when the user actually sends something.
  }
}
