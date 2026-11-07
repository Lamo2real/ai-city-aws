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
    func save(_ tokens: Tokens)
    func clear()
}

struct KeychainTokenStore: TokenStore {
    var service = "city.ai.aic.tokens"
    var account = "owner"

    private var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
    }

    func load() -> Tokens? {
        var q = query
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
        return try? JSONDecoder().decode(Tokens.self, from: data)
    }

    func save(_ tokens: Tokens) {
        guard let data = try? JSONEncoder().encode(tokens) else { return }
        SecItemDelete(query as CFDictionary)
        var q = query
        q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(q as CFDictionary, nil)
    }

    func clear() { SecItemDelete(query as CFDictionary) }
}

/// For tests and previews.
final class MemoryTokenStore: TokenStore, @unchecked Sendable {
    private let lock = NSLock()
    private var tokens: Tokens?
    init(_ t: Tokens? = nil) { tokens = t }
    func load() -> Tokens? { lock.withLock { tokens } }
    func save(_ t: Tokens) { lock.withLock { tokens = t } }
    func clear() { lock.withLock { tokens = nil } }
}
