// AIC changes what lives on the owner's device (decision 143; the web's lib/hudAction.ts): the theme, or which
// page is open. The `hud.action` event comes over the WebSocket from AIC's `hud_action` tool, which only runs on
// the owner's own message. Only the two actions below are understood; anything else, and any page this iPhone
// has no screen for, is ignored.
import Foundation

/// The appearance the owner chose for the parts of the app that follow one (the City tab; the glass screens are
/// dark in every appearance, decision 103).
enum Appearance: String, Sendable, CaseIterable { case system, light, dark }

enum HudAction: Equatable, Sendable {
    case theme(Appearance)
    case open(AppSection)

    init?(event e: JSONValue) {
        guard e["type"].string == "hud.action" else { return nil }
        switch e["action"].string {
        case "theme":
            guard let value = e["value"].string, let a = Appearance(rawValue: value) else { return nil }
            self = .theme(a)
        case "open":
            guard let page = e["page"].string, let s = Self.section(forPage: page) else { return nil }
            self = .open(s)
        default:
            return nil
        }
    }

    /// The screen a HUD page (`#/ace`, `#/settings/connectors`, …) is on this iPhone, nil when it has none
    /// (Apps, Knowledge and Skills live on the web HUD only).
    static func section(forPage page: String) -> AppSection? {
        guard page.wholeMatch(of: /#\/[\w\/?=&.\-]{0,120}/) != nil else { return nil }
        let path = page.dropFirst(2).split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? ""
        let parts = path.split(separator: "/").map(String.init)
        switch parts.first {
        case "ace": return .aic
        case "city": return .city
        case "tickets": return .tickets
        case "costs": return .costs
        case "settings": return parts.dropFirst().first == "open-items" ? .inbox : .settings
        default: return nil
        }
    }
}
