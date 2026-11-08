// Uploads one file to the knowledge bucket with presigned URLs, the Swift port of web/src/lib/upload.ts
// (docs/KNOWLEDGE.md §5): `POST /knowledge/uploads` gives the item and a ticket, one PUT for a small file or
// multipart (parts PUT in parallel, each retried, then "complete" with the ETags). Progress is whole percent
// of the file's bytes, known per part for multipart; a single PUT reports only when it is done.
import Foundation

/// A file the owner picked: its bytes and what to call it.
struct PickedFile: Sendable {
    var name: String
    var contentType: String
    var data: Data
    /// The path under the picked folder, for the hidden-file check (nil for a single file).
    var relativePath: String?
}

/// What the server tells this iPhone to do with the bytes.
enum UploadTicket: Equatable, Sendable {
    case single(url: String, headers: [String: String])
    case multipart(uploadId: String, partSize: Int, partURLs: [String])

    init?(json: JSONValue) {
        if json["multipart"].bool == true, let id = json["upload_id"].string, let size = json["part_size"].double {
            self = .multipart(uploadId: id, partSize: Int(size), partURLs: json["part_urls"].array.compactMap(\.string))
        } else if let url = json["url"].string {
            self = .single(url: url, headers: json["headers"].object.compactMapValues(\.string))
        } else {
            return nil
        }
    }
}

struct UploadError: LocalizedError {
    let message: String
    /// The item, when the server had already created it (its status stays "uploading").
    let item: KnowledgeItem?
    var errorDescription: String? { message }
}

final class Uploader: Sendable {
    private let api: APIClient
    private let http: HTTPTransport
    private let retries: Int
    private let retryDelay: Duration
    private let concurrency: Int

    init(api: APIClient, http: HTTPTransport, retries: Int = 3, retryDelay: Duration = .seconds(1), concurrency: Int = 4) {
        self.api = api
        self.http = http
        self.retries = retries
        self.retryDelay = retryDelay
        self.concurrency = concurrency
    }

    /// Sends the file; `onCreated` runs (on the main actor, before any bytes go) as soon as the server has the
    /// item, and `onProgress` gets the item's id with each whole percent.
    func upload(_ file: PickedFile, onCreated: @escaping @MainActor (KnowledgeItem) -> Void = { _ in },
                onProgress: @escaping @MainActor (String, Int) -> Void = { _, _ in }) async throws -> KnowledgeItem {
        let (item, ticket) = try await api.startUpload(fileName: file.name, contentType: file.contentType, size: file.data.count)
        await onCreated(item)
        let total = max(1, file.data.count)
        do {
            switch ticket {
            case .single(let url, let headers):
                _ = try await put(url, file.data, headers)
                await onProgress(item.id, 100)
                return item
            case .multipart(let uploadId, let partSize, let partURLs):
                let etags = try await putParts(file.data, partSize: partSize, urls: partURLs) { loaded in
                    await onProgress(item.id, min(100, Int(Double(loaded) / Double(total) * 100)))
                }
                return try await api.completeUpload(id: item.id, uploadId: uploadId, etags: etags)
            }
        } catch {
            throw UploadError(message: "The upload of “\(file.name)” did not finish. Check your connection and add it again.", item: item)
        }
    }

    /// The parts, a few at once, each retried; the ETags come back in part order.
    private func putParts(_ data: Data, partSize: Int, urls: [String], progress: @escaping @Sendable (Int) async -> Void) async throws -> [String] {
        let size = max(1, partSize)
        let done = Progress()
        return try await withThrowingTaskGroup(of: (Int, String, Int).self) { group in
            var etags = [String](repeating: "", count: urls.count)
            var next = 0
            func add() {
                guard next < urls.count else { return }
                let i = next
                next += 1
                let from = min(data.count, i * size), to = min(data.count, (i + 1) * size)
                let body = data.subdata(in: from..<to)
                group.addTask { (i, try await self.put(urls[i], body, [:]), body.count) }
            }
            for _ in 0..<min(concurrency, urls.count) { add() }
            while let (i, etag, bytes) = try await group.next() {
                etags[i] = etag
                await progress(await done.add(bytes))
                add()
            }
            return etags
        }
    }

    private actor Progress {
        var loaded = 0
        func add(_ n: Int) -> Int { loaded += n; return loaded }
    }

    /// PUTs a body to a presigned URL, up to `retries` extra times (1 s, 2 s, 4 s between), and gives back the ETag.
    private func put(_ url: String, _ body: Data, _ headers: [String: String]) async throws -> String {
        guard let u = URL(string: url) else { throw UploadError(message: "Bad upload address.", item: nil) }
        var attempt = 0
        while true {
            var req = URLRequest(url: u)
            req.httpMethod = "PUT"
            for (k, v) in headers where k.lowercased() != "content-length" { req.setValue(v, forHTTPHeaderField: k) }
            req.httpBody = body
            do {
                let (_, status, response) = try await http.sendWithHeaders(req)
                guard (200..<300).contains(status) else { throw UploadError(message: "storage answered \(status)", item: nil) }
                return response.first { $0.key.lowercased() == "etag" }?.value ?? ""
            } catch {
                if attempt >= retries { throw error }
                try await Task.sleep(for: retryDelay * (1 << attempt))
                attempt += 1
            }
        }
    }
}
