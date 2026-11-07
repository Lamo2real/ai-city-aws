// Just enough unsigned big-integer math for Cognito's SRP (3072-bit group): add, subtract, multiply,
// remainder, and modular power via Montgomery multiplication. Little-endian 32-bit limbs.
// Checked against Python's own big integers in SRPTests (vectors from ios/scripts/srp_vectors.py).
import Foundation

struct BigUInt: Equatable, Comparable, Sendable {
    private(set) var limbs: [UInt32]  // little-endian, no trailing zero limbs (zero = [])

    init() { limbs = [] }
    init(_ v: UInt64) {
        limbs = [UInt32(truncatingIfNeeded: v), UInt32(truncatingIfNeeded: v >> 32)]
        normalize()
    }
    init(limbs: [UInt32]) {
        self.limbs = limbs
        normalize()
    }
    init?(hex: String) {
        let h = hex.hasPrefix("0x") ? String(hex.dropFirst(2)) : hex
        var out: [UInt32] = []
        var end = h.endIndex
        while end > h.startIndex {
            let start = h.index(end, offsetBy: -8, limitedBy: h.startIndex) ?? h.startIndex
            guard let v = UInt32(h[start..<end], radix: 16) else { return nil }
            out.append(v)
            end = start
        }
        limbs = out
        normalize()
    }
    init(bytes: [UInt8]) {
        var out: [UInt32] = []
        var i = bytes.count
        while i > 0 {
            var v: UInt32 = 0
            for j in max(0, i - 4)..<i { v = (v << 8) | UInt32(bytes[j]) }
            out.append(v)
            i -= 4
        }
        limbs = out
        normalize()
    }

    private mutating func normalize() { while limbs.last == 0 { limbs.removeLast() } }

    var isZero: Bool { limbs.isEmpty }
    var bitWidth: Int { limbs.isEmpty ? 0 : (limbs.count - 1) * 32 + (32 - limbs.last!.leadingZeroBitCount) }
    func bit(_ i: Int) -> Bool {
        let l = i / 32
        return l < limbs.count && (limbs[l] >> UInt32(i % 32)) & 1 == 1
    }

    /// Lowercase hex without leading zeros ("0" for zero), like JavaScript's BigInteger.toString(16).
    var hex: String {
        guard let top = limbs.last else { return "0" }
        var s = String(top, radix: 16)
        for l in limbs.dropLast().reversed() {
            let part = String(l, radix: 16)
            s += String(repeating: "0", count: 8 - part.count) + part
        }
        return s
    }

    /// Big-endian bytes, minimal length.
    var bytes: [UInt8] {
        var out: [UInt8] = []
        for l in limbs.reversed() { out += [UInt8(l >> 24), UInt8((l >> 16) & 0xff), UInt8((l >> 8) & 0xff), UInt8(l & 0xff)] }
        while out.first == 0 { out.removeFirst() }
        return out
    }

    static func < (a: BigUInt, b: BigUInt) -> Bool {
        if a.limbs.count != b.limbs.count { return a.limbs.count < b.limbs.count }
        for i in stride(from: a.limbs.count - 1, through: 0, by: -1) where a.limbs[i] != b.limbs[i] {
            return a.limbs[i] < b.limbs[i]
        }
        return false
    }

    static func + (a: BigUInt, b: BigUInt) -> BigUInt {
        let n = max(a.limbs.count, b.limbs.count)
        var out = [UInt32](repeating: 0, count: n + 1)
        var carry: UInt64 = 0
        for i in 0..<n {
            let s = UInt64(i < a.limbs.count ? a.limbs[i] : 0) + UInt64(i < b.limbs.count ? b.limbs[i] : 0) + carry
            out[i] = UInt32(truncatingIfNeeded: s)
            carry = s >> 32
        }
        out[n] = UInt32(carry)
        return BigUInt(limbs: out)
    }

    /// a - b; requires a >= b.
    static func - (a: BigUInt, b: BigUInt) -> BigUInt {
        precondition(a >= b, "BigUInt subtraction underflow")
        var out = a.limbs
        var borrow: Int64 = 0
        for i in 0..<out.count {
            var d = Int64(out[i]) - Int64(i < b.limbs.count ? b.limbs[i] : 0) - borrow
            if d < 0 { d += 1 << 32; borrow = 1 } else { borrow = 0 }
            out[i] = UInt32(d)
        }
        return BigUInt(limbs: out)
    }

