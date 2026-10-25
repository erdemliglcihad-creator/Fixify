// Session rules, kept free of React and storage so they can be tested with node --test.
import type { AnalysisMode, AnalysisRevision, FixSession, FixStep, ProblemAnalysis, SessionStatus, StepState } from "./types.ts";

export const isOpen = (s: SessionStatus) => s === "pendingAnalysis" || s === "active" || s === "unclear" || s === "partiallySolved";

export function latestRevision(session: FixSession): AnalysisRevision | null {
  return session.revisions.reduce<AnalysisRevision | null>((best, r) => (!best || r.number > best.number ? r : best), null);
}

export const currentAnalysis = (session: FixSession): ProblemAnalysis | null => latestRevision(session)?.analysis ?? null;

export function stateOf(session: FixSession, step: FixStep): StepState {
  return session.stepStates[step.id] ?? "pending";
}

/** Fraction of current plan steps that are done or skipped. */
export function progress(session: FixSession): number {
  const steps = currentAnalysis(session)?.steps ?? [];
  if (!steps.length) return session.status === "solved" ? 1 : 0;
  const finished = steps.filter((s) => ["done", "skipped"].includes(stateOf(session, s))).length;
  return finished / steps.length;
}

/** First step that still needs attention (pending or failed). */
export function currentStep(session: FixSession): FixStep | null {
  return currentAnalysis(session)?.steps.find((s) => ["pending", "failed"].includes(stateOf(session, s))) ?? null;
}

/** Keep progress only for steps that are genuinely the same in the new plan (same id and title). */
export function carryOverStates(old: ProblemAnalysis | null, states: Record<string, StepState>, next: ProblemAnalysis) {
  const titles = new Map((old?.steps ?? []).map((s) => [s.id, s.title]));
  const result: Record<string, StepState> = {};
  for (const step of next.steps) {
    if (titles.get(step.id) === step.title && states[step.id]) result[step.id] = states[step.id];
  }
  return result;
}

/** A photo was added after the latest analysis, so the plan does not know about it yet. */
export function hasNewObservation(session: FixSession): boolean {
  const rev = latestRevision(session);
  return Boolean(rev && isOpen(session.status) && session.images.some((i) => i.createdAt > rev.createdAt));
}

export function searchText(session: FixSession): string {
  const a = currentAnalysis(session);
  const ocr = session.images.flatMap((i) => i.blocks ?? []).map((b) => b.text);
  return [session.title, session.description, a?.title, a?.summary, ...(a?.steps.map((s) => s.title) ?? []), ...ocr]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Plan updates (non-initial server analyses) used in this session, for the per-session limit. */
export function updatesUsed(session: FixSession): number {
  return session.revisions.filter((r) => r.trigger !== ("initial" satisfies AnalysisMode)).length;
}

/** Images to send: the original first, then the newest observations, up to `max`. */
export function imagesToSend<T>(images: T[], max: number): T[] {
  if (!images.length || max <= 0) return [];
  if (max === 1) return [images[0]];
  return [images[0], ...images.slice(1).slice(-(max - 1))];
}
