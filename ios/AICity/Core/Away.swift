// Autopilot, like web/src/lib/away.ts: the owner can be gone for weeks. Nothing waits on them; AIC's screen opens
// with "While you were away" after more than 12 hours, standing orders handle incoming work, and what only the
// owner's hands can do waits on a short "When you're back" list. A 404 from these routes shows nothing about them.
import Foundation

enum Away {
    /// Long enough away that AIC's screen opens with "While you were away".
    static let awayMs: Double = 12 * 3_600_000
    static let seenKey = "aic.lastSeen"
    static let addPrompt = "While I'm away, "

    /// One plain line for a job or a handled item, whatever shape the server sends.
    static func label(_ j: JSONValue) -> String {
        if let s = j.string { return s }
        for k in ["words", "summary", "name", "title", "what", "goal"] {
            if let s = j[k].string, !s.isEmpty { return s }
        }
        return ""
    }

    /// "every 15 minutes", "every hour", "every 2 hours", "every day".
    static func every(_ min: Int) -> String {
        if min <= 0 { return "now and then" }
        if min % 1440 == 0 { return min == 1440 ? "every day" : "every \(min / 1440) days" }
        if min % 60 == 0 { return min == 60 ? "every hour" : "every \(min / 60) hours" }
        return min == 1 ? "every minute" : "every \(min) minutes"
    }

    private static let sources: [String: (String, String)] = [
        "jira": ("Jira", "tickets"), "slack": ("Slack", "messages"), "github": ("GitHub", "issues"),
        "linear": ("Linear", "issues"), "zendesk": ("Zendesk", "tickets"), "intercom": ("Intercom", "conversations"),
        "mail": ("", "emails"), "email": ("", "emails"), "gmail": ("Gmail", "emails"), "outlook": ("Outlook", "emails"),
    ]

    /// "Every 15 minutes, Customer Support handles new Jira tickets."
    static func words(_ o: StandingOrder) -> String {
        let when = every(o.everyMinutes)
        let who = o.department.trimmingCharacters(in: .whitespaces).isEmpty ? "the team" : o.department
        var work = "new work"
        let what = o.what.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "."))
        if !what.isEmpty {
            work = what.prefix(1).lowercased() + what.dropFirst()
        } else if !o.source.isEmpty {
            let (name, noun) = sources[o.source.lowercased()] ?? (o.source.prefix(1).uppercased() + o.source.dropFirst(), "work")
            work = "new \(name.isEmpty ? "" : "\(name) ")\(noun)"
        }
        return "\(when.prefix(1).uppercased() + when.dropFirst()), \(who) handles \(work)."
    }

    /// Where the one button of a "When you're back" item goes: the web HUD's page that does it (the iPhone has no
    /// provider sign-in of its own; the browser finishes it).
    static func backAction(_ w: WhenBack) -> (label: String, path: String) {
        let svc = w.service.trimmingCharacters(in: .whitespaces)
        let name = svc.isEmpty ? "" : svc.prefix(1).uppercased() + svc.dropFirst().replacingOccurrences(of: "-", with: " ")
        let why = w.why.lowercased()
        func has(_ words: [String]) -> Bool { words.contains { why.range(of: "\\b\($0)\\b", options: .regularExpression) != nil } }
        if svc.lowercased() == "github" { return ("Add your GitHub token", "#/settings/github") }
        if has(["key", "token", "password"]) { return (name.isEmpty ? "Add the key" : "Add the key for \(name)", "#/settings/connectors") }
        if has(["pay", "payment", "card", "billing", "invoice"]) || svc.isEmpty { return ("Open it", "#/settings/open-items") }
        return ("Sign in to \(name)", "#/settings/connectors")
    }
}

struct WhenBack: Equatable, Sendable, Identifiable {
    var id: String
    var title: String
    var why: String
    var service: String
    init?(json j: JSONValue) {
        guard let id = j["id"].string, !id.isEmpty else { return nil }
        self.id = id
        title = j["title"].string ?? ""
        why = j["why"].string ?? ""
        service = j["service"].string ?? ""
    }
}

struct AwaySummary: Equatable, Sendable {
    var since: String
    var finished: [String]
    var running: [String]
    var decided: Int
    var handled: [String]
    var whenBack: [WhenBack]
    init(json j: JSONValue, since fallback: String) {
        since = j["since"].string ?? fallback
        finished = j["jobs_finished"].array.map(Away.label).filter { !$0.isEmpty }
        running = j["jobs_running"].array.map(Away.label).filter { !$0.isEmpty }
        decided = Int(j["decided"].double ?? 0)
        handled = j["handled_by_standing_orders"].array.map(Away.label).filter { !$0.isEmpty }
        whenBack = j["when_youre_back"].array.compactMap(WhenBack.init(json:))
    }
    var isQuiet: Bool { finished.isEmpty && running.isEmpty && decided == 0 && handled.isEmpty && whenBack.isEmpty }
}

struct StandingOrder: Equatable, Sendable, Identifiable {
    var id: String
    var source: String
    var what: String
    var instructions: String
    var department: String
    var everyMinutes: Int
    var enabled: Bool
    init?(json j: JSONValue) {
        guard let id = j["id"].string, !id.isEmpty else { return nil }
        self.id = id
        source = j["source"].string ?? ""
        what = j["what"].string ?? ""
        instructions = j["instructions"].string ?? ""
        department = j["department"].string ?? ""
        everyMinutes = Int(j["every_minutes"].double ?? 15)
        enabled = j["enabled"].bool ?? true
    }
}
