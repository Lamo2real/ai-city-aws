// The City screen: the web HUD's own pixel town (see CityWebView.swift), with native banners, zoom buttons,
// the detail sheet for whatever was tapped, and everything on the map also reachable as a list (VoiceOver,
// Dynamic Type).
import SwiftUI

struct CityScreen: View {
    @Environment(AppModel.self) private var model
    @State private var selected: String?
    @State private var showList = false

    var body: some View {
        let s = model.hud.city
        ZStack(alignment: .top) {
            // The web HUD's own City scene (scene.js), full screen; it does its own pinch, pan and taps.
            CityWebView(controller: model.cityScene)
                .ignoresSafeArea(edges: .horizontal)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(cityDescription(s))
                .accessibilityHint("Every building and agent is also listed under List.")
                .accessibilityAction(named: "Open the list") { showList = true }

            VStack(spacing: 8) {
                if let e = model.hud.loadError {
                    Banner(tone: .bad, text: "The city could not load: \(e)", action: ("Try again", { Task { await model.loadCity() } }))
                }
                if model.hud.live == .reconnecting { Banner(tone: .warn, text: "Live updates stopped. Reconnecting… The map catches up when it is back.") }
                if s.city?.paused == true { Banner(tone: .warn, text: "The city is paused\(s.city?.reason.map { ": \($0)" } ?? ""). Nothing new starts.") }
            }
            .padding(.horizontal)
            .padding(.top, 8)
            .background(.clear)
        }
        .overlay(alignment: .bottomTrailing) {
            VStack(spacing: 0) {
                MapButton(symbol: "plus.magnifyingglass", label: "Zoom in") { model.cityScene.zoomIn() }
                Divider().frame(width: 44)
                MapButton(symbol: "minus.magnifyingglass", label: "Zoom out") { model.cityScene.zoomOut() }
                Divider().frame(width: 44)
                MapButton(symbol: "arrow.up.left.and.arrow.down.right", label: "Fit the whole map") { model.cityScene.fit() }
            }
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            .padding(12)
        }
        .navigationTitle("City")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showList = true } label: { Image(systemName: "list.bullet").frame(minWidth: 44, minHeight: 44) }
                    .accessibilityLabel("Departments, activity and what the marks mean")
            }
        }
        .onAppear {
            model.wireCityScene()
            model.cityScene.onTap = { tap in
                switch tap {
                case .agent(let id), .building(let id): selected = id
                case .none, .ready: break
                }
            }
            model.cityScene.resume()
        }
        .sheet(item: Binding(get: { selected.map(Selection.init) }, set: { selected = $0?.id })) { sel in
            CityPanel(id: sel.id).presentationDetents([.medium, .large])
                .onDisappear { model.cityScene.select(nil) }
        }
        .sheet(isPresented: $showList) {
            CityList { id in showList = false; selected = id }.presentationDetents([.medium, .large])
        }
    }

    private func cityDescription(_ s: CityState) -> String {
        let depts = City.departmentNames(s)
        let atWork = s.agents.keys.filter { City.placement(s, $0)?.place == .station }.count
        return "The city map. HQ and \(depts.count) department\(depts.count == 1 ? "" : "s"); \(atWork) agents at work."
    }
}

private struct MapButton: View {
    var symbol: String
    var label: String
    var action: () -> Void
    var body: some View {
        Button(action: action) { Image(systemName: symbol).font(.title3).frame(width: 48, height: 48) }
            .accessibilityLabel(label)
    }
}

/// Everything on the map as text: departments (open one) and the activity feed.
struct CityList: View {
    @Environment(AppModel.self) private var model
    var open: (String) -> Void

