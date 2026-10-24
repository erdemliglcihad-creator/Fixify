import SwiftUI

struct PrivacyInfoView: View {
    var body: some View {
        List {
            Section("Always on this iPhone") {
                InfoRow(symbol: "text.viewfinder", title: String(localized: "Text recognition"),
                        detail: String(localized: "Apple Vision reads text in your photos and in the live camera on the device."))
                InfoRow(symbol: "internaldrive", title: String(localized: "Your sessions"),
                        detail: String(localized: "Photos, analyses and history are stored only in Fixify on this iPhone, protected while it is locked."))
                InfoRow(symbol: "iphone", title: String(localized: "On-device analysis"),
                        detail: String(localized: "If chosen, Apple's on-device model runs locally. Nothing is sent."))
            }
            Section("Only when you tap Analyze") {
                InfoRow(symbol: "server.rack", title: String(localized: "Sent to your Fixify server"),
                        detail: String(localized: "Up to four photos (reduced to about 1600 pixels), the recognized text, your description, answers and the steps you tried in this session."))
                InfoRow(symbol: "arrow.right.circle", title: String(localized: "Passed on to Anthropic"),
                        detail: String(localized: "Your server forwards this to Claude to create the analysis. The server logs only timing and sizes, never images or text."))
            }
            Section("Never") {
                InfoRow(symbol: "chart.bar.xaxis", title: String(localized: "No analytics or tracking"),
                        detail: String(localized: "Fixify has no telemetry, ads or third-party SDKs."))
                InfoRow(symbol: "key", title: String(localized: "No API key in the app"),
                        detail: String(localized: "The Claude key stays on your server. The app only stores an app token in the Keychain."))
            }
            Section {
                Text("Fixify gives guidance, not guarantees. It does not give medical, legal or electrical diagnoses as fact. For mains electricity, gas, vehicles or anything unsafe, ask a professional.")
                    .font(.fxCaption)
            }
        }
        .navigationTitle("What Fixify processes")
    }
}

struct HelpView: View {
    var body: some View {
        List {
            Section {
                helpItem("camera.viewfinder", String(localized: "1. Show the problem"),
                         String(localized: "Photograph the error message, device or part. Boxes in the camera show text the iPhone recognizes. Video records up to 10 seconds and uses three frames."))
                helpItem("sparkle.magnifyingglass", String(localized: "2. Understand it"),
                         String(localized: "The analysis separates what is visible from what is guessed, lists possible causes and says what is still unknown."))
                helpItem("number.circle", String(localized: "3. Look where it matters"),
                         String(localized: "Numbered markers point to findings. Solid boxes come from recognized text and are exact; dashed boxes are AI estimates."))
                helpItem("checklist", String(localized: "4. Fix it step by step"),
                         String(localized: "Mark each step as done or tell Fixify it didn't work. The plan is adjusted with what you report."))
                helpItem("checkmark.seal", String(localized: "5. Verify"),
                         String(localized: "You check the success criteria yourself. Fixify never marks a problem as solved on its own."))
            }
            Section("Limits") {
                Text("Fixify can be wrong. It cannot read things a photo doesn't show, like whether Bluetooth is on or a wire is live. When it needs that, it asks you.")
                    .font(.fxCaption)
            }
        }
        .navigationTitle("How Fixify works")
    }

    private func helpItem(_ symbol: String, _ title: String, _ text: String) -> some View {
        InfoRow(symbol: symbol, title: title, detail: text)
    }
}

struct ServerSetupHelpView: View {
    var body: some View {
        List {
            Section {
                InfoRow(symbol: "1.circle", title: String(localized: "Install Node.js 22 or newer on your computer."))
                InfoRow(symbol: "2.circle", title: String(localized: "In the project's server folder, run npm install."),
                        detail: String(localized: "Then put your Anthropic API key into server/.env as ANTHROPIC_API_KEY."))
                InfoRow(symbol: "3.circle", title: String(localized: "Start it with npm start."),
                        detail: String(localized: "The window shows a server address and an app token."))
                InfoRow(symbol: "4.circle", title: String(localized: "Enter both in Settings → AI analysis and tap Test connection."),
                        detail: String(localized: "Your iPhone and computer must be on the same Wi-Fi. Allow the local network prompt and, on Windows, the firewall prompt."))
            }
        }
        .navigationTitle("Server setup")
    }
}
