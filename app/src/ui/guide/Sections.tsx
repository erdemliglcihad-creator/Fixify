import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { findingNumber } from "../../core/analysis.ts";
import type { AnsweredQuestion, AnalysisRevision, Cause, Diagnostic, Finding, FixSession, FixStep, ProblemAnalysis, Question, SessionEvent, StepState } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { phaseTitle, type Failure, type Job, type Preflight } from "../../services/analysis.ts";
import { categoryInfo, type IconName } from "../categories.ts";
import { Body, Button, Caption, Card, Chip, Divider, MarkerBadge, SectionTitle } from "../components.tsx";
import { mono, radius, space, type, useTheme } from "../theme.ts";

export function AnalysisHeader({ analysis, revision }: { analysis: ProblemAnalysis; revision: AnalysisRevision | null }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space.s }}>
      <View style={{ flexDirection: "row", gap: space.s, flexWrap: "wrap" }}>
        <Chip text={categoryInfo[analysis.category].title()} icon={categoryInfo[analysis.category].icon} />
        <Chip text="Claude" color={c.secondary} icon="server-outline" />
        {revision && revision.number > 1 && <Chip text={t("Plan v%lld", revision.number)} color={c.secondary} icon="git-branch-outline" />}
      </View>
      <Text style={[type.title, { color: c.text }]}>{analysis.title}</Text>
      <Body>{analysis.summary}</Body>
      {analysis.confidenceNote ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Ionicons name="speedometer-outline" size={15} color={c.secondary} style={{ marginTop: 2 }} />
          <Caption style={{ flex: 1 }}>{analysis.confidenceNote}</Caption>
        </View>
      ) : null}
    </View>
  );
}

