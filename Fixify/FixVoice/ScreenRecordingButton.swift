import ReplayKit
import SwiftUI

/// iOS only lets the system's own picker start a screen recording. This puts the (invisible) picker
/// on top of our ring button, so tapping the ring opens "Start Broadcast" with Fixify preselected.
struct ScreenRecordingPicker: UIViewRepresentable {
    static let extensionID = "app.fixify.ios.broadcast"

    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
        picker.preferredExtension = Self.extensionID
        picker.showsMicrophoneButton = false
        // Hide the default glyph; our ring is drawn underneath.
        for case let button as UIButton in picker.subviews {
            button.imageView?.tintColor = .clear
            button.setImage(nil, for: .normal)
        }
        return picker
    }

    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}
