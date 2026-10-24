import SwiftUI
import AVFoundation
import Observation

enum CaptureMode: String, CaseIterable, Identifiable {
    case photo, video, document
    var id: String { rawValue }
    var title: String {
        switch self {
        case .photo: String(localized: "Photo")
        case .video: String(localized: "Video")
        case .document: String(localized: "Document")
        }
    }
}

/// UI state of the camera. `state` reflects what the hardware is actually doing.
@MainActor
@Observable
final class CameraModel {
    enum State: Equatable {
        case starting
        case ready
        case capturing
        case recording(since: Date)
        case extractingFrames
        case denied
        case unavailable
    }

    let camera = CameraSession()
    var state: State = .starting
    var mode: CaptureMode = .photo {
        didSet { if oldValue != mode { modeChanged(from: oldValue) } }
    }
    var liveText: [TextBlock] = []
    var liveFrameSize: CGSize = .zero
    var torchOn = false { didSet { camera.setTorch(torchOn) } }
    var errorMessage: String?

    func start() async {
        guard await CameraSession.requestAccess() else { state = .denied; return }
        do {
            camera.onTextDetected = { [weak self] blocks, size in
                Task { @MainActor in
                    guard let self, self.mode == .photo else { return }
                    self.liveText = blocks
                    self.liveFrameSize = size
                }
            }
            try await camera.configure()
            camera.start()
            state = .ready
        } catch {
            state = .unavailable
        }
    }

    func stop() {
        camera.stop()
        torchOn = false
    }

    private func modeChanged(from old: CaptureMode) {
        liveText = []
        if mode == .video || old == .video { camera.setVideoMode(mode == .video) }
        camera.liveTextEnabled = mode == .photo
    }

    func takePhoto() async -> UIImage? {
        guard state == .ready else { return nil }
        state = .capturing
        defer { if state == .capturing { state = .ready } }
        do {
            return try await camera.capturePhoto()
        } catch {
            errorMessage = error.localizedDescription
            return nil
        }
    }

    /// Records up to 10 s, then returns three evenly spaced frames for analysis.
    func recordClip() async -> [UIImage] {
        guard state == .ready else { return [] }
        state = .recording(since: .now)
        do {
            let url = try await camera.startRecording()
            state = .extractingFrames
            defer { try? FileManager.default.removeItem(at: url) }
            let frames = try await ImageProcessing.keyFrames(from: url, count: 3)
            state = .ready
            return frames
        } catch {
            state = .ready
            errorMessage = error.localizedDescription
            return []
        }
    }

    func stopRecording() { camera.stopRecording() }

    var statusText: String {
        switch state {
        case .starting: String(localized: "Starting camera")
        case .capturing: String(localized: "Capturing")
        case .recording: String(localized: "Recording")
        case .extractingFrames: String(localized: "Taking frames from the video")
        case .denied: String(localized: "No camera access")
        case .unavailable: String(localized: "Camera unavailable")
        case .ready:
            switch mode {
            case .photo:
                liveText.isEmpty
                    ? String(localized: "Ready")
                    : String(localized: "Text detected on device")
            case .video: String(localized: "Ready · up to 10 s")
            case .document: String(localized: "Ready")
            }
        }
    }
}

/// Camera preview layer, aspect-fill.
struct CameraPreview: UIViewRepresentable {
    let session: AVCaptureSession
    var onTap: (CGPoint, CGPoint) -> Void = { _, _ in }

    final class PreviewView: UIView {
        override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
        var previewLayer: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
        var onTap: (CGPoint, CGPoint) -> Void = { _, _ in }

        @objc func tapped(_ recognizer: UITapGestureRecognizer) {
            let point = recognizer.location(in: self)
            onTap(point, previewLayer.captureDevicePointConverted(fromLayerPoint: point))
        }

        override func layoutSubviews() {
            super.layoutSubviews()
            if let connection = previewLayer.connection, connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
        }
    }

    func makeUIView(context: Context) -> PreviewView {
        let view = PreviewView()
        view.previewLayer.session = session
        view.previewLayer.videoGravity = .resizeAspectFill
        view.backgroundColor = .black
        view.addGestureRecognizer(UITapGestureRecognizer(target: view, action: #selector(PreviewView.tapped(_:))))
        view.onTap = onTap
        return view
    }

    func updateUIView(_ view: PreviewView, context: Context) {
        view.onTap = onTap
    }
}
