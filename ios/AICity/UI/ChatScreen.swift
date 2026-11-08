// The landing screen (web AceScreen, decisions 106–108): the conversation runs up under the glass top bar,
// the clear button floats in its corner, and the voice strip (a small eye at the start of the voice line, the
// Speak replies pill) sits above the composer with its + menu and push-to-talk. The owner's lines sit on the
// right in a filled bubble; AIC's on the left as plain full-width text with its Markdown. While AIC works,
// its status row shows the current step and seconds.
import PhotosUI
import SwiftUI

struct ChatScreen: View {
    @Environment(AppModel.self) private var model
    @AppStorage("aic.draft") private var draft = ""
    @FocusState private var focused: Bool
    @State private var confirmClear = false
    @State private var menuOpen = false

    var body: some View {
        let hud = model.hud
        VStack(spacing: 0) {
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
            // Under the bar: the notes that need the owner, and the quiet clear button in the corner.
            .safeAreaInset(edge: .top, spacing: 0) { notes }

            Composer(draft: $draft, focused: $focused, menuOpen: $menuOpen)
        }
        .nightScreen()
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbar { ToolbarItem(placement: .principal) { Wordmark() } }
        .confirmationDialog("Clear the conversation on this iPhone?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear", role: .destructive) { model.hud.chat = [] }
        } message: {
            Text("Only this iPhone forgets it. AIC keeps its own record, and it costs nothing.")
        }
        .sheet(isPresented: $menuOpen) {
            PlusMenuSheet(onURLs: { urls, fromFolder in
                Task {
                    if fromFolder, let folder = urls.first {
                        let r = await FilePicks.readFolder(folder)
                        if let note = r.note { model.show(note) }
                        await model.attach(r.files)
                    } else {
                        await model.attach(await FilePicks.read(urls))
                    }
                    focused = true
                }
            }, onPhotos: { items in
                Task {
                    await model.attach(await FilePicks.read(items))
                    focused = true
                }
            }, onInsert: { i in
                draft = Slash.insert(i.words, into: draft, atStart: i.atStart)
                focused = true
            })
        }
        .task { await model.loadLists() }
    }

    @ViewBuilder private var notes: some View {
        let hud = model.hud
        let banners = [
            hud.live == .reconnecting ? Banner(tone: .bad, text: "Connection lost. Your messages are saved. Reconnecting…") : nil,
            !hud.unsent.isEmpty && hud.live == .online
                ? Banner(tone: .info, text: (hud.unsent.count == 1 ? "One message is waiting to send." : "\(hud.unsent.count) messages are waiting to send.") + " They go out automatically.")
                : nil,
        ].compactMap { $0 }
        if !banners.isEmpty || !hud.chat.isEmpty || !model.awayMissing {
            HStack(alignment: .top, spacing: 4) {
                // "While you were away": by itself after more than 12 hours away, and from this clock any time.
                if !model.awayMissing {
                    Button { model.toggleAway() } label: {
                        Image(systemName: "clock").font(.callout).foregroundStyle(Glass.mute).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("While you were away")
                    .padding(.leading, 4)
                }
                VStack(spacing: 8) {
                    if let since = model.awaySince { AwayPanel(since: since).padding(.top, 6) }
                    ForEach(Array(banners.enumerated()), id: \.offset) { $0.element }
                }
                .frame(maxWidth: .infinity)
                .padding(.horizontal)
                .padding(.vertical, banners.isEmpty ? 0 : 8)
                if !hud.chat.isEmpty {
                    Button { confirmClear = true } label: {
                        Image(systemName: "trash").font(.callout).foregroundStyle(Glass.mute).frame(width: 44, height: 44)
                    }
                    .accessibilityLabel("Clear conversation on this iPhone")
                    .padding(.trailing, 4)
                }
            }
            .background { if !banners.isEmpty { Rectangle().fill(.ultraThinMaterial) } }
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

/// The bottom of the screen: the voice strip, what rides along with the message, and the box with its buttons.
struct Composer: View {
    @Environment(AppModel.self) private var model
    @Binding var draft: String
    var focused: FocusState<Bool>.Binding
    @Binding var menuOpen: Bool

    var body: some View {
        let voice = model.voice
        let attachments = model.attachments
        let commands = Slash.allCommands(model.skills)
        let suggestions = Slash.matchCommands(draft, commands)
        VStack(spacing: 8) {
            // A small eye at the start of the voice line (decision 107); the line keeps its bars, wave and dots.
            HStack(spacing: 12) {
                EyeView(size: 44)
                VoiceLine(presence: model.hud.presence, listening: voice.listening, level: voice.inputLevel, speaking: voice.speaking)
                    .frame(maxWidth: .infinity)
            }
            if voice.listening, !voice.partial.isEmpty {
                Text(voice.partial).font(.callout).foregroundStyle(.secondary).lineLimit(2)
            }
            if let p = voice.problem { Banner(tone: .bad, text: p) }
            if !focused.wrappedValue {
                // Speak replies: one glass pill, the amber highlight sliding to the choice (decision 106's look).
                HStack(spacing: 12) {
                    Text("Speak replies").font(.footnote.weight(.bold))
                    GlassSegmented(options: VoiceController.SpeakMode.allCases, label: \.label,
                                   selection: Binding(get: { voice.speakMode }, set: { voice.speakMode = $0 }))
                        .frame(maxWidth: 270)
                        .accessibilityLabel("Speak replies")
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if !attachments.entries.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(attachments.entries) { e in
                            AttachedChip(entry: e) { attachments.remove(e.id, api: model.api) }
                        }
                    }
                }
                .accessibilityLabel("Attached to your message")
            }
            if !suggestions.isEmpty {
                // Typing "/" lists the commands above the box: one line each, and the list scrolls past four so
                // the box stays above the keyboard.
                ScrollView {
                    VStack(spacing: 0) {
                        ForEach(suggestions.prefix(8)) { c in
                            Button {
                                draft = Slash.insert("/\(c.name) ", into: draft, atStart: true)
                            } label: {
                                HStack(spacing: 10) {
                                    Text("/\(c.name)").font(.body.weight(.semibold)).foregroundStyle(Glass.text)
                                    Text(c.hint).font(.footnote).foregroundStyle(Glass.mute).lineLimit(1)
                                    Spacer(minLength: 0)
                                }
                                .padding(.horizontal, 12)
                                .frame(minHeight: 44)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .frame(maxHeight: 44 * 4)
                .fixedSize(horizontal: false, vertical: suggestions.count <= 4)
                .padding(.vertical, 4)
                .glassPanel(radius: Glass.radius)
                .accessibilityLabel("Slash commands")
            }
            HStack(alignment: .bottom, spacing: 8) {
                PlusButton(open: $menuOpen)

                TextField("Type your message…", text: $draft, axis: .vertical)
                    .lineLimit(1...5)
                    .focused(focused)
                    .padding(.horizontal, 12).padding(.vertical, 10)
                    .frame(minHeight: 44)
                    .glassWell(radius: 20)
                    .submitLabel(.send)
                    .onSubmit(send)
                    .accessibilityLabel("Message to AIC")

                Button {
                    voice.toggle()
                } label: {
                    Image(systemName: voice.listening ? "stop.circle.fill" : "mic.circle")
                        .font(.system(size: 30))
                        .frame(width: 44, height: 44)
                        .foregroundStyle(voice.listening ? Glass.badLight : Glass.amber)
                }
                .accessibilityLabel(voice.listening ? "Stop listening and send" : "Talk to AIC")
                .accessibilityHint("Tap to talk, tap again to send what you said.")

                Button(action: send) {
                    Image(systemName: "arrow.up").font(.headline).frame(width: 44, height: 44)
                }
                .buttonStyle(.glassPrimaryCircle)
                .disabled((draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && attachments.entries.isEmpty) || !attachments.sendable)
                .accessibilityLabel("Send to AIC")
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .glassBar()
    }

    private func send() {
        let t = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let attached = model.attachments.items
        guard !t.isEmpty || !attached.isEmpty else { return }
        guard model.attachments.sendable else { return model.show("Your files are still uploading. Send once they are in.") }
        var body = t
        switch Slash.expand(t, Slash.allCommands(model.skills)) {
        case .clear:
            model.hud.chat = []
            draft = ""
            return
        case .needs(let c):
            return model.show(Slash.needsWords(c))
        case .send(let said):
            body = said
        case nil:
            break
        }
        body = Attach.body(body, attached: attached)
        draft = ""
        model.attachments.clear()
        Task { await model.send(body) }
    }
}

/// One file riding along with the message: its name, its live status, and × to leave it out (and delete it).
struct AttachedChip: View {
    var entry: Attachments.Entry
    var remove: () -> Void

    var body: some View {
        HStack(spacing: 6) {
            Text(entry.item.title).font(.footnote.weight(.semibold)).lineLimit(1).frame(maxWidth: 160)
            Text(entry.words).font(.footnote)
                .foregroundStyle(entry.failed ? Glass.badLight : entry.item.status == .ready ? Glass.goodLight : Glass.mute)
                .lineLimit(1)
            Button(action: remove) {
                Image(systemName: "xmark").font(.footnote.weight(.semibold)).frame(width: 44, height: 44)
            }
            .accessibilityLabel("Remove \(entry.item.title)")
        }
        .padding(.leading, 12)
        .frame(height: 44)
        .glassTint(Glass.fill2, radius: 22)
        .accessibilityElement(children: .contain)
    }
}
