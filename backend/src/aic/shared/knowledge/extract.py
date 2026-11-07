"""Summary + entity/relationship extraction: Haiku's JSON, validated (§3). At most 50 entities per item.

Entities are names, never instructions: anything that does not look like a short name is dropped.
"""

from __future__ import annotations

import json
import re
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from .model import MAX_ENTITIES

EntityType = Literal["person", "organization", "place", "project", "product", "event", "concept"]
_TYPES = ("person", "organization", "place", "project", "product", "event", "concept")
_FENCE = re.compile(r"^\s*```(?:json)?\s*|\s*```\s*$")
SUMMARY_MAX_WORDS = 150


def clean_name(v: str) -> str:
    """One line, no markup, at most 120 characters."""
    s = re.sub(r"<[^>]*>", "", v)
    s = re.sub(r"[<>{}\[\]`#|\\]", "", re.sub(r"\s+", " ", s)).strip(" .,:;\"'")
    return s[:120]


def relation_slug(v: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", v.strip().lower()).strip("_")[:40]


class Entity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str
    type: EntityType = "concept"
    description: str = ""

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, v: Any) -> str:
        return clean_name(str(v))

    @field_validator("type", mode="before")
    @classmethod
    def _type(cls, v: Any) -> str:
        t = str(v or "").strip().lower()
        return t if t in _TYPES else "concept"

    @field_validator("description", mode="before")
    @classmethod
    def _desc(cls, v: Any) -> str:
        return re.sub(r"\s+", " ", str(v or "")).strip()[:300]


class Relationship(BaseModel):
    model_config = ConfigDict(extra="ignore")
    source: str
    relation: str
    target: str

    @field_validator("source", "target", mode="before")
    @classmethod
    def _ends(cls, v: Any) -> str:
        return clean_name(str(v))

    @field_validator("relation", mode="before")
    @classmethod
    def _rel(cls, v: Any) -> str:
        return relation_slug(str(v))


class Extraction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    summary: str = ""
    entities: list[Entity] = Field(default_factory=list)
    relationships: list[Relationship] = Field(default_factory=list)


def _limit_words(text: str, n: int) -> str:
    words = text.split()
    return text.strip() if len(words) <= n else " ".join(words[:n]) + " …"


def parse_extraction(text: str) -> Extraction:
    """Parses and validates Haiku's reply. Raises ``ValueError`` when it is not the JSON asked for."""
    raw = _FENCE.sub("", text.strip())
    start, end = raw.find("{"), raw.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in the reply")
    try:
        data = json.loads(raw[start : end + 1])
        ex = Extraction.model_validate(data)
    except (ValueError, ValidationError) as e:
        raise ValueError(f"the reply is not valid extraction JSON: {type(e).__name__}") from e
    entities: list[Entity] = []
    seen: set[str] = set()
    for ent in ex.entities:
        k = ent.name.lower()
        if len(ent.name) < 2 or k in seen:
            continue
        seen.add(k)
        entities.append(ent)
        if len(entities) >= MAX_ENTITIES:
            break
    names = {ent.name.lower() for ent in entities}
    rels = [
        r
        for r in ex.relationships
        if r.relation
        and r.source.lower() in names
        and r.target.lower() in names
        and r.source.lower() != r.target.lower()
    ][: MAX_ENTITIES * 3]
    summary = _limit_words(re.sub(r"\s+", " ", ex.summary), SUMMARY_MAX_WORDS)
    return Extraction(summary=summary, entities=entities, relationships=rels)
