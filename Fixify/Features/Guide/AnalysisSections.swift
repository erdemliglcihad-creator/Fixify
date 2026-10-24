import SwiftUI

struct AnalysisHeader: View {
    let session: FixSession
    let analysis: ProblemAnalysis
    let revision: AnalysisRevision?

    var body: some View {
        VStack(alignment: .leading, spacing: FXSpacing.s) {
            HStack(spacing: FXSpacing.s) {
                Chip(text: analysis.category.title, symbol: analysis.category.symbol)
                if let revision {
                    if revision.isOnDevice {
                        Chip(text: String(localized: "On-device · text only"), color: .fxSecondaryText, symbol: "iphone")
                    } else {
                        Chip(text: "Claude", color: .fxSecondaryText, symbol: "server.rack")
                    }
                    if revision.number > 1 {
                        Chip(text: String(localized: "Plan v\(revision.number)"), color: .fxSecondaryText, symbol: "arrow.triangle.branch")
                    }
                }
            }
            Text(analysis.title).font(.fxTitle)
            Text(analysis.summary).font(.fxBody)
            if !analysis.confidenceNote.isEmpty {
                Label {
                    Text(analysis.confidenceNote)
                } icon: {
                    Image(systemName: "gauge.with.dots.needle.33percent")
                }
                .font(.fxCaption)
                .foregroundStyle(Color.fxSecondaryText)
            }
        }
    }
}

struct FindingsSection: View {
    let analysis: ProblemAnalysis
    let locatedIDs: Set<String>
    var onSelect: (ProblemAnalysis.Finding) -> Void

