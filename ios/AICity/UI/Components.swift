// Shared pieces: the logo, banners, toasts, loading and empty states.
import SwiftUI

/// The logo (decisions 147 and 158; the web's Wordmark.tsx): an amber tile with a small skyline, then "VAIC" with
/// the "AI" set apart: amber, a slight lean and a small spark, so Vice Artificial Intelligence City reads at a
/// glance. The tile and the AI read the accent tokens (decision 142). VoiceOver reads it as "VAIC".
struct Wordmark: View {
    @Environment(\.colorScheme) private var scheme

    /// The "ΛI"'s amber (the web's --wm-ai-top / --wm-ai-bottom): the deeper pair on a light ground so it reads.
    private var ai: LinearGradient {
        scheme == .light
            ? LinearGradient(colors: [Color(hex: 0xe8a33d), Color(hex: 0xa8661a)], startPoint: .top, endPoint: .bottom)
            : LinearGradient(colors: [Color(hex: 0xffd98a), Color(hex: 0xe8a33d)], startPoint: .top, endPoint: .bottom)
    }

    var body: some View {
        HStack(spacing: 10) {
            SunsetMark().frame(width: 30, height: 30)
            // The word: 67 × 20 units shown at 74 × 22, every letter drawn in one frame so the amber gradient runs
            // over the whole word's height, as the web's userSpaceOnUse gradient does.
            ZStack {
                WordLetters(part: .vc).fill(scheme == .light ? Glass.ink : Glass.text)
                WordLetters(part: .ai).fill(ai)
            }
            .frame(width: 74, height: 22)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("VAIC")
    }
}

/// The mark (decision 159): a round sunset, light to deep amber, cut by three dark stripes with a skyline in front.
/// Drawn in the web's 32-unit box: the gradient fills the box, the circle (r 15 at 16, 16) clips it.
struct SunsetMark: View {
    static let sunset = LinearGradient(
        stops: [
            .init(color: Color(hex: 0xffd98a), location: 0),
            .init(color: Color(hex: 0xf2b33d), location: 0.55),
            .init(color: Color(hex: 0xe07a3a), location: 1),
        ],
        startPoint: .top, endPoint: .bottom)

    var body: some View {
        Rectangle()
            .fill(Self.sunset)
            .overlay(SunsetSkyline().fill(Glass.accentInk))
            .clipShape(MarkCircle())
            .aspectRatio(1, contentMode: .fit)
    }
}

/// The circle the mark is clipped to: radius 15 at (16, 16) in a 32-unit box, so one unit of the box is left all round.
struct MarkCircle: Shape {
    func path(in rect: CGRect) -> Path {
        let k = min(rect.width, rect.height) / 32
        return Path(ellipseIn: rect.insetBy(dx: k, dy: k))
    }
}

/// The stripes and the skyline of the mark, in its 32-unit box. The skyline is the web's single path (the favicon's
/// too): seven buildings of different heights, the tallest with an aerial, on a ground that runs to the bottom.
struct SunsetSkyline: Shape {
    /// The web's stripes: y, then height.
    static let stripes: [(CGFloat, CGFloat)] = [(14.6, 1.1), (17.6, 1.5), (20.8, 1.9)]
    /// The web's skyline path `M0 32V24h3.5v-3h2.5v3h2V15.5…V32z` as its corners, in order.
    static let skyline: [(CGFloat, CGFloat)] = [
        (0, 32), (0, 24), (3.5, 24), (3.5, 21), (6, 21), (6, 24), (8, 24), (8, 15.5), (11.5, 15.5), (11.5, 24),
        (13, 24), (13, 9.5), (14.2, 9.5), (14.2, 7), (15.8, 7), (15.8, 9.5), (17, 9.5), (17, 24), (18.5, 24),
        (18.5, 18), (21.5, 18), (21.5, 24), (23, 24), (23, 15), (26.5, 15), (26.5, 24), (28.5, 24), (28.5, 21.5),
        (32, 21.5), (32, 32),
    ]

    func path(in rect: CGRect) -> Path {
        let k = min(rect.width, rect.height) / 32
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * k, y: rect.minY + y * k) }
        var p = Path()
        for (y, h) in Self.stripes {
            p.addRect(CGRect(x: rect.minX, y: rect.minY + y * k, width: 32 * k, height: h * k))
        }
        for (i, (x, y)) in Self.skyline.enumerated() {
            if i == 0 { p.move(to: pt(x, y)) } else { p.addLine(to: pt(x, y)) }
        }
        p.closeSubpath()
        return p
    }
}

/// "VAIC" drawn as lines, not set in a font, so it is the same on every device (decision 159). The web's 67 × 20
/// viewBox: round-capped strokes of 3.6 units; `.vc` is the V and the C (the text colour), `.ai` the crossbar-less
/// Λ that mirrors the V, the I, and a four-point spark over the I (the amber).
struct WordLetters: Shape {
    enum Part { case vc, ai }
    var part: Part

    static let strokeWidth: CGFloat = 3.6
    /// The spark's corners (the web's `M39.5-1.2l1.1 2.5 2.5 1.1…z`): it rises above the viewBox, as on the web.
    static let spark: [(CGFloat, CGFloat)] = [(39.5, -1.2), (40.6, 1.3), (43.1, 2.4), (40.6, 3.5), (39.5, 6), (38.4, 3.5), (35.9, 2.4), (38.4, 1.3)]

