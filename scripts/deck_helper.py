#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""CLI helper for the self-contained `research-to-motion-slides` skill.

Works with both `python3 scripts/deck_helper.py ...` and `uv run scripts/deck_helper.py ...`
(zero external packages required).

Subcommands:
  install           One-command global installer for non-technical users and AI agents.
                    Links/copies `research-to-motion-slides` (plus its bundled `anatomy`
                    engine) across Antigravity, OpenCode, Codex,
                    Claude Code, and ~/.agents/skills, and registers the OpenCode slash command.
  uninstall         Cleanly remove installed symlinks/copies of `research-to-motion-slides`
                    and the OpenCode slash command.
  stage-fonts       Copy the catalogue fonts into the project's assets/fonts/ directory: the
                    bundled ones from resources/fonts/, and Thmanyah or ZIAN from the user's
                    own font folders (NM_FONTS_DIR first) because their licenses forbid
                    redistribution. Missing fonts make decks use the open pairing.
  audit-deck        Validate an HTML presentation deck against all strict quality gates
                    (Zero Emojis, @font-face declarations, existing URL-decoded asset/font paths,
                    1920x1080 stage + hidden controls structure, motion graphics presence,
                    and embedded `anatomy` SVG checks).
  cleanup-previews  Remove temporary `.frontend-slides/slide-previews/` files
                    after the user approves the final deck.
  open-files        Open one or more HTML files in the user's default browser across
                    macOS, Windows, and Linux.
  edit              Open a finished deck in Nevermind Studio (`nm-studio edit`), the local
                    visual editor, so the user can adjust text, images, and layout by hand.
                    Uses the bundled build in resources/nm-studio/ when nm-studio is not on PATH.
  notes             List or close the pinned notes the user left for the agent in Nevermind
                    Studio (`nm-studio notes list|done`).
  stage-runtime     Copy the nm-runtime v2 files (nm-deck, nm-focus, nm-diagram, nm-layout,
                    nm-media, nm-table, nm-math) into <target-dir>/assets/nm/. `--inline` also writes a
                    paste-in snippet; `--math` adds the optional TeX converter (Temml).
  plan-init         Write <target-dir>/deck.plan.json from the bundled example (or N stub slides).
  plan-lint         Validate deck.plan.json and apply the motion-director design rules.
  theme-derive      Three palettes from the materials and tools of the topic (contrast-checked),
                    optional previews, `--apply N` writes one into the plan.
  plan-advise       Suggest a representation, acts and Morph for each slide from its described
                    information (`content`), with reasons in Arabic and English (advice.json).
                    `--apply` writes the first suggestion into unlocked slides that fit poorly.
  scaffold          Generate the full deck HTML from a lint-clean plan (also stages fonts and runtime).
  check             Run the headless-Chrome runtime checks (scripts/deck_check.mjs): overflow,
                    contrast, fonts, images, steps, console errors, screenshots and a contact sheet.
"""

from __future__ import annotations

import argparse
import difflib
import html as html_lib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import webbrowser
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parent.parent
FONTS_SOURCE_DIR = SKILL_ROOT / "resources" / "fonts"
BUNDLED_ANATOMY_DIR = SKILL_ROOT / "resources" / "engine" / "anatomy"
LAYOUT_PRESETS_DIR = SKILL_ROOT / "resources" / "layout-presets"  # read by the editor's layout panel
RUNTIME_DIR = SKILL_ROOT / "resources" / "engine" / "nm-runtime"
TEMPLATES_DIR = SKILL_ROOT / "resources" / "templates"
DECK_CHECK_SCRIPT = SKILL_ROOT / "scripts" / "deck_check.mjs"
TEMP_DIR = Path(tempfile.gettempdir())

# Copy filter to exclude git metadata, caches, and OS junk during installation
COPY_IGNORE = shutil.ignore_patterns(
    ".git", "__pycache__", ".DS_Store", "*.pyc", ".pytest_cache", "node_modules"
)

# Comprehensive Unicode emoji pattern (Regional Indicator Flags, Pictographs,
# Emoticons, Transport, Supplemental Symbols, Dingbats, Miscellaneous Symbols)
EMOJI_REGEX = re.compile(
    "["
    "\U0001F1E6-\U0001F1FF"  # Regional Indicator Symbols (flags)
    "\U0001F300-\U0001F5FF"  # Miscellaneous Symbols and Pictographs
    "\U0001F600-\U0001F64F"  # Emoticons
    "\U0001F680-\U0001F6FF"  # Transport and Map Symbols
    "\U0001F700-\U0001F77F"  # Alchemical Symbols
    "\U0001F780-\U0001F7FF"  # Geometric Shapes Extended
    "\U0001F800-\U0001F8FF"  # Supplemental Arrows-C
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    "\U0001FA00-\U0001FA6F"  # Chess Symbols
    "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    "\u2600-\u26FF"          # Miscellaneous Symbols
    "\u2700-\u27BF"          # Dingbats
    "]+"
)


def write_json_output(output_path: Path, payload: dict[str, Any]) -> None:
    resolved = output_path.expanduser().resolve()
    resolved.parent.mkdir(parents=True, exist_ok=True)
    resolved.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _discover_skill_roots() -> list[Path]:
    home = Path.home()
    xdg_config = Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config"))).expanduser()
    codex_home = Path(os.environ.get("CODEX_HOME", str(home / ".codex"))).expanduser()
    claude_home = Path(os.environ.get("CLAUDE_CONFIG_DIR", str(home / ".claude"))).expanduser()

    candidates = [
        home / ".gemini" / "config" / "skills",
        home / ".gemini" / "antigravity" / "skills",
        xdg_config / "opencode" / "skills",
        home / ".opencode" / "skills",
        codex_home / "skills",
        claude_home / "skills",
        home / ".agents" / "skills",
    ]
    seen: set[str] = set()
    unique: list[Path] = []
    for path in candidates:
        key = str(path)
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def _check_runtime_prerequisites() -> dict[str, Any]:
    node_path = shutil.which("node")
    node_version = None
    if node_path:
        try:
            proc = subprocess.run(
                [node_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
                check=False,
            )
            if proc.returncode == 0:
                node_version = proc.stdout.strip()
        except OSError:
            node_version = None
    return {
        "python_version": platform.python_version(),
        "node_available": node_path is not None,
        "node_version": node_version,
    }


def _safe_symlink_or_copy(source: Path, dest: Path, overwrite: bool = True) -> str:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() or dest.is_symlink():
        if not overwrite:
            return "kept_existing"
        if dest.is_symlink() or dest.is_file():
            dest.unlink()
        elif dest.resolve() == source.resolve():
            return "already_canonical"
        else:
            # Back up any pre-existing non-symlink directory once before replacing
            backup_path = dest.with_name(f"{dest.name}.bak")
            if backup_path.exists() or backup_path.is_symlink():
                if backup_path.is_symlink() or backup_path.is_file():
                    backup_path.unlink()
                else:
                    shutil.rmtree(backup_path)
            shutil.move(str(dest), str(backup_path))
    try:
        os.symlink(str(source), str(dest), target_is_directory=True)
        return "symlinked"
    except OSError:
        shutil.copytree(source, dest, ignore=COPY_IGNORE)
        return "copied"


def cmd_install(args: argparse.Namespace) -> int:
    home = Path.home()
    canonical_root = home / ".agents" / "skills" / "nevermind-slides"
    skill_roots = _discover_skill_roots()

    # If running from outside the permanent global skill roots (e.g. /tmp, ~/Downloads, ~/Desktop),
    # copy the clean skill bundle into ~/.agents/skills/nevermind-slides so deleting the
    # downloaded/cloned folder later never breaks any symlinks.
    source_root = SKILL_ROOT.resolve()
    resolved_skill_roots = [r.resolve() for r in skill_roots if r.exists()]
    is_inside_global_root = any(
        source_root.parent == r or r in source_root.parents for r in resolved_skill_roots
    )
    if not is_inside_global_root:
        canonical_root.parent.mkdir(parents=True, exist_ok=True)
        if canonical_root.is_symlink() or canonical_root.is_file():
            canonical_root.unlink()
        elif canonical_root.exists():
            shutil.rmtree(canonical_root)
        shutil.copytree(source_root, canonical_root, ignore=COPY_IGNORE)
        source_root = canonical_root.resolve()

    installed_targets: list[dict[str, str]] = []
    for root in skill_roots:
        target = root / "nevermind-slides"
        status = _safe_symlink_or_copy(source_root, target, overwrite=True)
        installed_targets.append({"target": str(target), "status": status})

        # Also maintain backward-compatible alias `research-to-motion-slides`
        alias_target = root / "research-to-motion-slides"
        _safe_symlink_or_copy(source_root, alias_target, overwrite=True)

        # Ensure the bundled companion skill `anatomy` is also available globally (the frontend-slides bundle was
        # retired in roadmap NM-21: its layouts live in nm-layout.css, its layout presets in resources/layout-presets)
        bundled_anatomy = source_root / "resources" / "engine" / "anatomy"
        if bundled_anatomy.exists():
            _safe_symlink_or_copy(bundled_anatomy, root / "anatomy", overwrite=False)


    # Register OpenCode slash command (/nevermind-slides and alias /research-to-motion-slides)
    xdg_config = Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config"))).expanduser()
    opencode_cmd_dir = xdg_config / "opencode" / "commands"
    opencode_cmd_dir.mkdir(parents=True, exist_ok=True)
    cmd_payload = (
        '---\n'
        'description: "Transforms research papers, technical articles, or complex topics into Arabic story-driven explanations and ambitious, motion-graphic-rich HTML presentations (1920x1080 fixed stage) with upfront style previews, anatomy isometric figures (static/animated), Thmanyah Display + KOMission typography, smooth Morph + Camera Zoom transitions, zero emojis, and live SVG motion graphics."\n'
        'agent: build\n'
        '---\n'
        'Call skill({ name: "nevermind-slides" }) and follow its workflow phases (Phase 1 optional explanation, Phase 2 upfront content analysis + anatomy proposal + 3 browser style previews, Phase 3 full 1920x1080 Arabic motion deck build, Phase 4 automated audit) to handle $ARGUMENTS.\n'
    )
    opencode_cmd_file = opencode_cmd_dir / "nevermind-slides.md"
    opencode_cmd_file.write_text(cmd_payload, encoding="utf-8")
    (opencode_cmd_dir / "research-to-motion-slides.md").write_text(cmd_payload, encoding="utf-8")

    # The runtime, templates and checker live inside the skill folder, so every link or copy above
    # already carries them; report anything that is missing so an incomplete bundle is visible.
    bundle_expected = {
        "nm_runtime": source_root / "resources" / "engine" / "nm-runtime" / "nm-deck.js",
        "templates": source_root / "resources" / "templates" / "deck-skeleton.html",
        "themes": source_root / "resources" / "templates" / "themes.json",
        "deck_check": source_root / "scripts" / "deck_check.mjs",
    }
    bundle = {name: path.exists() for name, path in bundle_expected.items()}

    runtime_info = _check_runtime_prerequisites()
    result = {
        "status": "ok",
        "canonical_skill_dir": str(source_root),
        "bundle": bundle,
        "installed_locations": installed_targets,
        "opencode_command": str(opencode_cmd_file),
        "runtime": runtime_info,
    }
    output_path = Path(args.output).expanduser().resolve()
    write_json_output(output_path, result)
    print(f"Installed `nevermind-slides` across {len(installed_targets)} agent environments. Report: {output_path}")
    incomplete = [name for name, ok in bundle.items() if not ok]
    if incomplete:
        print(f"Note: this copy of the skill is missing: {', '.join(incomplete)}. Runtime and plan commands need them.", file=sys.stderr)
    return 0


def cmd_uninstall(args: argparse.Namespace) -> int:
    home = Path.home()
    skill_roots = _discover_skill_roots()
    removed_targets: list[str] = []

    for root in skill_roots:
        for skill_name in ("nevermind-slides", "research-to-motion-slides"):
            target = root / skill_name
            if target.is_symlink() or target.is_file():
                target.unlink()
                removed_targets.append(str(target))
            elif target.exists() and not args.keep_canonical:
                shutil.rmtree(target)
                removed_targets.append(str(target))

    xdg_config = Path(os.environ.get("XDG_CONFIG_HOME", str(home / ".config"))).expanduser()
    for cmd_name in ("nevermind-slides.md", "research-to-motion-slides.md"):
        opencode_cmd_file = xdg_config / "opencode" / "commands" / cmd_name
        if opencode_cmd_file.exists() or opencode_cmd_file.is_symlink():
            opencode_cmd_file.unlink()
            removed_targets.append(str(opencode_cmd_file))

    output_path = Path(args.output).expanduser().resolve()
    result = {
        "status": "ok",
        "removed_locations": removed_targets,
    }
    write_json_output(output_path, result)
    print(f"Uninstalled `nevermind-slides` from {len(removed_targets)} location(s). Report: {output_path}")
    return 0


# ---------------------------------------------------------------------------
# Fonts: catalogue, sources and pairings
# ---------------------------------------------------------------------------
# Fonts whose license allows redistribution ship in resources/fonts/. Fonts whose license forbids it
# (Thmanyah, ZIAN; see THIRD_PARTY_NOTICES.md) are found on the user's machine instead: NM_FONTS_DIR, then the
# usual per-user and system font folders. A pairing whose fonts are missing falls back to the open pairing.

# (family, file, css format, css weight)
FONT_CATALOGUE: tuple[tuple[str, str, str, str], ...] = (
    ("Thmanyah Display", "thmanyahserifdisplay-Light.otf", "opentype", "300"),
    ("Thmanyah Display", "thmanyahserifdisplay-Regular.otf", "opentype", "400"),
    ("Thmanyah Display", "thmanyahserifdisplay-Medium.otf", "opentype", "500"),
    ("Thmanyah Display", "thmanyahserifdisplay-Bold.otf", "opentype", "700"),
    ("Thmanyah Display", "thmanyahserifdisplay-Black.otf", "opentype", "900"),
    ("KOMission", "KOMission-Black.otf", "opentype", "100 900"),
    ("Thmanyah Sans", "thmanyahsans-Light.otf", "opentype", "300"),
    ("Thmanyah Sans", "thmanyahsans-Regular.otf", "opentype", "400"),
    ("Thmanyah Sans", "thmanyahsans-Medium.otf", "opentype", "500"),
    ("Thmanyah Sans", "thmanyahsans-Bold.otf", "opentype", "700"),
    ("Thmanyah Sans", "thmanyahsans-Black.otf", "opentype", "900"),
    ("Qahwa Arabic", "Qahwa-Arabic-Black.otf", "opentype", "900"),
    ("Setabr Display", "SetabrDisplay-Regular.otf", "opentype", "400 800"),
    ("Alkhalil Kufi", "Alkhalil-Kufi.otf", "opentype", "400 800"),
    ("ZIAN", "ZIAN-VF.ttf", "truetype", "100 900"),
    ("IBM Plex Sans Arabic", "IBMPlexSansArabic-Regular.ttf", "truetype", "400"),
    ("IBM Plex Sans Arabic", "IBMPlexSansArabic-Medium.ttf", "truetype", "500"),
    ("IBM Plex Sans Arabic", "IBMPlexSansArabic-SemiBold.ttf", "truetype", "600 700"),
    ("Zain Rounded", "ZainRounded-VF.ttf", "truetype", "100 900"),
    ("Readex Pro", "ReadexPro-VF.ttf", "truetype", "100 900"),
)
# Families the user must install themselves: name, where to get them.
USER_INSTALLED_FONTS = {
    "Thmanyah Display": "https://font.thmanyah.com",
    "Thmanyah Sans": "https://font.thmanyah.com",
    "ZIAN": "the MUQLA foundry (commercial license)",
}
OPEN_PAIRING = "open"
# pairing: (display stack, body stack, families that must be present)
PAIRING_FONTS: dict[str, tuple[str, str, tuple[str, ...]]] = {
    "thmanyah": ("'Thmanyah Display', 'Readex Pro', sans-serif",
                 "'KOMission', 'Thmanyah Sans', 'IBM Plex Sans Arabic', sans-serif",
                 ("Thmanyah Display", "Thmanyah Sans")),
    "sans": ("'Thmanyah Display', 'Readex Pro', sans-serif",
             "'Thmanyah Sans', 'KOMission', 'IBM Plex Sans Arabic', sans-serif",
             ("Thmanyah Display", "Thmanyah Sans")),
    "qahwa": ("'Qahwa Arabic', 'Readex Pro', sans-serif",
              "'IBM Plex Sans Arabic', 'Zain Rounded', sans-serif",
              ("Qahwa Arabic", "IBM Plex Sans Arabic")),
    "setabr": ("'Setabr Display', 'ZIAN', 'Readex Pro', sans-serif",
               "'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
               ("Setabr Display", "Readex Pro")),
    "kufi": ("'Alkhalil Kufi', 'Readex Pro', sans-serif",
             "'IBM Plex Sans Arabic', sans-serif",
             ("Alkhalil Kufi", "IBM Plex Sans Arabic")),
    OPEN_PAIRING: ("'Readex Pro', 'IBM Plex Sans Arabic', sans-serif",
                   "'IBM Plex Sans Arabic', 'Readex Pro', sans-serif",
                   ("Readex Pro", "IBM Plex Sans Arabic")),
}
FONT_EXTENSIONS = (".otf", ".ttf", ".woff2")


def _user_font_dirs() -> list[Path]:
    # NM_FONTS_BUNDLED_ONLY=1: bundled fonts only (golden tests must not depend on what a machine has installed).
    if os.environ.get("NM_FONTS_BUNDLED_ONLY") == "1":
        return []
    dirs: list[Path] = []
    env = os.environ.get("NM_FONTS_DIR")
    if env:
        dirs.extend(Path(p).expanduser() for p in env.split(os.pathsep) if p)
    home = Path.home()
    dirs += [home / ".fonts", home / ".local" / "share" / "fonts", home / "Library" / "Fonts",
             Path("/Library/Fonts"), Path("/usr/local/share/fonts"), Path("/usr/share/fonts")]
    for var in ("LOCALAPPDATA", "WINDIR"):
        base = os.environ.get(var)
        if base:
            dirs.append(Path(base) / ("Microsoft/Windows/Fonts" if var == "LOCALAPPDATA" else "Fonts"))
    return dirs


def _font_sources() -> dict[str, Path]:
    """Catalogue file name -> where it was found. Bundled fonts win over the user's copies."""
    wanted = {f.lower(): f for _, f, _, _ in FONT_CATALOGUE}
    found: dict[str, Path] = {}
    roots = [FONTS_SOURCE_DIR] + _user_font_dirs()
    for root in roots:
        if not root.is_dir():
            continue
        for dirpath, _dirs, files in os.walk(root):
            for name in files:
                canonical = wanted.get(name.lower())
                if canonical and canonical not in found:
                    found[canonical] = Path(dirpath) / name
        if len(found) == len(wanted):
            break
    return found


def _available_families(files: Any) -> set[str]:
    names = set(files)
    return {family for family, f, _, _ in FONT_CATALOGUE if f in names}


def resolve_pairing(requested: str, families: set[str]) -> str:
    """The requested pairing when its fonts are present, else the open pairing."""
    need = PAIRING_FONTS.get(requested, PAIRING_FONTS["thmanyah"])[2]
    return requested if all(f in families for f in need) else OPEN_PAIRING


def _missing_font_hint(families: set[str]) -> str:
    missing = sorted({f for f in USER_INSTALLED_FONTS if f not in families})
    if not missing:
        return ""
    where = sorted({USER_INSTALLED_FONTS[f] for f in missing})
    return (f"Not bundled (their licenses forbid redistribution): {', '.join(missing)}. "
            f"Get them from {' / '.join(where)}, install them or put the files in NM_FONTS_DIR, then rerun stage-fonts. "
            f"Until then decks use the open pairing (Readex Pro + IBM Plex Sans Arabic).")


def _stage_fonts(target_dir: Path) -> dict[str, Any]:
    dest_fonts_dir = target_dir / "assets" / "fonts"
    dest_fonts_dir.mkdir(parents=True, exist_ok=True)

    sources = _font_sources()
    staged_files: list[str] = []
    for _family, name, _fmt, _weight in FONT_CATALOGUE:
        src = sources.get(name)
        if src is None:
            continue
        dest_file = dest_fonts_dir / name
        if src.resolve() != dest_file.resolve():
            shutil.copy2(src, dest_file)
        staged_files.append(str(dest_file.relative_to(target_dir)))

    families = _available_families(name for name in sources)
    if not staged_files:
        return {
            "status": "error",
            "message": f"No catalogue font files found in {FONTS_SOURCE_DIR} or the user font folders",
            "staged_files": [],
        }

    return {
        "status": "ok",
        "target_dir": str(target_dir),
        "fonts_dir": str(dest_fonts_dir),
        "staged_count": len(staged_files),
        "staged_files": staged_files,
        "families": sorted(families),
        "user_installed": sorted(str(sources[n]) for n in sources if not str(sources[n]).startswith(str(FONTS_SOURCE_DIR))),
        "missing_hint": _missing_font_hint(families),
        "bundled_anatomy_kit": str(BUNDLED_ANATOMY_DIR / "kit" / "iso-kit.mjs"),
    }


def cmd_stage_fonts(args: argparse.Namespace) -> int:
    target_dir = Path(args.target_dir).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    result = _stage_fonts(target_dir)
    write_json_output(output_path, result)
    if result["status"] != "ok":
        print(f"Error: {result['message']}", file=sys.stderr)
        return 1
    print(f"Staged {result['staged_count']} font files to {result['fonts_dir']}. Report written to {output_path}")
    if result.get("user_installed"):
        print("Note: fonts copied from your own font folders are licensed to you; do not publish the deck folder with them.")
    if result.get("missing_hint"):
        print(f"Note: {result['missing_hint']}")
    return 0


# ---------------------------------------------------------------------------
# Runtime v2 vocabulary (single source of truth: references/runtime-contract.md)
# ---------------------------------------------------------------------------

