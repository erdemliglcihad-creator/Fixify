import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Finding, FixStep, MarkerPrecision, ProblemAnalysis } from "../../core/types.ts";
import { t } from "../../i18n/index.ts";
import { Body, Button, Caption, Card, MarkerBadge } from "../components.tsx";
import { mono, radius, space, type, useTheme } from "../theme.ts";
import { font } from "../theme.ts";

function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.header, { borderBottomColor: c.hairline }]}>
          <Text style={[type.headline, { color: c.text, flex: 1 }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t("Close")}>
            <Ionicons name="close-circle" size={28} color={c.secondary} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.l, gap: space.l }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={{ padding: space.l, paddingBottom: space.xxl }}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

export function FindingSheet({
  finding,
  number,
  precision,
  recognizedText,
  steps,
  onClose,
}: {
  finding: Finding | null;
  number: number;
  precision: MarkerPrecision | null;
  recognizedText: string;
  steps: FixStep[];
  onClose: () => void;
}) {
  const { c } = useTheme();
  return (
    <Sheet visible={Boolean(finding)} title={t("Finding %lld", number)} onClose={onClose}>
      {finding && (
        <>
          <View style={{ flexDirection: "row", gap: space.m, alignItems: "center" }}>
            <MarkerBadge number={number} size={30} estimated={precision === "estimated"} />
            <Text style={[type.title, { color: c.text, flex: 1 }]}>{finding.label}</Text>
          </View>
          {finding.detail ? <Body>{finding.detail}</Body> : null}
          {recognizedText ? (
            <Card>
              <Caption>{t("Recognized text")}</Caption>
              <Text selectable style={{ color: c.text, fontFamily: mono, fontSize: 14 }}>
                {recognizedText}
              </Text>
            </Card>
          ) : null}
          <Card>
            <Caption>{t("Position")}</Caption>
            <Body>
              {precision === "textMatch"
                ? t("Exact – taken from recognized text.")
                : precision === "estimated"
                  ? t("Approximate – estimated by the AI from the photo. Check it yourself.")
                  : t("Not marked – the location could not be determined reliably.")}
            </Body>
          </Card>
          {steps.length > 0 && (
            <Card>
              <Caption>{t("Used in steps")}</Caption>
              {steps.map((s) => (
                <Body key={s.id}>{s.title}</Body>
              ))}
            </Card>
          )}
        </>
      )}
    </Sheet>
  );
}

/** "Didn't work": capture what happened so the next plan can use it. */
export function StepFeedbackSheet({
  step,
  canUpdatePlan,
  onClose,
  onSubmit,
}: {
  step: FixStep | null;
  canUpdatePlan: boolean;
  onClose: () => void;
  onSubmit: (feedback: string, wantsPhoto: boolean) => void;
}) {
  const { c } = useTheme();
  const [choice, setChoice] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState(false);
  const options = [t("Nothing changed"), t("A different error appeared"), t("I couldn't do this step"), t("I don't see what the step describes")];
  const reset = () => {
    setChoice(null);
    setText("");
    setPhoto(false);
  };
  return (
    <Sheet
      visible={Boolean(step)}
      title={t("Didn't work")}
      onClose={() => {
        reset();
        onClose();
      }}
      footer={
        <Button
          title={canUpdatePlan ? t("Update plan") : t("Save")}
          disabled={!choice && !text.trim()}
          onPress={() => {
            onSubmit([choice, text.trim()].filter(Boolean).join(". ") || t("No details given"), photo);
            reset();
          }}
        />
      }
    >
      <Text style={[type.headline, { color: c.text }]}>{step?.title}</Text>
      <Caption style={{ textTransform: "uppercase", ...font.semibold }}>{t("What happened?")}</Caption>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {options.map((o) => (
          <Pressable key={o} onPress={() => setChoice(o)} style={styles.choice} aria-selected={choice === o}>
            <Text style={[type.body, { color: c.text, flex: 1 }]}>{o}</Text>
            {choice === o && <Ionicons name="checkmark" size={20} color={c.accent} />}
          </Pressable>
        ))}
      </Card>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t("Details (optional)")}
        placeholderTextColor={c.secondary}
        multiline
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.hairline }]}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.m }}>
        <Text style={[type.body, { color: c.text, flex: 1 }]}>{t("Add a photo of what you see now")}</Text>
        <Switch value={photo} onValueChange={setPhoto} />
      </View>
      <Caption>
        {canUpdatePlan
          ? t("Fixify uses this to adjust the plan instead of repeating the same step.")
          : t("AI analysis is not available, so the plan can't be adjusted automatically. Your note is saved in the session history.")}
      </Caption>
    </Sheet>
  );
}

