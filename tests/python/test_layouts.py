"""Compositions ported from the frontend-slides layout presets (roadmap NM-21) and the trimmed bundle (decision D4)."""
from __future__ import annotations

import json
import re
import unittest
from pathlib import Path

from _helpers import ROOT, load_deck_helper

dh = load_deck_helper()
CSS = (ROOT / "resources/engine/nm-runtime/nm-layout.css").read_text(encoding="utf-8")


class LayoutsTest(unittest.TestCase):
    def test_every_ported_composition_is_defined_and_accepted_by_the_plan(self):
        names = dh._layout_names()
        for comp in dh.PORTED_LAYOUTS:
            self.assertIn(f".nm-l-{comp}", CSS, comp)
            self.assertIn(comp, names, comp)

    def test_ported_css_uses_logical_properties_only(self):
        ported = CSS.split("Compositions ported from the layout presets", 1)[1]
        physical = re.findall(r"(?<![-\w])(margin|padding|border)-(left|right)\b|(?<![-\w])(left|right)\s*:|text-align:\s*(left|right)", ported)
        self.assertEqual(physical, [], "use inline-start/end so right to left works by itself")

    def test_scaffold_fills_each_ported_composition(self):
        for lang in ("ar", "en"):
            plan = json.loads((ROOT / f"tests/corpus/plans/{lang}-layouts.plan.json").read_text(encoding="utf-8"))
            self.assertTrue(dh.lint_plan(plan)["passed"], lang)
            html, _, _ = dh.render_deck(plan, Path("/nonexistent"), font_files=[])
            for comp in dh.PORTED_LAYOUTS:
                self.assertIn(f"nm-l-{comp}", html, f"{lang}: {comp}")
            self.assertNotIn("has no figure cell", html, f"{lang}: a visual left without a cell")
        self.assertIn('<span class="nm-t-num">٣٨٪</span><p>ماء أقل</p>', (ROOT / "tests/corpus/golden/ar-layouts.scaffold.html").read_text(encoding="utf-8"))

    def test_the_bundle_is_trimmed_and_the_editor_presets_remain(self):
        self.assertFalse((ROOT / "resources/engine/frontend-slides").exists())
        presets = ROOT / "resources/layout-presets"
        ids = re.findall(r"\['([a-z]+/[a-z-]+)'", (ROOT / "editor/src/server/layout-presets.ts").read_text(encoding="utf-8"))
        self.assertEqual(len(ids), 23)
        for pid in ids:
            self.assertTrue((presets / pid / "preview.html").is_file(), pid)
        self.assertTrue((presets / "LICENSE").is_file())


if __name__ == "__main__":
    unittest.main()
