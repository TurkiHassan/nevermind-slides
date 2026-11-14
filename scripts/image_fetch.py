#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""Web image fallback for the Arabic slides skill (stdlib only; Pillow optional).

Use this when no image-generation tool exists. Find open-licence images on the web,
download them, crop/trim/treat them to a slide slot, and record credits.

Subcommands:
  search       Query Openverse and Wikimedia Commons (no API key), write candidates.json.
  fetch        Download one candidate (or a --url found elsewhere) into assets/img/src/.
  fit          Crop to the slot aspect ratio (focal point aware), resize, never upscale > 1.25x.
  treat        Bake a palette treatment (duotone, mono, tint) so mixed sources look like one set.
  auto         search -> fetch -> fit -> treat in one call; prints a <figure> snippet.
  credits      Emit the "مصادر الصور" block, or --check a deck for missing credits.
  placeholder  Generate an abstract on-palette SVG plate (no network needed).

Exit codes: 0 ok, 1 failure, 2 bad usage, 3 network unavailable.
Environment: NM_OPENVERSE_API, NM_WIKIMEDIA_API (override base URLs), NM_NO_PILLOW=1,
NM_NO_MAGICK=1, NM_NO_SIPS=1 (disable tools), NM_TIMEOUT, NM_RETRY_SLEEP.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html as htmllib
import json
import math
import os
import random
import re
import shutil
import ssl
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zlib
from pathlib import Path
from typing import Any

USER_AGENT = "nevermind-slides-image-fetch/1.0 (open-licence image search for slide decks)"
MAX_BYTES = 25 * 1024 * 1024
MAX_UPSCALE = 1.25
EXIT_OK, EXIT_FAIL, EXIT_USAGE, EXIT_NET = 0, 1, 2, 3
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}

OPENVERSE_DEFAULT = "https://api.openverse.org/v1/images/"
WIKIMEDIA_DEFAULT = "https://commons.wikimedia.org/w/api.php"


class NetworkError(Exception):
    """The network (or proxy) is unreachable."""


class ProviderError(Exception):
    """A provider answered with an error or unusable data."""


# --------------------------------------------------------------------------- helpers


def env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def say(msg: str, err: bool = False) -> None:
    print(msg, file=sys.stderr if err else sys.stdout)


def emit(summary: str, data: dict[str, Any], args: argparse.Namespace | None = None) -> None:
    """One human line, then the machine JSON (unless --quiet)."""
    print(summary)
    if not (args is not None and getattr(args, "quiet", False)):
        print(json.dumps(data, ensure_ascii=False, indent=2))


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def slugify(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9_-]+", "-", name.strip()).strip("-_").lower()
    return s or "image"


def parse_slot(text: str) -> tuple[int, int]:
    m = re.fullmatch(r"\s*(\d+)\s*[xX×]\s*(\d+)\s*", text or "")
    if not m or int(m.group(1)) < 1 or int(m.group(2)) < 1:
        raise ValueError(f"bad --slot '{text}', expected WxH such as 1200x800")
    return int(m.group(1)), int(m.group(2))


def parse_ratio(text: str) -> float:
    m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*", text or "")
    if m:
        return float(m.group(1)) / float(m.group(2))
    try:
        v = float(text)
        if v > 0:
            return v
    except (TypeError, ValueError):
        pass
    raise ValueError(f"bad --ratio '{text}', expected 16:9 or 1.78")


def parse_hex(value: str) -> tuple[int, int, int]:
    m = re.fullmatch(r"#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", (value or "").strip())
    if not m:
        raise ValueError(f"bad colour '{value}', expected #rrggbb")
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def hex_of(rgb: tuple[int, int, int]) -> str:
    return "#%02x%02x%02x" % rgb


def lerp_rgb(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))  # type: ignore[return-value]


def have_pillow() -> bool:
    if os.environ.get("NM_NO_PILLOW"):
        return False
    try:
        import PIL  # noqa: F401
        return True
    except ImportError:
        return False


def magick_bin() -> str | None:
    if os.environ.get("NM_NO_MAGICK"):
        return None
    m = shutil.which("magick")
    if m:
        return m
    if os.name != "nt":  # on Windows `convert` is a disk utility
        return shutil.which("convert")
    return None


def sips_bin() -> str | None:
    if os.environ.get("NM_NO_SIPS"):
        return None
    return shutil.which("sips")


def rel(path: Path, base: Path) -> str:
    try:
        return path.resolve().relative_to(base.resolve()).as_posix()
    except ValueError:
        return path.as_posix()


# --------------------------------------------------------------------------- http


def ssl_context() -> ssl.SSLContext:
    for var in ("SSL_CERT_FILE", "REQUESTS_CA_BUNDLE", "CURL_CA_BUNDLE"):
        p = os.environ.get(var)
        if p and os.path.isfile(p):
            try:
                return ssl.create_default_context(cafile=p)
            except (ssl.SSLError, OSError):
                continue
    return ssl.create_default_context()


def http_open(url: str, accept: str = "*/*", retries: int = 3, timeout: float | None = None):
    """Open a URL with retries and backoff. Returns the response object (caller closes it)."""
    timeout = timeout or env_float("NM_TIMEOUT", 25.0)
    sleep0 = env_float("NM_RETRY_SLEEP", 0.8)
    handlers: list[Any] = [urllib.request.HTTPSHandler(context=ssl_context())]
    opener = urllib.request.build_opener(*handlers)  # ProxyHandler picks up HTTPS_PROXY by default
    last: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
        try:
            return opener.open(req, timeout=timeout)
        except urllib.error.HTTPError as e:
            last = ProviderError(f"HTTP {e.code} from {urllib.parse.urlsplit(url).netloc}")
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                wait = sleep0 * (2 ** attempt)
                ra = e.headers.get("Retry-After") if e.headers else None
                if ra and ra.isdigit():
                    wait = min(float(ra), 5.0)
                time.sleep(wait)
                continue
            raise last
        except (urllib.error.URLError, TimeoutError, ConnectionError, ssl.SSLError, OSError) as e:
            last = NetworkError(str(getattr(e, "reason", e)))
            if attempt < retries - 1:
                time.sleep(sleep0 * (2 ** attempt))
                continue
            raise last
    raise last or NetworkError("unknown network error")


def http_json(url: str) -> Any:
    resp = http_open(url, accept="application/json")
    try:
        raw = resp.read(8 * 1024 * 1024)
    finally:
        resp.close()
    try:
        return json.loads(raw.decode("utf-8", "replace"))
    except json.JSONDecodeError as e:
        raise ProviderError(f"invalid JSON: {e}") from e


# --------------------------------------------------------------------------- licences

LICENSE_RANK = {"cc0": 4, "pdm": 4, "by": 3, "by-sa": 2, "by-nc": 1, "by-nc-sa": 1}
LICENSE_SETS = {
    "commercial": {"cc0", "pdm", "by", "by-sa"},
    "public-domain": {"cc0", "pdm"},
    "any-open": {"cc0", "pdm", "by", "by-sa", "by-nc", "by-nc-sa"},  # never ND: we crop
}


def license_key(text: str | None, url: str | None = None) -> str:
    """Normalise a licence string/URL to one of cc0, pdm, by, by-sa, by-nc, by-nc-sa, by-nd, by-nc-nd, other."""
    t = (text or "").strip().lower()
    u = (url or "").lower()
    m = re.search(r"creativecommons\.org/(licenses|publicdomain)/([a-z-]+)", u)
    if m:
        kind = m.group(2)
        if m.group(1) == "publicdomain":
            return "cc0" if kind == "zero" else "pdm"
        if kind in ("by", "by-sa", "by-nc", "by-nc-sa", "by-nd", "by-nc-nd"):
            return kind
    t = t.replace("_", "-")
    if "cc0" in t or "cc zero" in t or "zero" in t and "cc" in t:
        return "cc0"
    if t in ("pdm", "pd") or "public domain" in t or t.startswith("pdm") or "publicdomain" in t:
        return "pdm"
    m = re.search(r"\bcc[\s-]*by(?:[\s-]*(nc))?(?:[\s-]*(nd|sa))?\b", t)
    if m:
        parts = ["by"] + [p for p in (m.group(1), m.group(2)) if p]
        key = "-".join(parts)
        if key in ("by", "by-sa", "by-nc", "by-nd", "by-nc-sa", "by-nc-nd"):
            return key
    m = re.fullmatch(r"(by(?:-nc)?(?:-sa|-nd)?)(?:[\s-]*[\d.]+)?", t)
    if m:
        return m.group(1)
    return "other"


def license_label(key: str, version: str | None = None) -> str:
    base = {"cc0": "CC0", "pdm": "Public Domain Mark"}.get(key)
    if base:
        return base + (f" {version}" if version else "")
    if key.startswith("by"):
        return "CC " + key.upper() + (f" {version}" if version else "")
    return key


