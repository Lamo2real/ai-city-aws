// The landing screen (web VaicScreen, decisions 106–108 and 112): there is no top bar and no title, so the
// conversation runs from the status bar (fading softly under the clock) down to the composer; the history and
// clear buttons float as small glass circles in the top corners, and the composer holds the + menu, the box,
// one voice button and Send. The voice has no row of its own: its light (UI/Aurora.swift) rises from the
// message box behind the chat text, blue for the owner and amber for VAIC, and is not there when nobody talks.
// The owner's lines sit on the right in a filled bubble; VAIC's on the left as plain full-width text with its
// Markdown. While VAIC works, its status row shows the current step and seconds.
import PhotosUI
import SwiftUI

struct ChatScreen: View {
    @Environment(AppModel.self) private var model
    @AppStorage("vaic.draft") private var draft = ""
    @FocusState private var focused: Bool
    @State private var confirmClear = false
    @State private var menuOpen = false
    @State private var composerHeight: CGFloat = 0
    @State private var statusBarHeight: CGFloat = 0

    var body: some View {
        let hud = model.hud
        let speaker = Aurora.speaker(listening: model.voice.listening, speaking: model.voice.speaking,
                                     presence: hud.presence, askedByVoice: model.lastAskedByVoice)
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        if hud.chat.isEmpty {
                            Text("Say hi. Type, or tap the mic and just talk.")
                                .foregroundStyle(.secondary).padding(.top, 24).frame(maxWidth: .infinity)
                        }
                        ForEach(hud.chat) { line in MessageRow(line: line).id(line.id) }
                        if hud.waitingForVaic, let turn = hud.turn { VaicStatusRow(turn: turn).id("status") }
                    }
                    .padding()
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: hud.chat.last?.text) { _, _ in withAnimation { proxy.scrollTo(hud.chat.last?.id, anchor: .bottom) } }
                .onChange(of: hud.chat.count) { _, _ in withAnimation { proxy.scrollTo(hud.waitingForVaic ? "status" : hud.chat.last?.id, anchor: .bottom) } }
                .onAppear { proxy.scrollTo(hud.chat.last?.id, anchor: .bottom) }
            }
            .accessibilityLabel("Conversation with VAIC")
            // Under the status bar: the two floating buttons, and the notes that need the owner.
            .safeAreaInset(edge: .top, spacing: 0) { notes }

            Composer(draft: $draft, focused: $focused, menuOpen: $menuOpen, speaker: speaker)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { composerHeight = $0 }
        }
        // The voice's light, behind the chat text and the composer's glass: it rises from the box's top edge.
        .background(alignment: .bottom) {
            AuroraView(speaker: speaker, voice: model.voice, base: composerHeight)
                .frame(height: composerHeight + Aurora.reach)
        }
        .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { statusBarHeight = $0 }
        .nightScreen()
        // No top bar on this tab (decision 145): the room goes to the conversation.
        .toolbar(.hidden, for: .navigationBar)
        .confirmationDialog("Clear the conversation on this iPhone?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear", role: .destructive) { model.hud.chat = [] }
        } message: {
            Text("Only this iPhone forgets it. VAIC keeps its own record, and it costs nothing.")
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
        HStack(alignment: .top, spacing: 4) {
            // "While you were away": by itself after more than 12 hours away, and from this clock any time.
            if !model.awayMissing {
                FloatingGlassButton(symbol: "clock", label: "While you were away") { model.toggleAway() }
                    .padding(.leading, 6)
            }
            VStack(spacing: 8) {
                if let since = model.awaySince { AwayPanel(since: since).padding(.top, 6) }
                ForEach(Array(banners.enumerated()), id: \.offset) { $0.element }
            }
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
            .padding(.vertical, banners.isEmpty ? 0 : 8)
            if !hud.chat.isEmpty {
                FloatingGlassButton(symbol: "trash", label: "Clear conversation on this iPhone") { confirmClear = true }
                    .padding(.trailing, 6)
            }
        }
        // The soft fade under the status bar, so the conversation never clashes with the clock. It reaches a
        // little below the status bar and lies behind the buttons; with nothing in the row it is all there is.
        .background(alignment: .top) { StatusBarFade(statusBarHeight: statusBarHeight) }
        // A note that needs the owner sits on glass up to the top edge, so the chat never shows through it.
        .background { if !banners.isEmpty { Rectangle().fill(.ultraThinMaterial).ignoresSafeArea(edges: .top) } }
    }
}

