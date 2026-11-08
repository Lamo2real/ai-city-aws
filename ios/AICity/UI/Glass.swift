// The glass theme (decision 103), the iPhone side: the same cream/ink/amber palette as `web/src/styles.css`,
// dark translucent panels over a softly lit night, light edges, blur only on containers. The City tab keeps
// its own look: nothing here is applied there, and the shared pieces (banners, tags) read `\.glass` from the
// environment and draw the old way when it is off.
import SwiftUI

enum Glass {
    // Palette (the web's --gtext, --gmute, --night, --night2, --go, --you-t …).
    static let text = Color(hex: 0xfff6e0)
    static let mute = Color(hex: 0xcfc6b4)
    static let ink = Color(hex: 0x1d1c36)
    static let night = Color(hex: 0x26284a)
    static let night2 = Color(hex: 0x1b1c36)
    static let night3 = Color(hex: 0x1f2142)
    static let solid = Color(hex: 0x2b2d52) // Reduce Transparency: the panels go solid night
    static let amber = Color(hex: 0xe8a33d)
    static let amber2 = Color(hex: 0xf9c976)
    static let lamp = Color(hex: 0x4f8fd6) // lamplight blue: the owner speaking

    // Fills and edges: cream at low opacity. Rows and chips tint only; panels add the material behind.
    static let fill = text.opacity(0.07)
    static let fill2 = text.opacity(0.13)
    static let deep = Color(hex: 0x0e0f22).opacity(0.42) // inputs and code: a darker well
    static let edge = text.opacity(0.16)
    static let edge2 = text.opacity(0.32)

    // Status: light text on tinted glass.
    static let badTint = Color(hex: 0xd8392b).opacity(0.24)
    static let badLight = Color(hex: 0xffb3a9)
    static let warnTint = Color(hex: 0xf2b33d).opacity(0.22)
    static let warnLight = Color(hex: 0xffd889)
    static let goodTint = Color(hex: 0x49ad7c).opacity(0.24)
    static let goodLight = Color(hex: 0x9fe6bb)
    static let infoTint = lamp.opacity(0.28)
    static let infoLight = Color(hex: 0xa9c8ff)
    static let youTint = lamp.opacity(0.28)

    static let radius: CGFloat = 18 // panels
    static let radiusSmall: CGFloat = 12 // rows, inputs, chips

    static let primaryGradient = LinearGradient(colors: [amber, amber2], startPoint: .top, endPoint: .bottom)
}

/// On when a view sits on the night sky, so shared pieces draw as glass. The City tab leaves it off.
private struct GlassKey: EnvironmentKey { static let defaultValue = false }
extension EnvironmentValues {
    var glass: Bool {
        get { self[GlassKey.self] }
        set { self[GlassKey.self] = newValue }
    }
}

/// The light behind the glass: a dusk sky with three soft lamps (amber top-left, lamplight blue top-right,
/// wood below), the same as the HUD's `body::before`. Still, so there is nothing to reduce for Reduce Motion.
struct NightSky: View {
    var body: some View {
        GeometryReader { g in
            let w = g.size.width, h = g.size.height
            ZStack {
                LinearGradient(colors: [Glass.night2, Glass.night, Glass.night3], startPoint: .top, endPoint: .bottom)
                lamp(Color(hex: 0xf2b33d).opacity(0.30), at: CGPoint(x: w * 0.12, y: -h * 0.08), r: max(w, h) * 0.62)
                lamp(Color(hex: 0x4f8fd6).opacity(0.30), at: CGPoint(x: w * 0.92, y: h * 0.08), r: max(w, h) * 0.56)
                lamp(Color(hex: 0xa86f40).opacity(0.34), at: CGPoint(x: w * 0.5, y: h * 1.12), r: max(w, h) * 0.52)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }

    private func lamp(_ color: Color, at c: CGPoint, r: CGFloat) -> some View {
        RadialGradient(colors: [color, .clear], center: .center, startRadius: 0, endRadius: r)
            .frame(width: r * 2, height: r * 2)
            .position(c)
    }
}

/// A container on the sky: material (solid night under Reduce Transparency) behind, a 1pt light edge.
struct GlassPanel: ViewModifier {
    var radius: CGFloat = Glass.radius
    var raised = false
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content
            .background {
                if reduceTransparency {
                    shape.fill(Glass.solid)
                } else {
                    shape.fill(raised ? .regularMaterial : .ultraThinMaterial)
                    shape.fill(raised ? Glass.fill2 : Glass.fill)
                }
            }
            .overlay(shape.strokeBorder(Glass.edge, lineWidth: 1))
    }
}

/// A row, chip or input: tint only, no blur (long lists stay smooth), with the same light edge.
struct GlassTint: ViewModifier {
    var fill: Color = Glass.fill
    var radius: CGFloat = Glass.radiusSmall
    var edge: Color = Glass.edge
    func body(content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: radius, style: .continuous)
        content.background(fill, in: shape).overlay(shape.strokeBorder(edge, lineWidth: 1))
    }
}

