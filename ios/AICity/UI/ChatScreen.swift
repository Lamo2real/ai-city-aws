// The landing screen (web AceScreen): AIC's eye and voice line on top, then the chat, then the composer
// with push-to-talk. The owner's lines sit on the right in a filled bubble; AIC's on the left as plain
// full-width text with its Markdown. While AIC works, its status row shows the current step and seconds.
import SwiftUI

struct ChatScreen: View {
    @Environment(AppModel.self) private var model
    @AppStorage("aic.draft") private var draft = ""
    @FocusState private var focused: Bool
    @State private var confirmClear = false

    var body: some View {
        let hud = model.hud
        VStack(spacing: 0) {
            VStack(spacing: 6) {
                EyeView(size: 110)
                VoiceLine(presence: hud.presence, listening: model.voice.listening, level: model.voice.inputLevel, speaking: model.voice.speaking)
                    .frame(maxWidth: 260)
                if model.voice.listening, !model.voice.partial.isEmpty {
                    Text(model.voice.partial).font(.callout).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            .padding(.vertical, 8)

            VStack(spacing: 8) {
                if let p = model.voice.problem { Banner(tone: .bad, text: p) }
                if hud.waitingCount > 0 {
                    Banner(tone: .warn, text: hud.waitingCount == 1 ? "One thing needs you." : "\(hud.waitingCount) things need you.",
                           action: ("Open", { model.open(.inbox) }))
                }
                if hud.live == .reconnecting { Banner(tone: .bad, text: "Connection lost. Your messages are saved. Reconnecting…") }
                if !hud.unsent.isEmpty, hud.live == .online {
                    Banner(tone: .info, text: (hud.unsent.count == 1 ? "One message is waiting to send." : "\(hud.unsent.count) messages are waiting to send.") + " They go out automatically.")
                }
            }
            .padding(.horizontal)

            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if hud.chat.isEmpty {
                            Text("Say hi. Try “yo AIC, what’s the status?” or tap the mic.")
                                .foregroundStyle(.secondary).padding(.top, 24).frame(maxWidth: .infinity)
                        }
                        ForEach(hud.chat) { line in MessageRow(line: line).id(line.id) }
                        if hud.waitingForAic, let turn = hud.turn { AicStatusRow(turn: turn).id("status") }
                    }
                    .padding()
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: hud.chat.last?.text) { _, _ in withAnimation { proxy.scrollTo(hud.chat.last?.id, anchor: .bottom) } }
                .onChange(of: hud.chat.count) { _, _ in withAnimation { proxy.scrollTo(hud.waitingForAic ? "status" : hud.chat.last?.id, anchor: .bottom) } }
                .onAppear { proxy.scrollTo(hud.chat.last?.id, anchor: .bottom) }
            }
            .accessibilityLabel("Conversation with AIC")

            Composer(draft: $draft, focused: $focused)
        }
        .nightScreen()
        .navigationTitle("AIC")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Menu {
                    Toggle("Speak replies", isOn: Binding(get: { model.voice.speakReplies }, set: { model.voice.speakReplies = $0 }))
                    Button("Clear conversation on this iPhone…", role: .destructive) { confirmClear = true }
                        .disabled(hud.chat.isEmpty)
                } label: {
                    Image(systemName: "ellipsis.circle").frame(minWidth: 44, minHeight: 44)
                }
                .accessibilityLabel("Chat options")
            }
        }
        .confirmationDialog("Clear the conversation on this iPhone?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear", role: .destructive) { model.hud.chat = [] }
        } message: {
            Text("Only this iPhone forgets it. AIC keeps its own record, and it costs nothing.")
        }
    }
}

struct MessageRow: View {
    var line: ChatLine
    @State private var showSteps = false

    var body: some View {
        if line.who == .owner {
            HStack {
                Spacer(minLength: 48)
                VStack(alignment: .trailing, spacing: 4) {
                    // The owner speaking: translucent lamplight blue, light text (the HUD's --you-t).
                    Text(line.text)
                        .padding(.horizontal, 14).padding(.vertical, 10)
                        .foregroundStyle(Glass.text)
                        .glassTint(Glass.youTint, radius: 18, edge: Glass.edge2)
                        .textSelection(.enabled)
                    if line.state == .failed || line.state == .queued {
                        Label("Not sent yet. It will send when the connection is back.", systemImage: "clock")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("You: \(line.text)\(line.state == .failed || line.state == .queued ? ". Not sent yet." : "")")
        } else {
            VStack(alignment: .leading, spacing: 6) {
                StreamedText(text: line.text, streaming: line.state == .streaming)
                    .accessibilityLabel("AIC: \(line.text)")
                if line.state == .done, let steps = line.steps, steps.count >= 2 {
                    DisclosureGroup(isExpanded: $showSteps) {
                        VStack(alignment: .leading, spacing: 2) {
                            ForEach(Array(steps.enumerated()), id: \.offset) { i, s in Text("\(i + 1). \(s)").font(.caption) }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    } label: {
                        let secs = line.tookMs.map { max(1, Int(($0 / 1000).rounded())) }
                        Text("\(steps.count) steps\(secs.map { " · \($0)s" } ?? "")").font(.caption).foregroundStyle(.secondary)
                    }
                    .frame(minHeight: 44)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// AIC at work, before its first words: a small eye with a slow blink, the step with a soft shimmer, seconds.
struct AicStatusRow: View {
    var turn: AceTurn
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { ctx in
            let secs = max(0, Int((ctx.date.timeIntervalSince1970 * 1000 - turn.started) / 1000))
            let blink = !reduceMotion && Int(ctx.date.timeIntervalSince1970 * 4) % 16 == 0
            HStack(spacing: 10) {
                EyeView(size: 28).scaleEffect(y: blink ? 0.15 : 1)
                Text("\(turn.steps.last ?? "Working on it")…")
                    .foregroundStyle(.secondary)
                    .opacity(reduceMotion ? 1 : 0.65 + 0.35 * abs(sin(ctx.date.timeIntervalSince1970 * 2)))
                Text("\(secs)s").font(.caption.monospacedDigit()).foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("AIC: \(turn.steps.last ?? "Working on it")")
    }
}

struct Composer: View {
    @Environment(AppModel.self) private var model
    @Binding var draft: String
    var focused: FocusState<Bool>.Binding

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Button {
                model.voice.toggle()
            } label: {
                Image(systemName: model.voice.listening ? "stop.circle.fill" : "mic.circle")
                    .font(.system(size: 30))
                    .frame(width: 44, height: 44)
                    .foregroundStyle(model.voice.listening ? Glass.badLight : Glass.amber)
            }
            .accessibilityLabel(model.voice.listening ? "Stop listening and send" : "Talk to AIC")
            .accessibilityHint("Tap to talk, tap again to send what you said.")

            TextField("Type your message…", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused(focused)
                .padding(.horizontal, 12).padding(.vertical, 10)
                .frame(minHeight: 44)
                .glassWell(radius: 20)
                .submitLabel(.send)
                .onSubmit(send)
                .accessibilityLabel("Message to AIC")

            Button(action: send) {
                Image(systemName: "arrow.up").font(.headline).frame(width: 44, height: 44)
            }
            .buttonStyle(.glassPrimaryCircle)
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .accessibilityLabel("Send to AIC")
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .glassBar()
    }

    private func send() {
        let t = draft
        guard !t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        draft = ""
        Task { await model.send(t) }
    }
}
