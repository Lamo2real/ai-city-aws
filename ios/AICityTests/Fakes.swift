// Fakes only: nothing in the tests reaches AWS.
import Foundation
@testable import AICity

/// Answers requests from a handler and records every request it saw.
final class FakeHTTP: HTTPTransport, @unchecked Sendable {
    struct Seen { let method: String; let url: String; let headers: [String: String]; let body: JSONValue }
    private let lock = NSLock()
    private var _seen: [Seen] = []
    var seen: [Seen] { lock.withLock { _seen } }
    let handler: (Seen) throws -> (JSONValue, Int)

    init(_ handler: @escaping (Seen) throws -> (JSONValue, Int)) { self.handler = handler }

    func send(_ request: URLRequest) async throws -> (Data, Int) {
        let body = request.httpBody.flatMap(JSONValue.parse) ?? .null
        let s = Seen(method: request.httpMethod ?? "GET", url: request.url?.absoluteString ?? "", headers: request.allHTTPHeaderFields ?? [:], body: body)
        lock.withLock { _seen.append(s) }
        let (json, status) = try handler(s)
        return (try JSONEncoder().encode(json), status)
    }
}

let testConfig = AppConfig(region: "eu-north-1", apiUrl: "https://api.example.test", wsUrl: "wss://ws.example.test",
                           clientId: "client123", userPoolId: "eu-north-1_TestPool1", identityPoolId: nil, pollyVoice: nil)
