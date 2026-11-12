// Debug builds only: a fake AI City for the simulator and screenshots (launch argument `-demo`, or
// `-demo -signedout` to see the sign-in screens). It never talks to AWS; Release builds do not contain it.
#if DEBUG
import Foundation

enum Demo {
    @MainActor static func model() -> AppModel {
        let defaults = UserDefaults(suiteName: "vaic.demo")!
        defaults.removePersistentDomain(forName: "vaic.demo")
        let http = DemoTransport()
        let store = ConfigStore(defaults: defaults, http: http, bundleHost: "demo.ai-city.invalid")
        let args = ProcessInfo.processInfo.arguments
        let signedOut = args.contains("-signedout")
        let makeAuth: (AppConfig) -> AuthClient
        if args.contains("-demo-cognito") {
            // The real sign-in code (SRP, Keychain, refresh with rotation) against a fake Cognito, so quitting and
            // relaunching can be checked in the simulator. The tokens survive relaunches like real ones.
            let keychain = KeychainTokenStore(service: "city.ai.vaic.demo.tokens")
            if args.contains("-reset") { keychain.clear(); DemoCognito.reset() }
            makeAuth = { CognitoAuth(config: $0, http: http, store: keychain) }
        } else {
            let auth = DemoAuth(signedIn: !signedOut)
            makeAuth = { _ in auth }
        }
        let model = AppModel(configStore: store, hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: makeAuth, connectLive: false)
        http.model = model
        if let i = args.firstIndex(of: "-demo-voice"), i + 1 < args.count { showVoice(args[i + 1], on: model) }
        UserDefaults.standard.set(true, forKey: "vaic.guide.done")
        // `-away`: as if the owner was last here two days ago, so VAIC opens with "While you were away".
        if args.contains("-away") { UserDefaults.standard.set(nowMs() - 48 * 3_600_000, forKey: Away.seenKey) }
        return model
    }

    /// `-demo-voice you` holds the screen as if the owner were talking (a level that rises and falls);
    /// `-demo-voice vaic` sends one spoken-style message, so the made-up reply is thought about and then read out
    /// by the system voice with its volume at zero. Both show the aurora without a microphone.
    @MainActor private static func showVoice(_ who: String, on model: AppModel) {
        Task { @MainActor in
            try? await Task.sleep(for: .seconds(2.5))
            if who == "vaic" {
                model.voice.volume = 0
                await model.send("What's the status of the city?", byVoice: true)
            } else {
                model.voice.listening = true
                model.voice.partial = "What's the status of the city"
                while model.voice.listening {
                    let t = Date().timeIntervalSinceReferenceDate
                    model.voice.inputLevel = 0.45 + 0.4 * sin(t * 1.7) * sin(t * 0.9)
                    try? await Task.sleep(for: .milliseconds(50))
                }
            }
        }
    }

    static let config: JSONValue = [
        "region": "eu-north-1", "apiUrl": "https://api.demo.ai-city.invalid", "wsUrl": "wss://ws.demo.ai-city.invalid",
        "clientId": "demo", "userPoolId": "eu-north-1_Demo", "identityPoolId": "", "pollyVoice": "Matthew",
    ]

    static func iso(_ minutesAgo: Double) -> JSONValue {
        .string(ISO8601DateFormatter().string(from: Date().addingTimeInterval(-minutesAgo * 60)))
    }

