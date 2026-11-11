import AVFoundation
import CallKit
import XCTest
@testable import AICity

/// VAIC's calls: the VoIP push rings once, an unanswered or declined call is missed exactly once, an answered one
/// opens VAIC's voice (`call` after `ready`, then the microphone) and ends with `stop` and `ended`; a missed call's
/// message answers the approval. Fake CallKit, fake backend, fake socket and audio; no APNs, no AWS.
@MainActor
final class CallsTests: XCTestCase {
    final class FakeCallKit: CallSystem {
        var reported: [UUID] = []
        var ended: [(UUID, CXCallEndedReason)] = []
        var refuse: Error?
        func reportIncoming(_ uuid: UUID, completion: @escaping (Error?) -> Void) {
            reported.append(uuid)
            completion(refuse)
        }
        func reportEnded(_ uuid: UUID, reason: CXCallEndedReason) { ended.append((uuid, reason)) }
    }

    final class FakeSocket: SonicSocket, @unchecked Sendable {
        var sent: [JSONValue] = []
        var closed = false
        private var inbox: [String] = []
        private var waiting: CheckedContinuation<String, Error>?
        func server(_ frame: JSONValue) {
            let text = String(data: try! JSONEncoder().encode(frame), encoding: .utf8)!
            if let w = waiting { waiting = nil; w.resume(returning: text) } else { inbox.append(text) }
        }
        func send(_ text: String) async throws { sent.append(JSONValue.parse(Data(text.utf8)) ?? .null) }
        func receive() async throws -> String {
            if closed { throw URLError(.cancelled) }
            if !inbox.isEmpty { return inbox.removeFirst() }
            return try await withCheckedThrowingContinuation { waiting = $0 }
        }
        func close() {
            closed = true
            waiting?.resume(throwing: URLError(.cancelled))
            waiting = nil
        }
        var types: [String] { sent.compactMap { $0["type"].string } }
    }

    final class FakeAudio: CallAudio, @unchecked Sendable {
        var mic: (@Sendable (Data) -> Void)?
        var played: [Data] = []
        var flushes = 0
        var stops = 0
        func start(mic: @escaping @Sendable (Data) -> Void) throws { self.mic = mic }
        func play(_ pcm: Data) { played.append(pcm) }
        func flush() { flushes += 1 }
        func stop() { stops += 1 }
    }

    private var http: FakeHTTP!
    private var kit: FakeCallKit!
    private var socket: FakeSocket!
    private var audio: FakeAudio!

    private func controller(ring: Duration = .seconds(30)) -> CallController {
        http = FakeHTTP { s in
            if s.url.hasSuffix("/voice/session") { return (["url": "wss://voice.example.test/s?sig=x", "expires_in": 300], 200) }
            return (["ok": true], 200)
        }
        let api = APIClient(baseURL: "https://api.example.test", http: http) { _ in "tok" }
        kit = FakeCallKit()
        socket = FakeSocket()
        audio = FakeAudio()
        return CallController(system: kit, backend: APICallBackend { api }, ring: ring) { [unowned self] url, id in
            XCTAssertEqual(url.absoluteString, "wss://voice.example.test/s?sig=x")
            return SonicLink(socket: self.socket, audio: self.audio, callId: id)
        }
    }

    private let payload: [AnyHashable: Any] = ["aps": [:] as [String: Any],
                                               "vaic_call": ["id": "call-7", "reason": "The spring campaign wants $80 over today's ad ceiling.", "approval": "appr-3"]]

