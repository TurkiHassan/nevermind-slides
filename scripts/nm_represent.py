#!/usr/bin/env python3
"""Representation intelligence for deck plans (roadmap NM-29). Stdlib only, deterministic, no network.

The agent describes each slide's information in `content` (kind, items, dimensions, quantities, sequence, formula,
detail, entities). This module turns that description into features, scores the representations with the data rules
in resources/templates/representation-rules.json, removes what must never be suggested, adds the narrative pass
(what the slide shares with its neighbours, how deep it goes) and the motion restraint (a still slide is a legitimate
result), and checks the plan's data (parts that do not add up, mixed units).

Every suggestion is advisory, explained by a reason code with Arabic and English text, and can be locked
(`"visual": {"locked": true}`). A plan without `content` gets no advice: the tools behave exactly as before.

Used by deck_helper.py (plan-advise, plan-lint when `"advisor": true`, scaffold, audit-deck).
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

RULES_PATH = Path(__file__).resolve().parent.parent / "resources" / "templates" / "representation-rules.json"
KINDS = ("concept", "comparison", "process", "causal", "data", "finding", "argument", "definition", "hierarchy", "part-whole", "timeline")
SEQUENCES = ("ordered", "unordered", "cyclic")
DETAILS = ("overview", "standard", "deep")
AUDIENCES = ("general", "practitioner", "expert")
DIAGRAM_ALIASES = {"bar": "bars", "column": "bars", "area": "line", "pie": "donut", "stack": "layers", "network": "flow", "graph": "flow", "kpi": "stat"}
# Labels that name a point in time: years, quarters and halves (capital Q/H), "epoch 3", Arabic period words.
_TIME_LABEL = re.compile(r"^\s*([\d٠-٩]{4}|[QH][1-4]\b.*|(19|20)\d\d\s*[-/]\s*\d+|[Ee]poch\s*\d+|[Ww]eek\s*\d+|[Mm]onth\s*\d+|[Dd]ay\s*\d+|الأسبوع.*|الشهر.*|اليوم.*|العام.*|السنة.*)\s*$")
_AR_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩٫", "0123456789.")

_RULES: dict[str, Any] | None = None


def rules() -> dict[str, Any]:
    global _RULES
    if _RULES is None:
        _RULES = json.loads(RULES_PATH.read_text(encoding="utf-8"))
    return _RULES


def code_text(code: str, lang: str, **values: Any) -> str:
    """The Arabic or English text of an act, fit or integrity code, with its placeholders filled."""
    for c in rules()["codes"]:
        if c["id"] == code:
            return _fill(c["ar" if lang == "ar" else "en"], values, lang)
    raise KeyError(code)


_TO_AR = str.maketrans("0123456789.", "٠١٢٣٤٥٦٧٨٩٫")


def _fill(template: str, values: dict[str, Any], lang: str = "en") -> str:
    """Fill {placeholders}; numbers in Arabic text use Arabic-Indic digits."""
    out = template
    for k, v in values.items():
        text = str(int(v) if isinstance(v, float) and v.is_integer() else v)
        if lang == "ar" and isinstance(v, (int, float)):
            text = text.translate(_TO_AR)
        out = out.replace("{" + k + "}", text)
    return out


# --------------------------------------------------------------------------------------------------- features

def _num(v: Any) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        m = re.search(r"-?\d+(?:\.\d+)?", v.translate(_AR_DIGITS).replace(",", ""))
        return float(m.group(0)) if m else None
    return None


def _unit(u: Any) -> str:
    u = str(u or "").strip()
    return "%" if u in ("%", "٪", "percent", "بالمئة") else u


def visual_key(slide: dict[str, Any]) -> str:
    """The plan's current representation as a key of the rules file (chart:bars, diagram:flow, table, none...)."""
    v = slide.get("visual") if isinstance(slide.get("visual"), dict) else {}
    t = str(v.get("type") or "none")
    if t in ("chart", "diagram"):
        raw = str(v.get("diagram_type") or ("bars" if t == "chart" else "flow"))
        real = DIAGRAM_ALIASES.get(raw, raw)
        family = "chart" if real in ("bars", "line", "donut", "gauge", "stat") else "diagram"
        return f"{family}:{real}"
    return t


