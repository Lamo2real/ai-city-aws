import XCTest
@testable import AICity

/// The SRP math against vectors from Python's own big integers (ios/scripts/srp_vectors.py), where a fake
/// server computed the session key from its side. Matching key and signature means the client side is right.
final class SRPTests: XCTestCase {
    func testBigUIntArithmeticMatchesPython() {
        let p = BigUInt(hex: SRPVectors.mulP)!, q = BigUInt(hex: SRPVectors.mulQ)!
        XCTAssertEqual((p * q).hex, SRPVectors.product)
        XCTAssertEqual(((p * q) % SRP.N).hex, SRPVectors.remainder)
        XCTAssertEqual(q.power(p, modulus: SRP.N).hex, SRPVectors.powered)
        XCTAssertEqual((p + q - q), p)
        XCTAssertEqual(BigUInt(bytes: [0x01, 0x00]).hex, "100")
        XCTAssertEqual(BigUInt(hex: "00ff")!.bytes, [0xff])
    }

    func testMultiplierK() {
        XCTAssertEqual(SRP.k.hex, SRPVectors.expectedK)
    }

    func testPadHexLikeAmplify() {
        XCTAssertEqual(SRP.padHex(BigUInt(hex: "f")!), "0f")
        XCTAssertEqual(SRP.padHex(BigUInt(hex: "7f")!), "7f")
        XCTAssertEqual(SRP.padHex(BigUInt(hex: "80")!), "0080")
    }

    func testClientMatchesServerKeyAndSignature() {
        let c = SRP.Client(a: BigUInt(hex: SRPVectors.aHex)!)
        XCTAssertEqual(c.srpA, SRPVectors.expectedA)
        let key = c.passwordKey(poolName: SRPVectors.pool, userId: SRPVectors.userId, password: SRPVectors.password,
                                serverB: BigUInt(hex: SRPVectors.bHex)!, salt: BigUInt(hex: SRPVectors.saltHex)!)
        XCTAssertEqual(key.map { $0.map { String(format: "%02x", $0) }.joined() }, SRPVectors.expectedKey)
        let sig = SRP.signature(key: key!, poolName: SRPVectors.pool, userId: SRPVectors.userId,
                                secretBlock: SRPVectors.secretBlock, timestamp: SRPVectors.timestamp)
        XCTAssertEqual(sig, SRPVectors.expectedSignature)
    }

    func testWrongPasswordGivesAnotherKey() {
        let c = SRP.Client(a: BigUInt(hex: SRPVectors.aHex)!)
        let key = c.passwordKey(poolName: SRPVectors.pool, userId: SRPVectors.userId, password: "wrong",
                                serverB: BigUInt(hex: SRPVectors.bHex)!, salt: BigUInt(hex: SRPVectors.saltHex)!)
        XCTAssertNotEqual(key.map { $0.map { String(format: "%02x", $0) }.joined() }, SRPVectors.expectedKey)
    }

    func testRefusesUnsafeServerB() {
        let c = SRP.Client(a: BigUInt(hex: SRPVectors.aHex)!)
        XCTAssertNil(c.passwordKey(poolName: "p", userId: "u", password: "x", serverB: SRP.N, salt: BigUInt(1)))
    }

    func testTimestampFormat() {
        let d = ISO8601DateFormatter().date(from: "2026-11-07T09:05:03Z")!
        XCTAssertEqual(SRP.timestamp(d), SRPVectors.timestamp)
    }
}
