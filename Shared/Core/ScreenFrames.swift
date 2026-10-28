import Foundation

/// Hand-off between the screen broadcast extension (writes the newest frame about once a second)
/// and the screen question (reads it, then stops the broadcast).
enum ScreenFrames {
    static let stopNotification = "app.fixify.broadcast.stop"
    private static let activeKey = "fixify.broadcastActive"

    static var frameURL: URL? {
        AppGroup.container?.appendingPathComponent("screen-latest.jpg")
    }

    static func write(_ jpeg: Data) {
        guard let url = frameURL else { return }
        try? jpeg.write(to: url, options: .atomic)
    }

    /// The newest frame, if it is fresh enough to still show what the user is looking at.
    static func latest(maxAge: TimeInterval = 4) -> Data? {
        guard let url = frameURL,
              let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let modified = attributes[.modificationDate] as? Date,
              Date().timeIntervalSince(modified) <= maxAge
        else { return nil }
        return try? Data(contentsOf: url)
    }

    static var isBroadcasting: Bool {
        get { AppGroup.defaults.bool(forKey: activeKey) && latest(maxAge: 10) != nil }
        set { AppGroup.defaults.set(newValue, forKey: activeKey) }
    }

    /// Asks the broadcast extension to end the recording (Darwin notifications cross process boundaries).
    static func stopBroadcast() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(center, CFNotificationName(stopNotification as CFString), nil, nil, true)
    }

    /// Removes the stored frame so no screen content lingers after the answer.
    static func clear() {
        guard let url = frameURL else { return }
        try? FileManager.default.removeItem(at: url)
    }
}
