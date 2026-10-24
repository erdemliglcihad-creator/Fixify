import Foundation
import SwiftData
import UIKit

/// An image the user captured or imported, before it is stored.
struct CapturedImage: Identifiable, Sendable {
    let id = UUID()
    var image: UIImage
    var source: ImageSource
}

/// All writes to sessions go through here so image files and records stay consistent.
@MainActor
final class SessionStore {
    let context: ModelContext
    let images: ImageStore

    init(context: ModelContext, images: ImageStore = .shared) {
        self.context = context
        self.images = images
    }

    /// Creates a session from captures: normalizes, stores and OCRs each image locally.
    func createSession(captures: [CapturedImage], description: String, category: ProblemCategory?) async throws -> FixSession {
        let placeholder = description.trimmingCharacters(in: .whitespacesAndNewlines)
        let title = placeholder.isEmpty
            ? String(localized: "New problem")
            : String(placeholder.prefix(48))
        let session = FixSession(title: title, description: description, category: category)
        context.insert(session)
        try await addImages(captures, to: session, logAs: .captured)
        if session.images.isEmpty {
            session.log(.captured, String(localized: "Problem described without a photo"))
        }
        session.refreshSearchText()
        try context.save()
        return session
    }

    /// Stores images for a session. OCR runs on-device; returns the new records.
    @discardableResult
    func addImages(_ captures: [CapturedImage], to session: FixSession, logAs kind: EventKind = .photoAdded) async throws -> [SessionImage] {
        var added: [SessionImage] = []
        var nextIndex = (session.images.map(\.orderIndex).max() ?? -1) + 1
        for capture in captures {
            let source = capture.image
            let (fileName, size, blocks) = try await Task.detached(priority: .userInitiated) {
                let upright = ImageProcessing.normalized(source, maxLongEdge: 2048)
                guard let data = ImageProcessing.jpeg(upright, quality: 0.85) else { throw StoreError.encodingFailed }
                let name = try ImageStore.shared.save(jpeg: data)
                let blocks = await TextRecognizer.recognize(in: upright)
                return (name, ImageProcessing.pixelSize(upright), blocks)
            }.value
            let record = SessionImage(fileName: fileName, pixelSize: size, orderIndex: nextIndex, source: capture.source, blocks: blocks)
            nextIndex += 1
            session.images.append(record)
            added.append(record)
            let detail = blocks.isEmpty
                ? String(localized: "No text found on the image")
                : String(localized: "\(blocks.count) text lines recognized on device")
            session.log(kind, detail)
        }
        session.refreshSearchText()
        try context.save()
        return added
    }

    func delete(_ session: FixSession) {
        let files = Set(session.images.map(\.fileName))
        context.delete(session)
        try? context.save()
        removeUnreferenced(files)
    }

    /// Removes the stored image files of a session but keeps its text, steps and history.
    func deleteImages(of session: FixSession) {
        let files = Set(session.images.map(\.fileName))
        for image in session.images { context.delete(image) }
        session.log(.note, String(localized: "Photos deleted to save space"))
        try? context.save()
        removeUnreferenced(files)
    }

    func deleteEverything() throws {
        try context.delete(model: FixSession.self)
        try context.delete(model: SessionImage.self)
        try context.delete(model: AnalysisRevision.self)
        try context.delete(model: SessionEvent.self)
        try context.save()
        images.removeOrphans(keeping: [])
    }

    /// Applies the "delete photos of solved sessions after N days" setting.
    func applyRetention(days: Int) {
        guard days > 0 else { return }
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: .now) ?? .now
        let solved = SessionStatus.solved.rawValue
        let descriptor = FetchDescriptor<FixSession>(predicate: #Predicate { $0.statusRaw == solved && $0.updatedAt < cutoff })
        for session in (try? context.fetch(descriptor)) ?? [] where !session.images.isEmpty {
            deleteImages(of: session)
        }
    }

    /// Deletes files no record references any more (identical images can be shared between sessions).
    private func removeUnreferenced(_ candidates: Set<String>) {
        let referenced = Set(((try? context.fetch(FetchDescriptor<SessionImage>())) ?? []).map(\.fileName))
        for file in candidates.subtracting(referenced) { images.delete(file) }
    }

    enum StoreError: LocalizedError {
        case encodingFailed
        var errorDescription: String? { String(localized: "The image could not be saved.") }
    }
}
