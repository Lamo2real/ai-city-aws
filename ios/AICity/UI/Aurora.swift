// The voice's light (the web HUD's `Aurora` in web/src/components/VoiceVisualizer.tsx): soft veils rising from
// the message box behind the chat text and the composer, their crest following the voice level. Blue while the
// owner talks, amber while AIC talks, a slow breathing glow while AIC thinks about a spoken message, and nothing
// at all when nobody does. With Reduce Motion: one still glow per state. It replaces the eye and the voice line
// that used to sit above the box, so the chat runs down to the composer.
import SwiftUI

enum AuroraSpeaker: String, Sendable { case you, aic, thinking, idle }

/// The pure parts (tested in AICityTests/AuroraTests.swift).
enum Aurora {
    /// Who the light is for. Thinking shows only after a spoken message: a typed one stays quiet, like the web,
    /// where the aurora belongs to the voice conversation.
    static func speaker(listening: Bool, speaking: Bool, presence: Presence, askedByVoice: Bool) -> AuroraSpeaker {
        if listening { return .you }
        if speaking { return .aic }
        if presence == .thinking, askedByVoice { return .thinking }
        return .idle
    }

    /// What VoiceOver hears as the voice button's value (the words the voice line used to show).
    static func words(_ s: AuroraSpeaker) -> String {
        switch s {
        case .you: return "You’re talking"
        case .aic: return "AIC is talking"
        case .thinking: return "AIC is thinking"
        case .idle: return ""
        }
    }

    /// The level (0…1) the veils head for: the mic while the owner talks, AIC's speech while it talks, a slow
    /// breath while it thinks. `t` is seconds.
    static func target(_ s: AuroraSpeaker, input: Double, output: Double, t: Double) -> Double {
        let raw: Double
        switch s {
        case .you: raw = input
        case .aic: raw = output
        case .thinking: raw = 0.18 + 0.1 * sin(t / 0.6)
        case .idle: raw = 0
        }
        return min(1, max(0, raw * 1.3))
    }

    /// Slow to rise and fall, so the light is calm and never jumpy: a tenth of the way per 60th of a second.
    static func eased(_ smooth: Double, toward target: Double, dt: Double) -> Double {
        smooth + (target - smooth) * (1 - pow(0.9, max(0, min(dt, 0.1)) * 60))
    }

    /// The level of AIC's own voice: each word it starts lifts the light, which then settles toward a floor
    /// until the next one (the system voice gives word boundaries, not loudness).
    static func spokenLevel(strength: Double, since seconds: Double) -> Double {
        max(0.28, min(1, strength) * exp(-max(0, seconds) * 4))
    }
    static func wordStrength(letters: Int) -> Double { min(1, 0.45 + Double(max(0, letters)) * 0.05) }

    /// How far above the box's top edge the crest of a veil sits, in points.
    static func rise(amp: Double) -> CGFloat { 18 + CGFloat(min(1, max(0, amp))) * 96 }

    /// The level drawn under Reduce Motion: one still glow.
    static let stillLevel = 0.35
    /// How far the light may rise above the box, in points (the layer's height above the composer).
    static let reach: CGFloat = 190

    /// Deep and light tones per speaker (the web's AURORA table).
    static func colors(_ s: AuroraSpeaker) -> (deep: Color, light: Color) {
        switch s {
        case .you: return (Color(red: 79 / 255, green: 143 / 255, blue: 214 / 255), Color(red: 138 / 255, green: 180 / 255, blue: 255 / 255))
        case .aic: return (Color(red: 232 / 255, green: 163 / 255, blue: 61 / 255), Color(red: 249 / 255, green: 201 / 255, blue: 118 / 255))
        case .thinking, .idle: return (Color(red: 150 / 255, green: 120 / 255, blue: 200 / 255), Color(red: 200 / 255, green: 170 / 255, blue: 240 / 255))
        }
    }
}

/// What the light remembers between frames.
private final class AuroraMemory {
    struct Spark { var x: CGFloat; var y: CGFloat; var v: CGFloat; var r: CGFloat; var life: Double; var seed: Double }
    var smooth = 0.0
    var last: Date?
    var shown: AuroraSpeaker = .you
    var sparks: [Spark] = []
}

