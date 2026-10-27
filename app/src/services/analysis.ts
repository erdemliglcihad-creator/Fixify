// Runs text recognition and analyses for sessions and exposes their real progress.
// Phases only advance when the corresponding work has actually happened.
import * as Crypto from "expo-crypto";
import type { AnalysisMode, FixSession } from "../core/types.ts";
import { carryOverStates, currentAnalysis, imagesToSend, latestRevision } from "../core/session.ts";
import { lang, t } from "../i18n/index.ts";
import { encodeForAnalysis } from "./images.ts";
import { analyze, ProxyError, recognizeText } from "./proxy.ts";
import { getSession, logEvent, updateSession } from "./sessions.ts";
import { isServerConfigured, serverBase, settingsStore } from "./settings.ts";
import { createStore, useStore } from "./store.ts";
import { limits } from "./usage.ts";

export type Phase = "preparing" | "recognizing" | "analyzing" | "checking";
export type Job = { phase: Phase; mode: AnalysisMode; startedAt: number; controller: AbortController };
export type Failure = { code: ProxyError["code"]; message: string; retryable: boolean };

export const phaseTitle = (p: Phase) =>
  ({
    preparing: t("Preparing photos and recognized text"),
    recognizing: t("Recognizing text"),
    analyzing: t("The AI is analyzing"),
    checking: t("Checking the result"),
  })[p];

const jobsStore = createStore<Record<string, Job>>({});
const failuresStore = createStore<Record<string, Failure>>({});
export const useJob = (id: string) => useStore(jobsStore)[id] ?? null;
export const useFailure = (id: string) => useStore(failuresStore)[id] ?? null;

function setJob(id: string, job: Job | null) {
  jobsStore.set((all) => {
    const next = { ...all };
    if (job) next[id] = job;
    else delete next[id];
    return next;
  });
}

function setFailure(id: string, failure: Failure | null) {
  failuresStore.set((all) => {
    const next = { ...all };
    if (failure) next[id] = failure;
    else delete next[id];
    return next;
  });
}

export type Preflight = "ready" | "needsConsent" | "needsSetup" | "off";

/** What has to happen before an analysis may run. Screens handle each case (consent, setup, paywall). */
export function preflight(_session: FixSession, _mode: AnalysisMode): Preflight {
  const s = settingsStore.get();
  if (s.provider === "off") return "off";
  if (!isServerConfigured(s)) return "needsSetup";
  if (!s.consent) return "needsConsent";
  return "ready";
}

export function cancel(id: string) {
  jobsStore.get()[id]?.controller.abort();
}

/** Text recognition only (used right after capture). Silent no-op without server or consent. */
export async function recognizeMissingText(sessionId: string) {
  const s = settingsStore.get();
  const base = serverBase(s);
  if (!base || !isServerConfigured(s) || !s.consent || jobsStore.get()[sessionId]) return;
  const controller = new AbortController();
  setJob(sessionId, { phase: "recognizing", mode: "initial", startedAt: Date.now(), controller });
  try {
    await ocrPending(sessionId, base, s.appToken, controller.signal);
  } catch {
    // Not fatal: the analysis retries text recognition and reports real errors.
  } finally {
    setJob(sessionId, null);
  }
}

async function ocrPending(sessionId: string, base: string, token: string, signal: AbortSignal) {
  const session = getSession(sessionId);
  for (const image of session?.images.filter((i) => i.blocks === null) ?? []) {
    const encoded = await encodeForAnalysis(image);
    const blocks = await recognizeText(base, token, encoded, signal);
    updateSession(sessionId, (s) => ({ ...s, images: s.images.map((i) => (i.id === image.id ? { ...i, blocks } : i)) }));
    if (signal.aborted) return;
  }
}

export function start(sessionId: string, mode: AnalysisMode, feedback: string | null = null) {
  if (jobsStore.get()[sessionId]) return;
  setFailure(sessionId, null);
  const controller = new AbortController();
  setJob(sessionId, { phase: "preparing", mode, startedAt: Date.now(), controller });
  run(sessionId, mode, feedback, controller).finally(() => setJob(sessionId, null));
}

async function run(sessionId: string, mode: AnalysisMode, feedback: string | null, controller: AbortController) {
  const s = settingsStore.get();
  const base = serverBase(s);
  const phase = (p: Phase) => setJob(sessionId, { ...jobsStore.get()[sessionId], phase: p });
  try {
    if (!base) throw new ProxyError("notConfigured", t("No analysis server is set up. Add its address and app token in Settings."));

    phase("recognizing");
    try {
      await ocrPending(sessionId, base, s.appToken, controller.signal);
    } catch (err) {
      // Text recognition only adds exact markers. If it is unavailable, the analysis still runs;
      // only a cancel or an unreachable server stops here.
      if (err instanceof ProxyError && (err.code === "cancelled" || err.code === "unreachable" || err.code === "offline")) throw err;
      updateSession(sessionId, (cur) => logEvent(cur, "note", t("Text recognition was not available. The analysis uses the photo only.")));
    }

    phase("preparing");
    const session = getSession(sessionId);
    if (!session) return;
    const chosen = imagesToSend(session.images, limits.imagesPerAnalysis);
    const images = [];
    for (const image of chosen) {
      const encoded = await encodeForAnalysis(image);
      images.push({ label: image === session.images[0] ? "original" : "later observation", base64: encoded.base64, blocks: image.blocks ?? [] });
    }

    phase("analyzing");
    const result = await analyze(
      base,
      s.appToken,
      {
        mode,
        locale: lang,
        description: session.description,
        categoryHint: session.category,
        images,
        history: session.events.map((e) => ({ kind: e.kind, text: e.text })),
        answers: session.answers,
        feedback,
        previousAnalysis: mode === "initial" ? null : currentAnalysis(session),
      },
      controller.signal,
    );

    phase("checking");
    updateSession(sessionId, (current) => {
      const previous = currentAnalysis(current);
      const number = (latestRevision(current)?.number ?? 0) + 1;
      let next: FixSession = {
        ...current,
        revisions: [
          ...current.revisions,
          { id: Crypto.randomUUID(), number, createdAt: Date.now(), analysis: result.analysis, provider: result.model, trigger: mode, sentImageIds: chosen.map((i) => i.id) },
        ],
        stepStates: carryOverStates(previous, current.stepStates, result.analysis),
        status: "active",
        category: current.category ?? result.analysis.category,
        title: number === 1 ? result.analysis.title : current.title,
      };
      next = logEvent(
        next,
        mode === "initial" ? "analyzed" : "replanned",
        mode === "initial" ? t("Analysis: %@", result.analysis.title) : t("Plan updated with %lld steps", result.analysis.steps.length),
      );
      return next;
    });
  } catch (err) {
    const e = err instanceof ProxyError ? err : new ProxyError("server", String((err as Error)?.message ?? err));
    if (e.code === "cancelled") {
      updateSession(sessionId, (cur) => logEvent(cur, "note", t("Analysis cancelled")));
      return;
    }
    setFailure(sessionId, { code: e.code, message: e.message, retryable: e.retryable });
    updateSession(sessionId, (cur) => logEvent(cur, "analysisFailed", e.message));
  }
}
