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

    func testViceHeardOrSpelledIsAlwaysWrittenVAICAndOrdinaryUsesStay() {
        XCTAssertEqual(SpeechClean.clean("Hey Vice, what's the status?"), "Hey VAIC, what's the status?")
        XCTAssertEqual(SpeechClean.clean("yo vice can you check V A I C's tasks"), "yo VAIC can you check VAIC's tasks")
        XCTAssertEqual(SpeechClean.clean("the vice president said it's vice versa"), "the vice president said it's vice versa")
        XCTAssertEqual(SpeechClean.clean("like Vice City in GTA"), "like Vice City in GTA")
        XCTAssertEqual(SpeechClean.clean("VAIC, ship it"), "VAIC, ship it")
        XCTAssertEqual(SpeechClean.clean("Name the button \"Vice\""), "Name the button \"Vice\"")
        XCTAssertEqual(SpeechClean.clean("advice and device stay"), "advice and device stay")
    }

    func testVaicHeardOrSpelledIsAlwaysWrittenVAICAndQuotedWordsStay() {
        XCTAssertEqual(SpeechClean.clean("Hey Vaic, what's the status?"), "Hey VAIC, what's the status?")
        XCTAssertEqual(SpeechClean.clean("vaic can you check A C E's tasks"), "VAIC can you check VAIC's tasks")
        XCTAssertEqual(SpeechClean.clean("A-C-E, ship it"), "VAIC, ship it")
        XCTAssertEqual(SpeechClean.clean("Name the button \"Vaic\""), "Name the button \"Vaic\"")
        XCTAssertEqual(SpeechClean.clean("Grace and Candace are here"), "Grace and Candace are here")
    }

    func testTheNameIsSaidVice() {
        XCTAssertEqual(VoiceController.speakable("VAIC here. **Done**, and `AIC` too."), "Vice here. Done, and Vice too.")
        XCTAssertEqual(VoiceController.speakable("AI City and AICity stay"), "AI City and AICity stay")
    }
}
