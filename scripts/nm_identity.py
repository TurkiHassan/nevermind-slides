#!/usr/bin/env python3
"""Identity derived from the topic (roadmap NM-19). Stdlib only, deterministic, no network.

The colours of a deck come from the materials and tools of its own world (a port: container orange and sea; a
lesson on the brain: neural pink; a paper on gravity: a deep blue), not from a stock palette. This module finds those
words in the plan (title, headlines, body, content.entities, or theme.derive.materials), and builds three named
palettes of the theme tokens (paper, ink, muted, line, accent, accent2, surface): a light one, a tinted one led by the
second material and a dark one. Every palette is checked and corrected for contrast: ink on paper and on surface
7:1 or more, muted 4.5:1, accent and accent2 3:1.

The lexicon is data: resources/templates/identity-lexicon.json.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any

LEXICON_PATH = Path(__file__).resolve().parent.parent / "resources" / "templates" / "identity-lexicon.json"
_LEX: dict[str, Any] | None = None


def lexicon() -> dict[str, Any]:
    global _LEX
    if _LEX is None:
        _LEX = json.loads(LEXICON_PATH.read_text(encoding="utf-8"))
    return _LEX


# --------------------------------------------------------------------------------------------------- colour

def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(c: float) -> float:
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def oklch_to_rgb(L: float, C: float, h: float) -> tuple[float, float, float]:
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    bl = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    return tuple(_linear_to_srgb(v) if v > 0 else 0.0 if v > -1e-9 else -1.0 for v in (r, g, bl))  # type: ignore[return-value]


def _in_gamut(rgb: tuple[float, float, float]) -> bool:
    return all(-1e-6 <= v <= 1 + 1e-6 for v in rgb)


def to_hex(L: float, C: float, h: float) -> str:
    """OKLCH to #RRGGBB, lowering chroma until the colour fits sRGB."""
    c = C
    rgb = oklch_to_rgb(L, c, h)
    while not _in_gamut(rgb) and c > 0:
        c = max(0.0, c - 0.004)
        rgb = oklch_to_rgb(L, c, h)
    return "#" + "".join(f"{round(min(1, max(0, v)) * 255):02X}" for v in rgb)


def _rgb(hexc: str) -> tuple[float, float, float]:
    h = hexc.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def luminance(hexc: str) -> float:
    r, g, b = (_srgb_to_linear(v) for v in _rgb(hexc))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast(a: str, b: str) -> float:
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def lab(hexc: str) -> tuple[float, float, float]:
    """CIELAB (D65), for the standard colour difference."""
    r, g, b = (_srgb_to_linear(v) for v in _rgb(hexc))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116
    fx, fy, fz = f(x), f(y), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e(a: str, b: str) -> float:
    """CIE76 colour difference (CIELAB distance)."""
    return math.dist(lab(a), lab(b))


# --------------------------------------------------------------------------------------------------- words

_DIAC = re.compile(r"[ً-ْـ]")


def _norm(text: str) -> str:
    t = _DIAC.sub("", str(text)).lower()
    t = re.sub("[إأآ]", "ا", t).replace("ة", "ه").replace("ى", "ي")
    return t


def _stems(word: str) -> set[str]:
    """The word and its forms without attached prefixes (و ف ب ل ك ال) or a plural/feminine ending."""
    out = {word}
    w = word
    for _ in range(2):
        if len(w) > 3 and w[0] in "وفبلك":
            w = w[1:]
            out.add(w)
    for v in list(out):
        if v.startswith("ال") and len(v) > 3:
            out.add(v[2:])
        if v.startswith("لل") and len(v) > 3:
            out.add(v[2:])
    for v in list(out):
        for suf in ("ات", "ين", "ون", "ه", "ي"):
            if v.endswith(suf) and len(v) - len(suf) >= 3:
                out.add(v[: -len(suf)])
        if v.endswith("s") and len(v) > 3:
            out.add(v[:-1])
    return out


def _keys(mat: dict[str, Any]) -> list[str]:
    return [_norm(k) for k in mat["keys_ar"] + mat["keys_en"] + [mat["id"]]]


def find_materials(texts: list[tuple[str, int]]) -> list[dict[str, Any]]:
    """Materials named in weighted texts, strongest first (weight, then first appearance)."""
    mats = lexicon()["materials"]
    score: dict[str, float] = {}
    first: dict[str, int] = {}
    pos = 0
    for text, weight in texts:
        norm = _norm(text)
        words = re.findall(r"[\w؀-ۿ]+", norm)
        stems = [_stems(w) for w in words]
        for m in mats:
            for key in _keys(m):
                hit = 0
                if " " in key:
                    hit = norm.count(key)
                else:
                    hit = sum(1 for st in stems if key in st)
                if hit:
                    score[m["id"]] = score.get(m["id"], 0) + hit * weight
                    first.setdefault(m["id"], pos)
        pos += 1
    order = sorted(score, key=lambda k: (-score[k], first[k], k))
    by_id = {m["id"]: m for m in mats}
    return [by_id[k] for k in order]