def features(slide: dict[str, Any], deck: dict[str, Any] | None = None) -> dict[str, Any]:
    deck = deck or {}
    content = slide.get("content") if isinstance(slide.get("content"), dict) else {}
    qs = [q for q in content.get("quantities") or [] if isinstance(q, dict)]
    values = [_num(q.get("value")) for q in qs]
    values_ok = [v for v in values if v is not None]
    units = sorted({_unit(q.get("unit")) for q in qs} - {""})
    dims = content.get("dimensions") if isinstance(content.get("dimensions"), dict) else {}
    text = slide.get("text") if isinstance(slide.get("text"), dict) else {}
    body = [b for b in text.get("body") or [] if isinstance(b, str)]
    items = content.get("items")
    items = int(items) if isinstance(items, (int, float)) and not isinstance(items, bool) else (len(qs) or len(body))
    entities = [str(e) for e in content.get("entities") or [] if str(e).strip()]
    sequence = content.get("sequence") if content.get("sequence") in SEQUENCES else None
    decreasing = len(values_ok) >= 3 and len(values_ok) == len(values) and all(a > b for a, b in zip(values_ok, values_ok[1:]))
    labels = [str(q.get("label") or "") for q in qs]
    time_labels = len(labels) >= 3 and all(_TIME_LABEL.match(lb) for lb in labels)
    time_series = len(qs) >= 3 and (time_labels or (sequence == "ordered" and not decreasing))
    total = sum(values_ok)
    sum100 = len(qs) >= 2 and len(values_ok) == len(qs) and all(v >= 0 for v in values_ok) and set(units) <= {"%"} and abs(total - 100) <= 1
    formula = content.get("formula")
    return {
        "kind": content.get("kind") if content.get("kind") in KINDS else None,
        "items": items,
        "options": int(dims.get("options") or 0) if isinstance(dims.get("options"), (int, float)) else 0,
        "criteria": int(dims.get("criteria") or 0) if isinstance(dims.get("criteria"), (int, float)) else 0,
        "quantities": len(qs),
        "units": "none" if not units else ("one" if len(units) == 1 else "mixed"),
        "unit_list": units,
        "sum": round(total, 2),
        "sum100": sum100,
        "time_series": time_series,
        "decreasing": decreasing,
        "sequence": sequence,
        "formula": bool(formula),
        "formula_source": formula if isinstance(formula, str) and formula.strip() else None,
        "detail": content.get("detail") if content.get("detail") in DETAILS else None,
        "entities": len(entities),
        "entity_list": entities,
        "audience": deck.get("audience") if deck.get("audience") in AUDIENCES else "general",
        "rel": str(slide.get("rel") or "next"),
        "role": slide.get("role"),
        "body": len(body),
    }


def _match(when: dict[str, Any], f: dict[str, Any]) -> bool:
    for key, cond in when.items():
        if key == "any":
            if not any(_match(sub, f) for sub in cond):
                return False
            continue
        value = f.get(key)
        if isinstance(cond, bool):
            if bool(value) != cond:
                return False
        elif isinstance(cond, list) and len(cond) == 2 and all(c is None or isinstance(c, (int, float)) for c in cond) and key in ("items", "options", "criteria", "quantities", "entities"):
            lo, hi = cond
            if (lo is not None and value < lo) or (hi is not None and value > hi):
                return False
        elif isinstance(cond, list):
            if value not in cond:
                return False
        elif value != cond:
            return False
    return True


# --------------------------------------------------------------------------------------------------- scoring

