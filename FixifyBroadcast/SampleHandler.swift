import CoreImage
import ReplayKit
import UIKit

/// Fixify's screen recording ("broadcast"). iOS starts it only after the user confirms
/// (Control Center → Screen Recording → Fixify → Start). While it runs, the newest frame is kept in the
/// App Group about once a second; a screen question reads it and then asks this extension to stop.
/// Nothing is uploaded from here and no video is stored.
final class SampleHandler: RPBroadcastSampleHandler {
    private let context = CIContext()
    private var lastFrame = Date.distantPast

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        ScreenFrames.isBroadcasting = true
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterAddObserver(center, Unmanaged.passUnretained(self).toOpaque(), { _, observer, _, _, _ in
            guard let observer else { return }
            let handler = Unmanaged<SampleHandler>.fromOpaque(observer).takeUnretainedValue()
            handler.finishFromApp()
        }, ScreenFrames.stopNotification as CFString, nil, .deliverImmediately)
    }

    override func broadcastFinished() {
        cleanUp()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video, Date().timeIntervalSince(lastFrame) >= 0.8,
              let pixels = CMSampleBufferGetImageBuffer(sampleBuffer)
        else { return }
        lastFrame = Date()

        var image = CIImage(cvPixelBuffer: pixels)
        if let raw = CMGetAttachment(sampleBuffer, key: RPVideoSampleOrientationKey as CFString, attachmentModeOut: nil) as? NSNumber,
           let orientation = CGImagePropertyOrientation(rawValue: raw.uint32Value) {
            image = image.oriented(orientation)
        }
        // Keep memory low (broadcast extensions have a tight limit): long side 1280 px.
        let scale = min(1, 1280 / max(image.extent.width, image.extent.height))
        image = image.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
        guard let cgImage = context.createCGImage(image, from: image.extent),
              let jpeg = UIImage(cgImage: cgImage).jpegData(compressionQuality: 0.7)
        else { return }
        ScreenFrames.write(jpeg)
    }

    private func finishFromApp() {
        cleanUp()
        let error = NSError(domain: "app.fixify.broadcast", code: 0, userInfo: [
            NSLocalizedDescriptionKey: String(localized: "Fixify answered. The screen recording has ended."),
        ])
        finishBroadcastWithError(error)
    }

    private func cleanUp() {
        ScreenFrames.isBroadcasting = false
        ScreenFrames.clear()
        CFNotificationCenterRemoveEveryObserver(CFNotificationCenterGetDarwinNotifyCenter(), Unmanaged.passUnretained(self).toOpaque())
    }
}
