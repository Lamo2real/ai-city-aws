// Cognito's SRP-6a sign-in math (USER_SRP_AUTH → PASSWORD_VERIFIER), the same steps as Amplify's
// AuthenticationHelper: the password never leaves the phone, only a proof that we know it.
import CryptoKit
import Foundation

enum SRP {
    /// RFC 5054 3072-bit group, g = 2 (what Cognito uses).
    static let N = BigUInt(hex:
        "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DD"
        + "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
        + "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
        + "83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"
        + "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA0510"
        + "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7"
        + "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C"
        + "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF")!
    static let g = BigUInt(2)
    static let k = BigUInt(hex: hexHash(padHex(N) + padHex(g)))!

    /// Hex of a positive number, padded like Amplify: even length, and a leading 00 when the top bit is set.
    static func padHex(_ v: BigUInt) -> String {
        var h = v.hex
        if h.count % 2 == 1 { h = "0" + h } else if let c = h.first, "89abcdef".contains(c) { h = "00" + h }
        return h
    }

    static func hexBytes(_ hex: String) -> [UInt8] {
        var out: [UInt8] = []
        out.reserveCapacity(hex.count / 2)
        var i = hex.startIndex
        while i < hex.endIndex {
            let j = hex.index(i, offsetBy: 2, limitedBy: hex.endIndex) ?? hex.endIndex
            out.append(UInt8(hex[i..<j], radix: 16) ?? 0)
            i = j
        }
        return out
    }

    static func sha256Hex(_ bytes: [UInt8]) -> String {
        let h = SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined()
        return String(repeating: "0", count: 64 - h.count) + h
    }
    static func hexHash(_ hex: String) -> String { sha256Hex(hexBytes(hex)) }

    /// The client's half: a secret random `a` and the public A = g^a mod N.
    struct Client {
        let a: BigUInt
        let A: BigUInt

        init(a: BigUInt) {
            self.a = a
            A = SRP.g.power(a, modulus: SRP.N)
        }
        static func random() -> Client {
            var bytes = [UInt8](repeating: 0, count: 128)
            let ok = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
            precondition(ok == errSecSuccess, "no secure random bytes")
            return Client(a: BigUInt(bytes: bytes) % SRP.N)
        }

        /// SRP_A as Cognito wants it: plain hex.
        var srpA: String { A.hex }

        /// The 16-byte key from the server's B and salt, or nil when the server's values are unsafe.
        func passwordKey(poolName: String, userId: String, password: String, serverB: BigUInt, salt: BigUInt) -> [UInt8]? {
            guard !(serverB % SRP.N).isZero else { return nil }
            let u = BigUInt(hex: SRP.hexHash(SRP.padHex(A) + SRP.padHex(serverB)))!
            guard !u.isZero else { return nil }
            let userPassHash = SRP.sha256Hex(Array("\(poolName)\(userId):\(password)".utf8))
            let x = BigUInt(hex: SRP.hexHash(SRP.padHex(salt) + userPassHash))!
            let kv = (SRP.k * SRP.g.power(x, modulus: SRP.N)) % SRP.N
            let b = serverB % SRP.N
            let base = b >= kv ? b - kv : b + SRP.N - kv
            let S = base.power(a + u * x, modulus: SRP.N)
            return SRP.hkdf(ikm: SRP.hexBytes(SRP.padHex(S)), salt: SRP.hexBytes(SRP.padHex(u)))
        }
    }

    /// HKDF-SHA256 with info "Caldera Derived Key", 16 bytes.
    static func hkdf(ikm: [UInt8], salt: [UInt8]) -> [UInt8] {
        let prk = HMAC<SHA256>.authenticationCode(for: ikm, using: SymmetricKey(data: salt))
        let okm = HMAC<SHA256>.authenticationCode(for: Array("Caldera Derived Key".utf8) + [1], using: SymmetricKey(data: Data(prk)))
        return Array(Data(okm).prefix(16))
    }

    /// "Tue Nov 7 09:05:03 UTC 2026": day without a leading zero, as Cognito expects.
    static func timestamp(_ date: Date) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "EEE MMM d HH:mm:ss 'UTC' yyyy"
        return f.string(from: date)
    }

    /// PASSWORD_CLAIM_SIGNATURE = base64(HMAC(key, poolName + userId + secretBlock + timestamp)).
    static func signature(key: [UInt8], poolName: String, userId: String, secretBlock: String, timestamp: String) -> String? {
        guard let block = Data(base64Encoded: secretBlock) else { return nil }
        let msg = Data(poolName.utf8) + Data(userId.utf8) + block + Data(timestamp.utf8)
        let mac = HMAC<SHA256>.authenticationCode(for: msg, using: SymmetricKey(data: key))
        return Data(mac).base64EncodedString()
    }
}
