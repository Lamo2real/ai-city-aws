// The logo's drawn parts (Components.swift, decision 159): the mark's circle, stripes and skyline, and the letters
// of VAIC as strokes, all in the web's unit boxes.
import XCTest
@testable import AICity

final class WordmarkTests: XCTestCase {
    func testTheMarksCircleLeavesOneUnitOfTheBoxAllRound() {
        let b = MarkCircle().path(in: CGRect(x: 0, y: 0, width: 32, height: 32)).boundingRect
        XCTAssertEqual(b, CGRect(x: 1, y: 1, width: 30, height: 30), "r 15 at (16, 16)")
        let shown = MarkCircle().path(in: CGRect(x: 0, y: 0, width: 30, height: 30)).boundingRect
        XCTAssertEqual(shown.width, 28.125, accuracy: 0.001, "at 30 pt the circle is 30/32 of the frame")
    }

    func testTheSkylineRunsAcrossTheBoxFromTheAerialToTheGround() {
        let b = SunsetSkyline().path(in: CGRect(x: 0, y: 0, width: 32, height: 32)).boundingRect
        XCTAssertEqual(b.minX, 0, accuracy: 0.01)
        XCTAssertEqual(b.maxX, 32, accuracy: 0.01)
        XCTAssertEqual(b.minY, 7, accuracy: 0.01, "the aerial's tip")
        XCTAssertEqual(b.maxY, 32, accuracy: 0.01, "the ground runs to the bottom of the box")
        XCTAssertEqual(SunsetSkyline.stripes.map(\.0), [14.6, 17.6, 20.8], "the three stripes' tops")
        XCTAssertEqual(SunsetSkyline.skyline.count, 30, "the web path's corners")
    }

    func testTheSkylineScalesWithItsFrame() {
        let b = SunsetSkyline().path(in: CGRect(x: 10, y: 10, width: 64, height: 64)).boundingRect
        XCTAssertEqual(b.minY, 24, accuracy: 0.01, "the aerial at 7 × 2 from the frame's top")
        XCTAssertEqual(b.maxX, 74, accuracy: 0.01)
    }

    func testTheVAndTheCAreStrokedTheWebsWayRound() {
        // The V from (2, 2) to (16, 2) by way of (9, 18); the C's arc from (63, 4.6) to (63, 15.4) the long way
        // round through the left, so with its round caps nothing reaches right of 63 + 1.8.
        let b = WordLetters(part: .vc).path(in: CGRect(x: 0, y: 0, width: 67, height: 20)).boundingRect
        XCTAssertEqual(b.minX, 0.2, accuracy: 0.05, "the V's cap")
        XCTAssertEqual(b.minY, 0.2, accuracy: 0.05)
        XCTAssertEqual(b.maxY, 19.8, accuracy: 0.05)
        XCTAssertEqual(b.maxX, 64.8, accuracy: 0.05, "the C opens to the right")
    }

    func testTheAmberLambdaIAndSparkSitBetweenTheVAndTheC() {
        let b = WordLetters(part: .ai).path(in: CGRect(x: 0, y: 0, width: 67, height: 20)).boundingRect
        XCTAssertEqual(b.minX, 18.2, accuracy: 0.05, "the Λ's left foot")
        XCTAssertEqual(b.maxX, 43.1, accuracy: 0.05, "the spark's right point")
        XCTAssertEqual(b.minY, -1.2, accuracy: 0.05, "the spark rises above the box, as on the web")
        XCTAssertEqual(b.maxY, 19.8, accuracy: 0.05)
        XCTAssertEqual(WordLetters.spark.count, 8, "a four-point spark has eight corners")
    }

    func testTheLettersScaleWithTheirFrame() {
        // Shown at 74 × 22 the word is 1.1 times its viewBox.
        let b = WordLetters(part: .ai).path(in: CGRect(x: 0, y: 0, width: 74, height: 22)).boundingRect
        XCTAssertEqual(b.maxX, 43.1 * 1.1, accuracy: 0.05)
        XCTAssertEqual(b.maxY, 19.8 * 1.1, accuracy: 0.05)
    }
}