def plan_texts(plan: dict[str, Any]) -> list[tuple[str, int]]:
    texts: list[tuple[str, int]] = [(str(plan.get("title") or ""), 3)]
    for s in plan.get("slides") or []:
        if not isinstance(s, dict):
            continue
        content = s.get("content") if isinstance(s.get("content"), dict) else {}
        for e in content.get("entities") or []:
            texts.append((str(e), 2))
        text = s.get("text") if isinstance(s.get("text"), dict) else {}
        for k in ("headline", "kicker"):
            if isinstance(text.get(k), str):
                texts.append((text[k], 1))
        for b in text.get("body") or []:
            if isinstance(b, str):
                texts.append((b, 1))
        visual = s.get("visual") if isinstance(s.get("visual"), dict) else {}
        if isinstance(visual.get("query"), str):
            texts.append((visual["query"], 1))
    return texts


# --------------------------------------------------------------------------------------------------- palettes

def _fit(L: float, C: float, h: float, against: list[str], target: float, darker: bool) -> str:
    """Move lightness away from the background until the contrast target holds."""
    step = -0.01 if darker else 0.01
    col = to_hex(L, C, h)
    while any(contrast(col, bg) < target for bg in against) and 0.0 < L < 1.0:
        L = min(1.0, max(0.0, L + step))
        col = to_hex(L, C, h)
    return col


def _palette(kind: str, m1: dict[str, Any], m2: dict[str, Any], mood: dict[str, Any], lang: str) -> dict[str, Any]:
    k = mood.get("chroma", 1.0)
    h1, c1 = m1["hue"], min(0.2, m1["chroma"] * k)
    h2, c2 = m2["hue"], min(0.2, m2["chroma"] * k)
    paper_h = mood.get("paper_hue", h1)
    if kind == "light":
        paper, surface, line = to_hex(0.968, 0.012, paper_h), to_hex(0.992, 0.005, paper_h), to_hex(0.875, 0.02, paper_h)
        bgs = [paper, surface]
        ink = _fit(0.24, 0.025, h1, bgs, 7.2, True)
        muted = _fit(0.48, 0.03, h1, bgs, 4.7, True)
        accent = _fit(0.54, c1, h1, [paper], 3.3, True)
        accent2 = _fit(0.50, c2, h2, [paper], 3.3, True)
        names = {"ar": ("ضوء النهار", "حبر"), "en": ("daylight", "ink")}
    elif kind == "tint":
        paper, surface, line = to_hex(0.95, 0.028, h2), to_hex(0.985, 0.01, h2), to_hex(0.85, 0.035, h2)
        bgs = [paper, surface]
        ink = _fit(0.23, 0.03, h2, bgs, 7.2, True)
        muted = _fit(0.46, 0.035, h2, bgs, 4.7, True)
        accent = _fit(0.50, c2, h2, [paper], 3.3, True)
        accent2 = _fit(0.50, c1, h1, [paper], 3.3, True)
        names = {"ar": (f"{m2['ar']} فاتح", "حبر"), "en": (f"pale {m2['en']}", "ink")}
    else:  # dark
        paper, surface, line = to_hex(0.205, 0.025, h1), to_hex(0.255, 0.028, h1), to_hex(0.38, 0.03, h1)
        bgs = [paper, surface]
        ink = _fit(0.955, 0.01, h1, bgs, 7.2, False)
        muted = _fit(0.76, 0.02, h1, bgs, 4.7, False)
        accent = _fit(0.74, c1, h1, [paper], 3.3, False)
        accent2 = _fit(0.72, c2, h2, [paper], 3.3, False)
        names = {"ar": ("ليل", "ضوء"), "en": ("night", "light")}
    lead, second = (m2, m1) if kind == "tint" else (m1, m2)
    tokens = {"paper": paper, "ink": ink, "muted": muted, "line": line, "accent": accent, "accent2": accent2, "surface": surface,
              "radius": 18 if kind == "dark" else 20}
    return {
        "kind": kind,
        "tone": "dark" if kind == "dark" else "light",
        "tokens": tokens,
        "names": {
            "ar": {"paper": names["ar"][0], "ink": names["ar"][1], "accent": lead["ar"], "accent2": second["ar"]},
            "en": {"paper": names["en"][0], "ink": names["en"][1], "accent": lead["en"], "accent2": second["en"]},
        },
        "contrast": {
            "ink": round(min(contrast(ink, paper), contrast(ink, surface)), 2),
            "muted": round(min(contrast(muted, paper), contrast(muted, surface)), 2),
            "accent": round(contrast(accent, paper), 2),
            "accent2": round(contrast(accent2, paper), 2),
        },
    }


