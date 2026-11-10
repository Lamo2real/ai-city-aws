// The live connection (web/src/lib/ws.ts): city events and VAIC's streamed replies over the API Gateway
// WebSocket. Reconnects on its own with jittered back-off, pings every 4 minutes so the connection stays
// listed, and reports when it is up or down. The token goes in the query string, as the $connect authorizer
// expects (wss only, so it is encrypted on the wire).
import Foundation

@MainActor
final class LiveConnection {
    var onEvent: (JSONValue) -> Void = { _ in }
    var onStatus: (LiveStatus) -> Void = { _ in }
    private(set) var status: LiveStatus = .connecting

    private let wsURL: String
    private let token: @Sendable (Bool) async throws -> String?
    private let session: URLSession
    private var task: URLSessionWebSocketTask?
    private var tries = 0
    private var stopped = false
    private var pingTimer: Timer?
    private var generation = 0

    init(wsURL: String, session: URLSession = .shared, token: @escaping @Sendable (Bool) async throws -> String?) {
        self.wsURL = wsURL
        self.session = session
        self.token = token
    }

    private func set(_ s: LiveStatus) {
        status = s
        onStatus(s)
    }

    /// Back-off: 1 s, 2 s, 4 s … up to 30 s, each scaled by 0.5–1.0 so reconnects spread out.
    nonisolated static func delay(tries: Int, jitter: Double) -> Double {
        min(30, pow(2, Double(tries))) * (0.5 + jitter / 2)
    }

    func start() {
        stopped = false
        generation += 1
        let gen = generation
        Task {
            let t: String?
            do { t = try await token(false) } catch { return self.retry(gen) }
            guard gen == self.generation, !self.stopped else { return }
            guard let t else { return self.set(.signedOut) }
            guard var c = URLComponents(string: wsURL) else { return }
            c.queryItems = [URLQueryItem(name: "token", value: t)]
            guard let url = c.url else { return }
            let task = session.webSocketTask(with: url)
            self.task = task
            task.resume()
            self.receive(task, gen)
            self.probe(task, gen)
        }
    }

    private func receive(_ task: URLSessionWebSocketTask, _ gen: Int) {
        task.receive { [weak self] result in
            Task { @MainActor in
                guard let self, gen == self.generation else { return }
                switch result {
                case .success(let message):
                    if self.status != .online { self.opened(task) }
                    let data: Data?
                    switch message {
                    case .string(let s): data = s.data(using: .utf8)
                    case .data(let d): data = d
                    @unknown default: data = nil
                    }
                    if let data, let e = JSONValue.parse(data), e["type"].string != "pong" { self.onEvent(e) }
                    self.receive(task, gen)
                case .failure:
                    self.closed(gen)
                }
            }
        }
    }

    /// A socket that opens quietly (no first frame) counts as online once a WebSocket ping comes back.
    private func probe(_ task: URLSessionWebSocketTask, _ gen: Int) {
        task.sendPing { [weak self] error in
            Task { @MainActor in
                guard let self, error == nil, gen == self.generation, self.status != .online else { return }
                self.opened(task)
            }
        }
    }

    private func opened(_ task: URLSessionWebSocketTask) {
        tries = 0
        set(.online)
        pingTimer?.invalidate()
        pingTimer = Timer.scheduledTimer(withTimeInterval: 240, repeats: true) { [weak task] _ in
            task?.send(.string(#"{"action":"ping"}"#)) { _ in }
        }
    }

    private func closed(_ gen: Int) {
        pingTimer?.invalidate()
        if stopped { return }
        set(.reconnecting)
        retry(gen)
    }

    private func retry(_ gen: Int) {
        guard !stopped else { return }
        let d = Self.delay(tries: tries, jitter: Double.random(in: 0...1))
        tries += 1
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(d))
            guard let self, gen == self.generation, !self.stopped else { return }
            self.start()
        }
    }

    /// Back in the foreground: reconnect now if the connection is down or waiting out a back-off.
    func resumeNow() {
        guard !stopped, status != .online else { return }
        tries = 0
        start()
    }

    func stop() {
        stopped = true
        generation += 1
        pingTimer?.invalidate()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
    }
}
