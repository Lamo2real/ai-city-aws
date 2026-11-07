import UserNotifications
import XCTest
@testable import AICity

/// Notifications: asked once after sign-in, the APNs token goes to `POST /devices` on every launch and when
/// it changes, sign-out removes this iPhone, a tap opens AIC. A fake backend and a fake iOS; no APNs.
@MainActor
final class PushTests: XCTestCase {
    final class FakeSystem: PushSystem {
        var status: UNAuthorizationStatus = .notDetermined
        var answer = true
        var asked = 0
        var registers = 0
        func authorization() async -> UNAuthorizationStatus { status }
        func requestAuthorization() async -> Bool {
            asked += 1
            status = answer ? .authorized : .denied
            return answer
        }
        func registerForRemoteNotifications() { registers += 1 }
    }

    /// The backend: gives each new token an id, the same id for a token it knows; can be offline.
    final class Backend: @unchecked Sendable {
        var online = true
        var firstRunDone = true
        var devices: [String: String] = [:]  // id → token
        lazy var http = FakeHTTP { [weak self] s in
            guard let self else { throw URLError(.cancelled) }  // the test is over; a stray Task's call
            if s.url.hasSuffix("/config.json") {
                return (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200)
            }
            if !self.online { throw URLError(.notConnectedToInternet) }
            if s.method == "POST", s.url.hasSuffix("/devices") {
                let token = s.body["token"].string ?? ""
                let id = self.devices.first { $0.value == token }?.key ?? "dev-\(self.devices.count + 1)"
                self.devices[id] = token
                return (["device": ["id": .string(id)]], 201)
            }
            if s.method == "DELETE", let r = s.url.range(of: "/devices/") {
                let id = String(s.url[r.upperBound...])
                return self.devices.removeValue(forKey: id) == nil ? (["error": "Not found."], 404) : (["ok": true], 200)
            }
            return (["agents": [], "settings": ["first_run_done": .bool(self.firstRunDone)]], 200)
        }
        var posts: [FakeHTTP.Seen] { http.seen.filter { $0.method == "POST" && $0.url.hasSuffix("/devices") } }
    }

