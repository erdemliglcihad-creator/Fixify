import Foundation

/// Talks to the Fixify proxy (server/). The Anthropic key stays on the server; the app only holds an app token.
struct ProxyAnalysisService: AnalysisService {
    let baseURL: URL
    let token: String
    var session: URLSession = .shared

    struct Health: Decodable, Sendable {
        var ok: Bool
        var configured: Bool
        var model: String?
    }

    func analyze(_ input: AnalysisInput) async throws -> AnalysisOutput {
        var request = URLRequest(url: baseURL.appending(path: "v1/analyze"))
        request.httpMethod = "POST"
        request.timeoutInterval = 150
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONEncoder().encode(RequestBody(input))

        let (data, response) = try await send(request)
        guard let http = response as? HTTPURLResponse else { throw AnalysisFailure.unreachable }

        guard http.statusCode == 200 else {
            let message = (try? JSONDecoder().decode(ErrorBody.self, from: data))?.error
            switch (http.statusCode, message?.code ?? "") {
            case (401, _): throw AnalysisFailure.unauthorized
            case (429, _): throw AnalysisFailure.rateLimited(retryAfter: http.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init))
            case (_, "refused"): throw AnalysisFailure.refused
            case (_, "upstream_timeout"): throw AnalysisFailure.timeout
            case (_, "invalid_model_output"): throw AnalysisFailure.invalidResponse(message?.message ?? "")
            default: throw AnalysisFailure.server(message?.message ?? String(localized: "The server reported an error (\(http.statusCode))."))
            }
        }

        let body: ResponseBody
        do {
            body = try JSONDecoder().decode(ResponseBody.self, from: data)
        } catch {
            throw AnalysisFailure.invalidResponse(String(describing: error).prefix(140).description)
        }
        let analysis = try AnalysisValidator.validate(body.analysis, imageCount: input.images.count)
        return AnalysisOutput(analysis: analysis, provider: body.model)
    }

    /// Checks reachability (public /health) and the token (/v1/ping).
    func check() async throws -> Health {
        var health = URLRequest(url: baseURL.appending(path: "health"))
        health.timeoutInterval = 8
        let (_, healthResponse) = try await send(health)
        guard (healthResponse as? HTTPURLResponse)?.statusCode == 200 else { throw AnalysisFailure.unreachable }

        var ping = URLRequest(url: baseURL.appending(path: "v1/ping"))
        ping.timeoutInterval = 8
        ping.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let (data, response) = try await send(ping)
        if (response as? HTTPURLResponse)?.statusCode == 401 { throw AnalysisFailure.unauthorized }
        return try JSONDecoder().decode(Health.self, from: data)
    }

    private func send(_ request: URLRequest) async throws -> (Data, URLResponse) {
        do {
            return try await session.data(for: request)
        } catch let error as URLError {
            switch error.code {
            case .cancelled: throw CancellationError()
            case .notConnectedToInternet, .dataNotAllowed, .networkConnectionLost: throw AnalysisFailure.offline
            case .timedOut: throw AnalysisFailure.timeout
            default: throw AnalysisFailure.unreachable
            }
        }
    }

    // MARK: Wire format (server/src/app.mjs RequestSchema)

    private struct RequestBody: Encodable {
        struct Image: Encodable {
            var label: String?
            var mediaType = "image/jpeg"
            var data: String
            var ocr: [OCR]
        }
        struct OCR: Encodable {
            var id: String
            var text: String
            var box: NormalizedRect
        }
        struct HistoryItem: Encodable { var kind: String; var text: String }

        var mode: String
        var locale: String
        var description: String
        var categoryHint: String?
        var images: [Image]
        var history: [HistoryItem]
        var answers: [AnsweredQuestion]
        var feedback: String?
        var previousAnalysis: ProblemAnalysis?

        init(_ input: AnalysisInput) {
            mode = input.mode.rawValue
            locale = input.locale
            description = input.description
            categoryHint = input.category?.rawValue
            images = input.images.map { image in
                Image(label: image.label,
                      data: image.jpeg.base64EncodedString(),
                      ocr: image.blocks.prefix(150).map { OCR(id: $0.id, text: String($0.text.prefix(500)), box: $0.box) })
            }
            history = input.history.suffix(60).map { HistoryItem(kind: $0.kind, text: String($0.text.prefix(1000))) }
            answers = input.answers
            feedback = input.feedback
            previousAnalysis = input.previous
        }
    }

    private struct ResponseBody: Decodable {
        var analysis: ProblemAnalysis
        var model: String
    }

    private struct ErrorBody: Decodable {
        struct Detail: Decodable { var code: String; var message: String }
        var error: Detail
    }
}
