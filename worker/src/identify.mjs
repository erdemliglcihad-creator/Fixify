// "Tap to identify": the user taps up to three objects in the live camera; the photo comes with those spots
// drawn in as colored rings (1 = red, 2 = green, 3 = blue) plus their coordinates. The vision model names each
// object and lists a few notable parts, for the holographic labels in the app.
import { z } from "zod";
import { AnalysisError } from "../../server/src/analyze.mjs";
import { chatCompletion, extractJson } from "./openai.mjs";

const RING_COLORS = ["red", "green", "blue"];

export const IdentifyRequestSchema = z.object({
  locale: z.enum(["de", "en"]).default("en"),
  image: z.object({ mediaType: z.enum(["image/jpeg", "image/png"]), data: z.string().min(1).max(2_800_000) }),
  points: z.array(z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).min(1).max(3),
  /** Profile summary from the first-launch questions (optional). */
  profile: z.string().max(800).nullable().optional(),
});

const ObjectSchema = z.object({
  point: z.number().int().min(1).max(3),
  name: z.string().min(1).max(60),
  description: z.string().max(200).default(""),
  parts: z.array(z.string().min(1).max(40)).max(4).default([]),
});

export function identifyPrompt(req) {
  const spots = req.points
    .map((p, i) => `${i + 1}: the ${RING_COLORS[i]} ring at x=${p.x.toFixed(2)}, y=${p.y.toFixed(2)} (0..1 from the top left)`)
    .join("\n");
  return `You identify objects in a photo for Fixify, an app that helps people fix things. The user tapped these spots, drawn as colored rings:
${spots}

For each spot, name the object or component at the center of its ring as specifically as the photo allows (e.g. "Turbocharger", "Washing machine motor", "Wi-Fi router"), add one short sentence about what it is or does, and list up to 4 notable parts of it that are visible or typical (short names).
If a spot shows nothing recognizable, say so as the name ("Unclear area") instead of guessing.
${req.profile ? `About the user: ${req.profile}\n` : ""}Write the names, sentences and parts in ${req.locale === "de" ? "German" : "English"}.
Reply only with JSON: {"objects":[{"point":1,"name":"...","description":"...","parts":["..."]}]}`;
}

export async function identifyObjects(req, { baseUrl, apiKey, models, signal, fetchImpl = fetch }) {
  const out = await chatCompletion({
    baseUrl,
    apiKey,
    models,
    json: true,
    maxTokens: 900,
    timeoutMs: 45_000,
    signal,
    fetchImpl,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: identifyPrompt(req) },
          { type: "image_url", image_url: { url: `data:${req.image.mediaType};base64,${req.image.data}` } },
        ],
      },
    ],
  });
  const parsed = extractJson(out.content);
  const objects = (Array.isArray(parsed?.objects) ? parsed.objects : [])
    .map((o) => ObjectSchema.safeParse(o))
    .filter((r) => r.success)
    .map((r) => r.data)
    .filter((o) => o.point <= req.points.length);
  if (!objects.length) throw new AnalysisError("invalid_model_output", "No objects were recognized.", 502);
  return { objects, model: out.model };
}
