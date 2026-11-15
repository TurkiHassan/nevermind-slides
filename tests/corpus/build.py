#!/usr/bin/env python3
"""Build the golden corpus decks into a folder, exactly as a user's project would look.

    python3 tests/corpus/build.py --out DIR            build every deck into DIR/<name>/deck.html
    python3 tests/corpus/build.py --update             rewrite golden/<name>.scaffold.html (read README.md first)

Plans are scaffolded with NM_FONTS_BUNDLED_ONLY=1 so the output never depends on fonts installed on the machine.
Stdlib only.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS = Path(__file__).resolve().parent
HELPER = ROOT / "scripts" / "deck_helper.py"
GOLDEN = CORPUS / "golden"


def decks() -> list[dict]:
    return json.loads((CORPUS / "corpus.json").read_text(encoding="utf-8"))["decks"]


def _run(*args: str) -> None:
    env = {**os.environ, "NM_FONTS_BUNDLED_ONLY": "1"}
    result = subprocess.run([sys.executable, str(HELPER), *args], capture_output=True, text=True, env=env)
    if result.returncode != 0:
        raise SystemExit(f"deck_helper {' '.join(args[:1])} failed:\n{result.stdout}\n{result.stderr}")


def build(deck: dict, out_root: Path) -> Path:
    """Build one deck into out_root/<name>/ and return the deck.html path."""
    project = out_root / deck["name"]
    if project.exists():
        shutil.rmtree(project)
    src = ROOT / deck["source"]
    if deck["kind"] == "plan":
        project.mkdir(parents=True)
        shutil.copy(src, project / "deck.plan.json")
        _run("scaffold", "--plan", str(project / "deck.plan.json"), "--out", str(project / "deck.html"))
    else:
        def skip(folder: str, names: list[str]) -> set[str]:  # staged copies and local check output are rebuilt
            staged = {"fonts", "nm"} if Path(folder).name == "assets" else set()
            return {n for n in names if n in staged or n == "check-shots" or n.endswith(".bak")}
        shutil.copytree(src, project, ignore=skip)
        _run("stage-fonts", "--target-dir", str(project))
        _run("stage-runtime", "--target-dir", str(project))
    return project / "deck.html"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", help="folder to build the decks into")
    ap.add_argument("--update", action="store_true", help="rewrite the scaffold golden files")
    args = ap.parse_args()
    out = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix="nm-corpus-"))
    out.mkdir(parents=True, exist_ok=True)
    for deck in decks():
        html = build(deck, out)
        print(f"{deck['name']}: {html}")
        if args.update and deck["kind"] == "plan":
            GOLDEN.mkdir(exist_ok=True)
            shutil.copy(html, GOLDEN / f"{deck['name']}.scaffold.html")
            print(f"  updated golden/{deck['name']}.scaffold.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
