import SwiftUI

/// The plan: the current step expanded, the others compact.
struct StepsSection: View {
    let session: FixSession
    let analysis: ProblemAnalysis
    var onDone: (ProblemAnalysis.FixStep) -> Void
    var onFailed: (ProblemAnalysis.FixStep) -> Void
    var onSkip: (ProblemAnalysis.FixStep) -> Void
    var onReset: (ProblemAnalysis.FixStep) -> Void
    var onAddPhoto: () -> Void
    var onShowFinding: (String) -> Void

    @State private var expanded: String?

    var body: some View {
        let states = session.stepStates
        let current = session.currentStep?.id

        VStack(alignment: .leading, spacing: FXSpacing.m) {
            HStack {
                SectionTitle(String(localized: "Fix plan"), symbol: "checklist")
                Spacer()
                planMeta
            }
            if !analysis.tools.isEmpty {
                Label {
                    Text(analysis.tools.joined(separator: ", "))
                } icon: {
                    Image(systemName: "wrench.and.screwdriver")
                }
                .font(.fxCaption)
                .foregroundStyle(Color.fxSecondaryText)
            }

            ForEach(Array(analysis.steps.enumerated()), id: \.element.id) { index, step in
                let state = states[step.id] ?? .pending
                if step.id == (expanded ?? current) && state != .done && state != .skipped {
                    StepCard(step: step, index: index, total: analysis.steps.count, state: state, analysis: analysis,
                             onDone: { onDone(step); expanded = nil },
                             onFailed: { onFailed(step) },
                             onSkip: { onSkip(step); expanded = nil },
                             onAddPhoto: onAddPhoto,
                             onShowFinding: onShowFinding)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                } else {
                    CompactStepRow(step: step, index: index, state: state, isCurrent: step.id == current)
                        .onTapGesture { withAnimation(.smooth) { expanded = step.id } }
                        .contextMenu {
                            if state != .pending {
                                Button("Mark as not done", systemImage: "arrow.uturn.backward") { onReset(step) }
                            }
                        }
                }
            }
        }
        .animation(.smooth, value: session.stepStatesData)
    }

    @ViewBuilder
    private var planMeta: some View {
        HStack(spacing: FXSpacing.s) {
            if let minutes = analysis.estimatedMinutes {
                Label("\(minutes) min", systemImage: "clock").labelStyle(.titleAndIcon)
            }
            if let difficulty = analysis.difficulty {
                Text(difficultyTitle(difficulty))
            }
        }
        .font(.caption)
        .foregroundStyle(Color.fxSecondaryText)
    }

    private func difficultyTitle(_ d: ProblemAnalysis.Difficulty) -> String {
        switch d {
        case .easy: String(localized: "Easy")
        case .moderate: String(localized: "Moderate")
        case .hard: String(localized: "Hard")
        case .expert: String(localized: "For experts")
        }
    }
}

struct CompactStepRow: View {
    let step: ProblemAnalysis.FixStep
    let index: Int
    let state: StepState
    let isCurrent: Bool

    var body: some View {
        HStack(spacing: FXSpacing.m) {
            ZStack {
                Circle().fill(fill).frame(width: 28, height: 28)
                switch state {
                case .done: Image(systemName: "checkmark").font(.caption.weight(.bold)).foregroundStyle(.white)
                case .failed: Image(systemName: "xmark").font(.caption.weight(.bold)).foregroundStyle(.white)
                case .skipped: Image(systemName: "forward.fill").font(.caption2).foregroundStyle(Color.fxSecondaryText)
                case .pending: Text("\(index + 1)").font(.fxNumber).foregroundStyle(isCurrent ? .white : Color.fxSecondaryText)
                }
            }
            Text(step.title)
                .font(.fxBody)
                .strikethrough(state == .skipped)
                .foregroundStyle(state == .done || state == .skipped ? Color.fxSecondaryText : Color.primary)
            Spacer()
            Image(systemName: "chevron.down").font(.caption).foregroundStyle(Color.fxSecondaryText)
        }
        .padding(.vertical, FXSpacing.s)
        .padding(.horizontal, FXSpacing.m)
        .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.control, style: .continuous))
        .contentShape(.rect)
        .accessibilityElement(children: .combine)
        .accessibilityValue(Text(stateText))
        .accessibilityHint(Text("Shows this step"))
    }

    private var fill: Color {
        switch state {
        case .done: .fxSuccess
        case .failed: .fxDanger
        case .skipped: .fxHairline
        case .pending: isCurrent ? .fxAccent : .fxHairline
        }
    }

    private var stateText: String {
        switch state {
        case .done: String(localized: "Done")
        case .failed: String(localized: "Didn't work")
        case .skipped: String(localized: "Skipped")
        case .pending: String(localized: "Open")
        }
    }
}

