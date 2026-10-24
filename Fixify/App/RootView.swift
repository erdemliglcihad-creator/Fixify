import SwiftUI
import SwiftData

struct RootView: View {
    @Environment(Router.self) private var router
    @Environment(AppSettings.self) private var settings
    @Environment(UsageMeter.self) private var usage
    @Environment(ProStore.self) private var pro
    @Environment(\.modelContext) private var context
    @State private var coordinator = AnalysisCoordinator()

    var body: some View {
        @Bindable var router = router

        TabView(selection: $router.tab) {
            Tab("Home", systemImage: "house", value: AppTab.home) {
                NavigationStack { HomeView() }
            }
            Tab("Scan", systemImage: "viewfinder", value: AppTab.scan) {
                // Selecting this tab opens the camera full screen; the tab itself never stays selected.
                Color.fxBackground
            }
            Tab("Sessions", systemImage: "wrench.and.screwdriver", value: AppTab.sessions) {
                NavigationStack(path: $router.sessionPath) {
                    SessionsListView()
                        .navigationDestination(for: UUID.self) { id in SessionScreen(sessionID: id) }
                }
            }
            Tab("Library", systemImage: "books.vertical", value: AppTab.library) {
                NavigationStack { LibraryView() }
            }
            Tab("Settings", systemImage: "gearshape", value: AppTab.settings) {
                NavigationStack { SettingsView() }
            }
        }
        .tabBarMinimizeBehavior(.onScrollDown)
        .onChange(of: router.tab) { old, new in
            if new == .scan {
                router.tab = old == .scan ? .home : old
                router.startScan()
            }
        }
        .fullScreenCover(item: $router.camera) { request in
            LiveFixFlow(request: request)
        }
        .sheet(item: $router.paywallReason) { reason in
            PaywallView(reason: reason)
        }
        .environment(coordinator)
        .task {
            coordinator.configure(context: context, settings: settings, usage: usage, pro: pro)
            SessionStore(context: context).applyRetention(days: settings.autoDeleteSolvedImagesDays)
        }
    }
}

/// Resolves a session id to the guide screen.
struct SessionScreen: View {
    let sessionID: UUID
    @Query private var sessions: [FixSession]

    init(sessionID: UUID) {
        self.sessionID = sessionID
        _sessions = Query(filter: #Predicate<FixSession> { $0.id == sessionID })
    }

    var body: some View {
        if let session = sessions.first {
            SessionDetailView(session: session)
        } else {
            ContentUnavailableView("Session not found", systemImage: "questionmark.folder",
                                   description: Text("It may have been deleted."))
        }
    }
}
