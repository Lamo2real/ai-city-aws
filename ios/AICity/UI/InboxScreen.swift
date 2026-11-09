// Open items (More → While I'm away → Open items; the Needs you tab before Autopilot): what is still open from
// before, kept reachable until it is empty so nothing is lost. Every question shows its default with a one-tap "Use default"; approvals are bound to the exact
// action and need holding the button on a confirmation that says what it may cost.
import SwiftUI

struct InboxScreen: View {
    @Environment(AppModel.self) private var model
    @State private var problem: String?
    @State private var confirming: Approval?
    @State private var own: [String: String] = [:]
    @State private var busy: Set<String> = []

    var body: some View {
        let questions = model.hud.openQuestions
        let approvals = model.hud.openApprovals
        let chief = model.hud.chief
        List {
            Group {
                if let problem { Banner(tone: .bad, text: problem).listRowSeparator(.hidden).listRowBackground(Color.clear) }
                if questions.isEmpty && approvals.isEmpty {
                    EmptyState(text: "Nothing is open. Everything from before has been handled.").listRowSeparator(.hidden)
                }
                if !approvals.isEmpty {
                    Section("Approvals") {
                        ForEach(approvals) { a in
                            VStack(alignment: .leading, spacing: 8) {
                                NeedsOwnerWhy(why: chief.needsOwner[a.id] ?? a.needsOwnerReason)
                                Text("\(City.displayName(a.agent)) wants to do exactly this, once:")
                                Text(a.action).font(.callout.monospaced()).padding(8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .glassWell(radius: 8)
                                Text("Why it needs you: \(a.reason)").font(.callout).foregroundStyle(.secondary)
                                HStack {
                                    Button("Refuse") {
                                        run(a.id, done: "Refused. The agent will carry on without it.") {
                                            try await model.api?.decide(approval: a.id, approved: false)
                                            Haptics.warning()
                                        }
                                    }
                                    .buttonStyle(.glass)
                                    Spacer()
                                    Button("Approve…") { confirming = a }
                                        .buttonStyle(.glass)
                                }
                                .disabled(busy.contains(a.id))
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
                if !questions.isEmpty {
                    Section("Questions") {
                        ForEach(Array(questions.enumerated()), id: \.element.id) { i, q in
                            QuestionCard(q: q, first: i == 0, why: chief.needsOwner[q.id] ?? q.needsOwnerReason, own: Binding(get: { own[q.id] ?? "" }, set: { own[q.id] = $0 }), busy: busy.contains(q.id)) { kind in
                                switch kind {
                                case .useDefault:
                                    run(q.id, done: "Answered with the default: \(q.defaultAnswer)") { try await model.api?.useDefault(question: q.id) }
                                case .option(let o):
                                    run(q.id, done: "Answered: \(o)") { try await model.api?.answer(question: q.id, with: o) }
                                case .own:
                                    let t = (own[q.id] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                                    guard !t.isEmpty else { return }
                                    run(q.id, done: "Answer sent.") { try await model.api?.answer(question: q.id, with: t) }
                                }
                            }
                        }
                    }
                }
            }
            .glassRows()
        }
        .nightScreen()
        .navigationTitle("Open items")
        .refreshable { await model.loadCity() }
        .sheet(item: $confirming) { a in
            HoldToApprove(approval: a) {
                confirming = nil
                run(a.id, done: "Approved once. The agent will run it now.") {
                    try await model.api?.decide(approval: a.id, approved: true)
                    Haptics.success()
                }
            } cancel: { confirming = nil }
            .nightSheet()
            .presentationDetents([.medium, .large])
        }
    }

    private func run(_ id: String, done: String, _ fn: @escaping () async throws -> Void) {
        problem = nil
        busy.insert(id)
        Task {
            defer { busy.remove(id) }
            do {
                try await fn()
                model.show(done, tone: .good)
            } catch {
                Haptics.error()
                problem = AppModel.plain(error)
            }
        }
    }
}

struct QuestionCard: View {
    enum Choice { case useDefault, option(String), own }
    var q: Question
    var first: Bool
    var why: String? = nil
    @Binding var own: String
    var busy: Bool
    var choose: (Choice) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            NeedsOwnerWhy(why: why)
            Text("\(q.path) · \(Fmt.ago(City.parseISO(q.createdAt)))").font(.caption).foregroundStyle(.secondary)
            Text(q.text).font(.body.weight(.medium))
            if first {
                Button { choose(.useDefault) } label: { Text("Use default: \(q.defaultAnswer)").frame(maxWidth: .infinity) }
                    .buttonStyle(.glassPrimary)
            } else {
                Button { choose(.useDefault) } label: { Text("Use default: \(q.defaultAnswer)").frame(maxWidth: .infinity) }
                    .buttonStyle(.glass)
            }
            ForEach(q.options.filter { $0 != q.defaultAnswer }, id: \.self) { o in
                Button(o) { choose(.option(o)) }.buttonStyle(.glass)
            }
            HStack {
                TextField("Or answer in your own words", text: $own)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 44)
                    .glassWell()
                    .onSubmit { choose(.own) }
                Button("Send") { choose(.own) }.frame(minWidth: 44, minHeight: 44)
                    .disabled(own.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityLabel("Send answer")
            }
        }
        .disabled(busy)
        .buttonStyle(.borderless)
        .padding(.vertical, 4)
    }
}

/// On an open item: why the Chief of Staff left it to the owner.
struct NeedsOwnerWhy: View {
    var why: String?
    var body: some View {
        if let why, !why.isEmpty {
            Text("Chief of Staff: \(why)")
                .font(.callout.weight(.semibold))
                .foregroundStyle(Glass.warnLight)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 10).padding(.vertical, 6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .glassTint(Glass.warnTint)
        }
    }
}

/// One thing the Chief of Staff decided: the question, its choice, the one-line reason, when and which department;
/// tap to read it all.
struct DecidedRow: View {
    var d: DecidedItem
    @State private var open = false

    var body: some View {
        let meta = [Fmt.ago(City.parseISO(d.at)), d.department].filter { !$0.isEmpty }.joined(separator: " · ")
        DisclosureGroup(isExpanded: $open) {
            VStack(alignment: .leading, spacing: 6) {
                if !d.reason.isEmpty { Text("Why: \(d.reason)") }
                if let t = City.parseISO(d.at) {
                    Text(Date(timeIntervalSince1970: t / 1000).formatted(date: .abbreviated, time: .shortened))
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .font(.callout)
            .padding(.top, 4)
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text(d.title).font(.body.weight(.semibold)).lineLimit(open ? nil : 1)
                (Text(d.kind == "approval" ? "It said: " : "It chose: ") + Text(d.choice.isEmpty ? "—" : d.choice).bold())
                    .font(.callout)
                if !d.reason.isEmpty, !open {
                    Text(d.reason).font(.callout).foregroundStyle(.secondary).lineLimit(1)
                }
                if !meta.isEmpty { Text(meta).font(.caption).foregroundStyle(.secondary) }
            }
            .frame(minHeight: 44, alignment: .leading)
        }
        .tint(Glass.amber2)
        .accessibilityLabel("Decided: \(d.title). \(d.kind == "approval" ? "It said" : "It chose") \(d.choice).")
    }
}

/// Approving needs holding the button for a moment (a tap does nothing), with a haptic when it lands.
struct HoldToApprove: View {
    var approval: Approval
    var approve: () -> Void
    var cancel: () -> Void
    @State private var progress: CGFloat = 0
    @State private var holding = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Approve this action?").font(.title2.bold())
            Text("\(approval.action) — it runs once, exactly as written. \(approval.reason)")
            Label(approval.costHint ?? "This may cost money or be hard to undo; that is why it needs you.", systemImage: "dollarsign.circle")
                .foregroundStyle(Glass.warnLight)
            Spacer(minLength: 0)
            // The primary action: amber on ink, like every primary button; the hold fills it with light.
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Glass.accentFill)
                GeometryReader { g in
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white.opacity(0.45)).frame(width: g.size.width * progress)
                }
                RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Glass.accentEdge, lineWidth: 1)
                Text(holding ? "Keep holding…" : "Hold to approve").font(.headline).frame(maxWidth: .infinity)
                    .foregroundStyle(Glass.accentInk)
            }
            .frame(height: 56)
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 1.2, maximumDistance: 40) {
                Haptics.success()
                approve()
            } onPressingChanged: { pressing in
                holding = pressing
                if pressing { Haptics.tap() }
                withAnimation(pressing ? .linear(duration: 1.2) : Glass.ease(Glass.durS)) { progress = pressing ? 1 : 0 }
            }
            .accessibilityElement()
            .accessibilityLabel("Approve")
            .accessibilityHint("Runs once, exactly as written.")
            .accessibilityAddTraits(.isButton)
            .accessibilityAction { Haptics.success(); approve() }
            Button(action: cancel) { Text("Cancel").frame(maxWidth: .infinity) }.buttonStyle(.glass)
        }
        .padding(24)
    }
}
