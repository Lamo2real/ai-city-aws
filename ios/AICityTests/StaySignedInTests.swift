import Security
import XCTest
@testable import AICity

/// The owner signs in once. After that, opening the app (even weeks later) refreshes the tokens silently with
/// the refresh token from the Keychain; only a refresh token Cognito refuses shows the sign-in screen.
@MainActor
final class StaySignedInTests: XCTestCase {
    let launchDay = ISO8601DateFormatter().date(from: "2026-11-21T08:00:00Z")!  // two weeks after signing in

    // MARK: The token store

    func testKeychainKeepsTokensAfterFirstUnlockOnThisDeviceOnly() {
        let k = KeychainTokenStore(service: "city.ai.vaic.tests.\(UUID().uuidString)")
        defer { k.clear() }
        let t = Tokens(idToken: "i", accessToken: "a", refreshToken: "r", expiresAt: launchDay)
        XCTAssertTrue(k.save(t))
        XCTAssertEqual(k.load(), t)
        XCTAssertEqual(k.accessibility(), kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
    }

    func testKeychainSaveReplacesInPlace() {
        let k = KeychainTokenStore(service: "city.ai.vaic.tests.\(UUID().uuidString)")
        defer { k.clear() }
        XCTAssertTrue(k.save(Tokens(idToken: "i1", accessToken: "a1", refreshToken: "r1", expiresAt: launchDay)))
        XCTAssertTrue(k.save(Tokens(idToken: "i2", accessToken: "a2", refreshToken: "r2", expiresAt: launchDay)))
        XCTAssertEqual(k.load()?.refreshToken, "r2", "the rotated refresh token replaces the old one")
    }

    func testOldUnlockedOnlyItemsMoveToTheNewProtection() throws {
        let service = "city.ai.vaic.tests.\(UUID().uuidString)"
        let data = try JSONEncoder().encode(Tokens(idToken: "i", accessToken: "a", refreshToken: "r", expiresAt: launchDay))
        let add: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "owner",
                                  kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly]
        XCTAssertEqual(SecItemAdd(add as CFDictionary, nil), errSecSuccess)
        let k = KeychainTokenStore(service: service)
        defer { k.clear() }
        XCTAssertEqual(k.load()?.refreshToken, "r", "a token saved by the first version is still found")
        XCTAssertEqual(k.accessibility(), kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly as String)
    }

    // MARK: Launch and foreground, with a fake Cognito

    /// A fake Cognito and API: rotates the refresh token, refuses an old or unknown one, records bearer tokens.
    final class World: @unchecked Sendable {
        var validRefresh: String? = "refresh-1"
        var generation = 1
        var online = true
        var refreshes = 0
        var bearers: [String] = []
        lazy var http = FakeHTTP { [unowned self] s in
            if !self.online { throw URLError(.notConnectedToInternet) }
            if s.url.hasSuffix("/config.json") {
                return (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200)
            }
            if s.url.contains("cognito-idp") {
                XCTAssertEqual(s.headers["X-Amz-Target"], "AWSCognitoIdentityProviderService.GetTokensFromRefreshToken")
                guard let r = s.body["RefreshToken"].string, r == self.validRefresh else {
                    return (["__type": "NotAuthorizedException", "message": "Invalid Refresh Token"], 400)
                }
                self.refreshes += 1
                self.generation += 1
                self.validRefresh = "refresh-\(self.generation)"
                return (["AuthenticationResult": ["IdToken": .string("id-\(self.generation)"), "AccessToken": "a",
                                                  "RefreshToken": .string("refresh-\(self.generation)"), "ExpiresIn": 900]], 200)
            }
            self.bearers.append(s.headers["Authorization"] ?? "")
            return (["agents": [], "settings": ["first_run_done": true]], 200)
        }
    }

