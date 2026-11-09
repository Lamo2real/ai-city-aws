// The tap signal (UI/TapFeedback.swift): the setting, what a tap gets, and what counts as a tap.
import XCTest
@testable import AICity

final class TapFeedbackTests: XCTestCase {
    func testTheSettingIsOnUntilTheOwnerTurnsItOffAndIsKept() {
        let suite = "aic.tests.tap.\(UUID().uuidString)"
        let d = UserDefaults(suiteName: suite)!
        XCTAssertTrue(TapSignal.isOn(d), "on by default")
        d.set(false, forKey: TapSignal.key)
        XCTAssertFalse(TapSignal.isOn(d))
        XCTAssertFalse(TapSignal.isOn(UserDefaults(suiteName: suite)!), "kept on this iPhone")
        d.set(true, forKey: TapSignal.key)
        XCTAssertTrue(TapSignal.isOn(d))
        d.removePersistentDomain(forName: suite)
        XCTAssertEqual(TapSignal.key, "aic.tapFeedback", "the Settings switch and the signal read the same key")
    }

    func testOffMeansNothingAndReduceMotionOnlyHidesTheRings() {
        XCTAssertEqual(TapSignal.plan(on: true, reduceMotion: false), .init(rings: true, sound: true, haptic: true))
        XCTAssertEqual(TapSignal.plan(on: true, reduceMotion: true), .init(rings: false, sound: true, haptic: true))
        XCTAssertEqual(TapSignal.plan(on: false, reduceMotion: false), .init(rings: false, sound: false, haptic: false))
        XCTAssertEqual(TapSignal.plan(on: false, reduceMotion: true), .init(rings: false, sound: false, haptic: false))
    }

    func testAScrollOrDragIsNotATap() {
        XCTAssertTrue(TapSignal.isTap(from: CGPoint(x: 100, y: 100), to: CGPoint(x: 100, y: 100)))
        XCTAssertTrue(TapSignal.isTap(from: CGPoint(x: 100, y: 100), to: CGPoint(x: 106, y: 108)), "a finger never lands twice on one point")
        XCTAssertFalse(TapSignal.isTap(from: CGPoint(x: 100, y: 100), to: CGPoint(x: 100, y: 140)))
    }

    func testTheTimingsAreTheWebs() {
        XCTAssertEqual(TapSignal.duration, 0.52)
        XCTAssertEqual(TapSignal.secondDelay, 0.09)
        XCTAssertEqual(TapSignal.maxRadius, 36)
        XCTAssertEqual(TapSignal.rings.map(\.delay), [0, 0.09], "two rings, the second a beat later")
        XCTAssertEqual(TapSignal.rings.map(\.color), [0xf9c976, 0xe8a33d], "the accent's two tones")
    }

    func testTheClickIsInTheAppAndShort() throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "tap", withExtension: "wav"), "the tap sound is bundled")
        let bytes = try Data(contentsOf: url).count
        XCTAssertLessThan(bytes, 16000, "a tiny sound: under 0.15 s")
        XCTAssertGreaterThan(bytes, 500)
    }

    @MainActor
    func testTheObserverNeverTakesATouchFromAnythingElse() {
        let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 300, height: 600))
        TapFeedback.shared.install(on: window)
        TapFeedback.shared.install(on: window)
        let observers = (window.gestureRecognizers ?? []).compactMap { $0 as? TapObserver }
        XCTAssertEqual(observers.count, 1, "one per window, however often it is installed")
        let o = observers[0]
        XCTAssertFalse(o.cancelsTouchesInView)
        XCTAssertFalse(o.delaysTouchesBegan)
        XCTAssertFalse(o.delaysTouchesEnded)
        let other = UITapGestureRecognizer()
        XCTAssertFalse(o.canPrevent(other))
        XCTAssertFalse(o.canBePrevented(by: other))
        XCTAssertTrue(o.gestureRecognizer(o, shouldRecognizeSimultaneouslyWith: other))
        TapFeedback.shared.rings(at: CGPoint(x: 50, y: 50), in: window)
        let rings = (window.layer.sublayers ?? []).compactMap { $0 as? CAShapeLayer }
        XCTAssertEqual(rings.count, 2)
        XCTAssertEqual(rings.first?.path?.boundingBoxOfPath.width, 72, "36 pt radius")
        XCTAssertNil(rings.first?.fillColor, "thin rings, not discs")
    }
}
