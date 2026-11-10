// Stop (decision 183): the owner drops VAIC's answer to the message it is working on, as on the web HUD.
import XCTest
@testable import AICity

@MainActor
final class StopTests: XCTestCase {
    func busyStore() -> HudStore {
        let h = HudStore(archive: NoChatArchive())
        var t = 1000.0
        h.clock = { t += 100; return t }
        h.chat = [ChatLine(id: "o1", who: .owner, text: "write fifty sentences", state: .sent, at: 0)]
        h.presence = .thinking
        h.beginTurn()
        return h
    }

    func testStopDropsTheHalfWrittenAnswerAndKeepsTheMessageMarked() {
        let h = busyStore()
        XCTAssertEqual(h.busyLine?.id, "o1")
        h.event(["type": "vaic.reply", "conversation": "main", "text": "One. ", "done": false, "message_id": "owner-o1"])
        XCTAssertEqual(h.chat.count, 2)
        h.stopTurn("o1")
        XCTAssertEqual(h.chat.count, 1)
        XCTAssertEqual(h.chat[0].stopped, true)
        XCTAssertNil(h.turn)
        XCTAssertEqual(h.presence, .idle)
        XCTAssertNil(h.busyLine)  // the composer is ready at once
        // Late pieces of the stopped answer never show.
        h.event(["type": "vaic.reply", "conversation": "main", "text": "Two.", "done": true, "message_id": "owner-o1"])
        XCTAssertEqual(h.chat.count, 1)
        XCTAssertTrue(h.unsent.isEmpty)
    }

    func testVaicsConfirmationSaysWhatWasAlreadyDone() {
        let h = busyStore()
        h.event(["type": "vaic.stopped", "conversation": "main", "message_id": "owner-o1",
                 "tools": [["activity": "delegating", "detail": "delegate_to_orchestrator"]]])
        XCTAssertEqual(h.chat[0].stopped, true)
        XCTAssertEqual(h.chat[0].handedOn, true)
        XCTAssertEqual(h.chat[0].stoppedSteps?.isEmpty, false)
        XCTAssertTrue(StopWords.note(h.chat[0]).contains("keeps going"))
        XCTAssertNil(h.turn)
    }

    func testALateConfirmationDoesNotEndANewerTurn() {
        let h = busyStore()
        h.stopTurn("o1")
        h.chat.append(ChatLine(id: "o2", who: .owner, text: "second", state: .sent, at: 1))
        h.beginTurn()
        h.event(["type": "vaic.reply", "conversation": "main", "text": "Wor", "done": false, "message_id": "owner-o2"])
        h.event(["type": "vaic.stopped", "conversation": "main", "message_id": "owner-o1", "tools": []])
        XCTAssertNotNil(h.turn)
        XCTAssertEqual(h.chat.last?.text, "Wor")
        XCTAssertEqual(h.chat.last?.state, .streaming)
    }

    func testEditTakesTheStoppedMessageOut() {
        let h = busyStore()
        h.stopTurn("o1")
        h.removeLine("o1")
        XCTAssertTrue(h.chat.isEmpty)
    }

    func testStopRouteMatchesTheWebHUD() async throws {
        let http = FakeHTTP { s in
            XCTAssertEqual(s.method, "POST")
            XCTAssertEqual(s.url, "https://api.example.test/messages/o1abc234/stop")
            return (["stopped": true], 202)
        }
        try await APIClient(baseURL: "https://api.example.test", http: http) { _ in "tok" }.stopMessage(clientId: "o1abc234")
        XCTAssertEqual(http.seen.count, 1)
    }
}
