// One tiny seam for every network call, so tests use fakes and never reach AWS.
import Foundation

protocol HTTPTransport: Sendable {
    func send(_ request: URLRequest) async throws -> (Data, Int)
    /// The same, with the response headers (the knowledge uploads need the ETag of each part).
    func sendWithHeaders(_ request: URLRequest) async throws -> (Data, Int, [String: String])
}

extension HTTPTransport {
    func sendWithHeaders(_ request: URLRequest) async throws -> (Data, Int, [String: String]) {
        let (data, status) = try await send(request)
        return (data, status, [:])
    }
}

struct URLSessionTransport: HTTPTransport {
    let session: URLSession
    init(session: URLSession = .shared) { self.session = session }
    func send(_ request: URLRequest) async throws -> (Data, Int) {
        let (data, response) = try await session.data(for: request)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }
    func sendWithHeaders(_ request: URLRequest) async throws -> (Data, Int, [String: String]) {
        let (data, response) = try await session.data(for: request)
        let http = response as? HTTPURLResponse
        var headers: [String: String] = [:]
        for (k, v) in http?.allHeaderFields ?? [:] { if let k = k as? String, let v = v as? String { headers[k] = v } }
        return (data, http?.statusCode ?? 0, headers)
    }
}
