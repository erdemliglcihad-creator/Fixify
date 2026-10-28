import Foundation

/// End-of-turn detection on microphone levels (same rules as the Expo app's core/voice.ts):
/// speech counts once it stays above the room noise for a moment; about 1.1 s of quiet ends the turn.
struct TurnDetector {
    struct Options {
        /// dB above the measured room noise that counts as speech.
        var margin: Double = 10
        var minSpeech: TimeInterval = 0.22
        var silence: TimeInterval = 1.1
        var noSpeech: TimeInterval = 15
        var maxTurn: TimeInterval = 30
        /// Echo mode: the floor follows the peaks of FixVoice's own voice from the loudspeaker.
        var echo = false
        /// At the start, only learn the level, never count anything as speech.
        var calibrate: TimeInterval = 0

        /// While FixVoice talks, only a voice clearly louder than its own counts as talking over it.
        static let bargeIn = Options(margin: 8, minSpeech: 0.45, noSpeech: 120, echo: true, calibrate: 1.2)
    }

    enum Event: Equatable { case none, end, noSpeech, cap }

    var options: Options
    private(set) var heard = false
    private var startedAt: TimeInterval
    private var floor: Double?
    private var loudSince: TimeInterval?
    private var lastLoudAt: TimeInterval?

    init(options: Options = Options(), now: TimeInterval) {
        self.options = options
        startedAt = now
    }

    /// Mic level in dBFS (about -160…0) mapped to 0…1 for the orb.
    static func level(_ db: Double) -> Double {
        guard db.isFinite else { return 0 }
        return min(max((db + 55) / 50, 0), 1)
    }

    mutating func step(db: Double, now: TimeInterval) -> Event {
        let elapsed = now - startedAt
        if elapsed >= options.maxTurn { return heard ? .cap : .noSpeech }
        guard db.isFinite else { return .none }

        let previous = floor ?? db
        let calibrating = elapsed < options.calibrate
        let loud = !calibrating && db >= max(previous + options.margin, -50)
        if options.echo {
            // Rise to the voice's peaks (fast while calibrating), fall back only very slowly between words.
            let up = calibrating ? 0.6 : 0.1
            floor = loud ? previous : (db > previous ? previous * (1 - up) + db * up : previous * 0.995 + db * 0.005)
        } else {
            // Room noise: drops quickly, rises slowly, frozen while someone speaks.
            floor = loud ? previous : (db < previous ? previous * 0.7 + db * 0.3 : previous * 0.98 + db * 0.02)
        }

        if loud {
            let since = loudSince ?? now
            loudSince = since
            lastLoudAt = now
            if now - since >= options.minSpeech { heard = true }
        } else {
            loudSince = nil
        }

        if heard, let last = lastLoudAt, now - last >= options.silence { return .end }
        if !heard, elapsed >= options.noSpeech { return .noSpeech }
        return .none
    }
}

/// 16-bit mono PCM to a WAV file for the speech-to-text upload.
enum WAV {
    static func encode(pcm: Data, sampleRate: Int) -> Data {
        var out = Data()
        func append<T: FixedWidthInteger>(_ value: T) { withUnsafeBytes(of: value.littleEndian) { out.append(contentsOf: $0) } }
        out.append(contentsOf: Array("RIFF".utf8)); append(UInt32(36 + pcm.count))
        out.append(contentsOf: Array("WAVE".utf8))
        out.append(contentsOf: Array("fmt ".utf8)); append(UInt32(16)); append(UInt16(1)); append(UInt16(1))
        append(UInt32(sampleRate)); append(UInt32(sampleRate * 2)); append(UInt16(2)); append(UInt16(16))
        out.append(contentsOf: Array("data".utf8)); append(UInt32(pcm.count))
        out.append(pcm)
        return out
    }
}