def rank(f: dict[str, Any]) -> list[dict[str, Any]]:
    """Representations by score (highest first) with the rules that support each, never-rules applied."""
    r = rules()
    order = list(r["representations"])
    scores: dict[str, float] = {}
    why: dict[str, list[tuple[float, str]]] = {}
    if f["kind"] is None:
        return []
    for rule in r["rules"]:
        if not _match(rule["when"], f):
            continue
        for rep, pts in rule["suggest"].items():
            scores[rep] = scores.get(rep, 0) + pts
            if pts > 0:
                why.setdefault(rep, []).append((pts, rule["id"]))
    banned = forbidden(f)
    out = [
        {"visual": rep, "score": s, "why": [rid for _p, rid in sorted(why.get(rep, []), key=lambda x: (-x[0], x[1]))]}
        for rep, s in scores.items() if s > 0 and rep not in banned and why.get(rep)
    ]
    out.sort(key=lambda x: (-x["score"], order.index(x["visual"]) if x["visual"] in order else len(order)))
    return out


def forbidden(f: dict[str, Any]) -> dict[str, str]:
    """Representation -> never-rule id, for the representations this information must never get."""
    out: dict[str, str] = {}
    for n in rules()["never"]:
        if _match(n["unless"], f):
            continue
        if "drop" in n:
            out.setdefault(n["drop"], n["id"])
        else:
            for rep in rules()["representations"]:
                if rep.startswith(n["drop_prefix"]):
                    out.setdefault(rep, n["id"])
    return out


def _rule_text(rule_id: str, f: dict[str, Any], lang: str) -> str:
    for rule in rules()["rules"]:
        if rule["id"] == rule_id:
            return _fill(rule["ar" if lang == "ar" else "en"], {
                "options": f["options"], "criteria": f["criteria"], "n": f["quantities"], "items": f["items"],
                "units": "، ".join(f["unit_list"]) if lang == "ar" else ", ".join(f["unit_list"]),
                "entities": "، ".join(f["entity_list"][:4]) if lang == "ar" else ", ".join(f["entity_list"][:4]),
            }, lang)
    raise KeyError(rule_id)


def _family(rep: str | None) -> str:
    return (rep or "none").split(":")[0]


# --------------------------------------------------------------------------------------------------- narrative

def still(f: dict[str, Any]) -> bool:
    """Information a still slide shows best: a definition, a quote, one number, one or two plain points."""
    if f["kind"] == "definition" or f["role"] == "quote" or f["quantities"] == 1:
        return True
    return f["kind"] in ("concept", "argument") and f["items"] <= 2 and f["entities"] < 3 and not f["formula"]


def acts_for(f: dict[str, Any], top: str | None, prev: dict[str, Any] | None) -> tuple[list[dict[str, Any]], bool]:
    """Suggested acts for the slide (act, target, reason codes) and whether the slide should stay still."""
    if still(f):
        return [], True
    acts: list[dict[str, Any]] = []
    fam = _family(top)
    if f["rel"] == "deeper":
        act = "lens" if top in ("anatomy", "image") or fam == "chart" else "zoom" if fam == "diagram" else "detail"
        acts.append({"act": act, "target": "visual", "why": ["A301"]})
    if f["body"] > 5 or (f["detail"] == "deep" and f["items"] > 4):
        acts.append({"act": "detail", "target": "visual", "why": ["A304"]})
    if f["entities"] >= 3 and top in ("anatomy", "image"):
        acts.append({"act": "pins", "target": "visual", "why": ["A305"]})
    if f["detail"] != "overview":
        reveal = None
        if top in ("diagram:flow", "diagram:timeline", "diagram:cycle", "diagram:tree") and f["items"] >= 3:
            reveal = ("reveal", "visual:rank")
        elif top in ("chart:bars", "chart:line") and f["quantities"] >= 3:
            reveal = ("draw", "visual:series")
        elif top == "table" and max(f["options"], f["quantities"], f["items"]) >= 3:
            reveal = ("reveal", "visual:row")
        elif top == "equation" and f["kind"] in ("process", "causal"):
            reveal = ("reveal", "visual:line")
        if reveal:
            acts.append({"act": reveal[0], "target": reveal[1], "why": ["A306"]})
    seen, out = set(), []
    for a in acts:  # one act per kind; at most one detail, lens or slice (plan-lint R108)
        if a["act"] in seen or (a["act"] in ("detail", "lens", "slice") and seen & {"detail", "lens", "slice"}):
            continue
        seen.add(a["act"])
        out.append(a)
    return out, False