export type Outcome = "solved" | "partiallySolved" | "unresolved" | "unclear";
export const outcomeTitle = (o: Outcome) =>
  ({ solved: t("Problem solved"), partiallySolved: t("Partly solved"), unresolved: t("Problem still there"), unclear: t("Not sure yet") })[o];

/** The user checks the success criteria themselves; Fixify never declares a fix on its own. */
export function VerificationSheet({
  visible,
  analysis,
  canFollowUp,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  analysis: ProblemAnalysis | null;
  canFollowUp: boolean;
  onClose: () => void;
  onSubmit: (o: Outcome, checked: string[], note: string, followUp: boolean) => void;
}) {
  const { c } = useTheme();
  const [checked, setChecked] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState("");
  const criteria = analysis?.successCriteria ?? [];
  const toggle = (k: string) => {
    const next = checked.includes(k) ? checked.filter((x) => x !== k) : [...checked, k];
    setChecked(next);
    // Suggest, never force: all criteria ticked pre-selects "solved".
    if (!outcome && criteria.length && next.length === criteria.length) setOutcome("solved");
  };
  const submit = (followUp: boolean) => {
    if (!outcome) return;
    onSubmit(outcome, criteria.filter((x) => checked.includes(x)), note.trim(), followUp);
    setChecked([]);
    setOutcome(null);
    setNote("");
  };
  return (
    <Sheet visible={visible} title={t("Check the result")} onClose={onClose} footer={<Button title={t("Save")} disabled={!outcome} onPress={() => submit(false)} />}>
      {criteria.length > 0 && (
        <>
          <Caption style={{ textTransform: "uppercase", ...font.semibold }}>{t("Check it yourself")}</Caption>
          <Card style={{ gap: space.m }}>
            {criteria.map((k) => (
              <Pressable key={k} onPress={() => toggle(k)} style={{ flexDirection: "row", gap: space.m }} accessibilityRole="checkbox" aria-checked={checked.includes(k)}>
                <Ionicons name={checked.includes(k) ? "checkbox" : "square-outline"} size={22} color={checked.includes(k) ? c.success : c.secondary} />
                <Text style={[type.body, { color: c.text, flex: 1 }]}>{k}</Text>
              </Pressable>
            ))}
          </Card>
          <Caption>{t("Tick only what you have actually tested.")}</Caption>
        </>
      )}
      <Caption style={{ textTransform: "uppercase", ...font.semibold }}>{t("Result")}</Caption>
      <Card style={{ gap: 0, paddingVertical: space.xs }}>
        {(["solved", "partiallySolved", "unresolved", "unclear"] as const).map((o) => (
          <Pressable key={o} onPress={() => setOutcome(o)} style={styles.choice} accessibilityRole="radio" aria-selected={outcome === o}>
            <Text style={[type.body, { color: c.text, flex: 1 }]}>{outcomeTitle(o)}</Text>
            {outcome === o && <Ionicons name="checkmark" size={20} color={c.accent} />}
          </Pressable>
        ))}
      </Card>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={t("Note (optional)")}
        placeholderTextColor={c.secondary}
        multiline
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.hairline }]}
      />
      {outcome && outcome !== "solved" && (
        <View style={{ gap: space.s }}>
          <Button
            title={outcome === "unclear" ? t("Suggest a test to find out") : t("Find the next thing to try")}
            icon="git-branch-outline"
            kind="secondary"
            disabled={!canFollowUp}
            onPress={() => submit(true)}
          />
          {!canFollowUp && <Caption>{t("Needs AI analysis. Set it up in Settings.")}</Caption>}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: space.l, borderBottomWidth: StyleSheet.hairlineWidth },
  choice: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  input: { minHeight: 80, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.control, padding: space.m, fontSize: 16, textAlignVertical: "top" },
});
