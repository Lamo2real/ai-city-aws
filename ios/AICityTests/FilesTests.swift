import XCTest
@testable import AICity

/// Files in the chat (docs/FILES.md §8): VAIC's `vaic.files` lands on its reply, the card's words, the links.
@MainActor
final class FilesTests: XCTestCase {
    func store() -> HudStore {
        let h = HudStore(archive: NoChatArchive())
        var t = 1000.0
        h.clock = { t += 100; return t }
        return h
    }

    let sunrise: JSONValue = ["id": "f-aaaaaaaaaaaa", "name": "IMG_sunrise.jpg", "kind": "image", "size_bytes": 2_400_000,
                              "taken_at": "2026-04-12T06:10:00Z"]

    func testFilesShownBeforeTheFirstWordsLandOnTheReply() {
        let h = store()
        h.chat = [ChatLine(id: "o1", who: .owner, text: "find the sunrise photo", state: .sent, at: 0)]
        h.beginTurn()
        h.event(["type": "vaic.files", "conversation": "main", "files": [sunrise]])
        XCTAssertEqual(h.chat.count, 1, "held for the reply")
        h.event(["type": "vaic.reply", "conversation": "main", "text": "Here it is, Sir.", "done": true])
        XCTAssertEqual(h.chat.last?.text, "Here it is, Sir.")
        XCTAssertEqual(h.chat.last?.files?.map(\.id), ["f-aaaaaaaaaaaa"])
    }

    func testFilesDuringAStreamingReplyJoinIt_andOtherChatsAreIgnored() {
        let h = store()
        h.beginTurn()
        h.event(["type": "vaic.reply", "conversation": "main", "text": "Two fit, Sir. ", "done": false])
        h.event(["type": "vaic.files", "conversation": "main",
                 "files": [sunrise, ["id": "f-bbbbbbbbbbbb", "name": "b.png", "kind": "image", "department": "Media"]]])
        h.event(["type": "vaic.files", "conversation": "main", "files": [sunrise]])  // repeated: no duplicate
        XCTAssertEqual(h.chat.last?.files?.count, 2)
        h.event(["type": "vaic.files", "conversation": "app-x", "files": [["id": "f-cccccccccccc", "name": "c", "kind": "other"]]])
        XCTAssertEqual(h.chat.last?.files?.count, 2)
    }

    func testWithoutATurnTheFilesArriveAsTheirOwnLine() {
        let h = store()
        h.event(["type": "vaic.files", "conversation": "main", "files": [sunrise]])
        XCTAssertEqual(h.chat.count, 1)
        XCTAssertEqual(h.chat.last?.who, .vaic)
        XCTAssertEqual(h.chat.last?.text, "")
    }

    func testCardWordsAndOldChatsStillDecode() throws {
        let f = try XCTUnwrap(ChatFile(json: sunrise))
        let parts = f.meta.components(separatedBy: " · ")
        XCTAssertEqual(parts.count, 3, f.meta)
        XCTAssertEqual(parts.first, "Image")
        XCTAssertTrue(parts[1].contains("2") && parts[1].contains("4") && parts[1].contains("MB"), f.meta)
        XCTAssertTrue(parts[2].hasPrefix("Taken "), f.meta)
        // A chat saved before Files existed (no "files" key) still loads.
        let old = #"[{"id":"a1","who":"vaic","text":"hi","state":"done","at":1}]"#
        let lines = try JSONDecoder().decode([ChatLine].self, from: Data(old.utf8))
        XCTAssertNil(lines.first?.files)
    }

    func testLinksFromTheApi() throws {
        let l = try XCTUnwrap(FileLinks(json: ["id": "f-a", "name": "Deck.PDF", "kind": "document", "content_type": "",
                                              "url": "https://b/f?inline", "download_url": "https://b/f?attachment"]))
        XCTAssertTrue(l.isPDF)
        XCTAssertEqual(l.downloadURL?.absoluteString, "https://b/f?attachment")
        XCTAssertNil(l.thumbURL)
    }

    // MARK: The Files tab

    func testBrowseAndSearchQueries() {
        XCTAssertEqual(FilesQuery().path(), "/files?scope=here&sort=date&order=desc")
        XCTAssertEqual(FilesQuery(folder: "Brand/2026", sort: .nameAZ).path(offset: 60),
                       "/files?folder=Brand/2026&scope=here&sort=name&order=asc&offset=60")
        XCTAssertEqual(FilesQuery(folder: "Brand", search: "porsche sunrise").path(),
                       "/files?q=porsche%20sunrise&folder=Brand&scope=all&sort=relevance&order=desc")
        XCTAssertEqual(FilesQuery(folder: "Brand", search: "logo", onlyHere: true, kind: "image").path(),
                       "/files?q=logo&folder=Brand&scope=here&kind=image&sort=relevance&order=desc")
    }

    func testAPageOfFilesFoldersAndWhatIsLeft() throws {
        let page = FilesPage(json: [
            "files": [["id": "f-a", "name": "a.jpg", "kind": "image", "folder": "Brand", "size_bytes": 2_400_000,
                       "status": "failed", "error": "ThrottlingException: busy", "added_by": "wkr-media-1", "department": "Media",
                       "thumb_url": "https://t/a"]],
            "count": 75, "next": 60,
            "subfolders": [["name": "2026", "path": "Brand/2026", "files": 4]],
            "found_folders": ["Brand/Guides"], "folders": ["Brand", "Brand/2026", "Brand/Guides"],
        ])
        XCTAssertEqual(page.count, 75)
        XCTAssertEqual(page.next, 60)
        XCTAssertEqual(page.subfolders.first?.path, "Brand/2026")
        XCTAssertEqual(page.subfolders.first?.files, 4)
        XCTAssertEqual(page.foundFolders.map(\.path), ["Brand/Guides"])
        let f = try XCTUnwrap(page.files.first)
        XCTAssertEqual(f.by, "Media")
        XCTAssertEqual(f.statusWords, "Failed: ThrottlingException: busy")
        XCTAssertEqual(f.thumbURL?.absoluteString, "https://t/a")
        XCTAssertNotNil(f.card)
        XCTAssertNil(FilesPage(json: ["files": [], "count": 0, "next": nil]).next)
    }

    func testFilesHasItsOwnTabAndHudPage() {
        XCTAssertTrue(AppSection.tabs.contains(.files))
        XCTAssertEqual(HudAction.section(forPage: "#/files"), .files)
    }

    func testReferencesForABuildArriveAsTheirOwnLabelledLine() {
        let h = store()
        h.beginTurn()
        h.event(["type": "vaic.reply", "conversation": "main", "text": "On it.", "done": false])
        h.event(["type": "vaic.files", "conversation": "main", "label": "References for this build", "files": [sunrise]])
        XCTAssertEqual(h.chat.last?.filesLabel, "References for this build")
        XCTAssertEqual(h.chat.count, 2)
    }
}
