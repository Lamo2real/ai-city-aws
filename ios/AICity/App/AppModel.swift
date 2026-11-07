// The app shell's state (web/src/App.tsx + lib/actions.ts): config, sign-in, the live connection, the
// outbox and the toasts. Screens call the methods here; nothing here draws.
import Foundation
import Observation

struct Toast: Identifiable, Equatable {
    enum Tone { case good, info, bad }
    let id = UUID()
    var text: String
    var tone: Tone = .info
    var undo: (@MainActor () async -> Void)?
    static func == (a: Toast, b: Toast) -> Bool { a.id == b.id }
}

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    // Tabs, in order: four areas and "More". Everything else lives in the More list, so new areas (apps,
    // knowledge, connectors, mail) are one case here, one row in `underMore` and one view in MainTabs.
    case aic, city, inbox, tickets, more
    // Under More:
    case costs, settings

    static let tabs: [AppSection] = [.aic, .city, .inbox, .tickets, .more]
    static let underMore: [AppSection] = [.costs, .settings]

    var id: String { rawValue }
    var title: String {
        switch self {
        case .aic: return "AIC"
        case .city: return "City"
        case .inbox: return "Needs you"
        case .tickets: return "Tickets"
        case .more: return "More"
        case .costs: return "Costs"
        case .settings: return "Settings"
        }
    }
    var symbol: String {
        switch self {
        case .aic: return "bubble.left.and.text.bubble.right"
        case .city: return "building.2"
        case .inbox: return "tray.full"
        case .tickets: return "ticket"
        case .more: return "ellipsis.circle"
        case .costs: return "dollarsign.circle"
        case .settings: return "gearshape"
        }
    }
}

@MainActor
@Observable
final class AppModel {
    enum Boot: Equatable { case starting, needsSite, signedOut, ready, failed(String) }

    var boot: Boot = .starting
    var section: AppSection = .aic
    /// What is open under the More tab.
    var morePath: [AppSection] = []
    var showGuide = false
    var toast: Toast?
    private(set) var config: AppConfig?

    let hud: HudStore
    let voice = VoiceController()
    /// The City scene: one web view for the app's lifetime, fed by the store.
    @ObservationIgnored private(set) lazy var cityScene: CityWebController = {
        let c = CityWebController()
        c.onReady = { [weak self, weak c] in
            guard let self, let c else { return }
            if let snap = self.hud.lastSnapshot { c.load(snapshot: snap) }
            c.resume()
        }
        return c
    }()
    @ObservationIgnored private var sceneWired = false

    /// Connects the store to the City scene the first time the City is shown.
    func wireCityScene() {
        guard !sceneWired else { return }
        sceneWired = true
        let scene = cityScene
        hud.onSceneSnapshot = { [weak scene] snap, replay in
            scene?.load(snapshot: snap)
            for e in replay { scene?.event(e) }
        }
        hud.onSceneEvent = { [weak scene] e in scene?.event(e) }
        if let snap = hud.lastSnapshot { scene.load(snapshot: snap) }
    }
    @ObservationIgnored let configStore: ConfigStore
    @ObservationIgnored private(set) var auth: AuthClient?
    @ObservationIgnored private(set) var api: APIClient?
    @ObservationIgnored private var live: LiveConnection?
    @ObservationIgnored private let makeAuth: (AppConfig) -> AuthClient
    @ObservationIgnored private let http: HTTPTransport
    @ObservationIgnored private let connectLive: Bool
    @ObservationIgnored private var toastTask: Task<Void, Never>?

    init(configStore: ConfigStore = ConfigStore(), hud: HudStore? = nil, http: HTTPTransport = URLSessionTransport(),
         makeAuth: @escaping (AppConfig) -> AuthClient = { CognitoAuth(config: $0) }, connectLive: Bool = true) {
        self.configStore = configStore
        self.hud = hud ?? HudStore()
        self.http = http
        self.makeAuth = makeAuth
        self.connectLive = connectLive
        voice.onText = { [weak self] text in Task { await self?.send(text) } }
        voice.onSpeakingDone = { [weak self] in if self?.hud.presence == .speaking { self?.hud.presence = .idle } }
        self.hud.onReplyDone = { [weak self] text in
            guard let self else { return }
            if self.voice.speakReplies { self.voice.speak(text) } else { self.hud.presence = .idle }
        }
    }

    // MARK: Boot