    static var city: JSONValue {
        [
            "agents": [
                ["id": "vaic", "kind": "core", "role": "VAIC", "department": nil, "model": "haiku-5-5", "parent": nil, "state": "active"],
                ["id": "orchestrator", "kind": "core", "role": "Planner", "department": nil, "model": "fable-5-1", "parent": "vaic", "state": "active"],
                ["id": "mgr-app", "kind": "manager", "role": "App manager", "department": "App", "model": "fable-5-1", "parent": "orchestrator", "state": "active"],
                ["id": "wkr-ios-1", "kind": "worker", "role": "iOS developer", "department": "App", "model": "opus-5-5", "parent": "mgr-app", "state": "active", "worker_state": "working", "total_cost_usd": 1.42],
                ["id": "wkr-qa-1", "kind": "worker", "role": "QA tester", "department": "App", "model": "opus-5-5", "parent": "mgr-app", "state": "active", "worker_state": "review"],
                ["id": "mgr-mkt", "kind": "manager", "role": "Marketing manager", "department": "Marketing", "model": "fable-5-1", "parent": "orchestrator", "state": "active"],
                ["id": "wkr-copy-1", "kind": "worker", "role": "Copywriter", "department": "Marketing", "model": "opus-5-5", "parent": "mgr-mkt", "state": "active", "worker_state": "waiting"],
                ["id": "wkr-old-1", "kind": "worker", "role": "Researcher", "department": "Marketing", "model": "opus-5-5", "parent": "mgr-mkt", "state": "retired", "worker_state": "released", "last_active_at": iso(120)],
            ],
            "departments": [
                ["name": "App", "key": "app", "mission": "Build and ship the owner's apps.", "manager_id": "mgr-app", "state": "active", "created_at": iso(3000)],
                ["name": "Marketing", "key": "marketing", "mission": "Tell people about it.", "manager_id": "mgr-mkt", "state": "active", "created_at": iso(2000)],
                ["name": "Travel", "key": "travel", "mission": "Plan trips.", "manager_id": "mgr-trv", "state": "active", "created_at": iso(1000)],
            ],
            "tickets": [
                ["id": "t-1a2b3c4d", "goal": "Build the iOS app for AI City", "from": "mgr-app", "to": "wkr-ios-1", "status": "in_progress", "department": "App", "parent_id": nil, "created_at": iso(50), "updated_at": iso(3)],
                ["id": "t-2b3c4d5e", "goal": "Test the sign-in screens", "from": "mgr-app", "to": "wkr-qa-1", "status": "in_review", "department": "App", "parent_id": nil, "created_at": iso(40), "updated_at": iso(8)],
                ["id": "t-3c4d5e6f", "goal": "Write the launch post", "from": "mgr-mkt", "to": "wkr-copy-1", "status": "waiting_on_owner", "department": "Marketing", "parent_id": nil, "created_at": iso(30), "updated_at": iso(12)],
            ],
            "parked": [],
            "questions": [
                ["id": "q-1", "asked_by": "wkr-copy-1", "path": "Marketing › Copywriter", "ticket_id": "t-3c4d5e6f", "text": "Should the launch post be casual or formal?", "options": ["Casual", "Formal"], "default_answer": "Casual", "status": "open", "created_at": iso(12)],
            ],
            "approvals": [
                ["id": "ap-1", "agent": "wkr-ios-1", "action": "git push origin ios-app", "reason": "Pushing a branch leaves the city.", "cost_hint": "No cost; it publishes the branch on GitHub."],
            ],
            "specialists": [],
            "usage": ["usd": 3.2, "turns": 41, "tokens": 820000],
            "spend": ["App": 2.1, "Marketing": 1.1],
            "caps": ["daily_global_usd": 10, "monthly_budget_usd": nil, "daily_department_usd": nil],
            "city": ["paused": false, "reason": nil, "running": 1, "waiting": 0],
            "activities": ["wkr-ios-1": ["activity": "coding", "detail": "SignInFlow.swift"]],
        ]
    }

    static var away: JSONValue {
        [
            "since": iso(2880),
            "jobs_finished": [["id": "j1", "name": "Build the sign-in screens", "status": "Done"], ["id": "j2", "name": "Fix the login bug", "status": "Done"]],
            "jobs_running": [["id": "j3", "name": "Write the launch post", "status": "Working on it"]],
            "decided": 14,
            "handled_by_standing_orders": [["source": "jira", "item": "SUP-12", "summary": "Customer Support answered 6 new Jira tickets"]],
            "when_youre_back": [["id": "back-slack", "title": "Slack sign-in expired", "why": "Slack needs you to sign in again.", "service": "slack"]],
        ]
    }
    static let orders: JSONValue = [
        ["id": "so-1", "source": "jira", "instructions": "Answer new tickets in project SUP; hand bugs to App", "department": "Customer Support", "every_minutes": 15, "enabled": true],
        ["id": "so-2", "source": "slack", "instructions": "Answer questions in #help", "department": "App", "every_minutes": 60, "enabled": false],
    ]

