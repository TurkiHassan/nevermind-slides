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
                    and `frontend-slides` engines) across Antigravity, OpenCode, Codex,
                    Claude Code, and ~/.agents/skills, and registers the OpenCode slash command.
  uninstall         Cleanly remove installed symlinks/copies of `research-to-motion-slides`
                    and the OpenCode slash command.
  stage-fonts       Copy bundled Thmanyah Display, Thmanyah Sans, KOMission, Qahwa,
                    Setabr, Alkhalil, ZIAN, IBM Plex Sans Arabic, Zain Rounded, and Readex Pro
                    fonts from resources/fonts/ into the project's assets/fonts/ directory.
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
                    nm-media) into <target-dir>/assets/nm/. `--inline` also writes a paste-in snippet.
  plan-init         Write <target-dir>/deck.plan.json from the bundled example (or N stub slides).
  plan-lint         Validate deck.plan.json and apply the motion-director design rules.
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
BUNDLED_FRONTEND_SLIDES_DIR = SKILL_ROOT / "resources" / "engine" / "frontend-slides"
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

        # Ensure bundled companion skills (`anatomy` and `frontend-slides`) are also available globally
        bundled_anatomy = source_root / "resources" / "engine" / "anatomy"
        if bundled_anatomy.exists():
            _safe_symlink_or_copy(bundled_anatomy, root / "anatomy", overwrite=False)

        bundled_fs = source_root / "resources" / "engine" / "frontend-slides"
        if bundled_fs.exists():
            _safe_symlink_or_copy(bundled_fs, root / "frontend-slides", overwrite=False)

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


