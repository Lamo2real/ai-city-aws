// The + menu's brains: slash commands, folder picks and the attached line (Core/Attach.swift), the port of
// web/test/attach.test.ts; plus the uploader against a fake transport and the chips' live status.
import XCTest
@testable import AICity

/// Collects values from callbacks that may run on any thread.
final class Recorder<T>: @unchecked Sendable {
    private let lock = NSLock()
    private var _values: [T] = []
    var values: [T] { lock.withLock { _values } }
    func add(_ v: T) { lock.withLock { _values.append(v) } }
}

final class AttachTests: XCTestCase {
    let commands = Slash.allCommands([Skill(name: "pdf-report", description: "The pdf-report skill"),
                                      Skill(name: "old-one", description: "The old-one skill", enabled: false)])

    func testListsBuiltInsAndEnabledSkillsFilteredByWhatIsTyped() {
        XCTAssertEqual(commands.map(\.name), Slash.builtIn.map(\.name) + ["pdf-report"])
        XCTAssertEqual(Slash.matchCommands("/", commands).map(\.name), commands.map(\.name))
        XCTAssertEqual(Slash.matchCommands("/st", commands).map(\.name), ["status", "stop"])
        XCTAssertEqual(Slash.matchCommands("/PDF", commands).map(\.name), ["pdf-report"])
        XCTAssertEqual(Slash.matchCommands("hello /status", commands), [])
        XCTAssertEqual(Slash.matchCommands("/status now", commands), [], "words after it: no longer a hint")
    }

    func testBecomesThePlainSentenceAicUnderstands() {
        XCTAssertEqual(Slash.expand("/status", commands), .send("What's the status of the city?"))
        XCTAssertEqual(Slash.expand("/home", commands), .send("Send everyone home."))
        XCTAssertEqual(Slash.expand("/status please, in one line", commands), .send("What's the status of the city? please, in one line"))
        XCTAssertEqual(Slash.expand("/connect HeyGen", commands), .send("Add HeyGen as a connector."))
        XCTAssertEqual(Slash.expand("/pdf-report one for Q3", commands), .send("Use the “pdf-report” skill: one for Q3"))
    }

    func testAsksForTheMissingWordsClearsLocallyAndLeavesUnknownSlashesAlone() {
        guard case .needs(let c)? = Slash.expand("/connect", commands) else { return XCTFail("needs") }
        XCTAssertEqual(c.name, "connect")
        XCTAssertEqual(Slash.needsWords(c), "Add the service after /connect, like “/connect HeyGen”.")
        guard case .needs(let s)? = Slash.expand("/pdf-report", commands) else { return XCTFail("needs") }
        XCTAssertEqual(s.name, "pdf-report")
        XCTAssertEqual(Slash.expand("/clear", commands), .clear)
        XCTAssertNil(Slash.expand("/old-one go", commands), "a disabled skill is not a command")
        XCTAssertNil(Slash.expand("/whatever", commands))
        XCTAssertNil(Slash.expand("a/b", commands))
    }

    func testMenuWordsGoInFrontOrAtTheEnd() {
        XCTAssertEqual(Slash.insert("/status ", into: "", atStart: true), "/status ")
        XCTAssertEqual(Slash.insert("/stop ", into: "/status now", atStart: true), "/stop now", "a command replaces the one there")
        XCTAssertEqual(Slash.insert("Use GitHub to ", into: "Please  ", atStart: false), "Please Use GitHub to ")
        XCTAssertEqual(Slash.insert("Use GitHub to ", into: "", atStart: false), "Use GitHub to ")
    }

    func testAFolderPickDropsHiddenFilesAndFoldersAndStopsAtTheLimit() {
        let r = Attach.folderFiles(["docs/a.md", "docs/.DS_Store", "docs/.git/config", "docs/b.md"]) { $0 }
        XCTAssertEqual(r.files, ["docs/a.md", "docs/b.md"])
        XCTAssertEqual(r.hidden, 2)
        XCTAssertEqual(r.skipped, 0)
        let many = Attach.folderFiles((0..<(Attach.maxFolderFiles + 5)).map { "d/\($0).txt" }) { $0 }
        XCTAssertEqual(many.files.count, Attach.maxFolderFiles)
        XCTAssertEqual(many.skipped, 5)
        XCTAssertEqual(Attach.folderNote(hidden: 1, added: 100, skipped: 5), "1 hidden file was left out; only the first 100 files were added.")
        XCTAssertNil(Attach.folderNote(hidden: 0, added: 3, skipped: 0))
    }

