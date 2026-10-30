// The scan result as one short chat message: warnings first, then what is going on, then what to do.
// Steps point at the numbered markers on the photo ("(1)") when they belong to a marked spot.
import type { ProblemAnalysis } from "./types.ts";

/** `markerNumber` maps a finding id to its marker number on the photo, or null when it has none. */
export function chatAnswer(a: ProblemAnalysis, markerNumber: (findingId: string) => number | null): string {
  const parts: string[] = [];
  if (a.safety.level !== "none" && a.safety.warnings.length) parts.push(a.safety.warnings.join(" "));
  parts.push(!a.canHelp && a.cannotHelpReason ? a.cannotHelpReason : a.summary);

  if (a.steps.length) {
    parts.push(
      a.steps
        .map((s, i) => {
          const marks = [...new Set(s.findingIds.map(markerNumber).filter((n): n is number => n !== null))];
          return `${i + 1}. ${s.title}${marks.length ? ` (${marks.join(", ")})` : ""}`;
        })
        .join("\n"),
    );
  } else if (a.nextDiagnostic) {
    parts.push(a.nextDiagnostic.instruction);
  } else if (a.questions.length) {
    parts.push(a.questions[0].question);
  }
  return parts.filter((p) => p.trim()).join("\n\n");
}
