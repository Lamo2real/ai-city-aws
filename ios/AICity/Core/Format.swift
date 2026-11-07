// Plain-language formatting shared by every screen (web/src/lib/format.ts and steps.ts).
import Foundation

enum Fmt {
    static func money(_ usd: Double?) -> String {
        guard let usd, !usd.isNaN else { return "—" }
        return usd < 10 ? String(format: "$%.2f", usd) : String(format: "$%.0f", usd)
    }

    enum Level: String { case ok, amber, red }
    /// Amber at 80 % of the cap, red at 100 %.
    static func spendLevel(spent: Double, cap: Double) -> Level {
        if cap <= 0 || spent >= cap { return .red }
        return spent / cap >= 0.8 ? .amber : .ok
    }
    static func levelWords(_ l: Level) -> String {
        switch l { case .ok: return ""; case .amber: return "close to the cap"; case .red: return "cap reached" }
    }

    static func ago(_ ms: Double?, now: Double = nowMs()) -> String {
        guard let ms else { return "" }
        let s = max(0, Int(((now - ms) / 1000).rounded()))
        if s < 60 { return "just now" }
        if s < 3600 { return "\(s / 60) min ago" }
        if s < 86400 { return "\(s / 3600) h ago" }
        return "\(s / 86400) d ago"
    }

    static func tokensK(_ n: Double) -> String {
        n >= 1_000_000 ? String(format: "%.1fM", n / 1_000_000) : "\(Int((n / 1000).rounded()))k"
    }
}

/// AIC's visible steps while it works: plain phrases from its `activity` events (never model reasoning).
enum Steps {
    static let byTool = [
        "get_status": "Checking the ledger", "list_notes": "Reading your notes", "add_note": "Saving a note",
        "add_reminder": "Setting a reminder", "delegate_to_orchestrator": "Handing this to the Orchestrator",
        "instruct_agent": "Passing your instruction on", "answer_question": "Answering a question from the team",
        "pause_city": "Pausing the City", "resume_city": "Resuming the City",
    ]
    static let byActivity = [
        "understanding": "Understanding your message", "answering": "Answering a question from the team",
        "delegating": "Handing this to the Orchestrator", "asking": "Asking you a question", "reading": "Reading",
        "researching": "Looking things up", "reviewing": "Reviewing", "reporting": "Writing a report",
    ]
    static let first = byActivity["understanding"]!

    /// The phrase for one activity event, or nil for "idle" (the turn is over, not a step).
    static func words(activity: String, detail: String?) -> String? {
        if activity == "idle" { return nil }
        var tool = detail ?? ""
        if tool.hasPrefix("mcp__city__") { tool.removeFirst("mcp__city__".count) }
        return byTool[tool] ?? byActivity[activity] ?? "Working on it"
    }
}
