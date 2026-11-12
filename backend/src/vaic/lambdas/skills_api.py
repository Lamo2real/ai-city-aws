"""The ``/skills*`` routes (``docs/CONNECTORS_SKILLS.md`` §2.2–2.4). Only the owner adds, replaces or deletes skills.

Uploads are checked (§2.3), the frontmatter is reduced to ``name`` and ``description``, the files go to
``s3://<bucket>/skills/<name>/<version>/<path>``, and the ledger row moves to the new version with a conditional
update before the old version's objects are deleted, so a turn never sees half a skill. Answers are
``(status, body)``.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from vaic.shared import dept_pick, skills_catalog
from vaic.shared.events import now_iso
from vaic.shared.ledger import Ledger
from vaic.shared.log import log
from vaic.shared.skills import (
    MAX_BYTES,
    MAX_DESCRIPTION,
    MAX_FILES,
    NAME_RE,
    PK,
    ROLES,
    SkillInvalid,
    object_key,
    path_problem,
    public,
    reduce_frontmatter,
    sk,
    valid_roles,
)
from vaic.shared.table import UpdateOptions

Answer = tuple[int, Any]
RESERVED = "catalog"  # /skills/catalog is Discover (decision 188)


@dataclass
class SkillsApi:
    ledger: Ledger
    s3: Any = None
    bucket: str | None = None


async def _departments(s: SkillsApi, v: Any) -> list[str]:
    """The departments a skill is for (decision 266): an empty list (or none on the row) is every department."""
    try:
        sel = dept_pick.check(v, dept_pick.choices(await s.ledger.list_departments()))
    except ValueError as e:
        raise SkillInvalid(str(e)) from e
    return [] if sel == dept_pick.ALL else list(sel)


def _err(status: int, message: str, fix: str | None = None) -> Answer:
    return status, {"error": message, "fix": fix}


def _decode(files: Any) -> dict[str, bytes]:
    if not isinstance(files, list) or not files:
        raise SkillInvalid("Send the skill's files.")
    if len(files) > MAX_FILES:
        raise SkillInvalid(f"A skill can have at most {MAX_FILES} files.")
    out: dict[str, bytes] = {}
    total = 0
    for f in files:
        if (
            not isinstance(f, dict)
            or not isinstance(f.get("path"), str)
            or not isinstance(f.get("content_base64"), str)
        ):
            raise SkillInvalid("Each file needs a path and its contents.")
        try:
            data = base64.b64decode(f["content_base64"], validate=True)
        except (binascii.Error, ValueError) as e:
            raise SkillInvalid(f"{f['path'][:80]} is not valid base64.") from e
        total += len(data)
        if total > MAX_BYTES:
            raise SkillInvalid("A skill can be at most 4 MB in all.")
        if f["path"] in out:
            raise SkillInvalid(f"{f['path'][:80]} is there twice.")
        out[f["path"]] = data
    # A folder upload may carry the folder's own name in front of every path: drop it.
    if "SKILL.md" not in out:
        tops = {p.split("/", 1)[0] for p in out}
        if len(tops) == 1 and all("/" in p for p in out):
            top = tops.pop()
            out = {p[len(top) + 1 :]: v for p, v in out.items()}
    for p in out:
        if bad := path_problem(p):
            raise SkillInvalid(bad)
    if "SKILL.md" not in out:
        raise SkillInvalid("A skill needs SKILL.md at its root.")
    return out


def prepare(b: dict[str, Any]) -> tuple[str, str, dict[str, bytes], list[str]]:
    """(name, description, files with the reduced SKILL.md, removed frontmatter keys). Raises SkillInvalid."""
    files = _decode(b.get("files"))
    try:
        text = files["SKILL.md"].decode("utf-8")
    except UnicodeDecodeError as e:
        raise SkillInvalid("SKILL.md must be UTF-8 text.") from e
    reduced, kept, removed = reduce_frontmatter(text)
    given = b.get("name")
    name = kept.get("name") or (given if isinstance(given, str) else "")
    if not NAME_RE.match(name or ""):
        raise SkillInvalid("The name must be lower-case letters, digits and dashes (at most 64).")
    if name == RESERVED:
        raise SkillInvalid(f"{RESERVED} is the name of Discover's catalog; pick another name.")
    if isinstance(given, str) and given and given != name:
        raise SkillInvalid(f"The name {given[:64]} doesn't match the SKILL.md name {name}.")
    description = kept.get("description", "").strip()
    if not description:
        raise SkillInvalid("SKILL.md needs a description in its frontmatter.")
    if len(description) > MAX_DESCRIPTION:
        raise SkillInvalid("The description can be at most 1,024 characters.")
    if "name" not in kept:  # a single file without a name: write the request's name into it
        reduced, _, _ = reduce_frontmatter(reduced.replace("---\n", f"---\nname: {name}\n", 1))
    files["SKILL.md"] = reduced.encode()
    return name, description, files, removed


async def _put_objects(s: SkillsApi, name: str, version: str, files: dict[str, bytes]) -> None:
    def put() -> None:
        for path, data in files.items():
            s.s3.put_object(Bucket=s.bucket, Key=object_key(name, version, path), Body=data)

    await asyncio.to_thread(put)


async def _delete_objects(s: SkillsApi, row: dict[str, Any]) -> None:
    keys = [{"Key": object_key(row["name"], row["version"], f["path"])} for f in row.get("files") or []]

    def delete() -> None:
        for i in range(0, len(keys), 1000):
            s.s3.delete_objects(Bucket=s.bucket, Delete={"Objects": keys[i : i + 1000], "Quiet": True})

    try:
        await asyncio.to_thread(delete)
    except Exception as e:  # noncurrent versions expire on their own
        log("warn", "skills.delete_failed", skill=row["name"], error=type(e).__name__)


async def route(
    s: SkillsApi,
    method: str,
    seg: list[str],
    body: Callable[[], dict[str, Any]],
    query: dict[str, str] | None = None,
) -> Answer | None:
    if not seg or seg[0] != "skills" or len(seg) > 3:
        return None
    try:
        if len(seg) >= 2 and seg[1] == RESERVED:
            return await _catalog(s, method, seg[2:], body, query or {})
        if len(seg) > 2:
            return None
        return await _route(s, method, seg, body)
    except SkillInvalid as e:
        return _err(400, str(e))


async def _catalog(
    s: SkillsApi, method: str, rest: list[str], body: Callable[[], dict[str, Any]], query: dict[str, str]
) -> Answer | None:
    """Discover (decision 188): ``GET /skills/catalog[?q=&department=]``, ``GET /skills/catalog/<name>`` (with its
    SKILL.md) and ``POST /skills/catalog/<name>`` (add it: the same path as an upload)."""
    table = s.ledger.table
    if not rest and method == "GET":
        have = {r["name"] for r in await table.query(PK, "SKILL#")}
        found = skills_catalog.search(str(query.get("q") or ""), str(query.get("department") or ""))
        return 200, {
            "skills": [{**e, "added": e["name"] in have} for e in found],
            "departments": skills_catalog.departments(),
        }
    if len(rest) != 1:
        return None
    e = skills_catalog.find(rest[0])
    if not e:
        return _err(404, "That skill is not in the catalog.", "GET /skills/catalog?q=<words> lists what is.")
    mine = await table.get(PK, sk(e["name"]))
    if method == "GET":
        return 200, {**e, "added": mine is not None, "skill_md": skills_catalog.skill_md(e)}
    if method != "POST":
        return None
    if mine:
        return _err(
            409,
            f"You already have the skill {e['name']}.",
            "It is under Yours. Remove it there first to add the catalog's version.",
        )
    if s.s3 is None or not s.bucket:
        return _err(503, "Skills can't be stored yet.", "The owner deploys the skills bucket first.")
    b = body() or {}
    files = [{"path": p, "content_base64": base64.b64encode(v).decode()} for p, v in skills_catalog.files(e).items()]
    req = {"files": files, "roles": b.get("roles"), **({"departments": b["departments"]} if "departments" in b else {})}
    return await _upload(s, req, source="catalog")


async def _route(s: SkillsApi, method: str, seg: list[str], body: Callable[[], dict[str, Any]]) -> Answer | None:
    table = s.ledger.table
    if len(seg) == 1 and method == "GET":
        rows = sorted(await table.query(PK, "SKILL#"), key=lambda r: r["name"])
        return 200, {"skills": [public(r) for r in rows]}
    if len(seg) == 1 and method == "POST":
        if s.s3 is None or not s.bucket:
            return _err(503, "Skills can't be stored yet.", "The owner deploys the skills bucket first.")
        return await _upload(s, body())
    if len(seg) != 2:
        return None
    row = await table.get(PK, sk(seg[1])) if NAME_RE.match(seg[1]) else None
    if not row:
        return _err(404, "That skill does not exist.")
    if method == "GET":

        def read() -> str:
            obj = s.s3.get_object(Bucket=s.bucket, Key=object_key(row["name"], row["version"], "SKILL.md"))
            text: str = obj["Body"].read().decode("utf-8", "replace")
            return text

        return 200, {**public(row), "skill_md": await asyncio.to_thread(read)}
    if method == "PUT":
        b = body()
        patch: dict[str, Any] = {}
        if "roles" in b:
            patch["roles"] = valid_roles(b["roles"])
        if "departments" in b:
            patch["departments"] = await _departments(s, b["departments"])
        if "enabled" in b:
            if not isinstance(b["enabled"], bool):
                raise SkillInvalid("Enabled must be on or off.")
            patch["enabled"] = b["enabled"]
        if not patch:
            raise SkillInvalid("Nothing to change.")
        out = await table.update(
            PK, sk(row["name"]), UpdateOptions(set={**patch, "updated_at": now_iso(s.ledger.now())})
        )
        return 200, {"skill": public(out or row)}
    if method == "DELETE":
        await table.delete(PK, sk(row["name"]))
        if s.s3 is not None:
            await _delete_objects(s, row)
        return 200, {"ok": True}
    return None


async def _upload(s: SkillsApi, b: dict[str, Any], source: str = "upload") -> Answer:
    name, description, files, removed = prepare(b)
    table = s.ledger.table
    old = await table.get(PK, sk(name))
    roles = valid_roles(b["roles"]) if b.get("roles") is not None else list((old or {}).get("roles") or ROLES)
    depts = (
        await _departments(s, b["departments"]) if "departments" in b else list((old or {}).get("departments") or [])
    )
    version = f"v{s.ledger.now_ms()}"
    at = now_iso(s.ledger.now())
    fields: dict[str, Any] = {
        "name": name,
        "description": description,
        "roles": roles,
        "enabled": (old or {}).get("enabled", True),
        "version": version,
        "files": [
            {"path": p, "size": len(v), "sha256": hashlib.sha256(v).hexdigest()} for p, v in sorted(files.items())
        ],
        "size_bytes": sum(len(v) for v in files.values()),
        "source": source,
        "updated_at": at,
        "departments": depts,
    }
    await _put_objects(s, name, version, files)
    if old:
        row = await table.update(PK, sk(name), UpdateOptions(set=fields, expect={"version": old["version"]}))
        if row is None:
            return _err(409, "Someone replaced this skill at the same moment.", "Try again.")
        await _delete_objects(s, old)
    else:
        row = {"pk": PK, "sk": sk(name), "created_at": at, **fields}
        if not await table.put(row, if_not_exists=True):
            return _err(409, "Someone added this skill at the same moment.", "Try again.")
    log("info", "skills.saved", skill=name, files=len(files), removed=len(removed), source=source)
    return 201, {"skill": public(row), "removed_frontmatter": removed}