    func path(in rect: CGRect) -> Path {
        let k = min(rect.width / 67, rect.height / 20)
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * k, y: rect.minY + y * k) }
        let style = StrokeStyle(lineWidth: Self.strokeWidth * k, lineCap: .round, lineJoin: .round)
        var lines = Path()
        switch part {
        case .vc:
            lines.move(to: pt(2, 2)); lines.addLine(to: pt(9, 18)); lines.addLine(to: pt(16, 2)) // V
            // C: the web's arc from (63, 4.6) to (63, 15.4), radius 8, the long way round through the left.
            let half: CGFloat = 5.4, r: CGFloat = 8
            let centre = pt(63 - (r * r - half * half).squareRoot(), 10)
            let a = Angle(radians: Double(atan2(-half, (r * r - half * half).squareRoot())))
            lines.move(to: pt(63, 4.6))
            lines.addArc(center: centre, radius: r * k, startAngle: a, endAngle: -a, clockwise: true)
            return lines.strokedPath(style)
        case .ai:
            lines.move(to: pt(20, 18)); lines.addLine(to: pt(27, 2)); lines.addLine(to: pt(34, 18)) // Λ
            lines.move(to: pt(39.5, 7)); lines.addLine(to: pt(39.5, 18)) // I
            var p = lines.strokedPath(style)
            for (i, (x, y)) in Self.spark.enumerated() {
                if i == 0 { p.move(to: pt(x, y)) } else { p.addLine(to: pt(x, y)) }
            }
            p.closeSubpath()
            return p
        }
    }
}

struct Banner: View {
    enum Tone { case good, info, warn, bad }
    var tone: Tone
    var text: String
    var action: (label: String, run: () -> Void)?

    init(tone: Tone, text: String, action: (label: String, run: () -> Void)? = nil) {
        self.tone = tone
        self.text = text
        self.action = action
    }

    @Environment(\.glass) private var glass

    private var color: Color {
        switch tone { case .good: return .green; case .info: return .blue; case .warn: return .orange; case .bad: return .red }
    }
    // On glass: light text on tinted glass (the HUD's --bad-t / --bad-l pairs).
    private var tint: Color {
        switch tone { case .good: return Glass.goodTint; case .info: return Glass.infoTint; case .warn: return Glass.warnTint; case .bad: return Glass.badTint }
    }
    private var light: Color {
        switch tone { case .good: return Glass.goodLight; case .info: return Glass.infoLight; case .warn: return Glass.warnLight; case .bad: return Glass.badLight }
    }
    private var symbol: String {
        switch tone {
        case .good: return "checkmark.circle.fill"
        case .info: return "info.circle.fill"
        case .warn: return "exclamationmark.triangle.fill"
        case .bad: return "xmark.octagon.fill"
        }
    }

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Image(systemName: symbol).foregroundStyle(glass ? light : color).accessibilityHidden(true)
            Text(text).font(.callout).frame(maxWidth: .infinity, alignment: .leading).fixedSize(horizontal: false, vertical: true)
            if let action {
                if glass {
                    Button(action.label, action: action.run).buttonStyle(.glass)
                } else {
                    Button(action.label, action: action.run)
                        .buttonStyle(.bordered)
                        .frame(minHeight: 44)
                }
            }
        }
        .padding(12)
        .background(glass ? tint : color.opacity(0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay { if glass { RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(Glass.edge, lineWidth: 1) } }
        .accessibilityElement(children: .combine)
    }
}

struct ToastView: View {
    @Environment(AppModel.self) private var model
    var body: some View {
        if let t = model.toast {
            HStack(spacing: 12) {
                Text(t.text).font(.callout).frame(maxWidth: .infinity, alignment: .leading)
                if let undo = t.undo {
                    Button("Undo") {
                        model.toast = nil
                        Task { await undo() }
                    }
                    .frame(minWidth: 44, minHeight: 44)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 6)
            .modifier(ToastSurface(glass: model.section != .city))
            .padding(.horizontal)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityElement(children: .contain)
            .onAppear { UIAccessibility.post(notification: .announcement, argument: t.text) }
        }
    }
}

/// The toast's surface: dark glass over the glass screens (whatever the phone's appearance), the system
/// material over the City tab, which keeps its own look.
private struct ToastSurface: ViewModifier {
    var glass: Bool
    func body(content: Content) -> some View {
        if glass {
            content
                .foregroundStyle(Glass.text)
                .tint(Glass.amber)
                .glassPanel(radius: 14, raised: true)
                .shadow(color: .black.opacity(0.35), radius: 8, y: 4)
                .environment(\.colorScheme, .dark) // after the panel, so its material is the dark one
        } else {
            content
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
                .shadow(radius: 6)
        }
    }
}

struct LoadingView: View {
    var what: String
    var body: some View {
        HStack(spacing: 10) {
            ProgressView()
            Text("Loading \(what)…").foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding()
        .accessibilityElement(children: .combine)
    }
}

struct EmptyState: View {
    var text: String
    var body: some View {
        Text(text).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.vertical, 32)
    }
}
