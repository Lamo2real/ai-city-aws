// One store for the whole app, like web/src/lib/store.ts: the city (via the ported reducer), VAIC's chat,
// the connection status and the owner's outbox. Every screen reads from here; the WebSocket and API write.
import Foundation
import Observation

struct ChatLine: Codable, Equatable, Identifiable, Sendable {
    enum Who: String, Codable { case owner, vaic }
    /// Owner lines: queued (not sent yet), sent, or failed. VAIC lines: streaming until done.
    enum State: String, Codable { case queued, sent, failed, streaming, done }
    var id: String
    var who: Who
    var text: String
    var state: State
    var at: Double
    var steps: [String]?
    var tookMs: Double?
    /// VAIC lines: files VAIC put in the chat (show_files), each drawn with a preview and Download.
    var files: [ChatFile]?
    /// A heading over the files ("References for this build", decision 154).
    var filesLabel: String?
    /// Owner lines: the owner pressed Stop on VAIC's answer (decision 183), and what VAIC had already done by then.
    var stopped: Bool?
    var stoppedSteps: [String]?
    /// VAIC had already handed work to the team: Stop does not undo that (the job's own Stop does).
    var handedOn: Bool?
}

struct VaicTurn: Equatable, Sendable {
    var started: Double
    var steps: [String]
    /// Files VAIC showed in this turn before its reply line existed.
    var files: [ChatFile] = []
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
    var turn: VaicTurn?
    /// The Chief of Staff on Needs you (Core/ChiefOfStaff.swift).
    var chief = ChiefState()

    @ObservationIgnored private let archive: ChatArchive
    @ObservationIgnored private var recentlyClosed: [String: DecidedItem] = [:]
    @ObservationIgnored private var during: [JSONValue]?
    /// Messages whose answer the owner stopped ("owner-<line id>"): anything still in flight for them is dropped.
    @ObservationIgnored private var stoppedIds: Set<String> = []
    @ObservationIgnored var clock: () -> Double = nowMs
    /// The City scene (the web HUD's own, in a web view) keeps its own animated copy: it gets the raw
    /// snapshot plus the events that arrived while it loaded, then every event.
    @ObservationIgnored var onSceneSnapshot: (JSONValue, [JSONValue]) -> Void = { _, _ in }
    @ObservationIgnored var onSceneEvent: (JSONValue) -> Void = { _ in }
    @ObservationIgnored private(set) var lastSnapshot: JSONValue?
    /// Called once with VAIC's whole reply when it is done (to read it aloud).
    @ObservationIgnored var onReplyDone: (String) -> Void = { _ in }
    /// `hud.action` events: VAIC changing the theme or the open page on the owner's devices (decision 143).
    @ObservationIgnored var onHudAction: (JSONValue) -> Void = { _ in }
    /// `knowledge.updated` events, for the files attached to the message being written.
    @ObservationIgnored var onKnowledgeUpdated: (JSONValue) -> Void = { _ in }

    init(archive: ChatArchive = FileChatArchive()) {
        self.archive = archive
        chat = archive.load()
    }

    /// What still waits for the owner: not what the Chief of Staff already decided.
    var openQuestions: [Question] { city.questions.values.filter { !$0.decidedByChief }.sorted { $0.createdAt < $1.createdAt } }
    var openApprovals: [Approval] { city.approvals.values.filter { !$0.decidedByChief }.sorted { $0.id < $1.id } }
    var waitingCount: Int { openQuestions.count + openApprovals.count }

    // MARK: The Chief of Staff

    func chiefLoaded(_ r: JSONValue) {
        let decided = r["decided"].array.compactMap { DecidedItem(json: $0) }
        let ids = Set(decided.map(\.id))
        var needsOwner: [String: String] = [:]
        for n in r["needs_owner"].array {
            if let id = n["id"].string, let why = n["why"].string, !why.isEmpty { needsOwner[id] = why }
        }
        chief = ChiefState(status: .ready, enabled: r["enabled"].bool == true, saving: false,
                           decided: ChiefState.newestFirst(decided + chief.decided.filter { !ids.contains($0.id) }),
                           needsOwner: needsOwner)
        for id in ids { dropOpen(id) }
    }

