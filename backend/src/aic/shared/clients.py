"""boto3 clients, created once per process with one botocore ``Config`` (``docs/KNOWLEDGE.md`` §14).

Reused connections (pool of 50, TCP keep-alive), adaptive retries, short timeouts. Only the services whose
calls take long (Converse, Transcribe, MediaConvert) get a longer read timeout.
"""

from __future__ import annotations

import threading
from typing import Any

from botocore.config import Config

CONFIG = Config(
    max_pool_connections=50,
    tcp_keepalive=True,
    retries={"mode": "adaptive", "max_attempts": 5},
    connect_timeout=2,
    read_timeout=10,
)
LONG_READ_TIMEOUT_S = {"bedrock-runtime": 300, "transcribe": 60, "mediaconvert": 60}
S3_CONFIG = Config(signature_version="s3v4", s3={"addressing_style": "virtual"})
"""Presigned URLs use SigV4 on the regional virtual-hosted endpoint (the HUD's CSP allows exactly that)."""

_lock = threading.Lock()
_clients: dict[tuple[int, str, str], Any] = {}


def config_for(service: str) -> Config:
    cfg = CONFIG
    if service in LONG_READ_TIMEOUT_S:
        cfg = cfg.merge(Config(read_timeout=LONG_READ_TIMEOUT_S[service]))
    if service == "s3":
        cfg = cfg.merge(S3_CONFIG)
    return cfg


def client(session: Any, service: str) -> Any:
    """The process's one client for ``service`` on this boto3 session."""
    key = (id(session), service, "client")
    with _lock:
        c = _clients.get(key)
        if c is None:
            c = session.client(service, config=config_for(service))
            _clients[key] = c
        return c


def resource(session: Any, service: str) -> Any:
    key = (id(session), service, "resource")
    with _lock:
        r = _clients.get(key)
        if r is None:
            r = session.resource(service, config=config_for(service))
            _clients[key] = r
        return r
