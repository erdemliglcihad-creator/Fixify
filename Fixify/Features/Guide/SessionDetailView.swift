import SwiftUI
import SwiftData

/// The Live Fix guide for one session: evidence with markers, diagnosis, plan, verification and history.
struct SessionDetailView: View {
    @Bindable var session: FixSession

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Environment(AnalysisCoordinator.self) private var coordinator
    @Environment(AppSettings.self) private var settings
    @Environment(Router.self) private var router

    @State private var selectedFinding: String?
    @State private var detailFinding: FindingSelection?
    @State private var page = 0
    @State private var feedbackStep: ProblemAnalysis.FixStep?
    @State private var showVerification = false
    @State private var showConsent = false
    @State private var pendingAfterConsent: (() -> Void)?
    @State private var showDeleteConfirm = false
    @State private var reminderMessage: String?

    struct FindingSelection: Identifiable {
        var id: String { finding.id }
        var finding: ProblemAnalysis.Finding
        var number: Int
    }

    private var analysis: ProblemAnalysis? { session.analysis }
    private var job: AnalysisCoordinator.Job? { coordinator.job(for: session) }
    private var aiAvailable: Bool {
        switch coordinator.preflight(for: session, mode: .replan) {
        case .ready, .needsConsent, .limit: true
        default: false
        }
    }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: FXSpacing.l) {
                    if !session.images.isEmpty {
                        EvidenceGallery(session: session, analysis: analysis, selectedFinding: $selectedFinding, page: $page) { marker in
                            detailFinding = FindingSelection(finding: marker.finding, number: marker.number)
                        }
                        .id("evidence")
                    } else if !session.problemDescription.isEmpty {
                        FXCard {
                            SectionTitle(String(localized: "Your description"), symbol: "text.bubble")
                            Text(session.problemDescription).font(.fxBody)
                        }
                    }

                    if let job {
                        AnalyzingCard(job: job) { coordinator.cancel(session) }
                    } else if let failure = coordinator.failure(for: session) {
                        FailureCard(failure: failure,
                                    retry: { run(analysis == nil ? .initial : .replan) },
                                    openSettings: { router.tab = .settings })
                    }

                    if let analysis {
                        content(for: analysis, proxy: proxy)
                    } else if job == nil {
                        AnalysisGateCard(session: session, preflight: coordinator.preflight(for: session, mode: .initial),
                                         analyze: { run(.initial) },
                                         openSettings: { router.tab = .settings },
                                         showPaywall: { router.paywallReason = $0 })
                        RecognizedTextCard(images: session.sortedImages)
                    }

                    if !session.events.isEmpty {
                        DisclosureGroup {
                            HistoryTimeline(events: session.sortedEvents).padding(.top, FXSpacing.s)
                        } label: {
                            SectionTitle(String(localized: "History"), symbol: "clock.arrow.circlepath")
                        }
                        .padding(FXSpacing.l)
                        .background(Color.fxSurface, in: .rect(cornerRadius: FXRadius.card, style: .continuous))
                    }
                }
                .padding(.horizontal, FXSpacing.l)
                .padding(.bottom, FXSpacing.xxl)
            }
            .onChange(of: selectedFinding) { _, id in
                guard let id, let analysis, let finding = analysis.findings.first(where: { $0.id == id }) else { return }
                if let index = session.sortedImages.firstIndex(where: { session.latestRevision?.sentImageIndex(of: $0.id) == finding.imageIndex }) {
                    page = index
                }
                withAnimation(.smooth) { proxy.scrollTo("evidence", anchor: .top) }
            }
        }
        .fxScreen()
        .navigationTitle(analysis?.title ?? session.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .sheet(item: $detailFinding) { selection in
            findingSheet(selection).presentationDetents([.medium, .large])
        }
        .sheet(item: $feedbackStep) { step in
            StepFeedbackSheet(step: step, canUpdatePlan: aiAvailable) { feedback, wantsPhoto in
                stepFailed(step, feedback: feedback, wantsPhoto: wantsPhoto)
            }
            .presentationDetents([.large])
        }
        .sheet(isPresented: $showVerification) {
            if let analysis {
                VerificationSheet(analysis: analysis, canFollowUp: aiAvailable) { outcome, checked, note, followUp in
                    verify(outcome, checked: checked, note: note, followUp: followUp)
                }
            }
        }
        .sheet(isPresented: $showConsent) {
            ConsentSheet { accepted in
                showConsent = false
                settings.externalConsent = accepted
                if accepted { pendingAfterConsent?() }
                pendingAfterConsent = nil
            }
            .presentationDetents([.medium, .large])
        }
        .confirmationDialog("Delete this session?", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("Delete session and photos", role: .destructive) {
                Reminders.cancel(sessionID: session.id)
                SessionStore(context: context).delete(session)
                router.sessionPath = []
            }
        }
        .alert("Reminder", isPresented: .init(get: { reminderMessage != nil }, set: { if !$0 { reminderMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(reminderMessage ?? "")
        }
    }

    // MARK: Content

    @ViewBuilder
    private func content(for analysis: ProblemAnalysis, proxy: ScrollViewProxy) -> some View {
        let located = locatedFindingIDs(analysis)

        AnalysisHeader(session: session, analysis: analysis, revision: session.latestRevision)
        SafetyBanner(safety: analysis.safety)

        if newObservationPending {
            UpdateSuggestionCard(enabled: job == nil) { run(.replan, feedback: "The user added a new photo as an observation.") }
        }

        if !analysis.canHelp {
            FXCard {
                SectionTitle(String(localized: "Fixify can't solve this reliably"), symbol: "hand.raised")
                Text(analysis.cannotHelpReason ?? analysis.confidenceNote).font(.fxBody)
            }
        }

        if !session.status.isOpen {
            SessionSummaryCard(session: session)
        }

        if let diagnostic = analysis.nextDiagnostic, session.status.isOpen {
            NextDiagnosticCard(diagnostic: diagnostic)
        }

        if !analysis.questions.isEmpty && session.status.isOpen {
            QuestionsSection(questions: analysis.questions, canUpdate: aiAvailable) { answers in
                answer(answers)
            }
        }

        if !analysis.steps.isEmpty {
            StepsSection(session: session, analysis: analysis,
                         onDone: { markStep($0, .done) },
                         onFailed: { feedbackStep = $0 },
                         onSkip: { markStep($0, .skipped) },
                         onReset: { markStep($0, .pending) },
                         onAddPhoto: { router.addPhoto(to: session) },
                         onShowFinding: { selectedFinding = $0 })
        }

        if session.status.isOpen && !analysis.steps.isEmpty {
            if session.currentStep == nil {
                Button { showVerification = true } label: {
                    Label("Check the result", systemImage: "checkmark.seal")
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.glassProminent)
            } else {
                Button { showVerification = true } label: {
                    Label("I'm done – check the result", systemImage: "checkmark.seal")
                        .font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                }
                .buttonStyle(.glass)
            }
        } else if !session.status.isOpen {
            Button {
                session.status = .active
                session.log(.note, String(localized: "Session reopened"))
                try? context.save()
            } label: {
                Label("Reopen session", systemImage: "arrow.uturn.backward").frame(maxWidth: .infinity).padding(.vertical, 4)
            }
            .buttonStyle(.glass)
        }

        if !analysis.findings.isEmpty {
            FindingsSection(analysis: analysis, locatedIDs: located) { finding in
                if located.contains(finding.id) {
                    selectedFinding = finding.id
                }
                detailFinding = FindingSelection(finding: finding, number: analysis.findingNumber(finding.id) ?? 0)
            }
        }
        if !analysis.causes.isEmpty { CausesSection(causes: analysis.causes) }
        if !analysis.unknowns.isEmpty { UnknownsSection(unknowns: analysis.unknowns) }
    }

    /// A photo was added after the latest analysis, so the plan does not know about it yet.
    private var newObservationPending: Bool {
        guard let revision = session.latestRevision, session.status.isOpen else { return false }
        return session.images.contains { $0.createdAt > revision.createdAt }
    }

    private func locatedFindingIDs(_ analysis: ProblemAnalysis) -> Set<String> {
        var ids = Set<String>()
        for image in session.sortedImages {
            guard let index = session.latestRevision?.sentImageIndex(of: image.id) else { continue }
            ids.formUnion(analysis.markers(forImage: index, blocks: image.textBlocks).map(\.id))
        }
        return ids
    }

    private func findingSheet(_ selection: FindingSelection) -> some View {
        let finding = selection.finding
        let image = session.sortedImages.first { session.latestRevision?.sentImageIndex(of: $0.id) == finding.imageIndex }
        let blocks = image?.textBlocks ?? []
        let marker = image.flatMap { _ in analysis?.markers(forImage: finding.imageIndex, blocks: blocks).first { $0.id == finding.id } }
        let text = finding.ocrBlockIds.compactMap { id in blocks.first { $0.id == id }?.text }.joined(separator: "\n")
        let steps = analysis?.steps.filter { $0.findingIds.contains(finding.id) } ?? []
        return FindingDetailSheet(finding: finding, number: selection.number, precision: marker?.precision,
                                  relatedSteps: steps, recognizedText: text)
    }

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Menu {
                Button("Add a photo", systemImage: "camera") { router.addPhoto(to: session) }
                if analysis != nil {
                    Button("Analyze again", systemImage: "arrow.clockwise") {
                        run(.replan, feedback: "The user asked for a fresh look at the problem.")
                    }
                    .disabled(job != nil)
                }
                Button("Remind me tomorrow", systemImage: "bell") { remind() }
                ShareLink(item: SessionSummaryCard.shareText(for: session)) {
                    Label("Share summary", systemImage: "square.and.arrow.up")
                }
                if !session.images.isEmpty {
                    Button("Delete photos only", systemImage: "photo.badge.minus") {
                        SessionStore(context: context).deleteImages(of: session)
                    }
                }
                Divider()
                Button("Delete session", systemImage: "trash", role: .destructive) { showDeleteConfirm = true }
            } label: {
                Label("More", systemImage: "ellipsis.circle")
            }
        }
    }

    // MARK: Actions

    /// Runs an analysis after the same checks as the first one: consent, setup, limits.
    private func run(_ mode: AnalysisMode, feedback: String? = nil) {
        switch coordinator.preflight(for: session, mode: mode) {
        case .ready:
            coordinator.start(session, mode: mode, feedback: feedback)
        case .needsConsent:
            pendingAfterConsent = { coordinator.start(session, mode: mode, feedback: feedback) }
            showConsent = true
        case .limit(let reason):
            router.paywallReason = reason
        case .needsSetup, .localOnly, .onDeviceUnavailable:
            router.tab = .settings
        }
    }

    private func markStep(_ step: ProblemAnalysis.FixStep, _ state: StepState) {
        var states = session.stepStates
        states[step.id] = state
        session.stepStates = states
        switch state {
        case .done: session.log(.stepDone, step.title, stepId: step.id)
        case .skipped: session.log(.stepSkipped, step.title, stepId: step.id)
        case .pending: session.log(.note, String(localized: "Step reopened: \(step.title)"), stepId: step.id)
        case .failed: break
        }
        try? context.save()
        if state == .done && session.currentStep == nil {
            showVerification = true
        }
    }

    private func stepFailed(_ step: ProblemAnalysis.FixStep, feedback: String, wantsPhoto: Bool) {
        var states = session.stepStates
        states[step.id] = .failed
        session.stepStates = states
        session.log(.stepFailed, "\(step.title): \(feedback)", stepId: step.id)
        try? context.save()
        if wantsPhoto {
            // The plan update is offered once the photo is in (UpdateSuggestionCard).
            router.addPhoto(to: session)
        } else if aiAvailable {
            run(.replan, feedback: "Step \"\(step.title)\" did not work: \(feedback)")
        }
    }

    private func answer(_ answers: [AnsweredQuestion]) {
        session.answers = session.answers + answers
        for a in answers { session.log(.answer, "\(a.question) → \(a.answer)") }
        try? context.save()
        if aiAvailable { run(.replan) }
    }

    private func verify(_ outcome: VerificationOutcome, checked: [String], note: String, followUp: Bool) {
        var text = outcome.title
        if let analysis, !analysis.successCriteria.isEmpty {
            text += " · " + String(localized: "\(checked.count) of \(analysis.successCriteria.count) checks confirmed")
        }
        if !note.isEmpty { text += " · \(note)" }
        session.status = outcome.status
        session.outcomeNote = note.isEmpty ? nil : note
        session.log(.verified, text)
        try? context.save()
        if outcome == .solved { Reminders.cancel(sessionID: session.id) }
        if followUp {
            let confirmed = checked.isEmpty ? "none" : checked.joined(separator: "; ")
            let feedback = "Verification result: \(outcome.rawValue). Confirmed checks: \(confirmed). Note: \(note.isEmpty ? "none" : note)"
            run(.followup, feedback: feedback)
        }
    }

    private func remind() {
        guard settings.remindersEnabled else {
            reminderMessage = String(localized: "Turn on reminders in Settings → Notifications first.")
            return
        }
        Task {
            let ok = await Reminders.schedule(sessionID: session.id, title: analysis?.title ?? session.title, after: 24 * 60 * 60)
            reminderMessage = ok
                ? String(localized: "Fixify will remind you tomorrow at about this time.")
                : String(localized: "Notifications are turned off for Fixify. You can allow them in the iOS Settings.")
        }
    }
}

