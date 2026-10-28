import Testing
import Foundation
import CoreGraphics
import SwiftData
@testable import Fixify

// Same payload shape the proxy returns (see server/test/proxy.test.mjs).
let sampleJSON = """
{
  "title": "Printer offline",
  "category": "peripheral",
  "summary": "The screen shows a printer offline error.",
  "confidenceNote": "Based on the visible message only.",
  "canHelp": true,
  "cannotHelpReason": null,
  "findings": [
    { "id": "f1", "label": "Error text", "detail": "", "imageIndex": 0, "ocrBlockIds": ["t1", "t2"], "box": null, "boxConfidence": "none", "source": "ocr" },
    { "id": "f2", "label": "Cable", "detail": "", "imageIndex": 0, "ocrBlockIds": [], "box": { "x": 0.5, "y": 0.5, "width": 0.2, "height": 0.1 }, "boxConfidence": "medium", "source": "visual" },
    { "id": "f3", "label": "Light", "detail": "", "imageIndex": 0, "ocrBlockIds": [], "box": { "x": 0.1, "y": 0.1, "width": 0.1, "height": 0.1 }, "boxConfidence": "low", "source": "visual" },
    { "id": "f4", "label": "Elsewhere", "detail": "", "imageIndex": 5, "ocrBlockIds": [], "box": null, "boxConfidence": "none", "source": "visual" }
  ],
  "causes": [{ "id": "c1", "title": "Wi-Fi", "explanation": "", "likelihood": "likely", "evidence": [] }],
  "unknowns": ["Whether the printer is on the same network"],
  "questions": [{ "id": "q1", "question": "Is the Wi-Fi light on?", "options": ["Yes", "No"] }],
  "nextDiagnostic": { "title": "Check Wi-Fi light", "instruction": "Look at the printer panel.", "reason": "Separates network from driver issues." },
  "steps": [
    { "id": "s1", "title": "Restart printer", "explanation": "", "action": "Turn it off and on.", "expectedResult": "Ready light", "pitfalls": [], "findingIds": ["f1", "f4"], "safetyNote": null },
    { "id": "s2", "title": "Print test page", "explanation": "", "action": "Print.", "expectedResult": "", "pitfalls": [], "findingIds": [], "safetyNote": null }
  ],
  "tools": [],
  "difficulty": "easy",
  "estimatedMinutes": 5,
  "safety": { "level": "none", "warnings": [], "recommendProfessional": false },
  "successCriteria": ["A test page prints"]
}
"""

func sampleAnalysis() throws -> ProblemAnalysis {
    try JSONDecoder().decode(ProblemAnalysis.self, from: Data(sampleJSON.utf8))
}

@Suite struct AnalysisTests {
    @Test func decodesServerPayload() throws {
        let a = try sampleAnalysis()
        #expect(a.category == .peripheral)
        #expect(a.findings.count == 4)
        #expect(a.findings[1].box?.width == 0.2)
        #expect(a.difficulty == .easy)
        #expect(a.nextDiagnostic?.title == "Check Wi-Fi light")
    }

    @Test func validatorDropsFindingsForImagesThatWereNotSent() throws {
        let a = try AnalysisValidator.validate(try sampleAnalysis(), imageCount: 1)
        #expect(a.findings.map(\.id) == ["f1", "f2", "f3"])
        #expect(a.steps[0].findingIds == ["f1"])
    }

    @Test func validatorRejectsDuplicateStepIDs() throws {
        var a = try sampleAnalysis()
        a.steps[1].id = "s1"
        #expect(throws: AnalysisFailure.self) { try AnalysisValidator.validate(a, imageCount: 1) }
    }

    @Test func encodesAndDecodesRoundTrip() throws {
        let a = try sampleAnalysis()
        let b = try JSONDecoder().decode(ProblemAnalysis.self, from: JSONEncoder().encode(a))
        #expect(a == b)
    }
}

@Suite struct MarkerTests {
    let blocks = [
        TextBlock(id: "t1", text: "Printer", box: NormalizedRect(x: 0.1, y: 0.2, width: 0.2, height: 0.05), confidence: 1),
        TextBlock(id: "t2", text: "offline", box: NormalizedRect(x: 0.35, y: 0.2, width: 0.2, height: 0.07), confidence: 1),
    ]

    @Test func ocrFindingsUseUnionOfTextBoxes() throws {
        let markers = try sampleAnalysis().markers(forImage: 0, blocks: blocks)
        let text = try #require(markers.first { $0.id == "f1" })
        #expect(text.precision == .textMatch)
        #expect(abs(text.rect.x - 0.1) < 1e-9)
        #expect(abs(text.rect.width - 0.45) < 1e-9)
        #expect(abs(text.rect.height - 0.07) < 1e-9)
        #expect(text.number == 1)
    }

