// Fakes only: nothing in the tests reaches AWS.
import Foundation
@testable import AICity

/// Answers requests from a handler and records every request it saw.
final class FakeHTTP: HTTPTransport, @unchecked Sendable {
    struct Seen { let method: String; let url: String; let headers: [String: String]; let body: JSONValue; let rawBody: Data? }
    private let lock = NSLock()
    private var _seen: [Seen] = []
    var seen: [Seen] { lock.withLock { _seen } }
    let handler: (Seen) throws -> (JSONValue, Int)
    /// The ETag a PUT answers with (the knowledge uploads).
    var etag: (Seen) -> String? = { _ in nil }

    init(_ handler: @escaping (Seen) throws -> (JSONValue, Int)) { self.handler = handler }

    func send(_ request: URLRequest) async throws -> (Data, Int) {
        let (data, status, _) = try await sendWithHeaders(request)
        return (data, status)
    }

    func sendWithHeaders(_ request: URLRequest) async throws -> (Data, Int, [String: String]) {
        let body = request.httpBody.flatMap(JSONValue.parse) ?? .null
        let s = Seen(method: request.httpMethod ?? "GET", url: request.url?.absoluteString ?? "", headers: request.allHTTPHeaderFields ?? [:], body: body,
                     rawBody: request.httpBody)
        lock.withLock { _seen.append(s) }
        let (json, status) = try handler(s)
        return (try JSONEncoder().encode(json), status, etag(s).map { ["ETag": $0] } ?? [:])
    }
}

let testConfig = AppConfig(region: "eu-north-1", apiUrl: "https://api.example.test", wsUrl: "wss://ws.example.test",
                           clientId: "client123", userPoolId: "eu-north-1_TestPool1", identityPoolId: nil, pollyVoice: nil)
