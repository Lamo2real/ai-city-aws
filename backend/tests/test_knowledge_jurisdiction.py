"""The jurisdiction-aware knowledge base (docs/KNOWLEDGE.md §15): the region map, metadata detection with a fake
model, the Retrieve filters, supersession by year, owner edits, and a US + Sweden task that keeps the GDPR out of
the US answer."""

import json
from typing import Any

import pytest

from aic.shared.knowledge.jurisdiction import (
    clean_detected,
    clean_metadata,
    hints_from_name,
    in_force_status,
    item_holds_in,
    market_codes,
    market_filter,
    matches_filter,
    normalize,
    parents,
    superseded_map,
)
from aic.shared.knowledge.kb import Hit, ingest_document, retrieval_config
from aic.shared.knowledge.model import item_metadata
from aic.shared.knowledge.search import search_markets
from aic.shared.knowledge.service import KnowledgeError
from knowledge_support import World, ready_item, world
from test_knowledge_pipeline import pipeline, step, upload


# ---------- the region map ----------
def test_names_and_codes_normalize() -> None:
    assert normalize("Sweden") == "SE"
    assert normalize("se") == "SE"
    assert normalize("Switzerland") == "CH"
    assert normalize("USA") == "US"
    assert normalize("California") == "US-CA"
    assert normalize("us-ca") == "US-CA"
    assert normalize("European Union") == "EU"
    assert normalize("global") == "global"
    assert normalize("DE-BY") == "DE-BY"
    assert normalize("Atlantis") is None
    assert normalize(42) is None


def test_parent_regions() -> None:
    assert parents("SE") == ["EU", "EEA"]
    assert parents("NO") == ["EEA", "EFTA"]
    assert parents("CH") == ["EFTA"]  # Switzerland: neither EU nor EEA
    assert parents("US") == []
    assert parents("US-CA") == ["US"]
    assert parents("EU") == ["EEA"]
    assert market_codes("SE") == ["SE", "EU", "EEA", "global"]
    assert market_codes("global") == ["global"]


def test_which_items_hold_in_which_market() -> None:
    gdpr = ["EU", "EEA"]
    assert item_holds_in(gdpr, "SE")
    assert item_holds_in(gdpr, "NO")
    assert not item_holds_in(gdpr, "US")
    assert not item_holds_in(gdpr, "CH")
    assert item_holds_in(["US-CA"], "US")  # CCPA counts for a US launch
    assert item_holds_in(["US"], "US-CA")
    assert not item_holds_in(["US-TX"], "US-CA")
    assert not item_holds_in(["SE"], "EU")  # one member's law is not EU-wide
    assert item_holds_in(["global"], "CH")
    assert not item_holds_in([], "SE")
    assert not item_holds_in(None, "SE")


# ---------- validation ----------
def test_owner_metadata_is_validated_in_plain_words() -> None:
    got = clean_metadata(
        {
            "jurisdictions": "Sweden, EU",
            "year": "2026",
            "topic": "Data protection",
            "doc_type": "Law",
            "language": "SV",
        },
        partial=True,
    )
    assert got == {"jurisdictions": ["SE", "EU"], "year": 2026, "topic": "privacy", "doc_type": "law", "language": "sv"}
    with pytest.raises(ValueError, match="I don't know these places: Atlantis"):
        clean_metadata({"jurisdictions": ["SE", "Atlantis"]}, partial=True)
    with pytest.raises(ValueError, match="year like 2026"):
        clean_metadata({"year": 26}, partial=True)
    with pytest.raises(ValueError, match="before the start"):
        clean_metadata({"in_force_from": "2026-01-01", "in_force_to": "2025-01-01"}, partial=True)
    with pytest.raises(ValueError, match="topic must be one of"):
        clean_metadata({"topic": "astrology"}, partial=True)
    assert clean_metadata({"in_force_from": "2027"}, partial=True) == {"in_force_from": "2027-01-01"}


def test_the_models_answer_is_cleaned_field_by_field() -> None:
    got = clean_detected(
        {"jurisdictions": ["Sweden", "Narnia", "SE"], "year": "twenty", "topic": "tax", "doc_type": "statute",
         "language": "sv", "in_force_from": "2026-01-01"}
    )  # fmt: skip
    assert got["jurisdictions"] == ["SE"]
    assert got["year"] == 2026  # from the in-force date
    assert got["topic"] == "tax"
    assert got["doc_type"] is None
    assert got["language"] == "sv"
    assert clean_detected("nonsense")["jurisdictions"] == []


