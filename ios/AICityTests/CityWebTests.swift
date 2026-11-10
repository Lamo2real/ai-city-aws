import WebKit
import XCTest
@testable import AICity

/// The bundled City page (the web HUD's own scene) and the locks around its web view.
final class CityWebTests: XCTestCase {
    func testOnlyTheCityPageMayLoad() {
        XCTAssertTrue(CityWeb.allows(URL(string: "vaic-city://city/city-embed.html")))
        XCTAssertFalse(CityWeb.allows(URL(string: "vaic-city://city/city-embed.js")), "a script is not a page")
        XCTAssertFalse(CityWeb.allows(URL(string: "https://example.com/")))
        XCTAssertFalse(CityWeb.allows(URL(string: "vaic-city://evil/city-embed.html")))
        XCTAssertFalse(CityWeb.allows(URL(string: "file:///etc/passwd")))
        XCTAssertFalse(CityWeb.allows(nil))
    }

    func testSchemeHandlerServesOnlyTheTwoBundledFiles() throws {
        let (html, htmlType) = try XCTUnwrap(CitySchemeHandler.response(for: URL(string: "vaic-city://city/city-embed.html"), bundle: .main))
        XCTAssertEqual(htmlType, "text/html")
        let page = String(decoding: html, as: UTF8.self)
        XCTAssertTrue(page.contains("connect-src 'none'"), "the page cannot reach the network")
        XCTAssertTrue(page.contains("./city-embed.js"))
        let (js, jsType) = try XCTUnwrap(CitySchemeHandler.response(for: URL(string: "vaic-city://city/city-embed.js"), bundle: .main))
        XCTAssertEqual(jsType, "text/javascript")
        XCTAssertTrue(String(decoding: js, as: UTF8.self).contains("vaicCity"))
        XCTAssertNil(CitySchemeHandler.response(for: URL(string: "vaic-city://city/Info.plist"), bundle: .main))
        XCTAssertNil(CitySchemeHandler.response(for: URL(string: "vaic-city://city/../AICity"), bundle: .main))
        XCTAssertNil(CitySchemeHandler.response(for: URL(string: "https://city/city-embed.html"), bundle: .main))
    }

    func testTapMessagesAreCheckedBeforeUse() {
        XCTAssertEqual(CityWeb.Tap(message: ["type": "agent", "id": "wkr-1"]), .agent("wkr-1"))
        XCTAssertEqual(CityWeb.Tap(message: ["type": "building", "id": "App"]), .building("App"))
        XCTAssertEqual(CityWeb.Tap(message: ["type": "none", "id": NSNull()]), CityWeb.Tap.none)
        XCTAssertEqual(CityWeb.Tap(message: ["type": "ready"]), .ready)
        XCTAssertNil(CityWeb.Tap(message: ["type": "agent"]))
        XCTAssertNil(CityWeb.Tap(message: ["type": "navigate", "id": "https://evil"]))
        XCTAssertNil(CityWeb.Tap(message: "agent"))
        XCTAssertNil(CityWeb.Tap(message: ["type": "agent", "id": String(repeating: "x", count: 500)]))
    }

    func testJSONGoesInAsPlainValues() {
        let v: JSONValue = ["a": [1, "two", nil, true]]
        let f = v.foundation as? [String: Any]
        let arr = f?["a"] as? [Any]
        XCTAssertEqual(arr?.count, 4)
        XCTAssertTrue(arr?[2] is NSNull)
    }

    @MainActor
    func testTheRealSceneLoadsAndDrawsASnapshot() async throws {
        let c = CityWebController()
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 402, height: 700))
        c.webView.frame = window.bounds
        window.addSubview(c.webView)
        window.makeKeyAndVisible()
        let ready = expectation(description: "page ready")
        c.onReady = { ready.fulfill() }
        await fulfillment(of: [ready], timeout: 20)
        c.load(snapshot: ["agents": [["id": "vaic", "kind": "core", "role": "VAIC", "department": nil, "model": "haiku-5-5", "parent": nil, "state": "active"],
                                     ["id": "wkr-1", "kind": "worker", "role": "Dev", "department": "App", "model": "opus-5-5", "parent": nil, "state": "active", "worker_state": "working"]],
                          "departments": [["name": "App", "key": "app", "state": "active", "created_at": "2026-11-01T00:00:00Z"]],
                          "tickets": [], "questions": [], "approvals": []])
        c.event(["type": "agent.hired", "agent": ["id": "wkr-2", "kind": "worker", "role": "QA", "department": "App", "model": "opus-5-5", "parent": nil, "state": "active"]])
        try await Task.sleep(for: .milliseconds(500))
        let ids = try await c.webView.callAsyncJavaScript("return document.getElementById('city').dataset.cityReady", contentWorld: .page) as? String
        XCTAssertEqual(ids, "1")
        let network = try await c.webView.callAsyncJavaScript("try { await fetch('https://example.com'); return 'reached' } catch { return 'blocked' }", contentWorld: .page) as? String
        XCTAssertEqual(network, "blocked", "the page has no network")
        // The scene took a snapshot, drew it, and its frame loop runs (scene.js reports frames per second).
        let diag = try await c.webView.callAsyncJavaScript("""
            let err = 'ok'
            try { vaicCity.load({agents: [{id: 'vaic', kind: 'core', role: 'VAIC', department: null, model: 'haiku-5-5', parent: null, state: 'active'}], departments: [], tickets: [], questions: [], approvals: []}) } catch (e) { err = String(e) }
            await new Promise(r => setTimeout(r, 2500))
            const c = document.querySelector('canvas')
            return [err, c.width > 0 && c.height > 0, Number(document.getElementById('city').dataset.fps || 0) > 0].join(' ')
            """, contentWorld: .page) as? String
        XCTAssertEqual(diag, "ok true true")
    }
}
