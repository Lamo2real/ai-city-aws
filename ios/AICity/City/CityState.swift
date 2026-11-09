// The City's state as plain data: a Swift port of web/src/city/city-state.js (the reducer the web HUD uses),
// so the phone and the browser agree on what every event means. Pure functions; unit-tested in
// AICityTests/CityReducerTests.swift. Times are epoch milliseconds, like the web version.
import Foundation

struct Agent: Equatable, Sendable {
    var id: String
    var kind: String  // core | manager | worker | specialist
    var role: String
    var department: String?
    var model: String
    var parent: String?
    var state: String  // active | dormant | retired
    var workerState: String?
    var totalCostUsd: Double?
    var ticketId: String?
    var lastActiveAt: String?
    var awaitingMerge: String?  // the branch

    init(id: String, kind: String, role: String, department: String?, model: String, parent: String? = nil, state: String,
         workerState: String? = nil, totalCostUsd: Double? = nil, ticketId: String? = nil, lastActiveAt: String? = nil) {
        self.id = id; self.kind = kind; self.role = role; self.department = department; self.model = model
        self.parent = parent; self.state = state; self.workerState = workerState; self.totalCostUsd = totalCostUsd
        self.ticketId = ticketId; self.lastActiveAt = lastActiveAt
    }
    init?(json j: JSONValue) {
        guard let id = j["id"].string else { return nil }
        self.init(id: id, kind: j["kind"].string ?? "worker", role: j["role"].string ?? id, department: j["department"].string,
                  model: j["model"].string ?? "", parent: j["parent"].string, state: j["state"].string ?? "active",
                  workerState: j["worker_state"].string, totalCostUsd: j["total_cost_usd"].double, ticketId: j["ticket_id"].string,
                  lastActiveAt: j["last_active_at"].string)
    }
}

struct Ticket: Equatable, Sendable, Identifiable {
    var id: String
    var goal: String
    var from: String
    var to: String
    var status: String
    var department: String?
    var createdAt: String?
    var updatedAt: String?
    var result: String?
    init?(json j: JSONValue) {
        guard let id = j["id"].string else { return nil }
        self.id = id
        goal = j["goal"].string ?? ""
        from = j["from"].string ?? ""
        to = j["to"].string ?? ""
        status = j["status"].string ?? "open"
        department = j["department"].string
        createdAt = j["created_at"].string
        updatedAt = j["updated_at"].string
        result = j["result"].string
    }
}

struct Question: Equatable, Sendable, Identifiable {
    var id: String
    var askedBy: String
    var path: String
    var text: String
    var options: [String]
    var defaultAnswer: String
    var createdAt: String
    /// The Chief of Staff already decided it (it no longer waits for the owner).
    var decidedByChief = false
    /// Why the Chief of Staff left it to the owner (sign in, paste a key, pay).
    var needsOwnerReason: String?
    init?(json j: JSONValue) {
        guard let id = j["id"].string else { return nil }
        self.id = id
        askedBy = j["asked_by"].string ?? ""
        path = j["path"].string ?? askedBy
        text = j["text"].string ?? ""
        options = j["options"].array.compactMap(\.string)
        defaultAnswer = j["default_answer"].string ?? ""
        createdAt = j["created_at"].string ?? ""
        decidedByChief = City.decidedByChief(j)
        needsOwnerReason = j["needs_owner_reason"].string.flatMap { $0.isEmpty ? nil : $0 }
    }
}

struct Approval: Equatable, Sendable, Identifiable {
    var id: String
    var agent: String
    var action: String
    var reason: String
    var costHint: String?
    var title: String?
    var department: String?
    var decidedByChief = false
    var needsOwnerReason: String?
    init?(json j: JSONValue) {
        guard let id = j["id"].string else { return nil }
        self.id = id
        agent = j["agent"].string ?? "An agent"
        action = j["action"].string ?? ""
        reason = j["reason"].string ?? ""
        costHint = j["cost_hint"].string
        title = j["title"].string
        department = j["department"].string
        decidedByChief = City.decidedByChief(j)
        needsOwnerReason = j["needs_owner_reason"].string.flatMap { $0.isEmpty ? nil : $0 }
    }
}

