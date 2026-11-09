// Shared pieces: the wordmark, banners, toasts, loading and empty states.
import SwiftUI

/// The brand: the AI CITY wordmark alone (decision 108). The eye drawing is no longer on any screen; it stays in the app icon.
struct Wordmark: View {
    var body: some View {
        Text("AI CITY").font(.headline.monospaced()).accessibilityLabel("AI City")
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