def test_hints_from_file_name_and_folder() -> None:
    assert hints_from_name("Inkomstskatt 2026.pdf", "tax/Sweden") == {"jurisdictions": ["SE"], "year": 2026}
    assert hints_from_name("CH_VAT_2025.pdf") == {"jurisdictions": ["CH"], "year": 2025}
    # Lower-case two-letter words are ordinary words, not countries.
    assert hints_from_name("notes in de stad.txt") == {"jurisdictions": [], "year": None}


# ---------- filters ----------
def test_market_filters() -> None:
    assert market_filter("SE") == {
        "orAll": [
            {"listContains": {"key": "countries", "value": "SE"}},
            {"listContains": {"key": "jurisdictions", "value": "EU"}},
            {"listContains": {"key": "jurisdictions", "value": "EEA"}},
            {"listContains": {"key": "jurisdictions", "value": "global"}},
        ]
    }
    assert market_filter("US-CA")["orAll"][0] == {"listContains": {"key": "jurisdictions", "value": "US-CA"}}
    assert market_filter("global") == {"listContains": {"key": "jurisdictions", "value": "global"}}
    cfg = retrieval_config(5, ["always", "relevant"], market_filter("US"))["vectorSearchConfiguration"]
    assert cfg["overrideSearchType"] == "HYBRID"
    assert cfg["filter"]["andAll"][0] == {"in": {"key": "scope", "value": ["always", "relevant"]}}
    # No market: the plain scope filter, as before.
    assert retrieval_config(5, ["relevant"])["vectorSearchConfiguration"]["filter"] == {
        "in": {"key": "scope", "value": ["relevant"]}
    }


@pytest.mark.parametrize(
    ("js", "market", "expected"),
    [(["EU", "EEA"], "SE", True), (["EU", "EEA"], "US", False), (["US-CA"], "US", True), (["SE"], "CH", False)],
)
def test_filter_and_record_check_agree(js: list[str], market: str, expected: bool) -> None:
    meta = item_metadata({"id": "k-aaaaaaaaaaaa", "scope": "relevant", "kind": "document", "jurisdictions": js})
    f = retrieval_config(5, ["relevant"], market_filter(market))["vectorSearchConfiguration"]["filter"]
    assert matches_filter(meta, f) is expected
    assert item_holds_in(js, market) is expected


def test_metadata_attributes_are_typed_for_bedrock() -> None:
    meta = item_metadata(
        {"id": "k-aaaaaaaaaaaa", "scope": "relevant", "kind": "document", "jurisdictions": ["US-CA"],
         "year": 2026, "topic": "privacy", "doc_type": "law", "language": "en"}
    )  # fmt: skip
    assert meta["countries"] == ["US"]
    attrs = {a["key"]: a["value"] for a in ingest_document("s3://b/k", meta)["metadata"]["inlineAttributes"]}
    assert attrs["jurisdictions"] == {"type": "STRING_LIST", "stringListValue": ["US-CA"]}
    assert attrs["year"] == {"type": "NUMBER", "numberValue": 2026}
    assert attrs["topic"] == {"type": "STRING", "stringValue": "privacy"}
    # Nothing known: only the old three attributes (Bedrock has no null).
    assert set(item_metadata({"id": "k-aaaaaaaaaaaa", "scope": "relevant", "kind": "text"})) == {
        "item_id", "scope", "kind"
    }  # fmt: skip


# ---------- time ----------
def _it(i: str, year: int, js: list[str], topic: str = "tax", **kw: Any) -> dict[str, Any]:
    return {"id": i, "status": "ready", "year": year, "jurisdictions": js, "topic": topic, **kw}


def test_newer_years_supersede_older_for_the_same_place_and_topic() -> None:
    items = [
        _it("se25", 2025, ["SE"]),
        _it("se26", 2026, ["SE"]),
        _it("ch25", 2025, ["CH"]),
        _it("se24priv", 2024, ["SE"], topic="privacy"),
        _it("se27", 2027, ["SE"]),  # not in force yet in 2026
    ]
    assert superseded_map(items, 2026) == {"se25": "se26"}
    assert superseded_map(items, 2027) == {"se25": "se27", "se26": "se27"}
    assert superseded_map(items, 2025) == {}
    assert in_force_status(items[4], 2026) == "not yet in force"
    assert in_force_status(_it("x", 2020, ["SE"], in_force_to="2023-12-31"), 2026) == "no longer in force"


