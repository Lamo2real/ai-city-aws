// AIC's Markdown as native text (never a web view), and the streamed reveal of a reply.
import SwiftUI

struct MarkdownText: View {
    var text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(Markdown.blocks(text).enumerated()), id: \.offset) { _, block in
                blockView(block)
            }
        }
        .textSelection(.enabled)
        .environment(\.openURL, OpenURLAction { url in
            Markdown.safeLink(url.absoluteString) != nil ? .systemAction(url) : .discarded
        })
    }

    @ViewBuilder private func blockView(_ b: MDBlock) -> some View {
        switch b {
        case .heading(let level, let t):
            Text(Markdown.inline(t)).font(level <= 1 ? .title3.bold() : level == 2 ? .headline : .subheadline.bold())
                .accessibilityAddTraits(.isHeader)
        case .paragraph(let lines):
            Text(lines.map(Markdown.inline).reduce(AttributedString()) { $0.characters.isEmpty ? $1 : $0 + AttributedString("\n") + $1 })
        case .bullets(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").accessibilityHidden(true)
                        Text(Markdown.inline(item))
                    }
                }
            }
        case .numbers(let items):
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(items.enumerated()), id: \.offset) { i, item in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("\(i + 1).").monospacedDigit()
                        Text(Markdown.inline(item))
                    }
                }
            }
        case .code(let code):
            ScrollView(.horizontal) {
                Text(code).font(.callout.monospaced()).padding(10)
            }
            .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
        case .table(let head, let rows):
            ScrollView(.horizontal) {
                Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
                    GridRow { ForEach(Array(head.enumerated()), id: \.offset) { _, c in Text(Markdown.inline(c)).bold() } }
                    Divider()
                    ForEach(Array(rows.enumerated()), id: \.offset) { _, r in
                        GridRow { ForEach(0..<head.count, id: \.self) { j in Text(Markdown.inline(j < r.count ? r[j] : "")) } }
                    }
                }
                .padding(8)
            }
            .background(Color.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
        }
    }
}

/// A reply as it streams: revealed at a steady typing pace that catches up with what has arrived, with
/// half-arrived Markdown held back. Done, or with Reduce Motion: the whole text at once.
struct StreamedText: View {
    var text: String
    var streaming: Bool
    @State private var shown = 0
    @State private var last = Date()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Group {
            if !streaming || reduceMotion {
                MarkdownText(text: text)
            } else {
                TimelineView(.animation) { ctx in
                    MarkdownText(text: Markdown.revealable(text, shown) + "▍")
                        .onChange(of: ctx.date) { _, now in
                            let dt = now.timeIntervalSince(last) * 1000
                            last = now
                            shown = Markdown.nextShown(shown: shown, arrived: text.count, dtMs: dt)
                        }
                }
            }
        }
        .accessibilityLabel(text)
    }
}
