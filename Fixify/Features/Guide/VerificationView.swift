import SwiftUI

enum VerificationOutcome: String, CaseIterable, Identifiable {
    case solved, partiallySolved, unresolved, unclear
    var id: String { rawValue }

    var status: SessionStatus {
        switch self {
        case .solved: .solved
        case .partiallySolved: .partiallySolved
        case .unresolved: .unresolved
        case .unclear: .unclear
        }
    }

    var title: String {
        switch self {
        case .solved: String(localized: "Problem solved")
        case .partiallySolved: String(localized: "Partly solved")
        case .unresolved: String(localized: "Problem still there")
        case .unclear: String(localized: "Not sure yet")
        }
    }
}

/// The user checks the success criteria themselves; Fixify never declares a fix on its own.
struct VerificationSheet: View {
    let analysis: ProblemAnalysis
    let canFollowUp: Bool
    var onSubmit: (_ outcome: VerificationOutcome, _ checked: [String], _ note: String, _ requestFollowUp: Bool) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var checked: Set<String> = []
    @State private var outcome: VerificationOutcome?
    @State private var note = ""

    var body: some View {
        NavigationStack {
            Form {
                if !analysis.successCriteria.isEmpty {
                    Section {
                        ForEach(analysis.successCriteria, id: \.self) { criterion in
                            Button {
                                if checked.contains(criterion) { checked.remove(criterion) } else { checked.insert(criterion) }
                            } label: {
                                HStack(alignment: .top) {
                                    Image(systemName: checked.contains(criterion) ? "checkmark.square.fill" : "square")
                                        .foregroundStyle(checked.contains(criterion) ? Color.fxSuccess : Color.fxSecondaryText)
                                    Text(criterion).foregroundStyle(Color.primary)
                                }
                            }
                            .accessibilityAddTraits(checked.contains(criterion) ? .isSelected : [])
                        }
                    } header: {
                        Text("Check it yourself")
                    } footer: {
                        Text("Tick only what you have actually tested.")
                    }
                }

                Section("Result") {
                    Picker("Result", selection: $outcome) {
                        ForEach(VerificationOutcome.allCases) { Text($0.title).tag(VerificationOutcome?.some($0)) }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                    TextField("Note (optional)", text: $note, axis: .vertical).lineLimit(1...4)
                }

                if let outcome, outcome != .solved {
                    Section {
                        Button {
                            submit(outcome, followUp: true)
                        } label: {
                            Label(outcome == .unclear ? String(localized: "Suggest a test to find out") : String(localized: "Find the next thing to try"),
                                  systemImage: "arrow.triangle.branch")
                        }
                        .disabled(!canFollowUp)
                    } footer: {
                        if !canFollowUp {
                            Text("Needs AI analysis. Set it up in Settings.")
                        }
                    }
                }
            }
            .navigationTitle("Check the result")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { if let outcome { submit(outcome, followUp: false) } }
                        .disabled(outcome == nil)
                }
            }
            .onChange(of: checked) { _, newValue in
                // Suggest, never force: all criteria ticked pre-selects "solved".
                if outcome == nil, !analysis.successCriteria.isEmpty, newValue.count == analysis.successCriteria.count {
                    outcome = .solved
                }
            }
        }
    }

    private func submit(_ outcome: VerificationOutcome, followUp: Bool) {
        onSubmit(outcome, analysis.successCriteria.filter(checked.contains), note.trimmingCharacters(in: .whitespacesAndNewlines), followUp)
        dismiss()
    }
}

/// What was actually done, taken from the session log, not from the plan.
struct SessionSummaryCard: View {
    let session: FixSession

    var body: some View {
        let done = session.sortedEvents.filter { [.stepDone, .stepFailed, .stepSkipped].contains($0.kind) }
        let verification = session.sortedEvents.last { $0.kind == .verified }
        FXCard {
            HStack {
                SectionTitle(String(localized: "Summary"), symbol: "doc.text")
                Spacer()
                StatusBadge(status: session.status)
            }
            if let verification {
                Text(verification.text).font(.fxBody)
            }
            if done.isEmpty {
                Text("No steps were recorded.").font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
            } else {
                ForEach(done) { event in
                    Label(event.text, systemImage: event.kind.symbol)
                        .font(.fxCaption)
                        .foregroundStyle(event.kind == .stepFailed ? Color.fxDanger : Color.primary)
                }
            }
        }
    }

    static func shareText(for session: FixSession) -> String {
        var lines = ["Fixify – \(session.analysis?.title ?? session.title)", session.status.title, ""]
        if let summary = session.analysis?.summary { lines.append(summary); lines.append("") }
        for event in session.sortedEvents where [.stepDone, .stepFailed, .stepSkipped, .verified].contains(event.kind) {
            lines.append("• \(event.text)")
        }
        return lines.joined(separator: "\n")
    }
}

/// Chronological log of everything that happened in a session.
struct HistoryTimeline: View {
    let events: [SessionEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: FXSpacing.m) {
            ForEach(events) { event in
                HStack(alignment: .top, spacing: FXSpacing.m) {
                    Image(systemName: event.kind.symbol)
                        .foregroundStyle(event.kind == .analysisFailed || event.kind == .stepFailed ? Color.fxDanger : Color.fxAccent)
                        .frame(width: 22)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.text).font(.fxCaption)
                        Text(event.date, format: .dateTime.day().month().hour().minute())
                            .font(.caption2)
                            .foregroundStyle(Color.fxSecondaryText)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}
