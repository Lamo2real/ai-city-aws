import XCTest
@testable import AICity

/// Autopilot in plain words (Core/Away.swift), like web/test/away.test.ts.
final class AwayTests: XCTestCase {
    func order(_ extra: [String: JSONValue] = [:]) -> StandingOrder {
        var j: [String: JSONValue] = ["id": "so", "source": "jira", "department": "Customer Support", "every_minutes": 15, "enabled": true]
        for (k, v) in extra { j[k] = v }
        return StandingOrder(json: .object(j))!
    }

    func testHowOften() {
        XCTAssertEqual(Away.every(15), "every 15 minutes")
        XCTAssertEqual(Away.every(60), "every hour")
        XCTAssertEqual(Away.every(120), "every 2 hours")
        XCTAssertEqual(Away.every(1440), "every day")
    }

    func testStandingOrderAsOneSentence() {
        XCTAssertEqual(Away.words(order()), "Every 15 minutes, Customer Support handles new Jira tickets.")
        XCTAssertEqual(Away.words(order(["source": "slack", "department": "", "every_minutes": 60])), "Every hour, the team handles new Slack messages.")
        XCTAssertEqual(Away.words(order(["what": "New Zendesk tickets."])), "Every 15 minutes, Customer Support handles new Zendesk tickets.")
    }

    func testSummaryReadsWhateverShape() {
        let s = AwaySummary(json: [
            "jobs_finished": [["id": "j", "name": "Build the page", "status": "Done"], "Plain line"],
            "jobs_running": [],
            "decided": 3,
            "handled_by_standing_orders": [["source": "jira", "item": "SUP-1", "summary": "Answered SUP-1"]],
            "when_youre_back": [["id": "back-slack", "title": "Slack", "why": "Sign in again.", "service": "slack"], ["title": "no id"]],
        ], since: "2026-11-01T00:00:00Z")
        XCTAssertEqual(s.since, "2026-11-01T00:00:00Z")
        XCTAssertEqual(s.finished, ["Build the page", "Plain line"])
        XCTAssertEqual(s.decided, 3)
        XCTAssertEqual(s.handled, ["Answered SUP-1"])
        XCTAssertEqual(s.whenBack.map(\.id), ["back-slack"])
        XCTAssertFalse(s.isQuiet)
    }

    func testOneButtonPerThingOnlyTheOwnerCanDo() {
        let w = { (why: String, svc: String) in WhenBack(json: ["id": "1", "title": "t", "why": .string(why), "service": .string(svc)])! }
        XCTAssertEqual(Away.backAction(w("Slack needs you to sign in again.", "slack")).label, "Sign in to Slack")
        XCTAssertEqual(Away.backAction(w("Needs a new API key.", "heygen")).path, "#/settings/connectors")
        XCTAssertEqual(Away.backAction(w("GitHub refused the token.", "github")).path, "#/settings/github")
        XCTAssertEqual(Away.backAction(w("Only you can pay the invoice.", "")).path, "#/settings/open-items")
    }

    @MainActor func testOpensByItselfOnlyAfterTwelveHoursAway() {
        let d = UserDefaults.standard
        let before = d.object(forKey: Away.seenKey)
        defer { d.set(before, forKey: Away.seenKey) }
        let model = AppModel(configStore: ConfigStore(defaults: UserDefaults(suiteName: "vaic.test.away")!, bundleHost: "x.invalid"),
                             hud: HudStore(archive: NoChatArchive()), http: URLSessionTransport(), makeAuth: { _ in FakeAuthForAway() }, connectLive: false)
        let now = 1_000_000_000_000.0
        d.set(now - 3_600_000, forKey: Away.seenKey)
        model.noteSeen(now: now)
        XCTAssertNil(model.awaySince)
        d.set(now - 13 * 3_600_000, forKey: Away.seenKey)
        model.noteSeen(now: now)
        XCTAssertEqual(model.awaySince, now - 13 * 3_600_000)
        XCTAssertEqual(d.double(forKey: Away.seenKey), now)
    }
}

private final class FakeAuthForAway: AuthClient, @unchecked Sendable {
    var hasSession: Bool { false }
    func signIn(email: String, password: String) async throws -> SignInStep { .done }
    func setNewPassword(_ password: String) async throws -> SignInStep { .done }
    func confirmCode(_ code: String) async throws -> SignInStep { .done }
    func forgotPassword(email: String) async throws {}
    func confirmForgotPassword(email: String, code: String, password: String) async throws {}
    func idToken(fresh: Bool) async throws -> String? { nil }
    func signOut() async {}
}
