// The logo (Components.swift, decision 169): the owner's eye ships as a template image, so it takes the text colour.
import XCTest
import UIKit
@testable import AICity

final class WordmarkTests: XCTestCase {
    func testTheEyeIsInTheAppAndWiderThanTall() throws {
        let eye = try XCTUnwrap(UIImage(named: "Eye"), "the Eye image set is in the asset catalog")
        XCTAssertEqual(eye.renderingMode, .alwaysTemplate, "the eye takes the text colour, no background of its own")
        XCTAssertGreaterThan(eye.size.width, eye.size.height * 1.5)
    }
}
