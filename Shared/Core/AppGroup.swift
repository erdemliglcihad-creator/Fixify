import Foundation

/// Storage shared by the app, the Control Center button and the screen broadcast extension.
/// Falls back to the process's own storage when the App Group is not available (e.g. some sideloading setups).
enum AppGroup {
    static let id = "group.app.fixify.ios"

    static var container: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: id)
    }

    static var defaults: UserDefaults {
        UserDefaults(suiteName: id) ?? .standard
    }

    private enum Keys {
        static let deviceID = "fixify.deviceID"
        static let voice = "fixify.voiceGender"
        static let consent = "fixify.cloudConsent"
    }

    /// Anonymous id for Fixify Cloud's daily limits (same idea as the Expo app).
    static var deviceID: String {
        if let id = defaults.string(forKey: Keys.deviceID) { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: Keys.deviceID)
        return id
    }

    /// FixVoice and screen questions speak with this voice; the language follows the iPhone.
    static var voiceGender: VoiceGender {
        get { VoiceGender(rawValue: defaults.string(forKey: Keys.voice) ?? "") ?? .female }
        set { defaults.set(newValue.rawValue, forKey: Keys.voice) }
    }

    /// The user agreed once that screenshots, speech and questions go to Fixify Cloud.
    static var cloudConsent: Bool {
        get { defaults.bool(forKey: Keys.consent) }
        set { defaults.set(newValue, forKey: Keys.consent) }
    }

    /// "de" or "en", following the iPhone's language.
    static var locale: String {
        Locale.preferredLanguages.first?.hasPrefix("de") == true ? "de" : "en"
    }
}

enum VoiceGender: String, CaseIterable, Identifiable, Sendable {
    case female, male
    var id: String { rawValue }
}
