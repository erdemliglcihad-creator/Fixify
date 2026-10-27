import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, Share, Text, View, type ScrollViewInstance } from "react-native";
import { currentAnalysis, currentStep, hasNewObservation, isOpen, latestRevision } from "../../core/session.ts";
import type { AnalysisMode, Finding, FixSession, FixStep, ResolvedMarker, StepState } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { cancel, preflight, start, useFailure, useJob } from "../../services/analysis.ts";
import { startScan } from "../../services/nav.ts";
import { setChatContext } from "../../services/chat.ts";
import { cancelReminder, scheduleReminder } from "../../services/reminders.ts";
import { deletePhotos, deleteSession, logEvent, updateSession, useSession } from "../../services/sessions.ts";
import { settingsStore, updateSettings } from "../../services/settings.ts";
import { Body, Button, Card, Caption, SafetyBanner, SectionTitle } from "../../ui/components.tsx";
import { confirmDestructive, notify } from "../../ui/confirm.ts";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { EvidenceGallery, markersFor } from "../../ui/guide/Evidence.tsx";
import {
  AnalysisHeader,
  AnalyzingCard,
  CausesSection,
  FailureCard,
  FindingsSection,
  GateCard,
  HistoryCard,
  NextDiagnosticCard,
  QuestionsSection,
  RecognizedTextCard,
  StepsSection,
  SummaryCard,
  UnknownsSection,
  UpdateSuggestion,
} from "../../ui/guide/Sections.tsx";
import { FindingSheet, outcomeTitle, StepFeedbackSheet, VerificationSheet, type Outcome } from "../../ui/guide/Sheets.tsx";
import { space, type, useTheme } from "../../ui/theme.ts";
import { useArea } from "../../services/area.ts";

export default function SessionScreen() {
  useArea("session");
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession(id);
  const { c } = useTheme();
  if (!session) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.s, backgroundColor: c.background }}>
        <Text style={[type.title, { color: c.text }]}>{t("Session not found")}</Text>
        <Caption>{t("It may have been deleted.")}</Caption>
      </View>
    );
  }
  return <Guide session={session} />;
}

