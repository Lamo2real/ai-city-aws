// Tokens live in the Keychain only (this device, unlocked), never in UserDefaults or files.
import Foundation
import Security

struct Tokens: Codable, Equatable, Sendable {
    var idToken: String
    var accessToken: String
    var refreshToken: String
    /// When the ID and access tokens expire.
    var expiresAt: Date
}

protocol TokenStore: Sendable {
    func load() -> Tokens?
    /// False when the tokens could not be written.
    @discardableResult func save(_ tokens: Tokens) -> Bool
    func clear()
}

/// The owner signs in once: the tokens, including Cognito's refresh token (rotated on every refresh, each new
/// one saved here), stay in the Keychain until Cognito refuses the refresh token or the owner signs out.
/// They are readable after the phone's first unlock since it started (so a launch iOS prepares ahead of time,
/// or one right after unlocking, still finds them) and never leave this device (no iCloud Keychain, no backups).
struct KeychainTokenStore: TokenStore {
    var service = "city.ai.vaic.tokens"
    var account = "owner"
    static let accessible = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account,
         kSecAttrSynchronizable as String: false]
    }

    func load() -> Tokens? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        // Items saved by the first version were readable only while unlocked; move them to the current rule.
        SecItemUpdate(query as CFDictionary, [kSecAttrAccessible as String: Self.accessible] as CFDictionary)
        return try? JSONDecoder().decode(Tokens.self, from: data)
    }

    /// Updates the item in place (so a failed write never leaves the owner without tokens), or adds it.
    @discardableResult
    func save(_ tokens: Tokens) -> Bool {
        guard let data = try? JSONEncoder().encode(tokens) else { return false }
        let change: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: Self.accessible]
        let updated = SecItemUpdate(query as CFDictionary, change as CFDictionary)
        if updated == errSecSuccess { return true }
        guard updated == errSecItemNotFound else { return false }
        return SecItemAdd(query.merging(change) { $1 } as CFDictionary, nil) == errSecSuccess
    }

    func clear() { SecItemDelete(query as CFDictionary) }

    /// The protection class the stored item has (for tests).
    func accessibility() -> String? {
        var q = query
        q[kSecReturnAttributes as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let attrs = out as? [String: Any] else { return nil }
        return attrs[kSecAttrAccessible as String] as? String
    }
}

/// For tests and previews.
final class MemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var tokens: Tokens?
    init(_ t: Tokens? = nil) { tokens = t }
    func load() -> Tokens? { lock.withLock { tokens } }
    @discardableResult func save(_ t: Tokens) -> Bool { lock.withLock { tokens = t }; return true }
    func clear() { lock.withLock { tokens = nil } }
}
