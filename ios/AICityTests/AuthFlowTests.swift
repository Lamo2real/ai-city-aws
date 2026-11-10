import XCTest
@testable import AICity

/// The sign-in flow against a fake Cognito (no network): SRP, first-login new password, TOTP setup, TOTP
/// codes, forgot password, refresh with rotation, and sign-out with revocation. Tokens land in the store.
final class AuthFlowTests: XCTestCase {
    let fixedNow = ISO8601DateFormatter().date(from: "2026-11-07T09:05:03Z")!
    let tokens: JSONValue = ["AuthenticationResult": ["IdToken": "id-1", "AccessToken": "access-1", "RefreshToken": "refresh-1", "ExpiresIn": 900]]

    private func target(_ s: FakeHTTP.Seen) -> String {
        (s.headers["X-Amz-Target"] ?? "").replacingOccurrences(of: "AWSCognitoIdentityProviderService.", with: "")
    }

    private func passwordVerifier() -> JSONValue {
        ["ChallengeName": "PASSWORD_VERIFIER", "ChallengeParameters": [
            "USER_ID_FOR_SRP": .string(SRPVectors.userId), "SRP_B": .string(SRPVectors.bHex), "SALT": .string(SRPVectors.saltHex),
            "SECRET_BLOCK": .string(SRPVectors.secretBlock), "USERNAME": .string(SRPVectors.userId),
        ]]
    }

    private func makeAuth(_ http: FakeHTTP, store: TokenStore = MemoryTokenStore(), now: Date? = nil) -> CognitoAuth {
        var cfg = testConfig
        cfg.userPoolId = "eu-north-1_\(SRPVectors.pool)"
        let n = now ?? fixedNow
        return CognitoAuth(config: cfg, http: http, store: store, now: { n }, makeSRP: { SRP.Client(a: BigUInt(hex: SRPVectors.aHex)!) })
    }

    func testSignInWithSRPThenTotpCode() async throws {
        let store = MemoryTokenStore()
        let http = FakeHTTP { [self] s in
            switch target(s) {
            case "InitiateAuth":
                XCTAssertEqual(s.body["AuthFlow"].string, "USER_SRP_AUTH")
                XCTAssertEqual(s.body["AuthParameters"]["USERNAME"].string, "owner@example.com")
                XCTAssertEqual(s.body["AuthParameters"]["SRP_A"].string, SRPVectors.expectedA)
                XCTAssertNil(s.body["AuthParameters"]["PASSWORD"].string, "the password is never sent")
                return (passwordVerifier(), 200)
            case "RespondToAuthChallenge" where s.body["ChallengeName"].string == "PASSWORD_VERIFIER":
                let r = s.body["ChallengeResponses"]
                XCTAssertEqual(r["PASSWORD_CLAIM_SIGNATURE"].string, SRPVectors.expectedSignature)
                XCTAssertEqual(r["TIMESTAMP"].string, SRPVectors.timestamp)
                XCTAssertEqual(r["USERNAME"].string, SRPVectors.userId)
                return (["ChallengeName": "SOFTWARE_TOKEN_MFA", "Session": "s-2", "ChallengeParameters": [:]], 200)
            case "RespondToAuthChallenge":
                XCTAssertEqual(s.body["ChallengeName"].string, "SOFTWARE_TOKEN_MFA")
                XCTAssertEqual(s.body["Session"].string, "s-2")
                XCTAssertEqual(s.body["ChallengeResponses"]["SOFTWARE_TOKEN_MFA_CODE"].string, "123456")
                return (tokens, 200)
            default:
                XCTFail("unexpected \(target(s))"); return (.null, 400)
            }
        }
        let auth = makeAuth(http, store: store)
        let first = try await auth.signIn(email: " Owner@Example.com ", password: SRPVectors.password)
        XCTAssertEqual(first, .totpCode)
        XCTAssertNil(store.load())
        let done = try await auth.confirmCode("123456")
        XCTAssertEqual(done, .done)
        XCTAssertEqual(store.load()?.idToken, "id-1")
        XCTAssertEqual(store.load()?.refreshToken, "refresh-1")
        let id = try await auth.idToken(fresh: false)
        XCTAssertEqual(id, "id-1")
        XCTAssertTrue(http.seen.allSatisfy { $0.url == "https://cognito-idp.eu-north-1.amazonaws.com/" })
    }