def strip_html(s: str | None) -> str:
    s = re.sub(r"<[^>]+>", "", s or "")
    return re.sub(r"\s+", " ", htmllib.unescape(s)).strip()


# --------------------------------------------------------------------------- providers


def openverse_search(query: str, a: argparse.Namespace) -> list[dict[str, Any]]:
    base = os.environ.get("NM_OPENVERSE_API", OPENVERSE_DEFAULT)
    params: dict[str, Any] = {"q": query, "page_size": min(max(a.count, 10), 20)}
    if a.license == "public-domain":
        params["license"] = "cc0,pdm"
    elif a.license == "commercial":
        params["license_type"] = "commercial"
    ori = {"landscape": "wide", "portrait": "tall", "square": "square"}.get(a.orientation)
    if ori:
        params["aspect_ratio"] = ori
    if a.min_width >= 1200:
        params["size"] = "large"
    sep = "&" if "?" in base else "?"
    data = http_json(base + sep + urllib.parse.urlencode(params))
    out = []
    for r in data.get("results", []) or []:
        key = license_key(r.get("license"), r.get("license_url"))
        mime = None
        ft = (r.get("filetype") or "").lower()
        if ft:
            mime = "image/jpeg" if ft in ("jpg", "jpeg") else f"image/{ft}"
        out.append({
            "id": f"openverse:{r.get('id')}",
            "provider": "openverse",
            "title": strip_html(r.get("title")) or "untitled",
            "creator": strip_html(r.get("creator")) or "unknown",
            "license": license_label(key, r.get("license_version")),
            "license_key": key,
            "license_url": r.get("license_url") or "",
            "source_page": r.get("foreign_landing_url") or "",
            "image_url": r.get("url") or "",
            "thumb_url": r.get("thumbnail") or "",
            "width": r.get("width"),
            "height": r.get("height"),
            "mime": mime,
        })
    return out


def wikimedia_search(query: str, a: argparse.Namespace) -> list[dict[str, Any]]:
    base = os.environ.get("NM_WIKIMEDIA_API", WIKIMEDIA_DEFAULT)
    params = {
        "action": "query", "format": "json", "formatversion": "2",
        "generator": "search", "gsrsearch": f"{query} filetype:bitmap",
        "gsrnamespace": "6", "gsrlimit": str(min(max(a.count * 3, 15), 50)),
        "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": "2400",
        "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|ObjectName|ImageDescription",
    }
    sep = "&" if "?" in base else "?"
    data = http_json(base + sep + urllib.parse.urlencode(params))
    pages = (data.get("query") or {}).get("pages") or []
    if isinstance(pages, dict):
        pages = list(pages.values())
    pages = sorted(pages, key=lambda p: p.get("index", 0))
    out = []
    for p in pages:
        infos = p.get("imageinfo") or []
        if not infos:
            continue
        ii = infos[0]
        md = ii.get("extmetadata") or {}
        val = lambda k: (md.get(k) or {}).get("value", "")  # noqa: E731
        key = license_key(val("LicenseShortName"), val("LicenseUrl"))
        title = strip_html(val("ObjectName")) or re.sub(r"^File:|\.[A-Za-z]+$", "", p.get("title", ""))
        out.append({
            "id": f"wikimedia:{p.get('pageid')}",
            "provider": "wikimedia",
            "title": title or "untitled",
            "creator": strip_html(val("Artist")) or "unknown",
            "license": strip_html(val("LicenseShortName")) or license_label(key),
            "license_key": key,
            "license_url": val("LicenseUrl") or "",
            "source_page": ii.get("descriptionurl") or "",
            "image_url": ii.get("url") or "",
            "thumb_url": ii.get("thumburl") or "",
            "width": ii.get("width"),
            "height": ii.get("height"),
            "mime": ii.get("mime"),
        })
    return out


# Register more providers here: name -> callable(query, args) -> list of normalised candidates.
PROVIDERS = {"openverse": openverse_search, "wikimedia": wikimedia_search}


def orientation_of(w: int | float, h: int | float) -> str:
    r = w / h
    return "landscape" if r > 1.15 else "portrait" if r < 0.87 else "square"


def rank_candidates(cands: list[dict[str, Any]], a: argparse.Namespace) -> list[dict[str, Any]]:
    allowed = LICENSE_SETS[a.license]
    seen: set[str] = set()
    kept = []
    floor = min(a.min_width, 800)
    for c in cands:
        if not c.get("image_url") or c.get("license_key") not in allowed:
            continue
        mime = (c.get("mime") or "").lower()
        ext = Path(urllib.parse.urlsplit(c["image_url"]).path).suffix.lower()
        if not mime:
            mime = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "")
        if mime not in ALLOWED_MIME:
            continue
        c["mime"] = mime
        w, h = c.get("width"), c.get("height")
        unknown = not (isinstance(w, int) and isinstance(h, int) and w > 0 and h > 0)
        if not unknown:
            if w < floor or h < 400:
                continue
            if not 0.3 <= w / h <= 3.2:
                continue
        dedupe = c["image_url"]
        tkey = (c["title"].lower() + "|" + c["creator"].lower())
        if dedupe in seen or tkey in seen:
            continue
        seen.add(dedupe)
        seen.add(tkey)
        if unknown:
            res_fit, ori_fit = 0.4, 0.5
        else:
            res_fit = min(w, a.min_width * 1.5) / (a.min_width * 1.5)
            ori_fit = 1.0 if a.orientation == "any" or orientation_of(w, h) == a.orientation else 0.3
        lic_fit = LICENSE_RANK.get(c["license_key"], 0) / 4
        c["score"] = round(0.45 * res_fit + 0.30 * ori_fit + 0.25 * lic_fit, 4)
        kept.append(c)
    kept.sort(key=lambda c: (-c["score"], c["id"]))
    return kept


NET_DOWN_MSG = (
    "NETWORK_UNAVAILABLE: تعذر الاتصال بالإنترنت أو بمزودي الصور ({detail}).\n"
    "لا تعد المحاولة في حلقة. استخدم لوحة بديلة على لوني الشرائح حتى لا تبقى فجوة فارغة:\n"
    "  python3 scripts/image_fetch.py placeholder --slot {slot} --name {name} --project DIR "
    "--ink \"#1c1b19\" --paper \"#f8f6f1\" --accent \"#c83e37\" --motif topo\n"
    "(English: network unavailable; generate an on-palette placeholder with the command above.)"
)


def net_down(detail: str, slot: str = "1200x800", name: str = "slide-image") -> int:
    say(NET_DOWN_MSG.format(detail=detail, slot=slot, name=name), err=True)
    return EXIT_NET


# --------------------------------------------------------------------------- credits


def img_dir(project: Path) -> Path:
    return project / "assets" / "img"


def credits_path(project: Path) -> Path:
    return img_dir(project) / "credits.json"


def load_credits(project: Path) -> dict[str, Any]:
    p = credits_path(project)
    if p.is_file():
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(d, dict) and isinstance(d.get("images"), list):
                return d
        except json.JSONDecodeError:
            pass
    return {"version": 1, "images": []}


def save_credits(project: Path, data: dict[str, Any]) -> None:
    p = credits_path(project)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(tmp, p)


def find_project(path: Path, explicit: str | None) -> Path | None:
    if explicit:
        return Path(explicit).resolve()
    parts = path.resolve().parts
    for i in range(len(parts) - 1, 0, -1):
        if parts[i - 1] == "assets" and parts[i] == "img":
            return Path(*parts[: i - 1])
    return None


def entry_paths(e: dict[str, Any]) -> set[str]:
    s = {e.get("file", "")}
    s.update(e.get("outputs", []))
    return {x for x in s if x}


def upsert_entry(project: Path, entry: dict[str, Any]) -> None:
    d = load_credits(project)
    imgs = d["images"]
    for i, e in enumerate(imgs):
        if e.get("name") == entry["name"]:
            keep = {k: v for k, v in e.items() if k in ("fit", "treat", "outputs", "final")}
            if e.get("file") == entry.get("file"):
                entry = {**entry, **{k: v for k, v in keep.items() if k not in entry}}
            imgs[i] = entry
            break
    else:
        imgs.append(entry)
    save_credits(project, d)


def record_derived(project: Path | None, src: Path, key: str, info: dict[str, Any], out: Path) -> None:
    """Record fit/treat results under the entry that owns `src` (creating a stub if needed)."""
    if project is None:
        return
    d = load_credits(project)
    rs, ro = rel(src, project), rel(out, project)
    target = None
    for e in d["images"]:
        if rs in entry_paths(e):
            target = e
            break
    if target is None:
        for e in d["images"]:
            if e.get("name") == src.stem.split("-")[0]:
                target = e
                break
    if target is None:
        target = {"name": src.stem, "file": rs, "title": src.stem, "creator": "unknown",
                  "license": "unverified", "license_url": "", "source_page": "", "provider": "local",
                  "recorded_at": now_iso(), "note": "added by fit/treat; source was not fetched with this tool"}
        d["images"].append(target)
    target.setdefault("outputs", [])
    if ro not in target["outputs"] and ro != target.get("file"):
        target["outputs"].append(ro)
    target[key] = info
    target["final"] = ro
    save_credits(project, d)