# ---------- detection in the pipeline (fake model) ----------
async def test_ingest_detects_metadata_and_sends_it_to_the_kb() -> None:
    w = world()
    p, _, _ = pipeline(w)
    w.haiku.replies["metadata"] = [
        json.dumps({"jurisdictions": ["SE"], "year": 2026, "topic": "tax", "doc_type": "law", "language": "sv"})
    ]
    item_id = await upload(w, "skatt.txt", "Inkomstskattelag 2026 för Sverige".encode(), "text/plain")
    await step(p, "route", item_id)
    await step(p, "prepare_document", item_id)
    await step(p, "ingest", item_id)
    item = await w.store.get_item(item_id)
    assert item is not None
    assert (item["jurisdictions"], item["year"], item["topic"], item["language"]) == (["SE"], 2026, "tax", "sv")
    assert item["meta_source"] == "detected"
    meta = next(iter(w.kb.docs.values()))
    assert meta["jurisdictions"] == ["SE"] and meta["year"] == 2026 and meta["countries"] == ["SE"]
    sidecar = json.loads(await w.blobs.get(f"{item['normalized_keys'][0]}.metadata.json"))
    assert sidecar["metadataAttributes"]["jurisdictions"] == ["SE"]
    prompt = next(c.prompt for c in w.haiku.calls if "say where and when it holds" in c.prompt)
    assert "File name: skatt.txt" in prompt and "<data>" in prompt
    # A retried ingest (throttling) doesn't ask the model again.
    n = len(w.haiku.calls)
    await step(p, "ingest", item_id)
    assert len(w.haiku.calls) == n


async def test_detection_falls_back_to_the_file_name_and_never_fails_the_item() -> None:
    w = world()
    p, _, _ = pipeline(w)
    w.haiku.replies["metadata"] = ["I am not JSON"]
    r = await w.service.create_upload(
        {"file_name": "VAT_2025.txt", "content_type": "text/plain", "size_bytes": 5, "folder": "tax/Switzerland"}
    )
    item_id = r["item"]["id"]
    assert r["item"]["folder"] == "tax/Switzerland"
    await w.blobs.put(r["item"]["raw_key"], b"Mehrwertsteuer", "text/plain")
    await step(p, "route", item_id)
    await step(p, "prepare_document", item_id)
    await step(p, "ingest", item_id)
    item = await w.store.get_item(item_id)
    assert item is not None
    assert (item["jurisdictions"], item["year"], item["status"]) == (["CH"], 2025, "processing")


# ---------- owner edits ----------
async def test_owner_edit_reingests_with_new_metadata_and_list_marks_superseded() -> None:
    w = world()
    old = await ready_item(w, "Swedish tax 2025")
    new = await ready_item(w, "Swedish tax 2026")
    for it in (old, new):
        await w.store.update_item(it["id"], {"ingest_uris": [f"s3://b/normalized/{it['id']}/a.md"],
                                             "normalized_keys": [f"normalized/{it['id']}/a.md"]})  # fmt: skip
    got = await w.service.update(old["id"], {"jurisdictions": ["Sweden"], "year": 2025, "topic": "tax"})
    assert got["jurisdictions"] == ["SE"] and got["meta_source"] == "owner"
    assert w.kb.docs[f"s3://b/normalized/{old['id']}/a.md"]["jurisdictions"] == ["SE"]
    await w.service.update(new["id"], {"jurisdictions": ["SE"], "year": 2026, "topic": "tax"})
    listed = {i["id"]: i for i in (await w.service.list())["items"]}
    assert listed[old["id"]]["superseded_by"] == new["id"]  # kept and visible, marked
    assert "superseded_by" not in listed[new["id"]]
    with pytest.raises(KnowledgeError, match="I don't know these places"):
        await w.service.update(old["id"], {"jurisdictions": ["Atlantis"]})


# ---------- a US + Sweden task ----------
async def _placed(w: World, title: str, js: list[str], topic: str, year: int, text: str) -> dict[str, Any]:
    it = await ready_item(w, title)
    await w.store.update_item(it["id"], {"jurisdictions": js, "year": year, "topic": topic})
    meta = item_metadata({**it, "jurisdictions": js, "year": year, "topic": topic})
    w.kb.hits.append(Hit(it["id"], text, 0.9, "relevant", attributes=meta))
    return it


async def _launch_world() -> tuple[World, dict[str, dict[str, Any]]]:
    w = world()
    items = {
        "gdpr": await _placed(w, "GDPR", ["EU", "EEA"], "privacy", 2018, "GDPR: personal data needs a lawful basis."),
        "ccpa": await _placed(w, "CCPA", ["US-CA"], "privacy", 2020, "CCPA: Californians may opt out of sale."),
        "se_tax": await _placed(w, "Swedish VAT", ["SE"], "tax", 2026, "Swedish VAT is 25 %."),
        "se_tax_old": await _placed(w, "Swedish VAT old", ["SE"], "tax", 2025, "Swedish VAT 2025."),
        "ch_dp": await _placed(w, "Swiss FADP", ["CH"], "privacy", 2023, "FADP: Swiss data protection."),
    }
    return w, items


def _sections(out: str) -> dict[str, str]:
    got: dict[str, str] = {}
    for part in out.split("<market ")[1:]:
        code = part.split('code="', 1)[1].split('"', 1)[0]
        got[code] = part.split("</market>", 1)[0]
    return got


