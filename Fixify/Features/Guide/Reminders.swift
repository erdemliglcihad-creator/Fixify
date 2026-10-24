import Foundation
import UserNotifications

/// Optional, user-requested reminder to continue a session. Nothing is scheduled automatically.
enum Reminders {
    static func schedule(sessionID: UUID, title: String, after interval: TimeInterval) async -> Bool {
        let center = UNUserNotificationCenter.current()
        let granted = (try? await center.requestAuthorization(options: [.alert, .sound])) ?? false
        guard granted else { return false }
        let content = UNMutableNotificationContent()
        content.title = String(localized: "Continue your fix")
        content.body = title
        content.sound = .default
        content.userInfo = ["sessionID": sessionID.uuidString]
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let request = UNNotificationRequest(identifier: "session-\(sessionID.uuidString)", content: content, trigger: trigger)
        do {
            try await center.add(request)
            return true
        } catch {
            return false
        }
    }

    static func cancel(sessionID: UUID) {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: ["session-\(sessionID.uuidString)"])
    }

    static func cancelAll() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
    }
}
