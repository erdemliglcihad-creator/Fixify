import Foundation

enum AnalysisMode: String, Codable, Sendable {
    case initial, replan, followup
}

struct PreparedImage: Sendable {
    var imageID: UUID
    var jpeg: Data
    var label: String?
    var blocks: [TextBlock]
}

struct AnalysisInput: Sendable {
    var mode: AnalysisMode
    var locale: String
    var description: String
    var category: ProblemCategory?
    var images: [PreparedImage]
    var history: [(kind: String, text: String)]
    var answers: [AnsweredQuestion]
    var feedback: String?
    var previous: ProblemAnalysis?
}

struct AnalysisOutput: Sendable {
    var analysis: ProblemAnalysis
    /// Model id or "on-device".
    var provider: String
}

/// A source of structured analyses. Implementations: the Fixify proxy (Claude) and Apple's on-device model.
protocol AnalysisService: Sendable {
    func analyze(_ input: AnalysisInput) async throws -> AnalysisOutput
}

enum AnalysisFailure: LocalizedError, Equatable {
    case notConfigured
    case offline
    case unreachable
    case unauthorized
    case rateLimited(retryAfter: Int?)
    case refused
    case timeout
    case invalidResponse(String)
    case server(String)
    case onDeviceUnavailable(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            String(localized: "No analysis server is set up. Add its address and app token in Settings.")
        case .offline:
            String(localized: "You're offline. Your photos and text recognition are saved; analyze again when you're connected.")
        case .unreachable:
            String(localized: "The Fixify server can't be reached. Check that it is running and that your iPhone is on the same network.")
        case .unauthorized:
            String(localized: "The server rejected the app token. Copy the token from the server window into Settings.")
        case .rateLimited(let seconds):
            if let seconds {
                String(localized: "The server is limiting requests. Try again in \(seconds) seconds.")
            } else {
                String(localized: "The server is limiting requests. Try again later.")
            }
        case .refused:
            String(localized: "The AI declined to analyze this. Try a different photo or description.")
        case .timeout:
            String(localized: "The analysis took too long. Try again.")
        case .invalidResponse(let detail):
            String(localized: "The analysis came back in an unexpected format, so it is not shown. (\(detail))")
        case .server(let message):
            message
        case .onDeviceUnavailable(let reason):
            reason
        }
    }

    var isRetryable: Bool {
        switch self {
        case .offline, .unreachable, .rateLimited, .timeout, .invalidResponse, .server: true
        default: false
        }
    }
}

/// Client-side checks on top of the server's validation: never trust a response just because it decoded.
enum AnalysisValidator {
    static func validate(_ analysis: ProblemAnalysis, imageCount: Int) throws -> ProblemAnalysis {
        var a = analysis
        guard !a.title.trimmingCharacters(in: .whitespaces).isEmpty, !a.summary.isEmpty else {
            throw AnalysisFailure.invalidResponse("empty summary")
        }
        let stepIds = a.steps.map(\.id)
        guard Set(stepIds).count == stepIds.count else { throw AnalysisFailure.invalidResponse("duplicate step ids") }
        a.findings = a.findings.filter { $0.imageIndex >= 0 && $0.imageIndex < max(imageCount, 0) }
        let findingIds = Set(a.findings.map(\.id))
        a.steps = a.steps.map { step in
            var s = step
            s.findingIds = s.findingIds.filter(findingIds.contains)
            return s
        }
        return a
    }
}