    private func app(_ b: Backend, _ sys: FakeSystem, defaults: UserDefaults, auth: FakeAuth = FakeAuth()) -> AppModel {
        let cfg = ConfigStore(defaults: UserDefaults(suiteName: "aic.tests.\(UUID().uuidString)")!, http: b.http, bundleHost: "site.example.test")
        return AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: b.http, makeAuth: { _ in auth }, connectLive: false,
                        push: PushController(system: sys, defaults: defaults, sandbox: true))
    }

    private func freshDefaults() -> UserDefaults { UserDefaults(suiteName: "aic.tests.push.\(UUID().uuidString)")! }
    private let token1 = Data([0xab, 0xcd, 0x01])
    private let token2 = Data([0x02, 0x03])

    func testAsksOnceAfterSignInThenRegistersTheToken() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        let model = app(b, sys, defaults: d)
        await model.start()
        XCTAssertEqual(model.boot, .ready)
        XCTAssertTrue(model.push.askNow, "the one-sentence question shows after sign-in")
        XCTAssertEqual(sys.asked, 0, "iOS's prompt only after the owner says yes in the app")
        await model.push.allow()
        XCTAssertEqual(sys.asked, 1)
        XCTAssertEqual(model.push.state, .on)
        XCTAssertEqual(sys.registers, 1)
        await model.push.received(token: token1)
        XCTAssertEqual(b.posts.count, 1)
        XCTAssertEqual(b.posts[0].body, ["token": "abcd01", "platform": "ios", "sandbox": true])
        XCTAssertEqual(b.posts[0].headers["Authorization"], "Bearer tok", "owner-authenticated like every route")
        XCTAssertTrue(model.push.registered)
        XCTAssertEqual(model.push.deviceId, "dev-1")

        // Next launch: no question, register again with APNs and the backend (same token, same id).
        let again = app(b, sys, defaults: d)
        await again.start()
        XCTAssertFalse(again.push.askNow)
        XCTAssertEqual(sys.asked, 1)
        XCTAssertEqual(sys.registers, 2)
        await again.push.received(token: token1)
        XCTAssertEqual(b.posts.count, 2)
        XCTAssertEqual(b.devices, ["dev-1": "abcd01"])
    }

    func testNotNowIsNotAskedAgain() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        let model = app(b, sys, defaults: d)
        await model.start()
        XCTAssertTrue(model.push.askNow)
        model.push.notNow()
        let again = app(b, sys, defaults: d)
        await again.start()
        XCTAssertFalse(again.push.askNow)
        XCTAssertEqual(again.push.state, .notAsked, "Settings still offers to turn them on")
        XCTAssertEqual(sys.registers, 0)
        XCTAssertTrue(b.posts.isEmpty)
    }

    func testTheQuestionWaitsForTheFirstRunGuide() async {
        let b = Backend(), sys = FakeSystem()
        b.firstRunDone = false
        UserDefaults.standard.removeObject(forKey: "aic.guide.done")
        let model = app(b, sys, defaults: freshDefaults())
        await model.start()
        XCTAssertTrue(model.showGuide)
        XCTAssertFalse(model.push.askNow, "not on top of the guide")
        model.finishGuide()
        await model.push.offerIfNeeded()
        XCTAssertTrue(model.push.askNow)
        UserDefaults.standard.removeObject(forKey: "aic.guide.done")
    }

    func testANewTokenReplacesTheOldDevice() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        sys.status = .authorized
        let model = app(b, sys, defaults: d)
        await model.start()
        await model.push.received(token: token1)
        await model.push.received(token: token2)
        XCTAssertEqual(b.devices, ["dev-2": "0203"], "the old id is removed")
        XCTAssertEqual(model.push.deviceId, "dev-2")
    }

    func testOfflineRegistrationRetriesWhenTheAppComesBack() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        sys.status = .authorized
        let model = app(b, sys, defaults: d)
        await model.start()
        b.online = false
        await model.push.received(token: token1)
        XCTAssertFalse(model.push.registered)
        b.online = true
        await model.becameActive()  // iOS registers again, which hands the token again
        XCTAssertEqual(sys.registers, 2)
        await model.push.received(token: token1)
        XCTAssertTrue(model.push.registered)
        XCTAssertEqual(b.devices, ["dev-1": "abcd01"])
    }

    func testATokenBeforeSignInIsSentAfterIt() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        sys.status = .authorized
        let auth = FakeAuth()
        auth.token = nil
        let model = app(b, sys, defaults: d, auth: auth)
        await model.start()
        XCTAssertEqual(model.boot, .signedOut)
        await model.push.received(token: token1)
        XCTAssertTrue(b.posts.isEmpty, "nothing to send without a sign-in")
        auth.token = "tok"
        await model.signedIn()
        XCTAssertEqual(b.devices, ["dev-1": "abcd01"])
    }

    func testSignOutRemovesThisIPhoneFirst() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        sys.status = .authorized
        let auth = FakeAuth()
        let model = app(b, sys, defaults: d, auth: auth)
        await model.start()
        await model.push.received(token: token1)
        await model.signOut()
        XCTAssertTrue(b.devices.isEmpty)
        XCTAssertNil(model.push.deviceId)
        let delete = b.http.seen.last { $0.method == "DELETE" }
        XCTAssertEqual(delete?.url, "https://api.example.test/devices/dev-1")
        XCTAssertEqual(delete?.headers["Authorization"], "Bearer tok", "sent before the tokens are deleted")
    }

    func testOfflineSignOutRemovesTheDeviceLater() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        sys.status = .authorized
        let auth = FakeAuth()
        let model = app(b, sys, defaults: d, auth: auth)
        await model.start()
        await model.push.received(token: token1)
        b.online = false
        await model.signOut()
        b.online = true
        // Signed in again later, with a new token: the old device goes too.
        auth.token = "tok"
        await model.signedIn()
        await model.push.received(token: token2)
        XCTAssertEqual(b.devices, ["dev-2": "0203"])
    }

    func testTurnedOffInIOSSettingsRemovesThisIPhone() async {
        let b = Backend(), sys = FakeSystem(), d = freshDefaults()
        sys.status = .authorized
        let model = app(b, sys, defaults: d)
        await model.start()
        await model.push.received(token: token1)
        sys.status = .denied
        await model.becameActive()
        XCTAssertEqual(model.push.state, .off)
        XCTAssertTrue(b.devices.isEmpty)
    }

    func testRefusedRegistrationSaysWhy() async {
        let b = Backend()
        let model = app(b, FakeSystem(), defaults: freshDefaults())
        model.push.failed(NSError(domain: "APNs", code: 3000))
        XCTAssertNotNil(model.push.problem)
    }

    func testATapOpensAIC() async {
        let b = Backend()
        let model = app(b, FakeSystem(), defaults: freshDefaults())
        await model.start()
        model.open(.costs)
        model.openFromNotification()
        XCTAssertEqual(model.section, .aic)
        XCTAssertTrue(model.morePath.isEmpty)
    }

    func testSandboxComesFromTheProvisioningProfile() {
        let dev = Data("junk<plist><dict><key>Entitlements</key><dict><key>aps-environment</key>\n\t\t<string>development</string></dict></dict></plist>junk".utf8)
        let prod = Data("<key>aps-environment</key><string>production</string>".utf8)
        XCTAssertTrue(PushController.profileIsDevelopment(dev))
        XCTAssertFalse(PushController.profileIsDevelopment(prod))
        XCTAssertFalse(PushController.profileIsDevelopment(Data("no push here".utf8)))
    }
}
