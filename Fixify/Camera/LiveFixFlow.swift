import SwiftUI
import SwiftData

/// Camera → review → session. Owns the captures until they are saved.
struct LiveFixFlow: View {
    let request: CameraRequest

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Environment(Router.self) private var router
    @Environment(AppSettings.self) private var settings
    @Environment(AnalysisCoordinator.self) private var coordinator

    @State private var captures: [CapturedImage] = []
    @State private var showReview = false
    @State private var describeOnly = false

    static let maxCaptures = 4

    var body: some View {
        LiveFixCameraView(
            category: request.category,
            startWithLibrary: request.startWithLibrary,
            captures: $captures,
            maxCaptures: Self.maxCaptures,
            onClose: { dismiss() },
            onNext: { describeOnly = false; showReview = true },
            onDescribeOnly: { describeOnly = true; showReview = true }
        )
        .sheet(isPresented: $showReview) {
            CaptureReviewView(
                captures: $captures,
                initialCategory: request.category,
                targetSessionID: request.targetSessionID,
                focusDescription: describeOnly,
                onFinished: { sessionID in
                    showReview = false
                    dismiss()
                    router.open(sessionID)
                }
            )
            .presentationDetents([.large])
        }
    }
}

struct CaptureReviewView: View {
    @Binding var captures: [CapturedImage]
    var initialCategory: ProblemCategory?
    var targetSessionID: UUID?
    var focusDescription: Bool
    var onFinished: (UUID) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Environment(AppSettings.self) private var settings
    @Environment(AnalysisCoordinator.self) private var coordinator
    @Environment(Router.self) private var router
    @Environment(ProStore.self) private var pro
    @Query private var allSessions: [FixSession]

    @State private var text = ""
    @State private var paywall: PaywallReason?
    @State private var category: ProblemCategory?
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var showConsent = false
    @FocusState private var descriptionFocused: Bool