    @Test func onlyConfidentAIBoxesAreDrawn() throws {
        let ids = try sampleAnalysis().markers(forImage: 0, blocks: blocks).map(\.id)
        #expect(ids.contains("f2"))
        #expect(!ids.contains("f3"), "low-confidence boxes are not drawn")
        #expect(!ids.contains("f4"))
    }

    @Test func visionBoxesAreFlippedToTopLeftOrigin() {
        let r = NormalizedRect.fromVision(CGRect(x: 0.1, y: 0.7, width: 0.3, height: 0.2))
        #expect(abs(r.y - 0.1) < 1e-9)
        #expect(abs(r.x - 0.1) < 1e-9)
    }

    @Test func mapsIntoAspectFitContainer() {
        // 1000x2000 image in a 400x400 view: drawn 200x400, centered with 100 pt side bars.
        let r = NormalizedRect(x: 0.5, y: 0.5, width: 0.5, height: 0.25)
            .rect(in: CGRect(x: 0, y: 0, width: 400, height: 400), imageSize: CGSize(width: 1000, height: 2000))
        #expect(r == CGRect(x: 200, y: 200, width: 100, height: 100))
    }

    @Test func mapsIntoAspectFillContainer() {
        // 1000x2000 image filling a 400x400 view: drawn 400x800, cropped top and bottom by 200.
        let r = NormalizedRect(x: 0, y: 0.5, width: 1, height: 0.25)
            .rect(in: CGRect(x: 0, y: 0, width: 400, height: 400), imageSize: CGSize(width: 1000, height: 2000), fill: true)
        #expect(r == CGRect(x: 0, y: 200, width: 400, height: 200))
    }
}

@MainActor
@Suite struct UsageTests {
    func freshDefaults() -> UserDefaults {
        let name = "fixify.tests.\(UUID().uuidString)"
        return UserDefaults(suiteName: name)!
    }

    @Test func countsAndRollsOverMonthly() {
        let defaults = freshDefaults()
        let october = DateComponents(calendar: .init(identifier: .gregorian), year: 2026, month: 10, day: 24).date!
        let november = DateComponents(calendar: .init(identifier: .gregorian), year: 2026, month: 11, day: 1).date!
        let meter = UsageMeter(defaults: defaults, now: october)
        meter.record(now: october)
        meter.record(now: october)
        #expect(meter.remaining(limits: .free, now: october) == UsageLimits.free.analysesPerMonth - 2)

        let reloaded = UsageMeter(defaults: defaults, now: october)
        #expect(reloaded.analysesThisMonth == 2)
        #expect(reloaded.remaining(limits: .free, now: november) == UsageLimits.free.analysesPerMonth)
        #expect(reloaded.lifetimeAnalyses == 2)
    }

    @Test func proHasHigherLimits() {
        #expect(UsageLimits.pro.analysesPerMonth > UsageLimits.free.analysesPerMonth)
        #expect(UsageLimits.pro.storedSessions == nil)
    }
}

@Suite struct ImageStoreTests {
    @Test func identicalImagesAreStoredOnce() throws {
        let dir = FileManager.default.temporaryDirectory.appending(path: "fixify-\(UUID().uuidString)")
        let store = ImageStore(directory: dir)
        let a = try store.save(jpeg: Data("same bytes".utf8))
        let b = try store.save(jpeg: Data("same bytes".utf8))
        let c = try store.save(jpeg: Data("other bytes".utf8))
        #expect(a == b)
        #expect(a != c)
        #expect(try FileManager.default.contentsOfDirectory(atPath: dir.path).count == 2)

        store.removeOrphans(keeping: [a])
        #expect(try FileManager.default.contentsOfDirectory(atPath: dir.path) == [a])
    }
}