    var body: some View {
        let s = model.hud.city
        let top = City.topBar(s)
        NavigationStack {
            List {
                Section {
                    LabeledContent("Agents working now", value: "\(top.agentsActive) of \(top.agentsTotal)")
                    LabeledContent("Tickets running", value: "\(top.ticketsRunning)")
                    LabeledContent("On hold", value: "\(top.parked)")
                    if let m = City.cityMessage(s), model.hud.loaded { Text(m).foregroundStyle(.secondary) }
                }
                Section("Departments") {
                    ForEach(["HQ"] + City.departmentNames(s), id: \.self) { d in
                        let p = City.departmentPanel(s, d)
                        Button { open(d) } label: {
                            HStack {
                                Circle().fill(CityPalette.color(d)).frame(width: 12, height: 12).accessibilityHidden(true)
                                Text(d)
                                Spacer()
                                Text(d == "HQ" ? "VAIC, Orchestrator" : "\(p.workers.count) at work").foregroundStyle(.secondary)
                            }
                            .frame(minHeight: 44)
                        }
                        .foregroundStyle(.primary)
                    }
                }
                Section {
                    NavigationLink("What the marks mean") { Legend() }.frame(minHeight: 44)
                }
                Section("Activity") {
                    if s.feed.isEmpty { Text("Nothing has happened yet in this session.").foregroundStyle(.secondary) }
                    ForEach(s.feed.prefix(30)) { f in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(City.plainText(f.text).short).font(.callout)
                            Text(Fmt.ago(f.at)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("The city in words")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct Selection: Identifiable { let id: String }

/// What a tapped building or figure is doing, in one plain sentence first.
struct CityPanel: View {
    @Environment(AppModel.self) private var model
    var id: String
    @State private var instruction = ""
    @State private var problem: String?

    var body: some View {
        let s = model.hud.city
        NavigationStack {
            List {
                if let a = s.agents[id] ?? (id == "vaic" ? Agent(id: "vaic", kind: "core", role: "VAIC", department: nil, model: "", state: "active") : nil) {
                    let v = City.visualState(s, id)
                    let detail = s.activities[id].flatMap { $0.activity == v ? $0.detail : nil }.map { City.plainText($0, max: 120).short }
                    Section {
                        Text(City.doingWords(v, detail: detail))
                        LabeledContent("Who", value: a.role)
                        LabeledContent("Where", value: City.deptOf(a))
                        if !a.model.isEmpty { LabeledContent("Model", value: City.modelName[a.model] ?? a.model) }
                        if let t = City.currentTicket(s, id) { LabeledContent("Working on", value: t.goal) }
                    }
                    if a.state != "retired" && id != "vaic" {
                        Section {
                            if let problem { Banner(tone: .bad, text: problem) }
                            TextField("Tell \(a.role) something", text: $instruction, axis: .vertical).frame(minHeight: 44)
                            Button("Send instruction") {
                                let t = instruction.trimmingCharacters(in: .whitespacesAndNewlines)
                                guard !t.isEmpty else { return }
                                Task {
                                    do {
                                        try await model.api?.instruct(agent: id, text: t)
                                        instruction = ""
                                        model.show("Sent to \(a.role). Its manager is copied.", tone: .good)
                                    } catch { problem = AppModel.plain(error) }
                                }
                            }
                            .disabled(instruction.trimmingCharacters(in: .whitespaces).isEmpty)
                            .frame(minHeight: 44)
                        } footer: { Text("It costs one turn of that agent's model.") }
                    }
                } else {
                    let p = City.departmentPanel(s, id)
                    Section {
                        if let m = p.mission { Text(m) }
                        LabeledContent("Manager", value: p.manager.map(City.displayName) ?? "None yet")
                        LabeledContent("Workers at work", value: "\(p.workers.count)")
                        if p.released > 0 { LabeledContent("Released", value: "\(p.released)") }
                    }
                    if !p.workers.isEmpty {
                        Section("Workers") { ForEach(p.workers, id: \.self) { w in Text("\(w): \(City.visuals[City.visualState(s, w)]?.label ?? "")") } }
                    }
                    if !p.openTickets.isEmpty {
                        Section("Open tickets") { ForEach(p.openTickets) { t in Text("\(City.ticketWords(t.status)): \(t.goal)") } }
                    }
                }
            }
            .navigationTitle(id == "vaic" ? "VAIC" : id)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct Legend: View {
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label("Needs you: waiting for your answer", systemImage: "exclamationmark.circle.fill").foregroundStyle(.orange)
                    Label("Failed or blocked", systemImage: "xmark.circle.fill").foregroundStyle(.red)
                    Label("Waiting: for a review, a merge or its team", systemImage: "ellipsis.circle.fill").foregroundStyle(.gray)
                    Label("Working: the dot has its model's colour", systemImage: "circle.fill").foregroundStyle(.blue)
                }
                Section {
                    Text("HQ: VAIC stands by the fountain in the plaza, the Orchestrator at the HQ entrance.")
                    Text("Each department has its own office with its manager at the door and its workers inside. Lit windows mean someone is at work.")
                    Text("Houses: released workers and saved specialists. A FREE LOT sign marks where the next department goes up.")
                    Text("Pinch to zoom, drag to look around, tap anyone or any building. The map is the same one the web HUD shows.")
                }
                Section("Model colours") {
                    ForEach(City.modelName.sorted { $0.key < $1.key }, id: \.key) { k, name in
                        Label(name, systemImage: "circle.fill").foregroundStyle(CityPalette.model[k] ?? .gray)
                    }
                }
            }
            .navigationTitle("What the marks mean")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

/// Colours for native lists, the same as DEPT_COLOR / MODEL_COLOR in city-state.js.
enum CityPalette {
    static let dept: [String: Color] = ["HQ": Color(hex: 0x3b82ff), "IT": Color(hex: 0x4cc9f0), "App": Color(hex: 0xff7a45),
                                        "Cloud": Color(hex: 0x8ecae6), "Marketing": Color(hex: 0xf72585), "Video": Color(hex: 0xb5179e),
                                        "Travel": Color(hex: 0x06d6a0)]
    static func color(_ name: String) -> Color { dept[name] ?? Color(hex: 0x9aa0a6) }
    static let model: [String: Color] = ["haiku-5-5": Color(hex: 0xffd21e), "opus-5-5": Color(hex: 0x3b82ff), "sonnet-5-5": Color(hex: 0x2fd36b), "fable-5-2": Color(hex: 0xa86bff)]
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xff) / 255, green: Double((hex >> 8) & 0xff) / 255, blue: Double(hex & 0xff) / 255)
    }
}
