// The town plan in tiles of 16 art pixels, ported from layout() in web/src/city/city-state.js (portrait
// form, for a phone): HQ on top, one office per department in rows of two, the street grid, and houses
// below for released workers and saved specialists.
import CoreGraphics
import SwiftUI

struct CityLayout: Equatable {
    struct Plot: Equatable { var dept: String; var x: Int; var y: Int; var w: Int; var h: Int; var archived: Bool }
    struct Street: Equatable { var y: Int; var x0: Int; var x1: Int }
    var hq: Plot
    var buildings: [Plot]
    var lots: [Plot]
    var streets: [Street]
    var avenue: Int
    var width: Int
    var height: Int
    var houses: [CGPoint]  // tile coordinates of each house

    static let tile = 16
    static let buildingH = 5
    static let plotW = 9, seatPitch = 40, seatsPerRow = 4, street = 3, hqW = 12, hqH = 11, houseW = 3, houseRowH = 4

    static func make(_ s: CityState, seats: [String: Int] = [:], houses: Int = 0) -> CityLayout {
        var names = City.departmentNames(s)
        for d in seats.keys.sorted() where d != "HQ" && !names.contains(d) { names.append(d) }
        let cols = 2
        let rows = max(2, Int(ceil(Double(names.count) / Double(cols))))
        let originX = 1
        let width = originX + cols * plotW + (cols - 1) * street + 1
        let hq = Plot(dept: "HQ", x: Int((Double(width - hqW) / 2).rounded()), y: 1, w: hqW, h: hqH, archived: false)
        var buildings: [Plot] = [], lots: [Plot] = []
        let avenue = originX + plotW
        var streets = [Street(y: 1 + hqH, x0: 0, x1: width)]
        var y = 1 + hqH + street
        for r in 0..<rows {
            var most = 2 * seatsPerRow
            for c in 0..<cols where r * cols + c < names.count { most = max(most, seats[names[r * cols + c]] ?? 0) }
            let h = buildingH + Int(ceil(Double(Int(ceil(Double(most) / Double(seatsPerRow))) * seatPitch) / Double(tile)))
            for c in 0..<cols {
                let x = originX + c * (plotW + street)
                guard r * cols + c < names.count else { lots.append(Plot(dept: "", x: x, y: y, w: plotW, h: h, archived: false)); continue }
                let name = names[r * cols + c]
                buildings.append(Plot(dept: name, x: x, y: y, w: plotW, h: h, archived: s.departments[name]?.state == "archived" && (seats[name] ?? 0) == 0))
            }
            y += h
            streets.append(Street(y: y, x0: 0, x1: width))
            y += street
        }
        let homesW = width - 2
        let perRow = homesW / houseW
        var spots: [CGPoint] = []
        for i in 0..<houses { spots.append(CGPoint(x: 1 + (i % perRow) * houseW, y: y + (i / perRow) * houseRowH)) }
        let homesH = max(Int(ceil(Double(houses) / Double(perRow))) * houseRowH, houseRowH)
        return CityLayout(hq: hq, buildings: buildings, lots: lots, streets: streets, avenue: avenue, width: width, height: y + homesH + 1, houses: spots)
    }

    func building(_ dept: String) -> Plot? { dept == "HQ" ? hq : buildings.first { $0.dept == dept } }

    /// Where a figure's feet are (art pixels) on a department's terrace.
    static func seatSpot(_ b: Plot, _ seat: Int) -> CGPoint {
        let r = seat / seatsPerRow, c = seat % seatsPerRow
        let pitch = Double(b.w * tile - 8) / Double(seatsPerRow)
        return CGPoint(x: Double(b.x * tile + 4) + (pitch * (Double(c) + 0.5)).rounded(), y: Double((b.y + buildingH) * tile + r * seatPitch + 24))
    }

    /// Two spots in each house's front yard.
    func homeSpot(_ slot: Int) -> CGPoint? {
        let i = slot / 2
        guard i < houses.count else { return nil }
        let h = houses[i]
        return CGPoint(x: h.x * Double(Self.tile) + (slot % 2 == 1 ? 36 : 12), y: h.y * Double(Self.tile) + 58)
    }

    /// HQ's door and the plaza in front of it: AIC stands in the plaza, the Orchestrator at the door.
    var plaza: CGPoint { CGPoint(x: Double(hq.x * Self.tile + hq.w * Self.tile / 2 - 40), y: Double((hq.y + hq.h) * Self.tile - 6)) }
    var hqDoor: CGPoint { CGPoint(x: Double(hq.x * Self.tile + hq.w * Self.tile / 2 + 30), y: Double((hq.y + hq.h) * Self.tile - 6)) }
}

enum CityPalette {
    static let dept: [String: Color] = ["HQ": Color(hex: 0x3b82ff), "IT": Color(hex: 0x4cc9f0), "App": Color(hex: 0xff7a45),
                                        "Cloud": Color(hex: 0x8ecae6), "Marketing": Color(hex: 0xf72585), "Video": Color(hex: 0xb5179e),
                                        "Travel": Color(hex: 0x06d6a0)]
    static let others: [Color] = [Color(hex: 0xe0a458), Color(hex: 0x7bc47f), Color(hex: 0xc77dff), Color(hex: 0x4ea8de), Color(hex: 0xf28482), Color(hex: 0x84a59d)]
    /// Departments the web palette doesn't name get a stable colour of their own.
    static func color(_ dept: String) -> Color { dept_color(dept) }
    private static func dept_color(_ d: String) -> Color { dept[d] ?? others[Int(City.hashOf(d) % UInt32(others.count))] }

    static let skin = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa1665e].map { Color(hex: $0) }
    static let hair = [0x2b1b0e, 0x5a3825, 0xb55239, 0xe6c35c, 0x1c1c1c, 0x8a8a8a, 0x6b4423].map { Color(hex: $0) }
    static let shirt = [0x3b82ff, 0xef476f, 0x06d6a0, 0xffd166, 0x8338ec, 0xff7a45, 0x118ab2, 0x2a9d8f, 0xe76f51, 0x6c757d].map { Color(hex: $0) }
    static let trousers = [0x264653, 0x3d405b, 0x5c4033, 0x1d3557].map { Color(hex: $0) }
    static let model: [String: Color] = ["haiku-5-5": Color(hex: 0xffd21e), "opus-5-5": Color(hex: 0x3b82ff), "sonnet-5-5": Color(hex: 0x2fd36b), "fable-5-1": Color(hex: 0xa86bff)]
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255)
    }
}
