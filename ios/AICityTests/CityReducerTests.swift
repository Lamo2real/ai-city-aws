import XCTest
@testable import AICity

/// The Swift port of web/src/city/city-state.js: the same events give the same state.
final class CityReducerTests: XCTestCase {
    let now = 1_800_000_000_000.0

    func agent(_ id: String, kind: String = "worker", dept: String? = "App", state: String = "active", ws: String? = "working") -> JSONValue {
        ["id": .string(id), "kind": .string(kind), "role": .string("\(id) role"), "department": dept.map { .string($0) } ?? .null,
         "model": "opus-5-5", "parent": nil, "state": .string(state), "worker_state": ws.map { .string($0) } ?? .null]
    }
    func ticket(_ id: String, to: String, status: String, from: String = "mgr-app") -> JSONValue {
        ["id": .string(id), "goal": "Do the thing", "from": .string(from), "to": .string(to), "status": .string(status),
         "department": "App", "parent_id": nil, "created_at": "2026-11-07T09:00:00Z", "updated_at": "2026-11-07T09:00:00Z"]
    }
    func snapshot() -> JSONValue {
        ["agents": [agent("vaic", kind: "core", dept: nil, ws: nil), agent("mgr-app", kind: "manager", ws: nil), agent("wkr-1")],
         "departments": [["name": "App", "key": "app", "mission": "Apps", "manager_id": "mgr-app", "state": "active", "created_at": "2026-11-01T00:00:00Z"]],
         "tickets": [ticket("t-1", to: "wkr-1", status: "in_progress")],
         "parked": [], "questions": [], "approvals": [], "specialists": [["id": "s1", "specialty": "Designer", "department": "App", "created_at": "2026-11-01T00:00:00Z"]],
         "usage": ["usd": 1.5, "turns": 3, "tokens": 1000], "spend": ["App": 1.5],
         "caps": ["daily_global_usd": 10, "monthly_budget_usd": nil, "daily_department_usd": nil],
         "city": ["paused": false, "reason": nil, "running": 1, "waiting": 0]]
    }

    func testSnapshot() {
        let s = City.applySnapshot(CityState(), snapshot(), now: now)
        XCTAssertEqual(s.agents.count, 4)
        XCTAssertEqual(s.agents["spec-s1"]?.kind, "specialist")
        XCTAssertEqual(s.departments["App"]?.mission, "Apps")
        XCTAssertEqual(s.tickets["t-1"]?.status, "in_progress")
        XCTAssertEqual(s.usage?.usd, 1.5)
        XCTAssertEqual(s.caps?.dailyGlobalUsd, 10)
        XCTAssertNil(s.caps?.monthlyBudgetUsd)
        XCTAssertEqual(s.city?.running, 1)
        XCTAssertEqual(City.placement(s, "wkr-1")?.place, .station)
        XCTAssertEqual(City.placement(s, "spec-s1")?.place, .home)
        XCTAssertEqual(City.placement(s, "vaic")?.place, .hq)
    }

    func testHireFilesUnderTheRegisteredSpelling() {
        var s = City.applySnapshot(CityState(), snapshot(), now: now)
        s = City.reduce(s, ["type": "agent.hired", "agent": agent("wkr-2", dept: "app")], now: now)
        XCTAssertEqual(s.agents["wkr-2"]?.department, "App", "one department is one building")
        XCTAssertEqual(s.feed.first?.text, "wkr-2 role hired in App")
        XCTAssertEqual(s.departments.count, 1)
    }

