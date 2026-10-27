// Speech to text for FixBot's voice mode, via Groq Whisper (OpenAI-compatible endpoint).
import { z } from "zod";
import { AnalysisError } from "../../server/src/analyze.mjs";

export const TranscribeRequestSchema = z.object({
  locale: z.enum(["de", "en"]).default("en"),
  mediaType: z.enum(["audio/m4a", "audio/mp4", "audio/webm", "audio/wav", "audio/mpeg"]),
  // ~60 s of compressed speech is far below this; longer clips are rejected.
  data: z.string().min(1).max(4_000_000),
});

const EXT = { "audio/m4a": "m4a", "audio/mp4": "m4a", "audio/webm": "webm", "audio/wav": "wav", "audio/mpeg": "mp3" };

/** Whisper sometimes "hears" these in silence; treat them as no speech. */
const HALLUCINATIONS = [/^(untertitel|subtitles).*$/i, /^(vielen dank|thank you)[.!]?$/i, /^\.+$/];

export async function transcribe({ baseUrl, apiKey, model, req, signal, fetchImpl = fetch }) {
  const bytes = Uint8Array.from(atob(req.data), (ch) => ch.charCodeAt(0));
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: req.mediaType }), `speech.${EXT[req.mediaType]}`);
  form.append("model", model);
  form.append("language", req.locale);
  form.append("response_format", "json");
  form.append("temperature", "0");
  let res;
  try {
    res = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: form, signal });
  } catch {
    throw new AnalysisError("upstream_unreachable", "The server cannot reach the speech service.", 502);
  }
  if (res.status === 401 || res.status === 403) throw new AnalysisError("not_configured", "The server's AI key was rejected.", 503);
  if (res.status === 429) throw new AnalysisError("upstream_rate_limited", "Voice is busy right now. Try again shortly.", 503);
  if (!res.ok) throw new AnalysisError("upstream_error", `Speech service error (${res.status}).`, 502);
  const body = await res.json();
  const text = String(body?.text ?? "").trim();
  return HALLUCINATIONS.some((re) => re.test(text)) ? "" : text;
}
