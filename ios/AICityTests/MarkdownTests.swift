import XCTest
@testable import AICity

final class MarkdownTests: XCTestCase {
    func testBlocks() {
        let b = Markdown.blocks("""
        # Title
        Some **bold** text
        and a second line

        - one
        - two
        1. first
        | A | B |
        |---|---|
        | 1 | 2 |
        ```
        code <script>
        ```
        """)
        XCTAssertEqual(b, [
            .heading(level: 1, text: "Title"),
            .paragraph(["Some **bold** text", "and a second line"]),
            .bullets(["one", "two"]),
            .numbers(["first"]),
            .table(head: ["A", "B"], rows: [["1", "2"]]),
            .code("code <script>"),
        ])
    }

    func testInlineRunsAndSafeLinks() {
        let a = Markdown.inline("Hi **you** see [docs](https://example.com) and [bad](javascript:alert(1)) `x`")
        XCTAssertEqual(String(a.characters), "Hi you see docs and bad) x")
        let links = a.runs.compactMap(\.link)
        XCTAssertEqual(links, [URL(string: "https://example.com")!], "only http(s) links become links")
        XCTAssertNil(Markdown.safeLink("javascript:alert(1)"))
        XCTAssertNil(Markdown.safeLink("file:///etc/passwd"))
        XCTAssertNotNil(Markdown.safeLink("http://example.com/x"))
    }

    func testHtmlStaysText() {
        XCTAssertEqual(String(Markdown.inline("<b>not bold</b>").characters), "<b>not bold</b>")
    }

    func testStreamingHoldsBackHalfMarkup() {
        XCTAssertEqual(Markdown.revealable("Hello **wor", 11), "Hello ")
        XCTAssertEqual(Markdown.revealable("Use `co", 7), "Use ")
        let table = "Intro\n| A | B |\n|---|---|\n| 1 | 2 |"
        XCTAssertEqual(Markdown.revealable(table, 14), "Intro", "a table header waits for its rule line")
        XCTAssertEqual(Markdown.nextShown(shown: 10, arrived: 10, dtMs: 16), 10)
        XCTAssertGreaterThan(Markdown.nextShown(shown: 0, arrived: 1000, dtMs: 16), 40, "a backlog catches up")
    }
}
