import Foundation
import SwiftData
import Observation
import UIKit

/// Runs analyses for sessions and exposes their real progress.
/// Phases only advance when the corresponding work has actually happened.
@MainActor
@Observable
final class AnalysisCoordinator {
    enum Phase: Equatable {
        case preparing
        case waitingForServer
        case analyzingOnDevice
        case checking

        var title: String {
            switch self {
            case .preparing: String(localized: "Preparing photos and recognized text")
            case .waitingForServer: String(localized: "Your Fixify server is analyzing")
            case .analyzingOnDevice: String(localized: "Analyzing on this iPhone")
            case .checking: String(localized: "Checking the result")
            }
        }
    }

    struct Job {
        var phase: Phase
        var mode: AnalysisMode
        var provider: AnalysisProviderKind
        var startedAt: Date
        var task: Task<Void, Never>?
    }

    enum Preflight: Equatable {
        case ready
        case needsConsent
        case needsSetup
        case onDeviceUnavailable(String)
        case localOnly
        case limit(PaywallReason)
    }

    private(set) var jobs: [UUID: Job] = [:]
    private(set) var failures: [UUID: AnalysisFailure] = [:]

    private var context: ModelContext?
    private var settings: AppSettings?
    private var usage: UsageMeter?
    private var pro: ProStore?

    func configure(context: ModelContext, settings: AppSettings, usage: UsageMeter, pro: ProStore) {
        self.context = context
        self.settings = settings
        self.usage = usage
        self.pro = pro
    }

    func job(for session: FixSession) -> Job? { jobs[session.id] }
    func failure(for session: FixSession) -> AnalysisFailure? { failures[session.id] }
    func clearFailure(for session: FixSession) { failures[session.id] = nil }

    /// What has to happen before an analysis may run. The UI handles each case (consent sheet, setup, paywall).
    func preflight(for session: FixSession, mode: AnalysisMode) -> Preflight {
        guard let settings, let usage, let pro else { return .needsSetup }
        switch settings.provider {
        case .off:
            return .localOnly
        case .onDevice:
            let status = OnDeviceAnalysisService.availability
            return status.available ? .ready : .onDeviceUnavailable(status.reason)
        case .proxy:
            guard settings.isProxyConfigured else { return .needsSetup }
            guard settings.externalConsent else { return .needsConsent }
            let limits = pro.limits
            if usage.remaining(limits: limits) == 0 { return .limit(.monthlyAnalyses) }
            if mode != .initial {
                let updates = session.revisions.filter { $0.triggerRaw != AnalysisMode.initial.rawValue && !$0.isOnDevice }.count
                if updates >= limits.updatesPerSession { return .limit(.sessionUpdates) }
            }
            return .ready
        }
    }

    func start(_ session: FixSession, mode: AnalysisMode, feedback: String? = nil) {
        guard jobs[session.id] == nil, let settings else { return }
        failures[session.id] = nil
        let provider = settings.provider
        var job = Job(phase: .preparing, mode: mode, provider: provider, startedAt: .now)
        let sessionID = session.id
        job.task = Task { [weak self] in
            await self?.run(sessionID: sessionID, mode: mode, provider: provider, feedback: feedback)
        }
        jobs[session.id] = job
    }

    func cancel(_ session: FixSession) {
        jobs[session.id]?.task?.cancel()
    }

    private func setPhase(_ phase: Phase, for id: UUID) {
        jobs[id]?.phase = phase
    }

