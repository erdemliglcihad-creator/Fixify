import SwiftUI
import Observation

enum AppTab: Hashable {
    case home, fixVoice, scan, sessions, library, settings
}

/// What the camera is opened for.
struct CameraRequest: Identifiable, Equatable {
    let id = UUID()
    var category: ProblemCategory?
    /// When set, captured photos are added to this session as a new observation instead of creating one.
    var targetSessionID: UUID?
    var startWithLibrary = false
}

@MainActor
@Observable
final class Router {
    var tab: AppTab = .home
    var sessionPath: [UUID] = []
    var camera: CameraRequest?
    var paywallReason: PaywallReason?

    func startScan(category: ProblemCategory? = nil, library: Bool = false) {
        camera = CameraRequest(category: category, startWithLibrary: library)
    }

    func addPhoto(to session: FixSession) {
        camera = CameraRequest(category: session.category, targetSessionID: session.id)
    }

    func open(_ sessionID: UUID) {
        tab = .sessions
        sessionPath = [sessionID]
    }
}
