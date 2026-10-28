import AppIntents
import SwiftUI

/// "Ask Fixify": a question about what is on the screen, answered in a card on top of the current app
/// and read aloud, without opening Fixify.
///
/// Where the picture comes from:
/// - a screenshot passed in by a Shortcut ("Take Screenshot" → "Ask Fixify"), e.g. on Back Tap, or
/// - the running Fixify screen recording (started via Control Center → Screen Recording → Fixify),
///   which is stopped right after the answer.
struct AskFixifyIntent: AppIntent {
    static let title: LocalizedStringResource = "Ask Fixify"
    static let description = IntentDescription("Ask about what is on your screen. Fixify answers in a small card and reads the answer aloud.")
    static let openAppWhenRun = false

    @Parameter(title: "Screenshot", supportedContentTypes: [.image])
    var screenshot: IntentFile?

    @Parameter(title: "Question", requestValueDialog: IntentDialog("What do you want to know?"))
    var question: String

    init() {}

    static var parameterSummary: some ParameterSummary {
        Summary("Ask Fixify \(\.$question) about \(\.$screenshot)")
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        guard AppGroup.cloudConsent else {
            let text = String(localized: "Open Fixify once and allow FixVoice. Then screenshots and questions can be sent to Fixify Cloud.")
            return .result(dialog: IntentDialog("\(text)"), view: AskSnippetView(question: question, answer: text, thumbnail: nil))
        }

        let fromRecording = screenshot == nil
        let picture = screenshot?.data ?? ScreenFrames.latest()
        defer {
            if fromRecording {
                // One question per recording: end it right after the answer and drop the frame.
                ScreenFrames.stopBroadcast()
                ScreenFrames.clear()
            }
        }

        let answer: String
        if let picture, let image = FixifyCloud.encodeImage(picture) {
            do {
                answer = try await FixifyCloud().reply(turns: [.init(role: "user", text: question, image: image)], mode: .screen)
            } catch {
                answer = error.localizedDescription
            }
        } else {
            answer = String(localized: "I can't see your screen. Start the Fixify screen recording in Control Center, or use the Fixify shortcut with a screenshot.")
        }

        // Show the card right away and read the answer meanwhile (the app may play audio in the background).
        Task { @MainActor in
            AudioSessions.playback()
            await Speaker.shared.speak(answer)
            AudioSessions.release()
        }

        return .result(dialog: IntentDialog("\(answer)"), view: AskSnippetView(question: question, answer: answer, thumbnail: picture.flatMap(Self.thumbnail)))
    }

    /// Small preview for the card (snippets are archived, so keep it tiny).
    private static func thumbnail(_ data: Data) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let size = CGSize(width: 88, height: 88 * image.size.height / max(image.size.width, 1))
        let resized = UIGraphicsImageRenderer(size: size).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        return resized.jpegData(compressionQuality: 0.6)
    }
}