// MARK: - State cards

struct AnalyzingCard: View {
    let job: AnalysisCoordinator.Job
    var cancel: () -> Void

    var body: some View {
        FXCard {
            HStack(spacing: FXSpacing.m) {
                ProgressView()
                VStack(alignment: .leading, spacing: 2) {
                    Text(job.phase.title).font(.fxHeadline)
                    TimelineView(.periodic(from: job.startedAt, by: 1)) { context in
                        Text("\(Int(context.date.timeIntervalSince(job.startedAt))) s")
                            .font(.fxCaption.monospacedDigit())
                            .foregroundStyle(Color.fxSecondaryText)
                    }
                }
                Spacer()
                Button("Cancel", role: .cancel, action: cancel)
                    .buttonStyle(.glass)
            }
            Text(job.provider == .onDevice
                 ? String(localized: "Running on this iPhone. Uses recognized text and your description.")
                 : String(localized: "Usually takes 20–60 seconds. You can leave this screen; the session keeps your photos either way."))
                .font(.fxCaption)
                .foregroundStyle(Color.fxSecondaryText)
        }
        .accessibilityElement(children: .contain)
    }
}

struct FailureCard: View {
    let failure: AnalysisFailure
    var retry: () -> Void
    var openSettings: () -> Void

    var body: some View {
        FXCard {
            Label("Analysis didn't work", systemImage: "exclamationmark.triangle.fill")
                .font(.fxHeadline)
                .foregroundStyle(Color.fxCaution)
            Text(failure.localizedDescription).font(.fxBody)
            HStack {
                if failure.isRetryable {
                    Button("Try again", systemImage: "arrow.clockwise", action: retry).buttonStyle(.glassProminent)
                }
                if failure == .unauthorized || failure == .notConfigured || failure == .unreachable {
                    Button("Settings", systemImage: "gearshape", action: openSettings).buttonStyle(.glass)
                }
            }
        }
    }
}