    static var chief: JSONValue {
        [
            "enabled": true,
            "decided": [
                ["id": "q-0", "kind": "question", "title": "Which font should the sign-in screen use?", "choice": "The system font",
                 "reason": "It matches iOS and needs no licence.", "at": iso(25), "department": "App"],
                ["id": "ap-0", "kind": "approval", "title": "Run the unit tests on its work computer", "choice": "Approved",
                 "reason": "Tests change nothing and cost almost nothing.", "at": iso(180), "department": "App"],
            ],
            "needs_owner": [["id": "ap-1", "title": "git push origin ios-app", "why": "Publishing a branch on GitHub is yours to decide."]],
        ]
    }

    static var settings: JSONValue {
        ["settings": [
            "paused": false, "daily_global_usd": 10, "monthly_budget_usd": nil, "daily_department_usd": nil,
            "max_new_sessions_per_second": 20,
            "profile_prefix": "global", "notify_email": true, "first_run_done": true,
            "integrations": ["github": false, "google_calendar": false],
        ]]
    }

    static var costs: JSONValue {
        let s: (Double, Double) -> JSONValue = { usd, turns in ["usd": .number(usd), "turns": .number(turns), "tokens": 100000, "cache_savings_usd": 0.4] }
        return [
            "today": s(3.2, 41), "month": s(48.6, 610),
            "by_department": ["App": s(30.1, 400), "Marketing": s(18.5, 210)],
            "by_role": ["worker": s(31, 380), "manager": s(12, 150), "vaic": s(5.6, 80)],
            "by_model": ["Opus 5.5": s(31, 380), "Fable 5.1": s(12, 150), "Haiku 5.5": s(5.6, 80)],
            "caps": ["daily_global_usd": 10, "monthly_budget_usd": nil, "daily_department_usd": nil],
            "cost_explorer_url": "https://console.aws.amazon.com/costmanagement/home#/cost-explorer",
        ]
    }

    static let reply = """
    Here's where things stand:

    - **App**: the iOS developer is *building the sign-in screens*; QA is reviewing.
    - **Marketing**: the copywriter needs your call on the tone (see Needs you).

    Want me to push anything along?
    """
}

final class DemoTransport: HTTPTransport, @unchecked Sendable {
    weak var model: AppModel?

    func sendWithHeaders(_ request: URLRequest) async throws -> (Data, Int, [String: String]) {
        let (data, status) = try await send(request)
        return (data, status, request.httpMethod == "PUT" ? ["ETag": "\"demo-etag\""] : [:])
    }

