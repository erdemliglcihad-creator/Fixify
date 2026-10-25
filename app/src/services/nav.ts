import { router } from "expo-router";
import type { ProblemCategory } from "../core/types.ts";
import { resetDraft } from "./draft.ts";

export function startScan(opts: { category?: ProblemCategory | null; library?: boolean; targetSessionId?: string } = {}) {
  resetDraft({ category: opts.category ?? null, targetSessionId: opts.targetSessionId ?? null });
  router.navigate({ pathname: "/scan", params: { library: opts.library ? "1" : "0", n: String(Date.now()) } });
}

export const openSession = (id: string) => router.push({ pathname: "/session/[id]", params: { id } });