function Guide({ session }: { session: FixSession }) {
  const { c } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const job = useJob(session.id);
  const failure = useFailure(session.id);
  const analysis = currentAnalysis(session);
  const revision = latestRevision(session);
  const step = currentStep(session);

  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Finding | null>(null);
  const [feedbackStep, setFeedbackStep] = useState<FixStep | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [consentFor, setConsentFor] = useState<(() => void) | null>(null);

  const aiAvailable = ["ready", "needsConsent"].includes(preflight(session, "replan"));
  const located = new Set(session.images.flatMap((img) => markersFor(session, analysis, img).map((m) => m.id)));

  function run(mode: AnalysisMode, feedback: string | null = null) {
    const p = preflight(session, mode);
    if (p === "ready") start(session.id, mode, feedback);
    else if (p === "needsConsent") setConsentFor(() => () => start(session.id, mode, feedback));
    else router.navigate("/settings");
  }

  function showFinding(findingId: string) {
    setSelected(findingId);
    const f = analysis?.findings.find((x) => x.id === findingId);
    const idx = f ? session.images.findIndex((img) => revision?.sentImageIds.indexOf(img.id) === f.imageIndex) : -1;
    if (idx >= 0) setPage(idx);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function markStep(s: FixStep, state: StepState) {
    updateSession(session.id, (cur) => {
      const next = { ...cur, stepStates: { ...cur.stepStates, [s.id]: state } };
      if (state === "done") return logEvent(next, "stepDone", s.title, s.id);
      if (state === "skipped") return logEvent(next, "stepSkipped", s.title, s.id);
      return logEvent(next, "note", t("Step reopened: %@", s.title), s.id);
    });
    // Offer the check when the last open step is done.
    const remaining = analysis?.steps.filter((x) => x.id !== s.id && ["pending", "failed"].includes(session.stepStates[x.id] ?? "pending")) ?? [];
    if (state === "done" && remaining.length === 0) setVerifying(true);
  }

  function stepFailed(s: FixStep, feedback: string, wantsPhoto: boolean) {
    setFeedbackStep(null);
    updateSession(session.id, (cur) => logEvent({ ...cur, stepStates: { ...cur.stepStates, [s.id]: "failed" } }, "stepFailed", `${s.title}: ${feedback}`, s.id));
    // With a photo, the plan update is offered once the photo is in (UpdateSuggestion).
    if (wantsPhoto) startScan({ category: session.category, targetSessionId: session.id });
    else if (aiAvailable) run("replan", `Step "${s.title}" did not work: ${feedback}`);
  }

  function verify(o: Outcome, checked: string[], note: string, followUp: boolean) {
    setVerifying(false);
    const criteria = analysis?.successCriteria.length ?? 0;
    const text = [outcomeTitle(o), criteria ? t("%lld of %lld checks confirmed", checked.length, criteria) : null, note || null].filter(Boolean).join(" · ");
    updateSession(session.id, (cur) => logEvent({ ...cur, status: o, outcomeNote: note || null }, "verified", text));
    if (o === "solved") cancelReminder(session.id);
    if (followUp) run("followup", `Verification result: ${o}. Confirmed checks: ${checked.join("; ") || "none"}. Note: ${note || "none"}`);
  }

  async function remind() {
    if (!settingsStore.get().reminders) return notify(t("Reminder"), t("Turn on reminders in Settings → Notifications first."));
    const ok = await scheduleReminder(session.id, analysis?.title ?? session.title, 24 * 3600);
    notify(t("Reminder"), ok ? t("Fixify will remind you tomorrow at about this time.") : t("Notifications are turned off for Fixify. You can allow them in the iOS Settings."));
  }

  function share() {
    const lines = [`Fixify – ${analysis?.title ?? session.title}`, analysis?.summary ?? "", ""];
    for (const e of session.events) if (["stepDone", "stepFailed", "stepSkipped", "verified"].includes(e.kind)) lines.push(`• ${e.text}`);
    Share.share({ message: lines.join("\n") });
  }

  const detailNumber = detail && analysis ? analysis.findings.findIndex((f) => f.id === detail.id) + 1 : 0;
  const detailImage = detail ? session.images.find((img) => revision?.sentImageIds.indexOf(img.id) === detail.imageIndex) : undefined;
  const detailMarker: ResolvedMarker | undefined = detail && detailImage ? markersFor(session, analysis, detailImage).find((m) => m.id === detail.id) : undefined;
  const detailText = detail ? detail.ocrBlockIds.map((bid) => detailImage?.blocks?.find((b) => b.id === bid)?.text).filter(Boolean).join("\n") : "";

  return (
    <>
      <Stack.Screen options={{ title: analysis?.title ?? session.title }} />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: space.l, gap: space.l, paddingBottom: space.xxl * 2 }}
      >
        {session.images.length > 0 ? (
          <EvidenceGallery
            session={session}
            analysis={analysis}
            selected={selected}
            page={page}
            setPage={setPage}
            onSelect={(m) => {
              setSelected(m.id);
              setDetail(m.finding);
            }}
          />
        ) : session.description ? (
          <Card>
            <SectionTitle title={t("Your description")} icon="chatbubble-ellipses-outline" />
            <Body>{session.description}</Body>
          </Card>
        ) : null}

        {job ? (
          <AnalyzingCard job={job} onCancel={() => cancel(session.id)} />
        ) : failure ? (
          <FailureCard failure={failure} onRetry={() => run(analysis ? "replan" : "initial")} onSettings={() => router.navigate("/settings")} />
        ) : null}

        {!analysis && !job && (
          <>
            {!failure && (
              <GateCard
                hasPhotos={session.images.length > 0}
                preflight={preflight(session, "initial")}
              onAnalyze={() => run("initial")}
              onSettings={() => router.navigate("/settings")}
              />
            )}
            <RecognizedTextCard session={session} />
          </>
        )}

        {analysis && (
          <>
            <AnalysisHeader analysis={analysis} revision={revision} />
            <SafetyBanner safety={analysis.safety} />
            {hasNewObservation(session) && <UpdateSuggestion enabled={!job} onUpdate={() => run("replan", "The user added a new photo as an observation.")} />}
            {!analysis.canHelp && (
              <Card>
                <SectionTitle title={t("Fixify can't solve this reliably")} icon="hand-left-outline" />
                <Body>{analysis.cannotHelpReason ?? analysis.confidenceNote}</Body>
              </Card>
            )}
            {!isOpen(session.status) && <SummaryCard session={session} />}
            {analysis.nextDiagnostic && isOpen(session.status) && <NextDiagnosticCard d={analysis.nextDiagnostic} />}
            {analysis.questions.length > 0 && isOpen(session.status) && (
              <QuestionsSection
                questions={analysis.questions}
                canUpdate={aiAvailable}
                onSubmit={(answers) => {
                  updateSession(session.id, (cur) =>
                    answers.reduce((acc, a) => logEvent(acc, "answer", `${a.question} → ${a.answer}`), { ...cur, answers: [...cur.answers, ...answers] }),
                  );
                  if (aiAvailable) run("replan");
                }}
              />
            )}
            {analysis.steps.length > 0 && (
              <StepsSection
                session={session}
                analysis={analysis}
                currentId={step?.id ?? null}
                onDone={(s) => markStep(s, "done")}
                onFailed={setFeedbackStep}
                onSkip={(s) => markStep(s, "skipped")}
                onReset={(s) => markStep(s, "pending")}
                onAddPhoto={() => startScan({ category: session.category, targetSessionId: session.id })}
                onShowFinding={showFinding}
              />
            )}
            {isOpen(session.status) && analysis.steps.length > 0 && (
              <Button title={step ? t("I'm done – check the result") : t("Check the result")} icon="ribbon-outline" kind={step ? "secondary" : "primary"} onPress={() => setVerifying(true)} />
            )}
            {!isOpen(session.status) && (
              <Button
                title={t("Reopen session")}
                icon="arrow-undo-outline"
                kind="secondary"
                onPress={() => updateSession(session.id, (cur) => logEvent({ ...cur, status: "active" }, "note", t("Session reopened")))}
              />
            )}
            {analysis.findings.length > 0 && <FindingsSection analysis={analysis} located={located} onSelect={(f) => (located.has(f.id) ? showFinding(f.id) : setDetail(f))} />}
            {analysis.causes.length > 0 && <CausesSection causes={analysis.causes} />}
            {analysis.unknowns.length > 0 && <UnknownsSection unknowns={analysis.unknowns} />}
          </>
        )}

        {session.events.length > 0 && <HistoryCard events={session.events} />}

        <Card style={{ gap: space.s }}>
          <SectionTitle title={t("More")} icon="ellipsis-horizontal-circle-outline" />
          <Button
            title={t("Ask FixBot about this")}
            icon="chatbubbles-outline"
            kind="plain"
            compact
            onPress={() => {
              setChatContext(session.id);
              router.navigate("/fixbot");
            }}
          />
          <Button title={t("Add a photo")} icon="camera-outline" kind="plain" compact onPress={() => startScan({ category: session.category, targetSessionId: session.id })} />
          {analysis && <Button title={t("Analyze again")} icon="refresh" kind="plain" compact disabled={Boolean(job)} onPress={() => run("replan", "The user asked for a fresh look at the problem.")} />}
          <Button title={t("Remind me tomorrow")} icon="notifications-outline" kind="plain" compact onPress={remind} />
          <Button title={t("Share summary")} icon="share-outline" kind="plain" compact onPress={share} />
          {session.images.length > 0 && <Button title={t("Delete photos only")} icon="images-outline" kind="plain" compact onPress={() => deletePhotos(session.id)} />}
          <Button
            title={t("Delete session")}
            icon="trash-outline"
            kind="danger"
            compact
            onPress={() =>
              confirmDestructive(t("Delete this session?"), t("The analysis, steps, history and photos of this session are removed from this iPhone."), t("Delete session and photos"), () => {
                cancelReminder(session.id);
                router.back();
                deleteSession(session.id);
              })
            }
          />
        </Card>
      </ScrollView>

      <FindingSheet
        finding={detail}
        number={detailNumber}
        precision={detailMarker?.precision ?? null}
        recognizedText={detailText}
        steps={analysis?.steps.filter((s) => detail && s.findingIds.includes(detail.id)) ?? []}
        onClose={() => setDetail(null)}
      />
      <StepFeedbackSheet step={feedbackStep} canUpdatePlan={aiAvailable} onClose={() => setFeedbackStep(null)} onSubmit={(f, p) => feedbackStep && stepFailed(feedbackStep, f, p)} />
      <VerificationSheet visible={verifying} analysis={analysis} canFollowUp={aiAvailable} onClose={() => setVerifying(false)} onSubmit={verify} />
      <ConsentModal
        visible={consentFor !== null}
        onDecision={(allowed) => {
          updateSettings({ consent: allowed });
          const next = consentFor;
          setConsentFor(null);
          if (allowed) next?.();
        }}
      />
    </>
  );
}
