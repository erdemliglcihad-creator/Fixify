// Data model. ProblemAnalysis mirrors server/src/schema.mjs field for field.

export const CATEGORIES = ["computer", "network", "peripheral", "software", "object", "appliance", "document", "general"] as const;
export type ProblemCategory = (typeof CATEGORIES)[number];

/** Rectangle in image space, 0...1, origin top-left. */
export type NormalizedRect = { x: number; y: number; width: number; height: number };

export type Finding = {
  id: string;
  label: string;
  detail: string;
  imageIndex: number;
  ocrBlockIds: string[];
  box: NormalizedRect | null;
  boxConfidence: "high" | "medium" | "low" | "none";
  source: "ocr" | "visual" | "user";
};

export type Cause = {
  id: string;
  title: string;
  explanation: string;
  likelihood: "likely" | "possible" | "unlikely";
  evidence: string[];
};

export type Question = { id: string; question: string; options: string[] };
export type Diagnostic = { title: string; instruction: string; reason: string };

export type FixStep = {
  id: string;
  title: string;
  explanation: string;
  action: string;
  expectedResult: string;
  pitfalls: string[];
  findingIds: string[];
  safetyNote: string | null;
};

export type ProblemAnalysis = {
  title: string;
  category: ProblemCategory;
  summary: string;
  confidenceNote: string;
  canHelp: boolean;
  cannotHelpReason: string | null;
  findings: Finding[];
  causes: Cause[];
  unknowns: string[];
  questions: Question[];
  nextDiagnostic: Diagnostic | null;
  steps: FixStep[];
  tools: string[];
  difficulty: "easy" | "moderate" | "hard" | "expert" | null;
  estimatedMinutes: number | null;
  safety: { level: "none" | "caution" | "danger"; warnings: string[]; recommendProfessional: boolean };
  successCriteria: string[];
};

/** One line of text recognized by the proxy's OCR. */
export type TextBlock = { id: string; text: string; box: NormalizedRect; confidence: number };

export type SessionStatus = "pendingAnalysis" | "active" | "solved" | "partiallySolved" | "unresolved" | "unclear";
export type StepState = "pending" | "done" | "failed" | "skipped";
export type ImageSource = "camera" | "library" | "videoFrame";
export type AnalysisMode = "initial" | "replan" | "followup";
export type EventKind =
  | "captured"
  | "analyzed"
  | "analysisFailed"
  | "stepDone"
  | "stepFailed"
  | "stepSkipped"
  | "answer"
  | "photoAdded"
  | "note"
  | "replanned"
  | "verified";

export type SessionImage = {
  id: string;
  createdAt: number;
  /** Stored image: a file URI on the phone, a data URI in the web preview. */
  uri: string;
  /** Content hash; identical images share one file. */
  hash: string;
  width: number;
  height: number;
  source: ImageSource;
  /** null = text recognition has not run (no server), [] = ran and found nothing. */
  blocks: TextBlock[] | null;
};

export type AnalysisRevision = {
  id: string;
  number: number;
  createdAt: number;
  analysis: ProblemAnalysis;
  provider: string;
  trigger: AnalysisMode;
  /** Ids of the images sent, in send order (= the analysis' imageIndex). */
  sentImageIds: string[];
};

export type SessionEvent = { id: string; date: number; kind: EventKind; text: string; stepId?: string };
export type AnsweredQuestion = { question: string; answer: string };

export type FixSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  status: SessionStatus;
  category: ProblemCategory | null;
  description: string;
  images: SessionImage[];
  revisions: AnalysisRevision[];
  events: SessionEvent[];
  stepStates: Record<string, StepState>;
  answers: AnsweredQuestion[];
  outcomeNote: string | null;
};

export type MarkerPrecision = "textMatch" | "estimated";
export type ResolvedMarker = { id: string; number: number; finding: Finding; rect: NormalizedRect; precision: MarkerPrecision };