/// A small floating glass circle (36 pt drawn, 44 pt to tap) for the chat's top corners.
struct FloatingGlassButton: View {
    var symbol: String
    var label: String
    var action: () -> Void
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(Glass.text)
                .frame(width: 36, height: 36)
                .background {
                    if reduceTransparency { Circle().fill(Glass.solid) } else { Circle().fill(.ultraThinMaterial) }
                    Circle().fill(Glass.fill)
                }
                .overlay(Circle().strokeBorder(Glass.edge2, lineWidth: 1))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

/// The night, blurred, fading out just below the status bar: text scrolls up into it instead of under the clock.
/// Under Reduce Transparency it is the solid night with the same fade. Drawn from the top of the screen down
/// to `reach` points below the status bar, whatever view it is the background of.
struct StatusBarFade: View {
    var statusBarHeight: CGFloat
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    /// How far below the status bar the fade reaches.
    static let reach: CGFloat = 26

    var body: some View {
        let height = statusBarHeight + Self.reach
        Rectangle()
            .fill(reduceTransparency ? AnyShapeStyle(Glass.solid) : AnyShapeStyle(.ultraThinMaterial))
            .overlay(Glass.night2.opacity(reduceTransparency ? 0 : 0.35))
            .mask {
                // Full under the clock, gone at the bottom edge.
                LinearGradient(stops: [.init(color: .black, location: 0),
                                       .init(color: .black.opacity(0.85), location: statusBarHeight / max(1, height) * 0.8),
                                       .init(color: .clear, location: 1)],
                               startPoint: .top, endPoint: .bottom)
            }
            .frame(height: height)
            .offset(y: -statusBarHeight)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
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
                if !line.text.isEmpty || line.state == .streaming {
                    StreamedText(text: line.text, streaming: line.state == .streaming)
                        .accessibilityLabel("VAIC: \(line.text)")
                }
                if let files = line.files, !files.isEmpty {
                    if let label = line.filesLabel {
                        Text(label.uppercased()).font(.caption2.weight(.bold)).foregroundStyle(Glass.mute)
                    }
                    FileCards(files: files)
                }
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

/// VAIC at work, before its first words: a small amber light that breathes, the step with a soft shimmer, seconds.
struct VaicStatusRow: View {
    var turn: VaicTurn
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.25)) { ctx in
            let secs = max(0, Int((ctx.date.timeIntervalSince1970 * 1000 - turn.started) / 1000))
            let breath = reduceMotion ? 1 : 0.55 + 0.45 * abs(sin(ctx.date.timeIntervalSince1970 * 2))
            HStack(spacing: 10) {
                Circle().fill(Glass.accentFill).frame(width: 10, height: 10).opacity(breath)
                Text("\(turn.steps.last ?? "Working on it")…")
                    .foregroundStyle(.secondary)
                    .opacity(reduceMotion ? 1 : 0.65 + 0.35 * abs(sin(ctx.date.timeIntervalSince1970 * 2)))
                Text("\(secs)s").font(.caption.monospacedDigit()).foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("VAIC: \(turn.steps.last ?? "Working on it")")
    }
}

/// The message box's two layouts (decision 157, ChatGPT's way): the words use the whole width on one row; once
/// they need a second line the text takes the full top row and the buttons move under it, and it stays that
/// way until the box is empty again, so the layout never flickers while typing.
enum ComposerLayout {
    /// Whether the box is in its two-row shape now, from whether it was, whether it is empty, and whether the
    /// text needs more than one line.
    static func tall(was: Bool, empty: Bool, wraps: Bool) -> Bool { empty ? false : (was || wraps) }
    /// A text field taller than this many single lines has wrapped (the web's 1.4).
    static let wrapFactor: CGFloat = 1.4
    static func wraps(height: CGFloat, oneLine: CGFloat) -> Bool { height > oneLine * wrapFactor }
}

/// The bottom of the screen: what rides along with the message, and one rounded glass field that holds the +
/// button, the words, a plain dictate mic, the voice button and Send (decision 157).
struct Composer: View {
    @Environment(AppModel.self) private var model
    @Binding var draft: String
    var focused: FocusState<Bool>.Binding
    @Binding var menuOpen: Bool
    /// Who is talking right now: VoiceOver hears it as the voice button's value (the light itself is decoration).
    var speaker: AuroraSpeaker = .idle
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var tall = false
    @State private var fieldHeight: CGFloat = 0

