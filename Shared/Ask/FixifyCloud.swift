import Foundation
import UIKit

/// Client for Fixify Cloud (worker/), the free server everyone can use with a daily limit.
/// Used by FixVoice and by screen questions.
struct FixifyCloud {
    static let baseURL = URL(string: "https://fixify-cloud.fixify-cloud.workers.dev")!

    struct Turn: Encodable, Sendable {
        struct Image: Encodable, Sendable {
            var mediaType = "image/jpeg"
            var data: String
        }
        var role: String
        var text: String
        var image: Image?
    }

    enum Mode: String, Sendable {
        case voice, screen
    }

    enum Failure: LocalizedError {
        case uploadLimit, busy, offline, server(String)

        var errorDescription: String? {
            switch self {
            case .uploadLimit: String(localized: "Today's photo uploads are used up. They renew tomorrow.")
            case .busy: String(localized: "Fixify is very busy right now. Try again in a minute.")
            case .offline: String(localized: "No internet connection.")
            case let .server(message): message
            }
        }
    }

    var session: URLSession = .shared

    /// One short answer. Only an image in the last turn is sent.
    func reply(turns: [Turn], mode: Mode, context: String? = nil) async throws -> String {
        struct Body: Encodable {
            var locale: String
            var mode: String
            var context: String?
            var messages: [Turn]
        }
        struct Reply: Decodable { var reply: String }
        let body = Body(locale: AppGroup.locale, mode: mode.rawValue, context: context, messages: Array(turns.suffix(12)))
        let data = try await post("v1/chat", json: try JSONEncoder().encode(body), timeout: 60)
        let text = try JSONDecoder().decode(Reply.self, from: data).reply.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { throw Failure.server(String(localized: "Fixify could not answer. Try again.")) }
        return text
    }

    /// Speech to text (Whisper on the server). Empty when nothing understandable was said.
    func transcribe(wav: Data) async throws -> String {
        struct Body: Encodable { var locale: String; var mediaType = "audio/wav"; var data: String }
        struct Result: Decodable { var text: String }
        let body = Body(locale: AppGroup.locale, data: wav.base64EncodedString())
        let data = try await post("v1/transcribe", json: try JSONEncoder().encode(body), timeout: 30)
        return try JSONDecoder().decode(Result.self, from: data).text.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Uploads left today, for the ring in the FixVoice rail.
    func quota() async -> (left: Int, daily: Int)? {
        struct Ping: Decodable { var uploadsLeft: Int?; var uploadsDaily: Int? }
        var request = URLRequest(url: Self.baseURL.appendingPathComponent("v1/ping"))
        request.timeoutInterval = 8
        request.setValue(AppGroup.deviceID, forHTTPHeaderField: "x-fixify-device")
        guard let (data, _) = try? await session.data(for: request),
              let ping = try? JSONDecoder().decode(Ping.self, from: data),
              let left = ping.uploadsLeft, let daily = ping.uploadsDaily
        else { return nil }
        return (left, daily)
    }

    /// Downscales a screenshot or frame to keep uploads small (long side 1280 px, JPEG).
    static func encodeImage(_ data: Data) -> Turn.Image? {
        guard let image = UIImage(data: data) else { return nil }
        let longSide = max(image.size.width * image.scale, image.size.height * image.scale)
        let factor = min(1, 1280 / max(longSide, 1))
        let size = CGSize(width: image.size.width * image.scale * factor, height: image.size.height * image.scale * factor)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
        guard let jpeg = resized.jpegData(compressionQuality: 0.72) else { return nil }
        return Turn.Image(data: jpeg.base64EncodedString())
    }

    private func post(_ path: String, json: Data, timeout: TimeInterval) async throws -> Data {
        var request = URLRequest(url: Self.baseURL.appendingPathComponent(path))
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(AppGroup.deviceID, forHTTPHeaderField: "x-fixify-device")
        request.httpBody = json

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError where error.code == .cancelled {
            throw CancellationError()
        } catch {
            throw Failure.offline
        }
        let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
        if statusCode == 200 { return data }

        struct ErrorBody: Decodable {
            struct Detail: Decodable { var code: String?; var message: String? }
            var error: Detail?
        }
        let detail = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
        switch detail?.code ?? "" {
        case "upload_limit": throw Failure.uploadLimit
        case "upstream_rate_limited", "message_limit", "vision_limit": throw Failure.busy
        default: throw Failure.server(detail?.message ?? String(localized: "The server reported an error (\(statusCode))."))
        }
    }
}
