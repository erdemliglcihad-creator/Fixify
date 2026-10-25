// Usage limits per tier. Change the numbers here; nothing else hard-codes them.
// Only server (Claude) analyses count; text recognition is always free.

export type UsageLimits = { analysesPerMonth: number; updatesPerSession: number; imagesPerAnalysis: number; storedSessions: number | null };

export const FREE: UsageLimits = { analysesPerMonth: 15, updatesPerSession: 3, imagesPerAnalysis: 2, storedSessions: 30 };
export const PRO: UsageLimits = { analysesPerMonth: 300, updatesPerSession: 25, imagesPerAnalysis: 4, storedSessions: null };

export type UsageState = { month: string; count: number; lifetime: number };

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function rolled(state: UsageState, now: Date): UsageState {
  const month = monthKey(now);
  return state.month === month ? state : { ...state, month, count: 0 };
}

export function remaining(state: UsageState, limits: UsageLimits, now: Date): number {
  return Math.max(0, limits.analysesPerMonth - rolled(state, now).count);
}

export function recorded(state: UsageState, now: Date): UsageState {
  const s = rolled(state, now);
  return { month: s.month, count: s.count + 1, lifetime: s.lifetime + 1 };
}