# --------------------------------------------------------------------------- image bytes


def sniff_raster(head: bytes) -> tuple[str, str] | None:
    if head[:3] == b"\xff\xd8\xff":
        return "image/jpeg", ".jpg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png", ".png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp", ".webp"
    return None


def sniff_size(data: bytes) -> tuple[int, int] | None:
    """Image dimensions from raw bytes without Pillow (JPEG, PNG, WEBP)."""
    try:
        if data[:8] == b"\x89PNG\r\n\x1a\n":
            return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
        if data[:3] == b"\xff\xd8\xff":
            i = 2
            while i + 9 < len(data):
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                    i += 2
                    continue
                seg = int.from_bytes(data[i + 2:i + 4], "big")
                if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                    return int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
                i += 2 + seg
        if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            kind = data[12:16]
            if kind == b"VP8X":
                return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
            if kind == b"VP8L":
                b = data[21:25]
                bits = int.from_bytes(b, "little")
                return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            if kind == b"VP8 ":
                return int.from_bytes(data[26:28], "little") & 0x3FFF, int.from_bytes(data[28:30], "little") & 0x3FFF
    except (IndexError, ValueError):
        pass
    return None


def file_size_px(path: Path) -> tuple[int, int] | None:
    try:
        with open(path, "rb") as f:
            data = f.read(512 * 1024)
        s = sniff_size(data)
        if s:
            return s
    except OSError:
        return None
    if have_pillow():
        try:
            from PIL import Image
            with Image.open(path) as im:
                return im.size
        except Exception:  # noqa: BLE001
            return None
    return None


def download_image(url: str, dest_base: Path) -> dict[str, Any]:
    """Download `url` to dest_base + extension. Validates type, magic bytes and size cap."""
    resp = http_open(url, accept="image/jpeg,image/png,image/webp,image/*;q=0.8")
    try:
        ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype and not (ctype.startswith("image/") or ctype == "application/octet-stream"):
            raise ProviderError(f"not an image (Content-Type {ctype})")
        clen = resp.headers.get("Content-Length")
        if clen and clen.isdigit() and int(clen) > MAX_BYTES:
            raise ProviderError(f"too large ({int(clen) // 1048576} MB, cap 25 MB)")
        chunks, total = [], 0
        while True:
            b = resp.read(256 * 1024)
            if not b:
                break
            total += len(b)
            if total > MAX_BYTES:
                raise ProviderError("too large (cap 25 MB)")
            chunks.append(b)
    finally:
        resp.close()
    data = b"".join(chunks)
    kind = sniff_raster(data[:16])
    if not kind:
        raise ProviderError("downloaded bytes are not a JPEG/PNG/WEBP raster image")
    mime, ext = kind
    dest = dest_base.with_suffix(ext)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    size = sniff_size(data) or file_size_px(dest)
    return {"path": dest, "mime": mime, "bytes": total, "width": size[0] if size else None,
            "height": size[1] if size else None}


# --------------------------------------------------------------------------- search / fetch


def cmd_search(a: argparse.Namespace) -> int:
    providers = [p.strip() for p in a.providers.split(",") if p.strip()]
    unknown = [p for p in providers if p not in PROVIDERS]
    if unknown:
        say(f"unknown provider(s): {', '.join(unknown)}; available: {', '.join(PROVIDERS)}", True)
        return EXIT_USAGE
    queries = [a.query] + ([a.query_ar] if a.query_ar else [])
    raw: list[dict[str, Any]] = []
    ok = net_fail = other_fail = 0
    notes: list[str] = []
    for prov in providers:
        for q in queries:
            try:
                raw += PROVIDERS[prov](q, a)
                ok += 1
            except NetworkError as e:
                net_fail += 1
                notes.append(f"{prov}: network error ({e})")
            except ProviderError as e:
                other_fail += 1
                notes.append(f"{prov}: {e}")
    if ok == 0:
        if net_fail:
            return net_down(notes[0] if notes else "no route")
        say("all providers failed: " + "; ".join(notes), True)
        return EXIT_FAIL
    ranked = rank_candidates(raw, a)[: a.count]
    out = Path(a.out)
    payload = {"query": a.query, "query_ar": a.query_ar, "generated_at": now_iso(),
               "license_filter": a.license, "notes": notes, "candidates": ranked}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not ranked:
        say(f"no usable open-licence images for '{a.query}'. Broaden the query, lower --min-width, "
            f"or use --license any-open.", True)
        return EXIT_FAIL
    print(f"{len(ranked)} candidates written to {out} (from {len(raw)} raw results)")
    for i, c in enumerate(ranked):
        size = f"{c['width']}x{c['height']}" if c.get("width") else "?x?"
        print(f"  [{i}] {c['score']:.2f} {c['license']:<14} {size:<10} {c['provider']:<9} {c['title'][:60]}")
    for n in notes:
        say("warning: " + n, True)
    print(f"next: python3 scripts/image_fetch.py fetch --candidate {out}#0 --name SLUG --project DIR")
    return EXIT_OK


def load_candidate(spec: str) -> dict[str, Any]:
    path, _, idx = spec.rpartition("#")
    if not path or not idx.isdigit():
        raise ValueError("--candidate must look like candidates.json#INDEX")
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    lst = data["candidates"] if isinstance(data, dict) else data
    return lst[int(idx)]


def fetch_one(project: Path, name: str, meta: dict[str, Any], urls: list[str]) -> dict[str, Any]:
    """Download the first working URL and register credits. Returns the credits entry."""
    dest_base = img_dir(project) / "src" / name
    last: Exception | None = None
    got = None
    for u in urls:
        if not u:
            continue
        try:
            got = download_image(u, dest_base)
            meta["source_url"] = u
            break
        except ProviderError as e:
            last = e
    if got is None:
        raise last or ProviderError("no download URL")
    for old in dest_base.parent.glob(name + ".*"):
        if old != got["path"]:
            old.unlink()
    key = license_key(meta.get("license"), meta.get("license_url"))
    lic = meta.get("license") or "unverified"
    if lic.lower() in ("", "unknown", "unverified"):
        lic = "unverified"
    entry = {
        "name": name, "file": rel(got["path"], project), "title": meta.get("title") or name,
        "creator": meta.get("creator") or "unknown", "license": lic,
        "license_key": key if lic != "unverified" else "unverified",
        "license_url": meta.get("license_url") or "", "source_page": meta.get("source_page") or "",
        "source_url": meta.get("source_url", ""), "provider": meta.get("provider") or "manual",
        "candidate_id": meta.get("id", ""), "fetched_at": now_iso(), "mime": got["mime"],
        "bytes": got["bytes"], "width": got["width"], "height": got["height"],
        "outputs": [],
    }
    upsert_entry(project, entry)
    return entry


def license_warnings(entry: dict[str, Any]) -> list[str]:
    w = []
    if entry["license"] == "unverified":
        w.append("LICENCE UNVERIFIED: do not distribute this deck publicly until the licence is confirmed.")
    elif entry.get("license_key") in ("by-nd", "by-nc-nd"):
        w.append("licence forbids derivatives (ND): cropping is a modification. Pick another image.")
    elif entry.get("license_key") in ("by-nc", "by-nc-sa"):
        w.append("licence is non-commercial (NC): internal/non-commercial decks only.")
    elif entry.get("license_key") == "other":
        w.append("licence not recognised as open; verify before distributing.")
    if entry.get("creator") in ("unknown", ""):
        w.append("creator unknown: add --creator so the credit line is complete.")
    return w


def cmd_fetch(a: argparse.Namespace) -> int:
    project = Path(a.project)
    name = slugify(a.name)
    if bool(a.url) == bool(a.candidate):
        say("give exactly one of --url or --candidate", True)
        return EXIT_USAGE
    meta: dict[str, Any] = {}
    urls: list[str] = []
    if a.candidate:
        try:
            c = load_candidate(a.candidate)
        except (ValueError, OSError, IndexError, KeyError, json.JSONDecodeError) as e:
            say(f"cannot read candidate: {e}", True)
            return EXIT_USAGE
        meta = dict(c)
        urls = [c.get("image_url", ""), c.get("thumb_url", "")]
    else:
        if not a.license:
            say("--url requires --license (use --license unknown if you cannot find it), "
                "plus --creator, --source-page and --title.", True)
            return EXIT_USAGE
        meta = {"provider": "manual"}
        urls = [a.url]
    for k in ("license", "creator", "source_page", "title"):
        v = getattr(a, k, None)
        if v:
            meta[k] = v
    if meta.get("license") and a.candidate:
        meta["license_key"] = license_key(meta["license"], meta.get("license_url"))
    try:
        entry = fetch_one(project, name, meta, urls)
    except NetworkError as e:
        return net_down(str(e), name=name)
    except ProviderError as e:
        say(f"download failed: {e}", True)
        return EXIT_FAIL
    warns = license_warnings(entry)
    for w in warns:
        say("warning: " + w, True)
    emit(f"fetched {entry['file']} ({entry['width']}x{entry['height']}, {entry['license']}) credits recorded",
         {"ok": True, "file": entry["file"], "entry": entry, "warnings": warns}, a)
    return EXIT_OK


