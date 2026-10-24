import Foundation
import SwiftData

enum SessionStatus: String, Codable, CaseIterable, Sendable {
    /// Captured, but no analysis has completed yet (also the state after an interrupted analysis).
    case pendingAnalysis
    /// An analysis exists and the user is working through it.
    case active
    case solved
    case partiallySolved
    case unresolved
    case unclear

    var isOpen: Bool { self == .pendingAnalysis || self == .active || self == .unclear || self == .partiallySolved }

    var title: String {
        switch self {
        case .pendingAnalysis: String(localized: "Not analyzed")
        case .active: String(localized: "In progress")
        case .solved: String(localized: "Solved")
        case .partiallySolved: String(localized: "Partly solved")
        case .unresolved: String(localized: "Not solved")
        case .unclear: String(localized: "Result unclear")
        }
    }

    var symbol: String {
        switch self {
        case .pendingAnalysis: "hourglass"
        case .active: "wrench.adjustable"
        case .solved: "checkmark.seal.fill"
        case .partiallySolved: "circle.lefthalf.filled"
        case .unresolved: "xmark.octagon"
        case .unclear: "questionmark.diamond"
        }
    }
}

enum StepState: String, Codable, Sendable { case pending, done, failed, skipped }

enum ImageSource: String, Codable, Sendable { case camera, library, document, videoFrame }

enum EventKind: String, Codable, Sendable {
    case captured, analyzed, analysisFailed, stepDone, stepFailed, stepSkipped, answer, photoAdded, note, replanned, verified

    var symbol: String {
        switch self {
        case .captured: "camera"
        case .analyzed: "sparkle.magnifyingglass"
        case .analysisFailed: "exclamationmark.triangle"
        case .stepDone: "checkmark.circle"
        case .stepFailed: "xmark.circle"
        case .stepSkipped: "forward"
        case .answer: "text.bubble"
        case .photoAdded: "photo.badge.plus"
        case .note: "note.text"
        case .replanned: "arrow.triangle.branch"
        case .verified: "checkmark.seal"
        }
    }
}

struct AnsweredQuestion: Codable, Hashable, Sendable {
    var question: String
    var answer: String
}

@Model
final class FixSession {
    @Attribute(.unique) var id: UUID
    var title: String
    var createdAt: Date
    var updatedAt: Date
    var statusRaw: String
    var categoryRaw: String?
    var problemDescription: String
    var stepStatesData: Data
    var answersData: Data
    var outcomeNote: String?
    /// Lowercased text used by Library search: title, description, summary and OCR text.
    var searchText: String

    @Relationship(deleteRule: .cascade, inverse: \SessionImage.session) var images: [SessionImage] = []
    @Relationship(deleteRule: .cascade, inverse: \AnalysisRevision.session) var revisions: [AnalysisRevision] = []
    @Relationship(deleteRule: .cascade, inverse: \SessionEvent.session) var events: [SessionEvent] = []

    init(title: String, description: String, category: ProblemCategory?) {
        id = UUID()
        self.title = title
        createdAt = .now
        updatedAt = .now
        statusRaw = SessionStatus.pendingAnalysis.rawValue
        categoryRaw = category?.rawValue
        problemDescription = description
        stepStatesData = Data("{}".utf8)
        answersData = Data("[]".utf8)
        searchText = ""
    }

    var status: SessionStatus {
        get { SessionStatus(rawValue: statusRaw) ?? .active }
        set { statusRaw = newValue.rawValue }
    }

    var category: ProblemCategory? {
        get { categoryRaw.flatMap(ProblemCategory.init(rawValue:)) }
        set { categoryRaw = newValue?.rawValue }
    }

    var sortedImages: [SessionImage] { images.sorted { $0.orderIndex < $1.orderIndex } }
    var sortedEvents: [SessionEvent] { events.sorted { $0.date < $1.date } }
    var latestRevision: AnalysisRevision? { revisions.max { $0.number < $1.number } }
    var analysis: ProblemAnalysis? { latestRevision?.analysis }

    var stepStates: [String: StepState] {
        get { (try? JSONDecoder().decode([String: StepState].self, from: stepStatesData)) ?? [:] }
        set { stepStatesData = (try? JSONEncoder().encode(newValue)) ?? Data("{}".utf8) }
    }

    var answers: [AnsweredQuestion] {
        get { (try? JSONDecoder().decode([AnsweredQuestion].self, from: answersData)) ?? [] }
        set { answersData = (try? JSONEncoder().encode(newValue)) ?? Data("[]".utf8) }
    }

