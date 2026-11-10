// Push notifications: one notification when the city finishes a large feature (a top-level job), never for
// small steps. The backend sends it through SNS → APNs to the devices registered with `POST /devices`.
//
// The app asks once, after the first sign-in, with one plain sentence why. When the owner allows it, the
// app registers with APNs on every launch (Apple's advice: the token can change) and sends the token to the
// backend; sign-out removes this iPhone from the backend first. The notification's text (job, outcome,
// cost) is written by the backend; the app shows it as is, and a tap opens the app on VAIC.
import Foundation
import Observation
import UIKit
import UserNotifications

/// What the app needs from iOS for notifications; tests replace it with a fake.
@MainActor
protocol PushSystem: AnyObject {
    func authorization() async -> UNAuthorizationStatus
    func requestAuthorization() async -> Bool
    func registerForRemoteNotifications()
}

@MainActor
final class SystemPush: PushSystem {
    func authorization() async -> UNAuthorizationStatus {
        await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }
    func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }
    func registerForRemoteNotifications() { UIApplication.shared.registerForRemoteNotifications() }
}

@MainActor
@Observable
final class PushController {
    enum State: Equatable {
        case unknown
        /// iOS hasn't asked yet.
        case notAsked
        /// The owner said no, or turned them off in iOS Settings.
        case off
        /// Allowed; `registered` says whether the backend has this iPhone.
        case on
    }

    private(set) var state: State = .unknown
    /// True once the backend has this iPhone's current token.
    private(set) var registered = false
    /// A plain sentence when this iPhone can't get notifications even though they are allowed.
    private(set) var problem: String?
    /// Shows the one-sentence question before iOS's own prompt.
    var askNow = false

    @ObservationIgnored var api: APIClient?
    @ObservationIgnored private let system: PushSystem
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private let sandbox: Bool
    @ObservationIgnored private var token: String?

    private enum Key {
        static let asked = "vaic.push.asked"
        static let device = "vaic.push.device"  // the backend's id for this iPhone
        static let token = "vaic.push.token"  // the token that id belongs to
        static let orphan = "vaic.push.orphan"  // an id sign-out couldn't remove (offline); removed later
    }

    init(system: PushSystem? = nil, defaults: UserDefaults = .standard, sandbox: Bool = PushController.apnsSandbox()) {
        self.system = system ?? SystemPush()
        self.defaults = defaults
        self.sandbox = sandbox
    }

    /// The backend's id for this iPhone, if it has one.
    var deviceId: String? { defaults.string(forKey: Key.device) }

    /// On launch and whenever the app comes back: read what iOS allows, register with APNs when allowed,
    /// and remove this iPhone from the backend when the owner turned notifications off in iOS Settings.
    func refresh() async {
        switch await system.authorization() {
        case .notDetermined:
            state = .notAsked
        case .denied:
            state = .off
            await removeDevice()
        default:  // authorized, provisional, ephemeral
            state = .on
            system.registerForRemoteNotifications()
        }
    }

    /// After the first sign-in (and after the first-run guide): ask once. "Not now" isn't asked again; the
    /// owner can turn them on in Settings.
    func offerIfNeeded() async {
        guard !defaults.bool(forKey: Key.asked), await system.authorization() == .notDetermined else { return }
        askNow = true
    }

    func notNow() {
        askNow = false
        defaults.set(true, forKey: Key.asked)
    }

    /// The owner said yes in the app: now iOS's own prompt.
    func allow() async {
        askNow = false
        defaults.set(true, forKey: Key.asked)
        _ = await system.requestAuthorization()
        await refresh()
    }

    /// APNs gave this iPhone a token (every launch; it may change).
    func received(token data: Data) async {
        problem = nil
        token = data.map { String(format: "%02x", $0) }.joined()
        await sync()
    }

    /// APNs refused to register this app, usually a build signed without the Push Notifications capability.
    func failed(_ error: Error) {
        registered = false
        problem = "This build of the app can't receive notifications (it needs the Apple Developer Program; see ios/README.md)."
    }

    /// Sends the token to the backend when signed in and allowed. Called when a token arrives and after a
    /// sign-in; does nothing until both are there.
    func sync() async {
        guard let api, let token, state == .on else { return }
        let old = deviceId
        do {
            let id = try await api.registerDevice(token: token, sandbox: sandbox)
            defaults.set(id, forKey: Key.device)
            defaults.set(token, forKey: Key.token)
            registered = true
            if let old, old != id { try? await api.unregisterDevice(old) }  // the token changed
            if let orphan = defaults.string(forKey: Key.orphan) {
                if orphan != id { try? await api.unregisterDevice(orphan) }
                defaults.removeObject(forKey: Key.orphan)
            }
        } catch {
            registered = false  // offline or refused: the next launch or return to the app tries again
        }
    }

    /// Sign-out: the backend stops sending to this iPhone. Must run while the tokens still work.
    func signOut() async {
        await removeDevice()
        token = nil
    }

    private func removeDevice() async {
        registered = false
        guard let id = deviceId else { return }
        defaults.removeObject(forKey: Key.device)
        defaults.removeObject(forKey: Key.token)
        do {
            guard let api else { throw APIError.offline }
            try await api.unregisterDevice(id)
        } catch let e as APIError where e.status == 404 {
            // already gone
        } catch {
            defaults.set(id, forKey: Key.orphan)
        }
    }

    /// Which APNs the backend must use for this build: the sandbox for builds Xcode installs (development
    /// signing), production for TestFlight and the App Store. The provisioning profile says which; builds
    /// from the App Store carry none.
    nonisolated static func apnsSandbox(bundle: Bundle = .main) -> Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        guard let url = bundle.url(forResource: "embedded", withExtension: "mobileprovision"),
              let data = try? Data(contentsOf: url) else { return false }
        return profileIsDevelopment(data)
        #endif
    }

    /// Reads `aps-environment` from a provisioning profile (a signed plist; the plist part is plain text).
    nonisolated static func profileIsDevelopment(_ profile: Data) -> Bool {
        let text = String(decoding: profile, as: UTF8.self)
        guard let key = text.range(of: "<key>aps-environment</key>") else { return false }
        return text[key.upperBound...].prefix(80).contains("development")
    }
}

/// Receives what iOS hands the app delegate (the APNs token, a tapped notification) and passes it on to the
/// model once SwiftUI has made it; anything that comes earlier (a tap that launched the app) waits.
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    private weak var model: AppModel?
    private var pendingToken: Data?
    private var pendingTap = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func attach(_ model: AppModel) {
        guard self.model !== model else { return }
        self.model = model
        if let t = pendingToken { pendingToken = nil; Task { await model.push.received(token: t) } }
        if pendingTap { pendingTap = false; model.openFromNotification() }
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        guard let model else { pendingToken = token; return }
        Task { await model.push.received(token: token) }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        model?.push.failed(error)
    }

    // A notification while the app is open: show it anyway, it's rare and it's the point.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    // The owner tapped it: open VAIC.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        guard response.actionIdentifier == UNNotificationDefaultActionIdentifier else { return }
        await MainActor.run {
            if let model { model.openFromNotification() } else { pendingTap = true }
        }
    }
}