# --------------------------------------------------------------------------- fit


def window_size(W: int, H: int, ratio: float) -> tuple[int, int]:
    if W / H > ratio:
        return max(1, round(H * ratio)), H
    return W, max(1, round(W / ratio))


def window_from_focus(W: int, H: int, cw: int, ch: int, fx: float, fy: float) -> tuple[int, int]:
    x = min(max(round(fx * W - cw / 2), 0), W - cw)
    y = min(max(round(fy * H - ch / 2), 0), H - ch)
    return x, y


def saliency_window(im: Any, ratio: float) -> tuple[int, int, int, int, float, float]:
    """Pick the crop window that retains the most edge/contrast/colour energy (deterministic).

    Returns (x, y, cw, ch, focus_x, focus_y) in source pixels; focus values are 0..1.
    """
    from PIL import Image, ImageFilter, ImageOps

    W, H = im.size
    cw, ch = window_size(W, H, ratio)
    scale = min(1.0, 160.0 / max(W, H))
    sw, sh = max(8, round(W * scale)), max(8, round(H * scale))
    rgb = im.convert("RGB").resize((sw, sh), Image.BOX)
    gray = ImageOps.grayscale(rgb)
    sat = rgb.convert("HSV").split()[1]
    g = list(gray.getdata())
    gb = list(gray.filter(ImageFilter.GaussianBlur(3)).getdata())
    s = list(sat.getdata())
    sb = list(sat.filter(ImageFilter.GaussianBlur(3)).getdata())
    E = [[0.0] * sw for _ in range(sh)]
    for y in range(sh):
        for x in range(sw):
            i = y * sw + x
            gx = abs(g[y * sw + min(x + 1, sw - 1)] - g[y * sw + max(x - 1, 0)])
            gy = abs(g[min(y + 1, sh - 1) * sw + x] - g[max(y - 1, 0) * sw + x])
            dx = (x / sw - 0.5) * 2
            dy = (y / sh - 0.5) * 2
            centre = 1.0 - 0.30 * ((dx * dx + dy * dy) / 2)
            E[y][x] = (gx + gy + 1.5 * abs(g[i] - gb[i]) + 0.6 * abs(s[i] - sb[i])) * centre
    wx, wy = max(1, min(sw, round(cw * sw / W))), max(1, min(sh, round(ch * sh / H)))
    ox, oy = 0, 0
    if wx < sw:  # crop along x
        cols = [sum(E[y][x] for y in range(sh)) for x in range(sw)]
        pre = [0.0]
        for v in cols:
            pre.append(pre[-1] + v)
        mid = (sw - wx) / 2
        ox = max(range(sw - wx + 1), key=lambda o: (round(pre[o + wx] - pre[o], 6), -abs(o - mid)))
    elif wy < sh:
        rows = [sum(r) for r in E]
        pre = [0.0]
        for v in rows:
            pre.append(pre[-1] + v)
        mid = (sh - wy) / 2
        oy = max(range(sh - wy + 1), key=lambda o: (round(pre[o + wy] - pre[o], 6), -abs(o - mid)))
    tot = cx = cy = 0.0
    for y in range(oy, oy + wy):
        for x in range(ox, ox + wx):
            v = E[y][x]
            tot += v
            cx += v * x
            cy += v * y
    if tot > 0:
        fx, fy = (cx / tot + 0.5) / sw, (cy / tot + 0.5) / sh
    else:
        fx, fy = (ox + wx / 2) / sw, (oy + wy / 2) / sh
    x0 = min(max(round(ox * W / sw), 0), W - cw)
    y0 = min(max(round(oy * H / sh), 0), H - ch)
    return x0, y0, cw, ch, fx, fy


def trim_box(im: Any, tol: int = 14) -> tuple[int, int, int, int] | None:
    """Bounding box of non-border content, or None when there is nothing safe to trim."""
    from PIL import Image, ImageChops, ImageFilter

    W, H = im.size
    if "A" in im.getbands():
        alpha = im.getchannel("A")
        if alpha.getextrema()[0] < 250:
            bb = alpha.point(lambda v: 255 if v > 16 else 0).getbbox()
            if bb and bb != (0, 0, W, H):
                return bb
    rgb = im.convert("RGB")
    corners = [rgb.getpixel(p) for p in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1))]
    bg = corners[0]
    if any(max(abs(c[i] - bg[i]) for i in range(3)) > tol * 2 for c in corners):
        return None
    diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, bg)).convert("L")
    mask = diff.point(lambda v: 255 if v > tol else 0).filter(ImageFilter.MinFilter(3))
    bb = mask.getbbox()
    if not bb:
        return None
    l, t, r, b = max(bb[0] - 1, 0), max(bb[1] - 1, 0), min(bb[2] + 1, W), min(bb[3] + 1, H)
    removed = 1 - ((r - l) * (b - t)) / (W * H)
    if removed < 0.015 or (r - l) * (b - t) < 0.3 * W * H:
        return None
    return l, t, r, b


def plan_size(cw: int, ch: int, slot: tuple[int, int] | None, ratio: float, max_width: int) -> tuple[int, int, bool]:
    """Final (w, h, upscale_capped). Never upscales the crop by more than MAX_UPSCALE."""
    if slot:
        tw, th = slot
    else:
        tw = min(max_width, cw)
        th = round(tw / ratio)
    if tw > max_width:
        th = round(th * max_width / tw)
        tw = max_width
    capped = False
    if tw / cw > MAX_UPSCALE:
        capped = True
        k = (cw * MAX_UPSCALE) / tw
        tw, th = round(tw * k), round(th * k)
    return max(1, tw), max(1, th), capped


def default_fit_out(src: Path, fmt: str) -> Path:
    if src.parent.name == "src" and src.parent.parent.name == "img":
        return src.parent.parent / f"{src.stem}.{fmt}"
    return src.with_name(f"{src.stem}-fit.{fmt}")


def parse_focus(text: str) -> tuple[float, float] | None:
    t = (text or "auto").strip().lower()
    if t == "auto":
        return None
    if t == "center":
        return 0.5, 0.5
    m = re.fullmatch(r"(\d+(?:\.\d+)?)%?\s*,\s*(\d+(?:\.\d+)?)%?", t)
    if not m:
        raise ValueError(f"bad --focus '{text}', use auto, center or X%,Y%")
    return min(float(m.group(1)), 100) / 100, min(float(m.group(2)), 100) / 100


def run_cmd(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=120)


def fit_pillow(src: Path, out: Path, slot, ratio, focus, max_width, trim, fmt) -> dict[str, Any]:
    from PIL import Image, ImageOps

    Image.MAX_IMAGE_PIXELS = 120_000_000
    im = Image.open(src)
    im.load()
    im = ImageOps.exif_transpose(im)
    ox, oy = 0, 0
    trimmed = None
    orig_size = list(im.size)
    if trim:
        bb = trim_box(im)
        if bb:
            trimmed = {"x": bb[0], "y": bb[1], "w": bb[2] - bb[0], "h": bb[3] - bb[1],
                       "from": list(im.size)}
            im = im.crop(bb)
            ox, oy = bb[0], bb[1]
    W, H = im.size
    if slot:
        ratio = slot[0] / slot[1]
    cw, ch = window_size(W, H, ratio)
    if focus is None:
        x, y, cw, ch, fx, fy = saliency_window(im, ratio)
    else:
        x, y = window_from_focus(W, H, cw, ch, *focus)
        fx, fy = focus
    tw, th, capped = plan_size(cw, ch, slot, ratio, max_width)
    res = im.crop((x, y, x + cw, y + ch)).resize((tw, th), Image.LANCZOS)
    save_image(res, out, fmt)
    return {"tool": "pillow", "size": [tw, th], "crop": {"x": x + ox, "y": y + oy, "w": cw, "h": ch},
            "source_size": orig_size,
            "focus": {"x": round(fx * 100, 1), "y": round(fy * 100, 1)}, "upscale_capped": capped,
            "trimmed": trimmed}


def save_image(im: Any, out: Path, fmt: str) -> None:
    from PIL import Image

    out.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "jpg":
        if im.mode in ("RGBA", "LA", "P"):
            im = im.convert("RGBA")
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.getchannel("A"))
            im = bg
        else:
            im = im.convert("RGB")
        im.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    elif fmt == "webp":
        im.save(out, "WEBP", quality=82, method=4)
    else:
        im.save(out, "PNG", optimize=True)


