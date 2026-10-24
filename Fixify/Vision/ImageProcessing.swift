import UIKit
import Vision
import AVFoundation

/// Local, on-device image work. Nothing here leaves the phone.
enum ImageProcessing {
    /// Redraws the image upright (orientation .up) and caps its long edge.
    /// All coordinates in Fixify refer to this normalized image.
    static func normalized(_ image: UIImage, maxLongEdge: CGFloat) -> UIImage {
        let size = image.size
        let longEdge = max(size.width, size.height)
        let scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1
        let target = CGSize(width: (size.width * scale).rounded(), height: (size.height * scale).rounded())
        if scale == 1 && image.imageOrientation == .up { return image }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    static func jpeg(_ image: UIImage, quality: CGFloat) -> Data? {
        image.jpegData(compressionQuality: quality)
    }

    /// Pixel size of an upright image.
    static func pixelSize(_ image: UIImage) -> CGSize {
        CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
    }

    /// Extracts evenly spaced frames from a short video so they can be analyzed like photos.
    static func keyFrames(from url: URL, count: Int) async throws -> [UIImage] {
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration).seconds
        guard duration.isFinite, duration > 0 else { return [] }
        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.maximumSize = CGSize(width: 2048, height: 2048)
        generator.requestedTimeToleranceBefore = .init(seconds: 0.2, preferredTimescale: 600)
        generator.requestedTimeToleranceAfter = .init(seconds: 0.2, preferredTimescale: 600)
        var frames: [UIImage] = []
        for i in 0..<count {
            let t = duration * (Double(i) + 0.5) / Double(count)
            let (cg, _) = try await generator.image(at: CMTime(seconds: t, preferredTimescale: 600))
            frames.append(UIImage(cgImage: cg))
        }
        return frames
    }
}

/// On-device OCR with Apple Vision. Produces blocks with stable ids ("t1", "t2", …) and top-left normalized boxes.
enum TextRecognizer {
    static func recognize(in image: UIImage, fast: Bool = false) async -> [TextBlock] {
        guard let cg = image.cgImage else { return [] }
        // perform(_:) is synchronous; reading results afterwards avoids completion-handler edge cases.
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = fast ? .fast : .accurate
        request.usesLanguageCorrection = !fast
        request.automaticallyDetectsLanguage = true
        let handler = VNImageRequestHandler(cgImage: cg, orientation: .up)
        do {
            try handler.perform([request])
        } catch {
            return []
        }
        return blocks(from: request.results ?? [])
    }

    /// Synchronous variant for camera frames (already on a background queue).
    static func recognizeFast(pixelBuffer: CVPixelBuffer, orientation: CGImagePropertyOrientation) -> [TextBlock] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .fast
        request.usesLanguageCorrection = false
        request.minimumTextHeight = 0.02
        let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer, orientation: orientation)
        try? handler.perform([request])
        return blocks(from: request.results ?? [])
    }

    private static func blocks(from observations: [VNRecognizedTextObservation]) -> [TextBlock] {
        observations.enumerated().compactMap { index, observation in
            guard let candidate = observation.topCandidates(1).first,
                  !candidate.string.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
            return TextBlock(id: "t\(index + 1)",
                             text: candidate.string,
                             box: .fromVision(observation.boundingBox),
                             confidence: candidate.confidence)
        }
    }
}
