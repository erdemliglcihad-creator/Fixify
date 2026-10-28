import AVFoundation

/// Reads answers aloud with an iPhone voice (German or English, female or male).
/// Fish Audio voices on the server can replace this later.
@MainActor
final class Speaker: NSObject, AVSpeechSynthesizerDelegate {
    static let shared = Speaker()

    private let synthesizer = AVSpeechSynthesizer()
    private var finished: CheckedContinuation<Void, Never>?
    /// Called with the character offset of each spoken word (for highlighting and the orb pulse).
    var onWord: ((Int) -> Void)?

    override private init() {
        super.init()
        synthesizer.delegate = self
    }

    var isSpeaking: Bool { synthesizer.isSpeaking }

    /// Speaks and returns when done or stopped.
    func speak(_ text: String) async {
        stop()
        let utterance = AVSpeechUtterance(string: Self.speakable(text))
        utterance.voice = Self.voice(for: AppGroup.voiceGender)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 1.02
        utterance.prefersAssistiveTechnologySettings = false
        await withCheckedContinuation { continuation in
            finished = continuation
            synthesizer.speak(utterance)
        }
    }

    func stop() {
        if synthesizer.isSpeaking { synthesizer.stopSpeaking(at: .immediate) }
        resume()
    }

    private func resume() {
        finished?.resume()
        finished = nil
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.resume() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.resume() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, willSpeakRangeOfSpeechString characterRange: NSRange, utterance: AVSpeechUtterance) {
        let location = characterRange.location
        Task { @MainActor in self.onWord?(location) }
    }

    // MARK: Voices

    private static let female = ["anna", "helena", "petra", "marlene", "vicki", "samantha", "ava", "allison", "susan", "zoe", "nicky", "karen", "serena"]
    private static let male = ["markus", "martin", "yannick", "hans", "viktor", "aaron", "alex", "evan", "nathan", "tom", "fred", "daniel", "arthur", "rishi"]

    /// Best installed voice for the language and gender; premium/enhanced quality first.
    static func voice(for gender: VoiceGender) -> AVSpeechSynthesisVoice? {
        let language = AppGroup.locale == "de" ? "de-DE" : "en-US"
        let names = gender == .female ? female : male
        let candidates = AVSpeechSynthesisVoice.speechVoices().filter { voice in
            voice.language == language && (voice.gender == (gender == .female ? .female : .male) || names.contains { voice.name.lowercased().contains($0) })
        }
        let best = candidates.max { $0.quality.rawValue < $1.quality.rawValue }
        return best ?? AVSpeechSynthesisVoice(language: language)
    }

    /// FixVoice answers may contain light markdown; read them without the symbols.
    static func speakable(_ text: String) -> String {
        var out = text
        for pattern in ["\\*\\*", "__", "`", "^#{1,6}\\s+", "^\\s*[-*•]\\s+"] {
            out = out.replacingOccurrences(of: pattern, with: "", options: [.regularExpression])
        }
        out = out.replacingOccurrences(of: "(?m)^\\s*[-*•]\\s+", with: "", options: .regularExpression)
        out = out.replacingOccurrences(of: "(?m)^#{1,6}\\s+", with: "", options: .regularExpression)
        return out.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

enum AudioSessions {
    /// Screen questions: speak over other apps, lowering their sound (e.g. the TikTok video) meanwhile.
    static func playback() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? session.setActive(true)
    }

    static func release() {
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }
}
