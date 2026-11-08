// Needs you: every question shows its default with a one-tap "Use default"; approvals are bound to the exact
// action and need holding the button on a confirmation that says what it may cost.
import SwiftUI

struct InboxScreen: View {
    @Environment(AppModel.self) private var model
    @State private var problem: String?
    @State private var confirming: Approval?
    @State private var own: [String: String] = [:]
    @State private var busy: Set<String> = []

    var body: some View {
        let questions = model.hud.city.questions.values.sorted { $0.createdAt < $1.createdAt }
        let approvals = model.hud.city.approvals.values.sorted { $0.id < $1.id }
        List {
            Group {
                if let problem { Banner(tone: .bad, text: problem).listRowSeparator(.hidden).listRowBackground(Color.clear) }
                if questions.isEmpty && approvals.isEmpty {
                    EmptyState(text: "Nothing is waiting for you. AIC will tell you when something is.").listRowSeparator(.hidden)
                }
                if !approvals.isEmpty {
                    Section("Approvals") {
                        ForEach(approvals) { a in
                            VStack(alignment: .leading, spacing: 8) {
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
                            QuestionCard(q: q, first: i == 0, own: Binding(get: { own[q.id] ?? "" }, set: { own[q.id] = $0 }), busy: busy.contains(q.id)) { kind in
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
        .navigationTitle("Needs you")
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
    @Binding var own: String
    var busy: Bool
    var choose: (Choice) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
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
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Glass.amber.opacity(0.2))
                GeometryReader { g in
                    RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Glass.primaryGradient).frame(width: g.size.width * progress)
                }
                RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(Glass.edge2, lineWidth: 1)
                Text(holding ? "Keep holding…" : "Hold to approve").font(.headline).frame(maxWidth: .infinity)
                    .foregroundStyle(progress > 0.5 ? Glass.ink : Glass.text)
            }
            .frame(height: 56)
            .contentShape(Rectangle())
            .onLongPressGesture(minimumDuration: 1.2, maximumDistance: 40) {
                Haptics.success()
                approve()
            } onPressingChanged: { pressing in
                holding = pressing
                if pressing { Haptics.tap() }
                withAnimation(pressing ? .linear(duration: 1.2) : .easeOut(duration: 0.2)) { progress = pressing ? 1 : 0 }
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