    func send(_ request: URLRequest) async throws -> (Data, Int) {
        if request.url?.host?.hasPrefix("cognito-idp.") == true { return try DemoCognito.answer(request) }
        if let bearer = request.value(forHTTPHeaderField: "Authorization") { DemoCognito.defaults.set(bearer, forKey: "lastBearer") }
        let path = request.url?.path ?? ""
        let method = request.httpMethod ?? "GET"
        let body: JSONValue
        switch (method, path) {
        case ("GET", "/config.json"): body = Demo.config
        case ("GET", "/city"): body = Demo.city
        case ("GET", "/settings"): body = Demo.settings
        case ("PUT", "/settings"): body = Demo.settings
        case ("GET", "/costs"): body = Demo.costs
        case ("GET", "/chief-of-staff"): body = Demo.chief
        case ("GET", "/away-summary"): body = Demo.away
        case ("GET", "/standing-orders"): body = ["standing_orders": Demo.orders]
        case ("GET", "/tickets"):
            body = request.url?.query?.contains("done") == true ? ["tickets": []] : ["tickets": Demo.city["tickets"]]
        case ("GET", let p) where p.hasPrefix("/tickets/"):
            body = ["ticket": Demo.city["tickets"].array[0], "history": [["from": nil, "to": "open", "note": "", "at": Demo.iso(50)], ["from": "open", "to": "in_progress", "note": "hired an iOS developer", "at": Demo.iso(45)]], "children": []]
        case ("POST", "/devices"): body = ["device": ["id": "dev-demo"]]
        // The + menu: uploads land in a fake bucket and are "ready" a moment later; two connectors, two skills.
        case ("POST", "/knowledge/uploads"):
            let req = request.httpBody.flatMap(JSONValue.parse) ?? .null
            let id = "k-\(DemoCognito.defaults.integer(forKey: "knowledgeCount") + 1)"
            DemoCognito.defaults.set(DemoCognito.defaults.integer(forKey: "knowledgeCount") + 1, forKey: "knowledgeCount")
            let name = req["file_name"].string ?? "file"
            let type = req["content_type"].string ?? ""
            let kind = type.hasPrefix("image/") ? "image" : type.hasPrefix("video/") ? "video" : type.hasPrefix("audio/") ? "audio" : "document"
            body = ["item": ["id": .string(id), "kind": .string(kind), "title": .string(name), "scope": "relevant", "status": "uploading"],
                    "upload": ["method": "PUT", "url": .string("https://knowledge.demo.ai-city.invalid/put/\(id)"), "headers": ["Content-Type": .string(type)]]]
        case ("PUT", let p) where p.hasPrefix("/put/"):
            let id = String(p.dropFirst("/put/".count))
            Task { @MainActor [weak self] in await self?.readyKnowledge(id) }
            body = [:]
        case ("DELETE", let p) where p.hasPrefix("/knowledge/"): body = ["ok": true]
        case ("GET", "/connectors"):
            body = ["connectors": [
                ["id": "github", "label": "GitHub", "status": "ready", "tools": [["name": "search"], ["name": "read_file"], ["name": "open_pr"]]],
                ["id": "heygen", "label": "HeyGen", "status": "needs_key"],
            ]]
        case ("GET", "/skills"):
            body = ["skills": [
                ["name": "pdf-report", "description": "Turns findings into a one-page PDF", "enabled": true, "roles": ["worker"]],
                ["name": "old-one", "description": "Retired", "enabled": false, "roles": ["worker"]],
            ]]
        case ("POST", "/messages"):
            Task { @MainActor [weak self] in await self?.streamReply() }
            body = ["accepted": true]
        default: body = ["ok": true]
        }
        return (try JSONEncoder().encode(body), method == "POST" && path == "/messages" ? 202 : 200)
    }

    /// The bucket told the server: the item is being read, then ready (two `knowledge.updated` events).
    @MainActor private func readyKnowledge(_ id: String) async {
        guard let hud = model?.hud else { return }
        try? await Task.sleep(for: .milliseconds(600))
        hud.event(["type": "knowledge.updated", "id": .string(id), "status": "processing", "title": "", "scope": "relevant"])
        try? await Task.sleep(for: .seconds(2))
        hud.event(["type": "knowledge.updated", "id": .string(id), "status": "ready", "title": "", "scope": "relevant"])
    }

    @MainActor private func streamReply() async {
        guard let hud = model?.hud else { return }
        try? await Task.sleep(for: .milliseconds(700))
        hud.event(["type": "activity", "id": "vaic", "activity": "reading", "detail": "mcp__city__get_status"])
        try? await Task.sleep(for: .milliseconds(900))
        var sent = ""
        for word in Demo.reply.split(separator: " ", omittingEmptySubsequences: false) {
            let piece = (sent.isEmpty ? "" : " ") + word
            sent += piece
            hud.event(["type": "vaic.reply", "conversation": "main", "text": .string(piece), "done": false])
            try? await Task.sleep(for: .milliseconds(40))
        }
        hud.event(["type": "vaic.reply", "conversation": "main", "text": .string(Demo.reply), "done": true])
    }
}

