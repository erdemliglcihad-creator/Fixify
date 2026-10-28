import AppIntents
import SwiftUI
import WidgetKit

@main
struct FixifyControlsBundle: WidgetBundle {
    var body: some Widget {
        AskFixifyControl()
    }
}

/// The Fixify button for Control Center (like Shazam's). Tapping it asks a question about the screen:
/// iOS shows a small card on top of the current app, you speak or type, Fixify answers aloud.
struct AskFixifyControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: "app.fixify.ios.controls.ask") {
            ControlWidgetButton(action: AskFixifyIntent()) {
                Label("Ask Fixify", systemImage: "waveform.circle.fill")
            }
        }
        .displayName("Ask Fixify")
        .description("Ask about what is on your screen.")
    }
}
