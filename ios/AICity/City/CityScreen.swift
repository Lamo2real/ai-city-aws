// The City screen: the live town on top, then what it means in words (departments, activity, legend), so
// everything on the map is also reachable as a list (VoiceOver, Dynamic Type).
import SwiftUI

struct CityScreen: View {
    @Environment(AppModel.self) private var model
    @State private var selected: String?
    @State private var slots: [String: Int] = [:]
    @State private var showLegend = false
    @State private var zoom: CGFloat = 1
    @GestureState private var pinch: CGFloat = 1

    var body: some View {
        let s = model.hud.city
        let (plan, _) = CityScenePlan.make(s, previousSlots: slots)
        let top = City.topBar(s)
        List {
            Section {
                if let e = model.hud.loadError {
                    Banner(tone: .bad, text: "The city could not load: \(e)", action: ("Try again", { Task { await model.loadCity() } }))
                }
                if model.hud.live == .reconnecting { Banner(tone: .warn, text: "Live updates stopped. Reconnecting…") }
                if s.city?.paused == true { Banner(tone: .warn, text: "The city is paused\(s.city?.reason.map { ": \($0)" } ?? ""). Nothing new starts.") }
                if top.questionsWaiting > 0 {
                    Button { model.open(.inbox) } label: {
                        Text(top.questionsWaiting == 1 ? "Open: one thing needs you" : "Open: \(top.questionsWaiting) things need you").frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent).controlSize(.large)
                }
                HStack {
                    Stat(value: "\(top.agentsActive)/\(top.agentsTotal)", label: "agents active")
                    Stat(value: "\(top.ticketsRunning)", label: "tickets running")
                    Stat(value: "\(top.parked)", label: "on hold")
                }
                ScrollView([.horizontal, .vertical]) {
                    CityCanvas(state: s, plan: plan, selected: selected) { selected = $0 }
                        .frame(width: max(300, (UIScreen.main.bounds.width - 40) * zoom * pinch))
                }
                .frame(height: 420)
                .scrollIndicators(.visible)
                .gesture(MagnifyGesture().updating($pinch) { v, st, _ in st = v.magnification }.onEnded { v in zoom = min(3, max(1, zoom * v.magnification)) })
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(cityDescription(s, plan))
                .accessibilityHint("Every building and agent is also listed under Departments below.")
                .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
                .overlay(alignment: .bottomTrailing) {
                    HStack(spacing: 4) {
                        Button { zoom = max(1, zoom / 1.5) } label: { Image(systemName: "minus.magnifyingglass").frame(width: 44, height: 44) }
                            .accessibilityLabel("Zoom out")
                        Button { zoom = min(3, zoom * 1.5) } label: { Image(systemName: "plus.magnifyingglass").frame(width: 44, height: 44) }
                            .accessibilityLabel("Zoom in")
                    }
                    .buttonStyle(.borderless)
                    .background(.regularMaterial, in: Capsule())
                    .padding(8)
                }
                if let m = City.cityMessage(s), model.hud.loaded { Text(m).font(.callout).foregroundStyle(.secondary) }
            }
            Section("Departments") {
                ForEach(["HQ"] + City.departmentNames(s), id: \.self) { d in
                    let p = City.departmentPanel(s, d)
                    Button { selected = d } label: {
                        HStack {
                            Circle().fill(CityPalette.color(d)).frame(width: 12, height: 12).accessibilityHidden(true)
                            Text(d)
                            Spacer()
                            Text(d == "HQ" ? "AIC, Orchestrator" : "\(p.workers.count) at work").foregroundStyle(.secondary)
                        }
                        .frame(minHeight: 44)
                    }
                    .foregroundStyle(.primary)
                }
            }
            Section("Activity") {
                if s.feed.isEmpty { Text("Nothing has happened yet in this session.").foregroundStyle(.secondary) }
                ForEach(s.feed.prefix(20)) { f in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(City.plainText(f.text).short).font(.callout)
                        Text(Fmt.ago(f.at)).font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .navigationTitle("City")
        .withSpendPill()
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { showLegend = true } label: { Image(systemName: "questionmark.circle").frame(minWidth: 44, minHeight: 44) }
                    .accessibilityLabel("What the marks mean")
            }
        }
        .refreshable { await model.loadCity() }
        .onChange(of: model.hud.city) { _, new in slots = CityScenePlan.make(new, previousSlots: slots).1 }
        .sheet(item: Binding(get: { selected.map(Selection.init) }, set: { selected = $0?.id })) { sel in
            CityPanel(id: sel.id).presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $showLegend) { Legend().presentationDetents([.medium, .large]) }
    }

    private func cityDescription(_ s: CityState, _ plan: CityScenePlan) -> String {
        let depts = City.departmentNames(s)
        let atWork = plan.figures.filter { $0.place == .station }.count
        return "The city map. HQ and \(depts.count) department\(depts.count == 1 ? "" : "s"); \(atWork) agents at work."
    }
}

private struct Selection: Identifiable { let id: String }

private struct Stat: View {
    var value: String
    var label: String
    var body: some View {
        VStack {
            Text(value).font(.title3.bold().monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

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
                if let a = s.agents[id] ?? (id == "ace" ? Agent(id: "ace", kind: "core", role: "AIC", department: nil, model: "", state: "active") : nil) {
                    let v = City.visualState(s, id)
                    let detail = s.activities[id].flatMap { $0.activity == v ? $0.detail : nil }.map { City.plainText($0, max: 120).short }
                    Section {
                        Text(City.doingWords(v, detail: detail))
                        LabeledContent("Who", value: a.role)
                        LabeledContent("Where", value: City.deptOf(a))
                        if !a.model.isEmpty { LabeledContent("Model", value: City.modelName[a.model] ?? a.model) }
                        if let t = City.currentTicket(s, id) { LabeledContent("Working on", value: t.goal) }
                        if let c = a.totalCostUsd { LabeledContent("Spent so far (estimate)", value: Fmt.money(c)) }
                    }
                    if a.state != "retired" && id != "ace" {
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
                        if let u = p.todayUsd { LabeledContent("Today (estimate)", value: Fmt.money(u)) }
                    }
                    if !p.workers.isEmpty {
                        Section("Workers") { ForEach(p.workers, id: \.self) { w in Text("\(w): \(City.visuals[City.visualState(s, w)]?.label ?? "")") } }
                    }
                    if !p.openTickets.isEmpty {
                        Section("Open tickets") { ForEach(p.openTickets) { t in Text("\(City.ticketWords(t.status)): \(t.goal)") } }
                    }
                }
            }
            .navigationTitle(id == "ace" ? "AIC" : id)
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
                    Text("HQ: AIC stands in the plaza, the Orchestrator at the door.")
                    Text("Each department has its own office, its manager at the door and workers on the terrace. Lit windows mean someone is at work.")
                    Text("Houses: released workers and saved specialists. A free lot is where the next department goes up.")
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
