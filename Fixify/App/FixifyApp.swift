import SwiftUI
import SwiftData

@main
struct FixifyApp: App {
    @State private var settings = AppSettings()
    @State private var pro = ProStore()
    @State private var usage = UsageMeter()
    @State private var router = Router()

    let container: ModelContainer = {
        let schema = Schema([FixSession.self, SessionImage.self, AnalysisRevision.self, SessionEvent.self])
        do {
            return try ModelContainer(for: schema, configurations: ModelConfiguration(schema: schema))
        } catch {
            fatalError("Could not open the Fixify database: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(settings)
                .environment(pro)
                .environment(usage)
                .environment(router)
                .preferredColorScheme(settings.appearance.colorScheme)
                .tint(.fxAccent)
                .task { await pro.start() }
        }
        .modelContainer(container)
    }
}