def _fallback(title: str) -> list[dict[str, Any]]:
    """No material word found: two hues from the title itself, so different topics still differ."""
    d = hashlib.sha256(_norm(title).encode("utf-8")).digest()
    h1 = d[0] * 360 / 256
    return [
        {"id": "topic", "ar": "لون الموضوع", "en": "topic colour", "hue": round(h1), "chroma": 0.13},
        {"id": "topic2", "ar": "لون مرافق", "en": "companion colour", "hue": round((h1 + 150) % 360), "chroma": 0.10},
    ]


def derive(plan: dict[str, Any]) -> dict[str, Any]:
    """Three palettes for a plan. theme.derive.materials (words or lexicon ids) and theme.derive.mood steer it."""
    theme = plan.get("theme") if isinstance(plan.get("theme"), dict) else {}
    spec = theme.get("derive") if isinstance(theme.get("derive"), dict) else {}
    explicit = [str(x) for x in spec.get("materials") or [] if str(x).strip()]
    mats = find_materials([(w, 1) for w in explicit]) if explicit else find_materials(plan_texts(plan))
    source = "explicit" if explicit else "plan"
    found = [m["id"] for m in mats]
    if not mats:
        mats, source = _fallback(str(plan.get("title") or "")), "title"
    if len(mats) == 1:
        m = mats[0]
        mats = [m, {**m, "id": m["id"] + "-companion", "hue": (m["hue"] + 150) % 360, "chroma": max(0.06, m["chroma"] * 0.8),
                    "ar": "لون مرافق", "en": "companion colour"}]
    moods = lexicon()["moods"]
    mood_word = _norm(str(spec.get("mood") or ""))
    mood_id = next((k for k, v in moods.items() if mood_word and (mood_word == k or mood_word in [_norm(x) for x in v.get("ar", [])])), None)
    mood = moods.get(mood_id, {}) if mood_id else {}
    order = ["dark", "light", "tint"] if mood.get("dark_first") else ["light", "tint", "dark"]
    lang = plan.get("lang", "ar")
    palettes = [_palette(kind, mats[0], mats[1], mood, lang) for kind in order]
    return {"schema": "nevermind-identity/1", "source": source, "materials": found, "mood": mood_id,
            "lead": [mats[0]["id"], mats[1]["id"]], "palettes": palettes}


def pick(plan: dict[str, Any]) -> dict[str, Any] | None:
    """The tokens theme.derive asks for (theme.derive.pick: 1 to 3, default 1), or None without theme.derive."""
    theme = plan.get("theme") if isinstance(plan.get("theme"), dict) else {}
    spec = theme.get("derive")
    if not isinstance(spec, dict):
        return None
    n = spec.get("pick", 1)
    n = n if isinstance(n, int) and 1 <= n <= 3 else 1
    return derive(plan)["palettes"][n - 1]["tokens"]


def table(result: dict[str, Any], lang: str) -> str:
    ar = lang == "ar"
    head = "| اللوحة | النوع | الورق | الحبر | اللهجة | اللهجة الثانية | التباين (حبر/لهجة) |" if ar else \
        "| Palette | Kind | Paper | Ink | Accent | Accent 2 | Contrast (ink/accent) |"
    rows = [head, "|---|---|---|---|---|---|---|"]
    kinds_ar = {"light": "فاتحة", "tint": "ملوّنة", "dark": "داكنة"}
    for i, p in enumerate(result["palettes"], 1):
        n = p["names"]["ar" if ar else "en"]
        t = p["tokens"]
        rows.append(f"| {'ABC'[i - 1]} ({i}) | {kinds_ar[p['kind']] if ar else p['kind']} | {n['paper']} {t['paper']} | {n['ink']} {t['ink']} | "
                    f"{n['accent']} {t['accent']} | {n['accent2']} {t['accent2']} | {p['contrast']['ink']}:1 / {p['contrast']['accent']}:1 |")
    src = {"explicit": "من theme.derive.materials", "plan": "من نص الخطة", "title": "لم تُعرف مادة: من العنوان"} if ar else \
        {"explicit": "from theme.derive.materials", "plan": "from the plan text", "title": "no material word found: from the title"}
    rows.append("")
    rows.append(("المواد: " if ar else "Materials: ") + (", ".join(result["materials"]) or "-") + f" ({src[result['source']]})")
    return "\n".join(rows)
