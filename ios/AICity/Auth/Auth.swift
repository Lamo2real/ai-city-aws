// Sign-in on AI City's own screens, straight against Cognito's public API (no hosted pages, no SDK):
// SRP (the password never leaves the phone), the first-login "choose your own password" step, the
// authenticator-app (TOTP) setup and code steps, "forgot password", token refresh with
// GetTokensFromRefreshToken (the app client has refresh-token rotation on), and sign-out with token
// revocation. The same app client as the web HUD (ALLOW_USER_SRP_AUTH only). Tokens: Keychain only.
import Foundation

enum SignInStep: Equatable, Sendable {
    case done
    case newPassword
    case totpSetup(secret: String, uri: String)
    case totpCode
}

protocol AuthClient: AnyObject, Sendable {
    func signIn(email: String, password: String) async throws -> SignInStep
    func setNewPassword(_ password: String) async throws -> SignInStep
    /// Confirms the authenticator app (setup) or a sign-in code.
    func confirmCode(_ code: String) async throws -> SignInStep
    func forgotPassword(email: String) async throws
    func confirmForgotPassword(email: String, code: String, password: String) async throws
    /// A valid ID token (refreshed when needed, or always with fresh), nil when the owner must sign in
    /// again. Throws only when the network is down.
    func idToken(fresh: Bool) async throws -> String?
    func signOut() async
    var hasSession: Bool { get }
}

struct CognitoError: Error, Equatable {
    let name: String
    let message: String
}

/// Plain words for Cognito's errors (never the raw message; it can name the user pool). Same as the web HUD.
func authProblem(_ e: Error) -> String {
    switch (e as? CognitoError)?.name ?? (e is URLError ? "Network" : "") {
    case "NotAuthorizedException", "UserNotFoundException":
        return "That email or password is not right. Check both and try again."
    case "CodeMismatchException", "EnableSoftwareTokenMFAException":
        return "That code is not right. Use the newest 6-digit code from your authenticator app."
    case "ExpiredCodeException":
        return "That code has expired. Ask for a new one and try again."
    case "InvalidPasswordException", "InvalidParameterException":
        return "The new password does not meet the rules below."
    case "LimitExceededException", "TooManyRequestsException", "TooManyFailedAttemptsException":
        return "Too many tries. Wait a few minutes, then try again."
    case "PasswordResetRequiredException":
        return "Your password must be reset. Use “Forgot your password?” below."
    case "SessionExpired":
        return "That took too long and the sign-in expired. Start again."
    case "Network":
        return "No connection. Check your connection and try again."
    default:
        return "Signing in did not work. Check your connection and try again."
    }
}

enum PasswordRules {
    static let rules: [(String, (String) -> Bool)] = [
        ("At least 14 characters", { $0.count >= 14 }),
        ("An uppercase letter", { $0.range(of: "[A-Z]", options: .regularExpression) != nil }),
        ("A lowercase letter", { $0.range(of: "[a-z]", options: .regularExpression) != nil }),
        ("A number", { $0.range(of: "[0-9]", options: .regularExpression) != nil }),
        ("A symbol, like ! or #", { $0.range(of: "[^A-Za-z0-9]", options: .regularExpression) != nil }),
    ]
    static func problem(_ p: String) -> String? {
        if p.count < 14 { return "Use at least 14 characters." }
        if !rules[2].1(p) { return "Add a lowercase letter." }
        if !rules[1].1(p) { return "Add an uppercase letter." }
        if !rules[3].1(p) { return "Add a number." }
        if !rules[4].1(p) { return "Add a symbol, like ! or #." }
        return nil
    }
}

final class CognitoAuth: AuthClient, @unchecked Sendable {
    private let region: String
    private let clientId: String
    private let poolName: String
    private let http: HTTPTransport
    private let store: TokenStore
    private let now: @Sendable () -> Date
    private let makeSRP: @Sendable () -> SRP.Client
    private let lock = NSLock()

    // The sign-in in progress.
    private var session: String?
    private var username = ""
    private var email = ""
    private var settingUpTotp = false
    private var refreshing: Task<String?, Error>?

    init(config: AppConfig, http: HTTPTransport = URLSessionTransport(), store: TokenStore = KeychainTokenStore(),
         now: @escaping @Sendable () -> Date = { Date() }, makeSRP: @escaping @Sendable () -> SRP.Client = { SRP.Client.random() }) {
        region = config.region
        clientId = config.clientId
        poolName = config.poolName
        self.http = http
        self.store = store
        self.now = now
        self.makeSRP = makeSRP
    }

