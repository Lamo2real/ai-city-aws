// VAIC calls the owner when it needs a decision (a campaign that wants to spend over the daily ad ceiling, say):
// once. Unanswered, the backend sends a message instead; answered, it doesn't. All of it stays in AWS and Apple:
// the "call" is an in-app call, not a phone number.
//
// The backend sends a PushKit VoIP push; the app reports it to CallKit at once (iOS ends apps that don't), so
// the iPhone rings full-screen, locked or not, with "Vice" calling. Thirty seconds without an answer, or a
// decline, is a missed call (`POST /calls/{id}/missed`), and the backend's message follows. An answer is
// `POST /calls/{id}/answered`, then VAIC's real-time voice (Voice/SonicLink.swift) for as long as the call lasts;
// hanging up on either side is `POST /calls/{id}/ended`. One call at a time: a second one while the first is
// still on is ended at once and missed.
//
// The message that follows a missed call carries the decision as two buttons (category VAIC_DECIDE): "Yes, go
// ahead" and "No" answer the approval from the lock screen, after Face ID.
//
// CallKit, the backend and the voice are behind small protocols so the tests run every path with fakes.
import AVFoundation
import CallKit
import Foundation
import PushKit
import UserNotifications

/// What a VoIP push says: which call, why, and the approval it is about ("" when none).
struct CallPush: Equatable {
    let id: String
    let reason: String
    let approval: String

    init(id: String, reason: String = "", approval: String = "") {
        self.id = id
        self.reason = reason
        self.approval = approval
    }

    /// `{"aps": {}, "vaic_call": {"id": "call-…", "reason": "…", "approval": "…"}}`
    init?(payload: [AnyHashable: Any]) {
        guard let c = payload["vaic_call"] as? [String: Any], let id = c["id"] as? String, !id.isEmpty else { return nil }
        self.init(id: id, reason: c["reason"] as? String ?? "", approval: c["approval"] as? String ?? "")
    }

    /// The owner's answer from a missed call's message: its button and the approval it carries.
    static func decision(action: String, userInfo: [AnyHashable: Any]) -> (approval: String, approved: Bool)? {
        guard action == Decide.yes || action == Decide.no,
              let approval = (userInfo["vaic_call"] as? [String: Any])?["approval"] as? String, !approval.isEmpty else { return nil }
        return (approval, action == Decide.yes)
    }
}

/// The two buttons on a missed call's message.
enum Decide {
    static let category = "VAIC_DECIDE"
    static let yes = "YES"
    static let no = "NO"

    static func register() {
        let c = UNNotificationCategory(identifier: category, actions: [
            UNNotificationAction(identifier: yes, title: "Yes, go ahead", options: [.authenticationRequired]),
            UNNotificationAction(identifier: no, title: "No", options: [.authenticationRequired]),
        ], intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([c])
    }
}

/// What the app needs from CallKit; tests replace it with a fake.
@MainActor
protocol CallSystem: AnyObject {
    func reportIncoming(_ uuid: UUID, completion: @escaping (Error?) -> Void)
    func reportEnded(_ uuid: UUID, reason: CXCallEndedReason)
}

/// The backend's call routes.
protocol CallBackend: AnyObject {
    func answered(_ id: String) async throws
    func missed(_ id: String) async throws
    func ended(_ id: String) async throws
    func voiceSession() async throws -> URL
}

/// The routes on the owner's API client, made when it is first needed (a call can wake the app in the background
/// before any screen exists).
final class APICallBackend: CallBackend {
    private let api: @MainActor () async -> APIClient?
    init(api: @escaping @MainActor () async -> APIClient?) { self.api = api }
    private func client() async throws -> APIClient {
        guard let a = await api() else { throw APIError.signedOut }
        return a
    }
    func answered(_ id: String) async throws { try await client().callAnswered(id) }
    func missed(_ id: String) async throws { try await client().callMissed(id) }
    func ended(_ id: String) async throws { try await client().callEnded(id) }
    func voiceSession() async throws -> URL { try await client().voiceSession() }
}

@MainActor
final class CallController {
    struct Call: Equatable {
        let uuid: UUID
        let push: CallPush
        var answered = false
    }

    /// The call ringing or on, if any.
    private(set) var current: Call?
    /// The call was answered: the app's own push-to-talk and spoken replies stop.
    var onAnswer: () -> Void = {}

    private let system: CallSystem
    private let backend: CallBackend
    private let makeLink: @MainActor (URL, String) -> SonicLink
    private let ring: Duration
    private var timer: Task<Void, Never>?
    private var link: SonicLink?
    private var audioActive = false

    /// How long the iPhone rings before the call counts as missed.
    nonisolated static let ringFor: Duration = .seconds(30)

    init(system: CallSystem, backend: CallBackend, ring: Duration = CallController.ringFor,
         makeLink: @escaping @MainActor (URL, String) -> SonicLink = { url, id in
             SonicLink(socket: WebSocketSonic(url: url), audio: SonicAudio(), callId: id)
         }) {
        self.system = system
        self.backend = backend
        self.ring = ring
        self.makeLink = makeLink
    }

