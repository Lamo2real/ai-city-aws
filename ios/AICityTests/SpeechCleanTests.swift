import XCTest
@testable import AICity

final class SpeechCleanTests: XCTestCase {
    func testDropsFillersAndStammers() {
        XCTAssertEqual(SpeechClean.clean("I I think we should, um, ship it"), "I think we should ship it")
        XCTAssertEqual(SpeechClean.clean("Hmm, uhm, can you check the costs, er, today?"), "Can you check the costs today?")
        XCTAssertEqual(SpeechClean.clean("That that is fine"), "That is fine")
    }

    func testFillerOnlyIsNothing() {
        XCTAssertEqual(SpeechClean.clean("Um, um, um, well, um, maybe, um."), "")
        XCTAssertEqual(SpeechClean.clean("Um"), "")
    }

    func testKeepsQuotedWordsAndRealNames() {
        XCTAssertEqual(SpeechClean.clean("Remove the words \"um\" and \"uh\" from the app"), "Remove the words \"um\" and \"uh\" from the app")
        XCTAssertEqual(SpeechClean.clean("Ahmed and Erik have a meeting with Humana"), "Ahmed and Erik have a meeting with Humana")
        XCTAssertEqual(SpeechClean.clean("Yes."), "Yes.")
    }

    func testAceIsAlwaysWrittenAIC() {
        XCTAssertEqual(SpeechClean.clean("Hey Ace, what's the status?"), "Hey AIC, what's the status?")
        XCTAssertEqual(SpeechClean.clean("A-C-E, ship it"), "AIC, ship it")
        XCTAssertEqual(SpeechClean.clean("Name the button \"Ace\""), "Name the button \"Ace\"")
        XCTAssertEqual(SpeechClean.clean("Grace and Candace are here"), "Grace and Candace are here")
    }
}
