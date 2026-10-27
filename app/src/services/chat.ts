// FixBot conversation: one ongoing chat, kept on this iPhone. Replies come from Fixify Cloud (Groq).
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { FixSession } from "../core/types.ts";
import { currentAnalysis, currentStep } from "../core/session.ts";
import { lang, t } from "../i18n/index.ts";
import { encodeForAnalysis, storeImage } from "./images.ts";
import { chat, ProxyError, type ChatTurn } from "./proxy.ts";
import { getSession } from "./sessions.ts";
import { serverBase, settingsStore } from "./settings.ts";
import { createStore, useStore } from "./store.ts";

export type ChatPhoto = { uri: string; width: number; height: number };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  photo?: ChatPhoto | null;
  createdAt: number;
  model?: string;
  /** Answered by a smaller fallback model because the main one was busy. */
  degraded?: boolean;
  /** Set on a user message whose reply failed. */
  failed?: string;
  /** Spoken in voice mode. */
  voice?: boolean;
};

type ChatState = { messages: ChatMessage[]; contextSessionId: string | null; sending: boolean };

const KEY = "chat.v1";
const HISTORY_SENT = 12;
const HISTORY_KEPT = 80;

export const chatStore = createStore<ChatState>({ messages: [], contextSessionId: null, sending: false });
export const useChat = () => useStore(chatStore);

let controller: AbortController | null = null;

function persist() {
  const { messages, contextSessionId } = chatStore.get();
  AsyncStorage.setItem(KEY, JSON.stringify({ messages: messages.slice(-HISTORY_KEPT), contextSessionId })).catch(() => {});
}

export async function loadChat() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return;
  const saved = JSON.parse(raw) as Partial<ChatState>;
  chatStore.set({ messages: saved.messages ?? [], contextSessionId: saved.contextSessionId ?? null, sending: false });
}

export function newChat() {
  controller?.abort();
  chatStore.set({ messages: [], contextSessionId: null, sending: false });
  persist();
}

/** Ask FixBot about a Fix session: its summary goes along as context. */
export function setChatContext(sessionId: string | null) {
  chatStore.set((s) => ({ ...s, contextSessionId: sessionId }));
  persist();
}

/** Compact, factual summary of a session for FixBot (no photos). */
export function sessionContext(session: FixSession): string {
  const a = currentAnalysis(session);
  const step = currentStep(session);
  const tried = session.events.filter((e) => e.kind === "stepDone" || e.kind === "stepFailed").slice(-6);
  return [
    `Problem: ${a?.title ?? session.title}`,
    session.description ? `User's description: ${session.description.slice(0, 400)}` : null,
    a ? `Analysis: ${a.summary}` : "Not analyzed yet.",
    a?.causes.length ? `Possible causes: ${a.causes.map((c) => `${c.title} (${c.likelihood})`).join("; ")}` : null,
    step ? `Current step: ${step.title} – ${step.action}` : null,
    tried.length ? `Tried so far: ${tried.map((e) => `${e.kind === "stepDone" ? "done" : "did not work"}: ${e.text}`).join("; ")}` : null,
    `Status: ${session.status}`,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2900);
}

function append(message: ChatMessage) {
  chatStore.set((s) => ({ ...s, messages: [...s.messages, message] }));
}

function markFailed(id: string, failed: string | undefined) {
  chatStore.set((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, failed } : m)) }));
}

export function cancelReply() {
  controller?.abort();
}

/** Sends a message and resolves with FixBot's reply, or null if it failed (the error is on the message). */
export async function sendMessage(text: string, photo: ChatPhoto | null, options: { voice?: boolean } = {}): Promise<ChatMessage | null> {
  const s = settingsStore.get();
  const base = serverBase(s);
  const trimmed = text.trim();
  if ((!trimmed && !photo) || chatStore.get().sending) return null;

  const stored = photo ? await storeImage(photo.uri, photo.width, photo.height) : null;
  const userMessage: ChatMessage = {
    id: Crypto.randomUUID(),
    role: "user",
    text: trimmed,
    photo: stored ? { uri: stored.uri, width: stored.width, height: stored.height } : null,
    createdAt: Date.now(),
    voice: options.voice || undefined,
  };
  append(userMessage);
  chatStore.set((st) => ({ ...st, sending: true }));
  persist();

  controller = new AbortController();
  try {
    if (!base) throw new ProxyError("notConfigured", t("Choose an AI service in Settings to get a diagnosis and a guided plan."));
    const history = chatStore.get().messages.filter((m) => !m.failed).slice(-HISTORY_SENT);
    const turns: ChatTurn[] = [];
    for (const m of history) {
      const isNewest = m.id === userMessage.id;
      turns.push({
        role: m.role,
        text: m.text,
        image: isNewest && m.photo ? { base64: (await encodeForAnalysis(m.photo)).base64 } : m.photo ? { base64: "" } : null,
      });
    }
    // Older photos are only mentioned as "[photo]" by the server; strip their (empty) payloads here.
    const cleaned = turns.map((turn, i) => (i === turns.length - 1 ? turn : { ...turn, text: turn.image ? `[photo] ${turn.text}` : turn.text, image: null }));
    const contextId = chatStore.get().contextSessionId;
    const session = contextId ? getSession(contextId) : null;
    const out = await chat(base, s.provider === "proxy" ? s.appToken : "", { locale: lang, turns: cleaned, context: session ? sessionContext(session) : null }, controller.signal);
    const reply: ChatMessage = { id: Crypto.randomUUID(), role: "assistant", text: out.reply, createdAt: Date.now(), model: out.model, degraded: out.degraded };
    append(reply);
    return reply;
  } catch (err) {
    const message = err instanceof ProxyError ? (err.code === "cancelled" ? t("Stopped.") : err.message) : t("FixBot could not answer. Try again.");
    markFailed(userMessage.id, message);
    return null;
  } finally {
    controller = null;
    chatStore.set((st) => ({ ...st, sending: false }));
    persist();
  }
}

/** Sends a failed message again (removes the failed copy first). */
export async function retryMessage(id: string) {
  const message = chatStore.get().messages.find((m) => m.id === id);
  if (!message) return;
  chatStore.set((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== id) }));
  await sendMessage(message.text, message.photo ?? null);
}