def _stage_fonts(target_dir: Path) -> dict[str, Any]:
    dest_fonts_dir = target_dir / "assets" / "fonts"
    dest_fonts_dir.mkdir(parents=True, exist_ok=True)

    if not FONTS_SOURCE_DIR.exists():
        return {
            "status": "error",
            "message": f"Bundled fonts directory not found at {FONTS_SOURCE_DIR}",
            "staged_files": [],
        }

    staged_files: list[str] = []
    for ext in ("*.otf", "*.ttf", "*.woff2"):
        for font_file in sorted(FONTS_SOURCE_DIR.glob(ext)):
            dest_file = dest_fonts_dir / font_file.name
            shutil.copy2(font_file, dest_file)
            staged_files.append(str(dest_file.relative_to(target_dir)))

    if not staged_files:
        return {
            "status": "error",
            "message": f"No font files (.otf/.ttf/.woff2) found inside {FONTS_SOURCE_DIR}",
            "staged_files": [],
        }

    return {
        "status": "ok",
        "target_dir": str(target_dir),
        "fonts_dir": str(dest_fonts_dir),
        "staged_count": len(staged_files),
        "staged_files": staged_files,
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
    return 0


# ---------------------------------------------------------------------------
# Runtime v2 vocabulary (single source of truth: references/runtime-contract.md)
# ---------------------------------------------------------------------------

ACTS = ("reveal", "zoom", "highlight", "focus", "detail", "lens", "pins", "slice", "draw")
ISOLATION_ACTS = ("focus", "detail", "lens", "pins", "slice")
ONCE_PER_SLIDE_ACTS = ("detail", "slice", "lens")
TRANSIENT_ACTS = ("zoom", "highlight", "focus", "detail", "lens", "pins", "slice")
TRANSITIONS = (
    "auto", "fade-through", "push", "zoom-through", "iris", "wipe", "curtain", "depth", "fold", "dissolve", "none",
)
RELS = ("next", "deeper", "back-out", "chapter", "contrast", "time")
ENTRANCES = ("rise", "fade", "clip", "scale", "blur", "draw", "type", "count", "slide")
MODES = ("morph-and-zoom", "morph-only", "classic")
ROLES = ("cover", "section", "concept", "mechanism", "evidence", "comparison", "process", "quote", "summary", "closing")
VISUAL_TYPES = ("anatomy", "image", "diagram", "chart", "motion", "none")
VISUAL_MODES = ("static", "animated")
PAIRINGS = ("thmanyah", "qahwa", "setabr", "kufi", "sans")
IMAGE_SOURCES = ("generate", "web", "none")
BASE_DIAGRAM_TYPES = (
    "flow", "cycle", "tree", "hub", "layers", "timeline", "compare", "matrix", "funnel", "venn",
    "bar", "line", "area", "donut", "pie", "gauge", "scatter", "stat", "network", "graph", "stack", "steps",
)
BASE_LAYOUTS = (
    "cover", "section", "split", "split-rev", "hero", "stat", "cards", "compare", "diagram",
    "timeline", "quote", "center", "list",
)
RUNTIME_JS_ORDER = ("nm-deck.js", "nm-focus.js", "nm-diagram.js")
RUNTIME_CSS_ORDER = ("nm-deck.css", "nm-focus.css", "nm-diagram.css", "nm-media.css", "nm-layout.css")

FONT_MODE_LABELS = {
    "thmanyah": "ثمانية + كومشن",
    "sans": "ثمانية سانس",
    "qahwa": "قهوة",
    "setabr": "ستابر",
    "kufi": "كوفي",
}

DIGIT_GROUPS = {
    "western": re.compile(r"[0-9]"),
    "arabic-indic": re.compile(r"[٠-٩]"),
    "persian": re.compile(r"[۰-۹]"),
}

# Emoji plus invisible emoji glue (variation selector-16, zero-width joiner, keycap)
PLAN_EMOJI_REGEX = re.compile(EMOJI_REGEX.pattern[:-2] + "\uFE0F\u20E3]+")


def _closest(value: str, options: Any) -> str:
    match = difflib.get_close_matches(str(value), [str(o) for o in options], n=1, cutoff=0.5)
    return match[0] if match else ""


def _diagram_types() -> tuple[str, ...]:
    """Built-in diagram vocabulary plus any type token quoted in nm-diagram.js."""
    found = set(BASE_DIAGRAM_TYPES)
    js = RUNTIME_DIR / "nm-diagram.js"
    if js.is_file():
        try:
            text = js.read_text(encoding="utf-8")
            for token in re.findall(r"""['"]([a-z][a-z0-9-]{2,18})['"]""", text):
                found.add(token)
        except OSError:
            pass
    return tuple(sorted(found))


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


def resolve_theme(theme: Any) -> tuple[dict[str, Any], list[str]]:
    """Return (tokens, problems). Preset first, then explicit token overrides."""
    presets = _load_themes()
    problems: list[str] = []
    default_name = "paper" if "paper" in presets else next(iter(presets), "")
    tokens: dict[str, Any] = {}
    theme = theme if isinstance(theme, dict) else {}
    preset = theme.get("preset")
    if preset:
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
    if not preset and theme and not all(k in theme for k in ("paper", "ink", "accent")):
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
    if lang != "ar":
        err("P002", f"`lang` must be \"ar\", got \"{lang}\"")
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

    tokens, theme_problems = resolve_theme(plan.get("theme"))
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

    # layout repetition
    run = 1
    for i in range(1, n):
        if slides[i].get("layout") and slides[i].get("layout") == slides[i - 1].get("layout"):
            run += 1
        else:
            run = 1
        if run == 3:
            err("R104", f"slide {i + 1} ({slides[i].get('id', '?')}): layout \"{slides[i].get('layout')}\" is used on 3 slides in a row; change one of them", i + 1)
        elif run == 2:
            warn("R105", f"slide {i + 1} ({slides[i].get('id', '?')}): layout \"{slides[i].get('layout')}\" repeats the previous slide; vary it if you can", i + 1)

    # continuity and morph pairing
    for i in range(1, n):
        cur, prev = slides[i], slides[i - 1]
        shared = set(_slide_morph(cur)) & set(_slide_morph(prev))
        explicit = _slide_transition(cur) != "auto" or str(cur.get("rel") or "next") in ("chapter", "contrast")
        if not shared and not explicit:
            err("R106", f"slide {i + 1} ({cur.get('id', '?')}): no link to slide {i}; add a shared morph id (e.g. \"title\") to both, or set a non-auto transition, or rel chapter/contrast", i + 1)
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
    used = [name for name, rx in DIGIT_GROUPS.items() if any(rx.search(s) for s in visible)]
    if len(used) > 1:
        warn("R121", f"deck text mixes digit systems ({', '.join(used)}); pick one and use it everywhere")

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
            "flat_slides": [r["slide"] for r in slide_reports if r["motion_score"] <= 2],
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
    "evidence": {"type": "chart", "diagram_type": "bar"},
    "comparison": {"type": "chart", "diagram_type": "bar"},
    "process": {"type": "diagram", "diagram_type": "timeline"},
    "quote": {"type": "none"},
    "closing": {"type": "image", "query": "describe the closing image, no text"},
    "summary": {"type": "image", "query": "describe the closing image, no text"},
}