# --------------------------------------------------------------------------------------------------- plan

def _fit(current: str, recs: list[dict[str, Any]], banned: dict[str, str]) -> str:
    if not recs:
        return "unknown"
    if current in banned:
        return "poor"
    keys = [r["visual"] for r in recs]
    if current == keys[0] or (current in keys[:2] and recs[keys.index(current)]["score"] >= recs[0]["score"] - 1):
        return "good"
    if current in keys[:3]:
        return "fair"
    return "weak"


def integrity(f: dict[str, Any], current: str) -> list[dict[str, Any]]:
    out = []
    if f["kind"] == "part-whole" and f["quantities"] >= 2 and set(f["unit_list"]) <= {"%"} and not f["sum100"]:
        out.append({"code": "A501", "values": {"sum": f["sum"]}})
    if current.startswith("chart:") and f["units"] == "mixed":
        out.append({"code": "A502", "values": {"units": ", ".join(f["unit_list"])}})
    return out


def _fingerprint(slide: dict[str, Any], f: dict[str, Any]) -> tuple:
    n = f["items"]
    bucket = "0" if n == 0 else "1-2" if n <= 2 else "3-5" if n <= 5 else "6+"
    steps = slide.get("steps") if isinstance(slide.get("steps"), list) else []
    acts = tuple(sorted({str(s.get("act")) for s in steps if isinstance(s, dict)}))
    return (str(slide.get("layout") or ""), visual_key(slide), bucket, acts)


def _linked(a: dict[str, Any], b: dict[str, Any]) -> bool:
    ma = set(a.get("morph") or []) if isinstance(a.get("morph"), list) else set()
    mb = set(b.get("morph") or []) if isinstance(b.get("morph"), list) else set()
    return bool(ma & mb) or str(b.get("rel") or "next") != "next" or str(b.get("transition") or "auto") != "auto"