def fit_magick(binary: str, src: Path, out: Path, slot, ratio, focus, max_width, trim) -> dict[str, Any]:
    r = run_cmd([binary, str(src), "-auto-orient", "-format", "%w %h", "info:"])
    if r.returncode != 0:
        raise RuntimeError(r.stderr.strip() or "ImageMagick could not read the image")
    W, H = (int(v) for v in r.stdout.split()[:2])
    ox, oy, bw, bh = 0, 0, W, H
    trimmed = None
    if trim:
        r2 = run_cmd([binary, str(src), "-auto-orient", "-fuzz", "6%", "-format", "%@", "info:"])
        m = re.fullmatch(r"(\d+)x(\d+)\+(-?\d+)\+(-?\d+)", r2.stdout.strip())
        if m:
            w2, h2, x2, y2 = (int(g) for g in m.groups())
            if (w2 * h2) >= 0.3 * W * H and (w2 * h2) <= 0.985 * W * H:
                ox, oy, bw, bh = x2, y2, w2, h2
                trimmed = {"x": x2, "y": y2, "w": w2, "h": h2, "from": [W, H]}
    if slot:
        ratio = slot[0] / slot[1]
    cw, ch = window_size(bw, bh, ratio)
    fxy = focus or (0.5, 0.4)
    x, y = window_from_focus(bw, bh, cw, ch, *fxy)
    tw, th, capped = plan_size(cw, ch, slot, ratio, max_width)
    cmd = [binary, str(src), "-auto-orient", "-crop", f"{cw}x{ch}+{ox + x}+{oy + y}", "+repage",
           "-filter", "Lanczos", "-resize", f"{tw}x{th}!", "-strip"]
    if out.suffix.lower() in (".jpg", ".jpeg"):
        cmd += ["-background", "white", "-alpha", "remove", "-quality", "86", "-interlace", "Plane"]
    cmd.append(str(out))
    out.parent.mkdir(parents=True, exist_ok=True)
    r3 = run_cmd(cmd)
    if r3.returncode != 0:
        raise RuntimeError(r3.stderr.strip() or "ImageMagick failed")
    return {"tool": "magick", "size": [tw, th], "crop": {"x": ox + x, "y": oy + y, "w": cw, "h": ch},
            "source_size": [W, H], "focus": {"x": round(fxy[0] * 100, 1), "y": round(fxy[1] * 100, 1)},
            "upscale_capped": capped, "trimmed": trimmed,
            "note": "no saliency without Pillow: focus is the given X%,Y% or the default 50%,40%"}


def fit_sips(binary: str, src: Path, out: Path, slot, ratio, focus, max_width) -> dict[str, Any]:
    r = run_cmd([binary, "-g", "pixelWidth", "-g", "pixelHeight", str(src)])
    mw = re.search(r"pixelWidth:\s*(\d+)", r.stdout)
    mh = re.search(r"pixelHeight:\s*(\d+)", r.stdout)
    if not (mw and mh):
        raise RuntimeError("sips could not read the image")
    W, H = int(mw.group(1)), int(mh.group(1))
    if slot:
        ratio = slot[0] / slot[1]
    cw, ch = window_size(W, H, ratio)
    fxy = focus or (0.5, 0.4)
    x, y = window_from_focus(W, H, cw, ch, *fxy)
    tw, th, capped = plan_size(cw, ch, slot, ratio, max_width)
    fmt = {".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png"}.get(out.suffix.lower(), "jpeg")
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.stem + ".nm-tmp" + out.suffix)
    cmds = [
        [binary, "--cropToHeightWidth", str(ch), str(cw), "--cropOffset", str(y), str(x), str(src), "--out", str(tmp)],
        [binary, "-z", str(th), str(tw), "-s", "format", fmt, "-s", "formatOptions", "86", str(tmp), "--out", str(out)],
    ]
    for c in cmds:
        r2 = run_cmd(c)
        if r2.returncode != 0:
            tmp.unlink(missing_ok=True)
            raise RuntimeError(r2.stderr.strip() or "sips failed")
    tmp.unlink(missing_ok=True)
    return {"tool": "sips", "size": [tw, th], "crop": {"x": x, "y": y, "w": cw, "h": ch},
            "source_size": [W, H], "focus": {"x": round(fxy[0] * 100, 1), "y": round(fxy[1] * 100, 1)},
            "upscale_capped": capped, "trimmed": None, "note": "sips: trim unsupported, no saliency"}


def do_fit(src: Path, slot: tuple[int, int] | None, ratio: float | None, focus_text: str,
           max_width: int, fmt: str | None, out: Path | None, trim: bool, tool: str = "auto",
           project: Path | None = None) -> dict[str, Any]:
    """Crop/resize `src`. Never raises for missing tools: falls back to a CSS crop recommendation."""
    if not src.is_file():
        raise FileNotFoundError(str(src))
    focus = parse_focus(focus_text)
    if slot is None and ratio is None:
        raise ValueError("give --slot WxH or --ratio W:H")
    eff_ratio = (slot[0] / slot[1]) if slot else ratio
    assert eff_ratio
    fmt = (fmt or (out.suffix.lstrip(".").lower().replace("jpeg", "jpg") if out and out.suffix else "")
           or ("png" if src.suffix.lower() == ".png" else "jpg"))
    if fmt not in ("jpg", "webp", "png"):
        fmt = "jpg"
    out = out or default_fit_out(src, fmt)
    avail = []
    if have_pillow():
        avail.append("pillow")
    if magick_bin():
        avail.append("magick")
    if sips_bin() and fmt in ("jpg", "png"):
        avail.append("sips")
    order = [tool] if tool in avail else avail
    warnings: list[str] = []
    if tool not in ("auto", "none") and tool not in avail:
        warnings.append(f"requested tool '{tool}' not available; used cascade")
        order = avail
    if tool == "none":
        order = []
    result: dict[str, Any] | None = None
    for t in order:
        try:
            if t == "pillow":
                result = fit_pillow(src, out, slot, eff_ratio, focus, max_width, trim, fmt)
            elif t == "magick":
                result = fit_magick(magick_bin() or "", src, out, slot, eff_ratio, focus, max_width, trim)
            else:
                result = fit_sips(sips_bin() or "", src, out, slot, eff_ratio, focus, max_width)
            break
        except Exception as e:  # noqa: BLE001 - fall through the cascade
            warnings.append(f"{t} failed: {e}")
    if result is None:
        size = file_size_px(src)
        ext = src.suffix.lower() or ".jpg"
        dest = out.with_suffix(ext)
        if dest.resolve() != src.resolve():
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(src, dest)
        out = dest
        fx, fy = focus or (0.5, 0.4)
        pos = f"{round(fx * 100)}% {round(fy * 100)}%"
        aspect = f"{slot[0]} / {slot[1]}" if slot else f"{eff_ratio:.4f}"
        result = {
            "tool": "none", "size": list(size) if size else None, "crop": None,
            "source_size": list(size) if size else None,
            "focus": {"x": round(fx * 100, 1), "y": round(fy * 100, 1)},
            "upscale_capped": False, "trimmed": None,
            "css_fallback": {
                "object_fit": "cover", "object_position": pos, "aspect_ratio": aspect,
                "style": f"width:100%;aspect-ratio:{aspect};object-fit:cover;object-position:{pos}",
                "note": "no image tool available: source copied unchanged; the slide crops with CSS "
                        "(use <figure class=\"nm-img\"> and set --focus-x/--focus-y).",
            },
        }
        warnings.append("no image tool available (Pillow/ImageMagick/sips): copied source, use css_fallback")
    if result.get("upscale_capped"):
        warnings.append("source is too small for the slot: output limited to 1.25x upscale; "
                        "choose a larger image or a smaller slot")
    result["out"] = str(out)
    result["warnings"] = warnings
    result["object_position"] = (f"{result['focus']['x']}% {result['focus']['y']}%")
    if project is None:
        project = find_project(src, None)
    record_derived(project, src, "fit", {
        "out": rel(out, project) if project else str(out), "size": result["size"],
        "focus": result["focus"], "tool": result["tool"], "slot": list(slot) if slot else None,
        "ratio": round(eff_ratio, 4), "fitted_at": now_iso(), "css_fallback": "css_fallback" in result,
    }, out)
    return result


def cmd_fit(a: argparse.Namespace) -> int:
    try:
        slot = parse_slot(a.slot) if a.slot else None
        ratio = parse_ratio(a.ratio) if a.ratio else None
        if not slot and not ratio:
            raise ValueError("give --slot WxH or --ratio 16:9")
        res = do_fit(Path(a.src), slot, ratio, a.focus, a.max_width, a.format,
                     Path(a.out) if a.out else None, a.trim, a.tool,
                     Path(a.project).resolve() if a.project else None)
    except (ValueError, FileNotFoundError) as e:
        say(f"fit: {e}", True)
        return EXIT_USAGE
    for w in res["warnings"]:
        say("warning: " + w, True)
    sz = "x".join(map(str, res["size"])) if res["size"] else "unchanged"
    emit(f"fit -> {res['out']} ({sz}, tool {res['tool']}, focus {res['focus']['x']}%,{res['focus']['y']}%)",
         {"ok": True, **res}, a)
    return EXIT_OK


