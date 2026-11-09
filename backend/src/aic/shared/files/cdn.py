"""Previews and thumbnails through CloudFront (decision 156): the files bucket stays private behind Origin Access
Control, and every view gets a CloudFront signed URL (canned policy, 15 minutes, this one object). The private key
lives only in Secrets Manager (``aic/prod/files-signing-key``): a one-time Lambda (``signing_key``) generates the
pair there and hands Terraform the public key alone, so the private key is never in Terraform state, code or logs.
Downloads stay S3 presigned with ``attachment`` and the file's current name.
"""

from __future__ import annotations

import asyncio
import json
import threading
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote


def new_key_pair() -> tuple[str, str]:
    """(private PEM, public PEM): RSA 2048, the size CloudFront takes."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode()
    public = (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )
    return private, public


def public_of(private_pem: str) -> str:
    from cryptography.hazmat.primitives import serialization

    key = serialization.load_pem_private_key(private_pem.encode(), password=None)
    return (
        key.public_key()
        .public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        .decode()
    )


def ensure_signing_key(secrets: Any, secret_id: str) -> str:
    """The one-time step (Terraform invokes it on every apply; it changes nothing once done): a key pair in the
    secret, created when the secret has no value yet. Returns the public PEM only."""
    try:
        private = json.loads(secrets.get_secret_value(SecretId=secret_id)["SecretString"])["private_key"]
        return public_of(private)
    except Exception as e:
        code = (getattr(e, "response", None) or {}).get("Error", {}).get("Code")
        if code != "ResourceNotFoundException":
            raise
    private, public = new_key_pair()
    secrets.put_secret_value(SecretId=secret_id, SecretString=json.dumps({"private_key": private}))
    return public


@dataclass
class CdnSigner:
    """Signs ``https://<distribution>/<key>`` for one object, valid ``seconds``."""

    base_url: str
    key_pair_id: str
    private_pem: Any
    """A callable returning the private PEM (read from Secrets Manager once per process), or the PEM itself."""
    now: Any = field(default=lambda: datetime.now(UTC))
    _signer: Any = None
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def _get(self) -> Any:
        with self._lock:
            if self._signer is None:
                from botocore.signers import CloudFrontSigner
                from cryptography.hazmat.primitives import hashes, serialization
                from cryptography.hazmat.primitives.asymmetric import padding

                pem = self.private_pem() if callable(self.private_pem) else self.private_pem
                key = serialization.load_pem_private_key(str(pem).encode(), password=None)

                def rsa_signer(message: bytes) -> bytes:
                    return key.sign(message, padding.PKCS1v15(), hashes.SHA1())  # type: ignore[union-attr, call-arg, arg-type]  # noqa: S303 - CloudFront signs with SHA-1

                self._signer = CloudFrontSigner(self.key_pair_id, rsa_signer)
            return self._signer

    def sign_now(self, key: str, seconds: int) -> str:
        url = f"{self.base_url.rstrip('/')}/{quote(key)}"
        signed: str = self._get().generate_presigned_url(url, date_less_than=self.now() + timedelta(seconds=seconds))
        return signed

    async def sign(self, key: str, seconds: int) -> str:
        return await asyncio.to_thread(self.sign_now, key, seconds)


def cdn_from_env(session: Any, env: Any) -> CdnSigner | None:
    """``FILES_CDN_URL``, ``FILES_CDN_KEY_ID`` and ``FILES_SIGNING_SECRET``; None (S3 presigned views) without them."""
    url, key_id, secret = env.get("FILES_CDN_URL"), env.get("FILES_CDN_KEY_ID"), env.get("FILES_SIGNING_SECRET")
    if not url or not key_id or not secret:
        return None
    from ..clients import client

    sm = client(session, "secretsmanager")

    def pem() -> str:
        return str(json.loads(sm.get_secret_value(SecretId=secret)["SecretString"])["private_key"])

    return CdnSigner(base_url=url, key_pair_id=key_id, private_pem=pem)