    private var isAddingToSession: Bool { targetSessionID != nil }
    private var canSubmit: Bool { !saving && (!captures.isEmpty || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }

    var body: some View {
        NavigationStack {
            Form {
                if !captures.isEmpty {
                    Section {
                        ScrollView(.horizontal) {
                            HStack(spacing: FXSpacing.m) {
                                ForEach(captures) { capture in
                                    Image(uiImage: capture.image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 110, height: 150)
                                        .clipShape(.rect(cornerRadius: 14))
                                        .overlay(alignment: .topTrailing) {
                                            Button {
                                                captures.removeAll { $0.id == capture.id }
                                            } label: {
                                                Image(systemName: "xmark.circle.fill")
                                                    .font(.title3)
                                                    .symbolRenderingMode(.palette)
                                                    .foregroundStyle(.white, .black.opacity(0.55))
                                            }
                                            .padding(6)
                                            .accessibilityLabel(Text("Remove photo"))
                                        }
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .scrollIndicators(.hidden)
                        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    } header: {
                        Text("\(captures.count) of \(LiveFixFlow.maxCaptures) photos")
                    }
                }

                Section {
                    TextField(isAddingToSession ? String(localized: "What changed? (optional)") : String(localized: "What's wrong? What did you already try?"),
                              text: $text, axis: .vertical)
                        .lineLimit(3...8)
                        .focused($descriptionFocused)
                } header: {
                    Text(isAddingToSession ? String(localized: "New observation") : String(localized: "Description"))
                } footer: {
                    if captures.isEmpty {
                        Text("Without a photo, Fixify works from your description only.")
                    }
                }

                if !isAddingToSession {
                    Section("Topic") {
                        Picker("Topic", selection: $category) {
                            Text("Let Fixify decide").tag(ProblemCategory?.none)
                            ForEach(ProblemCategory.allCases) { category in
                                Label(category.title, systemImage: category.symbol).tag(ProblemCategory?.some(category))
                            }
                        }
                    }
                }

                Section {
                    privacyNote
                }
            }
            .navigationTitle(isAddingToSession ? "Add to session" : "Review")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { dismiss() }
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button {
                    submit()
                } label: {
                    HStack {
                        if saving { ProgressView() }
                        Text(saving ? String(localized: "Recognizing text on device") : (isAddingToSession ? String(localized: "Add observation") : primaryTitle))
                    }
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.glassProminent)
                .disabled(!canSubmit)
                .padding(.horizontal, FXSpacing.l)
                .padding(.bottom, FXSpacing.s)
            }
            .alert("Could not save", isPresented: .init(get: { errorMessage != nil }, set: { if !$0 { errorMessage = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
            .sheet(item: $paywall) { reason in PaywallView(reason: reason) }
            .sheet(isPresented: $showConsent) {
                ConsentSheet { accepted in
                    showConsent = false
                    settings.externalConsent = accepted
                    save(analyze: accepted)
                }
                .presentationDetents([.medium, .large])
            }
            .onAppear {
                category = initialCategory
                if focusDescription { descriptionFocused = true }
            }
        }
    }

    private var primaryTitle: String {
        switch settings.provider {
        case .proxy where settings.isProxyConfigured: String(localized: "Analyze")
        case .onDevice: String(localized: "Analyze on this iPhone")
        default: String(localized: "Save and recognize text")
        }
    }

    @ViewBuilder
    private var privacyNote: some View {
        switch settings.provider {
        case .proxy where settings.isProxyConfigured:
            InfoRow(symbol: "lock.shield",
                    title: String(localized: "Text is recognized on this iPhone first."),
                    detail: String(localized: "For the analysis, the photos (reduced in size), the recognized text and your description are sent to your Fixify server, which passes them to Claude. Nothing is sent before you tap Analyze."))
        case .onDevice:
            InfoRow(symbol: "iphone",
                    title: String(localized: "Everything stays on this iPhone."),
                    detail: String(localized: "The on-device model reads the recognized text and your description. It cannot see the photo itself."))
        default:
            InfoRow(symbol: "iphone",
                    title: String(localized: "Only on-device text recognition."),
                    detail: String(localized: "AI analysis is off or not set up. You can analyze the session later from Settings."))
        }
    }

    private func submit() {
        if !isAddingToSession, let limit = pro.limits.storedSessions, allSessions.count >= limit {
            paywall = .storedSessions
            return
        }
        if settings.provider == .proxy && settings.isProxyConfigured && !settings.externalConsent && !isAddingToSession {
            showConsent = true
        } else {
            save(analyze: true)
        }
    }

    private func save(analyze: Bool) {
        saving = true
        Task {
            defer { saving = false }
            let store = SessionStore(context: context)
            do {
                if let targetSessionID,
                   let session = try context.fetch(FetchDescriptor<FixSession>(predicate: #Predicate { $0.id == targetSessionID })).first {
                    let note = text.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !note.isEmpty { session.log(.note, note) }
                    try await store.addImages(captures, to: session)
                    captures = []
                    onFinished(session.id)
                } else {
                    let session = try await store.createSession(captures: captures, description: text, category: category)
                    captures = []
                    if analyze, coordinator.preflight(for: session, mode: .initial) == .ready {
                        coordinator.start(session, mode: .initial)
                    }
                    onFinished(session.id)
                }
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

/// Asked once before anything is sent to the configured server.
struct ConsentSheet: View {
    var onDecision: (Bool) -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: FXSpacing.l) {
                Image(systemName: "hand.raised.square")
                    .font(.system(size: 40))
                    .foregroundStyle(Color.fxAccent)
                Text("Send this problem for analysis?").font(.fxTitle)
                VStack(alignment: .leading, spacing: FXSpacing.m) {
                    InfoRow(symbol: "photo", title: String(localized: "Photos, reduced to about 1600 pixels"))
                    InfoRow(symbol: "text.viewfinder", title: String(localized: "Text recognized on this iPhone"))
                    InfoRow(symbol: "text.bubble", title: String(localized: "Your description, answers and the steps you tried"))
                }
                Text("They go to the Fixify server you configured, which sends them to Anthropic's Claude to create the analysis. Nothing is sent in the background. Avoid photographing passwords, IDs or other people.")
                    .font(.fxBody)
                    .foregroundStyle(Color.fxSecondaryText)
                Text("You can change this anytime in Settings → Privacy.")
                    .font(.fxCaption)
                    .foregroundStyle(Color.fxSecondaryText)
                VStack(spacing: FXSpacing.s) {
                    Button { onDecision(true) } label: {
                        Text("Allow and analyze").font(.headline).frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.glassProminent)
                    Button { onDecision(false) } label: {
                        Text("Only save on this iPhone").frame(maxWidth: .infinity).padding(.vertical, 6)
                    }
                    .buttonStyle(.glass)
                }
            }
            .padding(FXSpacing.xl)
        }
    }
}