async def test_us_and_sweden_task_retrieves_each_market_separately_and_never_applies_gdpr_to_the_us() -> None:
    w, it = await _launch_world()
    out = await search_markets(w.kb, w.store, "privacy and tax rules for launching the app", ["US", "SE"], 2026)
    s = _sections(out)
    assert set(s) == {"US", "SE"}
    assert it["ccpa"]["id"] in s["US"]
    assert it["gdpr"]["id"] not in s["US"] and "GDPR" not in s["US"]
    assert it["se_tax"]["id"] not in s["US"] and it["ch_dp"]["id"] not in s["US"]
    assert it["gdpr"]["id"] in s["SE"] and it["se_tax"]["id"] in s["SE"]
    assert it["ccpa"]["id"] not in s["SE"] and it["ch_dp"]["id"] not in s["SE"]
    assert 'jurisdictions="EU,EEA"' in s["SE"]
    assert 'covers="SE, EU, EEA, global"' in out
    # Newest year in force first; the 2025 law is kept, marked as superseded.
    assert f'status="superseded by {it["se_tax"]["id"]} (2026)"' in s["SE"]
    assert s["SE"].index(it["se_tax"]["id"]) < s["SE"].index(it["se_tax_old"]["id"])
    assert "Never carry one market's rules into another market's answer" in out
    # One filtered Retrieve per market.
    filters = [c["filter"] for c in w.kb.calls]
    assert {"listContains": {"key": "countries", "value": "US"}} in filters[0]["andAll"][1]["orAll"]
    assert {"listContains": {"key": "countries", "value": "SE"}} in filters[1]["andAll"][1]["orAll"]


async def test_switzerland_gets_neither_gdpr_nor_swedish_law_and_a_named_year_changes_the_status() -> None:
    w, it = await _launch_world()
    out = await search_markets(w.kb, w.store, "tax and privacy", ["CH", "SE"], 2025)
    s = _sections(out)
    assert it["ch_dp"]["id"] in s["CH"]
    assert it["gdpr"]["id"] not in s["CH"] and it["se_tax"]["id"] not in s["CH"]
    assert f'item="{it["se_tax_old"]["id"]}"' in s["SE"]
    assert 'status="not yet in force"' in s["SE"]  # the 2026 law, asked about 2025


async def test_when_the_index_cant_filter_the_record_check_still_keeps_markets_apart() -> None:
    w, it = await _launch_world()
    w.kb.fail_filters = True
    out = await search_markets(w.kb, w.store, "privacy", ["US"], 2026)
    s = _sections(out)
    assert it["ccpa"]["id"] in s["US"]
    assert it["gdpr"]["id"] not in s["US"]
    assert len(w.kb.calls) == 2 and "andAll" not in w.kb.calls[1]["filter"]  # the wider unfiltered retry


async def test_a_market_with_nothing_stored_says_so() -> None:
    w, _ = await _launch_world()
    out = await search_markets(w.kb, w.store, "privacy", ["JP"], 2026)
    assert "Nothing stored for Japan matches." in out


# ---------- the agents' tool ----------
async def test_search_tool_takes_jurisdictions_and_year() -> None:
    from aic.runtime.tools import gate_tools, tools_for
    from test_knowledge_api_tools import city, ctx

    w, it = await _launch_world()
    d = city(w)
    tools = {t.name: t for t in gate_tools(d, ctx("worker"), tools_for(d, ctx("worker")))}
    t = tools["search_knowledge"]
    out = await t.handler({"query": "launch rules", "jurisdictions": ["Sweden", "US", "SE"], "year": 2026})
    s = _sections(out)
    assert list(s) == ["SE", "US"]
    assert it["gdpr"]["id"] in s["SE"] and it["gdpr"]["id"] not in s["US"]
    assert "I don't know these places: Atlantis" in await t.handler({"query": "rules", "jurisdictions": ["Atlantis"]})
    assert "Invalid input" in await t.handler({"query": "rules", "year": 1200})
    # Without jurisdictions: one search as before, items still marked with their place and status.
    plain = await t.handler({"query": "launch rules"})
    assert "<market" not in plain and 'jurisdictions="EU,EEA"' in plain


def test_the_huds_place_names_match_the_config() -> None:
    from aic.shared.config import repo_root
    from aic.shared.knowledge.jurisdiction import jurisdictions_config

    root = repo_root()
    assert root is not None
    ts = (root / "web" / "src" / "lib" / "places.ts").read_text(encoding="utf-8")
    c = jurisdictions_config()
    for code, name in c["countries"].items():
        assert f'{code}: "{name}"' in ts, code
    for t in c["topics"]:
        assert f'"{t}"' in ts, t
