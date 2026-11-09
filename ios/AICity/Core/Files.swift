// Files (docs/FILES.md, decision 147) on the iPhone: what a chat line keeps of a file VAIC showed (`ace.files`),
// and its short-lived addresses from `GET /files/<id>` (fetched when the card is drawn; they last 15 minutes).
import Foundation

/// One file VAIC put in the chat: enough to draw its card; never an address (those expire).
struct ChatFile: Codable, Equatable, Identifiable, Sendable {
    var id: String
    var name: String
    var kind: String
    var contentType: String?
    var sizeBytes: Double?
    var department: String?
    var takenAt: String?
    var createdAt: String?

    init?(json: JSONValue) {
        guard let id = json["id"].string, !id.isEmpty, let name = json["name"].string else { return nil }
        self.id = id
        self.name = name
        kind = json["kind"].string ?? "other"
        contentType = json["content_type"].string
        sizeBytes = json["size_bytes"].double
        department = json["department"].string.flatMap { $0.isEmpty ? nil : $0 }
        takenAt = json["taken_at"].string.flatMap { $0.isEmpty ? nil : $0 }
        createdAt = json["created_at"].string.flatMap { $0.isEmpty ? nil : $0 }
    }

    /// "Image · 2.3 MB · Taken 12 Apr 2026 · Media"
    var meta: String {
        var parts = [Self.kindWord(kind)]
        if let s = sizeBytes, s > 0 { parts.append(ByteCountFormatter.string(fromByteCount: Int64(s), countStyle: .file)) }
        if let d = Self.date(takenAt) { parts.append("Taken \(d)") } else if let d = Self.date(createdAt) { parts.append(d) }
        if let dept = department { parts.append(dept) }
        return parts.joined(separator: " · ")
    }

    static func kindWord(_ kind: String) -> String {
        ["image": "Image", "video": "Video", "audio": "Audio", "document": "Document", "text": "Text"][kind] ?? "File"
    }

    static func date(_ iso: String?) -> String? {
        guard let iso else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        return d.map { $0.formatted(date: .abbreviated, time: .omitted) }
    }
}

/// A file with live addresses: `url` shows it, `downloadURL` saves it, `thumbURL` is its thumbnail.
struct FileLinks: Equatable, Sendable {
    var id: String
    var name: String
    var kind: String
    var contentType: String
    var description: String
    var url: URL?
    var downloadURL: URL?
    var thumbURL: URL?

    init?(json: JSONValue) {
        guard let id = json["id"].string, let name = json["name"].string else { return nil }
        self.id = id
        self.name = name
        kind = json["kind"].string ?? "other"
        contentType = json["content_type"].string ?? ""
        description = json["description"].string ?? ""
        url = json["url"].string.flatMap(URL.init(string:))
        downloadURL = json["download_url"].string.flatMap(URL.init(string:))
        thumbURL = json["thumb_url"].string.flatMap(URL.init(string:))
    }

    var isPDF: Bool { contentType.lowercased() == "application/pdf" || name.lowercased().hasSuffix(".pdf") }
}

extension APIClient {
    /// One file with fresh addresses (a 404 means it was deleted since).
    func fileLinks(_ id: String) async throws -> FileLinks {
        let r = try await request("/files/\(Self.seg(id))")
        guard let f = FileLinks(json: r) else { throw APIError(message: "That file couldn't be read.", status: 0, fix: "Open Files on the web.") }
        return f
    }
}