    private func paths() -> [String] { http.seen.map { "\($0.method) \($0.url.replacingOccurrences(of: "https://api.example.test", with: ""))" } }

    private func until(_ what: String = "", _ cond: () -> Bool) async {
        for _ in 0..<200 where !cond() { try? await Task.sleep(for: .milliseconds(10)) }
        XCTAssertTrue(cond(), what)
    }

    func testReadsTheVoIPPayload() {
        XCTAssertEqual(CallPush(payload: payload), CallPush(id: "call-7", reason: "The spring campaign wants $80 over today's ad ceiling.", approval: "appr-3"))
        XCTAssertEqual(CallPush(payload: ["vaic_call": ["id": "call-1"]]), CallPush(id: "call-1"), "reason and approval may be missing")
        XCTAssertNil(CallPush(payload: ["aps": [:] as [String: Any]]))
        XCTAssertNil(CallPush(payload: ["vaic_call": ["id": ""]]))
    }

    func testUnansweredRingIsMissedOnceAfterTheTimeout() async {
        let c = controller(ring: .milliseconds(50))
        var completed = false
        c.incoming(payload) { completed = true }
        XCTAssertTrue(completed, "PushKit hears back once CallKit has the call")
        XCTAssertEqual(kit.reported.count, 1)
        await until("missed after the ring") { paths() == ["POST /calls/call-7/missed"] }
        XCTAssertEqual(kit.ended.map(\.1), [.unanswered])
        XCTAssertEqual(http.seen.first?.body, [:])
        c.endedByOwner(kit.reported[0])  // CallKit's own end after the report: nothing more
        try? await Task.sleep(for: .milliseconds(100))
        XCTAssertEqual(paths(), ["POST /calls/call-7/missed"], "exactly once")
        XCTAssertNil(c.current)
    }

    func testDeclineIsMissedOnce() async {
        let c = controller()
        c.incoming(payload)
        let uuid = kit.reported[0]
        c.endedByOwner(uuid)
        c.endedByOwner(uuid)
        await until { !http.seen.isEmpty }
        try? await Task.sleep(for: .milliseconds(50))
        XCTAssertEqual(paths(), ["POST /calls/call-7/missed"])
        XCTAssertTrue(kit.ended.isEmpty, "CallKit ended it itself")
    }

    func testASecondCallWhileOneIsOnIsEndedAndMissed() async {
        let c = controller()
        c.incoming(payload)
        c.incoming(["vaic_call": ["id": "call-8", "reason": "x", "approval": ""]])
        XCTAssertEqual(kit.reported.count, 2, "reported first, as iOS requires")
        XCTAssertEqual(kit.ended.first?.0, kit.reported[1])
        await until { paths() == ["POST /calls/call-8/missed"] }
        XCTAssertEqual(c.current?.push.id, "call-7")
    }

    func testAnUnreadablePushStillRingsAndEnds() {
        let c = controller()
        c.incoming(["aps": [:] as [String: Any]])
        XCTAssertEqual(kit.reported.count, 1)
        XCTAssertEqual(kit.ended.map(\.1), [.failed])
        XCTAssertNil(c.current)
    }

    func testAnswerOpensTheVoiceThenHangUpEndsIt() async throws {
        let c = controller()
        c.incoming(payload)
        let uuid = kit.reported[0]
        c.audioActivated()  // CallKit's didActivate can come before the socket is ready
        XCTAssertTrue(c.answer(uuid))
        await until("answered, then the voice session") { paths() == ["POST /calls/call-7/answered", "POST /voice/session"] }
        XCTAssertEqual(http.seen[0].body, [:])

        socket.server(["type": "audio", "data": .string(Data([1, 0]).base64EncodedString())])  // before ready: held
        socket.server(["type": "ready", "model": "amazon.nova-2-sonic-v1:0", "region": "eu-north-1"])
        await until("call after ready") { socket.types == ["call"] }
        XCTAssertEqual(socket.sent[0], ["type": "call", "id": "call-7"])
        await until("the microphone starts once ready and active") { audio.mic != nil }
        XCTAssertEqual(audio.played, [Data([1, 0])], "VAIC's first words are played once the audio is on")

        audio.mic?(Data(repeating: 7, count: 3_000))  // one frame and a bit
        audio.mic?(Data(repeating: 7, count: 1_200))  // the bit makes a second
        await until("two frames") { socket.types == ["call", "audio", "audio"] }
        XCTAssertEqual(Data(base64Encoded: socket.sent[1]["data"].string ?? "")?.count, PCM.micFrameBytes)

        socket.server(["type": "audio", "data": .string(Data([2, 0, 3, 0]).base64EncodedString())])
        await until { audio.played.count == 2 }
        socket.server(["type": "interrupted"])
        await until("barge-in flushes") { audio.flushes == 1 }
        socket.server(["type": "transcript", "role": "assistant", "text": "Hi, it's Vice."])

        c.endedByOwner(uuid)
        await until("stop and ended") { paths().last == "POST /calls/call-7/ended" }
        XCTAssertEqual(socket.types.last, "stop")
        XCTAssertTrue(socket.closed)
        XCTAssertEqual(audio.stops, 1)
        XCTAssertEqual(paths().filter { $0.hasSuffix("/missed") }, [], "an answered call is never missed")
        XCTAssertNil(c.current)
    }

    func testVaicHangingUpOrFailingEndsTheCall() async {
        for (frame, reason) in [(["type": "closed"] as JSONValue, CXCallEndedReason.remoteEnded), (["type": "error", "message": "x"], .failed)] {
            let c = controller()
            c.incoming(payload)
            c.answer(kit.reported[0])
            await until { paths().count == 2 }
            socket.server(["type": "ready"])
            socket.server(frame)
            await until { paths().last == "POST /calls/call-7/ended" }
            XCTAssertEqual(kit.ended.map(\.1), [reason])
            XCTAssertTrue(socket.closed)
            XCTAssertNil(c.current)
        }
    }

    func testNoAnswerAfterTheTimeoutAndNothingMissedAfterAnswer() async {
        let c = controller(ring: .milliseconds(50))
        c.incoming(payload)
        c.answer(kit.reported[0])
        try? await Task.sleep(for: .milliseconds(150))
        XCTAssertFalse(paths().contains("POST /calls/call-7/missed"), "the ring timer stops on answer")
        XCTAssertTrue(kit.ended.isEmpty)
    }

    // MARK: The missed call's message

    func testDecideButtonsAnswerTheApproval() async {
        let info: [AnyHashable: Any] = ["aps": ["category": "VAIC_DECIDE"] as [String: Any], "vaic_call": ["id": "call-7", "approval": "appr-3"]]
        XCTAssertTrue(CallPush.decision(action: "YES", userInfo: info)! == ("appr-3", true))
        XCTAssertTrue(CallPush.decision(action: "NO", userInfo: info)! == ("appr-3", false))
        XCTAssertNil(CallPush.decision(action: UNNotificationDefaultActionIdentifier, userInfo: info), "a tap on the body only opens the app")
        XCTAssertNil(CallPush.decision(action: "YES", userInfo: ["vaic_call": ["id": "call-7", "approval": ""]]), "no approval: nothing to answer")

        let http = FakeHTTP { s in
            if s.url.hasSuffix("/config.json") {
                return (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200)
            }
            return (["ok": true], 200)
        }
        let cfg = ConfigStore(defaults: UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: http, bundleHost: "site.example.test")
        let model = AppModel(configStore: cfg, hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: { _ in FakeAuth() }, connectLive: false)
        await model.decide(approval: "appr-3", approved: true)  // woken in the background: no screen, no start()
        await model.decide(approval: "appr-3", approved: false)
        let posts = http.seen.filter { $0.method == "POST" }
        XCTAssertEqual(posts.map(\.url), ["https://api.example.test/approvals/appr-3", "https://api.example.test/approvals/appr-3"])
        XCTAssertEqual(posts.map(\.body), [["approved": true], ["approved": false]])
        XCTAssertEqual(posts[0].headers["Authorization"], "Bearer tok")
    }

    // MARK: PCM

    func testFramesAreWholeAndSmall() {
        var buf = Data(repeating: 1, count: 5_000)
        let frames = PCM.take(&buf, frameBytes: PCM.micFrameBytes)
        XCTAssertEqual(frames.map(\.count), [2_048, 2_048])
        XCTAssertEqual(buf.count, 904, "the rest waits for more")
        XCTAssertLessThan(frames[0].base64EncodedString().utf8.count, 24_000)
        XCTAssertEqual(frames[0].base64EncodedString().count, 2_732)
    }

    func testBytesAndBuffersRoundTrip() {
        let bytes = Data([0x01, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x09])  // 1, 32767, -32768 and a stray byte
        let b = PCM.buffer(bytes)!
        XCTAssertEqual(b.frameLength, 3)
        XCTAssertEqual(b.int16ChannelData![0][1], 32_767)
        XCTAssertEqual(PCM.bytes(b), bytes.prefix(6))
        XCTAssertNil(PCM.buffer(Data([1])))
    }

    func testConvertsTheMicrophoneTo16kHzAndVaicToTheSpeaker() {
        // 100 ms of a 48 kHz float tone, as a microphone gives it, becomes about 1,600 samples at 16 kHz Int16.
        let hw = AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1)!
        let toMic = AVAudioConverter(from: hw, to: PCM.micFormat)!
        var total = 0
        for _ in 0..<5 {
            let b = AVAudioPCMBuffer(pcmFormat: hw, frameCapacity: 4_800)!
            b.frameLength = 4_800
            for i in 0..<4_800 { b.floatChannelData![0][i] = 0.5 * sin(Float(i) * 2 * .pi * 440 / 48_000) }
            let out = PCM.convert(b, with: toMic)!
            XCTAssertEqual(out.format, PCM.micFormat)
            total += Int(out.frameLength)
        }
        XCTAssertEqual(Double(total), 8_000, accuracy: 200, "500 ms at 16 kHz, less the resampler's few ms of latency")

        // VAIC's 24 kHz Int16 becomes float for the player, same length.
        let voice = PCM.buffer(Data(repeating: 0, count: 4_800))!
        let toSpeaker = AVAudioConverter(from: PCM.voiceFormat, to: AVAudioFormat(standardFormatWithSampleRate: 24_000, channels: 1)!)!
        XCTAssertEqual(PCM.convert(voice, with: toSpeaker)?.frameLength, 2_400)
    }
}
