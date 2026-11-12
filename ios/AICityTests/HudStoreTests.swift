import XCTest
@testable import AICity

@MainActor
final class HudStoreTests: XCTestCase {
    func store() -> HudStore {
        let h = HudStore(archive: NoChatArchive())
        var t = 1000.0
        h.clock = { t += 100; return t }
        return h
    }

    func testStreamedReplyWithStepsAndSafetyNetRepeat() {
        let h = store()
        var spoken: [String] = []
        h.onReplyDone = { spoken.append($0) }
        h.chat = [ChatLine(id: "o1", who: .owner, text: "status?", state: .sent, at: 0)]
        h.presence = .thinking
        h.beginTurn()
        XCTAssertTrue(h.waitingForVaic)
        h.event(["type": "activity", "id": "vaic", "activity": "reading", "detail": "mcp__city__get_status"])
        h.event(["type": "activity", "id": "vaic", "activity": "reading", "detail": "mcp__city__get_status"])  // same step once
        XCTAssertEqual(h.turn?.steps, ["Understanding your message", "Checking the ledger"])
        h.event(["type": "vaic.reply", "conversation": "main", "text": "All ", "done": false])
        h.event(["type": "vaic.reply", "conversation": "main", "text": "good.", "done": false])
        XCTAssertEqual(h.chat.last?.text, "All good.")
        XCTAssertEqual(h.chat.last?.state, .streaming)
        XCTAssertFalse(h.waitingForVaic)
        h.event(["type": "vaic.reply", "conversation": "main", "text": "All good.", "done": true])
        XCTAssertEqual(h.chat.count, 2)
        XCTAssertEqual(h.chat.last?.state, .done)
        XCTAssertEqual(h.chat.last?.steps?.count, 2)
        XCTAssertNotNil(h.chat.last?.tookMs)
        XCTAssertNil(h.turn)
        XCTAssertEqual(h.presence, .speaking)
        // The event bus repeats the final reply: ignored.
        h.event(["type": "vaic.reply", "conversation": "main", "text": "All good.", "done": true])
        XCTAssertEqual(h.chat.count, 2)
        XCTAssertEqual(spoken, ["All good."])
    }

    func testEventsDuringSnapshotAreReplayed() {
        let h = store()
        h.beginSnapshot()
        h.event(["type": "approval.requested", "id": "ap-1", "agent": "w", "action": "a", "reason": "r"])
        h.snapshot(["agents": [], "departments": [], "tickets": [], "questions": [], "approvals": []])
        XCTAssertEqual(h.waitingCount, 1, "an event that arrived while loading is not lost")
        XCTAssertTrue(h.loaded)
    }

    func testUnsentLinesAreTheOutbox() {
        let h = store()
        h.chat = [ChatLine(id: "a", who: .owner, text: "1", state: .failed, at: 0), ChatLine(id: "b", who: .owner, text: "2", state: .sent, at: 0),
                  ChatLine(id: "c", who: .owner, text: "3", state: .queued, at: 0)]
        XCTAssertEqual(h.unsent.map(\.id), ["a", "c"])
        h.patchLine("a", state: .sent)
        XCTAssertEqual(h.unsent.map(\.id), ["c"])
    }

    func testChatArchiveKeepsLast60() throws {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("chat-\(UUID().uuidString).json")
        let a = FileChatArchive(url: url)
        a.save((0..<70).map { ChatLine(id: "\($0)", who: .owner, text: "x", state: .sent, at: 0) })
        XCTAssertEqual(a.load().count, 60)
        XCTAssertEqual(a.load().first?.id, "10")
        try? FileManager.default.removeItem(at: url)
    }