    static func * (a: BigUInt, b: BigUInt) -> BigUInt {
        if a.isZero || b.isZero { return BigUInt() }
        var out = [UInt32](repeating: 0, count: a.limbs.count + b.limbs.count)
        for i in 0..<a.limbs.count {
            var carry: UInt64 = 0
            let ai = UInt64(a.limbs[i])
            for j in 0..<b.limbs.count {
                let t = ai * UInt64(b.limbs[j]) + UInt64(out[i + j]) + carry
                out[i + j] = UInt32(truncatingIfNeeded: t)
                carry = t >> 32
            }
            out[i + b.limbs.count] = UInt32(carry)
        }
        return BigUInt(limbs: out)
    }

    private func shiftedLeft1() -> BigUInt {
        var out = [UInt32](repeating: 0, count: limbs.count + 1)
        var carry: UInt32 = 0
        for i in 0..<limbs.count {
            out[i] = (limbs[i] << 1) | carry
            carry = limbs[i] >> 31
        }
        out[limbs.count] = carry
        return BigUInt(limbs: out)
    }

    /// a mod m by binary long division (used a few times per sign-in, never in the hot loop).
    static func % (a: BigUInt, m: BigUInt) -> BigUInt {
        precondition(!m.isZero, "modulo by zero")
        if a < m { return a }
        var r = BigUInt()
        for i in stride(from: a.bitWidth - 1, through: 0, by: -1) {
            r = r.shiftedLeft1()
            if a.bit(i) { r = r + BigUInt(1) }
            if r >= m { r = r - m }
        }
        return r
    }

    /// base^exp mod m for an odd modulus m, with Montgomery multiplication.
    func power(_ exp: BigUInt, modulus m: BigUInt) -> BigUInt {
        precondition(m.limbs.first.map { $0 & 1 == 1 } ?? false, "modulus must be odd")
        let mont = Montgomery(m)
        var result = mont.toMont(BigUInt(1))
        let base = mont.toMont(self % m)
        for i in stride(from: exp.bitWidth - 1, through: 0, by: -1) {
            result = mont.mul(result, result)
            if exp.bit(i) { result = mont.mul(result, base) }
        }
        return mont.fromMont(result)
    }
}

/// Montgomery arithmetic modulo an odd m with R = 2^(32·n).
private struct Montgomery {
    let m: [UInt32]
    let n: Int
    let mInv: UInt32  // -m^-1 mod 2^32
    let r2: BigUInt  // R^2 mod m

    init(_ modulus: BigUInt) {
        m = modulus.limbs
        n = m.count
        // Newton iteration for m0^-1 mod 2^32.
        var inv: UInt32 = 1
        for _ in 0..<5 { inv = inv &* (2 &- m[0] &* inv) }
        mInv = 0 &- inv
        var rr = BigUInt(limbs: [UInt32](repeating: 0, count: 2 * n) + [1])  // R^2
        rr = rr % modulus
        r2 = rr
    }

    func padded(_ a: BigUInt) -> [UInt32] { a.limbs + [UInt32](repeating: 0, count: n - a.limbs.count) }

    /// a·b·R^-1 mod m (CIOS).
    func mul(_ a: BigUInt, _ b: BigUInt) -> BigUInt {
        let x = padded(a), y = padded(b)
        var t = [UInt32](repeating: 0, count: n + 2)
        x.withUnsafeBufferPointer { xp in
            y.withUnsafeBufferPointer { yp in
                m.withUnsafeBufferPointer { mp in
                    t.withUnsafeMutableBufferPointer { tp in
                        for i in 0..<n {
                            var carry: UInt64 = 0
                            let xi = UInt64(xp[i])
                            for j in 0..<n {
                                let s = UInt64(tp[j]) + xi * UInt64(yp[j]) + carry
                                tp[j] = UInt32(truncatingIfNeeded: s)
                                carry = s >> 32
                            }
                            var s = UInt64(tp[n]) + carry
                            tp[n] = UInt32(truncatingIfNeeded: s)
                            tp[n + 1] = UInt32(s >> 32)
                            let q = UInt64(tp[0] &* mInv)
                            s = UInt64(tp[0]) + q * UInt64(mp[0])
                            carry = s >> 32
                            for j in 1..<n {
                                let s2 = UInt64(tp[j]) + q * UInt64(mp[j]) + carry
                                tp[j - 1] = UInt32(truncatingIfNeeded: s2)
                                carry = s2 >> 32
                            }
                            s = UInt64(tp[n]) + carry
                            tp[n - 1] = UInt32(truncatingIfNeeded: s)
                            tp[n] = tp[n + 1] &+ UInt32(s >> 32)
                            tp[n + 1] = 0
                        }
                    }
                }
            }
        }
        var r = BigUInt(limbs: Array(t[0...n]))
        let mm = BigUInt(limbs: m)
        if r >= mm { r = r - mm }
        return r
    }

    func toMont(_ a: BigUInt) -> BigUInt { mul(a, r2) }
    func fromMont(_ a: BigUInt) -> BigUInt { mul(a, BigUInt(1)) }
}
