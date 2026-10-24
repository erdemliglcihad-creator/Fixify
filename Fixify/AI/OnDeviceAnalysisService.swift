import Foundation
import FoundationModels

/// Analysis with Apple's on-device model (iOS 26, Apple Intelligence devices).
/// It cannot see images: it reasons over the on-device OCR text and the user's description only,
/// and the UI labels its results accordingly. Markers come only from OCR lines it cites, so they are exact.
struct OnDeviceAnalysisService: AnalysisService {
    static var availability: (available: Bool, reason: String) {
        switch SystemLanguageModel.default.availability {
        case .available:
            return (true, "")
        case .unavailable(.deviceNotEligible):
            return (false, String(localized: "This iPhone does not support Apple Intelligence."))
        case .unavailable(.appleIntelligenceNotEnabled):
            return (false, String(localized: "Turn on Apple Intelligence in the iOS Settings to use on-device analysis."))
        case .unavailable(.modelNotReady):
            return (false, String(localized: "The on-device model is still downloading. Try again later."))
        case .unavailable:
            return (false, String(localized: "On-device analysis is not available right now."))
        @unknown default:
            return (false, String(localized: "On-device analysis is not available right now."))
        }
    }

    func analyze(_ input: AnalysisInput) async throws -> AnalysisOutput {
        let status = Self.availability
        guard status.available else { throw AnalysisFailure.onDeviceUnavailable(status.reason) }

        let language = input.locale == "de" ? "German" : "English"
        let instructions = """
        You help people diagnose practical problems (computers, Wi-Fi, devices, appliances, everyday objects, documents). \
        You cannot see images; you only get text recognized from photos and the user's description. \
        Never claim certainty you do not have, and never claim the problem is fixed. \
        Order steps from the safest and simplest check to more involved ones. \
        For anything involving mains electricity, gas, batteries, vehicles or health, warn clearly and recommend a professional. \
        Write all text in \(language). Keep sentences short.
        """
        let session = LanguageModelSession(instructions: instructions)

        var lines: [String] = []
        var lineMap: [String: (image: Int, block: String)] = [:]
        for (imageIndex, image) in input.images.enumerated() {
            for block in image.blocks.prefix(40) {
                let key = "L\(lineMap.count + 1)"
                lineMap[key] = (imageIndex, block.id)
                lines.append("[\(key)] \(block.text.prefix(160))")
            }
        }
        var prompt = "Problem description: \(input.description.isEmpty ? "(none)" : String(input.description.prefix(800)))\n"
        prompt += lines.isEmpty ? "No text was recognized in the photos.\n" : "Text recognized in the photos:\n\(lines.prefix(80).joined(separator: "\n"))\n"
        if let feedback = input.feedback { prompt += "New feedback from the user: \(feedback.prefix(600))\n" }
        if !input.answers.isEmpty {
            prompt += "Answers: " + input.answers.map { "\($0.question) → \($0.answer)" }.joined(separator: "; ") + "\n"
        }
        let tried = input.history.filter { $0.kind == EventKind.stepDone.rawValue || $0.kind == EventKind.stepFailed.rawValue }
        if !tried.isEmpty {
            prompt += "Already tried:\n" + tried.suffix(12).map { "- \($0.text.prefix(160))" }.joined(separator: "\n") + "\n"
        }

        let result: OnDeviceAnalysis
        do {
            result = try await session.respond(to: prompt, generating: OnDeviceAnalysis.self).content
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw AnalysisFailure.onDeviceUnavailable(String(localized: "The on-device model could not complete this analysis. Try a shorter description or use the Fixify server."))
        }
        return AnalysisOutput(analysis: result.toAnalysis(category: input.category, lineMap: lineMap), provider: AnalysisProviderKind.onDevice.rawValue)
    }
}

@Generable
struct OnDeviceAnalysis {
    @Guide(description: "Short name of the problem, at most 6 words")
    var title: String
    @Guide(description: "Two or three sentences explaining the problem")
    var summary: String
    @Guide(description: "How sure this analysis is and what it is based on")
    var confidenceNote: String
    @Guide(description: "Recognized text lines that matter, cited by their [L…] id")
    var findings: [OnDeviceFinding]
    @Guide(description: "Possible causes, most likely first, at most 4")
    var causes: [OnDeviceCause]
    @Guide(description: "Information that is missing to be sure")
    var unknowns: [String]
    @Guide(description: "Up to 2 short questions for the user")
    var questions: [String]
    @Guide(description: "Steps to try, safest first, at most 6")
    var steps: [OnDeviceStep]
    @Guide(description: "Concrete checks that show the problem is solved")
    var successCriteria: [String]
    @Guide(description: "Safety level", .anyOf(["none", "caution", "danger"]))
    var safetyLevel: String
    var safetyWarnings: [String]
    var recommendProfessional: Bool
}

@Generable
struct OnDeviceFinding {
    var label: String
    var detail: String
    @Guide(description: "Ids like L3 of the recognized lines this refers to")
    var lineIds: [String]
}

@Generable
struct OnDeviceCause {
    var title: String
    var explanation: String
    @Guide(description: "Likelihood", .anyOf(["likely", "possible", "unlikely"]))
    var likelihood: String
}

@Generable
struct OnDeviceStep {
    var title: String
    var explanation: String
    @Guide(description: "The single concrete action to take")
    var action: String
    @Guide(description: "What the user should see if the step worked")
    var expectedResult: String
}

extension OnDeviceAnalysis {
    func toAnalysis(category: ProblemCategory?, lineMap: [String: (image: Int, block: String)]) -> ProblemAnalysis {
        let mappedFindings: [ProblemAnalysis.Finding] = findings.enumerated().compactMap { index, finding in
            let refs = finding.lineIds.compactMap { lineMap[$0.trimmingCharacters(in: CharacterSet(charactersIn: "[] "))] }
            guard let image = refs.first?.image else { return nil }
            return ProblemAnalysis.Finding(id: "f\(index + 1)", label: finding.label, detail: finding.detail, imageIndex: image,
                                           ocrBlockIds: refs.filter { $0.image == image }.map(\.block),
                                           box: nil, boxConfidence: .none, source: .ocr)
        }
        let level = ProblemAnalysis.Safety.Level(rawValue: safetyLevel) ?? .caution
        return ProblemAnalysis(
            title: title,
            category: category ?? .general,
            summary: summary,
            confidenceNote: confidenceNote,
            canHelp: !steps.isEmpty,
            cannotHelpReason: steps.isEmpty ? confidenceNote : nil,
            findings: mappedFindings,
            causes: causes.prefix(4).enumerated().map { i, c in
                ProblemAnalysis.Cause(id: "c\(i + 1)", title: c.title, explanation: c.explanation,
                                      likelihood: .init(rawValue: c.likelihood) ?? .possible, evidence: [])
            },
            unknowns: unknowns,
            questions: questions.prefix(2).enumerated().map { i, q in ProblemAnalysis.Question(id: "q\(i + 1)", question: q, options: []) },
            nextDiagnostic: nil,
            steps: steps.prefix(6).enumerated().map { i, s in
                ProblemAnalysis.FixStep(id: "s\(i + 1)", title: s.title, explanation: s.explanation,
                                        action: s.action, expectedResult: s.expectedResult, pitfalls: [], findingIds: [], safetyNote: nil)
            },
            tools: [],
            difficulty: nil,
            estimatedMinutes: nil,
            safety: .init(level: level, warnings: safetyWarnings, recommendProfessional: recommendProfessional),
            successCriteria: successCriteria
        )
    }
}
