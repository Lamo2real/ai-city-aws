// The pixel-art town, drawn natively with SwiftUI Canvas (original art, not the web's sprites): HQ with AIC in
// the plaza and the Orchestrator at the door, one office per department with its manager at the door and
// workers on the terrace, free lots, and houses for released workers and saved specialists. Figures walk to
// their new place when the state changes; with Reduce Motion they move at once.
import SwiftUI

/// Where every figure should stand, from the state alone (pure, so it is unit-tested).
struct CityScenePlan {
    struct Figure: Equatable { var id: String; var target: CGPoint; var place: City.Place; var visual: String; var dept: String }
    var layout: CityLayout
    var figures: [Figure]

    static func make(_ s: CityState, previousSlots: [String: Int] = [:]) -> (CityScenePlan, [String: Int]) {
        var byDept: [String: [String]] = [:]
        var home: [String] = []
        var managers: [String: String] = [:]
        for (id, a) in s.agents {
            guard let p = City.placement(s, id) else { continue }
            switch p.place {
            case .hq: break
            case .station:
                if a.kind == "manager", managers[p.dept] == nil { managers[p.dept] = id } else { byDept[p.dept, default: []].append(id) }
            case .home: home.append(id)
            }
        }
        // Only the latest released people stand in the neighbourhood (like the web's RETIRED_SHOWN = 24).
        home = home.sorted { (s.agents[$0]?.lastActiveAt ?? "") > (s.agents[$1]?.lastActiveAt ?? "") || ((s.agents[$0]?.lastActiveAt ?? "") == (s.agents[$1]?.lastActiveAt ?? "") && $0 < $1) }
        home = Array(home.prefix(24))
        var slots: [String: Int] = [:]
        var seats: [String: Int] = [:]
        for (dept, ids) in byDept {
            let prev = previousSlots.filter { ids.contains($0.key) }
            let ds = City.assignSlots(ids, previous: prev)
            slots.merge(ds) { $1 }
            seats[dept] = (ds.values.max() ?? -1) + 1
        }
        let homeSlots = City.assignSlots(home.map { "h:" + $0 }, previous: previousSlots.filter { $0.key.hasPrefix("h:") })
        slots.merge(homeSlots) { $1 }
        let layout = CityLayout.make(s, seats: seats, houses: Int(ceil(Double(home.count) / 2)))
        var figures: [Figure] = []
        for id in ["ace", "orchestrator"] where s.agents[id] != nil || id == "ace" {
            figures.append(Figure(id: id, target: id == "ace" ? layout.plaza : layout.hqDoor, place: .hq, visual: City.visualState(s, id), dept: "HQ"))
        }
        for (dept, m) in managers {
            guard let b = layout.building(dept) else { continue }
            let door = CGPoint(x: Double(b.x * CityLayout.tile + b.w * CityLayout.tile / 2), y: Double((b.y + CityLayout.buildingH) * CityLayout.tile + 4))
            figures.append(Figure(id: m, target: door, place: .station, visual: City.visualState(s, m), dept: dept))
        }
        for (dept, ids) in byDept {
            guard let b = layout.building(dept) else { continue }
            for id in ids { figures.append(Figure(id: id, target: CityLayout.seatSpot(b, slots[id] ?? 0), place: .station, visual: City.visualState(s, id), dept: dept)) }
        }
        for id in home {
            if let spot = layout.homeSpot(homeSlots["h:" + id] ?? 0) {
                figures.append(Figure(id: id, target: spot, place: .home, visual: "idle", dept: City.deptOf(s.agents[id]!)))
            }
        }
        return (CityScenePlan(layout: layout, figures: figures.sorted { $0.id < $1.id }), slots)
    }
}