    func testTicketLifecycle() {
        var s = City.applySnapshot(CityState(), snapshot(), now: now)
        s = City.reduce(s, ["type": "ticket.status", "ticket": ticket("t-2", to: "wkr-1", status: "open"), "previous": nil], now: now)
        XCTAssertEqual(s.feed.first?.text, "wkr-1 got a ticket from mgr-app: Do the thing")
        s = City.reduce(s, ["type": "ticket.status", "ticket": ticket("t-2", to: "wkr-1", status: "parked"), "previous": "open"], now: now)
        XCTAssertNil(s.tickets["t-2"])
        XCTAssertNotNil(s.parked["t-2"])
        s = City.reduce(s, ["type": "ticket.status", "ticket": ticket("t-1", to: "wkr-1", status: "done"), "previous": "in_progress"], now: now)
        XCTAssertNil(s.tickets["t-1"])
        XCTAssertEqual(s.recent["wkr-1"]?.kind, "done")
        XCTAssertEqual(s.feed.first?.text, "wkr-1: in_progress → done")
    }

    func testQuestionsAndApprovals() {
        var s = CityState()
        let q: JSONValue = ["id": "q-1", "asked_by": "wkr-1", "path": "App › wkr-1", "ticket_id": nil, "text": "Blue or green?",
                            "options": ["Blue", "Green"], "default_answer": "Blue", "status": "open", "created_at": "2026-11-07T09:00:00Z"]
        s = City.reduce(s, ["type": "question.asked", "question": q], now: now)
        s = City.reduce(s, ["type": "question.asked", "question": q], now: now)  // a repeat changes nothing
        XCTAssertEqual(s.questions["q-1"]?.options, ["Blue", "Green"])
        XCTAssertEqual(s.feed.count, 1)
        s = City.reduce(s, ["type": "approval.requested", "id": "ap-1", "agent": "wkr-1", "action": "git push", "reason": "leaves the city"], now: now)
        XCTAssertEqual(City.topBar(s).questionsWaiting, 2)
        s = City.reduce(s, ["type": "question.answered", "id": "q-1", "answer": "Blue", "answered_by": "owner"], now: now)
        s = City.reduce(s, ["type": "approval.decided", "id": "ap-1", "approved": true], now: now)
        XCTAssertTrue(s.questions.isEmpty)
        XCTAssertTrue(s.approvals.isEmpty)
        XCTAssertEqual(s.feed.first?.text, "You approved an action")
    }

    func testCostsPauseAndCaps() {
        var s = CityState()
        s = City.reduce(s, ["type": "cost.update", "agent": "wkr-1", "role": "r", "department": "App", "model": "opus-5-5", "usd": 0.25, "tokens": 100,
                            "today": ["usd": 2.5, "turns": 9, "tokens": 5000]], now: now)
        s = City.reduce(s, ["type": "cost.update", "agent": "wkr-1", "role": "r", "department": "App", "model": "opus-5-5", "usd": 0.25, "tokens": 100,
                            "today": ["usd": 2.75, "turns": 10, "tokens": 5100]], now: now)
        XCTAssertEqual(s.usage?.usd, 2.75)
        XCTAssertEqual(s.costs["wkr-1"]?.usd, 0.5)
        s = City.reduce(s, ["type": "city.state", "paused": true, "reason": "owner"], now: now)
        XCTAssertEqual(s.city?.paused, true)
        s = City.reduce(s, ["type": "spend.cap_reached", "cap": "daily_global", "department": nil, "spent": 10, "limit": 10], now: now)
        XCTAssertEqual(s.feed.first?.text, "Spend cap reached: daily global ($10)")
    }

    func testUnknownEventsChangeNothing() {
        let s = City.applySnapshot(CityState(), snapshot(), now: now)
        XCTAssertEqual(City.reduce(s, ["type": "something.new", "x": 1], now: now), s)
        XCTAssertEqual(City.reduce(s, ["type": "agent.retired", "id": "nobody"], now: now), s)
    }

    func testRetireWalksHome() {
        var s = City.applySnapshot(CityState(), snapshot(), now: now)
        s = City.reduce(s, ["type": "ticket.status", "ticket": ticket("t-1", to: "wkr-1", status: "done"), "previous": "in_progress"], now: now)
        s = City.reduce(s, ["type": "worker.state", "id": "wkr-1", "state": "released", "previous": "completed"], now: now)
        s = City.reduce(s, ["type": "agent.retired", "id": "wkr-1"], now: now)
        XCTAssertEqual(City.placement(s, "wkr-1")?.place, .home)
        XCTAssertEqual(City.agentStatus(s, "wkr-1"), "released")
        XCTAssertEqual(s.feed.first?.text, "wkr-1 role released")
    }

