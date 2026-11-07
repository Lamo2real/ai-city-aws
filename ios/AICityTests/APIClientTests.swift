import XCTest
@testable import AICity

final class APIClientTests: XCTestCase {
    private func client(_ http: FakeHTTP, token: String? = "tok", refreshed: String? = "tok2") -> APIClient {
        APIClient(baseURL: "https://api.example.test", http: http) { fresh in fresh ? refreshed : token }
    }

    func testSendsBearerTokenAndJSON() async throws {
        let http = FakeHTTP { s in
            XCTAssertEqual(s.headers["Authorization"], "Bearer tok")
            XCTAssertEqual(s.method, "POST")
            XCTAssertEqual(s.url, "https://api.example.test/messages")
            XCTAssertEqual(s.headers["Content-Type"], "application/json")
            XCTAssertEqual(s.body, ["text": "hi", "conversation": "main", "client_id": "o1"])
            return (["accepted": true], 202)
        }
        try await client(http).sendMessage("hi", clientId: "o1")
    }

    func testRoutesMatchTheWebHUD() async throws {
        let http = FakeHTTP { _ in (["settings": ["paused": false], "tickets": []], 200) }
        let c = client(http)
        try await c.answer(question: "q-1", with: "Casual")
        try await c.useDefault(question: "q-1")
        try await c.decide(approval: "ap-1", approved: true)
        try await c.setPaused(true)
        try await c.setPaused(false)
        try await c.instruct(agent: "wkr-1", text: "go")
        _ = try await c.tickets(done: true)
        _ = try await c.ticket("t-1")
        _ = try await c.costs()
        _ = try await c.settings()
        _ = try await c.saveSettings(["notify_email": false])
        let seen = http.seen.map { "\($0.method) \($0.url.replacingOccurrences(of: "https://api.example.test", with: ""))" }
        XCTAssertEqual(seen, [
            "POST /questions/q-1/answer", "POST /questions/q-1/default", "POST /approvals/ap-1", "POST /city/pause",
            "POST /city/resume", "POST /city/instruct", "GET /tickets?status=done", "GET /tickets/t-1", "GET /costs",
            "GET /settings", "PUT /settings",
        ])
        XCTAssertEqual(http.seen[2].body, ["approved": true])
        XCTAssertEqual(http.seen[5].body, ["agent_id": "wkr-1", "text": "go"])
    }

    func testIdsCannotEscapeTheirPathSegment() {
        XCTAssertEqual(APIClient.seg("../settings"), "%2E%2E%2Fsettings")
        XCTAssertEqual(APIClient.seg("q-1_a"), "q-1_a")
    }

    func testServerErrorBecomesPlainWords() async {
        let http = FakeHTTP { _ in (["error": "That question was already answered.", "fix": "Refresh the list."], 409) }
        do { try await client(http).useDefault(question: "q"); XCTFail() } catch {
            XCTAssertEqual(error as? APIError, APIError(message: "That question was already answered.", status: 409, fix: "Refresh the list."))
            XCTAssertEqual((error as? APIError)?.errorDescription, "That question was already answered. Refresh the list.")
        }
    }

    func testNoTokenMeansSignedOut() async {
        let http = FakeHTTP { _ in XCTFail("must not call the API"); return (.null, 200) }
        do { _ = try await client(http, token: nil).city(); XCTFail() } catch { XCTAssertEqual(error as? APIError, .signedOut) }
    }

    func testNetworkFailureIsOffline() async {
        let http = FakeHTTP { _ in throw URLError(.notConnectedToInternet) }
        do { _ = try await client(http).city(); XCTFail() } catch { XCTAssertEqual(error as? APIError, .offline) }
    }

    func test401RetriesOnceWithAFreshToken() async throws {
        let http = FakeHTTP { s in s.headers["Authorization"] == "Bearer tok2" ? (["ok": true], 200) : (["message": "Unauthorized"], 401) }
        let r = try await client(http).request("/city")
        XCTAssertEqual(r["ok"].bool, true)
        XCTAssertEqual(http.seen.count, 2)
    }

    func testFirstLoginEmailNeedsNoToken() async throws {
        let http = FakeHTTP { s in
            XCTAssertNil(s.headers["Authorization"])
            XCTAssertEqual(s.body, ["email": "owner@example.com"])
            return (["accepted": true], 202)
        }
        try await APIClient.requestFirstLoginEmail(apiURL: "https://api.example.test", email: " Owner@Example.com", http: http)
    }

    func testConfigLoadsValidatesAndCaches() async throws {
        let defaults = UserDefaults(suiteName: "aic.tests.\(UUID().uuidString)")!
        var online = true
        let http = FakeHTTP { s in
            if !online { throw URLError(.notConnectedToInternet) }
            XCTAssertEqual(s.url, "https://d123.cloudfront.net/config.json")
            return (["region": "eu-north-1", "apiUrl": "https://abc.execute-api.eu-north-1.amazonaws.com/", "wsUrl": "wss://ws.example.test/prod",
                     "cognitoDomain": "x", "clientId": "c", "userPoolId": "eu-north-1_P", "identityPoolId": "i", "redirectUri": "r",
                     "pollyVoice": "Matthew", "transcribeVocabulary": "v"], 200)
        }
        let store = ConfigStore(defaults: defaults, http: http, bundleHost: nil)
        store.setSite(try ConfigStore.normalize("d123.cloudfront.net/"))
        let c = try await store.load()
        XCTAssertEqual(c.apiUrl, "https://abc.execute-api.eu-north-1.amazonaws.com")
        XCTAssertEqual(c.poolName, "P")
        online = false
        let cached = try await store.load()
        XCTAssertEqual(cached, c, "offline: the last good copy")
    }

    func testConfigRefusesPlainHTTP() {
        XCTAssertThrowsError(try ConfigStore.normalize("http://d123.cloudfront.net"))
        XCTAssertThrowsError(try AppConfig(region: "r", apiUrl: "http://x.test", wsUrl: "wss://y.test", clientId: "c", userPoolId: "r_p").validated())
        XCTAssertThrowsError(try AppConfig(region: "r", apiUrl: "https://x.test", wsUrl: "ws://y.test", clientId: "c", userPoolId: "r_p").validated())
    }

    func testReconnectBackoff() {
        XCTAssertEqual(LiveConnection.delay(tries: 0, jitter: 1), 1)
        XCTAssertEqual(LiveConnection.delay(tries: 3, jitter: 1), 8)
        XCTAssertEqual(LiveConnection.delay(tries: 10, jitter: 1), 30)
        XCTAssertEqual(LiveConnection.delay(tries: 10, jitter: 0), 15)
    }
}
