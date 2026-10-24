import Foundation
import CoreGraphics

/// Structured result of one analysis. Mirrors server/src/schema.mjs field for field.
struct ProblemAnalysis: Codable, Hashable, Sendable {
    var title: String
    var category: ProblemCategory
    var summary: String
    var confidenceNote: String
    var canHelp: Bool
    var cannotHelpReason: String?
    var findings: [Finding]
    var causes: [Cause]
    var unknowns: [String]
    var questions: [Question]
    var nextDiagnostic: Diagnostic?
    var steps: [FixStep]
    var tools: [String]
    var difficulty: Difficulty?
    var estimatedMinutes: Int?
    var safety: Safety
    var successCriteria: [String]

    struct Finding: Codable, Hashable, Identifiable, Sendable {
        var id: String
        var label: String
        var detail: String
        var imageIndex: Int
        var ocrBlockIds: [String]
        var box: NormalizedRect?
        var boxConfidence: BoxConfidence
        var source: Source

        enum BoxConfidence: String, Codable, Sendable { case high, medium, low, none }
        enum Source: String, Codable, Sendable { case ocr, visual, user }
    }

    struct Cause: Codable, Hashable, Identifiable, Sendable {
        var id: String
        var title: String
        var explanation: String
        var likelihood: Likelihood
        var evidence: [String]

        enum Likelihood: String, Codable, Sendable { case likely, possible, unlikely }
    }

    struct Question: Codable, Hashable, Identifiable, Sendable {
        var id: String
        var question: String
        var options: [String]
    }

    struct Diagnostic: Codable, Hashable, Sendable {
        var title: String
        var instruction: String
        var reason: String
    }

    struct FixStep: Codable, Hashable, Identifiable, Sendable {
        var id: String
        var title: String
        var explanation: String
        var action: String
        var expectedResult: String
        var pitfalls: [String]
        var findingIds: [String]
        var safetyNote: String?
    }

    enum Difficulty: String, Codable, Sendable { case easy, moderate, hard, expert }

    struct Safety: Codable, Hashable, Sendable {
        var level: Level
        var warnings: [String]
        var recommendProfessional: Bool

        enum Level: String, Codable, Sendable { case none, caution, danger }
    }
}

/// Rectangle in image space, 0...1, origin top-left (UIKit convention, not Vision's bottom-left).
struct NormalizedRect: Codable, Hashable, Sendable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double

    var cgRect: CGRect { CGRect(x: x, y: y, width: width, height: height) }

    init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x; self.y = y; self.width = width; self.height = height
    }

    init(_ rect: CGRect) {
        self.init(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height)
    }

    /// Converts a Vision bounding box (origin bottom-left) to top-left normalized space.
    static func fromVision(_ box: CGRect) -> NormalizedRect {
        NormalizedRect(x: box.minX, y: 1 - box.maxY, width: box.width, height: box.height)
    }

    func union(_ other: NormalizedRect) -> NormalizedRect {
        NormalizedRect(cgRect.union(other.cgRect))
    }

    /// Maps into a view rect where an image of `imageSize` is drawn aspect-fit (or fill) inside `container`.
    func rect(in container: CGRect, imageSize: CGSize, fill: Bool = false) -> CGRect {
        let drawn = ImageGeometry.drawnRect(imageSize: imageSize, in: container, fill: fill)
        return CGRect(x: drawn.minX + x * drawn.width,
                      y: drawn.minY + y * drawn.height,
                      width: width * drawn.width,
                      height: height * drawn.height)
    }
}

enum ImageGeometry {
    static func drawnRect(imageSize: CGSize, in container: CGRect, fill: Bool) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0 else { return container }
        let sx = container.width / imageSize.width
        let sy = container.height / imageSize.height
        let scale = fill ? max(sx, sy) : min(sx, sy)
        let size = CGSize(width: imageSize.width * scale, height: imageSize.height * scale)
        return CGRect(x: container.midX - size.width / 2, y: container.midY - size.height / 2,
                      width: size.width, height: size.height)
    }
}

/// One line of text found on-device by Apple Vision.
struct TextBlock: Codable, Hashable, Identifiable, Sendable {
    var id: String
    var text: String
    var box: NormalizedRect
    var confidence: Float
}

/// Where a marker on the image comes from. Shown to the user so precision is never overstated.
enum MarkerPrecision: Hashable, Sendable {
    /// Exact: union of on-device OCR boxes.
    case textMatch
    /// Location estimated by the AI from the image.
    case estimated
}

struct ResolvedMarker: Identifiable, Hashable, Sendable {
    var id: String { finding.id }
    var number: Int
    var finding: ProblemAnalysis.Finding
    var rect: NormalizedRect
    var precision: MarkerPrecision
}

extension ProblemAnalysis {
    /// Markers that can be drawn honestly on image `imageIndex`.
    /// OCR-backed findings get exact boxes; AI boxes only when the model is at least moderately sure.
    func markers(forImage imageIndex: Int, blocks: [TextBlock]) -> [ResolvedMarker] {
        let byId = Dictionary(blocks.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var result: [ResolvedMarker] = []
        for (offset, finding) in findings.enumerated() where finding.imageIndex == imageIndex {
            let ocrBoxes = finding.ocrBlockIds.compactMap { byId[$0]?.box }
            if let first = ocrBoxes.first {
                let union = ocrBoxes.dropFirst().reduce(first) { $0.union($1) }
                result.append(ResolvedMarker(number: offset + 1, finding: finding, rect: union, precision: .textMatch))
            } else if let box = finding.box, finding.boxConfidence == .high || finding.boxConfidence == .medium {
                result.append(ResolvedMarker(number: offset + 1, finding: finding, rect: box, precision: .estimated))
            }
        }
        return result
    }

    func findingNumber(_ id: String) -> Int? {
        findings.firstIndex { $0.id == id }.map { $0 + 1 }
    }
}