    /// A VoIP push. iOS requires a call reported for every one, so even one that can't be read rings and ends.
    /// `completion` goes back to PushKit once CallKit has the call.
    func incoming(_ payload: [AnyHashable: Any], completion: @escaping () -> Void = {}) {
        let uuid = UUID()
        let push = CallPush(payload: payload)
        system.reportIncoming(uuid) { [weak self] error in
            completion()
            guard let self else { return }
            guard let push else { return self.system.reportEnded(uuid, reason: .failed) }
            if error != nil { return self.post { try await $0.missed(push.id) } }  // Focus or blocked: not shown
            if self.current != nil {  // already on a call: this one is missed
                self.system.reportEnded(uuid, reason: .unanswered)
                return self.post { try await $0.missed(push.id) }
            }
            self.current = Call(uuid: uuid, push: push)
            self.timer = Task { [weak self, ring] in
                try? await Task.sleep(for: ring)
                guard !Task.isCancelled, let self, let c = self.current, c.uuid == uuid, !c.answered else { return }
                self.system.reportEnded(uuid, reason: .unanswered)
                self.close { try await $0.missed(push.id) }
            }
        }
    }

    /// CXAnswerCallAction. False when there is no such call (the action fails).
    @discardableResult
    func answer(_ uuid: UUID) -> Bool {
        guard var c = current, c.uuid == uuid, !c.answered else { return false }
        timer?.cancel()
        c.answered = true
        current = c
        onAnswer()
        Task {
            do {
                try await backend.answered(c.push.id)
                let url = try await backend.voiceSession()
                guard current?.uuid == uuid else { return }  // hung up meanwhile
                let l = makeLink(url, c.push.id)
                l.onEnd = { [weak self] end in self?.remoteEnded(uuid, end) }
                link = l
                l.start()
                if audioActive { l.audioActivated() }
            } catch {
                remoteEnded(uuid, .failed("VAIC's voice could not start."))
            }
        }
        return true
    }

    /// CXEndCallAction: the owner declined (a missed call) or hung up.
    func endedByOwner(_ uuid: UUID) {
        guard let c = current, c.uuid == uuid else { return }
        if c.answered {
            let l = link
            close { backend in
                await l?.hangUp()
                try await backend.ended(c.push.id)
            }
        } else {
            close { try await $0.missed(c.push.id) }
        }
    }

    /// CXSetMutedCallAction.
    func setMuted(_ muted: Bool) { link?.muted = muted }

    /// VAIC's side ended (or failed): CallKit hears it, the backend gets `ended`.
    private func remoteEnded(_ uuid: UUID, _ end: SonicLink.End) {
        guard let c = current, c.uuid == uuid else { return }
        system.reportEnded(uuid, reason: end == .remote ? .remoteEnded : .failed)
        close { try await $0.ended(c.push.id) }
    }

    /// CallKit reset (providerDidReset): every call is gone.
    func reset() {
        guard let c = current else { return }
        endedByOwner(c.uuid)
    }

    // CXProviderDelegate's audio session callbacks.
    func audioActivated() {
        audioActive = true
        link?.audioActivated()
    }
    func audioDeactivated() {
        audioActive = false
        link?.audioDeactivated()
    }

    /// Ends the current call here and tells the backend once.
    private func close(_ tell: @escaping (CallBackend) async throws -> Void) {
        timer?.cancel()
        timer = nil
        current = nil
        link = nil
        post(tell)
    }

    private func post(_ tell: @escaping (CallBackend) async throws -> Void) {
        Task { [backend] in try? await tell(backend) }
    }
}

/// CallKit itself: the full-screen ring, the answer and hang-up buttons, and the audio session they hand over.
@MainActor
final class CallKitSystem: NSObject, CallSystem, CXProviderDelegate {
    weak var controller: CallController?
    private let provider: CXProvider

    override init() {
        let config = CXProviderConfiguration()
        config.supportsVideo = false
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        config.includesCallsInRecents = false
        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)  // the main queue
    }

    func reportIncoming(_ uuid: UUID, completion: @escaping (Error?) -> Void) {
        let u = CXCallUpdate()
        u.remoteHandle = CXHandle(type: .generic, value: "Vice")
        u.localizedCallerName = "Vice"
        u.hasVideo = false
        u.supportsHolding = false
        u.supportsGrouping = false
        u.supportsUngrouping = false
        u.supportsDTMF = false
        provider.reportNewIncomingCall(with: uuid, update: u) { error in
            Task { @MainActor in completion(error) }
        }
    }

    func reportEnded(_ uuid: UUID, reason: CXCallEndedReason) {
        provider.reportCall(with: uuid, endedAt: Date(), reason: reason)
    }

    nonisolated func providerDidReset(_ provider: CXProvider) {
        MainActor.assumeIsolated { controller?.reset() }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        MainActor.assumeIsolated {
            // The session is set up here; the audio itself starts only in didActivate.
            let s = AVAudioSession.sharedInstance()
            try? s.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP])
            if controller?.answer(action.callUUID) == true { action.fulfill() } else { action.fail() }
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        MainActor.assumeIsolated { controller?.endedByOwner(action.callUUID) }
        action.fulfill()
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        MainActor.assumeIsolated { controller?.setMuted(action.isMuted) }
        action.fulfill()
    }

    nonisolated func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        MainActor.assumeIsolated { controller?.audioActivated() }
    }

    nonisolated func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        MainActor.assumeIsolated { controller?.audioDeactivated() }
    }
}

/// PushKit: the VoIP token, and the pushes that become calls.
@MainActor
final class VoIPPushes: NSObject, PKPushRegistryDelegate {
    var onToken: (Data) -> Void = { _ in }
    var onCall: ([AnyHashable: Any], @escaping () -> Void) -> Void = { _, done in done() }
    private let registry = PKPushRegistry(queue: .main)

    func start() {
        registry.delegate = self
        registry.desiredPushTypes = [.voIP]
    }

    nonisolated func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
        let token = credentials.token
        MainActor.assumeIsolated { onToken(token) }
    }

    nonisolated func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType,
                                  completion: @escaping () -> Void) {
        let body = payload.dictionaryPayload
        MainActor.assumeIsolated { onCall(body, completion) }
    }
}
