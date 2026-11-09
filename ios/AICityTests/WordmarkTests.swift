// The logo's drawn parts (Components.swift, decision 158): the skyline and the spark fit their boxes.
import XCTest
@testable import AICity

final class WordmarkTests: XCTestCase {
    func testTheSkylineFillsTheWebsTwentyFourPointBox() {
        let b = Skyline().path(in: CGRect(x: 0, y: 0, width: 24, height: 24)).boundingRect
        XCTAssertEqual(b.minX, 2, accuracy: 0.01, "the ground starts at 2")
        XCTAssertEqual(b.maxX, 22, accuracy: 0.01)
        XCTAssertEqual(b.minY, 2.4, accuracy: 0.01, "the aerial's tip")
        XCTAssertEqual(b.maxY, 22.2, accuracy: 0.01, "the ground's bottom edge")
    }

    func testTheSkylineScalesWithItsFrame() {
        let b = Skyline().path(in: CGRect(x: 10, y: 10, width: 48, height: 48)).boundingRect
        XCTAssertEqual(b.minX, 14, accuracy: 0.01)
        XCTAssertEqual(b.maxX, 54, accuracy: 0.01)
    }

    func testTheSparkHasFourPointsAndFillsItsBox() {
        let path = Spark().path(in: CGRect(x: 0, y: 0, width: 7, height: 7))
        XCTAssertEqual(path.boundingRect, CGRect(x: 0, y: 0, width: 7, height: 7))
        var corners = 0
        path.forEach { if case .line = $0 { corners += 1 } }
        XCTAssertEqual(corners, 7, "eight corners: a move and seven lines")
    }
}