    func testAMessageMayGoOnceEveryFileIsUploadedAndNamesWhatRidesAlong() {
        let item = { (id: String, status: KnowledgeItem.Status, kind: String) in KnowledgeItem(id: id, kind: kind, title: "\(id).pdf", status: status) }
        XCTAssertFalse(Attach.sendable([item("k-1", .uploading, "document")]))
        XCTAssertTrue(Attach.sendable([item("k-1", .processing, "document"), item("k-2", .ready, "document")]))
        XCTAssertEqual(
            Attach.attachedLine([item("k-1", .ready, "document"), item("k-2", .processing, "audio"), item("k-3", .failed, "document")]),
            "Attached (now in my knowledge base): “k-1.pdf” (document, ready); “k-2.pdf” (audio, still being prepared); “k-3.pdf” (document, failed to process)."
        )
        XCTAssertEqual(Attach.attachedLine([item("k-4", .unsupported, "other")]), "Attached (now in my knowledge base): “k-4.pdf” (other, stored, but cannot be searched).")
        XCTAssertEqual(Attach.body("", attached: [item("k-1", .ready, "document")]),
                       "Take a look at what I attached.\n\nAttached (now in my knowledge base): “k-1.pdf” (document, ready).")
        XCTAssertEqual(Attach.body("hi", attached: []), "hi")
    }