    /// `steward.decided`: the item leaves the open list and goes on top of "Decided for you"; one it could not do
    /// (no choice, a `needs_owner_reason`) stays open with the reason.
    func stewardDecided(_ e: JSONValue) {
        guard let id = e["id"].string, !id.isEmpty else { return }
        let choice = e["choice"].string ?? e["decision"].string ?? ""
        if choice.isEmpty, let why = e["needs_owner_reason"].string, !why.isEmpty {
            chief.needsOwner[id] = why
            return
        }
        let at = e["at"].string ?? ISO8601DateFormatter().string(from: Date(timeIntervalSince1970: clock() / 1000))
        var known = describe(id, at: at) ?? recentlyClosed[id]
        known?.at = at
        guard let d = DecidedItem(json: e, fallback: known) else { return }
        chief.needsOwner[id] = nil
        chief.decided = [d] + chief.decided.filter { $0.id != id }
        if chief.status != .ready { chief.status = .ready; chief.enabled = true }
        dropOpen(id)
    }

    /// What the open item was about, so a decision that arrives live still says it.
    private func describe(_ id: String, at: String) -> DecidedItem? {
        if let q = city.questions[id] {
            let dept = city.agents[q.askedBy].map { City.deptOf($0) } ?? ""
            return DecidedItem(id: id, kind: "question", title: q.text, at: at, department: dept == "HQ" ? "" : dept)
        }
        if let a = city.approvals[id] {
            let dept = a.department ?? city.agents[a.agent].map { City.deptOf($0) } ?? ""
            return DecidedItem(id: id, kind: "approval", title: a.title ?? a.action, at: at, department: dept == "HQ" ? "" : dept)
        }
        return nil
    }

