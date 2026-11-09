import Foundation

/// What the owner said, without the stumbles (the owner's rule, 2026-11-08): fillers ("um", "uh", "er", "hmm"),
/// stammered repeats ("I I think", "the the") and filler-only utterances never reach the chat or AIC. Words inside
/// quotation marks are the owner's on purpose and stay exactly as said. A Swift port of `web/src/voice/clean.ts`.
enum SpeechClean {
    private static let filler = "(?:uh[- ]huh|u+h*m+|u+h+|e+r+m*|a+h+|h+m+|m+h*m+|mhm)"
    private static let soft: Set<String> = ["well", "so", "like", "maybe", "actually", "basically", "anyway", "and", "but", "i", "mean"]

    private static func replace(_ s: String, _ pattern: String, _ with: String) -> String {
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return s }
        return re.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: with)
    }

    private static func scrub(_ s: String) -> String {
        var t = replace(s, ",\\s*\(filler)\\s*,\\s*", " ")
        t = replace(t, "(^|[\\s,.;!?…-])\(filler)(?=$|[\\s,.;!?…-])", "$1")
        t = replace(t, "\\b(\\w{1,3})-\\s+(?=\\1)", "")
        t = replace(t, "\\b(\\w+)(?:[\\s,]+\\1\\b)+", "$1")
        t = replace(t, "\\s*,\\s*(?:,\\s*)+", ", ")
        t = replace(t, "(^|[.!?]\\s*)[,;]\\s*", "$1")
        t = replace(t, "[,;]\\s*([.!?]|$)", "$1")
        t = replace(t, "\\s+([,.;!?])", "$1")
        return replace(t, "\\s{2,}", " ")
    }

    /// The owner's words without fillers and stammers; "" when nothing meaningful is left.
    static func clean(_ text: String) -> String {
        // Outside quotation marks only.
        guard let quotes = try? NSRegularExpression(pattern: "([\"“”][^\"“”]*[\"“”])") else { return text }
        var out = ""
        var last = text.startIndex
        for m in quotes.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let r = Range(m.range, in: text) else { continue }
            out += scrub(String(text[last..<r.lowerBound])) + text[r]
            last = r.upperBound
        }
        out += scrub(String(text[last...]))
        var t = replace(out.trimmingCharacters(in: .whitespacesAndNewlines), "^[,.;…-]+\\s*", "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return "" }
        let words = replace(replace(t.lowercased(), "[\"“”][^\"“”]*[\"“”]", " quoted "), "[^\\p{L}\\p{N}'\\s]", " ")
            .split(whereSeparator: \.isWhitespace).map(String.init)
        if words.isEmpty || words.allSatisfy({ soft.contains($0) }) { return "" }
        if let first = text.trimmingCharacters(in: .whitespaces).first, first.isUppercase, let c = t.first {
            t = c.uppercased() + t.dropFirst()
        }
        return t
    }
}
