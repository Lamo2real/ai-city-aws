"""Test vectors for the iOS app's SRP code (ios/AICity/Auth/SRP.swift), computed with Python's own big integers.

It plays both sides: a fake Cognito server with a known verifier computes the session key from its side
((A * v^u)^b mod N), and the vector records what the client must arrive at from its side. If the Swift client
math is right, its key and signature match. Run: python3 -I ios/scripts/srp_vectors.py
"""

import base64
import hashlib
import hmac

N = int(
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DD"
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA0510"
    "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7"
    "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200C"
    "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF",
    16,
)
G = 2


def pad_hex(v: int) -> str:
    h = format(v, "x")
    if len(h) % 2:
        return "0" + h
    return "00" + h if h[0] in "89abcdef" else h


def hex_hash(h: str) -> str:
    return hashlib.sha256(bytes.fromhex(h)).hexdigest()


K = int(hex_hash(pad_hex(N) + pad_hex(G)), 16)

pool = "TestPool1"
user_id = "3b7c0e1a-5f2d-4c8e-9a61-2d4e8f0b7c11"
password = "Correct-Horse-Battery-9!"
salt = int("a1b2c3d4e5f60718293a4b5c6d7e8f90", 16)
a = int("7" * 64 + "1234567890abcdef" * 8, 16) % N
b = int("5" * 64 + "fedcba0987654321" * 8, 16) % N
secret_block = base64.b64encode(b"secret-block-from-cognito-" * 4).decode()
timestamp = "Sat Nov 7 09:05:03 UTC 2026"

# Server side: verifier v = g^x, B = k*v + g^b.
x = int(hex_hash(pad_hex(salt) + hashlib.sha256(f"{pool}{user_id}:{password}".encode()).hexdigest()), 16)
v = pow(G, x, N)
B = (K * v + pow(G, b, N)) % N
A = pow(G, a, N)
u = int(hex_hash(pad_hex(A) + pad_hex(B)), 16)
S_server = pow(A * pow(v, u, N), b, N)

prk = hmac.new(bytes.fromhex(pad_hex(u)), bytes.fromhex(pad_hex(S_server)), hashlib.sha256).digest()
key = hmac.new(prk, b"Caldera Derived Key\x01", hashlib.sha256).digest()[:16]
msg = pool.encode() + user_id.encode() + base64.b64decode(secret_block) + timestamp.encode()
sig = base64.b64encode(hmac.new(key, msg, hashlib.sha256).digest()).decode()

print(f'static let aHex = "{format(a, "x")}"')
print(f'static let bHex = "{format(B, "x")}"')
print(f'static let saltHex = "{format(salt, "x")}"')
print(f'static let expectedA = "{format(A, "x")}"')
print(f'static let expectedK = "{format(K, "x")}"')
print(f'static let expectedKey = "{key.hex()}"')
print(f'static let secretBlock = "{secret_block}"')
print(f'static let expectedSignature = "{sig}"')
# Arithmetic checks for BigUInt.
p = int("f" * 100 + "123", 16)
q = int("abcdef" * 30, 16)
print(f'static let mulP = "{format(p, "x")}"')
print(f'static let mulQ = "{format(q, "x")}"')
print(f'static let product = "{format(p * q, "x")}"')
print(f'static let remainder = "{format((p * q) % N, "x")}"')
print(f'static let powered = "{format(pow(q, p, N), "x")}"')