ACTS = ("reveal", "zoom", "highlight", "focus", "detail", "lens", "pins", "slice", "draw")
ISOLATION_ACTS = ("focus", "detail", "lens", "pins", "slice")
# Acts a hand-written deck may use beyond the plan's: gsap comes from the optional adapter nm-gsap.js (NM-17).
RUNTIME_ACTS = ACTS + ("gsap",)
ONCE_PER_SLIDE_ACTS = ("detail", "slice", "lens")
TRANSIENT_ACTS = ("zoom", "highlight", "focus", "detail", "lens", "pins", "slice")
TRANSITIONS = (
    "auto", "fade-through", "push", "zoom-through", "iris", "wipe", "curtain", "depth", "fold", "dissolve", "none",
)
RELS = ("next", "deeper", "back-out", "chapter", "contrast", "time")
ENTRANCES = ("rise", "fade", "clip", "scale", "blur", "draw", "type", "count", "slide")
MODES = ("morph-and-zoom", "morph-only", "classic")
ROLES = ("cover", "section", "concept", "mechanism", "evidence", "comparison", "process", "quote", "summary", "closing")
VISUAL_TYPES = ("anatomy", "image", "diagram", "chart", "motion", "table", "equation", "none")
VISUAL_MODES = ("static", "animated")
PAIRINGS = ("thmanyah", "qahwa", "setabr", "kufi", "sans", "open")
IMAGE_SOURCES = ("generate", "web", "none")
# Types nm-diagram.js renders (LAYOUTS.<name> in nm-diagram.js); the HTML must use these.
BASE_DIAGRAM_TYPES = (
    "flow", "tree", "cycle", "hub", "swimlane", "sequence", "timeline", "layers", "matrix", "funnel",
    "pyramid", "venn", "compare", "bars", "line", "donut", "gauge", "stat", "scatter",
)
# Friendly plan names accepted by plan-lint; scaffold writes the real type.
DIAGRAM_TYPE_ALIASES = {"bar": "bars", "column": "bars", "area": "line", "pie": "donut", "stack": "layers", "network": "flow", "graph": "flow", "kpi": "stat"}
# nm-layout.css compositions (nm-l-<name>) plus the short plan names scaffold maps onto them (LAYOUT_ALIASES).
BASE_LAYOUTS = (
    "title", "section", "split", "hero-figure", "figure-full", "bento-3", "bento-4", "bento-5", "bento-6",
    "cards-2", "cards-3", "cards-4", "rail", "quote", "stat-row", "compare", "steps",
    "cover", "split-rev", "hero", "stat", "cards", "diagram", "timeline", "center", "list",
)
RUNTIME_JS_ORDER = ("nm-deck.js", "nm-focus.js", "nm-diagram.js", "nm-table.js", "nm-math.js")
RUNTIME_CSS_ORDER = ("nm-deck.css", "nm-focus.css", "nm-diagram.css", "nm-media.css", "nm-layout.css", "nm-table.css", "nm-math.css")
# Optional converter for data-tex (decision D3: native MathML is the default). Staged by stage-runtime --math, or by
# scaffold when the plan holds TeX; never loaded from the network.
MATH_VENDOR_FILES = ("temml.min.js", "temml.LICENSE.txt")

FONT_MODE_LABELS = {
    "thmanyah": "ثمانية + كومشن",
    "sans": "ثمانية سانس",
    "qahwa": "قهوة",
    "setabr": "ستابر",
    "kufi": "كوفي",
    "open": "ريدكس + بلكس",
}
FONT_MODE_LABELS_EN = {"thmanyah": "Thmanyah + KOMission", "sans": "Thmanyah Sans", "qahwa": "Qahwa", "setabr": "Setabr", "kufi": "Kufi", "open": "Readex + Plex"}

DIGIT_GROUPS = {
    "western": re.compile(r"[0-9]"),
    "arabic-indic": re.compile(r"[٠-٩]"),
    "persian": re.compile(r"[۰-۹]"),
}

# Emoji plus invisible emoji glue (variation selector-16, zero-width joiner, keycap)
PLAN_EMOJI_REGEX = re.compile(EMOJI_REGEX.pattern[:-2] + "\uFE0F\u20E3]+")


_REPRESENT: Any = None
_IDENTITY: Any = None


def _identity() -> Any:
    """scripts/nm_identity.py (identity derived from the topic, NM-19), loaded next to this file."""
    global _IDENTITY
    if _IDENTITY is None:
        import importlib.util
        spec = importlib.util.spec_from_file_location("nm_identity", Path(__file__).resolve().parent / "nm_identity.py")
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        sys.modules["nm_identity"] = module
        spec.loader.exec_module(module)
        _IDENTITY = module
    return _IDENTITY


def _represent() -> Any:
    """scripts/nm_represent.py (representation intelligence, NM-29), loaded next to this file."""
    global _REPRESENT
    if _REPRESENT is None:
        import importlib.util
        spec = importlib.util.spec_from_file_location("nm_represent", Path(__file__).resolve().parent / "nm_represent.py")
        module = importlib.util.module_from_spec(spec)
        assert spec.loader is not None
        sys.modules["nm_represent"] = module
        spec.loader.exec_module(module)
        _REPRESENT = module
    return _REPRESENT


def _has_content(plan: Any) -> bool:
    return isinstance(plan, dict) and any(isinstance(s, dict) and isinstance(s.get("content"), dict) for s in plan.get("slides") or [])


def _closest(value: str, options: Any) -> str:
    match = difflib.get_close_matches(str(value), [str(o) for o in options], n=1, cutoff=0.5)
    return match[0] if match else ""


def _real_diagram_types() -> tuple[str, ...]:
    """Types nm-diagram.js really renders (read from its LAYOUTS table when present)."""
    found = set(BASE_DIAGRAM_TYPES)
    js = RUNTIME_DIR / "nm-diagram.js"
    if js.is_file():
        try:
            names = re.findall(r"LAYOUTS\.([a-z]+)\s*=", js.read_text(encoding="utf-8"))
            if names:
                found = set(names)
        except OSError:
            pass
    return tuple(sorted(found))


def _diagram_types() -> tuple[str, ...]:
    """Plan vocabulary: real types plus friendly aliases."""
    return tuple(sorted(set(_real_diagram_types()) | set(DIAGRAM_TYPE_ALIASES)))


def _layout_names() -> tuple[str, ...]:
    found = set(BASE_LAYOUTS)
    css = RUNTIME_DIR / "nm-layout.css"
    if css.is_file():
        try:
            for name in re.findall(r"\.nm-l-([a-z][a-z0-9-]*)", css.read_text(encoding="utf-8")):
                found.add(name)
        except OSError:
            pass
    return tuple(sorted(found))


def _load_themes() -> dict[str, Any]:
    path = TEMPLATES_DIR / "themes.json"
    try:
        return json.loads(path.read_text(encoding="utf-8")).get("presets", {})
    except (OSError, ValueError):
        return {}


def _hex_to_rgb(value: str) -> tuple[int, int, int] | None:
    m = re.fullmatch(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})", value.strip())
    if not m:
        return None
    h = m.group(1)
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _luminance(rgb: tuple[int, int, int]) -> float:
    def chan(c: int) -> float:
        v = c / 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4

    r, g, b = rgb
    return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b)


