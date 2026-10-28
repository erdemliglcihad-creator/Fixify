import SwiftUI

/// One-time setup for asking about the screen from any app.
struct ScreenQuestionSetupView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Open Control Center, tap Edit (top left), Add a Control, search for Fixify and add \"Ask Fixify\".", systemImage: "1.circle")
                    Label("Long-press Screen Recording in Control Center, choose Fixify and tap Start Broadcast.", systemImage: "2.circle")
                    Label("Tap the Fixify button, ask your question by voice or tap to type. Fixify answers in a small card and reads it aloud. The recording ends after the answer.", systemImage: "3.circle")
                } header: {
                    Text("With the Control Center button")
                }

                Section {
                    Label("In the Shortcuts app, create a shortcut with \"Take Screenshot\" followed by \"Ask Fixify\" (use the screenshot as input).", systemImage: "1.circle")
                    Label("Settings → Accessibility → Touch → Back Tap → Double Tap → choose that shortcut. You can also add the shortcut to Control Center.", systemImage: "2.circle")
                    Label("Double-tap the back of your iPhone in any app and ask.", systemImage: "3.circle")
                } header: {
                    Text("Without recording: screenshot shortcut")
                } footer: {
                    Text("iOS does not allow apps to record or overlay other apps on their own, so the recording always needs your confirmation. Each question uses one of today's photo uploads.")
                }
            }
            .navigationTitle("Ask about your screen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
