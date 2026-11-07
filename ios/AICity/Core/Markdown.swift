// A small Markdown reader for AIC's replies (same rules as web/src/lib/markdown.tsx): headings, paragraphs,
// bullet and numbered lists, tables, code blocks, and inline **bold**, *italic*, `code` and
// [links](https://…). It builds plain SwiftUI text runs, never web content, so a reply cannot inject markup
// or scripts. Links open only for http(s) addresses; anything else stays plain text.
import Foundation
import SwiftUI

enum MDBlock: Equatable {
    case heading(level: Int, text: String)
    case paragraph([String])  // lines joined with line breaks
    case bullets([String])
    case numbers([String])
    case code(String)
    case table(head: [String], rows: [[String]])
}

enum Markdown {
    static func isTableRule(_ l: String?) -> Bool {
        guard let l else { return false }
        return l.range(of: #"^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$"#, options: .regularExpression) != nil
    }
    static func cells(_ row: String) -> [String] {
        var t = row.trimmingCharacters(in: .whitespaces)
        if t.hasPrefix("|") { t.removeFirst() }
        if t.hasSuffix("|") { t.removeLast() }
        return t.components(separatedBy: "|").map { $0.trimmingCharacters(in: .whitespaces) }
    }
    private static func match(_ line: String, _ pattern: String) -> String? {
        guard let r = try? NSRegularExpression(pattern: pattern),
              let m = r.firstMatch(in: line, range: NSRange(line.startIndex..., in: line)),
              let g = Range(m.range(at: m.numberOfRanges - 1), in: line) else { return nil }
        return String(line[g])
    }
    static func bullet(_ l: String) -> String? { match(l, #"^\s*[-*+]\s+(.*)$"#) }
    static func number(_ l: String) -> String? { match(l, #"^\s*\d+[.)]\s+(.*)$"#) }
    static func heading(_ l: String) -> (Int, String)? {
        guard let hashes = match(l, #"^(#{1,6})\s+.*$"#), let text = match(l, #"^#{1,6}\s+(.*)$"#) else { return nil }
        return (hashes.count, text)
    }

    static func blocks(_ text: String) -> [MDBlock] {
        let lines = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n").components(separatedBy: "\n")
        var out: [MDBlock] = []
        var i = 0
        func at(_ j: Int) -> String? { j < lines.count ? lines[j] : nil }
        while i < lines.count {
            let line = lines[i]
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { i += 1; continue }
            if trimmed.hasPrefix("```") {
                var code: [String] = []
                i += 1
                while i < lines.count, !lines[i].trimmingCharacters(in: .whitespaces).hasPrefix("```") { code.append(lines[i]); i += 1 }
                i += 1
                out.append(.code(code.joined(separator: "\n")))
                continue
            }
            if let (level, t) = heading(line) { out.append(.heading(level: level, text: t)); i += 1; continue }
            if line.contains("|"), isTableRule(at(i + 1)) {
                let head = cells(line)
                var rows: [[String]] = []
                i += 2
                while let l = at(i), l.contains("|"), !l.trimmingCharacters(in: .whitespaces).isEmpty { rows.append(cells(l)); i += 1 }
                out.append(.table(head: head, rows: rows))
                continue
            }
            if bullet(line) != nil || number(line) != nil {
                let isBullet = bullet(line) != nil
                var items: [String] = []
                while let l = at(i), let item = isBullet ? bullet(l) : number(l) { items.append(item); i += 1 }
                out.append(isBullet ? .bullets(items) : .numbers(items))
                continue
            }
            var para: [String] = []
            while let l = at(i), !l.trimmingCharacters(in: .whitespaces).isEmpty, heading(l) == nil, bullet(l) == nil, number(l) == nil,
                  !l.trimmingCharacters(in: .whitespaces).hasPrefix("```"), !(l.contains("|") && isTableRule(at(i + 1))) {
                para.append(l); i += 1
            }
            out.append(.paragraph(para))
        }
        return out
    }

    /// Inline runs as an AttributedString built piece by piece (no HTML, no Markdown interpreter).
    static func inline(_ text: String) -> AttributedString {
        let pattern = #"(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)"#
        guard let re = try? NSRegularExpression(pattern: pattern) else { return AttributedString(text) }
        var out = AttributedString()
        var last = text.startIndex
        for m in re.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let r = Range(m.range, in: text) else { continue }
            out += AttributedString(String(text[last..<r.lowerBound]))
            let part = String(text[r])
            if part.hasPrefix("**") {
                var a = inline(String(part.dropFirst(2).dropLast(2)))
                a.inlinePresentationIntent = .stronglyEmphasized
                out += a
            } else if part.hasPrefix("`") {
                var a = AttributedString(String(part.dropFirst().dropLast()))
                a.inlinePresentationIntent = .code
                a.font = .body.monospaced()
                out += a
            } else if part.hasPrefix("[") {
                let label = part[part.index(after: part.startIndex)..<part.firstIndex(of: "]")!]
                let href = String(part[part.index(part.firstIndex(of: "(")!, offsetBy: 1)..<part.index(before: part.endIndex)])
                var a = AttributedString(String(label))
                if let url = safeLink(href) {
                    a.link = url
                    a.underlineStyle = .single
                }
                out += a
            } else {
                var a = inline(String(part.dropFirst().dropLast()))
                a.inlinePresentationIntent = .emphasized
                out += a
            }
            last = r.upperBound
        }
        out += AttributedString(String(text[last...]))
        return out
    }

    /// Only http(s) links open, and only in Safari outside the app.
    static func safeLink(_ href: String) -> URL? {
        guard let u = URL(string: href), let s = u.scheme?.lowercased(), s == "https" || s == "http", u.host != nil else { return nil }
        return u
    }

    /// The streaming reveal (web/src/components/StreamedText.tsx): how many characters to show after dt.
    static func nextShown(shown: Int, arrived: Int, dtMs: Double) -> Int {
        if shown >= arrived { return arrived }
        let backlog = Double(arrived - shown)
        let cps = max(120, backlog / 0.35)
        return min(arrived, shown + max(1, Int((cps * dtMs / 1000).rounded())))
    }

    /// The first n characters of a streaming reply, trimmed so that half-arrived markup is not shown.
    static func revealable(_ full: String, _ n: Int) -> String {
        let s0 = String(full.prefix(n))
        var lines = s0.components(separatedBy: "\n")
        let fullLines = full.components(separatedBy: "\n")
        if let last = lines.last, last.trimmingCharacters(in: .whitespaces).hasPrefix("|"), n < full.count { lines.removeLast() }
        let i = lines.count - 1
        if i >= 0 {
            let last = lines[i]
            if last.contains("|"), !isTableRule(last), !(i > 0 && lines[i - 1].contains("|")), isTableRule(i + 1 < fullLines.count ? fullLines[i + 1] : nil) {
                lines.removeLast()
            }
        }
        var s = lines.joined(separator: "\n")
        for mark in ["**", "`"] {
            let count = s.components(separatedBy: mark).count - 1
            if count % 2 == 1, let r = s.range(of: mark, options: .backwards) { s = String(s[..<r.lowerBound]) }
        }
        return s
    }
}
