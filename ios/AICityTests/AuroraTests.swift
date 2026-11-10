// The voice's light (UI/Aurora.swift): who it is for, how it follows the voice, and what VoiceOver hears.
import XCTest
@testable import AICity

final class AuroraTests: XCTestCase {
    func testTheLightIsForWhoeverTalksAndNothingShowsWhenNobodyDoes() {
        XCTAssertEqual(Aurora.speaker(listening: true, speaking: true, presence: .thinking, askedByVoice: false), .you, "the owner talking wins")
        XCTAssertEqual(Aurora.speaker(listening: false, speaking: true, presence: .speaking, askedByVoice: true), .vaic)
        XCTAssertEqual(Aurora.speaker(listening: false, speaking: false, presence: .thinking, askedByVoice: true), .thinking)
        XCTAssertEqual(Aurora.speaker(listening: false, speaking: false, presence: .thinking, askedByVoice: false), .idle, "a typed message stays quiet")
        XCTAssertEqual(Aurora.speaker(listening: false, speaking: false, presence: .idle, askedByVoice: true), .idle)
    }

    func testVoiceOverHearsWhoIsTalkingOnTheVoiceButton() {
        XCTAssertEqual(Aurora.words(.you), "You’re talking")
        XCTAssertEqual(Aurora.words(.vaic), "VAIC is talking")
        XCTAssertEqual(Aurora.words(.thinking), "VAIC is thinking")
        XCTAssertEqual(Aurora.words(.idle), "")
    }

    func testTheLevelFollowsTheRightVoice() {
        XCTAssertEqual(Aurora.target(.you, input: 0.5, output: 0.9, t: 0), 0.65, accuracy: 0.0001)
        XCTAssertEqual(Aurora.target(.vaic, input: 0.5, output: 0.2, t: 0), 0.26, accuracy: 0.0001)
        XCTAssertEqual(Aurora.target(.you, input: 1, output: 0, t: 0), 1, "never above 1")
        XCTAssertEqual(Aurora.target(.idle, input: 1, output: 1, t: 0), 0)
        let breath = (0..<40).map { Aurora.target(.thinking, input: 0, output: 0, t: Double($0) * 0.1) }
        XCTAssertGreaterThan(breath.max()!, breath.min()!, "thinking breathes")
        XCTAssertLessThan(breath.max()!, 0.4, "and stays low")
    }

    func testTheLightIsCalmSlowToRiseAndFall() {
        var smooth = 0.0
        smooth = Aurora.eased(smooth, toward: 1, dt: 1.0 / 60)
        XCTAssertEqual(smooth, 0.1, accuracy: 0.0001, "a tenth of the way per frame")
        for _ in 0..<120 { smooth = Aurora.eased(smooth, toward: 1, dt: 1.0 / 60) }
        XCTAssertGreaterThan(smooth, 0.99)
        XCTAssertEqual(Aurora.eased(0.5, toward: 1, dt: 0), 0.5, "no time, no change")
        XCTAssertEqual(Aurora.eased(0, toward: 1, dt: 30), Aurora.eased(0, toward: 1, dt: 0.1), "a long pause never makes it jump")
    }

    func testAicsWordsLiftTheLightAndItSettlesToAFloor() {
        let word = Aurora.wordStrength(letters: 6)
        XCTAssertEqual(word, 0.75, accuracy: 0.0001)
        XCTAssertEqual(Aurora.wordStrength(letters: 40), 1)
        XCTAssertEqual(Aurora.spokenLevel(strength: word, since: 0), 0.75, accuracy: 0.0001)
        XCTAssertLessThan(Aurora.spokenLevel(strength: word, since: 0.2), 0.75)
        XCTAssertEqual(Aurora.spokenLevel(strength: word, since: 5), 0.28, "still lit between words")
    }

    func testTheCrestRisesWithTheVoiceWithinTheLayer() {
        XCTAssertEqual(Aurora.rise(amp: 0), 18)
        XCTAssertEqual(Aurora.rise(amp: 1), 114)
        XCTAssertEqual(Aurora.rise(amp: 7), 114)
        XCTAssertLessThan(Aurora.rise(amp: 1) + 30, Aurora.reach, "the fade above the crest fits in the layer")
    }

    @MainActor
    func testASpokenMessageIsAnsweredAloudAndATypedOneIsNot() async {
        let http = FakeHTTP { s in
            if s.url.hasSuffix("/config.json") {
                return (["region": "eu-north-1", "apiUrl": "https://api.example.test", "wsUrl": "wss://ws.example.test", "clientId": "c", "userPoolId": "eu-north-1_P"], 200)
            }
            return (["accepted": true], 202)
        }
        let model = AppModel(configStore: ConfigStore(defaults: UserDefaults(suiteName: "vaic.tests.\(UUID().uuidString)")!, http: http, bundleHost: "site.example.test"),
                             hud: HudStore(archive: NoChatArchive()), http: http, makeAuth: { _ in FakeAuth() }, connectLive: false)
        await model.start()
        model.voice.volume = 0
        await model.send("typed")
        XCTAssertFalse(model.lastAskedByVoice)
        model.hud.event(["type": "vaic.reply", "conversation": "main", "text": "Text only.", "done": true])
        XCTAssertFalse(model.voice.speaking)
        XCTAssertEqual(model.hud.presence, .idle)
        await model.send("spoken", byVoice: true)
        XCTAssertTrue(model.lastAskedByVoice)
        XCTAssertEqual(Aurora.speaker(listening: false, speaking: false, presence: model.hud.presence, askedByVoice: model.lastAskedByVoice), .thinking)
        model.hud.event(["type": "vaic.reply", "conversation": "main", "text": "Out loud.", "done": true])
        XCTAssertTrue(model.voice.speaking)
        XCTAssertGreaterThan(model.voice.outputLevel(), 0)
        model.voice.stopSpeaking()
        XCTAssertEqual(model.voice.outputLevel(), 0)
    }
}