/// A fake Cognito for `-demo-cognito`: accepts any password, the code 123456, issues ID tokens that last
/// 2 minutes (so a relaunch after a minute or more goes through a refresh) and rotates the refresh token on every
/// refresh, refusing an old one like Cognito does. Its state lives in UserDefaults "vaic.demo.cognito".
enum DemoCognito {
    static let defaults = UserDefaults(suiteName: "vaic.demo.cognito")!
    static func reset() { defaults.removePersistentDomain(forName: "vaic.demo.cognito") }

    static func answer(_ request: URLRequest) throws -> (Data, Int) {
        let target = (request.value(forHTTPHeaderField: "X-Amz-Target") ?? "").replacingOccurrences(of: "AWSCognitoIdentityProviderService.", with: "")
        let body = request.httpBody.flatMap(JSONValue.parse) ?? .null
        func tokens() -> JSONValue {
            let n = defaults.integer(forKey: "generation") + 1
            defaults.set(n, forKey: "generation")
            defaults.set("refresh-\(n)", forKey: "refresh")
            return ["AuthenticationResult": ["IdToken": .string("id-\(n)"), "AccessToken": .string("access-\(n)"),
                                             "RefreshToken": .string("refresh-\(n)"), "ExpiresIn": 120]]
        }
        let out: JSONValue
        var status = 200
        switch target {
        case "InitiateAuth":
            out = ["ChallengeName": "PASSWORD_VERIFIER", "ChallengeParameters": ["USER_ID_FOR_SRP": "demo-user", "SRP_B": "2", "SALT": "ab", "SECRET_BLOCK": "AAAA"]]
        case "RespondToAuthChallenge" where body["ChallengeName"].string == "PASSWORD_VERIFIER":
            out = ["ChallengeName": "SOFTWARE_TOKEN_MFA", "Session": "s-1", "ChallengeParameters": [:]]
        case "RespondToAuthChallenge":
            if body["ChallengeResponses"]["SOFTWARE_TOKEN_MFA_CODE"].string == "123456" {
                defaults.set(defaults.integer(forKey: "signIns") + 1, forKey: "signIns")
                out = tokens()
            } else { out = ["__type": "CodeMismatchException"]; status = 400 }
        case "GetTokensFromRefreshToken":
            if let r = body["RefreshToken"].string, r == defaults.string(forKey: "refresh") {
                defaults.set(defaults.integer(forKey: "refreshes") + 1, forKey: "refreshes")
                out = tokens()
            } else { out = ["__type": "NotAuthorizedException", "message": "Invalid Refresh Token"]; status = 400 }
        case "RevokeToken":
            defaults.removeObject(forKey: "refresh")
            out = [:]
        default:
            out = ["__type": "InvalidParameterException"]; status = 400
        }
        return (try JSONEncoder().encode(out), status)
    }
}

final class DemoAuth: AuthClient, @unchecked Sendable {
    private var signedIn: Bool
    init(signedIn: Bool) { self.signedIn = signedIn }
    var hasSession: Bool { signedIn }
    func signIn(email: String, password: String) async throws -> SignInStep {
        if password == "wrong" { throw CognitoError(name: "NotAuthorizedException", message: "") }
        return password == "first" ? .newPassword : .totpCode
    }
    func setNewPassword(_ password: String) async throws -> SignInStep {
        .totpSetup(secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", uri: CognitoAuth.otpURI(secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", email: "owner@example.com"))
    }
    func confirmCode(_ code: String) async throws -> SignInStep {
        if code != "123456" { throw CognitoError(name: "CodeMismatchException", message: "") }
        signedIn = true
        return .done
    }
    func forgotPassword(email: String) async throws {}
    func confirmForgotPassword(email: String, code: String, password: String) async throws {}
    func idToken(fresh: Bool) async throws -> String? { signedIn ? "demo-token" : nil }
    func signOut() async { signedIn = false }
}
#endif
