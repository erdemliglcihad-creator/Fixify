import AppIntents

/// Makes "Ask Fixify" show up in Shortcuts, Spotlight and Siri without any setup.
struct FixifyShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskFixifyIntent(),
            phrases: [
                "Ask \(.applicationName)",
                "Ask \(.applicationName) about my screen",
                "What's on my screen \(.applicationName)",
            ],
            shortTitle: "Ask Fixify",
            systemImageName: "waveform.circle"
        )
    }
}