export function FindingsSection({ analysis, located, onSelect }: { analysis: ProblemAnalysis; located: Set<string>; onSelect: (f: Finding) => void }) {
  const { c } = useTheme();
  const source = (f: Finding) =>
    ({ ocr: t("From recognized text"), visual: t("Seen in the image"), user: t("From your description") })[f.source] +
    (located.has(f.id) ? "" : ` · ${t("not marked on the image")}`);
  return (
    <Card>
      <SectionTitle title={t("What Fixify sees")} icon="eye-outline" />
      {analysis.findings.map((f, i) => (
        <Pressable key={f.id} onPress={() => onSelect(f)} style={{ flexDirection: "row", gap: space.m }} accessibilityRole="button">
          <MarkerBadge number={i + 1} size={22} dimmed={!located.has(f.id)} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.body, { color: c.text, fontWeight: "500" }]}>{f.label}</Text>
            {f.detail ? <Caption>{f.detail}</Caption> : null}
            <Caption style={{ fontSize: 12 }}>{source(f)}</Caption>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

export function CausesSection({ causes }: { causes: Cause[] }) {
  const { c } = useTheme();
  const chip = (l: Cause["likelihood"]) =>
    l === "likely" ? <Chip text={t("Likely")} /> : l === "possible" ? <Chip text={t("Possible")} color={c.caution} /> : <Chip text={t("Unlikely")} color={c.secondary} />;
  return (
    <Card>
      <SectionTitle title={t("Possible causes")} icon="list-outline" />
      {causes.map((cause, i) => (
        <View key={cause.id} style={{ gap: 4 }}>
          {i > 0 && <Divider />}
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.s, marginTop: i > 0 ? space.s : 0 }}>
            <Text style={[type.body, { color: c.text, fontWeight: "600", flex: 1 }]}>{cause.title}</Text>
            {chip(cause.likelihood)}
          </View>
          {cause.explanation ? <Caption>{cause.explanation}</Caption> : null}
          {cause.evidence.map((e) => (
            <Caption key={e} style={{ fontSize: 13 }}>{`↳ ${e}`}</Caption>
          ))}
        </View>
      ))}
    </Card>
  );
}

export function UnknownsSection({ unknowns }: { unknowns: string[] }) {
  return (
    <Card>
      <SectionTitle title={t("Not known yet")} icon="help-circle-outline" />
      {unknowns.map((u) => (
        <Caption key={u}>{`○ ${u}`}</Caption>
      ))}
    </Card>
  );
}

export function NextDiagnosticCard({ d }: { d: Diagnostic }) {
  const { c } = useTheme();
  return (
    <View style={[styles.soft, { backgroundColor: c.accentSoft }]}>
      <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>{t("Check this first")}</Text>
      <Text style={[type.headline, { color: c.text }]}>{d.title}</Text>
      <Body>{d.instruction}</Body>
      {d.reason ? <Caption>{d.reason}</Caption> : null}
    </View>
  );
}

/** Targeted follow-up questions. Answers feed the next analysis. */
export function QuestionsSection({ questions, canUpdate, onSubmit }: { questions: Question[]; canUpdate: boolean; onSubmit: (a: AnsweredQuestion[]) => void }) {
  const { c } = useTheme();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const set = (id: string, v: string | null) =>
    setAnswers((a) => {
      const next = { ...a };
      if (v) next[id] = v;
      else delete next[id];
      return next;
    });
  return (
    <Card>
      <SectionTitle title={t("Fixify needs to know")} icon="chatbubbles-outline" />
      {questions.map((q) => (
        <View key={q.id} style={{ gap: space.s }}>
          <Text style={[type.body, { color: c.text, fontWeight: "500" }]}>{q.question}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
            {q.options.map((o) => {
              const sel = answers[q.id] === o;
              return (
                <Pressable key={o} onPress={() => set(q.id, sel ? null : o)} style={[styles.option, { backgroundColor: sel ? c.accent : c.raised, borderColor: c.hairline }]} aria-selected={sel}>
                  <Text style={{ color: sel ? "#fff" : c.text, fontSize: 15 }}>{o}</Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={q.options.includes(answers[q.id] ?? "") ? "" : (answers[q.id] ?? "")}
            onChangeText={(v) => set(q.id, v)}
            placeholder={t("Or type an answer")}
            placeholderTextColor={c.secondary}
            style={[styles.input, { color: c.text, borderColor: c.hairline, backgroundColor: c.background }]}
          />
        </View>
      ))}
      <Button
        title={canUpdate ? t("Send answers and update the plan") : t("Save answers")}
        disabled={!Object.keys(answers).length}
        onPress={() => {
          onSubmit(questions.filter((q) => answers[q.id]).map((q) => ({ question: q.question, answer: answers[q.id] })));
          setAnswers({});
        }}
      />
    </Card>
  );
}

const stateColor = (c: ReturnType<typeof useTheme>["c"], s: StepState, current: boolean) =>
  s === "done" ? c.success : s === "failed" ? c.danger : s === "skipped" ? c.hairline : current ? c.accent : c.hairline;

export function StepsSection(props: {
  session: FixSession;
  analysis: ProblemAnalysis;
  currentId: string | null;
  onDone: (s: FixStep) => void;
  onFailed: (s: FixStep) => void;
  onSkip: (s: FixStep) => void;
  onReset: (s: FixStep) => void;
  onAddPhoto: () => void;
  onShowFinding: (id: string) => void;
}) {
  const { c } = useTheme();
  const { analysis, session, currentId } = props;
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => setExpanded(null), [currentId]);
  const meta = [
    analysis.estimatedMinutes ? t("%lld min", analysis.estimatedMinutes) : null,
    analysis.difficulty ? { easy: t("Easy"), moderate: t("Moderate"), hard: t("Hard"), expert: t("For experts") }[analysis.difficulty] : null,
  ].filter(Boolean);

  return (
    <View style={{ gap: space.m }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <SectionTitle title={t("Fix plan")} icon="checkbox-outline" />
        {meta.length > 0 && <Caption>{meta.join(" · ")}</Caption>}
      </View>
      {analysis.tools.length > 0 && <Caption>{`🔧 ${analysis.tools.join(", ")}`}</Caption>}
      {analysis.steps.map((step, index) => {
        const state = session.stepStates[step.id] ?? "pending";
        const open = (expanded ?? currentId) === step.id && state !== "done" && state !== "skipped";
        if (open) return <StepCard key={step.id} {...props} step={step} index={index} total={analysis.steps.length} state={state} />;
        return (
          <Pressable
            key={step.id}
            onPress={() => setExpanded(step.id)}
            onLongPress={() => state !== "pending" && props.onReset(step)}
            style={[styles.compact, { backgroundColor: c.surface }]}
            accessibilityRole="button"
            accessibilityHint={state !== "pending" ? t("Long press to mark as not done") : t("Shows this step")}
          >
            <View style={[styles.stepDot, { backgroundColor: stateColor(c, state, step.id === currentId) }]}>
              {state === "done" ? (
                <Ionicons name="checkmark" size={15} color="#fff" />
              ) : state === "failed" ? (
                <Ionicons name="close" size={15} color="#fff" />
              ) : state === "skipped" ? (
                <Ionicons name="play-skip-forward" size={12} color={c.secondary} />
              ) : (
                <Text style={{ color: step.id === currentId ? "#fff" : c.secondary, fontWeight: "700", fontSize: 13 }}>{index + 1}</Text>
              )}
            </View>
            <Text
              style={[type.body, { flex: 1, color: state === "done" || state === "skipped" ? c.secondary : c.text, textDecorationLine: state === "skipped" ? "line-through" : "none" }]}
              numberOfLines={2}
            >
              {step.title}
            </Text>
            <Ionicons name="chevron-down" size={16} color={c.secondary} />
          </Pressable>
        );
      })}
    </View>
  );
}

function StepCard(props: {
  step: FixStep;
  index: number;
  total: number;
  state: StepState;
  analysis: ProblemAnalysis;
  onDone: (s: FixStep) => void;
  onFailed: (s: FixStep) => void;
  onSkip: (s: FixStep) => void;
  onAddPhoto: () => void;
  onShowFinding: (id: string) => void;
}) {
  const { c } = useTheme();
  const { step } = props;
  const label = (text: string) => <Text style={{ color: c.secondary, fontSize: 13, fontWeight: "600" }}>{text}</Text>;
  return (
    <View style={[styles.stepCard, { backgroundColor: c.surface, borderColor: c.accent + "55" }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", textTransform: "uppercase" }}>{t("Step %lld of %lld", props.index + 1, props.total)}</Text>
        {props.state === "failed" && <Chip text={t("Didn't work")} color={c.danger} icon="close" />}
      </View>
      <Text style={[type.title, { color: c.text }]}>{step.title}</Text>
      {step.explanation ? <Body secondary>{step.explanation}</Body> : null}
      <View style={[styles.soft, { backgroundColor: c.accentSoft, padding: space.m }]}>
        {label(t("Do this"))}
        <Text style={[type.body, { color: c.text, fontWeight: "500" }]}>{step.action}</Text>
      </View>
      {step.findingIds.length > 0 && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.s }}>
          {label(t("Look at"))}
          {step.findingIds.map((id) => {
            const n = findingNumber(props.analysis, id);
            return n ? (
              <Pressable key={id} onPress={() => props.onShowFinding(id)} accessibilityLabel={t("Show marker %lld on the image", n)} hitSlop={6}>
                <MarkerBadge number={n} />
              </Pressable>
            ) : null;
          })}
        </View>
      )}
      {step.safetyNote ? <Text style={{ color: c.caution, fontWeight: "500" }}>{`⚠ ${step.safetyNote}`}</Text> : null}
      {step.pitfalls.length > 0 && (
        <View style={{ gap: 4 }}>
          {label(t("Watch out"))}
          {step.pitfalls.map((p) => (
            <Caption key={p}>{`• ${p}`}</Caption>
          ))}
        </View>
      )}
      {step.expectedResult ? (
        <View style={{ gap: 4 }}>
          {label(t("If it worked"))}
          <Caption>{`✓ ${step.expectedResult}`}</Caption>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: space.s }}>
        <Button title={t("Done")} icon="checkmark" onPress={() => props.onDone(step)} style={{ flex: 1 }} />
        <Button title={t("Didn't work")} icon="close" kind="secondary" onPress={() => props.onFailed(step)} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: space.s }}>
        <Button title={t("Add a photo")} icon="camera-outline" kind="plain" compact onPress={props.onAddPhoto} style={{ flex: 1 }} />
        <Button title={t("Skip this step")} icon="play-skip-forward-outline" kind="plain" compact onPress={() => props.onSkip(step)} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function AnalyzingCard({ job, onCancel }: { job: Job; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const { c } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
        <Ionicons name="sync" size={22} color={c.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[type.headline, { color: c.text }]}>{phaseTitle(job.phase)}</Text>
          <Caption>{`${Math.floor((now - job.startedAt) / 1000)} s`}</Caption>
        </View>
        <Button title={t("Cancel")} kind="secondary" compact onPress={onCancel} />
      </View>
      <Caption>{t("Usually takes 20–60 seconds. You can leave this screen; the session keeps your photos either way.")}</Caption>
    </Card>
  );
}

export function FailureCard({ failure, onRetry, onSettings }: { failure: Failure; onRetry: () => void; onSettings: () => void }) {
  const { c } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: "row", gap: space.s, alignItems: "center" }}>
        <Ionicons name="warning" size={20} color={c.caution} />
        <Text style={[type.headline, { color: c.caution }]}>{t("Analysis didn't work")}</Text>
      </View>
      <Body>{failure.message}</Body>
      <View style={{ flexDirection: "row", gap: space.s }}>
        {failure.retryable && <Button title={t("Try again")} icon="refresh" compact onPress={onRetry} />}
        {["unauthorized", "notConfigured", "unreachable"].includes(failure.code) && <Button title={t("Settings")} icon="settings-outline" kind="secondary" compact onPress={onSettings} />}
      </View>
    </Card>
  );
}

export function GateCard({
  preflight,
  hasPhotos,
  onAnalyze,
  onSettings,
  onPaywall,
}: {
  preflight: Preflight;
  hasPhotos: boolean;
  onAnalyze: () => void;
  onSettings: () => void;
  onPaywall: () => void;
}) {
  const saved = hasPhotos ? t("Your photos are saved on this iPhone.") : t("Your description is saved on this iPhone.");
  const content: Record<Preflight, { icon: IconName; title: string; text: string; action: [string, () => void] }> = {
    ready: { icon: "search", title: t("Ready to analyze"), text: saved, action: [t("Analyze"), onAnalyze] },
    needsConsent: { icon: "search", title: t("Ready to analyze"), text: saved, action: [t("Analyze"), onAnalyze] },
    needsSetup: {
      icon: "server-outline",
      title: t("AI analysis is not set up"),
      text: t("Connect your Fixify server in Settings to get text recognition, a diagnosis and a guided plan."),
      action: [t("Open Settings"), onSettings],
    },
    off: { icon: "phone-portrait-outline", title: t("AI analysis is off"), text: t("Turn on the Fixify server in Settings to get a guided plan."), action: [t("Open Settings"), onSettings] },
    monthlyLimit: {
      icon: "speedometer-outline",
      title: t("Monthly analyses used up"),
      text: `${saved} ${t("Analyze when your quota renews next month.")}`,
      action: [t("See Fixify Pro"), onPaywall],
    },
    sessionLimit: { icon: "speedometer-outline", title: t("Monthly analyses used up"), text: "", action: [t("See Fixify Pro"), onPaywall] },
  };
  const g = content[preflight];
  return (
    <Card>
      <SectionTitle title={g.title} icon={g.icon} />
      {g.text ? <Caption>{g.text}</Caption> : null}
      <Button title={g.action[0]} onPress={g.action[1]} kind={preflight === "ready" || preflight === "needsConsent" ? "primary" : "secondary"} />
    </Card>
  );
}

export function UpdateSuggestion({ enabled, onUpdate }: { enabled: boolean; onUpdate: () => void }) {
  return (
    <Card>
      <SectionTitle title={t("New observation added")} icon="add-circle-outline" />
      <Caption>{t("The current plan doesn't know about it yet.")}</Caption>
      <Button title={t("Update the plan")} icon="git-branch-outline" disabled={!enabled} onPress={onUpdate} />
    </Card>
  );
}

export function RecognizedTextCard({ session }: { session: FixSession }) {
  const { c } = useTheme();
  const text = session.images.map((i) => (i.blocks ?? []).map((b) => b.text).join("\n")).filter(Boolean).join("\n\n");
  if (!text) return null;
  return (
    <Card>
      <SectionTitle title={t("Recognized text")} icon="text-outline" />
      <Text selectable style={{ color: c.text, fontFamily: mono, fontSize: 13 }} numberOfLines={14}>
        {text}
      </Text>
    </Card>
  );
}

export function SummaryCard({ session }: { session: FixSession }) {
  const { c } = useTheme();
  const done = session.events.filter((e) => ["stepDone", "stepFailed", "stepSkipped"].includes(e.kind));
  const verification = [...session.events].reverse().find((e) => e.kind === "verified");
  return (
    <Card>
      <SectionTitle title={t("Summary")} icon="document-text-outline" />
      {verification && <Body>{verification.text}</Body>}
      {done.length === 0 ? (
        <Caption>{t("No steps were recorded.")}</Caption>
      ) : (
        done.map((e) => (
          <Text key={e.id} style={{ color: e.kind === "stepFailed" ? c.danger : c.text, fontSize: 14 }}>
            {`${e.kind === "stepDone" ? "✓" : e.kind === "stepFailed" ? "✗" : "↷"} ${e.text}`}
          </Text>
        ))
      )}
    </Card>
  );
}

const eventIcon: Record<SessionEvent["kind"], IconName> = {
  captured: "camera-outline",
  analyzed: "search",
  analysisFailed: "warning-outline",
  stepDone: "checkmark-circle-outline",
  stepFailed: "close-circle-outline",
  stepSkipped: "play-skip-forward-outline",
  answer: "chatbubble-outline",
  photoAdded: "image-outline",
  note: "document-text-outline",
  replanned: "git-branch-outline",
  verified: "ribbon-outline",
};

export function HistoryCard({ events }: { events: SessionEvent[] }) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Pressable onPress={() => setOpen((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }} accessibilityRole="button">
        <SectionTitle title={t("History")} icon="time-outline" />
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={c.secondary} />
      </Pressable>
      {open &&
        events.map((e) => (
          <View key={e.id} style={{ flexDirection: "row", gap: space.m }}>
            <Ionicons name={eventIcon[e.kind]} size={17} color={e.kind === "analysisFailed" || e.kind === "stepFailed" ? c.danger : c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 14 }}>{e.text}</Text>
              <Caption style={{ fontSize: 12 }}>{new Date(e.date).toLocaleString()}</Caption>
            </View>
          </View>
        ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  soft: { borderRadius: radius.card, padding: space.l, gap: space.s },
  option: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, paddingHorizontal: space.m, paddingVertical: 10, fontSize: 15 },
  compact: { flexDirection: "row", alignItems: "center", gap: space.m, padding: space.m, borderRadius: radius.control },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepCard: { borderRadius: radius.card, padding: space.l, gap: space.m, borderWidth: 1 },
});
