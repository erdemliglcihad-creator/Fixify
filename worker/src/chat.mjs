// FixBot: Fixify's chat assistant. Text goes to a chat model chain, a photo in the newest message to the vision model.
import { z } from "zod";
import { chatCompletion } from "./openai.mjs";

export const FIXBOT_PROMPT = `You are FixVoice, the voice assistant inside Fixify, an iPhone app that helps people solve practical problems: computers and software, Wi-Fi and Bluetooth, printers and other devices, household appliances, everyday objects, documents and forms.

How you answer
- Be concrete and practical. Short paragraphs, numbered steps when there is something to do, at most about 180 words unless the user asks for more.
- Say what you are unsure about. Never claim to know something a photo or description cannot show, and never claim a problem is fixed; tell the user how to check.
- Ask one targeted question when you need information to help.
- When a photo would make diagnosis much easier, suggest the Live Fix camera in the app.
- Safety first: for mains electricity, gas, car brakes or airbags, swollen batteries, chemicals or anything medical or legal, give a clear warning and recommend a professional. Never give instructions for opening mains-powered devices.
- If a question is unrelated to fixing or understanding things, you may still help briefly and kindly.
- Answer in the language given below. No emojis. You may use **bold** for key words and "-" or "1." lists.`;

const Message = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(4000),
  image: z.object({ mediaType: z.enum(["image/jpeg", "image/png"]), data: z.string().min(1).max(2_800_000) }).nullable().optional(),
});

export const ChatRequestSchema = z.object({
  locale: z.enum(["de", "en"]).default("en"),
  messages: z.array(Message).min(1).max(24),
  /** Short summary of a Fix session the user is asking about. */
  context: z.string().max(3000).nullable().optional(),
  /** "voice": a spoken phone-style call (FixVoice), answers are read aloud. */
  mode: z.enum(["chat", "voice", "screen"]).default("chat"),
});

const SCREEN_RULES = `

This is a quick question about what is on the user's iPhone screen right now (a screenshot is attached). They may be in any app: a video, a social feed, a website, a game, a chat.
- Answer exactly what they ask about the screen: who or what is shown, the name of a show, anime, film, song, product, place or app, what a text means, a translation, a quick explanation.
- Answer directly in 1 to 3 short sentences that sound natural when read aloud. Lead with the answer itself. No markdown, no lists, no emojis.
- Give your best identification plainly. Only if the screen really gives nothing to go on, say so in one short sentence and suggest what would help.
- Do not describe the whole screen unless asked. Never read out private data like passwords or codes.`;

const VOICE_RULES = `

This is a live voice call (FixVoice). Your answer is read aloud:
- Talk like a calm, friendly technician on the phone. Plain sentences, no markdown, no lists, no symbols, no emojis.
- Keep it short: 2 to 4 sentences, at most about 70 words. Give one step at a time and ask if it worked before the next.
- If you need details, ask exactly one short question.`;

/** Only a photo in the newest message is sent (to the vision model); older ones become "[photo]" to save tokens. */
export function buildChatMessages(req) {
  const last = req.messages.length - 1;
  const lastImageIndex = req.messages[last].role === "user" && req.messages[last].image ? last : -1;
  const system =
    FIXBOT_PROMPT +
    (req.mode === "voice" ? VOICE_RULES : req.mode === "screen" ? SCREEN_RULES : "") +
    `\n\nReply in: ${req.locale === "de" ? "German" : "English"}.` +
    (req.context ? `\n\nThe user is asking about this Fixify session:\n${req.context}` : "");
  const messages = [{ role: "system", content: system }];
  req.messages.forEach((m, i) => {
    if (m.role === "user" && m.image && i === lastImageIndex) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${m.image.mediaType};base64,${m.image.data}` } },
          { type: "text", text: m.text || "What do you see, and what could be wrong?" },
        ],
      });
    } else {
      messages.push({ role: m.role, content: m.image ? `[photo] ${m.text}` : m.text });
    }
  });
  return { messages, hasImage: lastImageIndex >= 0 };
}

export function cleanReply(text) {
  return String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .trim();
}

export async function fixbotReply(req, { baseUrl, apiKey, textModels, visionModels, signal, fetchImpl = fetch }) {
  const { messages, hasImage } = buildChatMessages(req);
  const out = await chatCompletion({
    baseUrl,
    apiKey,
    models: hasImage ? visionModels : textModels,
    messages,
    maxTokens: 1200,
    timeoutMs: 60_000,
    signal,
    fetchImpl,
  });
  const reply = cleanReply(out.content);
  if (!reply) throw new Error("empty reply");
  return { reply, model: out.model, degraded: out.degraded, hasImage };
}