    func testFirstLoginNewPasswordThenTotpSetup() async throws {
        let http = FakeHTTP { [self] s in
            switch (target(s), s.body["ChallengeName"].string ?? "") {
            case ("InitiateAuth", _): return (passwordVerifier(), 200)
            case ("RespondToAuthChallenge", "PASSWORD_VERIFIER"):
                return (["ChallengeName": "NEW_PASSWORD_REQUIRED", "Session": "s-np", "ChallengeParameters": ["USER_ID_FOR_SRP": .string(SRPVectors.userId)]], 200)
            case ("RespondToAuthChallenge", "NEW_PASSWORD_REQUIRED"):
                XCTAssertEqual(s.body["ChallengeResponses"]["NEW_PASSWORD"].string, "My-Own-Password-1!")
                XCTAssertEqual(s.body["Session"].string, "s-np")
                return (["ChallengeName": "MFA_SETUP", "Session": "s-setup", "ChallengeParameters": [:]], 200)
            case ("AssociateSoftwareToken", _):
                XCTAssertEqual(s.body["Session"].string, "s-setup")
                return (["SecretCode": "ABCDEFGHIJKLMNOP", "Session": "s-assoc"], 200)
            case ("VerifySoftwareToken", _):
                XCTAssertEqual(s.body["Session"].string, "s-assoc")
                XCTAssertEqual(s.body["UserCode"].string, "654321")
                return (["Status": "SUCCESS", "Session": "s-verified"], 200)
            case ("RespondToAuthChallenge", "MFA_SETUP"):
                XCTAssertEqual(s.body["Session"].string, "s-verified")
                return (tokens, 200)
            default:
                XCTFail("unexpected \(target(s))"); return (.null, 400)
            }
        }
        let auth = makeAuth(http)
        let s1 = try await auth.signIn(email: "owner@example.com", password: SRPVectors.password)
        XCTAssertEqual(s1, .newPassword)
        let s2 = try await auth.setNewPassword("My-Own-Password-1!")
        guard case .totpSetup(let secret, let uri) = s2 else { return XCTFail("expected TOTP setup, got \(s2)") }
        XCTAssertEqual(secret, "ABCDEFGHIJKLMNOP")
        XCTAssertTrue(uri.hasPrefix("otpauth://totp/AI%20City:owner@example.com?secret=ABCDEFGHIJKLMNOP"), uri)
        let s3 = try await auth.confirmCode("654321")
        XCTAssertEqual(s3, .done)
        XCTAssertTrue(auth.hasSession)
    }

    func testWrongPasswordGivesPlainWords() async {
        let http = FakeHTTP { [self] s in
            if target(s) == "InitiateAuth" { return (passwordVerifier(), 200) }
            return (["__type": "NotAuthorizedException", "message": "Incorrect username or password."], 400)
        }
        do {
            _ = try await makeAuth(http).signIn(email: "owner@example.com", password: "nope")
            XCTFail("should throw")
        } catch {
            XCTAssertEqual(error as? CognitoError, CognitoError(name: "NotAuthorizedException", message: "Incorrect username or password."))
            XCTAssertEqual(authProblem(error), "That email or password is not right. Check both and try again.")
        }
    }

    func testErrorTypeWithNamespaceIsUnderstood() async {
        let http = FakeHTTP { _ in (["__type": "com.amazonaws.cognito#CodeMismatchException"], 400) }
        do { try await makeAuth(http).forgotPassword(email: "x@y.z"); XCTFail() } catch {
            XCTAssertEqual((error as? CognitoError)?.name, "CodeMismatchException")
            XCTAssertTrue(authProblem(error).contains("code is not right"))
        }
    }