    private func dropOpen(_ id: String) {
        guard city.questions[id] != nil || city.approvals[id] != nil else { return }
        city.questions[id] = nil
        city.approvals[id] = nil
    }

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
        // A project's chat ("app-…") is not VAIC's main chat (the web HUD filters the same way).
        if type == "vaic.reply" || type == "vaic.question", (e["conversation"].string ?? "").hasPrefix("app-") { return }
        if type == "vaic.stopped" {
            guard (e["conversation"].string ?? "main") == "main", let id = e["message_id"].string else { return }
            let tools = e["tools"].array.map { (activity: $0["activity"].string ?? "", detail: $0["detail"].string) }
            return stopTurn(String(id.dropFirst(id.hasPrefix("owner-") ? 6 : 0)), tools: tools)
        }
        if type == "vaic.reply" || type == "vaic.files", let id = e["message_id"].string, stoppedIds.contains(id) {
            return  // the owner stopped this answer: a late piece of it never shows
        }
        if type == "vaic.reply" { return vaicReply(text: e["text"].string ?? "", done: e["done"].bool ?? false) }
        if type == "knowledge.updated" { return onKnowledgeUpdated(e) }
        if type == "hud.action" { return onHudAction(e) }
        if type == "vaic.files" {
            guard (e["conversation"].string ?? "main") == "main" else { return }
            let cards = e["files"].array.compactMap(ChatFile.init(json:))
            if let label = e["label"].string, !label.isEmpty, !cards.isEmpty {  // the references a build uses: own line
                chat.append(ChatLine(id: "a-files-\(Int(clock()))-\(chat.count)", who: .vaic, text: "", state: .done, at: clock(),
                                     files: cards, filesLabel: label))
                return
            }
            return vaicFiles(cards)
        }
        if type == "steward.decided" { return stewardDecided(e) }
        // The backend answers first, then says `steward.decided`: remember what a closing item was about.
        if ["question.answered", "approval.decided", "question.withdrawn", "approval.withdrawn"].contains(type),
           let id = e["id"].string, let d = describe(id, at: "") {
            if recentlyClosed.count >= 50 { recentlyClosed.removeAll() }
            recentlyClosed[id] = d
        }
        if type == "activity", e["id"].string == "vaic" { vaicStep(e["activity"].string ?? "", e["detail"].string) }
        during?.append(e)
        city = City.reduce(city, e, now: clock())
        if during == nil { onSceneEvent(e) }
    }

    /// The owner's message VAIC is still working on (thinking or writing), if any: what Stop would drop.
    var busyLine: ChatLine? {
        guard turn != nil, let i = chat.lastIndex(where: { $0.who == .owner }) else { return nil }
        let line = chat[i]
        if line.stopped == true { return nil }
        return chat[(i + 1)...].contains { $0.who == .vaic && $0.state == .done } ? nil : line
    }

    /// Stop (decision 183): the owner's line stays, marked stopped; VAIC's half-written answer goes; the turn ends.
    /// Also run when VAIC confirms it dropped the turn (`vaic.stopped`), with the tools it had already called.
    func stopTurn(_ lineId: String, tools: [(activity: String, detail: String?)] = []) {
        stoppedIds.insert("owner-\(lineId)")
        guard let i = chat.firstIndex(where: { $0.id == lineId && $0.who == .owner }) else { return }
        let wasCurrent = busyLine?.id == lineId  // a late confirmation must not end a newer turn
        var steps: [String] = []
        for t in tools { if let w = Steps.words(activity: t.activity, detail: t.detail), !steps.contains(w) { steps.append(w) } }
        let handedOn = tools.contains { $0.activity == "delegating" || ($0.detail ?? "").contains("delegate_to_orchestrator") }
        // Only VAIC's half-written answer to this message goes, never a reply to a message sent after it.
        let end = chat[(i + 1)...].firstIndex { $0.who == .owner } ?? chat.count
        var c = chat
        c[i].stopped = true
        if !steps.isEmpty { c[i].stoppedSteps = steps }
        if handedOn { c[i].handedOn = true }
        c = c.enumerated().filter { j, l in !(j > i && j < end && l.who == .vaic && l.state == .streaming) }.map(\.element)
        chat = c
        if wasCurrent {
            turn = nil
            if presence != .listening { presence = .idle }
        }
    }

    /// "Edit": a stopped message leaves the chat; its words go back in the box.
    func removeLine(_ id: String) { chat.removeAll { $0.id == id } }

    /// Starts VAIC's turn: the status row shows from now until its first words.
    func beginTurn() { turn = VaicTurn(started: clock(), steps: [Steps.first]) }

    private func vaicStep(_ activity: String, _ detail: String?) {
        guard let words = Steps.words(activity: activity, detail: detail), var t = turn, t.steps.last != words else { return }
        t.steps.append(words)
        turn = t
    }

    /// Files VAIC shows (show_files, docs/FILES.md §8): on its reply to this turn, or held for that reply until its
    /// first words; with no turn on this phone (asked on another device), as VAIC's own line.
    private func vaicFiles(_ cards: [ChatFile]) {
        guard !cards.isEmpty else { return }
        func merge(_ have: [ChatFile]) -> [ChatFile] { have + cards.filter { c in !have.contains { $0.id == c.id } } }
        let i = chat.lastIndex { $0.who == .vaic }
        if var t = turn {
            if let i, chat[i].at >= t.started {
                chat[i].files = merge(chat[i].files ?? [])
            } else {
                t.files = merge(t.files)
                turn = t
            }
            return
        }
        chat.append(ChatLine(id: "a-files-\(Int(clock()))-\(chat.count)", who: .vaic, text: "", state: .done, at: clock(), files: cards))
    }

    private func vaicReply(text: String, done: Bool) {
        var c = chat
        let last = c.last
        // The final reply arrives twice (straight from VAIC, and through the event bus as a safety net).
        if done, let last, last.who == .vaic, last.state == .done, last.text == text { return }
        if let last, last.who == .vaic, last.state == .streaming {
            var l = last
            l.text = done ? text : last.text + text
            l.state = done ? .done : .streaming
            l.steps = turn?.steps ?? last.steps
            c[c.count - 1] = l
        } else {
            c.append(ChatLine(id: "a-\(Int(clock()))-\(c.count)", who: .vaic, text: text, state: done ? .done : .streaming, at: clock(),
                              steps: turn?.steps, tookMs: turn.map { clock() - $0.started },
                              files: (turn?.files.isEmpty ?? true) ? nil : turn?.files))
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

    var unsent: [ChatLine] {
        chat.filter { $0.who == .owner && $0.stopped != true && ($0.state == .queued || $0.state == .failed) }
    }

    /// Right after the owner sends, VAIC's status row shows until its first words.
    var waitingForVaic: Bool {
        guard presence == .thinking, let l = chat.last else { return false }
        return l.who == .owner && l.state != .failed
    }
}