def advise_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """advice.json for a plan: per slide current representation, fit, ranked suggestions, acts, morph, data checks;
    plus repetition findings across slides. Deterministic: the same plan gives the same bytes."""
    lang = plan.get("lang", "ar") if plan.get("lang") in ("ar", "en") else "ar"
    deck = {"audience": plan.get("audience", "general")}
    slides = [s if isinstance(s, dict) else {} for s in plan.get("slides") or []]
    feats = [features(s, deck) for s in slides]
    out_slides: list[dict[str, Any]] = []
    tops: list[str | None] = []
    for i, (slide, f) in enumerate(zip(slides, feats)):
        recs = rank(f)
        top = recs[0]["visual"] if recs else None
        tops.append(top)
        current = visual_key(slide)
        visual = slide.get("visual") if isinstance(slide.get("visual"), dict) else {}
        entry: dict[str, Any] = {"slide": slide.get("id"), "index": i + 1, "kind": f["kind"], "current": current}
        if f["kind"] is None:
            entry.update({"fit": "unknown", "recommend": [], "acts": [], "still": False, "morph": [], "checks": [],
                          "note": {"code": "A200", "ar": code_text("A200", "ar"), "en": code_text("A200", "en")}})
            out_slides.append(entry)
            continue
        banned = forbidden(f)
        fit = _fit(current, recs, banned)
        acts, is_still = acts_for(f, current if fit in ("good", "fair") else top, feats[i - 1] if i else None)
        prev = slides[i - 1] if i else None
        morph: list[dict[str, Any]] = []
        if prev is not None:
            shared = sorted(set(f["entity_list"]) & set(feats[i - 1]["entity_list"]))
            if shared:
                same = _family(top) == _family(tops[i - 1]) and top is not None
                morph.append({"ids": ["visual"] if same else shared, "entities": shared, "why": ["A302"]})
        checks = [{"code": c["code"], "ar": code_text(c["code"], "ar", **c["values"]), "en": code_text(c["code"], "en", **c["values"])}
                  for c in integrity(f, current)]
        content = slide.get("content") or {}
        if isinstance(content.get("items"), int) and f["quantities"] and content["items"] != f["quantities"]:
            checks.append({"code": "A503", "ar": code_text("A503", "ar", items=content["items"], n=f["quantities"]),
                           "en": code_text("A503", "en", items=content["items"], n=f["quantities"])})
        entry.update({
            "fit": fit,
            "locked": bool(visual.get("locked")),
            "recommend": [
                {"visual": r["visual"], "score": r["score"], "why": r["why"],
                 "text_ar": _rule_text(r["why"][0], f, "ar"), "text_en": _rule_text(r["why"][0], f, "en")}
                for r in recs[:3]
            ],
            "never": {rep: rid for rep, rid in sorted(banned.items()) if rep == current},
            "acts": [{**a, "text_ar": code_text(a["why"][0], "ar", n=max(f["items"], f["entities"], f["quantities"]), entities="، ".join(f["entity_list"][:3])),
                      "text_en": code_text(a["why"][0], "en", n=max(f["items"], f["entities"], f["quantities"]), entities=", ".join(f["entity_list"][:3]))} for a in acts],
            "still": is_still,
            "morph": morph,
            "checks": checks,
        })
        if is_still:
            entry["still_why"] = {"code": "A310", "ar": code_text("A310", "ar"), "en": code_text("A310", "en")}
        out_slides.append(entry)

    repetition: list[dict[str, Any]] = []
    prints = [_fingerprint(s, f) for s, f in zip(slides, feats)]
    i = 0
    while i + 2 < len(slides):
        if prints[i] == prints[i + 1] == prints[i + 2]:
            j = i + 2
            while j + 1 < len(slides) and prints[j + 1] == prints[i]:
                j += 1
            run = list(range(i, j + 1))
            kinds = [feats[k]["kind"] for k in run]
            linked = all(_linked(slides[k - 1], slides[k]) for k in run[1:])
            code = "A401" if None not in kinds and len(set(kinds)) > 1 else ("A402" if not linked else None)
            if code:
                repetition.append({"code": code, "slides": [k + 1 for k in run], "fingerprint": list(prints[i][:3]),
                                   "ar": code_text(code, "ar"), "en": code_text(code, "en")})
            i = j + 1
        else:
            i += 1
    return {"schema": "nevermind-advice/1", "lang": lang, "audience": deck["audience"], "slides": out_slides, "repetition": repetition}


def advice_json(advice: dict[str, Any]) -> str:
    return json.dumps(advice, ensure_ascii=False, indent=1) + "\n"


# --------------------------------------------------------------------------------------------------- apply