struct Department: Equatable, Sendable {
    var name: String
    var mission: String?
    var managerId: String?
    var state: String?
    var key: String?
    var builtAt: Double
}

struct Usage: Equatable, Sendable {
    var usd: Double, turns: Double, tokens: Double
    init?(json j: JSONValue) {
        guard case .object = j else { return nil }
        usd = j["usd"].double ?? 0; turns = j["turns"].double ?? 0; tokens = j["tokens"].double ?? 0
    }
}

struct Caps: Equatable, Sendable {
    var dailyGlobalUsd: Double?
    var monthlyBudgetUsd: Double?
    var dailyDepartmentUsd: Double?
    init?(json j: JSONValue) {
        guard case .object = j else { return nil }
        dailyGlobalUsd = j["daily_global_usd"].double
        monthlyBudgetUsd = j["monthly_budget_usd"].double
        dailyDepartmentUsd = j["daily_department_usd"].double
    }
}

struct CityGate: Equatable, Sendable {
    var paused: Bool
    var reason: String?
    var running: Int?
    var waiting: Int?
}

struct FeedLine: Equatable, Sendable, Identifiable {
    var at: Double
    var text: String
    var kind: String
    var id: String { "\(at)-\(text)" }
}

struct Recent: Equatable, Sendable { var kind: String; var at: Double; var ticket: String? }
struct Review: Equatable, Sendable { var round: Double; var verdict: String?; var at: Double; var agent: String? }
struct ActivityNow: Equatable, Sendable { var activity: String; var detail: String? }
struct CapHit: Equatable, Sendable { var cap: String; var limit: Double; var spent: Double }

struct CityState: Equatable, Sendable {
    var agents: [String: Agent] = [:]
    var activities: [String: ActivityNow] = [:]
    var tickets: [String: Ticket] = [:]
    var parked: [String: Ticket] = [:]
    var questions: [String: Question] = [:]
    var approvals: [String: Approval] = [:]
    var departments: [String: Department] = [:]
    var reviews: [String: Review] = [:]
    var costs: [String: (usd: Double, tokens: Double)] = [:]
    var usage: Usage?
    var spend: [String: Double] = [:]
    var caps: Caps?
    var city: CityGate?
    var capHit: CapHit?
    var feed: [FeedLine] = []
    var recent: [String: Recent] = [:]
    var now: Double = 0

    static func == (a: CityState, b: CityState) -> Bool {
        a.agents == b.agents && a.tickets == b.tickets && a.parked == b.parked && a.questions == b.questions
            && a.approvals == b.approvals && a.departments == b.departments && a.usage == b.usage && a.caps == b.caps
            && a.city == b.city && a.feed == b.feed && a.activities == b.activities && a.spend == b.spend
            && a.capHit == b.capHit && a.recent == b.recent && a.reviews == b.reviews
            && a.costs.mapValues { [$0.usd, $0.tokens] } == b.costs.mapValues { [$0.usd, $0.tokens] }
    }
}

func nowMs() -> Double { Date().timeIntervalSince1970 * 1000 }

enum City {
    static let core: Set<String> = ["ace", "orchestrator"]
    static let feedMax = 40
    static let costNote = "Estimate from token counts at list prices. The AWS bill is the truth."
    static let modelName = ["haiku-5-5": "Haiku 5.5", "opus-5-5": "Opus 5.5", "sonnet-5-5": "Sonnet 5.5", "fable-5-1": "Fable 5.1"]
    static let recentMs: [String: Double] = ["done": 6000, "review_fail": 20000, "hired": 4000, "retired": 4000]

