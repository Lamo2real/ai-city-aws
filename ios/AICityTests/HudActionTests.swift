// AIC's `hud.action` events on the iPhone (Core/HudAction.swift, decision 143): the theme and the open page.
import XCTest
@testable import AICity

final class HudActionTests: XCTestCase {
    func testOnlyTheTwoKnownActionsWithKnownValuesAreUnderstood() {
        XCTAssertEqual(HudAction(event: ["type": "hud.action", "action": "theme", "value": "dark"]), .theme(.dark))
        XCTAssertEqual(HudAction(event: ["type": "hud.action", "action": "theme", "value": "system"]), .theme(.system))
        XCTAssertNil(HudAction(event: ["type": "hud.action", "action": "theme", "value": "sepia"]))
        XCTAssertNil(HudAction(event: ["type": "hud.action", "action": "theme"]))
        XCTAssertEqual(HudAction(event: ["type": "hud.action", "action": "open", "page": "#/city"]), .open(.city))
        XCTAssertNil(HudAction(event: ["type": "hud.action", "action": "open", "page": "#/skills"]), "no such screen on the iPhone")
        XCTAssertNil(HudAction(event: ["type": "hud.action", "action": "sign_out"]))
        XCTAssertNil(HudAction(event: ["type": "ace.reply", "action": "theme", "value": "dark"]))
    }

    func testHudPagesMapToTheScreensThisIPhoneHas() {
        XCTAssertEqual(HudAction.section(forPage: "#/ace"), .aic)
        XCTAssertEqual(HudAction.section(forPage: "#/city"), .city)
        XCTAssertEqual(HudAction.section(forPage: "#/tickets"), .tickets)
        XCTAssertEqual(HudAction.section(forPage: "#/costs"), .costs)
        XCTAssertEqual(HudAction.section(forPage: "#/settings"), .settings)
        XCTAssertEqual(HudAction.section(forPage: "#/settings/connectors"), .settings)
        XCTAssertEqual(HudAction.section(forPage: "#/settings/connectors?add=github"), .settings)
        XCTAssertEqual(HudAction.section(forPage: "#/settings/open-items"), .inbox)
        for page in ["#/apps", "#/knowledge", "#/", "", "ace", "/city", "https://example.test/#/city", "#/city<script>", "#/" + String(repeating: "a", count: 200)] {
            XCTAssertNil(HudAction.section(forPage: page), page)
        }
    }

    @MainActor
    func testAnEventOverTheLiveConnectionSetsTheThemeAndOpensTheScreen() {
        let suite = "aic.tests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite)!
        func model() -> AppModel {
            AppModel(configStore: ConfigStore(defaults: defaults, http: FakeHTTP { _ in (.null, 500) }, bundleHost: nil),
                     hud: HudStore(archive: NoChatArchive()), makeAuth: { _ in FakeAuth() }, connectLive: false, defaults: defaults)
        }
        let m = model()
        XCTAssertEqual(m.appearance, .system)
        XCTAssertEqual(m.section, .aic)

        m.hud.event(["type": "hud.action", "action": "theme", "value": "light", "conversation": "main"])
        XCTAssertEqual(m.appearance, .light)
        XCTAssertEqual(model().appearance, .light, "kept on this iPhone for the next launch")
        m.hud.event(["type": "hud.action", "action": "theme", "value": "neon"])
        XCTAssertEqual(m.appearance, .light, "an unknown value changes nothing")

        m.hud.event(["type": "hud.action", "action": "open", "page": "#/city"])
        XCTAssertEqual(m.section, .city)
        m.hud.event(["type": "hud.action", "action": "open", "page": "#/settings/voice"])
        XCTAssertEqual(m.section, .more)
        XCTAssertEqual(m.morePath, [.settings], "Settings pages are More → Settings")
        m.hud.event(["type": "hud.action", "action": "open", "page": "#/knowledge"])
        XCTAssertEqual(m.section, .more, "a page with no screen here is ignored")
        XCTAssertEqual(m.morePath, [.settings])
        m.hud.event(["type": "hud.action", "action": "open", "page": "#/ace"])
        XCTAssertEqual(m.section, .aic)
        defaults.removePersistentDomain(forName: suite)
    }
}
