import Foundation
import Observation

/// Usage limits per tier. Change the numbers here; nothing else hard-codes them.
/// Only server (Claude) analyses count. On-device analysis and text recognition are always unlimited.
struct UsageLimits: Sendable {
    var analysesPerMonth: Int
    var updatesPerSession: Int
    var imagesPerAnalysis: Int
    var storedSessions: Int?

    static let free = UsageLimits(analysesPerMonth: 15, updatesPerSession: 3, imagesPerAnalysis: 2, storedSessions: 30)
    static let pro = UsageLimits(analysesPerMonth: 300, updatesPerSession: 25, imagesPerAnalysis: 4, storedSessions: nil)

    static func current(isPro: Bool) -> UsageLimits { isPro ? .pro : .free }
}

enum PaywallReason: String, Identifiable {
    case monthlyAnalyses, sessionUpdates, storedSessions, browse
    var id: String { rawValue }
}

/// Counts server analyses per calendar month on this device.
@MainActor
@Observable
final class UsageMeter {
    private let defaults: UserDefaults
    private(set) var monthKey: String
    private(set) var analysesThisMonth: Int
    /// Total completed analyses ever. The paywall is never shown before the first one.
    private(set) var lifetimeAnalyses: Int

    init(defaults: UserDefaults = .standard, now: Date = .now) {
        self.defaults = defaults
        let key = Self.key(for: now)
        monthKey = key
        lifetimeAnalyses = defaults.integer(forKey: "usage.lifetime")
        analysesThisMonth = defaults.string(forKey: "usage.month") == key ? defaults.integer(forKey: "usage.count") : 0
    }

    static func key(for date: Date) -> String {
        let c = Calendar(identifier: .gregorian).dateComponents([.year, .month], from: date)
        return String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
    }

    func rollIfNeeded(now: Date = .now) {
        let key = Self.key(for: now)
        if key != monthKey {
            monthKey = key
            analysesThisMonth = 0
            persist()
        }
    }

    func remaining(limits: UsageLimits, now: Date = .now) -> Int {
        rollIfNeeded(now: now)
        return max(0, limits.analysesPerMonth - analysesThisMonth)
    }

    func record(now: Date = .now) {
        rollIfNeeded(now: now)
        analysesThisMonth += 1
        lifetimeAnalyses += 1
        persist()
    }

    private func persist() {
        defaults.set(monthKey, forKey: "usage.month")
        defaults.set(analysesThisMonth, forKey: "usage.count")
        defaults.set(lifetimeAnalyses, forKey: "usage.lifetime")
    }
}