    var body: some View {
        let voice = model.voice
        let attachments = model.attachments
        let commands = Slash.allCommands(model.skills)
        let suggestions = Slash.matchCommands(draft, commands)
        VStack(spacing: 8) {
            if voice.listening, !voice.dictating, !voice.partial.isEmpty {
                Text(voice.partial).font(.callout).foregroundStyle(.secondary).lineLimit(2)
            }
            if let p = voice.problem { Banner(tone: .bad, text: p) }
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
            field
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .glassBar()
    }

    /// One rounded field. Short words: everything on one row. Wrapped words: the text on top, the buttons under it.
    @ViewBuilder private var field: some View {
        let shape = RoundedRectangle(cornerRadius: tall ? 24 : 28, style: .continuous)
        // One tree for both shapes, so the text field keeps its identity (and the keyboard its focus) when the
        // buttons move from beside the words to under them.
        VStack(spacing: 0) {
            HStack(alignment: .bottom, spacing: 2) {
                if !tall { plus }
                textField
                if !tall {
                    dictate
                    talk
                    sendButton
                }
            }
            if tall {
                HStack(spacing: 2) {
                    plus
                    Spacer(minLength: 0)
                    dictate
                    talk
                    sendButton
                }
            }
        }
        .padding(4)
        .background(shape.fill(Glass.deep))
        .overlay(shape.strokeBorder(focused.wrappedValue ? Glass.amber : Glass.edge2, lineWidth: 1))
        .animation(reduceMotion ? nil : Glass.ease(Glass.durS), value: focused.wrappedValue)
        .onChange(of: draft) { _, text in
            if text.isEmpty { tall = false }
        }
    }

    private var textField: some View {
        TextField(model.voice.dictating ? "Listening… your words appear here" : "Type your message…", text: $draft, axis: .vertical)
            .lineLimit(1...6)
            .focused(focused)
            .padding(.horizontal, 8).padding(.vertical, 9)
            .frame(minHeight: 44)
            .submitLabel(.send)
            .onSubmit(send)
            .accessibilityLabel("Message to VAIC")
            // The field's own height says whether the words wrapped; the two-row shape then stays until the box is empty.
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { h in
                let oneLine = UIFont.preferredFont(forTextStyle: .body).lineHeight + 18
                tall = ComposerLayout.tall(was: tall, empty: draft.isEmpty, wraps: ComposerLayout.wraps(height: h, oneLine: oneLine))
            }
    }

    private var plus: some View {
        Button { menuOpen = true } label: { icon("plus", on: menuOpen) }
            .buttonStyle(.plain)
            .accessibilityLabel("Add to your message")
    }

    /// The plain mic: words into the box (ChatGPT's mic); blue while it listens, like the web's dictate button.
    private var dictate: some View {
        let voice = model.voice
        return Button(action: toggleDictation) {
            icon(voice.dictating ? "stop.fill" : "mic", on: voice.dictating, fill: voice.dictating ? Glass.lamp.opacity(0.9) : nil, ink: voice.dictating ? .white : nil)
        }
        .buttonStyle(.plain)
        .disabled(voice.listening && !voice.dictating)
        .accessibilityLabel(voice.dictating ? "Stop dictating" : "Dictate into the box")
        .accessibilityHint("Your words appear in the box as you speak; stop, then edit or send.")
    }

    /// The voice button (the waveform): what is said is sent and answered aloud; the accent while it listens.
    private var talk: some View {
        let voice = model.voice
        let on = voice.listening && !voice.dictating
        return Button { voice.toggle(.talk) } label: {
            icon(on ? "stop.fill" : "waveform", on: on, accent: on)
        }
        .buttonStyle(.plain)
        .disabled(voice.dictating)
        .accessibilityLabel(on ? "Stop listening and send" : "Talk to VAIC")
        .accessibilityValue(Aurora.words(speaker))
        .accessibilityHint("Tap to talk, tap again to send what you said. VAIC answers aloud.")
    }

    private var sendButton: some View {
        Button(action: send) {
            Image(systemName: "arrow.up").font(.headline).frame(width: 44, height: 44)
        }
        .buttonStyle(.glassPrimaryCircle)
        .disabled((draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && model.attachments.entries.isEmpty) || !model.attachments.sendable)
        .accessibilityLabel("Send to VAIC")
    }

    /// A borderless icon in a 44 pt circle: no edge, no fill, unless it is on.
    private func icon(_ symbol: String, on: Bool, fill: Color? = nil, ink: Color? = nil, accent: Bool = false) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 20, weight: .medium))
            .foregroundStyle(accent ? Glass.accentInk : (ink ?? (on ? Glass.amber : Glass.text)))
            .frame(width: 44, height: 44)
            .background {
                if accent { Circle().fill(Glass.accentFill) } else if let fill { Circle().fill(fill) }
            }
            .contentShape(Circle())
            .animation(reduceMotion ? nil : Glass.ease(Glass.durS), value: on)
    }

    /// Dictation: the words stream into the box after what was already there; stopping keeps them to edit.
    private func toggleDictation() {
        let voice = model.voice
        if voice.listening { return voice.toggle() }
        let base = draft
        voice.onDictation = { words, _ in draft = Dictation.append(base, words) }
        voice.toggle(.dictate)
        focused.wrappedValue = true
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
