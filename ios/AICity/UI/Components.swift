// Shared pieces: the eye, banners, the spend pill, toasts, the voice line, loading and empty states.
import SwiftUI

/// AIC's eye: the owner's own drawing, plain ink (no colour change or motion), adapting to Dark Mode.
struct EyeView: View {
    var size: CGFloat = 80
    var body: some View {
        Image("AICEye")
            .resizable()
            .renderingMode(.template)
            .scaledToFit()
            .foregroundStyle(.primary)
            .frame(width: size, height: size * 324 / 600)
            .accessibilityLabel("AIC")
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
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
            .shadow(radius: 6)
            .padding(.horizontal)
            .transition(.move(edge: .bottom).combined(with: .opacity))
            .accessibilityElement(children: .contain)
            .onAppear { UIAccessibility.post(notification: .announcement, argument: t.text) }
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

/// The voice line under the eye: who is talking, by shape and words. Blue bars follow the owner's mic,
/// a flowing wave while AIC speaks, travelling dots while it thinks, a flat line when idle.
/// With Reduce Motion: still pictures.
struct VoiceLine: View {
    var presence: Presence
    var listening: Bool
    var level: Double
    var speaking: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.glass) private var glass

    private var mode: String {
        if listening { return "listening" }
        if speaking { return "speaking" }
        if presence == .thinking { return "thinking" }
        return "idle"
    }
    private var words: String {
        switch mode {
        case "listening": return "You’re talking"
        case "speaking": return "AIC is talking"
        case "thinking": return "AIC is thinking"
        default: return "Tap the mic to talk"
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            TimelineView(.animation(paused: reduceMotion || mode == "idle")) { ctx in
                Canvas { g, size in
                    let t = reduceMotion ? 0 : ctx.date.timeIntervalSinceReferenceDate
                    let mid = size.height / 2
                    switch mode {
                    case "listening":
                        let n = 24
                        let w = size.width / CGFloat(n)
                        for i in 0..<n {
                            let wobble = reduceMotion ? 0.5 : (sin(t * 9 + Double(i) * 0.7) + 1) / 2
                            let h = max(3, CGFloat(0.15 + level * 0.85 * wobble) * size.height)
                            g.fill(Path(roundedRect: CGRect(x: CGFloat(i) * w + w * 0.2, y: mid - h / 2, width: w * 0.6, height: h), cornerRadius: 2), with: .color(glass ? Glass.lamp : .blue))
                        }
                    case "speaking":
                        var p = Path()
                        for x in stride(from: 0, through: size.width, by: 2) {
                            let y = mid + sin(Double(x) / 14 + t * 5) * Double(size.height) * 0.3 * sin(Double(x) / size.width * .pi)
                            if x == 0 { p.move(to: CGPoint(x: x, y: y)) } else { p.addLine(to: CGPoint(x: x, y: y)) }
                        }
                        g.stroke(p, with: .color(glass ? Glass.amber : Color(hex: 0x8b4a1f)), lineWidth: 3)
                    case "thinking":
                        for i in 0..<5 {
                            let phase = (t * 1.2 + Double(i) * 0.2).truncatingRemainder(dividingBy: 1)
                            let x = size.width * (0.3 + 0.1 * CGFloat(i))
                            let r: CGFloat = 3 + (reduceMotion ? 1 : CGFloat(sin(phase * .pi)) * 2)
                            g.fill(Path(ellipseIn: CGRect(x: x - r, y: mid - r, width: r * 2, height: r * 2)), with: .color(.secondary))
                        }
                    default:
                        g.stroke(Path { $0.move(to: CGPoint(x: 0, y: mid)); $0.addLine(to: CGPoint(x: size.width, y: mid)) }, with: .color(.secondary), lineWidth: 2)
                    }
                }
            }
            .frame(height: 36)
            .accessibilityHidden(true)
            Text(words).font(.caption).foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(words)
    }
}

struct EmptyState: View {
    var text: String
    var body: some View {
        Text(text).foregroundStyle(.secondary).multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.vertical, 32)
    }
}
