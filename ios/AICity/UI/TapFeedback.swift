// Every tap anywhere in the app answers like a signal (the owner, 2026-11-09, decision 148; the browser's is
// web/src/lib/tapFx.ts): two thin amber rings grow from the finger and fade, the second a beat after the first,
// with a short soft click and a light haptic. Nothing here handles the tap: a gesture recognizer on the window
// only watches touches and never recognises, so every button, list and the City map get their touches exactly
// as before; the rings are plain layers on top of the window. Settings → "Tap sound and rings" turns it all
// off; Reduce Motion turns the rings off and keeps the click and the haptic. The click is a system sound, so
// the silent switch mutes it and music keeps playing (decision 150).
import AudioToolbox
import SwiftUI
import UIKit
import UIKit.UIGestureRecognizerSubclass

/// The pure parts (tested in AICityTests/TapFeedbackTests.swift); the timings are the web's.
enum TapSignal {
    /// How long a ring takes to grow and fade.
    static let duration = 0.52
    /// The second ring starts this long after the first.
    static let secondDelay = 0.09
    static let maxRadius: CGFloat = 36
    /// A finger that travelled further than this was scrolling or dragging, not tapping.
    static let slop: CGFloat = 12
    /// The setting's key on this iPhone (on unless the owner turned it off).
    static let key = "aic.tapFeedback"

    static func isOn(_ defaults: UserDefaults = .standard) -> Bool { defaults.object(forKey: key) as? Bool ?? true }

    struct Plan: Equatable {
        var rings: Bool
        var sound: Bool
        var haptic: Bool
    }

    /// What a tap gets: everything when the setting is on, no rings under Reduce Motion, nothing when it is off.
    static func plan(on: Bool, reduceMotion: Bool) -> Plan {
        Plan(rings: on && !reduceMotion, sound: on, haptic: on)
    }

    static func isTap(from start: CGPoint, to end: CGPoint) -> Bool {
        hypot(end.x - start.x, end.y - start.y) <= slop
    }

    /// When each ring starts after the tap, and its colour (the accent's two tones, light first).
    static let rings: [(delay: Double, color: UInt32)] = [(0, 0xf9c976), (secondDelay, 0xe8a33d)]
}

/// Watches one-finger touches on a window and reports the ones that end as taps. It never leaves `.possible`
/// for `.began` or `.recognized`, so it cannot delay, cancel or win against anything else.
final class TapObserver: UIGestureRecognizer, UIGestureRecognizerDelegate {
    var onTap: (CGPoint) -> Void = { _ in }
    private var start: CGPoint?

    init() {
        super.init(target: nil, action: nil)
        cancelsTouchesInView = false
        delaysTouchesBegan = false
        delaysTouchesEnded = false
        delegate = self
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        let one = (event.allTouches?.count ?? touches.count) == 1
        start = one ? touches.first?.location(in: view) : nil
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        if let s = start, let p = touches.first?.location(in: view), !TapSignal.isTap(from: s, to: p) { start = nil }
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        if let s = start, let p = touches.first?.location(in: view), TapSignal.isTap(from: s, to: p) { onTap(p) }
        start = nil
        state = .failed
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        start = nil
        state = .failed
    }

    override func canPrevent(_ preventedGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    override func canBePrevented(by preventingGestureRecognizer: UIGestureRecognizer) -> Bool { false }
    func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}

@MainActor
final class TapFeedback {
    static let shared = TapFeedback()
    private var sound: SystemSoundID?
    private let haptic = UIImpactFeedbackGenerator(style: .light)

    /// Starts watching a window (once per window).
    func install(on window: UIWindow) {
        guard !(window.gestureRecognizers ?? []).contains(where: { $0 is TapObserver }) else { return }
        let observer = TapObserver()
        observer.onTap = { [weak self, weak window] point in
            guard let self, let window else { return }
            self.tapped(at: point, in: window)
        }
        window.addGestureRecognizer(observer)
        haptic.prepare()
    }

    func tapped(at point: CGPoint, in window: UIWindow) {
        let plan = TapSignal.plan(on: TapSignal.isOn(), reduceMotion: UIAccessibility.isReduceMotionEnabled)
        if plan.rings { rings(at: point, in: window) }
        if plan.sound { click() }
        if plan.haptic {
            haptic.impactOccurred(intensity: 0.6)
            haptic.prepare()
        }
    }

    /// Two thin rings on top of everything in the window: each grows to full size while it fades, with ease-out.
    func rings(at point: CGPoint, in window: UIWindow) {
        let r = TapSignal.maxRadius
        let now = CACurrentMediaTime()
        for ring in TapSignal.rings {
            let layer = CAShapeLayer()
            layer.path = UIBezierPath(ovalIn: CGRect(x: -r, y: -r, width: r * 2, height: r * 2)).cgPath
            layer.position = point
            layer.fillColor = nil
            layer.strokeColor = UIColor(Color(hex: ring.color)).cgColor
            layer.lineWidth = 1.5
            layer.opacity = 0 // before its turn and after its end, a ring is not there
            layer.zPosition = .greatestFiniteMagnitude
            window.layer.addSublayer(layer)

            let grow = CABasicAnimation(keyPath: "transform.scale")
            grow.fromValue = 0.15
            grow.toValue = 1
            let fade = CABasicAnimation(keyPath: "opacity")
            fade.fromValue = 0.9
            fade.toValue = 0
            let group = CAAnimationGroup()
            group.animations = [grow, fade]
            group.duration = TapSignal.duration
            group.beginTime = now + ring.delay
            group.timingFunction = CAMediaTimingFunction(controlPoints: 0.2, 0.8, 0.2, 1) // the design system's ease-out
            layer.add(group, forKey: "signal")
            DispatchQueue.main.asyncAfter(deadline: .now() + ring.delay + TapSignal.duration + 0.05) { layer.removeFromSuperlayer() }
        }
    }

    /// The bundled click (ios/scripts/make_tap_sound.py; the tone the web makes), played as a system sound: quiet with the silent switch
    /// on, never interrupting music, and no audio session of its own.
    private func click() {
        if sound == nil, let url = Bundle.main.url(forResource: "tap", withExtension: "wav") {
            var id: SystemSoundID = 0
            if AudioServicesCreateSystemSoundID(url as CFURL, &id) == kAudioServicesNoError { sound = id }
        }
        if let sound { AudioServicesPlaySystemSound(sound) }
    }
}

/// Finds the window this view is in and starts the tap signal on it.
struct TapFeedbackInstaller: UIViewRepresentable {
    final class Probe: UIView {
        override func didMoveToWindow() {
            super.didMoveToWindow()
            if let window { TapFeedback.shared.install(on: window) }
        }
    }
    func makeUIView(context: Context) -> Probe {
        let v = Probe()
        v.isUserInteractionEnabled = false
        v.isAccessibilityElement = false
        return v
    }
    func updateUIView(_ uiView: Probe, context: Context) {}
}