def contrast_ratio(a: str, b: str) -> float:
    ra, rb = _hex_to_rgb(a), _hex_to_rgb(b)
    if ra is None or rb is None:
        return 0.0
    hi, lo = sorted((_luminance(ra), _luminance(rb)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


# ---------------------------------------------------------------------------
# deck.plan.json: loading, linting, motion score
# ---------------------------------------------------------------------------

THEME_TOKENS = ("paper", "ink", "muted", "line", "accent", "accent2", "surface", "radius")


def _plan_words(text: Any) -> int:
    return len(str(text).split())


def _iter_strings(node: Any):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from _iter_strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from _iter_strings(value)


def resolve_theme(theme: Any, plan: Any = None) -> tuple[dict[str, Any], list[str]]:
    """Return (tokens, problems). theme.derive (palette from the topic, NM-19) or a preset first, then explicit
    token overrides."""
    presets = _load_themes()
    problems: list[str] = []
    default_name = "paper" if "paper" in presets else next(iter(presets), "")
    tokens: dict[str, Any] = {}
    theme = theme if isinstance(theme, dict) else {}
    preset = theme.get("preset")
    derived = _identity().pick(plan) if isinstance(theme.get("derive"), dict) and isinstance(plan, dict) else None
    if derived:
        tokens.update({k: v for k, v in derived.items() if k in THEME_TOKENS})
    elif preset:
        if preset in presets:
            tokens.update({k: v for k, v in presets[preset].items() if k in THEME_TOKENS})
        else:
            hint = _closest(preset, presets)
            problems.append(
                f"theme.preset \"{preset}\" is not in themes.json"
                + (f"; did you mean \"{hint}\"?" if hint else f"; valid: {', '.join(presets)}")
            )
    elif default_name:
        tokens.update({k: v for k, v in presets[default_name].items() if k in THEME_TOKENS})
    for key in THEME_TOKENS:
        if key in theme:
            tokens[key] = theme[key]
    if not preset and not derived and theme and not all(k in theme for k in ("paper", "ink", "accent")):
        problems.append("custom theme needs at least paper, ink and accent (or set theme.preset)")
    for key in THEME_TOKENS:
        if key == "radius" or key not in tokens:
            continue
        if not isinstance(tokens[key], str) or _hex_to_rgb(tokens[key]) is None:
            problems.append(f"theme.{key} must be a hex color like #1B1A17")
    return tokens, problems


def _visual_of(slide: dict[str, Any]) -> dict[str, Any]:
    visual = slide.get("visual")
    return visual if isinstance(visual, dict) else {}


def _visual_type(slide: dict[str, Any]) -> str:
    return str(_visual_of(slide).get("type") or "none")


def _slide_transition(slide: dict[str, Any]) -> str:
    return str(slide.get("transition") or "auto")


def _slide_morph(slide: dict[str, Any]) -> list[str]:
    morph = slide.get("morph")
    return [str(m) for m in morph] if isinstance(morph, list) else []


def _slide_steps(slide: dict[str, Any]) -> list[dict[str, Any]]:
    steps = slide.get("steps")
    return [s for s in steps if isinstance(s, dict)] if isinstance(steps, list) else []


def motion_score(slide: dict[str, Any], prev: dict[str, Any] | None) -> int:
    """0..10 rough measure of how much directed motion a slide carries."""
    score = 0
    if prev is not None:
        shared = set(_slide_morph(slide)) & set(_slide_morph(prev))
        if shared:
            score += 2 + (1 if len(shared) > 1 else 0)
        if _slide_transition(slide) != "auto" or str(slide.get("rel") or "next") in ("chapter", "contrast"):
            score += 1
    steps = _slide_steps(slide)
    score += min(len(steps), 3)
    if any(s.get("act") in ISOLATION_ACTS for s in steps):
        score += 2
    vtype = _visual_type(slide)
    if vtype != "none":
        score += 1
    if vtype in ("diagram", "chart", "anatomy", "motion") and (
        _visual_of(slide).get("mode") == "animated" or any(s.get("act") == "draw" for s in steps)
    ):
        score += 1
    return min(score, 10)


# Tables and equations (roadmap NM-10, NM-11)
_TEX_INLINE = re.compile(r"\\\((.+?)\\\)")
_TEX_DELIMS = re.compile(r"^\s*(\$|\\\(|\\\[)")
_UNSAFE_MARKUP = re.compile(r"<\s*(script|iframe|style|object|embed|foreignobject)\b|\son[a-z]+\s*=|javascript:", re.I)
_HIGHLIGHT_TOKEN = re.compile(r"^([rc])(\d+)$", re.I)
TABLE_STEP_MODES = ("row", "col")


def _equation_sources(visual: dict[str, Any]) -> list[dict[str, Any]]:
    """The formulas of an equation visual: `lines` (a derivation) or the visual itself (one formula)."""
    lines = visual.get("lines")
    if isinstance(lines, list):
        return [ln if isinstance(ln, dict) else {} for ln in lines]
    return [visual]


def _visual_strings(slide: dict[str, Any]) -> list[str]:
    """Visible text a table or equation visual puts on the slide (headers, cells, captions, notes; not the formulas)."""
    visual = _visual_of(slide)
    out: list[str] = []
    vtype = visual.get("type")
    if vtype == "table":
        for c in visual.get("columns") or []:
            out.append(str(c))
        for row in visual.get("rows") or []:
            if isinstance(row, list):
                out.extend(str(c) for c in row)
    if vtype == "equation":
        out.extend(str(src.get("note")) for src in _equation_sources(visual) if src.get("note"))
    if vtype in ("table", "equation") and visual.get("caption"):
        out.append(str(visual["caption"]))
    return [_TEX_INLINE.sub(" ", t) for t in out]


def _plan_uses_tex(plan: dict[str, Any]) -> bool:
    """True when the deck needs the TeX converter: equation sources in TeX, or inline \\( ... \\) in any text."""
    for slide in plan.get("slides") or []:
        if not isinstance(slide, dict):
            continue
        visual = _visual_of(slide)
        if visual.get("type") == "equation" and any(isinstance(src.get("tex"), str) and src["tex"].strip() for src in _equation_sources(visual)):
            return True
        if any(_TEX_INLINE.search(t) for t in _iter_strings(slide.get("text"))) or any(_TEX_INLINE.search(t) for t in _visual_strings_raw(slide)):
            return True
    return False


def _visual_strings_raw(slide: dict[str, Any]) -> list[str]:
    visual = _visual_of(slide)
    out: list[str] = []
    if visual.get("type") == "table":
        out += [str(c) for c in visual.get("columns") or []]
        out += [str(c) for row in visual.get("rows") or [] if isinstance(row, list) for c in row]
    if visual.get("type") == "equation":
        out += [str(src.get("note")) for src in _equation_sources(visual) if src.get("note")]
    if visual.get("caption"):
        out.append(str(visual["caption"]))
    return out


def _lint_table(visual: dict[str, Any], where: str, i: int, err: Any, warn: Any) -> None:
    cols, rows = visual.get("columns"), visual.get("rows")
    if not (isinstance(cols, list) and len(cols) >= 2 and all(isinstance(c, (str, int, float)) for c in cols)):
        err("R125", f"{where}: table visual needs `columns`, a list of at least 2 header labels", i + 1)
        return
    if not (isinstance(rows, list) and rows and all(isinstance(r, list) for r in rows)):
        err("R125", f"{where}: table visual needs `rows`, a list of rows (each a list of cells)", i + 1)
        return
    for r, row in enumerate(rows):
        if len(row) != len(cols):
            err("R125", f"{where}: table row {r + 1} has {len(row)} cells but the table has {len(cols)} columns; make them equal", i + 1)
        if not all(isinstance(c, (str, int, float)) for c in row):
            err("R125", f"{where}: table row {r + 1} holds a cell that is not text or a number", i + 1)
    if len(rows) > 8 or len(cols) > 6:
        warn("R126", f"{where}: table is {len(rows)} rows x {len(cols)} columns; above 8 x 6 it cannot stay at 20px or more, split it or move rows to a detail act", i + 1)
    spec = visual.get("highlight")
    if spec is not None:
        heads = 1 if visual.get("row_headers", True) else 0
        for tok in re.split(r"[\s,;]+", str(spec).strip()):
            m = _HIGHLIGHT_TOKEN.match(tok)
            if not m:
                err("R125", f"{where}: table highlight \"{tok}\" is not r<row> or c<column> (1-based, e.g. \"r2 c3\")", i + 1)
            elif m.group(1).lower() == "r" and not 1 <= int(m.group(2)) <= len(rows):
                err("R125", f"{where}: table highlight {tok}: the table has {len(rows)} body rows", i + 1)
            elif m.group(1).lower() == "c" and not 1 <= int(m.group(2)) <= len(cols) - heads:
                err("R125", f"{where}: table highlight {tok}: the table has {len(cols) - heads} data columns", i + 1)


def _lint_equation(visual: dict[str, Any], where: str, i: int, err: Any, warn: Any) -> None:
    lines = visual.get("lines")
    if lines is not None and not (isinstance(lines, list) and lines):
        err("R127", f"{where}: equation `lines` must be a non-empty list of {{\"mathml\" or \"tex\", \"note\"}}", i + 1)
        return
    sources = _equation_sources(visual)
    for k, src in enumerate(sources):
        label = f"equation line {k + 1}" if lines is not None else "equation"
        mathml, tex = src.get("mathml"), src.get("tex")
        has_m = isinstance(mathml, str) and bool(mathml.strip())
        has_t = isinstance(tex, str) and bool(tex.strip())
        if has_m == has_t:
            err("R127", f"{where}: {label} needs exactly one of `mathml` (native, the default) or `tex` (needs the Temml converter)", i + 1)
        elif has_m:
            body = mathml.strip()
            if not re.match(r"^<math[\s>]", body) or not body.endswith("</math>") or body.count("<math") != 1:
                err("R127", f"{where}: {label} `mathml` must be one <math> ... </math> element", i + 1)
            if _UNSAFE_MARKUP.search(body):
                err("R127", f"{where}: {label} `mathml` must not contain scripts, frames, styles or event handlers", i + 1)
        elif _TEX_DELIMS.match(tex):
            err("R128", f"{where}: {label} `tex` starts with a $, \\( or \\[ delimiter; write the formula without delimiters", i + 1)
    if len(sources) > 4:
        warn("R129", f"{where}: derivation has {len(sources)} lines; keep at most 4 on one slide and continue on the next (link terms with data-term)", i + 1)


def _slide_fingerprint(slide: dict[str, Any]) -> tuple[str, str, str, tuple[str, ...]]:
    """What a slide looks like, for R104/R105: composition, visual, how many points, which acts."""
    layout = str(slide.get("layout") or "")
    comp = LAYOUT_ALIASES.get(layout, layout)
    text = slide.get("text") if isinstance(slide.get("text"), dict) else {}
    body = [b for b in text.get("body") or [] if isinstance(b, str)]
    n = len(body)
    bucket = "0" if n == 0 else "1-2" if n <= 2 else "3-5" if n <= 5 else "6+"
    acts = tuple(sorted({str(st.get("act")) for st in _slide_steps(slide)}))
    return comp, _represent().visual_key(slide), bucket, acts


_TITLE_MORPHS = {"title", "headline", "kicker"}


def _intentional_series(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Two slides that share a morph id other than the title carry one element on purpose (a visual, a number)."""
    return bool((set(_slide_morph(a)) & set(_slide_morph(b))) - _TITLE_MORPHS)


def lint_plan(plan: Any) -> dict[str, Any]:
    errors: list[dict[str, Any]] = []
    warnings: list[dict[str, Any]] = []

    def err(code: str, message: str, slide: int | None = None) -> None:
        errors.append({"code": code, "slide": slide, "message": message})

    def warn(code: str, message: str, slide: int | None = None) -> None:
        warnings.append({"code": code, "slide": slide, "message": message})

    def ref(i: int, slide: dict[str, Any]) -> str:
        return f"slide {i + 1} ({slide.get('id', '?')})"

    if not isinstance(plan, dict):
        err("P001", "plan must be a JSON object with `title` and `slides`")
        return {"passed": False, "errors": errors, "warnings": warnings, "slides": []}

    title = plan.get("title")
    if not isinstance(title, str) or not title.strip():
        err("P001", "`title` is missing; add a non-empty deck title")
    slides_raw = plan.get("slides")
    if not isinstance(slides_raw, list) or not slides_raw:
        err("P001", "`slides` is missing or empty; add a list of slide objects")
        return {"passed": False, "errors": errors, "warnings": warnings, "slides": []}

    lang = plan.get("lang", "ar")
    if lang not in LANGS:
        err("P002", f"`lang` must be one of {', '.join(LANGS)}, got \"{lang}\"")
    mode = plan.get("mode", "morph-and-zoom")
    if mode not in MODES:
        err("P002", f"`mode` \"{mode}\" is invalid; use one of: {', '.join(MODES)}")
    image_source = plan.get("image_source", "none")
    if image_source not in IMAGE_SOURCES:
        err("P002", f"`image_source` \"{image_source}\" is invalid; use one of: {', '.join(IMAGE_SOURCES)}")
    fonts = plan.get("fonts")
    pairing = fonts.get("pairing", "thmanyah") if isinstance(fonts, dict) else "thmanyah"
    if pairing not in PAIRINGS:
        hint = _closest(pairing, PAIRINGS)
        err("P002", f"`fonts.pairing` \"{pairing}\" is invalid" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(PAIRINGS)}"))

    tokens, theme_problems = resolve_theme(plan.get("theme"), plan)
    if isinstance((plan.get("theme") or {}).get("derive") if isinstance(plan.get("theme"), dict) else None, dict):
        ident = _identity().derive(plan)
        if ident["source"] == "title":
            warn("R130", "theme.derive found no material word of the topic in the plan; the palette comes from the title alone. Name the topic's materials and tools in theme.derive.materials (for example [\"ميناء\", \"بحر\"])")
    for problem in theme_problems:
        err("P003", problem)
    if tokens.get("paper") and tokens.get("ink") and not theme_problems:
        ink_ratio = contrast_ratio(tokens["ink"], tokens["paper"])
        if ink_ratio < 7:
            warn("R122", f"theme: ink on paper contrast is {ink_ratio:.1f}:1 (need >= 7:1); darken ink or lighten paper")
        if tokens.get("accent"):
            acc_ratio = contrast_ratio(tokens["accent"], tokens["paper"])
            if acc_ratio < 3:
                warn("R122", f"theme: accent on paper contrast is {acc_ratio:.1f}:1 (need >= 3:1); pick a stronger accent")

    slides = [s if isinstance(s, dict) else {} for s in slides_raw]
    n = len(slides)
    if n < 5 or n > 24:
        err("R103", f"deck has {n} slides; keep it between 5 and 24")

    layouts_ok = _layout_names()
    diagram_types_ok = _diagram_types()
    seen_ids: dict[str, int] = {}

    for i, slide in enumerate(slides):
        where = ref(i, slide)
        if not isinstance(slides_raw[i], dict):
            err("P001", f"slide {i + 1} is not an object", i + 1)
            continue
        sid = slide.get("id")
        if not isinstance(sid, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", sid or ""):
            err("P004", f"slide {i + 1}: `id` must be a short ASCII id like \"s{i + 1}\"", i + 1)
        elif sid in seen_ids:
            err("P004", f"{where}: duplicate id (also slide {seen_ids[sid] + 1}); make ids unique", i + 1)
        else:
            seen_ids[sid] = i
        if not isinstance(slide.get("title"), str) or not slide.get("title", "").strip():
            err("P001", f"{where}: `title` is missing; add a short label", i + 1)
        role = slide.get("role")
        if role not in ROLES:
            hint = _closest(role, ROLES) if role else ""
            err("P002", f"{where}: role \"{role}\" is invalid" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(ROLES)}"), i + 1)
        layout = slide.get("layout")
        if layout not in layouts_ok:
            hint = _closest(layout, layouts_ok) if layout else ""
            err("P005", f"{where}: layout \"{layout}\" is unknown" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(layouts_ok)}"), i + 1)
        rel = slide.get("rel", "next")
        if rel not in RELS:
            hint = _closest(rel, RELS)
            err("P002", f"{where}: rel \"{rel}\" is invalid" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(RELS)}"), i + 1)
        transition = _slide_transition(slide)
        if transition not in TRANSITIONS:
            hint = _closest(transition, TRANSITIONS)
            err("P002", f"{where}: transition \"{transition}\" is invalid" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(TRANSITIONS)}"), i + 1)

        # visual
        visual = _visual_of(slide)
        vtype = visual.get("type", "none") if visual else "none"
        if vtype not in VISUAL_TYPES:
            hint = _closest(vtype, VISUAL_TYPES)
            err("P002", f"{where}: visual.type \"{vtype}\" is invalid" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(VISUAL_TYPES)}"), i + 1)
        vmode = visual.get("mode")
        if vmode is not None and vmode not in VISUAL_MODES:
            err("P002", f"{where}: visual.mode \"{vmode}\" is invalid; use static or animated", i + 1)
        if vtype == "anatomy":
            if not visual.get("ref"):
                err("R117", f"{where}: anatomy visual needs `visual.ref` (figure name); add it", i + 1)
            if not vmode:
                err("R117", f"{where}: anatomy visual needs `visual.mode` (static or animated); add it", i + 1)
        if vtype == "image":
            if image_source == "none":
                err("R118", f"{where}: visual.type is image but plan image_source is none; set image_source to generate/web or change the visual", i + 1)
            if not visual.get("ref") and not visual.get("query"):
                warn("R123", f"{where}: image visual has no `ref` or `query`; add a file stem or a search/prompt text", i + 1)
        dtype = visual.get("diagram_type")
        if vtype in ("diagram", "chart"):
            if not dtype:
                warn("R124", f"{where}: {vtype} visual has no `diagram_type`; add one such as flow, cycle or bar", i + 1)
        if dtype and dtype not in diagram_types_ok:
            hint = _closest(dtype, diagram_types_ok)
            err("P002", f"{where}: diagram_type \"{dtype}\" is unknown" + (f"; did you mean \"{hint}\"?" if hint else ""), i + 1)
        if vtype == "table":
            _lint_table(visual, where, i, err, warn)
        if vtype == "equation":
            _lint_equation(visual, where, i, err, warn)

        # morph
        morph = slide.get("morph")
        if morph is not None and (not isinstance(morph, list) or not all(isinstance(m, str) for m in morph)):
            err("P001", f"{where}: `morph` must be a list of id strings", i + 1)

        # steps
        steps_raw = slide.get("steps")
        if steps_raw is not None and not isinstance(steps_raw, list):
            err("P001", f"{where}: `steps` must be a list", i + 1)
        steps = _slide_steps(slide)
        for k, step in enumerate(steps):
            act = step.get("act")
            if act not in ACTS:
                hint = _closest(act, ACTS) if act else ""
                err("P002", f"{where}: step {k + 1} act \"{act}\" is invalid" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(ACTS)}"), i + 1)
        once = [s.get("act") for s in steps if s.get("act") in ONCE_PER_SLIDE_ACTS]
        if len(once) > 1:
            err("R108", f"{where}: {len(once)} detail/slice/lens acts ({', '.join(once)}); keep at most one per slide", i + 1)
        if len(steps) > 6:
            err("R109", f"{where}: {len(steps)} steps; keep at most 6 (split the slide)", i + 1)
        elif len(steps) > 4:
            warn("R110", f"{where}: {len(steps)} steps; more than 4 drags the pace, consider trimming", i + 1)

        # text
        text = slide.get("text")
        if text is not None and not isinstance(text, dict):
            err("P001", f"{where}: `text` must be an object", i + 1)
            text = {}
        text = text or {}
        headline = text.get("headline", "")
        if isinstance(headline, str) and _plan_words(headline) > 9:
            err("R114", f"{where}: headline has {_plan_words(headline)} words; keep it at 9 or fewer", i + 1)
        body = text.get("body", [])
        if body and not isinstance(body, list):
            err("P001", f"{where}: text.body must be a list of short strings", i + 1)
            body = []
        if len(body) > 5:
            err("R115", f"{where}: {len(body)} body items; keep at most 5 (move detail to the speaker note)", i + 1)
        for b, item in enumerate(body):
            if _plan_words(item) > 18:
                warn("R116", f"{where}: body item {b + 1} has {_plan_words(item)} words; keep each at 18 or fewer", i + 1)

    if slides and slides[0].get("role") != "cover":
        err("R101", "slide 1 must have role \"cover\"", 1)
    if slides and slides[-1].get("role") not in ("closing", "summary"):
        err("R102", f"slide {n} must have role \"closing\" or \"summary\"", n)

    # repetition by fingerprint (decision D9): two slides look alike when their composition (after the short
    # names are resolved), visual, number of points and acts are the same, whatever the layout is called. A series
    # carried by a shared element other than the title (Morph of a visual, a figure, a number) is intentional.
    prints = [_slide_fingerprint(sl) for sl in slides]
    run = 1
    for i in range(1, n):
        if slides[i].get("layout") and prints[i] == prints[i - 1] and not _intentional_series(slides[i - 1], slides[i]):
            run += 1
        else:
            run = 1
        what = f"{prints[i][0]} with {prints[i][1]}, {prints[i][2]} points"
        if run == 3:
            err("R104", f"slide {i + 1} ({slides[i].get('id', '?')}): three slides in a row look the same ({what}); change the composition or the visual of one, or carry one element across them with a morph id", i + 1)
        elif run == 2:
            warn("R105", f"slide {i + 1} ({slides[i].get('id', '?')}): looks the same as the previous slide ({what}); vary it if you can", i + 1)

    # continuity and morph pairing
    for i in range(1, n):
        cur, prev = slides[i], slides[i - 1]
        shared = set(_slide_morph(cur)) & set(_slide_morph(prev))
        explicit = _slide_transition(cur) != "auto" or str(cur.get("rel") or "next") in ("chapter", "contrast", "deeper", "back-out", "time")
        if not shared and not explicit:
            err("R106", f"slide {i + 1} ({cur.get('id', '?')}): no link to slide {i}; add a shared morph id (e.g. \"title\") to both, or set a non-auto transition, or a rel other than next", i + 1)
    for i, slide in enumerate(slides):
        for mid in _slide_morph(slide):
            neighbours = []
            if i > 0:
                neighbours.append(_slide_morph(slides[i - 1]))
            if i + 1 < n:
                neighbours.append(_slide_morph(slides[i + 1]))
            if not any(mid in m for m in neighbours):
                err("R107", f"slide {i + 1} ({slide.get('id', '?')}): morph id \"{mid}\" is not in the previous or next slide; add it there or remove it", i + 1)

    all_steps = [(i, s) for i, sl in enumerate(slides) for s in _slide_steps(sl)]
    if n >= 8 and not any(s.get("act") in ISOLATION_ACTS for _, s in all_steps):
        err("R111", "deck has 8+ slides but no isolation act; add one focus, detail, lens, pins or slice step")

    roles = {s.get("role") for s in slides}
    if roles & {"process", "comparison", "evidence"} and not any(_visual_type(s) in ("diagram", "chart") for s in slides):
        err("R112", "deck has process/comparison/evidence slides but no diagram or chart; make one of their visuals a diagram or chart")

    for i in range(1, n):
        if _visual_type(slides[i]) == "none" and _visual_type(slides[i - 1]) == "none":
            err("R113", f"slide {i + 1} ({slides[i].get('id', '?')}): two slides in a row have no visual; give one of them an image, diagram or chart", i + 1)

    counts: dict[str, int] = {}
    for sl in slides:
        t = _slide_transition(sl)
        if t not in ("auto", "none"):
            counts[t] = counts.get(t, 0) + 1
    for t, c in counts.items():
        if c > 3:
            warn("R119", f"transition \"{t}\" is used {c} times; use each non-auto transition at most 3 times")

    for i, slide in enumerate(slides):
        for s in _iter_strings(slide):
            if PLAN_EMOJI_REGEX.search(s):
                err("R120", f"slide {i + 1} ({slide.get('id', '?')}): contains an emoji; remove it (use SVG icons)", i + 1)
                break
    for s in _iter_strings({"title": plan.get("title")}):
        if PLAN_EMOJI_REGEX.search(s):
            err("R120", "deck title contains an emoji; remove it")

    visible = [s for sl in slides for k in ("text",) for s in _iter_strings(sl.get(k))] + [str(plan.get("title") or "")]
    visible = [_TEX_INLINE.sub(" ", s) for s in visible] + [s for sl in slides for s in _visual_strings(sl)]
    used = [name for name, rx in DIGIT_GROUPS.items() if any(rx.search(s) for s in visible)]
    if len(used) > 1:
        warn("R121", f"deck text mixes digit systems ({', '.join(used)}); pick one and use it everywhere")

    # representation advice (NM-29): advisory warnings only, and only when the plan asks for them
    still_slides: set[int] = set()
    if plan.get("advisor") is True:
        nr = _represent()
        for i, slide in enumerate(slides):
            content = slide.get("content")
            if content is not None and not isinstance(content, dict):
                warn("A200", f"slide {i + 1} ({slide.get('id', '?')}): `content` must be an object describing the information", i + 1)
                continue
            kind = (content or {}).get("kind")
            if kind and kind not in nr.KINDS:
                hint = _closest(kind, nr.KINDS)
                warn("A200", f"slide {i + 1} ({slide.get('id', '?')}): content.kind \"{kind}\" is unknown" + (f"; did you mean \"{hint}\"?" if hint else f"; use one of: {', '.join(nr.KINDS)}"), i + 1)
        advice = nr.advise_plan(plan)
        names = nr.rules()["representations"]
        for e in advice["slides"]:
            where = f"slide {e['index']} ({e['slide']})"
            if e["fit"] == "unknown" and slides[e["index"] - 1].get("role") not in ("cover", "closing", "section"):
                warn("A200", f"{where}: {nr.code_text('A200', 'en')}", e["index"])
            if e["fit"] in ("poor", "weak") and not e.get("locked") and e["recommend"]:
                rec = e["recommend"][0]
                code = "A290" if e["fit"] == "poor" else "A291"
                warn(code, f"{where}: {nr.code_text(code, 'en')}: {names.get(e['current'], {}).get('en', e['current'])} -> {names[rec['visual']]['en']} ({rec['why'][0]}: {rec['text_en']}); run plan-advise, or lock the visual", e["index"])
            for c in e.get("checks", []):
                warn(c["code"], f"{where}: {c['en']}", e["index"])
            if e.get("still"):
                still_slides.add(e["index"])
        for r in advice["repetition"]:
            warn(r["code"], f"slides {', '.join(map(str, r['slides']))}: {r['en']}", r["slides"][0])

    slide_reports = []
    for i, slide in enumerate(slides):
        sc = motion_score(slide, slides[i - 1] if i else None)
        slide_reports.append(
            {
                "slide": i + 1,
                "id": slide.get("id"),
                "role": slide.get("role"),
                "layout": slide.get("layout"),
                "visual": _visual_type(slide),
                "transition": _slide_transition(slide),
                "steps": len(_slide_steps(slide)),
                "morph": _slide_morph(slide),
                "motion_score": sc,
            }
        )
    scores = [r["motion_score"] for r in slide_reports]
    return {
        "passed": not errors,
        "errors": errors,
        "warnings": warnings,
        "slides": slide_reports,
        "motion_summary": {
            "average": round(sum(scores) / len(scores), 1) if scores else 0,
            # a slide the advisor marks still (definition, quote, one number) is not flat: stillness is its point
            "flat_slides": [r["slide"] for r in slide_reports if r["motion_score"] <= 2 and r["slide"] not in still_slides],
        },
    }


def _load_plan(path: Path) -> tuple[Any, str | None]:
    try:
        return json.loads(path.read_text(encoding="utf-8")), None
    except OSError as exc:
        return None, f"cannot read plan {path}: {exc}"
    except ValueError as exc:
        return None, f"plan is not valid JSON ({exc}); fix the syntax and rerun"


def _print_lint(report: dict[str, Any]) -> None:
    for item in report["errors"]:
        print(f"  error   {item['code']}  {item['message']}")
    for item in report["warnings"]:
        print(f"  warn    {item['code']}  {item['message']}")


def cmd_plan_lint(args: argparse.Namespace) -> int:
    plan_path = Path(args.plan).expanduser().resolve()
    plan, problem = _load_plan(plan_path)
    if problem:
        print(f"Plan lint FAILED: {problem}", file=sys.stderr)
        return 1
    report = lint_plan(plan)
    report["plan_path"] = str(plan_path)
    if args.output:
        write_json_output(Path(args.output), report)
    status = "PASSED" if report["passed"] else "FAILED"
    summary = report.get("motion_summary", {})
    print(
        f"Plan lint {status} ({len(report['slides'])} slides, {len(report['errors'])} errors, "
        f"{len(report['warnings'])} warnings, motion average {summary.get('average', 0)}/10)"
    )
    _print_lint(report)
    if summary.get("flat_slides"):
        print(f"  note    slides with little motion: {', '.join(str(s) for s in summary['flat_slides'])}")
    if args.output:
        print(f"Report written to {Path(args.output).expanduser().resolve()}")
    return 0 if report["passed"] else 1


def cmd_theme_derive(args: argparse.Namespace) -> int:
    plan_path = Path(args.plan).expanduser().resolve()
    plan, problem = _load_plan(plan_path)
    if problem or not isinstance(plan, dict):
        print(f"theme-derive FAILED: {problem or 'plan must be a JSON object'}", file=sys.stderr)
        return 1
    ni = _identity()
    theme = dict(plan.get("theme") or {}) if isinstance(plan.get("theme"), dict) else {}
    spec = dict(theme.get("derive") or {}) if isinstance(theme.get("derive"), dict) else {}
    if args.materials:
        spec["materials"] = [m.strip() for m in re.split(r"[,،]", args.materials) if m.strip()]
    if args.mood:
        spec["mood"] = args.mood
    work = {**plan, "theme": {**theme, "derive": spec}}
    result = ni.derive(work)
    lang = plan.get("lang", "ar")
    if args.output:
        write_json_output(Path(args.output), result)
    print(ni.table(result, lang))
    if args.previews:
        out = Path(args.previews).expanduser().resolve()
        out.mkdir(parents=True, exist_ok=True)
        slides = [s for s in plan.get("slides") or [] if isinstance(s, dict)]
        sample = [slides[0]] + [s for s in slides[1:] if _visual_type(s) != "none"][:1] if slides else []
        for i, pal in enumerate(result["palettes"]):
            preview = {**plan, "theme": {**pal["tokens"]}, "slides": sample}
            html_text, files, _ = render_deck(preview, out)
            for path, content in files:
                if not path.exists():
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(content, encoding="utf-8")
            (out / f"style-{'abc'[i]}.html").write_text(html_text, encoding="utf-8")
        _stage_fonts(out)
        _stage_runtime(out, math=_plan_features({"slides": sample})["tex"])
        print(f"\nPreviews: {out}/style-a.html, style-b.html, style-c.html (open all three)")
    if args.apply:
        n = args.apply
        if not 1 <= n <= 3:
            print("Error: --apply takes 1, 2 or 3", file=sys.stderr)
            return 1
        pal = result["palettes"][n - 1]
        new_theme = {**pal["tokens"], "derived": {"materials": result["materials"], "mood": result["mood"], "palette": n,
                                                  "names": pal["names"]["ar" if lang == "ar" else "en"]}}
        shutil.copy2(plan_path, plan_path.with_name(plan_path.name + ".bak"))
        write_json_output(plan_path, {**plan, "theme": new_theme})
        print(f"\nPalette {'ABC'[n - 1]} written into the plan's theme as fixed colours (the old plan is kept as .bak).")
    return 0


def cmd_plan_advise(args: argparse.Namespace) -> int:
    plan_path = Path(args.plan).expanduser().resolve()
    plan, problem = _load_plan(plan_path)
    if problem or not isinstance(plan, dict):
        print(f"Plan advise FAILED: {problem or 'plan must be a JSON object'}", file=sys.stderr)
        return 1
    nr = _represent()
    advice = nr.advise_plan(plan)
    out = Path(args.output).expanduser().resolve() if args.output else plan_path.parent / "advice.json"
    out.write_text(nr.advice_json(advice), encoding="utf-8")
    print(nr.table(advice))
    described = sum(1 for e in advice["slides"] if e["fit"] != "unknown")
    print(f"\nAdvice for {described} of {len(advice['slides'])} slides written to {out}")
    if not described:
        print("No slide describes its information yet: add content.kind (and items, quantities, entities...) to the slides; see references/deck-plan.md.")
    if args.apply:
        before = lint_plan(plan)
        new, applied, skipped = nr.apply_advice(plan, advice)
        after = lint_plan(new)
        old_errs = {(e["code"], e["slide"]) for e in before["errors"]}
        broke = sorted({e["slide"] for e in after["errors"] if (e["code"], e["slide"]) not in old_errs and e["slide"]})
        for idx in broke:  # never let advice break the plan: keep the author's visual on that slide
            new["slides"][idx - 1]["visual"] = plan["slides"][idx - 1].get("visual")
            sid = plan["slides"][idx - 1].get("id")
            applied = [a for a in applied if not a.startswith(f"{sid}:")]
            skipped.append(f"{sid}: the suggestion would break plan-lint ({', '.join(e['code'] for e in after['errors'] if e['slide'] == idx)}); kept the current visual")
        if applied:
            shutil.copy2(plan_path, plan_path.with_name(plan_path.name + ".bak"))
            write_json_output(plan_path, new)
        for line in applied:
            print(f"  applied  {line}")
        for line in skipped:
            print(f"  skipped  {line}")
        if not applied:
            print("Nothing to apply: every described slide fits, is locked, or needs data first.")
    return 0


# ---------------------------------------------------------------------------
# plan-init
# ---------------------------------------------------------------------------

_STUB_CYCLE = ("concept", "mechanism", "evidence", "comparison", "process", "concept", "quote")
_STUB_LAYOUT = {
    "cover": "cover", "section": "section", "mechanism": "diagram", "evidence": "stat",
    "comparison": "compare", "process": "timeline", "quote": "quote", "summary": "center", "closing": "center",
}
_STUB_VISUAL = {
    "cover": {"type": "image", "query": "describe the cover image, no text"},
    "mechanism": {"type": "diagram", "diagram_type": "flow", "mode": "animated"},
    "evidence": {"type": "chart", "diagram_type": "bars"},
    "comparison": {"type": "chart", "diagram_type": "bars"},
    "process": {"type": "diagram", "diagram_type": "timeline"},
    "quote": {"type": "none"},
    "closing": {"type": "image", "query": "describe the closing image, no text"},
    "summary": {"type": "image", "query": "describe the closing image, no text"},
}


_STUB_TEXT = {
    "ar": {"kicker": "اكتب العنوان الفرعي", "headline": "اكتب عنوان الشريحة", "opening": "اكتب جملة افتتاحية قصيرة",
           "stat_label": "اكتب وصف الرقم", "stat_source": "اكتب مصدر الرقم", "speaker": "اكتب اسم القائل", "quote": "اكتب الاقتباس هنا",
           "point1": "اكتب نقطة قصيرة", "point2": "اكتب نقطة ثانية", "action": "اكتب خطوة عملية واحدة",
           "cover": "الغلاف", "closing": "الخاتمة", "slide": "اكتب اسم الشريحة"},
    "en": {"kicker": "Write the subtitle", "headline": "Write the slide title", "opening": "Write a short opening sentence",
           "stat_label": "Describe the number", "stat_source": "Write the source of the number", "speaker": "Write who said it", "quote": "Write the quote here",
           "point1": "Write a short point", "point2": "Write a second point", "action": "Write one practical step",
           "cover": "Cover", "closing": "Closing", "slide": "Name the slide"},
}


def make_stub_plan(title: str, count: int, lang: str = "ar") -> dict[str, Any]:
    st = _STUB_TEXT[lang if lang in _STUB_TEXT else "ar"]
    roles = ["cover"]
    for k in range(count - 2):
        roles.append(_STUB_CYCLE[k % len(_STUB_CYCLE)])
    roles.append("closing")
    slides: list[dict[str, Any]] = []
    concept_seen = 0
    for i, role in enumerate(roles):
        layout = _STUB_LAYOUT.get(role)
        visual: dict[str, Any]
        if role == "concept":
            layout = "split" if concept_seen % 2 == 0 else "split-rev"
            concept_seen += 1
            visual = {"type": "anatomy", "ref": f"figure-{i + 1}", "mode": "animated"}
        else:
            visual = dict(_STUB_VISUAL.get(role, {"type": "none"}))
        if visual.get("type") == "image":
            visual.setdefault("ref", f"image-{i + 1}")
        elif visual.get("type") in ("diagram", "chart"):
            visual.setdefault("ref", f"visual-{i + 1}")
        steps: list[dict[str, Any]] = []
        if role == "mechanism":
            steps = [{"act": "draw", "target": "visual"}, {"act": "focus", "target": "visual", "note": "isolate the key part"}]
        elif role == "evidence":
            steps = [{"act": "reveal", "target": "stat"}]
        elif role in ("comparison", "process"):
            steps = [{"act": "reveal", "target": "visual"}]
        # a kicker above every title reads template-made (NM-20, T101): stubs offer one on every third content slide
        text: dict[str, Any] = {"kicker": st["kicker"], "headline": st["headline"]} if i % 3 == 1 else {"headline": st["headline"]}
        if role == "cover":
            text = {"kicker": st["kicker"], "headline": title, "body": [st["opening"]]}
        elif role == "evidence":
            text["stat"] = {"value": "0%", "label": st["stat_label"]}
            text["body"] = [st["stat_source"]]
        elif role == "quote":
            text = {"kicker": st["speaker"], "headline": st["quote"]}
        elif role in ("concept", "closing", "comparison"):
            text["body"] = [st["point1"], st["point2"]] if role != "closing" else [st["action"]]
        slides.append(
            {
                "id": f"s{i + 1}",
                "title": st["cover"] if role == "cover" else (st["closing"] if role == "closing" else st["slide"]),
                "role": role,
                "layout": layout,
                "visual": visual,
                "rel": "next",
                "transition": "auto",
                "morph": ["title"],
                "steps": steps,
                "text": text,
                "speaker_note": "",
            }
        )
    return {
        "title": title,
        "lang": lang if lang in _STUB_TEXT else "ar",
        "theme": {"derive": {"materials": [], "mood": ""}},  # colours from the topic (NM-19); theme-derive shows the three
        "fonts": {"pairing": "thmanyah"},
        "mode": "morph-and-zoom",
        "image_source": "generate",
        "slides": slides,
    }


def cmd_plan_init(args: argparse.Namespace) -> int:
    target = Path(args.target_dir).expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)
    out = target / "deck.plan.json"
    if out.exists() and not args.force:
        print(f"Error: {out} already exists. Use --force to overwrite it.", file=sys.stderr)
        return 1
    example = TEMPLATES_DIR / "deck.plan.example.json"
    if args.slides is None and getattr(args, "lang", "ar") != "ar":
        plan = make_stub_plan(args.title, 8, args.lang)  # the full example is written in Arabic
    elif args.slides is None:
        try:
            plan = json.loads(example.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            plan = make_stub_plan(args.title, 8, getattr(args, "lang", "ar"))
        plan["title"] = args.title
        if plan.get("slides"):
            plan["slides"][0].setdefault("text", {})["headline"] = args.title
    else:
        if not 5 <= args.slides <= 24:
            print("Error: --slides must be between 5 and 24.", file=sys.stderr)
            return 1
        plan = make_stub_plan(args.title, args.slides, getattr(args, "lang", "ar"))
    if getattr(args, "advisor", False):
        plan["advisor"] = True
        plan.setdefault("audience", "general")
        for slide in plan["slides"]:
            if slide.get("role") not in ("cover", "closing"):
                slide.setdefault("content", {"kind": "", "items": 0, "quantities": [], "entities": []})
    write_json_output(out, plan)
    nxt = "plan-advise" if getattr(args, "advisor", False) else "plan-lint"
    print(f"Plan written to {out} ({len(plan['slides'])} slides). Fill it in, then run: {nxt} --plan {out}")
    return 0


# ---------------------------------------------------------------------------
# stage-runtime
# ---------------------------------------------------------------------------


def _runtime_files() -> list[Path]:
    if not RUNTIME_DIR.is_dir():
        return []
    files = [p for p in RUNTIME_DIR.iterdir() if p.is_file() and p.suffix in (".css", ".js")]
    return sorted(files, key=lambda p: p.name)


def _stage_runtime(target_dir: Path, inline: bool = False, math: bool = False) -> dict[str, Any]:
    dest = target_dir / "assets" / "nm"
    files = _runtime_files()
    if not files:
        return {
            "status": "error",
            "message": f"nm-runtime files not found in {RUNTIME_DIR}; the runtime is not bundled in this copy of the skill",
            "staged_files": [],
        }
    dest.mkdir(parents=True, exist_ok=True)
    staged: list[str] = []
    for f in files:
        shutil.copy2(f, dest / f.name)
        staged.append(str((dest / f.name).relative_to(target_dir)))
    if math:
        vendor_src = RUNTIME_DIR / "vendor"
        missing = [n for n in MATH_VENDOR_FILES if not (vendor_src / n).is_file()]
        if missing:
            return {"status": "error", "message": f"--math: {', '.join(missing)} not found in {vendor_src}", "staged_files": staged}
        (dest / "vendor").mkdir(exist_ok=True)
        for name in MATH_VENDOR_FILES:
            shutil.copy2(vendor_src / name, dest / "vendor" / name)
            staged.append(str((dest / "vendor" / name).relative_to(target_dir)))
    result: dict[str, Any] = {
        "status": "ok",
        "target_dir": str(target_dir),
        "runtime_dir": str(dest),
        "staged_count": len(staged),
        "staged_files": staged,
    }
    if inline:
        ordered_css = [f for name in RUNTIME_CSS_ORDER for f in files if f.name == name]
        ordered_js = [f for name in RUNTIME_JS_ORDER for f in files if f.name == name]
        parts = [f"<style>\n{f.read_text(encoding='utf-8')}\n</style>" for f in ordered_css]
        if math:
            parts.append(f"<script>\n{(dest / 'vendor' / 'temml.min.js').read_text(encoding='utf-8')}\n</script>")
        parts += [f"<script>\n{f.read_text(encoding='utf-8')}\n</script>" for f in ordered_js]
        snippet = dest / "nm-inline.html"
        snippet.write_text("\n".join(parts) + "\n", encoding="utf-8")
        result["inline_snippet"] = str(snippet)
    return result


def cmd_stage_runtime(args: argparse.Namespace) -> int:
    target_dir = Path(args.target_dir).expanduser().resolve()
    result = _stage_runtime(target_dir, inline=args.inline, math=getattr(args, "math", False))
    if args.output:
        write_json_output(Path(args.output), result)
    if result["status"] != "ok":
        print(f"Error: {result['message']}", file=sys.stderr)
        return 1
    extra = f" Inline snippet: {result['inline_snippet']}" if "inline_snippet" in result else ""
    print(f"Staged {result['staged_count']} runtime file(s) to {result['runtime_dir']}.{extra}")
    return 0


# ---------------------------------------------------------------------------
# scaffold
# ---------------------------------------------------------------------------

_PH_GLYPH = (
    '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="9" width="36" height="30" rx="4"/>'
    '<circle cx="17" cy="20" r="4"/><path d="M8 35l11-10 8 7 6-5 9 8"/></svg>'
)


def _esc(text: Any) -> str:
    return html_lib.escape(str(text), quote=True)


# A Latin-led run with digits or neutral punctuation ("GPT-4 (2023)", "v2.1", "CO2/kWh") inside Arabic text: the
# bidi algorithm can move its punctuation and digits. <bdi> keeps it in one piece (check code C-BIDI).
_LATIN_RUN = re.compile(r"[(\[]?[A-Za-z][A-Za-z0-9]*(?:(?:\s?[-+/.:%]\s?|\s)?[(\[]?[A-Za-z0-9]+[)\]%]?)*[)\]]?")
_RISKY = re.compile(r"[0-9\-+/.:%()\[\]]")
_ARABIC_LETTER = re.compile(r"[\u0621-\u064A]")


def _text_plain(raw: str, arabic: bool) -> str:
    out = _esc(raw)
    if _SCAFFOLD["lang"] != "ar" or not arabic:
        return out
    return _LATIN_RUN.sub(lambda m: f"<bdi>{m.group(0)}</bdi>" if _RISKY.search(m.group(0)) else m.group(0), out)


def _text(text: Any) -> str:
    """Escaped element text; in Arabic decks, risky Latin or numeric runs are isolated with <bdi>.
    Inline TeX written as \\( ... \\) becomes an nm-math host (rendered by nm-math.js with Temml)."""
    raw = str(text)
    arabic = bool(_ARABIC_LETTER.search(raw))
    if "\\(" not in raw:
        return _text_plain(raw, arabic)
    parts, last = [], 0
    for m in _TEX_INLINE.finditer(raw):
        parts.append(_text_plain(raw[last:m.start()], arabic))
        parts.append(f'<span class="nm-math" data-tex="{_esc(m.group(1).strip())}"></span>')
        last = m.end()
    parts.append(_text_plain(raw[last:], arabic))
    return "".join(parts)


def _slug(title: str) -> str:
    ascii_part = re.sub(r"[^a-z0-9]+", "-", title.lower().encode("ascii", "ignore").decode()).strip("-")
    return ascii_part or "deck"


def _cmt(text: Any) -> str:
    """Make text safe inside an HTML comment."""
    return str(text).replace("--", "- -")


def _attrs(d: dict[str, str]) -> str:
    return "".join(f' {k}="{_esc(v)}"' if v != "" else f" {k}" for k, v in d.items())


def _placeholder_svg(label: str) -> str:
    safe = _esc(label)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">'
        f"<title>{safe}</title>"
        '<rect width="1600" height="900" fill="#E7E2D6"/>'
        '<path d="M0 640l320-240 260 200 300-280 360 300 360-220v500H0z" fill="#CFC8B8"/>'
        '<circle cx="1180" cy="230" r="90" fill="#D9D2C2"/></svg>\n'
    )


GRAPH_DIAGRAM_TYPES = ("flow", "tree", "cycle", "hub", "swimlane", "sequence")
PROGRESSIVE_MODES = ("rank", "node", "edge", "series")
_ORDINALS = ("الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس")
_AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"
LANGS = ("ar", "en")
_DIR = {"ar": "rtl", "en": "ltr"}

# Scaffold context, set by render_deck for the plan being built: language and digit system of the deck.
_SCAFFOLD: dict[str, Any] = {"lang": "ar", "arabic_digits": True}
_TO_WESTERN = str.maketrans({**{a: str(i) for i, a in enumerate(_AR_DIGITS)}, "٪": "%", "٫": ".", "٬": ","})

# Placeholder text the scaffold writes, per language (the author replaces all of it).
_STRINGS: dict[str, dict[str, Any]] = {
    "ar": {
        "item": lambda k: f"العنصر {_ORDINALS[k]}" if k < len(_ORDINALS) else f"عنصر {k + 1}",
        "idea": "الفكرة", "team1": "الفريق الأول", "team2": "الفريق الثاني",
        "seq": ["actors: a[الطرف الأول], b[الطرف الثاني]", "a -> b: الطلب", "b -.-> a: الرد"],
        "detail": ("اكتب سطرا تمهيديا", "اكتب عنوان التفصيل", "جملة أو جملتان تشرحان العنصر."),
        "pin": ("اكتب اسم الجزء", "سطر قصير يشرح الجزء"),
        "card": "اكتب نص البطاقة", "side1": "الجانب الأول", "side2": "الجانب الثاني",
    },
    "en": {
        "item": lambda k: f"Item {k + 1}",
        "idea": "The idea", "team1": "Team one", "team2": "Team two",
        "seq": ["actors: a[First party], b[Second party]", "a -> b: Request", "b -.-> a: Reply"],
        "detail": ("Write an opening line", "Write the detail title", "One or two sentences that explain the element."),
        "pin": ("Name the part", "A short line that explains the part"),
        "card": "Write the card text", "side1": "First side", "side2": "Second side",
    },
}
_STARTER_DATA: dict[str, dict[str, tuple[list[str], int]]] = {
    "ar": {
        "timeline": (["٢٠٢٤: البداية | اكتب ما حدث", "٢٠٢٥: التوسع | اكتب ما حدث !", "٢٠٢٦: الهدف"], 3),
        "layers": (["الطبقة العليا: عنصر، عنصر", "الطبقة الوسطى: عنصر، عنصر !", "الأساس: عنصر"], 3),
        "matrix": (["x: الجهد | منخفض | مرتفع", "y: الأثر | منخفض | مرتفع", "عنصر أول: 0.25, 0.8 !", "عنصر ثان: 0.7, 0.35"], 2),
        "funnel": (["المرحلة الأولى: ١٠٠", "المرحلة الثانية: ٤٠", "المرحلة الثالثة: ١٢ !"], 3),
        "pyramid": (["القمة: اكتب الوصف", "الوسط: اكتب الوصف", "الأساس: اكتب الوصف !"], 3),
        "venn": (["أ: المجال الأول", "ب: المجال الثاني", "أ&ب: التقاطع !"], 3),
        "compare": (["head: الخيار الأول | الخيار الثاني !", "المعيار الأول: قيمة | قيمة", "المعيار الثاني: قيمة | قيمة"], 3),
        "bars": (["unit: ٪", "العنصر الأول: ٣٠", "العنصر الثاني: ٥٥ !", "العنصر الثالث: ٤٢", "العنصر الرابع: ٧٠"], 4),
        "line": (["x: ٢٠٢٣, ٢٠٢٤, ٢٠٢٥, ٢٠٢٦", "series السلسلة الأولى: ١٢, ١٨, ٢٥, ٣١", "series السلسلة الثانية: ٢٠, ٢٢, ٢٣, ٢٦"], 2),
        "donut": (["center: ٦٢٪ | اكتب الوصف", "الجزء الأول: ٦٢ !", "الجزء الثاني: ٢١", "الجزء الثالث: ١٧"], 3),
        "gauge": (["value: ٧٠", "max: 100", "unit: ٪", "label: اكتب وصف المؤشر", "sub: الهدف ٩٠٪"], 1),
        "stat": (["اكتب وصف الرقم: ٧٠٪ | اكتب السياق !", "اكتب وصف الرقم الثاني: ١٢"], 2),
        "scatter": (["x: المحور الأفقي | الوحدة", "y: المحور الرأسي | الوحدة", "النقطة الأولى: ١٠, ٢٠", "النقطة الثانية: ٢٥, ٣٥ !", "النقطة الثالثة: ٤٠, ٣٠"], 3),
    },
    "en": {
        "timeline": (["2024: Start | Write what happened", "2025: Growth | Write what happened !", "2026: Goal"], 3),
        "layers": (["Top layer: part, part", "Middle layer: part, part !", "Base: part"], 3),
        "matrix": (["x: Effort | low | high", "y: Impact | low | high", "First item: 0.25, 0.8 !", "Second item: 0.7, 0.35"], 2),
        "funnel": (["First stage: 100", "Second stage: 40", "Third stage: 12 !"], 3),
        "pyramid": (["Top: write the description", "Middle: write the description", "Base: write the description !"], 3),
        "venn": (["A: First field", "B: Second field", "A&B: Overlap !"], 3),
        "compare": (["head: Option one | Option two !", "First criterion: value | value", "Second criterion: value | value"], 3),
        "bars": (["unit: %", "First item: 30", "Second item: 55 !", "Third item: 42", "Fourth item: 70"], 4),
        "line": (["x: 2023, 2024, 2025, 2026", "series First series: 12, 18, 25, 31", "series Second series: 20, 22, 23, 26"], 2),
        "donut": (["center: 62% | Write the description", "First part: 62 !", "Second part: 21", "Third part: 17"], 3),
        "gauge": (["value: 70", "max: 100", "unit: %", "label: Describe the indicator", "sub: Target 90%"], 1),
        "stat": (["Describe the number: 70% | Write the context !", "Describe the second number: 12"], 2),
        "scatter": (["x: Horizontal axis | unit", "y: Vertical axis | unit", "First point: 10, 20", "Second point: 25, 35 !", "Third point: 40, 30"], 3),
    },
}


def _plan_uses_arabic_digits(plan: dict[str, Any]) -> bool:
    """English decks use Western digits. Arabic decks use Arabic-Indic digits unless the plan writes only Western ones."""
    if plan.get("lang", "ar") != "ar":
        return False
    # formulas are not text: digits inside MathML or TeX do not decide the deck's digit system
    def no_formulas(slide: Any) -> Any:
        if isinstance(slide, dict) and isinstance(slide.get("content"), dict):
            # numbers in content.quantities are data (JSON numbers are always written 0-9); the deck formats them
            content = slide["content"]
            qs = [{k: v for k, v in q.items() if k != "value"} if isinstance(q, dict) else q for q in content.get("quantities") or []]
            slide = {**slide, "content": {k: v for k, v in content.items() if k not in ("quantities", "items", "dimensions", "formula")} | {"quantities": qs}}
        if not isinstance(slide, dict) or _visual_of(slide).get("type") != "equation":
            return slide
        visual = {k: v for k, v in _visual_of(slide).items() if k not in ("mathml", "tex", "lines")}
        visual["notes"] = [src.get("note") for src in _equation_sources(_visual_of(slide)) if src.get("note")]
        return {**slide, "visual": visual}
    slides = json.dumps([no_formulas(sl) for sl in plan.get("slides", [])], ensure_ascii=False)
    slides = _TEX_INLINE.sub(" ", slides.replace("\\\\", "\\"))
    return not DIGIT_GROUPS["western"].search(slides) or bool(DIGIT_GROUPS["arabic-indic"].search(slides))


def _set_scaffold_context(plan: dict[str, Any]) -> None:
    _SCAFFOLD["lang"] = plan.get("lang", "ar") if plan.get("lang", "ar") in LANGS else "ar"
    _SCAFFOLD["arabic_digits"] = _plan_uses_arabic_digits(plan)


def _t(key: str) -> Any:
    return _STRINGS[_SCAFFOLD["lang"]][key]


def _num(text: str) -> str:
    """Starter text in the deck's digit system (one system per deck, plan-lint R121)."""
    return text if _SCAFFOLD["arabic_digits"] else text.translate(_TO_WESTERN)


def _real_diagram_type(slide: dict[str, Any]) -> tuple[str, dict[str, str]]:
    """Plan diagram_type (real or alias) -> (nm-diagram data-type, extra figure attributes)."""
    visual = _visual_of(slide)
    raw = str(visual.get("diagram_type") or ("bars" if visual.get("type") == "chart" else "flow"))
    real = DIAGRAM_TYPE_ALIASES.get(raw, raw)
    extra = {"data-area": "on"} if raw == "area" else {}
    return real, extra


def _diagram_kind(slide: dict[str, Any]) -> str | None:
    """'graph' for node/edge diagrams, 'data' for charts and lists, None when the slide has no diagram."""
    if _visual_type(slide) not in ("diagram", "chart"):
        return None
    return "graph" if _real_diagram_type(slide)[0] in GRAPH_DIAGRAM_TYPES else "data"


def _plan_steps(slide: dict[str, Any]) -> dict[str, Any]:
    """Number the plan steps and decide where each one lands in the HTML.

    Returns {"elements": {key: (number, step)}, "diagram": {mode, start} | None,
             "node_steps": [(id, number, act)], "todos": [...], "node_ids": [...]}.
    A diagram builds its own steps (data-steps / data-step-from): `visual` with reveal or draw becomes one
    step ("all") or a block of steps when the target is written visual:rank or visual:series.
    """
    kind = _diagram_kind(slide)
    vtype = _visual_type(slide)
    visual = _visual_of(slide)
    out: dict[str, Any] = {"elements": {}, "diagram": None, "node_steps": [], "todos": [], "node_ids": [], "table": None, "lines": None}
    counter = 1
    for step in _slide_steps(slide):
        act = str(step.get("act") or "reveal")
        target = str(step.get("target") or "visual").strip()
        hint = None
        if target.startswith("visual:"):
            target, hint = "visual", target.split(":", 1)[1]
        key = "headline" if target == "title" else target
        if key.startswith("node:") and kind == "graph" and key.split(":", 1)[1]:
            nid = key.split(":", 1)[1]
            out["node_steps"].append((nid, counter, act))
            if nid not in out["node_ids"]:
                out["node_ids"].append(nid)
            counter += 1
            continue
        if key == "visual" and vtype == "table" and hint in TABLE_STEP_MODES and out["table"] is None and "visual" not in out["elements"]:
            if act not in ("reveal", "highlight"):
                out["todos"].append(f"visual:{hint} steps on a table take reveal or highlight, not {act}; used reveal")
                act = "reveal"
            rows = [r for r in visual.get("rows") or [] if isinstance(r, list)]
            heads = 1 if visual.get("row_headers", True) else 0
            n = len(rows) if hint == "row" else max(1, len(visual.get("columns") or []) - heads)
            out["table"] = {"mode": hint, "start": counter, "act": act}
            counter += max(1, n)
            continue
        if key == "visual" and vtype == "equation" and hint == "line" and isinstance(visual.get("lines"), list) and out["lines"] is None and "visual" not in out["elements"]:
            if act != "reveal":
                out["todos"].append(f"visual:line steps reveal the lines of a derivation, not {act}; used reveal")
            # the first line stays on screen (it is what the previous slide ended on, and its data-term parts can
            # fly in with Morph); the next lines reveal one per step
            out["lines"] = {"start": counter}
            counter += max(1, len(visual["lines"]) - 1)
            continue
        if hint and key == "visual" and vtype in ("table", "equation"):
            out["todos"].append(f"visual:{hint} does not fit a {vtype} (table: visual:row or visual:col; derivation: visual:line); used a single step")
        if key == "visual" and kind and act in ("reveal", "draw") and out["diagram"] is None and "visual" not in out["elements"]:
            mode = hint if hint in PROGRESSIVE_MODES else "all"
            if hint and hint not in PROGRESSIVE_MODES:
                out["todos"].append(f"visual:{hint} is not a diagram step mode; used a single step (modes: {', '.join(PROGRESSIVE_MODES)})")
            if mode == "series" and kind == "graph" or mode in ("rank", "node", "edge") and kind == "data":
                out["todos"].append(f"step mode {mode} does not fit this diagram type; used a single step")
                mode = "all"
            out["diagram"] = {"mode": mode, "start": counter, "number": counter}
            counter += _starter_step_count(slide, mode, out["node_ids"])
            continue
        if key in out["elements"]:
            out["todos"].append(f"step {counter} ({act}) targets \"{target}\" again; split it onto another element by hand")
            continue
        out["elements"][key] = (counter, step)
        counter += 1
    return out


def _starter_nodes(slide: dict[str, Any], node_ids: list[str]) -> list[str]:
    ids = list(node_ids)
    k = 1
    content = slide.get("content") if isinstance(slide.get("content"), dict) else {}
    items = content.get("items")
    # as many starter nodes as the information has elements (content.items, NM-29), 3 when the plan does not say
    want = max(3, min(6, items)) if isinstance(items, int) and not isinstance(items, bool) and items > 0 else 3
    while len(ids) < want:
        cand = f"n{k}"
        k += 1
        if cand not in ids:
            ids.append(cand)
    return ids


_DSL_KEYS = re.compile(r"[:|!\n]")


def _quantity_dsl(slide: dict[str, Any]) -> tuple[list[str], dict[str, int]] | None:
    """Chart DSL drawn from the plan's own numbers (content.quantities, NM-29) instead of starter data, or None."""
    content = slide.get("content") if isinstance(slide.get("content"), dict) else {}
    qs = [q for q in content.get("quantities") or [] if isinstance(q, dict) and q.get("value") is not None]
    dtype, _ = _real_diagram_type(slide)
    if not qs or _visual_type(slide) != "chart" or dtype not in ("bars", "donut", "line", "stat", "gauge", "funnel"):
        return None
    clean = lambda t: _DSL_KEYS.sub(" ", str(t)).strip()
    to_ar = str.maketrans("0123456789.", "٠١٢٣٤٥٦٧٨٩٫")
    val = lambda v: str(v).translate(to_ar) if _SCAFFOLD["arabic_digits"] else _num(str(v))  # the deck's digit system
    units = sorted({str(q.get("unit") or "").strip() for q in qs} - {""})
    unit = units[0] if len(units) == 1 else ""
    nums = [float(nr_v) if (nr_v := _represent()._num(q.get("value"))) is not None else 0.0 for q in qs]
    top = nums.index(max(nums))
    if dtype == "line":
        title = clean(slide.get("title") or "series")
        return [f"x: {', '.join(clean(q.get('label')) for q in qs)}", f"series {title}: {', '.join(val(q.get('value')) for q in qs)}"], {"series": 1}
    if dtype == "gauge":
        q = qs[0]
        return [f"value: {val(q.get('value'))}", f"max: {val(100) if unit in ('%', '٪') else val(max(nums) or 1)}"] + ([f"unit: {unit}"] if unit else []) + [f"label: {clean(q.get('label'))}"], {"series": 1}
    if dtype == "stat":
        return [f"{clean(q.get('label'))}: {val(q.get('value'))}{_num(str(q.get('unit') or ''))}" + (" !" if i == top else "") for i, q in enumerate(qs)], {"series": len(qs)}
    lines = [f"unit: {unit}"] if unit and dtype == "bars" else []
    lines += [f"{clean(q.get('label'))}: {val(q.get('value'))}" + (" !" if i == top else "") for i, q in enumerate(qs)]
    return lines, {"series": len(qs)}


def _starter_dsl(slide: dict[str, Any], node_ids: list[str]) -> tuple[list[str], dict[str, int]]:
    """Starter DSL lines that nm-diagram.js renders as is, plus how many steps each step mode makes."""
    from_plan = _quantity_dsl(slide)
    if from_plan:
        return from_plan
    dtype, _ = _real_diagram_type(slide)
    ids = _starter_nodes(slide, node_ids)
    n = len(ids)
    names = {i: _t("item")(k) for k, i in enumerate(ids)}
    title = str(slide.get("title") or _t("idea"))
    if dtype == "flow":
        lines = [" -> ".join(f"{i}[{names[i]}]" for i in ids), f"{ids[min(1, n - 1)]}.accent"]
        return lines, {"rank": n, "node": n, "edge": n - 1}
    if dtype == "tree":
        lines = [f"{ids[0]}[{names[ids[0]]}]"] + [f"  {i}[{names[i]}]" for i in ids[1:]]
        return lines, {"rank": 2, "node": n, "edge": n - 1}
    if dtype == "cycle":
        lines = [f"center: {title}"] + [f"{i}[{names[i]}]" for i in ids] + [f"{ids[0]}.accent"]
        return lines, {"rank": n, "node": n, "edge": n}
    if dtype == "hub":
        lines = [f"core(({title})).accent"] + [f"core -- {i}[{names[i]}]" for i in ids]
        return lines, {"rank": 2, "node": n + 1, "edge": n}
    if dtype == "swimlane":
        lines = [f"lane {_t('team1')}: {ids[0]}", f"lane {_t('team2')}: {' '.join(ids[1:])}",
                 " -> ".join(f"{i}[{names[i]}]" for i in ids)]
        return lines, {"rank": n, "node": n, "edge": n - 1}
    if dtype == "sequence":
        lines = list(_t("seq"))
        return lines, {"rank": 2, "node": 2, "edge": 2}
    data = _STARTER_DATA[_SCAFFOLD["lang"]]
    lines, series = data.get(dtype, data["bars"])
    return [_num(line) for line in lines], {"series": series}


def _starter_step_count(slide: dict[str, Any], mode: str, node_ids: list[str]) -> int:
    if mode == "all":
        return 1
    _, counts = _starter_dsl(slide, node_ids)
    return max(1, counts.get(mode, 1))


def _diagram_html(slide: dict[str, Any], sid: str, node_ids: list[str], attr_extra: str) -> str:
    dtype, extra = _real_diagram_type(slide)
    visual = _visual_of(slide)
    label = _esc(slide.get("title") or sid)
    did = _esc(visual.get("ref") or f"{sid}-diagram")
    extra_attr = _attrs(extra) if extra else ""
    todo = "" if _quantity_dsl(slide) else " data-nm-todo"  # numbers from content.quantities are the author's own
    head = f'<figure class="nm-diagram" data-type="{_esc(dtype)}" data-id="{did}" aria-label="{label}"{extra_attr}{todo}{attr_extra}>'
    lines, _ = _starter_dsl(slide, node_ids)
    body = "\n".join("      " + l for l in lines)
    return f'{head}\n    <script type="text/nm-diagram">\n{body}\n    </script>\n  </figure>'


def _cell(value: Any) -> str:
    """A table cell: numbers from the plan follow the deck's digit system, text is written as given."""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        out = str(value)
        if _SCAFFOLD["arabic_digits"]:
            out = "".join(_AR_DIGITS[int(c)] if c.isdigit() else ("٫" if c == "." else c) for c in out)
        return _esc(out)
    return _text(value)


def _table_html(slide: dict[str, Any], sid: str, attr_extra: str) -> str:
    visual = _visual_of(slide)
    cols = visual.get("columns") or []
    rows = [r for r in visual.get("rows") or [] if isinstance(r, list)]
    heads = bool(visual.get("row_headers", True))
    tid = _esc(visual.get("ref") or f"{sid}-table")
    label = _esc(slide.get("title") or sid)
    hl = str(visual.get("highlight") or "").strip()
    hl_attr = f' data-highlight="{_esc(" ".join(re.split(r"[\s,;]+", hl)))}"' if hl else ""
    head_cells = "".join(f'<th scope="col">{_cell(c)}</th>' for c in cols)
    body = []
    for row in rows:
        cells = [f'<th scope="row">{_cell(c)}</th>' if k == 0 and heads else f"<td>{_cell(c)}</td>" for k, c in enumerate(row)]
        body.append("        <tr>" + "".join(cells) + "</tr>")
    cap = f'\n    <figcaption>{_text(visual["caption"])}</figcaption>' if visual.get("caption") else ""
    return (
        f'<figure class="nm-table" data-id="{tid}" aria-label="{label}"{hl_attr}{attr_extra}>\n'
        f"    <table>\n      <thead>\n        <tr>{head_cells}</tr>\n      </thead>\n      <tbody>\n"
        + "\n".join(body)
        + f"\n      </tbody>\n    </table>{cap}\n  </figure>"
    )


def _formula_html(src: dict[str, Any]) -> str:
    """One display formula: the plan's MathML as written (display="block" added when absent), or a TeX host."""
    mathml = src.get("mathml")
    if isinstance(mathml, str) and mathml.strip():
        m = mathml.strip()
        if not re.match(r"<math\b[^>]*\bdisplay=", m):
            m = "<math display=\"block\"" + m[len("<math"):]
        return m
    return f'<span class="nm-math" data-display="block" data-tex="{_esc(str(src.get("tex") or "").strip())}"></span>'


def _equation_html(slide: dict[str, Any], sid: str, attr_extra: str, lines_step: dict[str, Any] | None) -> str:
    visual = _visual_of(slide)
    eid = _esc(visual.get("ref") or f"{sid}-equation")
    label = _esc(slide.get("title") or sid)
    inner: list[str] = []
    if isinstance(visual.get("lines"), list):
        for k, src in enumerate(_equation_sources(visual)):
            st = f' data-step="{lines_step["start"] + k - 1}" data-act="reveal"' if lines_step and k else ""
            note = f'<p class="nm-eq-note">{_text(src["note"])}</p>' if src.get("note") else ""
            inner.append(f'<div class="nm-eq-line"{st}>{_formula_html(src)}{note}</div>')
    else:
        inner.append(_formula_html(visual))
    if visual.get("caption"):
        inner.append(f'<figcaption>{_text(visual["caption"])}</figcaption>')
    return f'<figure class="nm-equation" data-id="{eid}" aria-label="{label}"{attr_extra}>\n    ' + "\n    ".join(inner) + "\n  </figure>"


def _plan_features(plan: dict[str, Any]) -> dict[str, bool]:
    """Optional runtime modules a deck needs; decks without tables or equations link exactly what they did before."""
    slides = [s for s in plan.get("slides") or [] if isinstance(s, dict)]
    table = any(_visual_type(s) == "table" for s in slides)
    tex = _plan_uses_tex(plan)
    math = tex or any(_visual_type(s) == "equation" for s in slides)
    return {"table": table, "math": math, "tex": tex}


# plan layout (short names kept as aliases) -> nm-layout.css composition
LAYOUT_ALIASES = {
    "cover": "title", "center": "title", "section": "section", "split": "split", "split-rev": "split",
    "hero": "hero-figure", "diagram": "hero-figure", "timeline": "hero-figure", "stat": "stat-row",
    "cards": "cards", "compare": "compare", "quote": "quote", "list": "rail",
}


def _composition(layout: str, has_visual: bool, visual_is_graphic: bool, n_body: int, has_stat: bool) -> tuple[str, dict[str, str]]:
    """Pick the real nm-l-* composition for a plan layout and the slide's content."""
    comp = LAYOUT_ALIASES.get(layout, layout)
    attrs: dict[str, str] = {}
    if comp == "title" and has_visual:
        comp, attrs = "split", {"data-ratio": "7:5"}
    elif comp == "split":
        attrs = {"data-ratio": "5:7" if visual_is_graphic else "1:1"}
    elif comp == "stat-row" and (has_visual or n_body):
        comp, attrs = "split", {"data-ratio": "1:1"}
    elif comp == "cards":
        k = max(2, min(4, n_body or 3))
        comp = f"bento-{min(6, k + 1)}" if has_visual else f"cards-{k}"
        if has_visual and k + 1 < 3:
            comp = "bento-3"
    elif comp == "compare" and has_visual:
        comp = "hero-figure"
    elif comp == "rail" and has_visual:
        comp, attrs = "split", {"data-ratio": "5:7"}
    elif comp == "steps" and has_visual:
        comp = "hero-figure"
    return comp, attrs


# Compositions ported from frontend-slides layout presets (NM-21, nm-layout.css): how scaffold fills them.
PORTED_LAYOUTS = ("ledger", "keynote", "stat-strip", "ledger-list", "meridian", "chapter", "plate", "triptych",
                  "monolith", "terminal", "staircase", "waypoint")


def _parts(item: str) -> list[str]:
    """A body item may carry its parts separated by " | " (value | label, date | title | description)."""
    return [p.strip() for p in str(item).split(" | ")]


def _ported_kids(comp: str, v: dict[str, Any]) -> list[str]:
    body_items: list[str] = v["body_items"]
    morph_attr, step_attrs, head = v["morph_attr"], v["step_attrs"], v["head"]
    kicker_html, headline_html, visual_html, stat = v["kicker_html"], v["headline_html"], v["visual_html"], v["stat"]
    attrs = lambda n: f'{morph_attr(f"body{n}")}{step_attrs(f"body{n}")}'
    items = list(enumerate(body_items, start=1))
    if comp == "ledger":
        half = (len(body_items) + 1) // 2

        def side(part: list[tuple[int, str]], label: str, cls: str) -> str:
            rows = "".join(
                f'<div class="nm-row"{attrs(n)}><p>{_text(_parts(t)[0])}</p>' + (f"<p>{_text(_parts(t)[1])}</p>" if len(_parts(t)) > 1 else "") + "</div>"
                for n, t in part
            )
            return f'<div class="nm-side{cls}">\n      <h3 data-nm-todo>{label}</h3>{rows}\n    </div>'
        return [head(kicker_html, headline_html), side(items[:half], _t("side1"), " is-favoured"), side(items[half:], _t("side2"), "")]
    if comp in ("ledger-list", "meridian"):
        def li(n: int, t: str) -> str:
            ps = _parts(t)
            if comp == "meridian" and len(ps) > 1:
                inner = f"<small>{_text(ps[0])}</small><strong>{_text(ps[1])}</strong>" + (f"<p>{_text(ps[2])}</p>" if len(ps) > 2 else "")
            else:
                inner = f"<strong>{_text(ps[0])}</strong>" + (f"<p>{_text(ps[1])}</p>" if len(ps) > 1 else "")
            return f"<li{attrs(n)}>{inner}</li>"
        return [head(kicker_html, headline_html), "<ol>\n        " + "\n        ".join(li(n, t) for n, t in items) + "\n      </ol>"]
    if comp == "staircase":
        return [head(kicker_html, headline_html)] + [f'<p{attrs(n)}>{_text(t)}</p>' for n, t in items]
    if comp == "stat-strip":
        tiles = []
        if stat:
            tiles.append(f'<div{morph_attr("stat")}{step_attrs("stat")}><span class="nm-t-num" data-entrance="count">{_esc(stat.get("value"))}</span><p>{_text(stat.get("label", ""))}</p></div>')
        for n, t in items:
            ps = _parts(t)
            tiles.append(f'<div{attrs(n)}><span class="nm-t-num">{_text(ps[0])}</span><p>{_text(ps[1]) if len(ps) > 1 else ""}</p></div>' if len(ps) > 1
                         else f"<div{attrs(n)}><p>{_text(t)}</p></div>")
        return [head(kicker_html, headline_html)] + tiles
    if comp == "keynote":
        hero = (f'<div{morph_attr("stat")}{step_attrs("stat")}><span class="nm-t-num" data-entrance="count">{_esc(stat.get("value"))}</span>'
                f'<p>{_text(stat.get("label", ""))}</p></div>') if stat else '<div data-nm-todo><span class="nm-t-num">0</span><p>اكتب وصف الرقم</p></div>'
        rail = "".join(f'<div{attrs(n)}><strong>{_text(_parts(t)[0])}</strong><span>{_text(_parts(t)[1]) if len(_parts(t)) > 1 else ""}</span></div>' for n, t in items)
        return [head(kicker_html, headline_html), hero] + ([f'<div class="nm-keynote-rail">{rail}</div>'] if rail else [])
    if comp == "chapter":
        num = f'<p class="nm-section-num" aria-hidden="true">{_digits(v["section_no"] or 1, v["arabic_digits"])}</p>'
        return [num, '<hr class="nm-rule is-accent">', kicker_html, headline_html, v["lead"]()]
    if comp == "monolith":
        return [kicker_html, headline_html, v["lead"]()]
    if comp == "terminal":
        strip = "<ul>" + "".join(f"<li{attrs(n)}>{_text(t)}</li>" for n, t in items) + "</ul>" if len(items) > 1 else v["lead"]()
        return [kicker_html, headline_html, strip]
    if comp == "waypoint":
        current = v["section_no"] or 1
        cur_attr = ' class="is-current"'
        lis = "".join(f"<li{cur_attr if n == current else ''}{attrs(n)}>{_text(t)}</li>" for n, t in items)
        return [kicker_html, headline_html] + ([f"<ol>{lis}</ol>"] if lis else [])
    if comp == "plate":
        return [visual_html, head(kicker_html, headline_html, v["lead"]())]
    if comp == "triptych":
        extra = []
        for k in (2, 3):
            ph_rel = f"assets/img/_placeholders/{v['sid']}-{k}.svg"
            v["extra_files"].append((v["out_dir"] / ph_rel, _placeholder_svg(f"placeholder {v['sid']} {k}")))
            extra.append(f'<figure class="nm-img nm-ph-frame" data-nm-todo><img src="{ph_rel}" alt=""><figcaption data-nm-todo>{_t("card")}</figcaption></figure>')
        return [head(kicker_html, headline_html)] + ([visual_html] if visual_html else []) + extra
    return [head(kicker_html, headline_html, v["lead"]()), visual_html, stat_html if (stat_html := v["stat_html"]) else ""]


def _digits(n: int, arabic: bool) -> str:
    # Arabic-Indic zero is a small dot, so "٠١" reads as a bullet: no zero padding in Arabic digits
    return "".join(_AR_DIGITS[int(c)] for c in str(n)) if arabic else f"{n:02d}"


def _build_slide(
    slide: dict[str, Any], idx: int, plan: dict[str, Any], out_dir: Path, section_no: int = 0
) -> tuple[str, list[str], list[tuple[Path, str]]]:
    sid = str(slide["id"])
    text = slide.get("text") or {}
    visual = _visual_of(slide)
    vtype = _visual_type(slide)
    role = slide.get("role")
    layout = str(slide.get("layout") or "split")
    todos: list[str] = []
    extra_files: list[tuple[Path, str]] = []
    arabic_digits = _SCAFFOLD["arabic_digits"]

    plan_steps = _plan_steps(slide)
    steps_map: dict[str, tuple[int, dict[str, Any]]] = plan_steps["elements"]
    todos.extend(plan_steps["todos"])
    advice = (_SCAFFOLD.get("advice") or {}).get(idx)
    if advice and advice["fit"] != "unknown":
        lang_key = "text_ar" if _SCAFFOLD["lang"] == "ar" else "text_en"
        rec = advice["recommend"][0] if advice["recommend"] else None
        line = f"representation: {advice['current']} ({advice['fit']}"
        if rec and rec["visual"] != advice["current"]:
            line += f"; plan-advise suggests {rec['visual']}, {rec['why'][0]}: {rec[lang_key]}"
        elif rec:
            line += f"; {rec['why'][0]}: {rec[lang_key]}"
        todos.append(line + ")")
        if advice.get("still"):
            todos.append("keep this slide still (" + advice["still_why"]["ar" if _SCAFFOLD["lang"] == "ar" else "en"] + ")")
    used_keys: set[str] = set()
    templates: list[str] = []
    templated: set[str] = set()

    def step_attrs(key: str) -> str:
        if key not in steps_map:
            return ""
        used_keys.add(key)
        num, step = steps_map[key]
        act = str(step.get("act", "reveal"))
        out = f' data-step="{num}" data-act="{_esc(act)}"'
        if act in ("detail", "slice") and key not in templated:
            templated.add(key)
            eid = f"{sid}-{key}"
            out += f' id="{eid}"'
            if act == "detail":
                out += ' data-detail="side"'
            templates.append(
                f'<template data-detail-for="{eid}">\n      <small data-nm-todo>{_t("detail")[0]}</small>\n'
                f'      <h3 data-nm-todo>{_t("detail")[1]}</h3>\n      <p data-nm-todo>{_t("detail")[2]}</p>\n    </template>'
            )
            todos.append(f"fill the <template data-detail-for=\"{eid}\"> (one title, one or two sentences, up to four bullets or three stats)")
        if act == "focus" and step.get("note"):
            out += f' data-focus-note="{_esc(step["note"])}"'
        return out

    # morph id -> element key
    morph_for: dict[str, str] = {}
    morph_key_alias = {"title": "headline", "headline": "headline", "kicker": "kicker", "visual": "visual", "stat": "stat", "body": "body"}
    for mid in _slide_morph(slide):
        key = morph_key_alias.get(mid) or (mid if re.fullmatch(r"body\d+", mid) else None)
        if key:
            morph_for[key] = mid
        else:
            todos.append(f'put data-morph="{mid}" on the element that exists in both this slide and its neighbour')

    def morph_attr(key: str) -> str:
        return f' data-morph="{_esc(morph_for[key])}"' if key in morph_for else ""

    node_ids = list(plan_steps["node_ids"])
    body_items = [b for b in (text.get("body") or []) if isinstance(b, str)]
    stat = text.get("stat") if isinstance(text.get("stat"), dict) and text["stat"].get("value") else None
    has_visual = vtype != "none"
    comp, comp_attrs = _composition(layout, has_visual, vtype in ("diagram", "chart", "anatomy", "motion", "table", "equation"), len(body_items), bool(stat))
    if layout == "split-rev" and comp_attrs.get("data-ratio") in ("5:7", "7:5"):
        # data-ratio follows DOM order and split-rev puts the visual first
        comp_attrs["data-ratio"] = "7:5" if comp_attrs["data-ratio"] == "5:7" else "5:7"

    # --- text pieces
    kicker = text.get("kicker")
    headline = text.get("headline")
    if not headline:
        todos.append("write text.headline")
    kicker_html = f'<p class="nm-kicker"{morph_attr("kicker")}{step_attrs("kicker")}>{_text(kicker)}</p>' if kicker else ""
    if comp in ("title", "monolith"):
        h_tag, h_cls = ("h1", "nm-t-display") if role == "cover" else ("h2", "nm-t-h1")
    elif comp in ("chapter", "terminal", "waypoint"):
        h_tag, h_cls = "h2", "nm-t-h1"
    elif comp == "section":
        h_tag, h_cls = "h2", "nm-t-h1"
    elif comp in ("split", "rail"):
        h_tag, h_cls = ("h1", "nm-t-h1") if role == "cover" else ("h2", "nm-t-h2")
    else:
        h_tag, h_cls = "h2", "nm-t-h2"
    headline_html = (
        f'<{h_tag} class="{h_cls}"{morph_attr("headline")}{step_attrs("headline")}>{_text(headline)}</{h_tag}>' if headline else ""
    )

    def body_list(cls: str = "nm-list") -> str:
        if not body_items:
            return ""
        lis = [f'<li{morph_attr(f"body{n}")}{step_attrs(f"body{n}")}>{_text(item)}</li>' for n, item in enumerate(body_items, start=1)]
        return f'<ul class="{cls}"{morph_attr("body")}{step_attrs("body")}>\n        ' + "\n        ".join(lis) + "\n      </ul>"

    def lead() -> str:
        """One body item reads as a lead paragraph, several as a list."""
        if len(body_items) == 1:
            return f'<p class="nm-t-lead"{morph_attr("body1") or morph_attr("body")}{step_attrs("body1") or step_attrs("body")}>{_text(body_items[0])}</p>'
        return body_list()

    stat_html = ""
    if stat:
        stat_html = (
            f'<div class="nm-stat-block"{morph_attr("stat")}{step_attrs("stat")}>'
            f'<span class="nm-t-num" data-entrance="count">{_esc(stat.get("value"))}</span>'
            f'<p class="nm-t-body">{_text(stat.get("label", ""))}</p></div>'
        )

    # --- visual
    visual_html = ""
    if has_visual:
        vref = str(visual.get("ref") or f"{sid}-visual")
        vattr = morph_attr("visual") + step_attrs("visual")
        if vtype == "anatomy":
            mode = visual.get("mode", "static")
            visual_html = (
                f'<div class="nm-ph" data-anatomy="{_esc(vref)}" data-mode="{_esc(mode)}" data-nm-todo{vattr}>'
                f'{_PH_GLYPH}<span class="nm-ph-label">anatomy: {_esc(vref)} ({_esc(mode)})</span>'
                f"<!-- TODO: build the figure per resources/engine/anatomy/SKILL.md (node build.mjs), save assets/anatomy/{_esc(vref)}.brief.json, "
                f"then replace this placeholder with the built SVG inside a div that keeps data-anatomy=\"{_esc(vref)}\" -->"
                "</div>"
            )
            todos.append(f"build anatomy figure \"{vref}\" ({mode}) and write {vref}.brief.json")
        elif vtype == "image":
            ph_rel = f"assets/img/_placeholders/{sid}.svg"
            extra_files.append((out_dir / ph_rel, _placeholder_svg(f"placeholder {vref}")))
            alt = _esc(visual.get("query") or slide.get("title") or vref)
            visual_html = (
                f'<figure class="nm-img nm-ph-frame" data-nm-todo{vattr}>'
                f'<img src="{ph_rel}" alt="{alt}" data-todo-src="assets/img/{_esc(vref)}.jpg">'
                f"<!-- TODO: save the real image as assets/img/{_cmt(vref)}.jpg (scripts/image_fetch.py auto/fit/treat), then set src to it"
                + (f" (query: {_cmt(visual.get('query'))})" if visual.get("query") else "")
                + " -->"
                "</figure>"
            )
            todos.append(f"replace placeholder image with assets/img/{vref}.jpg ({plan.get('image_source', 'none')})")
        elif vtype in ("diagram", "chart"):
            dg = plan_steps["diagram"]
            dg_attr = ""
            if dg:
                dg_attr = f' data-steps="{dg["mode"]}" data-step-from="{dg["start"]}"'
                used_keys.add("visual")
                todos.append(
                    f"diagram builds its own steps from number {dg['start']} (data-steps=\"{dg['mode']}\"); "
                    "if you add or remove nodes, renumber the other data-step values on this slide"
                )
            ns = plan_steps["node_steps"]
            if ns:
                dg_attr += f' data-node-steps="{_esc(", ".join(f"{i}:{n}:{a}" for i, n, a in ns))}"'
                for i, n, a in ns:
                    todos.append(f"step {n} {a} on diagram node \"{i}\" (data-node-steps on the figure; keep the node id when you edit the DSL)")
            visual_html = _diagram_html(slide, sid, node_ids, vattr + dg_attr)
            if _quantity_dsl(slide):
                todos.append(f"{vtype} drawn from content.quantities ({_real_diagram_type(slide)[0]}); check the labels in the nm-diagram script block")
            else:
                todos.append(f"edit {vtype} labels/values ({_real_diagram_type(slide)[0]}) in the nm-diagram script block")
        elif vtype == "table":
            tb = plan_steps["table"]
            tb_attr = ""
            if tb:
                used_keys.add("visual")
                tb_attr = f' data-steps="{tb["mode"]}" data-step-from="{tb["start"]}"' + (f' data-steps-act="{tb["act"]}"' if tb["act"] != "reveal" else "")
                todos.append(
                    f"table builds one step per {'body row' if tb['mode'] == 'row' else 'data column'} from number {tb['start']} "
                    f"(data-steps=\"{tb['mode']}\"); if you add other steps on this slide, number them after the table's"
                )
            visual_html = _table_html(slide, sid, vattr + tb_attr)
        elif vtype == "equation":
            if plan_steps["lines"]:
                used_keys.add("visual")
            visual_html = _equation_html(slide, sid, vattr, plan_steps["lines"])
        elif vtype == "motion":
            visual_html = (
                f'<div class="nm-ph" data-nm-todo{vattr}>'
                '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="mg-pulse" cx="24" cy="24" r="10"/>'
                '<circle class="mg-pulse" cx="24" cy="24" r="18"/></svg>'
                '<span class="nm-ph-label">motion graphic</span>'
                "<!-- TODO: replace with an inline SVG motion graphic (mg-flow / mg-pulse / mg-radar) -->"
                "</div>"
            )
            todos.append("build the motion graphic (inline SVG)")
        pins_step = steps_map.get("visual")
        if pins_step and str(pins_step[1].get("act")) == "pins" and visual_html:
            pin = f'<span class="nm-pin" data-x="50" data-y="50" data-label="{_t("pin")[0]}" data-nm-todo>{_t("pin")[1]}</span>'
            visual_html = re.sub(r"(<!-- TODO)", pin + r"\1", visual_html, count=1) if "<!-- TODO" in visual_html else visual_html.replace("</figure>", pin + "</figure>", 1)
            todos.append("place one .nm-pin per part (data-x / data-y in percent of the figure)")

    def head(*parts: str, cls: str = "nm-head") -> str:
        inner = "\n      ".join(p for p in parts if p)
        return f'<header class="{cls}">\n      {inner}\n    </header>' if inner else ""

    # --- assemble children per composition
    kids: list[str] = []
    if comp == "title":
        kids = [kicker_html, headline_html, lead(), stat_html]
    elif comp == "section":
        num = f'<p class="nm-section-num" aria-hidden="true">{_digits(section_no or 1, arabic_digits)}</p>'
        kids = [num, '<hr class="nm-rule is-accent">', kicker_html, headline_html, lead()]
    elif comp == "split":
        if has_visual:
            text_col = head(kicker_html, headline_html, lead(), stat_html)
            kids = [visual_html, text_col] if layout == "split-rev" else [text_col, visual_html]
        elif stat:
            kids = [head(kicker_html, headline_html, lead()), stat_html]
        else:
            kids = [head(kicker_html, headline_html), body_list()]
    elif comp in ("hero-figure",):
        kids = [head(kicker_html, headline_html, lead()), visual_html]
    elif comp == "figure-full":
        kids = [visual_html, f'<figcaption class="nm-caption">{headline_html}</figcaption>' if headline_html else ""]
    elif comp.startswith("cards-") or comp.startswith("bento-"):
        cards = [
            f'<article class="nm-card"{morph_attr(f"body{n}")}{step_attrs(f"body{n}")}><p class="nm-t-body">{_text(item)}</p></article>'
            for n, item in enumerate(body_items, start=1)
        ] or [f'<article class="nm-card" data-nm-todo><p class="nm-t-body">{_t("card")}</p></article>'] * 3
        if comp.startswith("bento-") and visual_html:
            cards.insert(0, f'<div class="nm-card is-quiet nm-card-figure">{visual_html}</div>')
        kids = [head(kicker_html, headline_html)] + cards
    elif comp == "stat-row":
        kids = [head(kicker_html, headline_html), stat_html]
    elif comp == "compare":
        half = (len(body_items) + 1) // 2
        a, b = body_items[:half], body_items[half:]

        def side(items: list[str], start: int, label: str) -> str:
            lis = "".join(f'<li{morph_attr(f"body{start + k}")}{step_attrs(f"body{start + k}")}>{_text(t)}</li>' for k, t in enumerate(items))
            return f'<div class="nm-side">\n      <h3 class="nm-t-h3" data-nm-todo>{label}</h3>\n      <ul class="nm-list">{lis}</ul>\n    </div>'

        kids = [head(kicker_html, headline_html), side(a, 1, _t("side1")), side(b, half + 1, _t("side2"))]
    elif comp == "quote":
        quote = f'<blockquote{morph_attr("headline")}{step_attrs("headline")}>{_text(headline or "")}</blockquote>'
        cite = f'<cite{morph_attr("kicker")}{step_attrs("kicker")}>{_text(kicker)}</cite>' if kicker else ""
        kids = [quote, cite]
    elif comp == "rail":
        kids = [f'<aside class="nm-rail-head">\n      {kicker_html}\n      {headline_html}\n    </aside>', f'<div class="nm-rail-main">\n      {lead()}\n      {stat_html}\n    </div>']
    elif comp == "steps":
        kids = [head(kicker_html, headline_html)] + [
            f'<div{morph_attr(f"body{n}")}{step_attrs(f"body{n}")}><p class="nm-t-body">{_text(t)}</p></div>' for n, t in enumerate(body_items, start=1)
        ]
    elif comp in PORTED_LAYOUTS:
        kids = _ported_kids(comp, locals())
    else:
        kids = [head(kicker_html, headline_html, lead()), visual_html, stat_html]
    if visual_html and not any(visual_html in k for k in kids if k):
        kids.append(visual_html)
        todos.append(f"layout {comp} has no figure cell; the visual was appended at the end, move it or pick another layout")
    kids = [k for k in kids if k]
    kids += templates
    # after assembly: every plan step must have landed on an element
    for key, (num, step) in steps_map.items():
        if key not in used_keys:
            todos.append(f"step {num} ({step.get('act')}) target \"{key}\" was not found; add data-step=\"{num}\" data-act=\"{step.get('act')}\" to the right element")
        elif step.get("note"):
            todos.append(f"step {num} {step.get('act')} {key}: {step['note']}")

    slots_html = "\n    ".join(kids)
    attrs = {
        "class": "slide",
        "id": sid,
        "data-title": str(slide.get("title") or sid),
        "data-rel": str(slide.get("rel") or "next"),
        "data-transition": _slide_transition(slide),
        "data-role": str(role),
    }
    if advice and advice.get("still"):
        attrs["data-nm-still"] = ""  # motion roles (NM-13): this slide's parts fade in together
    note = slide.get("speaker_note")
    note_html = f'\n    <aside class="nm-speaker-note" hidden>{_esc(note)}</aside>' if note else ""
    todo_text = "\n".join(f"       - {_cmt(t)}" for t in todos) if todos else "       - none"
    pad_attrs = _attrs(comp_attrs)
    html_out = (
        f"  <!-- {idx + 1}. {sid} / {role} / layout {layout} -> nm-l-{comp}\n       TODO:\n{todo_text}\n  -->\n"
        f"  <section{_attrs(attrs)}>\n"
        f'  <div class="camera-rig">\n'
        f'    <div class="nm-slide-pad nm-l-{_esc(comp)}"{pad_attrs}>\n    {slots_html}\n    </div>{note_html}\n'
        f"  </div>\n  </section>"
    )
    return html_out, todos, extra_files


def _theme_css_vars(tokens: dict[str, Any]) -> str:
    lines = []
    for key, css in (
        ("paper", "--nm-paper"), ("ink", "--nm-ink"), ("muted", "--nm-muted"), ("line", "--nm-line"),
        ("accent", "--nm-accent"), ("accent2", "--nm-accent-2"), ("surface", "--nm-surface"),
    ):
        if key in tokens:
            lines.append(f"      {css}: {tokens[key]};")
    # Text on an accent fill (accent diagram nodes): white on dark accents, the theme's dark colour on light ones.
    if "accent" in tokens:
        dark = min((tokens.get("paper", "#000000"), tokens.get("ink", "#000000")), key=lambda c: _luminance(_hex_to_rgb(c)) if _hex_to_rgb(c) else 1)
        try:
            on = "#FFFFFF" if contrast_ratio("#FFFFFF", tokens["accent"]) >= contrast_ratio(dark, tokens["accent"]) else dark
            lines.append(f"      --nm-on-accent: {on};")
        except (ValueError, TypeError):
            pass
    radius = tokens.get("radius", 20)
    radius_css = f"{radius}px" if isinstance(radius, (int, float)) else str(radius)
    lines.append(f"      --nm-radius: {radius_css};")
    return "\n".join(lines)


TAILWIND_BLOCK = """<!-- Tailwind CDN (opt-in, scaffold --tailwind): needs network; colour and font tokens map to the theme variables -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
  if (window.tailwind) {
    tailwind.config = {
      theme: { extend: {
        colors: { paper: 'var(--nm-paper)', ink: 'var(--nm-ink)', muted: 'var(--nm-muted)', line: 'var(--nm-line)',
                  accent: 'var(--nm-accent)', accent2: 'var(--nm-accent-2)', surface: 'var(--nm-surface)' },
        fontFamily: { display: 'var(--nm-font-display)', body: 'var(--nm-font-body)' },
        borderRadius: { nm: 'var(--nm-radius)' }
      } },
      corePlugins: { preflight: false }
    };
  }
</script>
"""


def render_deck(plan: dict[str, Any], out_dir: Path, tailwind: bool = False,
                font_files: Any = None) -> tuple[str, list[tuple[Path, str]], int]:
    template = (TEMPLATES_DIR / "deck-skeleton.html").read_text(encoding="utf-8")
    _set_scaffold_context(plan)
    _SCAFFOLD["advice"] = {e["index"] - 1: e for e in _represent().advise_plan(plan)["slides"]} if _has_content(plan) else {}
    features = _plan_features(plan)
    tokens, _ = resolve_theme(plan.get("theme"), plan)
    requested = (plan.get("fonts") or {}).get("pairing", "thmanyah") if isinstance(plan.get("fonts"), dict) else "thmanyah"
    sources = _font_sources() if font_files is None else {name: Path(name) for name in font_files}
    families = _available_families(sources)
    pairing = resolve_pairing(requested, families)
    usable = [p for p in PAIRINGS if resolve_pairing(p, families) == p]
    labels = FONT_MODE_LABELS if _SCAFFOLD["lang"] == "ar" else FONT_MODE_LABELS_EN
    font_modes = [{"className": f"font-mode-{p}", "label": labels[p]} for p in usable]
    font_faces = "\n".join(
        f"    @font-face {{ font-family: '{family}'; src: url('assets/fonts/{name}') format('{fmt}'); font-weight: {weight}; font-display: swap; }}"
        for family, name, fmt, weight in FONT_CATALOGUE if name in sources
    )
    mode_css = "\n".join(
        f"    body.font-mode-{p} {{ --nm-font-display: {PAIRING_FONTS[p][0]}; --nm-font-body: {PAIRING_FONTS[p][1]}; }}"
        for p in usable
    )
    slides_html: list[str] = []
    files: list[tuple[Path, str]] = []
    todo_count = 0
    section_no = 0
    for i, slide in enumerate(plan["slides"]):
        if LAYOUT_ALIASES.get(str(slide.get("layout")), slide.get("layout")) in ("section", "chapter", "waypoint"):
            section_no += 1
        s_html, todos, extra = _build_slide(slide, i, plan, out_dir, section_no)
        slides_html.append(s_html)
        files.extend(extra)
        todo_count += len(todos)
    replacements = {
        "{{LANG}}": _esc(_SCAFFOLD["lang"]),
        "{{DIR}}": _DIR[_SCAFFOLD["lang"]],
        "{{TITLE}}": _esc(plan["title"]),
        "{{THEME_VARS}}": _theme_css_vars(tokens),
        "{{BODY_CLASS}}": f"font-mode-{pairing}",
        "{{MODE}}": _esc(plan.get("mode", "morph-and-zoom")),
        "{{FONT_MODES_JSON}}": json.dumps(font_modes, ensure_ascii=False),
        "{{FONT_FACES}}": font_faces,
        "{{FONT_MODE_CSS}}": mode_css,
        "{{FONT_DISPLAY}}": PAIRING_FONTS[pairing][0],
        "{{FONT_BODY}}": PAIRING_FONTS[pairing][1],
        "{{SLIDES}}": "\n\n".join(slides_html),
        "{{TAILWIND}}": TAILWIND_BLOCK if tailwind else "",
        "{{EXTRA_CSS}}": "".join(
            f'\n<link rel="stylesheet" href="assets/nm/{name}">' for name, on in (("nm-table.css", features["table"]), ("nm-math.css", features["math"])) if on
        ),
        "{{EXTRA_JS}}": "".join(
            f'\n<script src="assets/nm/{name}"></script>'
            for name, on in (("nm-table.js", features["table"]), ("vendor/temml.min.js", features["tex"]), ("nm-math.js", features["math"])) if on
        ),
    }
    for key, value in replacements.items():
        template = template.replace(key, value)
    return template, files, todo_count


def cmd_scaffold(args: argparse.Namespace) -> int:
    plan_path = Path(args.plan).expanduser().resolve()
    plan, problem = _load_plan(plan_path)
    if problem:
        print(f"Error: {problem}", file=sys.stderr)
        return 1
    report = lint_plan(plan)
    if not report["passed"]:
        print(f"Scaffold refused: plan-lint found {len(report['errors'])} error(s). Fix them and rerun.", file=sys.stderr)
        _print_lint(report)
        return 1
    if not (TEMPLATES_DIR / "deck-skeleton.html").is_file():
        print(f"Error: deck-skeleton.html not found in {TEMPLATES_DIR}", file=sys.stderr)
        return 1
    out_dir = plan_path.parent
    out_path = Path(args.out).expanduser().resolve() if args.out else out_dir / f"{_slug(plan['title'])}-slides.html"
    if out_path.exists() and not args.force:
        print(f"Error: {out_path} already exists. Use --force to regenerate it (the old file is kept as .bak).", file=sys.stderr)
        return 1
    # The deck must sit in the plan directory so assets/ paths resolve.
    out_dir = out_path.parent
    deck_html, extra_files, todo_count = render_deck(plan, out_dir, tailwind=getattr(args, "tailwind", False))

    fonts = _stage_fonts(out_dir)
    features = _plan_features(plan)
    runtime = _stage_runtime(out_dir, math=features["tex"])
    for path, content in extra_files:
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
    if out_path.exists():
        shutil.copy2(out_path, out_path.with_name(out_path.name + ".bak"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(deck_html, encoding="utf-8")

    for w in report["warnings"]:
        print(f"  warn    {w['code']}  {w['message']}")
    if fonts["status"] != "ok":
        print(f"Warning: fonts not staged: {fonts.get('message')}", file=sys.stderr)
    requested = (plan.get("fonts") or {}).get("pairing", "thmanyah") if isinstance(plan.get("fonts"), dict) else "thmanyah"
    used = resolve_pairing(requested, set(fonts.get("families", [])))
    if used != requested:
        print(f"Note: font pairing \"{requested}\" needs fonts that are not installed; the deck uses \"{used}\". "
              f"{fonts.get('missing_hint', '')}".rstrip())
    if runtime["status"] != "ok":
        print(f"Warning: runtime not staged: {runtime.get('message')}", file=sys.stderr)
    elif features["tex"]:
        print("Note: the plan writes formulas in TeX, so the optional converter (Temml, MIT) was staged into assets/nm/vendor/. "
              "MathML in the plan needs nothing.")
    print(
        f"Scaffolded {len(plan['slides'])} slides to {out_path} ({todo_count} TODO items in HTML comments).\n"
        f"Next: fill each slide's TODO comments, then run audit-deck --html-path \"{out_path}\" and check --html-path \"{out_path}\"."
    )
    return 0


# ---------------------------------------------------------------------------
# audit-deck: runtime v2 contract checks
# ---------------------------------------------------------------------------

_VISUAL_TAGS = {"svg", "img", "figure", "canvas", "iframe", "video"}
_VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
_ORDINAL_NUMBER = re.compile(r"^(0[1-9]|٠[١-٩])(?:[.\s)]|$)")
_SKIP_TEXT_TAGS = {"script", "style", "template", "aside", "math"}  # formulas are not prose (digits, word counts)


class _DeckDom(HTMLParser):
    """Minimal structural view of a deck: elements with their slide index, per-slide text."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.elements: list[dict[str, Any]] = []
        self.slides: list[dict[str, Any]] = []
        self.inline_scripts: list[tuple[int | None, str]] = []
        self.ids: set[str] = set()
        self.visible_text: list[str] = []
        self._cur: int | None = None
        self._depth = 0
        self._skip: list[str] = []
        self._src_tag: str | None = None
        self._src_depth = 0
        self._script_buf: list[str] | None = None
        self._table = 0
        self._stack: list[dict[str, Any]] = []
        self._heading: dict[str, Any] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v if v is not None else "") for k, v in attrs}
        classes = a.get("class", "").split()
        if tag == "section" and "slide" in classes:
            self.slides.append({"attrs": a, "words": 0, "has_visual": False, "todo": False,
                                "heading": False, "kicker": False, "cards3": False, "numbered": 0, "accent_word": 0})
            self._cur = len(self.slides) - 1
            self._depth = 1
        elif tag == "section" and self._cur is not None:
            self._depth += 1
        if a.get("id"):
            self.ids.add(a["id"])
        self.elements.append({"tag": tag, "attrs": a, "slide": self._cur, "classes": classes})
        if self._cur is not None:
            if tag in _VISUAL_TAGS:
                self.slides[self._cur]["has_visual"] = True
            if "data-nm-todo" in a:
                self.slides[self._cur]["todo"] = True
        if tag in _SKIP_TEXT_TAGS:
            self._skip.append(tag)
        # template tells (NM-20): headings, kickers, card rows, a single coloured word in a title
        if self._cur is not None:
            sl = self.slides[self._cur]
            if tag in ("h1", "h2"):
                sl["heading"] = True
                self._heading = {"tag": tag, "marks": 0}
            elif self._heading is not None and tag in ("span", "em", "mark", "strong", "b") and (
                    any("accent" in c for c in classes) or "color" in a.get("style", "")):
                self._heading["marks"] += 1
            if any(c in ("nm-kicker", "eyebrow", "kicker") for c in classes):
                sl["kicker"] = True
            if "nm-card" in classes and self._stack:
                self._stack[-1]["cards"] += 1
        if tag not in _VOID_TAGS:
            self._stack.append({"tag": tag, "cards": 0})
        if tag == "table":
            self._table += 1
        # the image credits block (.nm-sources) is required boilerplate: not counted as slide text
        if self._src_tag is None and "nm-sources" in classes:
            self._src_tag, self._src_depth = tag, 1
        elif self._src_tag == tag:
            self._src_depth += 1
        if tag == "script" and "src" not in a:
            self._script_buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script_buf is not None:
            self.inline_scripts.append((self._cur, "".join(self._script_buf)))
            self._script_buf = None
        if tag in _SKIP_TEXT_TAGS and self._skip and self._skip[-1] == tag:
            self._skip.pop()
        for k in range(len(self._stack) - 1, -1, -1):
            if self._stack[k]["tag"] == tag:
                if self._stack[k]["cards"] >= 3 and self._cur is not None:
                    self.slides[self._cur]["cards3"] = True
                del self._stack[k:]
                break
        if self._heading is not None and tag == self._heading["tag"]:
            if self._heading["marks"] == 1 and self._cur is not None:
                self.slides[self._cur]["accent_word"] += 1
            self._heading = None
        if tag == "table" and self._table:
            self._table -= 1
        if self._src_tag == tag:
            self._src_depth -= 1
            if self._src_depth <= 0:
                self._src_tag = None
        if tag == "section" and self._cur is not None:
            self._depth -= 1
            if self._depth <= 0:
                self._cur = None

    def handle_data(self, data: str) -> None:
        if self._script_buf is not None:
            self._script_buf.append(data)
            return
        if self._skip or self._src_tag is not None:
            return
        stripped = data.strip()
        if stripped and self._cur is not None and _ORDINAL_NUMBER.match(stripped):
            self.slides[self._cur]["numbered"] += 1
        if stripped and self._cur is not None:
            if not self._table:  # table cells are data, read by row, not prose: no word budget
                self.slides[self._cur]["words"] += len(stripped.split())
            self.visible_text.append(stripped)


def _load_credits(path: Path) -> dict[str, dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if isinstance(data, dict):
        for key in ("images", "credits", "items", "entries"):
            if isinstance(data.get(key), (list, dict)):
                data = data[key]
                break
    entries: list[dict[str, Any]] = []
    if isinstance(data, dict):
        for k, v in data.items():
            entry = dict(v) if isinstance(v, dict) else {}
            entry.setdefault("file", k)
            entries.append(entry)
    elif isinstance(data, list):
        entries = [e for e in data if isinstance(e, dict)]
    out: dict[str, dict[str, Any]] = {}
    for e in entries:
        name = e.get("file") or e.get("filename") or e.get("path") or e.get("name") or e.get("local_path")
        if name:
            out[Path(str(name)).name] = e
    return out


def _find_briefs(base_dir: Path, ref: str) -> list[Path]:
    hits: list[Path] = []
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".git", "__pycache__")]
        if f"{ref}.brief.json" in files:
            hits.append(Path(root) / f"{ref}.brief.json")
    return hits


def _vocab_error(where: str, attr: str, value: str, valid: tuple[str, ...]) -> str:
    hint = _closest(value, valid)
    return f'{where}: {attr}="{value}" is not in the runtime vocabulary' + (
        f'; did you mean "{hint}"?' if hint else f"; valid: {', '.join(valid)}"
    )


def _template_tells(dom: Any, warnings: list[str]) -> list[str]:
    """Marks of a deck assembled from a template rather than designed for its topic (roadmap NM-20). Warnings only:
    each can be right on purpose, none is right on every slide."""
    tells: list[str] = []
    content = [(i, s) for i, s in enumerate(dom.slides) if s["attrs"].get("data-role") not in ("cover", "section", "quote", "closing")]
    titled = [(i, s) for i, s in content if s["heading"]]
    if len(titled) >= 4:
        kick = [i + 1 for i, s in titled if s["kicker"]]
        if len(kick) / len(titled) > 0.7:
            tells.append(f"T101: a kicker (eyebrow line) sits above the title on {len(kick)} of {len(titled)} content slides; keep it only where it adds information (a chapter name, a source), not as decoration.")
    if len(content) >= 4:
        cards = [i + 1 for i, s in content if s["cards3"]]
        if len(cards) > len(content) / 2:
            tells.append(f"T102: rows of three or more identical cards on {len(cards)} of {len(content)} content slides ({', '.join(map(str, cards))}); give some of them a diagram, a table, a figure or one strong sentence instead.")
    numbered = [i + 1 for i, s in enumerate(dom.slides) if s["numbered"] >= 2 and s["attrs"].get("data-role") not in ("process", "timeline")]
    if numbered:
        tells.append(f"T103: items numbered 01, 02... on slide(s) {', '.join(map(str, numbered))}, whose content is not a sequence; number only steps that happen in order.")
    accented = [i + 1 for i, s in enumerate(dom.slides) if s["accent_word"]]
    if len(accented) >= 2:
        tells.append(f"T104: one coloured word in the title on slides {', '.join(map(str, accented))}; spend the accent on the one thing the slide proves, once in the deck.")
    warnings.extend(tells)
    return tells


_DSL_RESERVED = {"unit", "x", "y", "max", "min", "value", "label", "sub", "center", "head", "actors", "lane", "title", "series"}


def _audit_plan_data(dom: Any, base_dir: Path, warnings: list[str]) -> list[str]:
    """Compare the drawn charts with the numbers the plan describes (content.quantities, NM-29): how many values a
    chart draws, and whether the parts of a whole add up to 100. Only when deck.plan.json sits next to the deck."""
    plan_path = base_dir / "deck.plan.json"
    if not plan_path.is_file():
        return []
    try:
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    if not _has_content(plan):
        return []
    issues: list[str] = []
    by_id = {s.get("id"): s for s in plan.get("slides") or [] if isinstance(s, dict)}
    scripts: dict[int, list[str]] = {}
    for slide_idx, code in dom.inline_scripts:
        if slide_idx is not None:
            scripts.setdefault(slide_idx, []).append(code)
    nr = _represent()
    for i, sl in enumerate(dom.slides):
        plan_slide = by_id.get(sl["attrs"].get("id"))
        content = (plan_slide or {}).get("content") if isinstance((plan_slide or {}).get("content"), dict) else None
        qs = [q for q in (content or {}).get("quantities") or [] if isinstance(q, dict)]
        if not qs or _visual_type(plan_slide) != "chart":
            continue
        dtype, _ = _real_diagram_type(plan_slide)
        for code in scripts.get(i, []):
            lines = [ln.strip() for ln in code.splitlines() if ln.strip()]
            if dtype == "line":
                xs = next((ln.split(":", 1)[1] for ln in lines if ln.lower().startswith("x:")), None)
                drawn = [v for v in re.split(r"[,،]", xs)] if xs else []
            else:
                drawn = [ln for ln in lines if ":" in ln and ln.split(":", 1)[0].strip().lower() not in _DSL_RESERVED
                         and nr._num(ln.split(":", 1)[1].split("|")[0]) is not None]
            if dtype in ("bars", "donut", "line", "funnel") and len(drawn) != len(qs):
                issues.append(f"Slide {i + 1}: the {dtype} chart draws {len(drawn)} values but the plan's content.quantities lists {len(qs)}; update one of them.")
            if dtype == "donut" and (content or {}).get("kind") == "part-whole":
                total = sum(nr._num(ln.split(":", 1)[1].split("|")[0].replace("!", "")) or 0 for ln in drawn)
                if drawn and abs(total - 100) > 1:
                    issues.append(f"Slide {i + 1}: the parts of the donut add up to {total:g}, not 100.")
    warnings.extend(issues)
    return issues


def _audit_contract(
    content: str, base_dir: Path, asset_refs: set[str], errors: list[str], warnings: list[str]
) -> dict[str, Any]:
    dom = _DeckDom()
    try:
        dom.feed(content)
        dom.close()
    except Exception as exc:  # malformed HTML must never crash the audit
        warnings.append(f"HTML parser stopped early ({exc}); contract checks may be incomplete.")
    contract: dict[str, Any] = {"declared": True, "version": 2}
    n_err_before = len(errors)

    # runtime files linked and present
    linked = {Path(r).name for r in asset_refs if "assets/nm/" in r.replace("\\", "/")}
    for needed in ("nm-deck.js", "nm-deck.css"):
        if needed not in linked:
            errors.append(f"Runtime v2 deck does not link assets/nm/{needed}; add it (see references/runtime-contract.md).")
    missing_rt = [r for r in sorted(asset_refs) if "assets/nm/" in r.replace("\\", "/") and not (base_dir / urllib.parse.unquote(r)).exists()]
    if missing_rt:
        errors.append(f"Runtime file(s) missing on disk: {', '.join(missing_rt)}. Run `deck_helper.py stage-runtime --target-dir <project>`.")
    contract["runtime_linked"] = sorted(linked)
    contract["runtime_missing"] = missing_rt

    # vocabulary
    vocab_errors: list[str] = []
    seen: set[tuple[Any, str, str]] = set()
    diagram_types = _real_diagram_types()
    for el in dom.elements:
        a, slide = el["attrs"], el["slide"]
        where = f"Slide {slide + 1}" if slide is not None else "Deck"
        checks: list[tuple[str, tuple[str, ...]]] = []
        if "data-act" in a:
            checks.append(("data-act", RUNTIME_ACTS))
        if "data-transition" in a:
            checks.append(("data-transition", TRANSITIONS))
        if "data-nm-transition" in a:
            checks.append(("data-nm-transition", TRANSITIONS))
        if "data-rel" in a:
            checks.append(("data-rel", RELS))
        if "data-entrance" in a:
            checks.append(("data-entrance", ENTRANCES))
        if "data-nm-mode" in a:
            checks.append(("data-nm-mode", MODES))
        if "data-type" in a and "nm-diagram" in el["classes"]:
            checks.append(("data-type", diagram_types))
        if "data-steps" in a and "nm-diagram" in el["classes"]:
            checks.append(("data-steps", ("none", "all") + PROGRESSIVE_MODES))
        if "nm-table" in el["classes"]:
            if "data-steps" in a:
                checks.append(("data-steps", ("none",) + TABLE_STEP_MODES))
            if "data-steps-act" in a:
                checks.append(("data-steps-act", ("reveal", "highlight", "focus", "zoom")))
            for tok in re.split(r"[\s,;]+", a.get("data-highlight", "").strip()):
                if tok and not _HIGHLIGHT_TOKEN.match(tok) and (slide, "data-highlight", tok) not in seen:
                    seen.add((slide, "data-highlight", tok))
                    vocab_errors.append(f'{where}: data-highlight entry "{tok}" is not r<row> or c<column> (for example "r2 c3")')
        for part in a.get("data-node-steps", "").split(","):
            bits = part.strip().split(":")
            if len(bits) >= 3 and bits[2] not in ACTS and (slide, "data-node-steps", bits[2]) not in seen:
                seen.add((slide, "data-node-steps", bits[2]))
                vocab_errors.append(_vocab_error(where, "data-node-steps act", bits[2], ACTS))
        for attr, valid in checks:
            value = a[attr].strip()
            if value and value not in valid and (slide, attr, value) not in seen:
                seen.add((slide, attr, value))
                vocab_errors.append(_vocab_error(where, attr, value, valid))
    errors.extend(vocab_errors)
    contract["vocabulary_errors"] = vocab_errors

    # tables and equations need their optional modules (roadmap NM-10, NM-11)
    module_issues: list[str] = []
    tables = [e for e in dom.elements if "nm-table" in e["classes"]]
    has_tex = any("data-tex" in e["attrs"] for e in dom.elements)
    has_term = any("data-term" in e["attrs"] for e in dom.elements)
    has_math = has_tex or has_term or any(e["tag"] == "math" for e in dom.elements)
    if tables:
        if "nm-table.css" not in linked:
            module_issues.append("warn:The deck has tables (figure.nm-table) but does not link assets/nm/nm-table.css; add it after nm-media.css.")
        if "nm-table.js" not in linked:
            stepped = any(e["attrs"].get("data-steps", "none") not in ("", "none") or e["attrs"].get("data-highlight") for e in tables)
            module_issues.append(("error:" if stepped else "warn:") + "The deck has tables but does not link assets/nm/nm-table.js; their row/column steps, highlights and numeric alignment need it.")
    if has_math and "nm-math.css" not in linked:
        module_issues.append("warn:The deck has equations but does not link assets/nm/nm-math.css; add it after nm-media.css.")
    if (has_tex or has_term) and "nm-math.js" not in linked:
        module_issues.append("error:The deck uses data-tex or data-term but does not link assets/nm/nm-math.js; add it after nm-diagram.js.")
    if has_tex:
        if "temml.min.js" not in linked:
            module_issues.append("error:data-tex needs the TeX converter: run `deck_helper.py stage-runtime --math --target-dir <project>` and link "
                                 "assets/nm/vendor/temml.min.js before nm-math.js (or write the formula as MathML, which needs nothing).")
        elif "nm-math.js" in linked and content.find("vendor/temml.min.js") > content.find("nm-math.js"):
            module_issues.append("error:assets/nm/vendor/temml.min.js must be linked before nm-math.js.")
    if any(e["attrs"].get("data-act") == "gsap" for e in dom.elements):
        if "nm-gsap.js" not in linked:
            module_issues.append("error:The deck uses data-act=\"gsap\" but does not link assets/nm/nm-gsap.js; add it after nm-deck.js.")
        if not re.search(r"<script[^>]+src=[\"'][^\"']*gsap[^\"']*(?<!nm-gsap\.js)[\"']", content):
            module_issues.append("warn:data-act=\"gsap\" needs GSAP itself (window.gsap), which the skill does not bundle; without it those elements only fade in. Link a local copy of GSAP before nm-gsap.js.")
    bad_at = sorted({e["attrs"]["data-at"] for e in dom.elements if "data-at" in e["attrs"] and not re.fullmatch(r"\s*(?:(?:<|>|@[\w-]+)\s*)?(?:[+-]=\s*)?(?:-?[\d.]+\s*(?:ms|s)?)?\s*", e["attrs"]["data-at"]) or (e["attrs"].get("data-at", "x").strip() == "")})
    for v in bad_at:
        module_issues.append(f"warn:data-at=\"{v}\" cannot be read; write <, >, +=200, <+=150, 300 or @label (references/morph-and-motion.md).")
    for issue in module_issues:
        kind, msg = issue.split(":", 1)
        (errors if kind == "error" else warnings).append(msg)
    contract["tables"] = len(tables)
    contract["equations"] = {"mathml": sum(1 for e in dom.elements if e["tag"] == "math"), "tex": sum(1 for e in dom.elements if "data-tex" in e["attrs"])}

    # morph ids
    morph_slides: dict[str, set[int]] = {}
    for el in dom.elements:
        mid = el["attrs"].get("data-morph")
        if mid and el["slide"] is not None:
            morph_slides.setdefault(mid, set()).add(el["slide"])
    morph_issues: list[str] = []
    for mid, where_set in sorted(morph_slides.items()):
        ordered = sorted(where_set)
        if len(ordered) < 2:
            morph_issues.append(f'data-morph="{mid}" appears only on slide {ordered[0] + 1}; add it to the neighbouring slide or remove it')
        elif not any(b - a == 1 for a, b in zip(ordered, ordered[1:])):
            morph_issues.append(
                f'data-morph="{mid}" appears on slides {", ".join(str(s + 1) for s in ordered)} but never on two consecutive slides'
            )
    warnings.extend(morph_issues)
    contract["morph_ids"] = {k: [s + 1 for s in sorted(v)] for k, v in sorted(morph_slides.items())}
    contract["morph_warnings"] = morph_issues

    # steps
    step_issues: list[str] = []
    steps_by_slide: dict[int, set[int]] = {}
    open_ended: set[int] = set()  # slides whose diagram builds a block of steps at runtime
    for el in dom.elements:
        if el["slide"] is None:
            continue
        a = el["attrs"]
        if a.get("data-steps", "none") not in ("", "none") and a.get("data-step-from", "").isdigit():
            steps_by_slide.setdefault(el["slide"], set()).add(int(a["data-step-from"]))
            if a["data-steps"] != "all":
                open_ended.add(el["slide"])
        for part in a.get("data-node-steps", "").split(","):
            bits = part.strip().split(":")
            if len(bits) >= 2 and bits[1].isdigit():
                steps_by_slide.setdefault(el["slide"], set()).add(int(bits[1]))
        raw = a.get("data-step")
        if raw is None:
            continue
        try:
            steps_by_slide.setdefault(el["slide"], set()).add(int(raw))
        except ValueError:
            step_issues.append(f'Slide {el["slide"] + 1}: data-step="{raw}" is not a whole number')
    for slide, nums in sorted(steps_by_slide.items()):
        if slide in open_ended:
            continue
        expected = set(range(1, max(nums) + 1))
        if nums != expected:
            missing = sorted(expected - nums)
            step_issues.append(f"Slide {slide + 1}: data-step numbers have gaps (missing {', '.join(map(str, missing))}); number them 1..{max(nums)}")
    warnings.extend(step_issues)
    contract["step_counts"] = {str(s + 1): len(v) for s, v in sorted(steps_by_slide.items())}
    contract["step_warnings"] = step_issues

    # detail templates
    detail_errors: list[str] = []
    for el in dom.elements:
        target = el["attrs"].get("data-detail-for")
        if target is not None and target not in dom.ids:
            where = f"Slide {el['slide'] + 1}" if el["slide"] is not None else "Deck"
            detail_errors.append(f'{where}: data-detail-for="{target}" matches no element id; give the zoom target id="{target}"')
    errors.extend(detail_errors)
    contract["detail_errors"] = detail_errors

    # visuals, long text, placeholders
    no_visual = [i + 1 for i, s in enumerate(dom.slides) if not s["has_visual"]]
    if no_visual:
        warnings.append(f"Slide(s) {', '.join(map(str, no_visual))} have no visual (svg, img, figure, canvas or iframe); add one so the slide is not text only.")
    long_text = [(i + 1, s["words"]) for i, s in enumerate(dom.slides) if s["words"] > 60]
    for num, words in long_text:
        warnings.append(f"Slide {num} has {words} words of text; keep it under 60 and move the rest to the speaker note.")
    todo_slides = [i + 1 for i, s in enumerate(dom.slides) if s["todo"]]
    if todo_slides:
        warnings.append(f"Scaffold placeholders (data-nm-todo) remain on slide(s) {', '.join(map(str, todo_slides))}; replace them with real content.")
    contract["slides_without_visual"] = no_visual
    contract["long_text_slides"] = [n for n, _ in long_text]
    contract["placeholder_slides"] = todo_slides

    # image credits
    img_refs = sorted(
        r for r in asset_refs
        if re.match(r"(?:\./)?assets/img/", r.replace("\\", "/")) and "_placeholders/" not in r.replace("\\", "/")
        and Path(r).suffix.lower() in (".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg")
    )
    credits_path = base_dir / "assets" / "img" / "credits.json"
    credit_issues: list[str] = []
    if credits_path.is_file():
        credits = _load_credits(credits_path)
        for ref in img_refs:
            entry = credits.get(Path(ref).name)
            if entry is None:
                credit_issues.append(f"Image {ref} has no entry in assets/img/credits.json; record its source and license.")
            elif str(entry.get("license", "")).lower() == "unverified":
                credit_issues.append(f"Image {ref} has license \"unverified\" in credits.json; confirm the license or replace the image.")
    # credit problems are errors for missing entries and warnings for unverified licenses
    for issue in credit_issues:
        (warnings if "unverified" in issue else errors).append(issue)
    contract["credit_issues"] = credit_issues

    # anatomy briefs
    anatomy_refs = sorted({el["attrs"]["data-anatomy"] for el in dom.elements if el["attrs"].get("data-anatomy")})
    brief_report: dict[str, Any] = {}
    node = shutil.which("node")
    checker = BUNDLED_ANATOMY_DIR / "scripts" / "brief-check.mjs"
    for ref in anatomy_refs:
        hits = _find_briefs(base_dir, ref)
        if not hits:
            warnings.append(f'data-anatomy="{ref}" has no {ref}.brief.json under the project; write it so the figure can be verified.')
            brief_report[ref] = {"brief": None}
            continue
        entry: dict[str, Any] = {"brief": str(hits[0])}
        if node and checker.is_file():
            try:
                proc = subprocess.run([node, str(checker), str(hits[0])], capture_output=True, text=True, timeout=90, check=False)
                entry["brief_check_exit"] = proc.returncode
                if proc.returncode != 0:
                    tail = (proc.stdout + proc.stderr).strip().splitlines()[-3:]
                    errors.append(f'Anatomy brief check failed for "{ref}": {" | ".join(tail)[:300]}')
            except (OSError, subprocess.SubprocessError) as exc:
                entry["brief_check_exit"] = None
                warnings.append(f'Anatomy brief check for "{ref}" could not run ({exc}).')
        else:
            entry["brief_check_exit"] = None
        brief_report[ref] = entry
    contract["anatomy"] = brief_report

    # hand-written navigation
    reimpl = [s for s, code in dom.inline_scripts if re.search(r"class\s+SlidePresentation\b", code)]
    if reimpl:
        errors.append("An inline <script> re-implements navigation (`class SlidePresentation`); remove it and use the bundled runtime (assets/nm/nm-deck.js).")
    contract["reimplemented_navigation"] = bool(reimpl)

    # digits
    used = [name for name, rx in DIGIT_GROUPS.items() if any(rx.search(t) for t in dom.visible_text)]
    if len(used) > 1:
        warnings.append(f"Slide text mixes digit systems ({', '.join(used)}); use one system everywhere.")
    contract["digit_systems"] = used

    contract["plan_data"] = _audit_plan_data(dom, base_dir, warnings)
    contract["template_tells"] = _template_tells(dom, warnings)

    contract["slide_count"] = len(dom.slides)
    contract["motion_driven"] = bool(
        any("data-entrance" in e["attrs"] or "data-morph" in e["attrs"] or "data-step" in e["attrs"] or "nm-diagram" in e["classes"] for e in dom.elements)
    )
    contract["contract_errors"] = len(errors) - n_err_before
    return contract


def cmd_audit_deck(args: argparse.Namespace) -> int:
    html_path = Path(args.html_path).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()

    if not html_path.exists():
        result = {
            "passed": False,
            "html_path": str(html_path),
            "errors": [f"HTML file does not exist: {html_path}"],
            "warnings": [],
            "metrics": {},
        }
        write_json_output(output_path, result)
        print(f"Audit failed: HTML file not found at {html_path}", file=sys.stderr)
        return 1

    content = html_path.read_text(encoding="utf-8")
    lines = content.splitlines()
    base_dir = html_path.parent

    errors: list[str] = []
    warnings: list[str] = []
    is_v2 = bool(re.search(r"""<meta\s+[^>]*name=["']nm-runtime["'][^>]*content=["']2["']""", content)) or bool(
        re.search(r"""<meta\s+[^>]*content=["']2["'][^>]*name=["']nm-runtime["']""", content)
    )

    # 1. Zero Emojis Check
    emoji_hits: list[dict[str, Any]] = []
    for idx, line in enumerate(lines, start=1):
        for match in EMOJI_REGEX.finditer(line):
            emoji_hits.append(
                {
                    "line": idx,
                    "emoji": match.group(0),
                    "snippet": line.strip()[:120],
                }
            )
    if emoji_hits:
        errors.append(
            f"Found {len(emoji_hits)} forbidden emoji occurrence(s). Zero emojis are allowed; use custom SVG icons."
        )

    # 2. Typography Check (Verify @font-face declarations for bundled Display + Body fonts)
    font_face_blocks = "\n".join(re.findall(r"@font-face\s*\{[^}]+\}", content))
    has_display_font = bool(
        re.search(
            r"font-family:\s*['\"](?:Thmanyah Serif Display|Thmanyah Display|Qahwa Arabic|Setabr Display|Alkhalil Kufi|ZIAN|Readex Pro)['\"]",
            font_face_blocks,
        )
    )
    has_body_font = bool(
        re.search(
            r"font-family:\s*['\"](?:KOMission|Thmanyah Sans|IBM Plex Sans Arabic|Zain Rounded|Readex Pro)['\"]",
            font_face_blocks,
        )
    )
    if not has_display_font:
        errors.append(
            "Missing `@font-face` declaration for a Display font (Thmanyah Display, Qahwa Arabic, Setabr Display, Alkhalil Kufi, ZIAN or Readex Pro)."
        )
    if not has_body_font:
        errors.append(
            "Missing `@font-face` declaration for a bundled Body font (KOMission, Thmanyah Sans, IBM Plex Sans Arabic, Zain Rounded, or Readex Pro)."
        )

    # 3. Referenced Local Assets Check (standalone src="..." / href="..." and CSS url('...'))
    asset_refs: set[str] = set()
    for m in re.finditer(r"""(?<![\w-])(?:src|href)\s*=\s*["']([^"']+)["']""", content):
        ref = m.group(1).strip()
        if not ref.startswith(("http://", "https://", "data:", "#", "mailto:", "javascript:", "blob:")):
            asset_refs.add(ref.split("?")[0].split("#")[0])

    for m in re.finditer(r"""url\(\s*["']?([^"')]+)["']?\s*\)""", content):
        ref = m.group(1).strip()
        if not ref.startswith(("http://", "https://", "data:", "#", "blob:")):
            asset_refs.add(ref.split("?")[0].split("#")[0])

    missing_assets: list[str] = []
    for ref in sorted(asset_refs):
        if not ref:
            continue
        decoded_ref = urllib.parse.unquote(ref)
        candidate = (base_dir / decoded_ref).resolve()
        if not candidate.exists():
            missing_assets.append(ref)

    if missing_assets:
        errors.append(f"Missing {len(missing_assets)} referenced local asset file(s): {', '.join(missing_assets)}")
        licensed = {name for family, name, _f, _w in FONT_CATALOGUE if family in USER_INSTALLED_FONTS}
        if any(Path(m).name in licensed for m in missing_assets):
            errors.append(
                "Thmanyah/ZIAN fonts are not bundled (their licenses forbid redistribution). Install them and run "
                "stage-fonts, or rerun scaffold so the deck uses the open pairing."
            )

    # 4. Slide Positioning, 1920x1080 Stage & Hidden Controls Check
    slide_tags = re.findall(r"<section\b[^>]*class=[\"']([^\"']*\bslide\b[^\"']*)[\"'][^>]*>", content)
    slide_count = len(slide_tags)
    if slide_count == 0:
        errors.append("No `<section class=\"slide\">` elements found in the HTML presentation.")

    for idx, cls_attr in enumerate(slide_tags, start=1):
        classes = cls_attr.split()
        if "relative" in classes:
            errors.append(
                f"Slide {idx} has class 'relative' on `<section class=\"slide\">`, which breaks `.slide {{ position: absolute }}` stacking."
            )

    has_fixed_stage = bool(
        re.search(r"\b(?:deck-stage|slides-stage)\b", content)
        and (is_v2 or ("1920" in content and "1080" in content))
    )
    if not has_fixed_stage:
        errors.append("Missing 1920x1080 fixed stage container (`.deck-stage` or `#slides-stage`).")

    if "deck-controls" in content and "controlsHotzone" not in content:
        warnings.append(
            "`.deck-controls` is present without `#controlsHotzone`; ensure navigation controls are hidden by default and revealed only on bottom-edge hover."
        )

    # 5. Motion Graphics & SVG Presence Check
    svg_count = len(re.findall(r"<svg\b", content))
    motion_markers = re.findall(
        r"\b(mg-flow|mg-flow-fast|mg-flow-rev|mg-radar|mg-pulse|mg-scan|mg-bar-fill|iso-stage|iso-svg)\b|<animate\b",
        content,
    )
    has_keyframes = "@keyframes" in content or "<animate" in content
    runtime_motion = is_v2 and bool(
        re.search(r"""\bdata-(?:entrance|morph|step|act)\b|class=["'][^"']*\bnm-diagram\b""", content)
    )
    if not runtime_motion and (svg_count == 0 or len(motion_markers) == 0 or not has_keyframes):
        errors.append("No active SVG motion graphics (`@keyframes` / `<animate>` + motion classes) detected in the presentation.")

    # 6. Embedded `anatomy` Isometric Figure Checks (if present)
    anatomy_open_tags = re.findall(r"<svg\b[^>]*class=[\"'][^\"']*\biso-svg\b[^\"']*[\"'][^>]*>", content)
    anatomy_stage_count = len(re.findall(r"class=[\"'][^\"']*\biso-stage\b[^\"']*[\"']", content))
    for i, iso_open_tag in enumerate(anatomy_open_tags, start=1):
        if "viewBox=" not in iso_open_tag:
            errors.append(f"Embedded `anatomy` figure #{i} (`svg.iso-svg`) is missing a `viewBox` attribute.")
        if "data-theme=" not in iso_open_tag and anatomy_stage_count == 0:
            warnings.append(
                f"Standalone `anatomy` figure #{i} (`svg.iso-svg`) does not specify `data-theme=\"light\"` or `data-theme=\"dark\"`."
            )

    # Check geometry attributes (`d="..."`, `transform="..."`, `points="..."`) for NaN coordinates
    nan_attr_hits = re.findall(r"""\b(?:d|transform|points|x1|y1|x2|y2|cx|cy|r)\s*=\s*["'][^"']*\bNaN\b[^"']*["']""", content)
    if nan_attr_hits:
        errors.append(f"Found {len(nan_attr_hits)} SVG geometry attribute(s) containing `NaN` coordinates.")

    contract: dict[str, Any] = {"declared": False}
    if is_v2:
        contract = _audit_contract(content, base_dir, asset_refs, errors, warnings)

    passed = len(errors) == 0
    result = {
        "passed": passed,
        "html_path": str(html_path),
        "errors": errors,
        "warnings": warnings,
        "emoji_occurrences": emoji_hits,
        "missing_assets": missing_assets,
        "metrics": {
            "slide_count": slide_count,
            "svg_count": svg_count,
            "motion_marker_count": len(motion_markers),
            "anatomy_svg_count": len(anatomy_open_tags),
            "anatomy_interactive_stage_count": anatomy_stage_count,
            "verified_asset_count": len(asset_refs) - len(missing_assets),
        },
        "contract": contract,
    }
    write_json_output(output_path, result)
    status_str = "PASSED" if passed else "FAILED"
    print(
        f"Deck audit {status_str} ({slide_count} slides, {svg_count} SVGs, {len(emoji_hits)} emojis). Report written to {output_path}"
    )
    if is_v2:
        for item in errors:
            print(f"  error: {item}")
        for item in warnings:
            print(f"  warn:  {item}")
    return 0 if passed else 1


def cmd_check(args: argparse.Namespace) -> int:
    html_path = Path(args.html_path).expanduser().resolve()
    if not html_path.is_file():
        print(f"Error: deck not found: {html_path}", file=sys.stderr)
        return 1
    node = shutil.which("node")
    if node is None:
        print("Cannot run the runtime check: Node.js >= 20 is not on PATH. Install Node (https://nodejs.org) and retry. "
              "The deck itself is unaffected; audit-deck still works without Node.", file=sys.stderr)
        return 2
    version = _check_runtime_prerequisites().get("node_version") or ""
    m = re.match(r"v(\d+)", version)
    if m and int(m.group(1)) < 20:
        print(f"Cannot run the runtime check: Node {version} is too old (need >= 20).", file=sys.stderr)
        return 2
    if not DECK_CHECK_SCRIPT.is_file():
        print(f"Cannot run the runtime check: {DECK_CHECK_SCRIPT} is missing from this copy of the skill.", file=sys.stderr)
        return 2
    command = [node, str(DECK_CHECK_SCRIPT), str(html_path), "--out", str(Path(args.output).expanduser().resolve())]
    if args.shots:
        command += ["--shots", str(Path(args.shots).expanduser().resolve())]
    if args.slides:
        command += ["--slides", args.slides]
    for flag, value in (("--save-baseline", args.save_baseline), ("--baseline", args.baseline)):
        if value:
            command += [flag, str(Path(value).expanduser().resolve())]
    if args.baseline_tolerance is not None:
        command += ["--baseline-tolerance", str(args.baseline_tolerance)]
    if args.baseline_strict:
        command.append("--baseline-strict")
    if args.motion:
        command.append("--motion")
    if args.steps:
        command.append("--steps")
    return subprocess.call(command)


def cmd_cleanup_previews(args: argparse.Namespace) -> int:
    target_dir = Path(args.target_dir).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    frontend_slides_dir = target_dir / ".frontend-slides"
    previews_dir = frontend_slides_dir / "slide-previews"
    removed = False

    if previews_dir.exists():
        shutil.rmtree(previews_dir)
        removed = True
        # Remove parent .frontend-slides only if it is now completely empty
        if frontend_slides_dir.exists() and not any(frontend_slides_dir.iterdir()):
            frontend_slides_dir.rmdir()
    elif frontend_slides_dir.exists() and not any(frontend_slides_dir.iterdir()):
        frontend_slides_dir.rmdir()
        removed = True

    result = {
        "status": "ok",
        "target_dir": str(target_dir),
        "removed_dir": str(previews_dir),
        "was_present": removed,
    }
    write_json_output(output_path, result)
    print(f"Cleanup previews complete (removed={removed}). Report written to {output_path}")
    return 0


def cmd_open_files(args: argparse.Namespace) -> int:
    system = platform.system()
    for raw_path in args.files:
        file_path = Path(raw_path).expanduser().resolve()
        if not file_path.exists():
            print(f"Warning: file not found: {file_path}", file=sys.stderr)
            continue
        if system == "Darwin":
            subprocess.run(["open", str(file_path)], check=False)
        elif system == "Windows":
            os.startfile(str(file_path))  # type: ignore[attr-defined]
        else:
            webbrowser.open(file_path.as_uri())
    return 0


NM_STUDIO_HINT = (
    "Nevermind Studio (nm-studio) is unavailable. The bundled copy needs Node.js >= 20 on PATH. "
    "Install Node, or point NM_STUDIO at either the `nm-studio` executable or a dist/nm-studio.mjs "
    "bundle."
)

# Single-file editor build shipped with this skill; see resources/nm-studio/ and editor/.
BUNDLED_NM_STUDIO = (
    Path(__file__).resolve().parent.parent / "resources" / "nm-studio" / "nm-studio.mjs"
)


def _node_runner(path: Path) -> list[str] | None:
    """Run a .mjs/.js bundle with node, or None when node or the bundle is missing."""
    node = shutil.which("node")
    return [node, str(path)] if node and path.is_file() else None


def _find_nm_studio() -> list[str] | None:
    """Return the argv prefix that runs nm-studio: NM_STUDIO, then PATH, then the bundled build."""
    override = os.environ.get("NM_STUDIO")
    if override:
        path = Path(override).expanduser()
        if path.suffix in (".mjs", ".js"):
            return _node_runner(path)
        return [str(path)] if path.is_file() else None
    found = shutil.which("nm-studio")
    if found:
        return [found]
    return _node_runner(BUNDLED_NM_STUDIO)


def cmd_edit(args: argparse.Namespace) -> int:
    html_path = Path(args.html_path).expanduser().resolve()
    if not html_path.is_file():
        print(f"Error: deck not found: {html_path}", file=sys.stderr)
        return 1
    runner = _find_nm_studio()
    if runner is None:
        print(f"Error: {NM_STUDIO_HINT}", file=sys.stderr)
        return 2
    command = [*runner, "edit", str(html_path)]
    if args.port is not None:
        command += ["--port", str(args.port)]
    if args.no_open:
        command.append("--no-open")
    # The editor runs until the user presses Ctrl+C; its URL is printed on stdout.
    return subprocess.call(command)


def cmd_notes(args: argparse.Namespace) -> int:
    html_path = Path(args.html_path).expanduser().resolve()
    runner = _find_nm_studio()
    if runner is None:
        print(f"Error: {NM_STUDIO_HINT}", file=sys.stderr)
        return 2
    command = [*runner, "notes", args.action, str(html_path)]
    if args.action == "done":
        if not args.note_id:
            print("Error: `notes done` needs a note id.", file=sys.stderr)
            return 1
        command.append(args.note_id)
    elif args.all:
        command.append("--all")
    return subprocess.call(command)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="deck_helper.py",
        description="Install/uninstall skill globally, stage bundled Arabic fonts, audit motion slide decks, and clean up style previews.",
    )
    subparsers = parser.add_subparsers(dest="subcommand", required=True)

    p_install = subparsers.add_parser(
        "install",
        help="Install research-to-motion-slides and its bundled engines across all AI agents (Antigravity, OpenCode, Codex, Claude).",
    )
    p_install.add_argument(
        "--output",
        default=str(TEMP_DIR / "research_to_motion_slides_install.json"),
        help="Output JSON file path for install report.",
    )
    p_install.set_defaults(func=cmd_install)

    p_uninstall = subparsers.add_parser(
        "uninstall",
        help="Remove installed symlinks/copies of research-to-motion-slides and the OpenCode slash command.",
    )
    p_uninstall.add_argument(
        "--keep-canonical",
        action="store_true",
        help="Keep the canonical ~/.agents/skills/research-to-motion-slides directory when removing agent symlinks.",
    )
    p_uninstall.add_argument(
        "--output",
        default=str(TEMP_DIR / "research_to_motion_slides_uninstall.json"),
        help="Output JSON file path for uninstall report.",
    )
    p_uninstall.set_defaults(func=cmd_uninstall)

    p_stage = subparsers.add_parser(
        "stage-fonts",
        help="Copy bundled Arabic display and body fonts into <target-dir>/assets/fonts/.",
    )
    p_stage.add_argument("--target-dir", required=True, help="Target project directory where the HTML deck lives.")
    p_stage.add_argument(
        "--output",
        default=str(TEMP_DIR / "stage_fonts_report.json"),
        help="Output JSON file path for staging report.",
    )
    p_stage.set_defaults(func=cmd_stage_fonts)

    p_audit = subparsers.add_parser(
        "audit-deck",
        help="Audit an HTML presentation deck for zero emojis, valid fonts/assets, slide structure, and motion graphics.",
    )
    p_audit.add_argument("--html-path", required=True, help="Path to the HTML presentation file to audit.")
    p_audit.add_argument(
        "--output",
        default=str(TEMP_DIR / "deck_audit_report.json"),
        help="Output JSON file path for audit report.",
    )
    p_audit.set_defaults(func=cmd_audit_deck)

    p_clean = subparsers.add_parser(
        "cleanup-previews",
        help="Remove temporary .frontend-slides/slide-previews/ files after final deck approval.",
    )
    p_clean.add_argument("--target-dir", required=True, help="Target project directory.")
    p_clean.add_argument(
        "--output",
        default=str(TEMP_DIR / "cleanup_previews.json"),
        help="Output JSON file path for cleanup report.",
    )
    p_clean.set_defaults(func=cmd_cleanup_previews)

    p_open = subparsers.add_parser(
        "open-files",
        help="Open one or more HTML files in the user's default browser across macOS, Windows, and Linux.",
    )
    p_open.add_argument("files", nargs="+", help="HTML file path(s) to open in the browser.")
    p_open.set_defaults(func=cmd_open_files)

    p_edit = subparsers.add_parser(
        "edit",
        help="Open a finished deck in Nevermind Studio, the local visual editor (requires nm-studio).",
    )
    p_edit.add_argument("--html-path", required=True, help="Path to the HTML deck to edit.")
    p_edit.add_argument("--port", type=int, default=None, help="Local port for the editor (default: any free port).")
    p_edit.add_argument("--no-open", action="store_true", help="Do not open the browser automatically.")
    p_edit.set_defaults(func=cmd_edit)

    p_notes = subparsers.add_parser(
        "notes",
        help="List or close the pinned notes left for the agent in Nevermind Studio (requires nm-studio).",
    )
    p_notes.add_argument("action", choices=["list", "done"])
    p_notes.add_argument("--html-path", required=True, help="Path to the HTML deck.")
    p_notes.add_argument("note_id", nargs="?", default=None, help="Note id (for `done`).")
    p_notes.add_argument("--all", action="store_true", help="With `list`: include completed notes.")
    p_notes.set_defaults(func=cmd_notes)

    p_rt = subparsers.add_parser(
        "stage-runtime",
        help="Copy the nm-runtime v2 files into <target-dir>/assets/nm/.",
    )
    p_rt.add_argument("--target-dir", required=True, help="Target project directory where the HTML deck lives.")
    p_rt.add_argument("--inline", action="store_true", help="Also write assets/nm/nm-inline.html (all runtime CSS/JS as <style>/<script>) for single-file decks.")
    p_rt.add_argument("--math", action="store_true", help="Also stage the optional TeX converter (Temml, MIT) into assets/nm/vendor/ for data-tex equations. Native MathML needs nothing.")
    p_rt.add_argument("--output", default=None, help="Optional JSON report path.")
    p_rt.set_defaults(func=cmd_stage_runtime)

    p_pinit = subparsers.add_parser("plan-init", help="Write <target-dir>/deck.plan.json from the bundled example or N stub slides.")
    p_pinit.add_argument("--target-dir", required=True, help="Project directory that will hold deck.plan.json.")
    p_pinit.add_argument("--title", required=True, help="Deck title.")
    p_pinit.add_argument("--lang", choices=LANGS, default="ar", help="Deck language: ar (right to left, default) or en.")
    p_pinit.add_argument("--slides", type=int, default=None, help="Number of stub slides (5..24). Omit to start from the full example.")
    p_pinit.add_argument("--force", action="store_true", help="Overwrite an existing deck.plan.json.")
    p_pinit.add_argument("--advisor", action="store_true", help="Add an empty `content` block to every content slide and turn on the representation advice (plan-advise, NM-29).")
    p_pinit.set_defaults(func=cmd_plan_init)

    p_plint = subparsers.add_parser("plan-lint", help="Validate deck.plan.json and apply the motion-director design rules.")
    p_plint.add_argument("--plan", required=True, help="Path to deck.plan.json.")
    p_plint.add_argument("--output", default=None, help="Optional JSON report path.")
    p_plint.set_defaults(func=cmd_plan_lint)

    p_td = subparsers.add_parser("theme-derive", help="Three palettes from the materials and tools of the topic, contrast-checked (NM-19).")
    p_td.add_argument("--plan", required=True, help="Path to deck.plan.json (its title, text and content.entities are read).")
    p_td.add_argument("--materials", default=None, help="Comma-separated materials of the topic; overrides what is found in the plan.")
    p_td.add_argument("--mood", default=None, help="calm | energetic | serious | warm | cool | dark (Arabic words work too).")
    p_td.add_argument("--previews", default=None, help="Write style-a/b/c.html (cover and one content slide in each palette) into this folder.")
    p_td.add_argument("--apply", type=int, default=None, help="Write palette 1, 2 or 3 into the plan's theme as fixed colours.")
    p_td.add_argument("--output", default=None, help="Optional JSON report path.")
    p_td.set_defaults(func=cmd_theme_derive)

    p_adv = subparsers.add_parser("plan-advise", help="Suggest representations, acts and Morph from each slide's described information (NM-29).")
    p_adv.add_argument("--plan", required=True, help="Path to deck.plan.json.")
    p_adv.add_argument("--output", default=None, help="advice.json path (default: next to the plan).")
    p_adv.add_argument("--apply", action="store_true", help="Write the first suggestion into unlocked slides whose fit is weak or poor (the old plan is kept as .bak).")
    p_adv.set_defaults(func=cmd_plan_advise)

    p_scaf = subparsers.add_parser("scaffold", help="Generate the deck HTML from a lint-clean deck.plan.json (stages fonts and runtime too).")
    p_scaf.add_argument("--plan", required=True, help="Path to deck.plan.json.")
    p_scaf.add_argument("--out", default=None, help="Output HTML path (default: <plan dir>/<slug>-slides.html).")
    p_scaf.add_argument("--force", action="store_true", help="Regenerate an existing output file (the old one is kept as .bak).")
    p_scaf.add_argument("--tailwind", action="store_true", help="Also load the Tailwind CDN mapped to the theme tokens (needs network; only for the editor's token panel). Default: pure nm-layout.css.")
    p_scaf.set_defaults(func=cmd_scaffold)

    p_check = subparsers.add_parser("check", help="Run headless-Chrome runtime checks on a deck (needs Node >= 20 and Chrome).")
    p_check.add_argument("--html-path", required=True, help="Path to the HTML deck.")
    p_check.add_argument("--shots", default=None, help="Directory for screenshots and the contact sheet (default: <deck dir>/check-shots).")
    p_check.add_argument("--slides", default=None, help="Slides to check, e.g. 1-5 or 2,4,7 (default: all).")
    p_check.add_argument("--output", default=str(TEMP_DIR / "deck_check_report.json"), help="Output JSON report path.")
    p_check.add_argument("--steps", action="store_true", help="Also screenshot every step (and compare them with --baseline).")
    p_check.add_argument("--save-baseline", default=None, help="Save this run's screenshots into DIR as the visual baseline (NM-07).")
    p_check.add_argument("--baseline", default=None, help="Compare the screenshots with the baseline in DIR (C-BASELINE, diff images in <shots>/diff/).")
    p_check.add_argument("--baseline-tolerance", type=float, default=None, help="Share of differing pixels allowed (default 0.0005).")
    p_check.add_argument("--baseline-strict", action="store_true", help="A baseline difference is an error, not a warning.")
    p_check.add_argument("--motion", action="store_true", help="Also measure each slide's arrival at full speed (C-MOTION, C-JANK; NM-08).")
    p_check.set_defaults(func=cmd_check)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
