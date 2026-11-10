// Autopilot on the iPhone, like web/src/components/Away.tsx: "While you were away" at the top of VAIC's screen
// (by itself after more than 12 hours away, and from the clock any time), and More → While I'm away (the Autopilot
// switch, the standing orders, and the open items from before). Calm: no badges, no counts that nag.
import SwiftUI

struct AwayPanel: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL
    var since: Double
    @State private var summary: AwaySummary?
    @State private var failed = false

    var body: some View {
        // At most about half the screen: it scrolls inside when there is more, so the chat stays in view.
        ViewThatFits(in: .vertical) {
            content
            ScrollView { content }
        }
        .frame(maxHeight: 380)
        .buttonStyle(.borderless)
        .glassPanel()
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2).fill(Glass.amber).frame(width: 3).padding(.vertical, 12)
        }
        .task(id: since) {
            do {
                summary = try await model.loadAway(since: since)
            } catch {
                failed = true
            }
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("While you were away").font(.headline)
                Spacer()
                Button { model.awaySince = nil } label: {
                    Image(systemName: "xmark").font(.callout).foregroundStyle(Glass.mute).frame(width: 44, height: 44)
                }
                .accessibilityLabel("Close While you were away")
            }
            if failed {
                Text("This didn't load. Your work carried on; try again from the clock.").font(.callout).foregroundStyle(.secondary)
            } else if let s = summary {
                if let t = City.parseISO(s.since) {
                    Text("Since \(Date(timeIntervalSince1970: t / 1000).formatted(date: .abbreviated, time: .shortened)).")
                        .font(.caption).foregroundStyle(.secondary)
                }
                if s.isQuiet { Text("All quiet. Nothing new happened.").font(.callout) }
                if !s.whenBack.isEmpty {
                    part("When you're back") {
                        Text("Only you can do these. Nothing waited for them.").font(.caption).foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        ForEach(s.whenBack) { w in backRow(w) }
                    }
                }
                if !s.finished.isEmpty { part("Finished") { few(s.finished) } }
                if !s.running.isEmpty { part("Still working on") { few(s.running) } }
                if s.decided > 0 {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("The Chief of Staff made \(s.decided == 1 ? "1 decision" : "\(s.decided) decisions") for you.").font(.callout)
                            .fixedSize(horizontal: false, vertical: true)
                        Button("See what it decided") { model.open(.tickets); model.showDecided = true }
                            .font(.callout.weight(.semibold)).foregroundStyle(Glass.amber2).frame(minHeight: 44)
                    }
                }
                if !s.handled.isEmpty { part("Your standing orders handled") { few(s.handled) } }
            } else {
                ProgressView().frame(maxWidth: .infinity)
            }
        }
        .padding(14)
    }

    @ViewBuilder private func part(_ title: String, @ViewBuilder _ content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.subheadline.weight(.semibold))
            content()
        }
    }

    @ViewBuilder private func few(_ items: [String]) -> some View {
        ForEach(Array(items.prefix(4).enumerated()), id: \.offset) { _, t in
            Text("• \(t)").font(.callout).fixedSize(horizontal: false, vertical: true)
        }
        if items.count > 4 { Text("and \(items.count - 4) more").font(.caption).foregroundStyle(.secondary) }
    }

    private func backRow(_ w: WhenBack) -> some View {
        let a = Away.backAction(w)
        return VStack(alignment: .leading, spacing: 6) {
            Text(w.title).font(.callout.weight(.semibold))
            if !w.why.isEmpty { Text(w.why).font(.caption).foregroundStyle(.secondary) }
            Button {
                if a.path == "#/settings/open-items" { model.open(.inbox) } else if let u = model.siteURL.flatMap({ URL(string: a.path, relativeTo: $0) }) { openURL(u) }
            } label: {
                Text(a.label).frame(maxWidth: .infinity)
            }
            .buttonStyle(.glass)
            .accessibilityHint(a.path == "#/settings/open-items" ? "" : "Opens AI City in Safari, where you finish it.")
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassWell()
    }
}

