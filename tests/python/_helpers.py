"""Shared fixtures for the deck_helper tests (stdlib only)."""
from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
EXAMPLE_PLAN = ROOT / "resources" / "templates" / "deck.plan.example.json"
SHOWCASE = ROOT / "examples" / "showcase"


def load_deck_helper():
    if "deck_helper" in sys.modules:
        return sys.modules["deck_helper"]
    spec = importlib.util.spec_from_file_location("deck_helper", SCRIPTS / "deck_helper.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules["deck_helper"] = module
    spec.loader.exec_module(module)
    return module


def example_plan() -> dict:
    return copy.deepcopy(json.loads(EXAMPLE_PLAN.read_text(encoding="utf-8")))


def codes(report: dict, level: str = "errors") -> set[str]:
    return {item["code"] for item in report[level]}
