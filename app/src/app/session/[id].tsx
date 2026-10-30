// A scan as a short chat: your photo (with the numbered markers) and description on the right,
// Fixify's answer on the left, typing itself in. No checklists: just what is going on and what to do.
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { ActionSheetIOS, Platform, Pressable, ScrollView, Share, Text, View, type ScrollViewInstance } from "react-native";
import { chatAnswer } from "../../core/answer.ts";
import { currentAnalysis, hasNewObservation, latestRevision } from "../../core/session.ts";
import type { AnalysisMode, FixSession } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { preflight, start, useFailure, useJob } from "../../services/analysis.ts";
import { useArea } from "../../services/area.ts";
import { setChatContext } from "../../services/chat.ts";
import { startScan } from "../../services/nav.ts";
import { cancelReminder } from "../../services/reminders.ts";
import { deleteSession, useSession } from "../../services/sessions.ts";
import { updateSettings } from "../../services/settings.ts";
import { Bubble, TypeText, TypingDots } from "../../ui/chat.tsx";
import { Button, Caption } from "../../ui/components.tsx";
import { confirmDestructive } from "../../ui/confirm.ts";
import { ConsentModal } from "../../ui/ConsentModal.tsx";
import { AnnotatedImage, markersFor } from "../../ui/guide/Evidence.tsx";
import { GateCard, UpdateSuggestion } from "../../ui/guide/Sections.tsx";
import { space, type, useTheme } from "../../ui/theme.ts";

/** Answers that already typed themselves once (per app launch), so reopening a scan shows them at once. */
const typed = new Set<string>();

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
  return <Chat session={session} />;
}

function Chat({ session }: { session: FixSession }) {
  const { c } = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  const job = useJob(session.id);
  const failure = useFailure(session.id);
  const analysis = currentAnalysis(session);
  const revision = latestRevision(session);
  const [consentFor, setConsentFor] = useState<(() => void) | null>(null);

  function run(mode: AnalysisMode, feedback: string | null = null) {
    const p = preflight(session, mode);
    if (p === "ready") start(session.id, mode, feedback);
    else if (p === "needsConsent") setConsentFor(() => () => start(session.id, mode, feedback));
    else router.navigate("/settings");
  }

  // Marker numbers as drawn on the photos, so the answer can point at them.
  const markers = new Map(session.images.flatMap((img) => markersFor(session, analysis, img).map((m) => [m.id, m.number] as const)));
  const answer = analysis
    ? [chatAnswer(analysis, (fid) => markers.get(fid) ?? null), analysis.safety.recommendProfessional ? t("We recommend getting a qualified professional for this. Do not continue if you are unsure.") : ""]
        .filter(Boolean)
        .join("\n\n")
    : "";
  const fresh = Boolean(revision && !typed.has(revision.id) && Date.now() - revision.createdAt < 60_000);

  const actions: [string, () => void][] = [
    [
      t("Ask FixVoice about this"),
      () => {
        setChatContext(session.id);
        router.navigate("/fixvoice");
      },
    ],
    [t("Add a photo"), () => startScan({ category: session.category, targetSessionId: session.id })],
    ...(analysis && !job ? ([[t("Analyze again"), () => run("replan", "The user asked for a fresh look at the problem.")]] as [string, () => void][]) : []),
    [t("Share summary"), () => Share.share({ message: `Fixify – ${analysis?.title ?? session.title}\n\n${answer}` })],
    [
      t("Delete session"),
      () =>
        confirmDestructive(t("Delete this session?"), t("The analysis, steps, history and photos of this session are removed from this iPhone."), t("Delete session and photos"), () => {
          cancelReminder(session.id);
          router.back();
          deleteSession(session.id);
        }),
    ],
  ];

  // The native iOS action sheet from the header; the web preview lists the actions under the chat.
  function openMenu() {
    Haptics.selectionAsync();
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...actions.map((a) => a[0]), t("Cancel")], cancelButtonIndex: actions.length, destructiveButtonIndex: actions.length - 1 },
      (i) => actions[i]?.[1](),
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: analysis?.title ?? session.title,
          headerRight:
            Platform.OS === "ios"
              ? () => (
                  <Pressable onPress={openMenu} hitSlop={10} accessibilityLabel={t("More")}>
                    <Ionicons name="ellipsis-horizontal-circle" size={26} color={c.text} />
                  </Pressable>
                )
              : undefined,
        }}
      />
      <ScrollView
        ref={scroll}
        contentInsetAdjustmentBehavior="automatic"
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: space.l, gap: space.m, paddingBottom: space.xxl * 2 }}
      >
        {/* You: the photos with their markers, and what you wrote. */}
        {session.images.map((img) => (
          <Bubble key={img.id} from="you" style={{ padding: 4, width: "80%" }}>
            <View style={{ borderRadius: 20, overflow: "hidden" }}>
              <AnnotatedImage image={img} markers={markersFor(session, analysis, img)} selected={null} onSelect={() => {}} height={260} />
            </View>
          </Bubble>
        ))}
        {session.description ? (
          <Bubble from="you">
            <Text style={[type.body, { color: c.onAccent }]}>{session.description}</Text>
          </Bubble>
        ) : null}

        {/* Fixify: thinking, the answer, or what went wrong. */}
        {job ? (
          <Bubble from="fixify">
            <TypingDots />
          </Bubble>
        ) : analysis ? (
          <Bubble from="fixify">
            <TypeText key={revision?.id} text={answer} animate={fresh} onDone={() => revision && typed.add(revision.id)} />
          </Bubble>
        ) : failure ? (
          <Bubble from="fixify" style={{ gap: space.m }}>
            <Text style={[type.body, { color: c.text }]}>{failure.message}</Text>
            {failure.retryable && <Button title={t("Try again")} icon="refresh" compact onPress={() => run("initial")} />}
          </Bubble>
        ) : (
          <GateCard hasPhotos={session.images.length > 0} preflight={preflight(session, "initial")} onAnalyze={() => run("initial")} onSettings={() => router.navigate("/settings")} />
        )}

        {analysis && hasNewObservation(session) && <UpdateSuggestion enabled={!job} onUpdate={() => run("replan", "The user added a new photo as an observation.")} />}

        {Platform.OS !== "ios" && (
          <View style={{ gap: space.xs, marginTop: space.xl }}>
            {actions.map(([title, act], i) => (
              <Button key={title} title={title} kind={i === actions.length - 1 ? "danger" : "plain"} compact onPress={act} />
            ))}
          </View>
        )}
      </ScrollView>

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
