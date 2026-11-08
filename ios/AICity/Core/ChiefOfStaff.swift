// The Chief of Staff, like web/src/lib/chief.ts: an always-on agent that decides the owner's questions and
// approvals. `GET /chief-of-staff` → {enabled, decided: [...], needs_owner: [{id, title, why}]} (a 404 means the
// backend has none yet, and the app shows nothing about it); `PUT /settings {chief_of_staff_enabled}` switches it;
// the event `steward.decided {id, kind, choice, reason}` moves an item out of Needs you at once.
import Foundation

struct DecidedItem: Equatable, Sendable, Identifiable {
    var id: String
    var kind: String
    var title: String
    var choice: String
    var reason: String
    var at: String
    var department: String

    init?(json j: JSONValue, fallback: DecidedItem? = nil) {
        guard let id = j["id"].string, !id.isEmpty else { return nil }
        self.id = id
        kind = j["kind"].string ?? fallback?.kind ?? "question"
        title = j["title"].string ?? fallback?.title ?? (kind == "approval" ? "An action to approve" : "A question")
        choice = j["choice"].string ?? j["decision"].string ?? fallback?.choice ?? ""
        reason = j["reason"].string ?? fallback?.reason ?? ""
        at = j["at"].string ?? fallback?.at ?? ISO8601DateFormatter().string(from: Date())
        department = j["department"].string ?? fallback?.department ?? ""
    }

    init(id: String, kind: String, title: String, choice: String = "", reason: String = "", at: String, department: String) {
        self.id = id
        self.kind = kind
        self.title = title
        self.choice = choice
        self.reason = reason
        self.at = at
        self.department = department
    }
}

struct ChiefState: Equatable, Sendable {
    enum Status: Equatable, Sendable { case loading, ready, missing, failed }
    var status: Status = .loading
    var enabled = false
    var saving = false
    /// Newest first.
    var decided: [DecidedItem] = []
    /// Why an item it could not do still needs the owner's own hands, by item id.
    var needsOwner: [String: String] = [:]

    func decidedThisWeek(now: Double = nowMs()) -> Int {
        decided.filter { d in
            guard let t = City.parseISO(d.at) else { return true }
            return now - t <= 7 * 24 * 3_600_000
        }.count
    }

    static func newestFirst(_ list: [DecidedItem]) -> [DecidedItem] { list.sorted { $0.at > $1.at } }
}
