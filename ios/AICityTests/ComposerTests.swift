// The message box's shape (decision 157) and dictation into it (ChatScreen.swift, Voice.swift).
import XCTest
@testable import AICity

final class ComposerTests: XCTestCase {
    func testTheBoxGoesTallWhenTheWordsWrapAndStaysTallUntilEmpty() {
        XCTAssertFalse(ComposerLayout.tall(was: false, empty: true, wraps: false))
        XCTAssertFalse(ComposerLayout.tall(was: false, empty: false, wraps: false), "short words: one row")
        XCTAssertTrue(ComposerLayout.tall(was: false, empty: false, wraps: true), "a second line: two rows")
        XCTAssertTrue(ComposerLayout.tall(was: true, empty: false, wraps: false), "stays tall while there are words, even once they fit again")
        XCTAssertFalse(ComposerLayout.tall(was: true, empty: true, wraps: false), "empty again: back to one row")
        XCTAssertFalse(ComposerLayout.tall(was: true, empty: true, wraps: true), "an empty box is never tall")
    }

    func testWrappingIsReadFromTheFieldsHeight() {
        XCTAssertFalse(ComposerLayout.wraps(height: 44, oneLine: 40))
        XCTAssertFalse(ComposerLayout.wraps(height: 55, oneLine: 40), "a little taller is still one line (Dynamic Type, insets)")
        XCTAssertTrue(ComposerLayout.wraps(height: 62, oneLine: 40))
        XCTAssertEqual(ComposerLayout.wrapFactor, 1.4, "the web's threshold")
    }

    func testDictatedWordsJoinWhatIsInTheBox() {
        XCTAssertEqual(Dictation.append("", "hello"), "hello")
        XCTAssertEqual(Dictation.append("Please ", "ship it"), "Please ship it")
        XCTAssertEqual(Dictation.append("Please", "  "), "Please", "nothing heard, nothing added")
        XCTAssertEqual(Dictation.append("", ""), "")
    }

    @MainActor
    func testTalkingSendsAndDictatingDoesNot() {
        let v = VoiceController()
        var sent: [String] = []
        var dictated: [(String, Bool)] = []
        v.onText = { sent.append($0) }
        v.onDictation = { dictated.append(($0, $1)) }
        XCTAssertFalse(v.dictating)
        XCTAssertEqual(v.outputLevel(), 0)
        // Nothing is listening, so toggling only picks the mode; the microphone itself needs a device.
        v.toggle(.dictate)
        XCTAssertEqual(v.mode, .dictate)
        v.toggle(.talk)
        XCTAssertEqual(v.mode, .talk)
        XCTAssertTrue(sent.isEmpty && dictated.isEmpty, "no words without a microphone")
    }
}