    private func app(_ world: World, store: TokenStore, now: Date, defaults: UserDefaults? = nil) -> AppModel {
        let cfg = ConfigStore(defaults: defaults ?? UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: world.http, bundleHost: "site.example.test")
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: world.http,
                             makeAuth: { CognitoAuth(config: $0, http: world.http, store: store, now: { now }) }, connectLive: false)
        return model
    }

    /// Two weeks after signing in, the ID token is long expired: opening the app refreshes it without asking.
    func testLaunchWeeksLaterRefreshesSilentlyAndKeepsTheRotatedToken() async {
        let world = World()
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(-14 * 86400)))
        let model = app(world, store: store, now: launchDay)
        await model.start()
        XCTAssertEqual(model.boot, .ready, "no sign-in screen")
        XCTAssertEqual(world.refreshes, 1)
        XCTAssertEqual(store.load()?.refreshToken, "refresh-2", "the rotated refresh token is saved")
        XCTAssertEqual(store.load()?.idToken, "id-2")
        XCTAssertTrue(world.bearers.allSatisfy { $0 == "Bearer id-2" } && !world.bearers.isEmpty, "API calls use the refreshed token")
    }

    func testLaunchWithFreshTokensNeedsNoNetworkForAuth() async {
        let world = World()
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(600)))
        let model = app(world, store: store, now: launchDay)
        await model.start()
        XCTAssertEqual(model.boot, .ready)
        XCTAssertEqual(world.refreshes, 0)
    }

    func testRefusedRefreshTokenShowsSignIn() async {
        let world = World()
        world.validRefresh = "something-else"  // revoked, or expired after 365 days
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(-60)))
        let model = app(world, store: store, now: launchDay)
        await model.start()
        XCTAssertEqual(model.boot, .signedOut)
        XCTAssertNil(store.load(), "a refused refresh token is forgotten")
    }

    func testNoTokensShowsSignIn() async {
        let world = World()
        let model = app(world, store: MemoryTokenStore(), now: launchDay)
        await model.start()
        XCTAssertEqual(model.boot, .signedOut)
        XCTAssertEqual(world.refreshes, 0)
    }

    /// Offline at launch with expired tokens: the app opens (with the cached settings) and stays signed in.
    func testOfflineLaunchStaysSignedIn() async {
        let world = World()
        let defaults = UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!  // the same phone: the cached config.json is here
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(-60)))
        let model = app(world, store: store, now: launchDay, defaults: defaults)
        await model.start()  // online once, so the config is cached
        XCTAssertEqual(model.boot, .ready)
        store.save(Tokens(idToken: "id-2", accessToken: "a", refreshToken: world.validRefresh!, expiresAt: launchDay.addingTimeInterval(-60)))
        world.online = false
        let again = app(world, store: store, now: launchDay, defaults: defaults)
        await again.start()
        XCTAssertEqual(again.boot, .ready, "no connection is not a reason to sign in again: the cached settings open the app")
        XCTAssertNotNil(store.load())
    }

    func testComingBackToTheForegroundRefreshes() async {
        let world = World()
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(600)))
        var now = launchDay
        let cfg = ConfigStore(defaults: UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: world.http, bundleHost: "site.example.test")
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: world.http,
                             makeAuth: { CognitoAuth(config: $0, http: world.http, store: store, now: { now }) }, connectLive: false)
        await model.start()
        XCTAssertEqual(world.refreshes, 0)
        now = launchDay.addingTimeInterval(3 * 86400)  // three days in the background
        await model.becameActive()
        XCTAssertEqual(model.boot, .ready)
        XCTAssertEqual(world.refreshes, 1)
        XCTAssertEqual(store.load()?.refreshToken, "refresh-2")
        XCTAssertEqual(world.bearers.last, "Bearer id-2", "the city reloads with the refreshed token")
        // Revoked while in the background (signed out elsewhere): back to sign-in.
        world.validRefresh = nil
        now = now.addingTimeInterval(86400)
        await model.becameActive()
        XCTAssertEqual(model.boot, .signedOut)
    }

    // MARK: Refresh races (rotation must never sign the owner out)

    /// Many calls at once with an expired token (launch: city, settings, socket, outbox): one refresh, all get
    /// the new token, the rotated refresh token is kept.
    func testConcurrentCallsShareOneRefresh() async throws {
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(-60)))
        let lock = NSLock()
        var valid = "refresh-1", n = 1, refreshes = 0
        let http = FakeHTTP { s in
            usleep(30_000)  // the request takes a while, so callers pile up
            return lock.withLock {
                guard s.body["RefreshToken"].string == valid else { return (["__type": "NotAuthorizedException"], 400) }
                refreshes += 1; n += 1; valid = "refresh-\(n)"
                return (["AuthenticationResult": ["IdToken": .string("id-\(n)"), "AccessToken": "a", "RefreshToken": .string(valid), "ExpiresIn": 900]], 200)
            }
        }
        let day = launchDay
        let auth = CognitoAuth(config: testConfig, http: http, store: store, now: { day })
        let ids = try await withThrowingTaskGroup(of: String?.self) { g in
            for i in 0..<20 {
                g.addTask {
                    try await Task.sleep(for: .milliseconds(i * 3))
                    return try await auth.idToken(fresh: false)
                }
            }
            return try await g.reduce(into: [String?]()) { $0.append($1) }
        }
        XCTAssertEqual(refreshes, 1)
        XCTAssertEqual(Set(ids.compactMap { $0 }), ["id-2"])
        XCTAssertEqual(store.load()?.refreshToken, "refresh-2")
    }

    /// A refresh refused because another one rotated the token meanwhile uses the newer token instead of
    /// signing out.
    func testRefusedBecauseRotatedMeanwhileUsesTheNewerToken() async throws {
        let store = MemoryTokenStore(Tokens(idToken: "id-1", accessToken: "a", refreshToken: "refresh-1", expiresAt: launchDay.addingTimeInterval(-60)))
        let day = launchDay
        let http = FakeHTTP { s in
            if s.body["RefreshToken"].string == "refresh-1" {
                // Meanwhile another refresh succeeded and saved refresh-2 (with an ID token that is already old).
                store.save(Tokens(idToken: "id-2", accessToken: "a", refreshToken: "refresh-2", expiresAt: day.addingTimeInterval(-1)))
                return (["__type": "NotAuthorizedException", "message": "Refresh Token has been rotated"], 400)
            }
            XCTAssertEqual(s.body["RefreshToken"].string, "refresh-2")
            return (["AuthenticationResult": ["IdToken": "id-3", "AccessToken": "a", "RefreshToken": "refresh-3", "ExpiresIn": 900]], 200)
        }
        let auth = CognitoAuth(config: testConfig, http: http, store: store, now: { day })
        let id = try await auth.idToken(fresh: false)
        XCTAssertEqual(id, "id-3")
        XCTAssertEqual(store.load()?.refreshToken, "refresh-3", "still signed in")
    }
}