    var body: some View {
        FXCard {
            SectionTitle(String(localized: "What Fixify sees"), symbol: "eye")
            ForEach(Array(analysis.findings.enumerated()), id: \.element.id) { index, finding in
                Button { onSelect(finding) } label: {
                    HStack(alignment: .top, spacing: FXSpacing.m) {
                        MarkerBadge(number: index + 1, size: 22)
                            .opacity(locatedIDs.contains(finding.id) ? 1 : 0.45)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(finding.label).font(.fxBody.weight(.medium))
                            if !finding.detail.isEmpty {
                                Text(finding.detail).font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
                            }
                            Text(sourceText(finding, located: locatedIDs.contains(finding.id)))
                                .font(.caption2)
                                .foregroundStyle(Color.fxSecondaryText)
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(.rect)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func sourceText(_ finding: ProblemAnalysis.Finding, located: Bool) -> String {
        let source = switch finding.source {
        case .ocr: String(localized: "From recognized text")
        case .visual: String(localized: "Seen in the image")
        case .user: String(localized: "From your description")
        }
        return located ? source : source + " · " + String(localized: "not marked on the image")
    }
}

struct CausesSection: View {
    let causes: [ProblemAnalysis.Cause]

    var body: some View {
        FXCard {
            SectionTitle(String(localized: "Possible causes"), symbol: "list.bullet.below.rectangle")
            ForEach(causes) { cause in
                VStack(alignment: .leading, spacing: FXSpacing.xs) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(cause.title).font(.fxBody.weight(.semibold))
                        Spacer()
                        likelihoodChip(cause.likelihood)
                    }
                    if !cause.explanation.isEmpty {
                        Text(cause.explanation).font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
                    }
                    ForEach(cause.evidence, id: \.self) { evidence in
                        Label(evidence, systemImage: "arrow.turn.down.right")
                            .font(.caption)
                            .foregroundStyle(Color.fxSecondaryText)
                    }
                }
                if cause.id != causes.last?.id { Divider() }
            }
        }
    }

    private func likelihoodChip(_ likelihood: ProblemAnalysis.Cause.Likelihood) -> some View {
        switch likelihood {
        case .likely: Chip(text: String(localized: "Likely"), color: .fxAccent)
        case .possible: Chip(text: String(localized: "Possible"), color: .fxCaution)
        case .unlikely: Chip(text: String(localized: "Unlikely"), color: .fxSecondaryText)
        }
    }
}

struct UnknownsSection: View {
    let unknowns: [String]

    var body: some View {
        FXCard {
            SectionTitle(String(localized: "Not known yet"), symbol: "questionmark.circle")
            ForEach(unknowns, id: \.self) { item in
                Label(item, systemImage: "circle.dashed").font(.fxCaption)
            }
        }
    }
}

/// Targeted follow-up questions. Answers feed the next analysis.
struct QuestionsSection: View {
    let questions: [ProblemAnalysis.Question]
    let canUpdate: Bool
    var onSubmit: ([AnsweredQuestion]) -> Void

    @State private var answers: [String: String] = [:]

    var body: some View {
        FXCard {
            SectionTitle(String(localized: "Fixify needs to know"), symbol: "text.bubble")
            ForEach(questions) { question in
                VStack(alignment: .leading, spacing: FXSpacing.s) {
                    Text(question.question).font(.fxBody.weight(.medium))
                    if !question.options.isEmpty {
                        FlowLayout(spacing: FXSpacing.s) {
                            ForEach(question.options, id: \.self) { option in
                                let selected = answers[question.id] == option
                                Button {
                                    answers[question.id] = selected ? nil : option
                                } label: {
                                    Text(option)
                                        .font(.subheadline)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 7)
                                        .foregroundStyle(selected ? .white : Color.primary)
                                        .background(selected ? Color.fxAccent : Color.fxSurfaceRaised, in: .capsule)
                                        .overlay { Capsule().strokeBorder(Color.fxHairline) }
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(selected ? .isSelected : [])
                            }
                        }
                    }
                    TextField("Or type an answer", text: Binding(
                        get: { question.options.contains(answers[question.id] ?? "") ? "" : (answers[question.id] ?? "") },
                        set: { answers[question.id] = $0.isEmpty ? nil : $0 }
                    ))
                    .textFieldStyle(.roundedBorder)
                }
            }
            Button {
                let result = questions.compactMap { q in answers[q.id].map { AnsweredQuestion(question: q.question, answer: $0) } }
                onSubmit(result)
                answers = [:]
            } label: {
                Text(canUpdate ? String(localized: "Send answers and update the plan") : String(localized: "Save answers"))
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
            }
            .buttonStyle(.glassProminent)
            .disabled(answers.isEmpty)
        }
    }
}

struct NextDiagnosticCard: View {
    let diagnostic: ProblemAnalysis.Diagnostic

    var body: some View {
        VStack(alignment: .leading, spacing: FXSpacing.s) {
            Label("Check this first", systemImage: "scope")
                .font(.caption.weight(.bold))
                .textCase(.uppercase)
                .foregroundStyle(Color.fxAccent)
            Text(diagnostic.title).font(.fxHeadline)
            Text(diagnostic.instruction).font(.fxBody)
            if !diagnostic.reason.isEmpty {
                Text(diagnostic.reason).font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(FXSpacing.l)
        .background(Color.fxAccentSoft, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
    }
}

/// Explanation for a tapped marker or finding.
struct FindingDetailSheet: View {
    let finding: ProblemAnalysis.Finding
    let number: Int
    let precision: MarkerPrecision?
    let relatedSteps: [ProblemAnalysis.FixStep]
    let recognizedText: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: FXSpacing.m) {
                        MarkerBadge(number: number, size: 30, estimated: precision == .estimated)
                        Text(finding.label).font(.fxHeadline)
                    }
                    if !finding.detail.isEmpty { Text(finding.detail) }
                }
                if let recognizedText, !recognizedText.isEmpty {
                    Section("Recognized text") {
                        Text(recognizedText).font(.fxMono).textSelection(.enabled)
                    }
                }
                Section("Position") {
                    switch precision {
                    case .textMatch?:
                        Label("Exact – taken from text recognized on this iPhone.", systemImage: "checkmark.square")
                    case .estimated?:
                        Label("Approximate – estimated by the AI from the photo. Check it yourself.", systemImage: "square.dashed")
                    case nil:
                        Label("Not marked – the location could not be determined reliably.", systemImage: "square.slash")
                    }
                }
                .font(.fxCaption)
                if !relatedSteps.isEmpty {
                    Section("Used in steps") {
                        ForEach(relatedSteps) { Text($0.title) }
                    }
                }
            }
            .navigationTitle("Finding \(number)")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// Wrapping horizontal layout for chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowHeight: CGFloat = 0, maxX: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            maxX = max(maxX, x - spacing)
            rowHeight = max(rowHeight, size.height)
        }
        return CGSize(width: min(maxX, width), height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowHeight: CGFloat = 0
        for view in subviews {
            let size = view.sizeThatFits(.unspecified)
            if x > bounds.minX && x + size.width > bounds.maxX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            view.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