    var hasSession: Bool { store.load() != nil }

    // MARK: Cognito's JSON API

    private func call(_ op: String, _ body: [String: Any]) async throws -> JSONValue {
        var req = URLRequest(url: URL(string: "https://cognito-idp.\(region).amazonaws.com/")!)
        req.httpMethod = "POST"
        req.setValue("application/x-amz-json-1.1", forHTTPHeaderField: "Content-Type")
        req.setValue("AWSCognitoIdentityProviderService.\(op)", forHTTPHeaderField: "X-Amz-Target")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, status) = try await http.send(req)
        let json = JSONValue.parse(data) ?? .null
        guard (200..<300).contains(status) else {
            // "__type" can be "com.amazonaws...#NotAuthorizedException" or just the name.
            let raw = json["__type"].string ?? "UnknownError"
            throw CognitoError(name: String(raw.split(separator: "#").last ?? Substring(raw)), message: json["message"].string ?? "")
        }
        return json
    }

    private func next(_ r: JSONValue) async throws -> SignInStep {
        let result = r["AuthenticationResult"]
        if let id = result["IdToken"].string, let access = result["AccessToken"].string {
            let refresh = result["RefreshToken"].string ?? store.load()?.refreshToken ?? ""
            store.save(Tokens(idToken: id, accessToken: access, refreshToken: refresh,
                              expiresAt: now().addingTimeInterval(result["ExpiresIn"].double ?? 900)))
            lock.withLock { session = nil; settingUpTotp = false }
            return .done
        }
        let params = r["ChallengeParameters"]
        lock.withLock {
            session = r["Session"].string
            if let u = params["USER_ID_FOR_SRP"].string ?? params["USERNAME"].string { username = u }
        }
        switch r["ChallengeName"].string ?? "" {
        case "NEW_PASSWORD_REQUIRED":
            return .newPassword
        case "SOFTWARE_TOKEN_MFA":
            lock.withLock { settingUpTotp = false }
            return .totpCode
        case "MFA_SETUP":
            let assoc = try await call("AssociateSoftwareToken", ["Session": currentSession()])
            guard let secret = assoc["SecretCode"].string else { throw CognitoError(name: "UnknownError", message: "") }
            lock.withLock { session = assoc["Session"].string ?? session; settingUpTotp = true }
            return .totpSetup(secret: secret, uri: Self.otpURI(secret: secret, email: email))
        default:
            throw CognitoError(name: "UnsupportedStep", message: r["ChallengeName"].string ?? "")
        }
    }

    static func otpURI(secret: String, email: String) -> String {
        var c = URLComponents()
        c.scheme = "otpauth"
        c.host = "totp"
        c.path = "/AI City:\(email)"
        c.queryItems = [URLQueryItem(name: "secret", value: secret), URLQueryItem(name: "issuer", value: "AI City")]
        return c.url?.absoluteString ?? ""
    }

    private func currentSession() throws -> String {
        guard let s = lock.withLock({ session }) else { throw CognitoError(name: "SessionExpired", message: "") }
        return s
    }

    // MARK: AuthClient

    func signIn(email rawEmail: String, password: String) async throws -> SignInStep {
        let e = rawEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        lock.withLock { email = e; username = e; session = nil; settingUpTotp = false }
        let srp = makeSRP()
        let start = try await call("InitiateAuth", [
            "AuthFlow": "USER_SRP_AUTH", "ClientId": clientId,
            "AuthParameters": ["USERNAME": e, "SRP_A": srp.srpA],
        ])
        guard start["ChallengeName"].string == "PASSWORD_VERIFIER" else { return try await next(start) }
        let p = start["ChallengeParameters"]
        guard let userId = p["USER_ID_FOR_SRP"].string, let bHex = p["SRP_B"].string, let B = BigUInt(hex: bHex),
              let saltHex = p["SALT"].string, let salt = BigUInt(hex: saltHex), let block = p["SECRET_BLOCK"].string,
              let key = srp.passwordKey(poolName: poolName, userId: userId, password: password, serverB: B, salt: salt)
        else { throw CognitoError(name: "NotAuthorizedException", message: "bad server values") }
        let ts = SRP.timestamp(now())
        guard let sig = SRP.signature(key: key, poolName: poolName, userId: userId, secretBlock: block, timestamp: ts) else {
            throw CognitoError(name: "NotAuthorizedException", message: "bad secret block")
        }
        var body: [String: Any] = [
            "ChallengeName": "PASSWORD_VERIFIER", "ClientId": clientId,
            "ChallengeResponses": ["USERNAME": userId, "PASSWORD_CLAIM_SECRET_BLOCK": block,
                                   "TIMESTAMP": ts, "PASSWORD_CLAIM_SIGNATURE": sig],
        ]
        if let s = start["Session"].string { body["Session"] = s }
        lock.withLock { username = userId }
        return try await next(try await call("RespondToAuthChallenge", body))
    }

    func setNewPassword(_ password: String) async throws -> SignInStep {
        try await next(try await call("RespondToAuthChallenge", [
            "ChallengeName": "NEW_PASSWORD_REQUIRED", "ClientId": clientId, "Session": currentSession(),
            "ChallengeResponses": ["USERNAME": lock.withLock { username }, "NEW_PASSWORD": password],
        ]))
    }

    func confirmCode(_ raw: String) async throws -> SignInStep {
        let code = raw.trimmingCharacters(in: .whitespaces)
        let user = lock.withLock { username }
        if lock.withLock({ settingUpTotp }) {
            let v = try await call("VerifySoftwareToken", ["Session": currentSession(), "UserCode": code, "FriendlyDeviceName": "AI City"])
            guard v["Status"].string == "SUCCESS" else { throw CognitoError(name: "CodeMismatchException", message: "") }
            lock.withLock { session = v["Session"].string ?? session }
            return try await next(try await call("RespondToAuthChallenge", [
                "ChallengeName": "MFA_SETUP", "ClientId": clientId, "Session": currentSession(),
                "ChallengeResponses": ["USERNAME": user],
            ]))
        }
        return try await next(try await call("RespondToAuthChallenge", [
            "ChallengeName": "SOFTWARE_TOKEN_MFA", "ClientId": clientId, "Session": currentSession(),
            "ChallengeResponses": ["USERNAME": user, "SOFTWARE_TOKEN_MFA_CODE": code],
        ]))
    }

    func forgotPassword(email: String) async throws {
        _ = try await call("ForgotPassword", ["ClientId": clientId, "Username": email.trimmingCharacters(in: .whitespaces).lowercased()])
    }

    func confirmForgotPassword(email: String, code: String, password: String) async throws {
        _ = try await call("ConfirmForgotPassword", [
            "ClientId": clientId, "Username": email.trimmingCharacters(in: .whitespaces).lowercased(),
            "ConfirmationCode": code.trimmingCharacters(in: .whitespaces), "Password": password,
        ])
    }

    func idToken(fresh: Bool = false) async throws -> String? {
        guard let t = store.load() else { return nil }
        if !fresh, t.expiresAt.timeIntervalSince(now()) > 60 { return t.idToken }
        // One refresh at a time: with rotation, a second refresh with the old token would be refused.
        let task: Task<String?, Error> = lock.withLock {
            if let r = refreshing { return r }
            let r = Task { try await self.refresh(t) }
            refreshing = r
            return r
        }
        defer { lock.withLock { refreshing = nil } }
        return try await task.value
    }

    private func refresh(_ t: Tokens) async throws -> String? {
        do {
            let r = try await call("GetTokensFromRefreshToken", ["ClientId": clientId, "RefreshToken": t.refreshToken])
            let a = r["AuthenticationResult"]
            guard let id = a["IdToken"].string, let access = a["AccessToken"].string else { store.clear(); return nil }
            store.save(Tokens(idToken: id, accessToken: access, refreshToken: a["RefreshToken"].string ?? t.refreshToken,
                              expiresAt: now().addingTimeInterval(a["ExpiresIn"].double ?? 900)))
            return id
        } catch let e as CognitoError where e.name == "NotAuthorizedException" {
            store.clear()  // refused (expired, revoked, already rotated): sign in again
            return nil
        }
    }

    func signOut() async {
        if let t = store.load() {
            _ = try? await call("RevokeToken", ["ClientId": clientId, "Token": t.refreshToken])
        }
        store.clear()
        lock.withLock { session = nil }
    }
}
