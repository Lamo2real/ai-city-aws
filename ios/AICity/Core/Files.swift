// Files (docs/FILES.md, decision 147) on the iPhone: what a chat line keeps of a file VAIC showed (`vaic.files`),
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

// MARK: The Files tab (docs/FILES.md §7, §11): browse, search, sort, a page at a time

/// One stored file as `GET /files` lists it; `json` keeps the whole row (its card and its addresses read from it).
struct StoredFile: Identifiable, Equatable, Sendable {
    var id: String
    var name: String
    var kind: String
    var folder: String
    var sizeBytes: Double
    var status: String
    var error: String?
    var department: String?
    var addedBy: String
    var date: String?
    var thumbURL: URL?
    var json: JSONValue

    init?(json: JSONValue) {
        guard let id = json["id"].string, let name = json["name"].string else { return nil }
        self.id = id
        self.name = name
        kind = json["kind"].string ?? "other"
        folder = json["folder"].string ?? ""
        sizeBytes = json["size_bytes"].double ?? 0
        status = json["status"].string ?? "ready"
        error = json["error"].string
        department = json["department"].string.flatMap { $0.isEmpty ? nil : $0 }
        addedBy = json["added_by"].string ?? "owner"
        date = json["taken_at"].string ?? json["created_at"].string
        thumbURL = json["thumb_url"].string.flatMap(URL.init(string:))
        self.json = json
    }

    var card: ChatFile? { ChatFile(json: json) }
    var by: String { addedBy == "owner" ? "You" : department ?? "A department" }
    /// "Image · 2.4 MB · 12 Apr 2026 · You"
    var meta: String {
        var parts = [ChatFile.kindWord(kind), ByteCountFormatter.string(fromByteCount: Int64(sizeBytes), countStyle: .file)]
        if let d = ChatFile.date(date) { parts.append(d) }
        parts.append(by)
        return parts.joined(separator: " · ")
    }
    /// The status in plain words, every error in full.
    var statusWords: String? {
        switch status {
        case "ready": return nil
        case "uploading": return "Uploading"
        case "processing": return kind == "video" || kind == "audio" ? "Watching and listening" : kind == "image" ? "Looking at it" : "Reading it"
        default: return "Failed: \(error ?? "it couldn't be described.")"
        }
    }
}

struct SubFolder: Identifiable, Hashable, Sendable {
    var name: String
    var path: String
    var files: Int?
    var id: String { path }
}

/// One page of `GET /files`.
struct FilesPage: Equatable, Sendable {
    var files: [StoredFile]
    var count: Int
    var next: Int?
    var subfolders: [SubFolder]
    var foundFolders: [SubFolder]
    var folders: [String]

    init(json: JSONValue) {
        files = json["files"].array.compactMap(StoredFile.init(json:))
        count = Int(json["count"].double ?? Double(files.count))
        next = json["next"].double.map { Int($0) }
        subfolders = json["subfolders"].array.compactMap { s in
            s["path"].string.map { SubFolder(name: s["name"].string ?? $0, path: $0, files: s["files"].double.map { Int($0) }) }
        }
        foundFolders = json["found_folders"].array.compactMap { $0.string.map { SubFolder(name: $0, path: $0, files: nil) } }
        folders = json["folders"].array.compactMap(\.string)
    }
}

/// What the screen asks for: a folder, maybe a search, a kind, a sort.
struct FilesQuery: Equatable, Hashable, Sendable {
    enum Sort: String, CaseIterable, Identifiable, Sendable {
        case best, newest, oldest, nameAZ, nameZA, largest, type
        var id: String { rawValue }
        var label: String {
            ["best": "Best match", "newest": "Newest first", "oldest": "Oldest first", "nameAZ": "Name A–Z",
             "nameZA": "Name Z–A", "largest": "Largest first", "type": "Type"][rawValue] ?? rawValue
        }
        var api: (String, String) {
            switch self {
            case .best: return ("relevance", "desc")
            case .newest: return ("date", "desc")
            case .oldest: return ("date", "asc")
            case .nameAZ: return ("name", "asc")
            case .nameZA: return ("name", "desc")
            case .largest: return ("size", "desc")
            case .type: return ("type", "asc")
            }
        }
    }

    var folder = ""
    var search = ""
    var onlyHere = false
    var kind = ""
    var sort: Sort?