    func testVisualStates() {
        var s = City.applySnapshot(CityState(), snapshot(), now: now)
        XCTAssertEqual(City.visualState(s, "wkr-1"), "working")
        s = City.reduce(s, ["type": "activity", "id": "wkr-1", "activity": "coding", "detail": "x.swift"], now: now)
        XCTAssertEqual(City.visualState(s, "wkr-1"), "coding")
        s = City.reduce(s, ["type": "approval.requested", "id": "ap", "agent": "wkr-1", "action": "a", "reason": "r"], now: now)
        XCTAssertEqual(City.visualState(s, "wkr-1"), "waiting_owner")
        XCTAssertEqual(City.doingWords("waiting_owner"), "Waiting for your answer.")
    }

    func testDepartmentRename() {
        var s = City.applySnapshot(CityState(), snapshot(), now: now)
        s = City.reduce(s, ["type": "department.updated", "previous_key": "app", "department": ["name": "Apps", "key": "apps", "state": "active"]], now: now)
        XCTAssertNil(s.departments["App"])
        XCTAssertNotNil(s.departments["Apps"])
        XCTAssertEqual(s.agents["wkr-1"]?.department, "Apps")
        XCTAssertEqual(s.feed.first?.text, "Department App is now Apps")
    }

    func testWordsAndText() {
        XCTAssertEqual(City.ticketWords("waiting_on_owner"), "Waiting for you")
        XCTAssertEqual(City.ticketWords("weird_state"), "weird state")
        XCTAssertEqual(City.plainText("(parent t-1234abcd) **Done** with `x`").short, "Done with x")
        let long = String(repeating: "This is a sentence that goes on. ", count: 10)
        let p = City.plainText(long)
        XCTAssertFalse(p.whole)
        XCTAssertTrue(p.short.hasSuffix("."))
        XCTAssertLessThanOrEqual(p.short.count, 170)
    }

    func testStableLooksAndSeats() {
        XCTAssertEqual(City.identity("wkr-1"), City.identity("wkr-1"))
        XCTAssertEqual(City.hashOf("a"), 3826002220)  // FNV-1a, same as the web version
        let first = City.assignSlots(["b", "a"])
        XCTAssertEqual(first, ["a": 0, "b": 1])
        let next = City.assignSlots(["b", "c"], previous: first)
        XCTAssertEqual(next, ["b": 1, "c": 0], "a seat is kept; a newcomer takes the lowest free one")
    }

    func testCityMessages() {
        let s = City.applySnapshot(CityState(), snapshot(), now: now)
        XCTAssertNil(City.cityMessage(s))
        XCTAssertEqual(City.cityMessage(CityState()), "No departments yet. An office goes up the moment a prompt needs one.")
    }

    func testSteps() {
        XCTAssertEqual(Steps.words(activity: "reading", detail: "mcp__city__get_status"), "Checking the ledger")
        XCTAssertEqual(Steps.words(activity: "delegating", detail: nil), "Handing this to the team")
        XCTAssertEqual(Steps.words(activity: "mystery", detail: nil), "Working on it")
        XCTAssertNil(Steps.words(activity: "idle", detail: nil))
    }

    func testMoneyAndLevels() {
        XCTAssertEqual(Fmt.money(3.2), "$3.20")
        XCTAssertEqual(Fmt.money(48.6), "$49")
        XCTAssertEqual(Fmt.money(nil), "—")
        XCTAssertEqual(Fmt.spendLevel(spent: 7, cap: 10), .ok)
        XCTAssertEqual(Fmt.spendLevel(spent: 8, cap: 10), .amber)
        XCTAssertEqual(Fmt.spendLevel(spent: 10, cap: 10), .red)
        XCTAssertEqual(Fmt.spendLevel(spent: 0, cap: 0), .red)
    }
}
