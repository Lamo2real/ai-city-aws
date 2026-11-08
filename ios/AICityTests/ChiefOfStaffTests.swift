import XCTest
@testable import AICity

/// The Chief of Staff on Needs you (Core/ChiefOfStaff.swift, HudStore), like web/test/chief.test.ts.
@MainActor
final class ChiefOfStaffTests: XCTestCase {
    func store() -> HudStore {
        let h = HudStore(archive: NoChatArchive())
        h.clock = { 1_000_000 }
        return h
    }
    func asked(_ id: String, _ extra: [String: JSONValue] = [:]) -> JSONValue {
        var q: [String: JSONValue] = ["id": .string(id), "asked_by": "wkr-1", "path": "p", "text": .string("Question \(id)?"),
                                      "options": ["A", "B"], "default_answer": "A", "created_at": "2026-11-08T10:00:00Z"]
        for (k, v) in extra { q[k] = v }
        return ["type": "question.asked", "question": .object(q)]
    }

    func testDecidedItemsAreNotCounted() {
        let h = store()
        h.event(asked("q1"))
        h.event(asked("q2", ["decided_by": "chief_of_staff", "decision": "B"]))
        XCTAssertEqual(h.waitingCount, 1)
        XCTAssertEqual(h.openQuestions.map(\.id), ["q1"])
    }

    func testLoadedListMovesDecidedOutAndKeepsReasons() {
        let h = store()
        h.event(asked("q1"))
        h.event(asked("q2"))
        h.chiefLoaded([
            "enabled": true,
            "decided": [
                ["id": "q1", "kind": "question", "title": "Old", "choice": "A", "reason": "r", "at": "2026-11-01T00:00:00Z"],
                ["id": "x", "kind": "approval", "title": "New", "choice": "Approved", "at": "2026-11-08T00:00:00Z"],
            ],
            "needs_owner": [["id": "q2", "title": "t", "why": "Only you can sign in."]],
        ])
        XCTAssertEqual(h.chief.status, .ready)
        XCTAssertTrue(h.chief.enabled)
        XCTAssertEqual(h.chief.decided.map(\.id), ["x", "q1"])  // newest first
        XCTAssertEqual(h.waitingCount, 1)
        XCTAssertEqual(h.chief.needsOwner["q2"], "Only you can sign in.")
    }

    func testLiveDecisionKeepsTheWordsAndDropsTheBadge() {
        let h = store()
        h.chief.status = .ready
        h.chief.enabled = true
        h.event(asked("q1"))
        XCTAssertEqual(h.waitingCount, 1)
        h.event(["type": "steward.decided", "id": "q1", "kind": "question", "choice": "B", "reason": "Because."])
        XCTAssertEqual(h.waitingCount, 0)
        XCTAssertEqual(h.chief.decided.first?.title, "Question q1?")
        XCTAssertEqual(h.chief.decided.first?.choice, "B")
        XCTAssertEqual(h.chief.decided.first?.reason, "Because.")
    }

    func testKeepsTheWordsWhenTheAnswerArrivesFirst() {
        let h = store()
        h.event(asked("q1"))
        h.event(["type": "question.answered", "id": "q1", "answered_by": "chief_of_staff", "answer": "B"])
        h.event(["type": "steward.decided", "id": "q1", "kind": "question", "choice": "B", "reason": "r"])
        XCTAssertEqual(h.chief.decided.first?.title, "Question q1?")
    }

    func testItCouldNotDoStaysOpenWithTheReason() {
        let h = store()
        h.event(asked("q1"))
        h.event(["type": "steward.decided", "id": "q1", "choice": nil, "needs_owner_reason": "Only you can pay."])
        XCTAssertEqual(h.waitingCount, 1)
        XCTAssertEqual(h.chief.needsOwner["q1"], "Only you can pay.")
    }

    func testWeekCount() {
        let now = City.parseISO("2026-11-08T12:00:00Z")!
        var s = ChiefState()
        s.decided = [
            DecidedItem(id: "a", kind: "question", title: "a", at: "2026-11-08T11:00:00Z", department: ""),
            DecidedItem(id: "b", kind: "question", title: "b", at: "2026-10-20T11:00:00Z", department: ""),
        ]
        XCTAssertEqual(s.decidedThisWeek(now: now), 1)
    }
}