struct AuroraView: View {
    var speaker: AuroraSpeaker
    /// Read every frame (not through the view's inputs), so a moving level never redraws the chat around it.
    var voice: VoiceController
    /// How far above this view's bottom the message box's top edge sits: the composer's height.
    var base: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var memory = AuroraMemory()

    var body: some View {
        TimelineView(.animation(paused: reduceMotion || speaker == .idle)) { ctx in
            Canvas { g, size in draw(&g, size, ctx.date) }
        }
        // Nothing visible when nobody talks: the last frame fades out (and the next one fades in).
        .opacity(speaker == .idle ? 0 : 1)
        .animation(reduceMotion ? nil : Glass.ease(Glass.durM), value: speaker)
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func draw(_ g: inout GraphicsContext, _ size: CGSize, _ now: Date) {
        let m = memory
        // Idle keeps the colours it had, so the fade-out does not change hue.
        let who = speaker == .idle ? m.shown : speaker
        m.shown = who
        let t = now.timeIntervalSinceReferenceDate
        let dt = m.last.map { now.timeIntervalSince($0) } ?? 0
        m.last = now
        if reduceMotion {
            m.smooth = Aurora.stillLevel
        } else if speaker != .idle {
            let target = Aurora.target(who, input: voice.inputLevel, output: voice.outputLevel(at: now), t: t)
            m.smooth = Aurora.eased(m.smooth, toward: target, dt: dt)
        }
        let w = size.width, h = size.height
        let baseY = h - base
        let (deep, light) = Aurora.colors(who)

        var soft = g
        soft.addFilter(.blur(radius: 22))
        func veil(amp: Double, speed: Double, freq: Double, alpha: Double, color: Color) {
            let rise = Aurora.rise(amp: amp)
            var p = Path()
            p.move(to: CGPoint(x: 0, y: h))
            for x in stride(from: CGFloat(0), through: w, by: 8) {
                let u = Double(x / max(1, w))
                let bell = pow(sin(.pi * u), 1.4) // tallest in the middle, flat at the sides
                let ripple = reduceMotion ? 0 : sin(u * .pi * freq + t / speed) * 0.18 + sin(u * 7 - t / (speed * 1.7)) * 0.06
                p.addLine(to: CGPoint(x: x, y: baseY - rise * CGFloat(bell * (0.85 + ripple * (0.3 + amp * 0.5)))))
            }
            p.addLine(to: CGPoint(x: w, y: h))
            p.closeSubpath()
            let gradient = Gradient(stops: [
                .init(color: color.opacity(0), location: 0),
                .init(color: color.opacity(alpha * 0.55), location: 0.45),
                .init(color: color.opacity(alpha), location: 1),
            ])
            soft.fill(p, with: .linearGradient(gradient, startPoint: CGPoint(x: 0, y: baseY - rise - 30), endPoint: CGPoint(x: 0, y: baseY + 20)))
        }
        veil(amp: m.smooth * 0.7, speed: 1.4, freq: 2, alpha: 0.24, color: light)
        veil(amp: m.smooth, speed: 0.9, freq: 3, alpha: 0.4, color: deep)

        // A rare spark: born at the crest when the voice is loud, drifting up and fading.
        guard !reduceMotion, speaker != .idle else { m.sparks = []; return }
        if m.smooth > 0.45, m.sparks.count < 6, Double.random(in: 0...1) < m.smooth * 0.05 {
            m.sparks.append(.init(x: w * CGFloat.random(in: 0.3...0.7), y: baseY - 16, v: CGFloat.random(in: 15...36),
                                  r: CGFloat.random(in: 0.8...1.6), life: 1, seed: Double.random(in: 0...6)))
        }
        m.sparks = m.sparks.compactMap { s in
            var s = s
            s.y -= s.v * CGFloat(min(dt, 0.1))
            s.life -= min(dt, 0.1) * 0.5
            return s.life > 0 ? s : nil
        }
        for s in m.sparks {
            let x = s.x + CGFloat(sin(t * 3.3 + s.seed)) * 4
            g.fill(Path(ellipseIn: CGRect(x: x - s.r, y: s.y - s.r, width: s.r * 2, height: s.r * 2)), with: .color(light.opacity(s.life * 0.45)))
        }
    }
}
