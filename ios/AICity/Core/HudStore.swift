// One store for the whole app, like web/src/lib/store.ts: the city (via the ported reducer), AIC's chat,
// the connection status and the owner's outbox. Every screen reads from here; the WebSocket and API write.
import Foundation
import Observation

struct ChatLine: Codable, Equatable, Identifiable, Sendable {
    enum Who: String, Codable { case owner, ace }
    /// Owner lines: queued (not sent yet), sent, or failed. AIC lines: streaming until done.
    enum State: String, Codable { case queued, sent, failed, streaming, done }
    var id: String
    var who: Who
    var text: String
    var state: State
    var at: Double
    var steps: [String]?
    var tookMs: Double?
}

struct AceTurn: Equatable, Sendable {
    var started: Double
    var steps: [String]
}

enum Presence: String, Sendable { case idle, listening, thinking, speaking, waiting }
enum LiveStatus: String, Sendable { case connecting, online, reconnecting, signedOut }

/// Where the chat is kept between launches: a file in Application Support with complete file protection.
protocol ChatArchive: Sendable {
    func load() -> [ChatLine]
    func save(_ lines: [ChatLine])
}

struct FileChatArchive: ChatArchive {
    var url: URL = {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("chat.json")
    }()
    func load() -> [ChatLine] {
        (try? Data(contentsOf: url)).flatMap { try? JSONDecoder().decode([ChatLine].self, from: $0) }.map { Array($0.suffix(60)) } ?? []
    }
    func save(_ lines: [ChatLine]) {
        guard let data = try? JSONEncoder().encode(Array(lines.suffix(60))) else { return }
        try? data.write(to: url, options: [.atomic, .completeFileProtection])
    }
}

struct NoChatArchive: ChatArchive {
    func load() -> [ChatLine] { [] }
    func save(_ lines: [ChatLine]) {}
}

@MainActor
@Observable
final class HudStore {
    var city = CityState()
    var loaded = false
    var loadError: String?
    var chat: [ChatLine] { didSet { archive.save(chat) } }
    var live: LiveStatus = .connecting
    var presence: Presence = .idle
    var turn: AceTurn?

    @ObservationIgnored private let archive: ChatArchive
    @ObservationIgnored private var during: [JSONValue]?
    @ObservationIgnored var clock: () -> Double = nowMs
    /// The City scene (the web HUD's own, in a web view) keeps its own animated copy: it gets the raw
    /// snapshot plus the events that arrived while it loaded, then every event.
    @ObservationIgnored var onSceneSnapshot: (JSONValue, [JSONValue]) -> Void = { _, _ in }
    @ObservationIgnored var onSceneEvent: (JSONValue) -> Void = { _ in }
    @ObservationIgnored private(set) var lastSnapshot: JSONValue?
    /// Called once with AIC's whole reply when it is done (to read it aloud).
    @ObservationIgnored var onReplyDone: (String) -> Void = { _ in }

    init(archive: ChatArchive = FileChatArchive()) {
        self.archive = archive
        chat = archive.load()
    }

    var waitingCount: Int { city.questions.count + city.approvals.count }

    /// Events that arrive while a snapshot is loading are replayed on top of it, so none are lost.
    func beginSnapshot() { during = [] }

    func snapshot(_ snap: JSONValue) {
        var c = City.applySnapshot(city, snap, now: clock())
        let replay = during ?? []
        for e in replay { c = City.reduce(c, e, now: clock()) }
        during = nil
        lastSnapshot = snap
        onSceneSnapshot(snap, replay)
        city = c
        loaded = true
        loadError = nil
    }

    func event(_ e: JSONValue) {
        let type = e["type"].string ?? ""
        if type == "ace.reply" { return aceReply(text: e["text"].string ?? "", done: e["done"].bool ?? false) }
        if type == "activity", e["id"].string == "ace" { aceStep(e["activity"].string ?? "", e["detail"].string) }
        during?.append(e)
        city = City.reduce(city, e, now: clock())
        if during == nil { onSceneEvent(e) }
    }

    /// Starts AIC's turn: the status row shows from now until its first words.
    func beginTurn() { turn = AceTurn(started: clock(), steps: [Steps.first]) }

    private func aceStep(_ activity: String, _ detail: String?) {
        guard let words = Steps.words(activity: activity, detail: detail), var t = turn, t.steps.last != words else { return }
        t.steps.append(words)
        turn = t
    }

    private func aceReply(text: String, done: Bool) {
        var c = chat
        let last = c.last
        // The final reply arrives twice (straight from AIC, and through the event bus as a safety net).
        if done, let last, last.who == .ace, last.state == .done, last.text == text { return }
        if let last, last.who == .ace, last.state == .streaming {
            var l = last
            l.text = done ? text : last.text + text
            l.state = done ? .done : .streaming
            l.steps = turn?.steps ?? last.steps
            c[c.count - 1] = l
        } else {
            c.append(ChatLine(id: "a-\(Int(clock()))-\(c.count)", who: .ace, text: text, state: done ? .done : .streaming, at: clock(),
                              steps: turn?.steps, tookMs: turn.map { clock() - $0.started }))
        }
        chat = c
        presence = done ? .speaking : .thinking
        if done {
            turn = nil
            onReplyDone(c.last?.text ?? text)
        }
    }

    func patchLine(_ id: String, state: ChatLine.State) {
        guard let i = chat.firstIndex(where: { $0.id == id }) else { return }
        chat[i].state = state
    }

    var unsent: [ChatLine] { chat.filter { $0.who == .owner && ($0.state == .queued || $0.state == .failed) } }

    /// Right after the owner sends, AIC's status row shows until its first words.
    var waitingForAic: Bool {
        guard presence == .thinking, let l = chat.last else { return false }
        return l.who == .owner && l.state != .failed
    }
}