    func start() async {
        guard configStore.site != nil else { boot = .needsSite; return }
        do {
            let c = try await configStore.load()
            config = c
            let a = auth ?? makeAuth(c)
            auth = a
            api = APIClient(baseURL: c.apiUrl, http: http) { [weak a] fresh in try await a?.idToken(fresh: fresh) ?? nil }
            let token: String?
            do { token = try await a.idToken(fresh: false) } catch { token = a.hasSession ? "offline" : nil }
            guard token != nil else { boot = .signedOut; return }
            await ready()
        } catch {
            boot = .failed((error as? LocalizedError)?.errorDescription ?? "unknown problem")
        }
    }

    func connect(site typed: String) async throws {
        let url = try ConfigStore.normalize(typed)
        configStore.setSite(url)
        do { _ = try await configStore.load() } catch {
            configStore.forget()
            throw error
        }
        await start()
    }

    func changeSite() async {
        await signOut()
        configStore.forget()
        auth = nil
        boot = .needsSite
    }

    private func ready() async {
        boot = .ready
        wireCityScene()  // the town loads in the background, so the City tab opens drawn
        guard let c = config, let a = auth else { return }
        if connectLive {
            let l = LiveConnection(wsURL: c.wsUrl) { [weak a] fresh in try await a?.idToken(fresh: fresh) ?? nil }
            l.onEvent = { [weak self] e in self?.hud.event(e) }
            l.onStatus = { [weak self] s in
                guard let self else { return }
                let was = self.hud.live
                self.hud.live = s
                if s == .online, was != .online {
                    Task { await self.loadCity(); await self.flushOutbox() }  // events may have been missed
                }
                if s == .signedOut { self.boot = .signedOut }
            }
            live = l
            l.start()
        } else {
            hud.live = .online
            await loadCity()
        }
        if let s = try? await api?.settings(), s["first_run_done"].bool != true, !UserDefaults.standard.bool(forKey: "aic.guide.done") {
            showGuide = true
        }
    }

    func signedIn() async { await start() }

    /// Opens any area: a tab, or a page under More.
    func open(_ s: AppSection) {
        if AppSection.tabs.contains(s) { section = s; return }
        section = .more
        morePath = [s]
    }

    func signOut() async {
        live?.stop()
        live = nil
        voice.stop(send: false)
        await auth?.signOut()
        hud.city = CityState()
        hud.loaded = false
        boot = .signedOut
    }

    func finishGuide() {
        showGuide = false
        UserDefaults.standard.set(true, forKey: "aic.guide.done")
        Task { _ = try? await api?.saveSettings(["first_run_done": true]) }
    }

    // MARK: Chat and the outbox: a message that can't be sent stays marked and goes out later.

    private func newLineId() -> String { "o\(String(Int(nowMs()), radix: 36))\(UUID().uuidString.prefix(6).lowercased())" }

    func send(_ text: String) async {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        let line = ChatLine(id: newLineId(), who: .owner, text: clean, state: .queued, at: nowMs())
        hud.chat.append(line)
        hud.presence = .thinking
        hud.beginTurn()
        await deliver(line)
    }

    private func deliver(_ line: ChatLine) async {
        guard let api else { hud.patchLine(line.id, state: .failed); return }
        do {
            try await api.sendMessage(line.text, clientId: line.id)
            hud.patchLine(line.id, state: .sent)
            hud.presence = .thinking
        } catch {
            hud.patchLine(line.id, state: .failed)
            if let e = error as? APIError, e.status != 0, e.status < 500 { show(e.errorDescription ?? "Not sent.", tone: .bad) }
        }
    }

    /// Re-sends everything the outbox holds. The server ignores a line it already has (same client id).
    func flushOutbox() async {
        for l in hud.unsent { await deliver(l) }
    }

    func loadCity() async {
        guard let api else { return }
        hud.beginSnapshot()
        do { hud.snapshot(try await api.city()) } catch {
            hud.loadError = (error as? LocalizedError)?.errorDescription ?? "The city could not load."
        }
    }

    // MARK: Toasts

    func show(_ text: String, tone: Toast.Tone = .info, undo: (@MainActor () async -> Void)? = nil) {
        let t = Toast(text: text, tone: tone, undo: undo)
        toast = t
        toastTask?.cancel()
        toastTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(undo == nil ? 4 : 12))
            if self?.toast?.id == t.id { self?.toast = nil }
        }
    }

    /// The same plain sentence for any failure.
    static func plain(_ e: Error) -> String {
        (e as? APIError)?.errorDescription ?? "That did not go through. Nothing changed. Try again."
    }
}