    static func deptOf(_ a: Agent) -> String { core.contains(a.id) ? "HQ" : (a.department ?? "other") }
    static func keyOf(_ name: String?) -> String {
        (name ?? "").trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).lowercased()
    }
    /// A record the Chief of Staff already decided: `decided_by: "chief_of_staff"` with a decision.
    static func decidedByChief(_ j: JSONValue) -> Bool {
        j["decided_by"].string == "chief_of_staff" && !(j["decision"].string ?? "").isEmpty
    }
    static func displayName(_ id: String) -> String { id == "ace" ? "VAIC" : id }

    private static func filed(_ departments: [String: Department], _ a: Agent) -> Agent {
        guard let dep = a.department, let d = departments.values.first(where: { keyOf($0.name) == keyOf(dep) }), d.name != dep else { return a }
        var b = a
        b.department = d.name
        return b
    }

    private static func touch(_ s: CityState, _ dept: String, _ now: Double) -> [String: Department] {
        if dept == "HQ" || s.departments[dept] != nil { return s.departments }
        var d = s.departments
        d[dept] = Department(name: dept, builtAt: now)
        return d
    }

    private static func feed(_ s: inout CityState, _ text: String, _ kind: String, _ now: Double) {
        s.feed = Array(([FeedLine(at: now, text: text, kind: kind)] + s.feed).prefix(feedMax))
    }

    private static func cut(_ s: String, _ n: Int) -> String { String(s.prefix(n)) }

    static func applySnapshot(_ state: CityState, _ snap: JSONValue, now: Double = nowMs()) -> CityState {
        var next = CityState()
        next.now = now
        next.feed = state.feed
        let listed: Bool = { if case .array = snap["departments"] { return true }; return false }()
        for d in snap["departments"].array where d["state"].string != "deleted" {
            guard let name = d["name"].string else { continue }
            let born = parseISO(d["created_at"].string).map { $0 } ?? .infinity
            next.departments[name] = Department(name: name, mission: d["mission"].string, managerId: d["manager_id"].string,
                                                state: d["state"].string, key: d["key"].string, builtAt: min(now - 60000, born))
        }
        for j in snap["agents"].array {
            guard let a = Agent(json: j) else { continue }
            next.agents[a.id] = filed(next.departments, a)
            if !listed { next.departments = touch(next, deptOf(a), now - 60000) }
        }
        for sp in snap["specialists"].array {
            guard let sid = sp["id"].string else { continue }
            let id = "spec-\(sid)"
            if next.agents[id] == nil {
                next.agents[id] = Agent(id: id, kind: "specialist", role: sp["specialty"].string ?? "Specialist", department: sp["department"].string,
                                        model: "opus-5-5", state: "retired", workerState: "released", lastActiveAt: sp["created_at"].string)
            }
        }
        for (id, a) in snap["activities"].object {
            next.activities[id] = ActivityNow(activity: a["activity"].string ?? "idle", detail: a["detail"].string)
        }
        for t in snap["tickets"].array { if let t = Ticket(json: t) { next.tickets[t.id] = t } }
        for t in snap["parked"].array { if let t = Ticket(json: t) { next.parked[t.id] = t } }
        if case .object = snap["city"] {
            let c = snap["city"]
            next.city = CityGate(paused: c["paused"].bool ?? false, reason: c["reason"].string,
                                 running: c["running"].double.map { Int($0) }, waiting: c["waiting"].double.map { Int($0) })
        }
        for q in snap["questions"].array { if let q = Question(json: q) { next.questions[q.id] = q } }
        for a in snap["approvals"].array { if let a = Approval(json: a) { next.approvals[a.id] = a } }
        next.usage = Usage(json: snap["usage"])
        for (k, v) in snap["spend"].object { next.spend[k] = v.double ?? 0 }
        next.caps = Caps(json: snap["caps"])
        return next
    }

    static let workerLine = ["review": "worker", "completed": "done", "released": "worker", "blocked": "fail", "failed": "fail",
                             "paused": "worker", "cancelled": "worker"]

    /// One event in, a new state out. Unknown events change nothing.
    static func reduce(_ state: CityState, _ e: JSONValue, now: Double = nowMs()) -> CityState {
        var s = state
        switch e["type"].string ?? "" {
        case "agent.hired":
            guard let raw = Agent(json: e["agent"]) else { return state }
            let a = filed(s.departments, raw)
            s.agents[a.id] = a
            s.departments = touch(s, deptOf(a), now)
            s.recent[a.id] = Recent(kind: "hired", at: now)
            feed(&s, "\(a.role) \(e["revived"].bool == true ? "is back" : "hired") in \(deptOf(a))", "hire", now)
        case "agent.retired":
            guard let id = e["id"].string, var a = s.agents[id] else { return state }
            a.state = "retired"
            s.agents[id] = a
            s.recent[id] = Recent(kind: "retired", at: now, ticket: s.recent[id]?.ticket)
            feed(&s, "\(a.role) \(a.workerState == "released" ? "released" : "retired")", "retire", now)
        case "ticket.status":
            guard let t = Ticket(json: e["ticket"]) else { return state }
            let terminal = ["done", "failed", "cancelled"].contains(t.status)
            s.tickets[t.id] = nil
            s.parked[t.id] = nil
            if t.status == "parked" { s.parked[t.id] = t } else if !terminal { s.tickets[t.id] = t }
            if terminal { s.recent[t.to] = Recent(kind: t.status, at: now, ticket: t.id) }
            let text = e["previous"].isNull ? "\(t.to) got a ticket from \(t.from): \(cut(t.goal, 60))" : "\(t.to): \(e["previous"].string ?? "") → \(t.status)"
            feed(&s, text, t.status, now)
        case "question.asked":
            guard let q = Question(json: e["question"]), s.questions[q.id] == nil else { return state }
            s.questions[q.id] = q
            feed(&s, "\(q.path) asks: \(q.text)", "question", now)
        case "question.answered":
            guard let id = e["id"].string else { return state }
            s.questions[id] = nil
            feed(&s, "\(e["answered_by"].string ?? "Someone") answered: \(cut(e["answer"].string ?? "", 60))", "answer", now)
        case "review.started":
            guard let tid = e["ticket_id"].string else { return state }
            let t = s.tickets[tid]
            let round = e["round"].double ?? 1
            s.reviews[tid] = Review(round: round, verdict: nil, at: now, agent: t?.to)
            feed(&s, "Inspector at \(t?.to ?? tid)'s door (round \(Int(round)))", "review", now)
        case "review.result":
            guard let tid = e["ticket_id"].string else { return state }
            let verdict = e["verdict"].string ?? ""
            s.reviews[tid] = Review(round: e["round"].double ?? 1, verdict: verdict, at: now, agent: s.reviews[tid]?.agent ?? e["agent"].string)
            feed(&s, "Review \(verdict): \(cut(e["summary"].string ?? "", 60))", verdict == "PASS" ? "pass" : "fail", now)
        case "cost.update":
            guard let agent = e["agent"].string else { return state }
            let c = s.costs[agent] ?? (0, 0)
            s.usage = Usage(json: e["today"]) ?? s.usage
            s.costs[agent] = (c.usd + (e["usd"].double ?? 0), c.tokens + (e["tokens"].double ?? 0))
        case "result":
            feed(&s, "Done: \(cut(e["summary"].string ?? "", 70))", "result", now)
        case "worker.state":
            guard let id = e["id"].string, var a = s.agents[id], let st = e["state"].string else { return state }
            a.workerState = st
            s.agents[id] = a
            if let kind = workerLine[st] { feed(&s, "\(id): \(e["previous"].string ?? "new") → \(st)", kind, now) }
        case "activity":
            guard let id = e["id"].string else { return state }
            s.activities[id] = ActivityNow(activity: e["activity"].string ?? "idle", detail: e["detail"].string)
        case "signoff.result":
            let v = e["verdict"].string ?? ""
            feed(&s, "Orchestrator sign-off \(v): \(cut(e["summary"].string ?? "", 60))", v == "PASS" ? "pass" : "fail", now)
        case "instruction":
            feed(&s, "You told \(e["to"].string ?? "an agent"): \(cut(e["text"].string ?? "", 60))", "answer", now)
        case "approval.requested":
            guard let a = Approval(json: e) else { return state }
            s.approvals[a.id] = a
            feed(&s, "\(a.agent) needs your approval: \(cut(a.action, 60))", "question", now)
        case "approval.decided":
            guard let id = e["id"].string else { return state }
            s.approvals[id] = nil
            let ok = e["approved"].bool == true
            feed(&s, ok ? "You approved an action" : "You refused an action", ok ? "pass" : "fail", now)
        case "spend.cap_reached":
            let cap = e["cap"].string ?? ""
            let limit = e["limit"].double ?? 0
            s.capHit = CapHit(cap: cap, limit: limit, spent: e["spent"].double ?? 0)
            feed(&s, "Spend cap reached: \(cap.replacingOccurrences(of: "_", with: " ")) ($\(fmtNumber(limit)))", "fail", now)
        case "city.state":
            let paused = e["paused"].bool ?? false
            var c = s.city ?? CityGate(paused: false)
            c.paused = paused
            c.reason = e["reason"].string
            s.city = c
            feed(&s, paused ? "City paused: \(e["reason"].string ?? "")" : "City resumed", paused ? "fail" : "pass", now)
        case "worker.merge_waiting":
            guard let id = e["id"].string, var a = s.agents[id] else { return state }
            a.awaitingMerge = e["branch"].string ?? "a branch"
            s.agents[id] = a
            feed(&s, "\(id) stays at its desk until \(a.awaitingMerge!) is merged", "worker", now)
        case "worker.merged":
            guard let id = e["id"].string, var a = s.agents[id] else { return state }
            a.awaitingMerge = nil
            s.agents[id] = a
            feed(&s, "\(e["branch"].string ?? "The branch") is settled; \(id) can leave its desk", "done", now)
        case "department.created":
            guard let name = e["name"].string, s.departments[name] == nil else { return state }
            s.departments[name] = Department(name: name, mission: e["mission"].string, managerId: e["manager_id"].string, state: "active", builtAt: now)
            feed(&s, "Department \(name) created", "department", now)
        case "department.updated":
            let d = e["department"]
            guard let name = d["name"].string else { return state }
            let oldKey = e["previous_key"].string ?? keyOf(name)
            let old = s.departments.values.first { keyOf($0.name) == oldKey }
            if let old { s.departments[old.name] = nil }
            if d["state"].string != "deleted" {
                s.departments[name] = Department(name: name, mission: d["mission"].string, managerId: d["manager_id"].string,
                                                 state: d["state"].string, key: d["key"].string, builtAt: old?.builtAt ?? now)
            }
            if let old, old.name != name {
                for (id, a) in s.agents where keyOf(a.department) == oldKey && a.department != nil {
                    var b = a; b.department = name; s.agents[id] = b
                }
            }
            let text = old?.key == nil ? "Department \(name) created"
                : old!.name != name ? "Department \(old!.name) is now \(name)"
                : old!.state != d["state"].string ? "Department \(name): \(old!.state ?? "") → \(d["state"].string ?? "")"
                : "Department \(name) updated"
            feed(&s, text, "department", now)
        case "city.resumed":
            var c = s.city ?? CityGate(paused: false)
            c.paused = false; c.reason = nil
            s.city = c
            feed(&s, "City resumed", "pass", now)
        case "tickets.parked":
            let ids = e["ids"].array.compactMap(\.string)
            for id in ids { if var t = s.tickets[id] { t.status = "parked"; s.parked[id] = t; s.tickets[id] = nil } }
            feed(&s, "\(ids.count) stale tickets parked; they wait for you", "fail", now)
        case "turn.failed":
            let who = e["agent"].string ?? ""
            feed(&s, "\(who.isEmpty ? "A turn" : who) failed\(e["retrying"].bool == true ? ", retrying" : ""): \(cut(e["error"].string ?? "", 80))", "fail", now)
        default:
            return state
        }
        s.now = now
        return s
    }

    // MARK: What each agent is doing, and where it is

    static func agentStatus(_ s: CityState, _ id: String, now: Double? = nil) -> String {
        let now = now ?? s.now
        guard let a = s.agents[id] else { return "unknown" }
        if a.state == "retired" { return a.workerState == "released" ? "released" : "retired" }
        let mine = s.tickets.values.filter { $0.to == id }
        if s.reviews.values.contains(where: { $0.agent == id && $0.verdict == "FAIL" && now - $0.at < recentMs["review_fail"]! }) { return "review_fail" }
        if a.kind == "worker", let ws = a.workerState {
            return ws == "blocked" && mine.contains { $0.status == "waiting_on_owner" } ? "waiting_on_owner" : ws
        }
        if mine.contains(where: { $0.status == "in_review" }) { return "in_review" }
        if mine.contains(where: { $0.status == "waiting_on_owner" }) { return "waiting_on_owner" }
        if let r = s.recent[id], r.kind == "done", now - r.at < recentMs["done"]! { return "done" }
        if mine.contains(where: { $0.status == "in_progress" || $0.status == "open" }) { return "working" }
        return "idle"
    }

    static func departmentNames(_ s: CityState) -> [String] {
        s.departments.values.sorted { $0.builtAt == $1.builtAt ? $0.name < $1.name : $0.builtAt < $1.builtAt }.map(\.name)
    }

    enum Place: String { case hq, station, home }
    struct Placement: Equatable { var place: Place; var dept: String; var why: String }

    static func placement(_ s: CityState, _ id: String) -> Placement? {
        guard let a = s.agents[id] else { return nil }
        if a.kind == "core" || core.contains(id) { return Placement(place: .hq, dept: "HQ", why: "core") }
        let dept = deptOf(a)
        if a.kind == "specialist" { return Placement(place: .home, dept: dept, why: "saved specialist") }
        if s.tickets.values.contains(where: { $0.to == id || $0.from == id }) { return Placement(place: .station, dept: dept, why: "ticket") }
        if a.awaitingMerge != nil { return Placement(place: .station, dept: dept, why: "merge") }
        if a.state != "retired" && a.workerState != "released" { return Placement(place: .station, dept: dept, why: "hired") }
        return Placement(place: .home, dept: dept, why: a.state == "retired" ? "released" : "off work")
    }

    struct Visual { let label: String; let words: String; let pose: String }
    static let visuals: [String: Visual] = [
        "understanding": .init(label: "Understanding", words: "Working out what is being asked", pose: "think"),
        "reading": .init(label: "Reading", words: "Reading a file", pose: "read"),
        "researching": .init(label: "Researching", words: "Looking things up", pose: "read"),
        "browsing": .init(label: "Browsing", words: "Using a browser", pose: "tablet"),
        "coding": .init(label: "Coding", words: "Writing code", pose: "type"),
        "running": .init(label: "Running", words: "Running a command", pose: "type"),
        "working": .init(label: "Working", words: "Working on its task", pose: "type"),
        "hiring": .init(label: "Hiring", words: "Hiring someone", pose: "wave"),
        "delegating": .init(label: "Delegating", words: "Handing work to someone", pose: "point"),
        "asking": .init(label: "Asking", words: "Asking a question", pose: "raise"),
        "answering": .init(label: "Answering", words: "Answering a question", pose: "point"),
        "reporting": .init(label: "Reporting", words: "Reporting back", pose: "clipboard"),
        "reviewing": .init(label: "Reviewing", words: "Reviewing someone's work", pose: "magnify"),
        "in_review": .init(label: "In review", words: "Finished, and waiting for its work to be checked", pose: "wait"),
        "summarizing": .init(label: "Summarizing", words: "Writing a summary", pose: "clipboard"),
        "remembering": .init(label: "Remembering", words: "Saving something to memory", pose: "think"),
        "waiting_team": .init(label: "Waiting for the team", words: "Waiting for its team to finish", pose: "wait"),
        "waiting_owner": .init(label: "Needs you", words: "Waiting for your answer", pose: "alarm"),
        "waiting_merge": .init(label: "Waiting for a merge", words: "Finished, and staying until its work is merged", pose: "wait"),
        "failed": .init(label: "Failed", words: "Its last task failed", pose: "slump"),
        "blocked": .init(label: "Blocked", words: "Blocked and cannot go on", pose: "slump"),
        "paused": .init(label: "Paused", words: "Paused", pose: "still"),
        "idle": .init(label: "Idle", words: "Nothing right now", pose: "rest"),
    ]

    static func visualState(_ s: CityState, _ id: String) -> String {
        guard let a = s.agents[id], let where_ = placement(s, id), where_.place != .home else { return "idle" }
        let mine = s.tickets.values.filter { $0.to == id }
        let worker = a.kind == "worker" ? a.workerState : nil
        let activity = s.activities[id]?.activity
        if worker == "failed" { return "failed" }
        if mine.contains(where: { $0.status == "waiting_on_owner" }) || activity == "waiting_owner"
            || s.questions.values.contains(where: { $0.askedBy == id }) || s.approvals.values.contains(where: { $0.agent == id }) {
            return "waiting_owner"
        }
        switch worker {
        case "waiting": return "asking"
        case "reporting": return "reporting"
        case "blocked": return "blocked"
        case "paused": return "paused"
        default: break
        }
        if where_.why == "merge" { return "waiting_merge" }
        if (worker == "idle" || worker == "completed") && mine.isEmpty { return "idle" }
        if let activity, activity != "idle" {
            if s.city?.paused == true { return "paused" }
            return visuals[activity] != nil ? activity : "working"
        }
        if worker == "review" || mine.contains(where: { $0.status == "in_review" }) { return "in_review" }
        if !mine.isEmpty { return "working" }
        return s.tickets.values.contains(where: { $0.from == id }) ? "waiting_team" : "idle"
    }

    static func doingWords(_ key: String, detail: String? = nil) -> String {
        let w = (visuals[key] ?? visuals["working"]!).words
        if let detail, !detail.isEmpty { return "\(w): \(detail)" }
        return "\(w)."
    }

    struct TopBar: Equatable { var agentsTotal: Int; var agentsActive: Int; var ticketsRunning: Int; var questionsWaiting: Int; var parked: Int }
    static func topBar(_ s: CityState) -> TopBar {
        let agents = s.agents.values.filter { !core.contains($0.id) && $0.kind != "specialist" }
        // "Agents working now": workers on a job right now, never managers, the Orchestrator or AIC (the owner, 2026-11-08).
        let busy: Set<String> = ["working", "reporting"] // running now: not waiting on an answer or in review (2026-11-09)
        let working = agents.filter { $0.kind == "worker" && $0.state != "retired" && busy.contains($0.workerState ?? "") }.count
        return TopBar(agentsTotal: agents.count, agentsActive: working,
                      ticketsRunning: s.tickets.values.filter { $0.status == "in_progress" || $0.status == "in_review" }.count,
                      questionsWaiting: s.questions.count + s.approvals.count, parked: s.parked.count)
    }

    static func cityMessage(_ s: CityState) -> String? {
        if departmentNames(s).isEmpty { return "No departments yet. An office goes up the moment a prompt needs one." }
        let others = s.agents.keys.filter { !core.contains($0) }
        if !others.contains(where: { placement(s, $0)?.place == .station }) { return "Nobody is at a desk right now. Everyone is home or at HQ." }
        return nil
    }

    static func currentTicket(_ s: CityState, _ id: String) -> Ticket? {
        s.tickets.values.filter { $0.to == id }.sorted { ($0.updatedAt ?? "") > ($1.updatedAt ?? "") }.first
    }

    static let ticketWordsMap = ["open": "Not started yet", "in_progress": "Working on it", "in_review": "Being reviewed",
                                 "waiting_on_owner": "Waiting for you", "parked": "On hold", "done": "Finished",
                                 "failed": "Did not finish", "cancelled": "Cancelled"]
    static func ticketWords(_ status: String) -> String { ticketWordsMap[status] ?? status.replacingOccurrences(of: "_", with: " ") }

    /// Drops the bookkeeping agents put in front of their notes and keeps the first sentences that fit.
    static func plainText(_ text: String, max: Int = 170) -> (short: String, whole: Bool) {
        let clean = text
            .replacingOccurrences(of: #"^(\s*\((?:parent|for)[^)]*\)\s*|\s*\[[^\]]*\]\s*|\s*(?:parent\s+)?t-[0-9a-f]{8}\b[:.]?\s*)+"#, with: "", options: [.regularExpression, .caseInsensitive])
            .replacingOccurrences(of: "[`*]+", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
        if clean.count <= max { return (clean, true) }
        let cutText = String(clean.prefix(max))
        let ends = [". ", "! ", "? "].compactMap { cutText.range(of: $0, options: .backwards)?.lowerBound }
        if let end = ends.max(), cutText.distance(from: cutText.startIndex, to: end) >= 60 {
            return (String(cutText[...end]), false)
        }
        let space = cutText.range(of: " ", options: .backwards)?.lowerBound ?? cutText.endIndex
        return (String(cutText[..<space]).trimmingCharacters(in: .whitespaces) + "…", false)
    }

    struct DepartmentPanel { var name: String; var mission: String?; var manager: String?; var workers: [String]; var openTickets: [Ticket]; var todayUsd: Double?; var released: Int }
    static func departmentPanel(_ s: CityState, _ dept: String) -> DepartmentPanel {
        let everyone = s.agents.values.filter { deptOf($0) == dept }
        let members = everyone.filter { $0.state != "retired" }
        let ids = Set(members.map(\.id))
        let reg = s.departments[dept]
        let spent = s.spend.filter { keyOf($0.key) == keyOf(dept) }.map(\.value)
        return DepartmentPanel(name: dept, mission: reg?.mission, manager: reg?.managerId ?? members.first { $0.kind == "manager" }?.id ?? (dept == "HQ" ? "orchestrator" : nil),
                               workers: members.filter { $0.kind == "worker" }.map(\.id).sorted(),
                               openTickets: s.tickets.values.filter { ids.contains($0.to) }.sorted { $0.id < $1.id },
                               todayUsd: spent.isEmpty ? nil : spent.reduce(0, +), released: everyone.count - members.count)
    }

    // MARK: Stable looks and places

    static func hashOf(_ s: String) -> UInt32 {
        var h: UInt32 = 2166136261
        for c in s.utf16 { h = (h ^ UInt32(c)) &* 16777619 }
        return h
    }
    struct Identity: Equatable { var skin: Int; var hair: Int; var hairStyle: Int; var shirt: Int; var trousers: Int }
    static func identity(_ id: String) -> Identity {
        let h = hashOf(id)
        return Identity(skin: Int(h % 6), hair: Int((h >> 3) % 7), hairStyle: Int((h >> 6) % 5), shirt: Int((h >> 9) % 10), trousers: Int((h >> 13) % 4))
    }

    /// Everyone keeps a seat once given one; a newcomer takes the lowest free one.
    static func assignSlots(_ ids: [String], previous: [String: Int] = [:]) -> [String: Int] {
        var slots: [String: Int] = [:]
        var taken = Set<Int>()
        for id in ids { if let p = previous[id] { slots[id] = p; taken.insert(p) } }
        var next = 0
        for id in ids.sorted() where slots[id] == nil {
            while taken.contains(next) { next += 1 }
            slots[id] = next
            taken.insert(next)
        }
        return slots
    }

    static func fmtNumber(_ v: Double) -> String { v.rounded() == v ? String(Int(v)) : String(v) }
    static func parseISO(_ s: String?) -> Double? {
        guard let s else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f.date(from: s) { return d.timeIntervalSince1970 * 1000 }
        f.formatOptions = [.withInternetDateTime]
        return f.date(from: s).map { $0.timeIntervalSince1970 * 1000 }
    }
}