# --------------------------------------------------------------------------- treat

CSS_FOR_STYLE = {"duotone": "nm-duotone", "mono": "nm-mono", "tint": "nm-tint", "none": ""}


def make_grain(size: tuple[int, int]) -> Any:
    from PIL import Image

    rng = random.Random(7)
    tile = Image.frombytes("L", (256, 256), bytes(rng.getrandbits(8) for _ in range(256 * 256)))
    full = Image.new("L", size)
    for yy in range(0, size[1], 256):
        for xx in range(0, size[0], 256):
            full.paste(tile, (xx, yy))
    return full


def bake_treatment(src: Path, out: Path, style: str, ink, paper, accent, grain: float, contrast: float) -> None:
    from PIL import Image, ImageChops, ImageEnhance, ImageOps

    im = Image.open(src)
    im.load()
    im = ImageOps.exif_transpose(im).convert("RGB")
    if style in ("duotone", "mono"):
        g = ImageOps.autocontrast(ImageOps.grayscale(im), cutoff=1)
        if contrast != 1.0:
            g = ImageEnhance.Contrast(g).enhance(contrast)
        if style == "duotone":
            if accent:
                mid = lerp_rgb(lerp_rgb(ink, paper, 0.5), accent, 0.35)
                im = ImageOps.colorize(g, black=ink, white=paper, mid=mid, midpoint=120)
            else:
                im = ImageOps.colorize(g, black=ink, white=paper)
        else:
            im = ImageOps.colorize(g, black=(0, 0, 0), white=paper)
    elif style == "tint":
        im = ImageEnhance.Color(im).enhance(0.8)
        if contrast != 1.0:
            im = ImageEnhance.Contrast(im).enhance(contrast)
        tint = accent or ink
        layer = Image.new("RGB", im.size, lerp_rgb((255, 255, 255), tint, 0.55))
        im = Image.blend(im, ImageChops.multiply(im, layer), 0.38)
    elif contrast != 1.0:
        im = ImageEnhance.Contrast(im).enhance(contrast)
    if grain > 0:
        noise = Image.blend(Image.new("L", im.size, 128), make_grain(im.size), min(grain, 1.0) * 0.35)
        im = ImageChops.add(im, Image.merge("RGB", (noise, noise, noise)), scale=1, offset=-128)
    fmt = out.suffix.lstrip(".").lower().replace("jpeg", "jpg") or "jpg"
    save_image(im, out, fmt if fmt in ("jpg", "webp", "png") else "jpg")


def do_treat(src: Path, style: str, ink: str, paper: str, accent: str | None, grain: float,
             contrast: float, out: Path | None, in_place: bool, project: Path | None = None) -> dict[str, Any]:
    if not src.is_file():
        raise FileNotFoundError(str(src))
    ink_rgb, paper_rgb = parse_hex(ink), parse_hex(paper)
    acc_rgb = parse_hex(accent) if accent else None
    cls = " ".join(x for x in (CSS_FOR_STYLE[style], "nm-grain" if grain > 0 else "") if x)
    css_vars = {"--nm-ink": hex_of(ink_rgb), "--nm-paper": hex_of(paper_rgb)}
    if acc_rgb:
        css_vars["--nm-accent"] = hex_of(acc_rgb)
    base = {"style": style, "grain": grain, "contrast": contrast, "css_class": cls, "css_vars": css_vars,
            "style_attr": ";".join(f"{k}:{v}" for k, v in css_vars.items())}
    if style == "none" and grain <= 0 and contrast == 1.0:
        return {**base, "baked": False, "out": str(src), "note": "nothing to do"}
    if not have_pillow():
        return {**base, "baked": False, "out": str(src),
                "note": "Pillow unavailable: add the css_class to the <figure class=\"nm-img ...\"> instead "
                        "(live treatment from nm-media.css, same look)."}
    if in_place:
        out = src
    elif out is None:
        out = src.with_name(f"{src.stem}-{style}{src.suffix if src.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp') else '.jpg'}")
    if out.resolve() == src.resolve():
        tmp = out.with_name(out.stem + ".nm-tmp" + out.suffix)
        bake_treatment(src, tmp, style, ink_rgb, paper_rgb, acc_rgb, grain, contrast)
        os.replace(tmp, out)
    else:
        bake_treatment(src, out, style, ink_rgb, paper_rgb, acc_rgb, grain, contrast)
    if project is None:
        project = find_project(src, None)
    record_derived(project, src, "treat", {
        "out": rel(out, project) if project else str(out), "style": style, "ink": hex_of(ink_rgb),
        "paper": hex_of(paper_rgb), "accent": hex_of(acc_rgb) if acc_rgb else None, "grain": grain,
        "contrast": contrast, "treated_at": now_iso()}, out)
    return {**base, "baked": True, "out": str(out), "css_class": "", "note": "baked: do not add the CSS treatment class"}


def cmd_treat(a: argparse.Namespace) -> int:
    try:
        res = do_treat(Path(a.src), a.style, a.ink, a.paper, a.accent, a.grain, a.contrast,
                       Path(a.out) if a.out else None, a.in_place,
                       Path(a.project).resolve() if a.project else None)
    except (ValueError, FileNotFoundError) as e:
        say(f"treat: {e}", True)
        return EXIT_USAGE
    except Exception as e:  # noqa: BLE001
        say(f"treat failed: {e}", True)
        return EXIT_FAIL
    msg = (f"treated -> {res['out']} ({a.style})" if res["baked"]
           else f"not baked ({res['note']}) class: {res['css_class'] or '-'}")
    emit(msg, {"ok": True, **res}, a)
    return EXIT_OK


# --------------------------------------------------------------------------- snippet / auto

AR_CLASSES = [(16 / 9, "nm-ar-16x9"), (4 / 3, "nm-ar-4x3"), (1.0, "nm-ar-1x1"), (3 / 4, "nm-ar-3x4"), (21 / 9, "nm-ar-21x9")]


def ratio_class(ratio: float) -> str | None:
    best = min(AR_CLASSES, key=lambda p: abs(p[0] - ratio) / p[0])
    return best[1] if abs(best[0] - ratio) / best[0] < 0.03 else None


def credit_text(e: dict[str, Any]) -> str:
    if e.get("license") == "generated":
        return ""
    who = e.get("creator") if e.get("creator") not in (None, "", "unknown") else e.get("provider", "")
    return f"{who} · {e['license']}"


def build_snippet(rel_path: str, slot: tuple[int, int] | None, ratio: float, fit: dict[str, Any],
                  treat: dict[str, Any] | None, entry: dict[str, Any] | None, alt: str, caption: bool) -> str:
    classes = ["nm-img"]
    rc = ratio_class(ratio)
    styles = []
    if rc:
        classes.append(rc)
    else:
        styles.append(f"aspect-ratio:{slot[0]} / {slot[1]}" if slot else f"aspect-ratio:{ratio:.4f}")
    if treat and not treat.get("baked") and treat.get("css_class"):
        classes.append(treat["css_class"])
        styles.append(treat["style_attr"])
    if fit.get("css_fallback") or fit.get("tool") == "none":
        styles.append(f"--focus-x:{fit['focus']['x']}%;--focus-y:{fit['focus']['y']}%")
    style_attr = f' style="{";".join(styles)}"' if styles else ""
    dims = f' width="{fit["size"][0]}" height="{fit["size"][1]}"' if fit.get("size") else ""
    lines = [f'<figure class="{" ".join(classes)}"{style_attr}>',
             f'  <img src="{rel_path}" alt="{htmllib.escape(alt, quote=True)}"{dims} loading="eager" decoding="async">']
    if caption and entry:
        ct = credit_text(entry)
        if ct:
            lines.append(f'  <figcaption class="nm-credit">{htmllib.escape(ct)}</figcaption>')
    lines.append("</figure>")
    return "\n".join(lines)


