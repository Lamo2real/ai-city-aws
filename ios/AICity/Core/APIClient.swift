// The owner-only HTTP API (backend/src/aic/lambdas/api.py) with the owner's ID token as a Bearer token.
// Errors become plain sentences with a hint, never codes — like web/src/lib/api.ts.
import Foundation

struct APIError: LocalizedError, Equatable {
    let message: String
    let status: Int
    let fix: String?
    var errorDescription: String? { fix.map { "\(message) \($0)" } ?? message }

    static let signedOut = APIError(message: "You were signed out.", status: 401, fix: "Sign in again.")
    static let offline = APIError(message: "No connection to AI City right now.", status: 0, fix: "Check your connection; we'll keep trying.")
}

final class APIClient: @unchecked Sendable {
    let baseURL: String
    private let http: HTTPTransport
    private let token: @Sendable (Bool) async throws -> String?

    init(baseURL: String, http: HTTPTransport = URLSessionTransport(), token: @escaping @Sendable (Bool) async throws -> String?) {
        self.baseURL = baseURL
        self.http = http
        self.token = token
    }

    @discardableResult
    func request(_ path: String, method: String = "GET", body: JSONValue? = nil) async throws -> JSONValue {
        let t: String?
        do { t = try await token(false) } catch { throw APIError.offline }
        guard let t else { throw APIError.signedOut }
        var (data, status) = try await send(path, method, body, t)
        if status == 401, let fresh = try? await token(true) {  // a token refused at the edge: try once more, fresh
            (data, status) = try await send(path, method, body, fresh)
        }
        let json = JSONValue.parse(data) ?? .object([:])
        guard (200..<300).contains(status) else {
            if status == 401 { throw APIError.signedOut }
            throw APIError(message: json["error"].string ?? "Something went wrong.", status: status, fix: json["fix"].string)
        }
        return json
    }

    private func send(_ path: String, _ method: String, _ body: JSONValue?, _ token: String) async throws -> (Data, Int) {
        guard let url = URL(string: baseURL + path) else { throw APIError(message: "Something went wrong.", status: 0, fix: nil) }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }
        do { return try await http.send(req) } catch { throw APIError.offline }
    }

    // MARK: What the owner can do (same routes as web/src/lib/actions.ts)

    func city() async throws -> JSONValue { try await request("/city") }
    func sendMessage(_ text: String, clientId: String) async throws {
        try await request("/messages", method: "POST", body: ["text": .string(text), "conversation": "main", "client_id": .string(clientId)])
    }
    func answer(question id: String, with answer: String) async throws {
        try await request("/questions/\(Self.seg(id))/answer", method: "POST", body: ["answer": .string(answer)])
    }
    func useDefault(question id: String) async throws {
        try await request("/questions/\(Self.seg(id))/default", method: "POST", body: [:])
    }
    func decide(approval id: String, approved: Bool) async throws {
        try await request("/approvals/\(Self.seg(id))", method: "POST", body: ["approved": .bool(approved)])
    }
    func setPaused(_ paused: Bool) async throws { try await request(paused ? "/city/pause" : "/city/resume", method: "POST") }
    func instruct(agent: String, text: String) async throws {
        try await request("/city/instruct", method: "POST", body: ["agent_id": .string(agent), "text": .string(text)])
    }
    func tickets(done: Bool) async throws -> JSONValue { try await request(done ? "/tickets?status=done" : "/tickets") }
    func ticket(_ id: String) async throws -> JSONValue { try await request("/tickets/\(Self.seg(id))") }
    func costs() async throws -> JSONValue { try await request("/costs") }
    func settings() async throws -> JSONValue { try await request("/settings")["settings"] }
    func saveSettings(_ patch: JSONValue) async throws -> JSONValue {
        try await request("/settings", method: "PUT", body: patch)["settings"]
    }

    /// IDs come from the server; keep them to one safe path segment anyway.
    static func seg(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_"))) ?? ""
    }

    /// The one public route: re-sends the owner's first-login email (same answer for any email).
    static func requestFirstLoginEmail(apiURL: String, email: String, http: HTTPTransport = URLSessionTransport()) async throws {
        guard let url = URL(string: apiURL + "/auth/first-login-email") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email.trimmingCharacters(in: .whitespaces).lowercased()])
        let (_, status) = try await http.send(req)
        if !(200..<300).contains(status) { throw APIError(message: "Not sent.", status: status, fix: nil) }
    }
}
