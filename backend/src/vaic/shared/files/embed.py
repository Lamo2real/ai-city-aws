"""Titan Text Embeddings V2 for Files (``embeddings.files`` in ``config/models.json``, decision 147).

One vector per file, made from its description, kept on the file record as float16 (1 KB at 512 dimensions). The
model never reasons or writes text; it only turns a description or a search into numbers.
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import math
import re
import struct
from typing import Any, Protocol

from ..config import models_config

MAX_INPUT_CHARS = 40_000
"""Titan V2 takes up to 8,192 tokens; a description never needs that much."""


def files_embedding() -> dict[str, Any]:
    e: dict[str, Any] = models_config()["embeddings"]["files"]
    return e


class Embedder(Protocol):
    dimensions: int

    async def embed(self, text: str) -> list[float]: ...


class TitanEmbedder:
    """``bedrock`` is a boto3 ``bedrock-runtime`` client in the city's Region."""

    def __init__(self, bedrock: Any) -> None:
        cfg = files_embedding()
        self._bedrock = bedrock
        self.model_id = str(cfg["modelId"])
        self.dimensions = int(cfg["dimensions"])

    async def embed(self, text: str) -> list[float]:
        body = json.dumps(
            {"inputText": text[:MAX_INPUT_CHARS] or " ", "dimensions": self.dimensions, "normalize": True}
        )
        r = await asyncio.to_thread(
            self._bedrock.invoke_model,
            modelId=self.model_id,
            body=body,
            contentType="application/json",
            accept="application/json",
        )
        out = json.loads(r["body"].read())
        return [float(x) for x in out["embedding"]]


class HashEmbedder:
    """Tests only: words → a bag-of-words vector (each word hashed to a slot), normalized. Shared words → similar."""

    def __init__(self, dimensions: int = 512) -> None:
        self.dimensions = dimensions
        self.calls: list[str] = []

    async def embed(self, text: str) -> list[float]:
        self.calls.append(text)
        v = [0.0] * self.dimensions
        for w in re.findall(r"[a-z0-9]+", text.lower()):
            if len(w) < 3:
                continue
            h = int.from_bytes(hashlib.sha256(w.encode()).digest()[:4], "big")
            v[h % self.dimensions] += 1.0
        return normalize(v)


def normalize(v: list[float]) -> list[float]:
    n = math.sqrt(sum(x * x for x in v))
    return [x / n for x in v] if n else v


def pack(v: list[float]) -> str:
    """float16, base64: what the record stores."""
    return base64.b64encode(struct.pack(f"<{len(v)}e", *v)).decode()


def unpack(s: str) -> list[float]:
    raw = base64.b64decode(s)
    return list(struct.unpack(f"<{len(raw) // 2}e", raw))


def cosine(a: list[float], b: list[float]) -> float:
    """Both normalized: the dot product (float16 rounding keeps it within ±0.002)."""
    if len(a) != len(b):
        return 0.0
    return sum(x * y for x, y in zip(a, b, strict=True))