    func testStatusWordsAndConnectorStatusMatchTheBrowser() {
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .uploading).statusWords(percent: 40), "Uploading 40 %")
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .uploading).statusWords(), "Uploading")
        XCTAssertEqual(KnowledgeItem(id: "a", kind: "audio", title: "a", status: .processing).statusWords(), "Transcribing")
        XCTAssertEqual(KnowledgeItem(id: "a", kind: "image", title: "a", status: .processing).statusWords(), "Reading the image")
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .processing).statusWords(), "Getting it ready")
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .ready).statusWords(), "Ready")
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .failed, error: "too big").statusWords(), "Failed: too big")
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .unsupported).statusWords(), "Can't be searched yet")
        XCTAssertEqual(KnowledgeItem(id: "a", title: "a", status: .ready).statusWords(localError: "network"), "Failed: network")
        XCTAssertEqual(Connector(id: "gh", status: "ready", toolCount: 3).statusWords, "On · 3 tools")
        XCTAssertEqual(Connector(id: "x", status: "needs_key", needs: "oauth_client").statusWords, "Needs its app's client id and secret")
        XCTAssertEqual(Connector(id: "x", status: "needs_key").statusWords, "Needs its key")
        XCTAssertEqual(Connector(id: "x", status: "error", error: "Boom").statusWords, "Boom")
        XCTAssertEqual(Connector(id: "x", status: "probing").statusWords, "Setting up…")
    }

    // MARK: Uploads

    private func client(_ http: FakeHTTP) -> APIClient { APIClient(baseURL: "https://api.example.test", http: http) { _ in "tok" } }

    func testASmallFileIsOnePutWithTheTicketsHeaders() async throws {
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/knowledge/uploads") {
                return (["item": ["id": "k-1", "kind": "document", "title": "notes.txt", "scope": "relevant", "status": "uploading"],
                         "upload": ["method": "PUT", "url": "https://bucket.example.test/k-1", "headers": ["Content-Type": "text/plain", "Content-Length": "5"]]], 200)
            }
            return (.null, 200)
        }
        let up = Uploader(api: client(http), http: http, retryDelay: .milliseconds(1))
        let created = Recorder<KnowledgeItem>()
        let item = try await up.upload(PickedFile(name: "notes.txt", contentType: "text/plain", data: Data("hello".utf8)), onCreated: { created.add($0) })
        XCTAssertEqual(created.values.first?.id, "k-1")
        XCTAssertEqual(item.id, "k-1")
        let start = http.seen[0]
        XCTAssertEqual(start.body, ["file_name": "notes.txt", "content_type": "text/plain", "size_bytes": 5])
        let put = http.seen[1]
        XCTAssertEqual(put.method, "PUT")
        XCTAssertEqual(put.url, "https://bucket.example.test/k-1")
        XCTAssertEqual(put.headers["Content-Type"], "text/plain")
        XCTAssertNil(put.headers["Content-Length"], "the system sets the length")
        XCTAssertEqual(put.rawBody, Data("hello".utf8))
        XCTAssertEqual(http.seen.count, 2, "no complete call for a single PUT")
    }

    func testABigFileGoesInPartsWithTheirETagsThenComplete() async throws {
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/knowledge/uploads") {
                return (["item": ["id": "k-2", "kind": "video", "title": "clip.mov", "scope": "relevant", "status": "uploading"],
                         "upload": ["multipart": true, "upload_id": "u-9", "part_size": 4,
                                    "part_urls": ["https://b.test/p1", "https://b.test/p2", "https://b.test/p3"]]], 200)
            }
            if s.url.hasSuffix("/complete") {
                return (["item": ["id": "k-2", "kind": "video", "title": "clip.mov", "scope": "relevant", "status": "processing"]], 200)
            }
            return (.null, 200)
        }
        http.etag = { s in s.url.hasSuffix("/p1") ? "\"e1\"" : s.url.hasSuffix("/p2") ? "\"e2\"" : "\"e3\"" }
        let up = Uploader(api: client(http), http: http, retryDelay: .milliseconds(1), concurrency: 2)
        let seen = Recorder<Int>()
        let item = try await up.upload(PickedFile(name: "clip.mov", contentType: "video/quicktime", data: Data("0123456789".utf8)),
                                       onProgress: { id, pct in XCTAssertEqual(id, "k-2"); seen.add(pct) })
        let percents = seen.values
        XCTAssertEqual(item.status, .processing)
        let puts = http.seen.filter { $0.method == "PUT" }
        XCTAssertEqual(puts.count, 3)
        XCTAssertEqual(puts.first { $0.url.hasSuffix("/p1") }?.rawBody, Data("0123".utf8))
        XCTAssertEqual(puts.first { $0.url.hasSuffix("/p3") }?.rawBody, Data("89".utf8))
        let complete = http.seen.last { $0.url.hasSuffix("/complete") }
        XCTAssertEqual(complete?.url, "https://api.example.test/knowledge/uploads/k-2/complete")
        XCTAssertEqual(complete?.body, ["upload_id": "u-9", "parts": [["part_number": 1, "etag": "\"e1\""], ["part_number": 2, "etag": "\"e2\""], ["part_number": 3, "etag": "\"e3\""]]])
        XCTAssertEqual(percents.last, 100)
        XCTAssertEqual(percents.sorted(), percents, "progress only grows")
    }

    func testAPutThatFailsIsRetriedThenGivenUpWithTheItemKept() async {
        var attempts = 0
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/knowledge/uploads") {
                return (["item": ["id": "k-3", "kind": "document", "title": "a.pdf", "scope": "relevant", "status": "uploading"],
                         "upload": ["method": "PUT", "url": "https://bucket.example.test/k-3", "headers": [:]]], 200)
            }
            attempts += 1
            return (.null, attempts == 2 ? 200 : 500)
        }
        let up = Uploader(api: client(http), http: http, retries: 3, retryDelay: .milliseconds(1))
        _ = try? await up.upload(PickedFile(name: "a.pdf", contentType: "application/pdf", data: Data("x".utf8)))
        XCTAssertEqual(attempts, 2, "the second try went through")
        attempts = 0
        let http2 = FakeHTTP { s in
            if s.url.hasSuffix("/knowledge/uploads") {
                return (["item": ["id": "k-4", "kind": "document", "title": "b.pdf", "scope": "relevant", "status": "uploading"],
                         "upload": ["method": "PUT", "url": "https://bucket.example.test/k-4", "headers": [:]]], 200)
            }
            attempts += 1
            return (.null, 500)
        }
        do {
            _ = try await Uploader(api: client(http2), http: http2, retries: 2, retryDelay: .milliseconds(1))
                .upload(PickedFile(name: "b.pdf", contentType: "application/pdf", data: Data("x".utf8)))
            XCTFail("should fail")
        } catch let e as UploadError {
            XCTAssertEqual(e.item?.id, "k-4", "the server has the item; the chip can show the failure")
            XCTAssertEqual(e.message, "The upload of “b.pdf” did not finish. Check your connection and add it again.")
            XCTAssertEqual(attempts, 3, "one try and two retries")
        } catch {
            XCTFail("wrong error \(error)")
        }
    }

    @MainActor
    func testChipsFollowTheUploadAndTheLiveEvents() async {
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/knowledge/uploads") {
                return (["item": ["id": "k-5", "kind": "document", "title": "notes.txt", "scope": "relevant", "status": "uploading"],
                         "upload": ["method": "PUT", "url": "https://bucket.example.test/k-5", "headers": [:]]], 200)
            }
            return (["ok": true], 200)
        }
        let api = client(http)
        let a = Attachments()
        let problems = await a.add([PickedFile(name: "notes.txt", contentType: "text/plain", data: Data("hi".utf8))], with: Uploader(api: api, http: http, retryDelay: .milliseconds(1)))
        XCTAssertEqual(problems, [])
        XCTAssertEqual(a.entries.map(\.id), ["k-5"])
        XCTAssertEqual(a.entries[0].item.status, .processing, "the bytes are in; the server has not said so yet")
        XCTAssertEqual(a.entries[0].words, "Getting it ready")
        XCTAssertTrue(a.sendable)
        a.apply(event: ["type": "knowledge.updated", "id": "k-5", "status": "ready", "title": "My notes", "kind": "text", "scope": "relevant"])
        XCTAssertEqual(a.entries[0].item.status, .ready)
        XCTAssertEqual(a.entries[0].item.title, "My notes")
        XCTAssertEqual(a.entries[0].words, "Ready")
        a.apply(event: ["type": "knowledge.updated", "id": "other", "status": "failed"])
        XCTAssertEqual(a.entries.count, 1, "someone else's item is not ours")
        a.remove("k-5", api: api)
        XCTAssertTrue(a.entries.isEmpty)
        try? await Task.sleep(for: .milliseconds(50))
        XCTAssertEqual(http.seen.last?.method, "DELETE")
        XCTAssertEqual(http.seen.last?.url, "https://api.example.test/knowledge/k-5")
    }

    @MainActor
    func testAnUploadThatStopsBlocksSendingUntilTheChipIsRemoved() async {
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/knowledge/uploads") {
                return (["item": ["id": "k-6", "kind": "document", "title": "a.pdf", "scope": "relevant", "status": "uploading"],
                         "upload": ["method": "PUT", "url": "https://bucket.example.test/k-6", "headers": [:]]], 200)
            }
            return (.null, 503)
        }
        let a = Attachments()
        let problems = await a.add([PickedFile(name: "a.pdf", contentType: "application/pdf", data: Data("x".utf8))], with: Uploader(api: client(http), http: http, retries: 0, retryDelay: .milliseconds(1)))
        XCTAssertEqual(problems.count, 1)
        XCTAssertEqual(a.entries[0].words, "Failed: The upload of “a.pdf” did not finish. Check your connection and add it again.")
        XCTAssertFalse(a.sendable)
        a.remove("k-6", api: nil)
        XCTAssertTrue(a.sendable)
    }

    @MainActor
    func testSpeakModeReadsTheOldSwitch() {
        let d = UserDefaults(suiteName: "aic.tests.speak.\(UUID().uuidString)")!
        XCTAssertEqual(VoiceController.readSpeakMode(d), .auto)
        d.set(false, forKey: "aic.voice.speak")
        XCTAssertEqual(VoiceController.readSpeakMode(d), .never, "a muted owner stays muted")
        d.set("always", forKey: "aic.voice.speakMode")
        XCTAssertEqual(VoiceController.readSpeakMode(d), .always)
    }
}