def cmd_auto(a: argparse.Namespace) -> int:
    project = Path(a.project)
    name = slugify(a.name)
    try:
        slot = parse_slot(a.slot)
    except ValueError as e:
        say(str(e), True)
        return EXIT_USAGE
    sa = argparse.Namespace(query=a.query, query_ar=a.query_ar, count=max(a.count, a.pick + 5),
                            orientation=a.orientation or orientation_of(*slot), min_width=a.min_width,
                            license=a.license, providers=a.providers, out=str(project / "assets" / "img" / "candidates.json"),
                            quiet=True)
    rc = cmd_search(sa)
    if rc == EXIT_NET and a.placeholder_on_fail:
        return placeholder_for_auto(a, slot, name)
    if rc != EXIT_OK:
        if rc == EXIT_NET:
            say(f"retry later or run placeholder --slot {a.slot} --name {name} --project {project}", True)
        elif a.placeholder_on_fail:
            return placeholder_for_auto(a, slot, name)
        return rc
    cands = json.loads(Path(sa.out).read_text(encoding="utf-8"))["candidates"]
    entry = None
    last_err = "no candidate downloaded"
    for idx in range(a.pick, min(len(cands), a.pick + 5)):
        c = dict(cands[idx])
        try:
            entry = fetch_one(project, name, c, [c.get("image_url", ""), c.get("thumb_url", "")])
            break
        except NetworkError as e:
            return net_down(str(e), a.slot, name)
        except ProviderError as e:
            last_err = f"candidate {idx}: {e}"
            say(f"warning: {last_err}; trying next", True)
    if entry is None:
        say(f"auto failed: {last_err}", True)
        return placeholder_for_auto(a, slot, name) if a.placeholder_on_fail else EXIT_FAIL
    src = project / entry["file"]
    try:
        fit = do_fit(src, slot, None, "auto", a.max_width, "jpg", project / "assets" / "img" / f"{name}.jpg",
                     True, "auto", project)
        final = Path(fit["out"])
        treat = None
        if a.style != "none" or a.grain > 0:
            treat = do_treat(final, a.style, a.ink, a.paper, a.accent, a.grain, 1.0, None, True, project)
            final = Path(treat["out"])
    except Exception as e:  # noqa: BLE001
        say(f"auto failed while fitting: {e}", True)
        return EXIT_FAIL
    for w in fit["warnings"] + license_warnings(entry):
        say("warning: " + w, True)
    rel_path = rel(final, project)
    ent = next((e for e in load_credits(project)["images"] if e["name"] == name), entry)
    snippet = build_snippet(rel_path, slot, slot[0] / slot[1], fit, treat, ent,
                            a.alt or entry["title"], not a.no_caption)
    emit(f"auto -> {rel_path} ({entry['license']}, {entry['provider']})",
         {"ok": True, "path": rel_path, "entry": ent, "fit": fit, "treat": treat, "snippet": snippet}, a)
    print(snippet)
    return EXIT_OK


def placeholder_for_auto(a: argparse.Namespace, slot: tuple[int, int], name: str) -> int:
    pa = argparse.Namespace(slot=a.slot, name=name, project=a.project, ink=a.ink, paper=a.paper,
                            accent=a.accent or "#c83e37", motif="topo", seed=None, quiet=True)
    say("falling back to an on-palette placeholder plate", True)
    rc = cmd_placeholder(pa)
    if rc == EXIT_OK:
        rel_path = f"assets/img/{name}.svg"
        print(f'<figure class="nm-img"><img src="{rel_path}" alt="" width="{slot[0]}" height="{slot[1]}"></figure>')
        return EXIT_OK
    return rc


# --------------------------------------------------------------------------- credits


def referenced_images(html_path: Path) -> list[str]:
    text = html_path.read_text(encoding="utf-8", errors="replace")
    found = []
    for m in re.finditer(r"assets/img/[^\s\"'()<>?#]+", text):
        p = urllib.parse.unquote(m.group(0))
        if p.endswith("credits.json") or p.endswith("candidates.json"):
            continue
        if p not in found:
            found.append(p)
    return found


def cmd_credits(a: argparse.Namespace) -> int:
    project = Path(a.project)
    data = load_credits(project)
    if a.check:
        html_path = Path(a.check)
        refs = referenced_images(html_path)
        known: dict[str, dict[str, Any]] = {}
        for e in data["images"]:
            for p in entry_paths(e):
                known[p] = e
        missing = [r for r in refs if r not in known]
        unverified = sorted({known[r]["name"] for r in refs if r in known and known[r].get("license") == "unverified"})
        absent = [r for r in refs if not (project / r).is_file()]
        ok = not missing and not (a.strict and unverified)
        res = {"ok": ok, "referenced": refs, "missing_credits": missing, "unverified": unverified,
               "missing_files": absent}
        if missing:
            say("images without a credits entry: " + ", ".join(missing), True)
            say("fix: fetch them with image_fetch.py (it records credits) or add the entry to assets/img/credits.json", True)
        if unverified:
            say("warning: unverified licence for: " + ", ".join(unverified) + " (do not distribute publicly)", True)
        emit(f"credits check: {len(refs)} images, {len(missing)} missing, {len(unverified)} unverified"
             f"{'' if ok else ' - FAIL'}", res, a)
        return EXIT_OK if ok else EXIT_FAIL
    entries = [e for e in data["images"] if e.get("license") != "generated"]
    if a.deck:
        used = set(referenced_images(Path(a.deck)))
        entries = [e for e in entries if entry_paths(e) & used]
    if a.format == "json":
        print(json.dumps({"images": entries}, ensure_ascii=False, indent=2))
        return EXIT_OK
    if a.format == "text":
        print("مصادر الصور")
        for e in entries:
            print(f"- {e['title']} / {e['creator']} / {e['license']} / {e.get('source_page', '')}")
        return EXIT_OK
    esc = lambda s: htmllib.escape(str(s or ""), quote=True)  # noqa: E731
    items = []
    for e in entries:
        lic = esc(e["license"])
        if e.get("license_url"):
            lic = f'<a href="{esc(e["license_url"])}">{lic}</a>'
        src = f' &middot; <a href="{esc(e["source_page"])}">{esc(urllib.parse.urlsplit(e["source_page"]).netloc or "المصدر")}</a>' if e.get("source_page") else ""
        items.append(f'    <li><span class="nm-src-title">{esc(e["title"])}</span> '
                     f'&middot; {esc(e["creator"])} &middot; {lic}{src}</li>')
    print('<section class="nm-sources" dir="rtl" lang="ar">\n  <h2>مصادر الصور</h2>\n  <ul>\n'
          + "\n".join(items) + "\n  </ul>\n</section>")
    return EXIT_OK


# --------------------------------------------------------------------------- placeholder


def _f(v: float) -> str:
    return f"{v:.1f}"


def svg_plate(w: int, h: int, ink: str, paper: str, accent: str, motif: str, seed: int) -> str:
    rng = random.Random(seed)
    parts: list[str] = []
    ln = f'fill="none" stroke="{ink}" stroke-linecap="round" stroke-linejoin="round"'
    if motif == "grid":
        n = 14
        step = w / n
        rows = int(h / step) + 1
        for i in range(n + 1):
            parts.append(f'<line x1="{_f(i * step)}" y1="0" x2="{_f(i * step)}" y2="{h}" stroke="{ink}" stroke-opacity=".12" stroke-width="2"/>')
        for j in range(rows + 1):
            parts.append(f'<line x1="0" y1="{_f(j * step)}" x2="{w}" y2="{_f(j * step)}" stroke="{ink}" stroke-opacity=".12" stroke-width="2"/>')
        for i in range(n + 1):
            for j in range(rows + 1):
                parts.append(f'<circle cx="{_f(i * step)}" cy="{_f(j * step)}" r="{_f(step * 0.04)}" fill="{ink}" fill-opacity=".3"/>')
        cx, cy, r = w * rng.uniform(0.55, 0.75), h * rng.uniform(0.35, 0.55), min(w, h) * 0.26
        parts.append(f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r)}" fill="{accent}" fill-opacity=".92"/>')
        parts.append(f'<circle cx="{_f(cx)}" cy="{_f(cy)}" r="{_f(r * 1.35)}" fill="none" stroke="{ink}" stroke-opacity=".5" stroke-width="3"/>')
    elif motif == "waves":
        n = 16
        phase = rng.uniform(0, 6.28)
        for k in range(n):
            base = h * (0.12 + 0.76 * k / (n - 1))
            amp = h * (0.03 + 0.05 * math.sin(k * 0.5 + phase) ** 2)
            pts = []
            for xi in range(0, w + 24, 24):
                y = base + amp * math.sin(xi / w * 6.28 * 2 + k * 0.35 + phase)
                pts.append(f"{'M' if xi == 0 else 'L'}{_f(xi)} {_f(y)}")
            hot = k == n // 2
            parts.append(f'<path d="{" ".join(pts)}" {ln if not hot else ln.replace(ink, accent)} stroke-width="{6 if hot else 2.5}" stroke-opacity="{1 if hot else .28}"/>')
    elif motif == "topo":
        centres = [(w * rng.uniform(0.3, 0.7), h * rng.uniform(0.3, 0.7), rng.uniform(0, 6.28), rng.uniform(0, 6.28)) for _ in range(2)]
        cx, cy, p1, p2 = centres[0]
        for k in range(1, 15):
            r = min(w, h) * 0.045 * k
            pts = []
            for t in range(0, 121):
                th = t / 120 * 6.2832
                rr = r * (1 + 0.13 * math.sin(3 * th + p1 + k * 0.15) + 0.07 * math.sin(5 * th + p2 - k * 0.1))
                pts.append(f"{'M' if t == 0 else 'L'}{_f(cx + rr * 1.35 * math.cos(th))} {_f(cy + rr * math.sin(th))}")
            hot = k == 6
            parts.append(f'<path d="{" ".join(pts)}Z" {ln if not hot else ln.replace(ink, accent)} stroke-width="{7 if hot else 2.5}" stroke-opacity="{1 if hot else .26}"/>')
        cx2, cy2, p3, p4 = centres[1]
        for k in range(1, 6):
            r = min(w, h) * 0.04 * k
            pts = []
            for t in range(0, 91):
                th = t / 90 * 6.2832
                rr = r * (1 + 0.12 * math.sin(4 * th + p3))
                pts.append(f"{'M' if t == 0 else 'L'}{_f(cx2 + rr * 1.3 * math.cos(th))} {_f(cy2 + rr * math.sin(th))}")
            parts.append(f'<path d="{" ".join(pts)}Z" {ln} stroke-width="2.5" stroke-opacity=".2"/>')
    else:  # rays
        ox, oy = w * 0.78, h * 1.08
        reach = math.hypot(w, h) * 1.2
        n = 42
        for k in range(n):
            ang = math.pi * (1.02 + 0.96 * k / (n - 1))
            x2, y2 = ox + reach * math.cos(ang), oy + reach * math.sin(ang)
            parts.append(f'<line x1="{_f(ox)}" y1="{_f(oy)}" x2="{_f(x2)}" y2="{_f(y2)}" stroke="{ink}" stroke-opacity="{.10 + .12 * (k % 3 == 0):.2f}" stroke-width="{4 if k % 3 == 0 else 2}"/>')
        parts.append(f'<circle cx="{_f(ox)}" cy="{_f(oy - h * 0.12)}" r="{_f(min(w, h) * 0.2)}" fill="{accent}" fill-opacity=".92"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
            f'preserveAspectRatio="xMidYMid slice" aria-hidden="true">\n'
            f'<rect width="{w}" height="{h}" fill="{paper}"/>\n' + "\n".join(parts) + "\n</svg>\n")


