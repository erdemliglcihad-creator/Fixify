import Foundation
import UIKit
import ImageIO
import CryptoKit

/// Stores captured images on disk, named by SHA-256 of their JPEG data so duplicates share one file.
/// Files are written with complete file protection (unreadable while the device is locked).
final class ImageStore: @unchecked Sendable {
    static let shared = ImageStore()

    let directory: URL
    private let cache = NSCache<NSString, UIImage>()

    init(directory: URL? = nil) {
        let base = directory ?? URL.applicationSupportDirectory.appending(path: "Images", directoryHint: .isDirectory)
        self.directory = base
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        cache.countLimit = 60
    }

    func url(for fileName: String) -> URL { directory.appending(path: fileName) }

    /// Saves JPEG data and returns the file name. Existing identical content is reused.
    @discardableResult
    func save(jpeg data: Data) throws -> String {
        let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        let name = "\(hash).jpg"
        let target = url(for: name)
        if !FileManager.default.fileExists(atPath: target.path) {
            try data.write(to: target, options: [.atomic, .completeFileProtection])
        }
        return name
    }

    func data(for fileName: String) -> Data? { try? Data(contentsOf: url(for: fileName)) }

    func image(for fileName: String) -> UIImage? {
        if let cached = cache.object(forKey: fileName as NSString) { return cached }
        guard let image = UIImage(contentsOfFile: url(for: fileName).path) else { return nil }
        cache.setObject(image, forKey: fileName as NSString)
        return image
    }

    /// Memory-friendly thumbnail via ImageIO (does not decode the full image).
    func thumbnail(for fileName: String, maxPixel: CGFloat) -> UIImage? {
        let key = "\(fileName)#\(Int(maxPixel))" as NSString
        if let cached = cache.object(forKey: key) { return cached }
        guard let source = CGImageSourceCreateWithURL(url(for: fileName) as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixel,
        ]
        guard let cg = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let image = UIImage(cgImage: cg)
        cache.setObject(image, forKey: key)
        return image
    }

    func delete(_ fileName: String) {
        try? FileManager.default.removeItem(at: url(for: fileName))
        cache.removeAllObjects()
    }

    /// Removes files that no SessionImage references any more.
    func removeOrphans(keeping referenced: Set<String>) {
        guard let files = try? FileManager.default.contentsOfDirectory(atPath: directory.path) else { return }
        for file in files where !referenced.contains(file) {
            try? FileManager.default.removeItem(at: url(for: file))
        }
        cache.removeAllObjects()
    }

    func totalBytes() -> Int64 {
        guard let files = try? FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.fileSizeKey]) else { return 0 }
        return files.reduce(0) { $0 + Int64((try? $1.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0) }
    }
}