/// The whole of a native screen on the night sky: dark appearance whatever the phone's setting (so the glass
/// reads as dark glass in light mode too), amber tint, glass bars, no system list background.
struct NightScreen: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    func body(content: Content) -> some View {
        content
            .scrollContentBackground(.hidden)
            .background { NightSky() }
            .environment(\.colorScheme, .dark)
            .environment(\.glass, true)
            .tint(Glass.amber)
            .toolbarBackground(reduceTransparency ? AnyShapeStyle(Glass.solid) : AnyShapeStyle(.ultraThinMaterial), for: .navigationBar, .tabBar)
            .toolbarColorScheme(.dark, for: .navigationBar, .tabBar)
    }
}

/// The rows of a List or Form on the sky: tint only (no blur), light separators. Applied inside the list,
/// to its content, since row modifiers do nothing on the List itself.
struct GlassRows: ViewModifier {
    func body(content: Content) -> some View {
        content
            .listRowBackground(Glass.fill)
            .listRowSeparatorTint(Glass.edge)
    }
}

/// A sheet (hold-to-approve, the first-run guide): its own night sky with dark material over it, and the dark
/// scheme for the whole presentation. The system sheet background would follow the phone's appearance and come
/// up white in light mode, with the glass text unreadable on it.
struct NightSheet: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    func body(content: Content) -> some View {
        content
            .preferredColorScheme(.dark)
            .environment(\.colorScheme, .dark)
            .environment(\.glass, true)
            .tint(Glass.amber)
            .presentationBackground {
                if reduceTransparency {
                    Glass.solid
                } else {
                    ZStack {
                        NightSky()
                        Rectangle().fill(.ultraThinMaterial).environment(\.colorScheme, .dark)
                        Glass.fill
                    }
                }
            }
    }
}

extension View {
    func nightScreen() -> some View { modifier(NightScreen()) }
    func nightSheet() -> some View { modifier(NightSheet()) }
    func glassRows() -> some View { modifier(GlassRows()) }
    func glassPanel(radius: CGFloat = Glass.radius, raised: Bool = false) -> some View { modifier(GlassPanel(radius: radius, raised: raised)) }
    func glassTint(_ fill: Color = Glass.fill, radius: CGFloat = Glass.radiusSmall, edge: Color = Glass.edge) -> some View {
        modifier(GlassTint(fill: fill, radius: radius, edge: edge))
    }
    /// An input well: a darker glass with the lighter edge.
    func glassWell(radius: CGFloat = Glass.radiusSmall) -> some View { modifier(GlassTint(fill: Glass.deep, radius: radius, edge: Glass.edge)) }
}

/// The one primary action on a screen: amber on ink, like the HUD's `.go` button. Pressed, it fades the way
/// the web's clickable things do (62%); disabled, it is dimmed.
struct GlassPrimaryButtonStyle: ButtonStyle {
    var circle = false
    @Environment(\.isEnabled) private var enabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(Glass.ink)
            .padding(.horizontal, circle ? 0 : 16)
            .frame(minWidth: 44, minHeight: circle ? 44 : 50)
            .background {
                if circle {
                    Circle().fill(Glass.primaryGradient)
                } else {
                    RoundedRectangle(cornerRadius: Glass.radiusSmall, style: .continuous).fill(Glass.primaryGradient)
                }
            }
            .overlay {
                if circle {
                    Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1)
                } else {
                    RoundedRectangle(cornerRadius: Glass.radiusSmall, style: .continuous).strokeBorder(Color.white.opacity(0.35), lineWidth: 1)
                }
            }
            .opacity(!enabled ? 0.45 : configuration.isPressed ? 0.62 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

/// Every other button that needs a shape: a raised tint with a light edge and cream text.
struct GlassButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.medium))
            .foregroundStyle(configuration.role == .destructive ? Glass.badLight : Glass.text)
            .padding(.horizontal, 14)
            .frame(minWidth: 44, minHeight: 44)
            .glassTint(Glass.fill2, edge: Glass.edge2)
            .opacity(!enabled ? 0.45 : configuration.isPressed ? 0.62 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

extension ButtonStyle where Self == GlassPrimaryButtonStyle {
    static var glassPrimary: GlassPrimaryButtonStyle { GlassPrimaryButtonStyle() }
    static var glassPrimaryCircle: GlassPrimaryButtonStyle { GlassPrimaryButtonStyle(circle: true) }
}
extension ButtonStyle where Self == GlassButtonStyle {
    static var glass: GlassButtonStyle { GlassButtonStyle() }
}

/// A bar at an edge of the screen (the composer, Settings' Save): material with a 1pt light edge on top.
struct GlassBar: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    func body(content: Content) -> some View {
        content
            .background {
                if reduceTransparency { Glass.solid.ignoresSafeArea() } else { Rectangle().fill(.ultraThinMaterial).ignoresSafeArea() }
            }
            .overlay(alignment: .top) { Glass.edge.frame(height: 1) }
    }
}

extension View {
    func glassBar() -> some View { modifier(GlassBar()) }
}
