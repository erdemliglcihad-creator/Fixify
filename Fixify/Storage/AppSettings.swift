import Foundation
import Observation
import Security

enum AnalysisProviderKind: String, CaseIterable, Identifiable, Sendable {
    /// Your Fixify proxy (server/), which calls Claude with a key that never leaves the server.
    case proxy
    /// Apple's on-device language model. Text only: reads OCR and your description, cannot see the image.
    case onDevice = "on-device"
    /// No AI. Local text recognition only.
    case off

    var id: String { rawValue }

    var title: String {
        switch self {
        case .proxy: String(localized: "Fixify server (Claude)")
        case .onDevice: String(localized: "On this iPhone (text only)")
        case .off: String(localized: "Off – text recognition only")
        }
    }
}

/// User preferences. Secrets (the app token) live in the Keychain, everything else in UserDefaults.
@MainActor
@Observable
final class AppSettings {
    private let defaults: UserDefaults

    var appearance: Appearance { didSet { defaults.set(appearance.rawValue, forKey: Keys.appearance) } }
    var provider: AnalysisProviderKind { didSet { defaults.set(provider.rawValue, forKey: Keys.provider) } }
    var serverURL: String { didSet { defaults.set(serverURL, forKey: Keys.serverURL) } }
    var appToken: String { didSet { Keychain.set(appToken, for: Keys.appToken) } }
    /// Explicit consent to send images and text to the configured server.
    var externalConsent: Bool { didSet { defaults.set(externalConsent, forKey: Keys.consent) } }
    var remindersEnabled: Bool { didSet { defaults.set(remindersEnabled, forKey: Keys.reminders) } }
    var hasSeenCameraIntro: Bool { didSet { defaults.set(hasSeenCameraIntro, forKey: Keys.cameraIntro) } }
    /// Delete image files of solved sessions automatically after this many days (0 = never).
    var autoDeleteSolvedImagesDays: Int { didSet { defaults.set(autoDeleteSolvedImagesDays, forKey: Keys.autoDelete) } }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        // Dark-first: the black and blue design is made for a dark base. Light stays available.
        appearance = Appearance(rawValue: defaults.string(forKey: Keys.appearance) ?? "") ?? .dark
        provider = AnalysisProviderKind(rawValue: defaults.string(forKey: Keys.provider) ?? "") ?? .proxy
        serverURL = defaults.string(forKey: Keys.serverURL) ?? ""
        appToken = Keychain.get(Keys.appToken) ?? ""
        externalConsent = defaults.bool(forKey: Keys.consent)
        remindersEnabled = defaults.bool(forKey: Keys.reminders)
        hasSeenCameraIntro = defaults.bool(forKey: Keys.cameraIntro)
        autoDeleteSolvedImagesDays = defaults.object(forKey: Keys.autoDelete) as? Int ?? 0
    }

    var normalizedServerURL: URL? {
        var text = serverURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        if !text.contains("://") { text = "http://" + text }
        while text.hasSuffix("/") { text.removeLast() }
        guard let url = URL(string: text), url.host() != nil else { return nil }
        return url
    }

    var isProxyConfigured: Bool { normalizedServerURL != nil && !appToken.isEmpty }

    private enum Keys {
        static let appearance = "appearance"
        static let provider = "analysisProvider"
        static let serverURL = "serverURL"
        static let appToken = "app.fixify.appToken"
        static let consent = "externalConsent"
        static let reminders = "remindersEnabled"
        static let cameraIntro = "hasSeenCameraIntro"
        static let autoDelete = "autoDeleteSolvedImagesDays"
    }
}

enum Keychain {
    static func set(_ value: String, for key: String) {
        let query: [CFString: Any] = [kSecClass: kSecClassGenericPassword, kSecAttrAccount: key]
        SecItemDelete(query as CFDictionary)
        guard !value.isEmpty else { return }
        var attributes = query
        attributes[kSecValueData] = Data(value.utf8)
        attributes[kSecAttrAccessible] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(attributes as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrAccount: key,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