    func testOutboxKeepsAMessageThatCouldNotBeSentAndSendsItLater() async throws {
        var online = false
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/config.json") {
                return (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200)
            }
            if !online { throw URLError(.notConnectedToInternet) }
            return (["accepted": true], 202)
        }
        let defaults = UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!
        let cfg = ConfigStore(defaults: defaults, http: http, bundleHost: "site.example.test")
        let auth = FakeAuth()
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: { _ in auth }, connectLive: false)
        await model.start()
        XCTAssertEqual(model.boot, .ready)
        await model.send("  hello  ")
        XCTAssertEqual(model.hud.chat.last?.text, "hello")
        XCTAssertEqual(model.hud.chat.last?.state, .failed)
        online = true
        await model.flushOutbox()
        XCTAssertEqual(model.hud.chat.last?.state, .sent)
        let posts = http.seen.filter { $0.url.hasSuffix("/messages") }
        XCTAssertEqual(posts.count, 2)
        XCTAssertEqual(posts[0].body["client_id"], posts[1].body["client_id"], "same client id: the server ignores a repeat")
    }

    func testSignedOutBootShowsSignIn() async {
        let http = FakeHTTP { _ in (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200) }
        let cfg = ConfigStore(defaults: UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: http, bundleHost: "site.example.test")
        let auth = FakeAuth()
        auth.token = nil
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: { _ in auth }, connectLive: false)
        await model.start()
        XCTAssertEqual(model.boot, .signedOut)
    }

    /// The address is built in (VAIC_SITE_HOST → VAICSiteHost): a build without it fails with a plain sentence, never a
    /// form asking for a web address (decision 111).
    func testNoBuiltInAddressFailsPlainly() async {
        let http = FakeHTTP { _ in XCTFail("nothing is fetched without an address"); return (.null, 500) }
        let cfg = ConfigStore(defaults: UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: http, bundleHost: nil)
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: { _ in FakeAuth() }, connectLive: false)
        await model.start()
        XCTAssertEqual(model.boot, .failed("This build has no AI City address; set VAIC_SITE_HOST in ios/Config/AICity.xcconfig"))
        XCTAssertTrue(http.seen.isEmpty)
    }

    /// With the built-in address and no tokens, the first screen is the sign-in screen: config.json is read from
    /// that host, and nothing asks the owner where their AI City is.
    func testBuiltInAddressBootsToSignIn() async {
        let http = FakeHTTP { s in
            XCTAssertEqual(s.url, "https://d2lcjbjaz1khxz.cloudfront.net/config.json")
            return (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200)
        }
        let cfg = ConfigStore(defaults: UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: http, bundleHost: "d2lcjbjaz1khxz.cloudfront.net")
        let auth = FakeAuth()
        auth.token = nil
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: { _ in auth }, connectLive: false)
        await model.start()
        XCTAssertEqual(model.boot, .signedOut)
        XCTAssertEqual(http.seen.count, 1)
    }

    func testSettingsFormMatchesTheAPI() {
        var f = SettingsForm(["paused": false, "daily_global_usd": 10, "monthly_budget_usd": nil, "daily_department_usd": nil,
                              "max_new_sessions_per_second": 20, "profile_prefix": "eu", "notify_email": true, "integrations": ["github": false]])
        XCTAssertEqual(f.dailyGlobal, "10")
        XCTAssertEqual(f.monthly, "")
        f.monthly = "-1"
        XCTAssertTrue(f.capsInvalid)
        f.monthly = ""
        f.dailyGlobal = ""
        XCTAssertFalse(f.capsInvalid)
        let p = f.patch
        XCTAssertEqual(p["daily_global_usd"], .null, "empty = no limit")
        XCTAssertEqual(p["profile_prefix"], "eu")
        XCTAssertEqual(p["max_new_sessions_per_second"], 20)
        XCTAssertTrue(p["max_concurrent_workers_global"].isNull, "no agent-count limits (decision 288)")
        XCTAssertTrue(p["max_concurrent_workers_per_department"].isNull)
        XCTAssertEqual(p["integrations"], ["github": false])
        XCTAssertTrue(p["paused"].isNull, "pausing has its own route")
    }
}

final class FakeAuth: AuthClient, @unchecked Sendable {
    var token: String? = "tok"
    var hasSession: Bool { token != nil }
    func signIn(email: String, password: String) async throws -> SignInStep { .done }
    func setNewPassword(_ password: String) async throws -> SignInStep { .done }
    func confirmCode(_ code: String) async throws -> SignInStep { .done }
    func forgotPassword(email: String) async throws {}
    func confirmForgotPassword(email: String, code: String, password: String) async throws {}
    func idToken(fresh: Bool) async throws -> String? { token }
    func signOut() async { token = nil }
}
