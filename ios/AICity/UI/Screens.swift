// Tickets, Costs and Settings (web/src/components/Screens.tsx). Plain words first; technical details behind
// "Details".
import SwiftUI

/// Loads one API value with loading, error and retry states.
@MainActor @Observable final class Loader {
    var data: JSONValue?
    var error: String?
    func load(_ fn: @escaping () async throws -> JSONValue?) async {
        error = nil
        do { data = try await fn() } catch { self.error = AppModel.plain(error) }
    }
}

// MARK: Tickets

struct TicketsScreen: View {
    @Environment(AppModel.self) private var model
    enum Which: Hashable { case live, done, decided }
    @State private var which = Which.live
    @State private var loader = Loader()
    private var done: Bool { which == .done }

    var body: some View {
        let tickets = which == .decided ? [] : loader.data?["tickets"].array.compactMap(Ticket.init(json:)) ?? []
        List {
            Picker("Which tickets", selection: $which) {
                Text("Working now").tag(Which.live)
                Text("Finished").tag(Which.done)
                Text("Decided").tag(Which.decided)
            }
            .pickerStyle(.segmented)
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)
            Group {
                if which == .decided {
                    // What the Chief of Staff decided for the owner, newest first (Autopilot).
                    let decided = model.hud.chief.decided
                    if decided.isEmpty {
                        EmptyState(text: "Nothing decided yet. When your team asks something, the Chief of Staff decides it and it shows here.")
                    } else {
                        Section {
                            ForEach(decided) { d in DecidedRow(d: d) }
                        } header: {
                            Text("Decided for you")
                        } footer: {
                            Text("Newest first. Tap one to read it all. If one isn't what you want, tell VAIC what to do instead.")
                        }
                    }
                } else if let e = loader.error {
                    Banner(tone: .bad, text: "Tickets did not load: \(e)", action: ("Try again", { Task { await reload() } }))
                } else if loader.data == nil {
                    LoadingView(what: "tickets")
                } else if tickets.isEmpty {
                    EmptyState(text: done ? "Nothing finished yet." : "Nothing is being worked on. Ask VAIC for something.")
                }
                ForEach(tickets) { t in
                    NavigationLink(value: t.id) {
                        VStack(alignment: .leading, spacing: 4) {
                            StatusTag(status: t.status)
                            Text(t.goal).lineLimit(3)
                            Text("\(City.displayName(t.to)) · \(Fmt.ago(City.parseISO(t.updatedAt)))").font(.caption).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
            .glassRows()
        }
        .nightScreen()
        .navigationTitle("Tickets")
        .navigationDestination(for: String.self) { TicketDetail(id: $0) }
        .task(id: which) { if which != .decided { await reload() } }
        .onAppear { if model.showDecided { which = .decided; model.showDecided = false } }
        .onChange(of: model.showDecided) { _, v in if v { which = .decided; model.showDecided = false } }
        .refreshable { await reload() }
    }

    private func reload() async {
        if loader.data != nil { loader.data = nil }
        await loader.load { try await model.api?.tickets(done: done) }
    }
}

struct StatusTag: View {
    var status: String
    @Environment(\.glass) private var glass
    var body: some View {
        let color: Color = status == "done" ? .green : status == "failed" ? .red : status == "waiting_on_owner" ? .orange : .blue
        let tint: Color = status == "done" ? Glass.goodTint : status == "failed" ? Glass.badTint : status == "waiting_on_owner" ? Glass.warnTint : Glass.infoTint
        let light: Color = status == "done" ? Glass.goodLight : status == "failed" ? Glass.badLight : status == "waiting_on_owner" ? Glass.warnLight : Glass.infoLight
        Text(City.ticketWords(status)).font(.caption.weight(.semibold)).padding(.horizontal, 8).padding(.vertical, 3)
            .background(glass ? tint : color.opacity(0.15), in: Capsule()).foregroundStyle(glass ? light : color)
            .overlay { if glass { Capsule().strokeBorder(Glass.edge, lineWidth: 1) } }
    }
}

struct TicketDetail: View {
    @Environment(AppModel.self) private var model
    var id: String
    @State private var loader = Loader()
    @State private var details = false

    var body: some View {
        List {
            Group {
                if let e = loader.error { Banner(tone: .bad, text: e) }
                if loader.data == nil && loader.error == nil { LoadingView(what: "the ticket") }
                if let d = loader.data, let t = Ticket(json: d["ticket"]) {
                    Section {
                        Text(t.goal).font(.title3.bold())
                        HStack { StatusTag(status: t.status); Text("\(City.displayName(t.from)) → \(City.displayName(t.to))").foregroundStyle(.secondary) }
                        if let r = t.result { Text(r).textSelection(.enabled) }
                    }
                    Section("What happened") {
                        ForEach(Array(d["history"].array.enumerated()), id: \.offset) { _, h in
                            let at = City.parseISO(h["at"].string).map { Date(timeIntervalSince1970: $0 / 1000).formatted(date: .abbreviated, time: .shortened) } ?? ""
                            let note = h["note"].string ?? ""
                            Text("\(at) — \(City.ticketWords(h["to"].string ?? ""))\(note.isEmpty ? "" : " (\(note))")").font(.callout)
                        }
                    }
                    let parts = d["children"].array.compactMap(Ticket.init(json:))
                    if !parts.isEmpty {
                        Section("Parts") {
                            ForEach(parts) { c in Text("\(City.ticketWords(c.status)): \(c.goal) — \(City.displayName(c.to))") }
                        }
                    }
                    Section {
                        DisclosureGroup("Details", isExpanded: $details) {
                            Text(d["ticket"].pretty).font(.caption.monospaced()).textSelection(.enabled)
                        }
                    }
                }
            }
            .glassRows()
        }
        .nightScreen()
        .navigationTitle("Ticket")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loader.load { try await model.api?.ticket(id) } }
    }
}

// MARK: Costs

struct CostsScreen: View {
    @Environment(AppModel.self) private var model
    @State private var loader = Loader()

    var body: some View {
        List {
            Group {
                Text(City.costNote).font(.footnote).foregroundStyle(.secondary).listRowBackground(Color.clear)
                if let e = loader.error {
                    Banner(tone: .bad, text: "Costs did not load: \(e)", action: ("Try again", { Task { await load() } }))
                } else if loader.data == nil {
                    LoadingView(what: "costs")
                }
                if let d = loader.data {
                    Section {
                        Meter(label: "Today", spent: d["today"]["usd"].double ?? 0, cap: d["caps"]["daily_global_usd"].double)
                        Meter(label: "This month", spent: d["month"]["usd"].double ?? 0, cap: d["caps"]["monthly_budget_usd"].double)
                        Text("Prompt caching saved about \(Fmt.money(d["month"]["cache_savings_usd"].double ?? 0)) this month.")
                    }
                    CostTable(title: "This month by department", rows: d["by_department"])
                    CostTable(title: "This month by role", rows: d["by_role"])
                    CostTable(title: "This month by model", rows: d["by_model"])
                    if let u = d["cost_explorer_url"].string.flatMap(Markdown.safeLink) {
                        Section { Link("Open AWS Cost Explorer (the real bill)", destination: u).frame(minHeight: 44) }
                    }
                }
            }
            .glassRows()
        }
        .nightScreen()
        .navigationTitle("Costs (estimates)")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async { await loader.load { try await model.api?.costs() } }
}

struct Meter: View {
    var label: String
    var spent: Double
    var cap: Double?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(label).bold()
                Spacer()
                Text(cap.map { "\(Fmt.money(spent)) of \(Fmt.money($0)) (estimate)" } ?? "\(Fmt.money(spent)) (estimate, no limit)")
                    .monospacedDigit().foregroundStyle(.secondary)
            }
            if let cap {
                let level = Fmt.spendLevel(spent: spent, cap: cap)
                ProgressView(value: cap > 0 ? min(spent, cap) : 1, total: cap > 0 ? cap : 1)
                    .tint(level == .red ? Glass.badLight : level == .amber ? Glass.warnLight : Glass.amber)
                    .accessibilityLabel("\(label): \(Fmt.money(spent)) of \(Fmt.money(cap))")
                if level != .ok {
                    Text(level == .red ? "Cap reached: no new work starts." : "Close to the cap.").font(.callout)
                        .foregroundStyle(level == .red ? Glass.badLight : Glass.warnLight)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

struct CostTable: View {
    var title: String
    var rows: JSONValue

    var body: some View {
        let list = rows.object.sorted { ($0.value["usd"].double ?? 0) > ($1.value["usd"].double ?? 0) }
        Section(title) {
            if list.isEmpty { Text("Nothing spent yet.").foregroundStyle(.secondary) }
            ForEach(list, id: \.key) { k, v in
                HStack {
                    Text(k)
                    Spacer()
                    Text(Fmt.money(v["usd"].double)).monospacedDigit()
                    Text("\(Int(v["turns"].double ?? 0)) turns").font(.caption).foregroundStyle(.secondary).frame(minWidth: 64, alignment: .trailing)
                }
                .accessibilityElement(children: .combine)
            }
        }
    }
}

// MARK: Settings

struct SettingsForm: Equatable {
    var paused = false
    var dailyGlobal = ""
    var dailyDepartment = ""
    var monthly = ""
    var perSecond = ""
    var profilePrefix = "global"
    var notifyEmail = true
    var integrations: [String: Bool] = [:]

    init() {}
    init(_ s: JSONValue) {
        paused = s["paused"].bool ?? false
        dailyGlobal = s["daily_global_usd"].double.map(City.fmtNumber) ?? ""
        dailyDepartment = s["daily_department_usd"].double.map(City.fmtNumber) ?? ""
        monthly = s["monthly_budget_usd"].double.map(City.fmtNumber) ?? ""
        perSecond = s["max_new_sessions_per_second"].double.map(City.fmtNumber) ?? ""
        profilePrefix = s["profile_prefix"].string ?? "global"
        notifyEmail = s["notify_email"].bool ?? true
        integrations = s["integrations"].object.compactMapValues(\.bool)
    }

    /// A cap: empty means no limit (null). Nil when the text isn't a number of zero or more.
    static func cap(_ t: String) -> JSONValue? {
        let s = t.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: ".")
        if s.isEmpty { return .null }
        guard let v = Double(s), v >= 0, v.isFinite else { return nil }
        return .number(v)
    }
    var capsInvalid: Bool { [dailyGlobal, dailyDepartment, monthly].contains { Self.cap($0) == nil } }

    /// The PUT /settings body (the same keys the web HUD sends).
    var patch: JSONValue {
        var o: [String: JSONValue] = [
            "daily_global_usd": Self.cap(dailyGlobal) ?? .null,
            "daily_department_usd": Self.cap(dailyDepartment) ?? .null,
            "monthly_budget_usd": Self.cap(monthly) ?? .null,
            "profile_prefix": .string(profilePrefix),
            "notify_email": .bool(notifyEmail),
            "integrations": .object(integrations.mapValues { .bool($0) }),
        ]
        if let n = Double(perSecond.trimmingCharacters(in: .whitespaces)) { o["max_new_sessions_per_second"] = .number(n) }
        return .object(o)
    }
}

struct SettingsScreen: View {
    @Environment(AppModel.self) private var model
    @AppStorage(TapSignal.key) private var tapFeedback = true
    @State private var loader = Loader()
    @State private var form = SettingsForm()
    @State private var saved = SettingsForm()
    @State private var problem: String?
    @State private var confirmPause = false
    @State private var confirmSignOut = false
    @State private var confirmForget = false
    @State private var saving = false

    var body: some View {
        Form {
            Group {
                if let e = loader.error {
                    Banner(tone: .bad, text: "Settings did not load: \(e)", action: ("Try again", { Task { await load() } }))
                } else if loader.data == nil {
                    LoadingView(what: "settings")
                } else {
                    content
                }
            }
            .glassRows()
        }
        .nightScreen()
        .navigationTitle("Settings")
        .task { await load() }
        .safeAreaInset(edge: .bottom) {
            if loader.data != nil {
                Button {
                    Task { await save() }
                } label: {
                    Text(saving ? "Saving…" : "Save changes").frame(maxWidth: .infinity)
                }
                .buttonStyle(.glassPrimary)
                .disabled(form.capsInvalid || form == saved || saving)
                .padding()
                .glassBar()
                .environment(\.colorScheme, .dark)
            }
        }
        .confirmationDialog("Pause the city?", isPresented: $confirmPause, titleVisibility: .visible) {
            Button("Pause", role: .destructive) { Task { await togglePause() } }
        } message: {
            Text("No new work starts. Work already running finishes within 15 minutes. Questions and results still reach you. Pausing costs nothing; storage, logs and the login page still cost a few cents a day.")
        }
        .confirmationDialog("Sign out of AI City on this iPhone?", isPresented: $confirmSignOut, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await model.signOut() } }
        } message: { Text("You need your password and a 6-digit code to sign in again. The city keeps running.") }
        .confirmationDialog("Forget this iPhone's conversation?", isPresented: $confirmForget, titleVisibility: .visible) {
            Button("Forget", role: .destructive) { model.hud.chat = [] }
        } message: { Text("Only this iPhone forgets it. It costs nothing.") }
    }

    @ViewBuilder private var content: some View {
        if let problem { Banner(tone: .bad, text: problem) }
        Section("The city") {
            Text(form.paused ? "Paused: nothing new starts." : "Running.")
            Button(form.paused ? "Resume the city" : "Pause the city…") {
                if form.paused { Task { await togglePause() } } else { confirmPause = true }
            }
            .frame(minHeight: 44)
        }
        Section {
            CapField(label: "Daily cap, all departments ($)", text: $form.dailyGlobal)
            CapField(label: "Daily cap per department ($)", text: $form.dailyDepartment)
            CapField(label: "Monthly cap ($)", text: $form.monthly)
            if form.capsInvalid {
                Text("Caps must be zero or more dollars, or empty for no limit.").foregroundStyle(Glass.badLight).font(.callout)
            }
        } header: { Text("Spend caps (optional)") } footer: {
            Text("No limit by default. Leave a field empty for no limit, or enter dollars to stop new work there.")
        }
        Section {
            NumberField(label: "New workers per second (max 25)", text: $form.perSecond)
        } header: { Text("Work at once") } footer: {
            Text("No limit on agents: each build gets as many workers as its parts can run at the same time.")
        }
        Section("Where Claude runs") {
            Picker("Model location", selection: $form.profilePrefix) {
                Text("Worldwide (cheapest; prompts may leave the EU)").tag("global")
                Text("Europe only (about 10% more; Fable roles use Opus instead)").tag("eu")
            }
            .pickerStyle(.inline)
            .labelsHidden()
        }
        Section("Notifications") {
            PushRow()
            Toggle("Email me when a task is done, a question waits, or spend nears a cap you set", isOn: $form.notifyEmail)
        }
        if !form.integrations.isEmpty {
            Section {
                ForEach(form.integrations.keys.sorted(), id: \.self) { k in
                    Toggle(k.replacingOccurrences(of: "_", with: " "), isOn: Binding(get: { form.integrations[k] ?? false }, set: { form.integrations[k] = $0 }))
                }
            } header: { Text("Integrations") } footer: {
                Text("Built but off. Each needs its sign-in set up in AWS first (see the deploy checklist).")
            }
        }
        Section {
            Toggle("Tap sound and rings", isOn: $tapFeedback).frame(minHeight: 44)
        } header: { Text("General") } footer: {
            Text("A soft click, a light tap you can feel and two rings wherever you tap. The silent switch mutes the click; Reduce Motion hides the rings.")
        }
        Section("Help and this iPhone") {
            Button("Show the first-run guide again") { model.showGuide = true }.frame(minHeight: 44)
            Button("Forget this iPhone's conversation…") { confirmForget = true }.frame(minHeight: 44)
            Button("Sign out…", role: .destructive) { confirmSignOut = true }.frame(minHeight: 44)
        }
    }

    private func load() async {
        await loader.load { try await model.api?.settings() }
        if let d = loader.data { form = SettingsForm(d); saved = form }
    }

    private func save() async {
        problem = nil
        saving = true
        defer { saving = false }
        let previous = saved
        do {
            guard let r = try await model.api?.saveSettings(form.patch) else { return }
            form = SettingsForm(r)
            saved = form
            Haptics.success()
            model.show("Settings saved.", tone: .good) {
                if let back = try? await model.api?.saveSettings(previous.patch) { form = SettingsForm(back); saved = form }
            }
        } catch {
            problem = (error as? APIError)?.errorDescription ?? "Not saved. Nothing changed. Try again."
        }
    }

    private func togglePause() async {
        let next = !form.paused
        do {
            try await model.api?.setPaused(next)
            form.paused = next
            saved.paused = next
            model.show(next ? "The city is paused." : "The city is running again.") {
                try? await model.api?.setPaused(!next)
                form.paused = !next
                saved.paused = !next
            }
        } catch {
            problem = AppModel.plain(error)
        }
    }
}

/// This iPhone's notifications: on, off in iOS Settings, or not asked yet.
struct PushRow: View {
    @Environment(AppModel.self) private var model
    @Environment(\.openURL) private var openURL

    var body: some View {
        let push = model.push
        if let problem = push.problem {
            Text(problem).foregroundStyle(.secondary)
        } else {
            switch push.state {
            case .on:
                Label("This iPhone gets a notification when a large feature is done.", systemImage: "bell.badge")
            case .off:
                Text("Notifications are off for AI City on this iPhone.")
                Button("Turn them on in iOS Settings") {
                    if let u = URL(string: UIApplication.openNotificationSettingsURLString) { openURL(u) }
                }
                .frame(minHeight: 44)
            case .notAsked, .unknown:
                Button("Notify this iPhone when a large feature is done") { Task { await push.allow() } }
                    .frame(minHeight: 44)
            }
        }
    }
}

struct CapField: View {
    var label: String
    @Binding var text: String
    var body: some View {
        LabeledContent(label) {
            TextField("No limit", text: $text).keyboardType(.decimalPad).multilineTextAlignment(.trailing).frame(minHeight: 44)
        }
    }
}

struct NumberField: View {
    var label: String
    @Binding var text: String
    var body: some View {
        LabeledContent(label) {
            TextField("", text: $text).keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(minHeight: 44)
        }
    }
}

// MARK: First-run guide

struct FirstRunGuide: View {
    var done: () -> Void
    @State private var i = 0
    private let steps = [
        ("Meet VAIC", "Talk to VAIC like a friend. Type, or tap the mic and speak. Ask for anything. VAIC tells you when it is done."),
        ("See the City", "The City shows your organization live: the planner at HQ, one building per department, and workers who walk in when hired and leave when done. Tap anyone to see what they are doing."),
        ("Where the money is", "Costs stay out of the way: everything about spend lives under More → Costs, and nowhere else. Figures there are estimates; the AWS bill is the truth."),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Step \(i + 1) of \(steps.count)").font(.footnote).foregroundStyle(.secondary)
            Text(steps[i].0).font(.title.bold())
            Text(steps[i].1)
            Spacer()
            HStack {
                Button("Skip", action: done).frame(minWidth: 44, minHeight: 44)
                Spacer()
                Button(i < steps.count - 1 ? "Next" : "Start") {
                    if i < steps.count - 1 { i += 1 } else { done() }
                }
                .buttonStyle(.glassPrimary)
            }
        }
        .padding(24)
        .nightSheet()
        .presentationDetents([.medium])
        .interactiveDismissDisabled()
    }
}
