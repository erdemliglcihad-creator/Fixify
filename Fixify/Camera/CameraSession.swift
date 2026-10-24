import AVFoundation
import UIKit

/// AVFoundation wrapper. All session work happens on a private serial queue.
/// Photo mode adds a frame output for live, on-device text detection; video mode swaps it for a movie output
/// (the two outputs are not combined, which keeps capture reliable on all devices).
final class CameraSession: NSObject, @unchecked Sendable {
    enum CameraError: LocalizedError {
        case unavailable, notAuthorized, captureFailed
        var errorDescription: String? {
            switch self {
            case .unavailable: String(localized: "No camera is available on this device.")
            case .notAuthorized: String(localized: "Fixify has no access to the camera.")
            case .captureFailed: String(localized: "The photo could not be taken. Try again.")
            }
        }
    }

    let session = AVCaptureSession()
    private let queue = DispatchQueue(label: "app.fixify.camera")
    private let frameQueue = DispatchQueue(label: "app.fixify.camera.frames", qos: .userInitiated)
    private let photoOutput = AVCapturePhotoOutput()
    private let movieOutput = AVCaptureMovieFileOutput()
    private let frameOutput = AVCaptureVideoDataOutput()
    private var device: AVCaptureDevice?
    private var isConfigured = false

    private var photoContinuation: CheckedContinuation<UIImage, Error>?
    private var movieContinuation: CheckedContinuation<URL, Error>?

    /// Called on a background queue with text found in the latest frame (upright, top-left normalized) and that frame's upright size.
    var onTextDetected: (@Sendable ([TextBlock], CGSize) -> Void)?
    var liveTextEnabled = true
    private var lastTextScan = Date.distantPast
    private var scanning = false

    static func requestAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: true
        case .notDetermined: await AVCaptureDevice.requestAccess(for: .video)
        default: false
        }
    }

    static var isAuthorized: Bool { AVCaptureDevice.authorizationStatus(for: .video) == .authorized }

    func configure() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async { [self] in
                if isConfigured { return continuation.resume() }
                guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                      let input = try? AVCaptureDeviceInput(device: device) else {
                    return continuation.resume(throwing: CameraError.unavailable)
                }
                self.device = device
                session.beginConfiguration()
                session.sessionPreset = .photo
                if session.canAddInput(input) { session.addInput(input) }
                if session.canAddOutput(photoOutput) {
                    session.addOutput(photoOutput)
                    photoOutput.maxPhotoQualityPrioritization = .quality
                }
                frameOutput.alwaysDiscardsLateVideoFrames = true
                frameOutput.videoSettings = [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_420YpCbCr8BiPlanarFullRange]
                frameOutput.setSampleBufferDelegate(self, queue: frameQueue)
                if session.canAddOutput(frameOutput) { session.addOutput(frameOutput) }
                applyPortrait()
                session.commitConfiguration()
                isConfigured = true
                continuation.resume()
            }
        }
    }

    func start() { queue.async { [self] in if !session.isRunning { session.startRunning() } } }
    func stop() { queue.async { [self] in if session.isRunning { session.stopRunning() } } }

    func setVideoMode(_ video: Bool) {
        queue.async { [self] in
            guard isConfigured else { return }
            session.beginConfiguration()
            if video {
                session.removeOutput(frameOutput)
                session.sessionPreset = .high
                if session.canAddOutput(movieOutput) { session.addOutput(movieOutput) }
            } else {
                session.removeOutput(movieOutput)
                session.sessionPreset = .photo
                if session.canAddOutput(frameOutput) { session.addOutput(frameOutput) }
            }
            applyPortrait()
            session.commitConfiguration()
        }
    }

    /// The app runs in portrait only.
    private func applyPortrait() {
        for output in [photoOutput as AVCaptureOutput, movieOutput, frameOutput] {
            if let connection = output.connection(with: .video), connection.isVideoRotationAngleSupported(90) {
                connection.videoRotationAngle = 90
            }
        }
    }

    func setTorch(_ on: Bool) {
        queue.async { [self] in
            guard let device, device.hasTorch, (try? device.lockForConfiguration()) != nil else { return }
            device.torchMode = on ? .on : .off
            device.unlockForConfiguration()
        }
    }

    /// Focus and exposure at a point in device coordinates (0...1, from the preview layer).
    func focus(at point: CGPoint) {
        queue.async { [self] in
            guard let device, (try? device.lockForConfiguration()) != nil else { return }
            if device.isFocusPointOfInterestSupported { device.focusPointOfInterest = point; device.focusMode = .autoFocus }
            if device.isExposurePointOfInterestSupported { device.exposurePointOfInterest = point; device.exposureMode = .autoExpose }
            device.unlockForConfiguration()
        }
    }

    func capturePhoto() async throws -> UIImage {
        try await withCheckedThrowingContinuation { continuation in
            queue.async { [self] in
                guard photoContinuation == nil else { return continuation.resume(throwing: CameraError.captureFailed) }
                photoContinuation = continuation
                let settings = AVCapturePhotoSettings()
                settings.photoQualityPrioritization = .balanced
                photoOutput.capturePhoto(with: settings, delegate: self)
            }
        }
    }

    func startRecording() async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            queue.async { [self] in
                guard !movieOutput.isRecording else { return continuation.resume(throwing: CameraError.captureFailed) }
                movieContinuation = continuation
                let url = FileManager.default.temporaryDirectory.appending(path: "fixify-\(UUID().uuidString).mov")
                movieOutput.maxRecordedDuration = CMTime(seconds: 10, preferredTimescale: 600)
                movieOutput.startRecording(to: url, recordingDelegate: self)
            }
        }
    }

    func stopRecording() {
        queue.async { [self] in if movieOutput.isRecording { movieOutput.stopRecording() } }
    }
}

extension CameraSession: AVCapturePhotoCaptureDelegate {
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        queue.async { [self] in
            let continuation = photoContinuation
            photoContinuation = nil
            if let data = photo.fileDataRepresentation(), let image = UIImage(data: data) {
                continuation?.resume(returning: image)
            } else {
                continuation?.resume(throwing: error ?? CameraError.captureFailed)
            }
        }
    }
}

extension CameraSession: AVCaptureFileOutputRecordingDelegate {
    func fileOutput(_ output: AVCaptureFileOutput, didFinishRecordingTo outputFileURL: URL, from connections: [AVCaptureConnection], error: Error?) {
        queue.async { [self] in
            let continuation = movieContinuation
            movieContinuation = nil
            // Hitting maxRecordedDuration reports an error but the file is complete.
            let finished = (error as NSError?)?.userInfo[AVErrorRecordingSuccessfullyFinishedKey] as? Bool ?? (error == nil)
            if finished {
                continuation?.resume(returning: outputFileURL)
            } else {
                continuation?.resume(throwing: error ?? CameraError.captureFailed)
            }
        }
    }
}

extension CameraSession: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard liveTextEnabled, !scanning, Date().timeIntervalSince(lastTextScan) > 0.5,
              let buffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        scanning = true
        lastTextScan = Date()
        // The connection is rotated to portrait, so the buffer is already upright.
        let size = CGSize(width: CVPixelBufferGetWidth(buffer), height: CVPixelBufferGetHeight(buffer))
        let blocks = TextRecognizer.recognizeFast(pixelBuffer: buffer, orientation: .up)
        scanning = false
        onTextDetected?(blocks, size)
    }
}
