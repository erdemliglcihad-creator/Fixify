import SwiftUI
import SwiftData
import StoreKit

struct SettingsView: View {
    @Environment(AppSettings.self) private var settings
    @Environment(ProStore.self) private var pro
    @Environment(UsageMeter.self) private var usage
    @Environment(Router.self) private var router
    @Environment(\.modelContext) private var context
    @Query private var sessions: [FixSession]

    @State private var connection: ConnectionState = .idle
    @State private var showDeleteAll = false
    @State private var showManageSubscriptions = false
    @State private var storageBytes: Int64 = 0
    @State private var restoreMessage: String?

    enum ConnectionState: Equatable {
        case idle, checking, ok(model: String?, configured: Bool), failed(String)
    }

    var body: some View {
        @Bindable var settings = settings

        Form {
            Section("Appearance") {
                Picker("Appearance", selection: $settings.appearance) {
                    ForEach(Appearance.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
            }

            aiSection

            Section {
                Toggle("Allow sending to my Fixify server", isOn: $settings.externalConsent)
                NavigationLink("What Fixify processes") { PrivacyInfoView() }
            } header: {
                Text("Privacy")
            } footer: {
                Text("When off, nothing leaves this iPhone: text recognition still works, and Fixify asks before the next analysis.")
            }

            Section {
                LabeledContent("Sessions", value: "\(sessions.count)")
                LabeledContent("Photos", value: ByteCountFormatter.string(fromByteCount: storageBytes, countStyle: .file))
                Picker("Delete photos of solved sessions", selection: $settings.autoDeleteSolvedImagesDays) {
                    Text("Never").tag(0)
                    Text("After 7 days").tag(7)
                    Text("After 30 days").tag(30)
                    Text("After 90 days").tag(90)
                }
                Button("Delete photos of completed sessions now") {
                    let store = SessionStore(context: context)
                    for session in sessions where !session.status.isOpen && !session.images.isEmpty {
                        store.deleteImages(of: session)
                    }
                    refreshStorage()
                }
                Button("Delete all Fixify data", role: .destructive) { showDeleteAll = true }
            } header: {
                Text("Storage")
            } footer: {
                Text("Photos are stored once even if used in several sessions, and are protected while your iPhone is locked.")
            }

            Section {
                Toggle("Reminders for open sessions", isOn: $settings.remindersEnabled)
            } header: {
                Text("Notifications")
            } footer: {
                Text("Only when you ask for a reminder in a session. Fixify sends no other notifications.")
            }

            proSection

            Section("Help & feedback") {
                NavigationLink("How Fixify works") { HelpView() }
                NavigationLink("Set up the Fixify server") { ServerSetupHelpView() }
                ShareLink(item: feedbackTemplate) { Label("Send feedback", systemImage: "envelope") }
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "–")
            }
        }
        .scrollContentBackground(.hidden)
        .fxScreen()
        .navigationTitle("Settings")
        .onAppear(perform: refreshStorage)
        .onChange(of: settings.remindersEnabled) { _, enabled in
            if !enabled { Reminders.cancelAll() }
        }
        .confirmationDialog("Delete all Fixify data?", isPresented: $showDeleteAll, titleVisibility: .visible) {
            Button("Delete everything", role: .destructive) {
                try? SessionStore(context: context).deleteEverything()
                Reminders.cancelAll()
                router.sessionPath = []
                refreshStorage()
            }
        } message: {
            Text("All sessions, photos, analyses and history are removed from this iPhone. Your settings stay.")
        }
        .manageSubscriptionsSheet(isPresented: $showManageSubscriptions)
        .alert("Purchases", isPresented: .init(get: { restoreMessage != nil }, set: { if !$0 { restoreMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(restoreMessage ?? "")
        }
    }

    // MARK: AI

    @ViewBuilder
    private var aiSection: some View {
        @Bindable var settings = settings
        Section {
            Picker("Analysis", selection: $settings.provider) {
                ForEach(AnalysisProviderKind.allCases) { Text($0.title).tag($0) }
            }

            switch settings.provider {
            case .proxy:
                TextField("Server address, e.g. 192.168.1.20:8787", text: $settings.serverURL)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: settings.serverURL) { connection = .idle }
                SecureField("App token", text: $settings.appToken)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .onChange(of: settings.appToken) { connection = .idle }
                Button {
                    testConnection()
                } label: {
                    HStack {
                        Text("Test connection")
                        Spacer()
                        connectionStatus
                    }
                }
                .disabled(!settings.isProxyConfigured || connection == .checking)
                LabeledContent("Analyses left this month",
                               value: "\(usage.remaining(limits: pro.limits)) / \(pro.limits.analysesPerMonth)")
            case .onDevice:
                let status = OnDeviceAnalysisService.availability
                Label(status.available ? String(localized: "Available on this iPhone") : status.reason,
                      systemImage: status.available ? "checkmark.circle" : "exclamationmark.circle")
                    .foregroundStyle(status.available ? Color.fxSuccess : Color.fxCaution)
            case .off:
                EmptyView()
            }
        } header: {
            Text("AI analysis")
        } footer: {
            switch settings.provider {
            case .proxy:
                Text("Your Fixify server holds the Claude API key, so no key is stored in the app. Start it on your computer and copy the address and token it shows.")
            case .onDevice:
                Text("Apple's on-device model reads the recognized text and your description. It cannot see photos, so markers appear only on recognized text.")
            case .off:
                Text("Fixify only recognizes text on this iPhone. No diagnosis or plan is created.")
            }
        }
    }

    @ViewBuilder
    private var connectionStatus: some View {
        switch connection {
        case .idle: EmptyView()
        case .checking: ProgressView()
        case .ok(_, let configured):
            Label(configured ? String(localized: "Connected") : String(localized: "Server has no API key"),
                  systemImage: configured ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                .foregroundStyle(configured ? Color.fxSuccess : Color.fxCaution)
                .font(.caption)
        case .failed(let message):
            Text(message).font(.caption).foregroundStyle(Color.fxDanger).multilineTextAlignment(.trailing)
        }
    }

    private func testConnection() {
        guard let url = settings.normalizedServerURL else { return }
        connection = .checking
        Task {
            do {
                let health = try await ProxyAnalysisService(baseURL: url, token: settings.appToken).check()
                connection = .ok(model: health.model, configured: health.configured)
            } catch {
                connection = .failed((error as? AnalysisFailure)?.localizedDescription ?? String(localized: "Not reachable"))
            }
        }
    }

    // MARK: Pro

    @ViewBuilder
    private var proSection: some View {
        Section {
            if pro.isPro {
                Label("Fixify Pro is active", systemImage: "checkmark.seal.fill").foregroundStyle(Color.fxSuccess)
                Button("Manage subscription") { showManageSubscriptions = true }
            } else {
                Button { router.paywallReason = .browse } label: {
                    Label("See Fixify Pro", systemImage: "sparkles")
                }
            }
            Button("Restore purchases") {
                Task {
                    do {
                        try await pro.restore()
                        restoreMessage = pro.isPro
                            ? String(localized: "Fixify Pro restored.")
                            : String(localized: "No active Fixify Pro purchase was found.")
                    } catch {
                        restoreMessage = error.localizedDescription
                    }
                }
            }
        } header: {
            Text("Fixify Pro")
        }
    }

    private func refreshStorage() {
        Task.detached {
            let bytes = ImageStore.shared.totalBytes()
            await MainActor.run { storageBytes = bytes }
        }
    }

    private var feedbackTemplate: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""
        return String(localized: "Fixify feedback (version \(version), iOS \(UIDevice.current.systemVersion))\n\nWhat happened:\n\nWhat I expected:\n")
    }
}