@MainActor
@Suite struct SessionTests {
    func makeContext() throws -> ModelContext {
        let schema = Schema([FixSession.self, SessionImage.self, AnalysisRevision.self, SessionEvent.self])
        let container = try ModelContainer(for: schema, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
        return ModelContext(container)
    }

    @Test func progressFollowsStepStates() throws {
        let context = try makeContext()
        let session = FixSession(title: "Test", description: "", category: nil)
        context.insert(session)
        session.revisions.append(AnalysisRevision(number: 1, analysis: try sampleAnalysis(), provider: "test", trigger: .initial, sentImageIDs: []))
        #expect(session.progress == 0)
        #expect(session.currentStep?.id == "s1")

        var states = session.stepStates
        states["s1"] = .done
        session.stepStates = states
        #expect(session.progress == 0.5)
        #expect(session.currentStep?.id == "s2")

        states["s2"] = .skipped
        session.stepStates = states
        #expect(session.progress == 1)
        #expect(session.currentStep == nil)
    }

    @Test func failedStepStaysCurrent() throws {
        let context = try makeContext()
        let session = FixSession(title: "Test", description: "", category: nil)
        context.insert(session)
        session.revisions.append(AnalysisRevision(number: 1, analysis: try sampleAnalysis(), provider: "test", trigger: .initial, sentImageIDs: []))
        session.stepStates = ["s1": .failed]
        #expect(session.currentStep?.id == "s1")
    }

    @Test func latestRevisionWinsAndMapsSentImages() throws {
        let context = try makeContext()
        let session = FixSession(title: "Test", description: "", category: nil)
        context.insert(session)
        var second = try sampleAnalysis()
        second.title = "Second plan"
        let image = UUID()
        session.revisions.append(AnalysisRevision(number: 1, analysis: try sampleAnalysis(), provider: "test", trigger: .initial, sentImageIDs: []))
        session.revisions.append(AnalysisRevision(number: 2, analysis: second, provider: "test", trigger: .replan, sentImageIDs: [UUID(), image]))
        #expect(session.analysis?.title == "Second plan")
        #expect(session.latestRevision?.sentImageIndex(of: image) == 1)
    }

    @Test func searchTextIncludesAnalysisAndDescription() throws {
        let context = try makeContext()
        let session = FixSession(title: "Drucker", description: "druckt nicht", category: nil)
        context.insert(session)
        session.revisions.append(AnalysisRevision(number: 1, analysis: try sampleAnalysis(), provider: "test", trigger: .initial, sentImageIDs: []))
        session.refreshSearchText()
        #expect(session.searchText.contains("printer offline"))
        #expect(session.searchText.contains("druckt nicht"))
        #expect(session.searchText.contains("print test page"))
    }
}

// MARK: FixVoice turn detection (same cases as app/test/voice.test.ts)

private func runDetector(_ samples: [Double], options: TurnDetector.Options = .init()) -> (TurnDetector.Event, TimeInterval) {
    var detector = TurnDetector(options: options, now: 0)
    for (i, db) in samples.enumerated() {
        let now = Double(i) * 0.08
        let event = detector.step(db: db, now: now)
        if event != .none { return (event, now) }
    }
    return (.none, -1)
}

private func repeated(_ db: Double, _ seconds: Double) -> [Double] {
    Array(repeating: db, count: Int((seconds / 0.08).rounded()))
}

@Test func turnEndsAfterSpeechAndSilence() {
    let (event, at) = runDetector(repeated(-50, 0.8) + repeated(-22, 1.5) + repeated(-50, 2))
    #expect(event == .end)
    #expect(at >= 3.3 && at <= 3.6)
}

@Test func clicksAreNotSpeech() {
    let (event, _) = runDetector(repeated(-50, 0.8) + [-15, -50, -50, -50, -15] + repeated(-50, 2))
    #expect(event == .none)
}

@Test func longSpeechHitsTheCapAndSilenceTimesOut() {
    #expect(runDetector(repeated(-50, 16)).0 == .noSpeech)
    #expect(runDetector(repeated(-50, 0.4) + repeated(-20, 31)).0 == .cap)
}

/// FixVoice's own voice through the speaker: words around -24 dB with short gaps around -42 dB.
private func echo(_ seconds: Double) -> [Double] {
    (0..<Int((seconds / 0.08).rounded())).map { i in i % 5 == 4 ? -42 : -24 - Double(i % 3) * 2 }
}

@Test func ownVoiceDoesNotInterrupt() {
    #expect(runDetector(repeated(-55, 0.3) + echo(8), options: .bargeIn).0 == .none)
}

@Test func clearlyLouderVoiceInterrupts() {
    var detector = TurnDetector(options: .bargeIn, now: 0)
    let samples = repeated(-55, 0.3) + echo(2.5) + repeated(-10, 1)
    var heardAt: TimeInterval = -1
    for (i, db) in samples.enumerated() {
        _ = detector.step(db: db, now: Double(i) * 0.08)
        if detector.heard { heardAt = Double(i) * 0.08; break }
    }
    #expect(heardAt > 2.8 && heardAt < 3.5)
}

@Test func wavHeaderDescribesSixteenKilohertzMono() {
    let wav = WAV.encode(pcm: Data(count: 32_000), sampleRate: 16_000)
    #expect(wav.count == 44 + 32_000)
    #expect(String(decoding: wav.prefix(4), as: UTF8.self) == "RIFF")
    #expect(wav[22] == 1) // mono
    #expect(wav[24] == 0x80 && wav[25] == 0x3E) // 16000
}
