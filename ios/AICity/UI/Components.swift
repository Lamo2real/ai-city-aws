// Shared pieces: the logo, banners, toasts, loading and empty states.
import SwiftUI

/// The logo (decisions 147 and 158; the web's Wordmark.tsx): an amber tile with a small skyline, then "VAIC" with
/// the "AI" set apart: amber, a slight lean and a small spark, so Vice Artificial Intelligence City reads at a
/// glance. The tile and the AI read the accent tokens (decision 142). VoiceOver reads it as "VAIC".
struct Wordmark: View {
    @Environment(\.colorScheme) private var scheme

    /// The AI's amber: the accent's two tones, or the deeper pair on a light ground so it reads.
    private var ai: LinearGradient {
        scheme == .light
            ? LinearGradient(colors: [Color(hex: 0xe8a33d), Color(hex: 0xa8661a)], startPoint: .top, endPoint: .bottom)
            : LinearGradient(colors: [Color(hex: 0xf9c976), Color(hex: 0xe8a33d)], startPoint: .top, endPoint: .bottom)
    }

    var body: some View {
        HStack(spacing: 9) {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Glass.accentFill)
                .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).strokeBorder(Glass.accentEdge, lineWidth: 1))
                .overlay(Skyline().fill(Glass.accentInk).frame(width: 18, height: 18))
                .frame(width: 28, height: 28)
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text("V")
                Text("AI")
                    .italic()
                    .foregroundStyle(ai)
                    .kerning(0.2)
                    .padding(.trailing, 1)
                    .overlay(alignment: .topTrailing) {
                        Spark().fill(Glass.amber).frame(width: 7, height: 7).offset(x: 3, y: -5)
                    }
                Text("C")
            }
            .font(.system(size: 22, weight: .heavy, design: .rounded))
            .kerning(-0.44)
            .foregroundStyle(scheme == .light ? Glass.ink : Glass.text)
            .lineLimit(1)
            .fixedSize()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("VAIC")
    }
}

/// The tile's skyline (the web's five SVG paths in a 24 × 24 box): three buildings with rounded tops, an aerial on
/// the middle one, and the ground.
struct Skyline: Shape {
    func path(in rect: CGRect) -> Path {
        let k = min(rect.width, rect.height) / 24
        func box(_ x: CGFloat, _ top: CGFloat, _ w: CGFloat) -> CGRect {
            // Each building runs a little under the ground, so only its top corners show as rounded.
            CGRect(x: rect.minX + x * k, y: rect.minY + top * k, width: w * k, height: (22 - top) * k)
        }
        var p = Path()
        p.addRoundedRect(in: box(3, 11.5, 5.2), cornerSize: CGSize(width: k, height: k))
        p.addRoundedRect(in: box(9.4, 5.2, 5.2), cornerSize: CGSize(width: k, height: k))
        p.addRoundedRect(in: box(15.8, 8.6, 5.2), cornerSize: CGSize(width: k, height: k))
        p.addRect(CGRect(x: rect.minX + 11.6 * k, y: rect.minY + 2.4 * k, width: 0.8 * k, height: 2.8 * k)) // the aerial
        p.addRect(CGRect(x: rect.minX + 2 * k, y: rect.minY + 21 * k, width: 20 * k, height: 1.2 * k)) // the ground
        return p
    }
}

/// A small four-point spark (the web's clip-path polygon).
struct Spark: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width, h = rect.height
        let pts: [(CGFloat, CGFloat)] = [(0.5, 0), (0.62, 0.38), (1, 0.5), (0.62, 0.62), (0.5, 1), (0.38, 0.62), (0, 0.5), (0.38, 0.38)]
        var p = Path()
        for (i, (x, y)) in pts.enumerated() {
            let pt = CGPoint(x: rect.minX + x * w, y: rect.minY + y * h)
            if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
        }
        p.closeSubpath()
        return p
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