def apply_advice(plan: dict[str, Any], advice: dict[str, Any]) -> tuple[dict[str, Any], list[str], list[str]]:
    """Write the first suggestion into slides whose fit is weak or poor and whose visual is not locked.

    Only representations scaffold can build from what the plan holds are written: diagrams and charts always, a table
    when the plan lists quantities, an equation when content.formula holds the formula, an image when the plan has an
    image source. Returns (new plan, applied lines, skipped lines)."""
    new = json.loads(json.dumps(plan))
    reps = rules()["representations"]
    applied, skipped = [], []
    for entry in advice["slides"]:
        if entry["fit"] not in ("weak", "poor") or entry.get("locked") or not entry["recommend"]:
            continue
        slide = new["slides"][entry["index"] - 1]
        rec = entry["recommend"][0]
        key = rec["visual"]
        visual = json.loads(json.dumps(reps[key]["visual"]))
        content = slide.get("content") or {}
        f = features(slide, {"audience": plan.get("audience")})
        if key == "table":
            qs = [q for q in content.get("quantities") or [] if isinstance(q, dict)]
            if not qs:
                skipped.append(f"{entry['slide']}: table needs the values; list them in content.quantities or write visual.columns and rows")
                continue
            unit = f["unit_list"][0] if f["units"] == "one" else ""
            visual.update(columns=["", unit] if unit else ["", ""], rows=[[str(q.get("label", "")), q.get("value") if f["units"] != "mixed" else f"{q.get('value')} {q.get('unit', '')}".strip()] for q in qs])
        elif key == "equation":
            src = f["formula_source"]
            if not src:
                skipped.append(f"{entry['slide']}: equation needs the formula; write it in content.formula (MathML or TeX)")
                continue
            visual["mathml" if src.lstrip().startswith("<math") else "tex"] = src
        elif key == "image" and plan.get("image_source", "none") == "none":
            skipped.append(f"{entry['slide']}: image needs image_source generate or web")
            continue
        elif key == "anatomy":
            visual["ref"] = f"{entry['slide']}-figure"
        old = slide.get("visual") if isinstance(slide.get("visual"), dict) else {}
        for keep in ("ref", "query"):
            if keep in old and keep not in visual and key in ("image", "anatomy") and _family(entry["current"]) == _family(key):
                visual[keep] = old[keep]
        visual["why"] = rec["text_ar"] if advice.get("lang") == "ar" else rec["text_en"]
        slide["visual"] = visual
        applied.append(f"{entry['slide']}: {entry['current']} -> {key} ({rec['why'][0]})")
    return new, applied, skipped


# --------------------------------------------------------------------------------------------------- report

def table(advice: dict[str, Any]) -> str:
    """A short table in the plan's language for the agent and the user."""
    ar = advice.get("lang") == "ar"
    fit_names = {"good": "مناسب", "fair": "مقبول", "weak": "ضعيف", "poor": "غير مناسب", "unknown": "غير موصوف"} if ar else \
        {"good": "good", "fair": "fair", "weak": "weak", "poor": "poor", "unknown": "not described"}
    reps = rules()["representations"]
    name = lambda k: reps.get(k, {}).get("ar" if ar else "en", k) if k else "-"
    head = "| الشريحة | الحالي | الملاءمة | الاقتراح الأول | السبب | الحركة |" if ar else "| Slide | Current | Fit | First suggestion | Why | Motion |"
    rows = [head, "|---|---|---|---|---|---|"]
    for e in advice["slides"]:
        rec = e["recommend"][0] if e["recommend"] else None
        if e.get("still"):
            motion = "ثابتة" if ar else "still"
        else:
            parts = [f"{a['act']} {a['target']}" for a in e["acts"]] + [f"Morph: {'، '.join(m['entities']) if ar else ', '.join(m['entities'])}" for m in e.get("morph", [])]
            motion = ("، " if ar else ", ").join(parts)
        why = (rec["text_ar"] if ar else rec["text_en"]) if rec else (e.get("note", {}).get("ar" if ar else "en", ""))
        rows.append(f"| {e['index']} {e['slide']} | {name(e['current'])} | {fit_names[e['fit']]} | {name(rec['visual']) if rec else '-'} | {why} | {motion or '-'} |")
    for r in advice["repetition"]:
        rows.append("")
        rows.append(f"{r['code']}: {r['ar'] if ar else r['en']} ({', '.join(map(str, r['slides']))})")
    for e in advice["slides"]:
        for c in e.get("checks", []):
            rows.append(f"{c['code']} ({e['index']} {e['slide']}): {c['ar'] if ar else c['en']}")
    return "\n".join(rows)
