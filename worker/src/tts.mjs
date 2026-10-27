// Text to speech for FixVoice via Fish Audio. Off until the FISH_API_KEY secret is set;
// the app then falls back to the iPhone's own voice.
import { z } from "zod";
import { AnalysisError } from "../../server/src/analyze.mjs";

export const TtsRequestSchema = z.object({
  locale: z.enum(["de", "en"]).default("en"),
  gender: z.enum(["female", "male"]).default("female"),
  text: z.string().min(1).max(1500),
});

/** Voice model ids per language and gender (Fish Audio "reference_id"), overridable via vars. */
export function fishVoice(env, locale, gender) {
  const key = `FISH_VOICE_${locale.toUpperCase()}_${gender.toUpperCase()}`;
  return env[key] || null;
}

export async function fishSpeech({ apiKey, voice, text, model = "s1", signal, fetchImpl = fetch }) {
  let res;
  try {
    res = await fetchImpl("https://api.fish.audio/v1/tts", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json", model },
      body: JSON.stringify({ text, reference_id: voice, format: "mp3", latency: "balanced" }),
      signal,
    });
  } catch {
    throw new AnalysisError("upstream_unreachable", "The server cannot reach the voice service.", 502);
  }
  if (res.status === 401 || res.status === 402 || res.status === 403) throw new AnalysisError("not_configured", "The voice service key or credit is missing.", 503);
  if (res.status === 429) throw new AnalysisError("upstream_rate_limited", "The voice service is busy.", 503);
  if (!res.ok) throw new AnalysisError("upstream_error", `Voice service error (${res.status}).`, 502);
  return res.arrayBuffer();
}