def cmd_placeholder(a: argparse.Namespace) -> int:
    try:
        w, h = parse_slot(a.slot)
        ink, paper, accent = hex_of(parse_hex(a.ink)), hex_of(parse_hex(a.paper)), hex_of(parse_hex(a.accent))
    except ValueError as e:
        say(str(e), True)
        return EXIT_USAGE
    name = slugify(a.name)
    project = Path(a.project)
    seed = a.seed if getattr(a, "seed", None) is not None else zlib.crc32(name.encode())
    svg = svg_plate(w, h, ink, paper, accent, a.motif, seed)
    out = img_dir(project) / f"{name}.svg"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(svg, encoding="utf-8")
    entry = {"name": name, "file": rel(out, project), "title": f"placeholder plate ({a.motif})",
             "creator": "nevermind-slides", "license": "generated", "license_key": "generated",
             "license_url": "", "source_page": "", "provider": "placeholder", "fetched_at": now_iso(),
             "mime": "image/svg+xml", "width": w, "height": h, "outputs": [],
             "note": "abstract plate generated locally; replace with a real image when the network is back"}
    upsert_entry(project, entry)
    emit(f"placeholder -> {entry['file']} ({w}x{h}, {a.motif})",
         {"ok": True, "path": entry["file"], "size": [w, h], "motif": a.motif,
          "snippet": f'<figure class="nm-img"><img src="{entry["file"]}" alt="" width="{w}" height="{h}"></figure>'}, a)
    return EXIT_OK


# --------------------------------------------------------------------------- cli


def add_common(p: argparse.ArgumentParser) -> None:
    p.add_argument("--quiet", action="store_true", help="print only the one-line summary (no JSON)")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="image_fetch.py", description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="search Openverse and Wikimedia Commons")
    s.add_argument("--query", required=True)
    s.add_argument("--query-ar", default=None, help="second query in Arabic")
    s.add_argument("--count", type=int, default=12)
    s.add_argument("--orientation", choices=["landscape", "portrait", "square", "any"], default="landscape")
    s.add_argument("--min-width", type=int, default=1600)
    s.add_argument("--license", choices=["commercial", "any-open", "public-domain"], default="commercial")
    s.add_argument("--providers", default="openverse,wikimedia")
    s.add_argument("--out", default="candidates.json")
    add_common(s)
    s.set_defaults(fn=cmd_search)

    f = sub.add_parser("fetch", help="download an image and record credits")
    f.add_argument("--url")
    f.add_argument("--candidate", help="candidates.json#INDEX")
    f.add_argument("--name", required=True)
    f.add_argument("--project", required=True)
    f.add_argument("--license")
    f.add_argument("--creator")
    f.add_argument("--source-page", dest="source_page")
    f.add_argument("--title")
    add_common(f)
    f.set_defaults(fn=cmd_fetch)

    t = sub.add_parser("fit", help="crop to the slot ratio and resize")
    t.add_argument("--src", required=True)
    t.add_argument("--slot")
    t.add_argument("--ratio")
    t.add_argument("--focus", default="auto")
    t.add_argument("--max-width", type=int, default=1920)
    t.add_argument("--format", choices=["jpg", "webp", "png"])
    t.add_argument("--trim", action="store_true", help="trim uniform borders / letterboxing first")
    t.add_argument("--tool", choices=["auto", "pillow", "magick", "sips", "none"], default="auto")
    t.add_argument("--project", help="project dir (default: inferred from the path)")
    t.add_argument("--out")
    add_common(t)
    t.set_defaults(fn=cmd_fit)

    tr = sub.add_parser("treat", help="bake a palette treatment")
    tr.add_argument("--src", required=True)
    tr.add_argument("--style", choices=["duotone", "mono", "tint", "none"], default="duotone")
    tr.add_argument("--ink", default="#1c1b19")
    tr.add_argument("--paper", default="#f8f6f1")
    tr.add_argument("--accent")
    tr.add_argument("--grain", type=float, default=0.0)
    tr.add_argument("--contrast", type=float, default=1.0)
    tr.add_argument("--in-place", action="store_true")
    tr.add_argument("--project")
    tr.add_argument("--out")
    add_common(tr)
    tr.set_defaults(fn=cmd_treat)

    au = sub.add_parser("auto", help="search, fetch, fit and treat in one call")
    au.add_argument("--query", required=True)
    au.add_argument("--query-ar", default=None)
    au.add_argument("--slot", required=True)
    au.add_argument("--name", required=True)
    au.add_argument("--project", required=True)
    au.add_argument("--style", choices=["duotone", "mono", "tint", "none"], default="none")
    au.add_argument("--ink", default="#1c1b19")
    au.add_argument("--paper", default="#f8f6f1")
    au.add_argument("--accent")
    au.add_argument("--grain", type=float, default=0.0)
    au.add_argument("--pick", type=int, default=0)
    au.add_argument("--count", type=int, default=12)
    au.add_argument("--orientation", choices=["landscape", "portrait", "square", "any"], default=None)
    au.add_argument("--min-width", type=int, default=1600)
    au.add_argument("--license", choices=["commercial", "any-open", "public-domain"], default="commercial")
    au.add_argument("--providers", default="openverse,wikimedia")
    au.add_argument("--max-width", type=int, default=1920)
    au.add_argument("--alt")
    au.add_argument("--no-caption", action="store_true")
    au.add_argument("--placeholder-on-fail", action="store_true",
                    help="generate a placeholder plate instead of failing when nothing can be fetched")
    add_common(au)
    au.set_defaults(fn=cmd_auto)

    c = sub.add_parser("credits", help="sources block or credits check")
    c.add_argument("--project", required=True)
    c.add_argument("--format", choices=["html", "json", "text"], default="html")
    c.add_argument("--check", metavar="HTML_PATH")
    c.add_argument("--deck", metavar="HTML_PATH", help="list only images used by this deck")
    c.add_argument("--strict", action="store_true", help="with --check: unverified licences also fail")
    add_common(c)
    c.set_defaults(fn=cmd_credits)

    p = sub.add_parser("placeholder", help="generate an abstract on-palette SVG plate")
    p.add_argument("--slot", required=True)
    p.add_argument("--name", required=True)
    p.add_argument("--project", required=True)
    p.add_argument("--ink", default="#1c1b19")
    p.add_argument("--paper", default="#f8f6f1")
    p.add_argument("--accent", default="#c83e37")
    p.add_argument("--motif", choices=["grid", "waves", "topo", "rays"], default="topo")
    p.add_argument("--seed", type=int, default=None)
    add_common(p)
    p.set_defaults(fn=cmd_placeholder)
    return ap


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.fn(args)
    except KeyboardInterrupt:
        return EXIT_FAIL
    except NetworkError as e:
        return net_down(str(e))


if __name__ == "__main__":
    sys.exit(main())