    func state(of step: ProblemAnalysis.FixStep) -> StepState { stepStates[step.id] ?? .pending }

    /// Fraction of current plan steps that are done or skipped.
    var progress: Double {
        guard let steps = analysis?.steps, !steps.isEmpty else { return status == .solved ? 1 : 0 }
        let states = stepStates
        let finished = steps.filter { states[$0.id] == .done || states[$0.id] == .skipped }.count
        return Double(finished) / Double(steps.count)
    }

    /// First step of the current plan that still needs attention.
    var currentStep: ProblemAnalysis.FixStep? {
        let states = stepStates
        return analysis?.steps.first { (states[$0.id] ?? .pending) == .pending || states[$0.id] == .failed }
    }

    func log(_ kind: EventKind, _ text: String, stepId: String? = nil) {
        let event = SessionEvent(kind: kind, text: text, stepId: stepId)
        events.append(event)
        updatedAt = .now
    }

    func refreshSearchText() {
        let ocr = images.map(\.ocrText).joined(separator: " ")
        let summary = analysis.map { "\($0.title) \($0.summary) \($0.steps.map(\.title).joined(separator: " "))" } ?? ""
        searchText = "\(title) \(problemDescription) \(summary) \(ocr)".lowercased()
    }
}

@Model
final class SessionImage {
    @Attribute(.unique) var id: UUID
    var createdAt: Date
    /// File in ImageStore, named by content hash so identical images are stored once.
    var fileName: String
    var pixelWidth: Double
    var pixelHeight: Double
    var orderIndex: Int
    var sourceRaw: String
    var ocrData: Data
    var ocrText: String
    var session: FixSession?

    init(fileName: String, pixelSize: CGSize, orderIndex: Int, source: ImageSource, blocks: [TextBlock]) {
        id = UUID()
        createdAt = .now
        self.fileName = fileName
        pixelWidth = pixelSize.width
        pixelHeight = pixelSize.height
        self.orderIndex = orderIndex
        sourceRaw = source.rawValue
        ocrData = (try? JSONEncoder().encode(blocks)) ?? Data("[]".utf8)
        ocrText = blocks.map(\.text).joined(separator: "\n")
    }

    var pixelSize: CGSize { CGSize(width: pixelWidth, height: pixelHeight) }
    var source: ImageSource { ImageSource(rawValue: sourceRaw) ?? .camera }
    var textBlocks: [TextBlock] { (try? JSONDecoder().decode([TextBlock].self, from: ocrData)) ?? [] }
}

@Model
final class AnalysisRevision {
    @Attribute(.unique) var id: UUID
    var number: Int
    var createdAt: Date
    var payload: Data
    /// "claude-…" model id, or "on-device".
    var provider: String
    var triggerRaw: String
    /// Ids of the SessionImages sent with this analysis, in send order (= the analysis' imageIndex).
    var sentImageIDsData: Data = Data("[]".utf8)
    var session: FixSession?

    init(number: Int, analysis: ProblemAnalysis, provider: String, trigger: AnalysisMode, sentImageIDs: [UUID]) {
        id = UUID()
        self.number = number
        createdAt = .now
        payload = (try? JSONEncoder().encode(analysis)) ?? Data()
        self.provider = provider
        triggerRaw = trigger.rawValue
        sentImageIDsData = (try? JSONEncoder().encode(sentImageIDs)) ?? Data("[]".utf8)
    }

    var sentImageIDs: [UUID] { (try? JSONDecoder().decode([UUID].self, from: sentImageIDsData)) ?? [] }

    func sentImageIndex(of imageID: UUID) -> Int? { sentImageIDs.firstIndex(of: imageID) }

    var analysis: ProblemAnalysis? { try? JSONDecoder().decode(ProblemAnalysis.self, from: payload) }
    var isOnDevice: Bool { provider == AnalysisProviderKind.onDevice.rawValue }
}

@Model
final class SessionEvent {
    @Attribute(.unique) var id: UUID
    var date: Date
    var kindRaw: String
    var text: String
    var stepId: String?
    var session: FixSession?

    init(kind: EventKind, text: String, stepId: String?) {
        id = UUID()
        date = .now
        kindRaw = kind.rawValue
        self.text = text
        self.stepId = stepId
    }

    var kind: EventKind { EventKind(rawValue: kindRaw) ?? .note }
}
