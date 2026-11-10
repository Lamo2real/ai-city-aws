// The files attached to the message being written (web/src/lib/knowledge.ts, the chat's part of it): each
// one is a knowledge item, so its live status comes from the `knowledge.updated` events; this iPhone adds the
// upload percent and any failure it saw itself. A chip's × deletes the item: it was added for this message only.
import Foundation
import Observation

@MainActor
@Observable
final class Attachments {
    struct Entry: Identifiable, Equatable {
        var item: KnowledgeItem
        /// Upload percent while this iPhone is sending the file.
        var percent: Int?
        /// A failure seen only here (an upload that stopped).
        var localError: String?
        var id: String { item.id }
        var words: String { item.statusWords(percent: percent, localError: localError) }
        var failed: Bool { localError != nil || item.status == .failed }
    }

    var entries: [Entry] = []
    var items: [KnowledgeItem] { entries.map(\.item) }
    /// A message may go once every file has left the iPhone (web `sendable`).
    var sendable: Bool { Attach.sendable(items) }

    /// Uploads every file, a chip appearing as soon as the server has the item; returns plain sentences for the
    /// ones that could not start or finish.
    func add(_ files: [PickedFile], with uploader: Uploader) async -> [String] {
        await withTaskGroup(of: String?.self) { group in
            for f in files {
                group.addTask { await self.upload(f, with: uploader) }
            }
            var problems: [String] = []
            for await p in group { if let p { problems.append(p) } }
            return problems
        }
    }

    private func upload(_ f: PickedFile, with uploader: Uploader) async -> String? {
        do {
            let done = try await uploader.upload(f, onCreated: { item in
                self.entries.append(Entry(item: item, percent: 0))
            }, onProgress: { id, pct in
                if let i = self.entries.firstIndex(where: { $0.id == id && $0.item.status == .uploading }) { self.entries[i].percent = pct }
            })
            guard let i = entries.firstIndex(where: { $0.id == done.id }) else { return nil }
            // An event may already have moved it on; else the item that came back still says "uploading" only
            // because the storage has not told the server yet.
            let now = entries[i].item.status
            var item = done
            item.status = now != .uploading ? now : (done.status == .uploading ? .processing : done.status)
            entries[i].item = item
            entries[i].percent = nil
            return nil
        } catch let e as UploadError {
            if let item = e.item, let i = entries.firstIndex(where: { $0.id == item.id }) {
                entries[i].localError = e.message
                entries[i].percent = nil
            }
            return e.message
        } catch {
            return AppModel.plain(error)
        }
    }

    /// The WebSocket's `knowledge.updated`; other events are not ours.
    func apply(event e: JSONValue) {
        guard e["type"].string == "knowledge.updated", let id = e["id"].string, let i = entries.firstIndex(where: { $0.id == id }) else { return }
        var item = entries[i].item
        if let s = e["status"].string, let status = KnowledgeItem.Status(rawValue: s) { item.status = status }
        if let t = e["title"].string, !t.isEmpty { item.title = t }
        if let k = e["kind"].string { item.kind = k }
        item.error = e["error"].string
        entries[i].item = item
        if item.status != .uploading { entries[i].percent = nil }
    }

    /// The owner changed their mind before VAIC saw it: the chip goes, and so does the knowledge item.
    func remove(_ id: String, api: APIClient?) {
        entries.removeAll { $0.id == id }
        Task { try? await api?.removeKnowledge(id) }
    }

    func clear() { entries = [] }
}