struct UpdateSuggestionCard: View {
    var enabled: Bool
    var update: () -> Void

    var body: some View {
        FXCard {
            Label("New observation added", systemImage: "photo.badge.plus").font(.fxHeadline)
            Text("The current plan doesn't know about it yet.").font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
            Button("Update the plan", systemImage: "arrow.triangle.branch", action: update)
                .buttonStyle(.glassProminent)
                .disabled(!enabled)
        }
    }
}

/// Shown when a session has no analysis yet; explains why and what to do.
struct AnalysisGateCard: View {
    let session: FixSession
    let preflight: AnalysisCoordinator.Preflight
    var analyze: () -> Void
    var openSettings: () -> Void
    var showPaywall: (PaywallReason) -> Void

    var body: some View {
        FXCard {
            switch preflight {
            case .ready, .needsConsent:
                SectionTitle(String(localized: "Ready to analyze"), symbol: "sparkle.magnifyingglass")
                Text("Your photos and the recognized text are saved.").font(.fxCaption).foregroundStyle(Color.fxSecondaryText)
                Button("Analyze", systemImage: "sparkle.magnifyingglass", action: analyze).buttonStyle(.glassProminent)
            case .needsSetup:
                SectionTitle(String(localized: "AI analysis is not set up"), symbol: "server.rack")
                Text("Text recognition below ran on this iPhone. Connect your Fixify server in Settings to get a diagnosis and a guided plan.")
                    .font(.fxCaption)
                Button("Open Settings", systemImage: "gearshape", action: openSettings).buttonStyle(.glass)
            case .localOnly:
                SectionTitle(String(localized: "AI analysis is off"), symbol: "iphone")
                Text("You chose text recognition only. Turn on an analysis method in Settings to get a guided plan.").font(.fxCaption)
                Button("Open Settings", systemImage: "gearshape", action: openSettings).buttonStyle(.glass)
            case .onDeviceUnavailable(let reason):
                SectionTitle(String(localized: "On-device analysis unavailable"), symbol: "iphone.slash")
                Text(reason).font(.fxCaption)
                Button("Open Settings", systemImage: "gearshape", action: openSettings).buttonStyle(.glass)
            case .limit(let reason):
                SectionTitle(String(localized: "Monthly analyses used up"), symbol: "gauge.with.dots.needle.100percent")
                Text("Your photos and recognized text are saved. Analyze when your quota renews next month, or with Fixify Pro.").font(.fxCaption)
                Button("See Fixify Pro", systemImage: "sparkles") { showPaywall(reason) }.buttonStyle(.glass)
            }
        }
    }
}

/// Local OCR result. Clearly labeled as text recognition, not as a diagnosis.
struct RecognizedTextCard: View {
    let images: [SessionImage]

    var body: some View {
        let text = images.map(\.ocrText).filter { !$0.isEmpty }.joined(separator: "\n\n")
        if !text.isEmpty {
            FXCard {
                HStack {
                    SectionTitle(String(localized: "Recognized text"), symbol: "text.viewfinder")
                    Spacer()
                    Chip(text: String(localized: "On device"), color: .fxSecondaryText, symbol: "iphone")
                }
                Text(text)
                    .font(.fxMono)
                    .textSelection(.enabled)
                    .lineLimit(14)
                ShareLink(item: text) { Label("Copy or share text", systemImage: "doc.on.doc") }
                    .font(.fxCaption)
            }
        }
    }
}