def make_stub_plan(title: str, count: int) -> dict[str, Any]:
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
        text: dict[str, Any] = {"kicker": "اكتب العنوان الفرعي", "headline": "اكتب عنوان الشريحة"}
        if role == "cover":
            text = {"kicker": "اكتب العنوان الفرعي", "headline": title, "body": ["اكتب جملة افتتاحية قصيرة"]}
        elif role == "evidence":
            text["stat"] = {"value": "0%", "label": "اكتب وصف الرقم"}
            text["body"] = ["اكتب مصدر الرقم"]
        elif role == "quote":
            text = {"kicker": "اكتب اسم القائل", "headline": "اكتب الاقتباس هنا"}
        elif role in ("concept", "closing", "comparison"):
            text["body"] = ["اكتب نقطة قصيرة", "اكتب نقطة ثانية"] if role != "closing" else ["اكتب خطوة عملية واحدة"]
        slides.append(
            {
                "id": f"s{i + 1}",
                "title": "الغلاف" if role == "cover" else ("الخاتمة" if role == "closing" else "اكتب اسم الشريحة"),
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
        "lang": "ar",
        "theme": {"preset": "paper"},
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
    if args.slides is None:
        try:
            plan = json.loads(example.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            plan = make_stub_plan(args.title, 8)
        plan["title"] = args.title
        if plan.get("slides"):
            plan["slides"][0].setdefault("text", {})["headline"] = args.title
    else:
        if not 5 <= args.slides <= 24:
            print("Error: --slides must be between 5 and 24.", file=sys.stderr)
            return 1
        plan = make_stub_plan(args.title, args.slides)
    write_json_output(out, plan)
    print(f"Plan written to {out} ({len(plan['slides'])} slides). Fill it in, then run: plan-lint --plan {out}")
    return 0


# ---------------------------------------------------------------------------
# stage-runtime
# ---------------------------------------------------------------------------


def _runtime_files() -> list[Path]:
    if not RUNTIME_DIR.is_dir():
        return []
    files = [p for p in RUNTIME_DIR.iterdir() if p.is_file() and p.suffix in (".css", ".js")]
    return sorted(files, key=lambda p: p.name)


def _stage_runtime(target_dir: Path, inline: bool = False) -> dict[str, Any]:
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
        parts += [f"<script>\n{f.read_text(encoding='utf-8')}\n</script>" for f in ordered_js]
        snippet = dest / "nm-inline.html"
        snippet.write_text("\n".join(parts) + "\n", encoding="utf-8")
        result["inline_snippet"] = str(snippet)
    return result


def cmd_stage_runtime(args: argparse.Namespace) -> int:
    target_dir = Path(args.target_dir).expanduser().resolve()
    result = _stage_runtime(target_dir, inline=args.inline)
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


def _step_targets(slide: dict[str, Any]) -> tuple[dict[str, tuple[int, dict[str, Any]]], list[str]]:
    """Map element key -> (step number, step). Collect notes about conflicts."""
    mapping: dict[str, tuple[int, dict[str, Any]]] = {}
    todos: list[str] = []
    for k, step in enumerate(_slide_steps(slide), start=1):
        target = str(step.get("target") or "visual").strip()
        key = target
        if key in ("title",):
            key = "headline"
        if key in mapping:
            todos.append(f"step {k} ({step.get('act')}) targets \"{target}\" again; split it onto another element by hand")
            continue
        mapping[key] = (k, step)
    return mapping, todos


def _diagram_html(slide: dict[str, Any], sid: str, node_ids: list[str], attr_extra: str) -> str:
    visual = _visual_of(slide)
    dtype = visual.get("diagram_type") or ("bar" if visual.get("type") == "chart" else "flow")
    is_chart = dtype in ("bar", "line", "area", "donut", "pie", "gauge", "scatter")
    label = _esc(slide.get("title") or sid)
    if is_chart:
        body = (
            '  <!-- TODO: replace the sample values with real data (one value per label) -->\n'
            '  <div class="nm-ph-label">sample data</div>\n'
        )
        return (
            f'<figure class="nm-diagram" data-type="{_esc(dtype)}" data-labels="A|B|C|D" data-values="30|55|42|70" '
            f'aria-label="{label}" data-nm-todo{attr_extra}>\n{body}</figure>'
        )
    ids = list(node_ids)
    k = 1
    while len(ids) < 3:
        cand = f"n{k}"
        k += 1
        if cand not in ids:
            ids.append(cand)
    links = " ".join(f"{a}>{b}" for a, b in zip(ids, ids[1:]))
    nodes = "\n".join(f'  <div class="nm-node" data-node="{_esc(i)}"{{ATTR_{i}}}>TODO label {_esc(i)}</div>' for i in ids)
    return (
        f'<figure class="nm-diagram" data-type="{_esc(dtype)}" data-links="{_esc(links)}" aria-label="{label}" '
        f"data-nm-todo{attr_extra}>\n{nodes}\n</figure>"
    )


def _build_slide(
    slide: dict[str, Any], idx: int, plan: dict[str, Any], out_dir: Path
) -> tuple[str, list[str], list[tuple[Path, str]]]:
    sid = str(slide["id"])
    text = slide.get("text") or {}
    visual = _visual_of(slide)
    vtype = _visual_type(slide)
    role = slide.get("role")
    layout = slide.get("layout")
    todos: list[str] = []
    extra_files: list[tuple[Path, str]] = []

    steps_map, step_todos = _step_targets(slide)
    todos.extend(step_todos)
    used_keys: set[str] = set()

    def step_attrs(key: str) -> str:
        if key in steps_map:
            used_keys.add(key)
            num, step = steps_map[key]
            return f' data-step="{num}" data-act="{_esc(step.get("act", "reveal"))}"'
        return ""

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

    # nodes referenced by steps
    node_ids = [k.split(":", 1)[1] for k in steps_map if k.startswith("node:") and k.split(":", 1)[1]]

    # --- text
    head_parts: list[str] = []
    kicker = text.get("kicker")
    headline = text.get("headline")
    if kicker:
        head_parts.append(f'<p class="nm-t-kicker"{morph_attr("kicker")}{step_attrs("kicker")}>{_esc(kicker)}</p>')
    if headline:
        tag = "h1" if role == "cover" else "h2"
        if role == "quote":
            head_parts = [
                f'<blockquote class="nm-t-quote nm-t-headline"{morph_attr("headline")}{step_attrs("headline")}>{_esc(headline)}</blockquote>'
            ] + head_parts[::-1]
        else:
            head_parts.append(f'<{tag} class="nm-t-headline"{morph_attr("headline")}{step_attrs("headline")}>{_esc(headline)}</{tag}>')
    else:
        todos.append("write text.headline")
    head_html = "\n      ".join(head_parts)

    body_items = [b for b in (text.get("body") or []) if isinstance(b, str)]
    body_html = ""
    if body_items:
        body_step = step_attrs("body")
        lis = []
        for n, item in enumerate(body_items, start=1):
            lis.append(f'<li class="nm-t-body"{morph_attr(f"body{n}")}{step_attrs(f"body{n}")}>{_esc(item)}</li>')
        li_html = "\n        ".join(lis)
        body_html = f'<ul class="nm-t-body-list"{morph_attr("body")}{body_step}>\n        {li_html}\n      </ul>'

    stat_html = ""
    stat = text.get("stat")
    if isinstance(stat, dict) and stat.get("value"):
        stat_html = (
            f'<div class="nm-t-stat"{morph_attr("stat")}{step_attrs("stat")}>'
            f'<span class="nm-t-stat-value" data-entrance="count">{_esc(stat.get("value"))}</span>'
            f'<span class="nm-t-stat-label">{_esc(stat.get("label", ""))}</span></div>'
        )

    # --- visual
    visual_html = ""
    detail_templates = ""
    if vtype != "none":
        vref = str(visual.get("ref") or f"{sid}-visual")
        vattr = morph_attr("visual") + step_attrs("visual")
        detail_for = ""
        if "visual" in steps_map and steps_map["visual"][1].get("act") == "detail":
            detail_for = f"{sid}-visual"
            vattr += f' id="{detail_for}"'
            detail_templates = (
                f'\n      <template data-detail-for="{detail_for}"><div class="nm-detail-card">'
                f"TODO: detail content (zoomed view, label or note)</div></template>"
            )
            todos.append(f"fill the detail template for #{detail_for}")
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
                f'<figure class="nm-img" data-nm-todo{vattr}>'
                f'<img class="nm-ph-img" src="{ph_rel}" alt="{alt}" data-todo-src="assets/img/{_esc(vref)}.jpg">'
                f"<!-- TODO: save the real image as assets/img/{_cmt(vref)}.jpg, then set src to it"
                + (f" (query: {_cmt(visual.get('query'))})" if visual.get("query") else "")
                + " -->"
                "</figure>"
            )
            todos.append(f"replace placeholder image with assets/img/{vref}.jpg ({plan.get('image_source', 'none')})")
        elif vtype in ("diagram", "chart"):
            visual_html = _diagram_html(slide, sid, node_ids, vattr)
            for nid in node_ids:
                key = f"node:{nid}"
                attrs = step_attrs(key) if key in steps_map else ""
                visual_html = visual_html.replace("{ATTR_" + nid + "}", attrs)
            visual_html = re.sub(r"\{ATTR_[^}]*\}", "", visual_html)
            todos.append(f"edit {vtype} labels/values ({visual.get('diagram_type', 'flow')}) in the nm-diagram figure")
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
        if visual_html:
            visual_html = f'<div class="nm-slot nm-slot-visual">\n      {visual_html}{detail_templates}\n    </div>'

    for key, (num, step) in steps_map.items():
        if key not in used_keys:
            todos.append(f"step {num} ({step.get('act')}) target \"{key}\" was not found; add data-step=\"{num}\" data-act=\"{step.get('act')}\" to the right element")
        elif step.get("note"):
            todos.append(f"step {num} {step.get('act')} {key}: {step['note']}")

    slots = []
    if head_html:
        slots.append(f'<header class="nm-slot nm-slot-head">\n      {head_html}\n    </header>')
    if body_html:
        slots.append(f'<div class="nm-slot nm-slot-body">\n      {body_html}\n    </div>')
    if visual_html:
        slots.append(visual_html)
    if stat_html:
        slots.append(f'<div class="nm-slot nm-slot-stat">{stat_html}</div>')
    slots_html = "\n    ".join(slots)

    attrs = {
        "class": "slide",
        "id": sid,
        "data-title": str(slide.get("title") or sid),
        "data-rel": str(slide.get("rel") or "next"),
        "data-transition": _slide_transition(slide),
        "data-role": str(role),
    }
    note = slide.get("speaker_note")
    note_html = f'\n    <aside class="nm-speaker-note" hidden>{_esc(note)}</aside>' if note else ""
    todo_text = "\n".join(f"       - {_cmt(t)}" for t in todos) if todos else "       - none"
    html_out = (
        f"  <!-- {idx + 1}. {sid} / {role} / layout {layout}\n       TODO:\n{todo_text}\n  -->\n"
        f"  <section{_attrs(attrs)}>\n"
        f'  <div class="camera-rig">\n'
        f'    <div class="nm-l nm-l-{_esc(layout)}">\n    {slots_html}\n    </div>{note_html}\n'
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
    radius = tokens.get("radius", 20)
    radius_css = f"{radius}px" if isinstance(radius, (int, float)) else str(radius)
    lines.append(f"      --nm-radius: {radius_css};")
    return "\n".join(lines)


def render_deck(plan: dict[str, Any], out_dir: Path) -> tuple[str, list[tuple[Path, str]], int]:
    template = (TEMPLATES_DIR / "deck-skeleton.html").read_text(encoding="utf-8")
    tokens, _ = resolve_theme(plan.get("theme"))
    pairing = (plan.get("fonts") or {}).get("pairing", "thmanyah") if isinstance(plan.get("fonts"), dict) else "thmanyah"
    font_modes = [{"className": f"font-mode-{p}", "label": FONT_MODE_LABELS[p]} for p in PAIRINGS]
    slides_html: list[str] = []
    files: list[tuple[Path, str]] = []
    todo_count = 0
    for i, slide in enumerate(plan["slides"]):
        s_html, todos, extra = _build_slide(slide, i, plan, out_dir)
        slides_html.append(s_html)
        files.extend(extra)
        todo_count += len(todos)
    replacements = {
        "{{LANG}}": _esc(plan.get("lang", "ar")),
        "{{TITLE}}": _esc(plan["title"]),
        "{{THEME_VARS}}": _theme_css_vars(tokens),
        "{{BODY_CLASS}}": f"font-mode-{pairing}",
        "{{MODE}}": _esc(plan.get("mode", "morph-and-zoom")),
        "{{FONT_MODES_JSON}}": json.dumps(font_modes, ensure_ascii=False),
        "{{SLIDES}}": "\n\n".join(slides_html),
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
    deck_html, extra_files, todo_count = render_deck(plan, out_dir)

    fonts = _stage_fonts(out_dir)
    runtime = _stage_runtime(out_dir)
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
    if runtime["status"] != "ok":
        print(f"Warning: runtime not staged: {runtime.get('message')}", file=sys.stderr)
    print(
        f"Scaffolded {len(plan['slides'])} slides to {out_path} ({todo_count} TODO items in HTML comments).\n"
        f"Next: fill each slide's TODO comments, then run audit-deck --html-path \"{out_path}\" and check --html-path \"{out_path}\"."
    )
    return 0


# ---------------------------------------------------------------------------
# audit-deck: runtime v2 contract checks
# ---------------------------------------------------------------------------

_VISUAL_TAGS = {"svg", "img", "figure", "canvas", "iframe", "video"}
_SKIP_TEXT_TAGS = {"script", "style", "template", "aside"}


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
        self._script_buf: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = {k: (v if v is not None else "") for k, v in attrs}
        classes = a.get("class", "").split()
        if tag == "section" and "slide" in classes:
            self.slides.append({"attrs": a, "words": 0, "has_visual": False, "todo": False})
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
        if tag == "script" and "src" not in a:
            self._script_buf = []

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._script_buf is not None:
            self.inline_scripts.append((self._cur, "".join(self._script_buf)))
            self._script_buf = None
        if tag in _SKIP_TEXT_TAGS and self._skip and self._skip[-1] == tag:
            self._skip.pop()
        if tag == "section" and self._cur is not None:
            self._depth -= 1
            if self._depth <= 0:
                self._cur = None

    def handle_data(self, data: str) -> None:
        if self._script_buf is not None:
            self._script_buf.append(data)
            return
        if self._skip:
            return
        stripped = data.strip()
        if stripped and self._cur is not None:
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
    diagram_types = _diagram_types()
    for el in dom.elements:
        a, slide = el["attrs"], el["slide"]
        where = f"Slide {slide + 1}" if slide is not None else "Deck"
        checks: list[tuple[str, tuple[str, ...]]] = []
        if "data-act" in a:
            checks.append(("data-act", ACTS))
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
        for attr, valid in checks:
            value = a[attr].strip()
            if value and value not in valid and (slide, attr, value) not in seen:
                seen.add((slide, attr, value))
                vocab_errors.append(_vocab_error(where, attr, value, valid))
    errors.extend(vocab_errors)
    contract["vocabulary_errors"] = vocab_errors

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
    for el in dom.elements:
        raw = el["attrs"].get("data-step")
        if raw is None or el["slide"] is None:
            continue
        try:
            steps_by_slide.setdefault(el["slide"], set()).add(int(raw))
        except ValueError:
            step_issues.append(f'Slide {el["slide"] + 1}: data-step="{raw}" is not a whole number')
    for slide, nums in sorted(steps_by_slide.items()):
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
            r"font-family:\s*['\"](?:Thmanyah Serif Display|Qahwa Arabic|Setabr Display|Alkhalil Kufi|ZIAN)['\"]",
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
            "Missing `@font-face` declaration for a bundled Display font (Thmanyah Serif Display, Qahwa Arabic, Setabr Display, Alkhalil Kufi, or ZIAN)."
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
    p_rt.add_argument("--output", default=None, help="Optional JSON report path.")
    p_rt.set_defaults(func=cmd_stage_runtime)

    p_pinit = subparsers.add_parser("plan-init", help="Write <target-dir>/deck.plan.json from the bundled example or N stub slides.")
    p_pinit.add_argument("--target-dir", required=True, help="Project directory that will hold deck.plan.json.")
    p_pinit.add_argument("--title", required=True, help="Deck title (Arabic).")
    p_pinit.add_argument("--slides", type=int, default=None, help="Number of stub slides (5..24). Omit to start from the full example.")
    p_pinit.add_argument("--force", action="store_true", help="Overwrite an existing deck.plan.json.")
    p_pinit.set_defaults(func=cmd_plan_init)

    p_plint = subparsers.add_parser("plan-lint", help="Validate deck.plan.json and apply the motion-director design rules.")
    p_plint.add_argument("--plan", required=True, help="Path to deck.plan.json.")
    p_plint.add_argument("--output", default=None, help="Optional JSON report path.")
    p_plint.set_defaults(func=cmd_plan_lint)

    p_scaf = subparsers.add_parser("scaffold", help="Generate the deck HTML from a lint-clean deck.plan.json (stages fonts and runtime too).")
    p_scaf.add_argument("--plan", required=True, help="Path to deck.plan.json.")
    p_scaf.add_argument("--out", default=None, help="Output HTML path (default: <plan dir>/<slug>-slides.html).")
    p_scaf.add_argument("--force", action="store_true", help="Regenerate an existing output file (the old one is kept as .bak).")
    p_scaf.set_defaults(func=cmd_scaffold)

    p_check = subparsers.add_parser("check", help="Run headless-Chrome runtime checks on a deck (needs Node >= 20 and Chrome).")
    p_check.add_argument("--html-path", required=True, help="Path to the HTML deck.")
    p_check.add_argument("--shots", default=None, help="Directory for screenshots and the contact sheet (default: <deck dir>/check-shots).")
    p_check.add_argument("--slides", default=None, help="Slides to check, e.g. 1-5 or 2,4,7 (default: all).")
    p_check.add_argument("--output", default=str(TEMP_DIR / "deck_check_report.json"), help="Output JSON report path.")
    p_check.set_defaults(func=cmd_check)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
