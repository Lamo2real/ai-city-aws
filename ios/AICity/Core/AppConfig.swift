// The same runtime settings the web HUD reads from /config.json (written by Terraform, public values only:
// endpoints and IDs, no secrets). The app fetches them from the AI City site over HTTPS and keeps the last
// good copy, so it can start offline. Nothing secret is in the app bundle.
import Foundation

struct AppConfig: Codable, Equatable, Sendable {
    var region: String
    var apiUrl: String
    var wsUrl: String
    var clientId: String
    var userPoolId: String
    var identityPoolId: String?
    var pollyVoice: String?

    /// The part of the user pool ID after the region, used by SRP ("eu-north-1_AbC" → "AbC").
    var poolName: String { userPoolId.split(separator: "_").dropFirst().joined(separator: "_") }

    /// Refuses anything that is not HTTPS / WSS, so tokens never travel in the clear.
    func validated() throws -> AppConfig {
        guard let api = URL(string: apiUrl), api.scheme == "https", api.host != nil,
            let ws = URL(string: wsUrl), ws.scheme == "wss", ws.host != nil,
            !clientId.isEmpty, userPoolId.contains("_"), !region.isEmpty
        else { throw ConfigError.invalid }
        var c = self
        c.apiUrl = apiUrl.hasSuffix("/") ? String(apiUrl.dropLast()) : apiUrl
        return c
    }
}

enum ConfigError: LocalizedError {
    case invalid, notReachable, badAddress
    var errorDescription: String? {
        switch self {
        case .invalid: return "That site's settings don't look like AI City's. Check the address."
        case .notReachable: return "AI City's settings could not be loaded. Check your connection and the address."
        case .badAddress: return "Use the address of your AI City site, starting with https://."
        }
    }
}

/// Loads and remembers the config. The site address comes from the build setting AIC_SITE_HOST (Info.plist
/// key AICSiteHost) or, when that is empty, from what the owner typed on the Connect screen.
final class ConfigStore: @unchecked Sendable {
    private let defaults: UserDefaults
    private let http: HTTPTransport
    private let bundleHost: String?
    private static let siteKey = "aic.site"
    private static let configKey = "aic.config"

    init(defaults: UserDefaults = .standard, http: HTTPTransport = URLSessionTransport(), bundleHost: String? = ConfigStore.hostFromBundle()) {
        self.defaults = defaults
        self.http = http
        self.bundleHost = bundleHost
    }

    static func hostFromBundle() -> String? {
        let h = (Bundle.main.object(forInfoDictionaryKey: "AICSiteHost") as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
        return h.isEmpty || h.contains("$(") ? nil : h
    }

    var site: URL? {
        if let s = defaults.string(forKey: Self.siteKey), let u = URL(string: s) { return u }
        if let h = bundleHost { return URL(string: "https://\(h)") }
        return nil
    }

    var cached: AppConfig? {
        defaults.data(forKey: Self.configKey).flatMap { try? JSONDecoder().decode(AppConfig.self, from: $0) }
    }

    /// "d123.cloudfront.net", "https://d123.cloudfront.net/" → https://d123.cloudfront.net
    static func normalize(_ typed: String) throws -> URL {
        var t = typed.trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.contains("://") { t = "https://" + t }
        guard var c = URLComponents(string: t), c.scheme?.lowercased() == "https", let host = c.host, host.contains(".") else {
            throw ConfigError.badAddress
        }
        c.path = ""; c.query = nil; c.fragment = nil
        guard let u = c.url else { throw ConfigError.badAddress }
        return u
    }

    func setSite(_ url: URL) { defaults.set(url.absoluteString, forKey: Self.siteKey) }

    func forget() {
        defaults.removeObject(forKey: Self.siteKey)
        defaults.removeObject(forKey: Self.configKey)
    }

    /// Fetches config.json from the site; falls back to the last good copy when offline.
    func load() async throws -> AppConfig {
        guard let site else { throw ConfigError.badAddress }
        var req = URLRequest(url: site.appendingPathComponent("config.json"))
        req.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, status) = try await http.send(req)
            guard status == 200 else { throw ConfigError.notReachable }
            let c = try JSONDecoder().decode(AppConfig.self, from: data).validated()
            defaults.set(try JSONEncoder().encode(c), forKey: Self.configKey)
            return c
        } catch let e as ConfigError where e == .invalid {
            throw e
        } catch is DecodingError {
            throw ConfigError.invalid
        } catch {
            if let c = cached { return c }
            throw ConfigError.notReachable
        }
    }
}
