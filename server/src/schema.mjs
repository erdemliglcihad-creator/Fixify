// Shape of one Fixify analysis. Two views of the same contract:
//  - ANALYSIS_JSON_SCHEMA constrains Claude's output (structured outputs).
//  - AnalysisSchema (zod) re-validates and normalizes it before it leaves the proxy.
// The iOS app decodes exactly this shape (Fixify/Models/Analysis.swift).
import { z } from "zod";

export const CATEGORIES = ["computer", "network", "peripheral", "software", "object", "appliance", "document", "general"];

const str = { type: "string" };
const strArray = { type: "array", items: str };
const nullable = (schema) => ({ anyOf: [schema, { type: "null" }] });
const obj = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});

const box = obj({ x: { type: "number" }, y: { type: "number" }, width: { type: "number" }, height: { type: "number" } });

export const ANALYSIS_JSON_SCHEMA = obj({
  title: str,
  category: { type: "string", enum: CATEGORIES },
  summary: str,
  confidenceNote: str,
  canHelp: { type: "boolean" },
  cannotHelpReason: nullable(str),
  findings: {
    type: "array",
    items: obj({
      id: str,
      label: str,
      detail: str,
      imageIndex: { type: "integer" },
      ocrBlockIds: strArray,
      box: nullable(box),
      boxConfidence: { type: "string", enum: ["high", "medium", "low", "none"] },
      source: { type: "string", enum: ["ocr", "visual", "user"] },
    }),
  },
  causes: {
    type: "array",
    items: obj({
      id: str,
      title: str,
      explanation: str,
      likelihood: { type: "string", enum: ["likely", "possible", "unlikely"] },
      evidence: strArray,
    }),
  },
  unknowns: strArray,
  questions: {
    type: "array",
    items: obj({ id: str, question: str, options: strArray }),
  },
  nextDiagnostic: nullable(obj({ title: str, instruction: str, reason: str })),
  steps: {
    type: "array",
    items: obj({
      id: str,
      title: str,
      explanation: str,
      action: str,
      expectedResult: str,
      pitfalls: strArray,
      findingIds: strArray,
      safetyNote: nullable(str),
    }),
  },
  tools: strArray,
  difficulty: nullable({ type: "string", enum: ["easy", "moderate", "hard", "expert"] }),
  estimatedMinutes: nullable({ type: "integer" }),
  safety: obj({
    level: { type: "string", enum: ["none", "caution", "danger"] },
    warnings: strArray,
    recommendProfessional: { type: "boolean" },
  }),
  successCriteria: strArray,
});

const clamp01 = (n) => Math.min(1, Math.max(0, n));

const BoxSchema = z
  .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
  .transform((b) => {
    const x = clamp01(b.x);
    const y = clamp01(b.y);
    return { x, y, width: clamp01(Math.min(b.width, 1 - x)), height: clamp01(Math.min(b.height, 1 - y)) };
  });

const nonEmpty = z.string().trim().min(1);

export const AnalysisSchema = z.object({
  title: nonEmpty.max(120),
  category: z.enum(CATEGORIES),
  summary: nonEmpty,
  confidenceNote: z.string(),
  canHelp: z.boolean(),
  cannotHelpReason: z.string().nullable(),
  findings: z
    .array(
      z.object({
        id: nonEmpty,
        label: nonEmpty,
        detail: z.string(),
        imageIndex: z.number().int(),
        ocrBlockIds: z.array(z.string()),
        box: BoxSchema.nullable(),
        boxConfidence: z.enum(["high", "medium", "low", "none"]),
        source: z.enum(["ocr", "visual", "user"]),
      }),
    )
    .max(12),
  causes: z
    .array(
      z.object({
        id: nonEmpty,
        title: nonEmpty,
        explanation: z.string(),
        likelihood: z.enum(["likely", "possible", "unlikely"]),
        evidence: z.array(z.string()),
      }),
    )
    .max(8),
  unknowns: z.array(z.string()).max(10),
  questions: z.array(z.object({ id: nonEmpty, question: nonEmpty, options: z.array(z.string()).max(6) })).max(4),
  nextDiagnostic: z.object({ title: nonEmpty, instruction: nonEmpty, reason: z.string() }).nullable(),
  steps: z
    .array(
      z.object({
        id: nonEmpty,
        title: nonEmpty,
        explanation: z.string(),
        action: nonEmpty,
        expectedResult: z.string(),
        pitfalls: z.array(z.string()),
        findingIds: z.array(z.string()),
        safetyNote: z.string().nullable(),
      }),
    )
    .max(12),
  tools: z.array(z.string()),
  difficulty: z.enum(["easy", "moderate", "hard", "expert"]).nullable(),
  estimatedMinutes: z.number().int().nonnegative().nullable(),
  safety: z.object({
    level: z.enum(["none", "caution", "danger"]),
    warnings: z.array(z.string()),
    recommendProfessional: z.boolean(),
  }),
  successCriteria: z.array(z.string()),
});

/**
 * Validates model output and drops references that point at nothing,
 * so the app never draws a marker for an image or OCR block that was not sent.
 */
export function validateAnalysis(raw, { imageCount, ocrIds }) {
  const parsed = AnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  const a = parsed.data;
  const findingIds = new Set();
  a.findings = a.findings
    .filter((f) => f.imageIndex >= 0 && f.imageIndex < imageCount)
    .map((f) => {
      const ids = f.ocrBlockIds.filter((id) => ocrIds.has(`${f.imageIndex}:${id}`));
      const box = f.box && f.box.width > 0.005 && f.box.height > 0.005 ? f.box : null;
      return { ...f, ocrBlockIds: ids, box, boxConfidence: box ? f.boxConfidence : "none" };
    });
  for (const f of a.findings) findingIds.add(f.id);
  a.steps = a.steps.map((s) => ({ ...s, findingIds: s.findingIds.filter((id) => findingIds.has(id)) }));
  if (!a.canHelp && !a.cannotHelpReason) a.cannotHelpReason = a.confidenceNote || a.summary;
  return { ok: true, analysis: a };
}
