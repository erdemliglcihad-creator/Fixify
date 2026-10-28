import AVFoundation
import Observation
import UIKit

/// FixVoice call: hands-free like a phone call. listen → pause → transcribe → answer → speak → listen again.
/// The microphone runs through Apple's voice processing (echo cancellation), so talking over the answer
/// interrupts it, and what you say becomes the next turn.
@MainActor
@Observable
final class CallEngine {
    enum Phase: Equatable { case idle, connecting, listening, transcribing, thinking, speaking }

    private(set) var phase: Phase = .idle
    private(set) var heard = ""
    private(set) var reply = ""
    /// Character offset of the word being spoken (lights up the reply).
    private(set) var spokenTo = 0
    private(set) var error: String?
    /// 0…1, the voice level for the orb (microphone while listening, word pulses while speaking).
    private(set) var level: Double = 0

    var inCall: Bool { phase != .idle }

    private let engine = AVAudioEngine()
    private let capture = Capture()
    private var detector = TurnDetector(now: 0)
    private var turnMode: TurnDetector.Options = .init()
    private var history: [FixifyCloud.Turn] = []
    private var silentTurns = 0
    private var work: Task<Void, Never>?

    // MARK: Call

    func start() async {
        guard phase == .idle else { return }
        error = nil
        heard = ""
        reply = ""
        silentTurns = 0
        phase = .connecting
        guard await AVAudioApplication.requestRecordPermission() else {
            error = String(localized: "Fixify needs the microphone to hear you. You can allow it in the iPhone settings.")
            phase = .idle
            return
        }
        do {
            try startAudio()
        } catch {
            self.error = String(localized: "The microphone could not be started.")
            phase = .idle
            return
        }
        UIApplication.shared.isIdleTimerDisabled = true
        haptic()
        listen()
    }

    func end() {
        guard phase != .idle else { return }
        work?.cancel()
        Speaker.shared.stop()
        stopAudio()
        UIApplication.shared.isIdleTimerDisabled = false
        level = 0
        phase = .idle
        haptic()
    }

    /// Tap during the call: send now while listening, interrupt while speaking.
    func tap() {
        switch phase {
        case .listening where detector.heard: finishTurn()
        case .speaking: interrupt()
        default: break
        }
    }

    private func listen(options: TurnDetector.Options = .init()) {
        turnMode = options
        detector = TurnDetector(options: options, now: CACurrentMediaTime())
        capture.reset()
        capture.isRecording = true
        if options.margin == TurnDetector.Options().margin { phase = .listening }
    }

    private func interrupt() {
        Speaker.shared.stop()
        // The running barge-in recording simply continues as the user's turn.
        turnMode = .init()
        phase = .listening
        haptic()
    }

    private func finishTurn() {
        capture.isRecording = false
        let pcm = capture.take()
        work = Task { await handle(pcm: pcm) }
    }

    private func handle(pcm: Data) async {
        let cloud = FixifyCloud()
        do {
            phase = .transcribing
            let text = try await cloud.transcribe(wav: WAV.encode(pcm: pcm, sampleRate: Capture.sampleRate))
            guard !Task.isCancelled, phase != .idle else { return }
            guard !text.isEmpty else { return listen() }
            heard = text
            reply = ""
            spokenTo = 0
            phase = .thinking
            history.append(.init(role: "user", text: text))
            let answer = try await cloud.reply(turns: history, mode: .voice)
            guard !Task.isCancelled, phase != .idle else { return }
            history.append(.init(role: "assistant", text: answer))
            error = nil
            reply = answer
            phase = .speaking
            haptic()
            // Keep listening for interruptions while speaking.
            listen(options: .bargeIn)
            Speaker.shared.onWord = { [weak self] offset in
                self?.spokenTo = offset
                self?.level = 0.75
            }
            await Speaker.shared.speak(answer)
            guard phase == .speaking else { return } // Interrupted: the recording is already the next turn.
            listen()
        } catch is CancellationError {
            return
        } catch {
            guard phase != .idle else { return }
            self.error = error.localizedDescription
            listen()
        }
    }

    // MARK: Audio

    private func startAudio() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.defaultToSpeaker, .allowBluetooth])
        try session.setActive(true)

        let input = engine.inputNode
        try? input.setVoiceProcessingEnabled(true)
        let format = input.outputFormat(forBus: 0)
        capture.prepare(input: format)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [capture] buffer, _ in
            let db = capture.ingest(buffer)
            Task { @MainActor [weak self] in self?.onLevel(db) }
        }
        engine.prepare()
        try engine.start()
    }

    private func stopAudio() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        capture.isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func onLevel(_ db: Double) {
        guard phase == .listening || phase == .speaking, capture.isRecording else {
            level = max(level * 0.9, 0)
            return
        }
        let wasHeard = detector.heard
        let event = detector.step(db: db, now: CACurrentMediaTime())
        level = phase == .speaking ? max(level * 0.88, 0.25) : TurnDetector.level(db)

        if phase == .speaking, !wasHeard, detector.heard { return interrupt() }
        switch event {
        case .none: break
        case .end, .cap:
            silentTurns = 0
            finishTurn()
        case .noSpeech:
            silentTurns += 1
            if silentTurns >= 2 { end() } else { listen(options: turnMode) }
        }
    }

    private func haptic() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}

/// Collects 16 kHz mono PCM from the audio thread and measures the level of each buffer.
private final class Capture: @unchecked Sendable {
    static let sampleRate = 16_000

    private let lock = NSLock()
    private var pcm = Data()
    private var recording = false
    private var converter: AVAudioConverter?
    private let outFormat = AVAudioFormat(commonFormat: .pcmFormatInt16, sampleRate: Double(Capture.sampleRate), channels: 1, interleaved: true)!

    var isRecording: Bool {
        get { lock.withLock { recording } }
        set { lock.withLock { recording = newValue } }
    }

    func prepare(input: AVAudioFormat) {
        converter = AVAudioConverter(from: input, to: outFormat)
    }

    func reset() {
        lock.withLock { pcm.removeAll(keepingCapacity: true) }
    }

    func take() -> Data {
        lock.withLock {
            defer { pcm.removeAll(keepingCapacity: true) }
            return pcm
        }
    }

    /// Returns the buffer's level in dBFS; appends converted audio while recording.
    func ingest(_ buffer: AVAudioPCMBuffer) -> Double {
        var db = -160.0
        if let samples = buffer.floatChannelData?[0], buffer.frameLength > 0 {
            var sum: Float = 0
            for i in 0..<Int(buffer.frameLength) { sum += samples[i] * samples[i] }
            let rms = sqrt(sum / Float(buffer.frameLength))
            db = rms > 0 ? Double(20 * log10(rms)) : -160
        }
        guard isRecording, let converter else { return db }

        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * outFormat.sampleRate / buffer.format.sampleRate) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: outFormat, frameCapacity: capacity) else { return db }
        var fed = false
        var error: NSError?
        converter.convert(to: out, error: &error) { _, status in
            if fed {
                status.pointee = .noDataNow
                return nil
            }
            fed = true
            status.pointee = .haveData
            return buffer
        }
        if error == nil, let channel = out.int16ChannelData?[0], out.frameLength > 0 {
            let bytes = Data(bytes: channel, count: Int(out.frameLength) * 2)
            lock.withLock {
                // Cap at about 35 s of audio.
                if pcm.count < Capture.sampleRate * 2 * 35 { pcm.append(bytes) }
            }
        }
        return db
    }
}