    /// The query string for `GET /files` (offset added for later pages).
    func path(offset: Int = 0) -> String {
        let q = search.trimmingCharacters(in: .whitespaces)
        let s = sort ?? (q.isEmpty ? .newest : .best)
        var items: [URLQueryItem] = []
        if !q.isEmpty { items.append(.init(name: "q", value: q)) }
        if !folder.isEmpty { items.append(.init(name: "folder", value: folder)) }
        items.append(.init(name: "scope", value: q.isEmpty || (onlyHere && !folder.isEmpty) ? "here" : "all"))
        if !kind.isEmpty { items.append(.init(name: "kind", value: kind)) }
        let (sort, order) = (q.isEmpty && s == .best ? Sort.newest : s).api
        items.append(.init(name: "sort", value: sort))
        items.append(.init(name: "order", value: order))
        if offset > 0 { items.append(.init(name: "offset", value: String(offset))) }
        var c = URLComponents()
        c.queryItems = items
        return "/files?" + (c.percentEncodedQuery ?? "")
    }
}

extension APIClient {
    func files(_ q: FilesQuery, offset: Int = 0) async throws -> FilesPage { FilesPage(json: try await request(q.path(offset: offset))) }
    func updateFile(_ id: String, _ patch: JSONValue) async throws {
        try await request("/files/\(Self.seg(id))", method: "PUT", body: patch)
    }
    func deleteFile(_ id: String) async throws { try await request("/files/\(Self.seg(id))", method: "DELETE") }
    func retryFile(_ id: String) async throws { try await request("/files/\(Self.seg(id))/retry", method: "POST") }
}

/// Sends a file on disk to Files (presigned PUT up to 100 MB, else the parts read one at a time from disk, two
/// in flight, each retried), so a long video never sits in memory whole.
final class FilesUploader: Sendable {
    private let api: APIClient
    private let http: HTTPTransport
    private let retries: Int

    init(api: APIClient, http: HTTPTransport, retries: Int = 3) {
        self.api = api
        self.http = http
        self.retries = retries
    }

    func upload(_ url: URL, name: String, contentType: String, folder: String, takenAt: Date?,
                onProgress: @escaping @MainActor (Int) -> Void = { _ in }) async throws -> String {
        let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        guard size > 0 else { throw APIError(message: "“\(name)” is empty.", status: 0, fix: nil) }
        var body: [String: JSONValue] = ["file_name": .string(name), "content_type": .string(contentType),
                                         "size_bytes": .number(Double(size)), "folder": .string(folder)]
        if let takenAt { body["taken_at"] = .number((takenAt.timeIntervalSince1970 * 1000).rounded()) }
        let r = try await api.request("/files/uploads", method: "POST", body: .object(body))
        guard let id = r["file"]["id"].string, let ticket = UploadTicket(json: r["upload"]) else {
            throw APIError(message: "The upload could not start.", status: 0, fix: "Try again.")
        }
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        switch ticket {
        case .single(let u, let headers):
            _ = try await put(u, try handle.readToEnd() ?? Data(), headers)
            await onProgress(100)
        case .multipart(let uploadId, let partSize, let urls):
            var etags: [String] = []
            for (i, u) in urls.enumerated() {
                try handle.seek(toOffset: UInt64(i * partSize))
                let part = try handle.read(upToCount: partSize) ?? Data()
                etags.append(try await put(u, part, [:]))
                await onProgress(min(99, Int(Double((i + 1) * partSize) / Double(size) * 100)))
            }
            let parts: [JSONValue] = etags.enumerated().map { ["part_number": .number(Double($0.offset + 1)), "etag": .string($0.element)] }
            try await api.request("/files/uploads/\(APIClient.seg(id))/complete", method: "POST",
                                  body: ["upload_id": .string(uploadId), "parts": .array(parts)])
            await onProgress(100)
        }
        return id
    }

    private func put(_ url: String, _ body: Data, _ headers: [String: String]) async throws -> String {
        guard let u = URL(string: url) else { throw APIError(message: "Bad upload address.", status: 0, fix: nil) }
        var attempt = 0
        while true {
            var req = URLRequest(url: u)
            req.httpMethod = "PUT"
            for (k, v) in headers where k.lowercased() != "content-length" { req.setValue(v, forHTTPHeaderField: k) }
            req.httpBody = body
            do {
                let (_, status, response) = try await http.sendWithHeaders(req)
                guard (200..<300).contains(status) else {
                    throw APIError(message: "The storage answered \(status).", status: status, fix: "Try again.")
                }
                return response.first { $0.key.lowercased() == "etag" }?.value ?? ""
            } catch {
                if attempt >= retries { throw error }
                try await Task.sleep(for: .seconds(1 << attempt))
                attempt += 1
            }
        }
    }
}