/// More → While I'm away.
struct AwaySettingsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var autopilot: Bool?
    @State private var orders: [StandingOrder]?
    @State private var problem: String?
    @State private var removing: StandingOrder?

    var body: some View {
        let open = model.hud.waitingCount
        List {
            Group {
                Section {
                    if let on = autopilot {
                        Toggle(isOn: Binding(get: { on }, set: { v in Task { await flip(v) } })) {
                            Text("Autopilot").font(.headline)
                        }
                        .tint(Glass.amber)
                        Text(on
                             ? "Your city keeps working while you're away. The Chief of Staff answers your team's questions and approvals; what only you can do waits on a short list for when you're back, and nothing stops for it."
                             : "Off: your team's questions and approvals wait for you.")
                            .font(.callout)
                    } else {
                        LoadingView(what: "Autopilot")
                    }
                }
                Section {
                    if let problem {
                        Banner(tone: .bad, text: problem, action: ("Try again", { Task { await load() } }))
                    } else if let orders {
                        if orders.isEmpty {
                            Text("No standing orders yet. Add one, like “check new Jira tickets every 15 minutes”.").font(.callout)
                        }
                        ForEach(orders) { o in orderRow(o) }
                    } else {
                        LoadingView(what: "your standing orders")
                    }
                    Button { model.startStandingOrder() } label: { Text("Add a standing order").frame(maxWidth: .infinity) }
                        .buttonStyle(.glassPrimary)
                } header: {
                    Text("Standing orders")
                } footer: {
                    Text("Work the city picks up on its own, on a schedule. Add opens VAIC's chat with “While I'm away, …”: say what to handle and how often.")
                }
                if open > 0 {
                    Section {
                        NavigationLink(value: AppSection.inbox) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Open items").font(.headline)
                                Text(open == 1 ? "1 thing from before Autopilot is still open" : "\(open) things from before Autopilot are still open")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                            .frame(minHeight: 44)
                        }
                    }
                }
            }
            .glassRows()
        }
        .nightScreen()
        .navigationTitle("While I'm away")
        .task { await load() }
        .refreshable { await load() }
        .confirmationDialog("Delete this standing order?", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }),
                            titleVisibility: .visible, presenting: removing) { o in
            Button("Delete", role: .destructive) { Task { await delete(o) } }
        } message: { o in Text("\(Away.words(o)) You can add it again any time by asking VAIC.") }
    }

    private func orderRow(_ o: StandingOrder) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(Away.words(o)).font(.body.weight(.semibold)).foregroundStyle(o.enabled ? Glass.text : Glass.mute)
            if !o.instructions.isEmpty { Text("“\(o.instructions)”").font(.caption).foregroundStyle(.secondary) }
            HStack {
                Toggle("On", isOn: Binding(get: { o.enabled }, set: { v in Task { await toggle(o, v) } }))
                    .labelsHidden().tint(Glass.amber)
                    .accessibilityLabel("\(Away.words(o)) On or off")
                Text(o.enabled ? "On" : "Off").font(.callout)
                Spacer()
                Button("Delete") { removing = o }.foregroundStyle(Glass.text).frame(minHeight: 44)
                    .accessibilityLabel("Delete: \(Away.words(o))")
            }
        }
        .buttonStyle(.borderless)
        .padding(.vertical, 4)
    }

    private func load() async {
        problem = nil
        guard let api = model.api else { return }
        if let s = try? await api.settings() { autopilot = s["autopilot"].bool != false } else if autopilot == nil { autopilot = true }
        do { orders = try await api.standingOrders() } catch let e as APIError where e.status == 404 {
            orders = []
        } catch {
            problem = "Your standing orders didn't load. Check the connection."
        }
    }
    private func flip(_ on: Bool) async {
        let was = autopilot
        autopilot = on
        do {
            _ = try await model.api?.saveSettings(["autopilot": .bool(on)])
            model.show(on ? "Autopilot is on. Nothing waits for you." : "Autopilot is off. Questions wait for you again.", tone: .good)
        } catch {
            autopilot = was
            model.show(AppModel.plain(error), tone: .bad)
        }
    }
    private func toggle(_ o: StandingOrder, _ on: Bool) async {
        set(o.id) { $0.enabled = on }
        do { try await model.api?.setStandingOrder(o.id, enabled: on) } catch {
            set(o.id) { $0.enabled = !on }
            model.show(AppModel.plain(error), tone: .bad)
        }
    }
    private func delete(_ o: StandingOrder) async {
        removing = nil
        orders?.removeAll { $0.id == o.id }
        do {
            try await model.api?.deleteStandingOrder(o.id)
            model.show("Deleted. That work is no longer picked up on its own.", tone: .good)
        } catch {
            orders?.append(o)
            model.show(AppModel.plain(error), tone: .bad)
        }
    }
    private func set(_ id: String, _ change: (inout StandingOrder) -> Void) {
        guard let i = orders?.firstIndex(where: { $0.id == id }) else { return }
        change(&orders![i])
    }
}