/// Positions that ease toward their targets, one step per frame.
@MainActor final class FigureMotion {
    var positions: [String: CGPoint] = [:]
    private var last = Date()
    func step(_ figures: [CityScenePlan.Figure], now: Date, instant: Bool) {
        let dt = min(0.1, now.timeIntervalSince(last))
        last = now
        for f in figures {
            guard let p = positions[f.id], !instant else { positions[f.id] = f.target; continue }
            let dx = f.target.x - p.x, dy = f.target.y - p.y
            let d = hypot(dx, dy)
            let speed = 70.0 * dt
            positions[f.id] = d <= speed ? f.target : CGPoint(x: p.x + dx / d * speed, y: p.y + dy / d * speed)
        }
    }
    func moving(_ f: CityScenePlan.Figure) -> Bool { positions[f.id].map { hypot($0.x - f.target.x, $0.y - f.target.y) > 0.5 } ?? false }
}

struct CityCanvas: View {
    var state: CityState
    var plan: CityScenePlan
    var selected: String?
    var onTap: (String) -> Void
    @State private var motion = FigureMotion()
    @Environment(\.colorScheme) private var scheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let L = plan.layout
        let worldW = CGFloat(L.width * CityLayout.tile), worldH = CGFloat(L.height * CityLayout.tile)
        GeometryReader { geo in
            let scale = geo.size.width / worldW
            TimelineView(.animation(minimumInterval: 1 / 30, paused: false)) { ctx in
                Canvas { g, _ in
                    motion.step(plan.figures, now: ctx.date, instant: reduceMotion)
                    g.scaleBy(x: scale, y: scale)
                    let night = scheme == .dark
                    drawGround(&g, L, worldW, worldH, night)
                    drawBuilding(&g, L.hq, name: "HQ", color: CityPalette.color("HQ"), lit: true, night: night, hq: true)
                    for b in L.buildings where !b.archived {
                        let lit = plan.figures.contains { $0.dept == b.dept && $0.place == .station }
                        drawBuilding(&g, b, name: b.dept, color: CityPalette.color(b.dept), lit: lit, night: night, hq: false)
                        if selected == b.dept { g.stroke(Path(CGRect(x: b.x * 16, y: b.y * 16, width: b.w * 16, height: CityLayout.buildingH * 16)), with: .color(.yellow), lineWidth: 3) }
                    }
                    for lot in L.lots { drawLot(&g, lot) }
                    for h in L.houses { drawHouse(&g, h, night) }
                    let t = reduceMotion ? 0 : ctx.date.timeIntervalSinceReferenceDate
                    for f in plan.figures.sorted(by: { (motion.positions[$0.id]?.y ?? 0) < (motion.positions[$1.id]?.y ?? 0) }) {
                        let p = motion.positions[f.id] ?? f.target
                        drawFigure(&g, f, at: p, t: t, walking: motion.moving(f), selected: selected == f.id)
                    }
                }
            }
            .frame(width: geo.size.width, height: worldH * scale)
            .contentShape(Rectangle())
            .gesture(SpatialTapGesture().onEnded { v in
                let p = CGPoint(x: v.location.x / scale, y: v.location.y / scale)
                if let hit = hitTest(p) { onTap(hit) }
            })
        }
        .aspectRatio(worldW / worldH, contentMode: .fit)
    }

    private func hitTest(_ p: CGPoint) -> String? {
        let near = plan.figures.map { f in (f, hypot((motion.positions[f.id] ?? f.target).x - p.x, (motion.positions[f.id] ?? f.target).y - 8 - p.y)) }
            .filter { $0.1 < 16 }.min { $0.1 < $1.1 }
        if let near { return near.0.id }
        let L = plan.layout
        for b in [L.hq] + L.buildings where CGRect(x: b.x * 16, y: b.y * 16, width: b.w * 16, height: b.h * 16).contains(p) { return b.dept }
        return nil
    }

    // MARK: Art (all original: flat pixel shapes)

    private func px(_ g: inout GraphicsContext, _ x: Double, _ y: Double, _ w: Double, _ h: Double, _ c: Color) {
        g.fill(Path(CGRect(x: x, y: y, width: w, height: h)), with: .color(c))
    }

    private func drawGround(_ g: inout GraphicsContext, _ L: CityLayout, _ W: CGFloat, _ H: CGFloat, _ night: Bool) {
        let a = night ? Color(hex: 0x1f3a2a) : Color(hex: 0x8cc66d), b = night ? Color(hex: 0x23412f) : Color(hex: 0x82bd63)
        for ty in 0..<L.height { for tx in 0..<L.width { px(&g, Double(tx * 16), Double(ty * 16), 16, 16, (tx + ty) % 2 == 0 ? a : b) } }
        let road = night ? Color(hex: 0x3a3a44) : Color(hex: 0x9a9a9a), line = night ? Color(hex: 0xb8a24a) : Color(hex: 0xf4f1de)
        for s in L.streets {
            px(&g, Double(s.x0 * 16), Double(s.y * 16), Double((s.x1 - s.x0) * 16), Double(CityLayout.street * 16), road)
            var x = Double(s.x0 * 16) + 4
            while x < Double(s.x1 * 16) { px(&g, x, Double(s.y * 16) + 23, 12, 2, line); x += 24 }
        }
        // The avenue joining the streets.
        if let first = L.streets.first, let last = L.streets.last {
            px(&g, Double(L.avenue * 16), Double(first.y * 16), Double(CityLayout.street * 16), Double((last.y - first.y + CityLayout.street) * 16), road)
        }
    }

    private func drawBuilding(_ g: inout GraphicsContext, _ b: CityLayout.Plot, name: String, color: Color, lit: Bool, night: Bool, hq: Bool) {
        let x = Double(b.x * 16), y = Double(b.y * 16), w = Double(b.w * 16)
        let h = Double((hq ? b.h : CityLayout.buildingH) * 16)
        let wall = night ? Color(hex: 0x5b4a3a) : Color(hex: 0xe9d8a6), ink = Color(hex: 0x2b1d14)
        px(&g, x + 2, y + 18, w - 4, h - 20, wall)
        px(&g, x, y + 6, w, 14, color)  // roof
        px(&g, x + 4, y + 2, w - 8, 6, color.opacity(0.8))
        g.stroke(Path(CGRect(x: x + 2, y: y + 18, width: w - 4, height: h - 20)), with: .color(ink), lineWidth: 1.5)
        // Windows: lit when someone is at work here.
        let win = lit ? (night ? Color(hex: 0xffd166) : Color(hex: 0xfff3b0)) : (night ? Color(hex: 0x24303a) : Color(hex: 0x7aa7c7))
        var wy = y + 26
        while wy < y + h - 24 {
            var wx = x + 10
            while wx < x + w - 20 { px(&g, wx, wy, 10, 10, win); wx += 20 }
            wy += 20
        }
        // Door and sign.
        px(&g, x + w / 2 - 7, y + h - 18, 14, 16, Color(hex: 0x6b4423))
        let label = Text(name.uppercased()).font(.system(size: hq ? 12 : 10, weight: .heavy, design: .monospaced)).foregroundColor(.white)
        g.draw(label, at: CGPoint(x: x + w / 2, y: y + 13))
        if !hq {
            // The terrace where workers sit.
            px(&g, x + 2, y + h, w - 4, Double((b.h - CityLayout.buildingH) * 16) - 4, night ? Color(hex: 0x4a3b2d) : Color(hex: 0xcfa66b))
        }
    }

    private func drawLot(_ g: inout GraphicsContext, _ lot: CityLayout.Plot) {
        let x = Double(lot.x * 16), y = Double(lot.y * 16)
        g.stroke(Path(CGRect(x: x + 6, y: y + 6, width: Double(lot.w * 16) - 12, height: Double(lot.h * 16) - 12)), with: .color(.white.opacity(0.6)), style: StrokeStyle(lineWidth: 2, dash: [6, 6]))
        g.draw(Text("FREE LOT").font(.system(size: 10, weight: .bold, design: .monospaced)).foregroundColor(.white.opacity(0.85)), at: CGPoint(x: x + Double(lot.w * 8), y: y + Double(lot.h * 8)))
    }

    private func drawHouse(_ g: inout GraphicsContext, _ h: CGPoint, _ night: Bool) {
        let x = h.x * 16, y = h.y * 16
        px(&g, x + 6, y + 18, 36, 26, night ? Color(hex: 0x6d5a48) : Color(hex: 0xf2e8cf))
        var roof = Path()
        roof.move(to: CGPoint(x: x + 2, y: y + 20)); roof.addLine(to: CGPoint(x: x + 24, y: y + 4)); roof.addLine(to: CGPoint(x: x + 46, y: y + 20)); roof.closeSubpath()
        g.fill(roof, with: .color(Color(hex: 0xbc4b51)))
        px(&g, x + 20, y + 30, 8, 14, Color(hex: 0x6b4423))
        px(&g, x + 10, y + 24, 7, 7, night ? Color(hex: 0xffd166) : Color(hex: 0x7aa7c7))
    }

    private func drawFigure(_ g: inout GraphicsContext, _ f: CityScenePlan.Figure, at p: CGPoint, t: Double, walking: Bool, selected: Bool) {
        let idn = City.identity(f.id)
        let bob = walking ? (Int(t * 8) % 2 == 0 ? -1.0 : 0) : (f.visual == "working" || f.visual == "coding" ? (Int(t * 3 + Double(idn.shirt)) % 2 == 0 ? -0.5 : 0) : 0)
        let x = p.x - 5, y = p.y - 18 + bob
        let isAce = f.id == "ace"
        if selected { g.fill(Path(ellipseIn: CGRect(x: p.x - 9, y: p.y - 3, width: 18, height: 6)), with: .color(.yellow)) }
        g.fill(Path(ellipseIn: CGRect(x: p.x - 6, y: p.y - 2, width: 12, height: 4)), with: .color(.black.opacity(0.25)))
        let trousers = CityPalette.trousers[idn.trousers]
        let legOffset = walking ? (Int(t * 8) % 2 == 0 ? 1.0 : -1.0) : 0
        px(&g, x + 2, y + 13, 2.5, 5 + legOffset, trousers)
        px(&g, x + 5.5, y + 13, 2.5, 5 - legOffset, trousers)
        px(&g, x + 1, y + 7, 8, 7, isAce ? Color(hex: 0x2b1d14) : CityPalette.shirt[idn.shirt])
        px(&g, x + 2, y + 1, 6, 6, CityPalette.skin[idn.skin])
        px(&g, x + 2, y, 6, idn.hairStyle == 0 ? 1.5 : 2.5, CityPalette.hair[idn.hair])
        if isAce {  // AIC wears its eye
            px(&g, x + 3, y + 3, 4, 2, .white)
            px(&g, x + 4.5, y + 3, 1.5, 2, .black)
        }
        // A mark above the head says what is going on.
        let mark: (String, Color)? = {
            switch f.visual {
            case "waiting_owner": return ("!", .orange)
            case "failed", "blocked": return ("×", .red)
            case "in_review", "waiting_merge", "waiting_team": return ("…", .gray)
            case "idle", "paused": return nil
            default: return f.place == .home ? nil : ("•", CityPalette.model[ (stateModel(f.id)) ] ?? .blue)
            }
        }()
        if let mark {
            g.fill(Path(ellipseIn: CGRect(x: p.x - 5, y: y - 12, width: 10, height: 10)), with: .color(.white))
            g.draw(Text(mark.0).font(.system(size: 9, weight: .black)).foregroundColor(mark.1), at: CGPoint(x: p.x, y: y - 7))
        }
    }

    private func stateModel(_ id: String) -> String { state.agents[id]?.model ?? "" }
}