    private func fetch(_ id: UUID) -> FixSession? {
        guard let context else { return nil }
        return try? context.fetch(FetchDescriptor<FixSession>(predicate: #Predicate { $0.id == id })).first
    }

    private func run(sessionID: UUID, mode: AnalysisMode, provider: AnalysisProviderKind, feedback: String?) async {
        defer { jobs[sessionID] = nil }
        guard let session = fetch(sessionID), let settings else { return }

        do {
            let limits = pro?.limits ?? .free
            let input = try await makeInput(for: session, mode: mode, feedback: feedback, maxImages: provider == .proxy ? limits.imagesPerAnalysis : 4)
            try Task.checkCancellation()

            let service: AnalysisService
            switch provider {
            case .proxy:
                guard let url = settings.normalizedServerURL else { throw AnalysisFailure.notConfigured }
                service = ProxyAnalysisService(baseURL: url, token: settings.appToken)
                setPhase(.waitingForServer, for: sessionID)
            case .onDevice:
                service = OnDeviceAnalysisService()
                setPhase(.analyzingOnDevice, for: sessionID)
            case .off:
                return
            }

            let analysisTask = Task { try await service.analyze(input) }
            let output = try await withTaskCancellationHandler {
                try await analysisTask.value
            } onCancel: {
                analysisTask.cancel()
            }
            setPhase(.checking, for: sessionID)
            apply(output, mode: mode, to: session, provider: provider, sentImageIDs: input.images.map(\.imageID))
        } catch is CancellationError {
            session.log(.note, String(localized: "Analysis cancelled"))
            try? context?.save()
        } catch {
            let failure = (error as? AnalysisFailure) ?? .server(error.localizedDescription)
            failures[sessionID] = failure
            session.log(.analysisFailed, failure.localizedDescription)
            try? context?.save()
        }
    }

    private func makeInput(for session: FixSession, mode: AnalysisMode, feedback: String?, maxImages: Int) async throws -> AnalysisInput {
        // First image (the original problem) plus the newest observations.
        let all = session.sortedImages
        var chosen = Array(all.prefix(1))
        chosen += all.dropFirst().suffix(max(0, maxImages - chosen.count))
        let sources = chosen.map { (id: $0.id, fileName: $0.fileName, blocks: $0.textBlocks, label: $0.orderIndex == 0 ? "original" : "later observation") }

        let prepared: [PreparedImage] = try await Task.detached(priority: .userInitiated) {
            try sources.map { source in
                guard let image = ImageStore.shared.image(for: source.fileName) else { throw SessionStore.StoreError.encodingFailed }
                // Same aspect ratio as the stored image, so normalized OCR boxes stay valid.
                let small = ImageProcessing.normalized(image, maxLongEdge: 1568)
                guard let jpeg = ImageProcessing.jpeg(small, quality: 0.72) else { throw SessionStore.StoreError.encodingFailed }
                return PreparedImage(imageID: source.id, jpeg: jpeg, label: source.label, blocks: source.blocks)
            }
        }.value

        return AnalysisInput(
            mode: mode,
            locale: Locale.current.language.languageCode?.identifier == "de" ? "de" : "en",
            description: session.problemDescription,
            category: session.category,
            images: prepared,
            history: session.sortedEvents.map { (kind: $0.kindRaw, text: $0.text) },
            answers: session.answers,
            feedback: feedback,
            previous: mode == .initial ? nil : session.analysis
        )
    }

    private func apply(_ output: AnalysisOutput, mode: AnalysisMode, to session: FixSession, provider: AnalysisProviderKind, sentImageIDs: [UUID]) {
        let previousSteps = Dictionary((session.analysis?.steps ?? []).map { ($0.id, $0.title) }, uniquingKeysWith: { a, _ in a })
        let number = (session.latestRevision?.number ?? 0) + 1
        let revision = AnalysisRevision(number: number, analysis: output.analysis, provider: output.provider, trigger: mode, sentImageIDs: sentImageIDs)
        session.revisions.append(revision)

        // Keep progress only for steps that are genuinely the same (same id and title).
        let oldStates = session.stepStates
        var newStates: [String: StepState] = [:]
        for step in output.analysis.steps where previousSteps[step.id] == step.title {
            if let state = oldStates[step.id] { newStates[step.id] = state }
        }
        session.stepStates = newStates

        if session.revisions.count == 1 || session.title == String(localized: "New problem") || session.title == String(session.problemDescription.prefix(48)) {
            session.title = output.analysis.title
        }
        if session.category == nil { session.category = output.analysis.category }
        session.status = .active
        let text = mode == .initial
            ? String(localized: "Analysis: \(output.analysis.title)")
            : String(localized: "Plan updated with \(output.analysis.steps.count) steps")
        session.log(mode == .initial ? .analyzed : .replanned, text)
        session.refreshSearchText()
        try? context?.save()
        if provider == .proxy { usage?.record() }
    }
}