    func testRefreshUsesGetTokensFromRefreshTokenAndKeepsRotatedToken() async throws {
        let store = MemoryTokenStore(Tokens(idToken: "old-id", accessToken: "old-a", refreshToken: "old-r", expiresAt: fixedNow.addingTimeInterval(30)))
        let http = FakeHTTP { [self] s in
            XCTAssertEqual(target(s), "GetTokensFromRefreshToken")
            XCTAssertEqual(s.body["RefreshToken"].string, "old-r")
            XCTAssertEqual(s.body["ClientId"].string, "client123")
            return (["AuthenticationResult": ["IdToken": "new-id", "AccessToken": "new-a", "RefreshToken": "new-r", "ExpiresIn": 900]], 200)
        }
        let auth = makeAuth(http, store: store)
        // Close to expiry: refreshes. Two callers at once share one refresh (rotation refuses a second).
        async let a = auth.idToken(fresh: false)
        async let b = auth.idToken(fresh: false)
        let (x, y) = try await (a, b)
        XCTAssertEqual(x, "new-id")
        XCTAssertEqual(y, "new-id")
        XCTAssertEqual(store.load()?.refreshToken, "new-r")
        XCTAssertEqual(http.seen.count, 1)
    }

    func testRefusedRefreshSignsOut() async throws {
        let store = MemoryTokenStore(Tokens(idToken: "i", accessToken: "a", refreshToken: "r", expiresAt: fixedNow))
        let http = FakeHTTP { _ in (["__type": "NotAuthorizedException", "message": "Refresh Token has been revoked"], 400) }
        let id = try await makeAuth(http, store: store).idToken(fresh: true)
        XCTAssertNil(id)
        XCTAssertNil(store.load())
    }

    func testRefreshOfflineKeepsTokensAndThrows() async {
        let store = MemoryTokenStore(Tokens(idToken: "i", accessToken: "a", refreshToken: "r", expiresAt: fixedNow))
        let http = FakeHTTP { _ in throw URLError(.notConnectedToInternet) }
        do { _ = try await makeAuth(http, store: store).idToken(fresh: true); XCTFail() } catch {
            XCTAssertNotNil(store.load(), "an offline phone stays signed in")
        }
    }

    func testSignOutRevokesAndClears() async {
        let store = MemoryTokenStore(Tokens(idToken: "i", accessToken: "a", refreshToken: "r-9", expiresAt: fixedNow.addingTimeInterval(900)))
        let http = FakeHTTP { [self] s in
            XCTAssertEqual(target(s), "RevokeToken")
            XCTAssertEqual(s.body["Token"].string, "r-9")
            return ([:], 200)
        }
        await makeAuth(http, store: store).signOut()
        XCTAssertNil(store.load())
        XCTAssertEqual(http.seen.count, 1)
    }

    func testForgotPasswordFlow() async throws {
        let http = FakeHTTP { [self] s in
            switch target(s) {
            case "ForgotPassword": XCTAssertEqual(s.body["Username"].string, "owner@example.com")
            case "ConfirmForgotPassword":
                XCTAssertEqual(s.body["ConfirmationCode"].string, "12345678")
                XCTAssertEqual(s.body["Password"].string, "New-Password-123!")
            default: XCTFail()
            }
            return ([:], 200)
        }
        let auth = makeAuth(http)
        try await auth.forgotPassword(email: "Owner@example.com")
        try await auth.confirmForgotPassword(email: "owner@example.com", code: " 12345678 ", password: "New-Password-123!")
        XCTAssertEqual(http.seen.count, 2)
    }

    func testPasswordRulesMatchTheWebHUD() {
        XCTAssertEqual(PasswordRules.problem("short"), "Use at least 14 characters.")
        XCTAssertEqual(PasswordRules.problem("ALLUPPERCASE123!"), "Add a lowercase letter.")
        XCTAssertEqual(PasswordRules.problem("alllowercase123!"), "Add an uppercase letter.")
        XCTAssertEqual(PasswordRules.problem("NoNumbersHere!!x"), "Add a number.")
        XCTAssertEqual(PasswordRules.problem("NoSymbolsHere123"), "Add a symbol, like ! or #.")
        XCTAssertNil(PasswordRules.problem("Correct-Horse-9!x"))
    }

    func testKeychainStoreRoundTrip() {
        let k = KeychainTokenStore(service: "city.ai.vaic.tests.\(UUID().uuidString)")
        let t = Tokens(idToken: "i", accessToken: "a", refreshToken: "r", expiresAt: fixedNow)
        k.save(t)
        XCTAssertEqual(k.load(), t)
        k.clear()
        XCTAssertNil(k.load())
    }
}
