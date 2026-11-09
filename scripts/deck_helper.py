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
"""

from __future__ import annotations

import argparse
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
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parent.parent
FONTS_SOURCE_DIR = SKILL_ROOT / "resources" / "fonts"
BUNDLED_ANATOMY_DIR = SKILL_ROOT / "resources" / "engine" / "anatomy"
BUNDLED_FRONTEND_SLIDES_DIR = SKILL_ROOT / "resources" / "engine" / "frontend-slides"
TEMP_DIR = Path(tempfile.gettempdir())

# Copy filter to exclude git metadata, caches, and OS junk during installation
COPY_IGNORE = shutil.ignore_patterns(".git", "__pycache__", ".DS_Store", "*.pyc", ".pytest_cache")

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

    runtime_info = _check_runtime_prerequisites()
    result = {
        "status": "ok",
        "canonical_skill_dir": str(source_root),
        "installed_locations": installed_targets,
        "opencode_command": str(opencode_cmd_file),
        "runtime": runtime_info,
    }
    output_path = Path(args.output).expanduser().resolve()
    write_json_output(output_path, result)
    print(f"Installed `nevermind-slides` across {len(installed_targets)} agent environments. Report: {output_path}")
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


def cmd_stage_fonts(args: argparse.Namespace) -> int:
    target_dir = Path(args.target_dir).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    dest_fonts_dir = target_dir / "assets" / "fonts"
    dest_fonts_dir.mkdir(parents=True, exist_ok=True)

    if not FONTS_SOURCE_DIR.exists():
        result = {
            "status": "error",
            "message": f"Bundled fonts directory not found at {FONTS_SOURCE_DIR}",
            "staged_files": [],
        }
        write_json_output(output_path, result)
        print(f"Error: {result['message']}", file=sys.stderr)
        return 1

    staged_files: list[str] = []
    for ext in ("*.otf", "*.ttf", "*.woff2"):
        for font_file in sorted(FONTS_SOURCE_DIR.glob(ext)):
            dest_file = dest_fonts_dir / font_file.name
            shutil.copy2(font_file, dest_file)
            staged_files.append(str(dest_file.relative_to(target_dir)))

    if not staged_files:
        result = {
            "status": "error",
            "message": f"No font files (.otf/.ttf/.woff2) found inside {FONTS_SOURCE_DIR}",
            "staged_files": [],
        }
        write_json_output(output_path, result)
        print(f"Error: {result['message']}", file=sys.stderr)
        return 1

    result = {
        "status": "ok",
        "target_dir": str(target_dir),
        "fonts_dir": str(dest_fonts_dir),
        "staged_count": len(staged_files),
        "staged_files": staged_files,
        "bundled_anatomy_kit": str(BUNDLED_ANATOMY_DIR / "kit" / "iso-kit.mjs"),
    }
    write_json_output(output_path, result)
    print(f"Staged {len(staged_files)} font files to {dest_fonts_dir}. Report written to {output_path}")
    return 0


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
        and "1920" in content
        and "1080" in content
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
    if svg_count == 0 or len(motion_markers) == 0 or not has_keyframes:
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
    }
    write_json_output(output_path, result)
    status_str = "PASSED" if passed else "FAILED"
    print(
        f"Deck audit {status_str} ({slide_count} slides, {svg_count} SVGs, {len(emoji_hits)} emojis). Report written to {output_path}"
    )
    return 0 if passed else 1


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

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