struct StepCard: View {
    let step: ProblemAnalysis.FixStep
    let index: Int
    let total: Int
    let state: StepState
    let analysis: ProblemAnalysis
    var onDone: () -> Void
    var onFailed: () -> Void
    var onSkip: () -> Void
    var onAddPhoto: () -> Void
    var onShowFinding: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: FXSpacing.m) {
            HStack {
                Text("Step \(index + 1) of \(total)")
                    .font(.caption.weight(.bold))
                    .textCase(.uppercase)
                    .foregroundStyle(Color.fxAccent)
                Spacer()
                if state == .failed {
                    Chip(text: String(localized: "Didn't work"), color: .fxDanger, symbol: "xmark")
                }
            }
            Text(step.title).font(.fxTitle)
            if !step.explanation.isEmpty {
                Text(step.explanation).font(.fxBody).foregroundStyle(Color.fxSecondaryText)
            }

            VStack(alignment: .leading, spacing: FXSpacing.xs) {
                Text("Do this").font(.caption.weight(.semibold)).foregroundStyle(Color.fxSecondaryText)
                Text(step.action).font(.fxBody.weight(.medium))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(FXSpacing.m)
            .background(Color.fxAccentSoft, in: .rect(cornerRadius: FXRadius.control, style: .continuous))

            if !step.findingIds.isEmpty {
                HStack(spacing: FXSpacing.s) {
                    Text("Look at").font(.caption).foregroundStyle(Color.fxSecondaryText)
                    ForEach(step.findingIds, id: \.self) { id in
                        if let number = analysis.findingNumber(id) {
                            Button { onShowFinding(id) } label: { MarkerBadge(number: number, size: 24) }
                                .buttonStyle(.plain)
                                .accessibilityLabel(Text("Show marker \(number) on the image"))
                        }
                    }
                }
            }

            if let note = step.safetyNote, !note.isEmpty {
                Label(note, systemImage: "exclamationmark.triangle.fill")
                    .font(.fxCaption.weight(.medium))
                    .foregroundStyle(Color.fxCaution)
            }

            if !step.pitfalls.isEmpty {
                VStack(alignment: .leading, spacing: FXSpacing.xs) {
                    Text("Watch out").font(.caption.weight(.semibold)).foregroundStyle(Color.fxSecondaryText)
                    ForEach(step.pitfalls, id: \.self) { Label($0, systemImage: "hand.raised").font(.fxCaption) }
                }
            }

            if !step.expectedResult.isEmpty {
                VStack(alignment: .leading, spacing: FXSpacing.xs) {
                    Text("If it worked").font(.caption.weight(.semibold)).foregroundStyle(Color.fxSecondaryText)
                    Label(step.expectedResult, systemImage: "checkmark.circle").font(.fxCaption)
                }
            }

            HStack(spacing: FXSpacing.s) {
                Button(action: onDone) {
                    Label("Done", systemImage: "checkmark").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)

                Button(action: onFailed) {
                    Label("Didn't work", systemImage: "xmark").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.glass)

                Menu {
                    Button("Add a photo", systemImage: "camera", action: onAddPhoto)
                    Button("Skip this step", systemImage: "forward", action: onSkip)
                } label: {
                    Image(systemName: "ellipsis").font(.headline).frame(width: 30, height: 30)
                }
                .buttonStyle(.glass)
                .accessibilityLabel(Text("More options for this step"))
            }
        }
        .padding(FXSpacing.l)
        .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: FXRadius.card, style: .continuous).strokeBorder(Color.fxAccent.opacity(0.35), lineWidth: 1)
        }
    }
}

/// "Didn't work": capture what happened so the next plan can use it.
struct StepFeedbackSheet: View {
    let step: ProblemAnalysis.FixStep
    let canUpdatePlan: Bool
    var onSubmit: (_ feedback: String, _ wantsPhoto: Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var choice: String?
    @State private var text = ""
    @State private var addPhoto = false

    private var options: [String] {
        [String(localized: "Nothing changed"),
         String(localized: "A different error appeared"),
         String(localized: "I couldn't do this step"),
         String(localized: "I don't see what the step describes")]
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(step.title).font(.fxHeadline)
                }
                Section("What happened?") {
                    ForEach(options, id: \.self) { option in
                        Button {
                            choice = option
                        } label: {
                            HStack {
                                Text(option).foregroundStyle(Color.primary)
                                Spacer()
                                if choice == option { Image(systemName: "checkmark").foregroundStyle(Color.fxAccent) }
                            }
                        }
                    }
                    TextField("Details (optional)", text: $text, axis: .vertical).lineLimit(2...5)
                }
                Section {
                    Toggle("Add a photo of what you see now", isOn: $addPhoto)
                } footer: {
                    Text(canUpdatePlan
                         ? String(localized: "Fixify uses this to adjust the plan instead of repeating the same step.")
                         : String(localized: "AI analysis is not available, so the plan can't be adjusted automatically. Your note is saved in the session history."))
                }
            }
            .navigationTitle("Didn't work")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button(canUpdatePlan ? String(localized: "Update plan") : String(localized: "Save")) {
                        let detail = [choice, text.trimmingCharacters(in: .whitespacesAndNewlines)]
                            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ". ")
                        onSubmit(detail.isEmpty ? String(localized: "No details given") : detail, addPhoto)
                        dismiss()
                    }
                    .disabled(choice == nil && text.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
